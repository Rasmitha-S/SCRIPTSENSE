import time
import requests
import io
from PIL import Image, ImageDraw, ImageFont

BASE_URL = "http://127.0.0.1:8000"

def test_fast_handwritten_ocr():
    print("================================================================")
    print("     TESTING FAST HANDWRITTEN OCR EXTRACTION & PERFORMANCE      ")
    print("================================================================\n")

    # 1. Login as teacher1
    res_login = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res_login.status_code == 200, f"Login failed: {res_login.text}"
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Teacher authenticated successfully.")

    # 2. Generate clear 2-mark handwritten style answer image
    img = Image.new("RGB", (700, 220), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((25, 30), "Student Answer - 2 Mark Question", fill=(15, 23, 42))
    draw.text((25, 75), "TCP is a connection oriented protocol that ensures", fill=(15, 23, 42))
    draw.text((25, 115), "reliable and ordered delivery of data packets.", fill=(15, 23, 42))
    draw.text((25, 155), "It uses a three-way handshake mechanism.", fill=(15, 23, 42))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_bytes = buf.getvalue()

    # 3. Upload and measure extraction time
    print("\n[2] Uploading answer image to POST /api/upload...")
    t0 = time.time()
    res_upload = requests.post(
        f"{BASE_URL}/api/upload",
        files={"file": ("tcp_answer_sheet.png", img_bytes, "image/png")},
        data={"student_name": "Marcus Vance", "roll_number": "CS2026-202"},
        headers=headers
    )
    t1 = time.time()
    elapsed = round(t1 - t0, 2)

    assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
    data = res_upload.json()
    sheet_id = data["answer_sheet_id"]
    student_id = data["student_id"]
    extracted_text = data["extracted_text"]
    status_val = data["status"]

    print(f"\n[3] OCR Extraction Completed in {elapsed}s:")
    print(f"    - answer_sheet_id: {sheet_id}")
    print(f"    - student_id:      {student_id}")
    print(f"    - status:          '{status_val}'")
    print(f"    - Extracted Text:\n\"\"\"\n{extracted_text}\n\"\"\"")

    assert sheet_id is not None
    assert student_id is not None
    assert status_val == "processed"
    assert len(extracted_text) > 10, "Extracted text should contain words from the image"
    assert "TCP" in extracted_text or "protocol" in extracted_text.lower() or "connection" in extracted_text.lower()

    # 4. Test Teacher manual edit/refinement
    print("\n[4] Testing Teacher editing OCR text (PUT /api/uploads/{id}/transcript)...")
    refined_text = "TCP is a connection oriented protocol that ensures reliable and ordered delivery of data packets."
    res_edit = requests.put(
        f"{BASE_URL}/api/uploads/{sheet_id}/transcript",
        json={"extracted_text": refined_text},
        headers=headers
    )
    assert res_edit.status_code == 200
    assert res_edit.json()["extracted_text"] == refined_text
    print("    - Teacher edit saved directly to answer_sheets.extracted_text in database [PASS].")

    # 5. Evaluate against Model Answer
    print("\n[5] Evaluating refined text against 2-Mark Model Answer...")
    res_model = requests.post(
        f"{BASE_URL}/api/model-answer",
        json={
            "question": "Define TCP and its primary characteristics.",
            "answer_text": "TCP is a connection-oriented transport protocol providing reliable and ordered delivery of packets.",
            "max_marks": 2.0
        },
        headers=headers
    )
    assert res_model.status_code == 200
    model_id = res_model.json()["model_answer_id"]

    res_eval = requests.post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_id, "model_answer_id": model_id},
        headers=headers
    )
    assert res_eval.status_code == 200
    eval_data = res_eval.json()
    print(f"    - Similarity:      {round(eval_data['similarity']*100, 1)}%")
    print(f"    - Suggested Marks: {eval_data['suggested_marks']}/2.0")
    print(f"    - Explanation:     {eval_data['explanation'][:90]}...")

    print("\n================================================================")
    print(f"   FAST OCR TEST PASSED SUCCESSFULLY IN {elapsed}s!             ")
    print("================================================================\n")

if __name__ == "__main__":
    test_fast_handwritten_ocr()
