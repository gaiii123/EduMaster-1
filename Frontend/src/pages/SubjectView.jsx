import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSubject } from '../api/learning';
import './SubjectView.css';

/**
 * Subject view — lists all notes in a subject with read checkmarks,
 * bookmark stars and reading-time badges.
 */
function SubjectView() {
  const { subjectId } = useParams();
  const [subject, setSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setSubject(await getSubject(subjectId));
      } catch (err) {
        console.error('Failed to load subject:', err);
        setError('Could not load this subject.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subjectId]);

  if (loading) {
    return (
      <div className="subject-view">
        <p className="subject-view__status">Loading subject…</p>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="subject-view">
        <p className="subject-view__status">{error ?? 'Subject not found.'}</p>
        <Link to="/student/library" className="subject-view__back">← Back to Library</Link>
      </div>
    );
  }

  const readCount = subject.notes.filter((note) => note.is_read).length;
  const percent = subject.notes.length
    ? Math.round((readCount / subject.notes.length) * 100)
    : 0;

  return (
    <div className="subject-view">
      <Link to="/student/library" className="subject-view__back">← Back to Library</Link>

      <header className="subject-view__header">
        <span className="subject-view__icon">{subject.icon}</span>
        <div className="subject-view__heading">
          <h1>{subject.title}</h1>
          <p>{subject.description}</p>
        </div>
      </header>

      <div className="subject-view__progress">
        <div className="subject-view__progress-bar">
          <div className="subject-view__progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span>
          {readCount} / {subject.notes.length} notes read ({percent}%)
        </span>
      </div>

      <ul className="subject-view__notes">
        {subject.notes.map((note, index) => (
          <li key={note.id}>
            <Link to={`/student/library/note/${note.id}`} className="subject-view__note">
              <span className="subject-view__note-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="subject-view__note-body">
                <div className="subject-view__note-title-row">
                  <h3>{note.title}</h3>
                  {note.is_bookmarked && <span title="Bookmarked">🔖</span>}
                  {note.source === 'ai' && (
                    <span className="subject-view__note-badge subject-view__note-badge--ai">✨ AI</span>
                  )}
                  {note.source === 'photo' && (
                    <span className="subject-view__note-badge subject-view__note-badge--photo">📷 Photo</span>
                  )}
                </div>
                <p>{note.summary}</p>
              </div>
              <div className="subject-view__note-meta">
                <span className="subject-view__note-time">⏱️ {note.reading_minutes} min</span>
                <span className={`subject-view__note-read ${note.is_read ? 'done' : ''}`}>
                  {note.is_read ? '✅ Read' : 'Start →'}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SubjectView;
