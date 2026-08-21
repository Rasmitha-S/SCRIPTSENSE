import sys
import requests

if hasattr(sys.stdout, "reconfigure"):
    getattr(sys.stdout, "reconfigure")(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def test_student_portal_ai_chatbot():
    print("================================================================")
    print("   TESTING STUDENT PORTAL AI MARKS EXPLAINER & CHATBOT API     ")
    print("================================================================\n")

    # 1. Lookup a student result
    login_res = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert login_res.status_code == 200, f"Teacher login failed: {login_res.text}"

    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch existing evaluations
    res_evals = requests.get(f"{BASE_URL}/api/results", headers=headers)
    assert res_evals.status_code == 200, "Failed to list evaluations"
    eval_list = res_evals.json()

    target_student_roll = None
    if eval_list:
        for ev in eval_list:
            if ev.get("roll_number"):
                target_student_roll = ev.get("roll_number")
                break

    if not target_student_roll:
        target_student_roll = "MQ-STU-406D2"

    res_lookup = requests.post(f"{BASE_URL}/api/student/portal-access", json={"roll_number_or_id": target_student_roll})




    assert res_lookup.status_code == 200, f"Portal lookup failed: {res_lookup.text}"
    portal_data = res_lookup.json()
    student_name = portal_data["student_name"]
    roll_num = portal_data["roll_number"]
    print(f"[1] Student Portal Loaded for: {student_name} (Roll: {roll_num})")
    print(f"    - Total exams found: {portal_data['total_exams']}")
    print(f"    - Verified exams: {portal_data['verified_exams']}")

    results = portal_data.get("results", [])
    assert len(results) > 0, "No exam results found for student."
    
    # Pick verified/evaluated exam
    exam = next((r for r in results if r.get("status") in ["Verified", "Evaluated"]), results[0])
    
    eval_id = exam.get("evaluation_id")
    subject = exam.get("subject")
    title = exam.get("title")
    question = exam.get("question")
    score = exam.get("final_marks") or exam.get("suggested_marks") or 0.0
    max_marks = exam.get("max_marks") or 10.0
    similarity = exam.get("similarity") or 0.0
    status_str = exam.get("status")

    print(f"\n[2] Target Exam for AI Explanation:")
    print(f"    - Evaluation ID: #{eval_id}")
    print(f"    - Subject / Title: {subject} / {title}")
    print(f"    - Question: {question}")
    print(f"    - Student Score: {score}/{max_marks} ({status_str})")
    print(f"    - Semantic Overlap: {similarity * 100:.1f}%")

    # 3. Test Initial Automatic Explanation
    payload_initial = {
        "evaluation_id": eval_id,
        "student_answer": exam.get("extracted_text") or "",
        "model_answer": exam.get("model_answer") or "",
        "question": question or title or "",
        "similarity": similarity,
        "marks_obtained": score,
        "max_marks": max_marks,
        "explanation": exam.get("explanation") or "",
        "user_question": None,
    }

    r_init = requests.post(f"{BASE_URL}/api/explain-marks", json=payload_initial)
    assert r_init.status_code == 200, f"Initial explanation failed: {r_init.text}"
    init_data = r_init.json()
    source = init_data.get("source")
    is_ai = init_data.get("is_ai_generated")
    print(f"\n[3] Initial Auto-Explanation Generated (Source: '{source}', AI Generated: {is_ai}):")
    print("-" * 60)
    print(init_data.get("reply"))
    print("-" * 60)
    assert len(init_data.get("reply", "")) > 20, "Reply should be non-empty"

    # 4. Test Follow-Up Question: 'Why did I lose marks?'
    payload_q1 = {
        **payload_initial,
        "user_question": "Why did I lose marks on this question?",
        "history": [
            {"sender": "ai", "text": init_data.get("reply")},
            {"sender": "user", "text": "Why did I lose marks on this question?"}
        ]
    }
    r_q1 = requests.post(f"{BASE_URL}/api/explain-marks", json=payload_q1)
    assert r_q1.status_code == 200, f"Follow-up Q1 failed: {r_q1.text}"
    q1_data = r_q1.json()
    print(f"\n[4] Follow-up Q1 Reply (Why did I lose marks?):")
    print("-" * 60)
    print(q1_data.get("reply"))
    print("-" * 60)
    assert len(q1_data.get("reply", "")) > 20

    # 5. Test Follow-Up Question: 'How can I get full marks next time?'
    payload_q2 = {
        **payload_initial,
        "user_question": "How can I get full marks next time?",
    }
    r_q2 = requests.post(f"{BASE_URL}/api/explain-marks", json=payload_q2)
    assert r_q2.status_code == 200, f"Follow-up Q2 failed: {r_q2.text}"
    q2_data = r_q2.json()
    print(f"\n[5] Follow-up Q2 Reply (How to get full marks?):")
    print("-" * 60)
    print(q2_data.get("reply"))
    print("-" * 60)
    assert len(q2_data.get("reply", "")) > 20

    print("\n================================================================")
    print("   ALL STUDENT PORTAL AI MARKS CHATBOT TESTS PASSED 100%!       ")
    print("================================================================")

if __name__ == "__main__":
    test_student_portal_ai_chatbot()
