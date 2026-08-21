import os
import requests
import json
import io
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

def test_students_and_linking():
    print("================================================================")
    print("   TESTING STUDENTS TABLE & ANSWER SHEET FOREIGN KEY LINKING    ")
    print("================================================================\n")

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
    res = api_post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Logged in as teacher1.")

    # 2. Test GET /api/students
    res_students = api_get(f"{BASE_URL}/api/students", headers=headers)
    assert res_students.status_code == 200, f"List students failed: {res_students.text}"
    students_list = res_students.json()
    print(f"[2] GET /api/students returned {len(students_list)} existing students:")
    for s in students_list[:3]:
        print(f"    - ID #{s['id']}: {s['name']} (Roll: {s['roll_number']})")

    # 3. Test POST /api/students
    unique_roll = f"TEST-{os.urandom(3).hex().upper()}"
    new_student_payload = {
        "name": "Sarah Connor",
        "roll_number": unique_roll
    }
    res_create = api_post(f"{BASE_URL}/api/students", json=new_student_payload, headers=headers)
    assert res_create.status_code == 201, f"Create student failed: {res_create.text}"
    created_student = res_create.json()
    sarah_id = created_student["id"]
    assert created_student["name"] == "Sarah Connor"
    assert created_student["roll_number"] == unique_roll
    print(f"\n[3] POST /api/students created student #{sarah_id}: {created_student['name']} (Roll: {created_student['roll_number']})")

    # 4. Upload Answer Sheet linked directly to student_id
    img_name = "sarah_answer_test.png"
    img = Image.new("RGB", (600, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), "Newton second law: F = m * a.", fill=(0, 0, 0))
    draw.text((20, 70), "Force is directly proportional to acceleration.", fill=(0, 0, 0))
    
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()

    try:
        files = {"file": (img_name, img_bytes, "image/png")}
        data = {"student_id": str(sarah_id), "student_name": "Sarah Connor"}
        res_upload = api_post(
            f"{BASE_URL}/api/upload",
            files=files,
            data=data,
            headers=headers
        )
        assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
        upload_data = res_upload.json()
        assert upload_data["student_id"] == sarah_id
        assert upload_data["student_name"] == "Sarah Connor"
        assert upload_data["roll_number"] == unique_roll
        sheet_id = upload_data["answer_sheet_id"]
        print(f"\n[4] Uploaded AnswerSheet #{sheet_id} linked with foreign key student_id={sarah_id} ({upload_data['student_name']})")
    except Exception as e:
        raise e

    # 5. Evaluate and verify result endpoint returns student metadata
    res_mod = api_post(
        f"{BASE_URL}/api/model-answer",
        json={
            "question": "State Newton's second law.",
            "answer_text": "Newton's second law is F = m * a. Force equals mass times acceleration.",
            "max_marks": 10.0
        },
        headers=headers
    )
    assert res_mod.status_code == 200
    mod_id = res_mod.json()["model_answer_id"]

    res_eval = api_post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_id, "model_answer_id": mod_id},
        headers=headers
    )
    assert res_eval.status_code == 200
    eval_id = res_eval.json()["evaluation_id"]

    res_res = api_get(f"{BASE_URL}/api/results/{eval_id}", headers=headers)
    assert res_res.status_code == 200
    res_detail = res_res.json()
    assert res_detail["student_id"] == sarah_id
    assert res_detail["student_name"] == "Sarah Connor"
    assert res_detail["roll_number"] == unique_roll
    print(f"\n[5] GET /api/results/{eval_id} verified with student metadata:")
    print(f"    - student_id: {res_detail['student_id']}")
    print(f"    - student_name: {res_detail['student_name']}")
    print(f"    - roll_number: {res_detail['roll_number']}")

    # 6. Test GET /api/students/overview
    res_overview = api_get(f"{BASE_URL}/api/students/overview", headers=headers)
    assert res_overview.status_code == 200, f"Overview failed: {res_overview.text}"
    overview_data = res_overview.json()
    sarah_overview = next((s for s in overview_data if s["id"] == sarah_id), None)
    assert sarah_overview is not None, f"Student {sarah_id} not found in overview"
    assert sarah_overview["status"] == "Evaluated", f"Expected Evaluated, got {sarah_overview['status']}"
    assert sarah_overview["latest_evaluation_id"] == eval_id
    assert sarah_overview["upload_count"] >= 1
    print(f"\n[6] GET /api/students/overview verified:")
    print(f"    - Total students in overview: {len(overview_data)}")
    print(f"    - Student #{sarah_id} status: {sarah_overview['status']}")
    print(f"    - Student #{sarah_id} latest_evaluation_id: {sarah_overview['latest_evaluation_id']}")

    # Teacher confirms score to test "Verified" status
    res_verify = api_put(
        f"{BASE_URL}/api/results/{eval_id}",
        json={"final_marks": 9.0, "teacher_feedback": "Excellent work."},
        headers=headers
    )
    assert res_verify.status_code == 200

    res_overview_after = api_get(f"{BASE_URL}/api/students/overview", headers=headers)
    assert res_overview_after.status_code == 200
    sarah_after = next((s for s in res_overview_after.json() if s["id"] == sarah_id), None)
    assert sarah_after is not None, f"Student {sarah_id} not found in overview after verification"
    assert sarah_after["status"] == "Verified", f"Expected Verified, got {sarah_after['status']}"
    assert sarah_after["final_marks"] == 9.0
    print(f"    - Student #{sarah_id} updated status after verification: {sarah_after['status']} (Final Marks: {sarah_after['final_marks']})")

    print("\n================================================================")
    print("   ALL STUDENTS TABLE & OVERVIEW TESTS PASSED SUCCESSFULLY!     ")
    print("================================================================")

if __name__ == "__main__":
    test_students_and_linking()

