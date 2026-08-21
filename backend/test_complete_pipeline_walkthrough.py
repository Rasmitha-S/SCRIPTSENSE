import json
import os
import time
import sys
from test_client_helper import get_client, BASE_URL

requests = get_client()

def run_complete_e2e_pipeline():
    print("=" * 70)
    print("      SCRIPTSENSE: COMPLETE END-TO-END WORKFLOW VERIFICATION")
    print("=" * 70)

    # Authentication
    res_login = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res_login.status_code == 200, f"Login failed: {res_login.text}"
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[0] Teacher authenticated successfully (token acquired).")

    # Step 1: Upload a real answer sheet image for a student
    print("\n" + "-" * 70)
    print("[STEP 1] Uploading real student answer sheet image (POST /api/upload)...")
    print("-" * 70)
    
    student_name = f"Jordan Hayes"
    roll_number = f"CS2026-JH{int(time.time()) % 10000:04d}"
    
    # Use real sample image from uploads
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sample_img_path = os.path.join(base_dir, "uploads", "7_test_sheet.png")
    if not os.path.exists(sample_img_path):
        sample_img_path = os.path.join(base_dir, "uploads", "31_alex_rivera_physics_answer.png")

    with open(sample_img_path, "rb") as f:
        res_upload = requests.post(
            f"{BASE_URL}/api/upload",
            files={"file": (os.path.basename(sample_img_path), f, "image/png")},
            data={"student_name": student_name, "roll_number": roll_number},
            headers=headers
        )

    assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
    upload_data = res_upload.json()
    sheet_id = upload_data["answer_sheet_id"]
    student_id = upload_data["student_id"]
    extracted_text = upload_data["extracted_text"]

    print(f"  [PASS] Answer Sheet ID:      #{sheet_id}")
    print(f"  [PASS] Linked Student:       {upload_data['student_name']} (ID #{student_id}, Roll: {upload_data['roll_number']})")
    print(f"  [PASS] Stored File Path:     {upload_data['file_path']}")
    print(f"  [PASS] OCR Extracted Text:\n      \"\"\"\n{extracted_text}\n      \"\"\"")

    # Step 2: Save a model answer
    print("\n" + "-" * 70)
    print("[STEP 2] Saving teacher's Model Answer (POST /api/model-answer)...")
    print("-" * 70)

    question_text = "State Newton's second law of motion and its mathematical formula."
    model_answer_text = (
        "Newton's second law of motion states that the rate of change of momentum of an object "
        "is directly proportional to the applied force and takes place in the direction of the force. "
        "Formula: Force = mass x acceleration (F = m * a). Force is measured in Newtons (N)."
    )
    max_marks = 10.0

    res_model = requests.post(
        f"{BASE_URL}/api/model-answer",
        data={
            "question": question_text,
            "answer_text": model_answer_text,
            "max_marks": str(max_marks),
            "subject": "Physics"
        },
        headers=headers
    )
    assert res_model.status_code == 200, f"Model answer creation failed: {res_model.text}"
    model_data = res_model.json()
    model_id = model_data["model_answer_id"]

    print(f"  [PASS] Model Answer ID:      #{model_id}")
    print(f"  [PASS] Title:                \"{model_data.get('title')}\"")
    print(f"  [PASS] Subject:              \"{model_data.get('subject')}\"")
    print(f"  [PASS] Max Marks:            {model_data.get('max_marks')}")
    print(f"  [PASS] Questions Count:      {model_data.get('questions_count', 1)}")

    # Step 3: Run evaluation
    print("\n" + "-" * 70)
    print("[STEP 3] Running AI Semantic Evaluation (POST /api/evaluate)...")
    print("-" * 70)

    res_eval = requests.post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_id, "model_answer_id": model_id},
        headers=headers
    )
    assert res_eval.status_code == 200, f"Evaluation failed: {res_eval.text}"
    eval_data = res_eval.json()
    eval_id = eval_data["evaluation_id"]

    print(f"  [PASS] Evaluation ID:        #{eval_id}")
    print(f"  [PASS] Similarity Score:     {eval_data['similarity'] * 100:.1f}%")
    print(f"  [PASS] AI Suggested Marks:   {eval_data['suggested_marks']} / {eval_data['max_marks']}")
    print(f"  [PASS] AI Explanation:       {eval_data['explanation']}")

    # Step 4: Fetch the results page
    print("\n" + "-" * 70)
    print(f"[STEP 4] Fetching Full Results Detail Page (GET /api/results/{eval_id})...")
    print("-" * 70)

    res_result = requests.get(f"{BASE_URL}/api/results/{eval_id}", headers=headers)
    assert res_result.status_code == 200, f"Fetch result failed: {res_result.text}"
    result_data = res_result.json()

    print(f"  [PASS] Evaluation ID:        #{result_data['evaluation_id']}")
    print(f"  [PASS] Student Info:         {result_data['student_name']} (Roll: {result_data['roll_number']}, Student ID: {result_data['student_id']})")
    print(f"  [PASS] Model Question:       \"{result_data['question']}\"")
    print(f"  [PASS] Model Reference Text: \"{result_data.get('model_answer','')[:60]}...\"")
    print(f"  [PASS] Student OCR Text:     \"{result_data.get('extracted_text','')[:60]}...\"")
    print(f"  [PASS] Similarity & Marks:   {result_data['similarity'] * 100:.1f}% -> Suggested: {result_data['suggested_marks']}/{result_data['max_marks']}")

    # Step 5: Submit teacher verification
    print("\n" + "-" * 70)
    print(f"[STEP 5] Teacher Submitting Final Verification (PUT /api/results/{eval_id})...")
    print("-" * 70)

    final_marks = 8.5
    feedback = "Good conceptual grasp of Newton's second law and formula (F = m * a). Validated despite OCR variance."
    
    res_verify = requests.put(
        f"{BASE_URL}/api/results/{eval_id}",
        json={"final_marks": final_marks, "teacher_feedback": feedback},
        headers=headers
    )
    assert res_verify.status_code == 200, f"Verification failed: {res_verify.text}"
    verify_data = res_verify.json()

    print(f"  [PASS] Final Marks Awarded:  {verify_data['final_marks']}")
    print(f"  [PASS] Verified By:          {verify_data['verified_by']}")
    print(f"  [PASS] Verified At:          {verify_data['verified_at']}")

    # Step 6: Confirm student overview & dashboard reflection
    print("\n" + "-" * 70)
    print("[STEP 6] Verifying Dashboard & Student Overview (GET /api/students/overview)...")
    print("-" * 70)

    res_overview = requests.get(f"{BASE_URL}/api/students/overview", headers=headers)
    assert res_overview.status_code == 200, f"Overview failed: {res_overview.text}"
    overview_list = res_overview.json()

    student_overview = next((s for s in overview_list if s["id"] == student_id), None)
    assert student_overview is not None, f"Student ID #{student_id} not found in overview list!"

    print(f"  [PASS] Student in Overview:  {student_overview['name']} (Roll: {student_overview['roll_number']})")
    print(f"  [PASS] Total Submissions:    {student_overview['upload_count']}")
    print(f"  [PASS] Latest Evaluation ID: #{student_overview['latest_evaluation_id']}")
    print(f"  [PASS] Average Score:        {student_overview['final_marks']} / {student_overview['max_marks']}")
    print(f"  [PASS] Final Status in DB:   {student_overview['status']}")
    assert student_overview['status'] == "Verified", f"Dashboard status expected 'Verified', got '{student_overview['status']}'"

    # Also check /api/results listing
    res_all_results = requests.get(f"{BASE_URL}/api/results", headers=headers)
    all_results = res_all_results.json()
    matched_res = next((r for r in all_results if r["evaluation_id"] == eval_id), None)
    assert matched_res is not None, f"Evaluation ID #{eval_id} not found in /api/results list!"
    print(f"  [PASS] Confirmed in Results Roster: Eval #{matched_res['evaluation_id']} has final mark {matched_res['final_marks']}/{matched_res['max_marks']} verified by {matched_res['verified_by']}.")

    print("\n" + "=" * 70)
    print("   COMPLETE PIPELINE TEST: ALL 6 STEPS PASSED 100% SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_complete_e2e_pipeline()
