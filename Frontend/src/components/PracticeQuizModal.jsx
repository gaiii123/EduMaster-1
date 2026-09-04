import { useEffect, useState } from 'react';
import { generatePractice } from '../api/learning';
import './NoteQuiz.css';
import './PracticeQuizModal.css';

const OPTION_LABELS = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };
const OPTION_KEYS = [1, 2, 3, 4];

/**
 * Ephemeral AI practice quiz modal — fresh MCQs from the AI practice
 * endpoint, graded instantly and locally against correct_option.
 * Reuses the NoteQuiz option styling.
 */
function PracticeQuizModal({ noteId, onClose }) {
  const [questions, setQuestions] = useState([]);
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selections, setSelections] = useState({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await generatePractice(noteId, 5);
        if (!cancelled) {
          setQuestions(res.questions);
          setModel(res.model || '');
        }
      } catch (err) {
        console.error('Practice quiz generation failed:', err);
        if (!cancelled) setError('Could not generate practice questions. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const allAnswered = questions.length > 0 && questions.every((_, i) => selections[i]);
  const score = questions.filter((q, i) => selections[i] === q.correct_option).length;
  const percentage = questions.length ? Math.round((score / questions.length) * 100) : 0;

  function handleRetake() {
    setSelections({});
    setSubmitted(false);
  }

  return (
    <div className="practice-modal__overlay" onClick={onClose}>
      <div className="practice-modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="practice-modal__header">
          <h2>🎯 AI Practice Quiz</h2>
          <button type="button" className="practice-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        {loading && <p className="practice-modal__status">Generating fresh questions with AI…</p>}
        {error && <p className="practice-modal__status practice-modal__status--error">{error}</p>}

        {!loading && !error && (
          <>
            {submitted && (
              <div className={`note-quiz__score ${percentage >= 50 ? 'good' : 'low'}`}>
                <strong>
                  {score} / {questions.length} correct ({percentage}%)
                </strong>
                <span>
                  {percentage === 100
                    ? 'Flawless — try another set or move to the next note.'
                    : percentage >= 50
                      ? 'Solid — review the misses and go again.'
                      : 'Re-read the note, then retake for a better score.'}
                </span>
                <button type="button" onClick={handleRetake} className="note-quiz__retake">
                  Retake
                </button>
              </div>
            )}

            {questions.map((question, index) => (
              <div key={index} className="note-quiz__question">
                <h3>
                  {index + 1}. {question.question}
                </h3>
                <div className="note-quiz__options">
                  {OPTION_KEYS.map((key) => {
                    const selected = selections[index] === key;
                    let stateClass = '';
                    if (submitted) {
                      if (key === question.correct_option) stateClass = 'correct';
                      else if (selected) stateClass = 'wrong';
                    } else if (selected) {
                      stateClass = 'selected';
                    }
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={submitted}
                        className={`note-quiz__option ${stateClass}`}
                        onClick={() => setSelections({ ...selections, [index]: key })}
                      >
                        <span className="note-quiz__option-label">{OPTION_LABELS[key]}</span>
                        <span>{question[`option_${OPTION_LABELS[key].toLowerCase()}`]}</span>
                        {submitted && key === question.correct_option && (
                          <span className="note-quiz__mark">✓</span>
                        )}
                        {submitted && selected && key !== question.correct_option && (
                          <span className="note-quiz__mark">✗</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {!submitted && (
              <button
                type="button"
                className="note-quiz__submit"
                disabled={!allAnswered}
                onClick={() => setSubmitted(true)}
              >
                {allAnswered ? 'Check answers' : 'Answer all questions to check'}
              </button>
            )}

            {model && <p className="practice-modal__model">Generated by {model}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default PracticeQuizModal;
