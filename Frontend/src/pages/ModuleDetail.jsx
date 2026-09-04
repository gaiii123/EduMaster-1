import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getModule,
  enrollModule,
  createSection,
  deleteSection,
  deleteItem,
  listParticipants,
  getModuleGrades,
} from '../api/modules';
import ModuleActivityModal from '../components/ModuleActivityModal';
import ModuleQuizModal from '../components/ModuleQuizModal';
import ModuleAssignmentModal from '../components/ModuleAssignmentModal';
import ModuleSlideViewerModal from '../components/ModuleSlideViewerModal';
import ModuleNoteModal from '../components/ModuleNoteModal';
import PreWeekVivaModal from '../components/PreWeekVivaModal';
import WeeklyVivaModal from '../components/WeeklyVivaModal';
import LecturerInsightsModal from '../components/LecturerInsightsModal';
import { updateStudentExamGrades } from '../api/diagnostic';
import config from '../config';
import './ModuleDetail.css';

export default function ModuleDetail() {
  const { moduleId } = useParams();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('course'); // "course" | "participants" | "grades" | "activities"

  // Collapsible section states (map of sectionId -> boolean)
  const [openSections, setOpenSections] = useState({});

  // Active modals
  const [activeActivityModalSection, setActiveActivityModalSection] = useState(null);
  const [activeQuizItem, setActiveQuizItem] = useState(null);
  const [activeAssignmentItem, setActiveAssignmentItem] = useState(null);
  const [activeSlideItem, setActiveSlideItem] = useState(null);
  const [activeNoteItem, setActiveNoteItem] = useState(null);
  const [activeDiagnosticItem, setActiveDiagnosticItem] = useState(null);
  const [activeWeeklyVivaItem, setActiveWeeklyVivaItem] = useState(null);
  const [activeInsightsSection, setActiveInsightsSection] = useState(null);

  // Admin Exam Grading Modal
  const [editingExamStudent, setEditingExamStudent] = useState(null);
  const [examForm, setExamForm] = useState({
    mid_exam_score: 0,
    end_exam_score: 0,
    presentation_score: '',
    notes: '',
  });
  const [savingExam, setSavingExam] = useState(false);

  // New section form
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [addingSection, setAddingSection] = useState(false);

  // Participants tab data
  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Grades tab data
  const [gradesData, setGradesData] = useState(null);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // Enrollment action state
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    loadModule();
  }, [moduleId]);

  async function loadModule() {
    try {
      setLoading(true);
      const data = await getModule(moduleId);
      setModule(data);

      // Default: expand all sections initially
      const initialOpen = {};
      data.sections?.forEach((s) => {
        initialOpen[s.id] = true;
      });
      setOpenSections(initialOpen);
    } catch (err) {
      console.error(err);
      setError('Could not load course module.');
    } finally {
      setLoading(false);
    }
  }

  // Load participants or grades on tab switch
  useEffect(() => {
    if (activeTab === 'participants') {
      loadParticipants();
    } else if (activeTab === 'grades') {
      loadGrades();
    }
  }, [activeTab, moduleId]);

  async function loadParticipants() {
    setLoadingParticipants(true);
    try {
      const data = await listParticipants(moduleId);
      setParticipants(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingParticipants(false);
    }
  }

  async function loadGrades() {
    setLoadingGrades(true);
    try {
      const data = await getModuleGrades(moduleId);
      setGradesData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGrades(false);
    }
  }

  function startEditingStudentExam(studentRow) {
    setEditingExamStudent(studentRow);
    setExamForm({
      mid_exam_score: studentRow.mid_exam ?? 0,
      end_exam_score: studentRow.end_exam ?? 0,
      presentation_score: studentRow.presentation !== null && studentRow.presentation !== undefined ? studentRow.presentation : '',
      notes: '',
    });
  }

  async function handleSaveExamGrades(e) {
    e.preventDefault();
    if (!editingExamStudent) return;
    setSavingExam(true);
    try {
      await updateStudentExamGrades(moduleId, editingExamStudent.student_id, {
        mid_exam_score: parseFloat(examForm.mid_exam_score) || 0,
        end_exam_score: parseFloat(examForm.end_exam_score) || 0,
        presentation_score: examForm.presentation_score !== '' ? parseFloat(examForm.presentation_score) : null,
        notes: examForm.notes || '',
      });
      setEditingExamStudent(null);
      await loadGrades();
    } catch (err) {
      console.error('Failed to save exam grades:', err);
      alert('Failed to save exam marks.');
    } finally {
      setSavingExam(false);
    }
  }

  async function handleEnroll() {
    setEnrolling(true);
    try {
      await enrollModule(moduleId);
      await loadModule();
    } catch (err) {
      console.error(err);
      alert('Failed to enroll.');
    } finally {
      setEnrolling(false);
    }
  }

  function toggleSection(sectionId) {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }

  function toggleAllSections() {
    const allOpen = Object.values(openSections).every(Boolean);
    const updated = {};
    module.sections?.forEach((s) => {
      updated[s.id] = !allOpen;
    });
    setOpenSections(updated);
  }

  async function handleAddSectionSubmit(e) {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;
    setAddingSection(true);
    try {
      await createSection(moduleId, { title: newSectionTitle.trim() });
      setNewSectionTitle('');
      setShowAddSection(false);
      await loadModule();
    } catch (err) {
      console.error(err);
      alert('Failed to add section.');
    } finally {
      setAddingSection(false);
    }
  }

  async function handleDeleteSection(sectionId, title) {
    if (!window.confirm(`Delete section "${title}" and all its activities?`)) return;
    try {
      await deleteSection(sectionId);
      await loadModule();
    } catch (err) {
      console.error(err);
      alert('Failed to delete section.');
    }
  }

  async function handleDeleteItem(itemId, title) {
    if (!window.confirm(`Delete activity "${title}"?`)) return;
    try {
      await deleteItem(itemId);
      await loadModule();
    } catch (err) {
      console.error(err);
      alert('Failed to delete activity.');
    }
  }

  function handleItemClick(item) {
    if (item.item_type === 'weekly_viva') {
      setActiveWeeklyVivaItem(item);
    } else if (item.item_type === 'diagnostic_viva') {
      setActiveDiagnosticItem(item);
    } else if (item.item_type === 'slide') {
      setActiveSlideItem(item);
    } else if (item.item_type === 'note') {
      setActiveNoteItem(item);
    } else if (item.item_type === 'quiz') {
      setActiveQuizItem(item);
    } else if (item.item_type === 'assignment') {
      setActiveAssignmentItem(item);
    } else if (item.item_type === 'file' && item.file_url) {
      window.open(`${config.apiBaseUrl}${item.file_url}`, '_blank');
    } else if (item.item_type === 'announcement') {
      alert(`Announcement:\n\n${item.title}\n\n${item.content || item.description || ''}`);
    }
  }

  function getItemIcon(itemType) {
    switch (itemType) {
      case 'weekly_viva':
        return 'WV';
      case 'diagnostic_viva':
        return 'DV';
      case 'slide':
        return 'SL';
      case 'note':
        return 'NT';
      case 'quiz':
        return 'QZ';
      case 'assignment':
        return 'AS';
      case 'announcement':
        return 'AN';
      case 'file':
      default:
        return 'FL';
    }
  }

  if (loading) {
    return (
      <div className="module-detail-page" style={{ textAlign: 'center', padding: '5rem' }}>
        <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Loading course content…</p>
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="module-detail-page" style={{ textAlign: 'center', padding: '5rem' }}>
        <p style={{ color: '#ef4444', fontSize: '1.1rem', marginBottom: '1rem' }}>{error || 'Course not found.'}</p>
        <Link to="/modules" className="btn btn-primary">
          ← Back to Course Overview
        </Link>
      </div>
    );
  }

  const allSectionsOpen = Object.values(openSections).every(Boolean);

  return (
    <div className="module-detail-page">
      {/* Deep Blue Header Banner (Image 2 style) */}
      <div className="module-header-banner">
        <div className="module-header-content">
          <Link to="/modules" className="module-breadcrumb">
            ← Course overview
          </Link>
          <h1 className="module-banner-title">
            {module.code} - {module.title}({module.academic_year})
          </h1>

          {/* Sub-navigation tabs: Course, Participants, Grades, Activities */}
          <div className="module-nav-tabs">
            <button
              type="button"
              className={`module-tab-btn ${activeTab === 'course' ? 'active' : ''}`}
              onClick={() => setActiveTab('course')}
            >
              Course
            </button>
            <button
              type="button"
              className={`module-tab-btn ${activeTab === 'participants' ? 'active' : ''}`}
              onClick={() => setActiveTab('participants')}
            >
              Participants ({module.enrolled_count || 0})
            </button>
            <button
              type="button"
              className={`module-tab-btn ${activeTab === 'grades' ? 'active' : ''}`}
              onClick={() => setActiveTab('grades')}
            >
              Grades
            </button>
            <button
              type="button"
              className={`module-tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
              onClick={() => setActiveTab('activities')}
            >
              Activities
            </button>
            <button
              type="button"
              className={`module-tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
              onClick={() => setActiveTab('insights')}
            >
              Teaching Insights
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="module-main-container">
        {/* Guest enrollment prompt banner */}
        {!isAdmin && !module.is_enrolled && (
          <div className="module-guest-banner">
            <div className="module-guest-info">
              <span>You are viewing this course as a guest. Enroll to access all activities, quizzes, and submit assignments.</span>
            </div>
            <button
              type="button"
              className="btn btn-success"
              disabled={enrolling}
              onClick={handleEnroll}
            >
              {enrolling ? 'Enrolling...' : 'Enroll in Course'}
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/*  Tab 1: Course Syllabus & Sections (Exact match to Image 2)  */}
        {/* ============================================================ */}
        {activeTab === 'course' && (
          <div>
            {/* Action controls (Collapse all / Add section) */}
            <div className="module-controls-bar">
              <button
                type="button"
                className="collapse-toggle-btn"
                onClick={toggleAllSections}
              >
                {allSectionsOpen ? 'Collapse all' : 'Expand all'}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowAddSection(true)}
                >
                  Add Section / Topic
                </button>
              )}
            </div>

            {/* Admin Add Section Form */}
            {showAddSection && (
              <form
                onSubmit={handleAddSectionSubmit}
                style={{
                  background: '#ffffff',
                  padding: '1.25rem',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="New Section Title (e.g. Topic 04 - Network Security)"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  autoFocus
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={addingSection}>
                  {addingSection ? 'Adding...' : 'Add Section'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddSection(false)}
                >
                  Cancel
                </button>
              </form>
            )}

            {/* Sections Accordion Stack */}
            <div className="sections-accordion-stack">
              {module.sections?.map((section) => {
                const isOpen = !!openSections[section.id];
                return (
                  <div key={section.id} className="section-card">
                    {/* Section Header */}
                    <div
                      className={`section-card-header ${isOpen ? 'is-open' : ''}`}
                      onClick={() => toggleSection(section.id)}
                    >
                      <div className="section-title-wrapper">
                        <span className={`section-chevron ${isOpen ? 'rotated' : ''}`}>▶</span>
                        <span className="section-title-text">{section.title}</span>
                        <span className="section-items-badge">
                          ({section.items?.length || 0} items)
                        </span>
                      </div>

                      {isAdmin && (
                        <div
                          className="section-admin-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', fontWeight: 600 }}
                            title="Inspect cohort baseline knowledge & lecture recommendations"
                            onClick={() => setActiveInsightsSection(section)}
                          >
                            Cohort Insights
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                            onClick={() => setActiveActivityModalSection(section)}
                          >
                            + Add Activity
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                            title="Delete section"
                            onClick={() => handleDeleteSection(section.id, section.title)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Section Body */}
                    {isOpen && (
                      <div className="section-body">
                        {section.description && (
                          <div className="section-desc-note">{section.description}</div>
                        )}

                        {section.items?.length === 0 ? (
                          <p style={{ color: '#94a3b8', fontSize: '0.9rem', padding: '0.5rem' }}>
                            No activities or resources added to this section yet.
                          </p>
                        ) : (
                          section.items?.map((item) => {
                            const icon = getItemIcon(item.item_type);
                            return (
                              <div
                                key={item.id}
                                className="module-item-row"
                                onClick={() => handleItemClick(item)}
                              >
                                <div className="module-item-left">
                                  <span className={`item-type-icon item-type-icon--${item.item_type}`}>
                                    {icon}
                                  </span>

                                  <div className="module-item-info">
                                    <div className="module-item-title">
                                      <span>{item.title}</span>
                                    </div>

                                    {item.description && (
                                      <div className="module-item-desc">{item.description}</div>
                                    )}

                                    {/* Item Meta Badges */}
                                    <div className="module-item-meta-badges">
                                      {item.item_type === 'weekly_viva' && (
                                        <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '0.15rem 0.55rem', borderRadius: 4, fontWeight: 700, fontSize: '0.78rem' }}>
                                          Post-Lecture AI Viva (Graded • 10%)
                                        </span>
                                      )}
                                      {item.item_type === 'diagnostic_viva' && (
                                        <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '0.15rem 0.55rem', borderRadius: 4, fontWeight: 700, fontSize: '0.78rem' }}>
                                          Pre-Week Diagnostic AI Viva (Not Graded)
                                        </span>
                                      )}
                                      {item.item_type === 'slide' && item.file_name && (
                                        <span className="badge-sub-info">{item.file_name}</span>
                                      )}
                                      {item.item_type === 'file' && item.file_size && (
                                        <span className="badge-sub-info">{item.file_size}</span>
                                      )}
                                      {item.item_type === 'assignment' && item.due_date && (
                                        <span className="badge-sub-info">
                                          Due: {new Date(item.due_date).toLocaleDateString()}
                                        </span>
                                      )}
                                      {item.item_type === 'assignment' && item.my_submission && (
                                        item.my_submission.status === 'graded' ? (
                                          <span className="badge-sub-graded">
                                            Graded: {item.my_submission.grade} / {item.max_points}
                                          </span>
                                        ) : (
                                          <span className="badge-sub-done">✓ Submitted</span>
                                        )
                                      )}
                                      {item.item_type === 'assignment' && item.my_submission?.defense_score !== null && item.my_submission?.defense_score !== undefined && (
                                        <span style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', padding: '0.15rem 0.55rem', borderRadius: 4, fontWeight: 700, fontSize: '0.78rem' }}>
                                          AI Defense: {item.my_submission.defense_score}%
                                        </span>
                                      )}
                                      {item.item_type === 'quiz' && item.my_quiz_attempt && (
                                        <span className="badge-quiz-score">
                                          Quiz Score: {item.my_quiz_attempt.score} / {item.my_quiz_attempt.total_questions} ({item.my_quiz_attempt.percentage}%)
                                        </span>
                                      )}
                                      {isAdmin && item.item_type === 'assignment' && (
                                        <span className="badge-sub-info">
                                          {item.submissions_count || 0} Submissions
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {isAdmin && (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      className="btn btn-danger"
                                      style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                      title="Delete item"
                                      onClick={() => handleDeleteItem(item.id, item.title)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}

                        {isAdmin && (
                          <div className="add-activity-btn-row">
                            <button
                              type="button"
                              className="btn-add-activity"
                              onClick={() => setActiveActivityModalSection(section)}
                            >
                              Add an activity or resource
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/*  Tab 2: Participants (Enrolled Students)                     */}
        {/* ============================================================ */}
        {activeTab === 'participants' && (
          <div className="table-card">
            <div className="table-card-header">
              <h2 style={{ fontSize: '1.25rem', color: '#0f172a' }}>
                Enrolled Participants ({participants.length})
              </h2>
            </div>

            {loadingParticipants ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading students…</p>
            ) : participants.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No students enrolled yet.</p>
            ) : (
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Full Name</th>
                    <th>Email Address</th>
                    <th>Enrolled Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.student_id}>
                      <td><strong>{p.student_code}</strong></td>
                      <td>{p.name}</td>
                      <td>{p.email}</td>
                      <td>{new Date(p.enrolled_at).toLocaleDateString()}</td>
                      <td>
                        <span style={{ color: '#16a34a', fontWeight: 600, background: '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.8rem' }}>
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/*  Tab 3: Grades & 100-Point Weighted Gradebook                */}
        {/* ============================================================ */}
        {activeTab === 'grades' && (
          <div className="table-card">
            {/* 100-Point Weighted Grading Formula Banner */}
            <div className="formula-banner-card">
              <div className="formula-header-title">
                <div className="formula-icon"></div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                    100-Point Weighted Final Grading Scheme
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.86rem' }}>
                    Calculated end of the module out of 100 points across 4 core academic pillars:
                  </p>
                </div>
              </div>

              <div className="formula-pillars-strip">
                <div className="formula-pillar-chip written">
                  <span className="chip-weight">60%</span>
                  <span className="chip-label">Physical Written Exams</span>
                  <span className="chip-sub">Mid 25% + End 35%</span>
                </div>
                <div className="formula-pillar-chip viva">
                  <span className="chip-weight">10%</span>
                  <span className="chip-label">Weekly AI Vivas</span>
                  <span className="chip-sub">Lecture Retention Checks</span>
                </div>
                <div className="formula-pillar-chip asgn">
                  <span className="chip-weight">15%</span>
                  <span className="chip-label">Assignments & Defense</span>
                  <span className="chip-sub">Work + AI Viva Defense</span>
                </div>
                <div className="formula-pillar-chip pres">
                  <span className="chip-weight">15%</span>
                  <span className="chip-label">Presentation / Quizzes</span>
                  <span className="chip-sub">Presentation Mark or Quiz Avg</span>
                </div>
              </div>
            </div>

            {loadingGrades ? (
              <p style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Calculating 100-point grade metrics…</p>
            ) : !gradesData ? (
              <p style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No assessment data found.</p>
            ) : gradesData.role === 'student' ? (
              <div>
                {/* Student 100-Point Grade Overview Card */}
                {gradesData.my_grade && (
                  <div className="student-hero-grade-card">
                    <div className="hero-grade-main">
                      <div className="hero-letter-badge">
                        <span className="letter-txt">{gradesData.my_grade.pillars?.letter_grade || '—'}</span>
                        <span className="status-txt">{gradesData.my_grade.pillars?.status || 'In Progress'}</span>
                      </div>
                      <div className="hero-score-meta">
                        <div className="hero-total-val">
                          {gradesData.my_grade.pillars?.total_score}
                          <span className="hero-total-max"> / 100.0</span>
                        </div>
                        <h3 className="hero-student-name">
                          {gradesData.my_grade.student_name} ({gradesData.my_grade.student_code})
                        </h3>
                        <p className="hero-desc">
                          Weighted cumulative final score calculated across written physical exams, weekly AI knowledge vivas, assignment oral defenses, and presentation marks.
                        </p>
                      </div>
                    </div>

                    {/* 4 Pillars Breakdown Grid */}
                    <div className="pillars-kpi-grid">
                      <div className="pillar-kpi-card written">
                        <div className="kpi-top">
                          <span className="kpi-icon">WR</span>
                          <span className="kpi-tag">60% Weight</span>
                        </div>
                        <div className="kpi-pts">
                          {gradesData.my_grade.pillars?.written_exams_score}
                          <span className="kpi-max">/ 60.0</span>
                        </div>
                        <div className="kpi-title">Written Physical Exams</div>
                        <div className="kpi-detail">
                          Mid: {gradesData.my_grade.mid_exam}% • End: {gradesData.my_grade.end_exam}%
                        </div>
                      </div>

                      <div className="pillar-kpi-card viva">
                        <div className="kpi-top">
                          <span className="kpi-icon">VI</span>
                          <span className="kpi-tag">10% Weight</span>
                        </div>
                        <div className="kpi-pts">
                          {gradesData.my_grade.pillars?.weekly_vivas_score}
                          <span className="kpi-max">/ 10.0</span>
                        </div>
                        <div className="kpi-title">Weekly AI Vivas</div>
                        <div className="kpi-detail">
                          Weekly Retention Avg: {gradesData.my_grade.weekly_vivas_avg}%
                        </div>
                      </div>

                      <div className="pillar-kpi-card asgn">
                        <div className="kpi-top">
                          <span className="kpi-icon">AS</span>
                          <span className="kpi-tag">15% Weight</span>
                        </div>
                        <div className="kpi-pts">
                          {gradesData.my_grade.pillars?.assignments_score}
                          <span className="kpi-max">/ 15.0</span>
                        </div>
                        <div className="kpi-title">Assignments & Defense</div>
                        <div className="kpi-detail">
                          Code + Oral Defense Avg: {gradesData.my_grade.assignments_avg}%
                        </div>
                      </div>

                      <div className="pillar-kpi-card pres">
                        <div className="kpi-top">
                          <span className="kpi-icon">PR</span>
                          <span className="kpi-tag">15% Weight</span>
                        </div>
                        <div className="kpi-pts">
                          {gradesData.my_grade.pillars?.presentation_or_quizzes_score}
                          <span className="kpi-max">/ 15.0</span>
                        </div>
                        <div className="kpi-title">Presentation / Quizzes</div>
                        <div className="kpi-detail">
                          {gradesData.my_grade.presentation !== null
                            ? `Presentation: ${gradesData.my_grade.presentation}%`
                            : `Quiz Avg: ${gradesData.my_grade.quizzes_avg}%`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Detailed Activity Breakdown Table */}
                <h4 style={{ margin: '1.75rem 0 0.75rem', color: '#0f172a', fontSize: '1.05rem' }}>
                  Individual Course Assessment Records
                </h4>
                <table className="lms-table">
                  <thead>
                    <tr>
                      <th>Assessment Item</th>
                      <th>Type</th>
                      <th>Max Points</th>
                      <th>Your Score</th>
                      <th>Percentage</th>
                      <th>Status</th>
                      <th>Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradesData.grades?.map((g) => (
                      <tr key={g.item_id}>
                        <td><strong>{g.title}</strong></td>
                        <td style={{ textTransform: 'capitalize' }}>{g.item_type}</td>
                        <td>{g.max_points}</td>
                        <td>{g.score !== null ? <strong>{g.score}</strong> : '—'}</td>
                        <td>{g.percentage !== null ? `${g.percentage}%` : '—'}</td>
                        <td>
                          <span
                            style={{
                              fontWeight: 600,
                              color: g.status === 'graded' ? '#16a34a' : g.status === 'attempted' ? '#0284c7' : '#f59e0b',
                            }}
                          >
                            {g.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{g.feedback || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Admin Gradebook View: 100-Point Weighted Gradebook + Detailed Matrix */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 700 }}>
                    Official 100-Point Final Gradebook ({gradesData.final_gradebook?.length || 0} Students)
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Click "Edit Written Exams" to update physical written exam & presentation marks.
                  </span>
                </div>

                <div style={{ overflowX: 'auto', marginBottom: '2.5rem' }}>
                  <table className="lms-table gradebook-100pt-table">
                    <thead>
                      <tr>
                        <th>Student Code</th>
                        <th>Student Name</th>
                        <th style={{ background: '#f8fafc' }}>
                          Written Physical Exams (60 pts)
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Mid (25%) + End (35%)</div>
                        </th>
                        <th style={{ background: '#f8fafc' }}>
                          Weekly AI Vivas (10 pts)
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Lecture Retention</div>
                        </th>
                        <th style={{ background: '#f8fafc' }}>
                          Assignments & Defense (15 pts)
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Work + Oral Viva</div>
                        </th>
                        <th style={{ background: '#f8fafc' }}>
                          Presentation / Quiz (15 pts)
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Pres Mark or Quizzes</div>
                        </th>
                        <th style={{ background: '#f0fdf4', color: '#166534' }}>
                          Final Total (100.0)
                        </th>
                        <th style={{ background: '#f0fdf4', color: '#166534' }}>Grade</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradesData.final_gradebook?.map((row) => {
                        const p = row.pillars;
                        return (
                          <tr key={row.student_id}>
                            <td><strong>{row.student_code}</strong></td>
                            <td>{row.student_name}</td>
                            <td>
                              <strong>{p?.written_exams_score}</strong> / 60.0
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Mid: {row.mid_exam}% • End: {row.end_exam}%
                              </div>
                            </td>
                            <td>
                              <strong>{p?.weekly_vivas_score}</strong> / 10.0
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Avg: {row.weekly_vivas_avg}%
                              </div>
                            </td>
                            <td>
                              <strong>{p?.assignments_score}</strong> / 15.0
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Avg: {row.assignments_avg}%
                              </div>
                            </td>
                            <td>
                              <strong>{p?.presentation_or_quizzes_score}</strong> / 15.0
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {row.presentation !== null ? `Pres: ${row.presentation}%` : `Quiz: ${row.quizzes_avg}%`}
                              </div>
                            </td>
                            <td style={{ background: '#f0fdf4', fontWeight: 800, fontSize: '1.05rem', color: '#166534' }}>
                              {p?.total_score}
                            </td>
                            <td style={{ background: '#f0fdf4', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.55rem',
                                borderRadius: 4,
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                background: p?.letter_grade?.startsWith('A') ? '#dcfce7' : p?.letter_grade?.startsWith('B') ? '#dbeafe' : '#fef3c7',
                                color: p?.letter_grade?.startsWith('A') ? '#15803d' : p?.letter_grade?.startsWith('B') ? '#1d4ed8' : '#b45309',
                              }}>
                                {p?.letter_grade}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                color: p?.status === 'Passed' ? '#16a34a' : p?.status === 'In Progress' ? '#0284c7' : '#dc2626',
                              }}>
                                {p?.status}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                onClick={() => startEditingStudentExam(row)}
                              >
                                Edit Written Exams
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Detailed Item Activity Matrix (Quizzes & Assignments) */}
                <h4 style={{ margin: '1.5rem 0 0.75rem', color: '#0f172a', fontSize: '1.05rem' }}>
                  Raw Activity Scores (Quizzes & Assignments)
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="lms-table">
                    <thead>
                      <tr>
                        <th>Student Code</th>
                        <th>Name</th>
                        {gradesData.columns?.map((col) => (
                          <th key={col.id}>
                            {col.title} ({col.type.toUpperCase()})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gradesData.rows?.map((row) => (
                        <tr key={row.student_id}>
                          <td><strong>{row.student_code}</strong></td>
                          <td>{row.student_name}</td>
                          {gradesData.columns?.map((col) => {
                            const g = row.grades?.[col.id];
                            return (
                              <td key={col.id}>
                                {g && g.score !== null ? (
                                  <span style={{ fontWeight: 700, color: '#16a34a' }}>
                                    {g.score} / {col.max_points} ({g.percentage}%)
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/*  Tab 4: Activities Summary                                   */}
        {/* ============================================================ */}
        {activeTab === 'activities' && (
          <div className="table-card">
            <h2 style={{ fontSize: '1.25rem', color: '#0f172a', marginBottom: '1.25rem' }}>
              All Module Activities & Learning Materials
            </h2>

            <table className="lms-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Section</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {module.sections?.flatMap((sec) =>
                  sec.items?.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className={`item-type-icon item-type-icon--${item.item_type}`} style={{ display: 'inline-flex', width: 28, height: 28, fontSize: '0.9rem' }}>
                          {getItemIcon(item.item_type)}
                        </span>
                      </td>
                      <td><strong>{item.title}</strong></td>
                      <td>{sec.title}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => handleItemClick(item)}
                        >
                          Open →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ============================================================ */}
        {/*  Tab 5: AI Teaching Insights & Lecture Prep Dashboard       */}
        {/* ============================================================ */}
        {activeTab === 'insights' && (
          <div className="table-card">
            <div className="table-card-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', color: '#0f172a' }}>
                  Teaching Intelligence & Weekly Lecture Prep
                </h2>
                <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Formative baseline assessments conducted by AI before each week begins. Identifies cohort strengths, knowledge gaps, and generated focus recommendations for lecturers.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {module.sections?.map((sec) => {
                const diagItem = sec.items?.find((it) => it.item_type === 'diagnostic_viva');
                return (
                  <div
                    key={sec.id}
                    style={{
                      background: '#ffffff',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: 14,
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: '#6d28d9',
                            background: '#ede9fe',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 6,
                          }}
                        >
                          {sec.title.includes('Week') ? 'Weekly Prep' : 'Topic Prep'}
                        </span>
                        {diagItem && (
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#16a34a' }}>
                            Pre-Week Viva Active
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                        {sec.title}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
                        {sec.description || 'Review cohort baseline mastery and specific gaps before lecturing.'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{
                            width: '100%',
                            padding: '0.55rem 1rem',
                            fontSize: '0.88rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                          }}
                          onClick={() => setActiveInsightsSection(sec)}
                        >
                          <span>Open Lecture Focus Plan →</span>
                        </button>
                      ) : diagItem ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ width: '100%', padding: '0.55rem 1rem', fontSize: '0.88rem' }}
                          onClick={() => setActiveDiagnosticItem(diagItem)}
                        >
                          Take Pre-Week Viva Check →
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          No pre-week assessment configured
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {activeActivityModalSection && (
        <ModuleActivityModal
          section={activeActivityModalSection}
          onClose={() => setActiveActivityModalSection(null)}
          onCreated={() => loadModule()}
        />
      )}

      {activeQuizItem && (
        <ModuleQuizModal
          item={activeQuizItem}
          isAdmin={isAdmin}
          onClose={() => setActiveQuizItem(null)}
          onQuizCompleted={() => loadModule()}
        />
      )}

      {activeAssignmentItem && (
        <ModuleAssignmentModal
          item={activeAssignmentItem}
          isAdmin={isAdmin}
          onClose={() => setActiveAssignmentItem(null)}
          onSubmitted={() => loadModule()}
        />
      )}

      {activeSlideItem && (
        <ModuleSlideViewerModal
          item={activeSlideItem}
          onClose={() => setActiveSlideItem(null)}
        />
      )}

      {activeNoteItem && (
        <ModuleNoteModal
          item={activeNoteItem}
          onClose={() => setActiveNoteItem(null)}
        />
      )}

      {activeDiagnosticItem && (
        <PreWeekVivaModal
          item={activeDiagnosticItem}
          onClose={() => setActiveDiagnosticItem(null)}
          onCompleted={() => loadModule()}
        />
      )}

      {activeWeeklyVivaItem && (
        <WeeklyVivaModal
          item={activeWeeklyVivaItem}
          onClose={() => setActiveWeeklyVivaItem(null)}
          onCompleted={() => {
            loadModule();
            if (activeTab === 'grades') loadGrades();
          }}
        />
      )}

      {activeInsightsSection && (
        <LecturerInsightsModal
          moduleId={module.id}
          section={activeInsightsSection}
          onClose={() => setActiveInsightsSection(null)}
        />
      )}

      {/* Admin Written Exams & Presentation Grade Editor Modal */}
      {editingExamStudent && (
        <div className="modal-overlay" onClick={() => setEditingExamStudent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                  Record Physical Written Exam Marks
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Student: <strong>{editingExamStudent.student_name}</strong> ({editingExamStudent.student_code})
                </p>
              </div>
              <button type="button" className="btn-close" onClick={() => setEditingExamStudent(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveExamGrades}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.85rem', color: '#334155' }}>
                  <strong>Grading Breakdown Info:</strong>
                  <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
                    <li>Mid-Term Exam contributes <strong>25%</strong> of module grade.</li>
                    <li>End-Semester Exam contributes <strong>35%</strong> (Total 60% written).</li>
                    <li>Presentation Mark contributes <strong>15%</strong> (or falls back to quizzes).</li>
                  </ul>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Mid-Term Physical Written Exam Mark (0 - 100) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    className="form-input"
                    value={examForm.mid_exam_score}
                    onChange={(e) => setExamForm({ ...examForm, mid_exam_score: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    End-Semester Physical Written Exam Mark (0 - 100) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    className="form-input"
                    value={examForm.end_exam_score}
                    onChange={(e) => setExamForm({ ...examForm, end_exam_score: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Presentation Mark (0 - 100, Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="form-input"
                    placeholder="Leave empty to use student's Quiz Average instead"
                    value={examForm.presentation_score}
                    onChange={(e) => setExamForm({ ...examForm, presentation_score: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Lecturer Notes / Exam Feedback
                  </label>
                  <textarea
                    rows={2}
                    className="form-input"
                    placeholder="Optional notes or paper reference..."
                    value={examForm.notes}
                    onChange={(e) => setExamForm({ ...examForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingExamStudent(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingExam}>
                  {savingExam ? 'Saving & Recalculating...' : 'Save & Recalculate Final Grade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
