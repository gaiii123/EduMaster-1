import { useState } from 'react';
import { coachAsk } from '../api/learning';
import './StudyCoach.css';

/**
 * AI Study Coach drawer — Socratic chat grounded in the current note.
 * Keeps a local transcript and sends the last 6 turns as history.
 */
function StudyCoach({ noteId, noteTitle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [followUp, setFollowUp] = useState(null);
  const [error, setError] = useState(null);

  async function ask(rawQuestion) {
    const question = rawQuestion.trim();
    if (!question || loading) return;

    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setFollowUp(null);
    setError(null);
    setLoading(true);
    try {
      const res = await coachAsk(noteId, question, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer }]);
      setFollowUp(res.follow_up || null);
    } catch (err) {
      console.error('Coach request failed:', err);
      setError('The coach could not answer right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      ask(input);
    }
  }

  return (
    <section className="study-coach">
      <div className="study-coach__header">
        <h3>💬 AI Study Coach</h3>
        <span>Ask anything about “{noteTitle}”</span>
      </div>

      <div className="study-coach__transcript">
        {messages.length === 0 && (
          <p className="study-coach__empty">
            No questions yet. Ask the coach to explain a concept, give an example, or quiz you.
          </p>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`study-coach__bubble study-coach__bubble--${message.role}`}>
            {message.content}
          </div>
        ))}
        {loading && <div className="study-coach__bubble study-coach__bubble--assistant">Thinking…</div>}
      </div>

      {error && <p className="study-coach__error">{error}</p>}

      {followUp && !loading && (
        <button type="button" className="study-coach__chip" onClick={() => ask(followUp)}>
          💡 {followUp}
        </button>
      )}

      <div className="study-coach__composer">
        <input
          type="text"
          value={input}
          placeholder="Type your question…"
          maxLength={2000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="button" disabled={loading || !input.trim()} onClick={() => ask(input)}>
          {loading ? '…' : 'Ask'}
        </button>
      </div>
    </section>
  );
}

export default StudyCoach;
