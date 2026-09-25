import os
import sys
import time
import signal
import threading
import subprocess
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import requests

router = APIRouter(
    prefix="/system",
    tags=["system"]
)

# Versión canónica del motor local
CURRENT_MOTOR_VERSION = "1.0.0"

class UpdateRequest(BaseModel):
    download_url: Optional[str] = None
    version: Optional[str] = None

def get_base_dir() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent

@router.get("/version")
def get_version():
    """Retorna la versión actual instalada del motor local y metadatos de entorno."""
    return {
        "version": CURRENT_MOTOR_VERSION,
        "platform": sys.platform,
        "is_frozen": getattr(sys, 'frozen', False),
        "executable": sys.executable,
        "base_dir": str(get_base_dir())
    }

def execute_swap_and_restart(temp_path: Path, target_exe: Path):
    """
    Ejecuta el script de swap atómico según el sistema operativo.
    Espera 1 segundo para asegurar que la respuesta HTTP se haya enviado y el puerto quede liberado.
    """
    time.sleep(1.2)
    pid = os.getpid()
    base_dir = get_base_dir()

    if sys.platform == "win32":
        swap_bat = base_dir / "update_swap.bat"
        # Script batch que espera liberación de proceso, reemplaza el binario y lo arranca
        bat_content = f"""@echo off
timeout /t 1 /nobreak >nul
taskkill /F /PID {pid} >nul 2>&1
move /y "{str(temp_path)}" "{str(target_exe)}" >nul 2>&1
start "" "{str(target_exe)}"
del "%~f0"
"""
        swap_bat.write_text(bat_content, encoding="utf-8")
        
        # Lanzar proceso completamente desacoplado (DETACHED_PROCESS = 0x00000008)
        DETACHED_PROCESS = 0x00000008
        subprocess.Popen(
            ["cmd.exe", "/c", str(swap_bat)],
            creationflags=DETACHED_PROCESS,
            close_fds=True,
            cwd=str(base_dir)
        )
        # Terminar proceso actual de inmediato
        os._exit(0)

    else:
        # macOS / Linux (UNIX)
        try:
            # En UNIX un archivo en ejecución puede ser reemplazado atómicamente con os.replace
            os.replace(str(temp_path), str(target_exe))
            os.chmod(str(target_exe), 0o755)

            # Relanzar en segundo plano desacoplado
            subprocess.Popen(
                ["/bin/bash", "-c", f"sleep 1 && '{str(target_exe)}' &"],
                start_new_session=True,
                cwd=str(base_dir)
            )
            os._exit(0)
        except Exception as e:
            print(f"[Auto-Update] Error en swap UNIX: {e}")
            os._exit(1)

@router.post("/update")
def trigger_update(req: UpdateRequest, background_tasks: BackgroundTasks):
    """
    Descarga el nuevo binario ligero del motor y ejecuta el reemplazo seguro.
    """
    is_frozen = getattr(sys, 'frozen', False)
    target_version = req.version or "latest"
    download_url = req.download_url

    # Si no se proveyó download_url, consultar release de GitHub
    if not download_url:
        repo = os.environ.get("GITHUB_REPO", "ma730dev/AutoProdAI")
        try:
            gh_res = requests.get(f"https://api.github.com/repos/{repo}/releases/latest", timeout=10)
            if gh_res.ok:
                rel_data = gh_res.json()
                target_version = rel_data.get("tag_name", "latest").replace("v", "")
                target_asset_name = "autoprod-motor.exe" if sys.platform == "win32" else "autoprod-motor"
                for asset in rel_data.get("assets", []):
                    if asset.get("name") == target_asset_name:
                        download_url = asset.get("browser_download_url")
                        break
        except Exception as e:
            print(f"[Auto-Update] No se pudo resolver URL remota: {e}")

    if not download_url:
        # Fallback a URL canónica directa de GitHub latest
        repo = os.environ.get("GITHUB_REPO", "ma730dev/AutoProdAI")
        asset_name = "autoprod-motor.exe" if sys.platform == "win32" else "autoprod-motor"
        download_url = f"https://github.com/{repo}/releases/latest/download/{asset_name}"

    base_dir = get_base_dir()
    exe_name = "autoprod-motor.exe" if sys.platform == "win32" else "autoprod-motor"
    target_exe = base_dir / exe_name
    temp_download = base_dir / f"{exe_name}.update"

    if not is_frozen:
        # Modo desarrollo (ejecutándose desde main.py con Python estándar)
        return {
            "status": "dev_mode",
            "message": "El motor se está ejecutando desde código fuente (modo desarrollo). Para actualizar, realiza git pull en tu terminal.",
            "current_version": CURRENT_MOTOR_VERSION,
            "target_version": target_version
        }

    try:
        # Descarga con streaming
        print(f"[Auto-Update] Descargando actualización desde: {download_url}")
        res = requests.get(download_url, stream=True, timeout=60)
        if not res.ok:
            raise HTTPException(status_code=502, detail=f"Fallo al descargar binario: HTTP {res.status_code}")

        with open(temp_download, "wb") as f:
            for chunk in res.iter_content(chunk_size=1024 * 64):
                if chunk:
                    f.write(chunk)

        # Validar tamaño mínimo de binario (al menos 2 MB para evitar páginas de error 404 HTML)
        file_size = temp_download.stat().st_size
        if file_size < 2 * 1024 * 1024:
            temp_download.unlink(missing_ok=True)
            raise HTTPException(status_code=502, detail="El archivo descargado es inválido o está corrupto.")

        if sys.platform != "win32":
            os.chmod(temp_download, 0o755)

        # Programar el swap desacoplado en background
        background_tasks.add_task(execute_swap_and_restart, temp_download, target_exe)

        return {
            "status": "updating",
            "message": f"Actualización a v{target_version} descargada correctamente ({file_size // (1024*1024)} MB). El motor se reiniciará en unos segundos.",
            "current_version": CURRENT_MOTOR_VERSION,
            "target_version": target_version
        }

    except HTTPException:
        raise
    except Exception as e:
        if temp_download.exists():
            temp_download.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Error durante el proceso de auto-update: {str(e)}")
