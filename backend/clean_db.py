import sqlite3
import os

DB_PATH = "scriptsense.db"

def clean_database():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("PRAGMA foreign_keys = ON;")

    print("==================================================")
    print("      SCRIPTSENSE DATABASE CLEANUP SCRIPT         ")
    print("==================================================")

    # 1. Fetch current students
    current_students = c.execute("SELECT id, name, roll_number FROM students ORDER BY id").fetchall()
    print(f"\n[1] Current Students in DB before cleanup ({len(current_students)} total):")
    for s in current_students:
        print(f"    - ID #{s[0]}: {s[1]} (Roll: {s[2]})")

    # Real students to preserve: 'madhu' and 'Sanjay' (or any non-test student)
    # Define test name patterns
    test_name_keywords = [
        "sarah connor",
        "alex rivera",
        "jane doe",
        "marcus vance",
        "elena rostova",
        "anonymous student",
        "elena gilbert",
        "student ",
        "batch student",
        "oliver queen",
        "jordan hayes",
        "sam altman",
        "marcus aurelius",
        "cnn test student",
        "cnn evaluated student",
        "crnn test student",
        "messy handwriting",
        "maria curie"
    ]

    def is_test_student(name, roll):
        if not name:
            return True
        n = name.strip().lower()
        r = (roll or "").strip().lower()
        if r.startswith("test-") or r.startswith("mq-stu-") or r.startswith("cnn-") or r.startswith("crnn-") or r.startswith("messy-") or r.startswith("clean-") or r.startswith("cs2026-jh"):
            return True
        for kw in test_name_keywords:
            if kw in n:
                return True
        return False

    students_to_delete = []
    students_to_keep = []
    seen_names = set()
    seen_rolls = set()

    for s_id, s_name, s_roll in current_students:
        name_clean = (s_name or "").strip().lower()
        roll_clean = (s_roll or "").strip().lower()

        if is_test_student(s_name, s_roll):
            students_to_delete.append(s_id)
        elif (name_clean and name_clean in seen_names) or (roll_clean and roll_clean in seen_rolls):
            # Duplicate
            students_to_delete.append(s_id)
        else:
            students_to_keep.append((s_id, s_name, s_roll))
            if name_clean:
                seen_names.add(name_clean)
            if roll_clean:
                seen_rolls.add(roll_clean)

    print(f"\n[2] Students identified for deletion: {len(students_to_delete)} records")
    print(f"    Preserving genuine students: {len(students_to_keep)} records -> {[s[1] for s in students_to_keep]}")

    # Delete foreign key linked final_results and evaluations
    # Find all answer sheets belonging to deleted students or test answer sheets
    sheet_ids_to_delete = [
        row[0] for row in c.execute("SELECT id FROM answer_sheets WHERE student_id IN ({seq})".format(
            seq=','.join(['?']*len(students_to_delete))
        ), students_to_delete).fetchall()
    ] if students_to_delete else []

    # Also find answer sheets without student_id or with test student names
    for row in c.execute("SELECT id, student_name FROM answer_sheets").fetchall():
        s_id = row[0]
        s_name = (row[1] or "").lower()
        if s_id not in sheet_ids_to_delete:
            for kw in test_name_keywords:
                if kw in s_name:
                    sheet_ids_to_delete.append(s_id)
                    break

    print(f"[3] Answer Sheets identified for deletion: {len(sheet_ids_to_delete)} records")

    # Find evaluations linked to these sheets or test model answers
    eval_ids_to_delete = [
        row[0] for row in c.execute("SELECT id FROM evaluations WHERE answer_sheet_id IN ({seq})".format(
            seq=','.join(['?']*len(sheet_ids_to_delete))
        ), sheet_ids_to_delete).fetchall()
    ] if sheet_ids_to_delete else []

    # Final results linked to these evaluations
    if eval_ids_to_delete:
        c.execute("DELETE FROM final_results WHERE evaluation_id IN ({seq})".format(
            seq=','.join(['?']*len(eval_ids_to_delete))
        ), eval_ids_to_delete)
        print(f"    - Deleted final_results linked to test evaluations.")

        c.execute("DELETE FROM evaluations WHERE id IN ({seq})".format(
            seq=','.join(['?']*len(eval_ids_to_delete))
        ), eval_ids_to_delete)
        print(f"    - Deleted {len(eval_ids_to_delete)} test evaluations.")

    # Also clean any remaining evaluations/final_results
    c.execute("DELETE FROM final_results WHERE evaluation_id NOT IN (SELECT id FROM evaluations)")

    # Delete answer sheets
    if sheet_ids_to_delete:
        c.execute("DELETE FROM answer_sheets WHERE id IN ({seq})".format(
            seq=','.join(['?']*len(sheet_ids_to_delete))
        ), sheet_ids_to_delete)
        print(f"    - Deleted {len(sheet_ids_to_delete)} test answer sheets.")

    # Delete test students
    if students_to_delete:
        c.execute("DELETE FROM students WHERE id IN ({seq})".format(
            seq=','.join(['?']*len(students_to_delete))
        ), students_to_delete)
        print(f"    - Deleted {len(students_to_delete)} dummy student records.")

    # Clean test model answers
    total_models_before = c.execute("SELECT count(*) FROM model_answers").fetchone()[0]
    # Delete test model answers
    c.execute("DELETE FROM final_results WHERE evaluation_id IN (SELECT id FROM evaluations WHERE model_answer_id IN (SELECT id FROM model_answers))")
    c.execute("DELETE FROM evaluations WHERE model_answer_id IN (SELECT id FROM model_answers)")
    c.execute("DELETE FROM model_answers")
    print(f"[4] Cleared {total_models_before} test model_answers from database.")

    # Clean temporary multi-teacher test accounts (prof_xxxxx) while keeping teacher1, teacher2, teacher3
    c.execute("DELETE FROM users WHERE username LIKE 'prof_%'")
    print("[5] Cleaned temporary test prof_* user accounts. Main teacher accounts preserved.")

    conn.commit()

    # Final verification summary
    final_students = c.execute("SELECT id, name, roll_number FROM students ORDER BY id").fetchall()
    final_models = c.execute("SELECT id, title, question, max_marks FROM model_answers").fetchall()
    final_sheets = c.execute("SELECT count(*) FROM answer_sheets").fetchone()[0]
    final_evals = c.execute("SELECT count(*) FROM evaluations").fetchone()[0]
    final_results = c.execute("SELECT count(*) FROM final_results").fetchone()[0]
    final_users = c.execute("SELECT id, username, role, full_name FROM users ORDER BY id").fetchall()

    print("\n==================================================")
    print("             FINAL CLEANUP SUMMARY                ")
    print("==================================================")
    print(f"Students in DB ({len(final_students)}):")
    for s in final_students:
        print(f"  - ID #{s[0]}: {s[1]} (Roll: {s[2]})")

    print(f"\nModel Answers in DB ({len(final_models)}):")
    if not final_models:
        print("  - [Clean / Empty - Ready for new exam papers]")
    else:
        for m in final_models:
            print(f"  - ID #{m[0]}: {m[1]} ({m[3]} Marks)")

    print(f"\nAnswer Sheets in DB: {final_sheets}")
    print(f"Evaluations in DB: {final_evals}")
    print(f"Final Results in DB: {final_results}")

    print(f"\nTeacher Users in DB ({len(final_users)}):")
    for u in final_users:
        print(f"  - ID #{u[0]}: {u[1]} ({u[2]} - {u[3]})")

    conn.close()

if __name__ == "__main__":
    clean_database()
