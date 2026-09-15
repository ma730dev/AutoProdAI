import os
import sys
import json
import shutil
import subprocess
import uuid
import time
import math
import threading
from pathlib import Path
from typing import List, Optional, Dict, Any

# Garantizar que el directorio raíz del controlador esté en sys.path
_controlador_dir = str(Path(__file__).resolve().parent.parent)
if _controlador_dir not in sys.path:
    sys.path.insert(0, _controlador_dir)

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from hardware import governor

router = APIRouter(
    prefix="/video",
    tags=["video_looper"],
)

# ──────────────────────────────────────────────
# Estado de Jobs en Memoria
# ──────────────────────────────────────────────
JOBS: Dict[str, Dict[str, Any]] = {}

def default_workspace_path() -> Path:
    config_path = Path(__file__).resolve().parent.parent.parent / ".autoprod-config.json"
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
                if "basePath" in config:
                    return (Path(config["basePath"]) / "youtube").resolve()
        except Exception:
            pass
    return (Path.home() / "AutoProd" / "youtube").resolve()

def get_temp_render_dir() -> Path:
    """
    Retorna la ruta de temp_renders ubicada dentro del workspace controlado (youtube/temp_renders)
    para que sea visible en el explorador de recursos y en la Biblioteca de Recursos.
    """
    ws_root = default_workspace_path()
    temp_dir = ws_root / "temp_renders"
    temp_dir.mkdir(parents=True, exist_ok=True)
    return temp_dir.resolve()


def get_ffmpeg_path() -> Path:
    # 1. E:\AutoProdAI\bin\ffmpeg.exe
    config_path = Path(__file__).resolve().parent.parent.parent / ".autoprod-config.json"
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
                if "basePath" in config:
                    cand = Path(config["basePath"]) / "bin" / ("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
                    if cand.exists():
                        return cand
        except Exception:
            pass

    # 2. Carpeta bin local en controlador/bin/
    local_bin = Path(__file__).resolve().parent.parent / "bin" / ("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
    if local_bin.exists():
        return local_bin

    # 3. PATH del sistema
    found = shutil.which("ffmpeg")
    if found:
        return Path(found)

    return Path("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")

def get_ffprobe_path() -> Path:
    config_path = Path(__file__).resolve().parent.parent.parent / ".autoprod-config.json"
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
                if "basePath" in config:
                    cand = Path(config["basePath"]) / "bin" / ("ffprobe.exe" if sys.platform == "win32" else "ffprobe")
                    if cand.exists():
                        return cand
        except Exception:
            pass

    local_bin = Path(__file__).resolve().parent.parent / "bin" / ("ffprobe.exe" if sys.platform == "win32" else "ffprobe")
    if local_bin.exists():
        return local_bin

    found = shutil.which("ffprobe")
    if found:
        return Path(found)

    return Path("ffprobe.exe" if sys.platform == "win32" else "ffprobe")

def format_time_hms(seconds: float) -> str:
    s = int(seconds)
    hours = s // 3600
    minutes = (s % 3600) // 60
    secs = s % 60
    if hours > 0:
        return f"{hours}h {minutes:02d}m {secs:02d}s"
    return f"{minutes}m {secs:02d}s"

CREATE_NO_WINDOW = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

def probe_duration(file_path: Path) -> float:
    ffprobe = get_ffprobe_path()
    try:
        cmd = [
            str(ffprobe),
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(file_path)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True, stdin=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW)
        val = float(res.stdout.strip())
        return val if val > 0 else 0.0
    except Exception:
        # Si ffprobe falla, intentar con ffmpeg
        try:
            ffmpeg = get_ffmpeg_path()
            cmd = [str(ffmpeg), "-nostdin", "-i", str(file_path)]
            res = subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW)
            # Buscar Duration: 00:01:23.45
            for line in res.stderr.splitlines():
                if "Duration:" in line:
                    part = line.split("Duration:")[1].split(",")[0].strip()
                    h, m, s = part.split(":")
                    return float(h) * 3600 + float(m) * 60 + float(s)
        except Exception:
            pass
    return 10.0 # Fallback por defecto si no se puede leer

def probe_video_meta(file_path: Path) -> Dict[str, Any]:
    ffprobe = get_ffprobe_path()
    meta = {
        "width": 1920,
        "height": 1080,
        "duration": 0.0,
        "fps": 30.0,
        "codec": "h264",
        "has_audio": False
    }
    try:
        cmd = [
            str(ffprobe),
            "-v", "error",
            "-show_entries", "stream=width,height,r_frame_rate,codec_name,codec_type",
            "-show_entries", "format=duration",
            "-of", "json",
            str(file_path)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True, stdin=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW)
        data = json.loads(res.stdout)
        if "format" in data and "duration" in data["format"]:
            meta["duration"] = float(data["format"]["duration"])
        
        if "streams" in data:
            for st in data["streams"]:
                if st.get("codec_type") == "video":
                    meta["width"] = st.get("width", 1920)
                    meta["height"] = st.get("height", 1080)
                    meta["codec"] = st.get("codec_name", "h264")
                    r_fps = st.get("r_frame_rate", "30/1")
                    if "/" in r_fps:
                        num, den = r_fps.split("/")
                        if float(den) > 0:
                            meta["fps"] = round(float(num) / float(den), 2)
                elif st.get("codec_type") == "audio":
                    meta["has_audio"] = True
    except Exception:
        meta["duration"] = probe_duration(file_path)
    return meta

# ──────────────────────────────────────────────
# Modelos Pydantic
# ──────────────────────────────────────────────
class ScanAudioFolderRequest(BaseModel):
    folder_path: str

class InspectMediaRequest(BaseModel):
    file_path: str

class CreateLoopRequest(BaseModel):
    video_paths: List[str]
    duration_mode: str = "custom"                # "custom" | "audio_folder"
    target_duration_seconds: float = 300.0        # En segundos
    audio_folder_path: Optional[str] = None       # Carpeta de canciones
    resolution: str = "1080p"                     # "1080p" | "4k" | "720p" | "shorts" | "original"
    quality: str = "high"                         # "master" | "high" | "balanced"
    is_preview: bool = False                      # Si es true, limita a max 5 min y usa preset veryfast
    mute_original_audio: bool = False             # Si es true, silencia/elimina el audio del video original
    output_channel: Optional[str] = None          # Nombre de canal de destino opcional
    output_folder_path: Optional[str] = None      # Ruta exacta de la carpeta de destino (ej: FinanzasReales/video1/Videos)
    output_filename: Optional[str] = None         # Nombre de archivo deseado

# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.get("/video_folders")
def get_video_folders():
    """Retorna una lista de carpetas de videos disponibles en el workspace."""
    ws_root = default_workspace_path()
    folders = []
    if not ws_root.exists():
        return {"folders": []}
    
    for root, dirs, _ in os.walk(ws_root):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in {"node_modules", ".git", "__pycache__"}]
        for d in dirs:
            if d.lower() in ("videos", "video"):
                full_p = Path(root) / d
                try:
                    rel = full_p.relative_to(ws_root).as_posix()
                except Exception:
                    rel = full_p.name
                folders.append({
                    "name": rel,
                    "path": full_p.resolve().as_posix()
                })
    return {"folders": folders}


