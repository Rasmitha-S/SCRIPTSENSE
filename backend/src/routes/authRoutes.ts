import { Router, Request, Response } from 'express';
import { queryOne, queryAll, execute } from '../database/index.js';
import {
  verifyPassword,
  hashPassword,
  createAccessToken,
  requireAuth,
  AuthenticatedRequest
} from '../middleware/auth.js';
import { generateMarksExplanation } from '../services/geminiService.js';
import {
  User,
  Student,
  AnswerSheet,
  Evaluation,
  FinalResult,
  ModelAnswer,
  TokenResponse
} from '../types/index.js';

export const authRouter = Router();

// POST /api/login
authRouter.post('/login', (req: Request, res: Response): void => {
  const { username, password, role } = req.body;
  const identifier = (username || '').trim();

  if (!identifier || !password) {
    res.status(400).json({ detail: 'Username and password are required' });
    return;
  }

  const user = queryOne<User>(`
    SELECT * FROM users 
    WHERE username = ? OR email = ? 
    LIMIT 1
  `, identifier, identifier);

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ detail: 'Incorrect username or password' });
    return;
  }

  if (!user.is_active) {
    res.status(401).json({ detail: 'Account has been deactivated. Please contact an administrator.' });
    return;
  }

  if (role && role.trim()) {
    const reqRole = role.trim().toLowerCase();
    if (user.role.toLowerCase() !== reqRole) {
      res.status(401).json({ detail: `This account does not have ${role} access permissions.` });
      return;
    }
  }

  const accessToken = createAccessToken({
    sub: user.username,
    role: user.role,
    user_id: user.id
  });

  const response: TokenResponse = {
    access_token: accessToken,
    token_type: 'bearer',
    user_id: user.id,
    name: user.full_name || user.username,
    role: user.role,
    username: user.username,
    full_name: user.full_name || user.username,
    email: user.email,
    status: 'success'
  };

  res.json(response);
});

// POST /api/register
authRouter.post('/register', (req: Request, res: Response): void => {
  const { username, password, email, full_name, role } = req.body;
  const cleanUsername = (username || '').trim();
  const cleanEmail = email && email.trim() ? email.trim() : null;

  if (!cleanUsername) {
    res.status(400).json({ detail: 'Username cannot be empty.' });
    return;
  }

  if (!password || password.length < 4) {
    res.status(400).json({ detail: 'Password must be at least 4 characters.' });
    return;
  }

  const existingUser = queryOne('SELECT id FROM users WHERE username = ? LIMIT 1', cleanUsername);
  if (existingUser) {
    res.status(400).json({ detail: 'Username or email already exists.' });
    return;
  }

  if (cleanEmail) {
    const existingEmail = queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', cleanEmail);
    if (existingEmail) {
      res.status(400).json({ detail: 'Username or email already exists.' });
      return;
    }
  }

  const pwdHash = hashPassword(password);
  const userRole = role || 'teacher';
  const nameVal = (full_name || '').trim() || cleanUsername;

  const result = execute(`
    INSERT INTO users (username, email, password_hash, role, full_name, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
  `, cleanUsername, cleanEmail, pwdHash, userRole, nameVal);

  const newUserId = Number(result.lastInsertRowid);
  const accessToken = createAccessToken({
    sub: cleanUsername,
    role: userRole,
    user_id: newUserId
  });

  const response: TokenResponse = {
    access_token: accessToken,
    token_type: 'bearer',
    user_id: newUserId,
    name: nameVal,
    role: userRole,
    username: cleanUsername,
    full_name: nameVal,
    email: cleanEmail,
    status: 'success'
  };

  res.status(201).json(response);
});

// POST /api/reset-password
authRouter.post('/reset-password', (req: Request, res: Response): void => {
  const { username, new_password } = req.body;
  const cleanUsername = (username || '').trim();

  if (!cleanUsername) {
    res.status(400).json({ detail: 'Username cannot be empty.' });
    return;
  }

  if (!new_password || new_password.length < 4) {
    res.status(400).json({ detail: 'New password must be at least 4 characters.' });
    return;
  }

  const user = queryOne<User>('SELECT * FROM users WHERE username = ? LIMIT 1', cleanUsername);
  if (!user) {
    res.status(404).json({ detail: `Teacher account with username '${cleanUsername}' was not found.` });
    return;
  }

  const newHash = hashPassword(new_password);
  execute('UPDATE users SET password_hash = ? WHERE id = ?', newHash, user.id);

  res.json({
    message: `Password for teacher '${user.username}' has been successfully reset. You can now sign in with your new password.`,
    success: true
  });
});

