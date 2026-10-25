import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { getWorkspacePath } from '@/lib/setup/detector';

// ──────────────────────────────────────────────
// Carpetas reservadas del sistema (Protegidas en la raíz del workspace)
// ──────────────────────────────────────────────
const SYSTEM_RESERVED_FOLDERS = [
  'recursos', 'assets', 'node_modules', 'bin', 'public', 'dist', 'build',
  'temp', 'tmp', 'cache', '.git', '.next', 'workspace', 'youtube', 'docs',
  'controlador', 'prisma', 'src', 'app', 'components', 'lib'
];

const ALLOWED_TEXT_EXTENSIONS = [
  '.md', '.markdown', '.txt',
  '.srt', '.vtt', '.ass', '.ssa', '.lrc',
  '.json', '.csv', '.tsv', '.xml', '.yaml', '.yml'
];

function sanitizeSegment(name: string): string {
  return name.replace(/[:*?"<>|]/g, ' - ').replace(/\s+/g, ' ').trim();
}

function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Resuelve una ruta (relativa o absoluta) garantizando que quede DENTRO del workspace.
 * Las rutas relativas se interpretan segmento a segmento ("Proyecto/Guiones" => carpeta anidada).
 * Retorna null si la ruta intenta salirse del workspace (path traversal) o es inválida.
 */
function resolveInsideWorkspace(wsRoot: string, raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const root = path.resolve(wsRoot);

  let candidate: string;
  if (path.isAbsolute(raw)) {
    candidate = path.resolve(raw);
  } else {
    const segments = raw.split(/[\\/]+/).filter(s => s && s !== '.');
    if (segments.some(s => s === '..')) return null;
    const cleaned = segments.map(sanitizeSegment).filter(Boolean);
    candidate = path.resolve(root, ...cleaned);
  }

  const rel = path.relative(root, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return candidate;
}

function collectPaths(body: any, keys: string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const val = body[key];
    if (Array.isArray(val)) out.push(...val.filter((v: any) => typeof v === 'string'));
    else if (typeof val === 'string' && val.trim()) out.push(val);
  }
  return out;
}

// ──────────────────────────────────────────────
// POST /api/tools/workspace_control
// Controlador unificado del dominio WORKSPACE_FS.
// El workspace es un espacio abierto: la IA lo explora, entiende su contenido
// y crea, lee o modifica lo que necesite. No impone estructura ni jerarquía.
// ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const accion = String(body.accion || body.action || body.tipo || 'listar').toLowerCase().trim();
    const userContext = body._userContext || {};

    // 1. Determinar raíz efectiva del workspace
    let wsRoot = (userContext.workspacePath && typeof userContext.workspacePath === 'string' && userContext.workspacePath.trim() !== '')
      ? userContext.workspacePath
      : getWorkspacePath();

    if (!wsRoot) {
      wsRoot = path.join(process.cwd(), 'workspace', 'youtube');
    }

    // Asegurar que la raíz exista
    if (!fs.existsSync(wsRoot)) {
      try {
        fs.mkdirSync(wsRoot, { recursive: true });
      } catch (mkdirErr: any) {
        console.warn('[WorkspaceControl] Error creando wsRoot:', mkdirErr.message);
      }
    }

    const outsideError = (p: string) => NextResponse.json({
      error: `La ruta "${p}" queda fuera del workspace. Usa rutas relativas al workspace (ej. "MiProyecto/Guiones").`
    }, { status: 400 });

    // ──────────────────────────────────────────────
    // ACCIÓN: DEFAULT (Ruta base y carpetas de primer nivel)
    // ──────────────────────────────────────────────
    if (accion === 'default' || accion === 'workspace_default') {
      const entries = fs.existsSync(wsRoot) ? fs.readdirSync(wsRoot, { withFileTypes: true }) : [];
      const folders = entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && !SYSTEM_RESERVED_FOLDERS.includes(e.name.toLowerCase()))
        .map(e => e.name);

      return NextResponse.json({
        success: true,
        workspace_path: toPosix(wsRoot),
        total_folders: folders.length,
        folders
      });
    }

    // ──────────────────────────────────────────────
    // ACCIÓN: LISTAR (Árbol o formato plano)
    // ──────────────────────────────────────────────
    if (accion === 'listar' || accion === 'listar_directorio' || accion === 'listar_directorio_plano') {
      const isFlat = Boolean(body.plano || body.flat || accion === 'listar_directorio_plano');
      const depth = Number(body.depth || 2);

      let targetDir = wsRoot;
      const requestedPath = body.base_path || body.path || body.target_path || body.ruta || '';

      if (requestedPath && requestedPath !== '.' && requestedPath !== '/') {
        const resolved = resolveInsideWorkspace(wsRoot, requestedPath);
        if (!resolved) return outsideError(requestedPath);
        targetDir = resolved;
      }

      if (!fs.existsSync(targetDir)) {
        // En lugar de romper con HTTP 404, devolver estado controlado amigable
        const rootEntries = fs.existsSync(wsRoot) ? fs.readdirSync(wsRoot, { withFileTypes: true }) : [];
        const existingFolders = rootEntries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);

        return NextResponse.json({
          success: false,
          exists: false,
          message: `La carpeta "${path.basename(targetDir)}" no existe físicamente en el workspace.`,
          workspace_root: toPosix(wsRoot),
          carpetas_existentes: existingFolders
        });
      }

      if (isFlat) {
        const folders: any[] = [];
        const files: any[] = [];

        const walk = (current: string, currentDepth: number) => {
          if (currentDepth > depth) return;
          try {
            const items = fs.readdirSync(current, { withFileTypes: true });
            for (const item of items) {
              if (item.name.startsWith('.')) continue;
              const fullP = toPosix(path.join(current, item.name));
              const entry = {
                nombre: item.name,
                ruta: fullP,
                es_directorio: item.isDirectory(),
                depth: currentDepth
              };
              if (item.isDirectory()) {
                folders.push(entry);
                walk(path.join(current, item.name), currentDepth + 1);
              } else {
                files.push(entry);
              }
            }
          } catch {}
        };

        walk(targetDir, 1);

        return NextResponse.json({
          success: true,
          base_path: toPosix(targetDir),
          total_carpetas: folders.length,
          total_archivos: files.length,
          carpetas: folders,
          archivos: files
        });
      }

      const buildTree = (current: string, currentDepth: number, maxD: number = 3): any[] => {
        if (currentDepth > maxD) return [];
        const tree: any[] = [];
        try {
          const items = fs.readdirSync(current, { withFileTypes: true });
          for (const item of items) {
            if (item.name.startsWith('.')) continue;
            const node: any = {
              name: item.name,
              path: toPosix(path.join(current, item.name)),
              type: item.isDirectory() ? 'directory' : 'file'
            };
            if (item.isDirectory()) {
              node.children = buildTree(path.join(current, item.name), currentDepth + 1, maxD);
            }
            tree.push(node);
          }
        } catch {}
        return tree;
      };

      return NextResponse.json({
        success: true,
        workspace: toPosix(targetDir),
        tree: buildTree(targetDir, 0)
      });
    }

    // ──────────────────────────────────────────────
    // ACCIÓN: CREAR_CARPETAS (carpetas anidadas libres dentro del workspace)
    // ──────────────────────────────────────────────
    if (accion === 'crear' || accion === 'crear_carpetas') {
      const candidates = collectPaths(body, [
        'paths', 'path', 'folders', 'carpetas', 'folder_names', 'folder_name', 'nombre_carpeta', 'name'
      ]);

      if (candidates.length === 0) {
        return NextResponse.json({
          error: "Debes especificar al menos una carpeta a crear en 'paths' (ej. [\"MiProyecto/Guiones\"])."
        }, { status: 400 });
      }

      const created: string[] = [];
      const alreadyExisted: string[] = [];

      for (const raw of candidates) {
        const resolved = resolveInsideWorkspace(wsRoot, raw);
        if (!resolved) return outsideError(raw);
        if (fs.existsSync(resolved)) {
          alreadyExisted.push(toPosix(resolved));
          continue;
        }
        fs.mkdirSync(resolved, { recursive: true });
        created.push(toPosix(resolved));
      }

      return NextResponse.json({
        success: true,
        message: `Se crearon ${created.length} carpeta(s)${alreadyExisted.length ? ` (${alreadyExisted.length} ya existían)` : ''}.`,
        created,
        already_existed: alreadyExisted.length > 0 ? alreadyExisted : undefined,
        workspace_root: toPosix(wsRoot)
      });
    }

    // ──────────────────────────────────────────────
    // ACCIÓN: ELIMINAR_CARPETAS
    // ──────────────────────────────────────────────
    if (accion === 'eliminar' || accion === 'eliminar_carpetas' || accion === 'borrar') {
      const candidates = collectPaths(body, ['paths', 'rutas', 'folders', 'carpetas', 'path', 'ruta', 'folder_name']);

      const deleted: string[] = [];
      const errors: string[] = [];
      const rootResolved = path.resolve(wsRoot);

      for (const raw of candidates) {
        const resolved = resolveInsideWorkspace(wsRoot, raw);
        if (!resolved) {
          errors.push(`Operación bloqueada: "${raw}" queda fuera del workspace.`);
          continue;
        }

        // Protección estricta: no permitir borrar la raíz del workspace
        if (resolved === rootResolved) {
          errors.push(`Operación bloqueada: No se puede eliminar la raíz del workspace (${raw}).`);
          continue;
        }

        // Las carpetas reservadas solo se protegen en el primer nivel del workspace
        const isTopLevel = path.dirname(resolved) === rootResolved;
        const baseName = path.basename(resolved).toLowerCase();
        if (isTopLevel && SYSTEM_RESERVED_FOLDERS.includes(baseName)) {
          errors.push(`Operación bloqueada: "${baseName}" es una carpeta reservada del sistema.`);
          continue;
        }

        if (fs.existsSync(resolved)) {
          try {
            fs.rmSync(resolved, { recursive: true, force: true });
            deleted.push(toPosix(resolved));
          } catch (delErr: any) {
            errors.push(`Error eliminando "${raw}": ${delErr.message}`);
          }
        }
      }

      return NextResponse.json({
        success: deleted.length > 0,
        deleted,
        errors: errors.length > 0 ? errors : undefined,
        message: deleted.length > 0 ? `Se eliminaron ${deleted.length} carpeta(s) exitosamente.` : 'No se eliminó ninguna carpeta.'
      });
    }

    // ──────────────────────────────────────────────
    // ACCIÓN: LEER_ARCHIVO
    // ──────────────────────────────────────────────
    if (accion === 'leer' || accion === 'leer_archivo') {
      const rawPath = body.path || body.ruta || body.file_path || body.archivo || '';
      if (!rawPath) {
        return NextResponse.json({ error: 'Debes proporcionar la ruta del archivo a leer.' }, { status: 400 });
      }

      const targetFile = resolveInsideWorkspace(wsRoot, rawPath);
      if (!targetFile) return outsideError(rawPath);

      if (!fs.existsSync(targetFile) || !fs.statSync(targetFile).isFile()) {
        return NextResponse.json({ error: `El archivo "${path.basename(targetFile)}" no existe.` }, { status: 404 });
      }

      const ext = path.extname(targetFile).toLowerCase();
      if (!ALLOWED_TEXT_EXTENSIONS.includes(ext)) {
        return NextResponse.json({ error: `Por seguridad solo se permite leer archivos de texto (${ALLOWED_TEXT_EXTENSIONS.join(', ')}).` }, { status: 400 });
      }

      const content = await fsPromises.readFile(targetFile, 'utf-8');
      return NextResponse.json({
        success: true,
        path: toPosix(targetFile),
        nombre: path.basename(targetFile),
        content
      });
    }

    // ──────────────────────────────────────────────
    // ACCIÓN: GUARDAR_ARCHIVO
    // ──────────────────────────────────────────────
    if (accion === 'guardar' || accion === 'guardar_archivo' || accion === 'escribir_archivo') {
      let rawPath = body.path || body.ruta || body.file_path || body.archivo || '';
      const content = body.content ?? body.text ?? body.contenido ?? body.body ?? '';

      if (!rawPath) {
        return NextResponse.json({ error: 'Debes proporcionar la ruta o nombre del archivo a guardar.' }, { status: 400 });
      }

      // Asegurar extensión de texto .md si no tiene extensión
      if (!path.extname(rawPath)) {
        rawPath += '.md';
      }

      const targetFile = resolveInsideWorkspace(wsRoot, rawPath);
      if (!targetFile) return outsideError(rawPath);

      if (body.overwrite === false && fs.existsSync(targetFile)) {
        return NextResponse.json({
          error: `El archivo "${path.basename(targetFile)}" ya existe y overwrite=false. Elige otro nombre o permite sobreescribir.`
        }, { status: 409 });
      }

      const parentDir = path.dirname(targetFile);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      await fsPromises.writeFile(targetFile, String(content), 'utf-8');

      return NextResponse.json({
        success: true,
        message: `Archivo "${path.basename(targetFile)}" guardado correctamente.`,
        path: toPosix(targetFile)
      });
    }

    return NextResponse.json({
      error: `Acción desconocida "${accion}". Acciones disponibles: listar, crear_carpetas, eliminar_carpetas, leer_archivo, guardar_archivo, default.`
    }, { status: 400 });

  } catch (error: any) {
    console.error('[WorkspaceControl Error]:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno en workspace_control.'
    }, { status: 500 });
  }
}
