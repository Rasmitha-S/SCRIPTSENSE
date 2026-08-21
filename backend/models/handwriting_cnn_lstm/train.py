import os
import sys
import random
from typing import List, Tuple
import numpy as np
import cv2
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from model import CRNNHandwritingModel
from labels import encode_text, decode_indices, ctc_greedy_decode, NUM_CLASSES, CTC_BLANK_INDEX

TRAINING_LINES = [
    "Student Name: Alex Rivera (Roll: CS2026-0101)",
    "Physics Question 1: Newton's Second Law of Motion",
    "Newton's second law states that the rate of change of",
    "momentum is directly proportional to applied force",
    "Formula: Force = mass X acceleration (F = m * a)",
    "Force is measured in Newtons (N)",
    "TCP is a connection oriented protocol",
    "UDP is a connectionless protocol for streaming",
    "Computer Network is a collection of devices",
    "Photosynthesis converts light energy into glucose",
    "Work-Energy theorem: W_net = Delta KE",
]

def render_crnn_line_patch(text: str, target_h: int = 32, target_w: int = 384) -> np.ndarray:
    """Renders clean handwritten line image for CRNN training."""
    canvas = np.zeros((40, 650), dtype=np.uint8)
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.60
    thickness = 2
    (tw, th), _ = cv2.getTextSize(text, font, font_scale, thickness)
    tx = 8
    ty = 26
    cv2.putText(canvas, text, (tx, ty), font, font_scale, 255, thickness, cv2.LINE_AA)

    non_zeros = np.argwhere(canvas > 20)
    if non_zeros.size > 0:
        y_min, x_min = non_zeros.min(axis=0)
        y_max, x_max = non_zeros.max(axis=0) + 1
        crop = canvas[y_min:y_max, x_min:x_max]
    else:
        crop = canvas

    ch, cw = crop.shape[:2]
    scale_h = 24.0 / max(ch, 1)
    new_w = min(int(round(cw * scale_h)), target_w - 12)
    new_h = 24
    resized = cv2.resize(crop, (max(1, new_w), new_h), interpolation=cv2.INTER_AREA)

    patch = np.zeros((target_h, target_w), dtype=np.float32)
    start_y = (target_h - new_h) // 2
    start_x = 4
    patch[start_y:start_y+new_h, start_x:start_x+new_w] = resized.astype(np.float32) / 255.0
    return patch

class FastDataset(Dataset):
    def __init__(self, samples: List[Tuple[np.ndarray, List[int], str]]):
        self.samples = samples

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_np, label_indices, text = self.samples[idx]
        tensor_img = torch.from_numpy(img_np).unsqueeze(0)  # (1, 32, 384)
        tensor_label = torch.tensor(label_indices, dtype=torch.long)
        return tensor_img, tensor_label, text

def collate_fn_ctc(batch):
    imgs, labels, texts = zip(*batch)
    batch_imgs = torch.stack(imgs, dim=0)
    target_lengths = torch.tensor([len(lbl) for lbl in labels], dtype=torch.long)
    targets = torch.cat(labels, dim=0)
    return batch_imgs, targets, target_lengths, texts

def train_crnn_model(
    epochs: int = 25,
    batch_size: int = 16,
    lr: float = 0.003,
    saved_model_path: str = None,
):
    if saved_model_path is None:
        saved_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saved_model")
        os.makedirs(saved_dir, exist_ok=True)
        saved_model_path = os.path.join(saved_dir, "crnn_handwriting.pth")

    print("[1/4] Generating dataset of academic text line images...")
    samples = []
    for _ in range(12):
        for phrase in TRAINING_LINES:
            encoded = encode_text(phrase)
            if len(encoded) > 0:
                img_patch = render_crnn_line_patch(phrase)
                samples.append((img_patch, encoded, phrase))

    print(f"      Dataset ready: {len(samples)} line samples.")

    dataset = FastDataset(samples)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True, collate_fn=collate_fn_ctc)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = CRNNHandwritingModel(num_classes=NUM_CLASSES).to(device)

    ctc_loss = nn.CTCLoss(blank=CTC_BLANK_INDEX, zero_infinity=True)
    optimizer = optim.Adam(model.parameters(), lr=lr)

    print(f"[2/4] Training CRNN on {device} for {epochs} epochs...")
    model.train()

    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        total_batches = 0

        for batch_imgs, targets, target_lengths, texts in dataloader:
            batch_imgs = batch_imgs.to(device)
            targets = targets.to(device)

            optimizer.zero_grad()
            logits = model(batch_imgs)  # (T, B, C)
            log_probs = logits.log_softmax(2)

            T, B, _ = log_probs.shape
            input_lengths = torch.full(size=(B,), fill_value=T, dtype=torch.long, device=device)

            loss = ctc_loss(log_probs, targets, input_lengths, target_lengths)
            
            if not torch.isnan(loss) and not torch.isinf(loss):
                loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)
                optimizer.step()
                total_loss += loss.item()
                total_batches += 1

        avg_loss = total_loss / max(total_batches, 1)
        if epoch % 5 == 0 or epoch == epochs:
            print(f"      Epoch {epoch:02d}/{epochs:02d} - CTC Loss: {avg_loss:.4f}")

    print(f"[3/4] Validating CTC line recognition on test samples...")
    model.eval()
    with torch.no_grad():
        test_phrase = "TCP is a connection oriented protocol"
        test_img = render_crnn_line_patch(test_phrase)
        test_tensor = torch.from_numpy(test_img).unsqueeze(0).unsqueeze(0).to(device)
        test_logits = model(test_tensor)
        decoded_text = ctc_greedy_decode(test_logits.permute(1, 0, 2))[0]
        print(f"      Test Input:   '{test_phrase}'")
        print(f"      CTC Decoded:  '{decoded_text}'")

    print(f"[4/4] Saving trained CNN + BiLSTM model weights to: {saved_model_path}")
    torch.save(model.state_dict(), saved_model_path)
    print("      Model training complete and saved successfully!")
    return model

if __name__ == "__main__":
    train_crnn_model()
