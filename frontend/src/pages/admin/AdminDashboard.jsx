import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAdminStatsApi, getAdminEvaluationsApi, getAdminTeachersApi } from '../../services/api';
import { 
  Users, 
  UserCog, 
  UploadCloud, 
  Cpu, 
  CheckCircle2, 
  Shield, 
  ArrowRight, 
  TrendingUp, 
  FileText, 
  Layers, 
  Sparkles,
  BarChart2,
  Clock,
  RotateCcw,
  BookOpen
} from 'lucide-react';

export const AdminDashboard = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total_teachers: 0,
    total_students: 0,
    total_answer_sheets: 0,
    total_evaluations: 0,
    total_verified_results: 0,
  });
  const [recentEvaluations, setRecentEvaluations] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAdminData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [statsData, evalsData, teachersData] = await Promise.all([
        getAdminStatsApi(token).catch(() => ({})),
        getAdminEvaluationsApi(null, token).catch(() => []),
        getAdminTeachersApi(token).catch(() => []),
      ]);
      if (statsData) setStats(statsData);
      if (evalsData) setRecentEvaluations(evalsData.slice(0, 8));
      if (teachersData) setTeachers(teachersData);
    } catch (err) {
      console.warn("Failed to fetch admin dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [token]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl relative overflow-hidden border border-amber-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Shield className="w-6 h-6" />
              </div>
              <span className="text-xs uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Administrator Overview
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
              System Control Dashboard
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Global management console for overseeing all registered teachers, student answer sheet submissions, AI OCR extractions, and verified grading.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchAdminData}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
            <Link
              to="/admin/teachers"
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-glow transition-all"
            >
              <UserCog className="w-3.5 h-3.5" />
              <span>Manage Teachers</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Global Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Total Teachers */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Teachers</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <UserCog className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{stats.total_teachers}</div>
            <p className="text-[11px] text-amber-300 mt-1">Active Faculty Accounts</p>
          </div>
        </div>

        {/* Total Students */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-brand-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Students</span>
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{stats.total_students}</div>
            <p className="text-[11px] text-brand-300 mt-1">Across all classrooms</p>
          </div>
        </div>

        {/* Answer Sheets */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Answer Sheets</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <UploadCloud className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{stats.total_answer_sheets}</div>
            <p className="text-[11px] text-cyan-300 mt-1">Handwritten PDFs & Images</p>
          </div>
        </div>

        {/* AI Evaluations */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-violet-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evaluations</span>
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{stats.total_evaluations}</div>
            <p className="text-[11px] text-violet-300 mt-1">AI Semantic Scoring Runs</p>
          </div>
        </div>

        {/* Verified Results */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-emerald-500/40 transition-all col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Final Marks</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{stats.total_verified_results}</div>
            <p className="text-[11px] text-emerald-300 mt-1">Teacher Verified Grades</p>
          </div>
        </div>

      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        <Link
          to="/admin/teachers"
          className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/60 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30 group-hover:scale-110 transition-transform">
              <UserCog className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
              Manage Teacher Accounts
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Add new educators, update credentials, deactivate accounts, and inspect student load distribution.
            </p>
          </div>
          <div className="mt-5 flex items-center text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
            <span>View Faculty ({stats.total_teachers})</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </Link>

        <Link
          to="/admin/students"
          className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-brand-500/50 hover:bg-slate-900/60 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 text-brand-400 flex items-center justify-center border border-brand-500/30 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors">
              Global Student Directory
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Browse all students across all teachers, check roll numbers, and view submission metrics.
            </p>
          </div>
          <div className="mt-5 flex items-center text-xs font-semibold text-brand-400 group-hover:translate-x-1 transition-transform">
            <span>View All Students ({stats.total_students})</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </Link>

        <Link
          to="/admin/results"
          className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/60 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
              Global Evaluation Results
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Inspect AI similarity scores, teacher final adjustments, verified scorecards, and export full CSV reports.
            </p>
          </div>
          <div className="mt-5 flex items-center text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
            <span>Inspect Results ({stats.total_evaluations})</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </Link>

      </div>

      {/* Recent Evaluations Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart2 className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Recent System Evaluations Across Teachers
            </h2>
          </div>
          <Link
            to="/admin/results"
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 hover:underline flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-5 py-3 font-semibold">ID</th>
                <th className="px-5 py-3 font-semibold">Student</th>
                <th className="px-5 py-3 font-semibold">Assigned Teacher</th>
                <th className="px-5 py-3 font-semibold">Subject / Question</th>
                <th className="px-5 py-3 font-semibold text-center">AI Similarity</th>
                <th className="px-5 py-3 font-semibold text-center">Marks</th>
                <th className="px-5 py-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {recentEvaluations.length > 0 ? (
                recentEvaluations.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate-400">#{item.id}</td>
                    <td className="px-5 py-3.5 font-medium text-white">
                      <div>{item.student_name}</div>
                      {item.roll_number && (
                        <div className="text-[10px] font-mono text-slate-400">Roll: {item.roll_number}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20 font-medium">
                        {item.teacher_name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-200 max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="px-5 py-3.5 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                        {Math.round((item.similarity || 0) * 100)}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center font-mono font-bold text-white">
                      {item.final_marks !== null ? item.final_marks : item.suggested_marks} / {item.max_marks}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          item.status === 'Verified'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-brand-500/10 text-brand-300 border-brand-500/30'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-5 py-8 text-center text-slate-500">
                    No recent evaluations found.
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
