import os
import sys
import io
import traceback
from PIL import Image
from dotenv import load_dotenv

# Ensure backend root is in Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Explicitly load backend .env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

def debug_gemini():
    print("=" * 75)
    print("                SCRIPTSENSE GEMINI PRO OCR DIAGNOSTIC                ")
    print("=" * 75)

    # 1. Environment Variable Loading Check
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    google_api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    
    effective_key = api_key or google_api_key

    print(f"[1] .env File Path: {os.path.abspath(env_path)}")
    print(f"[1] .env Exists: {os.path.exists(env_path)}")
    print(f"[1] GEMINI_API_KEY in os.environ: {'GEMINI_API_KEY' in os.environ}")
    print(f"[1] GEMINI_API_KEY is non-empty: {bool(api_key)}")
    if api_key:
        masked_key = api_key[:4] + "..." + api_key[-4:] if len(api_key) > 8 else "***"
        print(f"[1] GEMINI_API_KEY Masked Value: {masked_key} (Length: {len(api_key)} chars)")
    else:
        print("[1] GEMINI_API_KEY Masked Value: [EMPTY / NOT CONFIGURED]")

    print(f"[1] GOOGLE_API_KEY is non-empty: {bool(google_api_key)}")
    print("=" * 75)

    # 2. Image Path Check
    image_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "144_Screenshot_2026-08-19_135204.png")
    print(f"[2] Target Image: {image_path}")
    print(f"[2] Image Exists: {os.path.exists(image_path)}")
    if not os.path.exists(image_path):
        print("[ERROR] Target sample image does not exist!")
        return

    with open(image_path, "rb") as f:
        image_bytes = f.read()
    print(f"[2] Image File Size: {len(image_bytes)} bytes")
    print("=" * 75)

    # 3. Direct Raw Gemini Pro Call (No Catch / Full Traceback)
    print("[3] Attempting Direct Gemini 1.5 Pro API Call...")
    
    if not effective_key:
        print("\n[DIAGNOSTIC FAILURE: MISSING API KEY]")
        print("Root Cause: GEMINI_API_KEY in backend/.env is empty.")
        print("Because the API key is empty, ocr_service.py skips Gemini and falls back to EasyOCR.")
        print("To fix this, edit backend/.env and paste your Google Gemini API key:")
        print("  GEMINI_API_KEY=AIzaSy...")
        return

    try:
        import google.generativeai as genai
        genai.configure(api_key=effective_key)

        img = Image.open(io.BytesIO(image_bytes))
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')

        model = genai.GenerativeModel("gemini-1.5-pro")
        prompt = (
            "You are an expert at reading handwritten text. Carefully transcribe every word in this image exactly as written. "
            "If a word is ambiguous, use context from surrounding words and common English spelling to infer the most likely correct word. "
            "Preserve line breaks and punctuation. Return ONLY the transcribed text, no explanations."
        )

        print("[3] Sending request to Google Gemini API (gemini-1.5-pro)...")
        response = model.generate_content(
            [prompt, img],
            generation_config={"temperature": 0.0, "max_output_tokens": 2048}
        )

        print("\n" + "=" * 75)
        print("                     RAW RESPONSE FROM GEMINI PRO                     ")
        print("=" * 75)
        print(f"Response Object: {response}")
        print("-" * 75)
        if hasattr(response, "text"):
            print("Extracted Text:")
            print(response.text)
        else:
            print("[WARNING] Response object has no .text attribute.")
            if hasattr(response, "candidates"):
                print("Candidates:", response.candidates)
            if hasattr(response, "prompt_feedback"):
                print("Prompt Feedback:", response.prompt_feedback)
        print("=" * 75)

    except Exception as e:
        print("\n" + "!" * 75)
        print(f" [EXACT EXCEPTION]: {type(e).__name__}: {str(e)}")
        print("!" * 75)
        print("\nFull Stack Trace:")
        traceback.print_exc(file=sys.stdout)
        print("=" * 75)

if __name__ == "__main__":
    debug_gemini()
