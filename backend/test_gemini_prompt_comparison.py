import os
import sys
import io
import time
from PIL import Image
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

OLD_PROMPT = "Transcribe all handwritten text in this image exactly as written, preserving line breaks. Only return the transcribed text, nothing else."
NEW_PROMPT = (
    "You are an expert at reading handwritten text. Carefully transcribe every word in this image exactly as written. "
    "If a word is ambiguous, use context from surrounding words and common English spelling to infer the most likely correct word. "
    "Preserve line breaks and punctuation. Return ONLY the transcribed text, no explanations."
)

def test_prompt(image_bytes: bytes, prompt: str, api_key: str):
    import google.generativeai as genai
    genai.configure(api_key=api_key)

    img = Image.open(io.BytesIO(image_bytes))
    if img.mode not in ('RGB', 'L'):
        img = img.convert('RGB')

    model = genai.GenerativeModel("gemini-1.5-flash")
    t0 = time.time()
    response = model.generate_content(
        [prompt, img],
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

    print("=" * 70)
    print("      GEMINI OCR PROMPT COMPARISON (MESSY HANDWRITING SAMPLE)       ")
    print("=" * 70)
    print(f"Target Image: {messy_img}")
    print(f"API Key Present: {bool(api_key)}")
    print("=" * 70)

    with open(messy_img, "rb") as f:
        img_bytes = f.read()

    if not api_key:
        print("\n[NOTE] No GEMINI_API_KEY found in .env.")
        print("Here is the structural comparison of the prompt improvements:\n")
        print("Previous Baseline Prompt:")
        print(f"  \"{OLD_PROMPT}\"")
        print("\nImproved Expert Contextual Prompt:")
        print(f"  \"{NEW_PROMPT}\"")
        print("\n[Simulation / Expected Output Comparison on 144_Screenshot_2026-08-19_135204.png]:")
        print("=" * 70)
        return

    print("\n--- 1. Testing Previous Baseline Prompt ---")
    old_res, old_t = test_prompt(img_bytes, OLD_PROMPT, api_key)
    print(f"Time: {old_t:.2f}s")
    print("Extracted Text:")
    print("-" * 50)
    print(old_res)
    print("-" * 50)

    print("\n--- 2. Testing Improved Expert Contextual Prompt ---")
    new_res, new_t = test_prompt(img_bytes, NEW_PROMPT, api_key)
    print(f"Time: {new_t:.2f}s")
    print("Extracted Text:")
    print("-" * 50)
    print(new_res)
    print("-" * 50)

    print("\n======================================================================")
    print("COMPARISON & IMPROVEMENT ANALYSIS:")
    print("======================================================================")
    print("Baseline Output:")
    print(old_res)
    print("\nImproved Prompt Output:")
    print(new_res)
    print("=" * 70)

if __name__ == "__main__":
    main()
