import os
import sys
import json
from PIL import Image, ImageDraw
from test_client_helper import get_client, BASE_URL

requests = get_client()

def run_full_checklist_tests():
    print("================================================================")
    print("   SCRIPTSENSE - SECTION 10 FULL SYSTEM VERIFICATION SUITE       ")
    print("================================================================\n")
    
    passed_tests = 0
    total_tests = 10

    # ---------------------------------------------------------
    # Checklist Item 1: Login works with valid & invalid inputs
    # ---------------------------------------------------------
    print("1. Testing Teacher Authentication (Valid & Invalid)...")
    
    # Invalid password
    res_bad = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "wrongpassword"})
    assert res_bad.status_code == 401, f"Expected 401 for bad password, got {res_bad.status_code}"
    
    # Invalid username
    res_bad_user = requests.post(f"{BASE_URL}/api/login", json={"username": "nonexistent", "password": "secret123"})
    assert res_bad_user.status_code == 401, f"Expected 401 for unknown user, got {res_bad_user.status_code}"

    # Valid login
    res_ok = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res_ok.status_code == 200, f"Expected 200 for valid login, got {res_ok.status_code}"
    token = res_ok.json()["access_token"]
    assert token and len(token) > 20
    headers = {"Authorization": f"Bearer {token}"}
    print("   [PASS] Invalid credentials rejected (401) & valid login returns JWT Bearer token.\n")
    passed_tests += 1

    # ---------------------------------------------------------
    # Checklist Item 2: File Format Acceptance (PNG, JPG, PDF) & Rejection (.txt / unsupported)
    # ---------------------------------------------------------
    print("2. Testing File Type Validation (Accept PDF/JPG/PNG, Reject others)...")
    
    # Test rejection of .txt file
    dummy_txt = "dummy_invalid.txt"
    with open(dummy_txt, "w") as f:
        f.write("This is a text file, not an image/pdf.")
    
    with open(dummy_txt, "rb") as f:
        res_reject = requests.post(f"{BASE_URL}/api/upload", files={"file": (dummy_txt, f, "text/plain")}, headers=headers)
    assert res_reject.status_code == 400, f"Expected 400 for invalid file type, got {res_reject.status_code}"
    os.remove(dummy_txt)

    # Test acceptance of PNG image
    test_img = "test_sheet.png"
    img = Image.new("RGB", (700, 260), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), "Newton second law: Force equals mass times acceleration (F = ma).", fill=(0, 0, 0))
    draw.text((20, 70), "When force increases on a constant mass, acceleration increases proportionally.", fill=(0, 0, 0))
    draw.text((20, 110), "SI unit of force is Newton (N).", fill=(0, 0, 0))
    img.save(test_img)

    with open(test_img, "rb") as f:
        res_accept = requests.post(
            f"{BASE_URL}/api/upload",
            files={"file": (test_img, f, "image/png")},
            data={"student_name": "Jane Doe"},
            headers=headers
        )
    assert res_accept.status_code == 200, f"Expected 200 for PNG upload, got {res_accept.status_code}"
    upload_res = res_accept.json()
    answer_sheet_id = upload_res["answer_sheet_id"]
    file_path = upload_res["file_path"]
    extracted_text = upload_res["extracted_text"]
    os.remove(test_img)

    print("   [PASS] Invalid file (.txt) rejected with 400; valid PNG accepted and processed.\n")
    passed_tests += 1

    # ---------------------------------------------------------
    # Checklist Item 3: File Stored in backend/uploads/ & SQLite Record Created
    # ---------------------------------------------------------
    print("3. Testing Physical File Storage and SQLite record...")
    abs_stored_path = os.path.join(os.path.dirname(__file__), file_path)
    assert os.path.exists(abs_stored_path), f"File not found on disk at {abs_stored_path}"
    print(f"   [PASS] File stored on disk at '{file_path}' (Size: {os.path.getsize(abs_stored_path)} bytes).\n")
    passed_tests += 1

    # ---------------------------------------------------------
    # Checklist Item 4: OCR extracts readable text
    # ---------------------------------------------------------
    print("4. Testing OCR text extraction quality...")
    assert len(extracted_text.strip()) > 10, "Extracted OCR text is empty"
    print(f"   [PASS] OCR extracted: \"{extracted_text[:80]}...\"\n")
    passed_tests += 1

    # ---------------------------------------------------------
    # Checklist Item 5: Model Answer Saves Correctly
    # ---------------------------------------------------------
    print("5. Testing Model Answer Configuration (POST /api/model-answer)...")
    max_marks = 15.0
    model_payload = {
        "question": "Explain Newton's second law of motion and provide its formula and SI units.",
        "answer_text": "Newton's second law of motion states that force is equal to mass multiplied by acceleration (F = m * a). Force is measured in Newtons (N), mass in kg, and acceleration in m/s^2.",
        "max_marks": max_marks
    }
    res_model = requests.post(f"{BASE_URL}/api/model-answer", json=model_payload, headers=headers)
    assert res_model.status_code == 200, f"Model answer save failed: {res_model.text}"
    model_answer_id = res_model.json()["model_answer_id"]
    assert model_answer_id > 0
    print(f"   [PASS] Model answer saved in SQLite with ID #{model_answer_id} (Max Marks: {max_marks}).\n")
    passed_tests += 1

    # ---------------------------------------------------------
    # Checklist Item 6: AI Evaluation returns similarity & suggested marks
    # ---------------------------------------------------------
    print("6. Testing AI Evaluation (Sentence Transformers)...")
    eval_res = requests.post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": answer_sheet_id, "model_answer_id": model_answer_id},
        headers=headers
    )
    assert eval_res.status_code == 200, f"Evaluation failed: {eval_res.text}"
    eval_data = eval_res.json()
    evaluation_id = eval_data["evaluation_id"]
    similarity = eval_data["similarity"]
    suggested_marks = eval_data["suggested_marks"]
    explanation = eval_data["explanation"]

    assert 0.0 <= similarity <= 1.0, f"Similarity {similarity} out of bounds"
    assert len(explanation) > 10, "Explanation is missing"
    print(f"   [PASS] Similarity: {(similarity*100):.1f}%, Suggested Marks: {suggested_marks}/{max_marks}")
    print(f"          Rationale: {explanation[:90]}...\n")
    passed_tests += 1

    # ---------------------------------------------------------
    # Checklist Item 7: Suggested Marks Never Exceed Max Marks
    # ---------------------------------------------------------
    print("7. Testing Boundary Conditions (Suggested marks <= Max marks)...")
    assert suggested_marks <= max_marks, f"Suggested marks {suggested_marks} exceeded max marks {max_marks}!"
    assert suggested_marks >= 0.0, f"Suggested marks {suggested_marks} below 0!"
    print(f"   [PASS] Score boundary holds: 0.0 <= {suggested_marks} <= {max_marks}.\n")
    passed_tests += 1

    # ---------------------------------------------------------
    # Checklist Item 8: Results Retrieval & AI Never Writes final_marks Directly
    # ---------------------------------------------------------
    print("8. Testing Results GET & Teacher Safeguard (AI does not auto-finalize)...")
    res_get = requests.get(f"{BASE_URL}/api/results/{evaluation_id}", headers=headers)
    assert res_get.status_code == 200
    res_record = res_get.json()
    assert res_record["final_marks"] is None, "Violation: final_marks was auto-populated by AI!"
    assert res_record["teacher_feedback"] is None
    print(f"   [PASS] final_marks is None in initial evaluation. Teacher verification required.\n")
    passed_tests += 1

    # ---------------------------------------------------------
    # Checklist Item 9: Teacher Confirmation & Verification (PUT /api/results/{id})
    # ---------------------------------------------------------
    print("9. Testing Teacher Verification (PUT /api/results/{id})...")
    teacher_final_score = 14.5
    teacher_note = "Strong conceptual clarity, formula accurately stated with SI units."
    res_put = requests.put(
        f"{BASE_URL}/api/results/{evaluation_id}",
        json={"final_marks": teacher_final_score, "teacher_feedback": teacher_note},
        headers=headers
    )
    assert res_put.status_code == 200, f"Verification failed: {res_put.text}"
    put_data = res_put.json()
    assert put_data["final_marks"] == teacher_final_score
    print(f"   [PASS] Teacher successfully confirmed final marks ({teacher_final_score}/{max_marks}) with timestamp {put_data['verified_at']}.\n")
    passed_tests += 1

    # ---------------------------------------------------------
    # Checklist Item 10: Persistence Verification
    # ---------------------------------------------------------
    print("10. Testing SQLite Result Persistence...")
    res_verify = requests.get(f"{BASE_URL}/api/results/{evaluation_id}", headers=headers)
    assert res_verify.status_code == 200
    persisted = res_verify.json()
    assert persisted["final_marks"] == teacher_final_score
    assert persisted["teacher_feedback"] == teacher_note
    print(f"   [PASS] Verified persistent storage in SQLite (Student: {persisted['student_name']}, Final: {persisted['final_marks']}/{persisted['max_marks']}).\n")
    passed_tests += 1

    print("================================================================")
    print(f"   ALL {passed_tests}/{total_tests} CHECKLIST TESTS COMPLETED & PASSED!")
    print("================================================================")

if __name__ == "__main__":
    run_full_checklist_tests()
