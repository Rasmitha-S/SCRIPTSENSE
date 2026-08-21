# ScriptSense 🎓📝
**AI-Powered Handwritten Answer Sheet Evaluation System**

ScriptSense is an automated and teacher-in-the-loop grading platform that digitizes handwritten examination scripts via OCR and provides semantic AI evaluation using Sentence Transformers embeddings and step-wise rubrics.

---

## 🚀 Quick Start & Build

### 1. One-Click Build & Verification
To build the frontend bundle and verify all backend modules:
```powershell
.\build.bat
```

### 2. Launch Development Environment
To run both the FastAPI Backend and Vite Frontend simultaneously:
```powershell
.\start_dev.bat
```

- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Backend API & Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🛠 Project Structure

```
ScriptSense/
├── backend/                  # FastAPI Application
│   ├── database.py           # SQLite SQLAlchemy Engine & Session
│   ├── models.py             # Relational Database Models
│   ├── schemas.py            # Pydantic Schemas & Validations
│   ├── main.py               # Application Entrypoint & Startup Seeds
│   ├── routers/              # Modular API Endpoints
│   │   ├── auth.py           # JWT Authentication & Teacher Accounts
│   │   ├── students.py       # Student Profiles & Portal Access
│   │   ├── uploads.py        # Answer Sheet Upload & OCR Processing
│   │   ├── evaluation.py     # AI Semantic Scoring & Batch Processing
│   │   ├── results.py        # Score Confirmation, Edits & CSV Export
│   │   └── system.py         # System Storage Diagnostics
│   ├── services/
│   │   ├── evaluation_service.py # Sentence Transformers & Multi-Question Rubrics
│   │   ├── ocr_service.py        # Tesseract & PDF2Image Pipeline
│   │   └── file_service.py       # File Storage Management
│   └── test_*.py             # Full Verification Test Suites
│
├── frontend/                 # React 18 + Vite + TailwindCSS
│   ├── src/
│   │   ├── pages/            # Dashboard, Upload, Evaluation, Results, Student Portal
│   │   ├── components/       # Reusable UI & Navigation Components
│   │   ├── context/          # Auth Context & JWT Session State
│   │   └── services/api.js   # Axios API Client
│   └── package.json
│
├── build.bat                 # Unified Build & Test Script
├── start_dev.bat             # Dual Server Startup Script
└── README.md
```

---

## 🔑 Default Credentials

- **Admin**: `admin` / `admin@scriptsense.com` | Password: `admin123` (System Administrator - Global Control Hub)
- **Teacher 1**: `teacher1` / `teacher1@scriptsense.com` | Password: `secret123` (Dr. Sarah Smith)
- **Teacher 2**: `teacher2` / `teacher2@scriptsense.com` | Password: `secret123` (Prof. David Johnson)
- **Student Portal**: Access using assigned Roll Number (e.g. from Students directory).

---

## 🧪 Running Test Suites

Run individual automated test suites inside `backend/`:

```powershell
cd backend
python test_complete_role_and_ownership.py
python test_teacher_student_isolation.py
python test_integration_inproc.py
python test_multi_question_rubrics.py
python test_batch_and_export.py
```
