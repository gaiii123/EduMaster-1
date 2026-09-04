import { useState } from 'react';
import { createItem, uploadModuleFile } from '../api/modules';
import './ModuleModals.css';

const ACTIVITY_TYPES = [
  { id: 'diagnostic_viva', label: '🌱 Pre-Week Diagnostic AI Viva', icon: '🧠', desc: 'Formative AI viva before lectures start (not graded) to identify student strengths and gaps for lecture planning' },
  { id: 'weekly_viva', label: '🎯 Post-Lecture Weekly AI Viva', icon: '🎙️', desc: 'Graded post-lecture AI viva (10% weight) testing lecture knowledge retention and readiness for next week' },
  { id: 'note', label: 'Study Note', icon: '📝', desc: 'Markdown study notes and reading materials' },
  { id: 'slide', label: 'Lecture Slides', icon: '🖥️', desc: 'Presentation slides and slide decks (PDF/PPTX)' },
  { id: 'assignment', label: 'Assignment', icon: '📋', desc: 'Task with due date, file submission & AI Viva Defense (15% weight)' },
  { id: 'quiz', label: 'Quiz', icon: '❓', desc: 'Multiple-choice test with auto-grading' },
  { id: 'file', label: 'File / Resource', icon: '📄', desc: 'Past papers, syllabi, and downloadable documents' },
  { id: 'announcement', label: 'Announcement', icon: '📢', desc: 'Important notice or discussion bulletin' },
];

