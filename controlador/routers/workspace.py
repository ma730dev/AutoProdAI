import os
import sys
import shutil
import subprocess
import base64
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(
    prefix="/workspace",
    tags=["workspace"],
)



import json
import unicodedata

def normalize_str(s: str) -> str:
    return unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('utf-8').lower()

def init_channel_template_files(channel_dir: Path, channel_name: str, niche: Optional[str] = None):
    """Crea la estructura modular completa de un canal con sus carpetas y plantillas Markdown."""
    try:
        channel_dir.mkdir(parents=True, exist_ok=True)
        cname = channel_name.strip()
        cniche = (niche or cname).strip()

        # 1. Subcarpetas de producción: InfoCanal, Guiones, Videos, Miniatura, Musica, Imagenes
        subfolders = ["InfoCanal", "Guiones", "Videos", "Miniatura", "Musica", "Imagenes"]
        for sub in subfolders:
            (channel_dir / sub).mkdir(parents=True, exist_ok=True)

        # 2. Plantillas en InfoCanal/
        info_canal = channel_dir / "InfoCanal"
        contexto_file = info_canal / "Contexto_canal.md"
        if not contexto_file.exists():
            contexto_file.write_text(
                f"# Contexto y ADN del Canal: {cname}\n\n"
                f"## 🎯 Nicho y Audiencia Objetivo\n"
                f"- **Temática / Nicho:** {cniche}\n"
                f"- **Público Objetivo:** Creadores, profesionales y entusiastas interesados en {cniche}\n"
                f"- **Tono de Voz:** Cercano, profesional, dinámico y de alto valor para el creador\n\n"
                f"## 📋 Directivas de Producción y Marca\n"
                f"- **Estilo visual:** Moderno, limpio y minimalista\n"
                f"- **Duración promedio:** 8 - 15 minutos\n"
                f"- **Frecuencia:** Constante según cronograma de producción\n",
                encoding="utf-8"
            )

        metricas_file = info_canal / "Metricas_canal.md"
        if not metricas_file.exists():
            metricas_file.write_text(
                f"# Métricas y Rendimiento del Canal: {cname}\n\n"
                f"| Fecha | Video | Vistas | CTR Miniatura | Retención Media |\n"
                f"|---|---|---|---|---|\n"
                f"| Registro | Video 1 (Base) | - | - | - |\n",
                encoding="utf-8"
            )

        historial_file = info_canal / "Historial_canal.md"
        if not historial_file.exists():
            historial_file.write_text(
                f"# Historial de Contenido y Banco de Ideas: {cname}\n\n"
                f"## 📌 Temas Cubiertos\n"
                f"- [x] Apertura e inicialización del canal {cname}\n\n"
                f"## 💡 Banco de Ideas Futuras\n"
                f"- Idea 1: Introducción a {cniche} y fundamentos clave\n"
                f"- Idea 2: Guía práctica paso a paso para creadores\n"
                f"- Idea 3: Análisis de tendencias y errores comunes\n",
                encoding="utf-8"
            )

        # 3. Plantilla en Guiones/
        guiones = channel_dir / "Guiones"
        guion_file = guiones / "Plantilla_Guion.md"
        if not guion_file.exists():
            guion_file.write_text(
                f"# Guion: [Título del Video para {cname}]\n\n"
                f"## 🎣 Gancho Inicial (0:00 - 0:30)\n"
                f"- Planteamiento del problema y por qué este contenido es indispensable.\n\n"
                f"## 📖 Desarrollo Principal (0:30 - 7:00)\n"
                f"- Punto 1: Concepto clave y contexto\n"
                f"- Punto 2: Demostración práctica y desglose de valor\n"
                f"- Punto 3: Conclusión accionable\n\n"
                f"## 🚀 Llamado a la Acción y Cierre (7:00 - 8:00)\n"
                f"- Pregunta para interacción en comentarios y cierre de video.\n",
                encoding="utf-8"
            )

        # 4. Videos/
        videos = channel_dir / "Videos"
        videos_readme = videos / "README.md"
        if not videos_readme.exists():
            videos_readme.write_text(f"# Videos y Clips ({cname})\nAlmacenamiento de metraje bruto, grabaciones y exportaciones finales.\n", encoding="utf-8")

        # 5. Miniatura/
        miniatura = channel_dir / "Miniatura"
        miniatura_ideas = miniatura / "Ideas_Miniaturas.md"
        if not miniatura_ideas.exists():
            miniatura_ideas.write_text(
                f"# Conceptos de Miniaturas: {cname}\n\n"
                f"- **Concepto 1:** Expresión de alto impacto con elemento central de contraste.\n"
                f"- **Tipografía:** Máximo 3 palabras grandes y legibles en dispositivos móviles.\n"
                f"- **Colores:** Tonos vibrantes sobre fondo oscuro.\n",
                encoding="utf-8"
            )

        # 6. Musica/
        musica = channel_dir / "Musica"
        musica_readme = musica / "README.md"
        if not musica_readme.exists():
            musica_readme.write_text(f"# Música de Fondo ({cname})\nPistas musicales y efectos sonoros libres de derechos de autor.\n", encoding="utf-8")

        # 7. Imagenes/
        imagenes = channel_dir / "Imagenes"
        imagenes_readme = imagenes / "README.md"
        if not imagenes_readme.exists():
            imagenes_readme.write_text(f"# Recursos Gráficos e Imágenes ({cname})\nBanners, texturas, capturas y miniaturas generadas con IA.\n", encoding="utf-8")
    except Exception as e:
        print(f"[init_channel_template_files] Error al inicializar plantillas para {channel_name}: {e}")

