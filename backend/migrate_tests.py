import sqlite3
from database import Base, engine
import models

def migrate():
    print("=== Running Test Workflow Database Migration ===")
    Base.metadata.create_all(bind=engine)
    print("[OK] Base.metadata.create_all executed.")

    conn = sqlite3.connect('scriptsense.db')
    c = conn.cursor()

    # Check and add test_id column to answer_sheets
    c.execute("PRAGMA table_info(answer_sheets)")
    cols = [r[1] for r in c.fetchall()]
    if 'test_id' not in cols:
        c.execute("ALTER TABLE answer_sheets ADD COLUMN test_id INTEGER REFERENCES tests(id)")
        print("[OK] Added 'test_id' column to 'answer_sheets'.")
    else:
        print("[INFO] 'test_id' column already exists in 'answer_sheets'.")

    # Check and add test_id column to model_answers
    c.execute("PRAGMA table_info(model_answers)")
    cols = [r[1] for r in c.fetchall()]
    if 'test_id' not in cols:
        c.execute("ALTER TABLE model_answers ADD COLUMN test_id INTEGER REFERENCES tests(id)")
        print("[OK] Added 'test_id' column to 'model_answers'.")
    else:
        print("[INFO] 'test_id' column already exists in 'model_answers'.")

    conn.commit()
    conn.close()
    print("=== Test Migration Completed Successfully ===")

if __name__ == '__main__':
    migrate()
