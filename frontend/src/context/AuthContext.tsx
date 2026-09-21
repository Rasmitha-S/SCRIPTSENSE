import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { setAuthHeader } from '../services/api';
import { User, StudentPortalResponse, WorkflowData, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | null>(null);

const initialWorkflowData: WorkflowData = {
  answerSheetId: null,
  studentId: null,
  studentName: '',
  rollNumber: '',
  testId: null,
  testName: '',
  fileName: '',
  extractedText: '',
  modelAnswerId: null,
  question: '',
  modelAnswerText: '',
  maxMarks: 10,
  examTitle: '',
  examSubject: '',
  questions: [],
  rubric: [],
  evaluationId: null,
  similarity: null,
  suggestedMarks: null,
  explanation: '',
  finalMarks: null,
  teacherFeedback: '',
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Initialize state with localStorage persistence
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('scriptsense_token') || null;
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('scriptsense_user');
    try {
      return saved ? (JSON.parse(saved) as User) : null;
    } catch {
      return null;
    }
  });

  const [studentSession, setStudentSession] = useState<StudentPortalResponse | null>(() => {
    const saved = localStorage.getItem('scriptsense_student_session');
    try {
      return saved ? (JSON.parse(saved) as StudentPortalResponse) : null;
    } catch {
      return null;
    }
  });

  // Keep axios auth header synchronized with active token
  useEffect(() => {
    if (token) {
      setAuthHeader(token);
    }
  }, [token]);

  // Workflow tracking state for smooth page-to-page navigation
  const [workflowData, setWorkflowData] = useState<WorkflowData>(initialWorkflowData);

  const login = (
    authToken: string,
    userData: Partial<User> = { username: 'teacher1', role: 'teacher', full_name: 'Dr. Sarah Smith' }
  ) => {
    const fullUserData: User = {
      username: userData.username || 'teacher1',
      role: userData.role || 'teacher',
      full_name: userData.full_name || userData.name || 'Dr. Sarah Smith',
      name: userData.name || userData.full_name || 'Dr. Sarah Smith',
      email: userData.email,
      user_id: userData.user_id || userData.id,
      id: userData.id || userData.user_id,
      ...userData,
    };
    setToken(authToken);
    setUser(fullUserData);
    setStudentSession(null);
    setAuthHeader(authToken);
    localStorage.setItem('scriptsense_token', authToken);
    localStorage.setItem('scriptsense_user', JSON.stringify(fullUserData));
    localStorage.removeItem('scriptsense_student_session');
  };

  const loginAsStudent = (portalData: StudentPortalResponse) => {
    const studentUser: User = {
      username: portalData.student_name,
      full_name: portalData.student_name,
      name: portalData.student_name,
      role: 'student',
      studentId: portalData.student_id,
      rollNumber: portalData.roll_number,
    };
    setStudentSession(portalData);
    setUser(studentUser);
    setToken(null);
    setAuthHeader(null);
    localStorage.removeItem('scriptsense_token');
    localStorage.setItem('scriptsense_user', JSON.stringify(studentUser));
    localStorage.setItem('scriptsense_student_session', JSON.stringify(portalData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setStudentSession(null);
    setAuthHeader(null);
    localStorage.removeItem('scriptsense_token');
    localStorage.removeItem('scriptsense_user');
    localStorage.removeItem('scriptsense_student_session');
    setWorkflowData(initialWorkflowData);
  };

  const updateWorkflow = (fields: Partial<WorkflowData>) => {
    setWorkflowData((prev) => ({
      ...prev,
      ...fields,
    }));
  };

  const isAdminAuthenticated = Boolean(token && user?.role === 'admin');
  const isTeacherAuthenticated = Boolean(token && user?.role === 'teacher');
  const isStudentAuthenticated = Boolean(studentSession || user?.role === 'student');
  const isAuthenticated = isAdminAuthenticated || isTeacherAuthenticated || isStudentAuthenticated;

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        studentSession,
        setStudentSession,
        isAuthenticated,
        isAdminAuthenticated,
        isTeacherAuthenticated,
        isStudentAuthenticated,
        login,
        loginAsStudent,
        logout,
        workflowData,
        updateWorkflow,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
