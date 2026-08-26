import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createTestApi, getStudentsApi, extractTextApi } from '../services/api';
import { 
  FileText, 
  Layers, 
  BookOpen, 
  Users, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft,
  Atom,
  Binary,
  CheckSquare,
  Square,
  UserPlus,
  Hash,
  User,
  HelpCircle,
  Clock,
  ShieldCheck,
  UploadCloud,
  FileUp,
  FileCheck,
  Edit3,
  Loader2,
  Info,
  X,
  FileType,
  File,
  RotateCcw
} from 'lucide-react';

export const CreateTest = () => {
  const { token, updateWorkflow } = useAuth();
  const navigate = useNavigate();

  // Test Info
  const [testName, setTestName] = useState('');
  const [subject, setSubject] = useState('');

  // Mode: 'single' | 'multi'
  const [mode, setMode] = useState('multi');

  // Single Question fields
  const [singleQuestion, setSingleQuestion] = useState('');
  const [singleAnswer, setSingleAnswer] = useState('');
  const [singleMaxMarks, setSingleMaxMarks] = useState(10.0);
  const [singleInputMethod, setSingleInputMethod] = useState('text'); // 'text' | 'upload'
  const [singleFile, setSingleFile] = useState(null);
  const [singleExtracting, setSingleExtracting] = useState(false);
  const [singleExtractError, setSingleExtractError] = useState('');
  const [singleDragActive, setSingleDragActive] = useState(false);
  const singleFileInputRef = useRef(null);

  // Multi-Question fields
  const [questions, setQuestions] = useState([
    {
      q_num: 1,
      question: '',
      model_answer: '',
      max_marks: 5.0,
      rubric: [],
      inputMethod: 'text', // 'text' | 'upload'
      attachedFile: null,
      isExtracting: false,
      extractError: '',
      extractSuccess: false,
      dragActive: false,
    }
  ]);

  // Students Assignment
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Quick add new student inline
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentRoll, setNewStudentRoll] = useState('');
  const [inlineNewStudents, setInlineNewStudents] = useState([]);

  // Status
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [createdTest, setCreatedTest] = useState(null);

  const allowedFileTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.doc', '.webp'];

  useEffect(() => {
    if (token) {
      setLoadingStudents(true);
      getStudentsApi(token)
        .then((students) => {
          setAvailableStudents(students || []);
          if (students && students.length > 0) {
            setSelectedStudentIds(students.map((s) => s.id));
          }
        })
        .catch((err) => {
          console.warn("Could not fetch students:", err);
        })
        .finally(() => {
          setLoadingStudents(false);
        });
    }
  }, [token]);

  // Total Marks Calculation
  const totalCalculatedMarks = mode === 'multi'
    ? questions.reduce((sum, q) => sum + (parseFloat(q.max_marks) || 0), 0)
    : parseFloat(singleMaxMarks) || 10.0;

  // Single Question File Extraction Handler
  const handleSingleFileChange = async (file) => {
    if (!file) return;
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExt) && !allowedFileTypes.includes(file.type)) {
      setSingleExtractError('Unsupported file format. Please upload a PDF, DOCX, PNG, or JPG file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setSingleExtractError('File size exceeds 20MB limit.');
      return;
    }

    setSingleExtractError('');
    setSingleExtracting(true);

    try {
      const res = await extractTextApi(file, token);
      setSingleAnswer(res.extracted_text || '');
      setSingleFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: res.file_type || fileExt.replace('.', '').toUpperCase()
      });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to extract text from file.';
      setSingleExtractError(detail);
    } finally {
      setSingleExtracting(false);
    }
  };

  const handleSingleRemoveFile = () => {
    setSingleFile(null);
    setSingleExtractError('');
    if (singleFileInputRef.current) singleFileInputRef.current.value = '';
  };

  // Multi-Question handlers
  const handleAddQuestion = () => {
    const nextQNum = questions.length + 1;
    setQuestions([
      ...questions,
      {
        q_num: nextQNum,
        question: '',
        model_answer: '',
        max_marks: 5.0,
        rubric: [],
        inputMethod: 'text',
        attachedFile: null,
        isExtracting: false,
        extractError: '',
        extractSuccess: false,
        dragActive: false,
      }
    ]);
  };

  const handleRemoveQuestion = (idx) => {
    if (questions.length <= 1) {
      setError("A test must have at least one question.");
      return;
    }
    const filtered = questions.filter((_, i) => i !== idx).map((q, i) => ({
      ...q,
      q_num: i + 1
    }));
    setQuestions(filtered);
  };

  const handleQuestionChange = (idx, field, val) => {
    const updated = [...questions];
    updated[idx][field] = val;
    setQuestions(updated);
  };

  const handleQuestionFileUpload = async (qIdx, file) => {
    if (!file) return;
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExt) && !allowedFileTypes.includes(file.type)) {
      const updated = [...questions];
      updated[qIdx].extractError = 'Unsupported format. Please upload PDF, DOCX, PNG, or JPG.';
      setQuestions(updated);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      const updated = [...questions];
      updated[qIdx].extractError = 'File size exceeds 20MB limit.';
      setQuestions(updated);
      return;
    }

    const updated = [...questions];
    updated[qIdx].extractError = '';
    updated[qIdx].isExtracting = true;
    setQuestions([...updated]);

    try {
      const res = await extractTextApi(file, token);
      const postUpdated = [...questions];
      postUpdated[qIdx].model_answer = res.extracted_text || '';
      postUpdated[qIdx].attachedFile = {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: res.file_type || fileExt.replace('.', '').toUpperCase()
      };
      postUpdated[qIdx].isExtracting = false;
      postUpdated[qIdx].extractSuccess = true;
      postUpdated[qIdx].extractError = '';
      setQuestions(postUpdated);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to extract text from file.';
      const postUpdated = [...questions];
      postUpdated[qIdx].isExtracting = false;
      postUpdated[qIdx].extractError = detail;
      setQuestions(postUpdated);
    }
  };

  const handleQuestionRemoveFile = (qIdx) => {
    const updated = [...questions];
    updated[qIdx].attachedFile = null;
    updated[qIdx].extractError = '';
    updated[qIdx].extractSuccess = false;
    setQuestions(updated);
  };

  const handleAddRubric = (qIdx) => {
    const updated = [...questions];
    const q = updated[qIdx];
    const rCount = (q.rubric || []).length + 1;
    if (!q.rubric) q.rubric = [];
    q.rubric.push({
      id: `q${q.q_num}_r${rCount}`,
      criterion: `Step ${rCount} criteria description...`,
      max_marks: 2.0,
      keywords: []
    });
    setQuestions(updated);
  };

  const handleRemoveRubric = (qIdx, rIdx) => {
    const updated = [...questions];
    updated[qIdx].rubric = updated[qIdx].rubric.filter((_, i) => i !== rIdx);
    setQuestions(updated);
  };

  const handleRubricChange = (qIdx, rIdx, field, val) => {
    const updated = [...questions];
    updated[qIdx].rubric[rIdx][field] = val;
    setQuestions(updated);
  };

  const handleRubricKeywords = (qIdx, rIdx, raw) => {
    const kws = raw.split(',').map((k) => k.trim()).filter(Boolean);
    const updated = [...questions];
    updated[qIdx].rubric[rIdx].keywords = kws;
    setQuestions(updated);
  };

  // Student selection handlers
  const handleToggleStudent = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllStudents = () => {
    if (selectedStudentIds.length === availableStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(availableStudents.map((s) => s.id));
    }
  };

  const handleAddInlineStudent = (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    setInlineNewStudents([
      ...inlineNewStudents,
      {
        name: newStudentName.trim(),
        roll_number: newStudentRoll.trim() || null
      }
    ]);
    setNewStudentName('');
    setNewStudentRoll('');
  };

  const handleRemoveInlineStudent = (idx) => {
    setInlineNewStudents(inlineNewStudents.filter((_, i) => i !== idx));
  };

  // Submit
  const handleCreateTestSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!testName.trim()) {
      setError('Please provide a test name.');
      return;
    }

    if (mode === 'single') {
      if (!singleQuestion.trim()) {
        setError('Please enter the question text.');
        return;
      }
      if (!singleAnswer.trim()) {
        setError('Please enter or upload the reference model answer.');
        return;
      }
    } else {
      for (let i = 0; i < questions.length; i++) {
        if (!questions[i].question.trim()) {
          setError(`Question ${i + 1} prompt cannot be empty.`);
          return;
        }
        if (!questions[i].model_answer.trim()) {
          setError(`Question ${i + 1} model answer cannot be empty. Please type or upload a solution.`);
          return;
        }
      }
    }

    setCreating(true);

    try {
      const payload = {
        test_name: testName.trim(),
        subject: subject.trim() || 'General',
        max_marks: totalCalculatedMarks,
        student_ids: selectedStudentIds,
        new_students: inlineNewStudents.length > 0 ? inlineNewStudents : undefined,
      };

      if (mode === 'single') {
        payload.question = singleQuestion.trim();
        payload.answer_text = singleAnswer.trim();
      } else {
        payload.questions = questions.map((q, idx) => ({
          q_num: idx + 1,
          question: q.question.trim(),
          model_answer: q.model_answer.trim(),
          max_marks: parseFloat(q.max_marks) || 5.0,
          rubric: (q.rubric || []).map((r, rIdx) => ({
            id: r.id || `q${idx + 1}_r${rIdx + 1}`,
            criterion: r.criterion.trim(),
            max_marks: parseFloat(r.max_marks) || 2.0,
            keywords: r.keywords || [],
          }))
        }));
      }

      const res = await createTestApi(payload, token);
      setCreatedTest(res);

      updateWorkflow({
        testId: res.id,
        testName: res.test_name,
        modelAnswerId: res.model_answer_id,
        examTitle: res.test_name,
        examSubject: res.subject,
        maxMarks: res.max_marks,
        questions: res.questions,
      });
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message || 'Failed to create test.';
      setError(errorDetail);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>Test-Centric Setup</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Create New Test / Exam
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure questions, reference model answers (typed or uploaded), and student enrollment <strong>once</strong>. All student answer sheet uploads will automatically reuse this setup.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
      </div>

      {/* Success Notification Card */}
      {createdTest && (
        <div className="p-6 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-emerald-300 animate-fade-in shadow-xl">
          <div className="flex items-start space-x-3.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-white">
                Test "{createdTest.test_name}" Created Successfully!
              </h3>
              <p className="text-xs text-emerald-300/90 mt-1">
                ID #{createdTest.id} • Total Marks: {createdTest.max_marks} M • {createdTest.students_count} Students Assigned • Model Answer Saved
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-slate-700"
            >
              View in Dashboard
            </button>
            <button
              onClick={() => {
                updateWorkflow({
                  testId: createdTest.id,
                  testName: createdTest.test_name,
                  modelAnswerId: createdTest.model_answer_id,
                });
                navigate('/upload');
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow transition-all"
            >
              <span>Upload Student Sheet</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Creation Form */}
      <form onSubmit={handleCreateTestSubmit} className="space-y-8">
        
        {/* ============================================================ */}
        {/* SECTION 1: TEST METADATA                                      */}
        {/* ============================================================ */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-brand-400">
              <FileText className="w-4 h-4" />
              <span>Step 1: Test Details</span>
            </div>
            <span className="text-xs font-bold text-slate-300">
              Total Score: <span className="text-brand-400 text-sm font-black">{totalCalculatedMarks} Marks</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Test / Exam Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Enter test / exam name (e.g. Unit Test 1)"
                className="glass-input block w-full px-4 py-2.5 text-sm rounded-xl text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Subject / Topic
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter subject or course (e.g. Physics, Mathematics)"
                className="glass-input block w-full px-4 py-2.5 text-sm rounded-xl text-white font-medium"
              />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECTION 2: QUESTIONS & MODEL ANSWERS (Configured ONCE)       */}
        {/* ============================================================ */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-violet-400">
              <BookOpen className="w-4 h-4" />
              <span>Step 2: Questions, Solutions & Step-Wise Rubrics</span>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center space-x-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  mode === 'single' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Single Question
              </button>
              <button
                type="button"
                onClick={() => setMode('multi')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center space-x-1 ${
                  mode === 'multi' ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Multi-Question Exam</span>
              </button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* SINGLE QUESTION MODE                                         */}
          {/* ============================================================ */}
          {mode === 'single' ? (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Question Prompt <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={singleQuestion}
                  onChange={(e) => setSingleQuestion(e.target.value)}
                  placeholder="Enter the question text..."
                  className="glass-input block w-full px-4 py-2.5 text-sm rounded-xl"
                />
              </div>

              {/* Model Answer Input Section */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-300">
                      Model Answer Source <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Type manually or upload a PDF, DOCX, or Image file
                    </span>
                  </div>

                  {/* Dual Mode Switcher for Single Question */}
                  <div className="flex items-center space-x-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSingleInputMethod('text')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                        singleInputMethod === 'text'
                          ? 'bg-slate-800 text-brand-300 border border-slate-700 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Type Text</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSingleInputMethod('upload')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                        singleInputMethod === 'upload'
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload File (PDF / DOCX / Image)</span>
                    </button>
                  </div>
                </div>

                {/* Upload Zone for Single Question */}
                {singleInputMethod === 'upload' && (
                  <div className="space-y-3">
                    <input
                      ref={singleFileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.docx,.doc,.webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleSingleFileChange(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />

                    {!singleFile ? (
                      <div
                        onDragEnter={(e) => { e.preventDefault(); setSingleDragActive(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setSingleDragActive(false); }}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setSingleDragActive(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleSingleFileChange(e.dataTransfer.files[0]);
                          }
                        }}
                        onClick={() => singleFileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                          singleDragActive
                            ? 'border-brand-500 bg-brand-500/10'
                            : 'border-slate-700 hover:border-brand-500/50 bg-slate-950/60 hover:bg-slate-950/90'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                            <UploadCloud className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white">
                              Click or Drag & Drop Model Answer (PDF, DOCX, Image)
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              DOCX text extracted instantly • Images & PDFs run through OCR pipeline
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                            <FileCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                              {singleFile.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {singleFile.size} • Format: {singleFile.type.toUpperCase()} • Extracted
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => singleFileInputRef.current?.click()}
                            className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold underline px-2"
                          >
                            Replace File
                          </button>
                          <button
                            type="button"
                            onClick={handleSingleRemoveFile}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {singleExtracting && (
                      <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-500/30 flex items-center space-x-3 text-xs text-violet-300 animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                        <span>Extracting text from file... Please wait.</span>
                      </div>
                    )}

                    {singleExtractError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                        <span>{singleExtractError}</span>
                      </div>
                    )}

                    {/* Safety Net Banner when text is present in upload mode */}
                    {singleAnswer && !singleExtracting && (
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start space-x-2.5 text-amber-200 text-xs">
                        <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-300 block mb-0.5">
                            Teacher Review & Correction Safety Net:
                          </span>
                          <p className="text-amber-200/90 text-[11px] leading-relaxed">
                            The extracted text from your file is displayed in the editable box below. You can review, fix any typos, or add notes before saving. Whatever is in the box will be used during evaluation.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Editable Model Solution Textarea */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      {singleInputMethod === 'upload' ? 'Editable Model Answer Text (From File):' : 'Reference Model Answer Text:'}
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">
                      {singleAnswer.trim().split(/\s+/).filter(Boolean).length} words • {singleAnswer.length} chars
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    required
                    value={singleAnswer}
                    onChange={(e) => setSingleAnswer(e.target.value)}
                    placeholder={
                      singleInputMethod === 'upload'
                        ? 'Extracted text from your uploaded document will appear here for review and correction...'
                        : 'Enter the official reference answer text...'
                    }
                    className="glass-input block w-full p-3.5 text-xs sm:text-sm font-sans rounded-xl leading-relaxed bg-slate-950/80 border-slate-700"
                  />
                </div>
              </div>

              {/* Single Max Marks */}
              <div className="max-w-xs">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Max Marks <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="100"
                  required
                  value={singleMaxMarks}
                  onChange={(e) => setSingleMaxMarks(e.target.value)}
                  className="glass-input block w-full px-4 py-2.5 text-sm rounded-xl font-bold text-brand-300"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Points allocated for this question
                </span>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* MULTI-QUESTION MODE                                          */
            /* ============================================================ */
            <div className="space-y-6">
              {questions.map((q, qIdx) => (
                <div
                  key={qIdx}
                  className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800/90 space-y-4 relative shadow-lg"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-7 h-7 rounded-lg bg-violet-600/20 text-violet-300 font-extrabold text-xs flex items-center justify-center border border-violet-500/30">
                        Q{q.q_num}
                      </span>
                      <span className="text-sm font-bold text-white">Question #{q.q_num}</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1.5 text-xs">
                        <span className="text-slate-400 font-medium">Marks:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="100"
                          value={q.max_marks}
                          onChange={(e) => handleQuestionChange(qIdx, 'max_marks', e.target.value)}
                          className="glass-input w-16 px-2 py-1 text-xs rounded-lg font-bold text-center text-brand-300"
                        />
                        <span className="text-slate-400">M</span>
                      </div>

                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(qIdx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Remove Question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Question Prompt <span className="text-rose-400">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      value={q.question}
                      onChange={(e) => handleQuestionChange(qIdx, 'question', e.target.value)}
                      placeholder={`Enter question ${q.q_num} prompt...`}
                      className="glass-input block w-full px-3.5 py-2 text-xs rounded-xl text-slate-100"
                    />
                  </div>

                  {/* Model Answer Box with Independent Text/Upload Option */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-300">
                        Model Answer Source (Q{q.q_num}) <span className="text-rose-400">*</span>:
                      </label>

                      {/* Mode Toggle for this specific Question */}
                      <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-slate-900 border border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleQuestionChange(qIdx, 'inputMethod', 'text')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center space-x-1 ${
                            (q.inputMethod || 'text') === 'text'
                              ? 'bg-slate-800 text-brand-300 border border-slate-700 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <FileText className="w-3 h-3" />
                          <span>Type Text</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuestionChange(qIdx, 'inputMethod', 'upload')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center space-x-1 ${
                            q.inputMethod === 'upload'
                              ? 'bg-brand-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <UploadCloud className="w-3 h-3" />
                          <span>Upload File</span>
                        </button>
                      </div>
                    </div>

                    {/* File Dropzone if upload mode */}
                    {q.inputMethod === 'upload' && (
                      <div className="space-y-2.5">
                        <input
                          id={`file-input-q-${qIdx}`}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.docx,.doc,.webp"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleQuestionFileUpload(qIdx, e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />

                        {!q.attachedFile ? (
                          <div
                            onDragEnter={(e) => { e.preventDefault(); handleQuestionChange(qIdx, 'dragActive', true); }}
                            onDragLeave={(e) => { e.preventDefault(); handleQuestionChange(qIdx, 'dragActive', false); }}
                            onDragOver={(e) => { e.preventDefault(); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleQuestionChange(qIdx, 'dragActive', false);
                              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                handleQuestionFileUpload(qIdx, e.dataTransfer.files[0]);
                              }
                            }}
                            onClick={() => document.getElementById(`file-input-q-${qIdx}`)?.click()}
                            className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                              q.dragActive
                                ? 'border-brand-500 bg-brand-500/10'
                                : 'border-slate-700 hover:border-brand-500/40 bg-slate-900/50 hover:bg-slate-900/80'
                            }`}
                          >
                            <div className="flex items-center justify-center space-x-2 text-xs text-slate-300">
                              <UploadCloud className="w-4 h-4 text-brand-400 flex-shrink-0" />
                              <span>Click or Drag & Drop Model Answer (PDF, DOCX, Image) for Q{q.q_num}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              <FileCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              <span className="font-semibold text-white truncate max-w-xs">
                                {q.attachedFile.name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({q.attachedFile.size} • {q.attachedFile.type.toUpperCase()})
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => document.getElementById(`file-input-q-${qIdx}`)?.click()}
                                className="text-[11px] text-brand-400 hover:text-brand-300 underline font-medium"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuestionRemoveFile(qIdx)}
                                className="text-slate-400 hover:text-rose-400"
                                title="Remove file"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {q.isExtracting && (
                          <div className="p-2.5 rounded-lg bg-violet-950/40 border border-violet-500/30 flex items-center space-x-2 text-xs text-violet-300 animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                            <span>Extracting text from file for Q{q.q_num}...</span>
                          </div>
                        )}

                        {q.extractError && (
                          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                            <span>{q.extractError}</span>
                          </div>
                        )}

                        {/* Safety Net Banner */}
                        {q.model_answer && !q.isExtracting && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start space-x-2 text-amber-200 text-[11px]">
                            <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-amber-300 block mb-0.5">
                                Teacher Review & Correction (Q{q.q_num}):
                              </span>
                              <p className="text-amber-200/90 leading-relaxed">
                                Review and edit the extracted text below if needed before saving.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Editable Model Solution Textarea */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-slate-300">
                          {q.inputMethod === 'upload' ? `Editable Model Solution (Q${q.q_num}):` : `Model Solution Text (Q${q.q_num}):`}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {q.model_answer ? `${q.model_answer.length} chars` : ''}
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        required
                        value={q.model_answer}
                        onChange={(e) => handleQuestionChange(qIdx, 'model_answer', e.target.value)}
                        placeholder={
                          q.inputMethod === 'upload'
                            ? `Extracted text from uploaded document for Q${q.q_num} will appear here for review...`
                            : `Enter official reference solution for question ${q.q_num}...`
                        }
                        className="glass-input block w-full p-3 text-xs font-sans rounded-xl leading-relaxed bg-slate-950/80"
                      />
                    </div>
                  </div>

                  {/* Step-wise Rubrics */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Step-Wise Rubric Criteria (Optional):
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddRubric(qIdx)}
                        className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Criterion</span>
                      </button>
                    </div>

                    {(q.rubric || []).map((r, rIdx) => (
                      <div
                        key={rIdx}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-slate-950/60 border border-slate-800"
                      >
                        <div className="sm:col-span-6">
                          <input
                            type="text"
                            value={r.criterion}
                            onChange={(e) => handleRubricChange(qIdx, rIdx, 'criterion', e.target.value)}
                            placeholder="Criterion description (e.g. key formula, definition)..."
                            className="glass-input block w-full px-2.5 py-1 text-xs rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <input
                            type="text"
                            value={(r.keywords || []).join(', ')}
                            onChange={(e) => handleRubricKeywords(qIdx, rIdx, e.target.value)}
                            placeholder="Key terms (comma-separated)"
                            className="glass-input block w-full px-2.5 py-1 text-[11px] font-mono rounded-lg"
                            title="Comma-separated mandatory concepts"
                          />
                        </div>
                        <div className="sm:col-span-2 flex items-center space-x-1">
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={r.max_marks}
                            onChange={(e) => handleRubricChange(qIdx, rIdx, 'max_marks', e.target.value)}
                            className="glass-input w-14 px-1.5 py-1 text-xs rounded-lg text-center font-bold text-violet-300"
                          />
                          <span className="text-[10px] text-slate-400">M</span>
                        </div>
                        <div className="sm:col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveRubric(qIdx, rIdx)}
                            className="text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddQuestion}
                className="w-full py-3 rounded-xl border border-dashed border-slate-700 hover:border-brand-500 text-xs font-bold text-slate-300 hover:text-brand-300 transition-colors flex items-center justify-center space-x-2 bg-slate-900/40"
              >
                <Plus className="w-4 h-4 text-brand-400" />
                <span>Add Question #{questions.length + 1}</span>
              </button>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* SECTION 3: ASSIGN STUDENTS TO THIS TEST                      */}
        {/* ============================================================ */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Users className="w-4 h-4" />
              <span>Step 3: Assign Students to this Test</span>
            </div>
            <span className="text-xs text-slate-400">
              {selectedStudentIds.length + inlineNewStudents.length} Students Selected
            </span>
          </div>

          {/* Existing Class Roster Picker */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Select from Class Roster ({availableStudents.length} Registered Students)
              </label>
              {availableStudents.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllStudents}
                  className="text-xs font-bold text-brand-400 hover:text-brand-300"
                >
                  {selectedStudentIds.length === availableStudents.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {loadingStudents ? (
              <div className="py-8 text-center text-slate-400 text-xs">Loading students...</div>
            ) : availableStudents.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 text-center">
                No students found in your roster yet. You can add new students directly below!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
                {availableStudents.map((st) => {
                  const isSelected = selectedStudentIds.includes(st.id);
                  return (
                    <div
                      key={st.id}
                      onClick={() => handleToggleStudent(st.id)}
                      className={`p-3 rounded-xl border flex items-center space-x-2.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-brand-950/60 border-brand-500/40 text-brand-200'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 text-slate-400'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-brand-400 flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      )}
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold text-white truncate">{st.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {st.roll_number ? `Roll: ${st.roll_number}` : `ID: #${st.id}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inline Add New Students Directly into this Test */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Or Add New Students Directly to this Test:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="New student name (e.g. Marie Curie)"
                  className="glass-input block w-full px-3 py-2 text-xs rounded-xl"
                />
              </div>
              <div className="sm:col-span-4">
                <input
                  type="text"
                  value={newStudentRoll}
                  onChange={(e) => setNewStudentRoll(e.target.value)}
                  placeholder="Roll Number (e.g. CS-101)"
                  className="glass-input block w-full px-3 py-2 text-xs rounded-xl font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddInlineStudent}
                  disabled={!newStudentName.trim()}
                  className="w-full h-full py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors flex items-center justify-center space-x-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* List of newly added inline students */}
            {inlineNewStudents.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {inlineNewStudents.map((st, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                  >
                    <span>{st.name} {st.roll_number && `(${st.roll_number})`}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveInlineStudent(i)}
                      className="text-emerald-400 hover:text-rose-400 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            Cancel & Return to Dashboard
          </button>

          <button
            type="submit"
            disabled={creating}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-8 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 shadow-glow transition-all disabled:opacity-50"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Creating Test & Model Answers...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-brand-200" />
                <span>Save & Create Test ({totalCalculatedMarks} M)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