@router.post("/inspect_media")
def inspect_media(req: InspectMediaRequest):
    """Inspecciona las propiedades de un archivo de video o audio."""
    path_obj = Path(req.file_path)
    if not path_obj.exists():
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {req.file_path}")
    
    meta = probe_video_meta(path_obj)
    return {
        "file_name": path_obj.name,
        "path": path_obj.as_posix(),
        "size_mb": round(path_obj.stat().st_size / (1024 * 1024), 2),
        "duration_seconds": meta["duration"],
        "duration_formatted": format_time_hms(meta["duration"]),
        "width": meta["width"],
        "height": meta["height"],
        "fps": meta["fps"],
        "has_audio": meta["has_audio"]
    }

@router.post("/scan_audio_folder")
def scan_audio_folder(req: ScanAudioFolderRequest):
    """
    Escanea una carpeta en busca de canciones o pistas de audio,
    calcula la duración de cada una y devuelve la suma total exacta.
    """
    folder_path = Path(req.folder_path)
    if not folder_path.is_absolute():
        folder_path = (default_workspace_path() / folder_path).resolve()

    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(status_code=404, detail=f"Carpeta de música no encontrada: '{folder_path}'")

    audio_exts = {".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg", ".wma"}
    songs = []
    total_seconds = 0.0

    for item in sorted(folder_path.iterdir(), key=lambda x: x.name.lower()):
        if item.is_file() and item.suffix.lower() in audio_exts:
            dur = probe_duration(item)
            total_seconds += dur
            songs.append({
                "name": item.name,
                "path": item.as_posix(),
                "duration_seconds": round(dur, 2),
                "duration_formatted": format_time_hms(dur),
                "size_mb": round(item.stat().st_size / (1024 * 1024), 2)
            })

    return {
        "folder_path": folder_path.as_posix(),
        "total_songs": len(songs),
        "total_duration_seconds": round(total_seconds, 2),
        "total_duration_formatted": format_time_hms(total_seconds),
        "songs": songs
    }

