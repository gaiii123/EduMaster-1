import axios from 'axios';
import config from '../config';

const api = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((req) => {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  if (token && !req.headers.Authorization) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

/**
 * Evaluate a student's viva answer via the AI.
 *
 * @param {object} args
 * @param {string} args.message        – the student's answer
 * @param {number|null} [args.studentId] – attach to a student to persist & re-place
 * @param {string} [args.stage]        – 'Baseline Viva' | 'Formative Check-in' | 'Capstone Defense'
 * @param {Array<{role: string, content: string}>} [args.history] – recent transcript
 * @returns {Promise<{
 *   status: string, model: string, evaluation: string,
 *   scores: Record<string, number>, follow_up_question: string|null,
 *   misconceptions: string[], evaluation_id: number|null,
 *   placement: object|null, request_id: string|null
 * }>}
 */
export async function evaluateStudent({
  message,
  studentId = null,
  stage = 'Baseline Viva',
  history = [],
  videoFrame = null,
  speechMetrics = null,
}) {
  const { data } = await api.post('/api/evaluate', {
    message,
    student_id: studentId,
    stage,
    history,
    video_frame: videoFrame,
    speech_metrics: speechMetrics,
  });
  return data;
}

export default api;
