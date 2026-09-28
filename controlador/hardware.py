import os
import sys
import ctypes
import shutil
import subprocess
import threading
import time
from typing import Dict, Any, Optional, List

class MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [
        ('dwLength', ctypes.c_ulong),
        ('dwMemoryLoad', ctypes.c_ulong),
        ('ullTotalPhys', ctypes.c_ulonglong),
        ('ullAvailPhys', ctypes.c_ulonglong),
        ('ullTotalPageFile', ctypes.c_ulonglong),
        ('ullAvailPageFile', ctypes.c_ulonglong),
        ('ullTotalVirtual', ctypes.c_ulonglong),
        ('ullAvailVirtual', ctypes.c_ulonglong),
        ('sullAvailExtendedVirtual', ctypes.c_ulonglong),
    ]

def set_background_priority():
    """
    Configura la prioridad del proceso a 'Below Normal'.
    Esto asegura que Windows/macOS siempre den 100% de prioridad a la interfaz gráfica,
    el navegador y el cursor del usuario, evitando cualquier congelamiento o lag.
    """
    try:
        if sys.platform == "win32":
            BELOW_NORMAL_PRIORITY_CLASS = 0x00004000
            ctypes.windll.kernel32.SetPriorityClass(
                ctypes.windll.kernel32.GetCurrentProcess(),
                BELOW_NORMAL_PRIORITY_CLASS
            )
        else:
            os.nice(10)
    except Exception:
        pass