def run_loop_render(job_id: str, req: CreateLoopRequest):
    """Worker en segundo plano para renderizar el loop con FFmpeg de máxima fidelidad."""
    ffmpeg = get_ffmpeg_path()
    temp_dir = get_temp_render_dir()
    
    JOBS[job_id]["status"] = "rendering"
    JOBS[job_id]["progress"] = 5

    try:
        # 1. Validar archivos de video de entrada
        valid_videos: List[Path] = []
        video_metas: List[Dict[str, Any]] = []
        for vp in req.video_paths:
            v_path = Path(vp)
            if not v_path.is_absolute():
                v_path = (default_workspace_path() / v_path).resolve()
            if v_path.exists() and v_path.is_file():
                valid_videos.append(v_path)
                video_metas.append(probe_video_meta(v_path))

        if not valid_videos:
            raise Exception("No se proporcionó ningún archivo de video válido existente.")

        # Calcular duración del ciclo individual
        cycle_duration = 0.0
        for v in valid_videos:
            cycle_duration += probe_duration(v)

        if cycle_duration <= 0.1:
            cycle_duration = 10.0 * len(valid_videos)

        # 2. Determinar duración objetivo
        target_duration = req.target_duration_seconds

        # Si el modo es audio_folder, la duración del loop es EXACTAMENTE la duración de las canciones
        audio_files_to_concat: List[Path] = []
        if req.duration_mode == "audio_folder" and req.audio_folder_path:
            af_dir = Path(req.audio_folder_path)
            if not af_dir.is_absolute():
                af_dir = (default_workspace_path() / af_dir).resolve()
            if af_dir.exists() and af_dir.is_dir():
                audio_exts = {".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg"}
                for item in sorted(af_dir.iterdir(), key=lambda x: x.name.lower()):
                    if item.is_file() and item.suffix.lower() in audio_exts:
                        audio_files_to_concat.append(item)
                
                if audio_files_to_concat:
                    total_audio_dur = sum(probe_duration(a) for a in audio_files_to_concat)
                    if total_audio_dur > 1.0:
                        target_duration = total_audio_dur

        # Si es modo previsualización, limitar a máximo 300 segundos (5 minutos)
        if req.is_preview:
            target_duration = min(300.0, target_duration)
            JOBS[job_id]["message"] = "Renderizando previsualización nítida..."
        else:
            JOBS[job_id]["message"] = f"Generando bucle de video ({format_time_hms(target_duration)})..."

        # 3. Ensamblaje de Secuencia de Línea de Tiempo (si hay múltiples clips)
        master_cycle_file = None
        effective_loop_videos = valid_videos

        res_map = {
            "1080p": (1920, 1080),
            "4k": (3840, 2160),
            "720p": (1280, 720),
            "shorts": (1080, 1920),
        }
        is_original_res = req.resolution.lower() == "original"
        if is_original_res and valid_videos:
            w = video_metas[0].get("width", 1920)
            h = video_metas[0].get("height", 1080)
        else:
            w, h = res_map.get(req.resolution.lower(), (1920, 1080))

        if len(valid_videos) > 1:
            JOBS[job_id]["message"] = f"Ensamblando {len(valid_videos)} clips en el orden de la línea de tiempo..."
            master_cycle_file = temp_dir / f"cycle_master_{job_id}.mp4"

            cycle_cmd = [str(ffmpeg), "-nostdin", "-y"]
            for v in valid_videos:
                cycle_cmd.extend(["-i", str(v)])

            filter_parts = []
            for i in range(len(valid_videos)):
                filter_parts.append(
                    f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v{i}]"
                )

            concat_inputs = "".join(f"[v{i}]" for i in range(len(valid_videos)))
            filter_parts.append(f"{concat_inputs}concat=n={len(valid_videos)}:v=1:a=0[outv]")

            cycle_cmd.extend([
                "-filter_complex", ";".join(filter_parts),
                "-map", "[outv]",
                "-an",
                "-c:v", "libx264",
                "-preset", "fast" if req.is_preview else "medium",
                "-crf", "14",
                "-tune", "film",
                "-x264-params", "aq-mode=3:aq-strength=1.1",
                "-threads", str(governor.get_hardware_specs()["safe_threads"]),
                str(master_cycle_file)
            ])

            proc_cycle = subprocess.run(cycle_cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW)
            if proc_cycle.returncode != 0:
                raise Exception(f"Fallo al concatenar clips de la línea de tiempo: {proc_cycle.stderr[-500:]}")

            effective_loop_videos = [master_cycle_file]
            cycle_duration = probe_duration(master_cycle_file)
            if cycle_duration <= 0.1:
                cycle_duration = 10.0

        # 4. Calcular repeticiones necesarias para cubrir la duración objetivo
        loops_needed = max(1, math.ceil(target_duration / cycle_duration))

        # Crear archivo de texto para concat demuxer de FFmpeg
        video_concat_txt = temp_dir / f"concat_v_{job_id}.txt"
        with open(video_concat_txt, "w", encoding="utf-8") as f:
            for _ in range(loops_needed):
                for v in effective_loop_videos:
                    clean_p = v.as_posix().replace("'", "'\\''")
                    f.write(f"file '{clean_p}'\n")

        # 5. Preparar concat de audio si existe
        audio_concat_txt = None
        if audio_files_to_concat:
            audio_concat_txt = temp_dir / f"concat_a_{job_id}.txt"
            with open(audio_concat_txt, "w", encoding="utf-8") as f:
                for a in audio_files_to_concat:
                    clean_ap = a.as_posix().replace("'", "'\\''")
                    f.write(f"file '{clean_ap}'\n")

        # 6. Detección Inteligente de Stream Copy (Cero Pérdida 1:1)
        # Si es un ciclo maestro ensamblado O si es 1 clip con resolución original
        user_wants_copy = req.quality == "lossless_copy"
        if master_cycle_file:
            # El ciclo maestro ya está normalizado y listo para copia directa
            can_stream_copy = True
        else:
            can_stream_copy = (user_wants_copy or is_original_res)

        # 1. Determinar carpeta de destino exacta del usuario
        ws_root = default_workspace_path()
        target_out_dir = None

        if req.output_folder_path and req.output_folder_path.strip():
            target_out_dir = Path(req.output_folder_path.strip())
            if not target_out_dir.is_absolute():
                target_out_dir = (ws_root / target_out_dir).resolve()
            else:
                target_out_dir = target_out_dir.resolve()
        elif req.output_channel:
            channel_dir = ws_root / req.output_channel
            target_out_dir = channel_dir / "Videos" if (channel_dir / "Videos").exists() else channel_dir
        else:
            # Si no se pasó ruta, intentar deducir desde el primer clip
            if valid_videos:
                first_parent = valid_videos[0].parent
                if "videos" in first_parent.name.lower():
                    target_out_dir = first_parent
                elif (first_parent / "Videos").exists():
                    target_out_dir = first_parent / "Videos"
                else:
                    target_out_dir = first_parent
            else:
                target_out_dir = ws_root

        target_out_dir.mkdir(parents=True, exist_ok=True)

        # 2. Configurar salida y eliminación del previsualizador al renderizar completo
        if req.is_preview:
            # Previsualizador guardado directamente en la carpeta destino como preview_loop.mp4
            output_file = target_out_dir / "preview_loop.mp4"
        else:
            # Al generar el video final con tiempo completo: ELIMINAR el previsualizador antes de renderizar
            try:
                preview_file = target_out_dir / "preview_loop.mp4"
                if preview_file.exists():
                    preview_file.unlink(missing_ok=True)
                for old_p in target_out_dir.glob("preview_*.mp4"):
                    old_p.unlink(missing_ok=True)
                for old_temp_p in temp_dir.glob("preview_*.mp4"):
                    old_temp_p.unlink(missing_ok=True)
            except Exception as e:
                print(f"[WARN] Error eliminando previsualizador previo: {e}")

            fname = req.output_filename or f"loop_{int(time.time())}.mp4"
            if not fname.endswith(".mp4"):
                fname += ".mp4"
            output_file = target_out_dir / fname


        JOBS[job_id]["progress"] = 25

        # 6. Construir comando FFmpeg
        cmd = [
            str(ffmpeg),
            "-nostdin",
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(video_concat_txt)
        ]

        if audio_concat_txt:
            cmd.extend([
                "-f", "concat",
                "-safe", "0",
                "-i", str(audio_concat_txt)
            ])

        cmd.extend(["-t", str(target_duration)])

        if can_stream_copy:
            # ── MODO STREAM COPY (100% CERO PÉRDIDA DE CALIDAD) ──
            JOBS[job_id]["message"] = "Ejecutando bucle en modo Copia Directa 1:1 (Calidad nativa sin compresión)..."
            cmd.extend(["-c:v", "copy"])

            if audio_concat_txt:
                cmd.extend([
                    "-c:a", "aac",
                    "-b:a", "320k",
                    "-map", "0:v:0",
                    "-map", "1:a:0"
                ])
            elif req.mute_original_audio:
                cmd.extend([
                    "-map", "0:v:0",
                    "-an"
                ])
            else:
                cmd.extend([
                    "-map", "0:v:0",
                    "-map", "0:a?",
                    "-c:a", "copy"
                ])
        else:
            # ── MODO RE-ENCODE ULTRA FIDELIDAD CON AQ-MODE 3 ──
            res_map = {
                "1080p": (1920, 1080),
                "4k": (3840, 2160),
                "720p": (1280, 720),
                "shorts": (1080, 1920),
            }
            
            if is_original_res and valid_videos:
                first_meta = video_metas[0] if video_metas else probe_video_meta(valid_videos[0])
                w, h = first_meta.get("width", 1920), first_meta.get("height", 1080)
                # Si es resolución original, NO forzar pad ni scale destructivo
                vf_filter = "setsar=1"
            else:
                w, h = res_map.get(req.resolution.lower(), (1920, 1080))
                vf_filter = f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1"

            # Perfiles anti-pixelado con aq-mode=3 (bias hacia escenas oscuras/espaciales) y tune film
            if req.quality in ("master", "lossless_copy"):
                crf = "12"
                preset = "medium" if req.is_preview else "slow"
                x264_opts = "aq-mode=3:aq-strength=1.2:qcomp=0.8:no-fast-pskip=1"
            elif req.quality == "balanced":
                crf = "18"
                preset = "fast" if req.is_preview else "medium"
                x264_opts = "aq-mode=3:aq-strength=1.0"
            else: # "high" (por defecto)
                crf = "15"
                preset = "medium"
                x264_opts = "aq-mode=3:aq-strength=1.1:no-fast-pskip=1"

            if req.is_preview:
                crf = "15"

            cmd.extend([
                "-vf", vf_filter,
                "-c:v", "libx264",
                "-tune", "film",
                "-crf", crf,
                "-preset", preset,
                "-x264-params", x264_opts,
                "-pix_fmt", "yuv420p",
                "-colorspace", "bt709",
                "-color_primaries", "bt709",
                "-color_trc", "bt709",
                "-threads", str(governor.get_hardware_specs()["safe_threads"]),
            ])

            if audio_concat_txt:
                cmd.extend([
                    "-c:a", "aac",
                    "-b:a", "320k",
                    "-map", "0:v:0",
                    "-map", "1:a:0"
                ])
            elif req.mute_original_audio:
                cmd.extend([
                    "-map", "0:v:0",
                    "-an"
                ])
            else:
                cmd.extend([
                    "-map", "0:v:0",
                    "-map", "0:a?",
                    "-c:a", "aac",
                    "-b:a", "256k"
                ])

        cmd.append(str(output_file))

        JOBS[job_id]["progress"] = 40
        JOBS[job_id]["message"] = "Codificando bucle continuo con gradientes nítidos y Lanczos..."

        # Ejecutar FFmpeg sin ventana emergente en Windows
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            creationflags=CREATE_NO_WINDOW
        )

        def progress_ticker():
            cur = 40
            while process.poll() is None:
                time.sleep(0.8)
                if cur < 92:
                    cur += 4
                    JOBS[job_id]["progress"] = cur
                    if cur > 75:
                        JOBS[job_id]["message"] = "Finalizando compresión y estructura de fotogramas..."
                    elif cur > 55:
                        JOBS[job_id]["message"] = "Procesando bucles y estabilizando gradientes..."

        ticker_thread = threading.Thread(target=progress_ticker, daemon=True)
        ticker_thread.start()

        _, stderr = process.communicate()

        if process.returncode != 0:
            raise Exception(f"FFmpeg falló (código {process.returncode}): {stderr[-600:]}")

        # Limpieza de archivos temporales de concat
        try:
            if video_concat_txt.exists():
                video_concat_txt.unlink()
            if audio_concat_txt and audio_concat_txt.exists():
                audio_concat_txt.unlink()
            if master_cycle_file and master_cycle_file.exists():
                master_cycle_file.unlink()
        except Exception:
            pass

        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["progress"] = 100
        JOBS[job_id]["output_path"] = output_file.as_posix()
        JOBS[job_id]["duration_seconds"] = round(target_duration, 2)
        JOBS[job_id]["duration_formatted"] = format_time_hms(target_duration)
        JOBS[job_id]["file_size_mb"] = round(output_file.stat().st_size / (1024 * 1024), 2)
        JOBS[job_id]["is_preview"] = req.is_preview
        JOBS[job_id]["message"] = "Renderizado completado con éxito."

    except Exception as e:
        JOBS[job_id]["status"] = "error"
        JOBS[job_id]["error"] = str(e)
        JOBS[job_id]["message"] = f"Error en renderizado: {str(e)}"
    finally:
        governor.release_job_slot(job_id)

