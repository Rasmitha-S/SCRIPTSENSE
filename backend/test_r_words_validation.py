import time
import io
import requests
from PIL import Image, ImageDraw, ImageFont

BASE_URL = "http://127.0.0.1:8000"

TARGET_WORDS = [
    "are",
    "answer",
    "correct",
    "protocol",
    "computer",
    "server",
    "network",
    "error",
    "transfer"
]

def test_r_recognition_on_live_server():
    print("================================================================")
    print("        TESTING 'r' RECOGNITION ENHANCEMENTS ON API             ")
    print("================================================================\n")

    # 1. Login
    res_login = requests.post(f"{BASE_URL}/api/login", json={"username": "teacher1", "password": "secret123"})
    assert res_login.status_code == 200, f"Login failed: {res_login.text}"
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Teacher authenticated successfully.")

    # 2. Test actual WhatsApp image upload (where 'r' was originally misrecognized as 'x' and 'n')
    print("\n[2] Uploading real student handwritten image (129_WhatsApp_Image...)...")
    with open("uploads/129_WhatsApp_Image_2026-08-21_at_6.40.46_AM.jpeg", "rb") as f:
        img_bytes = f.read()

    t0 = time.time()
    res_upload_real = requests.post(
        f"{BASE_URL}/api/upload",
        files={"file": ("student_handwritten_network_answer.png", img_bytes, "image/png")},
        data={"student_name": "Marcus Vance", "roll_number": "CS2026-202"},
        headers=headers
    )
    t1 = time.time()
    elapsed_real = round(t1 - t0, 2)
    assert res_upload_real.status_code == 200, f"Upload failed: {res_upload_real.text}"
    real_text = res_upload_real.json()["extracted_text"]
    
    print(f"    - Extraction Time: {elapsed_real}s")
    print(f"    - Extracted Text:\n\"\"\"\n{real_text}\n\"\"\"")

    # Verify 'r' recognition in the real student handwriting
    assert "Computer" in real_text or "computer" in real_text.lower(), "Expected 'Computer' restored from 'Computex'"
    assert "network" in real_text.lower(), "Expected 'network' restored from 'netwoxk'"
    assert "interconnected" in real_text.lower(), "Expected 'interconnected' restored from 'intexconnected'"
    assert "computers" in real_text.lower(), "Expected 'computers' restored from 'computens'"
    assert "other" in real_text.lower(), "Expected 'other' restored from 'othen'"
    assert "share" in real_text.lower(), "Expected 'share' restored from 'shane'"
    print("    [PASS] All handwritten 'r' characters in real student answer successfully recognized/restored!")

    # 3. Test comprehensive suite of target words
    print("\n[3] Testing comprehensive target words suite containing 'r'...")
    target_sentences = [
        "These are the correct answers.",
        "TCP protocol runs on computer and server.",
        "Network error handling during data transfer."
    ]

    img = Image.new("RGB", (750, 180), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    y = 25
    for s in target_sentences:
        draw.text((25, y), s, fill=(15, 23, 42))
        y += 45

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    test_sheet_bytes = buf.getvalue()

    t0 = time.time()
    res_upload_suite = requests.post(
        f"{BASE_URL}/api/upload",
        files={"file": ("target_words_sheet.png", test_sheet_bytes, "image/png")},
        data={"student_name": "Marcus Vance", "roll_number": "CS2026-202"},
        headers=headers
    )
    t1 = time.time()
    elapsed_suite = round(t1 - t0, 2)
    assert res_upload_suite.status_code == 200
    suite_text = res_upload_suite.json()["extracted_text"]
    print(f"    - Extraction Time: {elapsed_suite}s")
    print(f"    - Extracted Text:\n\"\"\"\n{suite_text}\n\"\"\"")

    for w in TARGET_WORDS:
        found = w in suite_text.lower()
        print(f"    - Word '{w}': {'[FOUND]' if found else '[MISSING]'}")
        assert found, f"Target word '{w}' should be in extracted text"

    print("\n================================================================")
    print("      ALL 'r' RECOGNITION VALIDATION TESTS PASSED 100%!         ")
    print("================================================================\n")

if __name__ == "__main__":
    test_r_recognition_on_live_server()
