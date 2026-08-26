from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import Integer, String, Float, Text, DateTime, ForeignKey, Table, Column
from sqlalchemy.orm import relationship, Mapped, mapped_column
from database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# Association Table linking Tests and Students (Many-to-Many)
test_students = Table(
    "test_students",
    Base.metadata,
    Column("test_id", Integer, ForeignKey("tests.id", ondelete="CASCADE"), primary_key=True),
    Column("student_id", Integer, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(120), unique=True, index=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="teacher", nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    students: Mapped[List["Student"]] = relationship("Student", back_populates="teacher", cascade="all, delete-orphan")
    answer_sheets: Mapped[List["AnswerSheet"]] = relationship("AnswerSheet", back_populates="teacher")
    tests: Mapped[List["Test"]] = relationship("Test", back_populates="teacher", cascade="all, delete-orphan")

    @property
    def name(self) -> str:
        return str(self.full_name) if self.full_name else str(self.username)


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    test_name: Mapped[str] = mapped_column(String(200), nullable=False)
    teacher_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    subject: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="General")
    max_marks: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    teacher: Mapped[Optional["User"]] = relationship("User", back_populates="tests")
    students: Mapped[List["Student"]] = relationship("Student", secondary=test_students, back_populates="tests")
    model_answers: Mapped[List["ModelAnswer"]] = relationship("ModelAnswer", back_populates="test", cascade="all, delete-orphan")
    answer_sheets: Mapped[List["AnswerSheet"]] = relationship("AnswerSheet", back_populates="test")


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    teacher_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    roll_number: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    teacher: Mapped[Optional["User"]] = relationship("User", back_populates="students")
    answer_sheets: Mapped[List["AnswerSheet"]] = relationship("AnswerSheet", back_populates="student", cascade="all, delete-orphan")
    tests: Mapped[List["Test"]] = relationship("Test", secondary=test_students, back_populates="students")


class AnswerSheet(Base):
    __tablename__ = "answer_sheets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("students.id"), index=True, nullable=True)
    teacher_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    test_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("tests.id"), index=True, nullable=True)
    student_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    student: Mapped[Optional["Student"]] = relationship("Student", back_populates="answer_sheets")
    teacher: Mapped[Optional["User"]] = relationship("User", back_populates="answer_sheets")
    test: Mapped[Optional["Test"]] = relationship("Test", back_populates="answer_sheets")
    evaluations: Mapped[List["Evaluation"]] = relationship("Evaluation", back_populates="answer_sheet", cascade="all, delete-orphan")


class ModelAnswer(Base):
    __tablename__ = "model_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    test_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("tests.id"), index=True, nullable=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    max_marks: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    subject: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    questions_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rubric_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    test: Mapped[Optional["Test"]] = relationship("Test", back_populates="model_answers")
    evaluations: Mapped[List["Evaluation"]] = relationship("Evaluation", back_populates="model_answer")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    answer_sheet_id: Mapped[int] = mapped_column(Integer, ForeignKey("answer_sheets.id"), nullable=False)
    model_answer_id: Mapped[int] = mapped_column(Integer, ForeignKey("model_answers.id"), nullable=False)
    similarity: Mapped[float] = mapped_column(Float, nullable=False)
    suggested_marks: Mapped[float] = mapped_column(Float, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rubric_scores_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    question_evaluations_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    answer_sheet: Mapped["AnswerSheet"] = relationship("AnswerSheet", back_populates="evaluations")
    model_answer: Mapped["ModelAnswer"] = relationship("ModelAnswer", back_populates="evaluations")
    final_result: Mapped[Optional["FinalResult"]] = relationship("FinalResult", back_populates="evaluation", uselist=False)


class FinalResult(Base):
    __tablename__ = "final_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    evaluation_id: Mapped[int] = mapped_column(Integer, ForeignKey("evaluations.id"), unique=True, nullable=False)
    final_marks: Mapped[float] = mapped_column(Float, nullable=False)
    teacher_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verified_by: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    rubric_adjustments_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    question_results_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    evaluation: Mapped["Evaluation"] = relationship("Evaluation", back_populates="final_result")
