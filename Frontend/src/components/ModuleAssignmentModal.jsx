import { useEffect, useState } from 'react';
import {
  submitAssignment,
  listAssignmentSubmissions,
  gradeAssignment,
  uploadModuleFile,
} from '../api/modules';
import config from '../config';
import AssignmentDefenseModal from './AssignmentDefenseModal';
import './ModuleModals.css';

export default function ModuleAssignmentModal({ item, onClose, onSubmitted, isAdmin }) {
  const [activeTab, setActiveTab] = useState(isAdmin ? 'submissions' : 'details');
  const [submissionText, setSubmissionText] = useState(item.my_submission?.submission_text || '');
  const [fileUrl, setFileUrl] = useState(item.my_submission?.file_url || '');
  const [fileName, setFileName] = useState(item.my_submission?.file_name || '');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showDefenseModal, setShowDefenseModal] = useState(false);
  const [currentSub, setCurrentSub] = useState(item.my_submission);

  // Admin submissions list
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);

  useEffect(() => {
    if (isAdmin && activeTab === 'submissions') {
      loadSubmissions();
    }
  }, [isAdmin, activeTab]);

  async function loadSubmissions() {
    setLoadingSubs(true);
    try {
      const data = await listAssignmentSubmissions(item.id);
      setSubmissions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSubs(false);
    }
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
    } catch (err) {
      console.error(err);
      setError('File upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmitWork(e) {
    e.preventDefault();
    if (!submissionText.trim() && !fileUrl) {
      setError('Please provide text or upload a submission file.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const updatedSub = await submitAssignment(item.id, {
        submission_text: submissionText,
        file_url: fileUrl,
        file_name: fileName,
      });
      setSuccessMsg('Assignment submitted successfully!');
      if (onSubmitted) {
        onSubmitted(updatedSub);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to submit assignment.');
    } finally {
      setSubmitting(false);
    }
  }

  function startGrading(sub) {
    setSelectedSub(sub);
    setGradeInput(sub.grade !== null ? String(sub.grade) : '');
    setFeedbackInput(sub.feedback || '');
  }

  async function handleSaveGrade(e) {
    e.preventDefault();
    if (!selectedSub) return;
    setSavingGrade(true);
    try {
      const updated = await gradeAssignment(item.id, {
        submission_id: selectedSub.id,
        grade: Number(gradeInput),
        feedback: feedbackInput,
      });
      setSubmissions((subs) => subs.map((s) => (s.id === updated.id ? updated : s)));
      setSelectedSub(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save grade.');
    } finally {
      setSavingGrade(false);
    }
  }

  const dueDateFormatted = item.due_date
    ? new Date(item.due_date).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'No due date';

  const mySub = item.my_submission;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span>{item.title}</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Tab navigation for Admin */}
        {isAdmin && (
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 1rem' }}>
            <button
              type="button"
              style={{
                padding: '0.75rem 1.25rem',
                border: 'none',
                background: 'transparent',
                fontWeight: 600,
                cursor: 'pointer',
                color: activeTab === 'submissions' ? '#0284c7' : '#64748b',
                borderBottom: activeTab === 'submissions' ? '3px solid #0284c7' : 'none',
              }}
              onClick={() => setActiveTab('submissions')}
            >
              Student Submissions ({submissions.length})
            </button>
            <button
              type="button"
              style={{
                padding: '0.75rem 1.25rem',
                border: 'none',
                background: 'transparent',
                fontWeight: 600,
                cursor: 'pointer',
                color: activeTab === 'details' ? '#0284c7' : '#64748b',
                borderBottom: activeTab === 'details' ? '3px solid #0284c7' : 'none',
              }}
              onClick={() => setActiveTab('details')}
            >
              Assignment Instructions
            </button>
          </div>
        )}

        <div className="modal-body">
          {error && (
            <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#dc2626', borderRadius: 8, fontSize: '0.9rem' }}>
              {error}
            </div>
          )}
          {successMsg && (
            <div style={{ padding: '0.75rem 1rem', background: '#dcfce7', color: '#16a34a', borderRadius: 8, fontSize: '0.9rem' }}>
              {successMsg}
            </div>
          )}

          {/* Details / Instructions Tab */}
          {(activeTab === 'details' || !isAdmin) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span className="assignment-meta-badge assignment-meta-badge--due">
                  Due: {dueDateFormatted}
                </span>
                <span className="assignment-meta-badge assignment-meta-badge--points">
                  Max: {item.max_points || 100} Points
                </span>
                {mySub && (
                  <span
                    className="assignment-meta-badge"
                    style={{
                      background: mySub.status === 'graded' ? '#ecfdf5' : '#eff6ff',
                      color: mySub.status === 'graded' ? '#059669' : '#2563eb',
                      border: `1px solid ${mySub.status === 'graded' ? '#a7f3d0' : '#bfdbfe'}`,
                    }}
                  >
                    {mySub.status === 'graded' ? 'Graded' : 'Submitted'}
                  </span>
                )}
              </div>

              {item.description && (
                <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6 }}>{item.description}</p>
              )}

              {/* Instructions content */}
              {item.content && (
                <div
                  style={{
                    padding: '1.25rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                    fontSize: '0.95rem',
                    color: '#1e293b',
                  }}
                >
                  {item.content}
                </div>
              )}

              {/* Reference file attachment */}
              {item.file_url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', background: '#f0f9ff', borderRadius: 8 }}>
                  <span>Attached Resource:</span>
                  <a
                    href={`${config.apiBaseUrl}${item.file_url}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontWeight: 600, color: '#0284c7', textDecoration: 'underline' }}
                  >
                    {item.file_name || 'Download Assignment Material'}
                  </a>
                  {item.file_size && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>({item.file_size})</span>}
                </div>
              )}

              {/* If graded, show grade & feedback to student */}
              {mySub && mySub.status === 'graded' && (
                <div className="assignment-grade-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, color: '#166534' }}>Your Grade & Feedback</span>
                    <span className="assignment-grade-score">
                      {mySub.grade} / {item.max_points || 100}
                    </span>
                  </div>
                  {mySub.feedback && (
                    <p style={{ color: '#14532d', fontSize: '0.95rem', background: '#ffffff', padding: '0.75rem', borderRadius: 6 }}>
                      {mySub.feedback}
                    </p>
                  )}
                </div>
              )}

              {/* AI Viva Defense Card (Student View) */}
              {(currentSub || mySub) && (
                <div
                  className="assignment-defense-box"
                  style={{
                    padding: '1.25rem',
                    background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                    border: '1px solid #a7f3d0',
                    borderRadius: 10,
                    margin: '1rem 0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ color: '#065f46', fontSize: '1rem' }}>Assignment AI Viva Defense</strong>
                        <span style={{ background: '#d1fae5', color: '#047857', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 999 }}>
                          Graded (15% Final Weight)
                        </span>
                      </div>
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#047857' }}>
                        Defend your submitted answers and code directly with the AI Examiner to complete this assessment.
                      </p>
                    </div>

                    {(currentSub || mySub).defense_score !== null && (currentSub || mySub).defense_score !== undefined ? (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>
                          {(currentSub || mySub).defense_score}%
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#065f46', textTransform: 'uppercase' }}>Defense Mark</div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ background: 'linear-gradient(135deg, #059669, #047857)', fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                        onClick={() => setShowDefenseModal(true)}
                      >
                        Start AI Viva Defense
                      </button>
                    )}
                  </div>

                  {(currentSub || mySub).defense_feedback && (
                    <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.75)', borderRadius: 6, fontSize: '0.85rem', color: '#065f46' }}>
                      <strong>Examiner Feedback:</strong> {(currentSub || mySub).defense_feedback}
                    </div>
                  )}

                  {(currentSub || mySub).defense_score !== null && (currentSub || mySub).defense_score !== undefined && (
                    <button
                      type="button"
                      style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#059669', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setShowDefenseModal(true)}
                    >
                      Review AI Viva Defense Transcript & Questions →
                    </button>
                  )}
                </div>
              )}

              {/* Student Submission Form */}
              {!isAdmin && (
                <form onSubmit={handleSubmitWork} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                  <h4 style={{ color: '#0f172a' }}>
                    {mySub ? 'Update Your Submission' : 'Submit Your Work'}
                  </h4>

                  <div className="form-group">
                    <label className="form-label">Submission Text / Notes</label>
                    <textarea
                      className="form-textarea"
                      rows={4}
                      placeholder="Type your response, links, or report summary..."
                      value={submissionText}
                      onChange={(e) => setSubmissionText(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Upload File (PDF, Code, ZIP, Word)</label>
                    <div className="file-upload-box" onClick={() => document.getElementById('sub-file-input').click()}>
                      <input
                        type="file"
                        id="sub-file-input"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                      <div className="file-upload-icon">Upload</div>
                      <p style={{ fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                        {uploading ? 'Uploading...' : fileName ? `Selected: ${fileName}` : 'Click to select submission file'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || uploading}
                    style={{ alignSelf: 'flex-end' }}
                  >
                    {submitting ? 'Submitting...' : mySub ? 'Update Submission' : 'Submit Assignment'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Admin Student Submissions Tab */}
          {isAdmin && activeTab === 'submissions' && (
            <div>
              {loadingSubs ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading submissions...</p>
              ) : submissions.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No students have submitted this assignment yet.
                </p>
              ) : (
                <table className="submissions-table">
                  <thead>
                    <tr>
                      <th>Student Code</th>
                      <th>Name</th>
                      <th>Submitted At</th>
                      <th>Attachment</th>
                      <th>Written Grade</th>
                      <th>AI Viva Defense</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id}>
                        <td><strong>{sub.student_code}</strong></td>
                        <td>{sub.student_name}</td>
                        <td>{new Date(sub.submitted_at).toLocaleDateString()}</td>
                        <td>
                          {sub.file_url ? (
                            <a
                              href={`${config.apiBaseUrl}${sub.file_url}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#0284c7', fontWeight: 600 }}
                            >
                              {sub.file_name || 'Download'}
                            </a>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Text only</span>
                          )}
                        </td>
                        <td>
                          {sub.status === 'graded' ? (
                            <span style={{ fontWeight: 700, color: '#16a34a' }}>
                              {sub.grade} / {item.max_points}
                            </span>
                          ) : (
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>Pending</span>
                          )}
                        </td>
                        <td>
                          {sub.defense_score !== null && sub.defense_score !== undefined ? (
                            <span style={{ fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '0.2rem 0.55rem', borderRadius: 4, fontSize: '0.85rem' }}>
                              {sub.defense_score}%
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Pending</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => startGrading(sub)}
                          >
                            Grade / Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Grade Sub-Modal */}
              {selectedSub && (
                <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                  <h4 style={{ marginBottom: '0.75rem', color: '#0f172a' }}>
                    Grading: {selectedSub.student_name} ({selectedSub.student_code})
                  </h4>

                  {selectedSub.submission_text && (
                    <div style={{ padding: '0.75rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
                      <strong>Submission Text:</strong>
                      <p>{selectedSub.submission_text}</p>
                    </div>
                  )}

                  {/* AI Viva Defense Performance Display for Lecturer */}
                  <div style={{
                    padding: '0.85rem 1rem',
                    background: selectedSub.defense_score !== null ? '#ecfdf5' : '#fffbeb',
                    border: `1px solid ${selectedSub.defense_score !== null ? '#a7f3d0' : '#fde68a'}`,
                    borderRadius: 8,
                    marginBottom: '1rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: selectedSub.defense_score !== null ? '#065f46' : '#92400e' }}>
                        AI Viva Defense (15% Weight):
                      </strong>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: selectedSub.defense_score !== null ? '#059669' : '#b45309' }}>
                        {selectedSub.defense_score !== null ? `${selectedSub.defense_score}%` : 'Not defended yet'}
                      </span>
                    </div>
                    {selectedSub.defense_feedback && (
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#047857' }}>
                        {selectedSub.defense_feedback}
                      </p>
                    )}
                  </div>

                  <form onSubmit={handleSaveGrade} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Grade (0 - {item.max_points || 100}) *</label>
                        <input
                          type="number"
                          min="0"
                          max={item.max_points || 100}
                          className="form-input"
                          value={gradeInput}
                          onChange={(e) => setGradeInput(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Feedback to Student</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Well researched, clear packet sequence analysis."
                        value={feedbackInput}
                        onChange={(e) => setFeedbackInput(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setSelectedSub(null)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-success" disabled={savingGrade}>
                        {savingGrade ? 'Saving...' : 'Save Grade'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Assignment AI Viva Defense Modal */}
      {showDefenseModal && (
        <AssignmentDefenseModal
          submission={currentSub || item.my_submission}
          item={item}
          onClose={() => setShowDefenseModal(false)}
          onDefended={(updatedSub) => {
            setCurrentSub(updatedSub);
            setShowDefenseModal(false);
            if (onSubmitted) onSubmitted();
          }}
        />
      )}
    </div>
  );
}
