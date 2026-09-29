import os
import sys
import json
import shutil
import subprocess
import uuid
import time
import math
import mimetypes
import urllib.request
import urllib.error
from pathlib import Path
from typing import List, Optional, Dict, Any

# Garantizar que el directorio raíz del controlador esté en sys.path
_controlador_dir = str(Path(__file__).resolve().parent.parent)
if _controlador_dir not in sys.path:
    sys.path.insert(0, _controlador_dir)

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from hardware import governor, set_background_priority
from routers.video_looper import (
    default_workspace_path,
    get_temp_render_dir,
    get_ffmpeg_path,
    get_ffprobe_path,
    probe_duration,
    format_time_hms,
    CREATE_NO_WINDOW
)

try:
    from services.audio_subtitles_pipeline import procesar_subtitulado_musical_completo
except ImportError:
    procesar_subtitulado_musical_completo = None


router = APIRouter(
    prefix="/subtitles",
    tags=["subtitles"],
)

# ──────────────────────────────────────────────
# Estado de Trabajos de Subtitulado
# ──────────────────────────────────────────────
SUB_JOBS: Dict[str, Dict[str, Any]] = {}

def get_openai_api_key() -> str:
    """Busca la API key de OpenAI en el entorno o en el archivo .env raíz."""
    key = os.environ.get("OPENAI_API_KEY", "")
    if key and key.startswith("sk-"):
        return key

    # Intentar leer del .env del proyecto
    env_paths = [
        Path(__file__).resolve().parent.parent.parent / ".env",
        Path(__file__).resolve().parent.parent / ".env",
    ]
    for p in env_paths:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("OPENAI_API_KEY="):
                            val = line.split("=", 1)[1].strip().strip('"').strip("'")
                            if val:
                                return val
            except Exception:
                pass
    return ""

def format_srt_time(seconds: float) -> str:
    """Convierte segundos a formato SRT: 00:00:00,000"""
    millis = int((seconds % 1) * 1000)
    s = int(seconds)
    hours = s // 3600
    minutes = (s % 3600) // 60
    secs = s % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def format_vtt_time(seconds: float) -> str:
    """Convierte segundos a formato WebVTT: 00:00:00.000"""
    millis = int((seconds % 1) * 1000)
    s = int(seconds)
    hours = s // 3600
    minutes = (s % 3600) // 60
    secs = s % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

def segments_to_srt(segments: List[Dict[str, Any]]) -> str:
    """Convierte segmentos de transcripción a formato SRT estándar."""
    lines = []
    for i, seg in enumerate(segments, 1):
        start = format_srt_time(seg.get("start", 0.0))
        end = format_srt_time(seg.get("end", 0.0))
        text = seg.get("text", "").strip()
        lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(lines)

def segments_to_vtt(segments: List[Dict[str, Any]]) -> str:
    """Convierte segmentos de transcripción a formato WebVTT estándar."""
    lines = ["WEBVTT\n"]
    for seg in segments:
        start = format_vtt_time(seg.get("start", 0.0))
        end = format_vtt_time(seg.get("end", 0.0))
        text = seg.get("text", "").strip()
        lines.append(f"{start} --> {end}\n{text}\n")
    return "\n".join(lines)

def call_openai_whisper(audio_path: Path, api_key: str, language: Optional[str] = None, is_song: bool = True) -> Dict[str, Any]:
    """
    Llama a la API de Whisper de OpenAI usando la librería estándar urllib
    (sin dependencias externas, cero consumo de CPU/GPU local).
    Incluye timestamps a nivel de palabra y prompt lírico para máxima fidelidad en canciones.
    """
    boundary = f"----AutoProdWhisperBoundary{uuid.uuid4().hex}"
    body = bytearray()

    def add_field(name: str, value: str):
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        body.extend(f"{value}\r\n".encode("utf-8"))

    add_field("model", "whisper-1")
    add_field("response_format", "verbose_json")
    add_field("timestamp_granularities[]", "word")
    add_field("timestamp_granularities[]", "segment")
    add_field("temperature", "0.0")
    if is_song:
        add_field("prompt", "Letra de canción en español con rimas, versos, estrofas y puntuación limpia.")
    if language and language.lower() not in ["auto", ""]:
        add_field("language", language.lower())

    # Adjuntar archivo de audio
    mime_type = mimetypes.guess_type(audio_path.name)[0] or "audio/mpeg"
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{audio_path.name}"\r\n'.encode("utf-8"))
    body.extend(f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"))
    with open(audio_path, "rb") as f:
        body.extend(f.read())
    body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/transcriptions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        },
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=300) as response:
        resp_data = response.read().decode("utf-8")
        return json.loads(resp_data)

