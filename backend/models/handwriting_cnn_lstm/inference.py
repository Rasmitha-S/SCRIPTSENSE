import os
import sys
from typing import List, Optional, Union
import numpy as np
import torch
from PIL import Image

try:
    from .model import CRNNHandwritingModel
    from .labels import ctc_greedy_decode, NUM_CLASSES
except ImportError:
    from model import CRNNHandwritingModel
    from labels import ctc_greedy_decode, NUM_CLASSES


_cached_crnn_model: Optional[CRNNHandwritingModel] = None

def load_crnn_model(weights_path: Optional[str] = None) -> CRNNHandwritingModel:
    """
    Loads and caches the trained CRNN (CNN + BiLSTM) model.
    """
    global _cached_crnn_model
    if _cached_crnn_model is not None:
        return _cached_crnn_model

    if weights_path is None:
        weights_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saved_model", "crnn_handwriting.pth")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = CRNNHandwritingModel(num_classes=NUM_CLASSES).to(device)

    if os.path.exists(weights_path):
        checkpoint = torch.load(weights_path, map_location=device)
        model.load_state_dict(checkpoint)
        print(f"[CRNN INFERENCE] Loaded trained CNN+BiLSTM weights from: {weights_path}")
    else:
        print(f"[CRNN INFERENCE WARNING] Weights not found at '{weights_path}'. Running automatic training pipeline...")
        from train import train_crnn_model
        train_crnn_model(saved_model_path=weights_path)
        checkpoint = torch.load(weights_path, map_location=device)
        model.load_state_dict(checkpoint)

    model.eval()
    _cached_crnn_model = model
    return _cached_crnn_model


def recognize_line_image(model: CRNNHandwritingModel, line_img_np: np.ndarray) -> str:
    """
    Runs CNN + BiLSTM inference and CTC sequence decoding on a single line image (32, W).
    """
    if line_img_np is None or line_img_np.size == 0:
        return ""

    device = next(model.parameters()).device
    # Ensure line_img_np is (1, 1, 32, W)
    if line_img_np.ndim == 2:
        tensor_input = torch.from_numpy(line_img_np).unsqueeze(0).unsqueeze(0).to(device)
    elif line_img_np.ndim == 3:
        tensor_input = torch.from_numpy(line_img_np).unsqueeze(0).to(device)
    else:
        tensor_input = torch.from_numpy(line_img_np).to(device)

    with torch.no_grad():
        # Forward pass through CNN + BiLSTM -> (T, 1, num_classes)
        logits = model(tensor_input)
        # Permute to (B=1, T, num_classes)
        probs = logits.permute(1, 0, 2)
        decoded_list = ctc_greedy_decode(probs)

    return decoded_list[0] if decoded_list else ""


def recognize_batch_lines(model: CRNNHandwritingModel, line_imgs: List[np.ndarray]) -> List[str]:
    """
    Runs inference on a list of line images.
    """
    results: List[str] = []
    for img in line_imgs:
        text = recognize_line_image(model, img)
        if text:
            results.append(text)
    return results
