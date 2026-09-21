import { Router, Response } from 'express';
import { queryOne, queryAll, execute } from '../database/index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { Evaluation, AnswerSheet, Student, ModelAnswer, FinalResult } from '../types/index.js';

export const resultRouter = Router();

resultRouter.use(requireAuth);

function parseJsonSafely(jsonStr?: string | null): any {
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

// GET /api/results
resultRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.user!.id;

  const evaluations = queryAll<any>(`
    SELECT evaluations.*, answer_sheets.student_id, answer_sheets.extracted_text as sh_text,
           answer_sheets.student_name as sh_st_name, students.name as st_name, students.roll_number as st_roll,
           model_answers.title as ma_title, model_answers.subject as ma_subject, model_answers.question as ma_question,
           model_answers.answer_text as ma_answer, model_answers.max_marks as ma_max_marks,
           final_results.final_marks as fr_final_marks, final_results.teacher_feedback as fr_feedback,
           final_results.verified_by as fr_verified_by, final_results.verified_at as fr_verified_at,
           final_results.rubric_adjustments_json as fr_rubric_adjs, final_results.question_results_json as fr_q_results
    FROM evaluations
    JOIN answer_sheets ON evaluations.answer_sheet_id = answer_sheets.id
    LEFT JOIN students ON answer_sheets.student_id = students.id
    LEFT JOIN model_answers ON evaluations.model_answer_id = model_answers.id
    LEFT JOIN final_results ON evaluations.id = final_results.evaluation_id
    WHERE answer_sheets.teacher_id = ? OR students.teacher_id = ?
    ORDER BY evaluations.id DESC
  `, teacherId, teacherId);

  const resultsList = evaluations.map(ev => {
    const rubricScores = parseJsonSafely(ev.rubric_scores_json);
    const qEvals = parseJsonSafely(ev.question_evaluations_json);
    const rubricAdjs = parseJsonSafely(ev.fr_rubric_adjs);
    const qResults = parseJsonSafely(ev.fr_q_results);

    return {
      evaluation_id: ev.id,
      answer_sheet_id: ev.answer_sheet_id,
      student_id: ev.student_id,
      student_name: ev.st_name || ev.sh_st_name || null,
      roll_number: ev.st_roll || null,
      extracted_text: ev.sh_text,
      title: ev.ma_title || null,
      subject: ev.ma_subject || null,
      question: ev.ma_question || null,
      model_answer: ev.ma_answer || null,
      max_marks: ev.ma_max_marks || 10.0,
      similarity: ev.similarity,
      suggested_marks: ev.suggested_marks,
      explanation: ev.explanation,
      final_marks: ev.fr_final_marks !== null && ev.fr_final_marks !== undefined ? ev.fr_final_marks : null,
      teacher_feedback: ev.fr_feedback || null,
      verified_by: ev.fr_verified_by || null,
      verified_at: ev.fr_verified_at || null,
      rubric_scores: rubricScores,
      question_evaluations: qEvals,
      rubric_adjustments: rubricAdjs,
      question_results: qResults
    };
  });

  res.json(resultsList);
});

