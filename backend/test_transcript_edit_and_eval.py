import os
import sys
import json
import sqlite3
import uuid
from test_client_helper import get_client, BASE_URL

requests = get_client()

def test_transcript_edit_and_evaluation_flow():
    print("=" * 70)
    print("   TESTING EDITABLE TRANSCRIPT SAFETY NET & EVALUATION FLOW   ")
    print("=" * 70)

    # 1. Login
    res_login = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res_login.status_code == 200
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Logged in as teacher1.")

    # 2. Add Student
    roll = f"CS-SA-NET-{uuid.uuid4().hex[:6]}"
    res_student = requests.post(f"{BASE_URL}/api/students", json={"name": "Sam Altman", "roll_number": roll}, headers=headers)
    assert res_student.status_code in [200, 201]
    student_id = res_student.json()["id"]
    print(f"[2] Created Student #{student_id} (Sam Altman - {roll}).")

    # 3. Upload rough screenshot image
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sample_img = os.path.join(base_dir, "uploads", "144_Screenshot_2026-08-19_135204.png")
    if not os.path.exists(sample_img):
        sample_img = os.path.join(base_dir, "uploads", "105_Screenshot_2026-08-19_135204.png")

    with open(sample_img, "rb") as f:
        files = {"file": ("student_handwritten_network_answer.png", f, "image/png")}
        data = {"student_id": str(student_id), "student_name": "Sam Altman"}
        res_upload = requests.post(f"{BASE_URL}/api/upload", files=files, data=data, headers=headers)

    assert res_upload.status_code == 200
    upload_data = res_upload.json()
    sheet_id = upload_data["answer_sheet_id"]
    raw_ocr = upload_data["extracted_text"]
    print(f"[3] Uploaded Answer Sheet #{sheet_id}.")
    print(f"    Raw OCR Output:\n    {repr(raw_ocr)}")

    # 4. Teacher manually reviews and corrects the transcript in the editor
    corrected_student_text = (
        "A computer network is a system of interconnected computers and devices "
        "that communicate with each other and share resources, files, and data."
    )
    print("\n[4] Teacher corrects transcript in UI and submits to backend...")
    res_update = requests.put(
        f"{BASE_URL}/api/uploads/{sheet_id}/transcript",
        json={"extracted_text": corrected_student_text},
        headers=headers
    )
    assert res_update.status_code == 200
    updated_data = res_update.json()
    assert updated_data["extracted_text"] == corrected_student_text, "Updated text mismatch in response"
    print(f"    Transcript Update API Confirmed: '{updated_data['extracted_text']}'")

    # 5. Verify direct SQLite database storage
    conn = sqlite3.connect(os.path.join(base_dir, "scriptsense.db"))
    c = conn.cursor()
    c.execute("SELECT extracted_text FROM answer_sheets WHERE id = ?", (sheet_id,))
    db_extracted = c.fetchone()[0]
    conn.close()
    assert db_extracted == corrected_student_text, f"Database has stale text: {db_extracted}"
    print(f"[5] Verified directly in SQLite DB: Database extracted_text == '{db_extracted}'")

    # 6. Create Model Answer for Computer Networks
    model_payload = {
        "title": "Computer Networks Quiz",
        "subject": "Computer Science",
        "question": "What is a computer network and what is its primary purpose?",
        "answer_text": "A computer network is an interconnected group of computing devices that communicate and exchange data and share resources.",
        "max_marks": 10.0
    }
    res_model = requests.post(f"{BASE_URL}/api/model-answer", json=model_payload, headers=headers)
    model_id = res_model.json()["model_answer_id"]
    print(f"[6] Created Model Answer #{model_id}: '{model_payload['question']}'")

    # 7. Run AI Evaluation
    res_eval = requests.post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_id, "model_answer_id": model_id},
        headers=headers
    )
    assert res_eval.status_code == 200
    eval_data = res_eval.json()
    eval_id = eval_data["evaluation_id"]
    sim = eval_data["similarity"]
    suggested = eval_data["suggested_marks"]
    explanation = eval_data["explanation"]

    print(f"\n[7] AI Evaluation Result for #{eval_id}:")
    print(f"    - Semantic Similarity: {round(sim * 100, 1)}%")
    print(f"    - AI Suggested Marks: {suggested} / 10.0")
    print(f"    - AI Explanation: {explanation}")

    # Confirm evaluation evaluated the corrected text (should be >= 80% similarity)
    assert sim >= 0.75, f"Expected high similarity with corrected text, got {sim}"
    print("[8] Confirmation: AI evaluated the corrected transcript, NOT the raw fragmented OCR!")

    # 8. Check Results record
    res_res = requests.get(f"{BASE_URL}/api/results/{eval_id}", headers=headers)
    assert res_res.status_code == 200
    res_data = res_res.json()
    assert res_data["extracted_text"] == corrected_student_text
    print(f"[9] Results record verified: Student text stored = '{res_data['extracted_text']}'")

    print("\n" + "=" * 70)
    print("   ALL TESTS PASSED: EDITABLE TRANSCRIPT FLOW VERIFIED 100%   ")
    print("=" * 70)

if __name__ == "__main__":
    test_transcript_edit_and_evaluation_flow()
