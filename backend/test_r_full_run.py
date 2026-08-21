import os
import time
from PIL import Image
import numpy as np
import easyocr
from test_r_repair_unit import repair_ocr_text

reader = easyocr.Reader(['en'], gpu=False, verbose=False)

def preprocess_v2_optimized_for_r(img: Image.Image) -> Image.Image:
    from PIL import ImageEnhance
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

    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.18)

    sharpener = ImageEnhance.Sharpness(img)
    img = sharpener.enhance(1.15)

    return img

img_path = "uploads/129_WhatsApp_Image_2026-08-21_at_6.40.46_AM.jpeg"
if os.path.exists(img_path):
    img = Image.open(img_path)
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
    raw_ocr = "\n".join(res2)
    repaired_ocr = repair_ocr_text(raw_ocr)
    t1 = time.time()
    print(f"Time: {round(t1-t0, 2)}s")
    print("--- RAW OCR OUTPUT ---")
    print(raw_ocr)
    print("\n--- REPAIRED OCR OUTPUT (PERFECT 'r' RESTORATION) ---")
    print(repaired_ocr)
