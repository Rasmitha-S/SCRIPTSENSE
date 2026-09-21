import { Router, Response } from 'express';
import { queryOne, queryAll, execute } from '../database/index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { uploadMiddleware, saveUploadedBuffer } from '../services/fileService.js';
import { extractTextFromBuffer } from '../services/ocrService.js';
import { evaluateAnswers, evaluateMultiQuestionExam } from '../services/evaluationService.js';
import { ModelAnswer, AnswerSheet, Student, Test, Evaluation, QuestionItem, RubricCriterion } from '../types/index.js';

export const evalRouter = Router();

evalRouter.use(requireAuth);

// Handler for creating model answer
async function handleCreateModelAnswer(req: AuthenticatedRequest, res: Response): Promise<void> {
  let question = req.body.question;
  let typedAnswer = req.body.answer_text;
  let rawMaxMarks = req.body.max_marks || 10.0;
  let title = req.body.title;
  let subject = req.body.subject || 'General';
  let questions = req.body.questions;
  let rubric = req.body.rubric;

  let extractedOcrText = '';

  if (req.file) {
    try {
      saveUploadedBuffer(req.file.buffer, req.file.originalname, `model_${Date.now()}`);
      extractedOcrText = await extractTextFromBuffer(req.file.buffer, req.file.originalname);
    } catch (e) {}
  }

  const maxMarksVal = Number(rawMaxMarks) || 10.0;
  const finalAnswer = typedAnswer && typedAnswer.trim() ? typedAnswer.trim() : extractedOcrText.trim();

  let questionsJsonStr: string | null = null;
  let questionsData: QuestionItem[] = [];

  if (questions) {
    if (typeof questions === 'string') {
      try {
        questionsData = JSON.parse(questions);
      } catch (e) {}
    } else if (Array.isArray(questions)) {
      questionsData = questions;
    }
    if (questionsData.length > 0) {
      questionsJsonStr = JSON.stringify(questionsData);
    }
  }

  let rubricJsonStr: string | null = null;
  if (rubric) {
    if (typeof rubric === 'string') {
      try {
        rubricJsonStr = JSON.stringify(JSON.parse(rubric));
      } catch (e) {}
    } else if (Array.isArray(rubric)) {
      rubricJsonStr = JSON.stringify(rubric);
    }
  }

  let primaryTitle = '';
  let primaryQuestion = '';
  let primaryAnswer = '';
  let calcMaxMarks = maxMarksVal;

  if (questionsData.length > 0) {
    const totalCalc = questionsData.reduce((acc, q) => acc + (Number(q.max_marks) || 5.0), 0);
    calcMaxMarks = maxMarksVal <= 0 || maxMarksVal === 10.0 ? totalCalc : totalCalc;
    primaryTitle = title ? title.trim() : `Exam Paper (${questionsData.length} Questions)`;
    primaryQuestion = `${primaryTitle} — ` + questionsData.map((q, i) => `Q${q.q_num || i + 1}: ${(q.question || '').slice(0, 50)}`).join(' | ');
    primaryAnswer = finalAnswer || questionsData.map((q, i) => `[Q${q.q_num || i + 1} Model Solution]:\n${q.model_answer || ''}`).join('\n\n');
  } else {
    primaryTitle = title ? title.trim() : (question ? question.trim().slice(0, 50) : 'Standard Question');
    primaryQuestion = question ? question.trim() : primaryTitle;
    primaryAnswer = finalAnswer;
  }

  const result = execute(`
    INSERT INTO model_answers (title, subject, question, answer_text, max_marks, questions_json, rubric_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, primaryTitle, subject, primaryQuestion, primaryAnswer, calcMaxMarks, questionsJsonStr, rubricJsonStr);

  const modelAnswerId = Number(result.lastInsertRowid);
  const created = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE id = ?', modelAnswerId)!;

  res.json({
    model_answer_id: created.id,
    title: created.title,
    subject: created.subject,
    max_marks: created.max_marks,
    questions_count: questionsData.length > 0 ? questionsData.length : 1,
    extracted_text: primaryAnswer
  });
}

// POST /api/model-answer and POST /api/model-answers
evalRouter.post('/model-answer', uploadMiddleware.single('file'), handleCreateModelAnswer);
evalRouter.post('/model-answers', uploadMiddleware.single('file'), handleCreateModelAnswer);

// GET /api/model-answers
evalRouter.get('/model-answers', (_req: AuthenticatedRequest, res: Response): void => {
  const answers = queryAll<ModelAnswer>('SELECT * FROM model_answers ORDER BY id DESC');

  const results = answers.map(m => {
    let questionsList: any[] = [];
    if (m.questions_json) {
      try {
        questionsList = JSON.parse(m.questions_json);
      } catch (e) {}
    }

    let rubricList: any[] = [];
    if (m.rubric_json) {
      try {
        rubricList = JSON.parse(m.rubric_json);
      } catch (e) {}
    }

    return {
      id: m.id,
      title: m.title || 'Standard Model Answer',
      subject: m.subject || 'General',
      question: m.question,
      answer_text: m.answer_text,
      max_marks: m.max_marks,
      questions: questionsList,
      rubric: rubricList,
      questions_count: questionsList.length > 0 ? questionsList.length : 1
    };
  });

  res.json(results);
});

// PUT /api/model-answer/:id and PUT /api/model-answers/:id
function handleUpdateModelAnswer(req: AuthenticatedRequest, res: Response): void {
  const modelId = parseInt(req.params.id, 10);
  const model = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE id = ?', modelId);

  if (!model) {
    res.status(404).json({ detail: `Model answer with ID ${modelId} not found.` });
    return;
  }

  const { title, subject, question, answer_text, max_marks, questions, rubric } = req.body;

  let questionsJsonStr: string | null = null;
  let qCount = 1;
  let maxMarksVal = Number(max_marks) || 10.0;
  let primaryTitle = title || 'Standard Question';
  let primaryQuestion = question ? question.trim() : primaryTitle;
  let primaryAnswer = answer_text ? answer_text.trim() : '';

  if (questions && Array.isArray(questions) && questions.length > 0) {
    questionsJsonStr = JSON.stringify(questions);
    const totalCalc = questions.reduce((acc: number, q: any) => acc + (Number(q.max_marks) || 5.0), 0);
    maxMarksVal = totalCalc;
    primaryTitle = title || `Exam Paper (${questions.length} Questions)`;
    primaryQuestion = `${primaryTitle} — ` + questions.map((q: any, i: number) => `Q${q.q_num || i + 1}: ${(q.question || '').slice(0, 50)}`).join(' | ');
    primaryAnswer = questions.map((q: any, i: number) => `[Q${q.q_num || i + 1} Model Solution]:\n${q.model_answer || ''}`).join('\n\n');
    qCount = questions.length;
  }

  let rubricJsonStr: string | null = null;
  if (rubric && Array.isArray(rubric)) {
    rubricJsonStr = JSON.stringify(rubric);
  }

  execute(`
    UPDATE model_answers 
    SET title = ?, subject = ?, question = ?, answer_text = ?, max_marks = ?, questions_json = ?, rubric_json = ?
    WHERE id = ?
  `, primaryTitle, subject || 'General', primaryQuestion, primaryAnswer, maxMarksVal, questionsJsonStr, rubricJsonStr, modelId);

  const updated = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE id = ?', modelId)!;

  res.json({
    model_answer_id: updated.id,
    title: updated.title,
    subject: updated.subject,
    max_marks: updated.max_marks,
    questions_count: qCount,
    extracted_text: primaryAnswer
  });
}

evalRouter.put('/model-answer/:id', handleUpdateModelAnswer);
evalRouter.put('/model-answers/:id', handleUpdateModelAnswer);

// GET /api/answer-sheets
evalRouter.get('/answer-sheets', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.user!.id;
  const sheets = queryAll<any>(`
    SELECT answer_sheets.*, students.name as st_name, students.roll_number as st_roll
    FROM answer_sheets
    LEFT JOIN students ON answer_sheets.student_id = students.id
    WHERE answer_sheets.teacher_id = ? OR students.teacher_id = ?
    ORDER BY answer_sheets.id DESC
  `, teacherId, teacherId);

  res.json(sheets.map(s => ({
    id: s.id,
    student_id: s.student_id,
    student_name: s.st_name || s.student_name,
    roll_number: s.st_roll || null,
    file_path: s.file_path,
    uploaded_at: s.uploaded_at,
    extracted_text: s.extracted_text
  })));
});

// POST /api/evaluate
evalRouter.post('/evaluate', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.user!.id;
  const { answer_sheet_id, model_answer_id, test_id } = req.body;

  const sheet = queryOne<AnswerSheet>('SELECT * FROM answer_sheets WHERE id = ?', answer_sheet_id);
  if (!sheet) {
    res.status(404).json({ detail: `Answer sheet with ID ${answer_sheet_id} not found.` });
    return;
  }

  const student = sheet.student_id ? queryOne<Student>('SELECT * FROM students WHERE id = ?', sheet.student_id) : undefined;
  const sheetTeacherId = sheet.teacher_id || student?.teacher_id;

  if (sheetTeacherId !== null && sheetTeacherId !== undefined && sheetTeacherId !== teacherId) {
    res.status(403).json({ detail: "Access denied: You cannot evaluate another teacher's student's answer sheet." });
    return;
  }

  let modelAnswer: ModelAnswer | undefined;
  if (model_answer_id) {
    modelAnswer = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE id = ?', model_answer_id);
  } else if (test_id) {
    modelAnswer = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE test_id = ? LIMIT 1', test_id);
  } else if (sheet.test_id) {
    modelAnswer = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE test_id = ? LIMIT 1', sheet.test_id);
  }

  if (!modelAnswer) {
    modelAnswer = queryOne<ModelAnswer>('SELECT * FROM model_answers ORDER BY id DESC LIMIT 1');
  }

  if (!modelAnswer) {
    res.status(404).json({ detail: 'No reference model answer found for evaluation.' });
    return;
  }

  const studentText = sheet.extracted_text || '';
  let similarity = 0.0;
  let suggestedMarks = 0.0;
  let explanation = '';
  let rubricScores: any[] = [];
  let questionEvaluations: any[] = [];

  let questionsList: QuestionItem[] = [];
  if (modelAnswer.questions_json) {
    try {
      questionsList = JSON.parse(modelAnswer.questions_json);
    } catch (e) {}
  }

  let rubricList: RubricCriterion[] | undefined;
  if (modelAnswer.rubric_json) {
    try {
      rubricList = JSON.parse(modelAnswer.rubric_json);
    } catch (e) {}
  }

  if (questionsList.length > 0) {
    const evalResult = evaluateMultiQuestionExam(studentText, questionsList, modelAnswer.max_marks);
    similarity = evalResult.overallSimilarity;
    suggestedMarks = evalResult.totalSuggested;
    explanation = evalResult.overallExplanation;
    rubricScores = evalResult.allRubricScores;
    questionEvaluations = evalResult.questionEvaluations;
  } else {
    const evalResult = evaluateAnswers(studentText, modelAnswer.answer_text, modelAnswer.max_marks, rubricList);
    similarity = evalResult.similarity;
    suggestedMarks = evalResult.suggestedMarks;
    explanation = evalResult.explanation;
    rubricScores = evalResult.rubricScores;
  }

  const existingEval = queryOne<Evaluation>('SELECT * FROM evaluations WHERE answer_sheet_id = ? AND model_answer_id = ? ORDER BY id DESC LIMIT 1', sheet.id, modelAnswer.id);
  let evaluationId: number;
  if (existingEval) {
    execute(`
      UPDATE evaluations 
      SET similarity = ?, suggested_marks = ?, explanation = ?, rubric_scores_json = ?, question_evaluations_json = ?
      WHERE id = ?
    `, similarity, suggestedMarks, explanation, rubricScores.length > 0 ? JSON.stringify(rubricScores) : null, questionEvaluations.length > 0 ? JSON.stringify(questionEvaluations) : null, existingEval.id);
    evaluationId = existingEval.id;
  } else {
    const insertEval = execute(`
      INSERT INTO evaluations (answer_sheet_id, model_answer_id, similarity, suggested_marks, explanation, rubric_scores_json, question_evaluations_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, sheet.id, modelAnswer.id, similarity, suggestedMarks, explanation, rubricScores.length > 0 ? JSON.stringify(rubricScores) : null, questionEvaluations.length > 0 ? JSON.stringify(questionEvaluations) : null);
    evaluationId = Number(insertEval.lastInsertRowid);
  }
  const testRecord = (sheet.test_id || modelAnswer.test_id)
    ? queryOne<Test>('SELECT * FROM tests WHERE id = ?', sheet.test_id || modelAnswer.test_id)
    : undefined;

  res.json({
    evaluation_id: evaluationId,
    answer_sheet_id: sheet.id,
    model_answer_id: modelAnswer.id,
    test_id: testRecord?.id || sheet.test_id || modelAnswer.test_id || null,
    test_name: testRecord?.test_name || modelAnswer.title,
    student_id: sheet.student_id,
    student_name: student ? student.name : sheet.student_name,
    roll_number: student?.roll_number || null,
    title: modelAnswer.title || testRecord?.test_name,
    similarity,
    suggested_marks: suggestedMarks,
    max_marks: modelAnswer.max_marks,
    explanation: explanation || '',
    rubric_scores: rubricScores.length > 0 ? rubricScores : null,
    question_evaluations: questionEvaluations.length > 0 ? questionEvaluations : null
  });
});

