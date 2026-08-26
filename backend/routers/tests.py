import os
import json
import time
from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from routers.auth import get_current_user
from services.evaluation_service import evaluate_answers, evaluate_multi_question_exam
from services.file_service import validate_and_save_file
from services.ocr_service import extract_text_from_file

router = APIRouter(prefix="/api/tests", tags=["Tests"])


@router.post("", response_model=schemas.TestResponse, status_code=status.HTTP_201_CREATED)
def create_test(
    request: schemas.TestCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Creates a new Test, configures its reference model answer and rubrics ONCE for the whole test,
    and assigns existing and/or new students to this test.
    Enforces per-teacher data isolation.
    """
    if not request.test_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test name cannot be empty."
        )

    # 1. Process questions / model answer data
    questions_json_str = None
    rubric_json_str = None
    questions_count = 1
    total_max_marks = request.max_marks or 10.0

    if request.questions and len(request.questions) > 0:
        questions_data = [q.model_dump() for q in request.questions]
        questions_json_str = json.dumps(questions_data)
        calc_marks = sum(float(q.get("max_marks", 5.0)) for q in questions_data)
        if total_max_marks <= 0 or total_max_marks == 10.0:
            total_max_marks = calc_marks
        else:
            total_max_marks = calc_marks
        questions_count = len(questions_data)
        primary_question = f"{request.test_name} — " + " | ".join(
            f"Q{q.get('q_num', i+1)}: {q.get('question','')[:50]}" for i, q in enumerate(questions_data)
        )
        primary_answer = "\n\n".join(
            f"[Q{q.get('q_num', i+1)} Model Solution]:\n{q.get('model_answer','')}" for i, q in enumerate(questions_data)
        )
    else:
        primary_question = request.question.strip() if request.question else request.test_name.strip()
        primary_answer = request.answer_text.strip() if request.answer_text else ""
        if request.rubric:
            rubric_json_str = json.dumps([r.model_dump() for r in request.rubric])

    # 2. Create Test instance
    test = models.Test(
        test_name=request.test_name.strip(),
        teacher_id=current_user.id,
        subject=request.subject.strip() if request.subject else "General",
        max_marks=total_max_marks,
    )
    db.add(test)
    db.commit()
    db.refresh(test)

    # 3. Create ModelAnswer linked to this test
    model_answer = models.ModelAnswer(
        test_id=test.id,
        title=test.test_name,
        subject=test.subject,
        question=primary_question,
        answer_text=primary_answer,
        max_marks=total_max_marks,
        questions_json=questions_json_str,
        rubric_json=rubric_json_str,
    )
    db.add(model_answer)
    db.commit()
    db.refresh(model_answer)

    # 4. Assign existing students belonging to this teacher
    assigned_students: List[models.Student] = []
    if request.student_ids:
        for sid in request.student_ids:
            st = db.query(models.Student).filter(
                models.Student.id == sid,
                models.Student.teacher_id == current_user.id
            ).first()
            if st and st not in test.students:
                test.students.append(st)
                assigned_students.append(st)

    # 5. Create and assign new students directly if requested
    if request.new_students:
        for new_st_req in request.new_students:
            if not new_st_req.name.strip():
                continue
            # Check duplicate roll number for this teacher
            st_obj = None
            if new_st_req.roll_number and new_st_req.roll_number.strip():
                st_obj = db.query(models.Student).filter(
                    models.Student.teacher_id == current_user.id,
                    models.Student.roll_number == new_st_req.roll_number.strip()
                ).first()
            if not st_obj:
                st_obj = models.Student(
                    teacher_id=current_user.id,
                    name=new_st_req.name.strip(),
                    roll_number=new_st_req.roll_number.strip() if new_st_req.roll_number else None
                )
                db.add(st_obj)
                db.commit()
                db.refresh(st_obj)
            if st_obj not in test.students:
                test.students.append(st_obj)
                assigned_students.append(st_obj)

    db.commit()
    db.refresh(test)

    # Prepare response questions list
    q_schemas = []
    if questions_json_str:
        try:
            q_schemas = [schemas.QuestionItemSchema(**q) for q in json.loads(questions_json_str)]
        except Exception:
            q_schemas = []

    return schemas.TestResponse(
        id=test.id,
        test_name=test.test_name,
        teacher_id=test.teacher_id,
        subject=test.subject,
        max_marks=test.max_marks,
        created_at=test.created_at,
        questions_count=questions_count,
        students_count=len(test.students),
        model_answer_id=model_answer.id,
        students=[
            schemas.StudentResponse(
                id=s.id,
                teacher_id=s.teacher_id,
                name=s.name,
                roll_number=s.roll_number,
                created_at=s.created_at
            ) for s in test.students
        ],
        questions=q_schemas if q_schemas else None,
    )


@router.get("", response_model=List[schemas.TestResponse])
def list_tests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves all Tests created by the currently logged-in teacher.
    """
    tests = db.query(models.Test).filter(
        models.Test.teacher_id == current_user.id
    ).order_by(models.Test.id.desc()).all()

    result_list = []
    for t in tests:
        ma = t.model_answers[0] if t.model_answers else None
        q_schemas = []
        q_count = 1
        if ma and ma.questions_json:
            try:
                parsed_qs = json.loads(ma.questions_json)
                q_schemas = [schemas.QuestionItemSchema(**q) for q in parsed_qs]
                q_count = len(q_schemas)
            except Exception:
                q_schemas = []

        result_list.append(
            schemas.TestResponse(
                id=t.id,
                test_name=t.test_name,
                teacher_id=t.teacher_id,
                subject=t.subject,
                max_marks=t.max_marks,
                created_at=t.created_at,
                questions_count=q_count,
                students_count=len(t.students),
                model_answer_id=ma.id if ma else None,
                students=[
                    schemas.StudentResponse(
                        id=s.id,
                        teacher_id=s.teacher_id,
                        name=s.name,
                        roll_number=s.roll_number,
                        created_at=s.created_at
                    ) for s in t.students
                ],
                questions=q_schemas if q_schemas else None,
            )
        )
    return result_list


@router.get("/overview", response_model=List[schemas.TestOverviewResponse])
def get_tests_overview(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns all tests for the current teacher with assigned students and their specific
    status under each test (Pending Upload / Uploaded / Evaluated / Verified).
    Powers the test-grouped Dashboard.
    """
    tests = db.query(models.Test).filter(
        models.Test.teacher_id == current_user.id
    ).order_by(models.Test.id.desc()).all()

    overview_list = []
    for t in tests:
        ma = t.model_answers[0] if t.model_answers else None
        q_count = 1
        if ma and ma.questions_json:
            try:
                q_count = len(json.loads(ma.questions_json))
            except Exception:
                q_count = 1

        student_status_list = []
        uploaded_count = 0
        evaluated_count = 0
        verified_count = 0

        # Look up all answer sheets uploaded under this test
        test_sheets = db.query(models.AnswerSheet).filter(
            models.AnswerSheet.test_id == t.id
        ).all()
        sheet_by_student = {s.student_id: s for s in test_sheets if s.student_id is not None}

        for st in t.students:
            sheet = sheet_by_student.get(st.id)
            status_val = "Pending Upload"
            answer_sheet_id = None
            eval_id = None
            sim_val = None
            sug_marks = None
            fin_marks = None
            ver_by = None
            ver_at = None
            up_at = None

            if sheet:
                answer_sheet_id = sheet.id
                up_at = sheet.uploaded_at
                evals = db.query(models.Evaluation).filter(
                    models.Evaluation.answer_sheet_id == sheet.id
                ).order_by(models.Evaluation.id.desc()).all()

                if evals:
                    latest_eval = evals[0]
                    eval_id = latest_eval.id
                    sim_val = latest_eval.similarity
                    sug_marks = latest_eval.suggested_marks
                    final_res = latest_eval.final_result

                    if final_res and final_res.final_marks is not None:
                        status_val = "Verified"
                        fin_marks = final_res.final_marks
                        ver_by = final_res.verified_by
                        ver_at = final_res.verified_at
                        verified_count += 1
                    else:
                        status_val = "Evaluated"
                        evaluated_count += 1
                else:
                    status_val = "Uploaded"
                    uploaded_count += 1

            student_status_list.append(
                schemas.TestStudentStatusSchema(
                    student_id=st.id,
                    student_name=st.name,
                    roll_number=st.roll_number,
                    answer_sheet_id=answer_sheet_id,
                    evaluation_id=eval_id,
                    status=status_val,
                    similarity=sim_val,
                    suggested_marks=sug_marks,
                    final_marks=fin_marks,
                    max_marks=t.max_marks,
                    verified_by=ver_by,
                    verified_at=ver_at,
                    uploaded_at=up_at,
                )
            )

        overview_list.append(
            schemas.TestOverviewResponse(
                id=t.id,
                test_name=t.test_name,
                teacher_id=t.teacher_id,
                subject=t.subject,
                max_marks=t.max_marks,
                created_at=t.created_at,
                model_answer_id=ma.id if ma else None,
                questions_count=q_count,
                students_count=len(t.students),
                uploaded_count=uploaded_count,
                evaluated_count=evaluated_count,
                verified_count=verified_count,
                students=student_status_list,
            )
        )

    return overview_list


@router.get("/{id}", response_model=schemas.TestResponse)
def get_test(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieves details of a specific test. Enforces teacher data isolation.
    """
    test = db.query(models.Test).filter(models.Test.id == id).first()
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test with ID {id} not found."
        )

    if test.teacher_id is not None and test.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view tests belonging to another teacher."
        )

    ma = test.model_answers[0] if test.model_answers else None
    q_schemas = []
    q_count = 1
    if ma and ma.questions_json:
        try:
            parsed_qs = json.loads(ma.questions_json)
            q_schemas = [schemas.QuestionItemSchema(**q) for q in parsed_qs]
            q_count = len(q_schemas)
        except Exception:
            q_schemas = []

    return schemas.TestResponse(
        id=test.id,
        test_name=test.test_name,
        teacher_id=test.teacher_id,
        subject=test.subject,
        max_marks=test.max_marks,
        created_at=test.created_at,
        questions_count=q_count,
        students_count=len(test.students),
        model_answer_id=ma.id if ma else None,
        students=[
            schemas.StudentResponse(
                id=s.id,
                teacher_id=s.teacher_id,
                name=s.name,
                roll_number=s.roll_number,
                created_at=s.created_at
            ) for s in test.students
        ],
        questions=q_schemas if q_schemas else None,
    )