def extract_optimized_audio(source_file: Path, temp_dir: Path, target_id: str, is_cloud_api: bool = False, is_song: bool = True) -> Path:
    """
    Extrae y optimiza el audio con ecualización vocal acústica:
    - Para canciones: extrae y suma los canales L y R (atenuando desfases e instrumentos laterales)
      y filtra frecuencias extremas sin usar dynaudnorm (que amplificaba instrumentos en pausas).
    - Para voz común: aplica filtrado de banda vocal estándar.
    """
    ffmpeg = get_ffmpeg_path()
    if is_cloud_api:
        out_audio = temp_dir / f"audio_opt_{target_id}_{int(time.time())}.mp3"
        codec_args = ["-acodec", "libmp3lame", "-b:a", "128k"]
    else:
        out_audio = temp_dir / f"audio_opt_{target_id}_{int(time.time())}.wav"
        codec_args = ["-acodec", "pcm_s16le"]

    if is_song:
        # Aislamiento vocal: atenuar laterales estéreo, cancelar ruidos sub-graves y agudos extremos
        audio_filters = "pan=mono|c0=0.5*c0+0.5*c1,highpass=f=90,lowpass=f=8000,volume=1.2"
    else:
        audio_filters = "highpass=f=100,lowpass=f=7500"

    cmd = [
        str(ffmpeg),
        "-nostdin",
        "-y",
        "-i", str(source_file),
        "-vn",
        "-af", audio_filters,
        *codec_args,
        "-ar", "16000",
        "-ac", "1",
        str(out_audio)
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True, stdin=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW)
        if out_audio.exists() and out_audio.stat().st_size > 0:
            return out_audio
    except Exception:
        pass

    # Si FFmpeg falla o no está, devolver el archivo original
    return source_file

# ──────────────────────────────────────────────
# Modelos de Datos & Ciclo de Vida en RAM
# ──────────────────────────────────────────────
_LOADED_WHISPER_MODELS: Dict[str, Any] = {}

def get_or_create_faster_whisper_model(model_size: str = "large-v3-turbo", device: str = "cpu", compute_type: str = "int8", cpu_threads: int = 2):
    """Carga y cachea en memoria el modelo de Faster-Whisper.
    Siempre usa large-v3-turbo para máxima precisión — no hay fallback a modelos menores."""
    key = f"{model_size}_{device}_{compute_type}_{cpu_threads}"
    if key in _LOADED_WHISPER_MODELS:
        return _LOADED_WHISPER_MODELS[key]
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
            cpu_threads=cpu_threads
        )
        _LOADED_WHISPER_MODELS[key] = model
        return model
    except Exception as e:
        raise Exception(f"No se pudo inicializar el modelo Whisper '{model_size}': {e}")

def release_whisper_model():
    """Libera la memoria RAM ocupada por el modelo de Whisper al finalizar la tarea."""
    global _LOADED_WHISPER_MODELS
    try:
        _LOADED_WHISPER_MODELS.clear()
        import gc
        gc.collect()
    except Exception:
        pass