// GET /api/me
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
    is_active: Boolean(user.is_active),
    created_at: user.created_at
  });
});

// POST /api/student/portal-access
authRouter.post('/student/portal-access', (req: Request, res: Response): void => {
  const { roll_number_or_id } = req.body;
  const queryVal = (roll_number_or_id || '').trim();

  if (!queryVal) {
    res.status(400).json({ detail: 'Please provide a valid Roll Number or Student ID.' });
    return;
  }

  // 1. Try finding by roll number
  let student = queryOne<Student>('SELECT * FROM students WHERE LOWER(roll_number) = LOWER(?) LIMIT 1', queryVal);

  // 2. Try finding by ID
  if (!student && /^\d+$/.test(queryVal)) {
    student = queryOne<Student>('SELECT * FROM students WHERE id = ? LIMIT 1', parseInt(queryVal, 10));
  }

  // 3. Try finding by name
  if (!student) {
    student = queryOne<Student>('SELECT * FROM students WHERE LOWER(name) = LOWER(?) LIMIT 1', queryVal);
  }

  if (!student) {
    res.status(404).json({
      detail: `No student record found matching '${queryVal}'. Please verify your Roll Number with your teacher.`
    });
    return;
  }

  const sheets = queryAll<AnswerSheet>(`
    SELECT * FROM answer_sheets 
    WHERE student_id = ? 
    ORDER BY id DESC
  `, student.id);

  const resultsCards: any[] = [];
  let totalFinalMarks = 0.0;
  let totalMaxMarks = 0.0;
  let verifiedCount = 0;

  for (const sheet of sheets) {
    const evals = queryAll<Evaluation>(`
      SELECT * FROM evaluations 
      WHERE answer_sheet_id = ? 
      ORDER BY id DESC
    `, sheet.id);

    if (evals && evals.length > 0) {
      for (const evaluation of evals) {
        const modelAnswer = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE id = ?', evaluation.model_answer_id);
        const finalRes = queryOne<FinalResult>('SELECT * FROM final_results WHERE evaluation_id = ?', evaluation.id);

        const maxMarks = modelAnswer?.max_marks || 10.0;
        let statusVal = 'Evaluated';
        let finalMarksVal: number | null = null;
        let teacherFeedbackVal: string | null = null;
        let verifiedByVal: string | null = null;
        let verifiedAtVal: string | null = null;

        if (finalRes && finalRes.final_marks !== null && finalRes.final_marks !== undefined) {
          statusVal = 'Verified';
          finalMarksVal = finalRes.final_marks;
          teacherFeedbackVal = finalRes.teacher_feedback || null;
          verifiedByVal = finalRes.verified_by || null;
          verifiedAtVal = finalRes.verified_at || null;

          totalFinalMarks += finalMarksVal;
          totalMaxMarks += maxMarks;
          verifiedCount++;
        }

        let rubricScores = null;
        if (evaluation.rubric_scores_json) {
          try {
            rubricScores = JSON.parse(evaluation.rubric_scores_json);
          } catch (e) {}
        }

        let qEvals = null;
        if (evaluation.question_evaluations_json) {
          try {
            qEvals = JSON.parse(evaluation.question_evaluations_json);
          } catch (e) {}
        }

        let qResults = null;
        if (finalRes && finalRes.question_results_json) {
          try {
            qResults = JSON.parse(finalRes.question_results_json);
          } catch (e) {}
        }

        resultsCards.push({
          evaluation_id: evaluation.id,
          answer_sheet_id: sheet.id,
          student_id: student.id,
          student_name: student.name,
          roll_number: student.roll_number,
          title: modelAnswer?.title || null,
          subject: modelAnswer?.subject || null,
          question: modelAnswer?.question || null,
          model_answer: modelAnswer?.answer_text || null,
          extracted_text: sheet.extracted_text,
          file_path: sheet.file_path,
          max_marks: maxMarks,
          similarity: evaluation.similarity,
          suggested_marks: evaluation.suggested_marks,
          explanation: evaluation.explanation,
          final_marks: finalMarksVal,
          teacher_feedback: teacherFeedbackVal,
          verified_by: verifiedByVal,
          verified_at: verifiedAtVal,
          status: statusVal,
          uploaded_at: sheet.uploaded_at,
          rubric_scores: rubricScores,
          question_evaluations: qEvals,
          question_results: qResults
        });
      }
    } else {
      resultsCards.push({
        evaluation_id: 0,
        answer_sheet_id: sheet.id,
        student_id: student.id,
        student_name: student.name,
        roll_number: student.roll_number,
        question: 'Pending Evaluation',
        model_answer: null,
        extracted_text: sheet.extracted_text,
        file_path: sheet.file_path,
        max_marks: 10.0,
        similarity: 0.0,
        suggested_marks: 0.0,
        explanation: 'Your answer sheet has been received and is awaiting teacher evaluation.',
        final_marks: null,
        teacher_feedback: null,
        verified_by: null,
        verified_at: null,
        status: 'Uploaded',
        uploaded_at: sheet.uploaded_at
      });
    }
  }

  const avgScore = verifiedCount > 0 ? Math.round((totalFinalMarks / verifiedCount) * 100) / 100 : null;
  const avgPct = verifiedCount > 0 && totalMaxMarks > 0 ? Math.round((totalFinalMarks / totalMaxMarks) * 1000) / 10 : null;

  res.json({
    student_id: student.id,
    student_name: student.name,
    roll_number: student.roll_number,
    total_exams: resultsCards.length,
    verified_exams: verifiedCount,
    average_score: avgScore,
    average_percentage: avgPct,
    results: resultsCards
  });
});

