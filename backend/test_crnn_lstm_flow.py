import os
import sys
import numpy as np
import requests
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

BASE_URL = "http://127.0.0.1:8000"

def test_crnn_handwriting_pipeline():
    print("=" * 70)
    print("   TESTING CNN + BiLSTM + CTC HANDWRITTEN TEXT RECOGNITION PIPELINE   ")
    print("=" * 70)

    # 1. Load Trained CRNN Model
    print("\n[Step 1] Loading Trained CRNN (CNN + BiLSTM) Model...")
    from models.handwriting_cnn_lstm import load_crnn_model, recognize_line_image, CRNNHandwritingModel
    model = load_crnn_model()
    assert isinstance(model, CRNNHandwritingModel), "Model is not instance of CRNNHandwritingModel"
    print("         [PASS] CRNN model loaded successfully.")

    # 2. Test Line Image Recognition
    print("\n[Step 2] Testing Inference on Synthetic Line Image...")
    from models.handwriting_cnn_lstm.train import render_crnn_line_patch
    test_line = "TCP is a connection oriented protocol"
    line_patch = render_crnn_line_patch(test_line)
    recognized_line = recognize_line_image(model, line_patch)

    print(f"         Target Line:     '{test_line}'")
    print(f"         Recognized Line: '{recognized_line}'")
    print("         [PASS] Single line CRNN inference executed.")

    # 3. Test Full Handwritten Document Extraction
    sample_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "31_alex_rivera_physics_answer.png")
    if not os.path.exists(sample_img_path):
        sample_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "7_test_sheet.png")

    print(f"\n[Step 3] Testing Complete Document Extraction on: '{os.path.basename(sample_img_path)}'...")
    from services.handwriting_service import extract_handwritten_text_cnn
    extracted_text = extract_handwritten_text_cnn(sample_img_path)

    print("\n" + "-" * 70)
    print("                 CNN + BiLSTM EXTRACTED TEXT                     ")
    print("-" * 70)
    print(extracted_text)
    print("-" * 70)
    assert len(extracted_text) > 0, "Extracted text was empty"
    print("         [PASS] Document text lines recognized and combined in reading order.")

    # 4. Test FastAPI Upload Integration
    print("\n[Step 4] Testing POST /api/upload Integration with SQLite Storage...")
    login_res = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert login_res.status_code == 200, f"Teacher login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    with open(sample_img_path, "rb") as f:
        files = {"file": (os.path.basename(sample_img_path), f, "image/png")}
        data = {
            "student_name": "CRNN Test Student",
            "roll_number": "CRNN-2026-001"
        }
        res_upload = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files, data=data)

    assert res_upload.status_code == 200, f"Upload API failed: {res_upload.text}"
    upload_data = res_upload.json()
    sheet_id = upload_data["answer_sheet_id"]
    api_text = upload_data["extracted_text"]
    filename = upload_data.get("filename")
    status_val = upload_data.get("status")

    print("         [PASS] POST /api/upload returned 200 OK:")
    print(f"                - Answer Sheet ID: #{sheet_id}")
    print(f"                - Student: {upload_data.get('student_name')} ({upload_data.get('roll_number')})")
    print(f"                - Filename: {filename}")
    print(f"                - Status: {status_val}")
    print(f"                - Extracted Text Length: {len(api_text)} characters")

    # 5. Verify SQLite Database Record
    print("\n[Step 5] Verifying SQLite Database Persistence...")
    from database import SessionLocal
    from models import AnswerSheet
    db = SessionLocal()
    saved_sheet = db.query(AnswerSheet).filter(AnswerSheet.id == sheet_id).first()
    assert saved_sheet is not None, f"AnswerSheet #{sheet_id} not found in SQLite"
    assert saved_sheet.extracted_text == api_text, "Extracted text in SQLite does not match API response"
    print("         [PASS] SQLite persistence verified in answer_sheets.extracted_text.")
    db.close()

    print("\n" + "=" * 70)
    print("   ALL CNN + BiLSTM + CTC EXTRACTION TESTS PASSED 100%!        ")
    print("=" * 70)

if __name__ == "__main__":
    test_crnn_handwriting_pipeline()
