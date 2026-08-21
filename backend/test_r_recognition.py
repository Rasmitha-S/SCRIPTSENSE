import io
import time
from PIL import Image, ImageDraw, ImageFont
import easyocr
import numpy as np

# Test list of words containing 'r'
WORDS_TO_TEST = [
    "are",
    "answer",
    "correct",
    "protocol",
    "computer",
    "server",
    "network",
    "error",
    "transfer"
]

def render_handwritten_style_image(words):
    img = Image.new("RGB", (800, 450), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    y = 30
    for w in words:
        draw.text((40, y), f"The term is {w} in this test sentence.", fill=(20, 25, 35))
        y += 42
        
    return img

def main():
    print("Testing OCR on sample words with 'r'...")
    img = render_handwritten_style_image(WORDS_TO_TEST)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_bytes = buf.getvalue()
    
    reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    
    t0 = time.time()
    results = reader.readtext(np.array(img), detail=1)
    t1 = time.time()
    
    print(f"Raw EasyOCR took {round(t1-t0, 2)}s. Results:")
    for bbox, text, conf in results:
        print(f"  - '{text}' (conf: {round(conf, 2)})")

if __name__ == "__main__":
    main()
