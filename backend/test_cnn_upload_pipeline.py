import os
import sys
import requests
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

BASE_URL = "http://127.0.0.1:8000"

def test_full_cnn_upload_pipeline():
    print("=" * 70)
    print("      SCRIPTSENSE: COMPLETE CNN HANDWRITING EXTRACTION PIPELINE TEST      ")
    print("=" * 70)

    # 1. Step A: Standalone Preprocessing & Segmentation Verification
    from services.image_preprocessing import preprocess_image_for_cnn
    from services.handwriting_segmentation import segment_handwriting_document
    from PIL import Image

    sample_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "31_alex_rivera_physics_answer.png")
    if not os.path.exists(sample_img_path):
        sample_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "7_test_sheet.png")

    assert os.path.exists(sample_img_path), f"Test sample image missing: {sample_img_path}"
    print(f"\n[Step 1] Verifying Image Preprocessing on '{os.path.basename(sample_img_path)}'...")
    enhanced_gray, binary_img = preprocess_image_for_cnn(sample_img_path)
    print(f"         Enhanced Grayscale shape: {enhanced_gray.shape}, Binary shape: {binary_img.shape}")
    print("         [PASS] Image preprocessing (Grayscale -> Bilateral Filter -> CLAHE -> Otsu) complete.")

    print(f"\n[Step 2] Verifying Handwriting Segmentation (Lines & Character Units)...")
    doc_lines = segment_handwriting_document(binary_img)
    total_chars = sum(len(line) for line in doc_lines)
    print(f"         Segmented: {len(doc_lines)} text lines, {total_chars} character units in reading order.")
    print("         [PASS] Handwriting segmentation complete.")

    # 2. Step B: CNN Character Prediction & Reconstruction
    from services.handwriting_service import extract_handwritten_text_cnn
    print(f"\n[Step 3] Running CNN Model Inference & Word/Line Reconstruction...")
    direct_extracted_text = extract_handwritten_text_cnn(sample_img_path)
    print("\n" + "-" * 70)
    print("                 CNN RECONSTRUCTED EXTRACTED TEXT                ")
    print("-" * 70)
    print(direct_extracted_text)
    print("-" * 70)
    assert len(direct_extracted_text) > 0, "Direct extraction returned empty text"
    print("         [PASS] CNN character inference and text reconstruction succeeded.")

    # 3. Step C: Teacher Authentication & FastAPI Upload
    print(f"\n[Step 4] Authenticating Teacher & Sending POST /api/upload...")
    login_res = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert login_res.status_code == 200, f"Teacher login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    with open(sample_img_path, "rb") as f:
        files = {"file": (os.path.basename(sample_img_path), f, "image/png")}
        data = {
            "student_name": "CNN Evaluated Student",
            "roll_number": "CNN-STU-2026"
        }
        res_upload = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files, data=data)

    assert res_upload.status_code == 200, f"POST /api/upload failed: {res_upload.text}"
    upload_resp = res_upload.json()
    sheet_id = upload_resp["answer_sheet_id"]
    api_text = upload_resp["extracted_text"]
    filename = upload_resp.get("filename")
    status_val = upload_resp.get("status")

    print(f"         [PASS] Upload Endpoint returned 200 OK:")
    print(f"                - Answer Sheet ID: #{sheet_id}")
    print(f"                - Student: {upload_resp.get('student_name')} ({upload_resp.get('roll_number')})")
    print(f"                - Filename: {filename}")
    print(f"                - Status: {status_val}")
    print(f"                - Extracted Text Length: {len(api_text)} characters")

    # 4. Step D: Verify SQLite Persistence
    print(f"\n[Step 5] Verifying Persistence in SQLite database...")
    from database import SessionLocal
    import models
    db = SessionLocal()
    saved_sheet = db.query(models.AnswerSheet).filter(models.AnswerSheet.id == sheet_id).first()
    assert saved_sheet is not None, f"AnswerSheet #{sheet_id} not found in SQLite"
    assert saved_sheet.extracted_text == api_text, "Extracted text in SQLite does not match API response"
    print(f"         [PASS] Verified record in SQLite: answer_sheets.extracted_text matches API response.")
    db.close()

    print("\n" + "=" * 70)
    print("   ALL 5 STAGES OF CNN TEXT EXTRACTION & UPLOAD VERIFIED 100%!   ")
    print("=" * 70)

if __name__ == "__main__":
    test_full_cnn_upload_pipeline()
