"""
Módulo de Subtitulado Musical de Doble Vía para AutoProd
Arquitectura:
  1. Aislamiento Acústico Neuronal (HTDemucs) con duración 1:1 estricta.
  2. Router de Doble Vía:
     - Ruta 1 (Automática): Faster-Whisper Large-v3 con VAD anti-alucinaciones y condition_on_prev=False.
     - Ruta 2 (Asistida): Torchaudio MMS-FA / Wav2Vec 2.0 vía CTC Viterbi Trellis (0% WER).
  3. Capa de Post-Procesamiento:
     - Ajuste Reactivo Visual (-40ms) y resolución determinista de colisiones.
     - Extracción de picos de onda (Waveform Peaks) para el Canvas del Timeline.
  4. Ciclo de Vida:
     - Limpieza física inmediata de archivos temporales (vocals.wav).
     - Liberación explícita de VRAM y RAM entre etapas.
"""

import os
import gc
import re
import math
import shutil
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional

import torch
import torchaudio


def flush_gpu_memory():
    """Libera la memoria de video (VRAM) y fuerza el recolector de basura de Python."""
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        try:
            torch.cuda.ipc_collect()
        except Exception:
            pass
    gc.collect()


# ─────────────────────────────────────────────────────────────
# 1. SEPARACIÓN ACÚSTICA NEURONAL (HTDEMUCS)
# ─────────────────────────────────────────────────────────────

