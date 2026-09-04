import { useState, useEffect, useRef } from 'react';
import { sendWeeklyVivaTurn, getMyWeeklyVivaResult } from '../api/diagnostic';
import './WeeklyVivaModal.css';

export default function WeeklyVivaModal({ item, onClose, onCompleted }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [turnCount, setTurnCount] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState('');

  const chatEndRef = useRef(null);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        // Check if student already completed this weekly viva
        const existing = await getMyWeeklyVivaResult(item.id);
        if (existing) {
          setEvaluation(existing);
          setIsCompleted(true);
          if (existing.transcript && existing.transcript.length > 0) {
            setMessages(existing.transcript);
          }
        } else {
          // Initialize first greeting from AI Examiner
          setMessages([
            {
              role: 'assistant',
              content: `Welcome to your Post-Lecture Weekly Knowledge Check for "${item.title}".\n\nThis viva assesses what you actually learned and retained from this week's lecture. It contributes 10% to your final course grade.\n\nTo begin: What was the most critical concept or formula introduced in this week's lecture, and how did the lecturer explain its purpose?`,
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to init weekly viva:', err);
        setError('Could not initialize weekly viva session. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [item.id, item.title]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, submitting]);

  async function handleSend(finishEarly = false) {
    if (!inputText.trim() && !finishEarly) return;

    const userMsg = inputText.trim() || 'I am ready to finalize my post-lecture viva evaluation.';
    const newHistory = [...messages, { role: 'user', content: userMsg }];
    setMessages(newHistory);
    setInputText('');
    setSubmitting(true);
    setError('');

    try {
      // Build history for backend API (filter out welcome greeting if necessary or pass all)
      const payloadHistory = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await sendWeeklyVivaTurn(item.id, {
        message: userMsg,
        history: payloadHistory,
        finish_early: finishEarly,
      });

      if (res.is_completed) {
        setIsCompleted(true);
        setEvaluation(res.evaluation);
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: res.feedback || 'Weekly viva complete! Your grade has been calculated.' },
        ]);
        if (onCompleted) onCompleted(res.evaluation);
      } else {
        setTurnCount(res.turn_count || turnCount + 1);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `${res.feedback}\n\n**Next Question:** ${res.next_question}`,
          },
        ]);
      }
    } catch (err) {
      console.error('Weekly viva turn error:', err);
      setError(err.response?.data?.detail || 'Failed to submit response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const weightScore = evaluation ? ((evaluation.score / 100) * 10).toFixed(1) : 0;

  return (
    <div className="weekly-viva-backdrop" onClick={onClose}>
      <div className="weekly-viva-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="weekly-viva-header">
          <div className="header-badge-row">
            <span className="viva-pill-badge">POST-LECTURE VIVA</span>
            <span className="viva-weight-badge">Graded • 10% Final Grade</span>
          </div>
          <h2>{item.title}</h2>
          <p className="viva-subtitle">
            Evaluates your lecture retention & understanding before next week begins.
          </p>
          <button className="viva-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Loading / Error states */}
        {loading && (
          <div className="viva-loading-state">
            <div className="viva-spinner"></div>
            <p>Connecting to University Examiner...</p>
          </div>
        )}

        {error && <div className="viva-error-banner">{error}</div>}

        {!loading && (
          <>
            {/* Conversation Flow */}
            <div className="weekly-viva-chat-area">
              <div className="viva-progress-bar-wrap">
                <div className="progress-label">
                  <span>Knowledge Check Progress</span>
                  <span>{isCompleted ? 'Completed & Graded' : `Turn ${turnCount} of 3`}</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: isCompleted ? '100%' : `${(turnCount / 3) * 100}%` }}
                  />
                </div>
              </div>

              <div className="messages-list">
                {messages.map((m, idx) => (
                  <div key={idx} className={`message-bubble ${m.role}`}>
                    <div className="msg-avatar">
                      {m.role === 'assistant' ? 'E' : 'S'}
                    </div>
                    <div className="msg-content">
                      <div className="msg-sender-name">
                        {m.role === 'assistant' ? 'Examiner' : 'You'}
                      </div>
                      <div className="msg-text">{m.content}</div>
                    </div>
                  </div>
                ))}
                {submitting && (
                  <div className="message-bubble assistant thinking">
                    <div className="msg-avatar">E</div>
                    <div className="msg-content">
                      <div className="thinking-dots">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Evaluation Result Summary Card (Shown when completed) */}
            {isCompleted && evaluation && (
              <div className="viva-evaluation-card">
                <div className="eval-score-header">
                  <div className="score-circle">
                    <span className="score-num">{evaluation.score}%</span>
                    <span className="score-lbl">Mastery</span>
                  </div>
                  <div className="score-meta">
                    <div className="score-level-badge">{evaluation.knowledge_level}</div>
                    <h3>Weekly Knowledge Retention Score</h3>
                    <div className="weight-awarded">
                      Contributes <strong>{weightScore} / 10.0 pts</strong> to your Final Course Grade
                    </div>
                  </div>
                </div>

                <div className="eval-topics-grid">
                  <div className="topic-col mastered">
                    <h4>Lecture Concepts Mastered</h4>
                    <ul>
                      {evaluation.mastered_topics?.length > 0 ? (
                        evaluation.mastered_topics.map((t, i) => <li key={i}>{t}</li>)
                      ) : (
                        <li>General lecture concepts retained</li>
                      )}
                    </ul>
                  </div>

                  <div className="topic-col gaps">
                    <h4>Concepts to Review for Next Week</h4>
                    <ul>
                      {evaluation.retained_gaps?.length > 0 ? (
                        evaluation.retained_gaps.map((g, i) => <li key={i}>{g}</li>)
                      ) : (
                        <li>No critical knowledge gaps remaining!</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="eval-feedback-box">
                  <strong>Examiner's Concluding Evaluation:</strong>
                  <p>{evaluation.feedback}</p>
                </div>
              </div>
            )}

            {/* Input Controls */}
            {!isCompleted ? (
              <div className="weekly-viva-input-bar">
                <textarea
                  rows={2}
                  placeholder="Explain your understanding from this week's lecture... (Press Enter to send)"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={submitting}
                />
                <div className="viva-actions">
                  {turnCount >= 2 && (
                    <button
                      type="button"
                      className="btn-finish-early"
                      onClick={() => handleSend(true)}
                      disabled={submitting}
                    >
                      Finish & Grade
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-send-turn"
                    onClick={() => handleSend(false)}
                    disabled={submitting || !inputText.trim()}
                  >
                    {submitting ? 'Submitting...' : 'Send Answer →'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="weekly-viva-footer-actions">
                <button className="btn-close-viva" onClick={onClose}>
                  Done • Return to Module
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
