import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  uploadAnswerSheetApi, 
  getStudentsApi, 
  getTestsApi,
  updateTranscriptApi 
} from '../services/api';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  FileUp, 
  Eye, 
  Sparkles, 
  Info, 
  Layers, 
  User, 
  Hash, 
  UserPlus, 
  Users,
  Edit3,
  Save,
  Check,
  Loader2,
  RefreshCw,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';

export const UploadAnswer = () => {
  const { token, workflowData, updateWorkflow } = useAuth();
  const navigate = useNavigate();

  // Test Selection state
  const [testsList, setTestsList] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState(workflowData.testId || null);
  const [loadingTests, setLoadingTests] = useState(false);

  const [studentName, setStudentName] = useState(workflowData.studentName || '');
  const [rollNumber, setRollNumber] = useState(workflowData.rollNumber || '');
  const [selectedStudentId, setSelectedStudentId] = useState(workflowData.studentId || null);
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(Boolean(workflowData.answerSheetId && workflowData.extractedText));

  // Transcript editing state
  const [editableTranscript, setEditableTranscript] = useState(workflowData.extractedText || '');
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [transcriptSaveSuccess, setTranscriptSaveSuccess] = useState(false);

  const fileInputRef = useRef(null);

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];

  // Sync local state when workflowData changes
  useEffect(() => {
    if (workflowData.testId) {
      setSelectedTestId(workflowData.testId);
    }
    if (workflowData.studentName) {
      setStudentName(workflowData.studentName);
    }
    if (workflowData.rollNumber !== undefined) {
      setRollNumber(workflowData.rollNumber || '');
    }
    if (workflowData.studentId) {
      setSelectedStudentId(workflowData.studentId);
    }
    if (workflowData.extractedText) {
      setEditableTranscript(workflowData.extractedText);
    }
  }, [workflowData.testId, workflowData.studentId, workflowData.studentName, workflowData.rollNumber, workflowData.extractedText]);

  // Fetch Tests and registered students from SQLite on mount
  useEffect(() => {
    if (token) {
      setLoadingTests(true);
      getTestsApi(token)
        .then((tests) => {
          setTestsList(tests || []);
          if (tests && tests.length > 0 && !selectedTestId) {
            setSelectedTestId(tests[0].id);
            updateWorkflow({
              testId: tests[0].id,
              testName: tests[0].test_name,
              modelAnswerId: tests[0].model_answer_id,
              maxMarks: tests[0].max_marks,
            });
          }
        })
        .catch((err) => console.warn("Could not fetch tests:", err))
        .finally(() => setLoadingTests(false));

      setLoadingStudents(true);
      getStudentsApi(token)
        .then((students) => {
          setRegisteredStudents(students || []);
        })
        .catch((err) => {
          console.warn("Could not fetch students list:", err);
        })
        .finally(() => {
          setLoadingStudents(false);
        });
    }
  }, [token]);

  const handleSelectTest = (testIdStr) => {
    if (!testIdStr) {
      setSelectedTestId(null);
      return;
    }
    const tId = parseInt(testIdStr);
    setSelectedTestId(tId);
    const foundTest = testsList.find((t) => t.id === tId);
    if (foundTest) {
      updateWorkflow({
        testId: foundTest.id,
        testName: foundTest.test_name,
        modelAnswerId: foundTest.model_answer_id,
        maxMarks: foundTest.max_marks,
      });
    }
  };

  const handleSelectExistingStudent = (studentIdStr) => {
    if (!studentIdStr) {
      setSelectedStudentId(null);
      return;
    }
    const sId = parseInt(studentIdStr);
    const found = registeredStudents.find((s) => s.id === sId);
    if (found) {
      setSelectedStudentId(found.id);
      setStudentName(found.name);
      setRollNumber(found.roll_number || '');
    }
  };

  const validateAndSetFile = (selectedFile) => {
    setError('');
    if (!selectedFile) return;

    const fileExt = '.' + selectedFile.name.split('.').pop().toLowerCase();
    const isValidType = allowedTypes.includes(selectedFile.type) || allowedExtensions.includes(fileExt);

    if (!isValidType) {
      setError('Invalid file type. Please upload a PDF, JPG, JPEG, or PNG file.');
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setError('File size exceeds 15MB limit.');
      return;
    }

    setFile(selectedFile);
    setUploadSuccess(false);
    setEditableTranscript('');

    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    setError('');
    setUploadSuccess(false);
    setEditableTranscript('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!studentName.trim()) {
      setError('Please enter the student name.');
      return;
    }

    if (!file) {
      setError('Please select an answer sheet file (PDF or image) to upload.');
      return;
    }

    setUploading(true);
    setUploadSuccess(false);
    setEditableTranscript('');

    try {
      const data = await uploadAnswerSheetApi(
        file,
        studentName.trim(),
        rollNumber.trim() || null,
        selectedStudentId || null,
        token,
        selectedTestId || null
      );

      const targetTest = testsList.find((t) => t.id === (data.test_id || selectedTestId));

      updateWorkflow({
        answerSheetId: data.answer_sheet_id,
        studentId: data.student_id,
        studentName: data.student_name || studentName.trim(),
        rollNumber: data.roll_number || rollNumber.trim(),
        testId: data.test_id || selectedTestId,
        testName: data.test_name || (targetTest ? targetTest.test_name : undefined),
        modelAnswerId: targetTest ? targetTest.model_answer_id : workflowData.modelAnswerId,
        fileName: file.name,
        filePath: data.file_path,
        extractedText: data.extracted_text,
      });

      setEditableTranscript(data.extracted_text || '');
      setUploadSuccess(true);

      if (!data.extracted_text || data.extracted_text.startsWith('Text extraction failed')) {
        setError('Text extraction failed. Please try a clearer image or enter the answer manually.');
      }
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message || 'Text extraction failed. Please try a clearer image or enter the answer manually.';
      setError(errorDetail.includes('timeout') ? 'Text extraction failed. Please try a clearer image or enter the answer manually.' : errorDetail);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveTranscript = async () => {
    if (!workflowData.answerSheetId) return;
    setSavingTranscript(true);
    try {
      const res = await updateTranscriptApi(workflowData.answerSheetId, editableTranscript, token);
      updateWorkflow({ extractedText: res.extracted_text });
      setTranscriptSaveSuccess(true);
      setTimeout(() => setTranscriptSaveSuccess(false), 3000);
      return res.extracted_text;
    } catch (err) {
      console.warn("Failed to update transcript:", err);
      setError("Could not update OCR transcript.");
    } finally {
      setSavingTranscript(false);
    }
  };

  const handleSaveAndContinue = async (targetRoute = '/model-answer') => {
    if (workflowData.answerSheetId) {
      setSavingTranscript(true);
      try {
        const res = await updateTranscriptApi(workflowData.answerSheetId, editableTranscript, token);
        updateWorkflow({ extractedText: res.extracted_text });
      } catch (err) {
        console.warn("Failed to auto-save transcript on continue:", err);
      } finally {
        setSavingTranscript(false);
      }
    }
    navigate(targetRoute);
  };

  const charCount = (editableTranscript || '').length;
  const wordCount = (editableTranscript || '').trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>Workflow Step 1 of 4</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Upload Student Answer Sheet
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Upload student handwritten responses for high-speed OCR extraction and AI evaluation.
          </p>
        </div>
      </div>

      {/* Main Upload Card */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl border border-slate-800/80">
        <form onSubmit={handleUploadSubmit} className="space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-3 text-rose-300 text-sm animate-fade-in shadow-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Notice:</span>
                <span>{error}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setError('')}
                className="text-rose-400 hover:text-rose-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* Test Selector (Test-Centric Workflow)                        */}
          {/* ============================================================ */}
          <div className="p-4 rounded-2xl bg-brand-950/40 border border-brand-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-300 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-brand-400" />
                <span>Select Test / Exam</span>
              </label>
              <button
                type="button"
                onClick={() => navigate('/create-test')}
                className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
              >
                + Create New Test
              </button>
            </div>

            {loadingTests ? (
              <div className="text-xs text-slate-400 py-1">Loading available tests...</div>
            ) : testsList.length === 0 ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <span>No tests created yet. Setup a test to auto-bind model answers.</span>
                <button
                  type="button"
                  onClick={() => navigate('/create-test')}
                  className="font-bold text-brand-400 underline ml-2"
                >
                  Create Test
                </button>
              </div>
            ) : (
              <select
                value={selectedTestId || ''}
                onChange={(e) => handleSelectTest(e.target.value)}
                className="glass-input block w-full px-4 py-2.5 sm:text-sm rounded-xl text-white font-medium bg-slate-900 border-brand-500/40 focus:border-brand-400"
              >
                <option value="">-- Direct Upload (No Test Attached) --</option>
                {testsList.map((t) => (
                  <option key={t.id} value={t.id}>
                    Test #{t.id}: {t.test_name} ({t.subject || 'General'}) • {t.max_marks} M • {t.students_count} Students
                  </option>
                ))}
              </select>
            )}

            {selectedTestId && (
              <div className="text-[11px] text-brand-300/80 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
                <span>
                  Model answer for this test is automatically applied behind the scenes.
                </span>
              </div>
            )}
          </div>

          {/* Student Selection / Metadata Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                <Users className="w-4 h-4 text-brand-400" />
                <span>Student Assignment</span>
              </h3>
              <span className="text-xs text-slate-400">
                Select an existing student or enter a new student profile
              </span>
            </div>

            {/* Quick Pick Existing Student Dropdown */}
            {registeredStudents.length > 0 && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-brand-400" />
                  <span>Choose from My Class Roster ({registeredStudents.length} Students)</span>
                </label>
                <select
                  value={selectedStudentId || ''}
                  onChange={(e) => handleSelectExistingStudent(e.target.value)}
                  className="glass-input block w-full px-4 py-2.5 sm:text-sm rounded-xl text-slate-200"
                >
                  <option value="">-- Create New / Manual Student Entry --</option>
                  {registeredStudents.map((st) => (
                    <option key={st.id} value={st.id}>
                      #{st.id} — {st.name} {st.roll_number ? `(${st.roll_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Student Name Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-brand-400" />
                  <span>Student Name <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    setSelectedStudentId(null);
                  }}
                  placeholder="Enter student full name"
                  className="glass-input block w-full px-4 py-2.5 sm:text-sm rounded-xl"
                />
              </div>

              {/* Student Roll Number Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center space-x-1.5">
                  <Hash className="w-3.5 h-3.5 text-violet-400" />
                  <span>Roll Number (Optional)</span>
                </label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => {
                    setRollNumber(e.target.value);
                    setSelectedStudentId(null);
                  }}
                  placeholder="Enter roll number"
                  className="glass-input block w-full px-4 py-2.5 sm:text-sm rounded-xl font-mono text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Answer Sheet File (PDF, JPG, JPEG, PNG) <span className="text-rose-400">*</span>
            </label>

            {!file && !workflowData.fileName ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-slate-700/80 hover:border-brand-500/50 hover:bg-slate-900/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                    <FileUp className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Click to browse or drag & drop answer sheet
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Fast OCR extraction will transcribe the handwritten text immediately.
                    </p>
                  </div>
                  <span className="text-xs text-brand-400 font-medium bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
                    Fast EasyOCR Extraction
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {file ? file.name : workflowData.fileName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Uploaded to Backend'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Image Preview if available */}
            {filePreview && (
              <div className="mt-4 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="flex items-center space-x-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Selected File Preview</span>
                  </span>
                  <span className="text-emerald-400 font-medium">Valid Format</span>
                </div>
                <img
                  src={filePreview}
                  alt="Answer Sheet Preview"
                  className="max-h-64 rounded-lg mx-auto object-contain border border-slate-800"
                />
              </div>
            )}
          </div>

          {/* OCR Processing Loading State */}
          {uploading && (
            <div className="p-6 bg-gradient-to-r from-violet-950/40 via-slate-900/90 to-brand-950/40 rounded-2xl border border-violet-500/40 shadow-xl animate-fade-in space-y-4">
              <div className="flex items-start space-x-4">
                <div className="relative flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center shadow-inner">
                    <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-violet-500"></span>
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                      <span>Extracting handwritten text...</span>
                    </h4>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 animate-pulse">
                      EasyOCR Processing
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Analyzing handwriting and transcribing words with the local OCR engine. This usually takes just a few seconds.
                  </p>
                </div>
              </div>

              {/* Animated scanning progress bar */}
              <div className="space-y-1.5 pt-1">
                <div className="w-full h-2 bg-slate-800/90 rounded-full overflow-hidden border border-slate-700/60 p-0.5">
                  <div className="h-full bg-gradient-to-r from-brand-500 via-violet-500 to-indigo-400 rounded-full animate-pulse w-full"></div>
                </div>
              </div>
            </div>
          )}

          {/* Interactive OCR Transcript Editor Section - Only visible when NOT uploading and upload was successful or text exists */}
          {!uploading && (uploadSuccess || editableTranscript) && (
            <div className="space-y-4 pt-4 border-t border-slate-800 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center border border-violet-500/30">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-white block">
                        Extracted Text
                      </span>
                      <span className="inline-flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>Editable</span>
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      You can freely review, edit, or type corrections before AI evaluation.
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                    {wordCount} words • {charCount} chars
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveTranscript}
                    disabled={savingTranscript}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {savingTranscript ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : transcriptSaveSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Saved to Database!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Edits</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Helper Note for Teachers */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start space-x-3 text-amber-200 text-xs leading-relaxed shadow-sm">
                <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-300 block mb-1 text-sm flex items-center space-x-1.5">
                    <span>Teacher Review & Correction Safety Net:</span>
                  </span>
                  <p className="text-amber-200/90 text-xs">
                    <strong>Please review and correct the extracted text if needed before continuing.</strong> Rough handwriting or photo artifacts may cause OCR fragmentation. Whatever you edit or type in this box is saved directly to the database and will be used as the student's evaluated answer during AI grading — not the original raw OCR output.
                  </p>
                </div>
              </div>

              <textarea
                rows={7}
                value={editableTranscript}
                onChange={(e) => setEditableTranscript(e.target.value)}
                placeholder="OCR transcribed text will appear here. You can freely edit, fix typos, or type full corrections..."
                className="glass-input block w-full p-4 text-sm font-mono rounded-xl leading-relaxed text-slate-100 bg-slate-950/90 border-slate-700 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 transition-all shadow-inner"
              />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveTranscript}
                  disabled={savingTranscript}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 text-violet-400" />
                  <span>{transcriptSaveSuccess ? 'Saved to Database!' : 'Save Edits in Place'}</span>
                </button>

                <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleSaveAndContinue('/evaluation')}
                    disabled={savingTranscript}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all disabled:opacity-50"
                    title="Save edits and jump straight to AI Evaluation"
                  >
                    <span>Save & Continue to Evaluation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveAndContinue('/model-answer')}
                    disabled={savingTranscript}
                    className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all disabled:opacity-50"
                  >
                    {savingTranscript ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>Save & Continue to Model Answer</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                type="submit"
                disabled={uploading || !file}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 shadow-glow transition-all disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Extracting text, please wait...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload & Extract Text</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
