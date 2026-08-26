import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  UploadCloud, 
  BookOpen, 
  Cpu, 
  CheckCircle2, 
  LogOut, 
  LayoutDashboard,
  Sparkles,
  Users,
  GraduationCap,
  ExternalLink,
  UserCheck,
  Shield,
  UserCog,
  FileCheck,
  Layers
} from 'lucide-react';

export const Navbar = () => {
  const { 
    isAuthenticated, 
    isAdminAuthenticated, 
    isTeacherAuthenticated, 
    isStudentAuthenticated, 
    logout, 
    user, 
    studentSession 
  } = useAuth();
  
  const location = useLocation();
  const navigate = useNavigate();

  if (!isAuthenticated || location.pathname === '/login') {
    return null;
  }

  // Admin navigation items
  const adminNavItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/teachers', label: 'Teachers', icon: UserCog },
    { path: '/admin/students', label: 'All Students', icon: Users },
    { path: '/admin/results', label: 'All Results', icon: FileCheck },
  ];

  // Teacher navigation items
  const teacherNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/create-test', label: 'Create Test', icon: Layers },
    { path: '/students', label: 'Students', icon: Users },
    { path: '/upload', label: 'Upload Answer', icon: UploadCloud },
    { path: '/model-answer', label: 'Model Answer', icon: BookOpen },
    { path: '/evaluation', label: 'Evaluation', icon: Cpu },
    { path: '/results', label: 'Results', icon: CheckCircle2 },
    { path: '/student-portal', label: 'Student Portal', icon: GraduationCap },
  ];

  // Student navigation items
  const studentNavItems = [
    { 
      path: studentSession?.roll_number ? `/student-portal/${encodeURIComponent(studentSession.roll_number)}` : '/student-portal', 
      label: 'My Scorecard & Marks', 
      icon: GraduationCap 
    },
  ];

  let currentNavItems = teacherNavItems;
  let homePath = '/dashboard';
  let badgeLabel = 'Teacher Workspace';
  let badgeColor = 'bg-brand-500/20 text-brand-300 border-brand-500/30';
  let statusDotColor = 'bg-emerald-400';
  let subtitleText = 'Handwritten Evaluation & Multi-Teacher Hub';

  if (isAdminAuthenticated) {
    currentNavItems = adminNavItems;
    homePath = '/admin/dashboard';
    badgeLabel = 'Admin Control Hub';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    statusDotColor = 'bg-amber-400';
    subtitleText = 'System Administration & Global Analytics';
  } else if (isStudentAuthenticated && !isTeacherAuthenticated) {
    currentNavItems = studentNavItems;
    homePath = '/student-portal';
    badgeLabel = 'Student Portal';
    badgeColor = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
    statusDotColor = 'bg-teal-400';
    subtitleText = 'Verified Academic Scorecard';
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 glass-panel bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to={homePath} className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-violet-500 p-0.5 shadow-glow flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <FileText className="w-5 h-5 text-brand-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-lg font-bold tracking-tight text-white font-sans">ScriptSense</span>
                <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                  {badgeLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {subtitleText}
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {currentNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path.startsWith('/student-portal') && location.pathname.startsWith('/student-portal'));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? isAdminAuthenticated 
                        ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30 shadow-sm'
                        : 'bg-brand-600/20 text-brand-300 border border-brand-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? (isAdminAuthenticated ? 'text-amber-400' : 'text-brand-400') : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <div className={`w-2 h-2 rounded-full ${statusDotColor} animate-pulse`}></div>
              <span>
                {isAdminAuthenticated ? (
                  <>
                    Admin: <strong className="text-amber-300">{user?.full_name || user?.username || 'Administrator'}</strong>
                  </>
                ) : isTeacherAuthenticated ? (
                  <>
                    Teacher: <strong className="text-slate-200">{user?.full_name || user?.username || 'Teacher'}</strong>
                  </>
                ) : (
                  <>
                    Student: <strong className="text-emerald-300">{user?.full_name || user?.username || 'Student'}</strong>
                  </>
                )}
              </span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
              title="Logout / Switch Account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-800/80 bg-slate-950/90 text-xs overflow-x-auto">
        {currentNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center py-1 px-2 rounded flex-shrink-0 ${
                isActive 
                  ? (isAdminAuthenticated ? 'text-amber-400 font-semibold' : 'text-brand-400 font-semibold')
                  : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
};
