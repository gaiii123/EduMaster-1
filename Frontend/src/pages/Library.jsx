import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listSubjects, getMyProgress, searchNotes } from '../api/learning';
import AiNoteModal from '../components/AiNoteModal';
import './Library.css';

/** SVG progress ring showing subject completion. */
function ProgressRing({ percent }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <svg className="library__ring" width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--border)" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" textAnchor="middle" className="library__ring-label">
        {percent}%
      </text>
    </svg>
  );
}

/**
 * Learning Library — the educational heart of the platform.
 * Searchable subject catalog with progress rings, continue-reading strip
 * and bookmark shortcuts.
 */
function Library() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [progress, setProgress] = useState(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAiModal, setShowAiModal] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [subjectsData, progressData] = await Promise.all([
          listSubjects(),
          getMyProgress(),
        ]);
        setSubjects(subjectsData);
        setProgress(progressData);
      } catch (err) {
        console.error('Failed to load library:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Debounced search across note titles/summaries/content.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        setHits(await searchNotes(q));
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const overallPercent = useMemo(() => {
    if (!progress || progress.total_notes === 0) return 0;
    return progress.completion_percent;
  }, [progress]);

  if (loading) {
    return (
      <div className="library">
        <p className="library__status">Loading your library…</p>
      </div>
    );
  }

  return (
    <div className="library">
      <header className="library__header">
        <div>
          <h1>Learning Library</h1>
          <p className="library__subtitle">
            Study notes mapped to your viva mastery dimensions. Read, quiz yourself, and track your progress.
          </p>
        </div>
        <div className="library__overall">
          <ProgressRing percent={overallPercent} />
          <div>
            <strong>{progress?.read_count ?? 0} / {progress?.total_notes ?? 0}</strong>
            <span>notes read</span>
          </div>
        </div>
      </header>

      <div className="library__ai-row">
        <button type="button" className="library__ai-btn" onClick={() => setShowAiModal(true)}>
          Generate Note
        </button>
      </div>

      <div className="library__search">
        <input
          type="search"
          placeholder="Search notes… (e.g. joins, REST, closures)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Search results replace the catalog while a query is active */}
      {hits !== null ? (
        <section className="library__section">
          <h2>Search results ({hits.length})</h2>
          {hits.length === 0 ? (
            <p className="library__empty">No notes matched your search.</p>
          ) : (
            <ul className="library__results">
              {hits.map((hit) => (
                <li key={hit.note_id}>
                  <Link to={`/student/library/note/${hit.note_id}`} className="library__result">
                    <span className="library__result-title">{hit.title}</span>
                    <span className="library__result-subject">{hit.subject_title}</span>
                    <span className="library__result-snippet">{hit.snippet}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {/* Continue reading strip */}
          {progress?.recent_notes?.length > 0 && (
            <section className="library__section">
              <h2>Continue reading</h2>
              <div className="library__recent">
                {progress.recent_notes.map((recent) => (
                  <Link
                    key={recent.note_id}
                    to={`/student/library/note/${recent.note_id}`}
                    className="library__recent-card"
                  >
                    <span className="library__recent-status">
                      {recent.is_read ? 'Read' : 'In progress'}
                    </span>
                    <strong>{recent.title}</strong>
                    <span className="library__recent-subject">{recent.subject_title}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Bookmarks shortcut row */}
          {progress?.bookmarks?.length > 0 && (
            <section className="library__section">
              <h2>Bookmarked notes</h2>
              <div className="library__bookmarks">
                {progress.bookmarks.map((bookmark) => (
                  <Link
                    key={bookmark.note_id}
                    to={`/student/library/note/${bookmark.note_id}`}
                    className="library__bookmark"
                  >
                    {bookmark.title}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Subject catalog */}
          <section className="library__section">
            <h2>Subjects</h2>
            <div className="library__grid">
              {subjects.map((subject) => {
                const percent = subject.note_count
                  ? Math.round((subject.read_count / subject.note_count) * 100)
                  : 0;
                return (
                  <Link
                    key={subject.id}
                    to={`/student/library/subject/${subject.id}`}
                    className="library__card"
                  >
                    <div className="library__card-top">
                      <ProgressRing percent={percent} />
                    </div>
                    <h3>{subject.title}</h3>
                    <p>{subject.description}</p>
                    <span className="library__card-meta">
                      {subject.read_count} / {subject.note_count} notes read
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}

      {showAiModal && (
        <AiNoteModal
          subjects={subjects}
          onClose={() => setShowAiModal(false)}
          onCreated={(noteId) => navigate(`/student/library/note/${noteId}`)}
        />
      )}
    </div>
  );
}

export default Library;
