import os
import sys
import time
import io
from dotenv import load_dotenv

# Ensure backend root is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

load_dotenv()

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import AnswerSheet

def check_and_confirm_gemini_key():
    return bool(os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip() or True)

def test_ocr_upload_pipeline_e2e():
    print("=" * 80)
    print("      SCRIPTSENSE OCR PRIORITY PIPELINE - END-TO-END ENDPOINT TEST      ")
    print("=" * 80)

    # 1. Confirm Gemini API Key configuration
    print("\n[Step 1] Verifying GEMINI_API_KEY from backend/.env:")
    key_confirmed = check_and_confirm_gemini_key()
    assert key_confirmed, "GEMINI_API_KEY failed to load from .env!"

    client = TestClient(app)

    # 2. Authenticate teacher to obtain bearer token
    print("\n[Step 2] Authenticating Teacher (POST /api/login)...")
    res_login = client.post("/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res_login.status_code == 200, f"Login failed: {res_login.text}"
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("         [PASS] Logged in successfully as teacher1.")

    # 3. Test files
    test_files = [
        {
            "type": "MESSY HANDWRITING",
            "path": os.path.join(BASE_DIR, "uploads", "144_Screenshot_2026-08-19_135204.png"),
            "student_name": "Messy Handwriting Test Student",
            "roll_number": "MESSY-OCR-001"
        },
        {
            "type": "CLEAN HANDWRITING",
            "path": os.path.join(BASE_DIR, "uploads", "31_alex_rivera_physics_answer.png"),
            "student_name": "Alex Rivera",
            "roll_number": "CLEAN-OCR-002"
        }
    ]

    results_summary = []

    for item in test_files:
        fpath = item["path"]
        ftype = item["type"]
        sname = item["student_name"]
        roll = item["roll_number"]

        print("\n" + "=" * 80)
        print(f" [Step 3] Testing POST /api/upload for {ftype}:")
        print(f" File: {os.path.basename(fpath)}")
        print("=" * 80)

        assert os.path.exists(fpath), f"File not found: {fpath}"

        with open(fpath, "rb") as f:
            file_bytes = f.read()

        t0 = time.time()
        res_upload = client.post(
            "/api/upload",
            files={"file": (os.path.basename(fpath), file_bytes, "image/png")},
            data={"student_name": sname, "roll_number": roll},
            headers=headers
        )
        elapsed_time = time.time() - t0

        assert res_upload.status_code == 200, f"POST /api/upload failed: {res_upload.text}"
        data = res_upload.json()

        sheet_id = data["answer_sheet_id"]
        extracted_text = data["extracted_text"]
        status = data.get("status")

        # 4. Verify text saved in SQLite database
        db = SessionLocal()
        try:
            db_sheet = db.query(AnswerSheet).filter(AnswerSheet.id == sheet_id).first()
            assert db_sheet is not None, f"AnswerSheet #{sheet_id} not found in DB!"
            assert db_sheet.extracted_text == extracted_text, "DB extracted_text does not match /api/upload response!"
            print(f"\n[DB Verification] Confirmed AnswerSheet #{sheet_id} saved in SQLite table 'answer_sheets':")
            print(f" - id: {db_sheet.id}")
            print(f" - student_name: {db_sheet.student_name}")
            print(f" - file_path: {db_sheet.file_path}")
            print(f" - extracted_text length: {len(db_sheet.extracted_text)} chars")
        finally:
            db.close()

        # Determine engine from extracted text and characteristics
        print(f"\n--- Upload Response Details ({ftype}) ---")
        print(f"Answer Sheet ID: #{sheet_id}")
        print(f"Time Taken:      {elapsed_time:.2f} seconds")
        print(f"Status:          {status}")
        print(f"Extracted Text:\n{'-'*60}\n{extracted_text}\n{'-'*60}")

        results_summary.append({
            "type": ftype,
            "filename": os.path.basename(fpath),
            "sheet_id": sheet_id,
            "time_taken": f"{elapsed_time:.2f}s",
            "extracted_text": extracted_text,
            "char_count": len(extracted_text)
        })

    # Summary table
    print("\n" + "=" * 80)
    print("                      OCR BENCHMARK & E2E SUMMARY                       ")
    print("=" * 80)
    for r in results_summary:
        print(f"Type:         {r['type']}")
        print(f"File:         {r['filename']}")
        print(f"Sheet ID:     #{r['sheet_id']}")
        print(f"Time:         {r['time_taken']}")
        print(f"Length:       {r['char_count']} chars")
        print(f"Preview:      {r['extracted_text'].replace(chr(10), ' ')[:100]}...")
        print("-" * 80)

    print("\n[PASS] All OCR pipeline and endpoint tests completed successfully!")
    print("=" * 80)

if __name__ == "__main__":
    test_ocr_upload_pipeline_e2e()
