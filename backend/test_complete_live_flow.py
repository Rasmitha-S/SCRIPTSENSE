import os
import sys
import uuid
import json
from test_client_helper import get_client, BASE_URL

requests = get_client()

def run_full_e2e_verification():
    print("=" * 70)
    print("      SCRIPTSENSE COMPLETE LIVE END-TO-END VERIFICATION      ")
    print("=" * 70)

    # 1. Health check
    res_root = requests.get(f"{BASE_URL}/")
    assert res_root.status_code == 200, f"Root check failed: {res_root.text}"
    print(f"[STEP 1: OK] Backend Server Online: {res_root.json()}")

    # 2. Teacher Login
    login_payload = {"username": "teacher1", "password": "secret123"}
    res_login = requests.post(f"{BASE_URL}/api/login", json=login_payload)
    assert res_login.status_code == 200, f"Login failed: {res_login.text}"
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"[STEP 2: OK] Logged in as teacher1. Token acquired.")

    # 3. Add a new Student
    unique_suffix = uuid.uuid4().hex[:6].upper()
    student_payload = {
        "name": f"Marcus Vance {unique_suffix}",
        "roll_number": f"CS-MV-{unique_suffix}"
    }
    res_student = requests.post(f"{BASE_URL}/api/students", json=student_payload, headers=headers)
    assert res_student.status_code in [200, 201], f"Student creation failed: {res_student.text}"
    student_data = res_student.json()
    student_id = student_data["id"]
    print(f"[STEP 3: OK] Created Student #{student_id}: {student_data['name']} (Roll: {student_data['roll_number']})")

    # 4. Upload real handwritten answer sheet image
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sample_img_path = os.path.join(base_dir, "uploads", "31_alex_rivera_physics_answer.png")
    if not os.path.exists(sample_img_path):
        sample_img_path = os.path.join(base_dir, "uploads", "100_31_alex_rivera_physics_answer.png")

    assert os.path.exists(sample_img_path), f"Sample image not found: {sample_img_path}"

    with open(sample_img_path, "rb") as f:
        files = {"file": (f"{student_id}_marcus_physics_answer.png", f, "image/png")}
        data = {
            "student_id": str(student_id),
            "student_name": student_data["name"]
        }
        res_upload = requests.post(f"{BASE_URL}/api/upload", files=files, data=data, headers=headers)

    assert res_upload.status_code in [200, 201], f"Upload failed: {res_upload.text}"
    upload_data = res_upload.json()
    answer_sheet_id = upload_data["answer_sheet_id"]
    extracted_text = upload_data["extracted_text"]
    assert extracted_text and extracted_text != "No text could be extracted from the document.", f"OCR extraction failed: {extracted_text}"
    print(f"[STEP 4: OK] Uploaded Answer Sheet #{answer_sheet_id}. OCR Extracted Text:\n---")
    print(extracted_text)
    print("---")

    # 5. Create Model Answer
    model_payload = {
        "title": f"Physics Midterm Exam ({unique_suffix})",
        "subject": "Physics",
        "question": f"State Newton's Second Law of Motion with formula and unit of force.",
        "answer_text": "Newton's second law states that the rate of change of momentum is directly proportional to applied force. Formula: Force = mass x acceleration (F = m * a). Force is measured in Newtons (N).",
        "max_marks": 10.0,
    }
    res_model = requests.post(f"{BASE_URL}/api/model-answer", json=model_payload, headers=headers)
    assert res_model.status_code in [200, 201], f"Model answer creation failed: {res_model.text}"
    model_data = res_model.json()
    model_id = model_data["model_answer_id"]
    print(f"[STEP 5: OK] Created Model Answer #{model_id}: '{model_data['title']}' (Max Marks: {model_data['max_marks']})")

    # 6. Run Evaluation
    eval_payload = {
        "answer_sheet_id": answer_sheet_id,
        "model_answer_id": model_id
    }
    res_eval = requests.post(f"{BASE_URL}/api/evaluate", json=eval_payload, headers=headers)
    assert res_eval.status_code in [200, 201], f"Evaluation failed: {res_eval.text}"
    eval_data = res_eval.json()
    evaluation_id = eval_data["evaluation_id"]
    print(f"[STEP 6: OK] Evaluation Completed #{evaluation_id}:")
    print(f"    - Similarity Score: {eval_data.get('similarity')}")
    print(f"    - Suggested Marks: {eval_data.get('suggested_marks')} / {eval_data.get('max_marks')}")
    print(f"    - Explanation: {eval_data.get('explanation')}")

    # 7. Fetch Results Page Data
    res_result = requests.get(f"{BASE_URL}/api/results/{evaluation_id}", headers=headers)
    assert res_result.status_code == 200, f"Get result failed: {res_result.text}"
    result_data = res_result.json()
    assert result_data["student_id"] == student_id, "Student ID mismatch in results"
    assert result_data["student_name"] == student_data["name"], "Student Name mismatch in results"
    assert result_data["roll_number"] == student_data["roll_number"], "Roll number mismatch in results"
    print(f"[STEP 7: OK] Result verified for Student: {result_data['student_name']} ({result_data['roll_number']})")
    print(f"    - Suggested Marks: {result_data['suggested_marks']}")
    print(f"    - AI Similarity: {result_data['similarity']}")
    print(f"    - Extracted Text in Result: {result_data['extracted_text'][:60]}...")

    # 8. Submit Teacher Verification
    verify_payload = {
        "final_marks": 9.5,
        "teacher_feedback": "Accurate derivation and statement of Newton's law with correct SI unit."
    }
    res_verify = requests.put(f"{BASE_URL}/api/results/{evaluation_id}/verify", json=verify_payload, headers=headers)
    assert res_verify.status_code == 200, f"Verification failed: {res_verify.text}"
    verified_data = res_verify.json()
    assert verified_data["final_marks"] == 9.5, f"Expected 9.5 marks, got {verified_data['final_marks']}"
    assert verified_data["verified_by"] is not None, "Expected verifier name"
    print(f"[STEP 8: OK] Teacher verification submitted successfully:")
    print(f"    - Final Marks: {verified_data['final_marks']}")
    print(f"    - Verified By: {verified_data['verified_by']}")
    print(f"    - Verified At: {verified_data['verified_at']}")

    # 9. Check Students Overview / Dashboard
    res_overview = requests.get(f"{BASE_URL}/api/students/overview", headers=headers)
    assert res_overview.status_code == 200, f"Students overview failed: {res_overview.text}"
    students_overview = res_overview.json()
    
    target_student_entry = None
    for s in students_overview:
        if s["id"] == student_id:
            target_student_entry = s
            break

    assert target_student_entry is not None, f"Student #{student_id} not found in overview list"
    assert target_student_entry["status"] == "Verified", f"Expected overview status 'Verified', got {target_student_entry['status']}"
    assert target_student_entry["final_marks"] == 9.5, f"Expected overview final_marks 9.5, got {target_student_entry['final_marks']}"
    assert target_student_entry["latest_evaluation_id"] == evaluation_id, f"Expected eval ID {evaluation_id}, got {target_student_entry['latest_evaluation_id']}"
    print(f"[STEP 9: OK] Students Dashboard verified for Student #{student_id}:")
    print(f"    - Name: {target_student_entry['name']}")
    print(f"    - Roll: {target_student_entry['roll_number']}")
    print(f"    - Overview Status: {target_student_entry['status']}")
    print(f"    - Final Marks on Dashboard: {target_student_entry['final_marks']}")

    print("=" * 70)
    print("      ALL END-TO-END STEPS PASSED PERFECTLY (100% SUCCESS)      ")
    print("=" * 70)

if __name__ == "__main__":
    run_full_e2e_verification()
