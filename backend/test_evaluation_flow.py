import os
import sys
import json
from PIL import Image, ImageDraw
from test_client_helper import get_client, BASE_URL

requests = get_client()

def test_evaluation_flow():
    print("================================================================")
    print("   TESTING END-TO-END AI EVALUATION PIPELINE (MULTI-DOMAIN)     ")
    print("================================================================\n")

    # 1. Login
    res = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Logged in as teacher1 (Bearer JWT received)")

    # 2. Test Case A: Physics (High Match)
    print("\n--- Test Case A: Physics (Expected High Semantic Match) ---")
    img_a = "sample_physics_student.png"
    img = Image.new("RGB", (650, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), "Newton second law states that Force = mass * acceleration (F = ma).", fill=(0, 0, 0))
    draw.text((20, 70), "When mass is constant, acceleration is proportional to applied force.", fill=(0, 0, 0))
    draw.text((20, 110), "The standard unit of force is Newtons (N).", fill=(0, 0, 0))
    img.save(img_a)

    with open(img_a, "rb") as f:
        res_sheet_a = requests.post(
            f"{BASE_URL}/api/upload",
            files={"file": (img_a, f, "image/png")},
            data={"student_name": "Marcus Vance"},
            headers=headers
        )
    assert res_sheet_a.status_code == 200
    sheet_a_id = res_sheet_a.json()["answer_sheet_id"]
    os.remove(img_a)
    print(f"Uploaded Answer Sheet #{sheet_a_id} (Marcus Vance)")

    # Save Physics Model Answer
    res_mod_a = requests.post(
        f"{BASE_URL}/api/model-answer",
        json={
            "question": "State Newton's second law of motion, formula, and SI units.",
            "answer_text": "Newton's second law states that the acceleration of an object is directly proportional to net force and inversely proportional to mass (F = m * a). Force is measured in Newtons (N).",
            "max_marks": 10.0
        },
        headers=headers
    )
    assert res_mod_a.status_code == 200
    mod_a_id = res_mod_a.json()["model_answer_id"]
    print(f"Created Model Answer #{mod_a_id} (Physics - Max 10M)")

    # Evaluate Physics
    eval_res_a = requests.post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_a_id, "model_answer_id": mod_a_id},
        headers=headers
    )
    assert eval_res_a.status_code == 200
    data_a = eval_res_a.json()
    print(f"-> Similarity: {(data_a['similarity']*100):.1f}% | Suggested: {data_a['suggested_marks']}/10.0")
    print(f"-> Explanation: {data_a['explanation']}")
    assert data_a["similarity"] >= 0.75, "Expected high similarity"

    # 3. Test Case B: Computer Science (Partial Match)
    print("\n--- Test Case B: Computer Science (Expected Moderate Match) ---")
    img_b = "sample_cs_student.png"
    img = Image.new("RGB", (650, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), "Polymorphism means having many forms in code.", fill=(0, 0, 0))
    draw.text((20, 70), "It lets you use the same method name for different classes.", fill=(0, 0, 0))
    img.save(img_b)

    with open(img_b, "rb") as f:
        res_sheet_b = requests.post(
            f"{BASE_URL}/api/upload",
            files={"file": (img_b, f, "image/png")},
            data={"student_name": "Elena Rostova"},
            headers=headers
        )
    assert res_sheet_b.status_code == 200
    sheet_b_id = res_sheet_b.json()["answer_sheet_id"]
    os.remove(img_b)
    print(f"Uploaded Answer Sheet #{sheet_b_id} (Elena Rostova)")

    # Save CS Model Answer
    res_mod_b = requests.post(
        f"{BASE_URL}/api/model-answer",
        json={
            "question": "What is polymorphism in OOP and what are its two main types?",
            "answer_text": "Polymorphism enables entities to take on multiple forms. The two primary types are compile-time polymorphism (method overloading) and runtime polymorphism (method overriding via inheritance).",
            "max_marks": 8.0
        },
        headers=headers
    )
    assert res_mod_b.status_code == 200
    mod_b_id = res_mod_b.json()["model_answer_id"]
    print(f"Created Model Answer #{mod_b_id} (CS - Max 8M)")

    # Evaluate CS
    eval_res_b = requests.post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_b_id, "model_answer_id": mod_b_id},
        headers=headers
    )
    assert eval_res_b.status_code == 200
    data_b = eval_res_b.json()
    print(f"-> Similarity: {(data_b['similarity']*100):.1f}% | Suggested: {data_b['suggested_marks']}/8.0")
    print(f"-> Explanation: {data_b['explanation']}")
    assert data_b["suggested_marks"] <= 8.0

    # 4. Verify Listing Endpoints
    print("\n--- Verifying List Endpoints ---")
    sheets_list = requests.get(f"{BASE_URL}/api/answer-sheets", headers=headers).json()
    assert len(sheets_list) >= 2
    print(f"[OK] GET /api/answer-sheets returned {len(sheets_list)} total answer sheets.")

    models_list = requests.get(f"{BASE_URL}/api/model-answers", headers=headers).json()
    assert len(models_list) >= 2
    print(f"[OK] GET /api/model-answers returned {len(models_list)} total model answers.")

    # 5. Verify Teacher Confirmation on Case B
    eval_b_id = data_b["evaluation_id"]
    res_confirm = requests.put(
        f"{BASE_URL}/api/results/{eval_b_id}",
        json={"final_marks": 6.5, "teacher_feedback": "Understood the broad concept; omitted compile-time vs runtime classification."},
        headers=headers
    )
    assert res_confirm.status_code == 200
    print(f"\n[OK] Teacher finalized score for Evaluation #{eval_b_id}: 6.5/8.0")

    print("\n================================================================")
    print("   ALL MULTI-DOMAIN EVALUATION TESTS PASSED SUCCESSFULLY!       ")
    print("================================================================")

if __name__ == "__main__":
    test_evaluation_flow()
