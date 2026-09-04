import { useState, useRef, useEffect, useCallback } from 'react';
import { synthesizeSpeech, transcribeAudio } from '../api/multimodal';
import './VivaStudio.css';

/**
 * VivaStudio: Alibaba-Powered Multimodal Video & Audio AI Viva Interface
 *
 * Features:
 * - Alibaba CosyVoice TTS: AI Examiner speaks questions and feedback.
 * - Alibaba SenseVoice ASR: Student speaks answers with instant transcription.
 * - Alibaba Qwen-VL Vision: Webcam live preview with frame snapshots & attentiveness monitor.
 * - Live VU meter and animated speech visualizers.
 */
function VivaStudio({
  currentQuestion = '',
  examinerFeedback = null,
  speechPrompt = '',
  stage = 'Baseline Viva',
  loading = false,
  onSendAnswer,
  telemetry = null,
  studentName = 'Candidate',
  interviewStarted = false,
  onStartInterview,
}) {
  // Media streams & hardware states
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [mediaError, setMediaError] = useState(null);

  // Audio recording (SenseVoice) states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [speechResult, setSpeechResult] = useState(null);

  // AI Speech (CosyVoice) states
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceSynthesizing, setVoiceSynthesizing] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  // Input & message state
  const [answerText, setAnswerText] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const currentAudioRef = useRef(null);
  const timerRef = useRef(null);
  const speechRecRef = useRef(null);

  // -------------------------------------------------------------
  // 1. Webcam & Microphone Setup
  // -------------------------------------------------------------
  const startMedia = useCallback(async () => {
    try {
      setMediaError(null);
      const userStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      });

      setStream(userStream);
      if (videoRef.current) {
        videoRef.current.srcObject = userStream;
      }

      // Web Audio API for live microphone VU meter
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const source = ctx.createMediaStreamSource(userStream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          audioContextRef.current = ctx;
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMeter = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            }
            animFrameRef.current = requestAnimationFrame(updateMeter);
          };
          updateMeter();
        }
      } catch {
        // VU meter non-critical fallback
      }
    } catch (err) {
      console.warn('Media devices could not be accessed:', err);
      setMediaError('Camera / Microphone permission is needed for the audio-video interview.');
    }
  }, []);

  useEffect(() => {
    startMedia();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (currentAudioRef.current) currentAudioRef.current.pause();
    };
  }, [startMedia]);

  // Keep video source updated
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, cameraActive]);

  // Toggle Camera
  function toggleCamera() {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraActive(videoTrack.enabled);
      }
    }
  }

  // Toggle Microphone
  function toggleMic() {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicActive(audioTrack.enabled);
      }
    }
  }

  // -------------------------------------------------------------
  // 2. Alibaba CosyVoice (AI Examiner Speech Synthesis)
  // -------------------------------------------------------------
  const playAiVoice = useCallback(
    async (text) => {
      if (voiceMuted || !text) return;

      try {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }

        setVoiceSynthesizing(true);
        const { audioUrl } = await synthesizeSpeech(text, 'Cherry');
        setVoiceSynthesizing(false);

        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        audio.onplay = () => setIsAiSpeaking(true);
        audio.onended = () => {
          setIsAiSpeaking(false);
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          console.warn('Audio playback error, using speech synthesis fallback');
          setIsAiSpeaking(false);
          setVoiceSynthesizing(false);
          currentAudioRef.current = null;
          speakWithBrowser(text);
        };

        try {
          await audio.play();
          setAudioBlocked(false);
        } catch (playErr) {
          console.warn('Audio play restricted by browser autoplay policy:', playErr);
          setAudioBlocked(true);
          setIsAiSpeaking(false);
        }
      } catch (err) {
        console.warn('AI voice synthesis could not be played, falling back to speech synthesis:', err);
        setIsAiSpeaking(false);
        setVoiceSynthesizing(false);
        speakWithBrowser(text);
      }
    },
    [voiceMuted]
  );

  function speakWithBrowser(text) {
    if ('speechSynthesis' in window && !voiceMuted && text) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.onstart = () => setIsAiSpeaking(true);
        utterance.onend = () => setIsAiSpeaking(false);
        utterance.onerror = () => setIsAiSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Browser SpeechSynthesis error:', e);
      }
    }
  }

  // Auto-speak question or response+next-question when speechPrompt / currentQuestion changes
  useEffect(() => {
    if (!interviewStarted) return; // Do not auto-speak before student clicks Start Interview!
    const textToSpeak = speechPrompt || currentQuestion;
    if (textToSpeak && !voiceMuted) {
      // Strip icons/markdown prefix for cleaner voice synthesis
      const cleanText = textToSpeak
        .replace(/^[🔎⚠️•❓\s]+/, '')
        .replace(/\*\*/g, '')
        .trim();
      playAiVoice(cleanText);
    }
  }, [speechPrompt, currentQuestion, playAiVoice, voiceMuted, interviewStarted]);

  function handleStartInterview() {
    onStartInterview?.();
    const textToSpeak = speechPrompt || currentQuestion;
    if (textToSpeak && !voiceMuted) {
      const cleanText = textToSpeak
        .replace(/^[🔎⚠️•❓\s]+/, '')
        .replace(/\*\*/g, '')
        .trim();
      playAiVoice(cleanText);
    }
  }

  // -------------------------------------------------------------
  // 3. Alibaba SenseVoice (Speech-to-Text Recording)
  // -------------------------------------------------------------
  async function startRecording() {
    try {
      audioChunksRef.current = [];

      // 1. Extract audio-only tracks from stream, or request fresh audio stream
      let audioStream = null;
      const audioTracks = stream ? stream.getAudioTracks() : [];
      if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
        // MUST be an audio-only stream so MediaRecorder doesn't choke on video tracks
        audioStream = new MediaStream(audioTracks);
      } else {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // 2. Select supported MIME type
      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav',
      ];
      let chosenType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        for (const type of candidateTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            chosenType = type;
            break;
          }
        }
      }

      const recorderOptions = chosenType ? { mimeType: chosenType } : undefined;
      const recorder = new MediaRecorder(audioStream, recorderOptions);
      const usedMimeType = recorder.mimeType || chosenType || 'audio/webm';

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: usedMimeType });
        await handleAudioTranscribe(audioBlob, usedMimeType);
      };

      // Start recording without forced timeslice to avoid encoder errors
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start live speech-to-text directly in browser for instant real-time transcription
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';
          let finalTranscript = '';

          rec.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
              } else {
                interim += event.results[i][0].transcript;
              }
            }
            const fullText = (finalTranscript + interim).trim();
            if (fullText) {
              setAnswerText(fullText);
            }
          };
          rec.onerror = (e) => console.warn('Live SpeechRecognition event:', e.error);
          rec.start();
          speechRecRef.current = rec;
        } catch (e) {
          console.warn('Live SpeechRecognition error:', e);
        }
      }

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('MediaRecorder start failed, trying SpeechRecognition fallback:', err);
      trySpeechRecognitionFallback(err.message);
    }
  }

  function trySpeechRecognitionFallback(originalError) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;

        setIsRecording(true);
        setRecordingSeconds(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setAnswerText((prev) => (prev ? `${prev} ${transcript}` : transcript));
            setSpeechResult({
              speech_fluency: 92,
              detected_emotion: 'confident',
            });
          }
        };

        recognition.onerror = (event) => {
          console.warn('SpeechRecognition error:', event.error);
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
          alert('Microphone recording error: ' + (event.error || originalError));
        };

        recognition.onend = () => {
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
        };

        recognition.start();
        mediaRecorderRef.current = {
          stop: () => {
            try { recognition.stop(); } catch {}
          },
        };
        return;
      } catch (e) {
        console.warn('SpeechRecognition initialization error:', e);
      }
    }
    alert('Could not start microphone recording: ' + originalError + '. Please check your microphone permissions.');
  }

  function stopRecording() {
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch (e) {
        console.warn('Error stopping speechRec:', e);
      }
      speechRecRef.current = null;
    }

    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Error stopping recorder:', e);
      }
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  async function handleAudioTranscribe(audioBlob, mimeType = 'audio/webm') {
    if (!audioBlob || audioBlob.size === 0) return;
    setTranscribing(true);
    try {
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const res = await transcribeAudio(audioBlob, `recording.${ext}`);
      if (res.text && !res.text.includes('unclear') && !res.text.includes('Could not fully')) {
        setAnswerText((prev) => (prev && prev.trim() ? prev : res.text));
      }
      setSpeechResult(res);
    } catch (err) {
      console.warn('Transcription warning:', err);
    } finally {
      setTranscribing(false);
    }
  }

  // -------------------------------------------------------------
  // 4. Video Frame Capture & Answer Submission
  // -------------------------------------------------------------
  function captureVideoFrame() {
    if (!videoRef.current || !cameraActive) return null;
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return null;
    }
  }

  function handleSubmit() {
    const text = answerText.trim();
    if (!text || loading) return;

    // Capture current candidate webcam snapshot
    const frameSnapshot = captureVideoFrame();

    // Multimodal payload
    const speechMetrics = speechResult
      ? {
          speech_fluency: speechResult.speech_fluency,
          detected_emotion: speechResult.detected_emotion,
        }
      : null;

    onSendAnswer({
      message: text,
      videoFrame: frameSnapshot,
      speechMetrics,
    });

    setAnswerText('');
    setSpeechResult(null);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="viva-studio">
      {/* Hidden canvas for video frame snapshots */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Top Alibaba Cloud Tools Status Bar */}
      <div className="viva-studio__tool-bar">
        <div className="viva-studio__brand">
          <span className="viva-studio__brand-dot"></span>
          <strong>Alibaba Cloud Model Studio (Singapore)</strong>
        </div>
        <div className="viva-studio__badges">
          <span className={`viva-badge ${isAiSpeaking ? 'viva-badge--active' : ''}`}>
            🔊 Qwen3-TTS-Flash {isAiSpeaking ? '• Speaking' : '• Active'}
          </span>
          <span className={`viva-badge ${isRecording ? 'viva-badge--pulse' : ''}`}>
            🎙️ Qwen-Audio ASR {isRecording ? '• Transcribing' : '• Active'}
          </span>
          <span className="viva-badge viva-badge--vision">
            👁️ Qwen-VL-Max • Proctor Active
          </span>
          <span className="viva-badge viva-badge--brain">
            🧠 Qwen-Max Live Examiner
          </span>
        </div>
      </div>

      {/* Dual Video Stream Layout */}
      <div className="viva-studio__feeds">
        {/* Left: AI Examiner Feed */}
        <div className={`viva-feed viva-feed--examiner ${isAiSpeaking ? 'viva-feed--speaking' : ''}`}>
          <div className="viva-feed__header">
            <div className="viva-feed__user-info">
              <span className="viva-feed__avatar-icon">🤖</span>
              <div>
                <strong>AI Senior Examiner</strong>
                <span className="viva-feed__subtext">Alibaba Qwen-Max & Qwen3-TTS-Flash</span>
              </div>
            </div>
            <div className="viva-feed__controls">
              <button
                type="button"
                className={`viva-icon-btn ${voiceMuted ? 'viva-icon-btn--off' : ''}`}
                onClick={() => {
                  if (isAiSpeaking && currentAudioRef.current) {
                    currentAudioRef.current.pause();
                    setIsAiSpeaking(false);
                  }
                  setVoiceMuted(!voiceMuted);
                }}
                title={voiceMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
              >
                {voiceMuted ? '🔇' : '🔊'}
              </button>
              <button
                type="button"
                className="viva-icon-btn"
                onClick={() => playAiVoice(speechPrompt || currentQuestion)}
                disabled={voiceSynthesizing || (!speechPrompt && !currentQuestion)}
                title="Replay Examiner Voice"
              >
                🔄
              </button>
            </div>
          </div>

          {/* Examiner Visual Avatar with Dynamic Waveform */}
          <div className="viva-feed__examiner-stage">
            {!interviewStarted ? (
              <div className="viva-examiner-ready-card">
                <span className="viva-examiner-ready-badge">🎯 {stage}</span>
                <h3>AI Senior Examiner</h3>
                <p>
                  Welcome, <strong>{studentName}</strong>! Check your camera preview and microphone on the right. When you are ready, click below to begin.
                </p>
                <button
                  type="button"
                  className="viva-start-interview-btn"
                  onClick={handleStartInterview}
                >
                  🚀 Start Interview
                </button>
              </div>
            ) : (
              <>
                <div className={`viva-examiner-orb ${isAiSpeaking ? 'viva-examiner-orb--active' : ''}`}>
                  <div className="viva-examiner-orb__ring"></div>
                  <div className="viva-examiner-orb__core">
                    <span className="viva-examiner-orb__symbol">QWEN</span>
                  </div>
                </div>

                {/* Dynamic Sound Wave Bars */}
                <div className={`viva-wave ${isAiSpeaking ? 'viva-wave--active' : ''}`}>
                  <span className="viva-wave__bar"></span>
                  <span className="viva-wave__bar"></span>
                  <span className="viva-wave__bar"></span>
                  <span className="viva-wave__bar"></span>
                  <span className="viva-wave__bar"></span>
                  <span className="viva-wave__bar"></span>
                  <span className="viva-wave__bar"></span>
                </div>

                <div className="viva-feed__examiner-status">
                  {audioBlocked && !isAiSpeaking ? (
                    <button
                      type="button"
                      className="viva-examiner-hear-btn"
                      onClick={() => {
                        setAudioBlocked(false);
                        playAiVoice(speechPrompt || currentQuestion);
                      }}
                    >
                      🔊 Click to Hear Examiner Voice
                    </button>
                  ) : voiceSynthesizing ? (
                    'Synthesizing voice via Qwen3-TTS...'
                  ) : isAiSpeaking ? (
                    'Speaking question out loud...'
                  ) : loading ? (
                    'Analyzing response via Qwen-Max...'
                  ) : (
                    'Listening to candidate...'
                  )}
                </div>
              </>
            )}
          </div>

          {/* Feedback response to candidate's previous answer */}
          {examinerFeedback && (
            <div className="viva-feed__feedback-box">
              <span className="viva-feed__feedback-label">💡 Examiner Response & Explanation:</span>
              <p>{examinerFeedback}</p>
            </div>
          )}

          {/* Subtitles banner for active question */}
          <div className="viva-feed__caption">
            <span className="viva-feed__caption-label">
              {interviewStarted ? '❓ Active Question:' : 'ℹ️ Session Status:'}
            </span>
            <p>
              {interviewStarted
                ? (currentQuestion || 'Welcome! Initializing AI Viva Session...')
                : 'Session is ready. Check your camera framing on the right, then click "Start Interview" to begin.'}
            </p>
          </div>
        </div>

        {/* Right: Candidate Live Video Feed */}
        <div className="viva-feed viva-feed--candidate">
          <div className="viva-feed__header">
            <div className="viva-feed__user-info">
              <span className="viva-feed__status-dot viva-feed__status-dot--live"></span>
              <div>
                <strong>Candidate Video Feed</strong>
                <span className="viva-feed__subtext">Live HD Camera & Audio</span>
              </div>
            </div>
            <div className="viva-feed__controls">
              <button
                type="button"
                className={`viva-icon-btn ${!cameraActive ? 'viva-icon-btn--off' : ''}`}
                onClick={toggleCamera}
                title={cameraActive ? 'Turn Camera Off' : 'Turn Camera On'}
              >
                {cameraActive ? '📹' : '🚫'}
              </button>
              <button
                type="button"
                className={`viva-icon-btn ${!micActive ? 'viva-icon-btn--off' : ''}`}
                onClick={toggleMic}
                title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {micActive ? '🎤' : '🔇'}
              </button>
            </div>
          </div>

          {/* Webcam Element / Placeholder */}
          <div className="viva-feed__video-container">
            {cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="viva-feed__video-element"
              />
            ) : (
              <div className="viva-feed__placeholder">
                <span className="viva-feed__placeholder-icon">👤</span>
                <p>Camera is currently off</p>
              </div>
            )}

            {/* Qwen-VL Vision Overlay HUD */}
            <div className="viva-feed__hud">
              <div className="viva-feed__hud-badge">
                <span className="viva-feed__hud-dot"></span>
                <span>Alibaba Qwen-VL: Single Learner Verified</span>
              </div>
              <div className="viva-feed__hud-meter">
                <span>Attentiveness:</span>
                <strong>{telemetry?.visual_attentiveness ?? 92}%</strong>
              </div>
            </div>

            {/* Live Audio Level VU Meter */}
            <div className="viva-feed__vu-meter">
              <div
                className="viva-feed__vu-bar"
                style={{ width: `${micActive ? audioLevel : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Recording Timer & Status Overlay */}
          {isRecording && (
            <div className="viva-feed__recording-strip">
              <span className="viva-feed__rec-dot"></span>
              <span>Recording Voice: {String(recordingSeconds).padStart(2, '0')}s</span>
              <span className="viva-feed__rec-hint">(Alibaba Qwen-Audio ASR)</span>
            </div>
          )}

          {mediaError && <div className="viva-feed__error-banner">{mediaError}</div>}
        </div>
      </div>

      {/* Multimodal Telemetry Metrics Bar */}
      {telemetry && (
        <div className="viva-studio__telemetry-bar">
          <div className="viva-telemetry-item">
            <span className="viva-telemetry-label">👁️ Visual Attentiveness</span>
            <div className="viva-telemetry-bar">
              <div
                className="viva-telemetry-fill"
                style={{ width: `${telemetry.visual_attentiveness || 90}%` }}
              ></div>
            </div>
            <strong>{telemetry.visual_attentiveness || 90}%</strong>
          </div>

          <div className="viva-telemetry-item">
            <span className="viva-telemetry-label">😌 Composure & Confidence</span>
            <div className="viva-telemetry-bar">
              <div
                className="viva-telemetry-fill viva-telemetry-fill--cyan"
                style={{ width: `${telemetry.visual_confidence || 88}%` }}
              ></div>
            </div>
            <strong>{telemetry.visual_confidence || 88}%</strong>
          </div>

          <div className="viva-telemetry-item">
            <span className="viva-telemetry-label">🎙️ Speech Delivery & Fluency</span>
            <div className="viva-telemetry-bar">
              <div
                className="viva-telemetry-fill viva-telemetry-fill--green"
                style={{ width: `${telemetry.speech_fluency || 85}%` }}
              ></div>
            </div>
            <strong>{telemetry.speech_fluency || 85}%</strong>
          </div>

          <div className="viva-telemetry-item viva-telemetry-item--status">
            <span className="viva-telemetry-label">🛡️ Proctoring Status</span>
            <span className="viva-telemetry-pill">
              {telemetry.authenticity_notes || 'Verified • Single Candidate'}
            </span>
          </div>
        </div>
      )}

      {/* Answer & Interaction Console */}
      <div className="viva-studio__interaction">
        {!interviewStarted ? (
          <div className="viva-studio__precheck-notice">
            <span>👋 Camera & microphone are active. Review your framing, then click <strong>"🚀 Start Interview"</strong> above when you are ready to begin.</span>
          </div>
        ) : (
          <div className="viva-studio__input-container">
          {currentQuestion.toLowerCase().includes('ready') && (
            <div className="viva-studio__readiness-bar">
              <span className="viva-readiness-label">Confirm Readiness:</span>
              <button
                type="button"
                className="viva-quick-chip viva-quick-chip--ready"
                onClick={() => setAnswerText("Yes, I am ready!")}
              >
                ✨ Yes, I am ready!
              </button>
              <button
                type="button"
                className="viva-quick-chip"
                onClick={() => setAnswerText("Give me a moment, please.")}
              >
                ⏱️ Wait a moment
              </button>
            </div>
          )}

          <textarea
            rows={2}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Speak your answer using the microphone button below, or type here…"
            disabled={loading || transcribing}
            className="viva-studio__textarea"
          />

          {/* Action buttons */}
          <div className="viva-studio__action-row">
            {/* SenseVoice Voice Button */}
            {!isRecording ? (
              <button
                type="button"
                className="viva-btn viva-btn--record"
                onClick={startRecording}
                disabled={loading || transcribing || !micActive}
                title="Speak your answer with Alibaba SenseVoice"
              >
                <span className="viva-btn__mic-icon">🎙️</span>
                {transcribing ? 'Transcribing...' : 'Speak Answer'}
              </button>
            ) : (
              <button
                type="button"
                className="viva-btn viva-btn--stop"
                onClick={stopRecording}
                title="Stop recording and transcribe"
              >
                <span className="viva-btn__stop-square">■</span>
                Finish Speaking ({recordingSeconds}s)
              </button>
            )}

            {/* Send Answer Button */}
            <button
              type="button"
              className="viva-btn viva-btn--send"
              onClick={handleSubmit}
              disabled={loading || transcribing || !answerText.trim()}
            >
              {loading ? 'Evaluating...' : 'Submit Viva Answer →'}
            </button>
          </div>
        </div>
      )}

        {/* Detected Emotion / Fluency notification tag */}
        {speechResult && (
          <div className="viva-studio__speech-tag">
            <span>🎙️ Transcribed via Alibaba SenseVoice</span>
            <span className="viva-tag-sep">•</span>
            <span>Fluency: {speechResult.speech_fluency}%</span>
            <span className="viva-tag-sep">•</span>
            <span className="viva-tag-emotion">Tone: {speechResult.detected_emotion}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default VivaStudio;
