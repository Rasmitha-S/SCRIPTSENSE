import io
from typing import Union, Tuple
import numpy as np
from PIL import Image
import cv2

def preprocess_image_for_cnn(
    image_input: Union[str, bytes, Image.Image, np.ndarray],
    target_min_dim: int = 1200,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Image preprocessing pipeline for handwriting recognition:
    Input image -> Grayscale -> Noise reduction -> Contrast enhancement -> Thresholding -> Clean Binary Image.
    
    Returns:
        Tuple[np.ndarray, np.ndarray]: (enhanced_grayscale_image, binary_thresholded_image)
    """
    # 1. Load image to numpy array
    if isinstance(image_input, str):
        with Image.open(image_input) as pil_img:
            img_np = np.array(pil_img)
    elif isinstance(image_input, bytes):
        with Image.open(io.BytesIO(image_input)) as pil_img:
            img_np = np.array(pil_img)
    elif isinstance(image_input, Image.Image):
        img_np = np.array(image_input)
    elif isinstance(image_input, np.ndarray):
        img_np = image_input.copy()
    else:
        raise ValueError(f"Unsupported image input type: {type(image_input)}")

    # 2. Convert to Grayscale
    if len(img_np.shape) == 3:
        if img_np.shape[2] == 4:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGBA2GRAY)
        else:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    else:
        gray = img_np

    # 3. Resize / Upscale low-resolution images for fine stroke segmentation
    h, w = gray.shape[:2]
    if w < target_min_dim or h < target_min_dim:
        scale = max(1.5, float(target_min_dim) / max(w, h, 1))
        scale = min(scale, 2.5)
        new_w, new_h = int(w * scale), int(h * scale)
        gray = cv2.resize(gray, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

    # 4. Noise Reduction: Bilateral filter preserves sharp ink edges while smoothing paper background
    denoised = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

    # 5. Contrast Enhancement: CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    # 6. Thresholding: Otsu binarization with inverted threshold (ink = 255, background = 0)
    _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 7. Morphological noise clean
    clean_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, clean_kernel)

    return enhanced, binary


def format_line_for_crnn(
    line_crop: np.ndarray,
    target_height: int = 32,
    target_width: int = 384,
) -> np.ndarray:
    """
    Standardizes a segmented text line crop into a CNN+BiLSTM ready input tensor:
    - Automatically crops to active ink strokes
    - Scales height to target_height (32px) while preserving width aspect ratio
    - Centers/pads into normalized (32, target_width) float32 array in [0.0, 1.0].
    
    Returns:
        np.ndarray of shape (target_height, target_width) with float32 values in [0.0, 1.0].
    """
    if line_crop.size == 0 or np.sum(line_crop) == 0:
        return np.zeros((target_height, target_width), dtype=np.float32)

    # Auto-crop to active non-zero stroke pixels
    non_zeros = np.argwhere(line_crop > 20)
    if non_zeros.size > 0:
        y_min, x_min = non_zeros.min(axis=0)
        y_max, x_max = non_zeros.max(axis=0) + 1
        crop = line_crop[y_min:y_max, x_min:x_max]
    else:
        crop = line_crop

    ch, cw = crop.shape[:2]
    if ch == 0 or cw == 0:
        return np.zeros((target_height, target_width), dtype=np.float32)

    # Scale preserving height
    scale_h = float(target_height - 6) / max(ch, 1)
    new_w = min(int(round(cw * scale_h)), target_width - 8)
    new_h = int(round(ch * scale_h))

    resized = cv2.resize(crop, (max(1, new_w), max(1, new_h)), interpolation=cv2.INTER_AREA)

    patch = np.zeros((target_height, target_width), dtype=np.float32)
    start_y = (target_height - new_h) // 2
    start_x = 4
    patch[start_y:start_y+new_h, start_x:start_x+new_w] = resized.astype(np.float32) / 255.0

    return patch


def normalize_character_patch(
    canvas: np.ndarray,
    target_size: Tuple[int, int] = (28, 28)
) -> np.ndarray:
    """Standardizes a 2D character canvas into normalized target_size float32 array in [0.0, 1.0]."""
    if canvas.size == 0 or np.sum(canvas) == 0:
        return np.zeros(target_size, dtype=np.float32)
    non_zeros = np.argwhere(canvas > 20)
    if non_zeros.size > 0:
        y_min, x_min = non_zeros.min(axis=0)
        y_max, x_max = non_zeros.max(axis=0) + 1
        crop = canvas[y_min:y_max, x_min:x_max]
    else:
        crop = canvas
    ch, cw = crop.shape[:2]
    tw, th = target_size
    if ch == 0 or cw == 0:
        return np.zeros(target_size, dtype=np.float32)
    scale = float(min(tw, th) - 8) / max(ch, cw, 1)
    new_w = max(1, int(round(cw * scale)))
    new_h = max(1, int(round(ch * scale)))
    resized = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_AREA)
    patch = np.zeros(target_size, dtype=np.float32)
    sy = (th - new_h) // 2
    sx = (tw - new_w) // 2
    patch[sy:sy+new_h, sx:sx+new_w] = resized.astype(np.float32) / 255.0
    return patch
