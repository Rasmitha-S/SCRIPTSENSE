from typing import List, Tuple, Optional
import numpy as np
import cv2
from services.image_preprocessing import format_line_for_crnn

class BoundingBox:
    """Represents the coordinate boundary of a text line."""
    def __init__(self, x: int, y: int, w: int, h: int):
        self.x = int(x)
        self.y = int(y)
        self.w = int(w)
        self.h = int(h)

    @property
    def x2(self) -> int:
        return self.x + self.w

    @property
    def y2(self) -> int:
        return self.y + self.h

    def __repr__(self) -> str:
        return f"BoundingBox(x={self.x}, y={self.y}, w={self.w}, h={self.h})"


def detect_and_extract_text_lines(
    binary_img: np.ndarray,
    min_line_width_ratio: float = 0.04,
    min_line_height: int = 8,
    target_line_h: int = 32,
    target_line_w: int = 384,
) -> List[Tuple[BoundingBox, np.ndarray]]:
    """
    Detects and segments individual handwritten text lines across the document image:
    1. Applies horizontal morphological dilation to connect words across each line.
    2. Extracts bounding boxes of text lines.
    3. Sorts lines strictly from top to bottom (reading order).
    4. Formats each line crop into a normalized (32, 384) float32 array for the CRNN.
    
    Returns:
        List of (BoundingBox, formatted_line_patch_32x384_np).
    """
    img_h, img_w = binary_img.shape[:2]

    # Horizontal dilation kernel proportional to document width
    kernel_w = max(int(img_w * 0.035), 25)
    line_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_w, 3))
    dilated_lines = cv2.dilate(binary_img, line_kernel, iterations=2)

    # Find external contours of dilated text lines
    line_contours, _ = cv2.findContours(dilated_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    line_boxes: List[BoundingBox] = []
    min_w = int(img_w * min_line_width_ratio)

    for cnt in line_contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w >= min_w and h >= min_line_height:
            line_boxes.append(BoundingBox(x, y, w, h))

    # Sort strictly from top to bottom
    line_boxes.sort(key=lambda b: b.y)

    if not line_boxes:
        line_boxes = [BoundingBox(0, 0, img_w, img_h)]

    line_results: List[Tuple[BoundingBox, np.ndarray]] = []
    for box in line_boxes:
        pad_y1 = max(0, box.y - 2)
        pad_y2 = min(img_h, box.y2 + 2)
        line_crop = binary_img[pad_y1:pad_y2, box.x:box.x2]

        if line_crop.size > 0 and np.sum(line_crop) > 0:
            # Format line crop into normalized (32, 384) CRNN input patch
            line_patch = format_line_for_crnn(line_crop, target_height=target_line_h, target_width=target_line_w)
            line_results.append((BoundingBox(box.x, pad_y1, box.w, pad_y2 - pad_y1), line_patch))

    return line_results
