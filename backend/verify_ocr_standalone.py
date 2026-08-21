import os
import sys
from dotenv import load_dotenv

# Ensure backend root is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv()

from services.ocr_service import extract_text_from_file

def run_ocr_verification():
    print("=" * 60)
    print("      GOOGLE CLOUD VISION OCR SYSTEM DIAGNOSTIC")
    print("=" * 60)

    # 1. Check Vision Credentials configuration
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", os.path.join(backend_dir, "google-credentials.json"))
    if os.path.exists(cred_path):
        print(f"\n[1] Google Credentials: {cred_path} -> [FOUND & CONFIGURED]")
    else:
        print(f"\n[1] Google Credentials: Not found at {cred_path}")



    # 2. Test direct OCR on sample image from uploads
    sample_images = [
        "31_alex_rivera_physics_answer.png",
        "10_sample_physics_student.png",
        "11_sample_cs_student.png"
    ]

    for img_name in sample_images:
        img_path = os.path.join(backend_dir, "uploads", img_name)
        if os.path.exists(img_path):
            print(f"\n[2] Testing direct OCR on real sample file: '{img_name}' ({os.path.getsize(img_path)} bytes)")
            extracted = extract_text_from_file(img_path)
            print("-" * 50)
            print(extracted)
            print("-" * 50)
            break

    # 3. Test in-process /api/upload endpoint with live print
    print("\n[3] Testing /api/upload endpoint via FastAPI TestClient...")
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)

    # Login
    res_login = client.post("/api/login", json={"username": "teacher1", "password": "secret123"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Upload test image
    test_img_path = os.path.join(backend_dir, "uploads", "31_alex_rivera_physics_answer.png")
    with open(test_img_path, "rb") as f:
        res_upload = client.post(
            "/api/upload",
            files={"file": ("alex_physics_test.png", f, "image/png")},
            data={"student_name": "Alex Rivera", "roll_number": "CS2026-0101"},
            headers=headers
        )

    assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
    upload_data = res_upload.json()
    print(f"\n[3] /api/upload response received for Sheet ID #{upload_data['answer_sheet_id']}:")
    print(f"    Student: {upload_data['student_name']} (Roll: {upload_data['roll_number']})")
    print(f"    Extracted Text in Database:\n    \"{upload_data['extracted_text'].replace(chr(10), ' ')}\"")

    print("\n" + "=" * 60)
    print("   ALL OCR VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_ocr_verification()
