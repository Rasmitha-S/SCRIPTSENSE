import os
import sys
import json
import requests
from io import BytesIO
from PIL import Image, ImageDraw

BASE_URL = "http://127.0.0.1:8000"

def get_test_client():
    """
    Checks if live server is reachable; if not, returns an in-process FastAPI TestClient wrapper.
    """
    try:
        r = requests.get(f"{BASE_URL}/", timeout=1.0)
        if r.status_code == 200:
            return None  # Use live requests
    except Exception:
        pass
    
    # Fallback to FastAPI TestClient in-memory
    from fastapi.testclient import TestClient
    from main import app
    return TestClient(app)

def create_synthetic_handwritten_image(text: str) -> BytesIO:
    img = Image.new('RGB', (800, 300), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), text, fill=(0, 0, 0))
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

def run_test():
    print("=" * 65)
    print("  TESTING MULTI-QUESTION INDIVIDUAL MAX MARKS (2M + 5M = 7M)")
    print("=" * 65)

    client = get_test_client()
    if client is not None:
        print("[INFO] Server not running on port 8000. Using in-process TestClient.")
        c = client
        api_post = lambda url, **kwargs: c.post(url.replace(BASE_URL, ""), **kwargs)
        api_get = lambda url, **kwargs: c.get(url.replace(BASE_URL, ""), **kwargs)
        api_put = lambda url, **kwargs: c.put(url.replace(BASE_URL, ""), **kwargs)
    else:
        print("[INFO] Connected to live server at http://127.0.0.1:8000.")
        api_post = requests.post
        api_get = requests.get
        api_put = requests.put

    # 1. Login as teacher
    login_res = api_post(f"{BASE_URL}/api/login", json={
        "username": "teacher1",
        "password": "secret123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Teacher authenticated successfully.")

    # 2. Create multi-question model answer with Q1=2 marks, Q2=5 marks (Total=7 marks)
    model_payload = {
        "title": "Physics 2Q Paper (2M + 5M)",
        "subject": "Physics",
        "max_marks": 7.0,
        "questions": [
            {
                "q_num": 1,
                "question": "State Newton's second law of motion and write its mathematical formula.",
                "model_answer": "Newton's second law states that the rate of change of momentum of an object is proportional to applied force, F = m * a.",
                "max_marks": 2.0,
                "rubric": [
                    {
                        "id": "q1_r1",
                        "criterion": "Definition of momentum change and formula F = m * a",
                        "max_marks": 2.0,
                        "keywords": ["force", "momentum", "proportional", "f = m * a"]
                    }
                ]
            },
            {
                "q_num": 2,
                "question": "Define the Work-Energy Theorem, provide its formula, and explain a practical real-world example.",
                "model_answer": "The Work-Energy Theorem states that net work done by all forces equals the change in kinetic energy (W_net = Delta KE). For example, car brakes applying friction to reduce kinetic energy to zero.",
                "max_marks": 5.0,
                "rubric": [
                    {
                        "id": "q2_r1",
                        "criterion": "Definition and formula (W = Delta KE)",
                        "max_marks": 2.5,
                        "keywords": ["work", "kinetic energy", "delta", "change"]
                    },
                    {
                        "id": "q2_r2",
                        "criterion": "Practical application (car braking or falling object)",
                        "max_marks": 2.5,
                        "keywords": ["car", "brakes", "friction", "stopping"]
                    }
                ]
            }
        ]
    }

    create_model_res = api_post(f"{BASE_URL}/api/model-answer", json=model_payload, headers=headers)
    assert create_model_res.status_code == 200, f"Failed to create model answer: {create_model_res.text}"
    model_data = create_model_res.json()
    model_id = model_data["model_answer_id"]
    assert model_data["max_marks"] == 7.0, f"Expected 7.0 max marks, got {model_data['max_marks']}"
    assert model_data["questions_count"] == 2, f"Expected 2 questions, got {model_data['questions_count']}"
    print(f"[2] Created Model Answer ID #{model_id}: Total Max Marks = {model_data['max_marks']} (Q1=2.0M, Q2=5.0M)")

    # 3. Create student and upload student answer
    unique_roll = f"PHYS-{os.urandom(3).hex().upper()}"
    student_res = api_post(f"{BASE_URL}/api/students", json={
        "name": "Maria Curie",
        "roll_number": unique_roll
    }, headers=headers)
    student_id = student_res.json()["id"] if student_res.status_code in [200, 201] else None

    # Upload answer sheet
    img_buf = create_synthetic_handwritten_image("Q1: Force is proportional to momentum change, F=m*a. Q2: Work equals change in kinetic energy W=Delta KE, like car brakes.")
    files = {"file": ("student_exam.png", img_buf.getvalue(), "image/png")}
    upload_res = api_post(f"{BASE_URL}/api/upload", files=files, headers=headers)
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    sheet_id = upload_res.json()["answer_sheet_id"]

    # Provide clear transcript
    student_text = (
        "Q1: Newton's second law states that the rate of change of momentum of an object is proportional to applied force, F = m * a.\n\n"
        "Q2: The Work-Energy Theorem states that net work done equals the change in kinetic energy (W = Delta KE). For example, car brakes doing work against kinetic energy to stop the vehicle."
    )
    transcript_res = api_put(f"{BASE_URL}/api/uploads/{sheet_id}/transcript", json={"extracted_text": student_text}, headers=headers)
    assert transcript_res.status_code == 200

    # Link student
    if student_id:
        api_put(f"{BASE_URL}/api/answer-sheets/{sheet_id}/student", json={"student_id": student_id}, headers=headers)

    print(f"[3] AnswerSheet #{sheet_id} uploaded & transcript refined for student ID #{student_id}.")

    # 4. Evaluate answer sheet against 2-question model answer
    eval_res = api_post(f"{BASE_URL}/api/evaluate", json={
        "answer_sheet_id": sheet_id,
        "model_answer_id": model_id
    }, headers=headers)
    assert eval_res.status_code == 200, f"Evaluation failed: {eval_res.text}"
    eval_data = eval_res.json()
    eval_id = eval_data["evaluation_id"]

    print(f"\n[4] AI Evaluation Completed (Eval ID #{eval_id}):")
    print(f"    - Exam Total Max Marks: {eval_data['max_marks']} Marks")
    print(f"    - Overall Semantic Similarity: {eval_data['similarity']*100:.1f}%")
    print(f"    - Total Suggested Marks: {eval_data['suggested_marks']} / {eval_data['max_marks']}")
    print(f"    - Questions Evaluated: {len(eval_data['question_evaluations'])}")

    for qe in eval_data["question_evaluations"]:
        print(f"      * Q{qe['q_num']}: Max={qe['max_marks']}M | Suggested={qe['suggested_marks']}M (Sim: {qe['similarity']*100:.1f}%) | Prompt: {qe['question'][:40]}...")
        assert qe["suggested_marks"] <= qe["max_marks"], f"Q{qe['q_num']} suggested {qe['suggested_marks']} exceeds max {qe['max_marks']}"

    # Confirm Q1 max_marks is 2.0 and Q2 max_marks is 5.0
    q1 = next(q for q in eval_data["question_evaluations"] if q["q_num"] == 1)
    q2 = next(q for q in eval_data["question_evaluations"] if q["q_num"] == 2)
    assert q1["max_marks"] == 2.0, f"Expected Q1 max=2.0, got {q1['max_marks']}"
    assert q2["max_marks"] == 5.0, f"Expected Q2 max=5.0, got {q2['max_marks']}"

    # 5. Teacher verifies and adjusts per-question marks and saves
    save_res = api_put(f"{BASE_URL}/api/results/{eval_id}", json={
        "final_marks": 6.8,
        "teacher_feedback": "Excellent work on both mechanics questions. Very clear derivations.",
        "question_results": [
            {"q_num": 1, "final_marks": 2.0, "max_marks": 2.0, "teacher_comment": "Flawless definition and formula."},
            {"q_num": 2, "final_marks": 4.8, "max_marks": 5.0, "teacher_comment": "Great explanation and real world example."}
        ]
    }, headers=headers)
    assert save_res.status_code == 200, f"Save final marks failed: {save_res.text}"
    print("\n[5] Teacher saved verified per-question marks (Q1: 2.0/2.0, Q2: 4.8/5.0, Total: 6.8/7.0).")

    # 6. Retrieve result from /api/results/{id}
    res_get = api_get(f"{BASE_URL}/api/results/{eval_id}", headers=headers)
    assert res_get.status_code == 200
    res_data = res_get.json()
    assert res_data["final_marks"] == 6.8, f"Expected 6.8, got {res_data['final_marks']}"
    assert res_data["max_marks"] == 7.0, f"Expected 7.0, got {res_data['max_marks']}"
    assert len(res_data["question_results"]) == 2, f"Expected 2 question results, got {len(res_data['question_results'])}"
    
    breakdown_strs = []
    for qr in res_data['question_results']:
        q_n = qr['q_num']
        f_m = qr['final_marks']
        m_m = qr['max_marks']
        breakdown_strs.append(f"Q{q_n}: {f_m}/{m_m}M")

    print(f"[6] Verified GET /api/results/{eval_id}:")
    print(f"    - Final Marks: {res_data['final_marks']} / {res_data['max_marks']}")
    print(f"    - Verified By: {res_data['verified_by']}")
    print(f"    - Question Breakdown: {breakdown_strs}")

    print("\n" + "=" * 65)
    print("  ALL MULTI-QUESTION PER-QUESTION MARKS TESTS PASSED (100%)!")
    print("=" * 65)

if __name__ == "__main__":
    run_test()
