# ia-service/predict_api.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pipeline import LeatherGuardPipeline
import uvicorn

#l'objet fastAPI a l'interieur :
app = FastAPI(title="LeatherGuard AI", version="1.0.0") 

app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Servir les cartes SHAP comme fichiers statiques
app.mount("/shap", StaticFiles(directory="shap_outputs"), name="shap")

# Charger le pipeline au démarrage
pipeline = LeatherGuardPipeline()

class PredictRequest(BaseModel):
    image_path   : str
    id_piece     : str
    generate_shap: bool = True  # activer SHAP seulement si NIO

@app.get("/health")
def health():
    return pipeline.get_status()

@app.post("/predict")
def predict(req: PredictRequest):
    return pipeline.run(
        image_path    = req.image_path,
        id_piece      = req.id_piece,
        generate_shap = req.generate_shap
    )