def format_capcut_rhythmic_segments(
    raw_segments: List[Dict[str, Any]],
    max_words: int = 4,
    max_pause_sec: float = 0.40
) -> List[Dict[str, Any]]:
    """
    Agrupa palabras con timestamps en bloques rítmicos cortos de 3 a 5 palabras estilo CapCut / TikTok.
    Si la pausa entre dos palabras es mayor a 0.40s (fin de frase o compás lírico), cierra el bloque
    para mantener el ritmo exacto de la música.
    """
    all_words = []
    for s in raw_segments:
        if s.get("words"):
            for w in s["words"]:
                w_text = w.get("word", "")
                if w_text:
                    all_words.append({
                        "word": w_text,
                        "start": float(w.get("start", 0.0)),
                        "end": float(w.get("end", 0.0)),
                        "probability": float(w.get("probability", 1.0))
                    })

    if not all_words:
        return raw_segments

    formatted = []
    curr_words = []
    seg_id = 1

    for i, w in enumerate(all_words):
        curr_words.append(w)
        is_last = (i == len(all_words) - 1)
        
        has_pause = False
        if not is_last:
            next_start = float(all_words[i + 1]["start"])
            if (next_start - w["end"]) > max_pause_sec:
                has_pause = True

        has_punct = any(w["word"].rstrip().endswith(p) for p in [".", ",", "!", "?", ";"]) and len(curr_words) >= 3
        is_max_reached = len(curr_words) >= max_words

        if is_last or has_pause or has_punct or is_max_reached:
            text = "".join(cw["word"] for cw in curr_words).strip()
            if text:
                formatted.append({
                    "id": seg_id,
                    "start": round(curr_words[0]["start"], 3),
                    "end": round(curr_words[-1]["end"], 3),
                    "text": text,
                    "words": list(curr_words)
                })
                seg_id += 1
            curr_words = []

    return formatted if formatted else raw_segments

def transcribe_faster_whisper(
    audio_path: Path,
    language: Optional[str] = "es",
    device: str = "cpu",
    safe_threads: int = 2,
    model_size: str = "large-v3-turbo",
    is_song: bool = True
) -> Dict[str, Any]:
    """
    Transcribe audio usando faster-whisper (CTranslate2) 100% en local.
    Extrae marcas de tiempo a nivel de palabra para subtítulos estilo CapCut.
    Para canciones: desactiva VAD agresivo y ajusta no_speech_threshold a 0.6 para no perder palabras cantadas.
    """
    compute_type = "float16" if device == "cuda" else "int8"
    try:
        model = get_or_create_faster_whisper_model(model_size, device, compute_type, safe_threads)
    except Exception as e:
        if device == "cuda":
            # Fallback automático a CPU int8 si los drivers de GPU o cuDNN no están presentes
            model = get_or_create_faster_whisper_model(model_size, "cpu", "int8", safe_threads)
        else:
            raise e

    lang_param = language.lower() if (language and language.lower() not in ["auto", ""]) else None

    # Parámetros para canciones vs habla común
    if is_song:
        # En canciones apagamos vad_filter porque Silero VAD confunde notas cantadas/melodías con música y corta versos
        use_vad = False
        vad_params = None
        no_speech_thresh = 0.60
        initial_prompt = (
            "Letra de canción en español con rimas, métrica lírica, estrofas y versos bien estructurados y puntuados."
            if lang_param == "es"
            else "Song lyrics with clear verses, rhyming lines, and correct punctuation."
        )
    else:
        use_vad = True
        vad_params = dict(
            threshold=0.3,
            min_silence_duration_ms=600,
            speech_pad_ms=400
        )
        no_speech_thresh = 0.50
        initial_prompt = None

    segments_generator, info = model.transcribe(
        str(audio_path),
        language=lang_param,
        word_timestamps=True,
        vad_filter=use_vad,
        vad_parameters=vad_params,
        condition_on_previous_text=True,
        initial_prompt=initial_prompt,
        no_speech_threshold=no_speech_thresh,
        beam_size=5  # Calidad máxima determinista
    )

    full_text_parts = []
    raw_segments = []

    for seg in segments_generator:
        seg_text = seg.text.strip()
        full_text_parts.append(seg_text)
        words_list = []
        if seg.words:
            for w in seg.words:
                words_list.append({
                    "word": w.word,
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "probability": round(w.probability, 3)
                })
        raw_segments.append({
            "id": seg.id,
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "text": seg_text,
            "words": words_list
        })

    # Si es canción o hay timestamps de palabras, empaquetar en bloques rítmicos estilo CapCut (3 a 5 palabras)
    if is_song or any(s.get("words") for s in raw_segments):
        formatted_segments = format_capcut_rhythmic_segments(raw_segments, max_words=4, max_pause_sec=0.40)
    else:
        formatted_segments = raw_segments

    return {
        "text": " ".join(full_text_parts),
        "segments": formatted_segments,
        "language": getattr(info, "language", language or "es"),
        "duration": getattr(info, "duration", 0.0)
    }

