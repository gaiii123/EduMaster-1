import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import './SkillsHeatmap.css';

/**
 * Renders a radar / skills heatmap for a student's mastery scores.
 *
 * @param {{ scores: { mastery_logic_and_syntax, mastery_api_architecture,
 *           mastery_frontend_state, mastery_database_integration }, stage: string }} props
 */
function SkillsHeatmap({ scores, stage }) {
  const data = [
    { subject: 'Logic & Syntax', value: scores.mastery_logic_and_syntax },
    { subject: 'API Architecture', value: scores.mastery_api_architecture },
    { subject: 'Frontend State', value: scores.mastery_frontend_state },
    { subject: 'DB Integration', value: scores.mastery_database_integration },
  ];

  return (
    <div className="heatmap">
      <h3 className="heatmap__title">
        Skills Heatmap{stage ? ` — ${stage}` : ''}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar
            name="Mastery"
            dataKey="value"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.35}
          />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SkillsHeatmap;
