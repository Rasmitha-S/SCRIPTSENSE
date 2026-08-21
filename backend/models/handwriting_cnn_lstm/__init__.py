"""
Handwriting CNN + BiLSTM + CTC Recognition Package
"""

from .model import CRNNHandwritingModel
from .labels import encode_text, decode_indices, ctc_greedy_decode, NUM_CLASSES, INDEX_TO_CHAR, CHAR_TO_INDEX
from .inference import load_crnn_model, recognize_line_image, recognize_batch_lines
from .train import train_crnn_model

__all__ = [
    "CRNNHandwritingModel",
    "NUM_CLASSES",
    "INDEX_TO_CHAR",
    "CHAR_TO_INDEX",
    "encode_text",
    "decode_indices",
    "ctc_greedy_decode",
    "load_crnn_model",
    "recognize_line_image",
    "recognize_batch_lines",
    "train_crnn_model",
]
