import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base directory for database and file storage
export const BASE_DIR = path.resolve(__dirname, '..', '..');

function getDatabasePath(): string {
  // If running in Vercel Serverless environment, ensure writable DB in /tmp
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDbPath = path.join('/tmp', 'scriptsense.db');
    const sourceDbPath = path.join(BASE_DIR, 'scriptsense.db');

    if (!fs.existsSync(tmpDbPath)) {
      if (fs.existsSync(sourceDbPath)) {
        try {
          fs.copyFileSync(sourceDbPath, tmpDbPath);
          console.log(`[DB] Copied initial database to writable serverless path: ${tmpDbPath}`);
        } catch (err) {
          console.warn('[DB] Failed to copy database to /tmp, initializing fresh DB:', err);
        }
      }
    }
    return tmpDbPath;
  }

  // Local development database path
  return path.join(BASE_DIR, 'scriptsense.db');
}

export const dbPath = getDatabasePath();
export const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode for reliability
try {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
} catch (e) {
  console.warn('[DB] Pragma setting note:', e);
}

// Type-safe DB helper methods
export function queryAll<T = any>(sql: string, ...params: any[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

export function queryOne<T = any>(sql: string, ...params: any[]): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined;
}

export function execute(sql: string, ...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint } {
  return db.prepare(sql).run(...params);
}

export function initDatabase() {
  // 1. Create Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(120) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'teacher',
      full_name VARCHAR(100),
      is_active BOOLEAN NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_name VARCHAR(200) NOT NULL,
      teacher_id INTEGER REFERENCES users(id),
      subject VARCHAR(100) DEFAULT 'General',
      max_marks FLOAT NOT NULL DEFAULT 10.0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER REFERENCES users(id),
      name VARCHAR(100) NOT NULL,
      roll_number VARCHAR(50),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS test_students (
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      PRIMARY KEY (test_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS answer_sheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      teacher_id INTEGER REFERENCES users(id),
      test_id INTEGER REFERENCES tests(id),
      student_name VARCHAR(100),
      file_path VARCHAR(255) NOT NULL,
      uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      extracted_text TEXT,
      uploaded_by VARCHAR(50)
    );

    CREATE TABLE IF NOT EXISTS model_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      answer_text TEXT NOT NULL,
      max_marks FLOAT NOT NULL DEFAULT 10.0,
      title VARCHAR(200),
      subject VARCHAR(100),
      questions_json TEXT,
      rubric_json TEXT
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      answer_sheet_id INTEGER NOT NULL REFERENCES answer_sheets(id) ON DELETE CASCADE,
      model_answer_id INTEGER NOT NULL REFERENCES model_answers(id),
      similarity FLOAT NOT NULL,
      suggested_marks FLOAT NOT NULL,
      explanation TEXT,
      rubric_scores_json TEXT,
      question_evaluations_json TEXT
    );

    CREATE TABLE IF NOT EXISTS final_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluation_id INTEGER UNIQUE NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
      final_marks FLOAT NOT NULL,
      teacher_feedback TEXT,
      verified_by VARCHAR(50),
      verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      rubric_adjustments_json TEXT,
      question_results_json TEXT
    );
  `);

  // 2. Safe Column Migrations
  const userCols = queryAll<{ name: string }>('PRAGMA table_info(users)').map(c => c.name);
  if (!userCols.includes('full_name')) db.exec('ALTER TABLE users ADD COLUMN full_name VARCHAR(100);');
  if (!userCols.includes('email')) db.exec('ALTER TABLE users ADD COLUMN email VARCHAR(120);');
  if (!userCols.includes('is_active')) db.exec('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1;');
  if (!userCols.includes('created_at')) db.exec('ALTER TABLE users ADD COLUMN created_at DATETIME;');

  const resCols = queryAll<{ name: string }>('PRAGMA table_info(final_results)').map(c => c.name);
  if (!resCols.includes('verified_by')) db.exec('ALTER TABLE final_results ADD COLUMN verified_by VARCHAR(50);');
  if (!resCols.includes('rubric_adjustments_json')) db.exec('ALTER TABLE final_results ADD COLUMN rubric_adjustments_json TEXT;');
  if (!resCols.includes('question_results_json')) db.exec('ALTER TABLE final_results ADD COLUMN question_results_json TEXT;');

  const sheetCols = queryAll<{ name: string }>('PRAGMA table_info(answer_sheets)').map(c => c.name);
  if (!sheetCols.includes('uploaded_by')) db.exec('ALTER TABLE answer_sheets ADD COLUMN uploaded_by VARCHAR(50);');
  if (!sheetCols.includes('teacher_id')) db.exec('ALTER TABLE answer_sheets ADD COLUMN teacher_id INTEGER REFERENCES users(id);');
  if (!sheetCols.includes('test_id')) db.exec('ALTER TABLE answer_sheets ADD COLUMN test_id INTEGER REFERENCES tests(id);');

  const modelCols = queryAll<{ name: string }>('PRAGMA table_info(model_answers)').map(c => c.name);
  if (!modelCols.includes('title')) db.exec('ALTER TABLE model_answers ADD COLUMN title VARCHAR(200);');
  if (!modelCols.includes('subject')) db.exec('ALTER TABLE model_answers ADD COLUMN subject VARCHAR(100);');
  if (!modelCols.includes('questions_json')) db.exec('ALTER TABLE model_answers ADD COLUMN questions_json TEXT;');
  if (!modelCols.includes('rubric_json')) db.exec('ALTER TABLE model_answers ADD COLUMN rubric_json TEXT;');
  if (!modelCols.includes('test_id')) db.exec('ALTER TABLE model_answers ADD COLUMN test_id INTEGER REFERENCES tests(id);');

  const evalCols = queryAll<{ name: string }>('PRAGMA table_info(evaluations)').map(c => c.name);
  if (!evalCols.includes('rubric_scores_json')) db.exec('ALTER TABLE evaluations ADD COLUMN rubric_scores_json TEXT;');
  if (!evalCols.includes('question_evaluations_json')) db.exec('ALTER TABLE evaluations ADD COLUMN question_evaluations_json TEXT;');

  const studentCols = queryAll<{ name: string }>('PRAGMA table_info(students)').map(c => c.name);
  if (!studentCols.includes('teacher_id')) db.exec('ALTER TABLE students ADD COLUMN teacher_id INTEGER REFERENCES users(id);');
  if (!studentCols.includes('created_at')) db.exec('ALTER TABLE students ADD COLUMN created_at DATETIME;');

  // 3. Create Indexes
  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username);
      CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);
      CREATE INDEX IF NOT EXISTS ix_students_roll_number ON students (roll_number);
      CREATE INDEX IF NOT EXISTS ix_students_teacher_id ON students (teacher_id);
      CREATE INDEX IF NOT EXISTS ix_answer_sheets_teacher_id ON answer_sheets (teacher_id);
      CREATE INDEX IF NOT EXISTS ix_answer_sheets_test_id ON answer_sheets (test_id);
      CREATE INDEX IF NOT EXISTS ix_model_answers_test_id ON model_answers (test_id);
      CREATE INDEX IF NOT EXISTS ix_tests_teacher_id ON tests (teacher_id);
    `);
  } catch (e) {
    // Indexes already exist or created
  }

  // 4. Backfill Relationships
  db.exec(`
    UPDATE answer_sheets 
    SET teacher_id = (SELECT students.teacher_id FROM students WHERE students.id = answer_sheets.student_id)
    WHERE answer_sheets.teacher_id IS NULL AND answer_sheets.student_id IS NOT NULL;
  `);

  // 5. Seed Initial Admin Account if missing
  const adminUser = queryOne('SELECT * FROM users WHERE username = ? OR role = ? LIMIT 1', 'admin', 'admin');
  if (!adminUser) {
    const adminPwdHash = bcrypt.hashSync('admin123', 10);
    execute(`
      INSERT INTO users (username, email, password_hash, role, full_name, is_active, created_at)
      VALUES (?, ?, ?, 'admin', ?, 1, datetime('now'))
    `, 'admin', 'admin@scriptsense.com', adminPwdHash, 'System Administrator');
    console.log("[DB] Seeded initial Admin account: 'admin' (admin@scriptsense.com)");
  }

  // 6. Seed Default Teacher Accounts if missing
  const defaultTeachers = [
    { username: 'teacher1', email: 'teacher1@scriptsense.com', full_name: 'Dr. Sarah Smith', password: 'secret123' },
    { username: 'teacher2', email: 'teacher2@scriptsense.com', full_name: 'Prof. David Johnson', password: 'secret123' }
  ];

  for (const t of defaultTeachers) {
    const existing = queryOne('SELECT * FROM users WHERE username = ? LIMIT 1', t.username);
    if (!existing) {
      const pwdHash = bcrypt.hashSync(t.password, 10);
      execute(`
        INSERT INTO users (username, email, password_hash, role, full_name, is_active, created_at)
        VALUES (?, ?, ?, 'teacher', ?, 1, datetime('now'))
      `, t.username, t.email, pwdHash, t.full_name);
      console.log(`[DB] Seeded default Teacher account: '${t.username}' (${t.full_name})`);
    }
  }

  // 7. Migrate any remaining unassigned students to teacher1
  const t1 = queryOne('SELECT id FROM users WHERE username = ? LIMIT 1', 'teacher1');
  const t1Id = t1 ? t1.id : 1;
  execute('UPDATE students SET teacher_id = ? WHERE teacher_id IS NULL', t1Id);
  execute('UPDATE answer_sheets SET teacher_id = ? WHERE teacher_id IS NULL', t1Id);

  console.log('[DB] SQLite database initialized and synchronized.');
}

// Automatically initialize on import
initDatabase();
