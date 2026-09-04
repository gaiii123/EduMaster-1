"""
Alibaba Cloud Multimodal Router — Speech & Vision processing for EduMaster Viva.

Alibaba Tools Integrated
------------------------
1. Alibaba SenseVoice / Paraformer (ASR):
   - Model: 'sensevoice-v1' or 'paraformer-v1' via `dashscope.audio.asr.Recognition`
   - Transcribes student spoken answers and detects speech emotion/fluency.
2. Alibaba CosyVoice (TTS):
   - Model: 'cosyvoice-v1' via `dashscope.audio.tts_v2.SpeechSynthesizer`
   - Synthesizes the AI Examiner's spoken questions and feedback in natural voice.
3. Alibaba Qwen-VL / Qwen2.5-VL (Vision & Proctoring):
   - Model: 'qwen-vl-max' or 'qwen2.5-vl-72b-instruct' via `dashscope.MultiModalConversation`
   - Inspects candidate webcam video frames for attentiveness, eye contact,
     confidence, and authenticity (proctoring validation).

Dual Mode Support
-----------------
If DASHSCOPE_API_KEY is not configured or USE_MOCK_AI=true, the router switches
seamlessly to deterministic mock mode so local frontend development is never blocked.
"""

import io
import os
import re
import json
import wave
import math
import struct
import random
import logging
import tempfile
from typing import Optional

from fastapi import APIRouter, File, UploadFile, HTTPException, Response
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/multimodal",
    tags=["multimodal"],
)

# ============================================================
#  Constants (Alibaba Cloud Model Studio Singapore / ap-southeast-1)
# ============================================================

ASR_MODEL = "qwen-omni-turbo"  # Live Multimodal Audio ASR
TTS_MODEL = "qwen3-tts-flash"  # Live expressive text-to-speech
VISION_MODEL = "qwen-vl-max"    # Live visual analysis & proctoring
DEFAULT_VOICE = "Cherry"        # Natural bilingual female voice ("Ethan" for male)


def _use_mock() -> bool:
    if os.getenv("USE_MOCK_AI", "").lower() in ("1", "true", "yes"):
        return True
    key = (os.getenv("DASHSCOPE_API_KEY") or "").strip()
    return not key or key == "your_api_key_here"


def _init_dashscope() -> str:
    import dashscope
    key = (os.getenv("DASHSCOPE_API_KEY") or "").strip()
    dashscope.api_key = key
    if key.startswith("sk-ws-") or os.getenv("DASHSCOPE_INTL", "").lower() in ("1", "true", "yes"):
        dashscope.base_http_api_url = "https://dashscope-intl.aliyuncs.com/api/v1"
        dashscope.base_websocket_api_url = "wss://dashscope-intl.aliyuncs.com/api-ws/v1/inference"
    return key


# ============================================================
#  Schemas
# ============================================================

