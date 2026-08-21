import os
import sys
import unittest
from unittest.mock import patch, MagicMock

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import services.ocr_service as ocr_service
from services.ocr_service import extract_text_with_vision_api, extract_text_from_file

class TestGoogleVisionSDKOCR(unittest.TestCase):

    def setUp(self):
        # Reset cached client before each test
        ocr_service._vision_client = None

    @patch("services.ocr_service.get_vision_client")
    def test_vision_document_text_detection(self, mock_get_client):
        # Mock ImageAnnotatorClient and response
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.error.message = ""
        mock_response.full_text_annotation.text = "Newton's second law: F = m * a\nForce equals mass times acceleration."
        mock_client.document_text_detection.return_value = mock_response
        mock_get_client.return_value = mock_client

        test_bytes = b"sample_image_bytes"
        result = extract_text_with_vision_api(test_bytes)

        self.assertTrue(mock_client.document_text_detection.called)
        self.assertEqual(result, "Newton's second law: F = m * a\nForce equals mass times acceleration.")

    @patch("services.ocr_service.get_vision_client")
    def test_extract_text_from_file_mock(self, mock_get_client):
        sample_text = (
            "Newton's Second Law of Motion\n"
            "Force is equal to mass multiplied by acceleration (F = m * a).\n"
            "Unit of Force: Newton (N)"
        )
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.error.message = ""
        mock_response.full_text_annotation.text = sample_text
        mock_client.document_text_detection.return_value = mock_response
        mock_get_client.return_value = mock_client

        sample_img_path = os.path.join(backend_dir, "uploads", "100_31_alex_rivera_physics_answer.png")
        if not os.path.exists(sample_img_path):
            sample_img_path = os.path.join(backend_dir, "uploads", "7_test_sheet.png")

        extracted = extract_text_from_file(sample_img_path)
        self.assertEqual(extracted, sample_text)
        print(f"\n[Test Passed] Extracted text from sample image:\n{extracted}\n")

if __name__ == "__main__":
    unittest.main()
