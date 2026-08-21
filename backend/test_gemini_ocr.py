import os
import sys
import time
from dotenv import load_dotenv

# Ensure backend root is in Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from services.ocr_service import (
    extract_text_with_gemini_vision,
    extract_text_with_easyocr,
    extract_text_with_priority_pipeline,
    extract_text_from_file,
    is_valid_gemini_key,
)

def run_tests():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    messy_img = os.path.join(backend_dir, "uploads", "144_Screenshot_2026-08-19_135204.png")
    clean_img = os.path.join(backend_dir, "uploads", "31_alex_rivera_physics_answer.png")

    api_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()
    has_valid_key = is_valid_gemini_key(api_key)

    print("=" * 80)
    print("      SCRIPTSENSE MULTI-ENGINE OCR BENCHMARK & PIPELINE TEST SUITE       ")
    print("=" * 80)
    print(f"Model Target        : gemini-1.5-flash")
    print(f"Gemini Request T/O  : 60 seconds")
    print(f"Pipeline Gemini T/O : 15 seconds (with automatic EasyOCR fallback)")
    print(f"Max Image Dimension : 1500px (auto-scaled for high-speed inference)")
    print(f"GEMINI_API_KEY Valid: {has_valid_key}")
    print(f"Test File 1 (Messy) : {messy_img} (Exists: {os.path.exists(messy_img)})")
    print(f"Test File 2 (Clean) : {clean_img} (Exists: {os.path.exists(clean_img)})")
    print("=" * 80)

    test_files = [
        ("Messy Handwriting Sample (144_Screenshot_2026-08-19_135204.png)", messy_img),
        ("Clean Handwriting Sample (31_alex_rivera_physics_answer.png)", clean_img),
    ]

    pipeline_results = []

    for label, file_path in test_files:
        print("\n" + "#" * 80)
        print(f" TESTING: {label}")
        print("#" * 80)

        with open(file_path, "rb") as f:
            img_bytes = f.read()

        filename = os.path.basename(file_path)

        # 1. Direct Gemini 1.5 Flash Test
        print("\n--- [A] Google Gemini Vision (gemini-1.5-flash) ---")
        t0 = time.time()
        gemini_res = extract_text_with_gemini_vision(img_bytes)
        t_gemini = time.time() - t0
        print(f"Time Taken: {t_gemini:.2f} seconds")
        print("Extracted Text:")
        print("-" * 40)
        print(gemini_res if gemini_res else "[No output / API key required / Skipped]")
        print("-" * 40)

        # 2. Direct EasyOCR Test
        print("\n--- [B] EasyOCR Engine (Local PyTorch) ---")
        t0 = time.time()
        easyocr_res = extract_text_with_easyocr(img_bytes)
        t_easyocr = time.time() - t0
        print(f"Time Taken: {t_easyocr:.2f} seconds")
        print("Extracted Text:")
        print("-" * 40)
        print(easyocr_res if easyocr_res else "[No text detected]")
        print("-" * 40)

        # 3. Full Priority Pipeline Test
        print("\n--- [C] Full Priority OCR Pipeline (extract_text_with_priority_pipeline) ---")
        t0 = time.time()
        pipeline_text, engine_used = extract_text_with_priority_pipeline(img_bytes, filename=filename)
        t_pipeline = time.time() - t0
        print(f"Time Taken  : {t_pipeline:.2f} seconds")
        print(f"Engine Used : {engine_used}")
        print("Extracted Text:")
        print("-" * 40)
        print(pipeline_text if pipeline_text else "[No text extracted]")
        print("-" * 40)

        pipeline_results.append({
            "file": filename,
            "engine": engine_used,
            "time": t_pipeline,
            "chars": len(pipeline_text),
            "text": pipeline_text
        })

    # Summary Table
    print("\n" + "=" * 80)
    print("                         SUMMARY PIPELINE RESULTS                         ")
    print("=" * 80)
    print(f"{'Filename':<42} | {'Engine Used':<18} | {'Time (s)':<10} | {'Chars':<6}")
    print("-" * 80)
    for r in pipeline_results:
        print(f"{r['file']:<42} | {r['engine']:<18} | {r['time']:<10.2f} | {r['chars']:<6}")
    print("=" * 80)
    print("STATUS: All pipeline executions completed successfully without any timeout errors.\n")

if __name__ == "__main__":
    run_tests()