def ensure_youtube_workspace_and_template(base_ws: Path) -> Path:
    """Garantiza la existencia de la carpeta 'youtube' y la plantilla inicial de Canal_1 si está vacía."""
    try:
        if base_ws.name.lower() == "youtube":
            youtube_dir = base_ws
        else:
            youtube_dir = base_ws / "youtube"

        youtube_dir.mkdir(parents=True, exist_ok=True)

        # Si youtube_dir está vacía de canales, crear Canal_1 con su plantilla completa
        channel_dirs = [d for d in youtube_dir.iterdir() if d.is_dir() and not d.name.startswith('.')]
        if not channel_dirs:
            init_channel_template_files(youtube_dir / "Canal_1", "Canal_1", "Temática Principal del Canal")

        return youtube_dir
    except Exception as e:
        print(f"[ensure_youtube_workspace_and_template] Error: {e}")
        return base_ws

def default_workspace_path() -> Path:
    possible_config_paths = []
    if getattr(sys, 'frozen', False):
        possible_config_paths.append(Path(sys.executable).resolve().parent / ".autoprod-config.json")

    possible_config_paths.extend([
        Path(__file__).resolve().parent.parent.parent / ".autoprod-config.json",
        Path(__file__).resolve().parent.parent / ".autoprod-config.json",
        Path.cwd() / ".autoprod-config.json",
        Path.home() / "AutoProdAI" / ".autoprod-config.json",
        Path.home() / ".autoprod-config.json",
    ])
    for config_path in possible_config_paths:
        if config_path.exists():
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
                    if "basePath" in config and config["basePath"]:
                        bp = Path(config["basePath"]).resolve()
                        if bp.name.lower() == "youtube":
                            return ensure_youtube_workspace_and_template(bp)
                        if (bp / "workspace").exists():
                            return ensure_youtube_workspace_and_template(bp / "workspace")
                        return ensure_youtube_workspace_and_template(bp)
            except Exception:
                pass
    fallback_ws = (Path.home() / "AutoProdAI" / "workspace").resolve()
    return ensure_youtube_workspace_and_template(fallback_ws)


def resolve_target_dir(base_path: Optional[str] = None, channel_name: Optional[str] = None) -> Path:
    ws_root = default_workspace_path()
    raw = (base_path or "").strip()
    cname = (channel_name or "").strip()

    if raw and raw not in [".", "/"]:
        target = Path(raw)
    elif cname:
        target = ws_root / cname
    else:
        target = ws_root

    # Si es relativa, anclar a ws_root
    if not target.is_absolute():
        target = (ws_root / target).resolve()

    # Si no existe directamente, intentar búsqueda insensible a mayúsculas/acentos en ws_root
    try:
        if not target.exists() and ws_root.exists():
            norm_name = normalize_str(target.name)
            for item in ws_root.iterdir():
                if item.is_dir() and normalize_str(item.name) == norm_name:
                    return item.resolve()
    except Exception:
        pass

    return target.resolve()

@router.get("/default")
def default_workspace():
    """Retorna la ruta por defecto donde se ubican los canales leyendo la configuración."""
    return {"path": default_workspace_path().as_posix()}

