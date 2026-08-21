"""
Handwriting CNN Recognition Module
Includes model definition, training pipeline, model loading, and character inference.
"""

from .model import HandwritingCNN, CHARACTERS, NUM_CLASSES, INDEX_TO_CHAR, CHAR_TO_INDEX
from .inference import load_model, predict_character_patches
from .train import train_and_save_model

__all__ = [
    "HandwritingCNN",
    "CHARACTERS",
    "NUM_CLASSES",
    "INDEX_TO_CHAR",
    "CHAR_TO_INDEX",
    "load_model",
    "predict_character_patches",
    "train_and_save_model",
]
