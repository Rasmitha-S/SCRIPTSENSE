import React, { createContext, useContext, useState, useEffect } from 'react';
import { setAuthHeader } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Initialize state with localStorage persistence
  const [token, setToken] = useState(() => {
    return localStorage.getItem('scriptsense_token') || null;
  });

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('scriptsense_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [studentSession, setStudentSession] = useState(() => {
    const saved = localStorage.getItem('scriptsense_student_session');
    try {
      return saved ? JSON.parse(saved) : null;
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
  const [workflowData, setWorkflowData] = useState({
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

  const login = (authToken, userData = { username: 'teacher1', role: 'teacher', full_name: 'Dr. Sarah Smith' }) => {
    setToken(authToken);
    setUser(userData);
    setStudentSession(null);
    setAuthHeader(authToken);
    localStorage.setItem('scriptsense_token', authToken);
    localStorage.setItem('scriptsense_user', JSON.stringify(userData));
    localStorage.removeItem('scriptsense_student_session');
  };

  const loginAsStudent = (portalData) => {
    const studentUser = {
      username: portalData.student_name,
      full_name: portalData.student_name,
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
    setWorkflowData({
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

  const updateWorkflow = (fields) => {
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

