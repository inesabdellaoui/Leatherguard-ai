# ══════════════════════════════════════════════════════════════════════════════
# predict_api.py — LeatherGuard AI
# API Python FastAPI — Analyse YOLOv8s
# Lancer : uvicorn predict_api:app --host 0.0.0.0 --port 8000 --reload
# ══════════════════════════════════════════════════════════════════════════════

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO
import cv2
import numpy as np
import base64
import os
from pathlib import Path
from datetime import datetime
import json

# ── Initialisation FastAPI ────────────────────────────────────────────────────
app = FastAPI(
    title       = "LeatherGuard AI — Predict API",
    description = "API de détection de défauts sur cuir — YOLOv8s",
    version     = "1.0.0"
)

# ── CORS — autoriser NestJS ───────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Chemins modèles ───────────────────────────────────────────────────────────
# Adaptez selon où vous avez mis vos best.pt
BASE_DIR    = Path(__file__).parent
MODEL_N3    = BASE_DIR / "models" / "best_n3.pt"   # Niveau 3 — défauts BMW
MODEL_N1    = BASE_DIR / "models" / "best_n1.pt"   # Niveau 1 — BMW vs LR

# ── Classes du modèle N3 ──────────────────────────────────────────────────────
# Selon votre data.yaml : ['IO', 'scar']
CLASS_NAMES = {
    0: "IO",    # pièce conforme
    1: "scar",  # cicatrice
}

# ── Chargement des modèles au démarrage ───────────────────────────────────────
print("🔄 Chargement des modèles YOLOv8s...")

model_n3 = None
model_n1 = None

if MODEL_N3.exists():
    model_n3 = YOLO(str(MODEL_N3))
    print(f"✅ Modèle N3 chargé : {MODEL_N3}")
else:
    print(f"❌ Modèle N3 introuvable : {MODEL_N3}")

if MODEL_N1.exists():
    model_n1 = YOLO(str(MODEL_N1))
    print(f"✅ Modèle N1 chargé : {MODEL_N1}")
else:
    print(f"⚠️  Modèle N1 non chargé (optionnel)")

# ── Schémas Pydantic ──────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    image_path   : str | None = None   # chemin disque (prioritaire)
    image_base64 : str | None = None   # base64 (alternatif)
    conf_threshold: float = 0.25       # seuil confiance YOLO
    id_piece     : str | None = None   # pour les logs

class PredictResponse(BaseModel):
    resultat    : str           # "OK" ou "NIO"
    confidence  : float         # confiance de la détection
    type_defaut : str | None    # "scar", "open_area", etc.
    gravite     : str | None    # "Critique", "Majeure", "Mineure"
    bbox_x      : int | None    # coordonnée x centre
    bbox_y      : int | None    # coordonnée y centre
    bbox_w      : int | None    # largeur bounding box
    bbox_h      : int | None    # hauteur bounding box
    nb_defauts  : int           # nombre total de défauts détectés
    model_version: str          # version du modèle utilisé
    details     : list          # détail de toutes les détections

# ── Fonction utilitaire — déterminer gravité ──────────────────────────────────

def determiner_gravite(confidence: float) -> str:
    """
    Détermine la gravité du défaut selon la confiance du modèle.
    Critères alignés avec les référentiels BMW/JLR.
    """
    if confidence >= 0.85:
        return "Critique"
    elif confidence >= 0.60:
        return "Majeure"
    else:
        return "Mineure"

# ── Fonction utilitaire — charger image ───────────────────────────────────────

def charger_image(image_path: str = None,
                  image_base64: str = None) -> np.ndarray:
    """
    Charge une image depuis un chemin disque ou base64.
    Retourne un array numpy (BGR).
    """
    if image_path and os.path.exists(image_path):
        img = cv2.imread(image_path)
        if img is None:
            raise HTTPException(
                status_code = 400,
                detail      = f"Impossible de lire l'image : {image_path}"
            )
        return img

    elif image_base64:
        try:
            # Supprimer le header data:image/jpeg;base64, si présent
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]

            buffer = base64.b64decode(image_base64)
            nparr  = np.frombuffer(buffer, np.uint8)
            img    = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                raise HTTPException(
                    status_code = 400,
                    detail      = "Image base64 invalide"
                )
            return img

        except Exception as e:
            raise HTTPException(
                status_code = 400,
                detail      = f"Erreur décodage base64 : {str(e)}"
            )

    else:
        raise HTTPException(
            status_code = 400,
            detail      = "Fournir image_path ou image_base64"
        )

# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════

# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/")
def health_check():
    return {
        "status"       : "running",
        "model_n3"     : "loaded" if model_n3 else "not found",
        "model_n1"     : "loaded" if model_n1 else "not found",
        "version"      : "1.0.0"
    }

@app.get("/health")
def health():
    return {
        "status"   : "ok",
        "models"   : {
            "n3"   : str(MODEL_N3) if model_n3 else None,
            "n1"   : str(MODEL_N1) if model_n1 else None,
        },
        "classes"  : CLASS_NAMES,
        "timestamp": datetime.now().isoformat()
    }

