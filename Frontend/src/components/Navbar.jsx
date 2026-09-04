import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

function Navbar() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <div className="navbar__brand">
        <span className="navbar__logo">E</span>
        <span className="navbar__title">EduMaster</span>
      </div>

      {user ? (
        /* Logged in user navigation */
        <ul className="navbar__links">
          {role === 'admin' ? (
            /* Admin navigation */
            <>
              <li>
                <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
                  Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/modules" className={({ isActive }) => (isActive ? 'active' : '')}>
                  Modules
                </NavLink>
              </li>
              <li>
                <NavLink to="/students" className={({ isActive }) => (isActive ? 'active' : '')}>
                  Students
                </NavLink>
              </li>
            </>
          ) : (
            /* Student navigation */
            <>
              <li>
                <NavLink to="/modules" className={({ isActive }) => (isActive ? 'active' : '')}>
                  Courses
                </NavLink>
              </li>
              <li>
                <NavLink to="/student/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
                  My Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/student/library" className={({ isActive }) => (isActive ? 'active' : '')}>
                  Library
                </NavLink>
              </li>
              <li>
                <NavLink to="/student/viva" className={({ isActive }) => (isActive ? 'active' : '')}>
                  Take Viva
                </NavLink>
              </li>
            </>
          )}
          <li className="navbar__user">
            <span className="navbar__user-name">{user.name} ({role})</span>
            <button onClick={handleLogout} className="navbar__logout">
              Logout
            </button>
          </li>
        </ul>
      ) : (
        /* Not logged in - show login link */
        <ul className="navbar__links">
          <li>
            <Link to="/login" className="navbar__login-link">
              Login
            </Link>
          </li>
        </ul>
      )}
    </nav>
  );
}

export default Navbar;
