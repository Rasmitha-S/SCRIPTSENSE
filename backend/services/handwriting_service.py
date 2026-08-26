import os
import io
import re
import logging
from typing import List, Tuple, Optional, Union
import numpy as np
from PIL import Image
from pdf2image import convert_from_path
from dotenv import load_dotenv

from services.image_preprocessing import preprocess_image_for_cnn
from services.handwriting_segmentation import detect_and_extract_text_lines, BoundingBox
from models.handwriting_cnn_lstm.inference import load_crnn_model, recognize_line_image

load_dotenv()

logger = logging.getLogger("scriptsense.handwriting")

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Configure Poppler path for PDF conversion if available
poppler_env_path = os.getenv("POPPLER_PATH")
poppler_path = None
if poppler_env_path and os.path.exists(poppler_env_path):
    poppler_path = poppler_env_path
else:
    common_poppler_paths = [
        os.path.join(base_dir, "bin", "poppler"),
        os.path.join(base_dir, "bin", "poppler_extracted", "poppler-24.08.0", "Library", "bin"),
        r"C:\Program Files\poppler\bin",
        r"C:\Program Files (x86)\poppler\bin",
        r"C:\poppler\bin",
    ]
    for path in common_poppler_paths:
        if os.path.exists(path):
            poppler_path = path
            break


def clean_extracted_text(raw_text: str) -> str:
    """
    Cleans extracted text by normalizing whitespace, stripping excess blank lines,
    and returning formatted text.
    """
    if not raw_text:
        return "No text could be extracted from the document."

    cleaned_lines = []
    for raw_line in raw_text.splitlines():
        line = re.sub(r'[ \t]+', ' ', raw_line).strip()
        if line:
            cleaned_lines.append(line)

    result = "\n".join(cleaned_lines)
    return result if result else "No text could be extracted from the document."


def extract_text_from_image_crnn(img: Union[Image.Image, np.ndarray, bytes]) -> str:
    """
    Executes the CNN + BiLSTM + CTC text recognition pipeline on a single image page:
    1. Preprocess image (Grayscale, Bilateral Filter, CLAHE, Otsu Binarization).
    2. Detect and extract text line crops.
    3. Load trained CNN + BiLSTM model.
    4. Run CRNN inference & CTC sequence decoding on each text line.
    5. Reconstruct recognized text lines in natural reading order.
    """
    # 1. Image Preprocessing
    enhanced_gray, binary_img = preprocess_image_for_cnn(img)

    # 2. Text Line Detection & Extraction
    detected_lines = detect_and_extract_text_lines(binary_img)
    if not detected_lines:
        logger.info("Line detection found no text lines in image.")
        return ""

    # 3. Load Trained CNN + BiLSTM Model
    model = load_crnn_model()

    # 4 & 5. Run CRNN inference & CTC decoding line by line
    reconstructed_lines: List[str] = []
    for box, line_patch in detected_lines:
        line_text = recognize_line_image(model, line_patch)
        if line_text.strip():
            reconstructed_lines.append(line_text.strip())

    page_text = "\n".join(reconstructed_lines)
    return page_text


def extract_handwritten_text_cnn(file_path_or_bytes: Union[str, bytes]) -> str:
    """
    Complete handwriting text extraction service supporting PDF and image formats:
    - PDF: Converts each page to an image and runs CNN+BiLSTM recognition sequentially.
    - Images (JPG, JPEG, PNG, WEBP): Runs CNN+BiLSTM handwriting recognition pipeline.
    - Cleans and reconstructs the full answer text in reading order.
    """
    extracted_text = ""

    try:
        if isinstance(file_path_or_bytes, str):
            if not os.path.exists(file_path_or_bytes):
                err = f"[CRNN OCR ERROR] File not found: {file_path_or_bytes}"
                logger.error(err)
                return "No text could be extracted from the document."

            _, ext = os.path.splitext(file_path_or_bytes)
            ext = ext.lower()

            if ext == ".pdf":
                if poppler_path:
                    pages = convert_from_path(file_path_or_bytes, dpi=200, poppler_path=poppler_path)
                else:
                    pages = convert_from_path(file_path_or_bytes, dpi=200)

                page_texts = []
                for page_img in pages:
                    txt = extract_text_from_image_crnn(page_img)
                    if txt.strip():
                        page_texts.append(txt.strip())

                extracted_text = "\n\n".join(page_texts)

            elif ext in [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"]:
                with Image.open(file_path_or_bytes) as img:
                    extracted_text = extract_text_from_image_crnn(img)
            else:
                logger.warning(f"Unsupported file extension: {ext}")
                return "No text could be extracted from the document."

        elif isinstance(file_path_or_bytes, bytes):
            with Image.open(io.BytesIO(file_path_or_bytes)) as img:
                extracted_text = extract_text_from_image_crnn(img)

    except Exception as e:
        err = f"[CRNN OCR ERROR] Extraction exception: {type(e).__name__}: {str(e)}"
        print(err)
        logger.error(err)
        extracted_text = ""

    cleaned = clean_extracted_text(extracted_text)
    return cleaned


from models.handwriting_cnn.model import HandwritingCNN
from services.handwriting_segmentation import segment_lines_and_characters

def get_cnn_engine():
    """Returns initialized CRNN / CNN handwriting recognition engine."""
    from models.handwriting_cnn_lstm.inference import load_crnn_model
    return load_crnn_model()
