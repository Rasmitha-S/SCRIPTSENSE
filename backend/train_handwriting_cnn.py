import os
import sys
import numpy as np
import cv2
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from models.handwriting_cnn.model import HandwritingCNN, CHARACTERS, NUM_CLASSES

def render_char_28x28(char: str, font_face: int, font_scale: float, thickness: int, angle: float = 0.0) -> np.ndarray:
    """Renders a character directly to 28x28 normalized patch in OpenCV."""
    canvas = np.zeros((36, 36), dtype=np.uint8)
    (tw, th), baseline = cv2.getTextSize(char, font_face, font_scale, thickness)
    tx = max(1, (36 - tw) // 2)
    ty = max(th + 2, (36 + th) // 2)
    cv2.putText(canvas, char, (tx, ty), font_face, font_scale, 255, thickness, cv2.LINE_AA)

    if angle != 0:
        M = cv2.getRotationMatrix2D((18, 18), angle, 1.0)
        canvas = cv2.warpAffine(canvas, M, (36, 36), flags=cv2.INTER_LINEAR, borderValue=0)

    # Crop to content
    non_zeros = np.argwhere(canvas > 30)
    patch = np.zeros((28, 28), dtype=np.float32)
    if non_zeros.size > 0:
        y_min, x_min = non_zeros.min(axis=0)
        y_max, x_max = non_zeros.max(axis=0) + 1
        crop = canvas[y_min:y_max, x_min:x_max]
        ch, cw = crop.shape[:2]
        if ch > 0 and cw > 0:
            scale = 20.0 / max(ch, cw)
            new_w = max(1, int(round(cw * scale)))
            new_h = max(1, int(round(ch * scale)))
            resized = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_AREA)
            sx = (28 - new_w) // 2
            sy = (28 - new_h) // 2
            patch[sy:sy+new_h, sx:sx+new_w] = resized.astype(np.float32) / 255.0

    return patch

def fast_generate_dataset():
    X_list = []
    y_list = []

    fonts = [
        cv2.FONT_HERSHEY_SIMPLEX,
        cv2.FONT_HERSHEY_DUPLEX,
        cv2.FONT_HERSHEY_COMPLEX,
        cv2.FONT_HERSHEY_TRIPLEX,
        cv2.FONT_HERSHEY_SCRIPT_SIMPLEX,
    ]
    scales = [0.7, 0.85]
    thicknesses = [1, 2]
    angles = [-10.0, 0.0, 10.0]

    for char_idx, char in enumerate(CHARACTERS):
        for font in fonts:
            for scale in scales:
                for th in thicknesses:
                    for ang in angles:
                        p = render_char_28x28(char, font, scale, th, ang)
                        X_list.append(p)
                        y_list.append(char_idx)

    X = np.array(X_list, dtype=np.float32)[:, np.newaxis, :, :] # (N, 1, 28, 28)
    y = np.array(y_list, dtype=np.int64)
    return X, y

def train_and_save():
    models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
    os.makedirs(models_dir, exist_ok=True)
    save_path = os.path.join(models_dir, "handwriting_cnn.pth")

    print("[1/3] Generating character dataset...")
    X, y = fast_generate_dataset()
    print(f"      Dataset ready: {X.shape[0]} samples across {NUM_CLASSES} classes.")

    tensor_x = torch.from_numpy(X)
    tensor_y = torch.from_numpy(y)
    dataset = torch.utils.data.TensorDataset(tensor_x, tensor_y)
    loader = DataLoader(dataset, batch_size=64, shuffle=True)

    model = HandwritingCNN(num_classes=NUM_CLASSES)
    model.train()
    optimizer = optim.Adam(model.parameters(), lr=0.003)
    criterion = nn.CrossEntropyLoss()

    print("[2/3] Training HandwritingCNN...")
    for epoch in range(1, 8):
        total_loss = 0.0
        correct = 0
        total = 0
        for bx, by in loader:
            optimizer.zero_grad()
            out = model(bx)
            loss = criterion(out, by)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(by)
            _, p = torch.max(out, 1)
            correct += (p == by).sum().item()
            total += len(by)

        acc = (correct / total) * 100.0
        print(f"      Epoch {epoch}/7 - Loss: {total_loss/total:.4f} - Accuracy: {acc:.1f}%")

    print(f"[3/3] Saving weights to: {save_path}")
    torch.save(model.state_dict(), save_path)
    print("Done!")

if __name__ == "__main__":
    train_and_save()
