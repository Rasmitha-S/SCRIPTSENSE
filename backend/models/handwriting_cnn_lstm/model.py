import os
import sys
import torch
import torch.nn as nn
import torch.nn.functional as F

try:
    from .labels import NUM_CLASSES
except ImportError:
    from labels import NUM_CLASSES


class CRNNHandwritingModel(nn.Module):
    """
    CRNN (Convolutional Recurrent Neural Network) for Handwritten Text Line Recognition.
    Architecture:
    1. CNN Layers: Extract deep visual features from handwritten stroke patterns.
    2. Sequence Transformation: Reshapes feature maps into sequential time-steps.
    3. Bidirectional LSTM: Captures forward & backward contextual character sequences.
    4. Fully-Connected Projection: Computes character probabilities at each time-step for CTC.
    
    Input:
        x: Tensor of shape (Batch_size, 1, Height=32, Width=384)
    Output:
        logits: Tensor of shape (Time_steps, Batch_size, NUM_CLASSES) suitable for CTCLoss.
    """
    def __init__(
        self,
        img_height: int = 32,
        num_classes: int = NUM_CLASSES,
        lstm_hidden: int = 256,
        lstm_layers: int = 2,
    ):
        super(CRNNHandwritingModel, self).__init__()
        
        self.img_height = img_height
        self.num_classes = num_classes

        # ======================================================================
        # 1. CNN VISUAL FEATURE EXTRACTION BACKBONE
        # ======================================================================
        # Conv Block 1: (1, 32, W) -> (64, 16, W/2)
        self.conv1 = nn.Conv2d(1, 64, kernel_size=3, stride=1, padding=1)
        self.bn1 = nn.BatchNorm2d(64)
        self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2)

        # Conv Block 2: (64, 16, W/2) -> (128, 8, W/4)
        self.conv2 = nn.Conv2d(64, 128, kernel_size=3, stride=1, padding=1)
        self.bn2 = nn.BatchNorm2d(128)
        self.pool2 = nn.MaxPool2d(kernel_size=2, stride=2)

        # Conv Block 3: (128, 8, W/4) -> (256, 4, W/4) (Asymmetric pool keeps width resolution)
        self.conv3 = nn.Conv2d(128, 256, kernel_size=3, stride=1, padding=1)
        self.bn3 = nn.BatchNorm2d(256)
        self.conv4 = nn.Conv2d(256, 256, kernel_size=3, stride=1, padding=1)
        self.bn4 = nn.BatchNorm2d(256)
        self.pool3 = nn.MaxPool2d(kernel_size=(2, 1), stride=(2, 1))

        # Conv Block 4: (256, 4, W/4) -> (512, 2, W/4)
        self.conv5 = nn.Conv2d(256, 512, kernel_size=3, stride=1, padding=1)
        self.bn5 = nn.BatchNorm2d(512)
        self.pool4 = nn.MaxPool2d(kernel_size=(2, 1), stride=(2, 1))

        # Conv Block 5: (512, 2, W/4) -> (512, 1, W/4 - 1)
        self.conv6 = nn.Conv2d(512, 512, kernel_size=2, stride=1, padding=0)
        self.bn6 = nn.BatchNorm2d(512)

        # ======================================================================
        # 2. BIDIRECTIONAL LSTM SEQUENCE MODELING
        # ======================================================================
        self.lstm = nn.LSTM(
            input_size=512,
            hidden_size=lstm_hidden,
            num_layers=lstm_layers,
            bidirectional=True,
            batch_first=False,
            dropout=0.25 if lstm_layers > 1 else 0.0,
        )

        # ======================================================================
        # 3. DENSE PROJECTION TO CHARACTER VOCABULARY
        # ======================================================================
        self.linear = nn.Linear(lstm_hidden * 2, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.
        Args:
            x: (B, 1, 32, W)
        Returns:
            log_probs: (T, B, NUM_CLASSES) for CTC Loss & decoding.
        """
        # CNN Feature Extraction
        x = F.relu(self.bn1(self.conv1(x)))
        x = self.pool1(x)

        x = F.relu(self.bn2(self.conv2(x)))
        x = self.pool2(x)

        x = F.relu(self.bn3(self.conv3(x)))
        x = F.relu(self.bn4(self.conv4(x)))
        x = self.pool3(x)

        x = F.relu(self.bn5(self.conv5(x)))
        x = self.pool4(x)

        x = F.relu(self.bn6(self.conv6(x)))  # (B, 512, 1, T)

        # Reshape for Sequence Modeling: (B, 512, 1, T) -> (B, 512, T) -> (T, B, 512)
        x = x.squeeze(2)
        x = x.permute(2, 0, 1)

        # Bidirectional LSTM forward
        lstm_out, _ = self.lstm(x)  # (T, B, 2 * hidden)

        # Linear projection to class vocabulary
        logits = self.linear(lstm_out)  # (T, B, num_classes)
        return logits
