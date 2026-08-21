import os
import requests
import json
import io
from PIL import Image, ImageDraw

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

def test_teacher_student_isolation():
    print("================================================================")
    print("      TESTING TEACHER-STUDENT ISOLATION & SECURITY CHECKS       ")
    print("================================================================\n")

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

    # 1. Login as Teacher 1 and Teacher 2
    res_t1 = api_post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res_t1.status_code == 200, f"Teacher 1 login failed: {res_t1.text}"
    token_t1 = res_t1.json()["access_token"]
    headers_t1 = {"Authorization": f"Bearer {token_t1}"}
    print("[1] Logged in as Teacher 1 (Dr. Sarah Smith).")

    res_t2 = api_post(f"{BASE_URL}/api/login", json={"username": "teacher2", "password": "secret123"})
    assert res_t2.status_code == 200, f"Teacher 2 login failed: {res_t2.text}"
    token_t2 = res_t2.json()["access_token"]
    headers_t2 = {"Authorization": f"Bearer {token_t2}"}
    print("[1] Logged in as Teacher 2 (Prof. David Johnson).")

    # 2. Check Teacher 1 students (should contain migrated students like Sanjay, madhu)
    res_t1_students = api_get(f"{BASE_URL}/api/students", headers=headers_t1)
    assert res_t1_students.status_code == 200
    t1_students = res_t1_students.json()
    print(f"\n[2] Teacher 1 student count: {len(t1_students)}")
    assert len(t1_students) > 0, "Teacher 1 should have migrated students"
    t1_names = [s["name"] for s in t1_students]
    print(f"    - Teacher 1 Students: {', '.join(t1_names)}")
    assert "madhu" in t1_names or "Sanjay" in t1_names

    # 3. Check Teacher 2 students (must NOT see Teacher 1's students)
    res_t2_students = api_get(f"{BASE_URL}/api/students", headers=headers_t2)
    assert res_t2_students.status_code == 200
    t2_students = res_t2_students.json()
    print(f"\n[3] Teacher 2 student count: {len(t2_students)}")
    t2_names = [s["name"] for s in t2_students]
    print(f"    - Teacher 2 Students: {', '.join(t2_names) if t2_names else '(Empty List)'}")
    for st in t2_students:
        assert st["name"] not in ["madhu", "Sanjay"], f"Teacher 2 should not see Teacher 1 student {st['name']}"

    # 4. Test Per-Teacher Roll Number Uniqueness
    shared_roll = "ROLL-TEST-101"
    print(f"\n[4] Testing identical Roll Number '{shared_roll}' for both teachers...")

    # Teacher 2 creates Bob with roll 101
    res_create_bob = api_post(
        f"{BASE_URL}/api/students",
        json={"name": "Bob Martin", "roll_number": shared_roll},
        headers=headers_t2
    )
    assert res_create_bob.status_code == 201, f"Teacher 2 creating student failed: {res_create_bob.text}"
    bob_data = res_create_bob.json()
    bob_id = bob_data["id"]
    print(f"    - Teacher 2 created student #{bob_id}: {bob_data['name']} (Roll: {bob_data['roll_number']})")

    # Teacher 1 creates Alice with same roll 101
    res_create_alice = api_post(
        f"{BASE_URL}/api/students",
        json={"name": "Alice Wonderland", "roll_number": shared_roll},
        headers=headers_t1
    )
    assert res_create_alice.status_code == 201, f"Teacher 1 creating student with same roll failed: {res_create_alice.text}"
    alice_data = res_create_alice.json()
    alice_id = alice_data["id"]
    print(f"    - Teacher 1 created student #{alice_id}: {alice_data['name']} (Roll: {alice_data['roll_number']})")

    # Duplicate roll within SAME teacher should still fail
    res_dup_fail = api_post(
        f"{BASE_URL}/api/students",
        json={"name": "Duplicate Alice", "roll_number": shared_roll},
        headers=headers_t1
    )
    assert res_dup_fail.status_code == 400, "Expected 400 when duplicating roll within same teacher"
    print("    - Duplicate roll within same teacher rejected with 400 Bad Request as expected.")

    # 5. Verify isolated listings and overview
    res_t1_after = api_get(f"{BASE_URL}/api/students", headers=headers_t1).json()
    t1_ids = [s["id"] for s in res_t1_after]
    assert alice_id in t1_ids
    assert bob_id not in t1_ids

    res_t2_after = api_get(f"{BASE_URL}/api/students", headers=headers_t2).json()
    t2_ids = [s["id"] for s in res_t2_after]
    assert bob_id in t2_ids
    assert alice_id not in t2_ids
    print("\n[5] Verified separate student lists for Teacher 1 and Teacher 2.")

    # 6. Verify Security / Authorization Checks (403 Forbidden)
    print("\n[6] Testing Cross-Teacher 403 Forbidden Protection:")

    # Teacher 2 tries GET Alice
    res_forbidden_get = api_get(f"{BASE_URL}/api/students/{alice_id}", headers=headers_t2)
    assert res_forbidden_get.status_code == 403, f"Expected 403, got {res_forbidden_get.status_code}"
    print("    - Teacher 2 GET /api/students/{alice_id} -> 403 Forbidden [PASS]")

    # Teacher 2 tries PUT Alice
    res_forbidden_put = api_put(f"{BASE_URL}/api/students/{alice_id}", json={"name": "Hacked Alice"}, headers=headers_t2)
    assert res_forbidden_put.status_code == 403, f"Expected 403, got {res_forbidden_put.status_code}"
    print("    - Teacher 2 PUT /api/students/{alice_id} -> 403 Forbidden [PASS]")

    # Teacher 2 tries DELETE Alice
    res_forbidden_del = api_delete(f"{BASE_URL}/api/students/{alice_id}", headers=headers_t2)
    assert res_forbidden_del.status_code == 403, f"Expected 403, got {res_forbidden_del.status_code}"
    print("    - Teacher 2 DELETE /api/students/{alice_id} -> 403 Forbidden [PASS]")

    # Teacher 2 tries GET Alice results
    res_forbidden_res = api_get(f"{BASE_URL}/api/students/{alice_id}/results", headers=headers_t2)
    assert res_forbidden_res.status_code == 403, f"Expected 403, got {res_forbidden_res.status_code}"
    print("    - Teacher 2 GET /api/students/{alice_id}/results -> 403 Forbidden [PASS]")

    # Teacher 2 tries uploading answer sheet for Alice (student_id=alice_id)
    img = Image.new("RGB", (400, 150), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), "Test Answer Text for Isolation.", fill=(0, 0, 0))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()

    files = {"file": ("test_sheet.png", img_bytes, "image/png")}
    data = {"student_id": str(alice_id)}
    res_forbidden_upload = api_post(
        f"{BASE_URL}/api/upload",
        files=files,
        data=data,
        headers=headers_t2
    )
    assert res_forbidden_upload.status_code == 403, f"Expected 403, got {res_forbidden_upload.status_code}"
    print("    - Teacher 2 POST /api/upload with Alice's student_id -> 403 Forbidden [PASS]")

    # 7. Teacher 1 uploads answer sheet for Alice and evaluates
    print("\n[7] Teacher 1 uploading & evaluating Answer Sheet for Alice...")
    res_t1_upload = api_post(
        f"{BASE_URL}/api/upload",
        files={"file": ("alice_answer.png", img_bytes, "image/png")},
        data={"student_id": str(alice_id)},
        headers=headers_t1
    )
    assert res_t1_upload.status_code == 200
    sheet_id = res_t1_upload.json()["answer_sheet_id"]

    res_model = api_post(
        f"{BASE_URL}/api/model-answer",
        json={"question": "What is Python?", "answer_text": "Python is a programming language.", "max_marks": 10.0},
        headers=headers_t1
    )
    assert res_model.status_code == 200
    model_id = res_model.json()["model_answer_id"]

    # Teacher 2 tries evaluating Teacher 1's answer sheet -> 403 Forbidden
    res_forbidden_eval = api_post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_id, "model_answer_id": model_id},
        headers=headers_t2
    )
    assert res_forbidden_eval.status_code == 403, f"Expected 403, got {res_forbidden_eval.status_code}"
    print("    - Teacher 2 POST /api/evaluate on Alice's answer sheet -> 403 Forbidden [PASS]")

    # Teacher 1 evaluates Alice
    res_t1_eval = api_post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_id, "model_answer_id": model_id},
        headers=headers_t1
    )
    assert res_t1_eval.status_code == 200
    eval_id = res_t1_eval.json()["evaluation_id"]

    # Teacher 2 tries viewing or verifying Alice's evaluation result -> 403 Forbidden
    res_forbidden_result = api_get(f"{BASE_URL}/api/results/{eval_id}", headers=headers_t2)
    assert res_forbidden_result.status_code == 403, f"Expected 403, got {res_forbidden_result.status_code}"
    print("    - Teacher 2 GET /api/results/{eval_id} -> 403 Forbidden [PASS]")

    res_forbidden_verify = api_put(
        f"{BASE_URL}/api/results/{eval_id}",
        json={"final_marks": 10.0, "teacher_feedback": "Illegal edit"},
        headers=headers_t2
    )
    assert res_forbidden_verify.status_code == 403, f"Expected 403, got {res_forbidden_verify.status_code}"
    print("    - Teacher 2 PUT /api/results/{eval_id} -> 403 Forbidden [PASS]")

    # Clean up created test students
    api_delete(f"{BASE_URL}/api/students/{alice_id}", headers=headers_t1)
    api_delete(f"{BASE_URL}/api/students/{bob_id}", headers=headers_t2)
    print("\n[8] Test cleanup complete.")

    print("\n================================================================")
    print("   ALL TEACHER-STUDENT ISOLATION TESTS PASSED 100%!             ")
    print("================================================================\n")

if __name__ == "__main__":
    test_teacher_student_isolation()
