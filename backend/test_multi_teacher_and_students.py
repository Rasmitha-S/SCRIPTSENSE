import requests
import uuid
from PIL import Image, ImageDraw
import os

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

def test_multi_teacher_and_student_portal():
    print("================================================================")
    print("   TESTING MULTI-TEACHER WORKSPACE & STUDENT PORTAL ACCESS     ")
    print("================================================================\n")

    client = get_test_client()
    if client is not None:
        print("[INFO] Live server not found on port 8000. Using in-process FastAPI TestClient.")
        c = client
        api_post = lambda url, **kwargs: c.post(url.replace(BASE_URL, ""), **kwargs)
        api_get = lambda url, **kwargs: c.get(url.replace(BASE_URL, ""), **kwargs)
        api_put = lambda url, **kwargs: c.put(url.replace(BASE_URL, ""), **kwargs)
    else:
        print("[INFO] Connected to live server at http://127.0.0.1:8000.")
        api_post = requests.post
        api_get = requests.get
        api_put = requests.put

    # 1. Test Multiple Pre-seeded Teacher Logins
    print("[1] Testing Pre-seeded Teacher Logins (teacher1 & teacher2)...")
    res1 = api_post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res1.status_code == 200, f"Teacher 1 login failed: {res1.text}"
    token_t1 = res1.json()["access_token"]
    name_t1 = res1.json()["full_name"]
    print(f"    - Teacher 1 Logged in: {res1.json()['username']} ({name_t1})")

    res2 = api_post(f"{BASE_URL}/api/login", json={"username": "teacher2", "password": "secret123"})
    assert res2.status_code == 200, f"Teacher 2 login failed: {res2.text}"
    token_t2 = res2.json()["access_token"]
    name_t2 = res2.json()["full_name"]
    print(f"    - Teacher 2 Logged in: {res2.json()['username']} ({name_t2})")

    # 2. Test New Teacher Registration
    unique_suffix = uuid.uuid4().hex[:5]
    new_teacher_user = f"prof_{unique_suffix}"
    new_teacher_name = f"Professor Turing {unique_suffix.upper()}"
    print(f"\n[2] Testing Dynamic Teacher Registration (POST /api/register) for '{new_teacher_user}'...")
    reg_res = api_post(
        f"{BASE_URL}/api/register",
        json={
            "username": new_teacher_user,
            "password": "strongpassword123",
            "full_name": new_teacher_name
        }
    )
    assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"
    token_t3 = reg_res.json()["access_token"]
    print(f"    - Registered & Authenticated: {new_teacher_user} ({new_teacher_name})")

    # 3. Create a unique student and answer sheet uploaded by Teacher 1
    test_roll = f"TEST-STU-{unique_suffix.upper()}"
    student_name = f"Elena Gilbert {unique_suffix.upper()}"
    print(f"\n[3] Teacher 1 creates student '{student_name}' (Roll: {test_roll})...")
    st_res = api_post(
        f"{BASE_URL}/api/students",
        json={"name": student_name, "roll_number": test_roll},
        headers={"Authorization": f"Bearer {token_t1}"}
    )
    assert st_res.status_code == 201
    student_id = st_res.json()["id"]
    print(f"    - Created Student ID #{student_id}")

    # Generate dummy handwritten image
    dummy_img = "test_portal_sheet.png"
    img = Image.new("RGB", (750, 300), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((25, 35), "Photosynthesis is the process by which green plants convert light energy into chemical energy.", fill=(0, 0, 0))
    draw.text((25, 80), "Equation: 6CO2 + 6H2O + Sunlight -> C6H12O6 + 6O2.", fill=(0, 0, 0))
    draw.text((25, 125), "Chlorophyll in chloroplasts absorbs light wavelengths.", fill=(0, 0, 0))
    img.save(dummy_img)

    with open(dummy_img, "rb") as f:
        up_res = api_post(
            f"{BASE_URL}/api/upload",
            files={"file": (dummy_img, f.read(), "image/png")},
            data={"student_id": student_id, "student_name": student_name, "roll_number": test_roll},
            headers={"Authorization": f"Bearer {token_t1}"}
        )
    assert up_res.status_code == 200
    answer_sheet_id = up_res.json()["answer_sheet_id"]
    if os.path.exists(dummy_img):
        os.remove(dummy_img)
    print(f"    - Teacher 1 uploaded Answer Sheet #{answer_sheet_id}")

    # 4. Set Model Answer
    print("\n[4] Creating Model Answer for Biology question...")
    model_res = api_post(
        f"{BASE_URL}/api/model-answer",
        json={
            "question": "Describe the biochemical process of photosynthesis, including reactants, products, and chemical equation.",
            "answer_text": "Photosynthesis is the biological process used by plants to synthesize glucose and oxygen from carbon dioxide and water using sunlight absorbed by chlorophyll. 6CO2 + 6H2O -> C6H12O6 + 6O2.",
            "max_marks": 10.0
        },
        headers={"Authorization": f"Bearer {token_t1}"}
    )
    assert model_res.status_code == 200
    model_answer_id = model_res.json()["model_answer_id"]

    # 5. Teacher 1 runs AI evaluation
    print(f"\n[5] Running AI Evaluation (Answer Sheet #{answer_sheet_id} + Model #{model_answer_id})...")
    eval_res = api_post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": answer_sheet_id, "model_answer_id": model_answer_id},
        headers={"Authorization": f"Bearer {token_t1}"}
    )
    assert eval_res.status_code == 200
    evaluation_id = eval_res.json()["evaluation_id"]
    print(f"    - Evaluation created: ID #{evaluation_id}, Suggested: {eval_res.json()['suggested_marks']}/10.0")

    # 6. Verify Teacher 2 cannot modify Teacher 1's student evaluation (403), and Teacher 1 verifies
    print(f"\n[6] Testing cross-teacher permission check and verification...")
    teacher2_feedback = "Outstanding chemical equation and accurate definition. Full marks for chlorophyll mention!"
    
    # Teacher 2 attempt should return 403
    forbidden_res = api_put(
        f"{BASE_URL}/api/results/{evaluation_id}",
        json={"final_marks": 9.75, "teacher_feedback": teacher2_feedback},
        headers={"Authorization": f"Bearer {token_t2}"}
    )
    assert forbidden_res.status_code == 403, f"Expected 403 for cross-teacher modification, got {forbidden_res.status_code}"
    print(f"    - Teacher 2 was correctly forbidden (403) from modifying Teacher 1's student.")

    # Teacher 1 verifies their own student
    teacher1_feedback = "Outstanding chemical equation and accurate definition. Full marks for chlorophyll mention!"
    verify_res = api_put(
        f"{BASE_URL}/api/results/{evaluation_id}",
        json={"final_marks": 9.75, "teacher_feedback": teacher1_feedback},
        headers={"Authorization": f"Bearer {token_t1}"}
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["final_marks"] == 9.75
    assert verify_data["verified_by"] == name_t1 or verify_data["verified_by"] == "teacher1"
    print(f"    - Teacher 1 verified result: Final Marks = {verify_data['final_marks']}, Verified by = '{verify_data['verified_by']}'")

    # 7. Student checks their marks via Student Portal
    print(f"\n[7] Student looks up marks via Student Portal (POST /api/student/portal-access with Roll: '{test_roll}')...")
    portal_res = api_post(
        f"{BASE_URL}/api/student/portal-access",
        json={"roll_number_or_id": test_roll}
    )
    assert portal_res.status_code == 200, f"Portal access failed: {portal_res.text}"
    portal_data = portal_res.json()
    assert portal_data["student_id"] == student_id
    assert portal_data["student_name"] == student_name
    assert portal_data["roll_number"] == test_roll
    assert portal_data["total_exams"] >= 1
    assert portal_data["verified_exams"] >= 1
    assert portal_data["average_score"] == 9.75

    first_result = portal_data["results"][0]
    assert first_result["final_marks"] == 9.75
    assert first_result["teacher_feedback"] == teacher1_feedback
    assert first_result["verified_by"] == name_t1 or first_result["verified_by"] == "teacher1"
    assert first_result["extracted_text"] is not None
    assert first_result["status"] == "Verified"

    print(f"    - Student Scorecard retrieved successfully:")
    print(f"      * Student: {portal_data['student_name']} (Roll: {portal_data['roll_number']})")
    print(f"      * Average Score: {portal_data['average_score']}/10.0 ({portal_data['average_percentage']}%)")
    print(f"      * Exam: {first_result['question'][:60]}...")
    print(f"      * Teacher Feedback: \"{first_result['teacher_feedback']}\"")
    print(f"      * Verified By: {first_result['verified_by']}")

    # 8. Negative Test: Invalid Roll Number
    print("\n[8] Testing non-existent Roll Number lookup...")
    bad_res = api_post(
        f"{BASE_URL}/api/student/portal-access",
        json={"roll_number_or_id": "NON_EXISTENT_ROLL_9999"}
    )
    assert bad_res.status_code == 404
    print("    - Non-existent roll number returned 404 as expected.")

    print("\n================================================================")
    print("   ALL MULTI-TEACHER & STUDENT PORTAL TESTS PASSED!             ")
    print("================================================================\n")

if __name__ == "__main__":
    test_multi_teacher_and_student_portal()