// POST /api/evaluate/batch
evalRouter.post('/evaluate/batch', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.user!.id;
  const { answer_sheet_ids, model_answer_id, test_id } = req.body;

  let modelAnswer: ModelAnswer | undefined;
  if (model_answer_id) {
    modelAnswer = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE id = ?', model_answer_id);
  } else if (test_id) {
    modelAnswer = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE test_id = ? LIMIT 1', test_id);
  }

  if (!modelAnswer) {
    res.status(404).json({ detail: 'Model answer or Test not found.' });
    return;
  }

  let sheetIdsToEvaluate: number[] = answer_sheet_ids || [];
  if (sheetIdsToEvaluate.length === 0 && test_id) {
    const sheetsForTest = queryAll<{ id: number }>('SELECT id FROM answer_sheets WHERE test_id = ?', test_id);
    sheetIdsToEvaluate = sheetsForTest.map(s => s.id);
  }

  if (sheetIdsToEvaluate.length === 0) {
    res.json({
      processed_count: 0,
      successful_evaluations: [],
      failed_ids: []
    });
    return;
  }

  let questionsList: QuestionItem[] = [];
  if (modelAnswer.questions_json) {
    try {
      questionsList = JSON.parse(modelAnswer.questions_json);
    } catch (e) {}
  }

  let rubricList: RubricCriterion[] | undefined;
  if (modelAnswer.rubric_json) {
    try {
      rubricList = JSON.parse(modelAnswer.rubric_json);
    } catch (e) {}
  }

  const successful: any[] = [];
  const failed: number[] = [];

  for (const sheetId of sheetIdsToEvaluate) {
    const sheet = queryOne<AnswerSheet>('SELECT * FROM answer_sheets WHERE id = ?', sheetId);
    if (!sheet) {
      failed.push(sheetId);
      continue;
    }

    const student = sheet.student_id ? queryOne<Student>('SELECT * FROM students WHERE id = ?', sheet.student_id) : undefined;
    const sheetTeacherId = sheet.teacher_id || student?.teacher_id;

    if (sheetTeacherId !== null && sheetTeacherId !== undefined && sheetTeacherId !== teacherId) {
      failed.push(sheetId);
      continue;
    }

    const studentText = sheet.extracted_text || '';
    let similarity = 0.0;
    let suggestedMarks = 0.0;
    let explanation = '';
    let rubricScores: any[] = [];
    let questionEvaluations: any[] = [];

    try {
      if (questionsList.length > 0) {
        const evalResult = evaluateMultiQuestionExam(studentText, questionsList, modelAnswer.max_marks);
        similarity = evalResult.overallSimilarity;
        suggestedMarks = evalResult.totalSuggested;
        explanation = evalResult.overallExplanation;
        rubricScores = evalResult.allRubricScores;
        questionEvaluations = evalResult.questionEvaluations;
      } else {
        const evalResult = evaluateAnswers(studentText, modelAnswer.answer_text, modelAnswer.max_marks, rubricList);
        similarity = evalResult.similarity;
        suggestedMarks = evalResult.suggestedMarks;
        explanation = evalResult.explanation;
        rubricScores = evalResult.rubricScores;
      }

      const existingEval = queryOne<Evaluation>('SELECT * FROM evaluations WHERE answer_sheet_id = ? AND model_answer_id = ? ORDER BY id DESC LIMIT 1', sheet.id, modelAnswer.id);
      let evaluationId: number;
      if (existingEval) {
        execute(`
          UPDATE evaluations 
          SET similarity = ?, suggested_marks = ?, explanation = ?, rubric_scores_json = ?, question_evaluations_json = ?
          WHERE id = ?
        `, similarity, suggestedMarks, explanation, rubricScores.length > 0 ? JSON.stringify(rubricScores) : null, questionEvaluations.length > 0 ? JSON.stringify(questionEvaluations) : null, existingEval.id);
        evaluationId = existingEval.id;
      } else {
        const insertEval = execute(`
          INSERT INTO evaluations (answer_sheet_id, model_answer_id, similarity, suggested_marks, explanation, rubric_scores_json, question_evaluations_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, sheet.id, modelAnswer.id, similarity, suggestedMarks, explanation, rubricScores.length > 0 ? JSON.stringify(rubricScores) : null, questionEvaluations.length > 0 ? JSON.stringify(questionEvaluations) : null);
        evaluationId = Number(insertEval.lastInsertRowid);
      }
      const testRecord = (sheet.test_id || modelAnswer.test_id)
        ? queryOne<Test>('SELECT * FROM tests WHERE id = ?', sheet.test_id || modelAnswer.test_id)
        : undefined;

      successful.push({
        evaluation_id: evaluationId,
        answer_sheet_id: sheet.id,
        model_answer_id: modelAnswer.id,
        test_id: testRecord?.id || sheet.test_id || modelAnswer.test_id || null,
        test_name: testRecord?.test_name || modelAnswer.title,
        student_id: sheet.student_id,
        student_name: student ? student.name : sheet.student_name,
        roll_number: student?.roll_number || null,
        title: modelAnswer.title || testRecord?.test_name,
        similarity,
        suggested_marks: suggestedMarks,
        max_marks: modelAnswer.max_marks,
        explanation: explanation || '',
        rubric_scores: rubricScores.length > 0 ? rubricScores : null,
        question_evaluations: questionEvaluations.length > 0 ? questionEvaluations : null
      });
    } catch (e) {
      failed.push(sheetId);
    }
  }

  res.json({
    processed_count: successful.length,
    successful_evaluations: successful,
    failed_ids: failed
  });
});
