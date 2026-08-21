import os
import io
import time
import requests
from PIL import Image, ImageDraw

BASE_URL = "http://127.0.0.1:8000"

def get_test_client():
    try:
        r = requests.get(f"{BASE_URL}/", timeout=1.0)
        if r.status_code == 200:
            return None  # Use live server
    except Exception:
        pass
    from fastapi.testclient import TestClient
    from main import app
    return TestClient(app)

def run_complete_role_and_ownership_tests():
    print("=" * 70)
    print("     SCRIPTSENSE ROLE-BASED LOGIN & DATA OWNERSHIP TEST SUITE    ")
    print("=" * 70)

    client = get_test_client()
    if client is not None:
        print("[INFO] Using in-process FastAPI TestClient.")
        c = client
        api_post = lambda url, **kwargs: c.post(url.replace(BASE_URL, ""), **kwargs)
        api_get = lambda url, **kwargs: c.get(url.replace(BASE_URL, ""), **kwargs)
        api_put = lambda url, **kwargs: c.put(url.replace(BASE_URL, ""), **kwargs)
        api_delete = lambda url, **kwargs: c.delete(url.replace(BASE_URL, ""), **kwargs)
    else:
        print("[INFO] Connected to live server at http://127.0.0.1:8000.")
        api_post = requests.post
        api_get = requests.get
        api_put = requests.put
        api_delete = requests.delete

    # Helper image creation
    def make_test_image(text="Newton second law: F = m * a"):
        img = Image.new("RGB", (450, 150), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text((20, 40), text, fill=(0, 0, 0))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        return img_bytes.getvalue()

    # -------------------------------------------------------------
    # TEST 1: Login as Teacher A -> Create Rahul (101) -> Upload & Eval
    # -------------------------------------------------------------
    print("\n" + "="*50)
    print("[TEST 1] Teacher A Workflow & Ownership Verification")
    print("="*50)

    # 1. Login as Teacher A
    res_login_a = api_post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123", "role": "teacher"})
    assert res_login_a.status_code == 200, f"Teacher A login failed: {res_login_a.text}"
    data_a = res_login_a.json()
    token_a = data_a["access_token"]
    teacher_a_id = data_a["user_id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print(f" -> Teacher A logged in: ID={teacher_a_id}, Name='{data_a['name']}', Role='{data_a['role']}'")
    assert data_a["role"] == "teacher"
    assert data_a["status"] == "success"

    # 2. Create Student Rahul (Roll No: 101)
    unique_roll_suffix = str(int(time.time()))[-4:]
    roll_101 = f"ROLL-101-{unique_roll_suffix}"
    res_create_stu_a = api_post(
        f"{BASE_URL}/api/students",
        json={"name": "Rahul", "roll_number": roll_101},
        headers=headers_a
    )
    assert res_create_stu_a.status_code == 201, f"Teacher A creating student failed: {res_create_stu_a.text}"
    stu_a_data = res_create_stu_a.json()
    stu_a_id = stu_a_data["id"]
    print(f" -> Teacher A created student: ID={stu_a_id}, Name='{stu_a_data['name']}', Roll='{stu_a_data['roll_number']}'")
    assert stu_a_data["teacher_id"] == teacher_a_id

    # 3. Create Model Answer
    res_model_a = api_post(
        f"{BASE_URL}/api/model-answer",
        json={
            "question": "Explain Newton's second law of motion.",
            "answer_text": "Newton's second law states that force is directly proportional to acceleration, F = m * a.",
            "max_marks": 10.0
        },
        headers=headers_a
    )
    assert res_model_a.status_code == 200, f"Model answer creation failed: {res_model_a.text}"
    model_a_id = res_model_a.json()["model_answer_id"]
    print(f" -> Model answer created: ID={model_a_id}")

    # 4. Teacher A uploads an answer sheet for Rahul
    img_bytes = make_test_image("Newton second law states that force equals mass times acceleration: F = m * a.")
    files = {"file": ("rahul_answer_teacher_a.png", img_bytes, "image/png")}
    data = {"student_id": str(stu_a_id)}
    res_upload_a = api_post(
        f"{BASE_URL}/api/upload",
        files=files,
        data=data,
        headers=headers_a
    )
    assert res_upload_a.status_code == 200, f"Upload failed: {res_upload_a.text}"
    upload_a_data = res_upload_a.json()
    sheet_a_id = upload_a_data["answer_sheet_id"]
    print(f" -> Teacher A uploaded answer sheet: ID={sheet_a_id}, Extracted Text: '{upload_a_data['extracted_text'][:45]}...'")
    assert upload_a_data["extracted_text"] != ""
    assert upload_a_data["student_id"] == stu_a_id

    # 5. Teacher A evaluates answer sheet
    res_eval_a = api_post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_a_id, "model_answer_id": model_a_id},
        headers=headers_a
    )
    assert res_eval_a.status_code == 200, f"Evaluation failed: {res_eval_a.text}"
    eval_a_data = res_eval_a.json()
    eval_a_id = eval_a_data["evaluation_id"]
    print(f" -> Evaluation created: ID={eval_a_id}, Similarity={eval_a_data['similarity']}, Suggested Marks={eval_a_data['suggested_marks']}")
    assert eval_a_data["suggested_marks"] > 0

    # 6. Teacher A saves verified final result
    res_verify_a = api_put(
        f"{BASE_URL}/api/results/{eval_a_id}",
        json={"final_marks": 9.5, "teacher_feedback": "Excellent conceptual clarity."},
        headers=headers_a
    )
    assert res_verify_a.status_code == 200, f"Verification failed: {res_verify_a.text}"
    print(f" -> Result verified by Teacher A: Final Marks=9.5")

    print("[PASS] TEST 1: All records created and permanently owned by Teacher A.")

    # -------------------------------------------------------------
    # TEST 2: Login as Teacher B -> Check Isolation -> Create Rahul (101) -> Upload
    # -------------------------------------------------------------
    print("\n" + "="*50)
    print("[TEST 2] Teacher B Isolation & Scoped Student Uniqueness")
    print("="*50)

    # 1. Login as Teacher B
    res_login_b = api_post(f"{BASE_URL}/api/login", json={"username": "teacher2", "password": "secret123", "role": "teacher"})
    assert res_login_b.status_code == 200, f"Teacher B login failed: {res_login_b.text}"
    data_b = res_login_b.json()
    token_b = data_b["access_token"]
    teacher_b_id = data_b["user_id"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    print(f" -> Teacher B logged in: ID={teacher_b_id}, Name='{data_b['name']}'")

    # 2. Confirm Rahul from Teacher A is NOT visible in Teacher B's student list
    res_stu_list_b = api_get(f"{BASE_URL}/api/students", headers=headers_b)
    assert res_stu_list_b.status_code == 200
    stu_list_b = res_stu_list_b.json()
    stu_b_ids = [s["id"] for s in stu_list_b]
    assert stu_a_id not in stu_b_ids, "Teacher B must NOT see Teacher A's student!"
    print(f" -> Verified Teacher A's student #{stu_a_id} is completely hidden from Teacher B.")

    # 3. Teacher B creates student Rahul with the exact same Roll No (101)
    res_create_stu_b = api_post(
        f"{BASE_URL}/api/students",
        json={"name": "Rahul", "roll_number": roll_101},
        headers=headers_b
    )
    assert res_create_stu_b.status_code == 201, f"Teacher B creating identical roll number failed: {res_create_stu_b.text}"
    stu_b_data = res_create_stu_b.json()
    stu_b_id = stu_b_data["id"]
    print(f" -> Teacher B successfully created own student: ID={stu_b_id}, Name='{stu_b_data['name']}', Roll='{stu_b_data['roll_number']}'")
    assert stu_b_id != stu_a_id
    assert stu_b_data["teacher_id"] == teacher_b_id

    # 4. Teacher B uploads an answer sheet for Teacher B's Rahul
    img_bytes_b = make_test_image("Teacher B Student Answer: Momentum equals mass times velocity.")
    files_b = {"file": ("rahul_answer_teacher_b.png", img_bytes_b, "image/png")}
    res_upload_b = api_post(
        f"{BASE_URL}/api/upload",
        files=files_b,
        data={"student_id": str(stu_b_id)},
        headers=headers_b
    )
    assert res_upload_b.status_code == 200
    sheet_b_id = res_upload_b.json()["answer_sheet_id"]
    print(f" -> Teacher B uploaded answer sheet: ID={sheet_b_id}")

    # 5. Confirm Teacher B only sees Teacher B's answer sheets
    res_sheets_b = api_get(f"{BASE_URL}/api/answer-sheets", headers=headers_b)
    assert res_sheets_b.status_code == 200
    sheets_b = res_sheets_b.json()
    sheet_b_ids = [s["id"] for s in sheets_b]
    assert sheet_b_id in sheet_b_ids
    assert sheet_a_id not in sheet_b_ids, "Teacher B must NOT see Teacher A's answer sheet!"
    print(" -> Verified Teacher B only sees their own answer sheets.")

    print("[PASS] TEST 2: Scoped uniqueness and data separation confirmed.")

    # -------------------------------------------------------------
    # TEST 3: Cross-Teacher Security Checks (Must return 403)
    # -------------------------------------------------------------
    print("\n" + "="*50)
    print("[TEST 3] Cross-Teacher 403 Forbidden Enforcement")
    print("="*50)

    # 1. Teacher B tries to GET Teacher A's student details
    res_forbidden_1 = api_get(f"{BASE_URL}/api/students/{stu_a_id}", headers=headers_b)
    assert res_forbidden_1.status_code == 403, f"Expected 403, got {res_forbidden_1.status_code}"
    print(" -> Teacher B GET /api/students/{stu_a_id} -> 403 Forbidden [PASS]")

    # 2. Teacher B tries to edit Teacher A's transcript
    res_forbidden_2 = api_put(
        f"{BASE_URL}/api/uploads/{sheet_a_id}/transcript",
        json={"extracted_text": "Malicious transcript overwrite"},
        headers=headers_b
    )
    assert res_forbidden_2.status_code == 403, f"Expected 403, got {res_forbidden_2.status_code}"
    print(" -> Teacher B PUT /api/uploads/{sheet_a_id}/transcript -> 403 Forbidden [PASS]")

    # 3. Teacher B tries to evaluate Teacher A's answer sheet
    res_forbidden_3 = api_post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_a_id, "model_answer_id": model_a_id},
        headers=headers_b
    )
    assert res_forbidden_3.status_code == 403, f"Expected 403, got {res_forbidden_3.status_code}"
    print(" -> Teacher B POST /api/evaluate on Teacher A's sheet -> 403 Forbidden [PASS]")

    # 4. Teacher B tries to view Teacher A's evaluation result
    res_forbidden_4 = api_get(f"{BASE_URL}/api/results/{eval_a_id}", headers=headers_b)
    assert res_forbidden_4.status_code == 403, f"Expected 403, got {res_forbidden_4.status_code}"
    print(" -> Teacher B GET /api/results/{eval_a_id} -> 403 Forbidden [PASS]")

    # 5. Teacher B tries to modify Teacher A's verified final marks
    res_forbidden_5 = api_put(
        f"{BASE_URL}/api/results/{eval_a_id}",
        json={"final_marks": 0.0, "teacher_feedback": "Hacked marks"},
        headers=headers_b
    )
    assert res_forbidden_5.status_code == 403, f"Expected 403, got {res_forbidden_5.status_code}"
    print(" -> Teacher B PUT /api/results/{eval_a_id} -> 403 Forbidden [PASS]")

    print("[PASS] TEST 3: All unauthorized cross-teacher operations rejected with 403.")

    # -------------------------------------------------------------
    # TEST 4: Login as Admin -> View All Teachers, Students, Sheets, Evals, Results
    # -------------------------------------------------------------
    print("\n" + "="*50)
    print("[TEST 4] Admin Full Visibility & Global Analytics")
    print("="*50)

    # 1. Login as Admin
    res_login_admin = api_post(f"{BASE_URL}/api/login", json={"username": "admin", "password": "admin123", "role": "admin"})
    assert res_login_admin.status_code == 200, f"Admin login failed: {res_login_admin.text}"
    admin_data = res_login_admin.json()
    token_admin = admin_data["access_token"]
    headers_admin = {"Authorization": f"Bearer {token_admin}"}
    print(f" -> Admin logged in: ID={admin_data['user_id']}, Role='{admin_data['role']}', Name='{admin_data['name']}'")
    assert admin_data["role"] == "admin"

    # 2. View all teachers
    res_admin_teachers = api_get(f"{BASE_URL}/api/admin/teachers", headers=headers_admin)
    assert res_admin_teachers.status_code == 200
    admin_teachers = res_admin_teachers.json()
    teacher_usernames = [t["username"] for t in admin_teachers]
    print(f" -> Admin sees teachers: {', '.join(teacher_usernames)}")
    assert "teacher1" in teacher_usernames
    assert "teacher2" in teacher_usernames

    # 3. View all students (Both Teacher A's and Teacher B's Rahul)
    res_admin_students = api_get(f"{BASE_URL}/api/admin/students", headers=headers_admin)
    assert res_admin_students.status_code == 200
    admin_students = res_admin_students.json()
    student_ids = [s["id"] for s in admin_students]
    print(f" -> Admin sees {len(admin_students)} total students.")
    assert stu_a_id in student_ids, "Admin must see Teacher A's student"
    assert stu_b_id in student_ids, "Admin must see Teacher B's student"

    # 4. View all answer sheets
    res_admin_sheets = api_get(f"{BASE_URL}/api/admin/answer-sheets", headers=headers_admin)
    assert res_admin_sheets.status_code == 200
    admin_sheets = res_admin_sheets.json()
    sheet_ids = [s["id"] for s in admin_sheets]
    print(f" -> Admin sees {len(admin_sheets)} total answer sheets.")
    assert sheet_a_id in sheet_ids, "Admin must see Teacher A's sheet"
    assert sheet_b_id in sheet_ids, "Admin must see Teacher B's sheet"

    # 5. View all evaluations
    res_admin_evals = api_get(f"{BASE_URL}/api/admin/evaluations", headers=headers_admin)
    assert res_admin_evals.status_code == 200
    admin_evals = res_admin_evals.json()
    eval_ids = [e["id"] for e in admin_evals]
    print(f" -> Admin sees {len(admin_evals)} total evaluations.")
    assert eval_a_id in eval_ids, "Admin must see Teacher A's evaluation"

    # 6. View all final results
    res_admin_results = api_get(f"{BASE_URL}/api/admin/results", headers=headers_admin)
    assert res_admin_results.status_code == 200
    admin_results = res_admin_results.json()
    print(f" -> Admin sees {len(admin_results)} total results.")

    print("[PASS] TEST 4: Admin global visibility verified across all system entities.")

    # -------------------------------------------------------------
    # TEST 5: Duplicate Validation on Teacher Creation
    # -------------------------------------------------------------
    print("\n" + "="*50)
    print("[TEST 5] Duplicate Username / Email Validation")
    print("="*50)

    # 1. Try creating a teacher with an existing username ('teacher1')
    res_dup_username = api_post(
        f"{BASE_URL}/api/admin/teachers",
        json={
            "name": "Imposter Teacher",
            "username": "teacher1",
            "email": "unique_email_123@scriptsense.com",
            "password": "password123",
            "role": "teacher"
        },
        headers=headers_admin
    )
    assert res_dup_username.status_code == 400, f"Expected 400, got {res_dup_username.status_code}"
    dup_user_detail = res_dup_username.json().get("detail", "")
    print(f" -> Duplicate username rejected with 400: '{dup_user_detail}'")
    assert "Username or email already exists." in dup_user_detail

    # 2. Try creating a teacher with an existing email ('teacher1@scriptsense.com')
    res_dup_email = api_post(
        f"{BASE_URL}/api/admin/teachers",
        json={
            "name": "Imposter Teacher 2",
            "username": f"unique_user_{int(time.time())}",
            "email": "teacher1@scriptsense.com",
            "password": "password123",
            "role": "teacher"
        },
        headers=headers_admin
    )
    assert res_dup_email.status_code == 400, f"Expected 400, got {res_dup_email.status_code}"
    dup_email_detail = res_dup_email.json().get("detail", "")
    print(f" -> Duplicate email rejected with 400: '{dup_email_detail}'")
    assert "Username or email already exists." in dup_email_detail

    # 3. Try creating a completely unique teacher -> should succeed
    unique_name = f"Prof. Unique {unique_roll_suffix}"
    unique_u = f"prof_{unique_roll_suffix}"
    unique_e = f"prof_{unique_roll_suffix}@scriptsense.com"
    res_valid_teacher = api_post(
        f"{BASE_URL}/api/admin/teachers",
        json={
            "name": unique_name,
            "username": unique_u,
            "email": unique_e,
            "password": "securepassword123",
            "role": "teacher"
        },
        headers=headers_admin
    )
    assert res_valid_teacher.status_code == 201, f"Valid teacher creation failed: {res_valid_teacher.text}"
    new_t_data = res_valid_teacher.json()
    new_t_id = new_t_data["id"]
    print(f" -> Unique teacher created successfully: ID={new_t_id}, Username='{new_t_data['username']}', Email='{new_t_data['email']}'")

    # Clean up created unique teacher
    api_delete(f"{BASE_URL}/api/admin/teachers/{new_t_id}", headers=headers_admin)
    print(" -> Cleaned up test teacher account.")

    # Clean up students created during test
    api_delete(f"{BASE_URL}/api/students/{stu_a_id}", headers=headers_a)
    api_delete(f"{BASE_URL}/api/students/{stu_b_id}", headers=headers_b)
    print(" -> Cleaned up test students.")

    print("[PASS] TEST 5: Duplicate validation enforced and verified 100%.")

    print("\n" + "=" * 70)
    print("      ALL 5 ROLE & DATA OWNERSHIP TESTS PASSED WITH 100% SUCCESS!   ")
    print("=" * 70)

if __name__ == "__main__":
    run_complete_role_and_ownership_tests()
