import os
import sys

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv()

from services.ocr_service import extract_text_from_file

def main():
    print("=" * 65)
    print("      GOOGLE CLOUD VISION API OCR TEST (Service Account)")
    print("=" * 65)

    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", os.path.join(backend_dir, "google-credentials.json"))
    if os.path.exists(cred_path):
        print(f"[+] Service account credentials found: {cred_path}")
    else:
        print(f"[-] WARNING: Credentials file not found at {cred_path}")

    uploads_dir = os.path.join(backend_dir, "uploads")
    
    # Priority list of sample handwritten/test images
    candidates = [
        "105_Screenshot_2026-08-19_135204.png",
        "100_31_alex_rivera_physics_answer.png",
        "106_alex_newton_answer.png",
        "31_alex_rivera_physics_answer.png",
        "7_test_sheet.png",
        "10_sample_physics_student.png",
    ]

    tested = 0
    for filename in candidates:
        image_path = os.path.join(uploads_dir, filename)
        if os.path.exists(image_path):
            file_size_kb = os.path.getsize(image_path) / 1024
            print(f"\n" + "-" * 60)
            print(f"[Testing Image]: {filename} ({file_size_kb:.1f} KB)")
            print(f"[File Path]    : {image_path}")
            print("-" * 60)

            extracted_text = extract_text_from_file(image_path)
            print("[EXTRACTED TEXT OUTPUT]:")
            print(extracted_text)
            print("-" * 60)
            tested += 1
            if tested >= 2:
                break

    if tested == 0:
        print("No sample images found in uploads directory.")

if __name__ == "__main__":
    main()