// POST /api/explain-marks
authRouter.post('/explain-marks', async (req: Request, res: Response): Promise<void> => {
  const {
    evaluation_id,
    student_answer,
    model_answer,
    question,
    similarity = 0.0,
    marks_obtained = 0.0,
    max_marks = 10.0,
    explanation,
    user_question,
    history
  } = req.body;

  let sAns = student_answer || '';
  let mAns = model_answer || '';
  let qText = question || '';
  let marksVal = Number(marks_obtained) || 0.0;
  let maxM = Number(max_marks) > 0 ? Number(max_marks) : 10.0;
  let simVal = Number(similarity) || 0.0;
  let expVal = explanation || '';

  if (evaluation_id) {
    const evalRecord = queryOne<Evaluation>('SELECT * FROM evaluations WHERE id = ?', evaluation_id);
    if (evalRecord) {
      const sheet = queryOne<AnswerSheet>('SELECT * FROM answer_sheets WHERE id = ?', evalRecord.answer_sheet_id);
      const model = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE id = ?', evalRecord.model_answer_id);
      const finalRes = queryOne<FinalResult>('SELECT * FROM final_results WHERE evaluation_id = ?', evalRecord.id);

      if (!sAns && sheet) sAns = sheet.extracted_text || '';
      if (!mAns && model) mAns = model.answer_text || '';
      if (!qText && model) qText = model.question || model.title || '';
      if (finalRes && finalRes.final_marks !== null) {
        marksVal = finalRes.final_marks;
      } else if (marksVal === 0.0) {
        marksVal = evalRecord.suggested_marks;
      }
      if (simVal === 0.0) simVal = evalRecord.similarity;
      if (!expVal) expVal = evalRecord.explanation || '';
      if (model && model.max_marks) maxM = model.max_marks;
    }
  }

  const result = await generateMarksExplanation({
    studentAnswer: sAns,
    modelAnswer: mAns,
    similarity: simVal,
    marksObtained: marksVal,
    maxMarks: maxM,
    question: qText,
    explanation: expVal,
    userQuestion: user_question,
    history
  });

  res.json({
    reply: result.reply,
    is_ai_generated: result.isAiGenerated,
    source: result.source
  });
});
