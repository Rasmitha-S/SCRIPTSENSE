import os
import sys
from typing import List, Optional
import numpy as np
import torch
import torch.nn.functional as F

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from model import HandwritingCNN, CHARACTERS, NUM_CLASSES, INDEX_TO_CHAR, CHAR_TO_INDEX

_cached_model: Optional[HandwritingCNN] = None

def load_model(weights_path: Optional[str] = None) -> HandwritingCNN:
    """
    Loads and caches the trained HandwritingCNN model.
    """
    global _cached_model
    if _cached_model is not None:
        return _cached_model

    if weights_path is None:
        weights_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "handwriting_cnn.pth")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = HandwritingCNN(num_classes=NUM_CLASSES).to(device)

    if os.path.exists(weights_path):
        checkpoint = torch.load(weights_path, map_location=device)
        model.load_state_dict(checkpoint)
        print(f"[CNN INFERENCE] Loaded trained weights from: {weights_path}")
    else:
        print(f"[CNN INFERENCE WARNING] Weights not found at '{weights_path}'. Training model automatically...")
        from train import train_and_save_model
        train_and_save_model(output_path=weights_path)
        checkpoint = torch.load(weights_path, map_location=device)
        model.load_state_dict(checkpoint)

    model.eval()
    _cached_model = model
    return _cached_model


def predict_character_patches(model: HandwritingCNN, patches: List[np.ndarray]) -> List[str]:
    """
    Runs batched inference on a list of 28x28 normalized float32 character patches.
    Returns: List of predicted character strings.
    """
    if not patches:
        return []

    device = next(model.parameters()).device

    # Stack patches into tensor: (N, 1, 28, 28)
    batch_np = np.stack(patches, axis=0)[:, np.newaxis, :, :]
    batch_tensor = torch.from_numpy(batch_np).to(device)

    with torch.no_grad():
        logits = model(batch_tensor)
        probs = F.softmax(logits, dim=1)
        preds = torch.argmax(probs, dim=1).cpu().numpy()

    predicted_chars = [INDEX_TO_CHAR.get(int(idx), "") for idx in preds]
    return predicted_chars
