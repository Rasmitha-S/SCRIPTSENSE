import io
import os
import sys
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from main import app
from database import SessionLocal
import models

client = TestClient(app)

def create_mock_png(text_content="F = m * a"):
    img = Image.new("RGB", (600, 200), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((20, 80), text_content, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

def test_full_test_centric_workflow():
    print("\n" + "="*70)
    print("RUNNING SCRIPTSENSE TEST-CENTRIC WORKFLOW VERIFICATION SUITE")
    print("="*70)

    # 1. Login Teacher1 (Dr. Sarah Smith)
    t1_login = client.post("/api/login", json={"username": "teacher1", "password": "secret123"})
    assert t1_login.status_code == 200, f"Teacher1 login failed: {t1_login.text}"
    t1_token = t1_login.json()["access_token"]
    t1_headers = {"Authorization": f"Bearer {t1_token}"}
    print("[PASS] Step 1: Teacher1 logged in successfully.")

    # 2. Login Teacher2 (Prof. David Miller)
    t2_login = client.post("/api/login", json={"username": "teacher2", "password": "secret123"})
    assert t2_login.status_code == 200, f"Teacher2 login failed: {t2_login.text}"
    t2_token = t2_login.json()["access_token"]
    t2_headers = {"Authorization": f"Bearer {t2_token}"}
    print("[PASS] Step 2: Teacher2 logged in successfully.")

    # 3. Create 2 students for Teacher1
    u_suffix = os.urandom(2).hex().upper()
    st1_res = client.post("/api/students", json={"name": "Alice Newton", "roll_number": f"PHYS-001-{u_suffix}"}, headers=t1_headers)
    assert st1_res.status_code == 201
    st1 = st1_res.json()

    st2_res = client.post("/api/students", json={"name": "Bob Einstein", "roll_number": f"PHYS-002-{u_suffix}"}, headers=t1_headers)
    assert st2_res.status_code == 201
    st2 = st2_res.json()
    print(f"[PASS] Step 3: Created 2 students for Teacher1: Alice (ID {st1['id']}) and Bob (ID {st2['id']}).")

    # 4. Teacher1 creates a Test with 2 Questions and assigns both students
    test_payload = {
        "test_name": "Physics Unit Test 1",
        "subject": "Physics",
        "max_marks": 10.0,
        "questions": [
            {
                "q_num": 1,
                "question": "State Newton's second law of motion and write its mathematical formula.",
                "model_answer": "Newton's second law states that the rate of change of momentum is proportional to applied force. Formula: F = m * a with units in Newtons, kg, and m/s^2.",
                "max_marks": 4.0,
                "rubric": [
                    {"id": "q1_r1", "criterion": "Definition of law", "max_marks": 2.0, "keywords": ["force", "mass", "acceleration"]},
                    {"id": "q1_r2", "criterion": "Formula (F = m * a) & units", "max_marks": 2.0, "keywords": ["f = m * a", "newtons"]}
                ]
            },
            {
                "q_num": 2,
                "question": "Define the Work-Energy Theorem and provide a practical real-world example.",
                "model_answer": "The Work-Energy Theorem states that net work done equals the change in kinetic energy (W_net = Delta KE). Example: applying car brakes causes friction to do negative work, stopping the car.",
                "max_marks": 6.0,
                "rubric": [
                    {"id": "q2_r1", "criterion": "Theorem definition & formula", "max_marks": 3.5, "keywords": ["work", "kinetic energy", "delta"]},
                    {"id": "q2_r2", "criterion": "Real-world example", "max_marks": 2.5, "keywords": ["car", "brakes", "friction"]}
                ]
            }
        ],
        "student_ids": [st1["id"], st2["id"]]
    }

    create_test_res = client.post("/api/tests", json=test_payload, headers=t1_headers)
    assert create_test_res.status_code == 201, f"Failed to create test: {create_test_res.text}"
    created_test = create_test_res.json()
    test_id = created_test["id"]
    model_answer_id = created_test["model_answer_id"]
    assert created_test["test_name"] == "Physics Unit Test 1"
    assert created_test["questions_count"] == 2
    assert created_test["students_count"] == 2
    assert created_test["max_marks"] == 10.0
    print(f"[PASS] Step 4: Created Test '{created_test['test_name']}' (ID {test_id}) with 2 questions (10M total) and 2 students assigned.")

    # 5. Teacher1 uploads answer sheet for Student 1 (Alice) under test_id
    png_alice = create_mock_png("Newton second law: F = m * a. Work-energy theorem says work equals change in kinetic energy.")
    upload_alice_res = client.post(
        "/api/upload",
        data={
            "student_id": st1["id"],
            "student_name": st1["name"],
            "roll_number": st1["roll_number"],
            "test_id": test_id
        },
        files={"file": ("alice_answersheet.png", png_alice, "image/png")},
        headers=t1_headers
    )
    assert upload_alice_res.status_code == 200, f"Upload for Alice failed: {upload_alice_res.text}"
    alice_sheet = upload_alice_res.json()
    assert alice_sheet["test_id"] == test_id
    print(f"[PASS] Step 5: Uploaded answer sheet for Alice (Sheet ID {alice_sheet['answer_sheet_id']}) linked to Test {test_id}.")

    # 6. Teacher1 uploads answer sheet for Student 2 (Bob) under test_id
    png_bob = create_mock_png("Force is mass times acceleration (F = m*a). Brakes apply friction to stop a car converting kinetic energy.")
    upload_bob_res = client.post(
        "/api/upload",
        data={
            "student_id": st2["id"],
            "student_name": st2["name"],
            "roll_number": st2["roll_number"],
            "test_id": test_id
        },
        files={"file": ("bob_answersheet.png", png_bob, "image/png")},
        headers=t1_headers
    )
    assert upload_bob_res.status_code == 200, f"Upload for Bob failed: {upload_bob_res.text}"
    bob_sheet = upload_bob_res.json()
    assert bob_sheet["test_id"] == test_id
    print(f"[PASS] Step 6: Uploaded answer sheet for Bob (Sheet ID {bob_sheet['answer_sheet_id']}) linked to Test {test_id}.")

    # 7. Evaluate both students using Test-level one-click evaluation without re-entering model answers
    eval_all_res = client.post(f"/api/tests/{test_id}/evaluate-all", headers=t1_headers)
    assert eval_all_res.status_code == 200, f"Evaluate all failed: {eval_all_res.text}"
    eval_data = eval_all_res.json()
    assert eval_data["processed_count"] == 2
    assert len(eval_data["successful_evaluations"]) == 2

    eval1 = eval_data["successful_evaluations"][0]
    eval2 = eval_data["successful_evaluations"][1]

    # Verify both evaluations used the SAME test model answer automatically
    assert eval1["model_answer_id"] == model_answer_id
    assert eval2["model_answer_id"] == model_answer_id
    assert eval1["test_id"] == test_id
    assert eval2["test_id"] == test_id
    assert eval1["max_marks"] == 10.0
    assert eval2["max_marks"] == 10.0
    assert eval1["suggested_marks"] > 0
    assert eval2["suggested_marks"] > 0
    print(f"[PASS] Step 7: Evaluated both students in one click! Both reused model_answer_id={model_answer_id} without re-entry.")
    print(f"       Alice: {eval1['suggested_marks']}/10 M (Similarity: {eval1['similarity']*100:.1f}%)")
    print(f"       Bob:   {eval2['suggested_marks']}/10 M (Similarity: {eval2['similarity']*100:.1f}%)")

    # 8. Check Dashboard Test Overview endpoint (/api/tests/overview)
    overview_res = client.get("/api/tests/overview", headers=t1_headers)
    assert overview_res.status_code == 200
    overviews = overview_res.json()
    assert len(overviews) >= 1
    t1_test_overview = next(t for t in overviews if t["id"] == test_id)
    assert t1_test_overview["test_name"] == "Physics Unit Test 1"
    assert t1_test_overview["students_count"] == 2
    assert t1_test_overview["evaluated_count"] == 2
    for st_status in t1_test_overview["students"]:
        assert st_status["status"] in ["Evaluated", "Verified"]
        assert st_status["suggested_marks"] is not None
    print(f"[PASS] Step 8: Dashboard overview correctly groups students under '{t1_test_overview['test_name']}' with 'Evaluated' status.")

    # 9. Verify Teacher Data Isolation
    # Teacher2 must NOT be able to view, evaluate, or mutate Teacher1's test
    t2_view_test = client.get(f"/api/tests/{test_id}", headers=t2_headers)
    assert t2_view_test.status_code == 403, f"Expected 403 for Teacher2 accessing Teacher1's test, got {t2_view_test.status_code}"

    t2_eval_test = client.post(f"/api/tests/{test_id}/evaluate-all", headers=t2_headers)
    assert t2_eval_test.status_code == 403, f"Expected 403 for Teacher2 evaluating Teacher1's test, got {t2_eval_test.status_code}"

    t2_delete_test = client.delete(f"/api/tests/{test_id}", headers=t2_headers)
    assert t2_delete_test.status_code == 403, f"Expected 403 for Teacher2 deleting Teacher1's test, got {t2_delete_test.status_code}"

    t2_overview = client.get("/api/tests/overview", headers=t2_headers).json()
    assert not any(t["id"] == test_id for t in t2_overview), "Teacher2 must not see Teacher1's tests in their overview."
    print("[PASS] Step 9: Strict Teacher Data Isolation verified! Teacher2 cannot view, evaluate, or mutate Teacher1's tests.")

    # 10. Teacher1 verifies the result for Alice
    verify_res = client.put(
        f"/api/results/{eval1['evaluation_id']}",
        json={"final_marks": 9.5, "teacher_feedback": "Excellent conceptual understanding of laws of motion and work-energy."},
        headers=t1_headers
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["final_marks"] == 9.5
    print("[PASS] Step 10: Teacher verified Alice's score with final marks (9.5/10).")

    # 11. Re-check overview: Alice is now Verified (1 verified, 1 evaluated)
    overview_after = client.get("/api/tests/overview", headers=t1_headers).json()
    t1_test_after = next(t for t in overview_after if t["id"] == test_id)
    assert t1_test_after["verified_count"] == 1
    assert t1_test_after["evaluated_count"] == 1
    print("[PASS] Step 11: Overview updated: 1 Verified, 1 Evaluated.")

    print("\n" + "="*70)
    print("ALL 11 TEST-CENTRIC WORKFLOW CHECKS PASSED WITH 100% SUCCESS!")
    print("="*70)

if __name__ == "__main__":
    test_full_test_centric_workflow()
