import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listStudents, createStudent } from '../api/students';
import './Students.css';

/**
 * Admin roster of all students, each shown with their latest AI placement
 * (track, level, composite score). Clicking a card opens the per-student
 * drill-down on the Dashboard.
 */
function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', studentCode: '', password: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listStudents();
      setStudents(data);
    } catch {
      setError('Could not load students. Is the backend running on :8000?');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    listStudents()
      .then((data) => { if (active) setStudents(data); })
      .catch(() => { if (active) setError('Could not load students. Is the backend running on :8000?'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.studentCode.trim() || !form.password.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createStudent(form);
      setForm({ name: '', email: '', studentCode: '', password: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add student.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="students">
      <header className="students__header">
        <div>
          <h1>Students</h1>
          <p className="students__subtitle">
            Enrolment roster with latest AI placement. Select a student to drill down.
          </p>
        </div>
        <button
          className="students__add students__add--active"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? '× Close' : '+ Enrol Student'}
        </button>
      </header>

      {error && <div className="students__error">{error}</div>}

      {showForm && (
        <form className="students__form" onSubmit={handleAdd}>
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            placeholder="Student code (e.g. IT-2026-010)"
            value={form.studentCode}
            onChange={(e) => setForm({ ...form, studentCode: e.target.value })}
            required
          />
          <input
            placeholder="Initial password (min 6 characters)"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={6}
            required
          />
          <button type="submit" disabled={saving}>
            {saving ? 'Enrolling…' : 'Enrol'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="students__status">Loading students…</p>
      ) : students.length === 0 ? (
        <p className="students__status">
          No students yet. Enrol one and run their Baseline Viva.
        </p>
      ) : (
        <div className="students__grid">
          {students.map((s) => (
            <Link
              key={s.id}
              to={`/?student=${s.id}`}
              className="student-card"
            >
              <div className="student-card__avatar">{s.name.charAt(0)}</div>
              <div className="student-card__info">
                <h3>{s.name}</h3>
                <p>{s.email}</p>
                <div className="student-card__meta">
                  <span className="student-card__code">{s.student_code}</span>
                  {s.track ? (
                    <span className={`student-card__track student-card__track--${s.track.toLowerCase()}`}>
                      {s.track} · {s.level}
                    </span>
                  ) : (
                    <span className="student-card__track student-card__track--none">
                      Not placed
                    </span>
                  )}
                </div>
              </div>
              {s.composite_score !== null && s.composite_score !== undefined && (
                <div className="student-card__score">{s.composite_score}</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default Students;
