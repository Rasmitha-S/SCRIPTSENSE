import os
import sys
import io
import requests
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

BASE_URL = "http://127.0.0.1:8000"

def test_ocr_upload_module():
    print("=" * 70)
    print("     TESTING HANDWRITTEN ANSWER OCR & UPLOAD EXTRACTION MODULE     ")
    print("=" * 70)

    # 1. Authenticate Teacher
    print("[1] Authenticating Teacher...")
    login_res = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("    [PASS] Teacher authenticated successfully.")

    # 2. Test Image Upload & OCR with sample answer sheet
    sample_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "31_alex_rivera_physics_answer.png")
    if not os.path.exists(sample_img_path):
        sample_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "7_test_sheet.png")

    print(f"\n[2] Uploading Sample Answer Sheet: {sample_img_path}")
    assert os.path.exists(sample_img_path), f"Sample file not found at {sample_img_path}"

    with open(sample_img_path, "rb") as f:
        files = {"file": (os.path.basename(sample_img_path), f, "image/png")}
        data = {
            "student_name": "Marcus Aurelius",
            "roll_number": "CS2026-9901"
        }
        res_upload = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files, data=data)

    assert res_upload.status_code == 200, f"Upload API failed: {res_upload.text}"
    upload_data = res_upload.json()

    sheet_id = upload_data.get("answer_sheet_id")
    extracted_text = upload_data.get("extracted_text")
    file_path = upload_data.get("file_path")
    student_name = upload_data.get("student_name")

    print("    [PASS] POST /api/upload returned 200 OK.")
    print(f"    - Answer Sheet ID: {sheet_id}")
    print(f"    - Saved File Path: {file_path}")
    print(f"    - Student: {student_name} (Roll: {upload_data.get('roll_number')})")
    print(f"    - Extracted Text Length: {len(extracted_text)} characters")

    print("\n" + "=" * 70)
    print("                     EXTRACTED OCR TEXT                     ")
    print("=" * 70)
    print(extracted_text)
    print("=" * 70)

    # 3. Verify SQLite Persistence
    print("\n[3] Verifying SQLite Database Persistence...")
    from database import SessionLocal
    from models import AnswerSheet
    db = SessionLocal()
    saved_sheet = db.query(AnswerSheet).filter(AnswerSheet.id == sheet_id).first()
    assert saved_sheet is not None, "Answer sheet not found in SQLite"
    assert saved_sheet.extracted_text == extracted_text, "Extracted text in SQLite does not match API response"
    print("    [PASS] Database record confirmed in SQLite (answer_sheets.extracted_text).")
    db.close()

    print("\n======================================================================")
    print("   OCR & UPLOAD MODULE TEST COMPLETED AND VERIFIED SUCCESSFULLY!      ")
    print("======================================================================")

if __name__ == "__main__":
    test_ocr_upload_module()
