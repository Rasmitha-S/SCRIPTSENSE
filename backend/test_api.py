import os
import sys
import json
from test_client_helper import get_client, BASE_URL

requests = get_client()

def test_api():
    print("=== Testing ScriptSense API Endpoints ===")
    
    # 1. Test Root
    res = requests.get(f"{BASE_URL}/")
    assert res.status_code == 200, f"Root failed: {res.text}"
    print("[OK] Root endpoint is live:", res.json())

    # 2. Test Login
    login_payload = {"username": "teacher1", "password": "secret123"}
    res = requests.post(f"{BASE_URL}/api/login", json=login_payload)
    assert res.status_code == 200, f"Login failed: {res.text}"
    token_data = res.json()
    token = token_data["access_token"]
    assert token is not None
    print(f"[OK] Login successful! Received JWT token ({token[:20]}...)")

    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create a real sample image file to test upload
    from PIL import Image, ImageDraw
    
    test_img_path = "test_answer_sample.png"
    img = Image.new("RGB", (600, 250), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), "Newton second law states that Force = mass * acceleration (F = ma).", fill=(0, 0, 0))
    draw.text((20, 70), "When mass is constant, acceleration is proportional to force.", fill=(0, 0, 0))
    draw.text((20, 110), "Force is measured in Newtons (N).", fill=(0, 0, 0))
    img.save(test_img_path)
    print(f"[OK] Created test image answer sheet: {test_img_path}")

    # 4. Test Upload Answer Sheet (POST /api/upload)
    with open(test_img_path, "rb") as f:
        files = {"file": (test_img_path, f, "image/png")}
        data = {"student_name": "Alex Rivera"}
        res = requests.post(f"{BASE_URL}/api/upload", files=files, data=data, headers=headers)
    
    assert res.status_code == 200, f"Upload failed: {res.text}"
    upload_data = res.json()
    print("[OK] Real File Upload & OCR Successful! Response:")
    print(json.dumps(upload_data, indent=2))
    
    answer_sheet_id = upload_data["answer_sheet_id"]
    file_path = upload_data["file_path"]
    extracted_text = upload_data["extracted_text"]

    assert os.path.exists(os.path.join(os.path.dirname(__file__), file_path)), f"Stored file not found: {file_path}"
    print(f"[OK] File physically verified in storage at {file_path}")

    # 5. Test Model Answer (POST /api/model-answer)
    model_payload = {
        "question": "Explain Newton's second law of motion and state its mathematical expression.",
        "answer_text": "Newton's second law states that Force equals mass times acceleration (F = m * a). Force is measured in Newtons.",
        "max_marks": 10.0
    }
    res = requests.post(f"{BASE_URL}/api/model-answer", json=model_payload, headers=headers)
    assert res.status_code == 200, f"Model answer creation failed: {res.text}"
    model_data = res.json()
    model_answer_id = model_data["model_answer_id"]
    print(f"[OK] Model answer created with ID #{model_answer_id}")

    # 6. Test AI Evaluation (POST /api/evaluate)
    eval_payload = {
        "answer_sheet_id": answer_sheet_id,
        "model_answer_id": model_answer_id
    }
    res = requests.post(f"{BASE_URL}/api/evaluate", json=eval_payload, headers=headers)
    assert res.status_code == 200, f"Evaluation failed: {res.text}"
    eval_data = res.json()
    print("[OK] AI Evaluation Result:")
    print(json.dumps(eval_data, indent=2))
    evaluation_id = eval_data["evaluation_id"]

    # 7. Test Results GET (GET /api/results/{id})
    res = requests.get(f"{BASE_URL}/api/results/{evaluation_id}", headers=headers)
    assert res.status_code == 200, f"GET results failed: {res.text}"
    result_data = res.json()
    print("[OK] Retrieved Result Record:")
    print(json.dumps(result_data, indent=2))

    # 8. Test Teacher Verification PUT (PUT /api/results/{id})
    verify_payload = {
        "final_marks": 9.5,
        "teacher_feedback": "Excellent response with precise formula."
    }
    res = requests.put(f"{BASE_URL}/api/results/{evaluation_id}", json=verify_payload, headers=headers)
    assert res.status_code == 200, f"PUT results failed: {res.text}"
    verified_data = res.json()
    print("[OK] Teacher Verification Saved to SQLite:")
    print(json.dumps(verified_data, indent=2))

    # Cleanup temp test file
    if os.path.exists(test_img_path):
        os.remove(test_img_path)

    print("\nALL BACKEND ENDPOINTS & REAL FILE UPLOAD TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_api()
