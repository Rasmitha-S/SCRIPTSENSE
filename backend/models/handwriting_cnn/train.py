import os
import sys
import random
import numpy as np
import cv2
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader

# Ensure model module can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from model import HandwritingCNN, CHARACTERS, NUM_CLASSES, CHAR_TO_INDEX

def render_char_patch(char: str, font_face: int, font_scale: float, thickness: int, angle: float = 0.0) -> np.ndarray:
    """Renders a single character into a centered 28x28 normalized patch in OpenCV."""
    canvas = np.zeros((36, 36), dtype=np.uint8)
    (tw, th), _ = cv2.getTextSize(char, font_face, font_scale, thickness)
    tx = max(1, (36 - tw) // 2)
    ty = max(th + 2, (36 + th) // 2)
    cv2.putText(canvas, char, (tx, ty), font_face, font_scale, 255, thickness, cv2.LINE_AA)

    if angle != 0:
        M = cv2.getRotationMatrix2D((18, 18), angle, 1.0)
        canvas = cv2.warpAffine(canvas, M, (36, 36), flags=cv2.INTER_LINEAR, borderValue=0)

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

def generate_training_dataset():
    """Generates an augmented character dataset for all vocabulary characters."""
    X_list = []
    y_list = []

    fonts = [
        cv2.FONT_HERSHEY_SIMPLEX,
        cv2.FONT_HERSHEY_DUPLEX,
        cv2.FONT_HERSHEY_COMPLEX,
        cv2.FONT_HERSHEY_TRIPLEX,
        cv2.FONT_HERSHEY_SCRIPT_SIMPLEX,
    ]
    scales = [0.70, 0.85]
    thicknesses = [1, 2]
    angles = [-12.0, -6.0, 0.0, 6.0, 12.0]

    for char_idx, char in enumerate(CHARACTERS):
        for font in fonts:
            for scale in scales:
                for th in thicknesses:
                    for ang in angles:
                        patch = render_char_patch(char, font, scale, th, ang)
                        # Add slight noise augmentation
                        if random.random() < 0.25:
                            noise = np.random.normal(0, 0.02, patch.shape).astype(np.float32)
                            patch = np.clip(patch + noise, 0.0, 1.0)
                        X_list.append(patch)
                        y_list.append(char_idx)

    X = np.array(X_list, dtype=np.float32)[:, np.newaxis, :, :] # (N, 1, 28, 28)
    y = np.array(y_list, dtype=np.int64)
    return X, y

class CharDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.from_numpy(X)
        self.y = torch.from_numpy(y)

    def __len__(self):
        return len(self.y)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

from typing import Optional

def train_and_save_model(output_path: Optional[str] = None, epochs: int = 10, batch_size: int = 64, lr: float = 0.003):
    """
    Trains the HandwritingCNN on augmented character dataset and saves weights.
    """
    if output_path is None:
        output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "handwriting_cnn.pth")

    print(f"[1/3] Generating character dataset for {NUM_CLASSES} classes...")
    X, y = generate_training_dataset()
    print(f"      Dataset ready: {X.shape[0]} samples.")

    dataset = CharDataset(X, y)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = HandwritingCNN(num_classes=NUM_CLASSES).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    print(f"[2/3] Training HandwritingCNN on {device} for {epochs} epochs...")
    model.train()
    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        correct = 0
        total = 0
        for bx, by in dataloader:
            bx, by = bx.to(device), by.to(device)
            optimizer.zero_grad()
            outputs = model(bx)
            loss = criterion(outputs, by)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * len(by)
            _, preds = torch.max(outputs, 1)
            correct += (preds == by).sum().item()
            total += len(by)

        acc = (correct / total) * 100.0
        print(f"      Epoch {epoch:02d}/{epochs:02d} - Loss: {total_loss/total:.4f} - Accuracy: {acc:.2f}%")

    print(f"[3/3] Saving trained model weights to: {output_path}")
    torch.save(model.state_dict(), output_path)
    print("      Model training and checkpoint save completed successfully!")
    return model

if __name__ == "__main__":
    train_and_save_model()
