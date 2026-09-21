import { Router, Response } from 'express';
import { queryOne, queryAll, execute } from '../database/index.js';
import { requireAdmin, hashPassword, AuthenticatedRequest } from '../middleware/auth.js';
import { User } from '../types/index.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

// GET /api/admin/stats
adminRouter.get('/stats', (_req: AuthenticatedRequest, res: Response): void => {
  const teachersCount = (queryOne<{ count: number }>("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'") || { count: 0 }).count;
  const studentsCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM students') || { count: 0 }).count;
  const sheetsCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM answer_sheets') || { count: 0 }).count;
  const evalsCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM evaluations') || { count: 0 }).count;
  const resultsCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM final_results') || { count: 0 }).count;

  res.json({
    total_teachers: teachersCount,
    total_students: studentsCount,
    total_answer_sheets: sheetsCount,
    total_evaluations: evalsCount,
    total_verified_results: resultsCount
  });
});

// GET /api/admin/teachers
adminRouter.get('/teachers', (_req: AuthenticatedRequest, res: Response): void => {
  const teachers = queryAll<User>("SELECT * FROM users WHERE role = 'teacher' ORDER BY id DESC");
  const results = teachers.map(t => {
    const studentCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM students WHERE teacher_id = ?', t.id) || { count: 0 }).count;
    const uploadCount = (queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM answer_sheets 
      JOIN students ON answer_sheets.student_id = students.id 
      WHERE students.teacher_id = ?
    `, t.id) || { count: 0 }).count;

    return {
      id: t.id,
      name: t.full_name || t.username,
      username: t.username,
      email: t.email,
      role: t.role,
      is_active: Boolean(t.is_active),
      created_at: t.created_at,
      student_count: studentCount,
      upload_count: uploadCount
    };
  });

  res.json(results);
});

// POST /api/admin/teachers
adminRouter.post('/teachers', (req: AuthenticatedRequest, res: Response): void => {
  const { name, username, email, password, role } = req.body;
  const cleanUsername = (username || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (name || '').trim();

  if (!cleanUsername) {
    res.status(400).json({ detail: 'Username cannot be empty.' });
    return;
  }
  if (!cleanEmail) {
    res.status(400).json({ detail: 'Email cannot be empty.' });
    return;
  }
  if (!password || password.length < 4) {
    res.status(400).json({ detail: 'Password must be at least 4 characters.' });
    return;
  }

  const existingU = queryOne('SELECT id FROM users WHERE username = ? LIMIT 1', cleanUsername);
  if (existingU) {
    res.status(400).json({ detail: 'Username or email already exists.' });
    return;
  }

  const existingE = queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', cleanEmail);
  if (existingE) {
    res.status(400).json({ detail: 'Username or email already exists.' });
    return;
  }

  const pwdHash = hashPassword(password);
  const userRole = role || 'teacher';
  const nameVal = cleanName || cleanUsername;

  const result = execute(`
    INSERT INTO users (username, email, password_hash, role, full_name, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
  `, cleanUsername, cleanEmail, pwdHash, userRole, nameVal);

  const newId = Number(result.lastInsertRowid);
  const created = queryOne<User>('SELECT * FROM users WHERE id = ?', newId)!;

  res.status(201).json({
    id: created.id,
    name: created.full_name || created.username,
    username: created.username,
    email: created.email,
    role: created.role,
    is_active: Boolean(created.is_active),
    created_at: created.created_at,
    student_count: 0,
    upload_count: 0
  });
});

// PUT /api/admin/teachers/:id
adminRouter.put('/teachers/:id', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = parseInt(req.params.id, 10);
  const teacher = queryOne<User>('SELECT * FROM users WHERE id = ?', teacherId);

  if (!teacher) {
    res.status(404).json({ detail: `Teacher with ID ${teacherId} not found.` });
    return;
  }

  const { username, email, name, is_active, password } = req.body;

  if (username !== undefined) {
    const cleanUser = username.trim();
    if (!cleanUser) {
      res.status(400).json({ detail: 'Username cannot be empty.' });
      return;
    }
    const existing = queryOne('SELECT id FROM users WHERE username = ? AND id != ?', cleanUser, teacherId);
    if (existing) {
      res.status(400).json({ detail: 'Username or email already exists.' });
      return;
    }
    execute('UPDATE users SET username = ? WHERE id = ?', cleanUser, teacherId);
  }

  if (email !== undefined) {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      res.status(400).json({ detail: 'Email cannot be empty.' });
      return;
    }
    const existing = queryOne('SELECT id FROM users WHERE email = ? AND id != ?', cleanEmail, teacherId);
    if (existing) {
      res.status(400).json({ detail: 'Username or email already exists.' });
      return;
    }
    execute('UPDATE users SET email = ? WHERE id = ?', cleanEmail, teacherId);
  }

  if (name !== undefined) {
    execute('UPDATE users SET full_name = ? WHERE id = ?', name.trim(), teacherId);
  }

  if (is_active !== undefined) {
    execute('UPDATE users SET is_active = ? WHERE id = ?', is_active ? 1 : 0, teacherId);
  }

  if (password && password.trim().length >= 4) {
    const newHash = hashPassword(password.trim());
    execute('UPDATE users SET password_hash = ? WHERE id = ?', newHash, teacherId);
  }

  const updated = queryOne<User>('SELECT * FROM users WHERE id = ?', teacherId)!;
  const studentCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM students WHERE teacher_id = ?', teacherId) || { count: 0 }).count;
  const uploadCount = (queryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM answer_sheets 
    JOIN students ON answer_sheets.student_id = students.id 
    WHERE students.teacher_id = ?
  `, teacherId) || { count: 0 }).count;

  res.json({
    id: updated.id,
    name: updated.full_name || updated.username,
    username: updated.username,
    email: updated.email,
    role: updated.role,
    is_active: Boolean(updated.is_active),
    created_at: updated.created_at,
    student_count: studentCount,
    upload_count: uploadCount
  });
});

// DELETE /api/admin/teachers/:id
adminRouter.delete('/teachers/:id', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = parseInt(req.params.id, 10);
  const teacher = queryOne<User>('SELECT * FROM users WHERE id = ?', teacherId);

  if (!teacher) {
    res.status(404).json({ detail: `Teacher with ID ${teacherId} not found.` });
    return;
  }

  if (teacher.id === req.user!.id) {
    res.status(400).json({ detail: 'Admin cannot delete their own active account.' });
    return;
  }

  const teacherName = teacher.full_name || teacher.username;

  // Clean up associated student data
  const students = queryAll<{ id: number }>('SELECT id FROM students WHERE teacher_id = ?', teacherId);
  for (const st of students) {
    const sheets = queryAll<{ id: number }>('SELECT id FROM answer_sheets WHERE student_id = ?', st.id);
    for (const sh of sheets) {
      const evals = queryAll<{ id: number }>('SELECT id FROM evaluations WHERE answer_sheet_id = ?', sh.id);
      for (const ev of evals) {
        execute('DELETE FROM final_results WHERE evaluation_id = ?', ev.id);
        execute('DELETE FROM evaluations WHERE id = ?', ev.id);
      }
      execute('DELETE FROM answer_sheets WHERE id = ?', sh.id);
    }
    execute('DELETE FROM students WHERE id = ?', st.id);
  }

  execute('DELETE FROM users WHERE id = ?', teacherId);

  res.json({
    message: `Teacher '${teacherName}' (ID: ${teacherId}) and associated data removed successfully.`,
    success: true
  });
});

// GET /api/admin/students
adminRouter.get('/students', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.query.teacher_id ? parseInt(req.query.teacher_id as string, 10) : null;
  let students: any[];

  if (teacherId) {
    students = queryAll(`
      SELECT students.*, users.full_name as teacher_full_name, users.username as teacher_username 
      FROM students 
      LEFT JOIN users ON students.teacher_id = users.id 
      WHERE students.teacher_id = ? 
      ORDER BY students.id DESC
    `, teacherId);
  } else {
    students = queryAll(`
      SELECT students.*, users.full_name as teacher_full_name, users.username as teacher_username 
      FROM students 
      LEFT JOIN users ON students.teacher_id = users.id 
      ORDER BY students.id DESC
    `);
  }

  const result = students.map(s => {
    const uploadCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM answer_sheets WHERE student_id = ?', s.id) || { count: 0 }).count;
    const teacherName = s.teacher_full_name || s.teacher_username || 'Unassigned';

    return {
      id: s.id,
      teacher_id: s.teacher_id,
      teacher_name: teacherName,
      teacher_username: s.teacher_username || null,
      name: s.name,
      roll_number: s.roll_number,
      upload_count: uploadCount,
      created_at: s.created_at
    };
  });

  res.json(result);
});

