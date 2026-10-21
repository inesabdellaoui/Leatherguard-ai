# Model weights

The trained weights are **not included** in this repository: they were trained on DRÄXLMAIER's industrial images and belong to the company.

To run the IA service, place the weights in this folder with the following layout:

```
models/
├── n1_bmw_lr/          N1 — YOLOv8s customer identification (BMW / Land Rover)
├── patchcore/          N2 — PatchCore memory bank (wide_resnet50_2 features, FAISS index)
└── n3_efficientnet/    N3 — EfficientNet-B0 defect classifier (scar / wrinkle)
```

| Model | Training setup |
|---|---|
| N1 · YOLOv8s | 300 epochs, imgsz 1280, batch 8, lr0 0.0003, confidence threshold 0.25 |
| N2 · PatchCore | wide_resnet50_2 backbone, 224 px, coreset ratio 5%, k = 3, decision threshold 0.3163 |
| N3 · EfficientNet-B0 | 224 px, 50 epochs, batch 16, lr 0.001 (backbone 0.0001), dropout 0.3, label smoothing 0.1, mixup 0.2, backbone unfrozen at epoch 10 |

All models were trained on a Kaggle Tesla T4 GPU.
