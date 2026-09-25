import os
import signal
import threading
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import workspace, chat, video_looper, subtitles, tts, system
from hardware import governor

import sys
import multiprocessing

# Determinar directorio base según si está empaquetado (.exe) o ejecutándose como script .py
if getattr(sys, 'frozen', False):
    base_dir = os.path.dirname(os.path.abspath(sys.executable))
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))

possible_bin_dirs = [
    os.path.join(base_dir, "bin"),
    os.path.join(os.path.dirname(base_dir), "bin"),
]
for b_dir in possible_bin_dirs:
    if os.path.exists(b_dir) and b_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = b_dir + os.pathsep + os.environ["PATH"]

app = FastAPI(
    title="AutoProd Local Controlador",
    description="Motor local para procesar video y gestionar workspace en AutoProd",
    version=system.CURRENT_MOTOR_VERSION
)

# Configuración de CORS universal para permitir conexión desde el dashboard (localhost o producción)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Registrar Routers
app.include_router(workspace.router)
app.include_router(chat.router)
app.include_router(video_looper.router)
app.include_router(subtitles.router)
app.include_router(tts.router)
app.include_router(system.router)

@app.get("/")
def root():
    ws_path = str(workspace.default_workspace_path().as_posix())
    return {
        "status": "online",
        "service": "AutoProd Local Motor",
        "version": "1.0.0",
        "workspace_path": ws_path,
        "docs": "/docs",
        "status_url": "/status"
    }

@app.get("/status")
def get_status():
    ws_path = str(workspace.default_workspace_path().as_posix())
    return {
        "status": "online",
        "message": "Motor local conectado correctamente.",
        "version": "1.0.0",
        "workspace_path": ws_path
    }

@app.get("/system/hardware")
def get_system_hardware():
    """Retorna las especificaciones de hardware y el estado de concurrencia del equipo."""
    return governor.get_hardware_specs()

@app.post("/shutdown")
def shutdown_server():
    """Apaga el servidor de manera remota matando el proceso actual."""
    def kill_it():
        time.sleep(1) # Dar un segundo para que la respuesta HTTP se envíe
        os.kill(os.getpid(), signal.SIGTERM)
    
    threading.Thread(target=kill_it).start()
    return {"status": "success", "message": "Apagando el motor local..."}

if __name__ == "__main__":
    multiprocessing.freeze_support()
    import uvicorn
    if getattr(sys, 'frozen', False):
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
    else:
        uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
