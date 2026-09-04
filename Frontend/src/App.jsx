import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';

import Students from './pages/Students';
import Login from './pages/Login';
import StudentViva from './pages/StudentViva';
import StudentDashboard from './pages/StudentDashboard';
import Library from './pages/Library';
import SubjectView from './pages/SubjectView';
import NoteReader from './pages/NoteReader';
import CourseOverview from './pages/CourseOverview';
import ModuleDetail from './pages/ModuleDetail';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main className="app-main">
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />
            
            {/* Admin routes (protected - admin only) */}
            <Route
              path="/"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/students"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Students />
                </ProtectedRoute>
              }
            />
            
            {/* Student routes (protected - student only) */}
            <Route
              path="/student/viva"
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentViva />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/library"
              element={
                <ProtectedRoute requiredRole="student">
                  <Library />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/library/subject/:subjectId"
              element={
                <ProtectedRoute requiredRole="student">
                  <SubjectView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/library/note/:noteId"
              element={
                <ProtectedRoute requiredRole="student">
                  <NoteReader />
                </ProtectedRoute>
              }
            />

            {/* Course Modules routes (accessible to both authenticated students and admins) */}
            <Route
              path="/modules"
              element={
                <ProtectedRoute>
                  <CourseOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/modules/:moduleId"
              element={
                <ProtectedRoute>
                  <ModuleDetail />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