@router.post("/open_folder")
def open_folder(payload: Optional[dict] = None):
    """Abre la carpeta del workspace en el explorador de archivos nativo del SO."""
    target = default_workspace_path()
    if payload and isinstance(payload, dict) and payload.get("path"):
        p = Path(payload["path"])
        if p.exists():
            target = p
    try:
        if sys.platform == "win32":
            os.startfile(str(target))
        elif sys.platform == "darwin":
            subprocess.run(["open", str(target)])
        else:
            subprocess.run(["xdg-open", str(target)])
        return {"success": True, "path": str(target)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error abriendo explorador: {str(e)}")

@router.get("/pick")
def pick_workspace():
    """Abre el explorador de archivos nativo del SO para elegir una carpeta."""
    folder_path = ""
    try:
        if sys.platform == "win32":
            ps_script = (
                "Add-Type -AssemblyName System.windows.forms; "
                "$f = New-Object System.Windows.Forms.FolderBrowserDialog; "
                "$f.Description = 'Selecciona la carpeta raíz de tu Proyecto'; "
                "$f.ShowNewFolderButton = $true; "
                "if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }"
            )
            result = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True)
            folder_path = result.stdout.strip()
        elif sys.platform == "darwin":
            scpt = 'POSIX path of (choose folder with prompt "Selecciona la carpeta raíz del Proyecto")'
            result = subprocess.run(['osascript', '-e', scpt], capture_output=True, text=True)
            folder_path = result.stdout.strip()
        else:
            raise HTTPException(status_code=500, detail="Sistema operativo no soportado para el explorador nativo.")

        if folder_path:
            return {"path": Path(folder_path).resolve().as_posix()}
        else:
            raise HTTPException(status_code=400, detail="No se seleccionó ninguna carpeta")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error abriendo explorador: {str(e)}")

