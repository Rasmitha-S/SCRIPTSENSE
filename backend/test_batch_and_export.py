import io
import csv
import sys
import os
from test_client_helper import get_client, BASE_URL

requests = get_client()

def test_batch_and_export():
    print("================================================================")
    print("   TESTING BATCH EVALUATION, TRANSCRIPT EDIT, & CSV EXPORT      ")
    print("================================================================\n")

    # 1. Login
    res = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Teacher authenticated.")

    # 2. Upload 2 sample answer sheets
    sheet_ids = []
    for name, ans in [("Batch Student A", "Newton's second law is F = m * a."), ("Batch Student B", "Force is mass times acceleration.")]:
        files = {"file": ("batch_sample.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82", "image/png")}
        res_up = requests.post(f"{BASE_URL}/api/upload", files=files, data={"student_name": name}, headers=headers)
        assert res_up.status_code == 200
        sheet_id = res_up.json()["answer_sheet_id"]
        sheet_ids.append(sheet_id)

    print(f"[2] Uploaded 2 answer sheets with IDs: {sheet_ids}")

    # 3. Test Transcript Update Endpoint (PUT /api/uploads/{id}/transcript)
    custom_transcript = "Newton's second law: Force equals mass multiplied by acceleration (F = m * a)."
    res_trans = requests.put(
        f"{BASE_URL}/api/uploads/{sheet_ids[0]}/transcript",
        json={"extracted_text": custom_transcript},
        headers=headers
    )
    assert res_trans.status_code == 200
    assert res_trans.json()["extracted_text"] == custom_transcript
    print(f"[3] PUT /api/uploads/{sheet_ids[0]}/transcript updated OCR text successfully.")

    # 4. Create Model Answer
    res_mod = requests.post(
        f"{BASE_URL}/api/model-answer",
        json={
            "title": "Batch Test Mechanics Exam",
            "question": "Explain Newton's second law of motion.",
            "answer_text": "Newton's second law states that Force equals mass times acceleration (F = m * a).",
            "max_marks": 10.0
        },
        headers=headers
    )
    assert res_mod.status_code == 200
    model_id = res_mod.json()["model_answer_id"]
    print(f"[4] Created Model Answer ID #{model_id}")

    # 5. Test Batch Evaluation (POST /api/evaluate/batch)
    res_batch = requests.post(
        f"{BASE_URL}/api/evaluate/batch",
        json={
            "answer_sheet_ids": sheet_ids,
            "model_answer_id": model_id
        },
        headers=headers
    )
    assert res_batch.status_code == 200
    batch_data = res_batch.json()
    assert batch_data["processed_count"] == 2
    assert len(batch_data["successful_evaluations"]) == 2
    print(f"[5] POST /api/evaluate/batch evaluated {batch_data['processed_count']} sheets successfully.")
    for ev in batch_data["successful_evaluations"]:
        print(f"    - Eval #{ev['evaluation_id']}: Student: {ev['student_name']}, Suggested: {ev['suggested_marks']}/{ev['max_marks']} (Sim: {ev['similarity']*100:.1f}%)")

    # 6. Test CSV Export (GET /api/results/export/csv)
    res_csv = requests.get(f"{BASE_URL}/api/results/export/csv", headers=headers)
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers.get("content-type", "")
    assert "attachment; filename=" in res_csv.headers.get("content-disposition", "")
    
    csv_reader = csv.reader(io.StringIO(res_csv.text))
    rows = list(csv_reader)
    assert len(rows) >= 3, f"Expected at least 3 rows in CSV (header + 2 rows), got {len(rows)}"
    print(f"[6] GET /api/results/export/csv returned {len(rows)} rows with columns: {rows[0][:6]}...")

    print("\n================================================================")
    print("   ALL BATCH EVALUATION & CSV EXPORT TESTS PASSED!              ")
    print("================================================================")

if __name__ == "__main__":
    test_batch_and_export()