// GET /api/admin/answer-sheets
adminRouter.get('/answer-sheets', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.query.teacher_id ? parseInt(req.query.teacher_id as string, 10) : null;
  let sheets: any[];

  if (teacherId) {
    sheets = queryAll(`
      SELECT answer_sheets.*, students.name as st_name, students.roll_number as st_roll,
             users.id as t_id, users.full_name as teacher_full_name, users.username as teacher_username
      FROM answer_sheets
      LEFT JOIN students ON answer_sheets.student_id = students.id
      LEFT JOIN users ON (answer_sheets.teacher_id = users.id OR students.teacher_id = users.id)
      WHERE answer_sheets.teacher_id = ? OR students.teacher_id = ?
      ORDER BY answer_sheets.id DESC
    `, teacherId, teacherId);
  } else {
    sheets = queryAll(`
      SELECT answer_sheets.*, students.name as st_name, students.roll_number as st_roll,
             users.id as t_id, users.full_name as teacher_full_name, users.username as teacher_username
      FROM answer_sheets
      LEFT JOIN students ON answer_sheets.student_id = students.id
      LEFT JOIN users ON (answer_sheets.teacher_id = users.id OR students.teacher_id = users.id)
      ORDER BY answer_sheets.id DESC
    `);
  }

  const result = sheets.map(sh => {
    const teacherName = sh.teacher_full_name || sh.teacher_username || 'Unassigned';
    return {
      id: sh.id,
      student_id: sh.student_id,
      student_name: sh.st_name || sh.student_name,
      roll_number: sh.st_roll || null,
      teacher_id: sh.t_id || null,
      teacher_name: teacherName,
      file_path: sh.file_path,
      filename: sh.file_path ? sh.file_path.split('/').pop() : null,
      extracted_text: sh.extracted_text,
      uploaded_at: sh.uploaded_at
    };
  });

  res.json(result);
});

