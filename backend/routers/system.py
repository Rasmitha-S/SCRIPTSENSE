import os
import shutil
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db, DATABASE_URL, BASE_DIR
import models
from routers.auth import get_current_user

router = APIRouter(prefix="/api/system", tags=["System & Storage"])

@router.get("/storage-status")
def get_system_storage_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns real-time database connection metrics, table counts, and disk storage usage.
    """
    # 1. Database metrics
    is_sqlite = "sqlite" in DATABASE_URL
    db_file_path = os.path.join(BASE_DIR, "scriptsense.db") if is_sqlite else "Cloud / Remote Database"
    db_size_kb = round(os.path.getsize(db_file_path) / 1024, 2) if (is_sqlite and os.path.exists(db_file_path)) else 0

    student_count = db.query(models.Student).count()
    sheet_count = db.query(models.AnswerSheet).count()
    model_count = db.query(models.ModelAnswer).count()
    eval_count = db.query(models.Evaluation).count()
    verified_count = db.query(models.FinalResult).count()
    user_count = db.query(models.User).count()

    # 2. File storage metrics
    upload_dir = os.path.join(BASE_DIR, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    
    upload_files = [f for f in os.listdir(upload_dir) if os.path.isfile(os.path.join(upload_dir, f))]
    total_storage_bytes = sum(os.path.getsize(os.path.join(upload_dir, f)) for f in upload_files)
    total_storage_mb = round(total_storage_bytes / (1024 * 1024), 2)

    return {
        "status": "Online & Healthy",
        "database": {
            "engine": "SQLite Relational Storage" if is_sqlite else "PostgreSQL Database",
            "connection_status": "Connected & Synchronized",
            "database_file": db_file_path,
            "database_size_kb": db_size_kb,
            "tables": {
                "users": user_count,
                "students": student_count,
                "answer_sheets": sheet_count,
                "model_answers": model_count,
                "evaluations": eval_count,
                "final_results": verified_count,
            }
        },
        "storage": {
            "storage_provider": "Local Persistent Disk Storage",
            "upload_directory": upload_dir,
            "total_files": len(upload_files),
            "storage_used_mb": total_storage_mb,
            "allowed_formats": ["PDF", "JPG", "JPEG", "PNG"],
        }
    }
