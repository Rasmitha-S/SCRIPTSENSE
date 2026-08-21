from datetime import datetime
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
import models
import schemas
from routers.auth import get_current_admin_user, get_password_hash

router = APIRouter(prefix="/api/admin", tags=["Admin Management"])

@router.get("/stats", response_model=schemas.AdminStatsResponse)
def get_admin_stats(
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    """
    Returns total statistics across all teachers, students, answer sheets, evaluations, and results.
    """
    teachers_count = db.query(models.User).filter(models.User.role == "teacher").count()
    students_count = db.query(models.Student).count()
    sheets_count = db.query(models.AnswerSheet).count()
    evals_count = db.query(models.Evaluation).count()
    results_count = db.query(models.FinalResult).count()

    return schemas.AdminStatsResponse(
        total_teachers=teachers_count,
        total_students=students_count,
        total_answer_sheets=sheets_count,
        total_evaluations=evals_count,
        total_verified_results=results_count,
    )

@router.get("/teachers", response_model=List[schemas.TeacherResponse])
def list_all_teachers(
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    """
    Retrieves all teacher accounts with their assigned students count and uploaded answer sheets count.
    """
    teachers = db.query(models.User).filter(models.User.role == "teacher").order_by(models.User.id.desc()).all()
    results = []
    for t in teachers:
        student_count = db.query(models.Student).filter(models.Student.teacher_id == t.id).count()
        upload_count = db.query(models.AnswerSheet).join(models.Student).filter(models.Student.teacher_id == t.id).count()
        results.append(
            schemas.TeacherResponse(
                id=t.id,
                name=t.full_name or t.username,
                username=t.username,
                email=t.email,
                role=t.role,
                is_active=t.is_active,
                created_at=t.created_at,
                student_count=student_count,
                upload_count=upload_count,
            )
        )
    return results

@router.post("/teachers", response_model=schemas.TeacherResponse, status_code=status.HTTP_201_CREATED)
def create_teacher(
    request: schemas.TeacherCreateRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    """
    Creates a new teacher account.
    Enforces uniqueness on username and email: returns 'Username or email already exists.' on duplicate.
    """
    clean_username = request.username.strip()
    clean_email = request.email.strip().lower() if request.email else None
    clean_name = request.name.strip()

    if not clean_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot be empty."
        )
    if not clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email cannot be empty."
        )
    if not request.password or len(request.password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters."
        )

    # 1. Check duplicate username
    existing_username = db.query(models.User).filter(models.User.username == clean_username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists."
        )

    # 2. Check duplicate email
    existing_email = db.query(models.User).filter(models.User.email == clean_email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists."
        )

    hashed_pwd = get_password_hash(request.password)
    new_teacher = models.User(
        username=clean_username,
        email=clean_email,
        password_hash=hashed_pwd,
        role=request.role or "teacher",
        full_name=clean_name if clean_name else clean_username,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(new_teacher)
    db.commit()
    db.refresh(new_teacher)

    return schemas.TeacherResponse(
        id=new_teacher.id,
        name=new_teacher.full_name or new_teacher.username,
        username=new_teacher.username,
        email=new_teacher.email,
        role=new_teacher.role,
        is_active=new_teacher.is_active,
        created_at=new_teacher.created_at,
        student_count=0,
        upload_count=0,
    )

@router.put("/teachers/{teacher_id}", response_model=schemas.TeacherResponse)
def update_teacher(
    teacher_id: int,
    request: schemas.TeacherUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    """
    Updates teacher profile, username, email, active status, or password.
    Checks uniqueness of username and email against other teachers.
    """
    teacher = db.query(models.User).filter(models.User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Teacher with ID {teacher_id} not found."
        )

    if request.username is not None:
        clean_user = request.username.strip()
        if not clean_user:
            raise HTTPException(status_code=400, detail="Username cannot be empty.")
        existing_u = db.query(models.User).filter(
            models.User.username == clean_user,
            models.User.id != teacher_id
        ).first()
        if existing_u:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already exists."
            )
        teacher.username = clean_user

    if request.email is not None:
        clean_email = request.email.strip().lower()
        if not clean_email:
            raise HTTPException(status_code=400, detail="Email cannot be empty.")
        existing_e = db.query(models.User).filter(
            models.User.email == clean_email,
            models.User.id != teacher_id
        ).first()
        if existing_e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already exists."
            )
        teacher.email = clean_email

    if request.name is not None:
        teacher.full_name = request.name.strip()

    if request.is_active is not None:
        teacher.is_active = request.is_active

    if request.password and len(request.password.strip()) >= 4:
        teacher.password_hash = get_password_hash(request.password.strip())

    db.commit()
    db.refresh(teacher)

    student_count = db.query(models.Student).filter(models.Student.teacher_id == teacher.id).count()
    upload_count = db.query(models.AnswerSheet).join(models.Student).filter(models.Student.teacher_id == teacher.id).count()

    return schemas.TeacherResponse(
        id=teacher.id,
        name=teacher.full_name or teacher.username,
        username=teacher.username,
        email=teacher.email,
        role=teacher.role,
        is_active=teacher.is_active,
        created_at=teacher.created_at,
        student_count=student_count,
        upload_count=upload_count,
    )

@router.delete("/teachers/{teacher_id}", response_model=schemas.MessageResponse)
def delete_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    """
    Deactivates or deletes a teacher account and cleans up student data.
    """
    teacher = db.query(models.User).filter(models.User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Teacher with ID {teacher_id} not found."
        )

    if teacher.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin cannot delete their own active account."
        )

    teacher_name = teacher.full_name or teacher.username
    
    # Delete associated student sheets, evals, results
    students = db.query(models.Student).filter(models.Student.teacher_id == teacher.id).all()
    for st in students:
        sheets = db.query(models.AnswerSheet).filter(models.AnswerSheet.student_id == st.id).all()
        for sh in sheets:
            evals = db.query(models.Evaluation).filter(models.Evaluation.answer_sheet_id == sh.id).all()
            for ev in evals:
                final_res = db.query(models.FinalResult).filter(models.FinalResult.evaluation_id == ev.id).first()
                if final_res:
                    db.delete(final_res)
                db.delete(ev)
            db.delete(sh)
        db.delete(st)

    db.delete(teacher)
    db.commit()

    return schemas.MessageResponse(
        message=f"Teacher '{teacher_name}' (ID: {teacher_id}) and associated data removed successfully.",
        success=True
    )

