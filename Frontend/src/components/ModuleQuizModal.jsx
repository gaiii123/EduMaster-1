import { useState } from 'react';
import { submitQuiz } from '../api/modules';
import './ModuleModals.css';

export default function ModuleQuizModal({ item, onClose, onQuizCompleted, isAdmin }) {
  const questions = item.quiz_questions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  function selectOption(questionId, optIndex) {
    if (result) return;
    setAnswers({ ...answers, [questionId]: optIndex });
  }

  async function handleSubmit() {
    if (answeredCount < questions.length) {
      if (!window.confirm(`You have answered ${answeredCount} of ${questions.length} questions. Submit anyway?`)) {
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await submitQuiz(item.id, answers);
      setResult(res);
      if (onQuizCompleted) {
        onQuizCompleted(res);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span>❓ {item.title}</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#dc2626', borderRadius: 8, fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {/* Results Screen */}
          {result ? (
            <div>
              <div className="quiz-score-banner">
                <div className="quiz-score-number">{result.percentage}%</div>
                <div className="quiz-score-label">
                  You scored {result.score} out of {result.total_questions} questions correct!
                </div>
              </div>

              <h3 style={{ marginBottom: '1rem', color: '#0f172a' }}>Review Answers & Explanations</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {result.questions.map((rq, idx) => (
                  <div key={rq.question_id} className={`quiz-result-card ${rq.is_correct ? 'correct' : 'incorrect'}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>Question {idx + 1}</span>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: rq.is_correct ? '#16a34a' : '#dc2626',
                        }}
                      >
                        {rq.is_correct ? '✅ Correct (+1 pt)' : '❌ Incorrect (0 pts)'}
                      </span>
                    </div>
                    <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.75rem' }}>{rq.question}</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem' }}>
                      {[rq.option_a, rq.option_b, rq.option_c, rq.option_d].map((opt, oIdx) => {
                        const optNum = oIdx + 1;
                        const isChosen = rq.selected_option === optNum;
                        const isCorrect = rq.correct_option === optNum;
                        let bg = '#ffffff';
                        let border = '#e2e8f0';
                        if (isCorrect) {
                          bg = '#dcfce7';
                          border = '#86efac';
                        } else if (isChosen && !isCorrect) {
                          bg = '#fee2e2';
                          border = '#fca5a5';
                        }
                        return (
                          <div
                            key={oIdx}
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderRadius: 6,
                              background: bg,
                              border: `1px solid ${border}`,
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>
                              <strong>{['A', 'B', 'C', 'D'][oIdx]}:</strong> {opt}
                            </span>
                            {isCorrect && <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Correct</span>}
                            {isChosen && !isCorrect && <span style={{ color: '#dc2626', fontWeight: 600 }}>Your choice</span>}
                          </div>
                        );
                      })}
                    </div>

                    {rq.explanation && (
                      <div className="quiz-explanation-box">
                        <strong>💡 Explanation:</strong> {rq.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : questions.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
              This quiz does not have any questions yet.
            </p>
          ) : (
            /* Quiz Active Player */
            <div>
              {/* Top Navigation Dots */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
                  Question {currentIndex + 1} of {questions.length} ({answeredCount} answered)
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0284c7' }}>
                  ⏱️ {item.time_limit_minutes || 15} min test
                </span>
              </div>

              <div className="quiz-nav-dots">
                {questions.map((q, idx) => (
                  <button
                    key={q.id || idx}
                    type="button"
                    className={`quiz-dot ${currentIndex === idx ? 'active' : ''} ${
                      answers[q.id] ? 'answered' : ''
                    }`}
                    onClick={() => setCurrentIndex(idx)}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              {currentQ && (
                <div className="quiz-card">
                  <div className="quiz-question-text">
                    <span style={{ color: '#0284c7', marginRight: '0.5rem' }}>Q{currentIndex + 1}.</span>
                    {currentQ.question}
                  </div>

                  <div className="quiz-options-list">
                    {[
                      { key: 1, label: 'A', text: currentQ.option_a },
                      { key: 2, label: 'B', text: currentQ.option_b },
                      { key: 3, label: 'C', text: currentQ.option_c },
                      { key: 4, label: 'D', text: currentQ.option_d },
                    ]
                      .filter((o) => o.text)
                      .map((opt) => {
                        const isSelected = answers[currentQ.id] === opt.key;
                        return (
                          <label
                            key={opt.key}
                            className={`quiz-option-label ${isSelected ? 'selected' : ''}`}
                            onClick={() => selectOption(currentQ.id, opt.key)}
                          >
                            <input
                              type="radio"
                              name={`question-${currentQ.id}`}
                              checked={isSelected}
                              onChange={() => selectOption(currentQ.id, opt.key)}
                              style={{ display: 'none' }}
                            />
                            <span
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: '50%',
                                border: isSelected ? '2px solid #0284c7' : '2px solid #cbd5e1',
                                background: isSelected ? '#0284c7' : '#ffffff',
                                color: isSelected ? '#ffffff' : '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                              }}
                            >
                              {opt.label}
                            </span>
                            <span style={{ flex: 1 }}>{opt.text}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {result ? (
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Close Results
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((c) => Math.max(0, c - 1))}
              >
                ← Previous
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCurrentIndex((c) => Math.min(questions.length - 1, c + 1))}
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Submitting...' : 'Submit Quiz ✨'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
