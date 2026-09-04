import { useState } from 'react';
import { generateNote, photoToNote, savePhotoNote } from '../api/learning';
import './AiNoteModal.css';

/**
 * AI note creation modal — two flows:
 * 1. "Topic" tab: Qwen writes a full study note + quiz on a topic.
 * 2. "Photo" tab: Qwen-VL converts a photo of handwritten notes,
 *    the student confirms, then it is saved as a photo note.
 */
function AiNoteModal({ subjects, defaultSubjectId, onClose, onCreated }) {
  const [tab, setTab] = useState('topic');
  const [subjectId, setSubjectId] = useState(defaultSubjectId || subjects[0]?.id || '');

  // Topic tab state
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);

  // Photo tab state
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [draft, setDraft] = useState(null);
  const [converting, setConverting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleGenerate() {
    if (!subjectId || !topic.trim() || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await generateNote(subjectId, topic.trim());
      onCreated(res.note_id);
    } catch (err) {
      console.error('AI note generation failed:', err);
      setError('Could not generate the note. Please try again.');
      setGenerating(false);
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setDraft(null);
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleConvert() {
    if (!imageDataUrl || !subjectId || converting) return;
    setConverting(true);
    setError(null);
    try {
      setDraft(await photoToNote(imageDataUrl, subjectId));
    } catch (err) {
      console.error('Photo conversion failed:', err);
      setError('Could not convert the photo. Try a clearer image.');
    } finally {
      setConverting(false);
    }
  }

  async function handleSave() {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await savePhotoNote(subjectId, draft.title, draft.summary, draft.content_markdown);
      onCreated(res.note_id);
    } catch (err) {
      console.error('Saving photo note failed:', err);
      setError('Could not save the note. Please try again.');
      setSaving(false);
    }
  }

  const busy = generating || converting || saving;

  return (
    <div className="ai-modal__overlay" onClick={busy ? undefined : onClose}>
      <div className="ai-modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal__header">
          <h2>Generate a Note</h2>
          <button type="button" className="ai-modal__close" onClick={onClose} disabled={busy}>
            ✕
          </button>
        </div>

        <div className="ai-modal__tabs">
          <button
            type="button"
            className={`ai-modal__tab ${tab === 'topic' ? 'active' : ''}`}
            onClick={() => setTab('topic')}
          >
            Generate from topic
          </button>
          <button
            type="button"
            className={`ai-modal__tab ${tab === 'photo' ? 'active' : ''}`}
            onClick={() => setTab('photo')}
          >
            Photo of handwritten notes
          </button>
        </div>

        <div className="ai-modal__body">
          <label className="ai-modal__field">
            <span>Subject</span>
            <select value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))}>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.title}
                </option>
              ))}
            </select>
          </label>

          {tab === 'topic' && (
            <>
              <label className="ai-modal__field">
                <span>Topic</span>
                <input
                  type="text"
                  placeholder="e.g. Database indexes, Closures, HTTP caching…"
                  value={topic}
                  maxLength={200}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
              </label>
              <button
                type="button"
                className="ai-modal__cta"
                disabled={generating || !topic.trim()}
                onClick={handleGenerate}
              >
                {generating ? 'Writing your note… (up to ~30s)' : 'Generate note'}
              </button>
            </>
          )}

          {tab === 'photo' && (
            <>
              <label className="ai-modal__field">
                <span>Photo</span>
                <input type="file" accept="image/*" onChange={handleFileChange} />
              </label>

              {imageDataUrl && (
                <img src={imageDataUrl} alt="Selected handwritten notes" className="ai-modal__preview" />
              )}

              {!draft && (
                <button
                  type="button"
                  className="ai-modal__cta"
                  disabled={converting || !imageDataUrl}
                  onClick={handleConvert}
                >
                  {converting ? 'Analyzing your photo…' : 'Convert Image'}
                </button>
              )}

              {draft && (
                <div className="ai-modal__draft">
                  <label className="ai-modal__field">
                    <span>Title</span>
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    />
                  </label>
                  <p className="ai-modal__draft-summary">{draft.summary}</p>
                  <pre className="ai-modal__draft-content">{draft.content_markdown}</pre>
                  <div className="ai-modal__draft-actions">
                    <button type="button" className="ai-modal__ghost" onClick={() => setDraft(null)}>
                      Discard
                    </button>
                    <button
                      type="button"
                      className="ai-modal__cta"
                      disabled={saving || !draft.title.trim()}
                      onClick={handleSave}
                    >
                      {saving ? 'Saving…' : 'Save to library'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {error && <p className="ai-modal__error">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export default AiNoteModal;
