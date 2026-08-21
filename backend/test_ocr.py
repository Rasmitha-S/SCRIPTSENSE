import os
import sys
from dotenv import load_dotenv

# Ensure backend directory is in path
base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

load_dotenv()

from services.ocr_service import extract_text_from_file

# Test on real sample image from uploads folder
img_path = os.path.join(base_dir, 'uploads', '105_Screenshot_2026-08-19_135204.png')
if not os.path.exists(img_path):
    img_path = os.path.join(base_dir, 'uploads', '7_test_sheet.png')

print("=" * 60)
print(f"Testing Google Cloud Vision API OCR on: {img_path}")
print("=" * 60)

service_extracted = extract_text_from_file(img_path)
print(f"\n[Extracted Text Output]:\n{service_extracted}")
print("=" * 60)

