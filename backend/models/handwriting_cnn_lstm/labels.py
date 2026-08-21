from typing import List, Dict, Tuple
import torch

# CTC Blank Token is at Index 0
CTC_BLANK_TOKEN = "<BLANK>"
CTC_BLANK_INDEX = 0

# Character vocabulary (Digits, Uppercase, Lowercase, Common Symbols and Space)
VOCAB_CHARS = (
    " "
    "0123456789"
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"
)

# Index 0 is reserved for CTC Blank Token.
# Indices 1 to len(VOCAB_CHARS) map to the respective characters.
INDEX_TO_CHAR: Dict[int, str] = {0: ""}
for idx, char in enumerate(VOCAB_CHARS, start=1):
    INDEX_TO_CHAR[idx] = char

CHAR_TO_INDEX: Dict[str, int] = {char: idx for idx, char in enumerate(VOCAB_CHARS, start=1)}

NUM_CLASSES = len(INDEX_TO_CHAR)  # Total classes including CTC blank token


def encode_text(text: str) -> List[int]:
    """
    Encodes a string into a list of integer character indices.
    Unrecognized characters default to space.
    """
    encoded: List[int] = []
    for char in text:
        if char in CHAR_TO_INDEX:
            encoded.append(CHAR_TO_INDEX[char])
        elif char.lower() in CHAR_TO_INDEX:
            encoded.append(CHAR_TO_INDEX[char.lower()])
        else:
            encoded.append(CHAR_TO_INDEX.get(" ", 1))
    return encoded


def decode_indices(indices: List[int]) -> str:
    """Decodes a list of integer indices directly into a character string."""
    return "".join(INDEX_TO_CHAR.get(idx, "") for idx in indices)


def ctc_greedy_decode(logits: torch.Tensor) -> List[str]:
    """
    Performs CTC Greedy Decoding on raw model logits or log probabilities.
    
    Args:
        logits: Tensor of shape (Time_steps, Batch_size, Num_classes) or (Batch_size, Time_steps, Num_classes)
        
    Returns:
        List of decoded text strings for each item in the batch.
    """
    # Ensure shape is (Batch, Time_steps, Num_classes)
    if logits.dim() == 3 and logits.shape[0] != 1 and logits.shape[1] == 1:
        # (T, B, C) where B=1 -> permute to (B, T, C)
        probs = logits.permute(1, 0, 2)
    elif logits.dim() == 3 and logits.shape[2] == NUM_CLASSES:
        probs = logits
    else:
        probs = logits

    # Argmax over class dimension
    best_paths = torch.argmax(probs, dim=-1).cpu().numpy()  # (B, T)
    decoded_batch: List[str] = []

    for path in best_paths:
        decoded_chars: List[str] = []
        prev_idx = CTC_BLANK_INDEX

        for idx in path:
            # CTC Rule: Ignore blank tokens and consecutive duplicate tokens
            if idx != CTC_BLANK_INDEX and idx != prev_idx:
                decoded_chars.append(INDEX_TO_CHAR.get(int(idx), ""))
            prev_idx = idx

        text = "".join(decoded_chars).strip()
        decoded_batch.append(text)

    return decoded_batch
