import os
import sys
import sqlite3
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from database import SessionLocal
import models

def test_full_editable_transcript_pipeline():
    client = TestClient(app)

    print("=" * 75)
    print("  AUTOMATED END-TO-END TEST: EDITABLE OCR TRANSCRIPT SAFETY NET FLOW  ")
    print("=" * 75)

    # 1. Login
    res_login = client.post("/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res_login.status_code == 200, f"Login failed: {res_login.text}"
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Authentication: Logged in successfully as teacher1.")

    # 2. Add Student
    res_student = client.post(
        "/api/students",
        json={"name": "Sam Altman", "roll_number": f"CS-SA-NET-{os.getpid()}"},
        headers=headers
    )
    assert res_student.status_code in [200, 201], f"Student creation failed: {res_student.text}"
    student_id = res_student.json()["id"]
    print(f"[2] Student Creation: Created Student #{student_id} ('Sam Altman').")

    # 3. Upload Messy Image (144_Screenshot_2026-08-19_135204.png)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sample_img = os.path.join(base_dir, "uploads", "144_Screenshot_2026-08-19_135204.png")
    if not os.path.exists(sample_img):
        sample_img = os.path.join(base_dir, "uploads", "105_Screenshot_2026-08-19_135204.png")

    assert os.path.exists(sample_img), f"Sample image file does not exist: {sample_img}"

    with open(sample_img, "rb") as f:
        files = {"file": ("student_handwritten_network_answer.png", f.read(), "image/png")}
        data = {"student_id": str(student_id), "student_name": "Sam Altman"}
        res_upload = client.post("/api/upload", files=files, data=data, headers=headers)

    assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
    upload_data = res_upload.json()
    sheet_id = upload_data["answer_sheet_id"]
    raw_ocr = upload_data["extracted_text"]
    print(f"[3] File Upload & OCR:")
    print(f"    - Answer Sheet ID: #{sheet_id}")
    print(f"    - Raw Fragmented OCR Output:\n      {repr(raw_ocr)}")

    # 4. Teacher reviews and manually corrects the transcript in the editor box
    corrected_student_text = (
        "A computer network is a system of interconnected computers and devices "
        "that communicate with each other and share resources, files, and data."
    )
    print(f"\n[4] Teacher Edits Transcript:")
    print(f"    - Corrected Text: '{corrected_student_text}'")
    
    res_update = client.put(
        f"/api/uploads/{sheet_id}/transcript",
        json={"extracted_text": corrected_student_text},
        headers=headers
    )
    assert res_update.status_code == 200, f"Transcript update failed: {res_update.text}"
    updated_data = res_update.json()
    assert updated_data["extracted_text"] == corrected_student_text, "Updated text mismatch"
    print(f"    - Transcript Update API Response: Confirmed updated text saved!")

    # 5. Verify direct SQLite database storage
    conn = sqlite3.connect(os.path.join(base_dir, "scriptsense.db"))
    c = conn.cursor()
    c.execute("SELECT extracted_text FROM answer_sheets WHERE id = ?", (sheet_id,))
    db_extracted = c.fetchone()[0]
    conn.close()
    assert db_extracted == corrected_student_text, f"Database has stale text: {db_extracted}"
    print(f"[5] Direct SQLite DB Inspection: answer_sheets table confirmed holding corrected text.")

    # 6. Create Model Answer for Computer Networks
    model_payload = {
        "title": "Computer Networks Quiz",
        "subject": "Computer Science",
        "question": "What is a computer network and what is its primary purpose?",
        "answer_text": "A computer network is an interconnected group of computing devices that communicate and exchange data and share resources.",
        "max_marks": 10.0
    }
    res_model = client.post("/api/model-answer", json=model_payload, headers=headers)
    assert res_model.status_code == 200, f"Model answer creation failed: {res_model.text}"
    model_id = res_model.json()["model_answer_id"]
    print(f"[6] Model Answer Benchmark: Created Model Answer #{model_id} ('{model_payload['title']}').")

    # 7. Run AI Evaluation
    res_eval = client.post(
        "/api/evaluate",
        json={"answer_sheet_id": sheet_id, "model_answer_id": model_id},
        headers=headers
    )
    assert res_eval.status_code == 200, f"Evaluation failed: {res_eval.text}"
    eval_data = res_eval.json()
    eval_id = eval_data["evaluation_id"]
    sim = eval_data["similarity"]
    suggested = eval_data["suggested_marks"]
    explanation = eval_data["explanation"]

    print(f"\n[7] AI Evaluation Result for #{eval_id}:")
    print(f"    - Evaluated Student Text: (Fetched from DB answer_sheets.extracted_text)")
    print(f"    - Semantic Similarity: {round(sim * 100, 1)}%")
    print(f"    - AI Suggested Marks: {suggested} / 10.0")
    print(f"    - AI Explanation: {explanation}")

    # Confirm evaluation evaluated the corrected text (similarity >= 75%)
    # If raw fragmented OCR had been evaluated, similarity would have been < 30%.
    assert sim >= 0.75, f"Expected high similarity with corrected text, got {sim}"
    print(f"[8] Confirmation: AI evaluated the CORRECTED transcript (Similarity: {round(sim * 100, 1)}% >= 75%).")

    # 8. Check Results record via API
    res_res = client.get(f"/api/results/{eval_id}", headers=headers)
    assert res_res.status_code == 200, f"Get result failed: {res_res.text}"
    res_data = res_res.json()
    assert res_data["extracted_text"] == corrected_student_text, f"Stale text in results: {res_data['extracted_text']}"
    print(f"[9] Final Results Record Verification: Result object returned student text == '{res_data['extracted_text']}'.")

    print("\n" + "=" * 75)
    print("  ALL ASSERTIONS PASSED (100%): EDITABLE TRANSCRIPT SAFETY NET CONFIRMED!  ")
    print("=" * 75)

if __name__ == "__main__":
    test_full_editable_transcript_pipeline()
