import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listModules, createModule, enrollModule, deleteModule } from '../api/modules';
import './CourseOverview.css';

const BANNER_THEMES = [
  { id: 'networking', label: 'Networking (Blue/Cyan)' },
  { id: 'database', label: 'Big Data / Database (Emerald)' },
  { id: 'blue', label: 'Advanced DB (Royal Blue)' },
  { id: 'purple', label: 'Academic Literacy (Purple)' },
  { id: 'internship', label: 'Internship / Career (Teal)' },
  { id: 'code', label: 'Software Dev (Indigo)' },
  { id: 'orange', label: 'Systems & Cloud (Amber)' },
];

export default function CourseOverview() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';

  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create module form state
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLevel, setNewLevel] = useState('Level I');
  const [newYear, setNewYear] = useState('23/24');
  const [newPattern, setNewPattern] = useState('networking');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [enrollingId, setEnrollingId] = useState(null);

  useEffect(() => {
    fetchModules();
  }, []);

  async function fetchModules() {
    try {
      const data = await listModules();
      setModules(data);
    } catch (err) {
      console.error('Failed to load modules:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnroll(moduleId) {
    setEnrollingId(moduleId);
    try {
      await enrollModule(moduleId);
      await fetchModules();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to enroll in module.');
    } finally {
      setEnrollingId(null);
    }
  }

  async function handleDeleteModule(moduleId, title) {
    if (!window.confirm(`Are you sure you want to delete "${title}" and all its sections, quizzes, and materials?`)) {
      return;
    }
    try {
      await deleteModule(moduleId);
      setModules((prev) => prev.filter((m) => m.id !== moduleId));
    } catch (err) {
      console.error(err);
      alert('Failed to delete module.');
    }
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    if (!newCode.trim() || !newTitle.trim()) {
      setCreateError('Module code and title are required.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const created = await createModule({
        code: newCode.trim(),
        title: newTitle.trim(),
        description: newDesc.trim(),
        level: newLevel,
        academic_year: newYear,
        banner_pattern: newPattern,
        is_published: true,
      });
      setShowCreateModal(false);
      // Reset form
      setNewCode('');
      setNewTitle('');
      setNewDesc('');
      // Navigate straight to module editor
      navigate(`/modules/${created.id}`);
    } catch (err) {
      console.error(err);
      setCreateError(err.response?.data?.detail || 'Failed to create module.');
    } finally {
      setCreating(false);
    }
  }

  // Filter and sort modules
  const filteredModules = useMemo(() => {
    return modules
      .filter((m) => {
        // Status filter
        if (statusFilter === 'Enrolled' && !m.is_enrolled) return false;
        if (statusFilter === 'Available' && m.is_enrolled) return false;

        // Level filter
        if (levelFilter !== 'All' && m.level !== levelFilter) return false;

        // Search query
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchTitle = m.title?.toLowerCase().includes(q);
          const matchCode = m.code?.toLowerCase().includes(q);
          const matchDesc = m.description?.toLowerCase().includes(q);
          if (!matchTitle && !matchCode && !matchDesc) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.title.localeCompare(b.title);
        } else if (sortBy === 'code') {
          return a.code.localeCompare(b.code);
        }
        return 0;
      });
  }, [modules, search, levelFilter, statusFilter, sortBy]);

  function getThemeIcon(pattern) {
    return null;
  }

  if (loading) {
    return (
      <div className="course-overview-page" style={{ textAlign: 'center', padding: '4rem' }}>
        <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Loading course catalog…</p>
      </div>
    );
  }

  return (
    <div className="course-overview-page">
      {/* Top Welcome / Greeting Banner (Image 1 Style) */}
      <div className="overview-welcome-header">
        {!isAdmin ? (
          <div className="overview-greeting">
            <span>Hi, {user?.student_code || 'IM/2021/097'} - {user?.name || 'STUDENT'}!</span>
          </div>
        ) : (
          <div className="overview-admin-bar">
            <div className="overview-admin-title">
              <h1>Course & Module Management</h1>
              <p>Create university modules, add lecture slides, notes, assignments, and quizzes</p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.75rem 1.4rem', fontSize: '0.95rem' }}
              onClick={() => setShowCreateModal(true)}
            >
              Create Module
            </button>
          </div>
        )}
      </div>

      {/* Main Course Overview Box */}
      <div className="overview-card-container">
        <h2 className="overview-section-title">Course overview</h2>

        {/* Filter Controls Bar */}
        <div className="overview-filter-bar">
          {!isAdmin && (
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Courses</option>
              <option value="Enrolled">In progress (Enrolled)</option>
              <option value="Available">Available to Enroll</option>
            </select>
          )}

          <select
            className="filter-select"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="All">All Levels</option>
            <option value="Level I">Level I</option>
            <option value="Level II">Level II</option>
            <option value="Level III">Level III</option>
            <option value="Miscellaneous">Miscellaneous</option>
          </select>

          <div className="search-input-wrapper">
            <span className="search-icon"></span>
            <input
              type="text"
              className="search-input"
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name">Sort by course name</option>
            <option value="code">Sort by course code</option>
          </select>
        </div>

        {/* Course Cards Grid */}
        {filteredModules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No modules found matching your criteria.</p>
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: '0.75rem' }}
                onClick={() => setShowCreateModal(true)}
              >
                Create Your First Module
              </button>
            )}
          </div>
        ) : (
          <div className="course-cards-grid">
            {filteredModules.map((module) => {
              const theme = module.banner_pattern || 'networking';
              return (
                <div key={module.id} className="course-card">
                  {/* Status badge */}
                  {!isAdmin && (
                    <span
                      className={`course-card-status-badge ${
                        module.is_enrolled ? 'status-badge--enrolled' : 'status-badge--open'
                      }`}
                    >
                      {module.is_enrolled ? '✓ Enrolled' : 'Open'}
                    </span>
                  )}

                  {/* Banner illustration */}
                  <div className={`course-card-banner banner-pattern--${theme}`}>
                    <div className="banner-graphic" />
                  </div>

                  {/* Card Body */}
                  <div className="course-card-body">
                    <div className="course-card-level">
                      {module.level} • {module.academic_year}
                    </div>

                    <h3 className="course-card-title">
                      {module.code} - {module.title}
                    </h3>

                    <p className="course-card-desc">
                      {module.description || 'Comprehensive curriculum covering lectures, practical exercises, and assessments.'}
                    </p>

                    <div className="course-card-meta-row">
                      <span>{module.section_count || 0} Sections</span>
                      <span>{module.item_count || 0} Activities</span>
                      <span>{module.enrolled_count || 0} Enrolled</span>
                    </div>

                    <div className="course-card-actions">
                      {isAdmin ? (
                        <>
                          <Link
                            to={`/modules/${module.id}`}
                            className="btn-card-action btn-card-action--enter"
                          >
                            Manage Course →
                          </Link>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '0.55rem 0.75rem' }}
                            title="Delete module"
                            onClick={() => handleDeleteModule(module.id, module.title)}
                          >
                            Delete
                          </button>
                        </>
                      ) : module.is_enrolled ? (
                        <Link
                          to={`/modules/${module.id}`}
                          className="btn-card-action btn-card-action--enter"
                        >
                          Enter Course →
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="btn-card-action btn-card-action--enroll"
                          disabled={enrollingId === module.id}
                          onClick={() => handleEnroll(module.id)}
                        >
                          {enrollingId === module.id ? 'Enrolling...' : 'Enroll Now'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Create Module Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <span>Create New Module</span>
              </div>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {createError && (
                  <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#dc2626', borderRadius: 8, fontSize: '0.9rem' }}>
                    {createError}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Module Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. NET 101"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Academic Year</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 23/24"
                      value={newYear}
                      onChange={(e) => setNewYear(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Module Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Networking 1"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Level / Category</label>
                    <select
                      className="form-select"
                      value={newLevel}
                      onChange={(e) => setNewLevel(e.target.value)}
                    >
                      <option value="Level I">Level I</option>
                      <option value="Level II">Level II</option>
                      <option value="Level III">Level III</option>
                      <option value="Level IV">Level IV</option>
                      <option value="Miscellaneous">Miscellaneous</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Banner Theme</label>
                    <select
                      className="form-select"
                      value={newPattern}
                      onChange={(e) => setNewPattern(e.target.value)}
                    >
                      {BANNER_THEMES.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Syllabus Overview</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Enter course description and objectives..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create & Open Module →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
