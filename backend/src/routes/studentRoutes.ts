import { Router, Response } from 'express';
import { queryOne, queryAll, execute } from '../database/index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { Student, AnswerSheet, Evaluation, FinalResult, ModelAnswer } from '../types/index.js';

export const studentRouter = Router();

studentRouter.use(requireAuth);

// POST /api/students
studentRouter.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.user!.id;
  const { name, roll_number } = req.body;

  const cleanName = (name || '').trim();
  const cleanRoll = roll_number && roll_number.trim() ? roll_number.trim() : null;

  if (!cleanName) {
    res.status(400).json({ detail: 'Student name cannot be empty.' });
    return;
  }

  if (cleanRoll) {
    const existing = queryOne('SELECT id FROM students WHERE teacher_id = ? AND roll_number = ?', teacherId, cleanRoll);
    if (existing) {
      res.status(400).json({ detail: `A student with roll number '${cleanRoll}' already exists in your class list.` });
      return;
    }
  }

  const result = execute(`
    INSERT INTO students (teacher_id, name, roll_number, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `, teacherId, cleanName, cleanRoll);

  const studentId = Number(result.lastInsertRowid);
  const created = queryOne<Student>('SELECT * FROM students WHERE id = ?', studentId)!;

  res.status(201).json({
    id: created.id,
    teacher_id: created.teacher_id,
    name: created.name,
    roll_number: created.roll_number,
    created_at: created.created_at
  });
});

// GET /api/students
studentRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.user!.id;
  const students = queryAll<Student>('SELECT * FROM students WHERE teacher_id = ? ORDER BY id DESC', teacherId);

  res.json(students.map(s => ({
    id: s.id,
    teacher_id: s.teacher_id,
    name: s.name,
    roll_number: s.roll_number,
    created_at: s.created_at
  })));
});

// GET /api/students/overview
studentRouter.get('/overview', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.user!.id;
  const students = queryAll<Student>('SELECT * FROM students WHERE teacher_id = ? ORDER BY id DESC', teacherId);

  const overviewList = students.map(student => {
    const sheets = queryAll<AnswerSheet>('SELECT * FROM answer_sheets WHERE student_id = ? ORDER BY id DESC', student.id);

    const uploadCount = sheets.length;
    const latestAnswerSheetId = sheets.length > 0 ? sheets[0].id : null;
    let latestEvaluationId: number | null = null;
    let statusVal = 'Pending Upload';
    let questionVal: string | null = null;
    let similarityVal: number | null = null;
    let suggestedMarksVal: number | null = null;
    let finalMarksVal: number | null = null;
    let maxMarksVal = 10.0;
    let verifiedByVal: string | null = null;
    let verifiedAtVal: string | null = null;

    if (sheets.length > 0) {
      const sheetIds = sheets.map(s => s.id);
      const placeholders = sheetIds.map(() => '?').join(',');
      const evaluations = queryAll<Evaluation>(`
        SELECT * FROM evaluations 
        WHERE answer_sheet_id IN (${placeholders}) 
        ORDER BY id DESC
      `, ...sheetIds);

      if (evaluations.length > 0) {
        const latestEval = evaluations[0];
        latestEvaluationId = latestEval.id;
        similarityVal = latestEval.similarity;
        suggestedMarksVal = latestEval.suggested_marks;

        const modelAns = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE id = ?', latestEval.model_answer_id);
        if (modelAns) {
          questionVal = modelAns.question;
          maxMarksVal = modelAns.max_marks;
        }

        const finalRes = queryOne<FinalResult>('SELECT * FROM final_results WHERE evaluation_id = ?', latestEval.id);
        if (finalRes && finalRes.final_marks !== null && finalRes.final_marks !== undefined) {
          statusVal = 'Verified';
          finalMarksVal = finalRes.final_marks;
          verifiedByVal = finalRes.verified_by || null;
          verifiedAtVal = finalRes.verified_at || null;
        } else {
          statusVal = 'Evaluated';
        }
      } else {
        statusVal = 'Uploaded';
      }
    }

    return {
      id: student.id,
      teacher_id: student.teacher_id,
      name: student.name,
      roll_number: student.roll_number,
      upload_count: uploadCount,
      latest_answer_sheet_id: latestAnswerSheetId,
      latest_evaluation_id: latestEvaluationId,
      status: statusVal,
      question: questionVal,
      similarity: similarityVal,
      suggested_marks: suggestedMarksVal,
      final_marks: finalMarksVal,
      max_marks: maxMarksVal,
      verified_by: verifiedByVal,
      verified_at: verifiedAtVal
    };
  });

  res.json(overviewList);
});

