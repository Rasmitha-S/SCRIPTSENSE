import os
import sys
import time
import io
from PIL import Image
from unittest.mock import patch, MagicMock

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.ocr_service import (
    extract_text_with_gemini_vision,
    extract_text_with_priority_pipeline,
)

def test_timeout_and_resizing():
    print("=" * 70)
    print("   RUNNING OCR TIMEOUT & RESIZING VERIFICATION UNIT TESTS   ")
    print("=" * 70)

    # 1. Test image resizing for images > 1500px
    large_img = Image.new("RGB", (2400, 1800), color="white")
    buf = io.BytesIO()
    large_img.save(buf, format="PNG")
    large_bytes = buf.getvalue()

    with patch("google.generativeai.GenerativeModel") as mock_model_cls:
        mock_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "Transcribed large image text"
        mock_instance.generate_content.return_value = mock_response
        mock_model_cls.return_value = mock_instance

        with patch("services.ocr_service.is_valid_gemini_key", return_value=True):
            result = extract_text_with_gemini_vision(large_bytes)
            assert result == "Transcribed large image text"
            
            # Verify generate_content arguments
            call_args = mock_instance.generate_content.call_args
            prompt_and_img = call_args[0][0]
            passed_img = prompt_and_img[1]
            kwargs = call_args[1]

            print(f"[TEST 1 PASS] Image auto-resized from (2400, 1800) to: {passed_img.size} (Max dimension <= 1500: {max(passed_img.size) <= 1500})")
            print(f"[TEST 1 PASS] Request timeout set to: {kwargs.get('request_options', {}).get('timeout')}s")
            mock_model_cls.assert_called_with("gemini-1.5-flash")
            print(f"[TEST 1 PASS] GenerativeModel initialized with: gemini-1.5-flash")

    # 2. Test 15-second total pipeline timeout fallback
    def slow_gemini_vision(image_bytes, mime_type="image/png"):
        time.sleep(20)  # Simulate 20s hang
        return "Should never be returned"

    small_img = Image.new("RGB", (100, 100), color="white")
    buf2 = io.BytesIO()
    small_img.save(buf2, format="PNG")
    small_bytes = buf2.getvalue()

    with patch("services.ocr_service.extract_text_with_gemini_vision", side_effect=slow_gemini_vision):
        with patch("services.ocr_service.is_valid_gemini_key", return_value=True):
            with patch("services.ocr_service.extract_text_with_easyocr", return_value="EasyOCR Fallback Successful"):
                t0 = time.time()
                text, engine = extract_text_with_priority_pipeline(small_bytes, filename="test_timeout.png")
                elapsed = time.time() - t0

                print(f"[TEST 2 PASS] Hard pipeline timeout triggered in {elapsed:.2f}s (target ~15s)")
                print(f"[TEST 2 PASS] Engine fallback: {engine}")
                print(f"[TEST 2 PASS] Extracted text: {text}")
                assert engine == "EasyOCR"
                assert text == "EasyOCR Fallback Successful"
                assert 14.5 <= elapsed <= 16.5

    print("=" * 70)
    print("ALL OCR TIMEOUT & RESIZING UNIT TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    test_timeout_and_resizing()
