import api from './evaluation';

/**
 * Module & Course Management API Client
 */

export async function listModules(params = {}) {
  const { data } = await api.get('/api/modules', { params });
  return data;
}

export async function createModule(payload) {
  const { data } = await api.post('/api/modules', payload);
  return data;
}

export async function getModule(moduleId) {
  const { data } = await api.get(`/api/modules/${moduleId}`);
  return data;
}

export async function updateModule(moduleId, payload) {
  const { data } = await api.put(`/api/modules/${moduleId}`, payload);
  return data;
}

export async function deleteModule(moduleId) {
  await api.delete(`/api/modules/${moduleId}`);
}

export async function enrollModule(moduleId, studentId = null) {
  const params = studentId ? { student_id: studentId } : {};
  const { data } = await api.post(`/api/modules/${moduleId}/enroll`, null, { params });
  return data;
}

export async function unenrollModule(moduleId, studentId = null) {
  const params = studentId ? { student_id: studentId } : {};
  const { data } = await api.post(`/api/modules/${moduleId}/unenroll`, null, { params });
  return data;
}

export async function listParticipants(moduleId) {
  const { data } = await api.get(`/api/modules/${moduleId}/participants`);
  return data;
}

export async function createSection(moduleId, payload) {
  const { data } = await api.post(`/api/modules/${moduleId}/sections`, payload);
  return data;
}

export async function updateSection(sectionId, payload) {
  const { data } = await api.put(`/api/modules/sections/${sectionId}`, payload);
  return data;
}

export async function deleteSection(sectionId) {
  await api.delete(`/api/modules/sections/${sectionId}`);
}

export async function createItem(sectionId, payload) {
  const { data } = await api.post(`/api/modules/sections/${sectionId}/items`, payload);
  return data;
}

export async function updateItem(itemId, payload) {
  const { data } = await api.put(`/api/modules/items/${itemId}`, payload);
  return data;
}

export async function deleteItem(itemId) {
  await api.delete(`/api/modules/items/${itemId}`);
}

export async function uploadModuleFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/api/modules/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function submitQuiz(itemId, answers) {
  const { data } = await api.post(`/api/modules/items/${itemId}/quiz/submit`, { answers });
  return data;
}

export async function submitAssignment(itemId, payload) {
  const { data } = await api.post(`/api/modules/items/${itemId}/assignment/submit`, payload);
  return data;
}

export async function listAssignmentSubmissions(itemId) {
  const { data } = await api.get(`/api/modules/items/${itemId}/assignment/submissions`);
  return data;
}

export async function gradeAssignment(itemId, payload) {
  const { data } = await api.post(`/api/modules/items/${itemId}/assignment/grade`, payload);
  return data;
}

export async function getModuleGrades(moduleId) {
  const { data } = await api.get(`/api/modules/${moduleId}/grades`);
  return data;
}
