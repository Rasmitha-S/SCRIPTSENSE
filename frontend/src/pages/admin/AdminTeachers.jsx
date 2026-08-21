import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAdminTeachersApi, 
  createAdminTeacherApi, 
  updateAdminTeacherApi, 
  deleteAdminTeacherApi 
} from '../../services/api';
import { 
  UserCog, 
  UserPlus, 
  Users, 
  Mail, 
  User, 
  Lock, 
  Edit3, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  X, 
  RotateCcw,
  Check,
  ShieldAlert,
  UploadCloud
} from 'lucide-react';

export const AdminTeachers = () => {
  const { token, user } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form State for Add Teacher
  const [addForm, setAddForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'teacher',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Form State for Edit Teacher
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    is_active: true,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete State
  const [teacherToDelete, setTeacherToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchTeachers = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await getAdminTeachersApi(token);
      setTeachers(data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch teachers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, [token]);

  // Handle Add Teacher Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError('');

    if (!addForm.name.trim() || !addForm.username.trim() || !addForm.email.trim() || !addForm.password.trim()) {
      setAddError('Please complete all required fields.');
      return;
    }

    setAddLoading(true);
    try {
      await createAdminTeacherApi(
        {
          name: addForm.name.trim(),
          username: addForm.username.trim(),
          email: addForm.email.trim(),
          password: addForm.password.trim(),
          role: addForm.role || 'teacher',
        },
        token
      );
      setSuccessMsg(`Teacher account '${addForm.username}' created successfully.`);
      setIsAddModalOpen(false);
      setAddForm({ name: '', username: '', email: '', password: '', role: 'teacher' });
      fetchTeachers();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to create teacher account.';
      setAddError(detail);
    } finally {
      setAddLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (t) => {
    setSelectedTeacher(t);
    setEditForm({
      name: t.name || '',
      username: t.username || '',
      email: t.email || '',
      password: '',
      is_active: t.is_active !== undefined ? t.is_active : true,
    });
    setEditError('');
    setIsEditModalOpen(true);
  };

  // Handle Edit Teacher Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    setEditError('');

    setEditLoading(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        username: editForm.username.trim(),
        email: editForm.email.trim(),
        is_active: editForm.is_active,
      };
      if (editForm.password && editForm.password.trim().length >= 4) {
        payload.password = editForm.password.trim();
      }

      await updateAdminTeacherApi(selectedTeacher.id, payload, token);
      setSuccessMsg(`Teacher '${editForm.username}' updated successfully.`);
      setIsEditModalOpen(false);
      fetchTeachers();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to update teacher.';
      setEditError(detail);
    } finally {
      setEditLoading(false);
    }
  };

  // Open Delete Confirmation
  const openDeleteModal = (t) => {
    setTeacherToDelete(t);
    setIsDeleteModalOpen(true);
  };

  // Handle Delete Confirm
  const handleDeleteConfirm = async () => {
    if (!teacherToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteAdminTeacherApi(teacherToDelete.id, token);
      setSuccessMsg(`Teacher '${teacherToDelete.name}' (ID: ${teacherToDelete.id}) removed successfully.`);
      setIsDeleteModalOpen(false);
      setTeacherToDelete(null);
      fetchTeachers();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete teacher.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredTeachers = teachers.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.username && t.username.toLowerCase().includes(q)) ||
      (t.email && t.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-amber-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <UserCog className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-sans">Teacher Accounts Management</h1>
          </div>
          <p className="text-xs text-slate-400">
            Create, update, inspect data load, and manage faculty credentials with strict username/email uniqueness.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchTeachers}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setAddError('');
              setIsAddModalOpen(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-glow transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Teacher</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start space-x-3 text-emerald-300 text-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teachers by name, username, or email..."
            className="glass-input block w-full pl-9 pr-3 py-2 text-xs rounded-xl"
          />
        </div>

        <div className="text-xs text-slate-400">
          Showing <strong className="text-white">{filteredTeachers.length}</strong> of {teachers.length} teachers
        </div>
      </div>

      {/* Teachers Directory Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Teacher</th>
                <th className="px-5 py-3.5 font-semibold">Username</th>
                <th className="px-5 py-3.5 font-semibold">Email</th>
                <th className="px-5 py-3.5 font-semibold text-center">Assigned Students</th>
                <th className="px-5 py-3.5 font-semibold text-center">Answer Sheets</th>
                <th className="px-5 py-3.5 font-semibold text-center">Status</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredTeachers.length > 0 ? (
                filteredTeachers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white text-sm">{t.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: #{t.id}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-brand-300">
                      {t.username}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {t.email || <span className="text-slate-500 italic">No email</span>}
                    </td>
                    <td className="px-5 py-4 text-center font-mono">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-200 border border-slate-700 font-bold">
                        {t.student_count || 0}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center font-mono">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-200 border border-slate-700 font-bold">
                        {t.upload_count || 0}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          t.is_active
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
                          title="Edit Teacher"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
                          title="Delete / Deactivate Teacher"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-5 py-8 text-center text-slate-500">
                    No teacher accounts found matching your query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ADD NEW TEACHER                                 */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-amber-500/30 shadow-2xl space-y-5 bg-slate-900/95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">Create New Teacher Account</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Full Name & Title <span className="text-rose-400">*</span>
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="e.g. Dr. Alan Turing"
                    className="glass-input block w-full pl-9 pr-3 py-2 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Username (Unique) <span className="text-rose-400">*</span>
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <UserCog className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                    placeholder="e.g. aturing"
                    className="glass-input block w-full pl-9 pr-3 py-2 text-xs rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Email Address (Unique) <span className="text-rose-400">*</span>
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="e.g. aturing@institution.edu"
                    className="glass-input block w-full pl-9 pr-3 py-2 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    placeholder="Minimum 4 characters"
                    className="glass-input block w-full pl-9 pr-3 py-2 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-glow transition-all disabled:opacity-50"
                >
                  {addLoading ? (
                    <span>Creating...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Teacher</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT TEACHER                                    */}
      {/* ======================================================== */}
      {isEditModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-amber-500/30 shadow-2xl space-y-5 bg-slate-900/95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">Edit Teacher Profile</h2>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="glass-input block w-full px-3 py-2 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="glass-input block w-full px-3 py-2 text-xs rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="glass-input block w-full px-3 py-2 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Reset Password (Leave blank to keep unchanged)
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="New password (optional)"
                  className="glass-input block w-full px-3 py-2 text-xs rounded-xl"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active_checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="is_active_checkbox" className="text-xs font-medium text-slate-300 cursor-pointer">
                  Account Active (Uncheck to deactivate login)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-glow transition-all disabled:opacity-50"
                >
                  {editLoading ? <span>Saving...</span> : <span>Update Teacher</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: DELETE CONFIRMATION                             */}
      {/* ======================================================== */}
      {isDeleteModalOpen && teacherToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-sm p-6 rounded-2xl border border-rose-500/30 shadow-2xl space-y-4 bg-slate-900/95">
            <div className="flex items-center space-x-2 text-rose-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Delete Teacher Account</h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete teacher <strong className="text-white">'{teacherToDelete.name}'</strong> ({teacherToDelete.username})?
              All students and answer sheets owned by this teacher will be permanently removed.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-glow-rose transition-all disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
