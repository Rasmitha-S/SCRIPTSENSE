import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, Base, SessionLocal
import models
from routers import auth, uploads, evaluation, results, students, system, admin

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ScriptSense API",
    description="Backend API for Handwritten Answer Evaluation System with OCR & AI Semantic Scoring",
    version="1.0.0"
)

# 9.2 CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(students.router)
app.include_router(uploads.router)
app.include_router(evaluation.router)
app.include_router(results.router)
app.include_router(system.router)

# Mount uploads static directory
upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

import sqlite3
from datetime import datetime

def migrate_database_schema():
    """
    Safely adds any missing columns to existing SQLite tables and ensures data integrity.
    """
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scriptsense.db")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check users table
        cursor.execute("PRAGMA table_info(users);")
        user_cols = [col[1] for col in cursor.fetchall()]
        if "full_name" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN full_name VARCHAR(100);")
        if "email" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN email VARCHAR(120);")
        if "is_active" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1;")
        if "created_at" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN created_at DATETIME;")

        # Set default active status for existing users
        cursor.execute("UPDATE users SET is_active = 1 WHERE is_active IS NULL;")
        cursor.execute("UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL;")

        try:
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email);")
        except Exception:
            pass
            
        # Check final_results table
        cursor.execute("PRAGMA table_info(final_results);")
        res_cols = [col[1] for col in cursor.fetchall()]
        if "verified_by" not in res_cols:
            cursor.execute("ALTER TABLE final_results ADD COLUMN verified_by VARCHAR(50);")
        if "rubric_adjustments_json" not in res_cols:
            cursor.execute("ALTER TABLE final_results ADD COLUMN rubric_adjustments_json TEXT;")
        if "question_results_json" not in res_cols:
            cursor.execute("ALTER TABLE final_results ADD COLUMN question_results_json TEXT;")
            
        # Check answer_sheets table
        cursor.execute("PRAGMA table_info(answer_sheets);")
        sheet_cols = [col[1] for col in cursor.fetchall()]
        if "uploaded_by" not in sheet_cols:
            cursor.execute("ALTER TABLE answer_sheets ADD COLUMN uploaded_by VARCHAR(50);")
        if "teacher_id" not in sheet_cols:
            cursor.execute("ALTER TABLE answer_sheets ADD COLUMN teacher_id INTEGER REFERENCES users(id);")

        # Backfill answer_sheets.teacher_id from students.teacher_id where possible
        cursor.execute("""
            UPDATE answer_sheets 
            SET teacher_id = (SELECT students.teacher_id FROM students WHERE students.id = answer_sheets.student_id)
            WHERE answer_sheets.teacher_id IS NULL AND answer_sheets.student_id IS NOT NULL;
        """)

        # Check model_answers table
        cursor.execute("PRAGMA table_info(model_answers);")
        model_cols = [col[1] for col in cursor.fetchall()]
        if "title" not in model_cols:
            cursor.execute("ALTER TABLE model_answers ADD COLUMN title VARCHAR(200);")
        if "subject" not in model_cols:
            cursor.execute("ALTER TABLE model_answers ADD COLUMN subject VARCHAR(100);")
        if "questions_json" not in model_cols:
            cursor.execute("ALTER TABLE model_answers ADD COLUMN questions_json TEXT;")
        if "rubric_json" not in model_cols:
            cursor.execute("ALTER TABLE model_answers ADD COLUMN rubric_json TEXT;")

        # Check evaluations table
        cursor.execute("PRAGMA table_info(evaluations);")
        eval_cols = [col[1] for col in cursor.fetchall()]
        if "rubric_scores_json" not in eval_cols:
            cursor.execute("ALTER TABLE evaluations ADD COLUMN rubric_scores_json TEXT;")
        if "question_evaluations_json" not in eval_cols:
            cursor.execute("ALTER TABLE evaluations ADD COLUMN question_evaluations_json TEXT;")

        # Check students table
        cursor.execute("PRAGMA table_info(students);")
        student_cols = [col[1] for col in cursor.fetchall()]
        if "teacher_id" not in student_cols:
            cursor.execute("ALTER TABLE students ADD COLUMN teacher_id INTEGER REFERENCES users(id);")
        if "created_at" not in student_cols:
            cursor.execute("ALTER TABLE students ADD COLUMN created_at DATETIME;")

        cursor.execute("UPDATE students SET created_at = datetime('now') WHERE created_at IS NULL;")
            
        # Ensure non-unique index on roll_number and index on teacher_id
        try:
            cursor.execute("DROP INDEX IF EXISTS ix_students_roll_number;")
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_students_roll_number ON students (roll_number);")
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_students_teacher_id ON students (teacher_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_answer_sheets_teacher_id ON answer_sheets (teacher_id);")
        except Exception:
            pass

        # Migrate any remaining unassigned students to teacher1 (Dr. Sarah Smith)
        cursor.execute("SELECT id FROM users WHERE username = 'teacher1' LIMIT 1;")
        t1_row = cursor.fetchone()
        t1_id = t1_row[0] if t1_row else 1
        cursor.execute("UPDATE students SET teacher_id = ? WHERE teacher_id IS NULL;", (t1_id,))
        cursor.execute("UPDATE answer_sheets SET teacher_id = ? WHERE teacher_id IS NULL;", (t1_id,))

        conn.commit()
        conn.close()

# Execute schema updates
migrate_database_schema()


@app.on_event("startup")
def startup_seed_teacher_accounts():
    """
    Seeds default admin and teacher accounts and pre-warms EasyOCR model for instantaneous upload response.
    """
    migrate_database_schema()
    
    # Pre-warm EasyOCR neural network weights into memory
    try:
        from services.ocr_service import warmup_ocr_models
        warmup_ocr_models()
    except Exception as e:
        print(f"[STARTUP OCR WARMUP ERROR] {e}")

    db = SessionLocal()
    try:
        # 1. Seed Initial Admin Account
        admin_user = db.query(models.User).filter(
            (models.User.username == "admin") | (models.User.role == "admin")
        ).first()

        if not admin_user:
            admin_pwd = auth.get_password_hash("admin123")
            seeded_admin = models.User(
                username="admin",
                email="admin@scriptsense.com",
                password_hash=admin_pwd,
                role="admin",
                full_name="System Administrator",
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.add(seeded_admin)
            db.commit()
            print("Successfully seeded initial Admin account: 'admin' (admin@scriptsense.com)")
        else:
            if not admin_user.email:
                admin_user.email = "admin@scriptsense.com"
            if not admin_user.full_name:
                admin_user.full_name = "System Administrator"
            db.commit()

        # 2. Seed Default Teacher Accounts
        teachers_to_seed = [
            {"username": "teacher1", "email": "teacher1@scriptsense.com", "full_name": "Dr. Sarah Smith", "password": "secret123"},
            {"username": "teacher2", "email": "teacher2@scriptsense.com", "full_name": "Prof. David Johnson", "password": "secret123"},
        ]
        
        for t in teachers_to_seed:
            existing_user = db.query(models.User).filter(models.User.username == t["username"]).first()
            if not existing_user:
                hashed_pwd = auth.get_password_hash(t["password"])
                seeded_teacher = models.User(
                    username=t["username"],
                    email=t["email"],
                    password_hash=hashed_pwd,
                    role="teacher",
                    full_name=t["full_name"],
                    is_active=True,
                    created_at=datetime.utcnow()
                )
                db.add(seeded_teacher)
                db.commit()
                print(f"Successfully seeded teacher account: '{t['username']}' ({t['full_name']})")
            else:
                if not existing_user.full_name:
                    existing_user.full_name = t["full_name"]
                if not existing_user.email:
                    existing_user.email = t["email"]
                db.commit()
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "app": "ScriptSense Backend",
        "status": "online",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
