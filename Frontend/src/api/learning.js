import api from './evaluation';

/**
 * Learning library API client — subjects, notes, quizzes, progress, bookmarks.
 *
 * All endpoints are student-scoped; the Authorization header is set globally
 * via setAuthToken() after login.
 */

/** All subjects with note counts and the student's read counts. */
export async function listSubjects() {
  const { data } = await api.get('/api/learning/subjects');
  return data;
}

/** One subject with its ordered notes (+ per-note read/bookmark flags). */
export async function getSubject(subjectId) {
  const { data } = await api.get(`/api/learning/subjects/${subjectId}`);
  return data;
}

/** Full note content with its quiz (correct answers withheld). */
export async function getNote(noteId) {
  const { data } = await api.get(`/api/learning/notes/${noteId}`);
  return data;
}

/** Mark a note as read (idempotent upsert). */
export async function markRead(noteId) {
  const { data } = await api.post(`/api/learning/notes/${noteId}/read`);
  return data;
}

/** Toggle the bookmark flag for a note. */
export async function toggleBookmark(noteId) {
  const { data } = await api.post(`/api/learning/notes/${noteId}/bookmark`);
  return data;
}

/**
 * Submit quiz answers for grading.
 * @param {number} noteId
 * @param {Array<{question_id: number, selected_option: number}>} answers
 */
export async function submitQuiz(noteId, answers) {
  const { data } = await api.post(`/api/learning/notes/${noteId}/quiz`, { answers });
  return data;
}

/** Aggregated progress: completion %, bookmarks, recent notes. */
export async function getMyProgress() {
  const { data } = await api.get('/api/learning/my-progress');
  return data;
}

/** Search notes by title/summary/content. */
export async function searchNotes(query) {
  const { data } = await api.get('/api/learning/search', { params: { q: query } });
  return data;
}

/* ------------------------------------------------------------------
 * AI study tools (Alibaba Cloud Qwen / Qwen-VL, mock-mode fallback)
 * ------------------------------------------------------------------ */

/** Qwen writes a full note + quiz on a topic; returns the new note id. */
export async function generateNote(subjectId, topic) {
  const { data } = await api.post('/api/learning/ai/generate-note', {
    subject_id: subjectId,
    topic,
  });
  return data;
}

/** Ask the Socratic study coach about a note. */
export async function coachAsk(noteId, question, history = []) {
  const { data } = await api.post('/api/learning/ai/coach', {
    note_id: noteId,
    question,
    history,
  });
  return data;
}

/** Fresh AI-generated practice MCQs for a note. */
export async function generatePractice(noteId, count = 5) {
  const { data } = await api.post('/api/learning/ai/practice', {
    note_id: noteId,
    count,
  });
  return data;
}

/** Quick-revision digest: summary bullets + flashcards. */
export async function getDigest(noteId) {
  const { data } = await api.get(`/api/learning/ai/digest/${noteId}`);
  return data;
}

/** Grade a transcribed spoken answer. */
export async function gradeSpoken(question, answerText) {
  const { data } = await api.post('/api/learning/ai/grade-spoken', {
    question,
    answer_text: answerText,
  });
  return data;
}

/** Qwen-VL converts a photo of handwritten notes to Markdown (draft). */
export async function photoToNote(imageBase64, subjectId) {
  const { data } = await api.post('/api/learning/ai/photo-note', {
    image_base64: imageBase64,
    subject_id: subjectId,
  });
  return data;
}

/** Save the confirmed photo conversion into the library. */
export async function savePhotoNote(subjectId, title, summary, content) {
  const { data } = await api.post('/api/learning/ai/photo-note/save', {
    subject_id: subjectId,
    title,
    summary,
    content,
  });
  return data;
}
