import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getNote, getSubject, markRead, toggleBookmark, getDigest } from '../api/learning';
import { synthesizeSpeech } from '../api/multimodal';
import NoteQuiz from '../components/NoteQuiz';
import StudyCoach from '../components/StudyCoach';
import PracticeQuizModal from '../components/PracticeQuizModal';
import './NoteReader.css';

const MIN_FONT = 14;
const MAX_FONT = 22;
const TTS_CHUNK_SIZE = 4400; // backend /synthesize caps at 5000 chars

/** Strip Markdown into plain speakable text for the read-aloud feature. */
function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' (code example). ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\*\*|__|\*|_|~~/g, '')
    .replace(/\|/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split text into sentence-aware chunks under the TTS size limit. */
function chunkText(text, size = TTS_CHUNK_SIZE) {
  const chunks = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('. ', size);
    if (cut < size * 0.5) cut = size;
    chunks.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** One flip-able flashcard from the AI digest. */
function Flashcard({ card }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      className={`note-reader__flashcard ${flipped ? 'flipped' : ''}`}
      onClick={() => setFlipped((f) => !f)}
    >
      <span className="note-reader__flashcard-hint">{flipped ? 'Answer — click to flip back' : 'Question — click to reveal'}</span>
      <span>{flipped ? card.back : card.front}</span>
    </button>
  );
}

/**
 * Interactive note reader — Markdown rendering with a sticky toolbar
 * (scroll progress, font size, dark reading mode, bookmark) and an
 * end-of-note quiz. Marks the note read on open.
 */
function NoteReader() {
  const { noteId } = useParams();
  const [note, setNote] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [subjectTitle, setSubjectTitle] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const [fontSize, setFontSize] = useState(17);
  const [darkMode, setDarkMode] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // AI study tools state
  const [listening, setListening] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [digest, setDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestError, setDigestError] = useState(false);
  const audioRef = useRef(null);
  const playTokenRef = useRef(0);

  // Load note + sibling list; mark read on open.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      window.scrollTo(0, 0);
      setScrollProgress(0);
      try {
        const noteData = await getNote(noteId);
        if (cancelled) return;
        setNote(noteData);
        setBookmarked(noteData.is_bookmarked);

        markRead(noteId).catch(() => {});

        const subject = await getSubject(noteData.subject_id);
        if (cancelled) return;
        setSubjectTitle(subject.title);
        setSiblings(subject.notes);
      } catch (err) {
        console.error('Failed to load note:', err);
        if (!cancelled) setError('Could not load this note.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  // Reset AI tool state when switching notes.
  useEffect(() => {
    stopListening();
    setShowCoach(false);
    setShowFlashcards(false);
    setShowPractice(false);
    setDigest(null);
    setDigestError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // Scroll-based reading progress.
  useEffect(() => {
    function onScroll() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 100;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [note]);

  async function handleBookmarkToggle() {
    try {
      const { is_bookmarked } = await toggleBookmark(note.id);
      setBookmarked(is_bookmarked);
    } catch (err) {
      console.error('Bookmark toggle failed:', err);
    }
  }

  /* ---------------- AI read-aloud (CosyVoice TTS) ---------------- */

  function playUrl(url) {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        resolve();
      });
    });
  }

  function stopListening() {
    playTokenRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setListening(false);
  }

  async function handleListen() {
    if (listening) {
      stopListening();
      return;
    }
    const token = ++playTokenRef.current;
    setListening(true);
    try {
      const chunks = chunkText(stripMarkdown(note.content));
      for (const chunk of chunks) {
        if (playTokenRef.current !== token) return;
        const { audioUrl } = await synthesizeSpeech(chunk);
        if (playTokenRef.current !== token) {
          URL.revokeObjectURL(audioUrl);
          return;
        }
        await playUrl(audioUrl);
      }
    } catch (err) {
      console.error('Read-aloud failed:', err);
    } finally {
      if (playTokenRef.current === token) setListening(false);
    }
  }

  /* ---------------- AI digest (summary + flashcards) ---------------- */

  async function toggleFlashcards() {
    if (!showFlashcards && !digest && !digestLoading) {
      setDigestLoading(true);
      setDigestError(false);
      try {
        setDigest(await getDigest(note.id));
      } catch (err) {
        console.error('Digest fetch failed:', err);
        setDigestError(true);
      } finally {
        setDigestLoading(false);
      }
    }
    setShowFlashcards((s) => !s);
  }

  if (loading) {
    return (
      <div className="note-reader">
        <p className="note-reader__status">Loading note…</p>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="note-reader">
        <p className="note-reader__status">{error ?? 'Note not found.'}</p>
        <Link to="/student/library" className="note-reader__back">← Back to Library</Link>
      </div>
    );
  }

  const currentIndex = siblings.findIndex((s) => s.id === note.id);
  const prevNote = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextNote =
    currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  return (
    <div className={`note-reader ${darkMode ? 'note-reader--dark' : ''}`}>
      {/* Sticky header: toolbar + AI study tools bar */}
      <div className="note-reader__sticky-top">
      {/* Sticky toolbar */}
      <div className="note-reader__toolbar">
        <div className="note-reader__toolbar-left">
          <Link to={`/student/library/subject/${note.subject_id}`} className="note-reader__back">
            ← {subjectTitle || 'Subject'}
          </Link>
          <span className="note-reader__reading-time">{note.reading_minutes} min read</span>
        </div>
        <div className="note-reader__toolbar-right">
          <button
            type="button"
            className="note-reader__tool"
            title="Decrease font size"
            disabled={fontSize <= MIN_FONT}
            onClick={() => setFontSize((s) => Math.max(MIN_FONT, s - 1))}
          >
            A−
          </button>
          <button
            type="button"
            className="note-reader__tool"
            title="Increase font size"
            disabled={fontSize >= MAX_FONT}
            onClick={() => setFontSize((s) => Math.min(MAX_FONT, s + 1))}
          >
            A+
          </button>
          <button
            type="button"
            className={`note-reader__tool ${darkMode ? 'active' : ''}`}
            title="Toggle dark reading mode"
            onClick={() => setDarkMode((d) => !d)}
          >
            {darkMode ? 'Light' : 'Dark'}
          </button>
          <button
            type="button"
            className={`note-reader__tool ${bookmarked ? 'active' : ''}`}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark this note'}
            onClick={handleBookmarkToggle}
          >
            {bookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
        </div>
        <div className="note-reader__progress-track">
          <div className="note-reader__progress-fill" style={{ width: `${scrollProgress}%` }} />
        </div>
      </div>

      {/* AI Study Tools bar */}
      <div className="note-reader__ai-bar">
        <span className="note-reader__ai-label">Study Tools</span>
        <button
          type="button"
          className={`note-reader__ai-btn ${listening ? 'active' : ''}`}
          onClick={handleListen}
        >
          {listening ? 'Stop' : 'Listen'}
        </button>
        <button
          type="button"
          className={`note-reader__ai-btn ${showCoach ? 'active' : ''}`}
          onClick={() => setShowCoach((s) => !s)}
        >
          Study Coach
        </button>
        <button
          type="button"
          className={`note-reader__ai-btn ${showFlashcards ? 'active' : ''}`}
          onClick={toggleFlashcards}
        >
          Flashcards
        </button>
        <button type="button" className="note-reader__ai-btn" onClick={() => setShowPractice(true)}>
          Practice Quiz
        </button>
        <button
          type="button"
          className={`note-reader__ai-btn ${voiceMode ? 'active' : ''}`}
          onClick={() => setVoiceMode((v) => !v)}
        >
          Voice answers: {voiceMode ? 'on' : 'off'}
        </button>
      </div>
      </div>

      {showCoach && <StudyCoach noteId={note.id} noteTitle={note.title} />}

      {showFlashcards && (
        <section className="note-reader__digest">
          <h3>Quick revision digest</h3>
          {digestLoading && <p className="note-reader__digest-status">AI is preparing your digest…</p>}
          {digestError && <p className="note-reader__digest-status">Could not load the digest. Close and reopen to retry.</p>}
          {digest && (
            <>
              <ul className="note-reader__summary-points">
                {digest.summary_points.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
              <div className="note-reader__flashcards">
                {digest.flashcards.map((card, i) => (
                  <Flashcard key={i} card={card} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Article body */}
      <article className="note-reader__article" style={{ fontSize: `${fontSize}px` }}>
        {note.source === 'ai' && (
          <span className="note-reader__badge note-reader__badge--ai">Generated note</span>
        )}
        {note.source === 'photo' && (
          <span className="note-reader__badge note-reader__badge--photo">Photo note</span>
        )}
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
      </article>

      <NoteQuiz noteId={note.id} questions={note.quiz_questions} voiceMode={voiceMode} />

      {showPractice && <PracticeQuizModal noteId={note.id} onClose={() => setShowPractice(false)} />}

      {/* Prev / next navigation */}
      <nav className="note-reader__pager">
        {prevNote ? (
          <Link to={`/student/library/note/${prevNote.id}`} className="note-reader__pager-link">
            <span>← Previous</span>
            <strong>{prevNote.title}</strong>
          </Link>
        ) : (
          <span />
        )}
        {nextNote ? (
          <Link
            to={`/student/library/note/${nextNote.id}`}
            className="note-reader__pager-link note-reader__pager-link--next"
          >
            <span>Next →</span>
            <strong>{nextNote.title}</strong>
          </Link>
        ) : (
          <Link to={`/student/library/subject/${note.subject_id}`} className="note-reader__pager-link note-reader__pager-link--next">
            <span>Subject complete</span>
            <strong>Back to {subjectTitle}</strong>
          </Link>
        )}
      </nav>
    </div>
  );
}

export default NoteReader;
