import api from './evaluation';

/**
 * Student roster + placement drill-down.
 */

/** All students with a placement snapshot. */
export async function listStudents() {
  const { data } = await api.get('/api/students');
  return data;
}

/** Enrol a new student. */
export async function createStudent({ name, email, studentCode, password }) {
  const { data } = await api.post('/api/students', {
    name,
    email,
    student_code: studentCode,
    password,
  });
  return data;
}

/** Full drill-down: student + placement + evaluation history. */
export async function getStudent(id) {
  const { data } = await api.get(`/api/students/${id}`);
  return data;
}

/** Raw evaluation history (ascending). */
export async function listEvaluations(id) {
  const { data } = await api.get(`/api/students/${id}/evaluations`);
  return data;
}