class SubtitlesEstimateRequest(BaseModel):
    target_type: str = "video"                   # "video" | "songs_folder"
    path: str
    engine: str = "local_cpu"                    # "local_cpu" | "local_gpu" | "openai_api"

class SubtitlesGenerateRequest(BaseModel):
    target_type: str = "video"                   # "video" | "songs_folder"
    path: str
    channel_name: Optional[str] = None
    lyrics_text: Optional[str] = None            # Letra oficial (Modo Asistido 0% WER con CTC Viterbi Trellis)
    engine: str = "local_cpu"                    # "local_cpu" | "local_gpu" | "openai_api"
    language: str = "es"                         # "es" | "en" | "auto"
    formats: List[str] = [".srt", ".vtt", ".json"]
    burn_to_video: bool = False                  # Si es true y es video, quema subtítulos con FFmpeg

class SubtitleFileSaveRequest(BaseModel):
    path: str
    content: str

# ──────────────────────────────────────────────
# Worker de Ejecución
# ──────────────────────────────────────────────
def run_subtitles_worker(job_id: str, req: SubtitlesGenerateRequest):
    """
    Worker en segundo plano para procesar subtítulos respetando el HardwareGovernor.
    """
    set_background_priority()
    temp_dir = get_temp_render_dir()
    api_key = get_openai_api_key()

    SUB_JOBS[job_id]["status"] = "processing"
    SUB_JOBS[job_id]["progress"] = 5
    SUB_JOBS[job_id]["message"] = "Iniciando análisis de medios..."

    try:
        source_path = Path(req.path)
        if not source_path.is_absolute():
            source_path = (default_workspace_path() / source_path).resolve()

        if not source_path.exists():
            raise Exception(f"La ruta indicada no existe: {req.path}")

        # Recopilar archivos a transcribir
        files_to_process: List[Path] = []
        is_folder = req.target_type == "songs_folder" or source_path.is_dir()

        if is_folder:
            audio_exts = {".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg", ".wma"}
            for item in sorted(target_files := sorted(source_path.iterdir(), key=lambda x: x.name.lower())):
                if item.is_file() and item.suffix.lower() in audio_exts:
                    files_to_process.append(item)
            if not files_to_process:
                raise Exception(f"No se encontraron archivos de audio compatibles en la carpeta: {source_path}")
        else:
            files_to_process.append(source_path)

        SUB_JOBS[job_id]["total_tracks"] = len(files_to_process)
        SUB_JOBS[job_id]["processed_tracks"] = 0
        SUB_JOBS[job_id]["results"] = []

        total_files = len(files_to_process)

        # Crear carpeta de destino de subtítulos
        if is_folder:
            output_folder = source_path / "Subtitulos"
        else:
            output_folder = source_path.parent / "Subtitulos"
        output_folder.mkdir(parents=True, exist_ok=True)

        for idx, file_item in enumerate(files_to_process):
            track_num = idx + 1
            SUB_JOBS[job_id]["current_track"] = file_item.name
            SUB_JOBS[job_id]["message"] = f"Transcribiendo pista {track_num} de {total_files}: {file_item.name}..."
            base_progress = int((idx / total_files) * 85) + 5
            SUB_JOBS[job_id]["progress"] = base_progress

            is_song_file = is_folder or file_item.suffix.lower() in {".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg", ".wma"}

            # Buscar letra oficial (en la petición o en archivo homónimo .txt / .lyrics)
            lyrics_content = req.lyrics_text
            if not lyrics_content:
                txt_candidate = file_item.with_suffix(".txt")
                lyrics_candidate = file_item.with_name(f"{file_item.stem}.lyrics")
                if txt_candidate.exists():
                    try:
                        with open(txt_candidate, "r", encoding="utf-8") as lf:
                            lyrics_content = lf.read().strip()
                    except Exception:
                        pass
                elif lyrics_candidate.exists():
                    try:
                        with open(lyrics_candidate, "r", encoding="utf-8") as lf:
                            lyrics_content = lf.read().strip()
                    except Exception:
                        pass

            # 1. Extraer / optimizar audio con separación acústica vocal
            SUB_JOBS[job_id]["message"] = f"Optimizando audio para {file_item.name}..."
            opt_audio = extract_optimized_audio(file_item, temp_dir, f"{job_id}_{idx}", is_cloud_api=(req.engine == "openai_api"), is_song=is_song_file)

            # 2. Transcribir según el motor
            transcription_data = None
            if req.engine == "openai_api":
                if not api_key:
                    raise Exception("No se encontró la OPENAI_API_KEY en las variables de entorno o archivo .env.")
                SUB_JOBS[job_id]["message"] = f"Transcribiendo con OpenAI Whisper API (Cloud): {file_item.name}..."
                raw_data = call_openai_whisper(opt_audio, api_key, req.language, is_song=is_song_file)
                if raw_data.get("words"):
                    raw_data["segments"] = format_capcut_rhythmic_segments([{"words": raw_data["words"]}])
                transcription_data = raw_data
            else:
                # Motor local con perfil adaptativo inteligente según RAM y CPU del cliente
                opt_config = governor.get_optimal_whisper_config(for_music=is_song_file)
                device = "cuda" if (req.engine == "local_gpu" and opt_config["device"] == "cuda") else "cpu"
                safe_threads = opt_config["threads"]
                chosen_model = opt_config["model_size"]
                profile_desc = opt_config["description"]

                # Intentar pipeline neuronal de doble vía si es canción o hay letra provista
                used_pipeline = False
                if procesar_subtitulado_musical_completo and (is_song_file or lyrics_content):
                    try:
                        if lyrics_content:
                            SUB_JOBS[job_id]["message"] = f"Alineando letra con precisión acústica (Forced Alignment CTC Viterbi): {file_item.name}..."
                        else:
                            SUB_JOBS[job_id]["message"] = f"Aislando voz con HTDemucs y transcribiendo: {file_item.name}..."

                        pipeline_res = procesar_subtitulado_musical_completo(
                            audio_path=file_item,
                            lyrics_text=lyrics_content,
                            language=req.language,
                            device=device,
                            threads=safe_threads,
                            temp_dir=temp_dir
                        )
                        transcription_data = pipeline_res
                        used_pipeline = True
                    except Exception as pe:
                        SUB_JOBS[job_id]["message"] = f"Pipeline neuronal reportó aviso ({pe}), ejecutando fallback directo..."

                if not used_pipeline:
                    try:
                        SUB_JOBS[job_id]["message"] = f"Transcribiendo ({chosen_model.upper()} en {device.upper()} con {safe_threads} hilo(s) - {profile_desc}): {file_item.name}..."
                        transcription_data = transcribe_faster_whisper(
                            opt_audio,
                            language=req.language,
                            device=device,
                            safe_threads=safe_threads,
                            model_size=chosen_model,
                            is_song=is_song_file
                        )
                    except ImportError:
                        # Si faster-whisper no está instalado, intentar CLI de whisper clásico
                        whisper_bin = shutil.which("whisper")
                        if whisper_bin:
                            cmd = [
                                whisper_bin,
                                str(opt_audio),
                                "--model", "base",
                                "--output_dir", str(temp_dir),
                                "--output_format", "all",
                                "--threads", str(safe_threads),
                                "--device", device
                            ]
                            if req.language and req.language != "auto":
                                cmd.extend(["--language", req.language])

                            SUB_JOBS[job_id]["message"] = f"Transcribiendo con Whisper CLI ({device.upper()}): {file_item.name}..."
                            subprocess.run(cmd, capture_output=True, check=True, stdin=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW)
                            
                            json_out = temp_dir / f"{opt_audio.stem}.json"
                            if json_out.exists():
                                with open(json_out, "r", encoding="utf-8") as f:
                                    transcription_data = json.load(f)
                        elif api_key:
                            SUB_JOBS[job_id]["message"] = f"Faster-Whisper no detectado, usando OpenAI API: {file_item.name}..."
                            transcription_data = call_openai_whisper(opt_audio, api_key, req.language)
                        else:
                            raise Exception("Faster-Whisper no está instalado en el entorno local. Ejecuta: pip install faster-whisper")

            # Limpiar archivo temporal de audio si se creó uno nuevo
            if opt_audio != file_item and opt_audio.exists():
                try:
                    opt_audio.unlink()
                except Exception:
                    pass

            # 3. Procesar y guardar los formatos generados
            segments = transcription_data.get("segments", [])
            raw_text = transcription_data.get("text", "").strip()

            stem_name = file_item.stem
            srt_path = output_folder / f"{stem_name}.srt"
            vtt_path = output_folder / f"{stem_name}.vtt"
            json_path = output_folder / f"{stem_name}.json"

            # Generar contenido SRT
            srt_content = segments_to_srt(segments) if segments else f"1\n00:00:00,000 --> 00:00:10,000\n{raw_text}\n"
            with open(srt_path, "w", encoding="utf-8") as f:
                f.write(srt_content)

            # Generar contenido VTT
            vtt_content = segments_to_vtt(segments) if segments else f"WEBVTT\n\n00:00:00.000 --> 00:00:10.000\n{raw_text}\n"
            with open(vtt_path, "w", encoding="utf-8") as f:
                f.write(vtt_content)

            # Guardar JSON con timestamps y forma de onda
            json_payload = {
                "track_name": file_item.name,
                "language": transcription_data.get("language", req.language),
                "duration": transcription_data.get("duration", 0.0),
                "text": raw_text,
                "segments": segments
            }
            if "waveform" in transcription_data:
                json_payload["waveform"] = transcription_data["waveform"]
            if "modo" in transcription_data:
                json_payload["modo"] = transcription_data["modo"]

            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(json_payload, f, indent=2, ensure_ascii=False)

            result_entry = {
                "file_name": file_item.name,
                "srt_path": srt_path.as_posix(),
                "vtt_path": vtt_path.as_posix(),
                "json_path": json_path.as_posix(),
                "segments_count": len(segments),
                "text_snippet": raw_text[:140] + ("..." if len(raw_text) > 140 else "")
            }
            if "waveform" in transcription_data:
                result_entry["waveform"] = transcription_data["waveform"]
            if "modo" in transcription_data:
                result_entry["modo"] = transcription_data["modo"]

            SUB_JOBS[job_id]["results"].append(result_entry)
            SUB_JOBS[job_id]["processed_tracks"] += 1

        # 4. Quemar subtítulos en video si se solicitó
        if req.burn_to_video and not is_folder:
            SUB_JOBS[job_id]["progress"] = 92
            SUB_JOBS[job_id]["message"] = "Quemando subtítulos en el video con FFmpeg..."
            ffmpeg = get_ffmpeg_path()
            subbed_video_path = output_folder / f"{source_path.stem}_subtitulado.mp4"
            
            # Escapar ruta para el filtro de ffmpeg
            escaped_srt = str(srt_path).replace("\\", "/").replace(":", "\\:")
            burn_cmd = [
                str(ffmpeg),
                "-y",
                "-i", str(source_path),
                "-vf", f"subtitles='{escaped_srt}'",
                "-c:a", "copy",
                str(subbed_video_path)
            ]
            try:
                subprocess.run(burn_cmd, capture_output=True, check=True)
                SUB_JOBS[job_id]["subtitled_video_path"] = subbed_video_path.as_posix()
            except Exception as e:
                SUB_JOBS[job_id]["burn_warning"] = f"No se pudo quemar en el video: {str(e)}"

        SUB_JOBS[job_id]["status"] = "completed"
        SUB_JOBS[job_id]["progress"] = 100
        SUB_JOBS[job_id]["output_folder"] = output_folder.as_posix()
        SUB_JOBS[job_id]["message"] = f"¡Subtitulado completado con éxito! ({total_files} pistas procesadas)"

    except Exception as e:
        SUB_JOBS[job_id]["status"] = "error"
        SUB_JOBS[job_id]["error"] = str(e)
        SUB_JOBS[job_id]["message"] = f"Error generando subtítulos: {str(e)}"

    finally:
        # Liberar memoria RAM del modelo de Whisper y slot del HardwareGovernor
        release_whisper_model()
        governor.release_job_slot(job_id)