// GET /api/admin/evaluations
adminRouter.get('/evaluations', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.query.teacher_id ? parseInt(req.query.teacher_id as string, 10) : null;
  let evals: any[];

  if (teacherId) {
    evals = queryAll(`
      SELECT evaluations.*, answer_sheets.student_id, answer_sheets.student_name as sh_st_name,
             students.name as st_name, students.roll_number as st_roll,
             model_answers.title as ma_title, model_answers.question as ma_question, model_answers.max_marks as ma_max_marks,
             final_results.final_marks as fr_final_marks,
             users.id as t_id, users.full_name as teacher_full_name, users.username as teacher_username
      FROM evaluations
      JOIN answer_sheets ON evaluations.answer_sheet_id = answer_sheets.id
      LEFT JOIN students ON answer_sheets.student_id = students.id
      LEFT JOIN model_answers ON evaluations.model_answer_id = model_answers.id
      LEFT JOIN final_results ON evaluations.id = final_results.evaluation_id
      LEFT JOIN users ON (answer_sheets.teacher_id = users.id OR students.teacher_id = users.id)
      WHERE answer_sheets.teacher_id = ? OR students.teacher_id = ?
      ORDER BY evaluations.id DESC
    `, teacherId, teacherId);
  } else {
    evals = queryAll(`
      SELECT evaluations.*, answer_sheets.student_id, answer_sheets.student_name as sh_st_name,
             students.name as st_name, students.roll_number as st_roll,
             model_answers.title as ma_title, model_answers.question as ma_question, model_answers.max_marks as ma_max_marks,
             final_results.final_marks as fr_final_marks,
             users.id as t_id, users.full_name as teacher_full_name, users.username as teacher_username
      FROM evaluations
      JOIN answer_sheets ON evaluations.answer_sheet_id = answer_sheets.id
      LEFT JOIN students ON answer_sheets.student_id = students.id
      LEFT JOIN model_answers ON evaluations.model_answer_id = model_answers.id
      LEFT JOIN final_results ON evaluations.id = final_results.evaluation_id
      LEFT JOIN users ON (answer_sheets.teacher_id = users.id OR students.teacher_id = users.id)
      ORDER BY evaluations.id DESC
    `);
  }

  const result = evals.map(ev => {
    const teacherName = ev.teacher_full_name || ev.teacher_username || 'Unassigned';
    const finalM = ev.fr_final_marks !== null && ev.fr_final_marks !== undefined ? ev.fr_final_marks : null;
    const statusVal = finalM !== null ? 'Verified' : 'Evaluated';

    return {
      id: ev.id,
      answer_sheet_id: ev.answer_sheet_id,
      student_id: ev.student_id,
      student_name: ev.st_name || ev.sh_st_name || 'Unknown',
      roll_number: ev.st_roll || null,
      teacher_id: ev.t_id || null,
      teacher_name: teacherName,
      title: ev.ma_title || (ev.ma_question ? ev.ma_question.slice(0, 40) : 'Standard Exam'),
      similarity: ev.similarity,
      suggested_marks: ev.suggested_marks,
      max_marks: ev.ma_max_marks || 10.0,
      explanation: ev.explanation,
      final_marks: finalM,
      status: statusVal
    };
  });

  res.json(result);
});