@router.post("/{id}/students", response_model=schemas.TestResponse)
def assign_students_to_test(
    id: int,
    request: schemas.TestStudentAssignRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Assigns existing or new students to a test.
    """
    test = db.query(models.Test).filter(models.Test.id == id).first()
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test with ID {id} not found."
        )

    if test.teacher_id is not None and test.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You cannot modify tests belonging to another teacher."
        )

    if request.student_ids:
        for sid in request.student_ids:
            st = db.query(models.Student).filter(
                models.Student.id == sid,
                models.Student.teacher_id == current_user.id
            ).first()
            if st and st not in test.students:
                test.students.append(st)

    if request.new_students:
        for new_st in request.new_students:
            if not new_st.name.strip():
                continue
            st_obj = models.Student(
                teacher_id=current_user.id,
                name=new_st.name.strip(),
                roll_number=new_st.roll_number.strip() if new_st.roll_number else None
            )
            db.add(st_obj)
            db.commit()
            db.refresh(st_obj)
            if st_obj not in test.students:
                test.students.append(st_obj)

    db.commit()
    db.refresh(test)

    ma = test.model_answers[0] if test.model_answers else None
    return schemas.TestResponse(
        id=test.id,
        test_name=test.test_name,
        teacher_id=test.teacher_id,
        subject=test.subject,
        max_marks=test.max_marks,
        created_at=test.created_at,
        questions_count=len(test.model_answers),
        students_count=len(test.students),
        model_answer_id=ma.id if ma else None,
        students=[
            schemas.StudentResponse(
                id=s.id,
                teacher_id=s.teacher_id,
                name=s.name,
                roll_number=s.roll_number,
                created_at=s.created_at
            ) for s in test.students
        ],
    )


@router.post("/{id}/evaluate-all", response_model=schemas.BatchEvaluateResponse)
def evaluate_all_test_sheets(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Evaluates all uploaded answer sheets for this test against the test's model answer in one click.
    Reuses the model answer automatically without re-entry.
    """
    test = db.query(models.Test).filter(models.Test.id == id).first()
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test with ID {id} not found."
        )

    if test.teacher_id is not None and test.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You cannot evaluate tests belonging to another teacher."
        )

    if not test.model_answers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This test does not have a configured model answer."
        )

    model_answer = test.model_answers[0]
    sheets = db.query(models.AnswerSheet).filter(models.AnswerSheet.test_id == test.id).all()

    if not sheets:
        return schemas.BatchEvaluateResponse(
            processed_count=0,
            successful_evaluations=[],
            failed_ids=[]
        )

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

    successful = []
    failed = []

    for sheet in sheets:
        try:
            student_text = sheet.extracted_text or ""
            rubric_scores = []
            question_evaluations = []

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
                answer_sheet_id=sheet.id,
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

            st_obj = sheet.student
            parsed_rubric = [schemas.RubricScoreSchema(**r) for r in rubric_scores] if rubric_scores else None
            parsed_q = [schemas.QuestionEvaluationSchema(**q) for q in question_evaluations] if question_evaluations else None

            successful.append(
                schemas.EvaluateResponse(
                    evaluation_id=evaluation.id,
                    answer_sheet_id=sheet.id,
                    model_answer_id=model_answer.id,
                    test_id=test.id,
                    test_name=test.test_name,
                    student_id=sheet.student_id,
                    student_name=st_obj.name if st_obj else sheet.student_name,
                    roll_number=st_obj.roll_number if st_obj else None,
                    title=test.test_name,
                    similarity=evaluation.similarity,
                    suggested_marks=evaluation.suggested_marks,
                    max_marks=model_answer.max_marks,
                    explanation=evaluation.explanation or "",
                    rubric_scores=parsed_rubric,
                    question_evaluations=parsed_q,
                )
            )
        except Exception:
            failed.append(sheet.id)

    return schemas.BatchEvaluateResponse(
        processed_count=len(successful),
        successful_evaluations=successful,
        failed_ids=failed,
    )


