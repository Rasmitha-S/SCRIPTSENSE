import sqlite3

def check():
    conn = sqlite3.connect('scriptsense.db')
    c = conn.cursor()
    print("Tables:")
    for t in c.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall():
        print(f" - {t[0]}")
    
    print("\nUsers:")
    for u in c.execute("SELECT id, username, role FROM users").fetchall():
        print(f" - User #{u[0]}: {u[1]} ({u[2]})")

    print("\nAnswer Sheets:")
    for a in c.execute("SELECT id, student_name, file_path, extracted_text FROM answer_sheets").fetchall():
        print(f" - Sheet #{a[0]}: {a[1]} | File: {a[2]} | Text: {a[3][:60]}...")

    print("\nModel Answers:")
    for m in c.execute("SELECT id, question, max_marks FROM model_answers").fetchall():
        print(f" - Model #{m[0]}: {m[1][:40]}... (Max: {m[2]}M)")

    print("\nEvaluations:")
    for e in c.execute("SELECT id, answer_sheet_id, model_answer_id, similarity, suggested_marks FROM evaluations").fetchall():
        print(f" - Eval #{e[0]}: Sheet {e[1]} vs Model {e[2]} -> Sim: {e[3]}, Suggested: {e[4]}")

    print("\nFinal Results:")
    for f in c.execute("SELECT id, evaluation_id, final_marks, teacher_feedback, verified_at FROM final_results").fetchall():
        print(f" - Result #{f[0]}: Eval {f[1]} -> Final: {f[2]} | Feedback: {f[3]} | Time: {f[4]}")

if __name__ == "__main__":
    check()
