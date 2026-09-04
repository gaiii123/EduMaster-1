import { useState } from 'react';
import { submitQuiz } from '../api/learning';
import VoiceAnswer from './VoiceAnswer';
import './NoteQuiz.css';

const OPTION_LABELS = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };
const OPTION_KEYS = [1, 2, 3, 4];

/**
 * End-of-note multiple-choice quiz with instant server-graded feedback.
 * When voiceMode is on, each question also offers a spoken-answer
 * widget (SenseVoice transcription + Qwen grading).
 */
function NoteQuiz({ noteId, questions, voiceMode = false }) {
  const [selections, setSelections] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!questions || questions.length === 0) return null;

  const allAnswered = questions.every((q) => selections[q.id]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const answers = questions.map((q) => ({
        question_id: q.id,
        selected_option: selections[q.id],
      }));
      setResult(await submitQuiz(noteId, answers));
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (err) {
      console.error('Quiz submission failed:', err);
      setError('Could not grade your quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetake() {
    setSelections({});
    setResult(null);
  }

  const resultsById = result
    ? Object.fromEntries(result.results.map((r) => [r.question_id, r]))
    : {};

  return (
    <section className="note-quiz">
      <h2>📝 Check your understanding</h2>
      <p className="note-quiz__intro">
        Answer all {questions.length} question{questions.length > 1 ? 's' : ''} to get instant feedback.
      </p>

      {result && (
        <div className={`note-quiz__score ${result.percentage >= 50 ? 'good' : 'low'}`}>
          <strong>
            {result.score} / {result.total} correct ({result.percentage}%)
          </strong>
          <span>
            {result.percentage === 100
              ? 'Perfect! This note is fully absorbed.'
              : result.percentage >= 50
                ? 'Good work — review the misses below.'
                : 'Worth a re-read of the note before your next viva.'}
          </span>
          <button type="button" onClick={handleRetake} className="note-quiz__retake">
            Retake quiz
          </button>
        </div>
      )}

      {error && <p className="note-quiz__error">{error}</p>}

      {questions.map((question, index) => {
        const graded = resultsById[question.id];
        return (
          <div key={question.id} className="note-quiz__question">
            <h3>
              {index + 1}. {question.question}
            </h3>
            <div className="note-quiz__options">
              {OPTION_KEYS.map((key) => {
                const optionText = question[`option_${OPTION_LABELS[key].toLowerCase()}`];
                const selected = selections[question.id] === key;
                let stateClass = '';
                if (graded) {
                  if (key === graded.correct_option) stateClass = 'correct';
                  else if (selected) stateClass = 'wrong';
                } else if (selected) {
                  stateClass = 'selected';
                }
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!!result}
                    className={`note-quiz__option ${stateClass}`}
                    onClick={() => setSelections({ ...selections, [question.id]: key })}
                  >
                    <span className="note-quiz__option-label">{OPTION_LABELS[key]}</span>
                    <span>{optionText}</span>
                    {graded && key === graded.correct_option && <span className="note-quiz__mark">✓</span>}
                    {graded && selected && key !== graded.correct_option && (
                      <span className="note-quiz__mark">✗</span>
                    )}
                  </button>
                );
              })}
            </div>
            {voiceMode && <VoiceAnswer question={question.question} />}
          </div>
        );
      })}

      {!result && (
        <button
          type="button"
          className="note-quiz__submit"
          disabled={!allAnswered || submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Grading…' : allAnswered ? 'Submit answers' : 'Answer all questions to submit'}
        </button>
      )}
    </section>
  );
}

export default NoteQuiz;
