import uuid
import os
import sys
from PIL import Image, ImageDraw
from test_client_helper import get_client, BASE_URL

requests = get_client()

def run_test():
    print("=" * 64)
    print("   TESTING MULTI-QUESTION EXAM PAPERS & STEP-WISE RUBRICS     ")
    print("=" * 64)

    # 1. Login as teacher
    print("\n[1] Authenticating teacher...")
    login_resp = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("    [PASS] Teacher authenticated.")

    # 2. Create Multi-Question Exam Paper with Rubrics
    print("\n[2] Creating Multi-Question Exam Paper with Step-wise Rubrics...")
    exam_payload = {
        "title": "Physics Midterm: Mechanics & Energy",
        "subject": "Physics",
        "max_marks": 15.0,
        "questions": [
            {
                "q_num": 1,
                "question": "State Newton's second law of motion and write its mathematical formula.",
                "model_answer": "Newton's second law of motion states that the acceleration of an object is directly proportional to the net force acting upon it and inversely proportional to its mass. Mathematically, F = m * a where F is force in Newtons, m is mass in kg, and a is acceleration in m/s^2.",
                "max_marks": 8.0,
                "rubric": [
                    {
                        "id": "q1_r1",
                        "criterion": "Definition of Law (Rate of change of momentum / force & acceleration)",
                        "max_marks": 4.0,
                        "keywords": ["force", "acceleration", "proportional", "mass"]
                    },
                    {
                        "id": "q1_r2",
                        "criterion": "Mathematical Formula (F = m * a) with correct units (N, kg, m/s^2)",
                        "max_marks": 4.0,
                        "keywords": ["f = m * a", "newtons", "kg", "formula"]
                    }
                ]
            },
            {
                "q_num": 2,
                "question": "Define the Work-Energy Theorem and give a real-world example.",
                "model_answer": "The Work-Energy Theorem states that the net work done by all forces on a body equals the change in its kinetic energy (W_net = Delta KE). For example, when brakes are applied to a moving car, frictional work reduces its kinetic energy to zero, stopping the car.",
                "max_marks": 7.0,
                "rubric": [
                    {
                        "id": "q2_r1",
                        "criterion": "Statement & Definition of Work-Energy Theorem (W_net = Delta KE)",
                        "max_marks": 4.0,
                        "keywords": ["work", "kinetic energy", "forces", "change"]
                    },
                    {
                        "id": "q2_r2",
                        "criterion": "Valid real-world application or example (e.g. car braking)",
                        "max_marks": 3.0,
                        "keywords": ["car", "brakes", "friction", "stopping"]
                    }
                ]
            }
        ]
    }

    model_resp = requests.post(f"{BASE_URL}/api/model-answer", json=exam_payload, headers=headers)
    assert model_resp.status_code == 200, f"Model answer creation failed: {model_resp.text}"
    model_data = model_resp.json()
    model_id = model_data["model_answer_id"]
    print(f"    [PASS] Created Exam Paper ID #{model_id} ('{model_data['title']}', Total Marks: {model_data['max_marks']}, Questions: {model_data['questions_count']})")

    # 3. Create Student and Upload Multi-Question Answer Sheet
    test_id = uuid.uuid4().hex[:5].upper()
    student_roll = f"MQ-STU-{test_id}"
    print(f"\n[3] Creating Student ({student_roll}) and Uploading Multi-Question Answer Sheet...")
    student_resp = requests.post(f"{BASE_URL}/api/students", json={"name": f"Student {test_id}", "roll_number": student_roll}, headers=headers)
    assert student_resp.status_code == 201
    student_id = student_resp.json()["id"]

    # Generate a test image
    img = Image.new("RGB", (600, 300), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 20), "Q1: Newton second law states force equals mass times acceleration. F = m * a.", fill=(0, 0, 0))
    draw.text((20, 100), "Q2: Work energy theorem states work done is change in kinetic energy. Example: car braking.", fill=(0, 0, 0))
    test_img_path = f"test_mq_sheet_{test_id}.png"
    img.save(test_img_path)

    with open(test_img_path, "rb") as f:
        upload_resp = requests.post(
            f"{BASE_URL}/api/upload",
            files={"file": (test_img_path, f, "image/png")},
            data={"student_name": f"Student {test_id}", "roll_number": student_roll, "student_id": str(student_id)},
            headers=headers
        )
    if os.path.exists(test_img_path):
        os.remove(test_img_path)

    assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
    sheet_id = upload_resp.json()["answer_sheet_id"]
    print(f"    [PASS] Uploaded Answer Sheet #{sheet_id} for {student_roll}.")

    # 4. Trigger AI Evaluation
    print("\n[4] Running AI Semantic Evaluation on Multi-Question Exam Paper...")
    eval_resp = requests.post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_id, "model_answer_id": model_id},
        headers=headers
    )
    assert eval_resp.status_code == 200, f"Evaluation failed: {eval_resp.text}"
    eval_data = eval_resp.json()
    eval_id = eval_data["evaluation_id"]
    print(f"    [PASS] Evaluation created ID #{eval_id}")
    print(f"           Overall Similarity: {eval_data['similarity']*100:.1f}%")
    print(f"           Cumulative Suggested Marks: {eval_data['suggested_marks']} / {eval_data['max_marks']}")
    print(f"           Rationale: {eval_data['explanation']}")

    # Check question-by-question evaluations
    q_evals = eval_data.get("question_evaluations")
    assert q_evals and len(q_evals) == 2, f"Expected 2 question evaluations, got {len(q_evals) if q_evals else 0}"
    for qe in q_evals:
        print(f"           * Q{qe['q_num']}: Suggested {qe['suggested_marks']}/{qe['max_marks']} M (Sim: {qe['similarity']*100:.0f}%)")
        for r in qe.get("rubric_scores", []):
            print(f"             - Criterion: {r['criterion']} -> {r['suggested_marks']}/{r['max_marks']} M (Matched: {r['matched_keywords']})")

    # 5. Teacher Verification with Step-Wise Adjustments
    print("\n[5] Teacher Final Verification & Step-Wise Rubric Adjustments (PUT /api/results/{id})...")
    verification_payload = {
        "final_marks": 14.5,
        "teacher_feedback": "Outstanding work! Clear formulas and great car braking example.",
        "question_results": [
            {
                "q_num": 1,
                "final_marks": 7.8,
                "max_marks": 8.0,
                "teacher_comment": "Precise derivation of F=ma."
            },
            {
                "q_num": 2,
                "final_marks": 6.7,
                "max_marks": 7.0,
                "teacher_comment": "Excellent car braking example."
            }
        ]
    }

    verify_resp = requests.put(f"{BASE_URL}/api/results/{eval_id}", json=verification_payload, headers=headers)
    assert verify_resp.status_code == 200, f"Verification failed: {verify_resp.text}"
    verify_data = verify_resp.json()
    print(f"    [PASS] Confirmed Final Marks: {verify_data['final_marks']} M (Verified by: {verify_data['verified_by']})")

    # 6. Student Portal Lookup
    print(f"\n[6] Student looking up scorecard on Student Portal with Roll: '{student_roll}'...")
    portal_resp = requests.post(f"{BASE_URL}/api/student/portal-access", json={"roll_number_or_id": student_roll})
    assert portal_resp.status_code == 200, f"Portal access failed: {portal_resp.text}"
    portal_data = portal_resp.json()
    assert len(portal_data["results"]) >= 1
    card = portal_data["results"][0]
    print(f"    [PASS] Student Scorecard Retrieved:")
    print(f"           Student: {portal_data['student_name']} (Roll: {portal_data['roll_number']})")
    print(f"           Exam: {card['title'] or card['question']}")
    print(f"           Score: {card['final_marks']} / {card['max_marks']} ({card['final_marks']/card['max_marks']*100:.1f}%)")
    print(f"           Teacher Feedback: \"{card['teacher_feedback']}\"")
    print(f"           Question Breakdown Count: {len(card.get('question_evaluations') or [])}")

    print("\n" + "=" * 64)
    print("   ALL MULTI-QUESTION & RUBRICS TESTS PASSED SUCCESSFULLY!    ")
    print("=" * 64)

if __name__ == "__main__":
    run_test()
