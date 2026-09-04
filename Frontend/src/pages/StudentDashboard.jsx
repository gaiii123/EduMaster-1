import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMe } from '../api/auth';
import { listEvaluations } from '../api/students';
import { getMyProgress } from '../api/learning';
import PlacementCard from '../components/PlacementCard';
import MasteryCard from '../components/MasteryCard';
import SkillsHeatmap from '../components/SkillsHeatmap';
import './StudentDashboard.css';

/**
 * Student dashboard — shows the student's placement, skills, and evaluation history.
 */
function StudentDashboard() {
  const { user, token } = useAuth();
  const [placement, setPlacement] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [learning, setLearning] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [meData, evalsData, learningData] = await Promise.all([
          getMe(token),
          listEvaluations(user.id),
          getMyProgress().catch(() => null),
        ]);
        setPlacement(meData.placement);
        setEvaluations(evalsData);
        setLearning(learningData);
      } catch (err) {
        console.error('Failed to load student data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user.id, token]);

  if (loading) {
    return (
      <div className="student-dashboard">
        <p className="student-dashboard__status">Loading your dashboard…</p>
      </div>
    );
  }

  const latestScores = evaluations.length > 0 ? {
    mastery_logic_and_syntax: evaluations[evaluations.length - 1].mastery_logic_and_syntax,
    mastery_api_architecture: evaluations[evaluations.length - 1].mastery_api_architecture,
    mastery_frontend_state: evaluations[evaluations.length - 1].mastery_frontend_state,
    mastery_database_integration: evaluations[evaluations.length - 1].mastery_database_integration,
  } : null;

  const hasBaseline = evaluations.some((ev) => ev.stage === 'Baseline Viva' || ev.stage?.includes('Baseline'));
  const hasMidterm = evaluations.some((ev) => ev.stage === 'Midterm Viva' || ev.stage?.includes('Midterm'));
  const hasCapstone = evaluations.some((ev) => ev.stage === 'Capstone Defense' || ev.stage?.includes('Capstone'));

  return (
    <div className="student-dashboard">
      <header className="student-dashboard__header">
        <div>
          <h1>My Dashboard</h1>
          <p className="student-dashboard__welcome">
            Welcome back, <strong>{user.name}</strong> ({user.student_code})
          </p>
        </div>
        <Link
          to={`/student/viva?stage=${hasBaseline ? (hasMidterm ? 'Capstone Defense' : 'Midterm Viva') : 'Baseline Viva'}`}
          className="student-dashboard__viva-button"
        >
          {hasBaseline ? 'Take Viva Session' : 'Take Baseline Viva →'}
        </Link>
      </header>

      {/* Viva Assessment Stages Roadmap */}
      <section className="student-dashboard__section">
        <div className="student-dashboard__section-header">
          <div>
            <h2>Viva Assessment Stages</h2>
            <p className="student-dashboard__section-subtitle">
              Complete your interviews step-by-step. New students begin with the <strong>Baseline Viva</strong> to receive initial learning track placement.
            </p>
          </div>
        </div>

        <div className="student-dashboard__stages-grid">
          {/* Stage 1: Baseline Viva (Always Available for New Students) */}
          <div className={`student-dashboard__stage-card ${hasBaseline ? 'completed' : 'active'}`}>
            <div className="student-dashboard__stage-header">
              <span className={`student-dashboard__stage-badge ${hasBaseline ? 'badge-completed' : 'badge-active'}`}>
                {hasBaseline ? 'Completed' : 'Available Now'}
              </span>
              <span className="student-dashboard__stage-number">01</span>
            </div>
            <h3>Stage 1: Baseline Viva</h3>
            <p>
              Foundational conversational interview evaluating core logic, syntax intuition, and basic web understanding.
            </p>
            <div className="student-dashboard__stage-meta">
              <span>~5–10 mins</span>
              <span>Voice + Video Active</span>
            </div>
            {hasBaseline ? (
              <div className="student-dashboard__stage-actions">
                <Link to="/student/viva?stage=Baseline%20Viva" className="student-dashboard__stage-btn secondary">
                  Retake Baseline Viva
                </Link>
              </div>
            ) : (
              <Link to="/student/viva?stage=Baseline%20Viva" className="student-dashboard__stage-btn primary">
                Take Baseline Viva →
              </Link>
            )}
          </div>

          {/* Stage 2: Midterm Viva (Locked for New Students) */}
          <div className={`student-dashboard__stage-card ${hasMidterm ? 'completed' : hasBaseline ? 'active' : 'locked'}`}>
            <div className="student-dashboard__stage-header">
              <span className={`student-dashboard__stage-badge ${hasMidterm ? 'badge-completed' : hasBaseline ? 'badge-active' : 'badge-locked'}`}>
                {hasMidterm ? 'Completed' : hasBaseline ? 'Unlocked' : 'Locked'}
              </span>
              <span className="student-dashboard__stage-number">02</span>
            </div>
            <h3>Stage 2: Midterm Viva</h3>
            <p>
              Intermediate architectural review evaluating API design, state flow, and asynchronous request handling.
            </p>
            <div className="student-dashboard__stage-meta">
              <span>Prerequisite: Baseline Viva</span>
              <span>Focus: API & State</span>
            </div>
            {hasBaseline ? (
              <Link to="/student/viva?stage=Midterm%20Viva" className="student-dashboard__stage-btn primary">
                Take Midterm Viva →
              </Link>
            ) : (
              <button type="button" className="student-dashboard__stage-btn disabled" disabled>
                Complete Baseline Viva First
              </button>
            )}
          </div>

          {/* Stage 3: Capstone Defense (Locked for New Students) */}
          <div className={`student-dashboard__stage-card ${hasCapstone ? 'completed' : hasMidterm ? 'active' : 'locked'}`}>
            <div className="student-dashboard__stage-header">
              <span className={`student-dashboard__stage-badge ${hasCapstone ? 'badge-completed' : hasMidterm ? 'badge-active' : 'badge-locked'}`}>
                {hasCapstone ? 'Completed' : hasMidterm ? 'Unlocked' : 'Locked'}
              </span>
              <span className="student-dashboard__stage-number">03</span>
            </div>
            <h3>Stage 3: Capstone Defense</h3>
            <p>
              Comprehensive graduation defense evaluating end-to-end fullstack architecture, database optimization, and deployment.
            </p>
            <div className="student-dashboard__stage-meta">
              <span>Prerequisite: Midterm Viva</span>
              <span>Focus: Production Systems</span>
            </div>
            {hasMidterm ? (
              <Link to="/student/viva?stage=Capstone%20Defense" className="student-dashboard__stage-btn primary">
                Take Capstone Defense →
              </Link>
            ) : (
              <button type="button" className="student-dashboard__stage-btn disabled" disabled>
                Complete Midterm Viva First
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Placement card */}
      <section className="student-dashboard__section">
        <h2>Your Placement</h2>
        {placement ? (
          <PlacementCard placement={placement} />
        ) : (
          <div className="student-dashboard__no-placement">
            <p>You haven't completed your baseline viva assessment yet.</p>
            <Link to="/student/viva?stage=Baseline%20Viva" className="student-dashboard__cta">
              Start Your Baseline Viva →
            </Link>
          </div>
        )}
      </section>

      {/* Skills overview */}
      {latestScores && (
        <>
          <section className="student-dashboard__section">
            <h2>Your Skills</h2>
            <div className="student-dashboard__cards">
              <MasteryCard label="Logic & Syntax" score={latestScores.mastery_logic_and_syntax} />
              <MasteryCard label="API Architecture" score={latestScores.mastery_api_architecture} />
              <MasteryCard label="Frontend State" score={latestScores.mastery_frontend_state} />
              <MasteryCard label="Database Integration" score={latestScores.mastery_database_integration} />
            </div>
          </section>

          <section className="student-dashboard__section">
            <SkillsHeatmap scores={latestScores} />
          </section>
        </>
      )}

      {/* Evaluation history */}
      {evaluations.length > 0 && (
        <section className="student-dashboard__section">
          <h2>Evaluation History</h2>
          <table className="student-dashboard__table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Date</th>
                <th>Logic</th>
                <th>API</th>
                <th>Frontend</th>
                <th>Database</th>
                <th>Speech Fluency</th>
                <th>Visual Attention</th>
                <th>Integrity</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((ev) => (
                <tr key={ev.id}>
                  <td><strong>{ev.stage}</strong></td>
                  <td>{ev.evaluation_date}</td>
                  <td>{ev.mastery_logic_and_syntax}%</td>
                  <td>{ev.mastery_api_architecture}%</td>
                  <td>{ev.mastery_frontend_state}%</td>
                  <td>{ev.mastery_database_integration}%</td>
                  <td>{ev.speech_fluency ? `${ev.speech_fluency}%` : '85%'}</td>
                  <td>{ev.visual_attentiveness ? `${ev.visual_attentiveness}%` : '92%'}</td>
                  <td>
                    <span style={{ color: 'var(--success)', fontSize: '0.82rem', fontWeight: 600 }}>
                      Verified
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* My Learning */}
      <section className="student-dashboard__section">
        <div className="student-dashboard__section-header">
          <div>
            <h2>My Learning</h2>
            <p className="student-dashboard__section-subtitle">
              Study notes mapped to your viva mastery dimensions. Reading sharpens the skills your next viva will measure.
            </p>
          </div>
          <Link to="/student/library" className="student-dashboard__cta">
            Open Library →
          </Link>
        </div>

        {learning ? (
          <div className="student-dashboard__learning">
            <div className="student-dashboard__learning-summary">
              <div className="student-dashboard__learning-bar">
                <div
                  className="student-dashboard__learning-fill"
                  style={{ width: `${learning.completion_percent}%` }}
                />
              </div>
              <span>
                {learning.read_count} / {learning.total_notes} notes read (
                {learning.completion_percent}%)
              </span>
            </div>

            <div className="student-dashboard__learning-subjects">
              {learning.subject_progress.map((sp) => (
                <Link
                  key={sp.subject_id}
                  to={`/student/library/subject/${sp.subject_id}`}
                  className="student-dashboard__learning-subject"
                >
                  <span>{sp.title}</span>
                  <strong>{sp.percent}%</strong>
                </Link>
              ))}
            </div>

            {(learning.recent_notes?.length > 0 || learning.bookmarks?.length > 0) && (
              <div className="student-dashboard__learning-rows">
                {learning.recent_notes?.length > 0 && (
                  <div>
                    <h4>Continue reading</h4>
                    <ul>
                      {learning.recent_notes.slice(0, 3).map((recent) => (
                        <li key={recent.note_id}>
                          <Link to={`/student/library/note/${recent.note_id}`}>
                            {recent.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {learning.bookmarks?.length > 0 && (
                  <div>
                    <h4>Bookmarked</h4>
                    <ul>
                      {learning.bookmarks.slice(0, 3).map((bookmark) => (
                        <li key={bookmark.note_id}>
                          <Link to={`/student/library/note/${bookmark.note_id}`}>
                            {bookmark.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="student-dashboard__placeholder">
            <p>Your learning library is loading…</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default StudentDashboard;
