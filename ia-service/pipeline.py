# ia-service/pipeline.py
# LeatherGuard AI — Pipeline 3 niveaux
# N1 : YOLOv8s  (marque BMW/LR)
# N2 : PatchCore (IO/NIO)
# N3 : EfficientNet-B0 (scar/wrinkle)

import os
import cv2
import numpy as np
import pickle
import faiss
import torch
import torch.nn as nn
import torch.nn.functional as F
import timm

from PIL import Image
from torchvision import models, transforms
from ultralytics import YOLO
from shap_explainer import SHAPExplainer

# ─────────────────────────────────────────────────────────────────
# Constantes
# ─────────────────────────────────────────────────────────────────
CLASS_NAMES = ["scar", "wrinkle"]

# ─────────────────────────────────────────────────────────────────
# Modèle EfficientNet-B0 (même architecture que l'entraînement)
# ─────────────────────────────────────────────────────────────────
class LeatherClassifier(nn.Module):
    def __init__(self, backbone, head):
        super().__init__()
        self.backbone = backbone
        self.head     = head

    def forward(self, x):
        return self.head(self.backbone.forward_features(x))


def _build_efficientnet() -> LeatherClassifier:
    backbone   = timm.create_model("efficientnet_b0", pretrained=False, num_classes=0)
    n_features = backbone.num_features
    head = nn.Sequential(
        nn.AdaptiveAvgPool2d(1), nn.Flatten(),
        nn.Dropout(0.3),
        nn.Linear(n_features, 256),
        nn.ReLU(),
        nn.Dropout(0.15),
        nn.Linear(256, 2)
    )
    return LeatherClassifier(backbone, head)