@router.delete("/{id}", response_model=schemas.MessageResponse)
def delete_test(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Deletes a Test and clears test references with teacher ownership check.
    """
    test = db.query(models.Test).filter(models.Test.id == id).first()
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test with ID {id} not found."
        )

    if test.teacher_id is not None and test.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to delete tests belonging to another teacher."
        )

    test_name = test.test_name
    db.delete(test)
    db.commit()

    return schemas.MessageResponse(
        message=f"Test '{test_name}' (ID: {id}) deleted successfully.",
        success=True
    )


@router.post("/extract-model-answer", response_model=schemas.ExtractTextResponse)
async def extract_model_answer_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    """
    Extracts reference model answer text from an uploaded image, PDF, or DOCX file.
    - Images / PDFs: Runs through OCR pipeline (Gemini -> EasyOCR -> Tesseract fallback).
    - DOCX / DOC: Directly extracts paragraphs and tables via python-docx without OCR.
    Returns the extracted text for safety-net review and manual correction before saving the test.
    """
    unique_prefix = f"model_extract_{int(time.time()*1000)}"
    try:
        relative_path, abs_path = validate_and_save_file(file, prefix_id=unique_prefix)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process uploaded file: {str(e)}"
        )

    extracted_text = extract_text_from_file(abs_path)
    filename = file.filename or os.path.basename(abs_path)
    _, ext = os.path.splitext(filename)
    file_type = ext.lower().replace(".", "") or "file"

    return schemas.ExtractTextResponse(
        filename=filename,
        extracted_text=extracted_text,
        file_type=file_type,
        status="success"
    )

