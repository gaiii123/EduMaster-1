import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listStudents, getStudent } from '../api/students';
import SkillsHeatmap from '../components/SkillsHeatmap';
import MasteryCard from '../components/MasteryCard';
import PlacementCard from '../components/PlacementCard';
import './Dashboard.css';

/**
 * Admin drill-down: pick a student to view their AI placement, skills heatmap,
 * mastery cards and full evaluation history (the continuous re-grading loop).
 */
function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const selectedId = searchParams.get('student');

  // Load the roster once.
  useEffect(() => {
    listStudents()
      .then(setStudents)
      .catch(() => setError('Could not reach the backend. Is it running on :8000?'))
      .finally(() => setLoading(false));
  }, []);

  // Default to the first student when none is selected.
  useEffect(() => {
    if (!selectedId && students.length > 0) {
      setSearchParams({ student: students[0].id }, { replace: true });
    }
  }, [students, selectedId, setSearchParams]);

  // Load the selected student's detail.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    getStudent(selectedId)
      .then((data) => !cancelled && setDetail(data))
      .catch(() => !cancelled && setError('Failed to load student detail.'));
    return () => { cancelled = true; };
  }, [selectedId]);

  const latestScores = useMemo(() => {
    const evals = detail?.evaluations ?? [];
    if (evals.length === 0) return null;
    const last = evals[evals.length - 1];
    return {
      mastery_logic_and_syntax: last.mastery_logic_and_syntax,
      mastery_api_architecture: last.mastery_api_architecture,
      mastery_frontend_state: last.mastery_frontend_state,
      mastery_database_integration: last.mastery_database_integration,
    };
  }, [detail]);

  const latestStage = useMemo(() => {
    const evals = detail?.evaluations ?? [];
    return evals.length ? evals[evals.length - 1].stage : null;
  }, [detail]);

  if (loading) return <div className="dashboard"><p className="dashboard__status">Loading…</p></div>;

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <h1>Lecturer Dashboard</h1>
          <p className="dashboard__subtitle">
            Per-student AI placement, skills heatmap & longitudinal re-grading
          </p>
        </div>

        {students.length > 0 && (
          <select
            className="dashboard__select"
            value={selectedId ?? ''}
            onChange={(e) => {
              setError(null);
              setSearchParams({ student: e.target.value });
            }}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.student_code})
              </option>
            ))}
          </select>
        )}
      </header>

      {error && <div className="dashboard__error">{error}</div>}

      {!detail && !error && (
        <p className="dashboard__status">
          No students yet. <Link to="/students">Enrol a student</Link> to see their placement here once they take their Baseline Viva.
        </p>
      )}

      {detail && (
        <>
          {/* Placement decision */}
          <section className="dashboard__placement">
            <PlacementCard placement={detail.placement} />
          </section>

          {latestScores ? (
            <>
              {/* Mastery cards row */}
              <section className="dashboard__cards">
                <MasteryCard label="Logic & Syntax" score={latestScores.mastery_logic_and_syntax} />
                <MasteryCard label="API Architecture" score={latestScores.mastery_api_architecture} />
                <MasteryCard label="Frontend State" score={latestScores.mastery_frontend_state} />
                <MasteryCard label="Database Integration" score={latestScores.mastery_database_integration} />
              </section>

              {/* Radar chart */}
              <section className="dashboard__chart">
                <SkillsHeatmap scores={latestScores} stage={latestStage} />
              </section>

              {/* Stage history (the re-grading loop) */}
              <section className="dashboard__history">
                <h2>Evaluation History</h2>
                <table className="dashboard__table">
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th>Date</th>
                      <th>Logic</th>
                      <th>API</th>
                      <th>Frontend</th>
                      <th>Database</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.evaluations.map((ev) => (
                      <tr key={ev.id}>
                        <td>{ev.stage}</td>
                        <td>{ev.evaluation_date}</td>
                        <td>{ev.mastery_logic_and_syntax}</td>
                        <td>{ev.mastery_api_architecture}</td>
                        <td>{ev.mastery_frontend_state}</td>
                        <td>{ev.mastery_database_integration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          ) : (
            <p className="dashboard__status">
              This student has no evaluations yet. Once they take their Baseline Viva, their placement will appear here.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;
