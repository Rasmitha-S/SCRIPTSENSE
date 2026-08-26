import requests
import io
import os
import docx
from PIL import Image, ImageDraw

BASE_URL = "http://127.0.0.1:8000"

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

def test_live_full_flow():
    print("\n" + "="*70)
    print("RUNNING LIVE END-TO-END VERIFICATION AGAINST http://127.0.0.1:8000")
    print("="*70)

    # 1. Login Teacher1
    r = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Teacher1 authenticated on live server.")

    # 2. Test Image OCR text extraction on live server
    print("\n[2] Testing Live Image OCR Extraction...")
    png_bytes = create_sample_png([
        "Newton second law states that Force = mass * acceleration",
        "SI unit of force is Newton"
    ])
    r_img = requests.post(
        f"{BASE_URL}/api/extract-text",
        files={"file": ("live_diagram.png", png_bytes, "image/png")},
        headers=headers
    )
    assert r_img.status_code == 200, f"Extract image failed: {r_img.text}"
    img_res = r_img.json()
    print(f"    -> Extracted Text Preview:\n       \"{img_res['extracted_text'][:80]}...\"")

    # 3. Test DOCX extraction on live server
    print("\n[3] Testing Live DOCX Extraction...")
    docx_bytes = create_sample_docx([
        "Work done is the dot product of force and displacement.",
        "W = F * d * cos(theta). Unit is Joules."
    ])
    r_docx = requests.post(
        f"{BASE_URL}/api/extract-text",
        files={"file": ("work_energy.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=headers
    )
    assert r_docx.status_code == 200, f"Extract DOCX failed: {r_docx.text}"
    docx_res = r_docx.json()
    print(f"    -> Extracted Text from DOCX:\n       \"{docx_res['extracted_text']}\"")

    # 4. Create Multi-Question Test on Live Server
    print("\n[4] Creating Multi-Question Test with Typed Q1 & Uploaded/Edited Q2...")
    u_suffix = os.urandom(2).hex().upper()
    r_st = requests.post(f"{BASE_URL}/api/students", json={"name": "Niels Bohr", "roll_number": f"PHYS-NB-{u_suffix}"}, headers=headers)
    assert r_st.status_code == 201
    st = r_st.json()

    test_payload = {
        "test_name": f"Live Physics Exam {u_suffix}",
        "subject": "Physics",
        "max_marks": 10.0,
        "questions": [
            {
                "q_num": 1,
                "question": "State Newton's second law and formula.",
                "model_answer": "Force is mass times acceleration (F = m * a). Force is measured in Newtons.",
                "max_marks": 5.0,
                "rubric": [
                    {"id": "q1_r1", "criterion": "Formula (F = m * a)", "max_marks": 2.5, "keywords": ["force", "mass", "acceleration"]},
                    {"id": "q1_r2", "criterion": "Units (Newtons)", "max_marks": 2.5, "keywords": ["newton"]}
                ]
            },
            {
                "q_num": 2,
                "question": "State the formula and units of work done.",
                "model_answer": docx_res["extracted_text"] + "\nNote: Angle theta is between force and displacement vectors.",
                "max_marks": 5.0,
                "rubric": [
                    {"id": "q2_r1", "criterion": "Formula & dot product", "max_marks": 3.0, "keywords": ["work", "force", "displacement"]},
                    {"id": "q2_r2", "criterion": "SI Units (Joules)", "max_marks": 2.0, "keywords": ["joules"]}
                ]
            }
        ],
        "student_ids": [st["id"]]
    }

    r_test = requests.post(f"{BASE_URL}/api/tests", json=test_payload, headers=headers)
    assert r_test.status_code == 201, f"Create test failed: {r_test.text}"
    created_test = r_test.json()
    test_id = created_test["id"]
    print(f"    -> [PASS] Created Live Test #{test_id} with Model Answer #{created_test['model_answer_id']}.")

    # 5. Upload student answer sheet and evaluate
    print("\n[5] Uploading Student Answer Sheet to Live Test...")
    student_png = create_sample_png([
        "Q1: F = m * a where force equals mass times acceleration in Newtons.",
        "Q2: Work is force times displacement (W = F * d) measured in Joules."
    ])
    r_up = requests.post(
        f"{BASE_URL}/api/upload",
        data={"student_id": st["id"], "student_name": st["name"], "roll_number": st["roll_number"], "test_id": test_id},
        files={"file": ("bohr_answersheet.png", student_png, "image/png")},
        headers=headers
    )
    assert r_up.status_code == 200
    sheet_id = r_up.json()["answer_sheet_id"]
    print(f"    -> [PASS] Uploaded Sheet #{sheet_id}.")

    # 6. Evaluate all sheets under test
    print("\n[6] Running Live Test Evaluation...")
    r_eval = requests.post(f"{BASE_URL}/api/tests/{test_id}/evaluate-all", headers=headers)
    assert r_eval.status_code == 200
    eval_res = r_eval.json()
    assert eval_res["processed_count"] == 1
    eval_obj = eval_res["successful_evaluations"][0]
    print(f"    -> [PASS] Evaluation Successful!")
    print(f"       Score: {eval_obj['suggested_marks']}/{eval_obj['max_marks']} M")
    print(f"       Similarity: {eval_obj['similarity']*100:.1f}%")

    print("\n" + "="*70)
    print("LIVE END-TO-END RUN COMPLETED WITH 100% SUCCESS!")
    print("="*70)

if __name__ == "__main__":
    test_live_full_flow()
