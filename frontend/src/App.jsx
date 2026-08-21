import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Students } from './pages/Students';
import { UploadAnswer } from './pages/UploadAnswer';
import { ModelAnswer } from './pages/ModelAnswer';
import { EvaluationPage } from './pages/EvaluationPage';
import { Results } from './pages/Results';
import { StudentPortal } from './pages/StudentPortal';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminTeachers } from './pages/admin/AdminTeachers';
import { AdminStudents } from './pages/admin/AdminStudents';
import { AdminResults } from './pages/admin/AdminResults';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Root route redirects to /login as per Section 1 */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              
              {/* Main Login Route */}
              <Route path="/login" element={<Login />} />

              {/* Student Portal */}
              <Route path="/student-portal" element={<StudentPortal />} />
              <Route path="/student-portal/:rollNumber" element={<StudentPortal />} />

              {/* Admin Protected Workspace Routes */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute roleRequired="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/teachers"
                element={
                  <ProtectedRoute roleRequired="admin">
                    <AdminTeachers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/students"
                element={
                  <ProtectedRoute roleRequired="admin">
                    <AdminStudents />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/results"
                element={
                  <ProtectedRoute roleRequired="admin">
                    <AdminResults />
                  </ProtectedRoute>
                }
              />

              {/* Protected Teacher Workspace Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute roleRequired="teacher">
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/students"
                element={
                  <ProtectedRoute roleRequired="teacher">
                    <Students />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/upload"
                element={
                  <ProtectedRoute roleRequired="teacher">
                    <UploadAnswer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/model-answer"
                element={
                  <ProtectedRoute roleRequired="teacher">
                    <ModelAnswer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/evaluation"
                element={
                  <ProtectedRoute roleRequired="teacher">
                    <EvaluationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/results"
                element={
                  <ProtectedRoute roleRequired="teacher">
                    <Results />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/results/:id"
                element={
                  <ProtectedRoute roleRequired="teacher">
                    <Results />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all fallback redirects to /login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
