import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { evaluateAnswerApi, batchEvaluateApi, getAnswerSheetsApi, getModelAnswersApi } from '../services/api';
import { 
  Cpu, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  BookOpen, 
  Zap, 
  Check, 
  RefreshCw, 
  ChevronDown, 
  Layers, 
  ListOrdered, 
  Tag,
  Users,
  CheckSquare,
  Square
} from 'lucide-react';

export const EvaluationPage = () => {
  const { token, workflowData, updateWorkflow } = useAuth();
  const navigate = useNavigate();

  // Mode: 'single' | 'batch'
  const [evalMode, setEvalMode] = useState('single');

  const [evaluating, setEvaluating] = useState(false);
  const [evalStep, setEvalStep] = useState(0);
  const [error, setError] = useState('');
  const [evalSuccess, setEvalSuccess] = useState(Boolean(workflowData.evaluationId));

  // Available selections loaded from backend
  const [availableSheets, setAvailableSheets] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingSelections, setLoadingSelections] = useState(false);

  // Batch evaluation state
  const [selectedBatchSheetIds, setSelectedBatchSheetIds] = useState([]);
  const [batchResults, setBatchResults] = useState(null);

  useEffect(() => {
    if (token) {
      setLoadingSelections(true);
      Promise.all([
        getAnswerSheetsApi(token).catch(() => []),
        getModelAnswersApi(token).catch(() => []),
      ])
        .then(([sheets, models]) => {
          setAvailableSheets(sheets);
          setAvailableModels(models);

          // Default batch selection: all available sheets
          if (sheets && sheets.length > 0) {
            setSelectedBatchSheetIds(sheets.slice(0, 5).map((s) => s.id));
          }

          // Default to latest sheet if not in context
          if (!workflowData.answerSheetId && sheets && sheets.length > 0) {
            const latest = sheets[0];
            updateWorkflow({
              answerSheetId: latest.id,
              studentId: latest.student_id,
              studentName: latest.student_name,
              rollNumber: latest.roll_number,
              fileName: latest.file_path,
              extractedText: latest.extracted_text,
            });
          }

          // Default to latest model if not in context
          if (!workflowData.modelAnswerId && models && models.length > 0) {
            const latestM = models[0];
            updateWorkflow({
              modelAnswerId: latestM.id,
              question: latestM.question,
              modelAnswerText: latestM.answer_text,
              maxMarks: latestM.max_marks,
              examTitle: latestM.title,
              examSubject: latestM.subject,
              questions: latestM.questions,
            });
          }
        })
        .finally(() => {
          setLoadingSelections(false);
        });
    }
  }, [token]);

  const hasAnswerSheet = Boolean(workflowData.answerSheetId && workflowData.extractedText);
  const hasModelAnswer = Boolean(workflowData.modelAnswerId && (workflowData.modelAnswerText || workflowData.questions?.length));
  const isReady = hasAnswerSheet && hasModelAnswer;

  const currentModel = availableModels.find((m) => m.id === workflowData.modelAnswerId);
  const isMultiQuestion = Boolean(currentModel?.questions && currentModel.questions.length > 0);

  const evaluationSteps = isMultiQuestion
    ? [
        { title: 'Segmenting Student OCR Transcript', desc: 'Parsing question markers and separating responses for Q1, Q2, etc.' },
        { title: 'Sentence Embeddings & Keyword Match', desc: 'Computing semantic similarity & detecting required concept keywords per rubric step' },
        { title: 'Step-Wise Rubric Scoring', desc: 'Calibrating bounded points across individual question criteria' },
        { title: 'Aggregating Final Grade Package', desc: 'Synthesizing cumulative score and detailed explanatory breakdowns' },
      ]
    : [
        { title: 'Vectorizing Extracted Text', desc: 'Passing OCR transcription through Sentence Transformers encoder' },
        { title: 'Semantic Embeddings Comparison', desc: 'Computing high-dimensional cosine similarity against model answer' },
        { title: 'Calibrating Suggested Marks', desc: 'Applying bounded scoring formula proportional to max marks' },
        { title: 'Synthesizing Explanation', desc: 'Structuring semantic coverage & keyword alignment summary' },
      ];

  const handleSelectSheet = (sheetId) => {
    const selected = availableSheets.find((s) => s.id === Number(sheetId));
    if (selected) {
      updateWorkflow({
        answerSheetId: selected.id,
        studentId: selected.student_id,
        studentName: selected.student_name,
        rollNumber: selected.roll_number,
        fileName: selected.file_path,
        extractedText: selected.extracted_text,
        evaluationId: null,
        similarity: null,
        suggestedMarks: null,
        questionEvaluations: null,
      });
      setEvalSuccess(false);
    }
  };

  const handleSelectModel = (modelId) => {
    const selected = availableModels.find((m) => m.id === Number(modelId));
    if (selected) {
      updateWorkflow({
        modelAnswerId: selected.id,
        question: selected.question,
        modelAnswerText: selected.answer_text,
        maxMarks: selected.max_marks,
        examTitle: selected.title,
        examSubject: selected.subject,
        questions: selected.questions,
        evaluationId: null,
        similarity: null,
        suggestedMarks: null,
        questionEvaluations: null,
      });
      setEvalSuccess(false);
    }
  };

  const handleToggleBatchSheet = (id) => {
    setSelectedBatchSheetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllBatch = () => {
    if (selectedBatchSheetIds.length === availableSheets.length) {
      setSelectedBatchSheetIds([]);
    } else {
      setSelectedBatchSheetIds(availableSheets.map((s) => s.id));
    }
  };

  const handleRunEvaluation = async () => {
    if (!isReady) {
      setError('Please select both an Answer Sheet (Step 1) and a Model Answer / Exam (Step 2) from SQLite first.');
      return;
    }

    setError('');
    setEvaluating(true);
    setEvalStep(0);

    const stepInterval = setInterval(() => {
      setEvalStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 450);

    try {
      const data = await evaluateAnswerApi(
        {
          answer_sheet_id: workflowData.answerSheetId,
          model_answer_id: workflowData.modelAnswerId || undefined,
          test_id: workflowData.testId || undefined,
        },
        token
      );

      clearInterval(stepInterval);

      updateWorkflow({
        evaluationId: data.evaluation_id,
        testId: data.test_id || workflowData.testId,
        testName: data.test_name || workflowData.testName,
        similarity: data.similarity,
        suggestedMarks: data.suggested_marks,
        maxMarks: data.max_marks || workflowData.maxMarks,
        explanation: data.explanation,
        rubricScores: data.rubric_scores,
        questionEvaluations: data.question_evaluations,
        finalMarks: null,
      });

      setEvalSuccess(true);
    } catch (err) {
      clearInterval(stepInterval);
      const errorDetail = err.response?.data?.detail || err.message || 'Evaluation failed. Check backend connection.';
      setError(errorDetail);
    } finally {
      setEvaluating(false);
    }
  };

  const handleRunBatchEvaluation = async () => {
    if ((!workflowData.modelAnswerId && !workflowData.testId) || selectedBatchSheetIds.length === 0) {
      setError('Please select a Test or Model Answer and at least 1 answer sheet for batch evaluation.');
      return;
    }

    setError('');
    setEvaluating(true);
    setEvalStep(0);
    setBatchResults(null);

    const stepInterval = setInterval(() => {
      setEvalStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 450);

    try {
      const res = await batchEvaluateApi(
        {
          answer_sheet_ids: selectedBatchSheetIds,
          model_answer_id: workflowData.modelAnswerId || undefined,
          test_id: workflowData.testId || undefined,
        },
        token
      );

      setBatchResults(res);
      setEvalSuccess(true);
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message || 'Batch evaluation failed.';
      setError(errorDetail);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">
            <span>Step 3 of 4</span>
            <span>•</span>
            <span className="text-slate-400">AI Scoring Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AI Semantic Evaluation</h1>
          <p className="text-sm text-slate-400 mt-1">
            Run Sentence Transformers miniLM cosine similarity and step-wise rubrics against student OCR transcript.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setEvalMode('single')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              evalMode === 'single' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Single Student
          </button>
          <button
            type="button"
            onClick={() => setEvalMode('batch')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
              evalMode === 'batch' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Batch Engine</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {evalSuccess && evalMode === 'single' && (
        <div className="p-4 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-between text-brand-300 text-xs font-semibold animate-fade-in">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-brand-400 flex-shrink-0" />
            <div>
              <span className="text-white block font-bold">AI Evaluation Completed!</span>
              <span className="text-[11px] text-brand-300 font-normal">
                Suggested Score: {workflowData.suggestedMarks} / {workflowData.maxMarks} ({(workflowData.similarity * 100).toFixed(0)}% Similarity).
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate(`/results/${workflowData.evaluationId || ''}`)}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold transition-colors shadow-sm"
          >
            <span>Next: Teacher Verification</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Model Answer Picker Banner */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
            <BookOpen className="w-4 h-4 text-violet-400" />
            <span>Target Benchmark Exam / Model Answer</span>
          </span>
          <span className="text-xs text-slate-400">{availableModels.length} Exams in SQLite</span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">
            Choose Reference Model Answer / Exam Paper:
          </label>
          <select
            value={workflowData.modelAnswerId || ''}
            onChange={(e) => handleSelectModel(e.target.value)}
            className="glass-input block w-full px-3.5 py-2.5 text-xs rounded-xl font-semibold text-slate-200"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100">
                Exam #{m.id}: {m.title || m.question.slice(0, 45)} ({m.subject}) — Max: {m.max_marks} M [{m.questions_count || 1} Qs]
              </option>
            ))}
          </select>
        </div>
      </div>

      {evalMode === 'single' ? (
        /* SINGLE EVALUATION MODE */
        <div className="space-y-6">
          {/* Answer Sheet Picker */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-brand-400" />
                <span>Select Answer Sheet to Evaluate</span>
              </span>
              <span className="text-xs text-slate-400">{availableSheets.length} Answer Sheets</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Choose Uploaded Student Sheet:
              </label>
              <select
                value={workflowData.answerSheetId || ''}
                onChange={(e) => handleSelectSheet(e.target.value)}
                className="glass-input block w-full px-3.5 py-2.5 text-xs rounded-xl font-semibold text-slate-200"
              >
                {availableSheets.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100">
                    Sheet #{s.id}: {s.student_name || 'Anonymous'} {s.roll_number ? `(Roll: ${s.roll_number})` : ''} — {s.extracted_text?.slice(0, 50)}...
                  </option>
                ))}
              </select>
            </div>

            {/* Extracted Text Snippet */}
            {workflowData.extractedText && (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  OCR Transcript Preview:
                </span>
                <p className="text-xs font-mono text-slate-300 leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {workflowData.extractedText}
                </p>
              </div>
            )}
          </div>

          {/* Stepper Animation during Evaluation */}
          {evaluating && (
            <div className="glass-panel p-6 rounded-2xl border border-brand-500/30 space-y-4 animate-fade-in">
              <div className="flex items-center space-x-2 text-xs font-bold text-brand-400 uppercase tracking-wider">
                <div className="w-3 h-3 rounded-full bg-brand-400 animate-ping"></div>
                <span>Executing AI Semantic Scoring Pipeline...</span>
              </div>
              <div className="space-y-3">
                {evaluationSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start space-x-3 p-3 rounded-xl border transition-all ${
                      idx < evalStep
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : idx === evalStep
                        ? 'bg-brand-500/10 border-brand-500/40 text-brand-200'
                        : 'bg-slate-900/50 border-slate-800/80 text-slate-500'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0">
                      {idx < evalStep ? '✓' : idx + 1}
                    </div>
                    <div>
                      <div className="text-xs font-bold">{step.title}</div>
                      <div className="text-[11px] text-slate-400">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => navigate('/upload')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Upload</span>
            </button>

            <button
              type="button"
              onClick={handleRunEvaluation}
              disabled={evaluating || !isReady}
              className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 shadow-glow transition-all disabled:opacity-50"
            >
              {evaluating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Evaluating with SentenceTransformers...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  <span>Run Semantic Evaluation</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* BATCH EVALUATION MODE */
        <div className="space-y-6">
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-violet-400" />
                <span>Select Answer Sheets for Batch Evaluation ({selectedBatchSheetIds.length} selected)</span>
              </span>
              <button
                type="button"
                onClick={handleSelectAllBatch}
                className="text-xs font-bold text-brand-400 hover:text-brand-300"
              >
                {selectedBatchSheetIds.length === availableSheets.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/80 border border-slate-800 rounded-xl bg-slate-950/60">
              {availableSheets.map((s) => {
                const isSelected = selectedBatchSheetIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => handleToggleBatchSheet(s.id)}
                    className="p-3 flex items-center justify-between hover:bg-slate-900/80 cursor-pointer text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-violet-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                      <div>
                        <span className="font-bold text-white">
                          {s.student_name || 'Anonymous Student'}
                        </span>
                        {s.roll_number && (
                          <span className="text-slate-400 font-mono ml-2">
                            (Roll: {s.roll_number})
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 block">
                          Sheet #{s.id} • {s.extracted_text?.slice(0, 45)}...
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Batch Evaluation Results Display */}
          {batchResults && (
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-emerald-500/30 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Batch Evaluation Completed ({batchResults.processed_count} Processed)</span>
                </span>
                <button
                  onClick={() => navigate('/results')}
                  className="text-xs font-bold text-brand-400 hover:text-brand-300"
                >
                  View All in Results Console →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2 px-3">Eval ID</th>
                      <th className="py-2 px-3">Student</th>
                      <th className="py-2 px-3 text-center">Similarity</th>
                      <th className="py-2 px-3 text-center">AI Suggested</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {batchResults.successful_evaluations.map((ev) => (
                      <tr key={ev.evaluation_id} className="hover:bg-slate-900/60">
                        <td className="py-2.5 px-3 font-mono text-slate-400">#{ev.evaluation_id}</td>
                        <td className="py-2.5 px-3 font-bold text-white">
                          {ev.student_name}
                          {ev.roll_number && <span className="font-mono text-slate-400 ml-1.5 font-normal">({ev.roll_number})</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-brand-300">
                          {(ev.similarity * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-violet-300">
                          {ev.suggested_marks} / {ev.max_marks}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => navigate(`/results/${ev.evaluation_id}`)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold"
                          >
                            Verify
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setEvalMode('single')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Single Mode</span>
            </button>

            <button
              type="button"
              onClick={handleRunBatchEvaluation}
              disabled={evaluating || selectedBatchSheetIds.length === 0}
              className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-glow transition-all disabled:opacity-50"
            >
              {evaluating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Batch Processing {selectedBatchSheetIds.length} Sheets...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Execute Batch Evaluation ({selectedBatchSheetIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
