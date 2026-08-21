import os
import shutil
from typing import Tuple, Any
from fastapi import HTTPException

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png"
}
UPLOAD_DIRECTORY = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")

# Ensure uploads directory exists
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

def validate_and_save_file(file: Any, prefix_id: str = "") -> Tuple[str, str]:
    """
    Validates uploaded file against allowed formats and stores it securely in uploads/.
    Returns (relative_file_path, absolute_file_path).
    """
    filename = file.filename or "upload.pdf"
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats: PDF, JPG, JPEG, PNG."
        )

    # Sanitize and create distinct filename
    clean_name = os.path.basename(filename).replace(" ", "_")
    if prefix_id:
        target_filename = f"{prefix_id}_{clean_name}"
    else:
        target_filename = f"{int(os.path.getmtime(UPLOAD_DIRECTORY) if os.path.exists(UPLOAD_DIRECTORY) else 1)}_{clean_name}"

    dest_path = os.path.join(UPLOAD_DIRECTORY, target_filename)

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    relative_path = os.path.join("uploads", target_filename).replace("\\", "/")
    return relative_path, dest_path
