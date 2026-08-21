import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAdminStudentsApi, getAdminTeachersApi } from '../../services/api';
import { 
  Users, 
  Search, 
  Filter, 
  RotateCcw, 
  UserCog, 
  FileText, 
  Hash, 
  CheckCircle2, 
  Clock, 
  AlertCircle 
} from 'lucide-react';

export const AdminStudents = () => {
  const { token } = useAuth();
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async (teacherFilter = '') => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [studentsData, teachersData] = await Promise.all([
        getAdminStudentsApi(teacherFilter ? Number(teacherFilter) : null, token),
        getAdminTeachersApi(token).catch(() => []),
      ]);
      setStudents(studentsData || []);
      setTeachers(teachersData || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch students.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedTeacherId);
  }, [token, selectedTeacherId]);

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.roll_number && s.roll_number.toLowerCase().includes(q)) ||
      (s.teacher_name && s.teacher_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-brand-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-sans">Global Student Directory</h1>
          </div>
          <p className="text-xs text-slate-400">
            Master list of all student profiles across all teachers, indicating ownership and submission stats.
          </p>
        </div>

        <button
          onClick={() => fetchData(selectedTeacherId)}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors self-start sm:self-auto"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters & Search Controls */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative flex-1 w-full md:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student name, roll number, or teacher..."
            className="glass-input block w-full pl-9 pr-3 py-2 text-xs rounded-xl"
          />
        </div>

        {/* Filter by Teacher */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="flex items-center space-x-2 text-xs text-slate-400 whitespace-nowrap">
            <Filter className="w-4 h-4 text-brand-400" />
            <span>Filter by Faculty:</span>
          </div>
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="glass-input px-3 py-2 text-xs rounded-xl bg-slate-900 text-slate-100 border border-slate-700 focus:border-brand-500 min-w-[180px]"
          >
            <option value="">All Teachers</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.username})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Directory Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Student ID</th>
                <th className="px-5 py-3.5 font-semibold">Student Name</th>
                <th className="px-5 py-3.5 font-semibold">Roll Number</th>
                <th className="px-5 py-3.5 font-semibold">Assigned Teacher</th>
                <th className="px-5 py-3.5 font-semibold text-center">Answer Sheets</th>
                <th className="px-5 py-3.5 font-semibold text-right">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-5 py-4 font-mono text-slate-400">#{s.id}</td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-white text-sm">{s.name}</div>
                    </td>
                    <td className="px-5 py-4 font-mono">
                      {s.roll_number ? (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-brand-300 font-semibold">
                          {s.roll_number}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No roll number</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-1.5">
                        <UserCog className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-medium text-amber-200">{s.teacher_name}</span>
                        {s.teacher_username && (
                          <span className="text-[10px] text-slate-400 font-mono">({s.teacher_username})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center font-mono">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-200 border border-slate-700 font-bold">
                        {s.upload_count || 0}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-400">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-slate-500">
                    No student records found matching your filters.
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
