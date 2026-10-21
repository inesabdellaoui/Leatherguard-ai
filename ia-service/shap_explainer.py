# ia-service/shap_explainer.py

import matplotlib
matplotlib.use('Agg')  # ← CRITIQUE : pas de GUI, backend non-interactif

import matplotlib.pyplot as plt
import numpy as np
import cv2
import os
from datetime import datetime
from ultralytics import YOLO


class SHAPExplainer:

    def __init__(self):
        os.makedirs("shap_outputs", exist_ok=True)
        print("✅ SHAPExplainer initialisé")

    def explain(self, image_path: str, model: YOLO,
                id_piece: str) -> str:
        try:
            # ── Charger et redimensionner en 640x640 ─────────────
            img_bgr = cv2.imread(image_path)
            if img_bgr is None:
                print(f"⚠️  SHAP : impossible de lire {image_path}")
                return None

            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            img_640 = cv2.resize(img_rgb, (640, 640))  # ← toujours 640x640
            print(f"   SHAP image redimensionnée : {img_640.shape}")

            # ── Heatmap par occlusion (patch 80, stride 40) ───────
            heatmap = self._occlusion_heatmap(
                img_640, model, patch_size=80, stride=40
            )

            # ── Inférence pour annotation bbox ───────────────────
            results = model(img_640, conf=0.15, verbose=False)[0]

            # ── Sauvegarder la figure ─────────────────────────────
            output_path = self._save_figure(
                img_rgb    = img_640,
                heatmap    = heatmap,
                results    = results,
                id_piece   = id_piece
            )

            return output_path

        except Exception as e:
            print(f"⚠️  SHAP erreur : {e}")
            import traceback
            traceback.print_exc()
            return None

    def _occlusion_heatmap(self, img: np.ndarray, model: YOLO,
                            patch_size: int = 80,
                            stride: int = 40) -> np.ndarray:
        H, W = img.shape[:2]
        heatmap = np.zeros((H, W), dtype=np.float32)
        count   = np.zeros((H, W), dtype=np.float32)

        # Confidence de base
        base_results = model(img, conf=0.01, verbose=False)[0]
        base_conf    = self._max_confidence(base_results)
        print(f"   SHAP base_conf={base_conf:.3f}")

        n_patches = 0
        for y in range(0, H - patch_size + 1, stride):
            for x in range(0, W - patch_size + 1, stride):
                img_occ = img.copy()
                img_occ[y:y+patch_size, x:x+patch_size] = 128

                occ_results = model(img_occ, conf=0.01, verbose=False)[0]
                occ_conf    = self._max_confidence(occ_results)

                impact = max(0.0, base_conf - occ_conf)
                heatmap[y:y+patch_size, x:x+patch_size] += impact
                count  [y:y+patch_size, x:x+patch_size] += 1
                n_patches += 1

        print(f"   SHAP : {n_patches} patches traités")

        count   = np.maximum(count, 1)
        heatmap = heatmap / count
        vmin, vmax = heatmap.min(), heatmap.max()
        if vmax - vmin > 1e-8:
            heatmap = (heatmap - vmin) / (vmax - vmin)
        else:
            heatmap = np.zeros_like(heatmap)

        return heatmap

    def _max_confidence(self, results) -> float:
        boxes = results.boxes
        if boxes is None or len(boxes) == 0:
            return 0.0
        return float(max(float(b.conf[0]) for b in boxes))

    def _save_figure(self, img_rgb: np.ndarray, heatmap: np.ndarray,
                     results, id_piece: str) -> str:

        date_str = datetime.now().strftime('%Y/%m/%d')
        out_dir  = os.path.join("shap_outputs", date_str)
        os.makedirs(out_dir, exist_ok=True)

        timestamp = datetime.now().strftime('%H%M%S')
        out_path  = os.path.join(out_dir, f'{id_piece}_{timestamp}_shap.png')

        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        fig.patch.set_facecolor('#0D1B2A')

        # ── Panneau 1 : Détection YOLOv8 ─────────────────────────
        img_ann = results.plot(line_width=2)
        axes[0].imshow(img_ann[:, :, ::-1])
        axes[0].set_title('Détection YOLOv8s',
                           color='white', fontsize=12, fontweight='bold')
        axes[0].axis('off')

        # ── Panneau 2 : Heatmap SHAP ──────────────────────────────
        heatmap_color = cv2.applyColorMap(
            (heatmap * 255).astype(np.uint8), cv2.COLORMAP_JET
        )
        axes[1].imshow(heatmap_color[:, :, ::-1])
        axes[1].set_title('Carte SHAP\n(Rouge = zone décisive)',
                           color='white', fontsize=12, fontweight='bold')
        axes[1].axis('off')

        # ── Panneau 3 : Superposition ─────────────────────────────
        img_float  = img_rgb.astype(float) / 255.0
        heat_float = heatmap_color[:, :, ::-1].astype(float) / 255.0
        overlay    = np.clip(0.55 * img_float + 0.45 * heat_float, 0, 1)
        axes[2].imshow(overlay)
        axes[2].set_title('Superposition\n(Explication décision IA)',
                           color='white', fontsize=12, fontweight='bold')
        axes[2].axis('off')

        fig.suptitle(
            f'LeatherGuard AI — Explication SHAP\n'
            f'Pièce : {id_piece} — Défaut détecté',
            color='white', fontsize=13, fontweight='bold', y=1.02
        )

        plt.tight_layout()
        plt.savefig(out_path, dpi=120, bbox_inches='tight',
                    facecolor='#0D1B2A')
        plt.close(fig)  # ← fermer explicitement

        print(f"✅ SHAP sauvegardé : {out_path}")
        return out_path