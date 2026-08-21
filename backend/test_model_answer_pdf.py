import os
import requests
import json
import io
from PIL import Image, ImageDraw

BASE_URL = "http://127.0.0.1:8000"

def get_test_client():
    try:
        r = requests.get(f"{BASE_URL}/", timeout=1.0)
        if r.status_code == 200:
            return None  # Use live requests
    except Exception:
        pass
    
    from fastapi.testclient import TestClient
    from main import app
    return TestClient(app)

def create_sample_pdf_image(text_lines):
    img = Image.new("RGB", (700, 300), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    y = 30
    for line in text_lines:
        draw.text((20, y), line, fill=(0, 0, 0))
        y += 40
    
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

def test_model_answer_pdf_upload():
    print("================================================================")
    print("   TESTING MODEL ANSWER PDF / FILE UPLOAD & OCR EXTRACTION      ")
    print("================================================================\n")

    client = get_test_client()
    if client is not None:
        print("[INFO] Server not running on port 8000. Using in-process TestClient.")
        c = client
        api_post = lambda url, **kwargs: c.post(url.replace(BASE_URL, ""), **kwargs)
        api_get = lambda url, **kwargs: c.get(url.replace(BASE_URL, ""), **kwargs)
    else:
        print("[INFO] Connected to live server at http://127.0.0.1:8000.")
        api_post = requests.post
        api_get = requests.get

    # 1. Login as teacher
    res_login = api_post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res_login.status_code == 200, f"Login failed: {res_login.text}"
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Teacher authenticated successfully.")

    # 2. Test Case A: Upload Model Answer as PDF / Image (No typed text) -> OCR Extraction
    print("\n[2] Test Case A: Upload Model Answer PDF with no typed text...")
    pdf_bytes = create_sample_pdf_image([
        "Model Solution for Newton Second Law:",
        "Force is the product of mass and acceleration (F = m * a).",
        "Force is measured in standard SI units of Newtons."
    ])

    files = {"file": ("newton_model_answer.png", pdf_bytes, "image/png")}
    data = {
        "question": "State Newton's second law and its formula.",
        "max_marks": "10.0",
        "title": "Newton Law Reference PDF",
        "subject": "Physics"
    }

    res_pdf = api_post(
        f"{BASE_URL}/api/model-answer",
        files=files,
        data=data,
        headers=headers
    )
    assert res_pdf.status_code == 200, f"Model answer PDF upload failed: {res_pdf.text}"
    pdf_res = res_pdf.json()
    model_id_a = pdf_res["model_answer_id"]
    print(f"    -> Created Model Answer ID #{model_id_a}")
    print(f"    -> Extracted Text Preview: {pdf_res.get('extracted_text')[:80]}...")
    assert len(pdf_res.get("extracted_text", "")) > 10, "Extracted text should not be empty"

    # Verify retrieval from GET /api/model-answers
    res_list = api_get(f"{BASE_URL}/api/model-answers", headers=headers)
    assert res_list.status_code == 200
    saved_model_a = next((m for m in res_list.json() if m["id"] == model_id_a), None)
    assert saved_model_a is not None, f"Model #{model_id_a} not found in database"
    assert "Newton" in saved_model_a["answer_text"] or "Force" in saved_model_a["answer_text"] or len(saved_model_a["answer_text"]) > 10
    print(f"    -> [PASS] Stored in SQLite 'model_answers.answer_text':\n       \"{saved_model_a['answer_text'][:100]}...\"")

    # 3. Test Case B: Both Typed Text AND PDF File Provided -> Prioritizes Typed Text
    print("\n[3] Test Case B: Both Typed Text AND PDF provided (Verifying Typed Priority)...")
    typed_custom_override = "CUSTOM OVERRIDE: F = m * a where Force equals mass times acceleration."
    data_both = {
        "question": "State Newton's second law.",
        "answer_text": typed_custom_override,
        "max_marks": "10.0",
        "title": "Priority Test Answer",
        "subject": "Physics"
    }
    files_both = {"file": ("sample.png", pdf_bytes, "image/png")}

    res_both = api_post(
        f"{BASE_URL}/api/model-answer",
        files=files_both,
        data=data_both,
        headers=headers
    )
    assert res_both.status_code == 200
    model_id_b = res_both.json()["model_answer_id"]
    saved_model_b = next((m for m in api_get(f"{BASE_URL}/api/model-answers", headers=headers).json() if m["id"] == model_id_b), None)
    assert saved_model_b is not None
    assert saved_model_b["answer_text"] == typed_custom_override, f"Expected typed text priority, got: {saved_model_b['answer_text']}"
    print(f"    -> [PASS] Priority correctly honored: \"{saved_model_b['answer_text']}\"")

    # 4. Test Case C: End-to-End Evaluation against PDF Model Answer
    print("\n[4] Test Case C: Evaluating Student Answer Sheet against PDF-derived Model Answer...")
    student_bytes = create_sample_pdf_image([
        "Newton second law states that Force = mass * acceleration (F = m * a).",
        "Force is measured in Newtons."
    ])
    files_stu = {"file": ("student_sheet.png", student_bytes, "image/png")}
    data_stu = {"student_name": "Oliver Queen"}
    res_stu = api_post(f"{BASE_URL}/api/upload", files=files_stu, data=data_stu, headers=headers)
    assert res_stu.status_code == 200
    sheet_id = res_stu.json()["answer_sheet_id"]

    res_eval = api_post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_id, "model_answer_id": model_id_a},
        headers=headers
    )
    assert res_eval.status_code == 200, f"Evaluation failed: {res_eval.text}"
    eval_data = res_eval.json()
    print(f"    -> Evaluation ID #{eval_data['evaluation_id']}")
    print(f"    -> Similarity Score: {eval_data['similarity']*100:.1f}%")
    print(f"    -> Suggested Marks: {eval_data['suggested_marks']}/{eval_data['max_marks']}")
    print(f"    -> AI Rationale: {eval_data['explanation']}")

    print("\n================================================================")
    print("   ALL MODEL ANSWER PDF UPLOAD & OCR TESTS PASSED SUCCESSFULLY! ")
    print("================================================================")

if __name__ == "__main__":
    test_model_answer_pdf_upload()
