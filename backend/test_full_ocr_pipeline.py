import json
import os
import io
import sys
from PIL import Image, ImageDraw
from test_client_helper import get_client, BASE_URL

requests = get_client()

def create_test_image(text_lines):
    img = Image.new("RGB", (750, 320), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    y = 25
    for line in text_lines:
        draw.text((25, y), line, fill=(0, 0, 0))
        y += 40
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

def run_full_ocr_pipeline_test():
    print("=" * 65)
    print("     FULL END-TO-END OCR PIPELINE LIVE INTEGRATION TEST")
    print("=" * 65)

    # 1. Login
    res_login = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res_login.status_code == 200, f"Login failed: {res_login.text}"
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Teacher logged in successfully.")

    # 2. Upload Model Answer Image via /api/model-answer (OCR Extraction)
    print("\n[2] Uploading Model Answer Image with OCR Extraction (POST /api/model-answer)...")
    model_img_bytes = create_test_image([
        "Physics Benchmark Solution: Newton's Laws",
        "Newton's second law states that Force is equal to mass times acceleration (F = m * a).",
        "The standard unit of force is Newtons (N), mass in kg, acceleration in m/s^2."
    ])
    res_model = requests.post(
        f"{BASE_URL}/api/model-answer",
        files={"file": ("physics_model_sheet.png", model_img_bytes, "image/png")},
        data={
            "question": "State Newton's second law of motion and its formula.",
            "max_marks": "10.0",
            "title": "Physics Laws Reference",
            "subject": "Physics"
        },
        headers=headers
    )
    assert res_model.status_code == 200, f"Model answer upload failed: {res_model.text}"
    model_data = res_model.json()
    model_id = model_data["model_answer_id"]
    print(f"    -> Created Model Answer ID #{model_id}")
    print(f"    -> Extracted Model Text in DB:\n       \"{model_data.get('extracted_text', '').replace(chr(10), ' ')}\"")

    # 3. Upload Student Answer Sheet Image via /api/upload (OCR Extraction)
    print("\n[3] Uploading Student Answer Image with OCR Extraction (POST /api/upload)...")
    student_img_bytes = create_test_image([
        "Student Answer - Alex Rivera (CS2026-0101)",
        "Force is the product of mass and acceleration according to Newton's second law (F = m * a).",
        "Force is measured in Newtons."
    ])
    res_upload = requests.post(
        f"{BASE_URL}/api/upload",
        files={"file": ("alex_newton_answer.png", student_img_bytes, "image/png")},
        data={
            "student_name": "Alex Rivera",
            "roll_number": "CS2026-0101"
        },
        headers=headers
    )
    assert res_upload.status_code == 200, f"Student upload failed: {res_upload.text}"
    upload_data = res_upload.json()
    sheet_id = upload_data["answer_sheet_id"]
    print(f"    -> Created Answer Sheet ID #{sheet_id}")
    print(f"    -> Extracted Student Text in DB:\n       \"{upload_data.get('extracted_text', '').replace(chr(10), ' ')}\"")

    # 4. Teacher Edits OCR Transcript (PUT /api/uploads/{id}/transcript)
    print("\n[4] Teacher Refining OCR Transcript (PUT /api/uploads/{id}/transcript)...")
    refined_text = upload_data["extracted_text"] + "\n[Teacher Verified Transcription]"
    res_transcript = requests.put(
        f"{BASE_URL}/api/uploads/{sheet_id}/transcript",
        json={"extracted_text": refined_text},
        headers=headers
    )
    assert res_transcript.status_code == 200
    print(f"    -> Updated transcript in DB for Sheet ID #{sheet_id}")

    # 5. Run Semantic AI Evaluation
    print("\n[5] Running AI Evaluation on OCR Extracted Texts (POST /api/evaluate)...")
    res_eval = requests.post(
        f"{BASE_URL}/api/evaluate",
        json={"answer_sheet_id": sheet_id, "model_answer_id": model_id},
        headers=headers
    )
    assert res_eval.status_code == 200, f"Evaluation failed: {res_eval.text}"
    eval_data = res_eval.json()
    eval_id = eval_data["evaluation_id"]
    print(f"    -> Evaluation ID #{eval_id}")
    print(f"    -> Similarity Score: {eval_data['similarity']*100:.1f}%")
    print(f"    -> AI Suggested Marks: {eval_data['suggested_marks']}/{eval_data['max_marks']}")
    print(f"    -> AI Explanation: {eval_data['explanation']}")

    # 6. Save Teacher Verified Score
    print("\n[6] Teacher Confirming Final Marks (PUT /api/results/{id})...")
    res_verify = requests.put(
        f"{BASE_URL}/api/results/{eval_id}",
        json={"final_marks": 9.5, "teacher_feedback": "Excellent understanding of Newton's second law!"},
        headers=headers
    )
    assert res_verify.status_code == 200
    print("    -> Final Marks 9.5/10.0 recorded and published to student portal.")

    # 7. Student Portal Access
    print("\n[7] Student Accessing Scorecard via Student Portal (POST /api/student/portal-access)...")
    res_portal = requests.post(f"{BASE_URL}/api/student/portal-access", json={"roll_number_or_id": "CS2026-0101"})
    assert res_portal.status_code == 200
    portal_data = res_portal.json()
    print(f"    -> Student Name: {portal_data['student_name']}")
    print(f"    -> Total Exams: {portal_data['total_exams']}, Average Score: {portal_data['average_score']}/10.0")

    print("\n" + "=" * 65)
    print("   END-TO-END OCR & EVALUATION PIPELINE TEST: 100% SUCCESS!")
    print("=" * 65)

if __name__ == "__main__":
    run_full_ocr_pipeline_test()
