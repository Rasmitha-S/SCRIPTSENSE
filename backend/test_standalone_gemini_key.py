import os
import sys
import io
import time
from PIL import Image
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(override=True)

from services.ocr_service import (
    extract_text_with_priority_pipeline,
    is_valid_gemini_key,
)

def run_standalone_test():
    print("=" * 80)
    print("        GEMINI API KEY STANDALONE & PIPELINE VALIDATION TEST       ")
    print("=" * 80)

    # 1. Confirm key saved and loaded
    raw_key = os.getenv("GEMINI_API_KEY", "").strip()
    is_loaded = bool(raw_key)
    print(f"1. GEMINI_API_KEY saved and loaded successfully: {'Yes' if is_loaded else 'No'}")
    print(f"   Key length: {len(raw_key)} characters")

    # 2. Standalone Gemini API test (direct, bypassing fallback pipeline)
    clean_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "31_alex_rivera_physics_answer.png")
    print(f"\n2. Standalone Direct Gemini API Test on: {os.path.basename(clean_img_path)}")
    print("-" * 80)
    
    gemini_succeeded = False
    raw_response_text = ""

    try:
        import google.generativeai as genai
        genai.configure(api_key=raw_key)
        
        img = Image.open(clean_img_path)
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')
            
        w, h = img.size
        max_dim = max(w, h)
        if max_dim > 1500:
            scale = 1500.0 / max_dim
            img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)

        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = (
            "You are an expert at reading handwritten text. Carefully transcribe every word in this image exactly as written. "
            "If a word is ambiguous, use context from surrounding words and common English spelling to infer the most likely correct word. "
            "Preserve line breaks and punctuation. Return ONLY the transcribed text, no explanations."
        )

        t0 = time.time()
        response = model.generate_content(
            [prompt, img],
            generation_config={"temperature": 0.0, "max_output_tokens": 2048},
            request_options={"timeout": 60.0}
        )
        t_direct = time.time() - t0

        if response and response.text:
            raw_response_text = response.text.strip()
            print(f"[STATUS] Direct Gemini API call SUCCEEDED in {t_direct:.2f} seconds.")
            print("[RAW RESPONSE]:")
            print(raw_response_text)
            gemini_succeeded = True
        else:
            print("[STATUS] Direct Gemini API call returned empty response.")
            print(f"[RAW RESPONSE]: {response}")

    except Exception as e:
        print(f"[STATUS] Direct Gemini API call FAILED with error: {type(e).__name__}")
        print(f"[EXACT ERROR]: {e}")

    # 3. Priority Pipeline Test on both images
    print("\n" + "=" * 80)
    print("3. Full OCR Priority Pipeline Test (Gemini 1.5 Flash -> EasyOCR -> Tesseract)")
    print("=" * 80)

    messy_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "144_Screenshot_2026-08-19_135204.png")
    test_files = [
        ("Messy Handwriting Sample", messy_img_path),
        ("Clean Handwriting Sample", clean_img_path),
    ]

    for label, path in test_files:
        fn = os.path.basename(path)
        print(f"\n--- Processing: {fn} ({label}) ---")
        with open(path, "rb") as f:
            img_b = f.read()

        t0 = time.time()
        extracted, engine = extract_text_with_priority_pipeline(img_b, filename=fn)
        elapsed = time.time() - t0

        print(f"Engine Used : {engine}")
        print(f"Time Taken  : {elapsed:.2f}s")
        print(f"Characters  : {len(extracted)}")
        print("Extracted Text:")
        print("-" * 40)
        print(extracted)
        print("-" * 40)

if __name__ == "__main__":
    run_standalone_test()
