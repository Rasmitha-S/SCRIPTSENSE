import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { studentPortalLookupApi } from '../services/api';
import { MarksChatbotModal } from '../components/MarksChatbotModal';
import { 
  GraduationCap, 
  Search, 
  Award, 
  CheckCircle2, 
  Clock, 
  FileText, 
  BookOpen, 
  Cpu, 
  Percent, 
  Sparkles, 
  UserCheck, 
  ArrowLeft, 
  Printer, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Hash, 
  MessageSquare,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  LogOut,
  ListOrdered,
  Tag,
  Layers,
  Bot
} from 'lucide-react';

export const StudentPortal = () => {
  const { rollNumber: urlRollNumber } = useParams();
  const navigate = useNavigate();
  const { studentSession, setStudentSession, logout } = useAuth();

  const [lookupQuery, setLookupQuery] = useState(
    urlRollNumber || studentSession?.roll_number || ''
  );
  const [portalData, setPortalData] = useState(studentSession || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedExamId, setExpandedExamId] = useState(null);
  const [activeChatExam, setActiveChatExam] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchStudentData = async (query) => {
    if (!query || !query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await studentPortalLookupApi(query.trim());
      setPortalData(data);
      if (setStudentSession) {
        setStudentSession(data);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Unable to find student results.';
      setError(detail);
      setPortalData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlRollNumber) {
      setLookupQuery(urlRollNumber);
      fetchStudentData(urlRollNumber);
    } else if (studentSession && studentSession.roll_number) {
      setPortalData(studentSession);
    }
  }, [urlRollNumber]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (lookupQuery.trim()) {
      fetchStudentData(lookupQuery.trim());
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExit = () => {
    logout();
    navigate('/login');
  };

  const results = portalData?.results || [];

  const filteredResults = results.filter((res) => {
    if (filterStatus === 'verified') return res.status === 'Verified';
    if (filterStatus === 'evaluated') return res.status === 'Evaluated';
    if (filterStatus === 'uploaded') return res.status === 'Uploaded';
    return true;
  });

  const getGradePill = (pct) => {
    if (pct === null || pct === undefined) return { label: 'Pending', color: 'bg-slate-800 text-slate-400 border-slate-700' };
    if (pct >= 90) return { label: 'Grade: A+ (Outstanding)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
    if (pct >= 80) return { label: 'Grade: A (Excellent)', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' };
    if (pct >= 70) return { label: 'Grade: B (Good)', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
    if (pct >= 60) return { label: 'Grade: C (Satisfactory)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    return { label: 'Grade: D (Needs Work)', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Banner */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-violet-500 p-0.5 shadow-glow flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-brand-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-white">ScriptSense</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Student Portal
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Official Evaluated Marks & Rubric Feedback Hub</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {portalData && (
              <button
                onClick={handlePrint}
                className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors"
                title="Print Official Scorecard"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Scorecard</span>
              </button>
            )}
            <button
              onClick={handleExit}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit Portal</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Search Bar */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 print:hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <Search className="w-4 h-4 text-brand-400" />
                <span>Student Scorecard Lookup</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Enter your assigned Roll Number or Student ID to view your official evaluation breakdown.
              </p>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Hash className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder="e.g. CS2026-0101 or MQ-STU-042F3"
                className="glass-input block w-full pl-10 pr-4 py-3 text-sm rounded-xl font-mono text-slate-200"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !lookupQuery.trim()}
              className="inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 shadow-glow transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Searching Database...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Look Up Marks</span>
                </>
              )}
            </button>
          </form>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-sm animate-fade-in print:hidden">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <div>
              <strong className="font-semibold block">Record Lookup Notice</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        {portalData && (
          <div className="space-y-8 animate-fade-in">
            {/* Student Profile Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-brand-500/30 relative overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-600 p-0.5 shadow-glow flex items-center justify-center flex-shrink-0">
                    <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-xl font-black text-brand-300 font-mono">
                      {portalData.student_name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-extrabold text-white tracking-tight">
                        {portalData.student_name}
                      </h1>
                      {portalData.roll_number && (
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-slate-800/90 text-brand-300 border border-slate-700">
                          Roll: {portalData.roll_number}
                        </span>
                      )}
                      <span className="text-xs font-mono text-slate-400">
                        Student ID #{portalData.student_id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center space-x-2">
                      <span>Official Academic Transcript & AI Evaluation Record</span>
                      <span>•</span>
                      <span className="text-emerald-400 flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Teacher Verified</span>
                      </span>
                    </p>
                  </div>
                </div>

                {/* Overall Score Metrics */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center min-w-[100px]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Tests</span>
                    <span className="text-xl font-extrabold text-white">{portalData.total_exams}</span>
                  </div>

                  <div className="px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center min-w-[100px]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Verified</span>
                    <span className="text-xl font-extrabold text-emerald-400">{portalData.verified_exams}</span>
                  </div>

                  <div className="px-5 py-3 rounded-xl bg-gradient-to-tr from-brand-950/80 to-violet-950/80 border border-brand-500/40 text-center min-w-[130px] shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-brand-300 block tracking-wider">Overall Avg</span>
                    <div className="flex items-baseline justify-center space-x-1">
                      <span className="text-2xl font-black text-white">
                        {portalData.average_score !== null ? portalData.average_score : '—'}
                      </span>
                      {portalData.average_percentage !== null && (
                        <span className="text-xs font-bold text-brand-300">
                          ({portalData.average_percentage}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Tabs and Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800 print:hidden">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-brand-400" />
                <h2 className="text-lg font-bold text-white">Evaluated Exam Papers ({filteredResults.length})</h2>
              </div>

              <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filterStatus === 'all' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({results.length})
                </button>
                <button
                  onClick={() => setFilterStatus('verified')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filterStatus === 'verified' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Verified ({results.filter((r) => r.status === 'Verified').length})
                </button>
              </div>
            </div>

            {/* List of Evaluated Exam Papers */}
            {filteredResults.length === 0 ? (
              <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-3">
                <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No exam submissions found</h3>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredResults.map((exam, index) => {
                  const isExpanded = expandedExamId === exam.evaluation_id;
                  const finalScore = exam.final_marks !== null ? exam.final_marks : exam.suggested_marks;
                  const maxMarks = exam.max_marks || 10.0;
                  const pct = Math.round((finalScore / maxMarks) * 100);
                  const gradePill = getGradePill(pct);
                  const hasQuestions = Boolean(exam.question_evaluations && exam.question_evaluations.length > 0);

                  return (
                    <div
                      key={exam.evaluation_id || `sheet-${exam.answer_sheet_id}`}
                      className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-lg transition-all"
                    >
                      <div className="p-6 sm:p-7 space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800">
                                Exam #{index + 1}
                              </span>

                              {exam.status === 'Verified' ? (
                                <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Official Marks Verified</span>
                                </span>
                              ) : exam.status === 'Evaluated' ? (
                                <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-brand-500/10 text-brand-300 border border-brand-500/30">
                                  <Cpu className="w-3.5 h-3.5 text-brand-400" />
                                  <span>AI Evaluated</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Uploaded</span>
                                </span>
                              )}

                              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${gradePill.color}`}>
                                {gradePill.label}
                              </span>
                            </div>

                            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                              {exam.title || exam.question || 'Handwritten Answer Sheet Submission'}
                            </h3>
                          </div>

                          {/* Score Pill Card */}
                          <div className="flex sm:flex-col items-center justify-between sm:justify-center p-3 sm:p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-right sm:min-w-[140px] flex-shrink-0">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                                {exam.status === 'Verified' ? 'Final Score' : 'AI Suggested'}
                              </span>
                              <div className="flex items-baseline justify-end space-x-1">
                                <span className="text-2xl font-black text-white">
                                  {finalScore !== null ? finalScore : '—'}
                                </span>
                                <span className="text-xs text-slate-400 font-semibold">/ {maxMarks}</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-brand-400 sm:mt-1">
                              {pct}% Score
                            </span>
                          </div>
                        </div>

                        {/* Attribution & AI Match Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800/80 text-xs">
                          <div className="flex items-center space-x-2 text-slate-300">
                            <Sparkles className="w-4 h-4 text-brand-400 flex-shrink-0" />
                            <span>
                              AI Semantic Overlap: <strong className="text-brand-300">{(exam.similarity * 100).toFixed(0)}% Match</strong>
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-slate-300">
                            <UserCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span>
                              {exam.verified_by ? (
                                <>Verified by: <strong className="text-emerald-300">{exam.verified_by}</strong></>
                              ) : (
                                <span className="text-slate-500 italic">Awaiting teacher sign-off</span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-slate-400 sm:justify-end">
                            <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            <span>
                              {exam.verified_at 
                                ? new Date(exam.verified_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                : 'Recent'}
                            </span>
                          </div>
                        </div>

                        {/* Multi-Question Breakdown Grid on Card */}
                        {hasQuestions && (
                          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                              <ListOrdered className="w-4 h-4 text-brand-400" />
                              <span>Question-by-Question Marks & Step-wise Rubrics:</span>
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {exam.question_evaluations.map((qe) => (
                                <div key={qe.q_num} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                                  <div className="flex items-center justify-between font-bold">
                                    <span className="text-white">Q{qe.q_num}: {qe.question?.slice(0, 30)}...</span>
                                    <span className="text-emerald-400">{qe.suggested_marks} / {qe.max_marks} M</span>
                                  </div>

                                  {qe.rubric_scores && qe.rubric_scores.length > 0 && (
                                    <div className="space-y-1 pt-1 border-t border-slate-800/80">
                                      {qe.rubric_scores.map((r, rIdx) => (
                                        <div key={rIdx} className="flex items-center justify-between text-[11px] text-slate-400">
                                          <span className="truncate pr-2">✓ {r.criterion}</span>
                                          <span className="text-brand-300 font-mono flex-shrink-0">{r.suggested_marks}/{r.max_marks}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Teacher Feedback Callout */}
                        {exam.teacher_feedback ? (
                          <div className="p-4 rounded-xl bg-brand-950/30 border border-brand-500/30 space-y-1.5">
                            <div className="flex items-center space-x-2 text-xs font-bold text-brand-300">
                              <MessageSquare className="w-3.5 h-3.5 text-brand-400" />
                              <span>Teacher's Feedback & Commentary</span>
                            </div>
                            <p className="text-sm text-slate-200 italic leading-relaxed pl-5 border-l-2 border-brand-500/40">
                              "{exam.teacher_feedback}"
                            </p>
                          </div>
                        ) : exam.explanation ? (
                          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-1">
                            <span className="font-semibold text-slate-400 block">AI Evaluation Note:</span>
                            <p className="italic text-slate-300">{exam.explanation}</p>
                          </div>
                        ) : null}

                        {/* Card Action Buttons (Inspect & Ask AI) */}
                        <div className="pt-3 flex flex-wrap items-center justify-between gap-2.5 print:hidden border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => setActiveChatExam(exam)}
                            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 shadow-glow transition-all active:scale-95"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-brand-300 animate-pulse" />
                            <span>Ask AI About Your Marks</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedExamId(isExpanded ? null : exam.evaluation_id)}
                            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors"
                          >
                            <span>{isExpanded ? 'Hide Full Answer & Model Comparison' : 'Inspect Extracted Handwritten Text & Model Answer'}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Section */}
                      {isExpanded && (
                        <div className="p-6 sm:p-7 bg-slate-950 border-t border-slate-800/80 space-y-5 animate-fade-in">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-2 border-b border-slate-800">
                                <span className="flex items-center space-x-1.5">
                                  <FileText className="w-3.5 h-3.5 text-brand-400" />
                                  <span>Your Handwritten Answer (OCR Extracted)</span>
                                </span>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                                {exam.extracted_text || 'No extracted text available.'}
                              </div>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-2 border-b border-slate-800">
                                <span className="flex items-center space-x-1.5">
                                  <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Teacher's Reference Model Solution</span>
                                </span>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                                {exam.model_answer || 'No reference answer text set.'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!portalData && !loading && !error && (
          <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center mx-auto border border-brand-500/20">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Welcome to the Student Marks Portal</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Enter your Roll Number (e.g. <code className="text-brand-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">CS2026-0101</code>) or Student ID in the search box above to view your evaluated exam papers, scores, and teacher remarks.
            </p>
          </div>
        )}
      </main>

      {/* AI Marks Chatbot Modal */}
      <MarksChatbotModal
        isOpen={Boolean(activeChatExam)}
        onClose={() => setActiveChatExam(null)}
        examData={activeChatExam}
      />
    </div>
  );
};