class TranscribeResponse(BaseModel):
    status: str
    text: str = Field(..., description="Transcribed student answer.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="ASR confidence score.")
    speech_fluency: int = Field(..., ge=0, le=100, description="Fluency score (0-100).")
    detected_emotion: str = Field("neutral", description="Detected voice emotion/tone.")
    model: str = Field(..., description="Model that processed the audio.")


class TranscribeBase64Request(BaseModel):
    audio: str = Field(..., description="Base64 encoded audio string (or data:audio/... URL).")
    format: Optional[str] = Field("webm", description="Audio format, e.g. 'webm', 'wav', 'mp3'.")


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Text to speak.")
    voice: Optional[str] = Field(DEFAULT_VOICE, description="CosyVoice voice name.")
    speech_rate: Optional[float] = Field(1.0, ge=0.5, le=2.0)


class FrameAnalysisRequest(BaseModel):
    frame: str = Field(..., description="Base64 encoded JPEG or PNG image string.")
    stage: str = Field("Baseline Viva", description="Current viva lifecycle stage.")
    question: Optional[str] = Field("", description="Current question being answered.")


class FrameAnalysisResponse(BaseModel):
    status: str
    visual_attentiveness: int = Field(..., ge=0, le=100, description="Attentiveness score (0-100).")
    visual_confidence: int = Field(..., ge=0, le=100, description="Composure & confidence score (0-100).")
    authenticity_status: str = Field(..., description="'verified' or 'flagged'")
    observations: str = Field(..., description="Visual assessment notes.")
    model: str = Field(..., description="Model that evaluated the frame.")


class MultimodalStatusResponse(BaseModel):
    dashscope_configured: bool
    mode: str
    asr_model: str
    tts_model: str
    vision_model: str
    default_voice: str


# ============================================================
#  Audio Synthesis Helper (Mock fallback)
# ============================================================

def _generate_mock_audio_wav(duration_ms: int = 1500) -> bytes:
    """Generate a clean dual-tone soundwave to simulate spoken audio in mock mode."""
    buf = io.BytesIO()
    sample_rate = 16000
    num_samples = int(sample_rate * (duration_ms / 1000.0))
    w = wave.open(buf, "wb")
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(sample_rate)

    # Harmonics of pleasant bell/voice tone (440Hz + 880Hz)
    for i in range(num_samples):
        t = float(i) / sample_rate
        decay = math.exp(-2.5 * t)
        val = 0.3 * math.sin(2 * math.pi * 440 * t) + 0.15 * math.sin(2 * math.pi * 880 * t)
        sample = int(32767.0 * val * decay)
        sample = max(-32768, min(32767, sample))
        w.writeframes(struct.pack("<h", sample))

    w.close()
    return buf.getvalue()


# ============================================================
#  1. Speech-to-Text Endpoint (Alibaba SenseVoice)
# ============================================================

def _transcribe_audio_bytes(contents: bytes, ext: str = ".webm") -> TranscribeResponse:
    """Core logic to transcribe audio bytes using Alibaba Qwen-Omni / Qwen-Audio ASR."""
    if _use_mock():
        mock_answers = [
            "In React, state management helps keep components synchronized with user interactions.",
            "A RESTful API uses standard HTTP methods like GET, POST, PUT, and DELETE to manage resources.",
            "Relational databases maintain data integrity using foreign keys, ACID transactions, and indexes.",
            "Dependency injection decouples components and improves testability across modular services.",
            "Asynchronous functions prevent blocking the main event loop when handling network I/O.",
        ]
        chosen = random.choice(mock_answers)
        return TranscribeResponse(
            status="success",
            text=chosen,
            confidence=0.96,
            speech_fluency=random.randint(84, 96),
            detected_emotion="confident",
            model="mock-asr",
        )

    tmp_path = None
    try:
        api_key = _init_dashscope()
        clean_ext = ext if ext.startswith(".") else f".{ext}"
        with tempfile.NamedTemporaryFile(suffix=clean_ext, delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        norm_p = tmp_path.replace("\\", "/")
        if not norm_p.startswith("/"):
            norm_p = "/" + norm_p
        audio_uri = f"file://{norm_p}"

        # 1. Primary: Alibaba Qwen-Omni-Turbo (direct multimodal audio transcription)
        try:
            from dashscope import MultiModalConversation
            omni_res = MultiModalConversation.call(
                model=ASR_MODEL,
                messages=[{
                    "role": "user",
                    "content": [
                        {"audio": audio_uri},
                        {"text": "Transcribe the spoken audio verbatim in English. Output ONLY the plain transcription text, with no preamble or explanations."}
                    ]
                }],
                result_format="message",
                api_key=api_key
            )
            if omni_res.status_code == 200 and omni_res.output:
                raw_text = omni_res.output.choices[0].message.content
                if isinstance(raw_text, list):
                    raw_text = "".join(part.get("text", "") for part in raw_text if isinstance(part, dict))
                clean_text = str(raw_text or "").strip()
                # Remove quotes if wrapped
                if clean_text.startswith('"') and clean_text.endswith('"'):
                    clean_text = clean_text[1:-1].strip()
                if clean_text and clean_text.lower() != "silence":
                    # Estimate fluency based on word flow
                    word_count = len(clean_text.split())
                    fluency = min(98, max(75, 80 + min(word_count, 15)))
                    return TranscribeResponse(
                        status="success",
                        text=clean_text,
                        confidence=0.95,
                        speech_fluency=fluency,
                        detected_emotion="confident" if fluency > 88 else "thoughtful",
                        model=ASR_MODEL,
                    )
        except Exception as omni_err:
            logger.warning(f"Qwen-Omni ASR notice: {omni_err}")

        # 2. Secondary fallback: Qwen-Audio-3.0 streaming recognition
        try:
            from dashscope.audio.asr import Recognition, RecognitionCallback

            class AsrCallback(RecognitionCallback):
                def __init__(self):
                    self.sentences = []
                def on_open(self): pass
                def on_complete(self): pass
                def on_error(self, result): pass
                def on_event(self, result): pass

            cb = AsrCallback()
            fmt = clean_ext.replace(".", "").lower()
            if fmt not in ["pcm", "wav", "mp3", "opus", "speex", "aac", "amr"]:
                fmt = "wav"

            recognition = Recognition(
                model="qwen-audio-3.0-asr-flash-streaming",
                callback=cb,
                format=fmt,
                sample_rate=16000,
            )
            result = recognition.call(file=tmp_path)
            raw_sentences = result.get_sentence() if result and hasattr(result, "get_sentence") else []
            sentences = raw_sentences if isinstance(raw_sentences, list) else []
            sec_text = " ".join([s.get("text", "") for s in sentences if isinstance(s, dict) and s.get("text")]).strip()
            if sec_text:
                return TranscribeResponse(
                    status="success",
                    text=sec_text,
                    confidence=0.92,
                    speech_fluency=88,
                    detected_emotion="neutral",
                    model="qwen-audio-3.0-asr-flash-streaming",
                )
        except Exception as asr_err:
            logger.warning(f"Qwen-Audio streaming ASR notice: {asr_err}")

        return TranscribeResponse(
            status="warning",
            text="Could not fully transcribe audio. Please review or type your answer.",
            confidence=0.5,
            speech_fluency=70,
            detected_emotion="neutral",
            model=f"{ASR_MODEL}-fallback",
        )
    except Exception as e:
        logger.error(f"Alibaba ASR error: {e}", exc_info=True)
        return TranscribeResponse(
            status="warning",
            text="Audio transcription error. Please type your answer.",
            confidence=0.5,
            speech_fluency=70,
            detected_emotion="neutral",
            model=f"{ASR_MODEL}-error",
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe a student's spoken viva answer using Alibaba SenseVoice via multipart file.
    Accepts webm, wav, mp3, or m4a audio recording.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty audio recording submitted.")

    filename = file.filename or "recording.webm"
    ext = os.path.splitext(filename)[1] or ".webm"
    return _transcribe_audio_bytes(contents, ext)


@router.post("/transcribe-base64", response_model=TranscribeResponse)
async def transcribe_audio_base64(payload: TranscribeBase64Request):
    """
    Transcribe a student's spoken viva answer using Alibaba SenseVoice via Base64.
    """
    if not payload.audio:
        raise HTTPException(status_code=400, detail="Empty base64 audio data.")

    import base64
    raw_b64 = payload.audio
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",", 1)[1]

    try:
        audio_bytes = base64.b64decode(raw_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio: {e}")

    ext = f".{payload.format or 'webm'}"
    return _transcribe_audio_bytes(audio_bytes, ext)


# ============================================================
#  2. Text-to-Speech Endpoint (Alibaba CosyVoice)
# ============================================================

@router.post("/synthesize")
async def synthesize_speech(payload: SynthesizeRequest):
    """
    Synthesize the AI Examiner's question or feedback into natural human speech
    using Alibaba Qwen3-TTS-Flash. Returns streaming audio (WAV or MP3).
    """
    if _use_mock():
        audio_bytes = _generate_mock_audio_wav(duration_ms=1800)
        return Response(content=audio_bytes, media_type="audio/wav")

    api_key = _init_dashscope()

    # Clean text to strip excessive formatting or icons
    clean_text = re.sub(r"^[🔎⚠️•❓\s*]+", "", payload.text)
    clean_text = clean_text.replace("**", "").replace("`", "").strip()
    if not clean_text:
        clean_text = "Welcome to EduMaster. Let's begin the viva session."

    # Validate voice name for Qwen3-TTS
    valid_voices = {"Cherry", "Ethan", "Serena", "Chelsie", "Dylan"}
    chosen_voice = payload.voice if payload.voice in valid_voices else DEFAULT_VOICE

    # 1. Primary: Alibaba Qwen3-TTS via MultiModalConversation (International Model Studio)
    try:
        import requests
        from dashscope import MultiModalConversation

        tts_res = MultiModalConversation.call(
            model=TTS_MODEL,
            text=clean_text,
            voice=chosen_voice,
            language_type="English",
            api_key=api_key,
        )
        if tts_res.status_code == 200 and hasattr(tts_res, "output") and tts_res.output:
            audio_dict = getattr(tts_res.output, "audio", {})
            audio_url = audio_dict.get("url") if isinstance(audio_dict, dict) else getattr(audio_dict, "url", None)
            if audio_url:
                r = requests.get(audio_url, timeout=12)
                if r.status_code == 200 and r.content:
                    return Response(content=r.content, media_type="audio/x-wav")
        else:
            logger.warning(f"Alibaba Qwen3-TTS notice: status={tts_res.status_code}, msg={getattr(tts_res, 'message', '')}")
    except Exception as tts_err:
        logger.warning(f"Alibaba Qwen3-TTS-Flash exception: {tts_err}")

    fallback_wav = _generate_mock_audio_wav(duration_ms=1200)
    return Response(content=fallback_wav, media_type="audio/wav")


# ============================================================
#  3. Video Frame Analysis Endpoint (Alibaba Qwen-VL)
# ============================================================

@router.post("/analyze-frame", response_model=FrameAnalysisResponse)
async def analyze_video_frame(payload: FrameAnalysisRequest):
    """
    Analyze student video frame snapshot from webcam using Alibaba Qwen-VL.
    Evaluates attentiveness, eye contact, posture, and proctoring authenticity.
    """
    if not payload.frame:
        raise HTTPException(status_code=400, detail="Empty frame snapshot provided.")

    if _use_mock():
        rng = random.Random()
        attentiveness = rng.randint(84, 98)
        confidence = rng.randint(80, 94)
        return FrameAnalysisResponse(
            status="success",
            visual_attentiveness=attentiveness,
            visual_confidence=confidence,
            authenticity_status="verified",
            observations="Candidate is facing camera directly, attentive posture, no external distractions detected.",
            model="mock-qwen-vl",
        )

    tmp_image_path = None
    try:
        from dashscope import MultiModalConversation
        import base64

        raw_b64 = payload.frame
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]

        image_bytes = base64.b64decode(raw_b64)
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_img:
            tmp_img.write(image_bytes)
            tmp_image_path = tmp_img.name

        prompt = (
            f"You are an AI Viva Proctor and Visual Evaluator at an IT institute. "
            f"Current Stage: {payload.stage}. Question context: {payload.question or 'Technical interview question'}.\n"
            "Evaluate this candidate's video snapshot for:\n"
            "1. Attentiveness & eye contact (0-100 integer score)\n"
            "2. Visual composure and confidence (0-100 integer score)\n"
            "3. Authenticity / proctoring status ('verified' if single learner focused, 'flagged' if multiple persons or suspicious screen usage)\n"
            "4. 1-2 sentence constructive observation.\n\n"
            "Respond ONLY with a JSON object in this exact format:\n"
            '{"visual_attentiveness": 90, "visual_confidence": 85, "authenticity_status": "verified", "observations": "..."}'
        )

        norm_p = tmp_image_path.replace("\\", "/")
        if not norm_p.startswith("/"):
            norm_p = "/" + norm_p
        img_url = f"file://{norm_p}"

        messages = [
            {
                "role": "user",
                "content": [
                    {"image": img_url},
                    {"text": prompt},
                ],
            }
        ]

        api_key = _init_dashscope()
        response = MultiModalConversation.call(
            api_key=api_key,
            model=VISION_MODEL,
            messages=messages,
            result_format="message",
        )

        if response.status_code != 200:
            raise ValueError(f"Qwen-VL error: {response.message}")

        resp_text = response.output.choices[0].message.content
        if isinstance(resp_text, list):
            resp_text = "".join([part.get("text", "") for part in resp_text])

        s_idx = resp_text.find("{")
        e_idx = resp_text.rfind("}")
        if s_idx != -1 and e_idx > s_idx:
            data = json.loads(resp_text[s_idx:e_idx + 1])
            return FrameAnalysisResponse(
                status="success",
                visual_attentiveness=max(0, min(100, int(data.get("visual_attentiveness", 85)))),
                visual_confidence=max(0, min(100, int(data.get("visual_confidence", 80)))),
                authenticity_status=str(data.get("authenticity_status", "verified")).lower(),
                observations=str(data.get("observations", "Candidate is engaged with the interview.")),
                model=VISION_MODEL,
            )
        else:
            raise ValueError("No JSON payload in Qwen-VL response")

    except Exception as e:
        logger.error(f"Alibaba Qwen-VL frame analysis error: {e}", exc_info=True)
        return FrameAnalysisResponse(
            status="fallback",
            visual_attentiveness=88,
            visual_confidence=82,
            authenticity_status="verified",
            observations="Candidate is present and engaged in the viva session.",
            model=f"{VISION_MODEL}-fallback",
        )
    finally:
        if tmp_image_path and os.path.exists(tmp_image_path):
            try:
                os.remove(tmp_image_path)
            except OSError:
                pass


# ============================================================
#  4. Status & Diagnostic Endpoint
# ============================================================

@router.get("/status", response_model=MultimodalStatusResponse)
async def get_multimodal_status():
    """Returns current Alibaba Cloud AI tools configuration status."""
    is_mock = _use_mock()
    return MultimodalStatusResponse(
        dashscope_configured=not is_mock,
        mode="mock" if is_mock else "production",
        asr_model=ASR_MODEL,
        tts_model=TTS_MODEL,
        vision_model=VISION_MODEL,
        default_voice=DEFAULT_VOICE,
    )