export default function ModuleActivityModal({ section, onClose, onCreated }) {
  const [type, setType] = useState('note');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxPoints, setMaxPoints] = useState(100);
  const [timeLimit, setTimeLimit] = useState(15);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dynamic Quiz Questions Builder
  const [questions, setQuestions] = useState([
    {
      question: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 1,
      explanation: '',
    },
  ]);

  function addQuestion() {
    setQuestions([
      ...questions,
      {
        question: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: 1,
        explanation: '',
      },
    ]);
  }

  function updateQuestion(index, field, value) {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  }

  function removeQuestion(index) {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await uploadModuleFile(file);
      setFileUrl(res.file_url);
      setFileName(res.file_name);
      setFileSize(res.file_size);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (err) {
      console.error(err);
      setError('File upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title.');
      return;
    }

    if (type === 'quiz') {
      const validQuestions = questions.filter(
        (q) => q.question.trim() && q.option_a.trim() && q.option_b.trim()
      );
      if (validQuestions.length === 0) {
        setError('Please add at least one complete quiz question.');
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        item_type: type,
        title: title.trim(),
        description: description.trim(),
        content: content.trim(),
        file_url: fileUrl || null,
        file_name: fileName,
        file_size: fileSize,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        max_points: Number(maxPoints) || 100,
        time_limit_minutes: Number(timeLimit) || 15,
        quiz_questions:
          type === 'quiz'
            ? questions.filter((q) => q.question.trim()).map((q, idx) => ({
                question: q.question.trim(),
                option_a: q.option_a.trim(),
                option_b: q.option_b.trim(),
                option_c: q.option_c.trim() || 'None',
                option_d: q.option_d.trim() || 'None',
                correct_option: Number(q.correct_option),
                explanation: q.explanation.trim(),
                order_index: idx,
              }))
            : [],
      };

      const newItem = await createItem(section.id, payload);
      onCreated(newItem);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to create activity.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span>➕ Add an Activity or Resource</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
              (Section: {section.title})
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body">
            {error && (
              <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#dc2626', borderRadius: 8, fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            {/* Activity Type Selector */}
            <div className="form-group">
              <label className="form-label">Select Type:</label>
              <div className="activity-type-grid">
                {ACTIVITY_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`activity-type-btn ${type === t.id ? 'active' : ''}`}
                    onClick={() => setType(t.id)}
                  >
                    <span className="activity-type-icon">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* General Information */}
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder={
                  type === 'slide'
                    ? 'e.g. Lecture 01 - Introduction to Computer Networks'
                    : type === 'assignment'
                    ? 'e.g. Assignment 1: Packet Analysis with Wireshark'
                    : type === 'quiz'
                    ? 'e.g. Quiz 01: OSI Reference Model'
                    : type === 'note'
                    ? 'e.g. Study Note: Subnetting & CIDR'
                    : 'Title'
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description / Summary</label>
              <input
                type="text"
                className="form-input"
                placeholder="Brief summary shown on the module syllabus"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* File Upload for Slides, PDFs, or Reference Documents */}
            {(type === 'slide' || type === 'file' || type === 'assignment') && (
              <div className="form-group">
                <label className="form-label">
                  {type === 'slide' ? 'Slide Deck File (PDF, PPTX)' : type === 'assignment' ? 'Assignment Brief / Template (Optional)' : 'File Attachment (PDF, Document)'}
                </label>
                <div className="file-upload-box" onClick={() => document.getElementById('file-input').click()}>
                  <input
                    type="file"
                    id="file-input"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <div className="file-upload-icon">📁</div>
                  <p style={{ fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    {uploading ? 'Uploading...' : fileName ? `Attached: ${fileName} (${fileSize})` : 'Click to browse and upload file'}
                  </p>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Supports PDF, PPTX, DOCX, ZIP up to 50MB</span>
                </div>
              </div>
            )}

            {/* Markdown / Body Content for Notes or Announcements */}
            {(type === 'note' || type === 'announcement' || type === 'slide' || type === 'assignment') && (
              <div className="form-group">
                <label className="form-label">
                  {type === 'assignment' ? 'Detailed Instructions (Markdown supported)' : type === 'note' ? 'Study Content / Markdown Body' : type === 'slide' ? 'Lecture Topics / Outline' : 'Announcement Content'}
                </label>
                <textarea
                  className="form-textarea"
                  rows={type === 'note' || type === 'assignment' ? 6 : 4}
                  placeholder="Supports Markdown headers, bullet lists, code blocks..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            )}

            {/* Assignment specific settings */}
            {type === 'assignment' && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Due Date & Time</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Points</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    className="form-input"
                    value={maxPoints}
                    onChange={(e) => setMaxPoints(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Quiz Questions Builder */}
            {type === 'quiz' && (
              <div className="form-group">
                <div className="form-row" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Time Limit (Minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      className="form-input"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label className="form-label">Questions ({questions.length})</label>
                  <button type="button" className="btn btn-secondary" onClick={addQuestion}>
                    ➕ Add Question
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {questions.map((q, idx) => (
                    <div key={idx} className="question-item">
                      <div className="question-header">
                        <span>Question {idx + 1}</span>
                        {questions.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => removeQuestion(idx)}
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        className="form-input"
                        placeholder="Enter the question prompt..."
                        value={q.question}
                        onChange={(e) => updateQuestion(idx, 'question', e.target.value)}
                        required
                      />

                      <div className="options-grid">
                        <div className="option-input-wrapper">
                          <span style={{ fontWeight: 700, color: '#64748b' }}>A:</span>
                          <input
                            type="text"
                            className="form-input"
                            style={{ flex: 1 }}
                            placeholder="Option A"
                            value={q.option_a}
                            onChange={(e) => updateQuestion(idx, 'option_a', e.target.value)}
                            required
                          />
                        </div>
                        <div className="option-input-wrapper">
                          <span style={{ fontWeight: 700, color: '#64748b' }}>B:</span>
                          <input
                            type="text"
                            className="form-input"
                            style={{ flex: 1 }}
                            placeholder="Option B"
                            value={q.option_b}
                            onChange={(e) => updateQuestion(idx, 'option_b', e.target.value)}
                            required
                          />
                        </div>
                        <div className="option-input-wrapper">
                          <span style={{ fontWeight: 700, color: '#64748b' }}>C:</span>
                          <input
                            type="text"
                            className="form-input"
                            style={{ flex: 1 }}
                            placeholder="Option C"
                            value={q.option_c}
                            onChange={(e) => updateQuestion(idx, 'option_c', e.target.value)}
                          />
                        </div>
                        <div className="option-input-wrapper">
                          <span style={{ fontWeight: 700, color: '#64748b' }}>D:</span>
                          <input
                            type="text"
                            className="form-input"
                            style={{ flex: 1 }}
                            placeholder="Option D"
                            value={q.option_d}
                            onChange={(e) => updateQuestion(idx, 'option_d', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="correct-selector">
                          <label style={{ fontWeight: 600 }}>Correct Answer:</label>
                          <select
                            className="form-select"
                            value={q.correct_option}
                            onChange={(e) => updateQuestion(idx, 'correct_option', Number(e.target.value))}
                          >
                            <option value={1}>Option A</option>
                            <option value={2}>Option B</option>
                            <option value={3}>Option C</option>
                            <option value={4}>Option D</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Explanation / Rationale (optional)"
                          value={q.explanation}
                          onChange={(e) => updateQuestion(idx, 'explanation', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || uploading}>
              {submitting ? 'Creating Activity...' : 'Add to Section'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
