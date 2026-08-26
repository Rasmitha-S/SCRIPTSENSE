import csv
import io
import json
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from routers.auth import get_current_user

router = APIRouter(prefix="/api/results", tags=["Results"])

def parse_json_safely(json_str):
    if not json_str:
        return None
    try:
        return json.loads(json_str)
    except Exception:
        return None

@router.get("", response_model=List[schemas.ResultResponse])
def list_all_results(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves evaluation results belonging exclusively to the currently logged-in teacher's students.
    """
    evaluations = db.query(models.Evaluation).join(models.AnswerSheet).join(models.Student, isouter=True).filter(
        (models.AnswerSheet.teacher_id == current_user.id) | (models.Student.teacher_id == current_user.id)
    ).order_by(models.Evaluation.id.desc()).all()
    results_list = []
    for evaluation in evaluations:
        answer_sheet = evaluation.answer_sheet
        model_answer = evaluation.model_answer
        final_result = evaluation.final_result

        student_obj = answer_sheet.student if answer_sheet else None
        name_val = student_obj.name if student_obj else (answer_sheet.student_name if answer_sheet else None)
        roll_val = student_obj.roll_number if student_obj else None

        rubric_scores = parse_json_safely(evaluation.rubric_scores_json)
        q_evals = parse_json_safely(evaluation.question_evaluations_json)
        rubric_adjs = parse_json_safely(final_result.rubric_adjustments_json) if final_result else None
        q_results = parse_json_safely(final_result.question_results_json) if final_result else None

        results_list.append(
            schemas.ResultResponse(
                evaluation_id=evaluation.id,
                answer_sheet_id=evaluation.answer_sheet_id,
                student_id=answer_sheet.student_id if answer_sheet else None,
                student_name=name_val,
                roll_number=roll_val,
                extracted_text=answer_sheet.extracted_text if answer_sheet else None,
                title=model_answer.title if model_answer else None,
                subject=model_answer.subject if model_answer else None,
                question=model_answer.question if model_answer else None,
                model_answer=model_answer.answer_text if model_answer else None,
                max_marks=model_answer.max_marks if model_answer else 10.0,
                similarity=evaluation.similarity,
                suggested_marks=evaluation.suggested_marks,
                explanation=evaluation.explanation,
                final_marks=final_result.final_marks if final_result else None,
                teacher_feedback=final_result.teacher_feedback if final_result else None,
                verified_by=final_result.verified_by if final_result else None,
                verified_at=final_result.verified_at if final_result else None,
                rubric_scores=[schemas.RubricScoreSchema(**r) for r in rubric_scores] if rubric_scores else None,
                question_evaluations=[schemas.QuestionEvaluationSchema(**q) for q in q_evals] if q_evals else None,
                rubric_adjustments=[schemas.RubricAdjustmentSchema(**a) for a in rubric_adjs] if rubric_adjs else None,
                question_results=[schemas.QuestionResultSchema(**qr) for qr in q_results] if q_results else None,
            )
        )
    return results_list

@router.get("/export/csv")
def export_results_csv(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Generates a downloadable CSV containing evaluation results and grades for the currently logged-in teacher's students.
    """
    evaluations = db.query(models.Evaluation).join(models.AnswerSheet).join(models.Student, isouter=True).filter(
        (models.AnswerSheet.teacher_id == current_user.id) | (models.Student.teacher_id == current_user.id)
    ).order_by(models.Evaluation.id.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)

    # Write Header
    writer.writerow([
        "Evaluation ID",
        "Student ID",
        "Student Name",
        "Roll Number",
        "Exam / Question Title",
        "Subject",
        "Max Marks",
        "AI Semantic Similarity (%)",
        "AI Suggested Marks",
        "Teacher Final Marks",
        "Percentage (%)",
        "Status",
        "Verified By",
        "Verified At",
        "Teacher Feedback"
    ])

    for ev in evaluations:
        sheet = ev.answer_sheet
        model = ev.model_answer
        final = ev.final_result

        student_obj = sheet.student if sheet else None
        st_name = student_obj.name if student_obj else (sheet.student_name if sheet else "N/A")
        st_roll = student_obj.roll_number if student_obj else "N/A"
        st_id = student_obj.id if student_obj else (sheet.student_id if sheet else "N/A")

        title = model.title if model else (model.question[:40] if model else "N/A")
        subject = model.subject if model else "General"
        max_m = model.max_marks if model else 10.0
        sim = f"{round(ev.similarity * 100, 1)}%" if ev.similarity is not None else "0.0%"
        sug_m = ev.suggested_marks
        fin_m = final.final_marks if final and final.final_marks is not None else sug_m
        pct = f"{round((fin_m / max_m) * 100, 1)}%" if (fin_m is not None and max_m > 0) else "N/A"
        status_str = "Verified" if (final and final.final_marks is not None) else "Evaluated"
        ver_by = final.verified_by if final and final.verified_by else "Pending Verification"
        ver_at = final.verified_at.strftime("%Y-%m-%d %H:%M:%S") if (final and final.verified_at) else "N/A"
        feedback = final.teacher_feedback if final and final.teacher_feedback else ""

        writer.writerow([
            ev.id,
            st_id,
            st_name,
            st_roll,
            title,
            subject,
            max_m,
            sim,
            sug_m,
            fin_m,
            pct,
            status_str,
            ver_by,
            ver_at,
            feedback
        ])

    csv_content = output.getvalue()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"scriptsense_results_{timestamp}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@router.get("/{id}", response_model=schemas.ResultResponse)
def get_evaluation_result(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves evaluation details, OCR text, model answer, and teacher verification if saved.
    Enforces teacher-student ownership check.
    """
    evaluation = db.query(models.Evaluation).filter(models.Evaluation.id == id).first()
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation with ID {id} not found."
        )

    answer_sheet = evaluation.answer_sheet
    sheet_teacher_id = answer_sheet.teacher_id or (answer_sheet.student.teacher_id if answer_sheet and answer_sheet.student else None) if answer_sheet else None
    if sheet_teacher_id is not None and sheet_teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view results for this student."
        )

    model_answer = evaluation.model_answer
    final_result = evaluation.final_result
    student_obj = answer_sheet.student if answer_sheet else None
    name_val = student_obj.name if student_obj else (answer_sheet.student_name if answer_sheet else None)
    roll_val = student_obj.roll_number if student_obj else None

    rubric_scores = parse_json_safely(evaluation.rubric_scores_json)
    q_evals = parse_json_safely(evaluation.question_evaluations_json)
    rubric_adjs = parse_json_safely(final_result.rubric_adjustments_json) if final_result else None
    q_results = parse_json_safely(final_result.question_results_json) if final_result else None

    return schemas.ResultResponse(
        evaluation_id=evaluation.id,
        answer_sheet_id=evaluation.answer_sheet_id,
        student_id=answer_sheet.student_id if answer_sheet else None,
        student_name=name_val,
        roll_number=roll_val,
        extracted_text=answer_sheet.extracted_text if answer_sheet else None,
        title=model_answer.title if model_answer else None,
        subject=model_answer.subject if model_answer else None,
        question=model_answer.question if model_answer else None,
        model_answer=model_answer.answer_text if model_answer else None,
        max_marks=model_answer.max_marks if model_answer else 10.0,
        similarity=evaluation.similarity,
        suggested_marks=evaluation.suggested_marks,
        explanation=evaluation.explanation,
        final_marks=final_result.final_marks if final_result else None,
        teacher_feedback=final_result.teacher_feedback if final_result else None,
        verified_by=final_result.verified_by if final_result else None,
        verified_at=final_result.verified_at if final_result else None,
        rubric_scores=[schemas.RubricScoreSchema(**r) for r in rubric_scores] if rubric_scores else None,
        question_evaluations=[schemas.QuestionEvaluationSchema(**q) for q in q_evals] if q_evals else None,
        rubric_adjustments=[schemas.RubricAdjustmentSchema(**a) for a in rubric_adjs] if rubric_adjs else None,
        question_results=[schemas.QuestionResultSchema(**qr) for qr in q_results] if q_results else None,
    )

@router.put("/{id}", response_model=schemas.ResultUpdateResponse)
@router.put("/{id}/verify", response_model=schemas.ResultUpdateResponse)
@router.post("/{id}", response_model=schemas.ResultUpdateResponse)
@router.post("/{id}/verify", response_model=schemas.ResultUpdateResponse)
def save_teacher_verified_result(
    id: int,
    request: schemas.ResultUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Saves teacher-confirmed final marks, feedback, step-wise rubric adjustments, and question scores.
    Enforces teacher-student ownership check.
    """
    evaluation = db.query(models.Evaluation).filter(models.Evaluation.id == id).first()
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation with ID {id} not found."
        )

    answer_sheet = evaluation.answer_sheet
    sheet_teacher_id = answer_sheet.teacher_id or (answer_sheet.student.teacher_id if answer_sheet and answer_sheet.student else None) if answer_sheet else None
    if sheet_teacher_id is not None and sheet_teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to verify results for another teacher's student."
        )

    final_result = db.query(models.FinalResult).filter(models.FinalResult.evaluation_id == id).first()

    now = datetime.now(timezone.utc)
    verifier_name = current_user.full_name or current_user.username

    rubric_adjs_json = json.dumps([a.model_dump() for a in request.rubric_adjustments]) if request.rubric_adjustments else None
    q_results_json = json.dumps([q.model_dump() for q in request.question_results]) if request.question_results else None

    if final_result:
        final_result.final_marks = request.final_marks
        final_result.teacher_feedback = request.teacher_feedback
        final_result.verified_by = verifier_name
        final_result.verified_at = now
        if rubric_adjs_json:
            final_result.rubric_adjustments_json = rubric_adjs_json
        if q_results_json:
            final_result.question_results_json = q_results_json
    else:
        final_result = models.FinalResult(
            evaluation_id=evaluation.id,
            final_marks=request.final_marks,
            teacher_feedback=request.teacher_feedback,
            verified_by=verifier_name,
            verified_at=now,
            rubric_adjustments_json=rubric_adjs_json,
            question_results_json=q_results_json,
        )
        db.add(final_result)

    db.commit()
    db.refresh(final_result)

    answer_sheet = evaluation.answer_sheet
    student_obj = answer_sheet.student if answer_sheet else None
    name_val = student_obj.name if student_obj else (answer_sheet.student_name if answer_sheet else None)
    roll_val = student_obj.roll_number if student_obj else None

    rubric_raw = parse_json_safely(final_result.rubric_adjustments_json)
    parsed_adjs = [schemas.RubricAdjustmentSchema(**a) for a in rubric_raw] if isinstance(rubric_raw, list) else None
    q_res_raw = parse_json_safely(final_result.question_results_json)
    parsed_q_res = [schemas.QuestionResultSchema(**q) for q in q_res_raw] if isinstance(q_res_raw, list) else None

    return schemas.ResultUpdateResponse(
        evaluation_id=evaluation.id,
        student_id=answer_sheet.student_id if answer_sheet else None,
        student_name=name_val,
        roll_number=roll_val,
        final_marks=final_result.final_marks,
        verified_by=final_result.verified_by,
        verified_at=final_result.verified_at,
        rubric_adjustments=parsed_adjs,
        question_results=parsed_q_res,
    )