@router.get("/students", response_model=List[schemas.AdminStudentResponse])
def list_all_students(
    teacher_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    """
    Retrieves all students across all teachers, indicating owning teacher details.
    """
    query = db.query(models.Student).join(models.User, models.Student.teacher_id == models.User.id, isouter=True)
    if teacher_id:
        query = query.filter(models.Student.teacher_id == teacher_id)

    students = query.order_by(models.Student.id.desc()).all()
    result = []
    for s in students:
        upload_count = db.query(models.AnswerSheet).filter(models.AnswerSheet.student_id == s.id).count()
        teacher_name = s.teacher.full_name or s.teacher.username if s.teacher else "Unassigned"
        teacher_user = s.teacher.username if s.teacher else None
        result.append(
            schemas.AdminStudentResponse(
                id=s.id,
                teacher_id=s.teacher_id,
                teacher_name=teacher_name,
                teacher_username=teacher_user,
                name=s.name,
                roll_number=s.roll_number,
                upload_count=upload_count,
                created_at=s.created_at,
            )
        )
    return result

@router.get("/answer-sheets", response_model=List[schemas.AdminAnswerSheetResponse])
def list_all_answer_sheets(
    teacher_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    """
    Retrieves all uploaded answer sheets across all teachers.
    """
    query = db.query(models.AnswerSheet).join(models.Student, isouter=True).join(models.User, models.Student.teacher_id == models.User.id, isouter=True)
    if teacher_id:
        query = query.filter(
            (models.AnswerSheet.teacher_id == teacher_id) | (models.Student.teacher_id == teacher_id)
        )

    sheets = query.order_by(models.AnswerSheet.id.desc()).all()
    result = []
    for sh in sheets:
        st = sh.student
        teacher = sh.teacher or (st.teacher if st else None)
        teacher_name = teacher.full_name or teacher.username if teacher else "Unassigned"
        teacher_id_val = teacher.id if teacher else None

        result.append(
            schemas.AdminAnswerSheetResponse(
                id=sh.id,
                student_id=sh.student_id,
                student_name=st.name if st else sh.student_name,
                roll_number=st.roll_number if st else None,
                teacher_id=teacher_id_val,
                teacher_name=teacher_name,
                file_path=sh.file_path,
                filename=sh.file_path.split("/")[-1] if sh.file_path else None,
                extracted_text=sh.extracted_text,
                uploaded_at=sh.uploaded_at,
            )
        )
    return result

@router.get("/evaluations", response_model=List[schemas.AdminEvaluationResponse])
def list_all_evaluations(
    teacher_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    """
    Retrieves all AI evaluations across all teachers.
    """
    query = db.query(models.Evaluation).join(models.AnswerSheet).join(models.Student, isouter=True).join(models.User, models.Student.teacher_id == models.User.id, isouter=True)
    if teacher_id:
        query = query.filter(
            (models.AnswerSheet.teacher_id == teacher_id) | (models.Student.teacher_id == teacher_id)
        )

    evals = query.order_by(models.Evaluation.id.desc()).all()
    result = []
    for ev in evals:
        sh = ev.answer_sheet
        st = sh.student if sh else None
        teacher = sh.teacher if (sh and sh.teacher) else (st.teacher if st else None)
        teacher_name = teacher.full_name or teacher.username if teacher else "Unassigned"
        teacher_id_val = teacher.id if teacher else None
        model_ans = ev.model_answer

        final_res = ev.final_result
        final_m = final_res.final_marks if final_res else None
        status_val = "Verified" if final_m is not None else "Evaluated"

        result.append(
            schemas.AdminEvaluationResponse(
                id=ev.id,
                answer_sheet_id=ev.answer_sheet_id,
                student_id=st.id if st else (sh.student_id if sh else None),
                student_name=st.name if st else (sh.student_name if sh else "Unknown"),
                roll_number=st.roll_number if st else None,
                teacher_id=teacher_id_val,
                teacher_name=teacher_name,
                title=model_ans.title if model_ans else (model_ans.question[:40] if model_ans else "Standard Exam"),
                similarity=ev.similarity,
                suggested_marks=ev.suggested_marks,
                max_marks=model_ans.max_marks if model_ans else 10.0,
                explanation=ev.explanation,
                final_marks=final_m,
                status=status_val,
            )
        )
    return result

@router.get("/results", response_model=List[schemas.AdminResultResponse])
def list_all_final_results(
    teacher_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    """
    Retrieves all teacher-verified final results across all teachers.
    """
    query = db.query(models.Evaluation).join(models.AnswerSheet).join(models.Student, isouter=True).join(models.User, models.Student.teacher_id == models.User.id, isouter=True)
    if teacher_id:
        query = query.filter(
            (models.AnswerSheet.teacher_id == teacher_id) | (models.Student.teacher_id == teacher_id)
        )

    evals = query.order_by(models.Evaluation.id.desc()).all()
    result = []
    for ev in evals:
        sh = ev.answer_sheet
        st = sh.student if sh else None
        teacher = sh.teacher if (sh and sh.teacher) else (st.teacher if st else None)
        teacher_name = teacher.full_name or teacher.username if teacher else "Unassigned"
        teacher_id_val = teacher.id if teacher else None
        model_ans = ev.model_answer

        final_res = ev.final_result
        final_m = final_res.final_marks if final_res else None
        status_val = "Verified" if final_m is not None else "Evaluated"

        result.append(
            schemas.AdminResultResponse(
                id=final_res.id if final_res else ev.id,
                evaluation_id=ev.id,
                answer_sheet_id=ev.answer_sheet_id,
                student_id=st.id if st else (sh.student_id if sh else None),
                student_name=st.name if st else (sh.student_name if sh else "Unknown"),
                roll_number=st.roll_number if st else None,
                teacher_id=teacher_id_val,
                teacher_name=teacher_name,
                title=model_ans.title if model_ans else (model_ans.question[:40] if model_ans else "Standard Exam"),
                max_marks=model_ans.max_marks if model_ans else 10.0,
                similarity=ev.similarity,
                suggested_marks=ev.suggested_marks,
                final_marks=final_m,
                teacher_feedback=final_res.teacher_feedback if final_res else None,
                verified_by=final_res.verified_by if final_res else None,
                verified_at=final_res.verified_at if final_res else None,
                status=status_val,
            )
        )
    return result
