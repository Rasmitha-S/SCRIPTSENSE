import json
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from routers.auth import get_current_user

router = APIRouter(prefix="/api/students", tags=["Students"])


@router.post("", response_model=schemas.StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(
    request: schemas.StudentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Creates a new student record belonging to the currently logged-in teacher.
    """
    if not request.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student name cannot be empty."
        )

    # Check if roll number already exists for this specific teacher
    if request.roll_number and request.roll_number.strip():
        existing = db.query(models.Student).filter(
            models.Student.teacher_id == current_user.id,
            models.Student.roll_number == request.roll_number.strip()
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A student with roll number '{request.roll_number.strip()}' already exists in your class list."
            )

    student: Any = models.Student(
        teacher_id=current_user.id,
        name=request.name.strip(),
        roll_number=request.roll_number.strip() if request.roll_number else None,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    return student


@router.get("", response_model=List[schemas.StudentResponse])
def list_students(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves students belonging exclusively to the currently logged-in teacher.
    """
    students = db.query(models.Student).filter(
        models.Student.teacher_id == current_user.id
    ).order_by(models.Student.id.desc()).all()
    return students


@router.get("/overview", response_model=List[schemas.StudentOverviewResponse])
def get_students_overview(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves students belonging exclusively to the currently logged-in teacher with their upload status,
    latest scores, and evaluation IDs for dashboard display.
    """
    students: List[Any] = db.query(models.Student).filter(
        models.Student.teacher_id == current_user.id
    ).order_by(models.Student.id.desc()).all()
    overview_list: List[schemas.StudentOverviewResponse] = []

    for student in students:
        sheets: List[Any] = db.query(models.AnswerSheet).filter(
            models.AnswerSheet.student_id == student.id
        ).order_by(models.AnswerSheet.id.desc()).all()

        upload_count = len(sheets)
        latest_answer_sheet_id = sheets[0].id if sheets else None
        latest_evaluation_id = None
        status_val = "Pending Upload"
        question_val = None
        similarity_val = None
        suggested_marks_val = None
        final_marks_val = None
        max_marks_val = 10.0
        verified_by_val = None
        verified_at_val = None

        if sheets:
            sheet_ids = [s.id for s in sheets]
            evaluations: List[Any] = db.query(models.Evaluation).filter(
                models.Evaluation.answer_sheet_id.in_(sheet_ids)
            ).order_by(models.Evaluation.id.desc()).all()

            if evaluations:
                latest_eval: Any = evaluations[0]
                latest_evaluation_id = latest_eval.id
                similarity_val = latest_eval.similarity
                suggested_marks_val = latest_eval.suggested_marks
                
                if latest_eval.model_answer:
                    question_val = latest_eval.model_answer.question
                    max_marks_val = latest_eval.model_answer.max_marks

                final_res: Any = latest_eval.final_result
                if final_res and final_res.final_marks is not None:
                    status_val = "Verified"
                    final_marks_val = final_res.final_marks
                    verified_by_val = final_res.verified_by
                    verified_at_val = final_res.verified_at
                else:
                    status_val = "Evaluated"
            else:
                status_val = "Uploaded"

        overview_list.append(
            schemas.StudentOverviewResponse(
                id=student.id,
                teacher_id=student.teacher_id,
                name=student.name,
                roll_number=student.roll_number,
                upload_count=upload_count,
                latest_answer_sheet_id=latest_answer_sheet_id,
                latest_evaluation_id=latest_evaluation_id,
                status=status_val,
                question=question_val,
                similarity=similarity_val,
                suggested_marks=suggested_marks_val,
                final_marks=final_marks_val,
                max_marks=max_marks_val,
                verified_by=verified_by_val,
                verified_at=verified_at_val,
            )
        )

    return overview_list


@router.get("/{id}/results", response_model=schemas.StudentPortalResponse)
def get_student_results_history(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves full evaluation and verified marks history for a specific student ID.
    Enforces teacher-student ownership check.
    """
    student: Any = db.query(models.Student).filter(models.Student.id == id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {id} not found."
        )

    if student.teacher_id is not None and student.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view results for this student."
        )

    sheets: List[Any] = db.query(models.AnswerSheet).filter(
        models.AnswerSheet.student_id == student.id
    ).order_by(models.AnswerSheet.id.desc()).all()

    results_cards: List[schemas.StudentResultCard] = []
    total_final_marks = 0.0
    total_max_marks = 0.0
    verified_count = 0

    for sheet in sheets:
        evals: List[Any] = db.query(models.Evaluation).filter(
            models.Evaluation.answer_sheet_id == sheet.id
        ).order_by(models.Evaluation.id.desc()).all()

        if evals:
            for evaluation in evals:
                evaluation_any: Any = evaluation
                model_answer: Any = evaluation_any.model_answer
                final_res: Any = evaluation_any.final_result
                max_marks = model_answer.max_marks if model_answer else 10.0
                
                status_val = "Evaluated"
                final_marks_val = None
                teacher_feedback_val = None
                verified_by_val = None
                verified_at_val = None

                if final_res and final_res.final_marks is not None:
                    status_val = "Verified"
                    final_marks_val = final_res.final_marks
                    teacher_feedback_val = final_res.teacher_feedback
                    verified_by_val = final_res.verified_by
                    verified_at_val = final_res.verified_at
                    
                    total_final_marks += final_marks_val
                    total_max_marks += max_marks
                    verified_count += 1

                rubric_scores = None
                if evaluation_any.rubric_scores_json:
                    try:
                        rubric_scores = [schemas.RubricScoreSchema(**r) for r in json.loads(evaluation_any.rubric_scores_json)]
                    except Exception:
                        rubric_scores = None

                q_evals = None
                if evaluation_any.question_evaluations_json:
                    try:
                        q_evals = [schemas.QuestionEvaluationSchema(**q) for q in json.loads(evaluation_any.question_evaluations_json)]
                    except Exception:
                        q_evals = None

                q_results = None
                if final_res and final_res.question_results_json:
                    try:
                        q_results = [schemas.QuestionResultSchema(**qr) for qr in json.loads(final_res.question_results_json)]
                    except Exception:
                        q_results = None

                results_cards.append(
                    schemas.StudentResultCard(
                        evaluation_id=evaluation_any.id,
                        answer_sheet_id=sheet.id,
                        student_id=student.id,
                        student_name=student.name,
                        roll_number=student.roll_number,
                        title=model_answer.title if model_answer else None,
                        subject=model_answer.subject if model_answer else None,
                        question=model_answer.question if model_answer else None,
                        model_answer=model_answer.answer_text if model_answer else None,
                        extracted_text=sheet.extracted_text,
                        file_path=sheet.file_path,
                        max_marks=max_marks,
                        similarity=evaluation_any.similarity,
                        suggested_marks=evaluation_any.suggested_marks,
                        explanation=evaluation_any.explanation,
                        final_marks=final_marks_val,
                        teacher_feedback=teacher_feedback_val,
                        verified_by=verified_by_val,
                        verified_at=verified_at_val,
                        status=status_val,
                        uploaded_at=sheet.uploaded_at,
                        rubric_scores=rubric_scores,
                        question_evaluations=q_evals,
                        question_results=q_results,
                    )
                )
        else:
            results_cards.append(
                schemas.StudentResultCard(
                    evaluation_id=0,
                    answer_sheet_id=sheet.id,
                    student_id=student.id,
                    student_name=student.name,
                    roll_number=student.roll_number,
                    question="Pending Evaluation",
                    model_answer=None,
                    extracted_text=sheet.extracted_text,
                    file_path=sheet.file_path,
                    max_marks=10.0,
                    similarity=0.0,
                    suggested_marks=0.0,
                    explanation="Your answer sheet has been received and is awaiting teacher evaluation.",
                    final_marks=None,
                    teacher_feedback=None,
                    verified_by=None,
                    verified_at=None,
                    status="Uploaded",
                    uploaded_at=sheet.uploaded_at
                )
            )

    avg_score = round(total_final_marks / verified_count, 2) if verified_count > 0 else None
    avg_pct = round((total_final_marks / total_max_marks) * 100, 1) if (verified_count > 0 and total_max_marks > 0) else None

    return schemas.StudentPortalResponse(
        student_id=student.id,
        student_name=student.name,
        roll_number=student.roll_number,
        total_exams=len(results_cards),
        verified_exams=verified_count,
        average_score=avg_score,
        average_percentage=avg_pct,
        results=results_cards
    )


@router.get("/{id}", response_model=schemas.StudentResponse)
def get_student(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves student details by ID. Checks teacher ownership.
    """
    student: Any = db.query(models.Student).filter(models.Student.id == id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {id} not found."
        )

    if student.teacher_id is not None and student.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view this student."
        )

    return student


@router.put("/{id}", response_model=schemas.StudentResponse)
def update_student(
    id: int,
    request: schemas.StudentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Updates student name and roll number. Checks teacher ownership and scoped uniqueness.
    """
    student: Any = db.query(models.Student).filter(models.Student.id == id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {id} not found."
        )

    if student.teacher_id is not None and student.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to edit this student."
        )

    if request.roll_number and request.roll_number.strip():
        existing = db.query(models.Student).filter(
            models.Student.teacher_id == current_user.id,
            models.Student.roll_number == request.roll_number.strip(),
            models.Student.id != id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A student with roll number '{request.roll_number.strip()}' already exists in your class list."
            )

    student.name = request.name.strip()
    student.roll_number = request.roll_number.strip() if request.roll_number else None
    db.commit()
    db.refresh(student)

    return student


@router.delete("/{id}", response_model=schemas.MessageResponse)
def delete_student(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Deletes a student record and cleans up associated answer sheets and evaluations. Checks teacher ownership.
    """
    student: Any = db.query(models.Student).filter(models.Student.id == id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {id} not found."
        )

    if student.teacher_id is not None and student.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to delete this student."
        )

    student_name = student.name

    # Find and delete all answer sheets and their evaluations/final results
    sheets: List[Any] = db.query(models.AnswerSheet).filter(models.AnswerSheet.student_id == id).all()
    for sheet in sheets:
        evals: List[Any] = db.query(models.Evaluation).filter(models.Evaluation.answer_sheet_id == sheet.id).all()
        for eval_rec in evals:
            final_res: Any = db.query(models.FinalResult).filter(models.FinalResult.evaluation_id == eval_rec.id).first()
            if final_res:
                db.delete(final_res)
            db.delete(eval_rec)
        db.delete(sheet)

    db.delete(student)
    db.commit()

    return schemas.MessageResponse(
        message=f"Student '{student_name}' (ID: {id}) and associated records deleted successfully.",
        success=True
    )