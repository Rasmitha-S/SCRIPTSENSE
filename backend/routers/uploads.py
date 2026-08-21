import os
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from routers.auth import get_current_user
from services.file_service import validate_and_save_file
from services.ocr_service import extract_text_from_file

router = APIRouter(prefix="/api", tags=["Uploads"])

@router.post("/upload", response_model=schemas.UploadResponse)
async def upload_answer_sheet(
    file: UploadFile = File(...),
    student_id: Optional[int] = Form(None),
    student_name: Optional[str] = Form(None),
    roll_number: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Uploads a student handwritten answer sheet (PDF, JPG, JPEG, PNG),
    stores the file in uploads/, extracts text via OCR, and records it in SQLite linked to a Student (Section 6 & 9.3).
    """
    # Resolve or create Student record with strict teacher isolation
    student = None
    if student_id:
        student = db.query(models.Student).filter(models.Student.id == student_id).first()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student with ID {student_id} not found."
            )
        if student.teacher_id is not None and student.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot upload answer sheets for another teacher's student."
            )

    if not student and student_name and student_name.strip():
        name_clean = student_name.strip()
        roll_clean = roll_number.strip() if roll_number and roll_number.strip() else None

        if roll_clean:
            student = db.query(models.Student).filter(
                models.Student.teacher_id == current_user.id,
                models.Student.roll_number == roll_clean
            ).first()

        if not student:
            # Check by exact name within this teacher's students or create new
            student = db.query(models.Student).filter(
                models.Student.teacher_id == current_user.id,
                models.Student.name == name_clean,
                models.Student.roll_number == roll_clean
            ).first()

        if not student:
            student = models.Student(
                teacher_id=current_user.id,
                name=name_clean,
                roll_number=roll_clean
            )
            db.add(student)
            db.commit()
            db.refresh(student)

    # Fallback to default student if none provided to guarantee strict student_id linking
    if not student:
        default_name = student_name.strip() if (student_name and student_name.strip()) else "Anonymous Student"
        student = db.query(models.Student).filter(
            models.Student.teacher_id == current_user.id,
            models.Student.name == default_name,
            models.Student.roll_number == None
        ).first()
        if not student:
            student = models.Student(
                teacher_id=current_user.id,
                name=default_name,
                roll_number=None
            )
            db.add(student)
            db.commit()
            db.refresh(student)

    uploader = current_user.full_name or current_user.username

    # 1. Create preliminary database record to get unique answer_sheet_id
    answer_sheet = models.AnswerSheet(
        student_id=student.id,
        teacher_id=current_user.id,
        student_name=student.name,
        file_path="pending",
        extracted_text="Processing OCR...",
        uploaded_by=uploader,
    )
    db.add(answer_sheet)
    db.commit()
    db.refresh(answer_sheet)

    # 2. Validate and save file with ID prefix
    try:
        relative_path, abs_path = validate_and_save_file(file, prefix_id=str(answer_sheet.id))
    except HTTPException:
        db.delete(answer_sheet)
        db.commit()
        raise
    except Exception as e:
        db.delete(answer_sheet)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )

    # 3. Run synchronous OCR text extraction
    extracted_text = extract_text_from_file(abs_path)
    print(f"\n{'='*60}\n[OCR EXTRACTED TEXT from '{file.filename}']:\n{extracted_text}\n{'='*60}\n")

    # 4. Update database record with final file path and extracted OCR text
    answer_sheet.file_path = relative_path
    answer_sheet.extracted_text = extracted_text
    db.commit()
    db.refresh(answer_sheet)

    return schemas.UploadResponse(
        answer_sheet_id=answer_sheet.id,
        student_id=student.id if student else None,
        student_name=student.name if student else answer_sheet.student_name,
        roll_number=student.roll_number if student else None,
        file_path=answer_sheet.file_path,
        filename=file.filename or os.path.basename(abs_path),
        extracted_text=answer_sheet.extracted_text,
        uploaded_by=answer_sheet.uploaded_by,
        status="processed",
    )


@router.put("/uploads/{id}/transcript", response_model=schemas.UploadResponse)
def update_answer_sheet_transcript(
    id: int,
    request: schemas.TranscriptUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Allows a teacher to edit/refine OCR transcribed text before running evaluation.
    Enforces teacher-student ownership check.
    """
    answer_sheet = db.query(models.AnswerSheet).filter(models.AnswerSheet.id == id).first()
    if not answer_sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Answer sheet with ID {id} not found."
        )

    # Verify ownership either directly via answer_sheet.teacher_id or student.teacher_id
    sheet_teacher_id = answer_sheet.teacher_id or (answer_sheet.student.teacher_id if answer_sheet.student else None)
    if sheet_teacher_id is not None and sheet_teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to edit transcripts for another teacher's student."
        )

    answer_sheet.extracted_text = request.extracted_text.strip()
    db.commit()
    db.refresh(answer_sheet)

    student_obj = answer_sheet.student
    student_name_val = student_obj.name if student_obj else answer_sheet.student_name
    roll_number_val = student_obj.roll_number if student_obj else None

    return schemas.UploadResponse(
        answer_sheet_id=answer_sheet.id,
        student_id=answer_sheet.student_id,
        student_name=student_name_val,
        roll_number=roll_number_val,
        file_path=answer_sheet.file_path,
        extracted_text=answer_sheet.extracted_text or "",
        uploaded_by=answer_sheet.uploaded_by,
    )
