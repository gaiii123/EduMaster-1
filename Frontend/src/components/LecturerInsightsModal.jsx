import { useState, useEffect } from 'react';
import { getSectionLecturerInsights } from '../api/diagnostic';
import './LecturerInsightsModal.css';

export default function LecturerInsightsModal({ moduleId, section, onClose }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterLevel, setFilterLevel] = useState('All');
  const [expandedTranscripts, setExpandedTranscripts] = useState({});

  useEffect(() => {
    fetchInsights();
  }, [moduleId, section.id]);

  async function fetchInsights() {
    setLoading(true);
    try {
      const data = await getSectionLecturerInsights(moduleId, section.id);
      setInsights(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load lecturer prep insights.');
    } finally {
      setLoading(false);
    }
  }

  function toggleTranscript(studentId) {
    setExpandedTranscripts((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  }

  const filteredStudents = (insights?.students || []).filter((s) => {
    if (filterLevel === 'All') return true;
    return s.knowledge_level?.toLowerCase() === filterLevel.toLowerCase();
  });

  return (
    <div className="insights-modal-backdrop" onClick={onClose}>
      <div className="insights-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="insights-modal-header">
          <div>
            <div className="insights-header-badge">
              <span>Pre-Lecture Teaching Intelligence</span>
            </div>
            <h2 className="insights-header-title">
              {section.title} — Lecture Focus & Knowledge Insights
            </h2>
            <div className="insights-header-meta">
              {insights?.module_code} - {insights?.module_title} • Formative Diagnostic Assessment
            </div>
          </div>
          <button type="button" className="insights-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="insights-modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
              Synthesizing cohort knowledge gaps and generating lecture recommendations…
            </div>
          ) : error || !insights ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#dc2626' }}>
              {error || 'Unable to load insights.'}
            </div>
          ) : (
            <>
              {/* Metrics Grid */}
              <div className="insights-metrics-grid">
                <div className="insights-metric-card">
                  <div className="insights-metric-label">Assessed Participation</div>
                  <div className="insights-metric-val">
                    <span>{insights.total_assessed}</span>
                    <span style={{ fontSize: '1rem', color: '#94a3b8' }}>/ {insights.total_enrolled}</span>
                  </div>
                  <div className="insights-metric-sub">
                    {insights.total_enrolled > 0
                      ? `${Math.round((insights.total_assessed / insights.total_enrolled) * 100)}% of class assessed`
                      : 'No enrollments'}
                  </div>
                </div>

                <div className="insights-metric-card">
                  <div className="insights-metric-label">Cohort Readiness Index</div>
                  <div className="insights-metric-val" style={{ color: insights.average_readiness >= 70 ? '#16a34a' : '#d97706' }}>
                    {insights.average_readiness}%
                  </div>
                  <div className="insights-metric-sub">
                    {insights.average_readiness >= 75
                      ? 'Proficient baseline'
                      : insights.average_readiness >= 55
                      ? 'Developing (gaps present)'
                      : 'Needs foundational review'}
                  </div>
                </div>

                <div className="insights-metric-card">
                  <div className="insights-metric-label">Highest Priority Gap</div>
                  <div className="insights-metric-val" style={{ fontSize: '1.15rem', color: '#b91c1c' }}>
                    {insights.weak_topics?.[0]?.topic || 'None detected'}
                  </div>
                  <div className="insights-metric-sub" style={{ color: '#dc2626' }}>
                    {insights.weak_topics?.[0] ? `${insights.weak_topics[0].percentage}% of students struggled` : 'Class is ready'}
                  </div>
                </div>
              </div>

              {/* Week-by-Week Learning Growth / Delta (Post-Lecture vs Pre-Lecture Baseline) */}
              {insights.learning_growth && (
                <div
                  className="insights-learning-growth-card"
                  style={{
                    background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(99, 102, 241, 0.12))',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '1rem',
                    padding: '1.25rem 1.5rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <span style={{
                        background: 'rgba(56, 189, 248, 0.2)',
                        color: '#38bdf8',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        textTransform: 'uppercase',
                      }}>
                        Week-by-Week Learning Growth
                      </span>
                      <h3 style={{ margin: '0.35rem 0 0', color: '#f8fafc', fontSize: '1.15rem' }}>
                        Post-Lecture Knowledge Retention & Growth Delta
                      </h3>
                      <p style={{ margin: '0.2rem 0 0', color: '#94a3b8', fontSize: '0.84rem' }}>
                        Validates that students actually acquired and retained the knowledge from this week's lecture.
                      </p>
                    </div>
                    <div style={{
                      background: insights.learning_growth.growth_delta >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: insights.learning_growth.growth_delta >= 0 ? '#4ade80' : '#f87171',
                      border: `1px solid ${insights.learning_growth.growth_delta >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      padding: '0.5rem 1.25rem',
                      borderRadius: '0.75rem',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                        {insights.learning_growth.growth_delta >= 0 ? '+' : ''}{insights.learning_growth.growth_delta}%
                      </div>
                      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Knowledge Delta
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '0.6rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Pre-Lecture Baseline</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#cbd5e1', marginTop: '0.2rem' }}>
                        {insights.learning_growth.pre_lecture_readiness}%
                      </div>
                    </div>

                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '0.6rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Post-Lecture Mastery</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
                        {insights.learning_growth.post_lecture_mastery}%
                      </div>
                    </div>

                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '0.6rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Vivas Assessed</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#a855f7', marginTop: '0.2rem' }}>
                        {insights.learning_growth.total_weekly_vivas} students
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Lecture Focus Recommendations (Prominent Advisory Box) */}
              <div className="insights-focus-advisory-box">
                <div className="insights-focus-header">
                  <div className="insights-focus-title">
                    <span>Lecture Focus Plan: Where to Give Attention in This Week's Lecture</span>
                  </div>
                  <span className="insights-focus-badge">Actionable for Lecturer</span>
                </div>

                <div className="insights-rec-list">
                  {insights.lecture_focus_recommendations?.map((rec, idx) => (
                    <div key={idx} className="insights-rec-item">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>

              {/* Topics Comparison Columns (What they know vs Gaps) */}
              <div className="insights-topics-grid">
                {/* Strengths */}
                <div className="insights-topic-column">
                  <div className="insights-column-title insights-column-title--strong">
                    <span>Concepts Students Already Know Well</span>
                  </div>
                  {insights.strong_topics?.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No clear baseline strengths detected yet.</p>
                  ) : (
                    <div className="insights-bar-list">
                      {insights.strong_topics.map((item, i) => (
                        <div key={i} className="insights-bar-item">
                          <div className="insights-bar-label-row">
                            <span>{item.topic}</span>
                            <span style={{ color: '#16a34a' }}>{item.percentage}%</span>
                          </div>
                          <div className="insights-bar-track">
                            <div
                              className="insights-bar-fill insights-bar-fill--strong"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Weaknesses / Gaps */}
                <div className="insights-topic-column">
                  <div className="insights-column-title insights-column-title--weak">
                    <span>Knowledge Gaps (Needs Extra Attention in Lecture)</span>
                  </div>
                  {insights.weak_topics?.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No significant knowledge gaps detected.</p>
                  ) : (
                    <div className="insights-bar-list">
                      {insights.weak_topics.map((item, i) => (
                        <div key={i} className="insights-bar-item">
                          <div className="insights-bar-label-row">
                            <span>{item.topic}</span>
                            <span style={{ color: '#dc2626' }}>{item.percentage}% struggling</span>
                          </div>
                          <div className="insights-bar-track">
                            <div
                              className="insights-bar-fill insights-bar-fill--weak"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Common Misconceptions */}
              {insights.common_misconceptions?.length > 0 && (
                <div className="insights-misconceptions-card">
                  <div className="insights-misc-title">
                    <span>Specific Misconceptions Detected Across Class</span>
                  </div>
                  <div className="insights-misc-list">
                    {insights.common_misconceptions.map((m, idx) => (
                      <div key={idx} className="insights-misc-pill">
                        <strong>Misconception:</strong> {m}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Student Diagnostic Roster */}
              <div className="insights-roster-section">
                <div className="insights-roster-header">
                  <div className="insights-roster-title">
                    Individual Student Diagnostic Profiles ({filteredStudents.length})
                  </div>

                  <div className="insights-filter-tabs">
                    {['All', 'Proficient', 'Developing', 'Needs Guidance'].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={`insights-filter-btn ${filterLevel === tab ? 'active' : ''}`}
                        onClick={() => setFilterLevel(tab)}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredStudents.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No students found in this category.</p>
                ) : (
                  <div className="insights-students-grid">
                    {filteredStudents.map((s) => {
                      const isExpanded = !!expandedTranscripts[s.student_id];
                      return (
                        <div key={s.student_id} className="insights-student-card">
                          <div className="insights-student-top">
                            <div>
                              <span className="insights-student-name">{s.student_name}</span>
                              <span className="insights-student-code">({s.student_code})</span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <span
                                style={{
                                  background: s.readiness_score >= 70 ? '#dcfce7' : s.readiness_score >= 55 ? '#e0f2fe' : '#fef3c7',
                                  color: s.readiness_score >= 70 ? '#15803d' : s.readiness_score >= 55 ? '#0369a1' : '#b45309',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: 999,
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                }}
                              >
                                Readiness: {s.readiness_score}% ({s.knowledge_level})
                              </span>

                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                                onClick={() => toggleTranscript(s.student_id)}
                              >
                                {isExpanded ? 'Hide Transcript' : 'Inspect Viva Transcript ▾'}
                              </button>
                            </div>
                          </div>

                          {/* Pills */}
                          <div className="insights-student-pills">
                            {s.strong_areas?.map((sa, i) => (
                              <span key={i} className="insights-pill-s">
                                {sa}
                              </span>
                            ))}
                            {s.weak_areas?.map((wa, i) => (
                              <span key={i} className="insights-pill-w">
                                {wa}
                              </span>
                            ))}
                          </div>

                          {/* Notes */}
                          <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.45 }}>
                            <strong>Diagnostic Note: </strong>
                            {s.diagnostic_summary}
                          </div>

                          {/* Recommendation */}
                          {s.ai_recommendation && (
                            <div style={{ fontSize: '0.82rem', color: '#1e40af', marginTop: '0.35rem', fontStyle: 'italic' }}>
                              Recommendation: {s.ai_recommendation}
                            </div>
                          )}

                          {/* Expanded Transcript Drawer */}
                          {isExpanded && (
                            <div className="insights-transcript-drawer">
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>
                                Full Conversational AI Viva Transcript:
                              </div>
                              {s.transcript?.map((t, idx) => (
                                <div
                                  key={idx}
                                  className={`insights-transcript-msg ${
                                    t.role === 'assistant'
                                      ? 'insights-transcript-msg--assistant'
                                      : 'insights-transcript-msg--user'
                                  }`}
                                >
                                  <strong>{t.role === 'assistant' ? 'Examiner: ' : 'Student: '}</strong>
                                  {t.content}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
