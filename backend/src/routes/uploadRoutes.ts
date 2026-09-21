import { Router, Response } from 'express';
import { queryOne, execute } from '../database/index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { uploadMiddleware, saveUploadedBuffer } from '../services/fileService.js';
import { extractTextFromBuffer } from '../services/ocrService.js';
import { Student, Test, AnswerSheet } from '../types/index.js';

export const uploadRouter = Router();

uploadRouter.use(requireAuth);

// POST /api/upload
uploadRouter.post('/upload', uploadMiddleware.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const teacherId = req.user!.id;
  const uploaderName = req.user!.full_name || req.user!.username;

  if (!req.file) {
    res.status(400).json({ detail: 'No file uploaded.' });
    return;
  }

  const { student_id, student_name, roll_number, test_id } = req.body;
  const testIdNum = test_id ? parseInt(test_id, 10) : null;
  const studentIdNum = student_id ? parseInt(student_id, 10) : null;

  // Verify test ownership if test_id provided
  let testObj: Test | undefined;
  if (testIdNum) {
    testObj = queryOne<Test>('SELECT * FROM tests WHERE id = ?', testIdNum);
    if (!testObj) {
      res.status(404).json({ detail: `Test with ID ${testIdNum} not found.` });
      return;
    }
    if (testObj.teacher_id !== null && testObj.teacher_id !== teacherId) {
      res.status(403).json({ detail: "Access denied: Cannot upload answer sheets for another teacher's test." });
      return;
    }
  }

  // Resolve or create Student with strict teacher isolation
  let student: Student | undefined;
  if (studentIdNum) {
    student = queryOne<Student>('SELECT * FROM students WHERE id = ?', studentIdNum);
    if (!student) {
      res.status(404).json({ detail: `Student with ID ${studentIdNum} not found.` });
      return;
    }
    if (student.teacher_id !== null && student.teacher_id !== teacherId) {
      res.status(403).json({ detail: "Access denied: Cannot upload answer sheets for another teacher's student." });
      return;
    }
  }

  if (!student && student_name && student_name.trim()) {
    const nameClean = student_name.trim();
    const rollClean = roll_number && roll_number.trim() ? roll_number.trim() : null;

    if (rollClean) {
      student = queryOne<Student>('SELECT * FROM students WHERE teacher_id = ? AND roll_number = ?', teacherId, rollClean);
    }
    if (!student) {
      student = queryOne<Student>('SELECT * FROM students WHERE teacher_id = ? AND name = ?', teacherId, nameClean);
    }
    if (!student) {
      const insertSt = execute(`
        INSERT INTO students (teacher_id, name, roll_number, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `, teacherId, nameClean, rollClean);
      student = queryOne<Student>('SELECT * FROM students WHERE id = ?', Number(insertSt.lastInsertRowid));
    }
  }

  if (!student) {
    const defaultName = student_name && student_name.trim() ? student_name.trim() : 'Anonymous Student';
    student = queryOne<Student>('SELECT * FROM students WHERE teacher_id = ? AND name = ? AND roll_number IS NULL', teacherId, defaultName);
    if (!student) {
      const insertSt = execute(`
        INSERT INTO students (teacher_id, name, roll_number, created_at)
        VALUES (?, ?, NULL, datetime('now'))
      `, teacherId, defaultName);
      student = queryOne<Student>('SELECT * FROM students WHERE id = ?', Number(insertSt.lastInsertRowid));
    }
  }

  if (testObj && student) {
    execute('INSERT OR IGNORE INTO test_students (test_id, student_id) VALUES (?, ?)', testObj.id, student.id);
  }

  // 1. Create preliminary database record to obtain unique ID
  const insertSheet = execute(`
    INSERT INTO answer_sheets (student_id, teacher_id, test_id, student_name, file_path, extracted_text, uploaded_by, uploaded_at)
    VALUES (?, ?, ?, ?, 'pending', 'Processing OCR...', ?, datetime('now'))
  `, student!.id, teacherId, testObj ? testObj.id : null, student!.name, uploaderName);

  const answerSheetId = Number(insertSheet.lastInsertRowid);

  // 2. Save file to disk
  let savedFile: { relativePath: string; absolutePath: string };
  try {
    savedFile = saveUploadedBuffer(req.file.buffer, req.file.originalname, String(answerSheetId));
  } catch (err: any) {
    execute('DELETE FROM answer_sheets WHERE id = ?', answerSheetId);
    res.status(500).json({ detail: `Failed to save uploaded file: ${err?.message || err}` });
    return;
  }

  // 3. Extract text via OCR pipeline
  const extractedText = await extractTextFromBuffer(req.file.buffer, req.file.originalname);
  console.log(`\n[OCR EXTRACTED TEXT from '${req.file.originalname}']:\n${extractedText}\n`);

  // 4. Update answer sheet record
  execute(`
    UPDATE answer_sheets 
    SET file_path = ?, extracted_text = ?
    WHERE id = ?
  `, savedFile.relativePath, extractedText, answerSheetId);

  res.json({
    answer_sheet_id: answerSheetId,
    student_id: student!.id,
    student_name: student!.name,
    roll_number: student!.roll_number,
    test_id: testObj ? testObj.id : null,
    test_name: testObj ? testObj.test_name : null,
    file_path: savedFile.relativePath,
    filename: req.file.originalname,
    extracted_text: extractedText,
    uploaded_by: uploaderName,
    status: 'processed'
  });
});

// PUT /api/uploads/:id/transcript
uploadRouter.put('/uploads/:id/transcript', (req: AuthenticatedRequest, res: Response): void => {
  const sheetId = parseInt(req.params.id, 10);
  const teacherId = req.user!.id;
  const { extracted_text } = req.body;

  const sheet = queryOne<AnswerSheet>('SELECT * FROM answer_sheets WHERE id = ?', sheetId);
  if (!sheet) {
    res.status(404).json({ detail: `Answer sheet with ID ${sheetId} not found.` });
    return;
  }

  const student = sheet.student_id ? queryOne<Student>('SELECT * FROM students WHERE id = ?', sheet.student_id) : undefined;
  const sheetTeacherId = sheet.teacher_id || student?.teacher_id;

  if (sheetTeacherId !== null && sheetTeacherId !== undefined && sheetTeacherId !== teacherId) {
    res.status(403).json({ detail: "Access denied: You do not have permission to edit transcripts for another teacher's student." });
    return;
  }

  const cleanText = (extracted_text || '').trim();
  execute('UPDATE answer_sheets SET extracted_text = ? WHERE id = ?', cleanText, sheetId);

  res.json({
    answer_sheet_id: sheet.id,
    student_id: sheet.student_id,
    student_name: student ? student.name : sheet.student_name,
    roll_number: student?.roll_number || null,
    file_path: sheet.file_path,
    extracted_text: cleanText,
    uploaded_by: sheet.uploaded_by
  });
});

// POST /api/extract-text
uploadRouter.post('/extract-text', uploadMiddleware.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ detail: 'No file uploaded.' });
    return;
  }

  try {
    saveUploadedBuffer(req.file.buffer, req.file.originalname, `extract_${Date.now()}`);
    const extractedText = await extractTextFromBuffer(req.file.buffer, req.file.originalname);
    const ext = (req.file.originalname.split('.').pop() || 'file').toLowerCase();

    res.json({
      filename: req.file.originalname,
      extracted_text: extractedText,
      file_type: ext,
      status: 'success'
    });
  } catch (err: any) {
    res.status(500).json({ detail: `Failed to extract text: ${err?.message || err}` });
  }
});
