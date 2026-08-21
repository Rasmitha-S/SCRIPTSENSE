import os
import sys
import requests
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

BASE_URL = "http://127.0.0.1:8000"

def test_cnn_handwriting_pipeline():
    print("=" * 70)
    print("     TESTING CNN-BASED HANDWRITING RECOGNITION & EVALUATION FLOW     ")
    print("=" * 70)

    # 1. Direct Service Unit Test
    from services.handwriting_service import (
        extract_handwritten_text_cnn,
        preprocess_image_for_cnn,
        segment_lines_and_characters,
        get_cnn_engine,
        HandwritingCNN,
    )
    from PIL import Image

    sample_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "31_alex_rivera_physics_answer.png")
    assert os.path.exists(sample_img_path), f"Sample image not found at {sample_img_path}"

    print(f"\n[1] Testing Direct CNN Handwriting Pipeline on: {os.path.basename(sample_img_path)}")
    
    # Step A: Preprocess
    raw_img = Image.open(sample_img_path)
    enhanced, binary = preprocess_image_for_cnn(raw_img)
    print(f"    [PASS] Preprocessed image: Grayscale shape {enhanced.shape}, Binary thresholded shape {binary.shape}")

    # Step B: Segmentation
    structured_lines = segment_lines_and_characters(binary)
    total_chars = sum(len(line) for line in structured_lines)
    print(f"    [PASS] Segmentation: Found {len(structured_lines)} text lines, {total_chars} character units.")

    # Step C: CNN Inference
    engine = get_cnn_engine()
    assert isinstance(engine.model, HandwritingCNN), "CNN Model is not instance of HandwritingCNN"
    print(f"    [PASS] PyTorch HandwritingCNN loaded on device: {engine.device}")

    # Step D: Complete Service Call
    extracted_text = extract_handwritten_text_cnn(sample_img_path)
    print("\n" + "-" * 70)
    print("                 CNN EXTRACTED HANDWRITING TEXT                 ")
    print("-" * 70)
    print(extracted_text)
    print("-" * 70)
    assert len(extracted_text) > 0, "CNN text extraction returned empty"

    # 2. Test API Upload & SQLite Persistence
    print("\n[2] Testing POST /api/upload with CNN Handwriting Recognition...")
    login_res = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert login_res.status_code == 200, f"Teacher login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    with open(sample_img_path, "rb") as f:
        files = {"file": (os.path.basename(sample_img_path), f, "image/png")}
        data = {
            "student_name": "CNN Test Student",
            "roll_number": "CNN-ROLL-001"
        }
        res_upload = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files, data=data)

    assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
    upload_json = res_upload.json()
    sheet_id = upload_json["answer_sheet_id"]
    api_text = upload_json["extracted_text"]
    print(f"    [PASS] Answer Sheet uploaded with ID #{sheet_id}")
    print(f"    - Extracted Text in API response: {len(api_text)} characters")

    # Step E: Verify SQLite Database Record
    from database import SessionLocal
    import models
    db = SessionLocal()
    saved_sheet = db.query(models.AnswerSheet).filter(models.AnswerSheet.id == sheet_id).first()
    assert saved_sheet is not None, "Answer sheet not found in SQLite"
    assert saved_sheet.extracted_text == api_text, "Extracted text in SQLite does not match API response"
    print("    [PASS] Confirmed persistence in SQLite answer_sheets.extracted_text.")

    # 3. Test Evaluation Service with CNN-extracted text
    print("\n[3] Testing Semantic Evaluation with Gemini/Sentence-Transformers...")
    # Create a model answer for evaluation
    model_payload = {
        "title": "Physics Question: Newton's Second Law",
        "subject": "Physics",
        "question": "State Newton's second law of motion and its formula.",
        "model_answer": "Newton's second law states that the rate of change of momentum is directly proportional to applied force. Formula: F = m * a where Force is measured in Newtons.",
        "max_marks": 10.0
    }
    model_res = requests.post(f"{BASE_URL}/api/model-answer", headers=headers, json=model_payload)
    assert model_res.status_code == 200, f"Model answer creation failed: {model_res.text}"
    model_id = model_res.json()["model_answer_id"]

    eval_payload = {
        "answer_sheet_id": sheet_id,
        "model_answer_id": model_id
    }
    eval_res = requests.post(f"{BASE_URL}/api/evaluate", headers=headers, json=eval_payload)
    assert eval_res.status_code == 200, f"Evaluation failed: {eval_res.text}"
    eval_data = eval_res.json()
    print(f"    [PASS] Evaluation completed with ID #{eval_data['evaluation_id']}")
    print(f"    - Similarity Score: {eval_data['similarity'] * 100:.1f}%")
    print(f"    - Suggested Marks: {eval_data['suggested_marks']} / {eval_data['max_marks']}")
    print(f"    - Rationale: {eval_data['explanation'][:100]}...")

    db.close()

    print("\n" + "=" * 70)
    print("   ALL CNN HANDWRITING EXTRACTION & EVALUATION TESTS PASSED 100%!  ")
    print("=" * 70)

if __name__ == "__main__":
    test_cnn_handwriting_pipeline()
