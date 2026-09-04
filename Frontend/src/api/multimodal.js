import axios from 'axios';
import config from '../config';

const api = axios.create({
  baseURL: config.apiBaseUrl,
});

/**
 * Transcribe candidate audio using Alibaba SenseVoice via multipart form upload.
 * @param {Blob|File} audioBlob - Audio recording from browser MediaRecorder
 * @returns {Promise<{status: string, text: string, confidence: number, speech_fluency: number, detected_emotion: string, model: string}>}
 */
export async function transcribeAudio(audioBlob, filename = 'recording.webm') {
  const formData = new FormData();
  formData.append('file', audioBlob, filename);

  const { data } = await api.post('/api/multimodal/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Transcribe candidate audio using Alibaba SenseVoice via Base64.
 * @param {string} base64Audio - Base64 audio string or data URL
 * @param {string} [format='webm'] - Audio format extension
 */
export async function transcribeAudioBase64(base64Audio, format = 'webm') {
  const { data } = await api.post('/api/multimodal/transcribe-base64', {
    audio: base64Audio,
    format,
  });
  return data;
}

/**
 * Synthesize AI examiner text into speech using Alibaba CosyVoice.
 * Returns an audio Blob or Object URL that can be played in HTML5 Audio.
 * @param {string} text - The question or feedback text to speak
 * @param {string} [voice='longxiaochun'] - CosyVoice voice
 * @param {number} [speechRate=1.0] - Speech rate (0.5 - 2.0)
 * @returns {Promise<{audioBlob: Blob, audioUrl: string}>}
 */
export async function synthesizeSpeech(text, voice = 'longxiaochun', speechRate = 1.0) {
  const response = await api.post(
    '/api/multimodal/synthesize',
    { text, voice, speech_rate: speechRate },
    { responseType: 'blob' }
  );

  const audioBlob = new Blob([response.data], {
    type: response.headers['content-type'] || 'audio/mpeg',
  });
  const audioUrl = URL.createObjectURL(audioBlob);
  return { audioBlob, audioUrl };
}

/**
 * Analyze a video frame snapshot using Alibaba Qwen-VL.
 * @param {string} frame - Base64 image data URL (e.g. from canvas.toDataURL('image/jpeg'))
 * @param {string} [stage='Baseline Viva'] - Viva lifecycle stage
 * @param {string} [question=''] - Current question text
 * @returns {Promise<{status: string, visual_attentiveness: number, visual_confidence: number, authenticity_status: string, observations: string, model: string}>}
 */
export async function analyzeVideoFrame(frame, stage = 'Baseline Viva', question = '') {
  const { data } = await api.post('/api/multimodal/analyze-frame', {
    frame,
    stage,
    question,
  });
  return data;
}

/**
 * Get Alibaba Cloud AI tools configuration status.
 */
export async function getMultimodalStatus() {
  const { data } = await api.get('/api/multimodal/status');
  return data;
}

export default api;