@router.get("/")
def list_workspace(base_path: Optional[str] = None, channel_name: Optional[str] = None):
    """Lista el contenido recursivo del workspace para el Tree View."""
    workspace_path = resolve_target_dir(base_path, channel_name)
    if not workspace_path.exists() or not workspace_path.is_dir():
        raise HTTPException(status_code=404, detail=f"La ruta del workspace no existe: '{workspace_path}'")
    
    def build_tree(current_path: Path, current_depth: int, max_depth: int = 4):
        if current_depth > max_depth:
            return []
        
        tree = []
        try:
            items = sorted(current_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
            for item in items:
                if item.name.startswith('.'):
                    continue
                node = {
                    "name": item.name,
                    "path": str(item),
                    "type": "directory" if item.is_dir() else "file"
                }
                if item.is_dir():
                    node["children"] = build_tree(item, current_depth + 1, max_depth)
                tree.append(node)
        except PermissionError:
            pass
        return tree

    try:
        tree_data = build_tree(workspace_path, 0)
        return {"workspace": str(workspace_path), "tree": tree_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list_flat")
def list_flat(base_path: Optional[str] = None, channel_name: Optional[str] = None, depth: int = 2):
    """
    Lista el contenido de un directorio en formato plano (sin anidamiento).
    Devuelve una lista de carpetas con nombre EXACTO tal como existe en disco
    y su ruta absoluta en formato POSIX (compatible con macOS y Windows).
    """
    workspace_path = resolve_target_dir(base_path, channel_name)
    if not workspace_path.exists() or not workspace_path.is_dir():
        raise HTTPException(status_code=404, detail=f"La ruta del workspace no existe: '{workspace_path}'")

    folders = []
    files = []

    def walk(current: Path, current_depth: int):
        if current_depth > depth:
            return
        try:
            items = sorted(current.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
            for item in items:
                if item.name.startswith('.'):
                    continue
                posix_path = item.resolve().as_posix()
                entry = {
                    "nombre": item.name,
                    "exact_name": item.name,
                    "ruta": posix_path,
                    "absolute_path": posix_path,
                    "parent_path": current.resolve().as_posix(),
                    "type": "directory" if item.is_dir() else "file",
                    "depth": current_depth
                }
                if item.is_dir():
                    folders.append(entry)
                    walk(item, current_depth + 1)
                else:
                    files.append(entry)
        except PermissionError:
            pass

    walk(workspace_path, 1)
    return {
        "base_path": workspace_path.resolve().as_posix(),
        "total_folders": len(folders),
        "total_files": len(files),
        "folders": folders,
        "files": files,
        "note": "Usa 'ruta' directamente para cualquier operación sobre carpetas o archivos (válido en macOS y Windows)."
    }

class CreateFolderRequest(BaseModel):
    target_path: Optional[str] = None          # Ruta padre (opcional, si se omite usa ws_root o channel_name)
    folder_name: Optional[str] = None          # Nombre de carpeta individual
    channel_name: Optional[str] = None         # Nombre de canal opcional
    niche: Optional[str] = None                # Nicho del canal opcional
    is_channel: Optional[bool] = False         # Si es True, inicializa la plantilla modular completa del canal
    folders: Optional[List[str]] = None        # Múltiples nombres de carpetas a crear en target_path o channel_name
    paths: Optional[List[str]] = None          # Múltiples rutas completas o relativas directas
    subfolders: Optional[List[str]] = []       # Subcarpetas opcionales a crear dentro de cada carpeta

@router.get("/audit_channels")
def audit_channels():
    """Retorna la lista de carpetas de canales físicos presentes en workspace/youtube para auditoría y control de límites."""
    ws_root = default_workspace_path()
    channels = []
    try:
        for item in sorted(ws_root.iterdir(), key=lambda x: x.name.lower()):
            if item.is_dir() and not item.name.startswith('.'):
                has_info = (item / "InfoCanal").exists()
                sub_count = len([s for s in item.iterdir() if s.is_dir() and not s.name.startswith('.')])
                channels.append({
                    "name": item.name,
                    "path": item.resolve().as_posix(),
                    "has_info_canal": has_info,
                    "subfolders_count": sub_count,
                    "created_at": datetime.fromtimestamp(item.stat().st_ctime).isoformat() if hasattr(item.stat(), "st_ctime") else None
                })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error auditando canales: {str(e)}")

    return {
        "youtube_root": ws_root.resolve().as_posix(),
        "total_channels": len(channels),
        "channels": channels
    }

@router.post("/create")
def create_folder(req: CreateFolderRequest):
    """Crea una o múltiples carpetas y sus subcarpetas asociadas en el workspace."""
    ws_root = default_workspace_path()

    # Determinar la carpeta base (target_path o canal o workspace root)
    if req.target_path and req.target_path.strip() not in [".", "/"]:
        parent_base = resolve_target_dir(base_path=req.target_path, channel_name=req.channel_name)
    elif req.channel_name and req.channel_name.strip():
        parent_base = resolve_target_dir(channel_name=req.channel_name)
    else:
        parent_base = ws_root

    created = []
    errors = []

    # 1. Caso paths: lista de rutas directas
    if req.paths and len(req.paths) > 0:
        for p in req.paths:
            if not p or not p.strip():
                continue
            path_obj = Path(p.strip())
            if not path_obj.is_absolute():
                path_obj = (parent_base / path_obj).resolve()
            else:
                path_obj = path_obj.resolve()
            try:
                path_obj.mkdir(parents=True, exist_ok=True)
                created.append(path_obj.as_posix())
                if req.is_channel or path_obj.parent.resolve() == ws_root.resolve():
                    init_channel_template_files(path_obj, path_obj.name, req.niche)
                elif req.subfolders:
                    for sub in req.subfolders:
                        (path_obj / sub).mkdir(parents=True, exist_ok=True)
            except Exception as e:
                errors.append(f"Error creando '{p}': {str(e)}")

    # 2. Caso folders: lista de nombres de carpetas hermanas
    if req.folders and len(req.folders) > 0:
        for f in req.folders:
            if not f or not f.strip():
                continue
            folder_path = (parent_base / f.strip()).resolve()
            try:
                folder_path.mkdir(parents=True, exist_ok=True)
                created.append(folder_path.as_posix())
                if req.is_channel or parent_base.resolve() == ws_root.resolve():
                    init_channel_template_files(folder_path, f.strip(), req.niche)
                elif req.subfolders:
                    for sub in req.subfolders:
                        (folder_path / sub).mkdir(parents=True, exist_ok=True)
            except Exception as e:
                errors.append(f"Error creando '{f}': {str(e)}")

    # 3. Caso folder_name: carpeta individual
    if req.folder_name and req.folder_name.strip():
        folder_path = (parent_base / req.folder_name.strip()).resolve()
        try:
            folder_path.mkdir(parents=True, exist_ok=True)
            created.append(folder_path.as_posix())
            if req.is_channel or parent_base.resolve() == ws_root.resolve():
                init_channel_template_files(folder_path, req.folder_name.strip(), req.niche)
            elif req.subfolders:
                for sub in req.subfolders:
                    (folder_path / sub).mkdir(parents=True, exist_ok=True)
        except Exception as e:
            errors.append(f"Error creando '{req.folder_name}': {str(e)}")

    # 4. Caso canal nuevo: si solo se especificó channel_name y nada más
    if not req.paths and not req.folders and not req.folder_name and req.channel_name and req.channel_name.strip():
        channel_path = (ws_root / req.channel_name.strip()).resolve()
        try:
            channel_path.mkdir(parents=True, exist_ok=True)
            created.append(channel_path.as_posix())
            init_channel_template_files(channel_path, req.channel_name.strip(), req.niche)
        except Exception as e:
            errors.append(f"Error creando canal '{req.channel_name}': {str(e)}")

    if not created and not errors:
        raise HTTPException(
            status_code=400,
            detail="Debes especificar al menos 'folder_name', 'folders', 'paths' o 'channel_name' para crear carpetas."
        )

    if not created and errors:
        raise HTTPException(status_code=500, detail=" | ".join(errors))

    return {
        "status": "success",
        "message": f"Se crearon {len(created)} carpeta(s) exitosamente.",
        "created": created,
        "base_path": parent_base.as_posix(),
        "errors": errors if errors else None
    }

class SaveFileRequest(BaseModel):
    path: str
    content: str

@router.get("/raw")
@router.head("/raw")
def get_raw_file(path: str):
    """Sirve archivos binarios o multimedia (video, audio, imagen, texto) desde el workspace para streaming y previsualización."""
    if not path or not path.strip():
        raise HTTPException(status_code=400, detail="Ruta de archivo no proporcionada.")

    ws_root = default_workspace_path()
    file_path = Path(path.strip())
    if not file_path.is_absolute():
        file_path = (ws_root / file_path).resolve()
    else:
        file_path = file_path.resolve()

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="El archivo no existe.")

    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        ext = file_path.suffix.lower()
        if ext in [".mp4", ".m4v"]:
            mime_type = "video/mp4"
        elif ext == ".webm":
            mime_type = "video/webm"
        elif ext == ".mov":
            mime_type = "video/quicktime"
        elif ext == ".mkv":
            mime_type = "video/x-matroska"
        elif ext == ".mp3":
            mime_type = "audio/mpeg"
        elif ext == ".wav":
            mime_type = "audio/wav"
        elif ext == ".ogg":
            mime_type = "audio/ogg"
        elif ext in [".jpg", ".jpeg"]:
            mime_type = "image/jpeg"
        elif ext == ".png":
            mime_type = "image/png"
        elif ext == ".webp":
            mime_type = "image/webp"
        else:
            mime_type = "application/octet-stream"

    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        content_disposition_type="inline"
    )


@router.get("/file")
def read_file(path: str):
    """Lee el contenido de un archivo (preferiblemente .md o .txt)."""
    ws_root = default_workspace_path()
    file_path = Path(path)
    if not file_path.is_absolute():
        file_path = (ws_root / file_path).resolve()
    else:
        file_path = file_path.resolve()

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="El archivo no existe.")
    
    if file_path.suffix.lower() not in ['.md', '.txt']:
        raise HTTPException(status_code=400, detail="Solo se permite leer archivos .md o .txt por seguridad.")
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return {"content": f.read()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo el archivo: {str(e)}")

@router.post("/file")
def save_file(req: SaveFileRequest):
    """Guarda el contenido de un archivo, creándolo si no existe."""
    ws_root = default_workspace_path()
    file_path = Path(req.path)
    if not file_path.is_absolute():
        file_path = (ws_root / file_path).resolve()
    else:
        file_path = file_path.resolve()
    
    # Nos aseguramos de que el directorio exista
    file_path.parent.mkdir(parents=True, exist_ok=True)
        
    if file_path.suffix.lower() not in ['.md', '.txt']:
        raise HTTPException(status_code=400, detail="Solo se permite editar archivos .md o .txt por seguridad.")
        
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"status": "success", "message": f"Archivo guardado exitosamente en {file_path.as_posix()}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando el archivo: {str(e)}")