// GET /api/admin/results
adminRouter.get('/results', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.query.teacher_id ? parseInt(req.query.teacher_id as string, 10) : null;
  let evals: any[];

  if (teacherId) {
    evals = queryAll(`
      SELECT evaluations.*, answer_sheets.student_id, answer_sheets.student_name as sh_st_name,
             students.name as st_name, students.roll_number as st_roll,
             model_answers.title as ma_title, model_answers.question as ma_question, model_answers.max_marks as ma_max_marks,
             final_results.id as fr_id, final_results.final_marks as fr_final_marks,
             final_results.teacher_feedback as fr_teacher_feedback, final_results.verified_by as fr_verified_by,
             final_results.verified_at as fr_verified_at,
             users.id as t_id, users.full_name as teacher_full_name, users.username as teacher_username
      FROM evaluations
      JOIN answer_sheets ON evaluations.answer_sheet_id = answer_sheets.id
      LEFT JOIN students ON answer_sheets.student_id = students.id
      LEFT JOIN model_answers ON evaluations.model_answer_id = model_answers.id
      LEFT JOIN final_results ON evaluations.id = final_results.evaluation_id
      LEFT JOIN users ON (answer_sheets.teacher_id = users.id OR students.teacher_id = users.id)
      WHERE answer_sheets.teacher_id = ? OR students.teacher_id = ?
      ORDER BY evaluations.id DESC
    `, teacherId, teacherId);
  } else {
    evals = queryAll(`
      SELECT evaluations.*, answer_sheets.student_id, answer_sheets.student_name as sh_st_name,
             students.name as st_name, students.roll_number as st_roll,
             model_answers.title as ma_title, model_answers.question as ma_question, model_answers.max_marks as ma_max_marks,
             final_results.id as fr_id, final_results.final_marks as fr_final_marks,
             final_results.teacher_feedback as fr_teacher_feedback, final_results.verified_by as fr_verified_by,
             final_results.verified_at as fr_verified_at,
             users.id as t_id, users.full_name as teacher_full_name, users.username as teacher_username
      FROM evaluations
      JOIN answer_sheets ON evaluations.answer_sheet_id = answer_sheets.id
      LEFT JOIN students ON answer_sheets.student_id = students.id
      LEFT JOIN model_answers ON evaluations.model_answer_id = model_answers.id
      LEFT JOIN final_results ON evaluations.id = final_results.evaluation_id
      LEFT JOIN users ON (answer_sheets.teacher_id = users.id OR students.teacher_id = users.id)
      ORDER BY evaluations.id DESC
    `);
  }

  const result = evals.map(ev => {
    const teacherName = ev.teacher_full_name || ev.teacher_username || 'Unassigned';
    const finalM = ev.fr_final_marks !== null && ev.fr_final_marks !== undefined ? ev.fr_final_marks : null;
    const statusVal = finalM !== null ? 'Verified' : 'Evaluated';

    return {
      id: ev.fr_id || ev.id,
      evaluation_id: ev.id,
      answer_sheet_id: ev.answer_sheet_id,
      student_id: ev.student_id,
      student_name: ev.st_name || ev.sh_st_name || 'Unknown',
      roll_number: ev.st_roll || null,
      teacher_id: ev.t_id || null,
      teacher_name: teacherName,
      title: ev.ma_title || (ev.ma_question ? ev.ma_question.slice(0, 40) : 'Standard Exam'),
      max_marks: ev.ma_max_marks || 10.0,
      similarity: ev.similarity,
      suggested_marks: ev.suggested_marks,
      final_marks: finalM,
      teacher_feedback: ev.fr_teacher_feedback || null,
      verified_by: ev.fr_verified_by || null,
      verified_at: ev.fr_verified_at || null,
      status: statusVal
    };
  });

  res.json(result);
});