class HardwareGovernor:
    """
    Gestor de Recursos y Concurrencia de AutoProd.
    - Detecta capacidades físicas del computador (CPU, RAM, GPU).
    - Regula el uso de hilos para evitar saturar o congelar el PC.
    - Administra una cola de tareas pesadas (FFmpeg y Whisper).
    - Proporciona estimaciones de tiempo adaptadas a la capacidad del equipo.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(HardwareGovernor, cls).__new__(cls)
                    cls._instance._init_governor()
        return cls._instance

    def _init_governor(self):
        self.job_lock = threading.Lock()
        self.active_job: Optional[Dict[str, Any]] = None
        self.queue: List[Dict[str, Any]] = []
        self._cached_specs = None
        self._last_specs_time = 0
        set_background_priority()

    def get_hardware_specs(self) -> Dict[str, Any]:
        """Obtiene las especificaciones de hardware en tiempo real."""
        now = time.time()
        if self._cached_specs and (now - self._last_specs_time < 10):
            return self._cached_specs

        # 1. CPU & Gobernanza de Concurrencia Silenciosa
        cpu_cores = os.cpu_count() or 4
        # Para CTranslate2/Whisper, 2 a 4 hilos es el punto óptimo de ancho de banda de memoria.
        # Más de 4 hilos no acelera la inferencia pero satura la CPU y eleva temperaturas.
        if cpu_cores <= 2:
            safe_threads = 1
        elif cpu_cores <= 4:
            safe_threads = 2
        elif cpu_cores <= 8:
            safe_threads = 3
        else:
            safe_threads = 4  # Con 4 hilos la CPU se mantiene fresca, silenciosa y la UI no pierde fluidez

        # 2. Memoria RAM
        total_ram_gb = 8.0
        avail_ram_gb = 4.0
        memory_load = 50

        if sys.platform == "win32":
            try:
                stat = MEMORYSTATUSEX()
                stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
                if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                    total_ram_gb = round(stat.ullTotalPhys / (1024**3), 2)
                    avail_ram_gb = round(stat.ullAvailPhys / (1024**3), 2)
                    memory_load = stat.dwMemoryLoad
            except Exception:
                pass
        else:
            try:
                total_ram_gb = round(os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES') / (1024**3), 2)
            except Exception:
                pass

        # 3. GPU
        gpu_name = "Gráficos Integrados / No detectada"
        has_gpu = False
        has_cuda = False

        if sys.platform == "win32":
            CREATE_NO_WINDOW = 0x08000000
            # Verificar NVIDIA SMI
            if shutil.which("nvidia-smi"):
                try:
                    out = subprocess.check_output(
                        ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                        encoding="utf-8",
                        errors="ignore",
                        creationflags=CREATE_NO_WINDOW
                    )
                    lines = [l.strip() for l in out.splitlines() if l.strip()]
                    if lines:
                        gpu_name = lines[0]
                        has_gpu = True
                        has_cuda = True
                except Exception:
                    pass

            # Si no fue nvidia-smi, consultar el registro de Windows
            if not has_gpu:
                try:
                    out = subprocess.check_output(
                        ['reg', 'query', r'HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}', '/s', '/v', 'DriverDesc'],
                        encoding="utf-8",
                        errors="ignore",
                        creationflags=CREATE_NO_WINDOW
                    )
                    for line in out.splitlines():
                        if "DriverDesc" in line and "REG_SZ" in line:
                            parts = line.split("REG_SZ")
                            if len(parts) > 1:
                                cand = parts[1].strip()
                                if cand and cand.lower() not in ["basic display adapter", "miracast"]:
                                    gpu_name = cand
                                    has_gpu = True
                                    if "nvidia" in cand.lower() or "geforce" in cand.lower() or "rtx" in cand.lower():
                                        has_cuda = True
                                    break
                except Exception:
                    pass

        # Nivel de potencia estimado del equipo: "high" | "medium" | "low"
        if cpu_cores >= 8 and total_ram_gb >= 15.0 and has_gpu:
            power_level = "high"
        elif cpu_cores >= 4 and total_ram_gb >= 7.5:
            power_level = "medium"
        else:
            power_level = "low"

        specs = {
            "cpu_cores": cpu_cores,
            "safe_threads": safe_threads,
            "total_ram_gb": total_ram_gb,
            "avail_ram_gb": avail_ram_gb,
            "memory_load_percent": memory_load,
            "gpu_name": gpu_name,
            "has_gpu": has_gpu,
            "has_cuda": has_cuda,
            "power_level": power_level,
            "is_busy": self.active_job is not None,
            "active_job": self.active_job,
            "queue_length": len(self.queue)
        }

        self._cached_specs = specs
        self._last_specs_time = now
        return specs

    def estimate_subtitles_time(self, total_audio_seconds: float, engine: str) -> Dict[str, Any]:
        """
        Calcula el tiempo estimado para procesar subtítulos según el motor y el hardware.
        """
        specs = self.get_hardware_specs()
        
        # Whisper Cloud API: ultrarrápida (~0.05x - 0.08x tiempo real)
        api_factor = 0.06
        api_est_sec = max(3.0, total_audio_seconds * api_factor)

        # GPU Local: ~0.12x - 0.20x tiempo real
        gpu_factor = 0.15 if specs["has_cuda"] else 0.30
        gpu_est_sec = max(5.0, total_audio_seconds * gpu_factor)

        opt_config = self.get_optimal_whisper_config()
        if opt_config["profile"] == "low_resource_safe":
            cpu_factor = 0.8
            cpu_est_sec = max(15.0, total_audio_seconds * cpu_factor)
            cpu_impact_desc = f"Ultraligero defensivo (1 núcleo, ~450MB RAM para no saturar 4GB)"
        else:
            cpu_cores = specs["cpu_cores"]
            cpu_factor = max(0.5, 1.3 - (min(cpu_cores, 12) * 0.06))
            cpu_est_sec = max(10.0, total_audio_seconds * cpu_factor)
            cpu_impact_desc = f"Protegido (~{specs['safe_threads']} de {specs['cpu_cores']} núcleos, ~1.1GB RAM)"

        def fmt(sec: float) -> str:
            m = int(sec // 60)
            s = int(sec % 60)
            if m == 0:
                return f"{s} segundos"
            if s == 0:
                return f"{m} min"
            return f"{m} min {s} s"

        return {
            "media_duration_seconds": round(total_audio_seconds, 2),
            "media_duration_formatted": fmt(total_audio_seconds),
            "optimal_profile": opt_config,
            "engine_estimates": {
                "openai_api": {
                    "estimated_seconds": round(api_est_sec, 1),
                    "formatted": fmt(api_est_sec),
                    "cpu_impact": "0% (Procesamiento en la nube)",
                    "speed_multiplier": "15x - 20x más rápido",
                    "recommended": True
                },
                "local_gpu": {
                    "estimated_seconds": round(gpu_est_sec, 1),
                    "formatted": fmt(gpu_est_sec),
                    "cpu_impact": "Bajo (Acelerado por GPU)",
                    "speed_multiplier": "5x - 8x más rápido",
                    "supported": specs["has_gpu"]
                },
                "local_cpu": {
                    "estimated_seconds": round(cpu_est_sec, 1),
                    "formatted": fmt(cpu_est_sec),
                    "cpu_impact": cpu_impact_desc,
                    "speed_multiplier": "Velocidad estándar protegida",
                    "supported": True
                }
            },
            "selected_engine": engine,
            "selected_estimate": fmt(
                api_est_sec if engine == "openai_api" else (gpu_est_sec if engine == "local_gpu" else cpu_est_sec)
            ),
            "power_warning": "Por favor no apagues ni suspendas el PC durante la generación de subtítulos.",
            "charger_warning": "Se recomienda mantener el cargador conectado si es un portátil."
        }

    def acquire_job_slot(self, job_id: str, task_type: str, meta: Dict[str, Any]) -> bool:
        """
        Adquiere el slot de procesamiento pesado. Si ya hay una tarea en ejecución,
        se coloca en la cola de espera de forma ordenada y retorna False.
        """
        with self.job_lock:
            if self.active_job is None:
                self.active_job = {
                    "job_id": job_id,
                    "type": task_type,
                    "started_at": time.time(),
                    "meta": meta
                }
                return True
            else:
                self.queue.append({
                    "job_id": job_id,
                    "type": task_type,
                    "queued_at": time.time(),
                    "meta": meta
                })
                return False

    def get_optimal_whisper_config(self) -> Dict[str, Any]:
        """
        Determina de forma adaptativa el modelo, cantidad de hilos y tipo de cómputo
        según el hardware exacto del cliente (especialmente para laptops de 4GB RAM y 2-4 núcleos),
        garantizando que la máquina no se bloquee ni congele mientras procesa.
        """
        specs = self.get_hardware_specs()
        avail_ram = specs.get("avail_ram_gb", 4.0)
        total_ram = specs.get("total_ram_gb", 8.0)
        cpu_cores = specs.get("cpu_cores", 4)
        has_cuda = specs.get("has_cuda", False)

        # 1. Si el cliente tiene GPU NVIDIA con CUDA disponible
        if has_cuda:
            return {
                "device": "cuda",
                "model_size": "small",
                "compute_type": "float16",
                "threads": 2,
                "profile": "gpu_accelerated",
                "description": "GPU NVIDIA CUDA activa: alta velocidad y consumo casi nulo de CPU."
            }

        # 2. Perfil PC Modesto / Laptop de 4 GB RAM (o menos de 1.8 GB libres en RAM)
        # Modo 'Defensa Crítica': Carga 'base' con INT8 (solo ~450 MB de RAM y 1 hilo)
        # Esto previene absolutamente que Windows recurra al swap de disco (paging) y congele el PC.
        if total_ram <= 4.5 or avail_ram < 1.8:
            return {
                "device": "cpu",
                "model_size": "base",
                "compute_type": "int8",
                "threads": 1,
                "profile": "low_resource_safe",
                "description": "Perfil defensivo de 4GB RAM: 1 hilo en CPU y huella de RAM ultrabaja (~450MB)."
            }

        # 3. PC Estándar (8 GB a 16 GB RAM con CPU estándar)
        # Modo 'Equilibrado': Carga 'small' con INT8 (~1.1 GB RAM, 2 a 3 hilos)
        threads = 2 if cpu_cores <= 4 else (3 if cpu_cores <= 8 else 4)
        return {
            "device": "cpu",
            "model_size": "small",
            "compute_type": "int8",
            "threads": threads,
            "profile": "balanced_quality",
            "description": f"Perfil equilibrado: modelo small con {threads} hilos (~1.1GB RAM)."
        }

    def release_job_slot(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Libera el slot de la tarea finalizada y promueve la siguiente tarea en cola.
        """
        with self.job_lock:
            if self.active_job and self.active_job.get("job_id") == job_id:
                self.active_job = None

            # Si hay tareas en cola, promover la primera
            if self.queue:
                next_job = self.queue.pop(0)
                next_job["started_at"] = time.time()
                self.active_job = next_job
                return next_job
            return None

# Instancia singleton accesible globalmente
governor = HardwareGovernor()
