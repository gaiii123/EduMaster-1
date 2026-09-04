import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, setAuthToken, clearAuthToken, getMe } from '../api/auth';

const AuthContext = createContext(null);

/**
 * Auth provider that manages user authentication state (students and admins).
 * Persists token to localStorage so the session survives page refreshes.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);  // Can be student or admin
  const [role, setRole] = useState(null);  // "student" or "admin"
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if there's a saved token
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setAuthToken(savedToken);
      getMe(savedToken)
        .then(({ user, role }) => {
          setUser(user);
          setRole(role);
          setToken(savedToken);
        })
        .catch(() => {
          // Token is invalid or expired, clear it
          localStorage.removeItem('auth_token');
          clearAuthToken();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  /**
   * Log in a user (student or admin) with email and password.
   */
  async function login(email, password) {
    const { access_token, user, role } = await apiLogin({ email, password });
    localStorage.setItem('auth_token', access_token);
    setAuthToken(access_token);
    setToken(access_token);
    setUser(user);
    setRole(role);
    return { user, role };
  }

  /**
   * Log out the current user.
   */
  function logout() {
    localStorage.removeItem('auth_token');
    clearAuthToken();
    setToken(null);
    setUser(null);
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ user, role, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access the auth context.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