class DemucsVocalSeparator:
    """
    Extrae la pista a capela manteniendo la duración exacta y el timeline
    del audio original, rellenando los pasajes instrumentales con silencio digital.
    """
    def __init__(self, device: Optional[str] = None):
        if device and device != "auto":
            self.device = device
        else:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"

    def separate_vocals(self, audio_path: Path, output_dir: Path) -> Path:
        """
        Ejecuta HTDemucs para aislar 'vocals'.
        Garantiza que el archivo resultante tenga exactamente la misma duración y sample rate.
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        vocals_path = output_dir / f"{audio_path.stem}_vocals_16k.wav"

        try:
            from demucs.pretrained import get_model
            from demucs.apply import apply_model
        except ImportError:
            raise ImportError(
                "La librería 'demucs' no está instalada. Ejecuta: pip install demucs"
            )

        # Cargar modelo HTDemucs
        model = get_model(name="htdemucs")
        model.to(self.device)
        model.eval()

        # Cargar audio original preservando metadata
        wav, sr = torchaudio.load(str(audio_path))
        orig_num_samples = wav.shape[-1]

        # Demucs trabaja a 44100 Hz estéreo
        if sr != model.samplerate:
            resampler = torchaudio.transforms.Resample(sr, model.samplerate)
            wav_demucs = resampler(wav)
        else:
            wav_demucs = wav

        if wav_demucs.dim() == 1:
            wav_demucs = wav_demucs.unsqueeze(0).repeat(2, 1)
        elif wav_demucs.shape[0] == 1:
            wav_demucs = wav_demucs.repeat(2, 1)
        elif wav_demucs.shape[0] > 2:
            wav_demucs = wav_demucs[:2]

        wav_demucs = wav_demucs.unsqueeze(0).to(self.device)

        # Inferencia con overlap para evitar artefactos en fronteras
        with torch.no_grad():
            sources = apply_model(
                model, 
                wav_demucs, 
                device=self.device, 
                shifts=1, 
                split=True, 
                overlap=0.25
            )

        # Identificar índice de 'vocals' (usualmente índice 3 en htdemucs)
        vocal_idx = model.sources.index("vocals")
        vocals_wav = sources[0, vocal_idx].cpu()  # [2, num_samples]

        # Mezclar a mono y convertir a 16kHz (estándar para Whisper y Wav2Vec2)
        vocals_mono = torch.mean(vocals_wav, dim=0, keepdim=True)
        resampler_16k = torchaudio.transforms.Resample(model.samplerate, 16000)
        vocals_16k = resampler_16k(vocals_mono)

        # Validar consistencia temporal estricta (duración idéntica al original)
        expected_16k_samples = int(math.ceil((orig_num_samples / sr) * 16000))
        if vocals_16k.shape[-1] < expected_16k_samples:
            padding = expected_16k_samples - vocals_16k.shape[-1]
            vocals_16k = torch.nn.functional.pad(vocals_16k, (0, padding), mode="constant", value=0.0)
        elif vocals_16k.shape[-1] > expected_16k_samples:
            vocals_16k = vocals_16k[:, :expected_16k_samples]

        # Exportar WAV PCM 16-bit
        torchaudio.save(str(vocals_path), vocals_16k, sample_rate=16000, encoding="PCM_S", bits_per_sample=16)

        # Liberación inmediata de VRAM tras la separación
        del model
        del sources
        del wav_demucs
        del vocals_wav
        flush_gpu_memory()

        return vocals_path


# ─────────────────────────────────────────────────────────────
# 2. RUTA 1: MODO 100% AUTOMÁTICO (FASTER-WHISPER ANTI-ALUCINACIONES)
# ─────────────────────────────────────────────────────────────

class AutomaticWhisperTranscriber:
    """
    Ruta 1: Transcripción automática sin letra previa.
    Configuración anti-alucinaciones estricta sobre el acapela limpio.
    """
    def __init__(self, model_size: str = "large-v3-turbo", device: str = "auto", compute_type: str = "auto", threads: int = 2):
        from faster_whisper import WhisperModel

        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        if compute_type == "auto":
            self.compute_type = "float16" if self.device == "cuda" else "int8"
        else:
            self.compute_type = compute_type

        self.model = WhisperModel(
            model_size,
            device=self.device,
            compute_type=self.compute_type,
            cpu_threads=threads if self.device == "cpu" else 0
        )

    def transcribe(self, vocals_path: Path, language: Optional[str] = "es") -> List[Dict[str, Any]]:
        """
        Transcribe la pista a capela con marcas de tiempo a nivel de palabra.
        Aplica filtros estrictos para que los silencios no provoquen alucinaciones.
        """
        lang = language.lower() if (language and language.lower() not in ["auto", ""]) else None

        vad_parameters = dict(
            threshold=0.50,
            min_silence_duration_ms=1000,  # Ignora pausas instrumentales largas
            speech_pad_ms=250              # Margen para no cortar ataque vocal
        )

        segments, _ = self.model.transcribe(
            str(vocals_path),
            language=lang,
            word_timestamps=True,
            vad_filter=True,                           # OBLIGATORIO: silencia instrumentos
            vad_parameters=vad_parameters,
            condition_on_previous_text=False,          # OBLIGATORIO: evita bucles y ecos fantasma
            no_speech_threshold=0.60,                  # Rechaza alucinaciones de baja confianza
            temperature=0.0,                           # Salida determinista de máxima calidad
            beam_size=5
        )

        words_data = []
        for segment in segments:
            if not segment.words:
                continue
            for w in segment.words:
                clean_word = w.word.strip()
                if clean_word:
                    words_data.append({
                        "word": clean_word,
                        "start": float(round(w.start, 3)),
                        "end": float(round(w.end, 3)),
                        "probability": float(round(w.probability, 3))
                    })

        # Liberar memoria de Faster-Whisper
        del self.model
        flush_gpu_memory()

        return words_data


# ─────────────────────────────────────────────────────────────
# 3. RUTA 2: MODO ASISTIDO (CTC VITERBI TRELLIS CON TORCHAUDIO MMS-FA)
# ─────────────────────────────────────────────────────────────

class AssistedForcedAligner:
    """
    Ruta 2: Alineación forzada fonética milimétrica (0% WER).
    Bypasea Whisper por completo y calcula en qué milisegundo ocurre
    cada palabra del texto oficial proporcionado por el creador.
    """
    def __init__(self, device: Optional[str] = None):
        if device and device != "auto":
            self.device = device
        else:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"

    def align(self, vocals_path: Path, lyrics_text: str) -> List[Dict[str, Any]]:
        """
        Ejecuta Forced Alignment usando el pipeline MMS_FA (Multilingual Forced Alignment) de torchaudio.
        """
        raw_words = [w for w in re.split(r"\s+", lyrics_text.strip()) if w]
        if not raw_words:
            return []

        # Cargar pipeline de alineación MMS_FA
        bundle = torchaudio.pipelines.MMS_FA
        model = bundle.get_model().to(self.device)
        model.eval()
        tokenizer = bundle.get_tokenizer()
        aligner = bundle.get_aligner()

        waveform, sr = torchaudio.load(str(vocals_path))
        if sr != bundle.sample_rate:
            resampler = torchaudio.transforms.Resample(sr, bundle.sample_rate)
            waveform = resampler(waveform)

        # Guardar longitud real del waveform en CPU para el ratio antes de mover a device
        waveform_num_samples = waveform.shape[-1]
        waveform = waveform.to(self.device)

        # Preparar texto normalizado para el modelo fonético
        normalized_words = [re.sub(r"[^\w]", "", w.lower()) for w in raw_words]
        valid_pairs = [(orig, norm) for orig, norm in zip(raw_words, normalized_words) if norm]

        if not valid_pairs:
            return []

        clean_transcript = " ".join([p[1] for p in valid_pairs])

        with torch.no_grad():
            emission, _ = model(waveform)
            emission = torch.log_softmax(emission, dim=-1)
            # Tokenizar cada palabra individualmente para obtener el conteo real de tokens por palabra
            # (len(norm_word) != num_tokens para caracteres multi-byte o con diacríticos)
            per_word_tokens = [tokenizer(norm) for _, norm in valid_pairs]
            all_tokens = [tok for word_toks in per_word_tokens for tok in word_toks]
            token_spans = aligner(emission[0], torch.tensor(all_tokens, device=self.device))

        # Ratio correcto: usa la longitud real del waveform antes del .to(device)
        num_frames = emission.shape[1]
        ratio = (waveform_num_samples / bundle.sample_rate) / num_frames

        words_data = []
        token_idx = 0

        for (orig_word, norm_word), word_tokens in zip(valid_pairs, per_word_tokens):
            num_word_tokens = len(word_tokens)
            if num_word_tokens == 0:
                # Palabra sin tokens fonéticos válidos (solo signos): heredar timestamp de la anterior
                if words_data:
                    prev = words_data[-1]
                    words_data.append({
                        "word": orig_word,
                        "start": prev["end"],
                        "end": round(prev["end"] + 0.05, 3),
                        "probability": 1.0
                    })
                continue

            if token_idx + num_word_tokens > len(token_spans):
                # Tokens agotados antes de completar la letra: continuar en vez de romper
                # para no perder las palabras restantes — se marcan sin timestamp válido
                fallback_start = words_data[-1]["end"] if words_data else 0.0
                words_data.append({
                    "word": orig_word,
                    "start": round(fallback_start, 3),
                    "end": round(fallback_start + 0.05, 3),
                    "probability": 0.0  # Indica estimación, no alineación real
                })
                continue

            spans_for_word = token_spans[token_idx : token_idx + num_word_tokens]
            t_start = spans_for_word[0].start * ratio
            t_end = spans_for_word[-1].end * ratio
            words_data.append({
                "word": orig_word,
                "start": float(round(t_start, 3)),
                "end": float(round(t_end, 3)),
                "probability": 1.0  # 100% de paridad garantizada con la letra oficial
            })
            token_idx += num_word_tokens

        # Liberar memoria de Wav2Vec / MMS
        del model
        del waveform
        del emission
        flush_gpu_memory()

        return words_data


# ─────────────────────────────────────────────────────────────
# 4. CAPA DE POST-PROCESAMIENTO: AJUSTE REACTIVO Y FORMA DE ONDA
# ─────────────────────────────────────────────────────────────

def apply_reactive_visual_adjustment(
    words: List[Dict[str, Any]], 
    lead_time_sec: float = 0.040,
    min_word_duration: float = 0.060
) -> List[Dict[str, Any]]:
    """
    1. Resta lead_time_sec (40 ms) al start de cada palabra para compensar
       la latencia de reacción visual del espectador.
    2. Valida que el end de la palabra previa no solape el start de la siguiente.
    """
    if not words:
        return []

    adjusted = []
    for w in words:
        item = dict(w)
        # Compensación del ataque visual (-40ms)
        item["start"] = max(0.0, round(float(item["start"]) - lead_time_sec, 3))
        # Garantizar duración mínima audible/visual
        if float(item["end"]) <= float(item["start"]):
            item["end"] = round(float(item["start"]) + min_word_duration, 3)
        else:
            item["end"] = round(float(item["end"]), 3)
        adjusted.append(item)

    # Resolución determinista de colisiones y overlaps
    for i in range(len(adjusted) - 1):
        curr_word = adjusted[i]
        next_word = adjusted[i + 1]

        if curr_word["end"] > next_word["start"]:
            # Cortar palabra previa 5ms antes del nuevo inicio si hay solapamiento
            safe_end = max(curr_word["start"] + 0.020, next_word["start"] - 0.005)
            curr_word["end"] = round(safe_end, 3)

    return adjusted


def extract_waveform_peaks(audio_path: Path, points_per_second: int = 40) -> List[float]:
    """
    Calcula un array ligero de amplitudes normalizadas (0.0 a 1.0)
    para dibujar la onda de voz directamente en el Canvas del Timeline.
    """
    try:
        waveform, sr = torchaudio.load(str(audio_path))
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)

        step = max(1, int(sr / points_per_second))
        unfolded = waveform.abs().unfold(-1, step, step)
        peaks, _ = unfolded.max(dim=-1)
        max_val = peaks.max()
        if max_val > 1e-6:
            normalized = (peaks[0] / max_val).tolist()
        else:
            normalized = peaks[0].tolist()
        return [round(float(p), 2) for p in normalized]
    except Exception:
        return []


def format_capcut_rhythmic_segments(
    words: List[Dict[str, Any]],
    max_words: int = 4,
    max_pause_sec: float = 0.38
) -> List[Dict[str, Any]]:
    """
    Agrupa palabras con timestamps en bloques rítmicos estilo CapCut (3 a 5 palabras).
    Corta los subtítulos cuando detecta pausas líricas mayores a 0.38s o signos de puntuación.
    """
    if not words:
        return []

    formatted = []
    curr_words = []
    seg_id = 1

    for i, w in enumerate(words):
        curr_words.append(w)
        is_last = (i == len(words) - 1)

        has_pause = False
        if not is_last:
            next_start = float(words[i + 1]["start"])
            if (next_start - float(w["end"])) > max_pause_sec:
                has_pause = True

        has_punct = any(w["word"].rstrip().endswith(p) for p in [".", ",", "!", "?", ";"]) and len(curr_words) >= 3
        is_max_reached = len(curr_words) >= max_words

        if is_last or has_pause or has_punct or is_max_reached:
            text = " ".join(cw["word"] for cw in curr_words).strip()
            if text:
                formatted.append({
                    "id": seg_id,
                    "start": round(float(curr_words[0]["start"]), 3),
                    "end": round(float(curr_words[-1]["end"]), 3),
                    "text": text,
                    "words": list(curr_words)
                })
                seg_id += 1
            curr_words = []

    return formatted


# ─────────────────────────────────────────────────────────────
# 5. CONTROLADOR PRINCIPAL / PIPELINE INTEGRADO
# ─────────────────────────────────────────────────────────────

def procesar_subtitulado_musical_completo(
    audio_path: Path,
    lyrics_text: Optional[str] = None,
    language: str = "es",
    device: str = "auto",
    threads: int = 2,
    temp_dir: Optional[Path] = None,
    keep_vocals: bool = False
) -> Dict[str, Any]:
    """
    Ejecuta el pipeline completo de subtitulado musical:
    1. HTDemucs: Aisla voz con duración 1:1.
    2. Router:
       - Si lyrics_text está presente -> Ruta 2: Forced Alignment (0% WER).
       - Si no -> Ruta 1: Faster-Whisper Large-v3 con VAD anti-alucinaciones.
    3. Post-proceso: Ajuste Reactivo Visual (-40ms) + Segmentación CapCut.
    4. Limpieza: Borrado obligatorio de vocals.wav y vaciado de VRAM.
    """
    work_dir = temp_dir if temp_dir else Path(tempfile.mkdtemp(prefix="autoprod_subs_"))
    work_dir.mkdir(parents=True, exist_ok=True)
    vocals_file: Optional[Path] = None

    try:
        # PASO 1: Separación Acústica Neuronal
        separator = DemucsVocalSeparator(device=device)
        vocals_file = separator.separate_vocals(audio_path, work_dir)

        # Extraer envolvente de onda para visualización en Timeline
        waveform_peaks = extract_waveform_peaks(vocals_file, points_per_second=40)

        # PASO 2: Bifurcación
        has_lyrics = bool(lyrics_text and lyrics_text.strip())

        if has_lyrics:
            # RUTA 2: Asistido (Forced Alignment)
            aligner = AssistedForcedAligner(device=device)
            raw_words = aligner.align(vocals_file, lyrics_text)
            modo = "asistido_forced_alignment"
        else:
            # RUTA 1: Automático (Faster-Whisper)
            transcriber = AutomaticWhisperTranscriber(
                model_size="large-v3-turbo", 
                device=device, 
                threads=threads
            )
            raw_words = transcriber.transcribe(vocals_file, language=language)
            modo = "automatico_faster_whisper"

        # PASO 3: Ajuste Reactivo Visual y Segmentación Rítmica
        adjusted_words = apply_reactive_visual_adjustment(raw_words, lead_time_sec=0.040)
        rhythmic_segments = format_capcut_rhythmic_segments(adjusted_words, max_words=4, max_pause_sec=0.38)
        full_text = " ".join([w["word"] for w in adjusted_words]).strip()

        return {
            "status": "success",
            "modo": modo,
            "text": full_text,
            "words": adjusted_words,
            "segments": rhythmic_segments,
            "waveform": waveform_peaks,
            "total_words": len(adjusted_words)
        }

    finally:
        # PASO 4: Limpieza de archivos efímeros
        if not keep_vocals and vocals_file and vocals_file.exists():
            try:
                vocals_file.unlink()
            except Exception:
                pass
        flush_gpu_memory()
