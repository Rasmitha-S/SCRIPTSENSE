import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  getTestsOverviewApi, 
  listAllResultsApi, 
  exportResultsCsvApi,
  evaluateAllTestSheetsApi,
  deleteTestApi
} from '../services/api';
import { 
  UploadCloud, 
  BookOpen, 
  Cpu, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  FileText, 
  Layers, 
  ShieldCheck, 
  Clock, 
  RotateCcw,
  Percent,
  Award,
  AlertCircle,
  Check,
  ChevronRight,
  UserCheck,
  Users,
  Search,
  Hash,
  UserPlus,
  Download,
  BarChart2,
  TrendingUp,
  GraduationCap,
  Plus,
  Zap,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const Dashboard = () => {
  const { token, user, updateWorkflow } = useAuth();
  const navigate = useNavigate();

  const [testsOverview, setTestsOverview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [evaluatingTestId, setEvaluatingTestId] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDashboardData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getTestsOverviewApi(token);
      setTestsOverview(data || []);
    } catch (err) {
      console.warn("Could not fetch tests overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const handleExportCsv = async () => {
    if (!token) return;
    setExportingCsv(true);
    try {
      const blob = await exportResultsCsvApi(token);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ScriptSense_Classroom_Grades_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.warn("Failed to export CSV:", err);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleEvaluateAllInTest = async (testId, testName) => {
    if (!token) return;
    setEvaluatingTestId(testId);
    setActionSuccessMsg('');
    try {
      const res = await evaluateAllTestSheetsApi(testId, token);
      setActionSuccessMsg(`Successfully evaluated ${res.processed_count} students for '${testName}'!`);
      setTimeout(() => setActionSuccessMsg(''), 5000);
      fetchDashboardData();
    } catch (err) {
      console.warn("Evaluation failed:", err);
    } finally {
      setEvaluatingTestId(null);
    }
  };

  const handleDeleteTest = async (testId, testName) => {
    if (!token || !window.confirm(`Are you sure you want to delete test "${testName}"?`)) return;
    try {
      await deleteTestApi(testId, token);
      fetchDashboardData();
    } catch (err) {
      console.warn("Delete test failed:", err);
    }
  };

  const handleUploadForStudent = (test, student) => {
    updateWorkflow({
      testId: test.id,
      testName: test.test_name,
      studentId: student.student_id,
      studentName: student.student_name,
      rollNumber: student.roll_number || '',
      maxMarks: test.max_marks,
      modelAnswerId: test.model_answer_id,
    });
    navigate('/upload');
  };

  const handleViewResult = (evaluationId) => {
    if (evaluationId) {
      navigate(`/results/${evaluationId}`);
    }
  };

  // Metrics computation across all tests
  const totalTests = testsOverview.length;
  const allStudentsAssigned = testsOverview.flatMap((t) => t.students);
  const totalStudents = new Set(allStudentsAssigned.map((s) => s.student_id)).size;
  const totalUploaded = allStudentsAssigned.filter((s) => s.status !== 'Pending Upload').length;
  const totalEvaluated = allStudentsAssigned.filter((s) => s.status === 'Evaluated' || s.status === 'Verified').length;
  const totalVerified = allStudentsAssigned.filter((s) => s.status === 'Verified').length;

  // Filtered Tests & Students
  const filteredTests = testsOverview.map((test) => {
    if (!searchQuery.trim()) return test;
    const q = searchQuery.toLowerCase().trim();
    const testMatch = test.test_name.toLowerCase().includes(q) || (test.subject && test.subject.toLowerCase().includes(q));
    const matchingStudents = test.students.filter(
      (s) => s.student_name.toLowerCase().includes(q) || (s.roll_number && s.roll_number.toLowerCase().includes(q))
    );
    if (testMatch) return test;
    return { ...test, students: matchingStudents };
  }).filter((test) => test.students.length > 0 || test.test_name.toLowerCase().includes(searchQuery.toLowerCase().trim()));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-6 sm:p-8 border border-slate-800 shadow-2xl">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Evaluation Hub
              </span>
              <span className="text-xs text-slate-400">Teacher Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 tracking-tight">
              Welcome back, <span className="gradient-text">{user?.full_name || user?.username || 'Teacher'}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Manage tests, upload student answer sheets, run automated evaluations, and verify grades per test.
            </p>
          </div>

          {/* Top Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors disabled:opacity-50"
              title="Download Classroom CSV Marksheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportingCsv ? 'Exporting...' : 'Export Marksheet'}</span>
            </button>
            <button
              onClick={() => navigate('/students')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Class Roster</span>
            </button>
            <button
              onClick={() => navigate('/create-test')}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 shadow-glow transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Test</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center space-x-2 animate-fade-in shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-300 flex items-center justify-center flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-white">{totalTests}</div>
            <div className="text-xs text-slate-400">Total Tests</div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-sky-300">{totalUploaded}</div>
            <div className="text-xs text-slate-400">Sheets Uploaded</div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-violet-300">{totalEvaluated}</div>
            <div className="text-xs text-slate-400">AI Evaluated</div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-emerald-300">{totalVerified}</div>
            <div className="text-xs text-slate-400">Teacher Verified</div>
          </div>
        </div>
      </div>

      {/* Main Tests & Grouped Student Roster Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Layers className="w-5 h-5 text-brand-400" />
            <span>Tests & Student Progress Groupings</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Each test maintains its model answer and tracks assigned students across upload, evaluation, and verification.
          </p>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search test or student..."
            className="glass-input block w-full sm:w-64 pl-8 pr-3 py-1.5 text-xs rounded-xl"
          />
        </div>
      </div>

      {/* Test-Grouped Containers */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-3 glass-panel rounded-2xl border border-slate-800">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs">Loading tests and student rosters...</p>
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="py-16 text-center text-slate-400 space-y-4 glass-panel rounded-2xl border border-slate-800 p-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No Tests Created Yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Create your first test to define the questions, model answer, and assigned students once.
            </p>
          </div>
          <button
            onClick={() => navigate('/create-test')}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Test</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredTests.map((test) => {
            const hasUploadedSheets = test.uploaded_count > 0;
            const isEvaluatingThis = evaluatingTestId === test.id;

            return (
              <div
                key={test.id}
                className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl space-y-0"
              >
                {/* Test Card Header */}
                <div className="p-5 sm:p-6 bg-slate-900/60 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                        {test.subject || 'General'}
                      </span>
                      <span className="text-xs text-slate-400">
                        Test #{test.id} • {test.questions_count} {test.questions_count === 1 ? 'Question' : 'Questions'}
                      </span>
                      <span className="text-xs font-bold text-slate-300">
                        • Max: <strong className="text-brand-400">{test.max_marks} M</strong>
                      </span>
                    </div>

                    <h3 className="text-xl font-extrabold text-white mt-1">
                      {test.test_name}
                    </h3>
                  </div>

                  {/* Test Actions */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        updateWorkflow({
                          testId: test.id,
                          testName: test.test_name,
                          maxMarks: test.max_marks,
                          modelAnswerId: test.model_answer_id,
                        });
                        navigate('/upload');
                      }}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 transition-colors"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload Sheet for Test</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEvaluateAllInTest(test.id, test.test_name)}
                      disabled={isEvaluatingThis || test.students.filter((s) => s.answer_sheet_id).length === 0}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-glow transition-all disabled:opacity-40"
                      title="Automatically evaluate all uploaded sheets in this test using its model answer"
                    >
                      {isEvaluatingThis ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Evaluating Test...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-brand-200" />
                          <span>Evaluate All ({test.students.filter((s) => s.answer_sheet_id).length})</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteTest(test.id, test.test_name)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20"
                      title="Delete Test"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Test Students Table */}
                <div className="p-0 overflow-x-auto">
                  {test.students.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No students enrolled in this test yet.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold bg-slate-950/40">
                          <th className="py-3 px-4">Student</th>
                          <th className="py-3 px-4">Roll Number</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-center">AI Similarity</th>
                          <th className="py-3 px-4 text-center">AI Suggested</th>
                          <th className="py-3 px-4 text-center">Final Score</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {test.students.map((st) => {
                          const hasEval = Boolean(st.evaluation_id);
                          const hasSheet = Boolean(st.answer_sheet_id);

                          return (
                            <tr
                              key={st.student_id}
                              className="hover:bg-slate-900/50 transition-colors group"
                            >
                              {/* Student Name */}
                              <td className="py-3.5 px-4 font-bold text-white">
                                <div className="flex items-center space-x-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600/30 to-violet-600/30 border border-brand-500/30 text-brand-300 font-bold flex items-center justify-center text-[11px]">
                                    {st.student_name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className="group-hover:text-brand-300 transition-colors">
                                      {st.student_name}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-500 block">
                                      ID #{st.student_id}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Roll Number */}
                              <td className="py-3.5 px-4 font-mono text-slate-300">
                                {st.roll_number ? (
                                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                                    {st.roll_number}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 italic">None</span>
                                )}
                              </td>

                              {/* Status Badge */}
                              <td className="py-3.5 px-4 text-center">
                                {st.status === 'Verified' && (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                    <Check className="w-3 h-3" />
                                    <span>Verified</span>
                                  </span>
                                )}
                                {st.status === 'Evaluated' && (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                                    <Sparkles className="w-3 h-3" />
                                    <span>Evaluated</span>
                                  </span>
                                )}
                                {st.status === 'Uploaded' && (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                    <UploadCloud className="w-3 h-3" />
                                    <span>Uploaded</span>
                                  </span>
                                )}
                                {st.status === 'Pending Upload' && (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                    <Clock className="w-3 h-3 text-slate-500" />
                                    <span>Pending Upload</span>
                                  </span>
                                )}
                              </td>

                              {/* AI Similarity */}
                              <td className="py-3.5 px-4 text-center">
                                {st.similarity !== null && st.similarity !== undefined ? (
                                  <span className="font-bold text-brand-300">
                                    {(st.similarity * 100).toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>

                              {/* AI Suggested Marks */}
                              <td className="py-3.5 px-4 text-center">
                                {st.suggested_marks !== null && st.suggested_marks !== undefined ? (
                                  <span className="font-semibold text-violet-300">
                                    {st.suggested_marks} <span className="text-[10px] text-slate-500">/ {st.max_marks}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>

                              {/* Final Score */}
                              <td className="py-3.5 px-4 text-center">
                                {st.final_marks !== null && st.final_marks !== undefined ? (
                                  <div>
                                    <span className="font-extrabold text-emerald-400 text-xs block">
                                      {st.final_marks} <span className="text-[10px] text-emerald-500/80">/ {st.max_marks}</span>
                                    </span>
                                    {st.verified_by && (
                                      <span className="text-[10px] text-slate-400 block font-normal truncate max-w-[120px] mx-auto">
                                        by {st.verified_by}
                                      </span>
                                    )}
                                  </div>
                                ) : st.status === 'Evaluated' ? (
                                  <span className="text-amber-400/90 text-[11px] font-medium italic">Pending Review</span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>

                              {/* Action Row */}
                              <td className="py-3.5 px-4 text-right">
                                {hasEval ? (
                                  <button
                                    onClick={() => handleViewResult(st.evaluation_id)}
                                    className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                                      st.status === 'Verified'
                                        ? 'text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700'
                                        : 'text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-glow-teal'
                                    }`}
                                  >
                                    <span>{st.status === 'Verified' ? 'View Results' : 'Verify Score'}</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                ) : hasSheet ? (
                                  <button
                                    onClick={() => {
                                      updateWorkflow({
                                        testId: test.id,
                                        testName: test.test_name,
                                        studentId: st.student_id,
                                        studentName: st.student_name,
                                        rollNumber: st.roll_number || '',
                                        answerSheetId: st.answer_sheet_id,
                                        modelAnswerId: test.model_answer_id,
                                      });
                                      navigate('/evaluation');
                                    }}
                                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-300 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 transition-colors"
                                  >
                                    <span>Evaluate</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUploadForStudent(test, st)}
                                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 transition-colors"
                                  >
                                    <span>Upload Sheet</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
