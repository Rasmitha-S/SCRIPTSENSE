import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from starlette.datastructures import UploadFile as StarletteUploadFile
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from routers.auth import get_current_user
from services.evaluation_service import evaluate_answers, evaluate_multi_question_exam
from services.file_service import validate_and_save_file
from services.ocr_service import extract_text_from_file

router = APIRouter(prefix="/api", tags=["Evaluation"])

@router.post("/model-answer", response_model=schemas.ModelAnswerResponse)
@router.post("/model-answers", response_model=schemas.ModelAnswerResponse)
async def create_model_answer(
    request_obj: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Saves question(s), reference model answer text, rubrics, and max marks to SQLite.
    Supports:
      1. application/json: manually typed single or multi-question exam papers.
      2. multipart/form-data: PDF or image upload with automatic OCR text extraction.
    Priority rule: Manually typed text takes precedence if provided; otherwise OCR-extracted text is used.
    """
    content_type = request_obj.headers.get("content-type", "")
    
    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request_obj.form()
        raw_file = form.get("file")
        extracted_ocr_text = ""

        if (isinstance(raw_file, (UploadFile, StarletteUploadFile)) or hasattr(raw_file, "filename")) and getattr(raw_file, "filename", None):
            import time
            unique_prefix = f"model_{int(time.time()*1000)}"
            relative_path, abs_path = validate_and_save_file(raw_file, prefix_id=unique_prefix)
            extracted_ocr_text = extract_text_from_file(abs_path)
            file_name = getattr(raw_file, "filename", "unknown")
            print(f"\n{'='*60}\n[OCR EXTRACTED MODEL ANSWER from '{file_name}']:\n{extracted_ocr_text}\n{'='*60}\n")

        question = form.get("question")
        typed_answer = form.get("answer_text")
        raw_max_marks = form.get("max_marks", "10.0")
        try:
            max_marks_val = float(str(raw_max_marks)) if raw_max_marks is not None else 10.0
        except (ValueError, TypeError):
            max_marks_val = 10.0

        title = form.get("title")
        subject = form.get("subject", "General")

        # Priority Rule: Typed text takes priority if present, otherwise OCR text from PDF
        if typed_answer and str(typed_answer).strip():
            final_answer = str(typed_answer).strip()
        else:
            final_answer = extracted_ocr_text.strip() if extracted_ocr_text else ""

        raw_questions = form.get("questions") or form.get("questions_json")
        questions_json_str = None
        questions_data: list = []
        if raw_questions:
            try:
                parsed_q = json.loads(str(raw_questions)) if isinstance(raw_questions, (str, bytes, bytearray)) else raw_questions
                if isinstance(parsed_q, list):
                    questions_data = parsed_q
                questions_json_str = json.dumps(questions_data) if questions_data else None
            except Exception:
                questions_json_str = None

        raw_rubric = form.get("rubric") or form.get("rubric_json")
        rubric_json_str = None
        if raw_rubric:
            try:
                parsed_r = json.loads(str(raw_rubric)) if isinstance(raw_rubric, (str, bytes, bytearray)) else raw_rubric
                rubric_json_str = json.dumps(parsed_r) if parsed_r else None
            except Exception:
                rubric_json_str = None

        if questions_data and len(questions_data) > 0:
            total_calculated_marks = sum(float(q.get("max_marks", 5.0)) for q in questions_data if isinstance(q, dict))
            if max_marks_val <= 0 or max_marks_val == 10.0:
                max_marks_val = total_calculated_marks
            primary_title = str(title) if title else f"Exam Paper ({len(questions_data)} Questions)"
            primary_question = f"{primary_title} — " + " | ".join(f"Q{q.get('q_num', i+1)}: {q.get('question','')[:50]}" for i, q in enumerate(questions_data) if isinstance(q, dict))
            if not final_answer:
                primary_answer = "\n\n".join(f"[Q{q.get('q_num', i+1)} Model Solution]:\n{q.get('model_answer','')}" for i, q in enumerate(questions_data) if isinstance(q, dict))
            else:
                primary_answer = final_answer
        else:
            primary_title = str(title) if title else (str(question).strip()[:50] if question else "Standard Question")
            primary_question = str(question).strip() if question else primary_title
            primary_answer = final_answer

        q_count = len(questions_data) if questions_data else 1

    else:
        # JSON payload
        body_json = await request_obj.json()
        req = schemas.ModelAnswerCreate(**body_json)

        questions_json_str = None
        rubric_json_str = None

        if req.questions and len(req.questions) > 0:
            questions_data = [q.model_dump() for q in req.questions]
            questions_json_str = json.dumps(questions_data)

            total_calculated_marks = sum(q.get("max_marks", 5.0) for q in questions_data)
            max_marks_val = req.max_marks if req.max_marks > 0 and req.max_marks != 10.0 else total_calculated_marks

            primary_title = req.title or f"Exam Paper ({len(req.questions)} Questions)"
            primary_question = f"{primary_title} — " + " | ".join(f"Q{q.get('q_num', i+1)}: {q.get('question','')[:50]}" for i, q in enumerate(questions_data))
            primary_answer = "\n\n".join(f"[Q{q.get('q_num', i+1)} Model Solution]:\n{q.get('model_answer','')}" for i, q in enumerate(questions_data))
        else:
            max_marks_val = req.max_marks
            primary_title = req.title or "Standard Question"
            primary_question = req.question.strip() if req.question else primary_title
            primary_answer = req.answer_text.strip() if req.answer_text else ""

        if req.rubric:
            rubric_data = [r.model_dump() for r in req.rubric]
            rubric_json_str = json.dumps(rubric_data)

        subject = req.subject or "General"
        q_count = len(req.questions) if req.questions else 1

    # Save to SQLite model_answers table
    model_answer = models.ModelAnswer(
        title=primary_title,
        subject=subject or "General",
        question=primary_question,
        answer_text=primary_answer,
        max_marks=max_marks_val,
        questions_json=questions_json_str,
        rubric_json=rubric_json_str,
    )
    db.add(model_answer)
    db.commit()
    db.refresh(model_answer)

    return schemas.ModelAnswerResponse(
        model_answer_id=model_answer.id,
        title=model_answer.title,
        subject=model_answer.subject,
        max_marks=model_answer.max_marks,
        questions_count=q_count,
        extracted_text=primary_answer,
    )

@router.get("/model-answers")
def list_model_answers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves all configured model answers from SQLite including multi-question papers.
    """
    answers = db.query(models.ModelAnswer).order_by(models.ModelAnswer.id.desc()).all()
    result_list = []
    for m in answers:
        questions_list = []
        if m.questions_json:
            try:
                questions_list = json.loads(m.questions_json)
            except Exception:
                questions_list = []

        rubric_list = []
        if m.rubric_json:
            try:
                rubric_list = json.loads(m.rubric_json)
            except Exception:
                rubric_list = []

        result_list.append({
            "id": m.id,
            "title": m.title or "Standard Model Answer",
            "subject": m.subject or "General",
            "question": m.question,
            "answer_text": m.answer_text,
            "max_marks": m.max_marks,
            "questions": questions_list,
            "rubric": rubric_list,
            "questions_count": len(questions_list) if questions_list else 1,
        })
    return result_list

@router.put("/model-answer/{id}", response_model=schemas.ModelAnswerResponse)
@router.put("/model-answers/{id}", response_model=schemas.ModelAnswerResponse)
def update_model_answer(
    id: int,
    req: schemas.ModelAnswerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Updates an existing model answer / exam paper and its individual question max marks in SQLite.
    """
    model_answer = db.query(models.ModelAnswer).filter(models.ModelAnswer.id == id).first()
    if not model_answer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model answer with ID {id} not found."
        )

    questions_json_str = None
    rubric_json_str = None
    q_count = 1

    if req.questions and len(req.questions) > 0:
        questions_data = [q.model_dump() for q in req.questions]
        questions_json_str = json.dumps(questions_data)
        total_calculated_marks = sum(float(q.get("max_marks", 5.0)) for q in questions_data)
        max_marks_val = req.max_marks if req.max_marks > 0 and req.max_marks != 10.0 else total_calculated_marks

        primary_title = req.title or f"Exam Paper ({len(req.questions)} Questions)"
        primary_question = f"{primary_title} — " + " | ".join(f"Q{q.get('q_num', i+1)}: {q.get('question','')[:50]}" for i, q in enumerate(questions_data))
        primary_answer = "\n\n".join(f"[Q{q.get('q_num', i+1)} Model Solution]:\n{q.get('model_answer','')}" for i, q in enumerate(questions_data))
        q_count = len(req.questions)
    else:
        max_marks_val = req.max_marks
        primary_title = req.title or "Standard Question"
        primary_question = req.question.strip() if req.question else primary_title
        primary_answer = req.answer_text.strip() if req.answer_text else ""

    if req.rubric:
        rubric_data = [r.model_dump() for r in req.rubric]
        rubric_json_str = json.dumps(rubric_data)

    model_answer.title = primary_title
    model_answer.subject = req.subject or "General"
    model_answer.question = primary_question
    model_answer.answer_text = primary_answer
    model_answer.max_marks = max_marks_val
    model_answer.questions_json = questions_json_str
    model_answer.rubric_json = rubric_json_str

    db.commit()
    db.refresh(model_answer)

    return schemas.ModelAnswerResponse(
        model_answer_id=model_answer.id,
        title=model_answer.title,
        subject=model_answer.subject,
        max_marks=model_answer.max_marks,
        questions_count=q_count,
        extracted_text=primary_answer,
    )

@router.get("/answer-sheets")
def list_answer_sheets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves uploaded answer sheets belonging exclusively to the currently logged-in teacher's students.
    """
    sheets = db.query(models.AnswerSheet).join(models.Student, isouter=True).filter(
        (models.AnswerSheet.teacher_id == current_user.id) | (models.Student.teacher_id == current_user.id)
    ).order_by(models.AnswerSheet.id.desc()).all()
    return [
        {
            "id": s.id,
            "student_id": s.student_id,
            "student_name": s.student.name if s.student else s.student_name,
            "roll_number": s.student.roll_number if s.student else None,
            "file_path": s.file_path,
            "uploaded_at": s.uploaded_at.isoformat() if s.uploaded_at else None,
            "extracted_text": s.extracted_text
        }
        for s in sheets
    ]

@router.post("/evaluate", response_model=schemas.EvaluateResponse)
def evaluate_answer_sheet(
    request: schemas.EvaluateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Executes AI semantic evaluation comparing extracted OCR text against reference model answer and step-wise rubrics.
    Enforces teacher-student ownership check.
    """
    answer_sheet = db.query(models.AnswerSheet).filter(models.AnswerSheet.id == request.answer_sheet_id).first()
    if not answer_sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Answer sheet with ID {request.answer_sheet_id} not found."
        )

    sheet_teacher_id = answer_sheet.teacher_id or (answer_sheet.student.teacher_id if answer_sheet.student else None)
    if sheet_teacher_id is not None and sheet_teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You cannot evaluate another teacher's student's answer sheet."
        )

    model_answer = db.query(models.ModelAnswer).filter(models.ModelAnswer.id == request.model_answer_id).first()
    if not model_answer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model answer with ID {request.model_answer_id} not found."
        )

    student_text = answer_sheet.extracted_text or ""
    rubric_scores = []
    question_evaluations = []

    if model_answer.questions_json:
        try:
            questions_list = json.loads(model_answer.questions_json)
        except Exception:
            questions_list = []
            
        similarity, suggested, explanation, rubric_scores, question_evaluations = evaluate_multi_question_exam(
            student_text=student_text,
            questions_list=questions_list,
            total_max_marks=model_answer.max_marks,
        )
    else:
        rubric_list = None
        if model_answer.rubric_json:
            try:
                rubric_list = json.loads(model_answer.rubric_json)
            except Exception:
                rubric_list = None

        similarity, suggested, explanation, rubric_scores = evaluate_answers(
            student_text=student_text,
            model_text=model_answer.answer_text,
            max_marks=model_answer.max_marks,
            rubric=rubric_list,
        )

    evaluation = models.Evaluation(
        answer_sheet_id=answer_sheet.id,
        model_answer_id=model_answer.id,
        similarity=similarity,
        suggested_marks=suggested,
        explanation=explanation,
        rubric_scores_json=json.dumps(rubric_scores) if rubric_scores else None,
        question_evaluations_json=json.dumps(question_evaluations) if question_evaluations else None,
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)

    student_obj = answer_sheet.student
    student_name_val = student_obj.name if student_obj else answer_sheet.student_name
    roll_number_val = student_obj.roll_number if student_obj else None

    parsed_rubric_scores = [schemas.RubricScoreSchema(**r) for r in rubric_scores] if rubric_scores else None
    parsed_q_evals = [schemas.QuestionEvaluationSchema(**q) for q in question_evaluations] if question_evaluations else None

    return schemas.EvaluateResponse(
        evaluation_id=evaluation.id,
        answer_sheet_id=answer_sheet.id,
        model_answer_id=model_answer.id,
        student_id=answer_sheet.student_id,
        student_name=student_name_val,
        roll_number=roll_number_val,
        title=model_answer.title,
        similarity=evaluation.similarity,
        suggested_marks=evaluation.suggested_marks,
        max_marks=model_answer.max_marks,
        explanation=evaluation.explanation or "",
        rubric_scores=parsed_rubric_scores,
        question_evaluations=parsed_q_evals,
    )

@router.post("/evaluate/batch", response_model=schemas.BatchEvaluateResponse)
def batch_evaluate_answer_sheets(
    request: schemas.BatchEvaluateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Evaluates multiple answer sheets in one batch against a designated model answer / exam paper.
    """
    model_answer = db.query(models.ModelAnswer).filter(models.ModelAnswer.id == request.model_answer_id).first()
    if not model_answer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model answer with ID {request.model_answer_id} not found."
        )

    successful = []
    failed = []

    questions_list = []
    if model_answer.questions_json:
        try:
            questions_list = json.loads(model_answer.questions_json)
        except Exception:
            questions_list = []

    rubric_list = None
    if model_answer.rubric_json:
        try:
            rubric_list = json.loads(model_answer.rubric_json)
        except Exception:
            rubric_list = None

    for sheet_id in request.answer_sheet_ids:
        answer_sheet = db.query(models.AnswerSheet).filter(models.AnswerSheet.id == sheet_id).first()
        if not answer_sheet:
            failed.append(sheet_id)
            continue

        sheet_teacher_id = answer_sheet.teacher_id or (answer_sheet.student.teacher_id if answer_sheet.student else None)
        if sheet_teacher_id is not None and sheet_teacher_id != current_user.id:
            failed.append(sheet_id)
            continue

        student_text = answer_sheet.extracted_text or ""
        rubric_scores = []
        question_evaluations = []

        try:
            if questions_list:
                similarity, suggested, explanation, rubric_scores, question_evaluations = evaluate_multi_question_exam(
                    student_text=student_text,
                    questions_list=questions_list,
                    total_max_marks=model_answer.max_marks,
                )
            else:
                similarity, suggested, explanation, rubric_scores = evaluate_answers(
                    student_text=student_text,
                    model_text=model_answer.answer_text,
                    max_marks=model_answer.max_marks,
                    rubric=rubric_list,
                )

            evaluation = models.Evaluation(
                answer_sheet_id=answer_sheet.id,
                model_answer_id=model_answer.id,
                similarity=similarity,
                suggested_marks=suggested,
                explanation=explanation,
                rubric_scores_json=json.dumps(rubric_scores) if rubric_scores else None,
                question_evaluations_json=json.dumps(question_evaluations) if question_evaluations else None,
            )
            db.add(evaluation)
            db.commit()
            db.refresh(evaluation)

            student_obj = answer_sheet.student
            student_name_val = student_obj.name if student_obj else answer_sheet.student_name
            roll_number_val = student_obj.roll_number if student_obj else None

            parsed_rubric_scores = [schemas.RubricScoreSchema(**r) for r in rubric_scores] if rubric_scores else None
            parsed_q_evals = [schemas.QuestionEvaluationSchema(**q) for q in question_evaluations] if question_evaluations else None

            successful.append(
                schemas.EvaluateResponse(
                    evaluation_id=evaluation.id,
                    answer_sheet_id=answer_sheet.id,
                    model_answer_id=model_answer.id,
                    student_id=answer_sheet.student_id,
                    student_name=student_name_val,
                    roll_number=roll_number_val,
                    title=model_answer.title,
                    similarity=evaluation.similarity,
                    suggested_marks=evaluation.suggested_marks,
                    max_marks=model_answer.max_marks,
                    explanation=evaluation.explanation or "",
                    rubric_scores=parsed_rubric_scores,
                    question_evaluations=parsed_q_evals,
                )
            )
        except Exception:
            failed.append(sheet_id)

    return schemas.BatchEvaluateResponse(
        processed_count=len(successful),
        successful_evaluations=successful,
        failed_ids=failed,
    )
