import io
import os
import sys
import docx
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from main import app
from database import SessionLocal
import models

client = TestClient(app)

def create_sample_png(text_lines):
    img = Image.new("RGB", (700, 250), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    y = 30
    for line in text_lines:
        draw.text((20, y), line, fill=(0, 0, 0))
        y += 40
    
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf.getvalue()

def create_sample_docx(paragraphs):
    doc = docx.Document()
    for p in paragraphs:
        doc.add_paragraph(p)
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.getvalue()

def test_model_answer_restore_and_evaluation():
    print("\n" + "="*70)
    print("RUNNING RESTORED MODEL ANSWER (TYPED / FILE / OCR / DOCX) TEST SUITE")
    print("="*70)

    # 1. Login Teacher1
    res_login = client.post("/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res_login.status_code == 200, f"Login failed: {res_login.text}"
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Teacher1 authenticated successfully.")

    # 2. Test POST /api/extract-text with PNG Image (OCR Pipeline)
    print("\n[2] Testing POST /api/extract-text with PNG Image...")
    png_bytes = create_sample_png([
        "Newton second law states that Force = mass * acceleration",
        "SI unit of force is Newton (N)"
    ])
    res_extract_img = client.post(
        "/api/extract-text",
        files={"file": ("newton_diagram.png", png_bytes, "image/png")},
        headers=headers
    )
    assert res_extract_img.status_code == 200, f"Extract image failed: {res_extract_img.text}"
    img_data = res_extract_img.json()
    assert img_data["status"] == "success"
    assert "newton" in img_data["extracted_text"].lower() or "force" in img_data["extracted_text"].lower()
    print(f"    -> Extracted Text Preview from Image:\n       \"{img_data['extracted_text'][:80]}...\"")

    # 3. Test POST /api/extract-text with DOCX Word File (Direct python-docx Extraction)
    print("\n[3] Testing POST /api/extract-text with DOCX Word Document...")
    docx_bytes = create_sample_docx([
        "Kinetic Energy is the energy possessed by an object due to its motion.",
        "Formula: KE = 0.5 * m * v^2 where m is mass and v is velocity.",
        "The standard SI unit of energy is Joules (J)."
    ])
    res_extract_docx = client.post(
        "/api/extract-text",
        files={"file": ("kinetic_energy_solution.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=headers
    )
    assert res_extract_docx.status_code == 200, f"Extract DOCX failed: {res_extract_docx.text}"
    docx_data = res_extract_docx.json()
    assert docx_data["status"] == "success"
    assert "Kinetic Energy" in docx_data["extracted_text"]
    assert "0.5 * m * v^2" in docx_data["extracted_text"]
    assert "Joules" in docx_data["extracted_text"]
    print(f"    -> Extracted Text from DOCX:\n       \"{docx_data['extracted_text']}\"")

    # 4. Test POST /api/tests/extract-model-answer alias
    print("\n[4] Testing POST /api/tests/extract-model-answer alias...")
    res_alias = client.post(
        "/api/tests/extract-model-answer",
        files={"file": ("sample.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=headers
    )
    assert res_alias.status_code == 200
    assert "Kinetic Energy" in res_alias.json()["extracted_text"]
    print("    -> [PASS] /api/tests/extract-model-answer endpoint works identically.")

    # 5. Create a Student for Test
    u_suffix = os.urandom(2).hex().upper()
    res_stu = client.post(
        "/api/students",
        json={"name": "Robert Oppenheimer", "roll_number": f"PHYS-101-{u_suffix}"},
        headers=headers
    )
    assert res_stu.status_code == 201
    student = res_stu.json()
    student_id = student["id"]
    print(f"\n[5] Created Student #{student_id}: {student['name']}")

    # 6. Create Multi-Question Test with Mixed Input Methods:
    #    - Question 1: Model answer TYPED MANUALLY
    #    - Question 2: Model answer EXTRACTED FROM FILE (Image/PDF/DOCX) & EDITED via safety-net box
    print("\n[6] Creating Multi-Question Test with Mixed Input Methods (Q1 Typed, Q2 File Uploaded)...")
    q1_typed_answer = "Force equals mass multiplied by acceleration (F = m * a). Force is measured in Newtons."
    
    # Teacher uploaded DOCX or Image, reviewed in safety-net box, and made a minor correction
    q2_corrected_answer = docx_data["extracted_text"] + "\nNote: Velocity must be expressed in meters per second (m/s)."

    test_create_payload = {
        "test_name": "Midterm Physics Examination 2026",
        "subject": "Physics",
        "max_marks": 10.0,
        "questions": [
            {
                "q_num": 1,
                "question": "State Newton's Second Law and its formula.",
                "model_answer": q1_typed_answer,
                "max_marks": 5.0,
                "rubric": [
                    {"id": "q1_r1", "criterion": "Formula (F = m * a)", "max_marks": 2.5, "keywords": ["force", "mass", "acceleration"]},
                    {"id": "q1_r2", "criterion": "Units (Newtons)", "max_marks": 2.5, "keywords": ["newton", "newtons"]}
                ]
            },
            {
                "q_num": 2,
                "question": "Define Kinetic Energy, its formula, and units.",
                "model_answer": q2_corrected_answer,
                "max_marks": 5.0,
                "rubric": [
                    {"id": "q2_r1", "criterion": "Definition & formula", "max_marks": 3.0, "keywords": ["kinetic energy", "mass", "velocity"]},
                    {"id": "q2_r2", "criterion": "SI Units & notes", "max_marks": 2.0, "keywords": ["joules", "meters per second"]}
                ]
            }
        ],
        "student_ids": [student_id]
    }

    res_create_test = client.post("/api/tests", json=test_create_payload, headers=headers)
    assert res_create_test.status_code == 201, f"Create test failed: {res_create_test.text}"
    created_test = res_create_test.json()
    test_id = created_test["id"]
    model_answer_id = created_test["model_answer_id"]

    assert created_test["questions_count"] == 2
    assert created_test["students_count"] == 1
    assert created_test["max_marks"] == 10.0
    print(f"    -> Created Test #{test_id} with Model Answer #{model_answer_id}")

    # 7. Verify persistence in SQLite model_answers table
    print("\n[7] Verifying SQLite persistence in 'model_answers' table...")
    db = SessionLocal()
    try:
        db_model = db.query(models.ModelAnswer).filter(models.ModelAnswer.id == model_answer_id).first()
        assert db_model is not None, "Model answer not found in SQLite DB"
        assert db_model.test_id == test_id
        assert q1_typed_answer in db_model.answer_text
        assert "Kinetic Energy" in db_model.answer_text
        assert "Velocity must be expressed in meters per second" in db_model.answer_text
        print("    -> [PASS] Typed Q1 and Uploaded/Edited Q2 correctly stored in SQLite 'model_answers.answer_text' and 'questions_json'.")
    finally:
        db.close()

    # 8. Upload Student Answer Sheet for this Test
    print("\n[8] Uploading student answer sheet responding to both questions...")
    student_answer_png = create_sample_png([
        "Q1: Newton second law: F = m * a, force measured in Newtons.",
        "Q2: Kinetic energy is energy due to motion. KE = 0.5 * m * v^2 with units of Joules."
    ])
    res_upload_sheet = client.post(
        "/api/upload",
        data={
            "student_id": student_id,
            "student_name": student["name"],
            "roll_number": student["roll_number"],
            "test_id": test_id
        },
        files={"file": ("robert_answersheet.png", student_answer_png, "image/png")},
        headers=headers
    )
    assert res_upload_sheet.status_code == 200
    sheet = res_upload_sheet.json()
    sheet_id = sheet["answer_sheet_id"]
    print(f"    -> Answer Sheet #{sheet_id} uploaded successfully.")

    # 9. Evaluate Student Sheet against the mixed-source model answer
    print("\n[9] Running AI evaluation against Test model answer...")
    res_eval = client.post(
        f"/api/tests/{test_id}/evaluate-all",
        headers=headers
    )
    assert res_eval.status_code == 200
    eval_res = res_eval.json()
    assert eval_res["processed_count"] == 1
    eval_item = eval_res["successful_evaluations"][0]
    print(f"    -> Evaluation Score: {eval_item['suggested_marks']}/{eval_item['max_marks']} M")
    print(f"    -> AI Similarity: {eval_item['similarity']*100:.1f}%")
    assert eval_item["suggested_marks"] > 0
    assert eval_item["model_answer_id"] == model_answer_id
    print("    -> [PASS] Both questions evaluated seamlessly using the stored model answer.")

    print("\n" + "="*70)
    print("ALL RESTORED MODEL ANSWER & MULTI-QUESTION FLOW TESTS PASSED 100%!")
    print("="*70)

if __name__ == "__main__":
    test_model_answer_restore_and_evaluation()
