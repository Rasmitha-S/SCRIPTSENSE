import os
import sys

# Dynamically resolve paths relative to script location
current_dir = os.path.dirname(os.path.abspath(__file__))
cred_path = os.path.join(current_dir, 'google-credentials.json')

if not os.path.exists(cred_path):
    cred_path = 'google-credentials.json'

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = cred_path

def run_vision_test():
    print("=" * 60)
    print(f"[1] Credentials Path: {os.path.abspath(cred_path)}")
    print(f"[1] Credentials Exist: {os.path.exists(cred_path)}")
    print("=" * 60)

    try:
        from google.cloud import vision
        client = vision.ImageAnnotatorClient()
        print("[2] CONFIRMATION: Vision ImageAnnotatorClient initialized successfully.")
    except Exception as e:
        print(f"[2] ERROR: Failed to initialize Vision client / load google-credentials.json: {e}")
        return

    sample_images = [
        os.path.join(current_dir, 'uploads', '31_alex_rivera_physics_answer.png'),
        os.path.join(current_dir, 'uploads', '100_31_alex_rivera_physics_answer.png'),
        os.path.join(current_dir, 'uploads', '105_Screenshot_2026-08-19_135204.png'),
        os.path.join(current_dir, 'uploads', '7_test_sheet.png'),
        'uploads/31_alex_rivera_physics_answer.png',
    ]

    target_image = None
    for path in sample_images:
        if os.path.exists(path):
            target_image = path
            break

    if not target_image:
        print("[3] ERROR: No sample image found in uploads folder!")
        return

    print(f"[3] Using Sample Image: {target_image}")
    print("=" * 60)

    try:
        with open(target_image, 'rb') as f:
            content = f.read()

        image = vision.Image(content=content)
        print("[4] Sending document_text_detection request to Google Cloud Vision API...")
        response = client.document_text_detection(image=image)  # type: ignore

        print("=" * 60)
        if response.error.message:
            print('ERROR:', response.error.message)
        else:
            print('ERROR: None')

        text = response.full_text_annotation.text if response.full_text_annotation else ''
        print('TEXT:', text)
        print("=" * 60)

    except Exception as e:
        print("=" * 60)
        print('ERROR:', f"Exception from Vision API call: {type(e).__name__} - {e}")
        print("=" * 60)

if __name__ == '__main__':
    run_vision_test()
