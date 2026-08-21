import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStudentsApi, createStudentApi, deleteStudentApi } from '../services/api';
import { 
  Users, 
  UserPlus, 
  Search, 
  UploadCloud, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Hash, 
  Sparkles, 
  Layers,
  GraduationCap,
  ChevronRight,
  Filter,
  Trash2,
  X
} from 'lucide-react';

export const Students = () => {
  const { token, updateWorkflow } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Student Form state
  const [newName, setNewName] = useState('');
  const [newRoll, setNewRoll] = useState('');
  const [creating, setCreating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Delete Modal state
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStudents = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getStudentsApi(token);
      setStudents(data || []);
    } catch (err) {
      console.warn("Failed to load students:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete || !token) return;
    setDeleting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await deleteStudentApi(studentToDelete.id, token);
      setSuccessMsg(res.message || `Student "${studentToDelete.name}" was removed from the classroom roster.`);
      setStudents((prev) => prev.filter((s) => s.id !== studentToDelete.id));
      setStudentToDelete(null);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to delete student.';
      setError(detail);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [token]);

  const handleSelectStudentForUpload = (student) => {
    updateWorkflow({
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.roll_number || '',
      answerSheetId: null, // Reset previous sheet for the new student
      fileName: '',
      extractedText: '',
      evaluationId: null,
      similarity: null,
      suggestedMarks: null,
      finalMarks: null,
    });
    navigate('/upload');
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!newName.trim()) {
      setError('Please provide a student name.');
      return;
    }

    setCreating(true);

    try {
      const created = await createStudentApi(
        {
          name: newName.trim(),
          roll_number: newRoll.trim() || null,
        },
        token
      );

      setSuccessMsg(`Student "${created.name}" registered successfully! Redirecting to Upload...`);
      setNewName('');
      setNewRoll('');
      
      // Update local state
      setStudents((prev) => [created, ...prev]);

      // Automatically select and navigate to upload after 800ms
      setTimeout(() => {
        handleSelectStudentForUpload(created);
      }, 800);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to register student.';
      setError(detail);
    } finally {
      setCreating(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = s.name?.toLowerCase().includes(q);
    const rollMatch = s.roll_number?.toLowerCase().includes(q);
    return nameMatch || rollMatch;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">
            <span>Student Management</span>
            <span>•</span>
            <span className="text-slate-400">Classroom Roster</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <Users className="w-7 h-7 text-brand-400" />
            <span>Students Directory</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Register students with their roll numbers or select an existing student to upload and evaluate their handwritten answer sheet.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 shadow-glow transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>{showAddForm ? 'Hide Registration Form' : 'Register New Student'}</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center space-x-3 text-emerald-300 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <div>
            <strong className="font-semibold block">Registration Error</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Register New Student Form Card */}
      {showAddForm && (
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-brand-500/30 space-y-5 bg-slate-900/60 shadow-xl animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-300 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-white">Register Student</h2>
            </div>
            <span className="text-xs text-slate-400">Stores directly to SQLite database</span>
          </div>

          <form onSubmit={handleCreateStudent} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-brand-400" />
                  <span>Student Full Name <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Maya Lin"
                  className="glass-input block w-full px-4 py-2.5 text-sm rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center space-x-1.5">
                  <Hash className="w-3.5 h-3.5 text-violet-400" />
                  <span>Roll Number / Student ID</span>
                </label>
                <input
                  type="text"
                  value={newRoll}
                  onChange={(e) => setNewRoll(e.target.value)}
                  placeholder="e.g. CS2026-0105"
                  className="glass-input block w-full px-4 py-2.5 text-sm rounded-xl font-mono text-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-glow-teal transition-all disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Save & Proceed to Upload</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or roll number..."
            className="glass-input block w-full pl-10 pr-4 py-2 text-xs rounded-xl"
          />
        </div>

        <div className="text-xs text-slate-400 self-end sm:self-auto flex items-center space-x-1.5">
          <span>Showing {filteredStudents.length} of {students.length} students</span>
        </div>
      </div>

      {/* Students Directory Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-3">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs">Loading students roster from SQLite...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-3">
          <GraduationCap className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No students found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `No student matching "${searchQuery}". Try a different name or roll number.`
              : 'No students registered yet. Click "Register New Student" above to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStudents.map((st) => {
            const initials = st.name
              ? st.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
              : 'ST';

            return (
              <div
                key={st.id}
                className="glass-panel glass-panel-hover p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4 group transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-600/30 to-violet-600/30 border border-brand-500/30 text-brand-300 font-extrabold flex items-center justify-center text-sm shadow-sm group-hover:scale-105 transition-transform">
                      {initials}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors">
                        {st.name}
                      </h3>
                      {st.roll_number ? (
                        <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-1 mt-0.5">
                          <Hash className="w-3 h-3 text-violet-400" />
                          <span>{st.roll_number}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">No roll number</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800">
                      ID #{st.id}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStudentToDelete(st);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all"
                      title={`Delete student "${st.name}"`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSelectStudentForUpload(st)}
                    className="w-full inline-flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 hover:border-brand-500/50 transition-all shadow-sm group/btn"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-brand-400" />
                    <span>Upload</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    onClick={() => navigate(`/student-portal/${encodeURIComponent(st.roll_number || st.id)}`)}
                    className="w-full inline-flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 transition-all shadow-sm"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Scorecard</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div 
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <button
                onClick={() => setStudentToDelete(null)}
                disabled={deleting}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-white">
                Delete Student Record
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to remove <strong className="text-white font-bold">{studentToDelete.name}</strong> 
                {studentToDelete.roll_number ? ` (Roll: ${studentToDelete.roll_number})` : ''}?
              </p>
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] text-rose-300 leading-relaxed">
                ⚠️ This action will permanently remove this student and any associated answer sheets and evaluation records from the database.
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteStudent}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-glow-rose transition-all disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
