import os
import io
import re
import time
from PIL import Image, ImageEnhance, ImageOps, ImageFilter
import numpy as np
import easyocr

reader = easyocr.Reader(['en'], gpu=False, verbose=False)

def preprocess_v1(img: Image.Image) -> Image.Image:
    # Current v1 preprocessing
    if img.mode != 'RGB':
        img = img.convert('RGB')
    w, h = img.size
    max_dim = max(w, h)
    if max_dim > 1400:
        scale = 1400.0 / float(max_dim)
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.BILINEAR)
    enhancer = ImageEnhance.Contrast(img)
    return enhancer.enhance(1.25)

def preprocess_v2_optimized_for_r(img: Image.Image) -> Image.Image:
    """
    Carefully adjusted preprocessing to preserve the fine stroke and arch of 'r':
    - Keeps optimal dimensions (1200-1600px) using BICUBIC to prevent stroke pixelation.
    - Mild contrast enhancement (1.15x instead of harsh 1.25x+ which breaks top arch).
    - Subtle sharpness enhancement (1.15x) to define character edge boundaries without eroding thin strokes.
    - Preserves RGB or Grayscale with subtle stroke continuity.
    """
    if img.mode != 'RGB':
        img = img.convert('RGB')
    w, h = img.size
    max_dim = max(w, h)
    min_dim = min(w, h)
    
    if max_dim > 1500:
        scale = 1500.0 / float(max_dim)
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.BICUBIC)
    elif max_dim < 700:
        scale = 900.0 / float(max(min_dim, 1))
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.BICUBIC)

    # Gentle contrast to separate paper from ink without burning out thin 'r' arches
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.18)

    # Gentle sharpness to clarify handwriting edges
    sharpener = ImageEnhance.Sharpness(img)
    img = sharpener.enhance(1.15)

    return img

print("Testing actual student answer sheet...")
img_path = "uploads/129_WhatsApp_Image_2026-08-21_at_6.40.46_AM.jpeg"
if os.path.exists(img_path):
    img = Image.open(img_path)
    
    # 1. Raw / V1
    t0 = time.time()
    p1 = preprocess_v1(img)
    res1 = reader.readtext(np.array(p1), detail=0, paragraph=True)
    t1 = time.time()
    print(f"V1 Output ({round(t1-t0, 2)}s):\n", "\n".join([str(r) for r in res1]))
    
    # 2. V2 with tuned parameters
    t0 = time.time()
    p2 = preprocess_v2_optimized_for_r(img)
    res2 = reader.readtext(
        np.array(p2),
        detail=0,
        paragraph=True,
        text_threshold=0.3,
        low_text=0.2,
        link_threshold=0.25,
        slope_ths=0.2,
        width_ths=0.7
    )
    t1 = time.time()
    print(f"\nV2 Output ({round(t1-t0, 2)}s):\n", "\n".join([str(r) for r in res2]))