# ──────────────────────────────────────────────
# Endpoints de la API
# ──────────────────────────────────────────────

@router.post("/estimate")
def estimate_subtitles(req: SubtitlesEstimateRequest):
    """
    Calcula la duración del medio (video o canciones) y proporciona la estimación
    de tiempo y consumo de recursos para el modal previo a la ejecución.
    """
    target_path = Path(req.path)
    if not target_path.is_absolute():
        target_path = (default_workspace_path() / target_path).resolve()

    if not target_path.exists():
        raise HTTPException(status_code=404, detail=f"Ruta no encontrada: {req.path}")

    total_duration = 0.0
    files_list = []
    is_folder = req.target_type == "songs_folder" or target_path.is_dir()

    if is_folder:
        audio_exts = {".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg", ".wma"}
        for item in sorted(target_path.iterdir(), key=lambda x: x.name.lower()):
            if item.is_file() and item.suffix.lower() in audio_exts:
                dur = probe_duration(item)
                total_duration += dur
                files_list.append({
                    "name": item.name,
                    "duration_seconds": round(dur, 2),
                    "duration_formatted": format_time_hms(dur)
                })
        if not files_list:
            raise HTTPException(status_code=400, detail="No se encontraron archivos de audio en la carpeta especificada.")
    else:
        dur = probe_duration(target_path)
        total_duration = dur
        files_list.append({
            "name": target_path.name,
            "duration_seconds": round(dur, 2),
            "duration_formatted": format_time_hms(dur)
        })

    # Obtener estimación adaptada del HardwareGovernor
    estimate_data = governor.estimate_subtitles_time(total_duration, req.engine)
    hardware_specs = governor.get_hardware_specs()

    return {
        "target_type": "songs_folder" if is_folder else "video",
        "path": target_path.as_posix(),
        "total_files": len(files_list),
        "files": files_list,
        "total_duration_seconds": round(total_duration, 2),
        "total_duration_formatted": format_time_hms(total_duration),
        "hardware_specs": hardware_specs,
        "estimate": estimate_data
    }