// GET /api/students/:id/results
studentRouter.get('/:id/results', (req: AuthenticatedRequest, res: Response): void => {
  const studentId = parseInt(req.params.id, 10);
  const teacherId = req.user!.id;

  const student = queryOne<Student>('SELECT * FROM students WHERE id = ?', studentId);
  if (!student) {
    res.status(404).json({ detail: `Student with ID ${studentId} not found.` });
    return;
  }

  if (student.teacher_id !== null && student.teacher_id !== teacherId) {
    res.status(403).json({ detail: 'Access denied: You do not have permission to view results for this student.' });
    return;
  }

  const sheets = queryAll<AnswerSheet>('SELECT * FROM answer_sheets WHERE student_id = ? ORDER BY id DESC', student.id);

  const resultsCards: any[] = [];
  let totalFinalMarks = 0.0;
  let totalMaxMarks = 0.0;
  let verifiedCount = 0;

  for (const sheet of sheets) {
    const evals = queryAll<Evaluation>('SELECT * FROM evaluations WHERE answer_sheet_id = ? ORDER BY id DESC', sheet.id);

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

// GET /api/students/:id
studentRouter.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const studentId = parseInt(req.params.id, 10);
  const teacherId = req.user!.id;

  const student = queryOne<Student>('SELECT * FROM students WHERE id = ?', studentId);
  if (!student) {
    res.status(404).json({ detail: `Student with ID ${studentId} not found.` });
    return;
  }

  if (student.teacher_id !== null && student.teacher_id !== teacherId) {
    res.status(403).json({ detail: 'Access denied: You do not have permission to view this student.' });
    return;
  }

  res.json({
    id: student.id,
    teacher_id: student.teacher_id,
    name: student.name,
    roll_number: student.roll_number,
    created_at: student.created_at
  });
});

// PUT /api/students/:id
studentRouter.put('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const studentId = parseInt(req.params.id, 10);
  const teacherId = req.user!.id;

  const student = queryOne<Student>('SELECT * FROM students WHERE id = ?', studentId);
  if (!student) {
    res.status(404).json({ detail: `Student with ID ${studentId} not found.` });
    return;
  }

  if (student.teacher_id !== null && student.teacher_id !== teacherId) {
    res.status(403).json({ detail: 'Access denied: You do not have permission to edit this student.' });
    return;
  }

  const { name, roll_number } = req.body;
  const cleanName = (name || '').trim();
  const cleanRoll = roll_number && roll_number.trim() ? roll_number.trim() : null;

  if (!cleanName) {
    res.status(400).json({ detail: 'Student name cannot be empty.' });
    return;
  }

  if (cleanRoll) {
    const existing = queryOne('SELECT id FROM students WHERE teacher_id = ? AND roll_number = ? AND id != ?', teacherId, cleanRoll, studentId);
    if (existing) {
      res.status(400).json({ detail: `A student with roll number '${cleanRoll}' already exists in your class list.` });
      return;
    }
  }

  execute('UPDATE students SET name = ?, roll_number = ? WHERE id = ?', cleanName, cleanRoll, studentId);
  const updated = queryOne<Student>('SELECT * FROM students WHERE id = ?', studentId)!;

  res.json({
    id: updated.id,
    teacher_id: updated.teacher_id,
    name: updated.name,
    roll_number: updated.roll_number,
    created_at: updated.created_at
  });
});

// DELETE /api/students/:id
studentRouter.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const studentId = parseInt(req.params.id, 10);
  const teacherId = req.user!.id;

  const student = queryOne<Student>('SELECT * FROM students WHERE id = ?', studentId);
  if (!student) {
    res.status(404).json({ detail: `Student with ID ${studentId} not found.` });
    return;
  }

  if (student.teacher_id !== null && student.teacher_id !== teacherId) {
    res.status(403).json({ detail: 'Access denied: You do not have permission to delete this student.' });
    return;
  }

  const studentName = student.name;

  const sheets = queryAll<{ id: number }>('SELECT id FROM answer_sheets WHERE student_id = ?', studentId);
  let deletedSheets = sheets.length;
  let deletedEvals = 0;

  for (const sheet of sheets) {
    const evals = queryAll<{ id: number }>('SELECT id FROM evaluations WHERE answer_sheet_id = ?', sheet.id);
    deletedEvals += evals.length;
    for (const ev of evals) {
      execute('DELETE FROM final_results WHERE evaluation_id = ?', ev.id);
      execute('DELETE FROM evaluations WHERE id = ?', ev.id);
    }
    execute('DELETE FROM answer_sheets WHERE id = ?', sheet.id);
  }

  execute('DELETE FROM students WHERE id = ?', studentId);

  res.json({
    success: true,
    message: `Student '${studentName}' (ID: ${studentId}) and associated records deleted successfully.`,
    student_id: studentId,
    student_name: studentName,
    deleted_sheets_count: deletedSheets,
    deleted_evaluations_count: deletedEvals
  });
});
