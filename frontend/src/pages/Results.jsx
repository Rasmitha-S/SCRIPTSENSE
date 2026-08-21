import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getResultApi, saveFinalResultApi, listAllResultsApi } from '../services/api';
import { 
  CheckCircle2, 
  Sparkles, 
  ArrowLeft, 
  Save, 
  ShieldCheck, 
  FileText, 
  BookOpen, 
  Award, 
  Percent, 
  Edit3, 
  AlertCircle, 
  Printer, 
  Layers,
  ChevronDown,
  ChevronUp,
  Zap,
  Check,
  RotateCcw,
  ArrowRight,
  User,
  Clock,
  ThumbsUp,
  MessageSquare,
  Users,
  Hash,
  ListOrdered,
  Tag,
  GraduationCap
} from 'lucide-react';

const FEEDBACK_PRESETS = [
  "Excellent conceptual clarity; steps and logic are complete.",
  "Accurate formula and core definition, but remember to include standard SI units.",
  "Good attempt; partially correct concept but requires further elaboration.",
  "Core principle is understood, but key terms/steps were omitted.",
  "Needs review on definitions and fundamental principles.",
];

export const Results = () => {
  const { token, user, workflowData, updateWorkflow } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const [selectedEvalId, setSelectedEvalId] = useState(
    id ? parseInt(id) : workflowData.evaluationId || null
  );
  const [allEvaluations, setAllEvaluations] = useState([]);

  // Active question tab in multi-question mode: 'all' or question index (0, 1, 2...)
  const [activeQuestionTab, setActiveQuestionTab] = useState('all');

  const [resultData, setResultData] = useState(null);
  const [questionResults, setQuestionResults] = useState([]);
  const [rubricAdjustments, setRubricAdjustments] = useState([]);

  const maxMarks = resultData?.max_marks || workflowData.maxMarks || 10;
  const suggestedMarks = resultData?.suggested_marks ?? workflowData.suggestedMarks ?? 0;
  const similarity = resultData?.similarity ?? workflowData.similarity ?? 0;

  const [finalMarks, setFinalMarks] = useState(suggestedMarks);
  const [teacherFeedback, setTeacherFeedback] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [verifiedTime, setVerifiedTime] = useState(null);
  const [verifiedBy, setVerifiedBy] = useState(null);
  const [error, setError] = useState('');
  const [loadingResult, setLoadingResult] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Sync selectedEvalId when route param changes
  useEffect(() => {
    if (id) {
      const parsedId = parseInt(id);
      if (!isNaN(parsedId) && parsedId !== selectedEvalId) {
        setSelectedEvalId(parsedId);
      }
    }
  }, [id]);

  // Load all evaluations list for switcher
  const loadAllEvaluations = () => {
    if (token) {
      listAllResultsApi(token)
        .then((list) => {
          setAllEvaluations(list);
          if (!selectedEvalId && list && list.length > 0) {
            setSelectedEvalId(list[0].evaluation_id);
          }
        })
        .catch((err) => {
          console.warn("Could not list all results:", err);
        });
    }
  };

  useEffect(() => {
    loadAllEvaluations();
  }, [token]);

  // Fetch full evaluation details from GET /api/results/{id}
  useEffect(() => {
    if (selectedEvalId && token) {
      setLoadingResult(true);
      setError('');
      getResultApi(selectedEvalId, token)
        .then((data) => {
          setResultData(data);
          setVerifiedBy(data.verified_by || null);

          // Initialize question results & rubrics
          const qEvals = data.question_evaluations || [];
          if (qEvals.length > 0) {
            const initialQResults = qEvals.map((qe) => {
              const existingSaved = (data.question_results || []).find((qr) => qr.q_num === qe.q_num);
              return {
                q_num: qe.q_num,
                question: qe.question,
                final_marks: existingSaved ? existingSaved.final_marks : qe.suggested_marks,
                max_marks: qe.max_marks,
                teacher_comment: existingSaved ? existingSaved.teacher_comment : '',
                rubric_scores: qe.rubric_scores || [],
              };
            });
            setQuestionResults(initialQResults);
          } else {
            setQuestionResults([]);
          }

          if (data.final_marks !== null && data.final_marks !== undefined) {
            setFinalMarks(data.final_marks);
            setSaveSuccess(true);
            setVerifiedTime(
              data.verified_at
                ? new Date(data.verified_at).toLocaleTimeString()
                : new Date().toLocaleTimeString()
            );
          } else {
            setFinalMarks(data.suggested_marks);
            setSaveSuccess(false);
            setVerifiedTime(null);
          }

          setTeacherFeedback(data.teacher_feedback || '');

          updateWorkflow({
            evaluationId: data.evaluation_id,
            answerSheetId: data.answer_sheet_id,
            studentId: data.student_id,
            studentName: data.student_name,
            rollNumber: data.roll_number,
            extractedText: data.extracted_text,
            examTitle: data.title,
            question: data.question,
            modelAnswerText: data.model_answer,
            maxMarks: data.max_marks,
            similarity: data.similarity,
            suggestedMarks: data.suggested_marks,
            explanation: data.explanation,
            finalMarks: data.final_marks,
            teacherFeedback: data.teacher_feedback || '',
          });
        })
        .catch((err) => {
          console.warn("Failed to fetch evaluation record:", err);
          setError("Could not load evaluation details from SQLite.");
        })
        .finally(() => {
          setLoadingResult(false);
        });
    }
  }, [selectedEvalId, token]);

  const handleSelectEval = (evalIdStr) => {
    const newId = parseInt(evalIdStr);
    if (!isNaN(newId)) {
      setSelectedEvalId(newId);
      navigate(`/results/${newId}`);
    }
  };

  // Adjust marks for a specific question in multi-question mode
  const handleUpdateQuestionMarks = (qNum, deltaOrValue, isDirectValue = false) => {
    setQuestionResults((prev) => {
      const updated = prev.map((q) => {
        if (q.q_num === qNum) {
          let newScore;
          if (isDirectValue) {
            newScore = Math.max(0, Math.min(q.max_marks, parseFloat(deltaOrValue) || 0));
          } else {
            newScore = Math.max(0, Math.min(q.max_marks, Number(((parseFloat(q.final_marks) || 0) + deltaOrValue).toFixed(1))));
          }
          return { ...q, final_marks: newScore };
        }
        return q;
      });

      // Recalculate total confirmed score
      const newTotal = updated.reduce((sum, q) => sum + (parseFloat(q.final_marks) || 0), 0);
      setFinalMarks(Number(newTotal.toFixed(1)));
      return updated;
    });
  };

  const handleUpdateQuestionComment = (qNum, comment) => {
    setQuestionResults((prev) =>
      prev.map((q) => (q.q_num === qNum ? { ...q, teacher_comment: comment } : q))
    );
  };

  // Quick grading helpers for overall score
  const handleApplySuggested = () => {
    setFinalMarks(suggestedMarks);
    if (resultData?.question_evaluations) {
      setQuestionResults(
        resultData.question_evaluations.map((qe) => ({
          q_num: qe.q_num,
          question: qe.question,
          final_marks: qe.suggested_marks,
          max_marks: qe.max_marks,
          teacher_comment: '',
          rubric_scores: qe.rubric_scores || [],
        }))
      );
    }
  };

  const handleApplyMax = () => {
    setFinalMarks(maxMarks);
    if (questionResults.length > 0) {
      setQuestionResults((prev) =>
        prev.map((q) => ({ ...q, final_marks: q.max_marks }))
      );
    }
  };

  const handleAddFeedbackSnippet = (snippet) => {
    setTeacherFeedback((prev) => {
      if (!prev.trim()) return snippet;
      return `${prev.trim()} ${snippet}`;
    });
  };

  const handleSaveFinalResult = async (e) => {
    e?.preventDefault();
    setError('');
    setToastMessage('');

    const marksNum = parseFloat(finalMarks);
    if (isNaN(marksNum) || marksNum < 0 || marksNum > maxMarks) {
      setError(`Final marks must be a number between 0 and ${maxMarks}.`);
      return;
    }

    if (!selectedEvalId) {
      setError('No active evaluation record selected.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        final_marks: marksNum,
        teacher_feedback: teacherFeedback.trim(),
        question_results: questionResults.map((q) => ({
          q_num: q.q_num,
          final_marks: parseFloat(q.final_marks) || 0,
          max_marks: q.max_marks,
          teacher_comment: q.teacher_comment || '',
        })),
      };

      const data = await saveFinalResultApi(selectedEvalId, payload, token);

      const verifiedAtStr = data.verified_at
        ? new Date(data.verified_at).toLocaleTimeString()
        : new Date().toLocaleTimeString();

      updateWorkflow({
        finalMarks: data.final_marks,
        teacherFeedback: teacherFeedback.trim(),
      });

      setVerifiedTime(verifiedAtStr);
      setVerifiedBy(data.verified_by || user?.full_name || user?.username || 'Teacher');
      setSaveSuccess(true);
      setToastMessage('Score successfully verified and committed to SQLite database!');

      // Update in allEvaluations list
      setAllEvaluations((prev) =>
        prev.map((item) =>
          item.evaluation_id === selectedEvalId
            ? { ...item, final_marks: data.final_marks, teacher_feedback: teacherFeedback.trim(), verified_by: data.verified_by }
            : item
        )
      );

      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message || 'Failed to save final marks to SQLite.';
      setError(errorDetail);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const hasMultiQuestions = Boolean(resultData?.question_evaluations && resultData.question_evaluations.length > 0);
  const similarityPct = (similarity * 100).toFixed(1);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <span>Step 4 of 4</span>
            <span>•</span>
            <span className="text-slate-400">Teacher Verification Console</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Evaluation Results & Teacher Verification
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review step-wise rubric scores, verify student answers, adjust per-question marks, and confirm official grades.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Official Report</span>
          </button>
        </div>
      </div>

      {/* Record Switcher */}
      {allEvaluations.length > 0 && (
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-brand-400" />
            <span>Evaluation Records in Database ({allEvaluations.length} total):</span>
          </span>
          <div className="max-w-md w-full sm:w-auto flex items-center space-x-2">
            <select
              value={selectedEvalId || ''}
              onChange={(e) => handleSelectEval(e.target.value)}
              className="glass-input block w-full px-3 py-2 text-xs rounded-xl border-slate-700 font-mono text-slate-200"
            >
              {allEvaluations.map((item) => (
                <option key={item.evaluation_id} value={item.evaluation_id} className="bg-slate-900 text-slate-200">
                  Eval #{item.evaluation_id} — {item.student_name || 'Anonymous'} ({item.roll_number || 'No Roll'}) {item.final_marks !== null ? `[Verified: ${item.final_marks}/${item.max_marks}]` : '[Pending Review]'}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Verification Safeguard Banner */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-3 bg-slate-900/60">
        <div className="flex items-center space-x-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${saveSuccess ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">
              Human-in-the-Loop Safeguard: Teacher Confirmation Required
            </span>
            <p className="text-xs text-slate-300 mt-0.5">
              AI generates suggested marks for reference. Scores are only recorded as finalized in SQLite once confirmed below.
            </p>
          </div>
        </div>
        {saveSuccess ? (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              Verified {verifiedTime ? `(${verifiedTime})` : ''} {verifiedBy ? `by ${verifiedBy}` : ''}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex-shrink-0 animate-pulse">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Awaiting Teacher Confirmation</span>
          </span>
        )}
      </div>

      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center space-x-3 text-emerald-200 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Student Identity Banner */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-brand-500/30 bg-gradient-to-r from-slate-900/95 via-slate-900 to-indigo-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-600 text-white font-extrabold flex items-center justify-center text-base shadow-glow flex-shrink-0">
            {resultData?.student_name
              ? resultData.student_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
              : 'ST'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-bold tracking-wider text-brand-400">Assigned Student Record</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </div>
            <h2 className="text-lg font-extrabold text-white tracking-tight flex flex-wrap items-center gap-2 mt-0.5">
              <span>{resultData?.student_name || workflowData.studentName || 'Anonymous Student'}</span>
              {resultData?.roll_number && (
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-brand-300 border border-brand-500/30">
                  Roll: {resultData.roll_number}
                </span>
              )}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
              <span>Exam: <strong className="text-slate-200">{resultData?.title || resultData?.question?.slice(0, 40) || 'Midterm Exam'}</strong></span>
              <span>•</span>
              <span>Eval ID: <strong className="text-slate-200">#{selectedEvalId}</strong></span>
              {hasMultiQuestions && (
                <>
                  <span>•</span>
                  <span className="text-brand-300 font-semibold">{resultData.question_evaluations.length} Questions</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => navigate(`/student-portal/${encodeURIComponent(resultData?.roll_number || resultData?.student_id || '')}`)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
          >
            <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Student View</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/students')}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-800/90 hover:bg-slate-800 border border-slate-700 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-brand-400" />
            <span>Roster</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Cosine Similarity */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400 font-medium">Semantic Similarity</div>
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-brand-300 tracking-tight">
              {similarityPct}%
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-brand-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, similarity * 100))}%` }}
              ></div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500">Sentence Transformers Cosine Sim</div>
        </div>

        {/* Metric 2: AI Suggested Marks */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400 font-medium">AI Suggested Marks</div>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-violet-300 tracking-tight">
              {suggestedMarks} <span className="text-sm text-slate-400 font-normal">/ {maxMarks}</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Based on rubric criteria & embeddings
            </div>
          </div>
          <div className="text-[11px] text-slate-500">Auto-calculated suggestion</div>
        </div>

        {/* Metric 3: Confirmed Final Score */}
        <div className={`glass-panel p-5 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
          saveSuccess ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400 font-medium">Final Confirmed Marks</div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              saveSuccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
            }`}>
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-3xl font-extrabold tracking-tight ${saveSuccess ? 'text-emerald-400' : 'text-slate-500'}`}>
              {saveSuccess ? finalMarks : '—'} <span className="text-sm text-slate-400 font-normal">/ {maxMarks}</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {saveSuccess ? 'Committed to SQLite' : 'Requires teacher confirmation'}
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            {saveSuccess ? `Verified by ${verifiedBy || 'Teacher'}` : 'Status: Pending Confirmation'}
          </div>
        </div>
      </div>

      {/* AI Scoring Rationale */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-brand-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>AI Scoring Rationale & Semantic Analysis</span>
          </div>
          <span className="text-[11px] text-slate-400">Sentence Transformers miniLM</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
          {resultData?.explanation || workflowData.explanation || 
            "Semantic analysis indicates comprehensive overlap with the reference answer. The student response captures key conceptual formulations consistent with grading rubric."}
        </p>
      </div>

      {/* Per-Question Marks Breakdown Summary Card */}
      {hasMultiQuestions && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <ListOrdered className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-bold text-white">Question-Wise Marks Breakdown & Verification Table</h3>
            </div>
            <span className="text-xs text-slate-400">
              {resultData.question_evaluations.length} Questions • Total Max: <strong className="text-emerald-400 font-bold">{maxMarks} Marks</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/50">
                  <th className="py-2.5 px-3">Question</th>
                  <th className="py-2.5 px-3">Question Prompt / Topic</th>
                  <th className="py-2.5 px-3 text-center">Max Marks</th>
                  <th className="py-2.5 px-3 text-center">AI Suggested</th>
                  <th className="py-2.5 px-3 text-center">Teacher Confirmed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {resultData.question_evaluations.map((qe) => {
                  const currentConfirmed = questionResults.find((qr) => qr.q_num === qe.q_num)?.final_marks ?? qe.suggested_marks;
                  return (
                    <tr key={qe.q_num} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-3 font-bold text-brand-300">Q{qe.q_num}</td>
                      <td className="py-3 px-3 text-slate-200 font-medium max-w-xs truncate">
                        {qe.question}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-300">
                        {qe.max_marks} M
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-violet-300">
                        {qe.suggested_marks} <span className="text-[10px] text-slate-400 font-normal">/ {qe.max_marks} ({(qe.similarity * 100).toFixed(0)}%)</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center space-x-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestionMarks(qe.q_num, -0.5)}
                            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px]"
                            title="Subtract 0.5"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={qe.max_marks}
                            step="0.1"
                            value={currentConfirmed}
                            onChange={(e) => handleUpdateQuestionMarks(qe.q_num, e.target.value, true)}
                            className="w-12 px-1 text-center font-bold text-emerald-400 bg-transparent border-0 text-xs focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestionMarks(qe.q_num, 0.5)}
                            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px]"
                            title="Add 0.5"
                          >
                            +
                          </button>
                          <span className="text-[10px] text-slate-500 font-normal">/ {qe.max_marks}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700 bg-slate-900/90 font-bold">
                  <td colSpan={2} className="py-3 px-3 text-white">
                    TOTAL CUMULATIVE SCORE (Sum of all questions):
                  </td>
                  <td className="py-3 px-3 text-center text-emerald-400 font-extrabold text-sm">
                    {resultData.question_evaluations.reduce((sum, q) => sum + (parseFloat(q.max_marks) || 0), 0)} M
                  </td>
                  <td className="py-3 px-3 text-center text-violet-300 font-extrabold text-sm">
                    {resultData.question_evaluations.reduce((sum, q) => sum + (parseFloat(q.suggested_marks) || 0), 0).toFixed(1)} M
                  </td>
                  <td className="py-3 px-3 text-center text-emerald-400 font-extrabold text-sm">
                    {finalMarks} / {maxMarks} M
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Multi-Question Tabs (if multi-question exam) */}
      {hasMultiQuestions && (
        <div className="flex items-center space-x-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveQuestionTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeQuestionTab === 'all'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Questions ({resultData.question_evaluations.length})</span>
          </button>

          {resultData.question_evaluations.map((qe) => {
            const currentConfirmed = questionResults.find((qr) => qr.q_num === qe.q_num)?.final_marks ?? qe.suggested_marks;
            return (
              <button
                key={qe.q_num}
                type="button"
                onClick={() => setActiveQuestionTab(qe.q_num)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 whitespace-nowrap ${
                  activeQuestionTab === qe.q_num
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white bg-slate-950/60'
                }`}
              >
                <span>Q{qe.q_num}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-300">
                  {currentConfirmed} / {qe.max_marks} M
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Question Details & Step-Wise Rubric Console */}
      {hasMultiQuestions ? (
        <div className="space-y-6">
          {resultData.question_evaluations
            .filter((qe) => activeQuestionTab === 'all' || activeQuestionTab === qe.q_num)
            .map((qe) => {
              const qState = questionResults.find((qr) => qr.q_num === qe.q_num) || {
                final_marks: qe.suggested_marks,
                teacher_comment: '',
              };

              return (
                <div key={qe.q_num} className="glass-panel p-6 sm:p-7 rounded-2xl border border-slate-800 space-y-5">
                  {/* Question Header with Score Steppers */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-extrabold text-xs">
                          Question {qe.q_num}
                        </span>
                        <span className="text-xs text-slate-400">Max: {qe.max_marks} Marks</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                          AI Sim: {(qe.similarity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1">{qe.question}</h3>
                    </div>

                    {/* Question Marks Adjuster */}
                    <div className="flex items-center space-x-2 self-start sm:self-auto bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                      <span className="text-xs font-bold text-slate-300">Q{qe.q_num} Confirmed:</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuestionMarks(qe.q_num, -0.5)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={qe.max_marks}
                        step="0.1"
                        value={qState.final_marks}
                        onChange={(e) => handleUpdateQuestionMarks(qe.q_num, e.target.value, true)}
                        className="w-16 px-2 py-1 text-center font-bold text-emerald-400 bg-slate-900 border border-slate-700 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateQuestionMarks(qe.q_num, 0.5)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                      >
                        +
                      </button>
                      <span className="text-xs text-slate-400">/ {qe.max_marks}</span>
                    </div>
                  </div>

                  {/* Dual Column: Student Segmented Answer vs Question Benchmark */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-2 border-b border-slate-800">
                        <span className="flex items-center space-x-1.5">
                          <FileText className="w-3.5 h-3.5 text-brand-400" />
                          <span>Student Q{qe.q_num} Answer (OCR Segment)</span>
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto">
                        {qe.student_answer || "No text parsed for this question."}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-2 border-b border-slate-800">
                        <span className="flex items-center space-x-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                          <span>Q{qe.q_num} Reference Model Solution</span>
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto">
                        {qe.model_answer || "No reference solution set."}
                      </div>
                    </div>
                  </div>

                  {/* Step-wise Rubrics Criteria Breakdown */}
                  {qe.rubric_scores && qe.rubric_scores.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                        <ListOrdered className="w-3.5 h-3.5 text-violet-400" />
                        <span>Step-wise Rubrics & Concept Match (Q{qe.q_num})</span>
                      </span>

                      <div className="space-y-2.5">
                        {qe.rubric_scores.map((r, rIdx) => (
                          <div key={rIdx} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-200">{r.criterion}</span>
                                <span className="text-[11px] font-semibold px-2 py-0.2 rounded bg-brand-500/10 text-brand-300">
                                  {r.suggested_marks} / {r.max_marks} M
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400">{r.notes}</p>
                              {r.matched_keywords && r.matched_keywords.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                                    <Tag className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>Verified Concepts:</span>
                                  </span>
                                  {r.matched_keywords.map((kw, kwIdx) => (
                                    <span key={kwIdx} className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      ✓ {kw}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-Question Teacher Commentary */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Teacher Commentary for Q{qe.q_num}:
                    </label>
                    <input
                      type="text"
                      value={qState.teacher_comment || ''}
                      onChange={(e) => handleUpdateQuestionComment(qe.q_num, e.target.value)}
                      placeholder={`e.g. Precise definition for Q${qe.q_num}, full marks awarded.`}
                      className="glass-input block w-full px-3.5 py-2 text-xs rounded-xl text-slate-100"
                    />
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        /* Single Question Dual View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-brand-400" />
                <span>Student OCR Transcript</span>
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                {resultData?.student_name || 'Student'}
              </span>
            </div>
            <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-mono text-slate-200 leading-relaxed min-h-[140px] max-h-72 overflow-y-auto whitespace-pre-wrap">
              {resultData?.extracted_text || workflowData.extractedText || "No student answer text available."}
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <BookOpen className="w-4 h-4 text-violet-400" />
                <span>Teacher Model Answer (Benchmark)</span>
              </span>
              <span className="text-xs text-slate-400 font-semibold">Max: {maxMarks} Marks</span>
            </div>
            <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed min-h-[140px] max-h-72 overflow-y-auto whitespace-pre-wrap">
              {resultData?.model_answer || workflowData.modelAnswerText || "No reference answer available."}
            </div>
          </div>
        </div>
      )}

      {/* Teacher Verification Form */}
      <form onSubmit={handleSaveFinalResult} className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Teacher Final Verification & Official Sign-off</h2>
              <p className="text-xs text-slate-400">Confirm total exam grade, write feedback, and commit official results to SQLite.</p>
            </div>
          </div>
        </div>

        {/* Quick Grading Action Helper Buttons */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Quick Grading Actions:
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleApplySuggested}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-violet-300 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Accept AI Score ({suggestedMarks} M)</span>
            </button>

            <button
              type="button"
              onClick={handleApplyMax}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              Full Marks ({maxMarks} M)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Final Marks Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Cumulative Final Marks <span className="text-rose-400">*</span>
            </label>
            <div className="relative rounded-xl">
              <input
                type="number"
                min="0"
                max={maxMarks}
                step="0.1"
                required
                value={finalMarks}
                onChange={(e) => setFinalMarks(e.target.value)}
                className="glass-input block w-full px-4 py-3 sm:text-lg rounded-xl font-bold text-emerald-400 focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3.5 top-3.5 text-xs text-slate-400 pointer-events-none font-semibold">
                / {maxMarks} Max
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Teacher verified score saved directly to SQLite.
            </p>
          </div>

          {/* Feedback */}
          <div className="sm:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Official Teacher Feedback & Evaluation Remarks
              </label>
              <span className="text-[11px] text-slate-500">Visible on student report card</span>
            </div>

            <textarea
              rows={3}
              value={teacherFeedback}
              onChange={(e) => setTeacherFeedback(e.target.value)}
              placeholder="Enter written feedback for the student scorecard..."
              className="glass-input block w-full p-3.5 sm:text-sm rounded-xl resize-y text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-brand-500"
            />

            <div className="space-y-1 pt-1">
              <span className="text-[11px] text-slate-400 block font-medium">Quick Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {FEEDBACK_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddFeedbackSnippet(preset)}
                    className="text-[11px] text-left px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-slate-800">
          <button
            type="button"
            onClick={() => navigate('/evaluation')}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Evaluation</span>
          </button>

          <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Dashboard
            </button>

            <button
              type="submit"
              disabled={saving || !selectedEvalId}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-glow-teal transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Saving to SQLite...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{saveSuccess ? 'Update Verified Score' : 'Confirm & Save Final Marks'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
