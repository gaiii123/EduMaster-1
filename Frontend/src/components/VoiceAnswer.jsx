import { useEffect, useRef, useState } from 'react';
import { transcribeAudio } from '../api/multimodal';
import { gradeSpoken } from '../api/learning';
import './VoiceAnswer.css';

const VERDICT_META = {
  correct: { label: 'Correct', className: 'correct', icon: '✅' },
  partial: { label: 'Partially correct', className: 'partial', icon: '🟡' },
  incorrect: { label: 'Needs work', className: 'incorrect', icon: '❌' },
};

/**
 * Voice answer widget — record a spoken answer with MediaRecorder,
 * transcribe it via SenseVoice, then let Qwen grade the transcript.
 */
function VoiceAnswer({ question }) {
  const [status, setStatus] = useState('idle'); // idle | recording | transcribing | grading | done | error
  const [transcript, setTranscript] = useState('');
  const [grade, setGrade] = useState(null);
  const [error, setError] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // Safety net: release the mic if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
    };
  }, []);

  async function startRecording() {
    setError(null);
    setTranscript('');
    setGrade(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 0) processRecording(blob);
        else {
          setStatus('error');
          setError('Nothing was recorded. Please try again.');
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setStatus('recording');
    } catch (err) {
      console.error('Microphone access failed:', err);
      setStatus('error');
      setError('Microphone access was blocked. Allow mic access to answer by voice.');
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    setStatus('transcribing');
  }

  async function processRecording(blob) {
    try {
      setStatus('transcribing');
      const { text } = await transcribeAudio(blob);
      if (!text || !text.trim()) {
        setStatus('error');
        setError('No speech was detected. Speak clearly and try again.');
        return;
      }
      setTranscript(text.trim());
      setStatus('grading');
      const result = await gradeSpoken(question, text.trim());
      setGrade(result);
      setStatus('done');
    } catch (err) {
      console.error('Voice grading failed:', err);
      setStatus('error');
      setError('Voice grading failed. Please try again.');
    }
  }

  const meta = grade ? VERDICT_META[grade.verdict] || VERDICT_META.partial : null;

  return (
    <div className="voice-answer">
      <div className="voice-answer__controls">
        {status === 'recording' ? (
          <button type="button" className="voice-answer__btn voice-answer__btn--stop" onClick={stopRecording}>
            ⏹ Stop recording
          </button>
        ) : (
          <button
            type="button"
            className="voice-answer__btn"
            onClick={startRecording}
            disabled={status === 'transcribing' || status === 'grading'}
          >
            🎙 {transcript ? 'Re-record answer' : 'Answer by voice'}
          </button>
        )}
        {status === 'recording' && <span className="voice-answer__pulse">Recording…</span>}
        {status === 'transcribing' && <span className="voice-answer__busy">Transcribing speech…</span>}
        {status === 'grading' && <span className="voice-answer__busy">AI is grading your answer…</span>}
      </div>

      {error && <p className="voice-answer__error">{error}</p>}

      {transcript && (
        <p className="voice-answer__transcript">
          <strong>You said:</strong> “{transcript}”
        </p>
      )}

      {grade && meta && (
        <div className={`voice-answer__feedback voice-answer__feedback--${meta.className}`}>
          <strong>
            {meta.icon} {meta.label}
          </strong>
          <span>{grade.feedback}</span>
        </div>
      )}
    </div>
  );
}

export default VoiceAnswer;
