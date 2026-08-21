import os
from typing import Dict, Tuple, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F

# ==============================================================================
# CHARACTER VOCABULARY (EMNIST ByClass 62 classes + common exam symbols)
# ==============================================================================
CHARACTERS = (
    "0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    ".,:;!?-+*=/()\"'%$_"
)
NUM_CLASSES = len(CHARACTERS)
INDEX_TO_CHAR: Dict[int, str] = {i: c for i, c in enumerate(CHARACTERS)}
CHAR_TO_INDEX: Dict[str, int] = {c: i for i, c in enumerate(CHARACTERS)}


class HandwritingCNN(nn.Module):
    """
    Deep Convolutional Neural Network for handwritten character classification.
    Input: (B, 1, 28, 28) normalized grayscale character image patch.
    Output: (B, NUM_CLASSES) unnormalized class logits.
    """
    def __init__(self, num_classes: int = NUM_CLASSES, embedding_dim: int = 128):
        super(HandwritingCNN, self).__init__()
        
        # Block 1: Low-level edge and stroke detection (28x28 -> 14x14)
        self.conv1 = nn.Conv2d(1, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.pool1 = nn.MaxPool2d(2, 2)
        self.dropout1 = nn.Dropout2d(0.15)

        # Block 2: Stroke intersection and loop detection (14x14 -> 7x7)
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(64)
        self.pool2 = nn.MaxPool2d(2, 2)
        self.dropout2 = nn.Dropout2d(0.20)

        # Block 3: High-level topological character structures (7x7 -> 3x3)
        self.conv3 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm2d(128)
        self.pool3 = nn.MaxPool2d(2, 2)
        self.dropout3 = nn.Dropout2d(0.25)

        # Dense Embedding and Classification Head
        self.fc_embed = nn.Linear(128 * 3 * 3, embedding_dim)
        self.bn_embed = nn.BatchNorm1d(embedding_dim)
        self.dropout4 = nn.Dropout(0.35)
        self.classifier = nn.Linear(embedding_dim, num_classes)

    def extract_features(self, x: torch.Tensor) -> torch.Tensor:
        """Extracts 128-dimensional latent stroke feature representation."""
        x = F.relu(self.bn1(self.conv1(x)))
        x = self.pool1(x)
        x = self.dropout1(x)

        x = F.relu(self.bn2(self.conv2(x)))
        x = self.pool2(x)
        x = self.dropout2(x)

        x = F.relu(self.bn3(self.conv3(x)))
        x = self.pool3(x)
        x = self.dropout3(x)

        x = x.view(x.size(0), -1)
        x = F.relu(self.bn_embed(self.fc_embed(x)))
        return x

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        features = self.extract_features(x)
        features = self.dropout4(features)
        logits = self.classifier(features)
        return logits
