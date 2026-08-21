import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listAllResultsApi, getStudentsOverviewApi, exportResultsCsvApi } from '../services/api';
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
  GraduationCap
} from 'lucide-react';

export const Dashboard = () => {
  const { token, user, workflowData, updateWorkflow } = useAuth();
  const navigate = useNavigate();

  const [studentOverview, setStudentOverview] = useState([]);
  const [dbEvaluations, setDbEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'verified' | 'evaluated' | 'uploaded' | 'pending'
  const [searchQuery, setSearchQuery] = useState('');
  const [exportingCsv, setExportingCsv] = useState(false);

  const fetchDashboardData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [overviewData, evalData] = await Promise.all([
        getStudentsOverviewApi(token).catch(() => []),
        listAllResultsApi(token).catch(() => [])
      ]);
      setStudentOverview(overviewData || []);
      setDbEvaluations(evalData || []);
    } catch (err) {
      console.warn("Could not fetch dashboard data:", err);
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

  const steps = [
    {
      id: 1,
      title: 'Upload Answer Sheet',
      description: 'Upload student handwritten answers (PDF, JPG, JPEG, PNG). Runs OCR to extract text.',
      route: '/upload',
      icon: UploadCloud,
      status: workflowData.answerSheetId ? 'Completed' : 'Pending',
      statusColor: workflowData.answerSheetId 
        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
        : 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      actionText: workflowData.answerSheetId ? 'Re-upload / View' : 'Start Upload',
      info: workflowData.studentName ? `Student: ${workflowData.studentName}` : 'No sheet uploaded yet',
    },
    {
      id: 2,
      title: 'Set Model Answer',
      description: 'Define the question prompt, teacher reference answer, and maximum marks.',
      route: '/model-answer',
      icon: BookOpen,
      status: workflowData.modelAnswerId ? 'Configured' : 'Pending',
      statusColor: workflowData.modelAnswerId 
        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
        : 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      actionText: workflowData.modelAnswerId ? 'Edit Model Answer' : 'Define Answer',
      info: workflowData.question ? `Q: ${workflowData.question.slice(0, 35)}...` : 'No reference answer set',
    },
    {
      id: 3,
      title: 'AI Semantic Evaluation',
      description: 'Execute Sentence Transformers semantic similarity to compute suggested marks.',
      route: '/evaluation',
      icon: Cpu,
      status: workflowData.evaluationId ? 'Evaluated' : 'Ready to Run',
      statusColor: workflowData.evaluationId 
        ? 'bg-brand-500/10 text-brand-300 border-brand-500/30' 
        : 'bg-slate-500/10 text-slate-400 border-slate-700',
      actionText: workflowData.evaluationId ? 'View / Re-evaluate' : 'Run Evaluation',
      info: workflowData.similarity !== null ? `Similarity: ${(workflowData.similarity * 100).toFixed(0)}%` : 'Awaiting trigger',
    },
    {
      id: 4,
      title: 'Teacher Verification & Results',
      description: 'Review AI suggestion, inspect side-by-side comparison, and save final marks.',
      route: '/results',
      icon: CheckCircle2,
      status: workflowData.finalMarks !== null ? 'Verified' : 'Pending Review',
      statusColor: workflowData.finalMarks !== null 
        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
        : 'bg-violet-500/10 text-violet-300 border-violet-500/30',
      actionText: 'Open Results',
      info: workflowData.finalMarks !== null ? `Final Score: ${workflowData.finalMarks}/${workflowData.maxMarks}` : 'AI never auto-finalizes',
    },
  ];

  // Metrics computation across students
  const totalStudents = studentOverview.length;
  const verifiedStudents = studentOverview.filter((s) => s.status === 'Verified');
  const evaluatedStudents = studentOverview.filter((s) => s.status === 'Evaluated');
  const uploadedStudents = studentOverview.filter((s) => s.status === 'Uploaded');
  const pendingStudents = studentOverview.filter((s) => s.status === 'Pending Upload');

  const evaluatedWithSim = studentOverview.filter((s) => s.similarity !== null && s.similarity !== undefined);
  const avgSimilarity = evaluatedWithSim.length > 0
    ? (evaluatedWithSim.reduce((acc, curr) => acc + curr.similarity, 0) / evaluatedWithSim.length) * 100
    : 0;

  // Grade Distribution Calculation across verified/evaluated students
  const scoredStudents = studentOverview.filter(
    (s) => (s.final_marks !== null && s.final_marks !== undefined) || (s.suggested_marks !== null && s.suggested_marks !== undefined)
  );

  const gradeCounts = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0 };
  let totalScoreSum = 0;
  let maxScoreSum = 0;
  let passCount = 0;

  scoredStudents.forEach((s) => {
    const score = s.final_marks !== null && s.final_marks !== undefined ? s.final_marks : s.suggested_marks;
    const maxM = s.max_marks || 10.0;
    const pct = (score / maxM) * 100;
    totalScoreSum += score;
    maxScoreSum += maxM;

    if (pct >= 60) passCount += 1;

    if (pct >= 90) gradeCounts['A+'] += 1;
    else if (pct >= 80) gradeCounts['A'] += 1;
    else if (pct >= 70) gradeCounts['B'] += 1;
    else if (pct >= 60) gradeCounts['C'] += 1;
    else gradeCounts['D'] += 1;
  });

  const classAvgPct = maxScoreSum > 0 ? ((totalScoreSum / maxScoreSum) * 100).toFixed(1) : '0.0';
  const passRate = scoredStudents.length > 0 ? Math.round((passCount / scoredStudents.length) * 100) : 0;

  // Filtered student list
  const filteredStudents = studentOverview.filter((s) => {
    if (statusFilter === 'verified' && s.status !== 'Verified') return false;
    if (statusFilter === 'evaluated' && s.status !== 'Evaluated') return false;
    if (statusFilter === 'uploaded' && s.status !== 'Uploaded') return false;
    if (statusFilter === 'pending' && s.status !== 'Pending Upload') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = s.name?.toLowerCase().includes(q);
      const rollMatch = s.roll_number?.toLowerCase().includes(q);
      return nameMatch || rollMatch;
    }
    return true;
  });

  const handleStudentRowClick = (student) => {
    if (student.latest_evaluation_id) {
      navigate(`/results/${student.latest_evaluation_id}`);
    } else if (student.latest_answer_sheet_id) {
      updateWorkflow({
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.roll_number || '',
        answerSheetId: student.latest_answer_sheet_id,
      });
      navigate('/evaluation');
    } else {
      updateWorkflow({
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.roll_number || '',
        answerSheetId: null,
      });
      navigate('/upload');
    }
  };

  const loadSampleWorkflow = () => {
    updateWorkflow({
      answerSheetId: 101,
      studentName: 'Alex Rivera',
      rollNumber: 'CS2026-0101',
      fileName: 'newton_law_answer.pdf',
      extractedText: 'Newton second law states that the force acting on an object equals its mass multiplied by acceleration (F = m * a). When force increases, acceleration increases proportionally.',
      modelAnswerId: 201,
      question: "Explain Newton's second law of motion and write its mathematical formula.",
      modelAnswerText: "Newton's second law of motion states that the rate of change of momentum of a body is directly proportional to the applied force. In mathematical form, Force equals mass multiplied by acceleration (F = m * a), where F is in Newtons, m in kilograms, and a in m/s^2.",
      maxMarks: 10,
      evaluationId: 301,
      similarity: 0.86,
      suggestedMarks: 8.6,
      explanation: 'High semantic overlap with the model answer. Core principle (F=ma) and proportional relationship correctly explained. Minor omission of physical measurement units (kg, m/s^2).',
      finalMarks: 8.5,
      teacherFeedback: 'Accurate conceptual explanation with the formula. Remember to state SI units for full credit next time.',
    });
  };

  const resetWorkflow = () => {
    updateWorkflow({
      answerSheetId: null,
      studentId: null,
      studentName: '',
      rollNumber: '',
      fileName: '',
      extractedText: '',
      modelAnswerId: null,
      question: '',
      modelAnswerText: '',
      maxMarks: 10,
      evaluationId: null,
      similarity: null,
      suggestedMarks: null,
      explanation: '',
      finalMarks: null,
      teacherFeedback: '',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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
              ScriptSense tracks every student's answer sheet upload, semantic evaluation, and teacher verification.
            </p>
          </div>

          {/* Navigation Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors disabled:opacity-50"
              title="Download Classroom CSV Marksheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportingCsv ? 'Exporting...' : 'Export Marksheet (CSV)'}</span>
            </button>
            <button
              onClick={() => navigate('/students')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Manage Students</span>
            </button>
            <button
              onClick={loadSampleWorkflow}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 shadow-glow transition-all"
            >
              <Sparkles className="w-4 h-4 text-brand-200" />
              <span>Load Demo Data</span>
            </button>
            <button
              onClick={resetWorkflow}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Status Metric Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">{totalStudents}</div>
            <div className="text-xs text-slate-400">Total Students</div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-sky-300">{uploadedStudents.length + evaluatedStudents.length + verifiedStudents.length}</div>
            <div className="text-xs text-slate-400">Sheets Uploaded</div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-violet-300">{evaluatedStudents.length}</div>
            <div className="text-xs text-slate-400">AI Evaluated</div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-300">{verifiedStudents.length}</div>
            <div className="text-xs text-slate-400">Teacher Verified</div>
          </div>
        </div>
      </div>

      {/* Classroom Performance & Grade Distribution Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grade Distribution Breakdown */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-brand-400">
              <BarChart2 className="w-4 h-4" />
              <span>Classroom Grade Distribution ({scoredStudents.length} Graded)</span>
            </div>
            <span className="text-xs text-slate-400">Performance Histogram</span>
          </div>

          <div className="grid grid-cols-5 gap-3 pt-2">
            {[
              { label: 'A+ (90-100%)', grade: 'A+', count: gradeCounts['A+'], color: 'bg-emerald-500', textColor: 'text-emerald-400' },
              { label: 'A (80-89%)', grade: 'A', count: gradeCounts['A'], color: 'bg-teal-500', textColor: 'text-teal-400' },
              { label: 'B (70-79%)', grade: 'B', count: gradeCounts['B'], color: 'bg-blue-500', textColor: 'text-blue-400' },
              { label: 'C (60-69%)', grade: 'C', count: gradeCounts['C'], color: 'bg-amber-500', textColor: 'text-amber-400' },
              { label: 'D (<60%)', grade: 'D', count: gradeCounts['D'], color: 'bg-rose-500', textColor: 'text-rose-400' },
            ].map((g) => {
              const heightPct = scoredStudents.length > 0 ? (g.count / scoredStudents.length) * 100 : 0;
              return (
                <div key={g.grade} className="flex flex-col items-center justify-end space-y-2">
                  <span className={`text-xs font-extrabold ${g.textColor}`}>{g.count}</span>
                  <div className="w-full bg-slate-900 h-24 rounded-lg flex items-end p-1 border border-slate-800">
                    <div
                      className={`w-full rounded-md ${g.color} transition-all duration-500`}
                      style={{ height: `${Math.max(6, heightPct)}%` }}
                    ></div>
                  </div>
                  <span className="text-[11px] font-bold text-slate-300">{g.grade}</span>
                  <span className="text-[9px] text-slate-500 text-center leading-none hidden sm:block">
                    {g.label.split(' ')[1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Aggregate Class Summary Card */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-violet-400 pb-3 border-b border-slate-800">
              <TrendingUp className="w-4 h-4" />
              <span>Academic Performance</span>
            </div>

            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Class Average Score:</span>
                <span className="text-lg font-black text-white">{classAvgPct}%</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-brand-500 to-violet-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, parseFloat(classAvgPct))}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-400">Pass Rate (≥ 60%):</span>
                <span className="text-sm font-bold text-emerald-400">{passRate}% ({passCount}/{scoredStudents.length})</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Avg AI Semantic Match:</span>
                <span className="text-sm font-bold text-brand-300">{avgSimilarity.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/evaluation')}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 flex items-center justify-center space-x-2"
          >
            <Cpu className="w-3.5 h-3.5 text-brand-400" />
            <span>Launch Batch Evaluation Engine</span>
          </button>
        </div>
      </div>

      {/* Main Student Upload & Verification Status Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-6 space-y-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center space-x-1.5">
                <Users className="w-4 h-4" />
                <span>Student Roster & Verification Status</span>
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
              All Students Progress Roster
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any student row to immediately inspect their OCR transcript, AI evaluation, and verified results.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="glass-input block w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs rounded-xl"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'all' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({totalStudents})
              </button>
              <button
                onClick={() => setStatusFilter('verified')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'verified' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Verified ({verifiedStudents.length})
              </button>
              <button
                onClick={() => setStatusFilter('evaluated')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'evaluated' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Evaluated ({evaluatedStudents.length})
              </button>
              <button
                onClick={() => setStatusFilter('uploaded')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'uploaded' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Uploaded ({uploadedStudents.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'pending' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Pending ({pendingStudents.length})
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs">Loading students roster & status from SQLite...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No students match filter</p>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? `No student found matching "${searchQuery}".`
                : 'Register students or upload answer sheets to see them in this status table.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3">Student</th>
                  <th className="py-3 px-3">Roll Number</th>
                  <th className="py-3 px-3 text-center">Sheets</th>
                  <th className="py-3 px-3 text-center">Upload Status</th>
                  <th className="py-3 px-3 text-center">AI Similarity</th>
                  <th className="py-3 px-3 text-center">AI Suggested</th>
                  <th className="py-3 px-3 text-center">Final Score</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStudents.map((st) => {
                  const initials = st.name
                    ? st.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'ST';

                  const hasEvaluation = Boolean(st.latest_evaluation_id);

                  return (
                    <tr
                      key={st.id}
                      onClick={() => handleStudentRowClick(st)}
                      className="hover:bg-slate-900/70 transition-colors group cursor-pointer"
                      title={hasEvaluation ? `Open Results for ${st.name}` : `Upload/Evaluate for ${st.name}`}
                    >
                      {/* Student Name & Avatar */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600/30 to-violet-600/30 border border-brand-500/30 text-brand-300 font-bold flex items-center justify-center text-xs group-hover:scale-105 transition-transform">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-brand-300 transition-colors">
                              {st.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              Student ID #{st.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Roll Number */}
                      <td className="py-3.5 px-3 font-mono text-slate-300">
                        {st.roll_number ? (
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                            {st.roll_number}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">None</span>
                        )}
                      </td>

                      {/* Sheets Count */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-mono font-bold text-xs ${
                          st.upload_count > 0 ? 'bg-slate-800 text-slate-200' : 'bg-slate-900/50 text-slate-600'
                        }`}>
                          {st.upload_count}
                        </span>
                      </td>

                      {/* Upload Status Badge */}
                      <td className="py-3.5 px-3 text-center">
                        {st.status === 'Verified' && (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <Check className="w-3 h-3" />
                            <span>Verified</span>
                          </span>
                        )}
                        {st.status === 'Evaluated' && (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                            <Sparkles className="w-3 h-3" />
                            <span>Evaluated</span>
                          </span>
                        )}
                        {st.status === 'Uploaded' && (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            <UploadCloud className="w-3 h-3" />
                            <span>Uploaded</span>
                          </span>
                        )}
                        {st.status === 'Pending Upload' && (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>

                      {/* AI Similarity */}
                      <td className="py-3.5 px-3 text-center">
                        {st.similarity !== null && st.similarity !== undefined ? (
                          <span className="font-bold text-brand-300">
                            {(st.similarity * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* AI Suggested Marks */}
                      <td className="py-3.5 px-3 text-center">
                        {st.suggested_marks !== null && st.suggested_marks !== undefined ? (
                          <span className="font-semibold text-violet-300">
                            {st.suggested_marks} <span className="text-[10px] text-slate-500">/ {st.max_marks}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Final Score */}
                      <td className="py-3.5 px-3 text-center">
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

                      {/* Action Button */}
                      <td className="py-3.5 px-3 text-right">
                        {hasEvaluation ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/results/${st.latest_evaluation_id}`);
                            }}
                            className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                              st.status === 'Verified'
                                ? 'text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700'
                                : 'text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-glow-teal'
                            }`}
                          >
                            <span>{st.status === 'Verified' ? 'View Results' : 'Verify Score'}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ) : st.upload_count > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStudentRowClick(st);
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-300 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 transition-colors"
                          >
                            <span>Evaluate</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStudentRowClick(st);
                            }}
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
          </div>
        )}
      </div>

      {/* Guided Evaluation Steps Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Layers className="w-4 h-4 text-brand-400" />
            <span>Standard Evaluation Workflow Pipeline</span>
          </h2>
          <span className="text-xs text-slate-400">4-Stage Guided Flow</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                onClick={() => navigate(step.route)}
                className="glass-panel glass-panel-hover p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4 group cursor-pointer transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono text-slate-500">Stage 0{step.id}</span>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${step.statusColor}`}>
                    {step.status}
                  </span>
                  <span className="text-brand-400 group-hover:translate-x-0.5 transition-transform flex items-center space-x-1 font-semibold text-[11px]">
                    <span>{step.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
