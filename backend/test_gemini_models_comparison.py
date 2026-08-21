import os
import sys
import io
import time
from PIL import Image
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

PROMPT = (
    "You are an expert at reading handwritten text. Carefully transcribe every word in this image exactly as written. "
    "If a word is ambiguous, use context from surrounding words and common English spelling to infer the most likely correct word. "
    "Preserve line breaks and punctuation. Return ONLY the transcribed text, no explanations."
)

def test_model(image_bytes: bytes, model_name: str, api_key: str):
    import google.generativeai as genai
    genai.configure(api_key=api_key)

    img = Image.open(io.BytesIO(image_bytes))
    if img.mode not in ('RGB', 'L'):
        img = img.convert('RGB')

    model = genai.GenerativeModel(model_name)
    t0 = time.time()
    response = model.generate_content(
        [PROMPT, img],
        generation_config={"temperature": 0.0, "max_output_tokens": 2048}
    )
    t1 = time.time()
    
    text = response.text.strip() if (response and response.text) else ""
    if text.startswith("```") and text.endswith("```"):
        lines = text.splitlines()
        if len(lines) >= 2:
            text = "\n".join(lines[1:-1]).strip()
    return text, (t1 - t0)

def main():
    messy_img = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "144_Screenshot_2026-08-19_135204.png")
    api_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()

    print("=" * 75)
    print("   GEMINI VISION OCR MODEL COMPARISON: gemini-1.5-flash VS gemini-1.5-pro   ")
    print("=" * 75)
    print(f"Target Image: {messy_img} (Exists: {os.path.exists(messy_img)})")
    print(f"GEMINI_API_KEY Present: {bool(api_key)}")
    print("=" * 75)

    with open(messy_img, "rb") as f:
        img_bytes = f.read()

    if not api_key:
        print("\n[NOTE] No GEMINI_API_KEY is configured in backend/.env.")
        print("When an API key is configured:")
        print("  - gemini-1.5-pro delivers deeper multimodal reasoning for highly ambiguous strokes, overlapping handwriting, and complex notations.")
        print("  - gemini-1.5-flash is optimized for high-throughput, low-latency requests.")
        return

    print("\n--- 1. Testing gemini-1.5-flash (Previous) ---")
    flash_res, flash_t = test_model(img_bytes, "gemini-1.5-flash", api_key)
    print(f"Time Taken: {flash_t:.2f}s")
    print("Extracted Text:")
    print("-" * 50)
    print(flash_res)
    print("-" * 50)

    print("\n--- 2. Testing gemini-1.5-pro (Current / Upgraded) ---")
    pro_res, pro_t = test_model(img_bytes, "gemini-1.5-pro", api_key)
    print(f"Time Taken: {pro_t:.2f}s")
    print("Extracted Text:")
    print("-" * 50)
    print(pro_res)
    print("-" * 50)

    print("\n" + "=" * 75)
    print("                       FINAL BENCHMARK COMPARISON                       ")
    print("=" * 75)
    print(f"{'Model':<20} | {'Latency':<12} | {'Character Count':<16}")
    print("-" * 75)
    print(f"{'gemini-1.5-flash':<20} | {flash_t:<10.2f}s | {len(flash_res)} chars")
    print(f"{'gemini-1.5-pro':<20} | {pro_t:<10.2f}s | {len(pro_res)} chars")
    print("=" * 75)

if __name__ == "__main__":
    main()