// GET /api/results/export/csv
resultRouter.get('/export/csv', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.user!.id;

  const evaluations = queryAll<any>(`
    SELECT evaluations.*, answer_sheets.student_id, answer_sheets.student_name as sh_st_name,
           students.name as st_name, students.roll_number as st_roll,
           model_answers.title as ma_title, model_answers.subject as ma_subject, model_answers.question as ma_question,
           model_answers.max_marks as ma_max_marks,
           final_results.final_marks as fr_final_marks, final_results.teacher_feedback as fr_feedback,
           final_results.verified_by as fr_verified_by, final_results.verified_at as fr_verified_at
    FROM evaluations
    JOIN answer_sheets ON evaluations.answer_sheet_id = answer_sheets.id
    LEFT JOIN students ON answer_sheets.student_id = students.id
    LEFT JOIN model_answers ON evaluations.model_answer_id = model_answers.id
    LEFT JOIN final_results ON evaluations.id = final_results.evaluation_id
    WHERE answer_sheets.teacher_id = ? OR students.teacher_id = ?
    ORDER BY evaluations.id DESC
  `, teacherId, teacherId);

  const rows: string[] = [
    [
      'Evaluation ID',
      'Student ID',
      'Student Name',
      'Roll Number',
      'Exam / Question Title',
      'Subject',
      'Max Marks',
      'AI Semantic Similarity (%)',
      'AI Suggested Marks',
      'Teacher Final Marks',
      'Percentage (%)',
      'Status',
      'Verified By',
      'Verified At',
      'Teacher Feedback'
    ].map(h => `"${h}"`).join(',')
  ];

  for (const ev of evaluations) {
    const stName = ev.st_name || ev.sh_st_name || 'N/A';
    const stRoll = ev.st_roll || 'N/A';
    const stId = ev.student_id || 'N/A';
    const title = ev.ma_title || (ev.ma_question ? ev.ma_question.slice(0, 40) : 'N/A');
    const subject = ev.ma_subject || 'General';
    const maxM = ev.ma_max_marks || 10.0;
    const sim = ev.similarity !== null ? `${(ev.similarity * 100).toFixed(1)}%` : '0.0%';
    const sugM = ev.suggested_marks;
    const finM = ev.fr_final_marks !== null && ev.fr_final_marks !== undefined ? ev.fr_final_marks : sugM;
    const pct = finM !== null && maxM > 0 ? `${((finM / maxM) * 100).toFixed(1)}%` : 'N/A';
    const statusStr = ev.fr_final_marks !== null && ev.fr_final_marks !== undefined ? 'Verified' : 'Evaluated';
    const verBy = ev.fr_verified_by || 'Pending Verification';
    const verAt = ev.fr_verified_at || 'N/A';
    const feedback = (ev.fr_feedback || '').replace(/"/g, '""');

    rows.push([
      ev.id,
      stId,
      `"${stName}"`,
      `"${stRoll}"`,
      `"${title.replace(/"/g, '""')}"`,
      `"${subject}"`,
      maxM,
      `"${sim}"`,
      sugM,
      finM,
      `"${pct}"`,
      `"${statusStr}"`,
      `"${verBy}"`,
      `"${verAt}"`,
      `"${feedback}"`
    ].join(','));
  }

  const csvContent = rows.join('\n');
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '_').slice(0, 15);
  const filename = `scriptsense_results_${timestamp}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});

// GET /api/results/:id
resultRouter.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const evalId = parseInt(req.params.id, 10);
  const teacherId = req.user!.id;

  const evaluation = queryOne<Evaluation>('SELECT * FROM evaluations WHERE id = ?', evalId);
  if (!evaluation) {
    res.status(404).json({ detail: `Evaluation with ID ${evalId} not found.` });
    return;
  }

  const sheet = queryOne<AnswerSheet>('SELECT * FROM answer_sheets WHERE id = ?', evaluation.answer_sheet_id);
  const student = sheet?.student_id ? queryOne<Student>('SELECT * FROM students WHERE id = ?', sheet.student_id) : undefined;
  const sheetTeacherId = sheet?.teacher_id || student?.teacher_id;

  if (sheetTeacherId !== null && sheetTeacherId !== undefined && sheetTeacherId !== teacherId) {
    res.status(403).json({ detail: 'Access denied: You do not have permission to view results for this student.' });
    return;
  }

  const modelAnswer = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE id = ?', evaluation.model_answer_id);
  const finalResult = queryOne<FinalResult>('SELECT * FROM final_results WHERE evaluation_id = ?', evaluation.id);

  const rubricScores = parseJsonSafely(evaluation.rubric_scores_json);
  const qEvals = parseJsonSafely(evaluation.question_evaluations_json);
  const rubricAdjs = parseJsonSafely(finalResult?.rubric_adjustments_json);
  const qResults = parseJsonSafely(finalResult?.question_results_json);

  res.json({
    evaluation_id: evaluation.id,
    answer_sheet_id: evaluation.answer_sheet_id,
    student_id: sheet?.student_id || null,
    student_name: student?.name || sheet?.student_name || null,
    roll_number: student?.roll_number || null,
    extracted_text: sheet?.extracted_text || null,
    title: modelAnswer?.title || null,
    subject: modelAnswer?.subject || null,
    question: modelAnswer?.question || null,
    model_answer: modelAnswer?.answer_text || null,
    max_marks: modelAnswer?.max_marks || 10.0,
    similarity: evaluation.similarity,
    suggested_marks: evaluation.suggested_marks,
    explanation: evaluation.explanation,
    final_marks: finalResult?.final_marks !== undefined ? finalResult.final_marks : null,
    teacher_feedback: finalResult?.teacher_feedback || null,
    verified_by: finalResult?.verified_by || null,
    verified_at: finalResult?.verified_at || null,
    rubric_scores: rubricScores,
    question_evaluations: qEvals,
    rubric_adjustments: rubricAdjs,
    question_results: qResults
  });
});

// Handler for saving teacher verified result
function handleSaveVerifiedResult(req: AuthenticatedRequest, res: Response): void {
  const evalId = parseInt(req.params.id, 10);
  const teacherId = req.user!.id;
  const verifierName = req.user!.full_name || req.user!.username;

  const evaluation = queryOne<Evaluation>('SELECT * FROM evaluations WHERE id = ?', evalId);
  if (!evaluation) {
    res.status(404).json({ detail: `Evaluation with ID ${evalId} not found.` });
    return;
  }

  const sheet = queryOne<AnswerSheet>('SELECT * FROM answer_sheets WHERE id = ?', evaluation.answer_sheet_id);
  const student = sheet?.student_id ? queryOne<Student>('SELECT * FROM students WHERE id = ?', sheet.student_id) : undefined;
  const sheetTeacherId = sheet?.teacher_id || student?.teacher_id;

  if (sheetTeacherId !== null && sheetTeacherId !== undefined && sheetTeacherId !== teacherId) {
    res.status(403).json({ detail: "Access denied: You do not have permission to verify results for another teacher's student." });
    return;
  }

  const { final_marks, teacher_feedback, rubric_adjustments, question_results } = req.body;
  const finalMarksVal = Number(final_marks) || 0.0;
  const rubricAdjsJson = rubric_adjustments && Array.isArray(rubric_adjustments) ? JSON.stringify(rubric_adjustments) : null;
  const qResultsJson = question_results && Array.isArray(question_results) ? JSON.stringify(question_results) : null;

  const existingFinal = queryOne<FinalResult>('SELECT * FROM final_results WHERE evaluation_id = ?', evalId);

  if (existingFinal) {
    execute(`
      UPDATE final_results 
      SET final_marks = ?, teacher_feedback = ?, verified_by = ?, verified_at = datetime('now'),
          rubric_adjustments_json = ?, question_results_json = ?
      WHERE id = ?
    `, finalMarksVal, teacher_feedback || null, verifierName, rubricAdjsJson, qResultsJson, existingFinal.id);
  } else {
    execute(`
      INSERT INTO final_results (evaluation_id, final_marks, teacher_feedback, verified_by, verified_at, rubric_adjustments_json, question_results_json)
      VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
    `, evalId, finalMarksVal, teacher_feedback || null, verifierName, rubricAdjsJson, qResultsJson);
  }

  const updatedFinal = queryOne<FinalResult>('SELECT * FROM final_results WHERE evaluation_id = ?', evalId)!;

  res.json({
    evaluation_id: evaluation.id,
    student_id: sheet?.student_id || null,
    student_name: student?.name || sheet?.student_name || null,
    roll_number: student?.roll_number || null,
    final_marks: updatedFinal.final_marks,
    verified_by: updatedFinal.verified_by,
    verified_at: updatedFinal.verified_at,
    rubric_adjustments: parseJsonSafely(updatedFinal.rubric_adjustments_json),
    question_results: parseJsonSafely(updatedFinal.question_results_json)
  });
}

// PUT /api/results/:id, PUT /api/results/:id/verify, POST /api/results/:id, POST /api/results/:id/verify
resultRouter.put('/:id', handleSaveVerifiedResult);
resultRouter.put('/:id/verify', handleSaveVerifiedResult);
resultRouter.post('/:id', handleSaveVerifiedResult);
resultRouter.post('/:id/verify', handleSaveVerifiedResult);
