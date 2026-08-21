import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAdminResultsApi, getAdminTeachersApi, exportResultsCsvApi } from '../../services/api';
import { 
  FileCheck, 
  Search, 
  Filter, 
  RotateCcw, 
  Download, 
  UserCog, 
  CheckCircle2, 
  Cpu, 
  AlertCircle,
  Award,
  BookOpen
} from 'lucide-react';

export const AdminResults = () => {
  const { token } = useAuth();
  const [results, setResults] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'verified' | 'evaluated'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportingCsv, setExportingCsv] = useState(false);

  const fetchData = async (teacherFilter = '') => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [resultsData, teachersData] = await Promise.all([
        getAdminResultsApi(teacherFilter ? Number(teacherFilter) : null, token),
        getAdminTeachersApi(token).catch(() => []),
      ]);
      setResults(resultsData || []);
      setTeachers(teachersData || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch evaluation results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedTeacherId);
  }, [token, selectedTeacherId]);

  const handleExportCsv = async () => {
    if (!token) return;
    setExportingCsv(true);
    try {
      const blob = await exportResultsCsvApi(token);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ScriptSense_Global_Results_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.warn("Failed to export CSV:", err);
    } finally {
      setExportingCsv(false);
    }
  };

  const filteredResults = results.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (r.student_name && r.student_name.toLowerCase().includes(q)) ||
      (r.roll_number && r.roll_number.toLowerCase().includes(q)) ||
      (r.teacher_name && r.teacher_name.toLowerCase().includes(q)) ||
      (r.title && r.title.toLowerCase().includes(q));

    if (statusFilter === 'verified') {
      return matchesSearch && r.status === 'Verified';
    } else if (statusFilter === 'evaluated') {
      return matchesSearch && r.status !== 'Verified';
    }
    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-emerald-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <FileCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-sans">Global Evaluation Results</h1>
          </div>
          <p className="text-xs text-slate-400">
            Comprehensive audit log of all handwritten exams evaluated, scored by AI, and verified by teachers.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <button
            onClick={() => fetchData(selectedTeacherId)}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-glow-teal transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{exportingCsv ? 'Exporting...' : 'Export Global CSV'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1 w-full md:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student, roll number, exam, or teacher..."
            className="glass-input block w-full pl-9 pr-3 py-2 text-xs rounded-xl"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          {/* Status Tabs */}
          <div className="flex p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                statusFilter === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({results.length})
            </button>
            <button
              onClick={() => setStatusFilter('verified')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                statusFilter === 'verified' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Verified
            </button>
            <button
              onClick={() => setStatusFilter('evaluated')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                statusFilter === 'evaluated' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Evaluated
            </button>
          </div>

          {/* Teacher Dropdown */}
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="glass-input px-3 py-2 text-xs rounded-xl bg-slate-900 text-slate-100 border border-slate-700 focus:border-emerald-500 min-w-[160px]"
          >
            <option value="">All Teachers</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Eval #</th>
                <th className="px-5 py-3.5 font-semibold">Student</th>
                <th className="px-5 py-3.5 font-semibold">Teacher</th>
                <th className="px-5 py-3.5 font-semibold">Exam Title / Question</th>
                <th className="px-5 py-3.5 font-semibold text-center">AI Similarity</th>
                <th className="px-5 py-3.5 font-semibold text-center">AI Marks</th>
                <th className="px-5 py-3.5 font-semibold text-center">Final Marks</th>
                <th className="px-5 py-3.5 font-semibold text-center">Status</th>
                <th className="px-5 py-3.5 font-semibold">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredResults.length > 0 ? (
                filteredResults.map((r) => (
                  <tr key={r.id || r.evaluation_id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-5 py-4 font-mono text-slate-400">
                      #{r.evaluation_id}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-white text-sm">{r.student_name}</div>
                      {r.roll_number && (
                        <div className="text-[10px] font-mono text-brand-300">Roll: {r.roll_number}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-1">
                        <UserCog className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-medium text-amber-200">{r.teacher_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 max-w-xs truncate text-slate-200" title={r.title}>
                      {r.title || 'Standard Exam'}
                    </td>
                    <td className="px-5 py-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-semibold">
                        {Math.round((r.similarity || 0) * 100)}%
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center font-mono text-slate-400">
                      {r.suggested_marks} / {r.max_marks}
                    </td>
                    <td className="px-5 py-4 text-center font-mono font-bold text-emerald-300 text-sm">
                      {r.final_marks !== null ? `${r.final_marks} / ${r.max_marks}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          r.status === 'Verified'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-brand-500/10 text-brand-300 border-brand-500/30'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 max-w-xs text-slate-400 italic truncate" title={r.teacher_feedback || ''}>
                      {r.teacher_feedback || <span className="text-slate-600">None</span>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-5 py-8 text-center text-slate-500">
                    No results found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
