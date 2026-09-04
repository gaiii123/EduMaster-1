import { useState, useEffect, useRef } from 'react';
import { sendDiagnosticTurn, getMyDiagnosticResult } from '../api/diagnostic';
import './PreWeekVivaModal.css';

export default function PreWeekVivaModal({ item, onClose, onCompleted }) {
  const [loading, setLoading] = useState(false);
  const [initialChecking, setInitialChecking] = useState(true);
  const [evaluation, setEvaluation] = useState(null);

  // Chat conversation state
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [turnCount, setTurnCount] = useState(0);
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    checkExistingResult();
  }, [item.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function checkExistingResult() {
    try {
      setInitialChecking(true);
      const res = await getMyDiagnosticResult(item.id);
      if (res && res.id) {
        setEvaluation(res);
      } else {
        startNewSession();
      }
    } catch (err) {
      startNewSession();
    } finally {
      setInitialChecking(false);
    }
  }

  function startNewSession() {
    const initialGreeting =
      item.content && item.content.startsWith('Topics:')
        ? `Hello! Welcome to your pre-week knowledge check for this section (${item.content}). Remember, this is completely formative and NOT graded. It helps your lecturer identify your strengths and where to focus during this week's classes! To begin: How would you describe the foundational concepts of this topic in your own words?`
        : `Hello! Welcome to your pre-week knowledge check. This is formative and NOT graded—it simply helps your lecturer identify what you already know and where to give extra attention during this week's lecture! What do you currently know about this topic?`;

    setMessages([
      {
        role: 'assistant',
        content: initialGreeting,
        type: 'question',
      },
    ]);
    setTurnCount(1);
    speakIfEnabled(initialGreeting);
  }

  function speakIfEnabled(text) {
    if (!voiceEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*_#`$]/g, '');
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  function toggleSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your response.');
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setCurrentInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }

  async function handleSendTurn(finishEarly = false) {
    const text = currentInput.trim();
    if (!text && !finishEarly) return;

    const userTurn = { role: 'user', content: text || 'I am ready to complete the assessment.' };
    const updatedHistory = [...messages, userTurn];
    setMessages(updatedHistory);
    setCurrentInput('');
    setLoading(true);

    try {
      const payload = {
        message: text || 'Complete assessment',
        history: updatedHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        finish_early: finishEarly,
      };

      const res = await sendDiagnosticTurn(item.id, payload);

      if (res.is_completed && res.evaluation) {
        setEvaluation(res.evaluation);
        speakIfEnabled(res.feedback);
        if (onCompleted) onCompleted(res.evaluation);
      } else {
        const nextTurns = [
          ...updatedHistory,
          { role: 'assistant', content: res.feedback, type: 'feedback' },
        ];
        if (res.next_question) {
          nextTurns.push({ role: 'assistant', content: res.next_question, type: 'question' });
          speakIfEnabled(`${res.feedback} ${res.next_question}`);
        } else {
          speakIfEnabled(res.feedback);
        }
        setMessages(nextTurns);
        setTurnCount(res.turn_count + 1);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection issue. Please try submitting again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function getReadinessClass(level) {
    switch (level?.toLowerCase()) {
      case 'proficient':
        return 'diag-readiness--proficient';
      case 'needs guidance':
        return 'diag-readiness--needs-guidance';
      default:
        return 'diag-readiness--developing';
    }
  }

  return (
    <div className="diag-modal-backdrop" onClick={onClose}>
      <div className="diag-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="diag-modal-header">
          <div>
            <div className="diag-modal-title">
              <span>{item.title}</span>
              <span className="diag-badge-formative">Formative • Not Graded</span>
            </div>
            <div className="diag-modal-subtitle">
              Pre-week diagnostic check evaluated to identify your strengths and knowledge gaps for your lecturer.
            </div>
          </div>
          <button type="button" className="diag-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        {initialChecking ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            Checking assessment state…
          </div>
        ) : evaluation ? (
          /* Completed Result Summary View */
          <div className="diag-modal-body">
            <div className="diag-result-card">
              <div className="diag-result-header">
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: '#0f172a', marginBottom: '0.25rem' }}>
                    Diagnostic Evaluation Complete
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
                    Completed on {new Date(evaluation.completed_at).toLocaleDateString()}
                  </p>
                </div>
                <div className={`diag-readiness-badge ${getReadinessClass(evaluation.knowledge_level)}`}>
                  <span>Readiness: {evaluation.readiness_score}%</span>
                  <span>•</span>
                  <span>{evaluation.knowledge_level}</span>
                </div>
              </div>

              {/* Strong Areas */}
              <div className="diag-pills-section">
                <div className="diag-pills-title">
                  <span>Concepts You Understand Well:</span>
                </div>
                <div className="diag-pills-grid">
                  {evaluation.strong_areas?.map((sa, i) => (
                    <span key={i} className="diag-pill-strong">
                      {sa}
                    </span>
                  ))}
                </div>
              </div>

              {/* Weak Areas */}
              <div className="diag-pills-section">
                <div className="diag-pills-title">
                  <span>Topics Your Lecturer Will Emphasize in Class:</span>
                </div>
                <div className="diag-pills-grid">
                  {evaluation.weak_areas?.map((wa, i) => (
                    <span key={i} className="diag-pill-weak">
                      {wa}
                    </span>
                  ))}
                </div>
              </div>

              {/* Diagnostic Notes */}
              {evaluation.diagnostic_summary && (
                <div className="diag-summary-box">
                  <strong>Evaluation Summary: </strong>
                  {evaluation.diagnostic_summary}
                </div>
              )}

              {/* Lecturer Notice Reassurance */}
              <div className="diag-lecturer-notice">
                <div>
                  <strong>Shared with Your Lecturer: </strong>
                  Your diagnostic profile has been aggregated into the lecturer's weekly prep dashboard so they know exactly which concepts need more visual demonstrations and worked examples in class.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEvaluation(null);
                    startNewSession();
                  }}
                >
                  Retake Diagnostic Check
                </button>
                <button type="button" className="btn btn-primary" onClick={onClose}>
                  Done & Return to Course
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Active Conversational AI Viva */
          <>
            <div className="diag-modal-body">
              <div className="diag-progress-bar">
                <span>Diagnostic Turn {Math.min(turnCount, 3)} of 3</span>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input
                      type="checkbox"
                      checked={voiceEnabled}
                      onChange={(e) => setVoiceEnabled(e.target.checked)}
                    />
                    <span>Read questions aloud</span>
                  </label>
                </div>
              </div>

              {/* Conversation bubbles */}
              <div className="diag-chat-stack">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`diag-bubble ${m.role === 'user' ? 'diag-bubble--user' : 'diag-bubble--ai'}`}
                  >
                    <div className={`diag-bubble-avatar ${m.role === 'user' ? 'diag-bubble-avatar--user' : 'diag-bubble-avatar--ai'}`}>
                      {m.role === 'user' ? 'S' : 'E'}
                    </div>
                    <div className="diag-bubble-content">
                      {m.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="diag-bubble diag-bubble--ai">
                    <div className="diag-bubble-avatar diag-bubble-avatar--ai">E</div>
                    <div className="diag-bubble-content" style={{ color: '#64748b' }}>
                      Examiner is analyzing your answer…
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input Footer */}
            <div className="diag-input-area">
              <textarea
                className="diag-textarea"
                placeholder="Type your explanation or conceptual understanding here… (or click Speak)"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSendTurn();
                  }
                }}
                disabled={loading}
              />

              <div className="diag-input-actions">
                <button
                  type="button"
                  className="btn-diag-finish-early"
                  onClick={() => handleSendTurn(true)}
                  disabled={loading}
                >
                  Finish & Get Evaluation Now →
                </button>

                <div className="diag-submit-group">
                  <button
                    type="button"
                    className={`btn-diag-voice ${listening ? 'listening' : ''}`}
                    onClick={toggleSpeechRecognition}
                    title="Speak answer using microphone"
                    disabled={loading}
                  >
                    <span>{listening ? 'Listening…' : 'Speak'}</span>
                  </button>

                  <button
                    type="button"
                    className="btn-diag-send"
                    onClick={() => handleSendTurn(false)}
                    disabled={loading || !currentInput.trim()}
                  >
                    {loading ? 'Evaluating…' : 'Send Answer →'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