@router.delete("/file")
def delete_file(path: str):
    """Elimina un archivo del workspace."""
    ws_root = default_workspace_path()
    file_path = Path(path)
    if not file_path.is_absolute():
        file_path = (ws_root / file_path).resolve()
    else:
        file_path = file_path.resolve()

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="El archivo no existe.")
        
    if file_path.suffix.lower() not in ['.md', '.txt']:
        raise HTTPException(status_code=400, detail="Solo se permite eliminar archivos .md o .txt por seguridad.")
        
    try:
        file_path.unlink()
        return {"status": "success", "message": "Archivo eliminado exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error eliminando el archivo: {str(e)}")

class DeleteFoldersRequest(BaseModel):
    ruta: Optional[str] = None             # Ruta directa absoluta o relativa
    path: Optional[str] = None             # Sinónimo directo de ruta
    rutas: Optional[List[str]] = None      # Múltiples rutas
    paths: Optional[List[str]] = None      # Sinónimo de múltiples rutas
    folders: Optional[List[str]] = None    # Múltiples nombres de carpetas
    folder_name: Optional[str] = None      # Nombre simple de carpeta
    channel_name: Optional[str] = None     # Canal opcional

@router.post("/delete_folder")
def delete_folders(req: DeleteFoldersRequest):
    """Elimina una o múltiples carpetas del workspace, compatible con macOS y Windows."""
    ws_root = default_workspace_path()
    cname = (req.channel_name or "").strip()

    # Recopilar todos los elementos a procesar
    items_to_delete: List[str] = []

    if req.paths:
        items_to_delete.extend([p.strip() for p in req.paths if p and p.strip()])
    if req.rutas:
        items_to_delete.extend([p.strip() for p in req.rutas if p and p.strip()])
    if req.folders:
        items_to_delete.extend([f.strip() for f in req.folders if f and f.strip()])
    if req.ruta and req.ruta.strip():
        items_to_delete.append(req.ruta.strip())
    if req.path and req.path.strip():
        items_to_delete.append(req.path.strip())
    if req.folder_name and req.folder_name.strip():
        items_to_delete.append(req.folder_name.strip())

    # Eliminar duplicados preservando orden
    seen = set()
    unique_items = []
    for item in items_to_delete:
        if item not in seen:
            seen.add(item)
            unique_items.append(item)

    # Si no se pasó ninguna carpeta pero sí un canal, se asume eliminación del canal completo
    if not unique_items and cname:
        unique_items = [cname]

    if not unique_items:
        raise HTTPException(
            status_code=400,
            detail="Se requiere al menos el parámetro 'ruta', 'paths', 'folder_name' o 'channel_name' para eliminar."
        )

    deleted = []
    errors = []

    channel_dir = (ws_root / cname).resolve() if cname else None

    # Resolver todas las rutas y deduplicar rutas canónicas
    resolved_paths: List[Path] = []
    for item_str in unique_items:
        folder_path = Path(item_str)

        # Si no es absoluta, determinar el ancla adecuada
        if not folder_path.is_absolute():
            # Si el item es el canal mismo, resolver a ws_root / cname
            if cname and item_str.lower() == cname.lower():
                folder_path = (ws_root / cname).resolve()
            elif channel_dir and not item_str.lower().startswith(cname.lower() + "/"):
                folder_path = (channel_dir / folder_path).resolve()
            else:
                folder_path = (ws_root / folder_path).resolve()
        else:
            folder_path = folder_path.resolve()

        if folder_path not in resolved_paths:
            resolved_paths.append(folder_path)

    for folder_path in resolved_paths:
        print(f"[delete_folder] Procesando resuelta: '{folder_path.as_posix()}'")

        # 1. Borrado directo si existe y es carpeta
        if folder_path.exists() and folder_path.is_dir():
            try:
                shutil.rmtree(folder_path)
                deleted.append(folder_path.as_posix())
                print(f"[delete_folder] Eliminada directamente: '{folder_path.as_posix()}'")
                continue
            except Exception as e:
                errors.append(f"Error al eliminar '{folder_path.name}': {str(e)}")
                continue

        # 2. Búsqueda inteligente insensible a mayúsculas/acentos
        target_name_norm = normalize_str(folder_path.name)
        search_root = folder_path.parent if (folder_path.parent.exists() and folder_path.parent.is_dir()) else (channel_dir if (channel_dir and channel_dir.exists()) else ws_root)

        print(f"[delete_folder] Buscando '{folder_path.name}' (norm: '{target_name_norm}') en '{search_root.as_posix()}'")
        found_dirs = []

        if search_root.exists():
            for root, dirs, _files in os.walk(search_root):
                for d in dirs:
                    if normalize_str(d) == target_name_norm:
                        found_dirs.append(Path(root) / d)

        if found_dirs:
            for fd in found_dirs:
                try:
                    shutil.rmtree(fd)
                    deleted.append(fd.resolve().as_posix())
                    print(f"[delete_folder] Eliminada por búsqueda: '{fd.as_posix()}'")
                except Exception as e:
                    errors.append(f"Error al eliminar '{fd.as_posix()}': {str(e)}")
        else:
            errors.append(f"No se encontró ninguna carpeta llamada '{folder_path.name}' en {search_root.as_posix()}")

    if not deleted and errors:
        raise HTTPException(status_code=404, detail=" | ".join(errors))

    return {
        "status": "success",
        "message": f"Se eliminaron {len(deleted)} carpeta(s) correctamente.",
        "deleted": deleted,
        "errors": errors if errors else None
    }


