import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Protected route wrapper that redirects unauthenticated users to login.
 * Optionally checks for specific role (admin or student).
 */
function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If a specific role is required and user doesn't have it, redirect to appropriate page
  if (requiredRole && role !== requiredRole) {
    if (role === 'admin') {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/student/viva" replace />;
    }
  }

  return children;
}

export default ProtectedRoute;
