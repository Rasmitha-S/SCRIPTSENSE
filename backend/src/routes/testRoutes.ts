import { Router, Response } from 'express';
import { queryOne, queryAll, execute } from '../database/index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { uploadMiddleware, saveUploadedBuffer } from '../services/fileService.js';
import { extractTextFromBuffer } from '../services/ocrService.js';
import { evaluateAnswers, evaluateMultiQuestionExam } from '../services/evaluationService.js';
import { Test, Student, ModelAnswer, AnswerSheet, Evaluation, QuestionItem, RubricCriterion } from '../types/index.js';

export const testRouter = Router();

testRouter.use(requireAuth);

// POST /api/tests
testRouter.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.user!.id;
  const { test_name, subject, max_marks, question, answer_text, questions, rubric, student_ids, new_students } = req.body;

  if (!test_name || !test_name.trim()) {
    res.status(400).json({ detail: 'Test name cannot be empty.' });
    return;
  }

  let questionsJsonStr: string | null = null;
  let rubricJsonStr: string | null = null;
  let questionsCount = 1;
  let totalMaxMarks = Number(max_marks) || 10.0;
  let primaryQuestion = '';
  let primaryAnswer = '';

  if (questions && Array.isArray(questions) && questions.length > 0) {
    questionsJsonStr = JSON.stringify(questions);
    const calcMarks = questions.reduce((acc: number, q: any) => acc + (Number(q.max_marks) || 5.0), 0);
    totalMaxMarks = calcMarks;
    questionsCount = questions.length;
    primaryQuestion = `${test_name.trim()} — ` + questions.map((q: any, i: number) => `Q${q.q_num || i + 1}: ${(q.question || '').slice(0, 50)}`).join(' | ');
    primaryAnswer = questions.map((q: any, i: number) => `[Q${q.q_num || i + 1} Model Solution]:\n${q.model_answer || ''}`).join('\n\n');
  } else {
    primaryQuestion = question && question.trim() ? question.trim() : test_name.trim();
    primaryAnswer = answer_text && answer_text.trim() ? answer_text.trim() : '';
    if (rubric && Array.isArray(rubric)) {
      rubricJsonStr = JSON.stringify(rubric);
    }
  }

  // 1. Create Test instance
  const testInsert = execute(`
    INSERT INTO tests (test_name, teacher_id, subject, max_marks, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `, test_name.trim(), teacherId, subject ? subject.trim() : 'General', totalMaxMarks);

  const testId = Number(testInsert.lastInsertRowid);

  // 2. Create ModelAnswer linked to test
  const modelInsert = execute(`
    INSERT INTO model_answers (test_id, title, subject, question, answer_text, max_marks, questions_json, rubric_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, testId, test_name.trim(), subject ? subject.trim() : 'General', primaryQuestion, primaryAnswer, totalMaxMarks, questionsJsonStr, rubricJsonStr);

  const modelAnswerId = Number(modelInsert.lastInsertRowid);

  // 3. Assign existing students belonging to this teacher
  if (student_ids && Array.isArray(student_ids)) {
    for (const sId of student_ids) {
      const st = queryOne<Student>('SELECT id FROM students WHERE id = ? AND teacher_id = ?', sId, teacherId);
      if (st) {
        execute('INSERT OR IGNORE INTO test_students (test_id, student_id) VALUES (?, ?)', testId, st.id);
      }
    }
  }

  // 4. Create and assign new students if requested
  if (new_students && Array.isArray(new_students)) {
    for (const newSt of new_students) {
      const nameClean = (newSt.name || '').trim();
      if (!nameClean) continue;
      const rollClean = newSt.roll_number && newSt.roll_number.trim() ? newSt.roll_number.trim() : null;

      let stObj: Student | undefined;
      if (rollClean) {
        stObj = queryOne<Student>('SELECT * FROM students WHERE teacher_id = ? AND roll_number = ?', teacherId, rollClean);
      }
      if (!stObj) {
        const insertSt = execute(`
          INSERT INTO students (teacher_id, name, roll_number, created_at)
          VALUES (?, ?, ?, datetime('now'))
        `, teacherId, nameClean, rollClean);
        stObj = queryOne<Student>('SELECT * FROM students WHERE id = ?', Number(insertSt.lastInsertRowid));
      }
      if (stObj) {
        execute('INSERT OR IGNORE INTO test_students (test_id, student_id) VALUES (?, ?)', testId, stObj.id);
      }
    }
  }

  // Retrieve assigned students
  const assignedStudents = queryAll<Student>(`
    SELECT students.* FROM students
    JOIN test_students ON students.id = test_students.student_id
    WHERE test_students.test_id = ?
  `, testId);

  const testRecord = queryOne<Test>('SELECT * FROM tests WHERE id = ?', testId)!;

  let parsedQuestions: any[] | null = null;
  if (questionsJsonStr) {
    try {
      parsedQuestions = JSON.parse(questionsJsonStr);
    } catch (e) {}
  }

  res.status(201).json({
    id: testRecord.id,
    test_name: testRecord.test_name,
    teacher_id: testRecord.teacher_id,
    subject: testRecord.subject,
    max_marks: testRecord.max_marks,
    created_at: testRecord.created_at,
    questions_count: questionsCount,
    students_count: assignedStudents.length,
    model_answer_id: modelAnswerId,
    students: assignedStudents.map(s => ({
      id: s.id,
      teacher_id: s.teacher_id,
      name: s.name,
      roll_number: s.roll_number,
      created_at: s.created_at
    })),
    questions: parsedQuestions
  });
});

// GET /api/tests
testRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.user!.id;
  const tests = queryAll<Test>('SELECT * FROM tests WHERE teacher_id = ? ORDER BY id DESC', teacherId);

  const results = tests.map(t => {
    const ma = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE test_id = ? LIMIT 1', t.id);
    const students = queryAll<Student>(`
      SELECT students.* FROM students
      JOIN test_students ON students.id = test_students.student_id
      WHERE test_students.test_id = ?
    `, t.id);

    let parsedQuestions: any[] | null = null;
    let qCount = 1;
    if (ma && ma.questions_json) {
      try {
        parsedQuestions = JSON.parse(ma.questions_json);
        qCount = Array.isArray(parsedQuestions) ? parsedQuestions.length : 1;
      } catch (e) {}
    }

    return {
      id: t.id,
      test_name: t.test_name,
      teacher_id: t.teacher_id,
      subject: t.subject,
      max_marks: t.max_marks,
      created_at: t.created_at,
      questions_count: qCount,
      students_count: students.length,
      model_answer_id: ma?.id || null,
      students: students.map(s => ({
        id: s.id,
        teacher_id: s.teacher_id,
        name: s.name,
        roll_number: s.roll_number,
        created_at: s.created_at
      })),
      questions: parsedQuestions
    };
  });

  res.json(results);
});

// GET /api/tests/overview
testRouter.get('/overview', (req: AuthenticatedRequest, res: Response): void => {
  const teacherId = req.user!.id;
  const tests = queryAll<Test>('SELECT * FROM tests WHERE teacher_id = ? ORDER BY id DESC', teacherId);

  const overviewList = tests.map(t => {
    const ma = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE test_id = ? LIMIT 1', t.id);
    let qCount = 1;
    if (ma && ma.questions_json) {
      try {
        const parsed = JSON.parse(ma.questions_json);
        qCount = Array.isArray(parsed) ? parsed.length : 1;
      } catch (e) {}
    }

    const testStudents = queryAll<Student>(`
      SELECT students.* FROM students
      JOIN test_students ON students.id = test_students.student_id
      WHERE test_students.test_id = ?
    `, t.id);

    const testSheets = queryAll<AnswerSheet>('SELECT * FROM answer_sheets WHERE test_id = ?', t.id);
    const sheetByStudent = new Map<number, AnswerSheet>();
    for (const s of testSheets) {
      if (s.student_id) sheetByStudent.set(s.student_id, s);
    }

    let uploadedCount = 0;
    let evaluatedCount = 0;
    let verifiedCount = 0;

    const studentStatusList = testStudents.map(st => {
      const sheet = sheetByStudent.get(st.id);
      let statusVal = 'Pending Upload';
      let answerSheetId: number | null = null;
      let evalId: number | null = null;
      let simVal: number | null = null;
      let sugMarks: number | null = null;
      let finMarks: number | null = null;
      let verBy: string | null = null;
      let verAt: string | null = null;
      let upAt: string | null = null;

      if (sheet) {
        answerSheetId = sheet.id;
        upAt = sheet.uploaded_at;
        const evals = queryAll<any>('SELECT * FROM evaluations WHERE answer_sheet_id = ? ORDER BY id DESC', sheet.id);

        if (evals && evals.length > 0) {
          const latestEval = evals[0];
          evalId = latestEval.id;
          simVal = latestEval.similarity;
          sugMarks = latestEval.suggested_marks;

          const finalRes = queryOne<any>('SELECT * FROM final_results WHERE evaluation_id = ?', latestEval.id);
          if (finalRes && finalRes.final_marks !== null && finalRes.final_marks !== undefined) {
            statusVal = 'Verified';
            finMarks = finalRes.final_marks;
            verBy = finalRes.verified_by || null;
            verAt = finalRes.verified_at || null;
            verifiedCount++;
          } else {
            statusVal = 'Evaluated';
            evaluatedCount++;
          }
        } else {
          statusVal = 'Uploaded';
          uploadedCount++;
        }
      }

      return {
        student_id: st.id,
        student_name: st.name,
        roll_number: st.roll_number,
        answer_sheet_id: answerSheetId,
        evaluation_id: evalId,
        status: statusVal,
        similarity: simVal,
        suggested_marks: sugMarks,
        final_marks: finMarks,
        max_marks: t.max_marks,
        verified_by: verBy,
        verified_at: verAt,
        uploaded_at: upAt
      };
    });

    return {
      id: t.id,
      test_name: t.test_name,
      teacher_id: t.teacher_id,
      subject: t.subject,
      max_marks: t.max_marks,
      created_at: t.created_at,
      model_answer_id: ma?.id || null,
      questions_count: qCount,
      students_count: testStudents.length,
      uploaded_count: uploadedCount,
      evaluated_count: evaluatedCount,
      verified_count: verifiedCount,
      students: studentStatusList
    };
  });

  res.json(overviewList);
});

// GET /api/tests/:id
testRouter.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const testId = parseInt(req.params.id, 10);
  const teacherId = req.user!.id;

  const test = queryOne<Test>('SELECT * FROM tests WHERE id = ?', testId);
  if (!test) {
    res.status(404).json({ detail: `Test with ID ${testId} not found.` });
    return;
  }

  if (test.teacher_id !== null && test.teacher_id !== teacherId) {
    res.status(403).json({ detail: 'Access denied: You do not have permission to view tests belonging to another teacher.' });
    return;
  }

  const ma = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE test_id = ? LIMIT 1', test.id);
  const students = queryAll<Student>(`
    SELECT students.* FROM students
    JOIN test_students ON students.id = test_students.student_id
    WHERE test_students.test_id = ?
  `, test.id);

  let parsedQuestions: any[] | null = null;
  let qCount = 1;
  if (ma && ma.questions_json) {
    try {
      parsedQuestions = JSON.parse(ma.questions_json);
      qCount = Array.isArray(parsedQuestions) ? parsedQuestions.length : 1;
    } catch (e) {}
  }

  res.json({
    id: test.id,
    test_name: test.test_name,
    teacher_id: test.teacher_id,
    subject: test.subject,
    max_marks: test.max_marks,
    created_at: test.created_at,
    questions_count: qCount,
    students_count: students.length,
    model_answer_id: ma?.id || null,
    students: students.map(s => ({
      id: s.id,
      teacher_id: s.teacher_id,
      name: s.name,
      roll_number: s.roll_number,
      created_at: s.created_at
    })),
    questions: parsedQuestions
  });
});

// POST /api/tests/:id/students
testRouter.post('/:id/students', (req: AuthenticatedRequest, res: Response): void => {
  const testId = parseInt(req.params.id, 10);
  const teacherId = req.user!.id;

  const test = queryOne<Test>('SELECT * FROM tests WHERE id = ?', testId);
  if (!test) {
    res.status(404).json({ detail: `Test with ID ${testId} not found.` });
    return;
  }

  if (test.teacher_id !== null && test.teacher_id !== teacherId) {
    res.status(403).json({ detail: 'Access denied: You cannot modify tests belonging to another teacher.' });
    return;
  }

  const { student_ids, new_students } = req.body;

  if (student_ids && Array.isArray(student_ids)) {
    for (const sId of student_ids) {
      const st = queryOne<Student>('SELECT id FROM students WHERE id = ? AND teacher_id = ?', sId, teacherId);
      if (st) {
        execute('INSERT OR IGNORE INTO test_students (test_id, student_id) VALUES (?, ?)', testId, st.id);
      }
    }
  }

  if (new_students && Array.isArray(new_students)) {
    for (const newSt of new_students) {
      const nameClean = (newSt.name || '').trim();
      if (!nameClean) continue;
      const rollClean = newSt.roll_number && newSt.roll_number.trim() ? newSt.roll_number.trim() : null;

      let stObj: Student | undefined;
      if (rollClean) {
        stObj = queryOne<Student>('SELECT * FROM students WHERE teacher_id = ? AND roll_number = ?', teacherId, rollClean);
      }
      if (!stObj) {
        const insertSt = execute(`
          INSERT INTO students (teacher_id, name, roll_number, created_at)
          VALUES (?, ?, ?, datetime('now'))
        `, teacherId, nameClean, rollClean);
        stObj = queryOne<Student>('SELECT * FROM students WHERE id = ?', Number(insertSt.lastInsertRowid));
      }
      if (stObj) {
        execute('INSERT OR IGNORE INTO test_students (test_id, student_id) VALUES (?, ?)', testId, stObj.id);
      }
    }
  }

  const ma = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE test_id = ? LIMIT 1', test.id);
  const students = queryAll<Student>(`
    SELECT students.* FROM students
    JOIN test_students ON students.id = test_students.student_id
    WHERE test_students.test_id = ?
  `, test.id);

  res.json({
    id: test.id,
    test_name: test.test_name,
    teacher_id: test.teacher_id,
    subject: test.subject,
    max_marks: test.max_marks,
    created_at: test.created_at,
    questions_count: 1,
    students_count: students.length,
    model_answer_id: ma?.id || null,
    students: students.map(s => ({
      id: s.id,
      teacher_id: s.teacher_id,
      name: s.name,
      roll_number: s.roll_number,
      created_at: s.created_at
    }))
  });
});

// POST /api/tests/:id/evaluate-all
testRouter.post('/:id/evaluate-all', (req: AuthenticatedRequest, res: Response): void => {
  const testId = parseInt(req.params.id, 10);
  const teacherId = req.user!.id;

  const test = queryOne<Test>('SELECT * FROM tests WHERE id = ?', testId);
  if (!test) {
    res.status(404).json({ detail: `Test with ID ${testId} not found.` });
    return;
  }

  if (test.teacher_id !== null && test.teacher_id !== teacherId) {
    res.status(403).json({ detail: 'Access denied: You cannot evaluate tests belonging to another teacher.' });
    return;
  }

  const modelAnswer = queryOne<ModelAnswer>('SELECT * FROM model_answers WHERE test_id = ? LIMIT 1', testId);
  if (!modelAnswer) {
    res.status(400).json({ detail: 'This test does not have a configured model answer.' });
    return;
  }

  const sheets = queryAll<AnswerSheet>('SELECT * FROM answer_sheets WHERE test_id = ?', testId);

  if (!sheets || sheets.length === 0) {
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

  for (const sheet of sheets) {
    try {
      const studentText = sheet.extracted_text || '';
      let similarity = 0.0;
      let suggestedMarks = 0.0;
      let explanation = '';
      let rubricScores: any[] = [];
      let questionEvaluations: any[] = [];

      if (questionsList && questionsList.length > 0) {
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
      const studentObj = sheet.student_id ? queryOne<Student>('SELECT * FROM students WHERE id = ?', sheet.student_id) : undefined;

      successful.push({
        evaluation_id: evaluationId,
        answer_sheet_id: sheet.id,
        model_answer_id: modelAnswer.id,
        test_id: test.id,
        test_name: test.test_name,
        student_id: sheet.student_id,
        student_name: studentObj ? studentObj.name : sheet.student_name,
        roll_number: studentObj?.roll_number || null,
        title: test.test_name,
        similarity,
        suggested_marks: suggestedMarks,
        max_marks: modelAnswer.max_marks,
        explanation: explanation || '',
        rubric_scores: rubricScores.length > 0 ? rubricScores : null,
        question_evaluations: questionEvaluations.length > 0 ? questionEvaluations : null
      });
    } catch (e) {
      failed.push(sheet.id);
    }
  }

  res.json({
    processed_count: successful.length,
    successful_evaluations: successful,
    failed_ids: failed
  });
});

// DELETE /api/tests/:id
testRouter.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const testId = parseInt(req.params.id, 10);
  const teacherId = req.user!.id;

  const test = queryOne<Test>('SELECT * FROM tests WHERE id = ?', testId);
  if (!test) {
    res.status(404).json({ detail: `Test with ID ${testId} not found.` });
    return;
  }

  if (test.teacher_id !== null && test.teacher_id !== teacherId) {
    res.status(403).json({ detail: 'Access denied: You do not have permission to delete tests belonging to another teacher.' });
    return;
  }

  const testName = test.test_name;
  execute('DELETE FROM tests WHERE id = ?', testId);

  res.json({
    message: `Test '${testName}' (ID: ${testId}) deleted successfully.`,
    success: true
  });
});

// POST /api/tests/extract-model-answer
testRouter.post('/extract-model-answer', uploadMiddleware.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ detail: 'No file uploaded' });
    return;
  }

  try {
    saveUploadedBuffer(req.file.buffer, req.file.originalname, `model_extract_${Date.now()}`);
    const extractedText = await extractTextFromBuffer(req.file.buffer, req.file.originalname);

    const ext = (req.file.originalname.split('.').pop() || 'file').toLowerCase();

    res.json({
      filename: req.file.originalname,
      extracted_text: extractedText,
      file_type: ext,
      status: 'success'
    });
  } catch (err: any) {
    res.status(500).json({ detail: `Failed to extract model answer text: ${err?.message || err}` });
  }
});