class SaveBinaryFileRequest(BaseModel):
    base64_data: str
    file_name: str
    channel_name: Optional[str] = None
    subfolder: Optional[str] = "Miniaturas"
    target_path: Optional[str] = None

@router.post("/save_binary_file")
def save_binary_file(req: SaveBinaryFileRequest):
    """Guarda un archivo binario (ej. imagen en base64) físicamente en el workspace."""
    try:
        data_str = req.base64_data.strip()
        if "," in data_str and "base64" in data_str[:30]:
            data_str = data_str.split(",", 1)[1]

        file_bytes = base64.b64decode(data_str)

        # Resolver directorio de destino
        if req.target_path and req.target_path.strip() not in [".", "/"]:
            dest_dir = Path(req.target_path.strip())
            if not dest_dir.is_absolute():
                dest_dir = (default_workspace_path() / dest_dir).resolve()
        elif req.channel_name and req.channel_name.strip():
            sub = req.subfolder.strip() if req.subfolder else "Miniaturas"
            dest_dir = (default_workspace_path() / req.channel_name.strip() / sub).resolve()
        else:
            dest_dir = (default_workspace_path() / "Recursos").resolve()

        dest_dir.mkdir(parents=True, exist_ok=True)
        file_path = (dest_dir / req.file_name.strip()).resolve()

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        ext = file_path.suffix.lstrip(".").lower()
        return {
            "status": "success",
            "message": f"Archivo guardado exitosamente en '{file_path.as_posix()}'.",
            "path": file_path.as_posix(),
            "name": file_path.name,
            "format": ext,
            "sizeBytes": file_path.stat().st_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar archivo binario: {str(e)}")

@router.post("/upload_stream")
async def upload_stream(
    request: Request,
    filename: Optional[str] = Query(None),
    target_path: Optional[str] = Query(None),
    subfolder: Optional[str] = Query("Videos")
):
    """
    Recibe archivos de video o audio de CUALQUIER tamaño (100MB, 2GB, 10GB+)
    por streaming de chunks directamente a disco, sin requerir python-multipart
    ni pasar por Base64 ni colapsar la RAM.
    """
    try:
        import urllib.parse
        raw_name = filename or request.headers.get("x-filename") or "video.mp4"
        decoded_name = urllib.parse.unquote(raw_name)
        safe_filename = Path(decoded_name).name or "video.mp4"

        raw_target = target_path or request.headers.get("x-target-path")
        decoded_target = urllib.parse.unquote(raw_target) if raw_target else None

        raw_sub = subfolder or request.headers.get("x-subfolder") or "Videos"
        decoded_sub = urllib.parse.unquote(raw_sub) if raw_sub else "Videos"

        ws_root = default_workspace_path()
        if decoded_target and decoded_target.strip() not in [".", "/"]:
            dest_dir = Path(decoded_target.strip())
            if not dest_dir.is_absolute():
                dest_dir = (ws_root / dest_dir).resolve()
        else:
            dest_dir = (ws_root / (decoded_sub or "Videos")).resolve()

        dest_dir.mkdir(parents=True, exist_ok=True)
        out_file_path = (dest_dir / safe_filename).resolve()

        with open(out_file_path, "wb") as buffer:
            async for chunk in request.stream():
                if chunk:
                    buffer.write(chunk)

        file_size = out_file_path.stat().st_size
        size_mb = round(file_size / (1024 * 1024), 2)
        return {
            "status": "success",
            "name": safe_filename,
            "path": out_file_path.as_posix(),
            "size_bytes": file_size,
            "size_mb": size_mb
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en subida de archivo grande: {str(e)}")

@router.get("/folder_videos")
def get_folder_videos(folder_path: str):
    """Retorna la lista de videos existentes dentro de una carpeta específica del workspace."""
    ws_root = default_workspace_path()
    fp = Path(folder_path.strip())
    if not fp.is_absolute():
        fp = (ws_root / fp).resolve()
    
    if not fp.exists() or not fp.is_dir():
        return {"videos": []}

    valid_exts = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
    videos = []
    try:
        for item in sorted(fp.iterdir(), key=lambda x: x.name.lower()):
            if item.is_file() and item.suffix.lower() in valid_exts:
                size_mb = round(item.stat().st_size / (1024 * 1024), 2)
                videos.append({
                    "name": item.name,
                    "path": item.as_posix(),
                    "size_mb": size_mb,
                })
    except Exception:
        pass
    return {"videos": videos}

class DeleteFileRequest(BaseModel):
    path: str

@router.post("/delete_file")
def delete_file(req: DeleteFileRequest):
    """Elimina un archivo específico del workspace del usuario."""
    try:
        raw_path = req.path.strip()
        p = Path(raw_path)
        if not p.is_absolute():
            p = (default_workspace_path() / p).resolve()
        else:
            p = p.resolve()

        if not p.exists():
            raise HTTPException(status_code=404, detail=f"El archivo no existe: '{p.as_posix()}'")
        if p.is_dir():
            raise HTTPException(status_code=400, detail="La ruta proporcionada es una carpeta, use /delete_folder")

        p.unlink()
        return {
            "status": "success",
            "message": f"Archivo '{p.name}' eliminado correctamente.",
            "deleted_path": p.as_posix()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar archivo: {str(e)}")

class OpenFolderRequest(BaseModel):
    path: str

@router.post("/open_folder")
def open_folder(req: OpenFolderRequest):
    """Abre el explorador de archivos nativo del SO en la ruta especificada."""
    try:
        raw_path = req.path.strip()
        p = Path(raw_path)
        if not p.is_absolute():
            p = (default_workspace_path() / p).resolve()
        else:
            p = p.resolve()

        if not p.exists():
            p = p.parent

        if not p.exists():
            raise HTTPException(status_code=404, detail=f"Ruta no encontrada: '{p.as_posix()}'")

        if sys.platform == "win32":
            if p.is_file():
                subprocess.Popen(["explorer.exe", f"/select,{p.as_posix().replace('/', chr(92))}"])
            else:
                subprocess.Popen(["explorer.exe", p.as_posix().replace('/', chr(92))])
        elif sys.platform == "darwin":
            subprocess.Popen(["open", "-R" if p.is_file() else "", p.as_posix()])
        else:
            subprocess.Popen(["xdg-open", (p.parent if p.is_file() else p).as_posix()])

        return {"status": "success", "opened": p.as_posix()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error abriendo explorador de archivos: {str(e)}")

class ScanMediaRequest(BaseModel):
    channel_name: Optional[str] = None
    target_path: Optional[str] = None

@router.post("/scan_media")
def scan_media(req: ScanMediaRequest):
    """Escanea las carpetas locales en busca de imágenes, subtítulos, videos y audios físicos."""
    try:
        target_dir = resolve_target_dir(base_path=req.target_path, channel_name=req.channel_name)
        try:
            is_valid_dir = target_dir.exists() and target_dir.is_dir()
        except Exception:
            is_valid_dir = False

        if not is_valid_dir:
            return {"status": "success", "target_path": target_dir.as_posix(), "count": 0, "files": []}

        valid_exts = {
            # Imágenes
            "png": "IMAGE", "jpg": "IMAGE", "jpeg": "IMAGE", "webp": "IMAGE",
            # Videos
            "mp4": "VIDEO", "mov": "VIDEO", "mkv": "VIDEO", "webm": "VIDEO",
            # Subtítulos
            "srt": "SUBTITLE", "vtt": "SUBTITLE", "txt": "SUBTITLE",
            # Audio
            "mp3": "AUDIO", "wav": "AUDIO", "m4a": "AUDIO", "aac": "AUDIO", "flac": "AUDIO"
        }

        media_files = []
        skip_dirs = {".git", "node_modules", "__pycache__", ".next", ".autoprod"}

        scan_roots = [target_dir]
        # Si es un escaneo general (sin canal específico), incluir también la carpeta temp_renders externa si existe
        if not req.channel_name:
            config_path = Path(__file__).resolve().parent.parent.parent / ".autoprod-config.json"
            if config_path.exists():
                try:
                    with open(config_path, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                        if "basePath" in cfg:
                            ext_temp = Path(cfg["basePath"]) / "temp_renders"
                            if ext_temp.exists() and ext_temp.is_dir() and ext_temp.resolve() != target_dir.resolve():
                                scan_roots.append(ext_temp)
                except Exception:
                    pass

        seen_paths = set()
        for s_root in scan_roots:
            for root, dirs, files in os.walk(s_root):
                dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith(".")]
                for f in files:
                    if f.startswith("concat_"):
                        continue
                    ext = f.split(".")[-1].lower() if "." in f else ""
                    if ext in valid_exts:
                        file_path = Path(root) / f
                        resolved_path = file_path.resolve().as_posix()
                        if resolved_path in seen_paths:
                            continue
                        seen_paths.add(resolved_path)

                        try:
                            stat = file_path.stat()
                            in_miniat = "miniatura" in root.lower() or "thumbnail" in root.lower()
                            in_subtit = "subtitulo" in root.lower() or "subtitles" in root.lower()
                            in_musica = "musica" in root.lower() or "cancion" in root.lower() or "audio" in root.lower()

                            detected_type = valid_exts[ext]
                            if detected_type == "IMAGE" and in_miniat:
                                detected_type = "THUMBNAIL"
                            elif ext == "txt" and not in_subtit:
                                continue

                            mod_iso = datetime.fromtimestamp(stat.st_mtime).isoformat()
                            try:
                                rel_path = file_path.relative_to(target_dir).as_posix()
                            except Exception:
                                rel_path = f"temp_renders/{f}"

                            media_files.append({
                                "name": f,
                                "format": ext,
                                "type": detected_type,
                                "localPath": resolved_path,
                                "relativePath": rel_path,
                                "sizeBytes": stat.st_size,
                                "modifiedAt": mod_iso
                            })
                        except Exception:
                            continue


        media_files.sort(key=lambda x: x["modifiedAt"], reverse=True)

        return {
            "status": "success",
            "target_path": target_dir.as_posix(),
            "channel": req.channel_name or target_dir.name,
            "count": len(media_files),
            "files": media_files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al escanear medios locales: {str(e)}")