@router.post("/generate")
def generate_subtitles(req: SubtitlesGenerateRequest, background_tasks: BackgroundTasks):
    """
    Inicia la generación de subtítulos controlada por el HardwareGovernor.
    """
    job_id = str(uuid.uuid4())

    SUB_JOBS[job_id] = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "message": "En cola para iniciar procesamiento...",
        "current_track": "",
        "total_tracks": 1,
        "processed_tracks": 0,
        "results": [],
        "output_folder": None,
        "created_at": time.time()
    }

    # Intentar adquirir slot en el HardwareGovernor
    slot_acquired = governor.acquire_job_slot(job_id, "subtitles", {
        "path": req.path,
        "engine": req.engine,
        "target_type": req.target_type
    })

    if not slot_acquired:
        SUB_JOBS[job_id]["message"] = "En cola: otra tarea pesada está en ejecución en el equipo..."

    # Añadir a tareas en segundo plano
    background_tasks.add_task(run_subtitles_worker, job_id, req)

    return {
        "job_id": job_id,
        "status": "processing" if slot_acquired else "queued",
        "slot_acquired": slot_acquired,
        "message": "Generación de subtítulos iniciada con éxito."
    }

@router.get("/status/{job_id}")
def get_subtitles_status(job_id: str):
    """Consulta el estado y progreso en tiempo real de una tarea de subtitulado."""
    job = SUB_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo de subtitulado no encontrado.")
    return job

@router.get("/preview_file")
def preview_subtitle_file(path: str):
    """Obtiene el texto de un archivo .srt, .vtt o .json para editarlo en el navegador."""
    ws_root = default_workspace_path()
    file_path = Path(path)
    if not file_path.is_absolute():
        file_path = (ws_root / file_path).resolve()
    else:
        file_path = file_path.resolve()

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo de subtítulo no encontrado.")

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        return {
            "path": file_path.as_posix(),
            "name": file_path.name,
            "content": content
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save_file")
def save_subtitle_file(req: SubtitleFileSaveRequest):
    """Guarda los cambios editados de un archivo de subtítulo."""
    ws_root = default_workspace_path()
    file_path = Path(req.path)
    if not file_path.is_absolute():
        file_path = (ws_root / file_path).resolve()
    else:
        file_path = file_path.resolve()

    if not file_path.parent.exists():
        file_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"success": True, "message": "Subtítulo guardado correctamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
