import { useState, useEffect, useRef } from 'react';
import { sendAssignmentDefenseTurn } from '../api/diagnostic';
import './AssignmentDefenseModal.css';

export default function AssignmentDefenseModal({ submission, item, onClose, onDefended }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [turnCount, setTurnCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [defenseResult, setDefenseResult] = useState(null);
  const [error, setError] = useState('');

  const chatEndRef = useRef(null);

  useEffect(() => {
    // If submission already defended, display past result and transcript
    if (submission?.defense_score !== null && submission?.defense_score !== undefined) {
      setIsCompleted(true);
      setDefenseResult({
        defense_score: submission.defense_score,
        defense_feedback: submission.defense_feedback,
      });
      try {
        const transcript = JSON.parse(submission.defense_transcript_json || '[]');
        if (transcript.length > 0) {
          setMessages(transcript);
        } else {
          setMessages([
            {
              role: 'assistant',
              content: `Defense completed. Awarded Score: ${submission.defense_score}%\n\nFeedback: ${submission.defense_feedback}`,
            },
          ]);
        }
      } catch {
        setMessages([]);
      }
    } else {
      // First prompt from AI defense examiner
      const snippet = submission.submission_text
        ? submission.submission_text.slice(0, 200)
        : `file "${submission.file_name}"`;

      setMessages([
        {
          role: 'assistant',
          content: `Welcome to your Assignment Defense for "${item.title}".\n\nI have reviewed your submitted work (${snippet}). This defense evaluates your authentic understanding of your solution and directly contributes 15% to your final course grade.\n\nTo begin: Can you summarize the core methodology you implemented in this assignment and explain why you chose this design?`,
        },
      ]);
    }
  }, [submission, item]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, submitting]);

  async function handleSend(finishEarly = false) {
    if (!inputText.trim() && !finishEarly) return;

    const userMsg = inputText.trim() || 'I have completed my defense explanations.';
    const newHistory = [...messages, { role: 'user', content: userMsg }];
    setMessages(newHistory);
    setInputText('');
    setSubmitting(true);
    setError('');

    try {
      const payloadHistory = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await sendAssignmentDefenseTurn(submission.id, {
        message: userMsg,
        history: payloadHistory,
        finish_early: finishEarly,
      });

      if (res.is_completed) {
        setIsCompleted(true);
        setDefenseResult({
          defense_score: res.defense_score,
          defense_feedback: res.defense_feedback,
        });
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `${res.feedback}\n\n**Defense Concluded!** Score: ${res.defense_score}%\n${res.defense_feedback}`,
          },
        ]);
        if (onDefended) {
          onDefended({
            ...submission,
            defense_score: res.defense_score,
            defense_feedback: res.defense_feedback,
          });
        }
      } else {
        setTurnCount(res.turn_count || turnCount + 1);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `${res.feedback}\n\n**Follow-up Question:** ${res.next_question}`,
          },
        ]);
      }
    } catch (err) {
      console.error('Assignment defense error:', err);
      setError(err.response?.data?.detail || 'Failed to submit defense answer. Please try again.');
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

  return (
    <div className="defense-viva-backdrop" onClick={onClose}>
      <div className="defense-viva-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="defense-viva-header">
          <div className="header-badge-row">
            <span className="defense-pill-badge">VIVA DEFENSE</span>
            <span className="defense-weight-badge">Graded • 15% Final Grade</span>
          </div>
          <h2>Defend Assignment: {item.title}</h2>
          <p className="defense-subtitle">
            Probes your submitted implementation, algorithmic reasoning, and code ownership.
          </p>
          <button className="defense-close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="defense-error-banner">{error}</div>}

        {/* Content Area */}
        <div className="defense-viva-chat-area">
          <div className="defense-submission-preview">
            <div className="preview-label">Your Submitted Content:</div>
            <div className="preview-text">
              {submission.submission_text || `Uploaded File: ${submission.file_name}`}
            </div>
          </div>

          <div className="defense-messages-list">
            {messages.map((m, idx) => (
              <div key={idx} className={`def-msg-bubble ${m.role}`}>
                <div className="def-avatar">
                  {m.role === 'assistant' ? 'E' : 'S'}
                </div>
                <div className="def-content">
                  <div className="def-sender">{m.role === 'assistant' ? 'Defense Examiner' : 'You'}</div>
                  <div className="def-text">{m.content}</div>
                </div>
              </div>
            ))}
            {submitting && (
              <div className="def-msg-bubble assistant thinking">
                <div className="def-avatar">E</div>
                <div className="def-content">
                  <div className="defense-thinking-dots">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Completed Defense Result Box */}
        {isCompleted && defenseResult && (
          <div className="defense-summary-card">
            <div className="defense-score-badge">
              <span className="score-val">{defenseResult.defense_score}%</span>
              <span className="score-txt">Defense Mark</span>
            </div>
            <div className="defense-meta">
              <h4>Academic Defense Approved</h4>
              <p>{defenseResult.defense_feedback}</p>
            </div>
          </div>
        )}

        {/* Input Bar */}
        {!isCompleted ? (
          <div className="defense-viva-input-bar">
            <textarea
              rows={2}
              placeholder="Defend your code choices and answers... (Press Enter to submit)"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={submitting}
            />
            <div className="defense-actions">
              {turnCount >= 2 && (
                <button
                  type="button"
                  className="btn-def-finish"
                  onClick={() => handleSend(true)}
                  disabled={submitting}
                >
                  Conclude Defense
                </button>
              )}
              <button
                type="button"
                className="btn-def-send"
                onClick={() => handleSend(false)}
                disabled={submitting || !inputText.trim()}
              >
                {submitting ? 'Submitting...' : 'Defend Answer →'}
              </button>
            </div>
          </div>
        ) : (
          <div className="defense-footer-actions">
            <button className="btn-def-close" onClick={onClose}>
              Done • Return to Assignment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
