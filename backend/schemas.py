from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

# Base schema with protected namespace override
class AppBaseModel(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

# Auth & User Schemas
class LoginRequest(AppBaseModel):
    username: str
    password: str
    role: Optional[str] = None

class TeacherRegisterRequest(AppBaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = "teacher"

class ResetPasswordRequest(AppBaseModel):
    username: str
    new_password: str

class ResetPasswordResponse(AppBaseModel):
    message: str
    success: bool = True

class ExplainMarksRequest(AppBaseModel):
    evaluation_id: Optional[int] = None
    student_answer: str
    model_answer: Optional[str] = None
    question: Optional[str] = None
    similarity: float = 0.0
    marks_obtained: float = 0.0
    max_marks: float = 10.0
    explanation: Optional[str] = None
    user_question: Optional[str] = None
    history: Optional[List[dict]] = None

class ExplainMarksResponse(AppBaseModel):
    reply: str
    is_ai_generated: bool = False
    source: str = "template"

class TokenResponse(AppBaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    role: str = "teacher"
    username: str
    status: str = "success"
    full_name: Optional[str] = None
    email: Optional[str] = None

class UserResponse(AppBaseModel):
    id: int
    username: str
    email: Optional[str] = None
    role: str
    full_name: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

# Admin & Teacher Management Schemas
class TeacherCreateRequest(AppBaseModel):
    name: str
    username: str
    email: str
    password: str
    role: Optional[str] = "teacher"

class TeacherUpdateRequest(AppBaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class TeacherResponse(AppBaseModel):
    id: int
    name: str
    username: str
    email: Optional[str] = None
    role: str = "teacher"
    is_active: bool = True
    created_at: Optional[datetime] = None
    student_count: int = 0
    upload_count: int = 0

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class AdminStudentResponse(AppBaseModel):
    id: int
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    teacher_username: Optional[str] = None
    name: str
    roll_number: Optional[str] = None
    upload_count: int = 0
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class AdminAnswerSheetResponse(AppBaseModel):
    id: int
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    file_path: str
    filename: Optional[str] = None
    extracted_text: Optional[str] = None
    uploaded_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class AdminEvaluationResponse(AppBaseModel):
    id: int
    answer_sheet_id: int
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    title: Optional[str] = None
    similarity: float
    suggested_marks: float
    max_marks: float = 10.0
    explanation: Optional[str] = None
    final_marks: Optional[float] = None
    status: str = "Evaluated"

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class AdminResultResponse(AppBaseModel):
    id: int
    evaluation_id: int
    answer_sheet_id: int
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    title: Optional[str] = None
    max_marks: float = 10.0
    similarity: float = 0.0
    suggested_marks: float = 0.0
    final_marks: Optional[float] = None
    teacher_feedback: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    status: str = "Verified"

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class AdminStatsResponse(AppBaseModel):
    total_teachers: int = 0
    total_students: int = 0
    total_answer_sheets: int = 0
    total_evaluations: int = 0
    total_verified_results: int = 0

class MessageResponse(AppBaseModel):
    message: str
    success: bool = True

# Student Schemas
class StudentCreate(AppBaseModel):
    name: str
    roll_number: Optional[str] = None

class StudentResponse(AppBaseModel):
    id: int
    teacher_id: Optional[int] = None
    name: str
    roll_number: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class StudentDeleteResponse(AppBaseModel):
    success: bool = True
    message: str
    student_id: int
    student_name: str
    deleted_sheets_count: int = 0
    deleted_evaluations_count: int = 0

class StudentOverviewResponse(AppBaseModel):
    id: int
    teacher_id: Optional[int] = None
    name: str
    roll_number: Optional[str] = None
    upload_count: int = 0
    created_at: Optional[datetime] = None
    latest_answer_sheet_id: Optional[int] = None
    latest_evaluation_id: Optional[int] = None
    status: str = "Pending Upload"  # 'Uploaded' | 'Evaluated' | 'Verified' | 'Pending Upload'
    question: Optional[str] = None
    similarity: Optional[float] = None
    suggested_marks: Optional[float] = None
    final_marks: Optional[float] = None
    max_marks: Optional[float] = 10.0
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

# Rubric & Multi-Question Core Schemas
class RubricCriterionSchema(AppBaseModel):
    id: Optional[str] = None
    criterion: str
    max_marks: float = 2.0
    keywords: Optional[List[str]] = []
    description: Optional[str] = None

class QuestionItemSchema(AppBaseModel):
    q_num: int = 1
    question: str
    model_answer: str
    max_marks: float = 5.0
    rubric: Optional[List[RubricCriterionSchema]] = []

class RubricScoreSchema(AppBaseModel):
    criterion_id: Optional[str] = None
    criterion: str
    max_marks: float
    suggested_marks: float
    similarity: float = 0.0
    matched_keywords: Optional[List[str]] = []
    notes: Optional[str] = None

class QuestionEvaluationSchema(AppBaseModel):
    q_num: int = 1
    question: str
    student_answer: Optional[str] = ""
    model_answer: Optional[str] = ""
    max_marks: float = 5.0
    similarity: float = 0.0
    suggested_marks: float = 0.0
    explanation: Optional[str] = None
    rubric_scores: Optional[List[RubricScoreSchema]] = []

class RubricAdjustmentSchema(AppBaseModel):
    criterion_id: Optional[str] = None
    criterion: Optional[str] = None
    final_marks: float
    teacher_note: Optional[str] = None

class QuestionResultSchema(AppBaseModel):
    q_num: int = 1
    final_marks: float
    max_marks: Optional[float] = None
    teacher_comment: Optional[str] = None
    rubric_adjustments: Optional[List[RubricAdjustmentSchema]] = []

# Student Portal Schemas
class StudentLookupRequest(AppBaseModel):
    roll_number_or_id: str

class StudentResultCard(AppBaseModel):
    evaluation_id: int
    answer_sheet_id: int
    student_id: int
    student_name: str
    roll_number: Optional[str] = None
    title: Optional[str] = None
    subject: Optional[str] = None
    question: Optional[str] = None
    model_answer: Optional[str] = None
    extracted_text: Optional[str] = None
    file_path: Optional[str] = None
    max_marks: float = 10.0
    similarity: float
    suggested_marks: float
    explanation: Optional[str] = None
    final_marks: Optional[float] = None
    teacher_feedback: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    status: str = "Evaluated"  # 'Verified' | 'Evaluated' | 'Uploaded'
    uploaded_at: Optional[datetime] = None
    rubric_scores: Optional[List[RubricScoreSchema]] = None
    question_evaluations: Optional[List[QuestionEvaluationSchema]] = None
    question_results: Optional[List[QuestionResultSchema]] = None

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class StudentPortalResponse(AppBaseModel):
    student_id: int
    student_name: str
    roll_number: Optional[str] = None
    total_exams: int = 0
    verified_exams: int = 0
    average_score: Optional[float] = None
    average_percentage: Optional[float] = None
    results: List[StudentResultCard] = []

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

# Upload Schemas
class UploadResponse(AppBaseModel):
    answer_sheet_id: int
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    test_id: Optional[int] = None
    test_name: Optional[str] = None
    file_path: str
    filename: Optional[str] = None
    extracted_text: str
    uploaded_by: Optional[str] = None
    status: Optional[str] = "processed"

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())


# Model Answer Schemas
class ModelAnswerCreate(AppBaseModel):
    test_id: Optional[int] = None
    question: Optional[str] = None
    answer_text: Optional[str] = None
    max_marks: float = Field(default=10.0, gt=0, le=500)
    title: Optional[str] = None
    subject: Optional[str] = None
    questions: Optional[List[QuestionItemSchema]] = None
    rubric: Optional[List[RubricCriterionSchema]] = None

class ModelAnswerResponse(AppBaseModel):
    model_answer_id: int
    test_id: Optional[int] = None
    title: Optional[str] = None
    subject: Optional[str] = None
    max_marks: Optional[float] = 10.0
    questions_count: Optional[int] = 1
    extracted_text: Optional[str] = None

# Evaluation Schemas
class EvaluateRequest(AppBaseModel):
    answer_sheet_id: int
    model_answer_id: Optional[int] = None
    test_id: Optional[int] = None

class EvaluateResponse(AppBaseModel):
    evaluation_id: int
    answer_sheet_id: Optional[int] = None
    model_answer_id: Optional[int] = None
    test_id: Optional[int] = None
    test_name: Optional[str] = None
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    title: Optional[str] = None
    similarity: float
    suggested_marks: float
    max_marks: Optional[float] = 10.0
    explanation: str
    rubric_scores: Optional[List[RubricScoreSchema]] = None
    question_evaluations: Optional[List[QuestionEvaluationSchema]] = None

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

# Results Schemas
class ResultResponse(AppBaseModel):
    evaluation_id: int
    answer_sheet_id: int
    test_id: Optional[int] = None
    test_name: Optional[str] = None
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    extracted_text: Optional[str] = None
    title: Optional[str] = None
    subject: Optional[str] = None
    question: Optional[str] = None
    model_answer: Optional[str] = None
    max_marks: float = 10.0
    similarity: float
    suggested_marks: float
    explanation: Optional[str] = None
    final_marks: Optional[float] = None
    teacher_feedback: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    rubric_scores: Optional[List[RubricScoreSchema]] = None
    question_evaluations: Optional[List[QuestionEvaluationSchema]] = None
    rubric_adjustments: Optional[List[RubricAdjustmentSchema]] = None
    question_results: Optional[List[QuestionResultSchema]] = None

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class ResultUpdateRequest(AppBaseModel):
    final_marks: float = Field(..., ge=0)
    teacher_feedback: Optional[str] = None
    rubric_adjustments: Optional[List[RubricAdjustmentSchema]] = None
    question_results: Optional[List[QuestionResultSchema]] = None

class ResultUpdateResponse(AppBaseModel):
    evaluation_id: int
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    final_marks: float
    verified_by: Optional[str] = None
    verified_at: datetime
    rubric_adjustments: Optional[List[RubricAdjustmentSchema]] = None
    question_results: Optional[List[QuestionResultSchema]] = None

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

# Batch Evaluation & Transcript Schemas
class BatchEvaluateRequest(AppBaseModel):
    answer_sheet_ids: Optional[List[int]] = None
    model_answer_id: Optional[int] = None
    test_id: Optional[int] = None

class BatchEvaluateResponse(AppBaseModel):
    processed_count: int
    successful_evaluations: List[EvaluateResponse] = []
    failed_ids: List[int] = []

class TranscriptUpdateRequest(AppBaseModel):
    extracted_text: str

class ExtractTextResponse(AppBaseModel):
    filename: str
    extracted_text: str
    file_type: str = "document"
    status: str = "success"


# ==========================================
# Test Schemas (Section 2 & 9.4 Test Workflow)
# ==========================================
class TestCreateRequest(AppBaseModel):
    test_name: str
    subject: Optional[str] = "General"
    max_marks: Optional[float] = 10.0
    question: Optional[str] = None
    answer_text: Optional[str] = None
    questions: Optional[List[QuestionItemSchema]] = None
    rubric: Optional[List[RubricCriterionSchema]] = None
    student_ids: Optional[List[int]] = None
    new_students: Optional[List[StudentCreate]] = None

class TestUpdateRequest(AppBaseModel):
    test_name: Optional[str] = None
    subject: Optional[str] = None
    max_marks: Optional[float] = None
    questions: Optional[List[QuestionItemSchema]] = None
    student_ids: Optional[List[int]] = None

class TestStudentAssignRequest(AppBaseModel):
    student_ids: Optional[List[int]] = []
    new_students: Optional[List[StudentCreate]] = []

class TestStudentStatusSchema(AppBaseModel):
    student_id: int
    student_name: str
    roll_number: Optional[str] = None
    answer_sheet_id: Optional[int] = None
    evaluation_id: Optional[int] = None
    status: str = "Pending Upload"  # 'Pending Upload' | 'Uploaded' | 'Evaluated' | 'Verified'
    similarity: Optional[float] = None
    suggested_marks: Optional[float] = None
    final_marks: Optional[float] = None
    max_marks: float = 10.0
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    uploaded_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class TestResponse(AppBaseModel):
    id: int
    test_name: str
    teacher_id: Optional[int] = None
    subject: Optional[str] = "General"
    max_marks: float = 10.0
    created_at: Optional[datetime] = None
    questions_count: int = 1
    students_count: int = 0
    model_answer_id: Optional[int] = None
    students: Optional[List[StudentResponse]] = None
    questions: Optional[List[QuestionItemSchema]] = None

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class TestOverviewResponse(AppBaseModel):
    id: int
    test_name: str
    teacher_id: Optional[int] = None
    subject: Optional[str] = "General"
    max_marks: float = 10.0
    created_at: Optional[datetime] = None
    model_answer_id: Optional[int] = None
    questions_count: int = 1
    students_count: int = 0
    uploaded_count: int = 0
    evaluated_count: int = 0
    verified_count: int = 0
    students: List[TestStudentStatusSchema] = []

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

