import api from './evaluation';

/**
 * Send a turn in the pre-week diagnostic AI viva.
 * @param {number} itemId
 * @param {{ message: string, history: Array<{role: string, content: string}>, finish_early?: boolean }} payload
 */
export async function sendDiagnosticTurn(itemId, payload) {
  const res = await api.post(`/api/modules/items/${itemId}/viva/chat`, payload);
  return res.data;
}

/**
 * Retrieve the current student's completed diagnostic evaluation for an item.
 * @param {number} itemId
 */
export async function getMyDiagnosticResult(itemId) {
  const res = await api.get(`/api/modules/items/${itemId}/viva/my-result`);
  return res.data;
}

/**
 * Retrieve cohort lecture prep intelligence for a section/week (Lecturer/Admin).
 * @param {number} moduleId
 * @param {number} sectionId
 */
export async function getSectionLecturerInsights(moduleId, sectionId) {
  const res = await api.get(`/api/modules/${moduleId}/sections/${sectionId}/lecturer-insights`);
  return res.data;
}

/**
 * Send a turn in the post-lecture weekly AI knowledge check viva (Graded 10%).
 * @param {number} itemId
 * @param {{ message: string, history: Array<{role: string, content: string}>, finish_early?: boolean }} payload
 */
export async function sendWeeklyVivaTurn(itemId, payload) {
  const res = await api.post(`/api/modules/items/${itemId}/weekly-viva/chat`, payload);
  return res.data;
}

/**
 * Retrieve the current student's completed post-lecture weekly viva evaluation.
 * @param {number} itemId
 */
export async function getMyWeeklyVivaResult(itemId) {
  const res = await api.get(`/api/modules/items/${itemId}/weekly-viva/my-result`);
  return res.data;
}

/**
 * Send a turn in the assignment AI viva defense.
 * @param {number} submissionId
 * @param {{ message: string, history: Array<{role: string, content: string}>, finish_early?: boolean }} payload
 */
export async function sendAssignmentDefenseTurn(submissionId, payload) {
  const res = await api.post(`/api/modules/submissions/${submissionId}/defense/chat`, payload);
  return res.data;
}

/**
 * Admin / Lecturer updates physical written exam marks (Mid, End) and presentation scores.
 * @param {number} moduleId
 * @param {number} studentId
 * @param {{ mid_exam_score: number, end_exam_score: number, presentation_score?: number, notes?: string }} payload
 */
export async function updateStudentExamGrades(moduleId, studentId, payload) {
  const res = await api.post(`/api/modules/${moduleId}/grades/exams/${studentId}`, payload);
  return res.data;
}

