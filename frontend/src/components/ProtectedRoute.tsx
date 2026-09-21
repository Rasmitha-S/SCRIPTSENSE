import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  roleRequired?: 'admin' | 'teacher' | 'student';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  roleRequired = 'teacher',
}) => {
  const { isAuthenticated, isTeacherAuthenticated, isAdminAuthenticated, isStudentAuthenticated } =
    useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roleRequired === 'admin') {
    if (!isAdminAuthenticated) {
      return <Navigate to={isTeacherAuthenticated ? '/dashboard' : '/login'} replace />;
    }
    return <>{children}</>;
  }

  if (roleRequired === 'teacher') {
    if (!isTeacherAuthenticated && !isAdminAuthenticated) {
      return <Navigate to={isStudentAuthenticated ? '/student-portal' : '/login'} replace />;
    }
    return <>{children}</>;
  }

  return <>{children}</>;
};
