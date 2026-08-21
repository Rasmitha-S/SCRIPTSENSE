import os
import json
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from dotenv import load_dotenv

from database import get_db
import models
import schemas

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "scriptsense_super_secret_jwt_key_2026_educator_token")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

security = HTTPBearer()

router = APIRouter(prefix="/api", tags=["Auth"])

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    if not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account has been deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def get_current_admin_user(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required. You do not have permission to view or manage admin data."
        )
    return current_user

@router.post("/login", response_model=schemas.TokenResponse)
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    """
    Role-based authentication endpoint for Teachers and Admins.
    Validates username/email, password, and optionally verifies requested role.
    """
    identifier = request.username.strip()
    user = db.query(models.User).filter(
        (models.User.username == identifier) | (models.User.email == identifier)
    ).first()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account has been deactivated. Please contact an administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # If role was explicitly specified in request, ensure user matches that role
    if request.role and request.role.strip():
        req_role = request.role.strip().lower()
        if user.role.lower() != req_role:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"This account does not have {request.role} access permissions.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    access_token = create_access_token(data={"sub": user.username, "role": user.role, "user_id": user.id})
    return schemas.TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        name=user.full_name or user.username,
        role=user.role,
        username=user.username,
        full_name=user.full_name or user.username,
        email=user.email,
        status="success"
    )

@router.post("/register", response_model=schemas.TokenResponse, status_code=status.HTTP_201_CREATED)
def register_teacher(request: schemas.TeacherRegisterRequest, db: Session = Depends(get_db)):
    """
    Allows new teachers to register and immediately start evaluating student work.
    """
    clean_username = request.username.strip()
    clean_email = request.email.strip() if request.email else None

    if not clean_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot be empty."
        )
    if len(request.password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters."
        )

    existing_user = db.query(models.User).filter(models.User.username == clean_username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists."
        )

    if clean_email:
        existing_email = db.query(models.User).filter(models.User.email == clean_email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already exists."
            )

    hashed_pwd = get_password_hash(request.password)
    new_user = models.User(
        username=clean_username,
        email=clean_email,
        password_hash=hashed_pwd,
        role=request.role or "teacher",
        full_name=request.full_name.strip() if request.full_name else clean_username,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(data={"sub": new_user.username, "role": new_user.role, "user_id": new_user.id})
    return schemas.TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=new_user.id,
        name=new_user.full_name or new_user.username,
        role=new_user.role,
        username=new_user.username,
        full_name=new_user.full_name,
        email=new_user.email,
        status="success"
    )

@router.post("/reset-password", response_model=schemas.ResetPasswordResponse)
def reset_password(request: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Teacher password reset endpoint.
    Verifies teacher username exists, hashes the new password with bcrypt, and updates it in SQLite.
    """
    clean_username = request.username.strip()
    if not clean_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot be empty."
        )
    if not request.new_password or len(request.new_password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 4 characters."
        )

    user = db.query(models.User).filter(models.User.username == clean_username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Teacher account with username '{clean_username}' was not found."
        )

    user.password_hash = get_password_hash(request.new_password)
    db.commit()
    db.refresh(user)

    return schemas.ResetPasswordResponse(
        message=f"Password for teacher '{user.username}' has been successfully reset. You can now sign in with your new password.",
        success=True
    )

@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_profile(
    current_user: models.User = Depends(get_current_user)
):
    """
    Returns authenticated user information.
    """
    return current_user

@router.post("/student/portal-access", response_model=schemas.StudentPortalResponse)
def student_portal_access(
    request: schemas.StudentLookupRequest,
    db: Session = Depends(get_db)
):
    """
    Allows a student to look up all their evaluated & verified marks using their Roll Number or Student ID.
    """
    query_val = request.roll_number_or_id.strip()
    if not query_val:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid Roll Number or Student ID."
        )

    # 1. Try finding student by roll number (case-insensitive match)
    student = db.query(models.Student).filter(
        models.Student.roll_number.ilike(query_val)
    ).first()

    # 2. Try by integer ID
    if not student and query_val.isdigit():
        student = db.query(models.Student).filter(models.Student.id == int(query_val)).first()

    # 3. Try by exact name
    if not student:
        student = db.query(models.Student).filter(
            models.Student.name.ilike(query_val)
        ).first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No student record found matching '{query_val}'. Please verify your Roll Number with your teacher."
        )

    # Fetch all answer sheets for this student
    sheets = db.query(models.AnswerSheet).filter(
        models.AnswerSheet.student_id == student.id
    ).order_by(models.AnswerSheet.id.desc()).all()

    results_cards = []
    total_final_marks = 0.0
    total_max_marks = 0.0
    verified_count = 0

    for sheet in sheets:
        evals = db.query(models.Evaluation).filter(
            models.Evaluation.answer_sheet_id == sheet.id
        ).order_by(models.Evaluation.id.desc()).all()

        if evals:
            for evaluation in evals:
                model_answer = evaluation.model_answer
                final_res = evaluation.final_result
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
                if evaluation.rubric_scores_json:
                    try:
                        rubric_scores = [schemas.RubricScoreSchema(**r) for r in json.loads(evaluation.rubric_scores_json)]
                    except Exception:
                        rubric_scores = None

                q_evals = None
                if evaluation.question_evaluations_json:
                    try:
                        q_evals = [schemas.QuestionEvaluationSchema(**q) for q in json.loads(evaluation.question_evaluations_json)]
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
                        evaluation_id=evaluation.id,
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
                        similarity=evaluation.similarity,
                        suggested_marks=evaluation.suggested_marks,
                        explanation=evaluation.explanation,
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

            # Sheet uploaded but not evaluated yet
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

@router.post("/explain-marks", response_model=schemas.ExplainMarksResponse)
def explain_student_marks(
    request: schemas.ExplainMarksRequest,
    db: Session = Depends(get_db)
):
    """
    Explains marks allocated to a student using Gemini 1.5 Flash (via REST)
    or intelligent grounded template fallback if API key is not configured.
    """
    from services.gemini_service import generate_marks_explanation

    student_ans = request.student_answer
    model_ans = request.model_answer
    q_text = request.question
    marks_val = request.marks_obtained
    max_m = request.max_marks if request.max_marks > 0 else 10.0
    sim_val = request.similarity
    exp_val = request.explanation

    # If evaluation_id is supplied, we can hydrate missing fields directly from DB
    if request.evaluation_id:
        eval_record = db.query(models.Evaluation).filter(models.Evaluation.id == request.evaluation_id).first()
        if eval_record:
            if not student_ans and eval_record.answer_sheet:
                student_ans = eval_record.answer_sheet.extracted_text or ""
            if not model_ans and eval_record.model_answer:
                model_ans = eval_record.model_answer.answer_text or ""
            if not q_text and eval_record.model_answer:
                q_text = eval_record.model_answer.question or eval_record.model_answer.title
            if eval_record.final_result and eval_record.final_result.final_marks is not None:
                marks_val = eval_record.final_result.final_marks
            elif marks_val == 0.0:
                marks_val = eval_record.suggested_marks
            if sim_val == 0.0:
                sim_val = eval_record.similarity
            if not exp_val:
                exp_val = eval_record.explanation

    reply_text, is_ai, source_name = generate_marks_explanation(
        student_answer=student_ans,
        model_answer=model_ans,
        similarity=sim_val,
        marks_obtained=marks_val,
        max_marks=max_m,
        question=q_text,
        explanation=exp_val,
        user_question=request.user_question,
        history=request.history,
    )

    return schemas.ExplainMarksResponse(
        reply=reply_text,
        is_ai_generated=is_ai,
        source=source_name
    )


