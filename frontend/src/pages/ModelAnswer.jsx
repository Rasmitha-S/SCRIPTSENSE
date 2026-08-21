import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createModelAnswerApi } from '../services/api';
import { 
  BookOpen, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  AlertCircle,
  Hash,
  FileCode,
  Atom,
  Binary,
  Layers,
  Plus,
  Trash2,
  ListOrdered,
  Tag,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Bookmark,
  Upload,
  FileText,
  FileCheck,
  X,
  FileType,
  Info
} from 'lucide-react';

export const ModelAnswer = () => {
  const { token, workflowData, updateWorkflow } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Mode: 'single' or 'multi'
  const [mode, setMode] = useState(workflowData.questions?.length > 1 ? 'multi' : 'single');

  // Single question input method: 'text' or 'upload'
  const [inputMethod, setInputMethod] = useState('text');
  const [pdfFile, setPdfFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [overrideText, setOverrideText] = useState('');
  const [lastExtractedText, setLastExtractedText] = useState(workflowData.modelAnswerText || '');

  // Single question fields
  const [question, setQuestion] = useState(
    workflowData.question || "Explain Newton's second law of motion and state its mathematical expression."
  );
  const [modelAnswerText, setModelAnswerText] = useState(
    workflowData.modelAnswerText ||
      "Newton's second law of motion states that the rate of change of momentum of an object is directly proportional to the applied unbalanced force in the direction of the force. Mathematically: F = m * a (Force = mass x acceleration), where Force is in Newtons (N), mass in kg, and acceleration in m/s^2."
  );
  const [maxMarks, setMaxMarks] = useState(workflowData.maxMarks || 10);

  // Multi-question Exam fields
  const [examTitle, setExamTitle] = useState(workflowData.examTitle || 'Midterm Examination');
  const [examSubject, setExamSubject] = useState(workflowData.examSubject || 'Physics');
  const [questions, setQuestions] = useState(
    workflowData.questions && workflowData.questions.length > 0
      ? workflowData.questions
      : [
          {
            q_num: 1,
            question: "State Newton's second law of motion and write its mathematical formula.",
            model_answer: "Newton's second law of motion states that the acceleration of an object is directly proportional to the net force acting upon it and inversely proportional to its mass. Mathematically, F = m * a where F is force in Newtons, m is mass in kg, and a is acceleration in m/s^2.",
            max_marks: 8.0,
            rubric: [
              {
                id: "q1_r1",
                criterion: "Definition of Law (Force proportional to rate of change of momentum / mass & acceleration)",
                max_marks: 4.0,
                keywords: ["force", "acceleration", "proportional", "mass"]
              },
              {
                id: "q1_r2",
                criterion: "Mathematical Formula (F = m * a) with correct standard units (N, kg, m/s^2)",
                max_marks: 4.0,
                keywords: ["f = m * a", "newtons", "kg", "formula"]
              }
            ]
          },
          {
            q_num: 2,
            question: "Define the Work-Energy Theorem and provide a practical real-world example.",
            model_answer: "The Work-Energy Theorem states that the net work done by all forces acting on a particle equals the change in its kinetic energy (W_net = Delta KE). For example, when brakes are applied to a moving car, the negative work done by friction dissipates its kinetic energy to zero, bringing it to a stop.",
            max_marks: 7.0,
            rubric: [
              {
                id: "q2_r1",
                criterion: "Statement & Definition of Work-Energy Theorem (W_net = Delta KE)",
                max_marks: 4.0,
                keywords: ["work", "kinetic energy", "forces", "change"]
              },
              {
                id: "q2_r2",
                criterion: "Valid real-world application/example (e.g. car braking or object falling)",
                max_marks: 3.0,
                keywords: ["car", "brakes", "friction", "stopping"]
              }
            ]
          }
        ]
  );

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(Boolean(workflowData.modelAnswerId));
  const [error, setError] = useState('');

  const sampleTemplates = [
    {
      id: 'physics_2q_7m',
      label: 'Physics Paper: 2 Questions (2 Marks + 5 Marks = 7 Total)',
      subject: 'Physics',
      icon: Atom,
      mode: 'multi',
      title: 'Physics Short Paper: Newton Law & Work-Energy (7 Marks)',
      questions: [
        {
          q_num: 1,
          question: "State Newton's second law of motion and write its mathematical formula.",
          model_answer: "Newton's second law states that the rate of change of momentum is directly proportional to applied force. Formula: F = m * a (Force = mass x acceleration), measured in Newtons.",
          max_marks: 2.0,
          rubric: [
            {
              id: "q1_r1",
              criterion: "Core definition and formula (F = m * a)",
              max_marks: 2.0,
              keywords: ["force", "mass", "acceleration", "proportional", "f = m * a"]
            }
          ]
        },
        {
          q_num: 2,
          question: "Define the Work-Energy Theorem, provide its formula, and explain a practical real-world example.",
          model_answer: "The Work-Energy Theorem states that the net work done by forces on an object equals the change in its kinetic energy (W_net = Delta KE). For example, when car brakes are applied, friction does work to reduce kinetic energy to zero, bringing the car to rest.",
          max_marks: 5.0,
          rubric: [
            {
              id: "q2_r1",
              criterion: "Definition and formula (W_net = Delta KE)",
              max_marks: 2.5,
              keywords: ["work", "kinetic energy", "forces", "change", "delta"]
            },
            {
              id: "q2_r2",
              criterion: "Practical real-world application (car braking or falling object)",
              max_marks: 2.5,
              keywords: ["car", "brakes", "friction", "stopping", "example"]
            }
          ]
        }
      ]
    },
    {
      id: 'physics_multi',
      label: 'Physics: Mechanics & Energy (8M + 7M = 15 Total)',
      subject: 'Physics',
      icon: Atom,
      mode: 'multi',
      title: 'Physics 101: Mechanics & Work-Energy Midterm',
      questions: [
        {
          q_num: 1,
          question: "State Newton's second law of motion and write its mathematical formula.",
          model_answer: "Newton's second law of motion states that the acceleration of an object is directly proportional to the net force acting upon it and inversely proportional to its mass. Mathematically, F = m * a where F is force in Newtons, m is mass in kg, and a is acceleration in m/s^2.",
          max_marks: 8.0,
          rubric: [
            {
              id: "p1",
              criterion: "Definition of Law (Force proportional to rate of change of momentum / mass & acceleration)",
              max_marks: 4.0,
              keywords: ["force", "acceleration", "proportional", "mass"]
            },
            {
              id: "p2",
              criterion: "Mathematical Formula (F = m * a) with correct standard units (N, kg, m/s^2)",
              max_marks: 4.0,
              keywords: ["f = m * a", "newtons", "kg", "formula"]
            }
          ]
        },
        {
          q_num: 2,
          question: "Define the Work-Energy Theorem and provide a practical real-world example.",
          model_answer: "The Work-Energy Theorem states that the net work done by all forces acting on a particle equals the change in its kinetic energy (W_net = Delta KE). For example, when brakes are applied to a moving car, the negative work done by friction dissipates its kinetic energy to zero, bringing it to a stop.",
          max_marks: 7.0,
          rubric: [
            {
              id: "p3",
              criterion: "Statement & Definition of Work-Energy Theorem (W_net = Delta KE)",
              max_marks: 4.0,
              keywords: ["work", "kinetic energy", "forces", "change"]
            },
            {
              id: "p4",
              criterion: "Valid real-world application/example (e.g. car braking or object falling)",
              max_marks: 3.0,
              keywords: ["car", "brakes", "friction", "stopping"]
            }
          ]
        }
      ]
    },
    {
      id: 'cs_multi',
      label: 'CS: OOP & Memory Management (2 Questions)',
      subject: 'Computer Science',
      icon: Binary,
      mode: 'multi',
      title: 'CS201: Object-Oriented Programming & Systems',
      questions: [
        {
          q_num: 1,
          question: "Explain the difference between compile-time polymorphism and runtime polymorphism with examples.",
          model_answer: "Compile-time polymorphism (static binding) is resolved during compilation via method overloading or operator overloading. Runtime polymorphism (dynamic binding) is resolved at runtime via method overriding through inheritance and virtual functions.",
          max_marks: 8.0,
          rubric: [
            {
              id: "cs1",
              criterion: "Clear distinction between compile-time vs runtime binding",
              max_marks: 4.0,
              keywords: ["compile-time", "runtime", "overloading", "overriding"]
            },
            {
              id: "cs2",
              criterion: "Code/Conceptual examples of inheritance & virtual methods",
              max_marks: 4.0,
              keywords: ["inheritance", "virtual", "method", "signature"]
            }
          ]
        },
        {
          q_num: 2,
          question: "What is a memory leak in C++ and how can smart pointers help prevent it?",
          model_answer: "A memory leak occurs when dynamically allocated memory on the heap (via new) is not freed when no longer needed. Smart pointers like std::unique_ptr and std::shared_ptr provide RAII-based automatic lifetime management, calling delete automatically when going out of scope.",
          max_marks: 7.0,
          rubric: [
            {
              id: "cs3",
              criterion: "Accurate definition of heap allocation and unfreed memory",
              max_marks: 3.5,
              keywords: ["heap", "dynamically", "allocated", "freed", "delete"]
            },
            {
              id: "cs4",
              criterion: "Explanation of smart pointers (unique_ptr, shared_ptr) and RAII",
              max_marks: 3.5,
              keywords: ["smart pointer", "unique_ptr", "shared_ptr", "raii", "scope"]
            }
          ]
        }
      ]
    },
    {
      id: 'single_os',
      label: 'Single Q: Deadlock Coffman Conditions',
      subject: 'Operating Systems',
      icon: FileCode,
      mode: 'single',
      question: "List and briefly explain the four Coffman conditions required for a deadlock to occur.",
      answer: "The four Coffman conditions are: 1. Mutual Exclusion (at least one non-shareable resource), 2. Hold and Wait (process holds resource while requesting another), 3. No Preemption (resources cannot be forcibly confiscated), and 4. Circular Wait (a closed chain of processes each waiting for a resource held by the next).",
      marks: 10.0
    }
  ];

  const applyTemplate = (tmpl) => {
    if (tmpl.mode === 'multi') {
      setMode('multi');
      setExamTitle(tmpl.title);
      setExamSubject(tmpl.subject);
      setQuestions(tmpl.questions);
    } else {
      setMode('single');
      setQuestion(tmpl.question);
      setModelAnswerText(tmpl.answer);
      setMaxMarks(tmpl.marks);
      setOverrideText('');
      setPdfFile(null);
    }
    setError('');
    setSaveSuccess(false);
  };

  // Multi-Question Handlers
  const handleAddQuestion = () => {
    const nextQNum = questions.length + 1;
    setQuestions([
      ...questions,
      {
        q_num: nextQNum,
        question: `Question ${nextQNum} prompt...`,
        model_answer: "Enter reference model solution...",
        max_marks: 5.0,
        rubric: [
          {
            id: `q${nextQNum}_r1`,
            criterion: "Core principle & conceptual definition",
            max_marks: 3.0,
            keywords: ["concept", "principle"]
          },
          {
            id: `q${nextQNum}_r2`,
            criterion: "Application, diagram, or formula accuracy",
            max_marks: 2.0,
            keywords: ["application", "formula"]
          }
        ]
      }
    ]);
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length <= 1) {
      setError("An exam paper must have at least one question.");
      return;
    }
    const filtered = questions.filter((_, i) => i !== index).map((q, idx) => ({
      ...q,
      q_num: idx + 1
    }));
    setQuestions(filtered);
  };

  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const handleAddRubricStep = (qIndex) => {
    const updated = [...questions];
    const q = updated[qIndex];
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

  const handleRemoveRubricStep = (qIndex, rIndex) => {
    const updated = [...questions];
    updated[qIndex].rubric = updated[qIndex].rubric.filter((_, i) => i !== rIndex);
    setQuestions(updated);
  };

  const handleRubricChange = (qIndex, rIndex, field, value) => {
    const updated = [...questions];
    updated[qIndex].rubric[rIndex][field] = value;
    setQuestions(updated);
  };

  const handleRubricKeywordsChange = (qIndex, rIndex, rawStr) => {
    const kws = rawStr.split(',').map((k) => k.trim()).filter(Boolean);
    const updated = [...questions];
    updated[qIndex].rubric[rIndex].keywords = kws;
    setQuestions(updated);
  };

  const calculatedTotalMarks = mode === 'multi'
    ? questions.reduce((sum, q) => sum + (parseFloat(q.max_marks) || 0), 0)
    : parseFloat(maxMarks) || 0;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      setError('');
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
      setPdfFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const handleRemoveFile = () => {
    setPdfFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setError('');

    if (mode === 'single') {
      if (!question.trim()) {
        setError('Please provide the question prompt.');
        return;
      }
      
      // If upload mode without file and without typed override text
      if (inputMethod === 'upload' && !pdfFile && !overrideText.trim()) {
        setError('Please upload a model answer PDF file or switch to Type Text mode.');
        return;
      }

      if (inputMethod === 'text' && !modelAnswerText.trim()) {
        setError('Please provide the model reference answer text.');
        return;
      }

      const marksNum = parseFloat(maxMarks);
      if (isNaN(marksNum) || marksNum <= 0 || marksNum > 500) {
        setError('Maximum marks must be between 1 and 500.');
        return;
      }

      setSaving(true);
      try {
        let data;
        if (inputMethod === 'upload' && pdfFile) {
          const formData = new FormData();
          formData.append('file', pdfFile);
          formData.append('question', question.trim());
          formData.append('max_marks', marksNum);
          formData.append('title', question.trim().slice(0, 50));
          formData.append('subject', examSubject || 'General');
          if (overrideText.trim()) {
            formData.append('answer_text', overrideText.trim());
          }
          data = await createModelAnswerApi(formData, token);
        } else if (inputMethod === 'upload' && !pdfFile && overrideText.trim()) {
          data = await createModelAnswerApi(
            {
              question: question.trim(),
              answer_text: overrideText.trim(),
              max_marks: marksNum,
              title: question.trim().slice(0, 50),
              subject: examSubject || 'General',
            },
            token
          );
        } else {
          data = await createModelAnswerApi(
            {
              question: question.trim(),
              answer_text: modelAnswerText.trim(),
              max_marks: marksNum,
              title: question.trim().slice(0, 50),
              subject: examSubject || 'General',
            },
            token
          );
        }

        const savedText = data.extracted_text || (inputMethod === 'upload' ? (overrideText.trim() || '') : modelAnswerText.trim());
        setLastExtractedText(savedText);

        updateWorkflow({
          modelAnswerId: data.model_answer_id,
          question: question.trim(),
          modelAnswerText: savedText,
          maxMarks: marksNum,
          examTitle: question.trim().slice(0, 50),
          questions: null,
        });

        setSaveSuccess(true);
      } catch (err) {
        const errorDetail = err.response?.data?.detail || err.message || 'Failed to save model answer.';
        setError(errorDetail);
      } finally {
        setSaving(false);
      }
    } else {
      // Multi-question mode
      if (!examTitle.trim()) {
        setError('Please enter the Exam Paper Title.');
        return;
      }
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.question.trim()) {
          setError(`Question ${i + 1} prompt cannot be empty.`);
          return;
        }
        if (!q.model_answer.trim()) {
          setError(`Question ${i + 1} reference solution cannot be empty.`);
          return;
        }
      }

      setSaving(true);
      try {
        const payload = {
          title: examTitle.trim(),
          subject: examSubject.trim(),
          max_marks: calculatedTotalMarks,
          questions: questions.map((q, idx) => ({
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
          }))
        };

        const data = await createModelAnswerApi(payload, token);

        updateWorkflow({
          modelAnswerId: data.model_answer_id,
          examTitle: examTitle.trim(),
          examSubject: examSubject.trim(),
          maxMarks: data.max_marks || calculatedTotalMarks,
          questions: payload.questions,
          question: `${examTitle} (${questions.length} Questions)`,
          modelAnswerText: payload.questions.map((q) => `Q${q.q_num}: ${q.model_answer}`).join('\n\n'),
        });

        setSaveSuccess(true);
      } catch (err) {
        const errorDetail = err.response?.data?.detail || err.message || 'Failed to save multi-question exam paper.';
        setError(errorDetail);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">
            <span>Step 2 of 4</span>
            <span>•</span>
            <span className="text-slate-400">Exam & Rubrics Configuration</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Configure Model Answer & Rubrics</h1>
          <p className="text-sm text-slate-400 mt-1">
            Define reference solutions via manual text entry or PDF upload with automated OCR text extraction.
          </p>
        </div>

        {/* Mode Selector Pill */}
        <div className="flex items-center space-x-1 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'single'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Single Question
          </button>
          <button
            type="button"
            onClick={() => setMode('multi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              mode === 'multi'
                ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-Question Exam Paper</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-3 text-emerald-300 text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <span className="font-semibold">Model Answer / Exam Paper Saved in Database!</span>
                <p className="text-xs text-emerald-400/80 mt-0.5">
                  Model ID: #{workflowData.modelAnswerId} • Total Marks: {workflowData.maxMarks} Marks
                  {mode === 'multi' && ` • ${questions.length} Questions Configured`}
                  {inputMethod === 'upload' && pdfFile && ' • Extracted from Uploaded File via OCR'}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/evaluation')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors self-start sm:self-auto"
            >
              <span>Next: Run AI Evaluation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {lastExtractedText && (
            <div className="p-3 rounded-lg bg-slate-900/90 border border-emerald-500/20 text-xs text-slate-300">
              <span className="font-semibold text-emerald-400 block mb-1">
                {inputMethod === 'upload' && pdfFile ? 'OCR Extracted Model Answer Text in DB:' : 'Stored Reference Answer in DB:'}
              </span>
              <p className="font-mono text-[11px] text-slate-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                {lastExtractedText}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Preset Templates */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>Quick Templates (Single & Multi-Question + Rubrics)</span>
          </span>
          <span className="text-xs text-slate-500">Click to load into editor</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sampleTemplates.map((tmpl) => {
            const Icon = tmpl.icon;
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 text-left transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400 flex-shrink-0 group-hover:bg-brand-500/20">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-brand-300">
                    {tmpl.label}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                    <span>{tmpl.subject}</span>
                    <span>•</span>
                    <span className="text-brand-300">
                      {tmpl.mode === 'multi' ? `${tmpl.questions.length} Qs` : `${tmpl.marks} M`}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Single Question Mode Form */}
      {mode === 'single' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-6">
            {/* Question Prompt (Manual Input) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Question Prompt <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Explain Newton's second law of motion and state its mathematical expression..."
                className="glass-input block w-full px-4 py-2.5 sm:text-sm rounded-xl"
              />
            </div>

            {/* Answer Input Method Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Reference Model Answer Source <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-slate-900 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setInputMethod('text')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 ${
                      inputMethod === 'text'
                        ? 'bg-slate-800 text-brand-300 border border-slate-700 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Type Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMethod('upload')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 ${
                      inputMethod === 'upload'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload PDF / Document</span>
                  </button>
                </div>
              </div>

              {/* Option A: Type Text */}
              {inputMethod === 'text' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Type or paste the official reference solution text:</span>
                    <span className="text-xs text-slate-400">{modelAnswerText.length} chars</span>
                  </div>
                  <textarea
                    required
                    rows={5}
                    value={modelAnswerText}
                    onChange={(e) => setModelAnswerText(e.target.value)}
                    placeholder="Enter the full reference answer here..."
                    className="glass-input block w-full p-4 sm:text-sm rounded-xl resize-y font-sans leading-relaxed"
                  />
                </div>
              )}

              {/* Option B: PDF Upload Dropzone */}
              {inputMethod === 'upload' && (
                <div className="space-y-4">
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
                      dragActive
                        ? 'border-brand-500 bg-brand-500/10 scale-[1.01]'
                        : pdfFile
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-slate-700 hover:border-slate-500 bg-slate-900/50 hover:bg-slate-900/80'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {pdfFile ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <div className="flex items-center space-x-3 text-left">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                            <FileCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                              {pdfFile.name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {(pdfFile.size / 1024).toFixed(1)} KB • Ready for OCR extraction
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Attached PDF
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile();
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 mx-auto flex items-center justify-center">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Drag & drop model answer PDF here, or <span className="text-brand-400 hover:underline">Browse</span>
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Supports PDF documents, PNG, JPG, or JPEG files (Max 20MB)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Priority & Manual Override note */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="flex items-start space-x-2 text-xs text-slate-300">
                      <Info className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>OCR Processing:</strong> The backend will automatically extract text from your uploaded PDF using Tesseract OCR.
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-slate-400">
                          Optional Custom Override Text (If provided, typed text takes priority over OCR text):
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={overrideText}
                        onChange={(e) => setOverrideText(e.target.value)}
                        placeholder="Leave blank to use extracted OCR text from PDF directly, or type custom override text..."
                        className="glass-input block w-full p-3 text-xs sm:text-sm rounded-xl resize-y font-sans leading-relaxed placeholder-slate-600"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Maximum Marks (Manual Input) */}
            <div className="max-w-xs">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center space-x-1.5">
                <Hash className="w-3.5 h-3.5 text-brand-400" />
                <span>Maximum Marks <span className="text-rose-400">*</span></span>
              </label>
              <div className="relative rounded-xl">
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.5"
                  required
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(e.target.value)}
                  className="glass-input block w-full px-4 py-2.5 sm:text-sm rounded-xl font-semibold"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 pointer-events-none">Points</span>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => navigate('/upload')}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Upload</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 shadow-glow transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Saving & Processing OCR...</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4" />
                    <span>Save Model Answer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Multi-Question Exam Paper Builder */}
      {mode === 'multi' && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Exam Meta Info */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-brand-400 uppercase tracking-wider">
              <Bookmark className="w-4 h-4" />
              <span>Exam Paper Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Exam Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="e.g. Physics Midterm Examination 2026"
                  className="glass-input block w-full px-4 py-2.5 text-sm rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Subject / Course
                </label>
                <input
                  type="text"
                  value={examSubject}
                  onChange={(e) => setExamSubject(e.target.value)}
                  placeholder="e.g. Physics, CS, Bio"
                  className="glass-input block w-full px-4 py-2.5 text-sm rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
              <span>Total Questions: <strong className="text-white">{questions.length}</strong></span>
              <span>Calculated Total Exam Score: <strong className="text-emerald-400 text-sm font-bold">{calculatedTotalMarks} Marks</strong></span>
            </div>
          </div>

          {/* Question List Cards */}
          <div className="space-y-6">
            {questions.map((q, qIdx) => (
              <div key={qIdx} className="glass-panel p-6 sm:p-7 rounded-2xl border border-slate-800 space-y-5 relative">
                {/* Question Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-300 font-extrabold flex items-center justify-center text-xs">
                      Q{qIdx + 1}
                    </span>
                    <span className="text-sm font-bold text-white">Question {qIdx + 1}</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs text-slate-400">Marks:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="0.5"
                        value={q.max_marks}
                        onChange={(e) => handleQuestionChange(qIdx, 'max_marks', e.target.value)}
                        className="w-16 px-2 py-1 text-xs font-bold rounded-lg bg-slate-900 border border-slate-700 text-brand-300 text-center"
                      />
                    </div>

                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIdx)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove Question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Question Prompt <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={q.question}
                    onChange={(e) => handleQuestionChange(qIdx, 'question', e.target.value)}
                    placeholder="Enter question text..."
                    className="glass-input block w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl"
                  />
                </div>

                {/* Reference Solution */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Official Reference Solution <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={q.model_answer}
                    onChange={(e) => handleQuestionChange(qIdx, 'model_answer', e.target.value)}
                    placeholder="Enter benchmark reference answer for Q..."
                    className="glass-input block w-full p-3 text-xs sm:text-sm rounded-xl resize-y font-sans"
                  />
                </div>

                {/* Step-wise Rubrics for this question */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <ListOrdered className="w-3.5 h-3.5 text-violet-400" />
                      <span>Step-wise Grading Rubrics & Keywords (Q{qIdx + 1})</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleAddRubricStep(qIdx)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-brand-300 bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Rubric Step</span>
                    </button>
                  </div>

                  {(q.rubric || []).length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-1">
                      No step-wise rubrics configured for Q{qIdx + 1}. The AI will score based on full question semantic similarity.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {q.rubric.map((r, rIdx) => (
                        <div key={rIdx} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={r.criterion}
                                onChange={(e) => handleRubricChange(qIdx, rIdx, 'criterion', e.target.value)}
                                placeholder="e.g. Formula derivation & standard units"
                                className="glass-input block w-full px-2.5 py-1 text-xs rounded-lg font-medium"
                              />
                            </div>

                            <div className="flex items-center space-x-2">
                              <span className="text-[11px] text-slate-400">Max:</span>
                              <input
                                type="number"
                                min="0.5"
                                max={q.max_marks}
                                step="0.5"
                                value={r.max_marks}
                                onChange={(e) => handleRubricChange(qIdx, rIdx, 'max_marks', e.target.value)}
                                className="w-14 px-2 py-1 text-xs font-bold rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 text-center"
                              />
                              <span className="text-[11px] text-slate-400">M</span>

                              <button
                                type="button"
                                onClick={() => handleRemoveRubricStep(qIdx, rIdx)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                                title="Remove Step"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Keywords */}
                          <div className="flex items-center space-x-2">
                            <Tag className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            <input
                              type="text"
                              value={(r.keywords || []).join(', ')}
                              onChange={(e) => handleRubricKeywordsChange(qIdx, rIdx, e.target.value)}
                              placeholder="Required key concepts / terms (comma-separated, e.g. force, mass, kg)"
                              className="glass-input block w-full px-2.5 py-1 text-[11px] font-mono text-brand-300 rounded-lg placeholder-slate-600"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Question Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleAddQuestion}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Exam Question</span>
            </button>
          </div>

          {/* Actions Footer */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate('/upload')}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Upload</span>
            </button>

            <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-400">
                {questions.length} Questions • <strong className="text-white">{calculatedTotalMarks} M Total</strong>
              </span>

              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 shadow-glow transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Saving Exam Paper...</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4" />
                    <span>Save Multi-Question Exam Paper</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
