import sqlite3
import os
from database import engine, Base, SessionLocal
import models

def migrate_database():
    print("=== Migrating Database for Students Table ===")
    
    # 1. Create tables with Base metadata
    Base.metadata.create_all(bind=engine)
    print("[OK] Base.metadata.create_all executed.")

    # 2. Check if answer_sheets has student_id column using raw SQLite PRAGMA
    db_path = os.path.join(os.path.dirname(__file__), "scriptsense.db")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(answer_sheets);")
        columns = [col[1] for col in cursor.fetchall()]
        
        if "student_id" not in columns:
            print("[INFO] Adding 'student_id' column to 'answer_sheets' table...")
            cursor.execute("ALTER TABLE answer_sheets ADD COLUMN student_id INTEGER REFERENCES students(id);")
            conn.commit()
            print("[OK] 'student_id' column successfully added.")
        else:
            print("[OK] 'student_id' column already exists in 'answer_sheets'.")

        cursor.execute("PRAGMA table_info(students);")
        student_columns = [col[1] for col in cursor.fetchall()]
        if "teacher_id" not in student_columns:
            print("[INFO] Adding 'teacher_id' column to 'students' table...")
            cursor.execute("ALTER TABLE students ADD COLUMN teacher_id INTEGER REFERENCES users(id);")
            conn.commit()
            print("[OK] 'teacher_id' column successfully added.")

        # Ensure indexes
        try:
            cursor.execute("DROP INDEX IF EXISTS ix_students_roll_number;")
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_students_roll_number ON students (roll_number);")
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_students_teacher_id ON students (teacher_id);")
            conn.commit()
        except Exception:
            pass
        
        conn.close()

    # 3. Migrate existing answer sheets and assign students to teacher1
    db = SessionLocal()
    try:
        teacher1 = db.query(models.User).filter(models.User.username == "teacher1").first()
        t1_id = teacher1.id if teacher1 else 1

        # Migrate unassigned students to teacher1
        unassigned_students = db.query(models.Student).filter(models.Student.teacher_id == None).all()
        for st in unassigned_students:
            st.teacher_id = t1_id
            print(f"  -> Assigned existing Student #{st.id} ({st.name}) to Teacher ID #{t1_id} (teacher1)")
        db.commit()

        sheets = db.query(models.AnswerSheet).all()
        print(f"[INFO] Checking {len(sheets)} existing answer sheets for student links...")
        
        # Roll number mapping dictionary for known test/demo students
        demo_roll_numbers = {
            "Alex Rivera": "CS2026-0101",
            "Jane Doe": "CS2026-0102",
            "Marcus Vance": "PH2026-0201",
            "Elena Rostova": "CS2026-0301",
        }
        
        for sheet in sheets:
            if not sheet.student_id:
                name = sheet.student_name.strip() if sheet.student_name else "Anonymous Student"
                roll = demo_roll_numbers.get(name, None)
                
                # Check if student already exists for teacher1
                student = db.query(models.Student).filter(models.Student.teacher_id == t1_id, models.Student.name == name).first()
                if not student:
                    student = models.Student(name=name, roll_number=roll, teacher_id=t1_id)
                    db.add(student)
                    db.commit()
                    db.refresh(student)
                    print(f"  -> Created student '{student.name}' (ID: #{student.id}, Roll: {student.roll_number}, Teacher: #{t1_id})")
                
                sheet.student_id = student.id
                db.commit()
                print(f"  -> Linked AnswerSheet #{sheet.id} to Student #{student.id} ({student.name})")

        print("[OK] All answer sheets successfully linked to students.")

        # Print all students in database
        all_students = db.query(models.Student).all()
        print(f"\n[SUMMARY] Total Students in Database: {len(all_students)}")
        for st in all_students:
            sheet_count = db.query(models.AnswerSheet).filter(models.AnswerSheet.student_id == st.id).count()
            print(f" - Student #{st.id}: {st.name} (Roll: {st.roll_number}) [Sheets: {sheet_count}]")

    finally:
        db.close()

    print("\n=== Students Migration Complete ===")

if __name__ == "__main__":
    migrate_database()