# ─────────────────────────────────────────────────────────────────
# Pipeline principal
# ─────────────────────────────────────────────────────────────────
class LeatherGuardPipeline:

    def __init__(self):
        print("🔄 Chargement des modèles...")

        # ── N1 : YOLOv8s marque ──────────────────────────────────
        self.model_n1 = YOLO("models/n1_bmw_lr/best.pt")
        print("✅ N1 BMW/LR chargé")

        # ── N2 : PatchCore ───────────────────────────────────────
        with open("models/patchcore/config.pkl", "rb") as f:
            pc_cfg = pickle.load(f)

        self.pc_threshold   = float(pc_cfg["threshold"])    # 0.3163
        self.pc_image_size  = int(pc_cfg["image_size"])     # 224
        self.pc_backbone    = pc_cfg["backbone_name"]       # wide_resnet50_2
        self.pc_n_neighbors = int(pc_cfg["n_neighbors"])    # 3

        self.coreset_bank = np.load("models/patchcore/coreset_bank.npy")
        self.faiss_index  = faiss.read_index("models/patchcore/faiss_index.faiss")
        print(f"✅ N2 PatchCore chargé — seuil={self.pc_threshold:.4f}")

        # Backbone PatchCore pour extraction features
        self._pc_backbone_model = self._load_patchcore_backbone()
        print("✅ N2 Backbone PatchCore prêt")

        # ── N3 : EfficientNet-B0 ─────────────────────────────────
        self.model_n3 = _build_efficientnet()
        checkpoint = torch.load(
            "models/n3_efficientnet/best_efficientnet_b0.pt",
            map_location="cpu"
        )
        self.model_n3.load_state_dict(checkpoint["model_state"])
        self.model_n3.eval()
        print("✅ N3 EfficientNet-B0 chargé — Acc=91.9%")

        # ── Transforms ───────────────────────────────────────────
        self.pc_transform = transforms.Compose([
            transforms.Resize((self.pc_image_size, self.pc_image_size)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406],
                                  [0.229, 0.224, 0.225])
        ])
        self.n3_transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406],
                                  [0.229, 0.224, 0.225])
        ])

        # ── SHAP ─────────────────────────────────────────────────
        self.shap = SHAPExplainer()
        print("✅ SHAP Explainer prêt")
        print("✅ Pipeline LeatherGuard AI prêt\n")

    # ─────────────────────────────────────────────────────────────
    # Backbone PatchCore (wide_resnet50_2)
    # ─────────────────────────────────────────────────────────────
    def _load_patchcore_backbone(self):
        backbone = models.wide_resnet50_2(pretrained=False)
        backbone.eval()
        return backbone

    def _extract_patch_embeddings(self, pil_img: Image.Image) -> np.ndarray:
        """Extrait les embeddings de patches via wide_resnet50_2."""
        tensor = self.pc_transform(pil_img).unsqueeze(0)  # [1,3,224,224]

        features = []

        def hook_fn(module, input, output):
            features.append(output.detach())

        # Hook sur layer2 et layer3 (comme PatchCore standard)
        h2 = self.pc_backbone_model.layer2.register_forward_hook(hook_fn)
        h3 = self.pc_backbone_model.layer3.register_forward_hook(hook_fn)

        with torch.no_grad():
            self.pc_backbone_model(tensor)

        h2.remove()
        h3.remove()

        # Interpoler au même spatial size et concaténer
        f2 = F.interpolate(features[0], size=(28, 28), mode="bilinear",
                           align_corners=False)
        f3 = F.interpolate(features[1], size=(28, 28), mode="bilinear",
                           align_corners=False)

        combined = torch.cat([f2, f3], dim=1)  # [1, C, 28, 28]
        # Reshape → [784, C]
        B, C, H, W = combined.shape
        patches = combined.permute(0, 2, 3, 1).reshape(-1, C).numpy()
        return patches.astype(np.float32)

    @property
    def pc_backbone_model(self):
        return self._pc_backbone_model

    # ─────────────────────────────────────────────────────────────
    # Calcul score anomalie PatchCore
    # ─────────────────────────────────────────────────────────────
    def _patchcore_score(self, pil_img: Image.Image):
        """
        Retourne (score, score_map_2d).
        score > threshold → NIO
        """
        patches = self._extract_patch_embeddings(pil_img)  # [784, C]

        # KNN dans FAISS
        distances, _ = self.faiss_index.search(patches, self.pc_n_neighbors)
        # Score patch = distance max au plus proche voisin
        patch_scores = distances[:, 0]  # distance au 1er voisin

        # Score image = max des scores de patches
        score = float(patch_scores.max())

        # Score map 2D (28x28)
        score_map = patch_scores.reshape(28, 28)
        return score, score_map

    # ─────────────────────────────────────────────────────────────
    # Crop zone suspecte à partir de la score map
    # ─────────────────────────────────────────────────────────────
    def _crop_suspicious(self, pil_img: Image.Image,
                         score_map: np.ndarray) -> Image.Image:
        """
        Crop la zone de l'image avec le score anomalie le plus élevé.
        """
        W, H = pil_img.size
        sm_norm = (score_map - score_map.min()) / \
                  (score_map.max() - score_map.min() + 1e-8)

        # Position du patch maximum
        idx = np.argmax(sm_norm)
        py, px = divmod(idx, 28)

        # Convertir coordonnées patch → pixels
        pw = W // 28
        ph = H // 28
        cx = int(px * pw + pw / 2)
        cy = int(py * ph + ph / 2)

        # Crop centré ± 30% de l'image
        half_w = int(W * 0.30)
        half_h = int(H * 0.30)
        x1 = max(0, cx - half_w)
        y1 = max(0, cy - half_h)
        x2 = min(W, cx + half_w)
        y2 = min(H, cy + half_h)

        return pil_img.crop((x1, y1, x2, y2))

    # ─────────────────────────────────────────────────────────────
    # N3 : Classification EfficientNet-B0
    # ─────────────────────────────────────────────────────────────
    def _classify_defect(self, crop: Image.Image) -> dict:
        """
        Classifie le crop en scar ou wrinkle.
        Retourne {type_defaut, conf_n3}
        """
        tensor = self.n3_transform(crop).unsqueeze(0)
        with torch.no_grad():
            output = self.model_n3(tensor)
            probs  = torch.softmax(output, dim=1)[0]
            idx    = int(probs.argmax().item())
            conf   = float(probs.max().item())

        return {
            "type_defaut": CLASS_NAMES[idx],
            "conf_n3"    : round(conf, 4)
        }

    # ─────────────────────────────────────────────────────────────
    # PIPELINE PRINCIPAL
    # ─────────────────────────────────────────────────────────────
    def run(self, image_path: str, id_piece: str,
            generate_shap: bool = True) -> dict:

        print(f"\n{'='*55}")
        print(f"📂 Image : {image_path}")
        print(f"   Existe : {os.path.exists(image_path)}")
        if os.path.exists(image_path):
            print(f"   Taille : {os.path.getsize(image_path)} octets")
        print(f"{'='*55}\n")

        # ── Validation image ──────────────────────────────────────
        if not image_path or not os.path.exists(image_path):
            return self._inconnu("Image introuvable — réessayez")
        if os.path.getsize(image_path) < 1000:
            return self._inconnu("Image invalide — réessayez")

        img_cv = cv2.imread(image_path)
        if img_cv is None:
            return self._inconnu("Image illisible — réessayez")

        img_rgb = cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        print(f"✅ Image lue : {img_cv.shape}")

        # ── N1 : Détection marque ─────────────────────────────────
        print("🔄 N1 — Détection marque...")
        res_n1   = self.model_n1(img_cv, conf=0.10, verbose=False)[0]
        boxes_n1 = res_n1.boxes

        if boxes_n1 and len(boxes_n1) > 0:
            conf_n1 = float(boxes_n1.conf[0])
            cls_n1  = int(boxes_n1.cls[0])
            marque  = "BMW" if cls_n1 == 0 else "LandRover"
            print(f"   cls={cls_n1} conf={conf_n1:.2f} → {marque}")
        else:
            conf_n1 = 0.0
            marque  = "BMW"
            print("   ⚠️  Aucune détection → BMW par défaut")

        if 0 < conf_n1 < 0.25:
            print(f"⚠️  Confiance trop faible ({conf_n1:.2f}) → INCONNU")
            return self._inconnu(
                "Pièce non reconnue — repositionnez et réessayez"
            )

        print(f"✅ Marque : {marque} (conf={conf_n1:.2f})")

        # ── LandRover → IO direct (pas de modèle N3 LR) ──────────
        if marque == "LandRover":
            print("ℹ️  LandRover → pipeline arrêté après N1 → IO")
            return {
                "marque"         : marque,
                "resultat"       : "IO",
                "confidence"     : round(conf_n1, 4),
                "type_defaut"    : None,
                "gravite"        : None,
                "bbox_x"         : None,
                "bbox_y"         : None,
                "bbox_w"         : None,
                "bbox_h"         : None,
                "shap_image_path": None,
                "model_version"  : "patchcore+efficientnet-v1",
                "message"        : "Land Rover — modèle N3 non appliqué"
            }

        # ── N2 : PatchCore IO/NIO (BMW uniquement) ────────────────
        print("🔄 N2 — PatchCore classification IO/NIO...")
        score, score_map = self._patchcore_score(pil_img)
        print(f"   Score anomalie = {score:.4f} | Seuil = {self.pc_threshold:.4f}")

        if score <= self.pc_threshold:
            print("✅ N2 → IO (pièce conforme)")
            return {
                "marque"         : marque,
                "resultat"       : "IO",
                "confidence"     : round(conf_n1, 4),
                "type_defaut"    : None,
                "gravite"        : None,
                "bbox_x"         : None,
                "bbox_y"         : None,
                "bbox_w"         : None,
                "bbox_h"         : None,
                "shap_image_path": None,
                "model_version"  : "patchcore+efficientnet-v1",
                "message"        : None
            }

        print(f"❌ N2 → NIO (score={score:.4f} > seuil={self.pc_threshold:.4f})")

        # ── N2b : Crop zone suspecte ──────────────────────────────
        print("🔄 N2b — Crop zone suspecte...")
        crop = self._crop_suspicious(pil_img, score_map)
        print(f"   Crop size : {crop.size}")

        # ── N3 : EfficientNet-B0 type défaut ─────────────────────
        print("🔄 N3 — EfficientNet-B0 classification défaut...")
        n3_result   = self._classify_defect(crop)
        type_defaut = n3_result["type_defaut"]
        conf_n3     = n3_result["conf_n3"]
        gravite     = self._gravite(conf_n3)
        print(f"   → {type_defaut} (conf={conf_n3:.2f}) gravité={gravite}")

        # ── SHAP ──────────────────────────────────────────────────
        shap_path = None
        if generate_shap:
            print("🔄 SHAP — Génération carte d'explication...")
            try:
                shap_path = self.shap.explain(
                    image_path=image_path,
                    model=self.model_n1,
                    id_piece=id_piece
                )
                # Convertir en chemin absolu
                if shap_path:
                    shap_path = os.path.abspath(shap_path)
                print(f"✅ SHAP sauvegardé : {shap_path}")
            except Exception as e:
                print(f"⚠️  SHAP erreur : {e}")
                shap_path = None

        print(f"\n✅ Résultat final : NIO | {type_defaut} | {gravite}")

        return {
            "marque"         : marque,
            "resultat"       : "NIO",
            "confidence"     : conf_n3,
            "type_defaut"    : type_defaut,
            "gravite"        : gravite,
            "bbox_x"         : None,
            "bbox_y"         : None,
            "bbox_w"         : None,
            "bbox_h"         : None,
            "shap_image_path": shap_path,
            "model_version"  : "patchcore+efficientnet-v1",
            "message"        : None
        }

    # ─────────────────────────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────────────────────────
    def _inconnu(self, message: str) -> dict:
        return {
            "marque"         : "INCONNU",
            "resultat"       : "INCONNU",
            "confidence"     : 0.0,
            "type_defaut"    : None,
            "gravite"        : None,
            "bbox_x"         : None,
            "bbox_y"         : None,
            "bbox_w"         : None,
            "bbox_h"         : None,
            "shap_image_path": None,
            "model_version"  : "patchcore+efficientnet-v1",
            "message"        : message
        }

    def _gravite(self, conf: float) -> str:
        if conf >= 0.85: return "Critique"
        if conf >= 0.60: return "Majeure"
        return "Mineure"

    def get_status(self) -> dict:
        return {
            "status": "running",
            "models": {
                "n1"      : "YOLOv8s BMW/LR — mAP50=99.5%",
                "n2"      : f"PatchCore — AUROC=0.741 seuil={self.pc_threshold:.4f}",
                "n3"      : "EfficientNet-B0 — Acc=91.9%"
            },
            "pipeline": "N1→N2→N2b(crop)→N3",
            "shap"    : "enabled"
        }