# ── Route principale — Prédiction ─────────────────────────────────────────────

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    """
    Analyse une image de pièce coupée et retourne le résultat IO/NIO.

    Flux :
    1. Charger l'image (chemin ou base64)
    2. Passer par YOLOv8s Niveau 3 (détection défauts)
    3. Analyser les détections
    4. Retourner résultat + bounding box du défaut principal
    """

    # ── Vérifier que le modèle est chargé ─────────────────────────
    if model_n3 is None:
        raise HTTPException(
            status_code = 503,
            detail      = "Modèle N3 non disponible — vérifiez best_n3.pt"
        )

    # ── Charger l'image ───────────────────────────────────────────
    img = charger_image(req.image_path, req.image_base64)

    # ── Redimensionner si nécessaire ──────────────────────────────
    h, w = img.shape[:2]
    if w != 640 or h != 640:
        img = cv2.resize(img, (640, 640))

    # ── Inférence YOLOv8s ─────────────────────────────────────────
    results = model_n3(
        img,
        conf    = req.conf_threshold,
        verbose = False
    )[0]

    boxes = results.boxes

    # ── Aucune détection → pièce conforme IO ──────────────────────
    if boxes is None or len(boxes) == 0:
        print(f"✅ {req.id_piece or 'Pièce'} → IO (aucun défaut)")
        return PredictResponse(
            resultat     = "OK",
            confidence   = 0.95,
            type_defaut  = None,
            gravite      = None,
            bbox_x       = None,
            bbox_y       = None,
            bbox_w       = None,
            bbox_h       = None,
            nb_defauts   = 0,
            model_version= "yolov8s-v1",
            details      = []
        )

    # ── Analyser toutes les détections ────────────────────────────
    details = []
    defauts_detectes = []

    for box in boxes:
        cls_id  = int(box.cls[0])
        conf    = float(box.conf[0])
        x, y, bw, bh = box.xywh[0].tolist()
        cls_name= CLASS_NAMES.get(cls_id, "inconnu")

        details.append({
            "classe"    : cls_name,
            "confidence": round(conf, 4),
            "bbox_x"    : round(x),
            "bbox_y"    : round(y),
            "bbox_w"    : round(bw),
            "bbox_h"    : round(bh)
        })

        # Ignorer les détections IO (classe 0)
        if cls_id != 0:
            defauts_detectes.append({
                "cls_id"    : cls_id,
                "cls_name"  : cls_name,
                "confidence": conf,
                "bbox_x"    : round(x),
                "bbox_y"    : round(y),
                "bbox_w"    : round(bw),
                "bbox_h"    : round(bh)
            })

    # ── Pièce conforme si tous les défauts sont de classe IO ──────
    if not defauts_detectes:
        print(f"✅ {req.id_piece or 'Pièce'} → IO (classe IO détectée)")
        return PredictResponse(
            resultat     = "OK",
            confidence   = max(d["confidence"] for d in details),
            type_defaut  = None,
            gravite      = None,
            bbox_x       = None,
            bbox_y       = None,
            bbox_w       = None,
            bbox_h       = None,
            nb_defauts   = 0,
            model_version= "yolov8s-v1",
            details      = details
        )

    # ── Prendre le défaut avec la plus haute confiance ────────────
    best_defaut = max(defauts_detectes, key=lambda d: d["confidence"])

    gravite = determiner_gravite(best_defaut["confidence"])

    print(
        f"❌ {req.id_piece or 'Pièce'} → NIO | "
        f"Défaut : {best_defaut['cls_name']} | "
        f"Confiance : {best_defaut['confidence']:.1%} | "
        f"Gravité : {gravite}"
    )

    return PredictResponse(
        resultat     = "NIO",
        confidence   = round(best_defaut["confidence"], 4),
        type_defaut  = best_defaut["cls_name"],
        gravite      = gravite,
        bbox_x       = best_defaut["bbox_x"],
        bbox_y       = best_defaut["bbox_y"],
        bbox_w       = best_defaut["bbox_w"],
        bbox_h       = best_defaut["bbox_h"],
        nb_defauts   = len(defauts_detectes),
        model_version= "yolov8s-v1",
        details      = details
    )

# ── Route test — vérifier avec une image de test ──────────────────────────────

@app.get("/test")
def test_model():
    """
    Vérifie que le modèle fonctionne avec une image noire de test.
    """
    if model_n3 is None:
        return { "status": "error", "message": "Modèle non chargé" }

    try:
        img_test = np.zeros((640, 640, 3), dtype=np.uint8)
        results  = model_n3(img_test, verbose=False)[0]
        return {
            "status"       : "ok",
            "message"      : "Modèle opérationnel",
            "model_path"   : str(MODEL_N3),
            "nb_classes"   : len(CLASS_NAMES),
            "classes"      : CLASS_NAMES,
            "test_detections": len(results.boxes) if results.boxes else 0
        }
    except Exception as e:
        return { "status": "error", "message": str(e) }

# ── Route statistiques ────────────────────────────────────────────────────────

@app.get("/stats")
def get_stats():
    """
    Informations sur les modèles chargés.
    """
    return {
        "model_n3": {
            "path"    : str(MODEL_N3),
            "loaded"  : model_n3 is not None,
            "classes" : CLASS_NAMES,
            "task"    : "Détection défauts BMW (IO vs scar)"
        },
        "model_n1": {
            "path"    : str(MODEL_N1),
            "loaded"  : model_n1 is not None,
            "task"    : "Classification BMW vs Land Rover"
        },
        "seuils_gravite": {
            "Critique": ">= 0.85",
            "Majeure" : ">= 0.60",
            "Mineure" : "< 0.60"
        }
    }