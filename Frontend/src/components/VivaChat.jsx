import { useState, useRef, useEffect } from 'react';
import { evaluateStudent } from '../api/evaluation';
import { listStudents } from '../api/students';
import { synthesizeSpeech } from '../api/multimodal';
import MasteryCard from './MasteryCard';
import PlacementCard from './PlacementCard';
import './VivaChat.css';

const STAGES = ['Baseline Viva', 'Formative Check-in', 'Capstone Defense'];

const STAGE_INTRO = {
  'Baseline Viva':
    "Hello and a warm welcome to EduMaster! I am your senior AI examiner today. " +
    "Don't worry if you have little or no background in IT—we designed this interview to start with very simple everyday concepts and help you advance step by step. Are you ready to begin?",
  'Formative Check-in':
    "Hello and welcome back to your Formative Check-in! " +
    "We will start with simple questions about what you've learned so far and build up from there. Are you ready to start?",
  'Capstone Defense':
    "Hello and welcome to your Capstone Defense! Congratulations on your learning journey. " +
    "We will start with a high-level overview of your project and walk through it step by step. Are you ready to begin?",
};

/**
 * Conversational AI viva with student/stage selection, conversational context,
 * live mastery scoring and the resulting placement decision.
 */
function VivaChat() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [stage, setStage] = useState(STAGES[0]);

  const [messages, setMessages] = useState([
    { role: 'assistant', content: STAGE_INTRO[STAGES[0]] },
  ]);
  const [scores, setScores] = useState(null);
  const [placement, setPlacement] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const bottomRef = useRef(null);
  const audioPlayerRef = useRef(null);

  async function handleSpeak(text, idx) {
    if (speakingIndex === idx) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setSpeakingIndex(null);
      return;
    }
    try {
      setSpeakingIndex(idx);
      const cleanText = text.replace(/^[🔎⚠️•\s]+/, '').replace(/\*\*/g, '').trim();
      const { audioUrl } = await synthesizeSpeech(cleanText, 'longxiaochun');
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setSpeakingIndex(null);
      audio.onerror = () => setSpeakingIndex(null);
      await audio.play();
    } catch {
      setSpeakingIndex(null);
    }
  }

  // Load the student roster for the selector.
  useEffect(() => {
    listStudents().then(setStudents).catch(() => setStudents([]));
  }, []);

  // Auto-scroll to latest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Reset the session when the student or stage changes.
  function resetSession(nextStudentId = studentId, nextStage = stage) {
    setMessages([{ role: 'assistant', content: STAGE_INTRO[nextStage] }]);
    setScores(null);
    setPlacement(null);
    const name = students.find((s) => String(s.id) === String(nextStudentId))?.name;
    if (name) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Evaluating student: ${name}. Answers will be saved to their record.` },
      ]);
    }
  }

  function handleStudentChange(e) {
    const id = e.target.value;
    setStudentId(id);
    resetSession(id, stage);
  }

  function handleStageChange(e) {
    const next = e.target.value;
    setStage(next);
    resetSession(studentId, next);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const transcript = [...messages, userMsg];
    setMessages(transcript);
    setInput('');
    setLoading(true);

    try {
      const res = await evaluateStudent({
        message: text,
        studentId: studentId ? Number(studentId) : null,
        stage,
        // Last 10 turns give the AI conversational context.
        history: transcript.slice(-10).map(({ role, content }) => ({ role, content })),
      });

      setMessages((prev) => {
        const next = [...prev, { role: 'assistant', content: res.evaluation }];
        if (res.misconceptions?.length) {
          next.push({
            role: 'assistant',
            content: `💡 Learning tip:\n• ${res.misconceptions.join('\n• ')}`,
          });
        }
        if (res.follow_up_question) {
          next.push({ role: 'assistant', content: `❓ Next Question:\n${res.follow_up_question}` });
        }
        return next;
      });
      setScores(res.scores);
      if (res.placement) setPlacement(res.placement);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Sorry, I could not reach the evaluation service. Please check that the backend is running and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="viva-chat-layout">
      {/* ------------ Chat pane ------------ */}
      <div className="viva-chat">
        <div className="viva-chat__header">
          <h2>AI Viva Session</h2>
          <div className="viva-chat__controls">
            <select value={studentId} onChange={handleStudentChange}>
              <option value="">— Guest (not saved) —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select value={stage} onChange={handleStageChange}>
              {STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="viva-chat__messages">
          {messages.map((msg, i) => (
            <div key={i} className={`viva-chat__bubble viva-chat__bubble--${msg.role}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}>
                <div style={{ flex: 1 }}>{msg.content}</div>
                {msg.role === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => handleSpeak(msg.content, i)}
                    title="Speak with Alibaba CosyVoice"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      opacity: speakingIndex === i ? 1 : 0.6,
                      color: speakingIndex === i ? '#ff6a00' : 'inherit',
                      padding: '2px',
                    }}
                  >
                    {speakingIndex === i ? '🔊...' : '🔊'}
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="viva-chat__bubble viva-chat__bubble--assistant viva-chat__bubble--typing">
              Evaluating<span className="dots">...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="viva-chat__input">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer here…"
            disabled={loading}
          />
          <button onClick={handleSend} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
      </div>

      {/* ------------ Session panel ------------ */}
      <aside className="viva-panel">
        <h3 className="viva-panel__title">Live Session Panel</h3>

        {scores ? (
          <div className="viva-panel__scores">
            <MasteryCard label="Logic & Syntax" score={scores.mastery_logic_and_syntax} />
            <MasteryCard label="API Architecture" score={scores.mastery_api_architecture} />
            <MasteryCard label="Frontend State" score={scores.mastery_frontend_state} />
            <MasteryCard label="Database Integration" score={scores.mastery_database_integration} />
          </div>
        ) : (
          <p className="viva-panel__hint">
            Answer the examiner's questions — mastery scores appear here in real time.
          </p>
        )}

        <div className="viva-panel__placement">
          <h4>Placement Decision</h4>
          <PlacementCard placement={placement} compact />
        </div>

        {!studentId && (
          <p className="viva-panel__hint">
            Select a student above to save this viva to their record and update their placement.
          </p>
        )}
      </aside>
    </div>
  );
}

export default VivaChat;
