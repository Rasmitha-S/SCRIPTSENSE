import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, roleRequired = 'teacher' }) => {
  const { isAuthenticated, isTeacherAuthenticated, isAdminAuthenticated, isStudentAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roleRequired === 'admin') {
    if (!isAdminAuthenticated) {
      return <Navigate to={isTeacherAuthenticated ? "/dashboard" : "/login"} replace />;
    }
    return children;
  }

  if (roleRequired === 'teacher') {
    if (!isTeacherAuthenticated && !isAdminAuthenticated) {
      return <Navigate to={isStudentAuthenticated ? "/student-portal" : "/login"} replace />;
    }
    return children;
  }

  return children;
};

