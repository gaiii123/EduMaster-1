import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

/**
 * Unified login page for students and admins.
 */
function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { role } = await login(email, password);
      
      // Redirect based on role
      if (role === 'admin') {
        navigate('/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <h1 className="login__title">Welcome to EduMaster</h1>
        <p className="login__subtitle">
          Log in to study interactive notes, take AI viva assessments, and track your growth.
          Students and admins can use the same login.
        </p>

        {error && <div className="login__error">{error}</div>}

        <form onSubmit={handleSubmit} className="login__form">
          <div className="login__field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kasun@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="login__field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="login__button" disabled={loading}>
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <p className="login__footer">
          Demo credentials:<br />
          Student: kasun@example.com / password123<br />
          Admin: admin@edumaster.com / password123
        </p>
      </div>
    </div>
  );
}

export default Login;
