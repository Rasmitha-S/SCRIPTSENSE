import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginApi, registerTeacherApi, resetPasswordApi, studentPortalLookupApi, setAuthHeader } from '../services/api';
import { 
  FileText, 
  Lock, 
  User, 
  Mail,
  ArrowRight, 
  ShieldCheck, 
  AlertCircle,
  KeyRound,
  Sparkles,
  GraduationCap,
  Users,
  UserPlus,
  Hash,
  CheckCircle2,
  BookOpen,
  Shield,
  Briefcase
} from 'lucide-react';

export const Login = () => {
  // Active Main Tab: 'auth' (Educator / Admin) | 'student' (Student portal lookup)
  const [activeTab, setActiveTab] = useState('auth');

  // Role Selection: 'teacher' | 'admin'
  const [role, setRole] = useState('teacher');

  // Auth Mode: 'signin' | 'register' | 'forgot'
  const [authMode, setAuthMode] = useState('signin');
  
  // Form Inputs
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Student Portal Lookup State
  const [studentRoll, setStudentRoll] = useState('');

  // Status & Feedback
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, loginAsStudent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Role-Based Login Handler
  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!usernameOrEmail.trim() || !password.trim()) {
      setError('Please enter both username/email and password.');
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'signin') {
        const data = await loginApi(usernameOrEmail.trim(), password.trim(), role);
        if (data.access_token) {
          setAuthHeader(data.access_token);
          login(data.access_token, {
            user_id: data.user_id,
            username: data.username || usernameOrEmail.trim(),
            full_name: data.name || data.full_name || usernameOrEmail.trim(),
            name: data.name || data.full_name || usernameOrEmail.trim(),
            role: data.role || role,
            email: data.email,
          });

          if (data.role === 'admin') {
            navigate('/admin/dashboard');
          } else {
            const destination = location.state?.from?.pathname || '/dashboard';
            navigate(destination);
          }
        } else {
          setError('Login failed. No access token received from server.');
        }
      } else {
        // Register new teacher
        const data = await registerTeacherApi({
          username: usernameOrEmail.trim(),
          email: email.trim() || undefined,
          password: password.trim(),
          full_name: fullName.trim() || usernameOrEmail.trim(),
          role: 'teacher',
        });
        if (data.access_token) {
          setAuthHeader(data.access_token);
          login(data.access_token, {
            user_id: data.user_id,
            username: data.username,
            full_name: data.name || data.full_name || data.username,
            name: data.name || data.full_name || data.username,
            role: 'teacher',
            email: data.email,
          });
          navigate('/dashboard');
        } else {
          setSuccessMsg('Account registered successfully! Please sign in.');
          setAuthMode('signin');
        }
      }
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message || 'Authentication failed. Please check your credentials.';
      setError(errorDetail);
    } finally {
      setLoading(false);
    }
  };

  // Password Reset Handler
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!usernameOrEmail.trim()) {
      setError('Please enter the username or email.');
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setError('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await resetPasswordApi(usernameOrEmail.trim(), newPassword);
      setSuccessMsg(res.message || 'Password reset successfully! You can now log in.');
      setPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setAuthMode('signin');
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message || 'Failed to reset password. Please verify your username.';
      setError(errorDetail);
    } finally {
      setLoading(false);
    }
  };

  // Student Marks Portal Handler
  const handleStudentLookup = async (e) => {
    e.preventDefault();
    setError('');

    if (!studentRoll.trim()) {
      setError('Please enter your Roll Number or Student ID.');
      return;
    }

    setLoading(true);

    try {
      const data = await studentPortalLookupApi(studentRoll.trim());
      if (data && data.student_id) {
        loginAsStudent(data);
        navigate(`/student-portal/${encodeURIComponent(data.roll_number || data.student_id)}`);
      } else {
        setError('No student records found.');
      }
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message || 'No records found matching this Roll Number.';
      setError(errorDetail);
    } finally {
      setLoading(false);
    }
  };

  const quickSelectStudent = (roll) => {
    setStudentRoll(roll);
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden bg-slate-950">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-10 w-[350px] h-[350px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Logo and Header */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-violet-500 p-0.5 shadow-glow flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <FileText className="w-7 h-7 text-brand-400" />
            </div>
          </div>
        </div>

        <h1 className="mt-5 text-center text-3xl font-extrabold tracking-tight text-white font-sans">
          Script<span className="gradient-text">Sense</span>
        </h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Handwritten Answer Evaluation & Multi-Teacher Academic Hub
        </p>

        {/* Dual Mode Switcher (Auth Workspace vs Student Lookup) */}
        <div className="mt-6 flex justify-center">
          <div className="p-1 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center space-x-1 shadow-lg">
            <button
              onClick={() => {
                setActiveTab('auth');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'auth'
                  ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-glow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Login Workspace</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('student');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'student'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-glow-teal'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Student Scorecard</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="glass-panel py-8 px-6 sm:px-10 rounded-2xl shadow-2xl border border-slate-800">
          
          {/* Notifications */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-2.5 text-rose-300 text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start space-x-2.5 text-emerald-300 text-sm animate-fade-in">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: ROLE-BASED LOGIN (Teacher & Admin)                  */}
          {/* ======================================================== */}
          {activeTab === 'auth' && (
            <div className="space-y-6">
              
              {/* Auth Mode Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                  {authMode === 'signin' && <span>Sign In</span>}
                  {authMode === 'register' && <span>Register New Teacher</span>}
                  {authMode === 'forgot' && (
                    <>
                      <KeyRound className="w-3.5 h-3.5 text-brand-400" />
                      <span>Reset Password</span>
                    </>
                  )}
                </span>
                <div className="flex items-center space-x-3">
                  {authMode !== 'signin' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setError('');
                        setSuccessMsg('');
                      }}
                      className="text-xs font-semibold text-brand-400 hover:text-brand-300 hover:underline"
                    >
                      Back to Sign In
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setRole('teacher');
                        setError('');
                        setSuccessMsg('');
                      }}
                      className="text-xs font-semibold text-brand-400 hover:text-brand-300 hover:underline flex items-center space-x-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>New Teacher?</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 1. Main Sign In / Register Form */}
              {authMode !== 'forgot' ? (
                <form onSubmit={handleAuth} className="space-y-4">
                  
                  {/* Role Dropdown Selector (Required Section 1 & 10) */}
                  {authMode === 'signin' && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                        Role
                      </label>
                      <div className="relative rounded-xl shadow-sm">
                        <select
                          value={role}
                          onChange={(e) => {
                            setRole(e.target.value);
                            setError('');
                            setSuccessMsg('');
                          }}
                          className="glass-input block w-full px-3.5 py-2.5 sm:text-sm rounded-xl bg-slate-900 text-slate-100 border border-slate-700 focus:border-brand-500 font-medium"
                        >
                          <option value="teacher" className="bg-slate-900 text-slate-100">Teacher</option>
                          <option value="admin" className="bg-slate-900 text-slate-100">Admin</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {authMode === 'register' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                          Full Name & Title
                        </label>
                        <div className="relative rounded-xl shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="e.g. Prof. Alan Turing"
                            className="glass-input block w-full pl-10 pr-3 py-2.5 sm:text-sm rounded-xl"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                          Email Address
                        </label>
                        <div className="relative rounded-xl shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Mail className="h-4 w-4 text-slate-500" />
                          </div>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="teacher@institution.edu"
                            className="glass-input block w-full pl-10 pr-3 py-2.5 sm:text-sm rounded-xl"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Username / Email
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <input
                        type="text"
                        required
                        value={usernameOrEmail}
                        onChange={(e) => setUsernameOrEmail(e.target.value)}
                        placeholder="Username or email address"
                        className="glass-input block w-full pl-10 pr-3 py-2.5 sm:text-sm rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Password
                      </label>
                      {authMode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('forgot');
                            setError('');
                            setSuccessMsg('');
                            setNewPassword('');
                            setConfirmPassword('');
                          }}
                          className="text-xs font-semibold text-brand-400 hover:text-brand-300 hover:underline"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-500" />
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="glass-input block w-full pl-10 pr-3 py-2.5 sm:text-sm rounded-xl"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full mt-2 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 ${
                      role === 'admin' && authMode === 'signin'
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-glow'
                        : 'bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 shadow-glow'
                    }`}
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Authenticating...</span>
                      </div>
                    ) : (
                      <>
                        <span>
                          {authMode === 'signin' 
                            ? (role === 'admin' ? 'Sign In as Admin' : 'Sign In as Teacher') 
                            : 'Register & Enter Workspace'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* 2. Forgot Password Form */
                <form onSubmit={handleResetPassword} className="space-y-4 animate-fade-in">
                  <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-xs text-brand-200 leading-relaxed">
                    Enter the username and choose a new password. The updated password will be securely hashed with bcrypt.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Username
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <input
                        type="text"
                        required
                        value={usernameOrEmail}
                        onChange={(e) => setUsernameOrEmail(e.target.value)}
                        placeholder="e.g. teacher1"
                        className="glass-input block w-full pl-10 pr-3 py-2.5 sm:text-sm rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      New Password
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-500" />
                      </div>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter at least 4 characters"
                        className="glass-input block w-full pl-10 pr-3 py-2.5 sm:text-sm rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-500" />
                      </div>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="glass-input block w-full pl-10 pr-3 py-2.5 sm:text-sm rounded-xl"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !usernameOrEmail.trim() || !newPassword || !confirmPassword}
                    className="w-full mt-2 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 focus:outline-none shadow-glow transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Resetting Password...</span>
                      </div>
                    ) : (
                      <>
                        <span>Reset Password & Return</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: STUDENT MARKS PORTAL                               */}
          {/* ======================================================== */}
          {activeTab === 'student' && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-white">Student Results Lookup</h2>
                <p className="text-xs text-slate-400">
                  View your verified exam scores, teacher feedback comments, and OCR answers.
                </p>
              </div>

              <form onSubmit={handleStudentLookup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Your Roll Number or Student ID
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Hash className="h-4 w-4 text-emerald-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={studentRoll}
                      onChange={(e) => setStudentRoll(e.target.value)}
                      placeholder="e.g. CS2026-0101 or 12"
                      className="glass-input block w-full pl-10 pr-3 py-2.5 sm:text-sm rounded-xl font-mono text-slate-100"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !studentRoll.trim()}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-glow-teal transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Retrieving Scorecard...</span>
                    </div>
                  ) : (
                    <>
                      <span>View My Marks & Feedback</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Sample Roll Numbers */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Quick Demo Student Lookups:
                </span>
                <div className="flex flex-wrap gap-2">
                  {['24cs116', '125', 'CS2026-202'].map((demoRoll) => (
                    <button
                      key={demoRoll}
                      type="button"
                      onClick={() => quickSelectStudent(demoRoll)}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-900/80 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 transition-colors"
                    >
                      {demoRoll}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Role-Isolated SQLite Backend</span>
            </span>
            <span>FastAPI Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
};