@router.post("/create_loop")
def create_loop(req: CreateLoopRequest, background_tasks: BackgroundTasks):
    """
    Inicia la concatenación y creación de loop de video.
    Soporta modo previsualización (máx 5 min) y modo completo.
    """
    job_id = str(uuid.uuid4())
    slot_acquired = governor.acquire_job_slot(job_id, "video_loop", {
        "is_preview": req.is_preview,
        "resolution": req.resolution
    })

    initial_msg = "Iniciando renderizado..." if slot_acquired else "En cola: esperando que finalice otra tarea pesada..."
    JOBS[job_id] = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "message": initial_msg,
        "output_path": None,
        "is_preview": req.is_preview,
        "created_at": time.time()
    }

    # Iniciar renderizado en hilo de fondo
    background_tasks.add_task(run_loop_render, job_id, req)

    return {
        "job_id": job_id,
        "status": "processing" if slot_acquired else "queued",
        "slot_acquired": slot_acquired,
        "is_preview": req.is_preview,
        "message": initial_msg
    }

@router.get("/status/{job_id}")
def get_job_status(job_id: str):
    """Consulta el progreso y estado de un job de renderizado."""
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado.")
    return job

@router.get("/preview/{job_id}")
def get_preview_video(job_id: str):
    """Sirve el video de previsualización renderizado para reproducirlo directamente en la UI."""
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado.")
    
    if job.get("status") != "completed" or not job.get("output_path"):
        raise HTTPException(status_code=400, detail="El video aún no está listo o falló.")

    file_path = Path(job["output_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="El archivo de video generado no se encuentra en disco.")

    return FileResponse(
        path=str(file_path),
        media_type="video/mp4",
        filename=file_path.name
    )

# ──────────────────────────────────────────────
# Modelos y Endpoint: Timeline Pro Multipista
# ──────────────────────────────────────────────

class TimelineCutItem(BaseModel):
    clip_path: str
    start_time: float = 0.0
    end_time: Optional[float] = None
    duration: Optional[float] = None
    loop_to_duration: Optional[float] = None
    is_reversed: bool = False

class TimelineOverlayItem(BaseModel):
    type: str  # 'subscribe_cta' | 'like_cta' | 'lower_third' | 'channel_logo' | 'custom_image' | 'text'
    text: Optional[str] = None
    path: Optional[str] = None
    x_percent: float = 50.0
    y_percent: float = 85.0
    scale: float = 1.0
    start_time: float = 0.0
    duration: float = 5.0

class TimelineAudioTrackItem(BaseModel):
    id: Optional[str] = None
    path: str
    name: Optional[str] = None
    start_time: float = 0.0
    duration: Optional[float] = None
    volume: float = 1.0

class TimelineAudioConfig(BaseModel):
    voice_audio_path: Optional[str] = None
    music_audio_path: Optional[str] = None
    music_tracks: Optional[List[TimelineAudioTrackItem]] = []
    music_volume: float = 0.25
    mute_video_audio: bool = False

class RenderTimelineRequest(BaseModel):
    cuts: List[TimelineCutItem]
    overlays: Optional[List[TimelineOverlayItem]] = []
    audio: Optional[TimelineAudioConfig] = None
    subtitle_path: Optional[str] = None
    resolution: str = "1080p"  # "1080p" | "4k" | "720p" | "vertical_shorts"
    quality: str = "high"
    aspect_ratio: str = "16:9" # "16:9" | "9:16"
    output_folder_path: Optional[str] = None
    output_filename: Optional[str] = "render_final.mp4"
    is_preview: bool = False

def run_timeline_render(job_id: str, req: RenderTimelineRequest):
    """
    Ejecuta el pipeline de renderizado multipista en una sola pasada de FFmpeg.
    Soporta múltiples cortes/clips secuenciales (Multi-Clip Concat), trimming in/out,
    normalización de resolución y aspect ratio, capas de texto/overlays y mezcla de audio.
    """
    try:
        ffmpeg_bin = get_ffmpeg_path()
        ws_root = default_workspace_path()

        if not req.cuts or len(req.cuts) == 0:
            raise Exception("No se especificaron clips de video en la línea de tiempo.")

        # Determinar carpeta de destino
        if req.is_preview:
            output_folder = get_temp_render_dir()
            output_file = output_folder / f"preview_timeline_{job_id[:8]}.mp4"
        elif req.output_folder_path and req.output_folder_path.strip():
            output_folder = Path(req.output_folder_path.strip())
            if not output_folder.is_absolute():
                output_folder = (ws_root / output_folder).resolve()
            output_folder.mkdir(parents=True, exist_ok=True)
            output_name = req.output_filename or "render_final.mp4"
            if not output_name.lower().endswith(".mp4"):
                output_name += ".mp4"
            output_file = output_folder / output_name
        else:
            output_folder = ws_root / "temp_renders"
            output_folder.mkdir(parents=True, exist_ok=True)
            output_file = output_folder / f"timeline_render_{job_id[:8]}.mp4"

        JOBS[job_id]["message"] = "Analizando pistas de video, audio y capas..."
        JOBS[job_id]["progress"] = 10

        # Filtro de escala según formato y aspect ratio
        if req.aspect_ratio == "9:16" or req.resolution == "vertical_shorts":
            scale_filter = "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
        elif req.aspect_ratio == "1:1":
            scale_filter = "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
        elif req.aspect_ratio == "4:5":
            scale_filter = "scale=1080:1350:force_original_aspect_ratio=decrease,pad=1080:1350:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
        elif req.aspect_ratio == "21:9":
            scale_filter = "scale=2560:1080:force_original_aspect_ratio=decrease,pad=2560:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
        elif req.aspect_ratio == "4:3":
            scale_filter = "scale=1440:1080:force_original_aspect_ratio=decrease,pad=1440:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
        elif req.resolution == "4k":
            scale_filter = "scale=3840:2160:force_original_aspect_ratio=decrease,pad=3840:2160:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
        elif req.resolution == "720p":
            scale_filter = "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
        else:
            scale_filter = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"

        # Detección de Aceleración por Hardware GPU
        hw_specs = governor.get_hardware_specs()
        has_nvidia = hw_specs.get("gpu", {}).get("has_nvidia", False)
        
        vcodec = "libx264"
        crf_args = ["-crf", "17", "-preset", "medium"]
        if req.is_preview:
            crf_args = ["-crf", "22", "-preset", "veryfast"]
        elif sys.platform == "darwin":
            vcodec = "h264_videotoolbox"
            crf_args = ["-b:v", "6M"]
        elif has_nvidia and not req.is_preview:
            vcodec = "h264_nvenc"
            crf_args = ["-preset", "p5", "-cq", "18"]

        cmd = [str(ffmpeg_bin), "-y"]
        filter_complex_parts = []

        # ── 1. Cargar todas las entradas de video (Cuts) ──
        include_camera_audio = bool(req.audio and not req.audio.mute_video_audio)
        total_cuts_duration = 0.0
        loop_target_duration = None

        for i, cut in enumerate(req.cuts):
            cut_path = Path(cut.clip_path)
            if not cut_path.is_absolute():
                cut_path = (ws_root / cut_path).resolve()
            if not cut_path.exists():
                raise Exception(f"Clip no encontrado: {cut.clip_path}")

            # Si el corte tiene bucle activado, registrar duración objetivo
            if cut.loop_to_duration and cut.loop_to_duration > 0:
                loop_target_duration = cut.loop_to_duration
            cmd.extend(["-i", str(cut_path)])

            meta = probe_video_meta(cut_path)
            clip_has_audio = meta.get("has_audio", False)

            st = max(0.0, float(cut.start_time or 0.0))
            if cut.end_time and cut.end_time > st:
                et = float(cut.end_time)
            elif cut.duration and cut.duration > 0:
                et = st + float(cut.duration)
            elif meta.get("duration", 0) > st:
                et = float(meta["duration"])
            else:
                et = st + 15.0

            cut_dur = max(0.2, et - st)
            total_cuts_duration += cut_dur

            # Filtro de video para este corte (con soporte de inversión / reverse)
            rev_v = ",reverse" if getattr(cut, "is_reversed", False) else ""
            filter_complex_parts.append(
                f"[{i}:v]trim=start={st:.3f}:end={et:.3f},setpts=PTS-STARTPTS{rev_v},{scale_filter}[v_cut_{i}]"
            )

            # Filtro de audio para este corte si se requiere audio de cámara
            if include_camera_audio:
                if clip_has_audio:
                    rev_a = ",areverse" if getattr(cut, "is_reversed", False) else ""
                    filter_complex_parts.append(
                        f"[{i}:a]atrim=start={st:.3f}:end={et:.3f},asetpts=PTS-STARTPTS{rev_a},aformat=sample_rates=44100:channel_layouts=stereo[a_cut_{i}]"
                    )
                else:
                    filter_complex_parts.append(
                        f"aevalsrc=0:d={cut_dur:.3f}:s=44100:c=stereo[a_cut_{i}]"
                    )

        # Próximo índice de entrada libre para pistas auxiliares
        next_input_idx = len(req.cuts)

        # ── 2. Concatenación de Cortes Secuenciales (Multi-Clip) ──
        if len(req.cuts) == 1:
            v_base_label = "[v_cut_0]"
            a_base_label = "[a_cut_0]" if include_camera_audio else None
        else:
            if include_camera_audio:
                concat_inputs = "".join([f"[v_cut_{i}][a_cut_{i}]" for i in range(len(req.cuts))])
                filter_complex_parts.append(
                    f"{concat_inputs}concat=n={len(req.cuts)}:v=1:a=1[v_concat][a_concat]"
                )
                v_base_label = "[v_concat]"
                a_base_label = "[a_concat]"
            else:
                concat_inputs = "".join([f"[v_cut_{i}]" for i in range(len(req.cuts))])
                filter_complex_parts.append(
                    f"{concat_inputs}concat=n={len(req.cuts)}:v=1:a=0[v_concat]"
                )
                v_base_label = "[v_concat]"
                a_base_label = None

        # ── 2.1. Calcular Duración Maestra del Proyecto (Modelo Premiere / DaVinci) ──
        max_audio_end = 0.0
        if req.audio and req.audio.music_tracks:
            for trk in req.audio.music_tracks:
                st = float(trk.start_time or 0.0)
                dur = float(trk.duration or 0.0)
                max_audio_end = max(max_audio_end, st + dur)

        max_overlay_end = 0.0
        if req.overlays:
            for ov in req.overlays:
                st = float(ov.start_time or 0.0)
                dur = float(ov.duration or 0.0)
                max_overlay_end = max(max_overlay_end, st + dur)

        is_any_cut_looping = any(bool(c.loop_to_duration and c.loop_to_duration > 0) for c in req.cuts)
        master_project_duration = max(total_cuts_duration, max_audio_end, max_overlay_end)
        if is_any_cut_looping and loop_target_duration:
            master_project_duration = max(master_project_duration, loop_target_duration)

        # Si el audio o los overlays continúan más allá de los videos en V1
        if master_project_duration > total_cuts_duration and total_cuts_duration > 0:
            if is_any_cut_looping:
                loop_frames = max(30, int(round(total_cuts_duration * 30)))
                filter_complex_parts.append(f"{v_base_label}loop=loop=-1:size={loop_frames}:start=0[v_looped]")
                v_base_label = "[v_looped]"
            else:
                gap_sec = master_project_duration - total_cuts_duration
                filter_complex_parts.append(f"{v_base_label}tpad=stop_mode=add:stop_duration={gap_sec:.3f}:color=black[v_padded]")
                v_base_label = "[v_padded]"

        # ── 3. Capas y Overlays Interactivos (Texto, Stickers, CTAs) ──
        cur_v_label = v_base_label
        for idx, ov in enumerate(req.overlays or []):
            txt = ov.text or ("SUSCRÍBETE AL CANAL" if ov.type == "subscribe_cta" else "¡DALE LIKE!")
            # Sanitizar texto para FFmpeg drawtext
            safe_txt = txt.replace("'", "\\'").replace(":", "\\:").replace("%", "\\%")
            font_size = max(16, int(36 * (ov.scale or 1.0)))
            x_pos = f"(w-text_w)*{ov.x_percent}/100"
            y_pos = f"(h-text_h)*{ov.y_percent}/100"
            dur = ov.duration or 5.0
            enable_cond = f"between(t,{ov.start_time},{ov.start_time + dur})"
            next_v_label = f"[v_ov_{idx}]"
            filter_complex_parts.append(
                f"{cur_v_label}drawtext=text='{safe_txt}':fontsize={font_size}:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=10:x={x_pos}:y={y_pos}:enable='{enable_cond}'{next_v_label}"
            )
        # ── 3.1. Subtítulos Sincronizados Quemados en Video ──
        if req.subtitle_path and Path(req.subtitle_path).exists():
            clean_sub = Path(req.subtitle_path).as_posix().replace(":", "\\:")
            next_v_label = "[v_subbed]"
            filter_complex_parts.append(
                f"{cur_v_label}subtitles='{clean_sub}':force_style='FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2'{next_v_label}"
            )
            cur_v_label = next_v_label

        final_video_label = cur_v_label

        # ── 4. Entradas Adicionales de Audio (Voz & Música Multipista) ──
        voice_idx = None
        if req.audio and req.audio.voice_audio_path and Path(req.audio.voice_audio_path).exists():
            cmd.extend(["-i", str(req.audio.voice_audio_path)])
            voice_idx = next_input_idx
            next_input_idx += 1

        music_combined_label = None
        # Caso A: Múltiples pistas de música en la línea de tiempo (Multi-track Audio)
        if req.audio and req.audio.music_tracks and len(req.audio.music_tracks) > 0:
            music_trk_labels = []
            for m_i, trk in enumerate(req.audio.music_tracks):
                trk_p = Path(trk.path)
                if trk_p.exists():
                    cmd.extend(["-i", str(trk_p)])
                    in_idx = next_input_idx
                    next_input_idx += 1
                    
                    delay_ms = max(0, int(trk.start_time * 1000))
                    base_vol = req.audio.music_volume if req.audio else 0.25
                    vol = round(trk.volume * base_vol, 3)
                    
                    trim_filter = f"atrim=0:{round(trk.duration, 2)},asetpts=PTS-STARTPTS," if (trk.duration and trk.duration > 0) else ""
                    out_lbl = f"[m_trk_{m_i}]"
                    filter_complex_parts.append(
                        f"[{in_idx}:a]{trim_filter}volume={vol},adelay={delay_ms}|{delay_ms},aformat=sample_rates=44100:channel_layouts=stereo{out_lbl}"
                    )
                    music_trk_labels.append(out_lbl)

            if len(music_trk_labels) > 1:
                inputs_str = "".join(music_trk_labels)
                filter_complex_parts.append(
                    f"{inputs_str}amix=inputs={len(music_trk_labels)}:duration=longest:dropout_transition=0[m_mixed]"
                )
                music_combined_label = "[m_mixed]"
            elif len(music_trk_labels) == 1:
                music_combined_label = music_trk_labels[0]

        # Caso B: Pista de música única heredada (Legacy single-track)
        elif req.audio and req.audio.music_audio_path and Path(req.audio.music_audio_path).exists():
            cmd.extend(["-stream_loop", "-1", "-i", str(req.audio.music_audio_path)])
            music_idx = next_input_idx
            next_input_idx += 1
            m_vol = req.audio.music_volume if req.audio else 0.25
            filter_complex_parts.append(
                f"[{music_idx}:a]volume={m_vol},aformat=sample_rates=44100:channel_layouts=stereo[music_fmt]"
            )
            music_combined_label = "[music_fmt]"

        # Mezcla final de Audio
        audio_out_label = None
        audio_streams_to_mix = []

        if a_base_label:
            audio_streams_to_mix.append(a_base_label)

        if voice_idx is not None:
            filter_complex_parts.append(f"[{voice_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo[voice_fmt]")
            audio_streams_to_mix.append("[voice_fmt]")

        if music_combined_label is not None:
            audio_streams_to_mix.append(music_combined_label)

        if len(audio_streams_to_mix) > 1:
            inputs_str = "".join(audio_streams_to_mix)
            filter_complex_parts.append(
                f"{inputs_str}amix=inputs={len(audio_streams_to_mix)}:duration=longest:dropout_transition=2[a_mixed]"
            )
            audio_out_label = "[a_mixed]"
        elif len(audio_streams_to_mix) == 1:
            audio_out_label = audio_streams_to_mix[0]

        # ── 5. Ensamblado del Comando FFmpeg Final ──
        if filter_complex_parts:
            cmd.extend(["-filter_complex", ";".join(filter_complex_parts)])
            cmd.extend(["-map", final_video_label])
            if audio_out_label:
                cmd.extend(["-map", audio_out_label])
        else:
            cmd.extend(["-map", "0:v"])
            if audio_out_label:
                cmd.extend(["-map", audio_out_label])

        # Límite de Duración (Modelo Premiere: fin del elemento más lejano)
        if req.is_preview:
            cmd.extend(["-t", "30"])
        elif master_project_duration > 0:
            cmd.extend(["-t", str(round(master_project_duration, 2))])
        elif total_cuts_duration > 0:
            cmd.extend(["-t", str(round(total_cuts_duration, 2))])

        cmd.extend(["-c:v", vcodec])
        cmd.extend(crf_args)
        if audio_out_label:
            cmd.extend(["-c:a", "aac", "-b:a", "192k"])

        cmd.extend(["-movflags", "+faststart", str(output_file)])

        creationflags = 0x08000000 if sys.platform == "win32" else 0
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.DEVNULL,
            creationflags=creationflags,
            universal_newlines=True
        )

        JOBS[job_id]["message"] = "Renderizando composición multipista..."
        JOBS[job_id]["progress"] = 35

        def progress_ticker():
            cur = 35
            while process.poll() is None and cur < 92:
                time.sleep(1.2)
                cur += 4
                JOBS[job_id]["progress"] = cur

        ticker = threading.Thread(target=progress_ticker, daemon=True)
        ticker.start()

        _, stderr = process.communicate()

        if process.returncode != 0:
            raise Exception(f"FFmpeg falló al componer el timeline: {stderr[-500:]}")

        file_size = output_file.stat().st_size / (1024 * 1024) if output_file.exists() else 0
        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["progress"] = 100
        JOBS[job_id]["output_path"] = output_file.as_posix()
        JOBS[job_id]["file_size_mb"] = round(file_size, 2)
        JOBS[job_id]["is_preview"] = req.is_preview
        JOBS[job_id]["message"] = "Composición de video finalizada con éxito."

    except Exception as e:
        JOBS[job_id]["status"] = "error"
        JOBS[job_id]["error"] = str(e)
        JOBS[job_id]["message"] = f"Error en renderizado: {str(e)}"
    finally:
        governor.release_job_slot(job_id)

@router.post("/render_timeline")
def render_timeline(req: RenderTimelineRequest, background_tasks: BackgroundTasks):
    """
    Inicia la composición y renderizado multipista del Timeline Studio en el motor local.
    """
    job_id = str(uuid.uuid4())
    slot_acquired = governor.acquire_job_slot(job_id, "video_timeline", {
        "is_preview": req.is_preview,
        "resolution": req.resolution
    })

    initial_msg = "Iniciando renderizado de timeline..." if slot_acquired else "En cola: esperando slot disponible..."
    JOBS[job_id] = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "message": initial_msg,
        "output_path": None,
        "is_preview": req.is_preview,
        "created_at": time.time()
    }

    background_tasks.add_task(run_timeline_render, job_id, req)

    return {
        "job_id": job_id,
        "status": "processing" if slot_acquired else "queued",
        "slot_acquired": slot_acquired,
        "is_preview": req.is_preview,
        "message": initial_msg
    }
