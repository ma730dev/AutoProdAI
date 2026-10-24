import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { getWorkspacePath } from '@/lib/setup/detector';
import { db as prisma } from '@/src/prisma/db';
import { PLANS_CONFIG } from '@/lib/pricing-config';

// ──────────────────────────────────────────────
// Carpetas reservadas del sistema (Protegidas)
// ──────────────────────────────────────────────
const SYSTEM_RESERVED_FOLDERS = [
  'recursos', 'assets', 'node_modules', 'bin', 'public', 'dist', 'build',
  'temp', 'tmp', 'cache', '.git', '.next', 'workspace', 'youtube', 'docs',
  'controlador', 'prisma', 'src', 'app', 'components', 'lib'
];

function sanitizeFolderName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, ' - ').replace(/\s+/g, ' ').trim();
}

const ALLOWED_TEXT_EXTENSIONS = [
  '.md', '.markdown', '.txt',
  '.srt', '.vtt', '.ass', '.ssa', '.lrc',
  '.json', '.csv', '.tsv', '.xml', '.yaml', '.yml'
];

// ──────────────────────────────────────────────
// POST /api/tools/workspace_control
// Controlador unificado del dominio WORKSPACE_FS
// ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const accion = String(body.accion || body.action || body.tipo || 'listar').toLowerCase().trim();
    const userContext = body._userContext || {};
    const userId = userContext.id || body.userId;

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

    // ──────────────────────────────────────────────
    // ACCIÓN: DEFAULT (Ruta base y canales detectados)
    // ──────────────────────────────────────────────
    if (accion === 'default' || accion === 'workspace_default') {
      const entries = fs.existsSync(wsRoot) ? fs.readdirSync(wsRoot, { withFileTypes: true }) : [];
      const channels = entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && !SYSTEM_RESERVED_FOLDERS.includes(e.name.toLowerCase()))
        .map(e => e.name);

      return NextResponse.json({
        success: true,
        workspace_path: wsRoot,
        total_channels: channels.length,
        channels
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
      const channelName = body.channel_name || body.channel || body.canal || '';

      if (requestedPath && requestedPath !== '.' && requestedPath !== '/') {
        targetDir = path.isAbsolute(requestedPath) ? requestedPath : path.join(wsRoot, requestedPath);
      } else if (channelName) {
        targetDir = path.join(wsRoot, sanitizeFolderName(channelName));
      }

      if (!fs.existsSync(targetDir)) {
        // En lugar de romper con HTTP 404, devolver estado controlado amigable
        const rootEntries = fs.existsSync(wsRoot) ? fs.readdirSync(wsRoot, { withFileTypes: true }) : [];
        const existingFolders = rootEntries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);

        return NextResponse.json({
          success: false,
          exists: false,
          message: `La carpeta "${path.basename(targetDir)}" no existe físicamente en el workspace.`,
          workspace_root: wsRoot,
          carpetas_existentes: existingFolders
        });
      }

      if (isFlat) {
        // Recorrido plano
        const folders: any[] = [];
        const files: any[] = [];

        function walk(current: string, currentDepth: number) {
          if (currentDepth > depth) return;
          try {
            const items = fs.readdirSync(current, { withFileTypes: true });
            for (const item of items) {
              if (item.name.startsWith('.')) continue;
              const fullP = path.join(current, item.name).replace(/\\/g, '/');
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
        }

        walk(targetDir, 1);

        return NextResponse.json({
          success: true,
          base_path: targetDir.replace(/\\/g, '/'),
          total_carpetas: folders.length,
          total_archivos: files.length,
          carpetas: folders,
          archivos: files
        });
      } else {
        // Recorrido jerárquico (Árbol)
        function buildTree(current: string, currentDepth: number, maxD: number = 3): any[] {
          if (currentDepth > maxD) return [];
          const tree: any[] = [];
          try {
            const items = fs.readdirSync(current, { withFileTypes: true });
            for (const item of items) {
              if (item.name.startsWith('.')) continue;
              const node: any = {
                name: item.name,
                path: path.join(current, item.name).replace(/\\/g, '/'),
                type: item.isDirectory() ? 'directory' : 'file'
              };
              if (item.isDirectory()) {
                node.children = buildTree(path.join(current, item.name), currentDepth + 1, maxD);
              }
              tree.push(node);
            }
          } catch {}
          return tree;
        }

        const tree = buildTree(targetDir, 0);
        return NextResponse.json({
          success: true,
          workspace: targetDir.replace(/\\/g, '/'),
          tree
        });
      }
    }

    // ──────────────────────────────────────────────
    // ACCIÓN: CREAR_CARPETAS (Carpetas, Canales o Proyectos)
    // ──────────────────────────────────────────────
    if (accion === 'crear' || accion === 'crear_carpetas' || accion === 'crear_canal') {
      const channelName = body.channel_name || body.channel || body.canal || body.nombre_canal || null;
      let targetParent = wsRoot;

      if (body.target_path && body.target_path !== '.' && body.target_path !== '/') {
        targetParent = path.isAbsolute(body.target_path) ? body.target_path : path.join(wsRoot, body.target_path);
      } else if (channelName && body.folder_name) {
        targetParent = path.join(wsRoot, sanitizeFolderName(channelName));
      }

      // Recolectar nombres de carpetas
      let candidateFolders: string[] = [];
      if (Array.isArray(body.folders)) candidateFolders.push(...body.folders);
      if (Array.isArray(body.carpetas)) candidateFolders.push(...body.carpetas);
      if (Array.isArray(body.folder_names)) candidateFolders.push(...body.folder_names);
      if (body.folder_name) candidateFolders.push(body.folder_name);
      if (body.nombre_carpeta) candidateFolders.push(body.nombre_carpeta);
      if (body.name && !channelName) candidateFolders.push(body.name);

      // Si solo vino channel_name sin folders específicos, se crea la carpeta del canal en la raíz
      if (candidateFolders.length === 0 && channelName) {
        candidateFolders.push(channelName);
      }

      if (candidateFolders.length === 0 && Array.isArray(body.paths)) {
        candidateFolders = body.paths;
      }

      if (candidateFolders.length === 0) {
        return NextResponse.json({
          error: "Debes especificar al menos el nombre de la carpeta o canal a crear ('folder_name' o 'folders')."
        }, { status: 400 });
      }

      // VALIDACIÓN DE LÍMITES DE PLAN (si se crea carpeta directamente en la raíz)
      const isTargetRoot = path.resolve(targetParent) === path.resolve(wsRoot);
      if (isTargetRoot && userId) {
        try {
          const userRecord = await prisma.user.findUnique({
            where: { id: userId },
            include: { subscription: { include: { plan: { include: { limits: true } } } } }
          });
          const planName = (userRecord?.subscription?.plan?.name as 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE') || 'FREE';
          const planConfig = PLANS_CONFIG[planName] || PLANS_CONFIG.FREE;
          const maxChannels = userRecord?.subscription?.plan?.limits?.maxChannels ?? planConfig.maxChannels;
          const isAdmin = userRecord?.role === 'ADMIN';

          if (!isAdmin && maxChannels < 9999) {
            const rootEntries = fs.readdirSync(wsRoot, { withFileTypes: true });
            const currentRootDirs = rootEntries
              .filter(e => e.isDirectory() && !e.name.startsWith('.') && !SYSTEM_RESERVED_FOLDERS.includes(e.name.toLowerCase()))
              .map(e => e.name);

            const isCreatingNewRoot = candidateFolders.some(f => !currentRootDirs.includes(sanitizeFolderName(f)));
            if (isCreatingNewRoot && currentRootDirs.length >= maxChannels) {
              return NextResponse.json({
                error: `[LÍMITE DE PLAN]: Tu plan actual ${planConfig.displayName} solo permite hasta ${maxChannels} canal(es)/carpeta(s) principales. Ya tienes ${currentRootDirs.length} (${currentRootDirs.join(', ')}). Actualiza tu plan para crear más.`,
                requiresUpgrade: true
              }, { status: 402 });
            }
          }
        } catch (planErr: any) {
          console.warn('[WorkspaceControl] Error al verificar límites de plan:', planErr.message);
        }
      }

      const createdPaths: string[] = [];
      const subfolders = Array.isArray(body.subfolders) ? body.subfolders : [];

      for (const rawName of candidateFolders) {
        if (!rawName || typeof rawName !== 'string') continue;
        const cleanName = sanitizeFolderName(rawName);
        if (!cleanName) continue;

        const fullFolderPath = path.isAbsolute(rawName) ? rawName : path.join(targetParent, cleanName);
        fs.mkdirSync(fullFolderPath, { recursive: true });
        createdPaths.push(fullFolderPath.replace(/\\/g, '/'));

        // Si se especificaron subcarpetas (ej: Guiones, Videos, Miniatura, Musica, Ambiente)
        for (const sub of subfolders) {
          if (sub && typeof sub === 'string') {
            fs.mkdirSync(path.join(fullFolderPath, sanitizeFolderName(sub)), { recursive: true });
          }
        }

        // Si la carpeta creada está directamente en la raíz (Nivel 1: Canal o Proyecto), inicializar InfoCanal base si no existe
        if (isTargetRoot) {
          const infoCanal = path.join(fullFolderPath, 'InfoCanal');
          if (!fs.existsSync(infoCanal)) {
            fs.mkdirSync(infoCanal, { recursive: true });
            const ctxFile = path.join(infoCanal, 'Contexto_canal.md');
            if (!fs.existsSync(ctxFile)) {
              const tematica = body.tematica || body.niche || body.tema || cleanName;
              fs.writeFileSync(ctxFile, `# Identidad del Canal: ${cleanName}\n\n- **Nicho / Enfoque:** ${tematica}\n- **Creado el:** ${new Date().toLocaleDateString()}\n- **Directivas:** Producción de contenido original.\n`, 'utf-8');
            }
          }

          // Registrar en la BD si hay userId
          if (userId) {
            try {
              await prisma.channel.upsert({
                where: { id: fullFolderPath }, // Fallback id
                update: { localPath: fullFolderPath, folderStatus: 'CREATED' },
                create: {
                  name: cleanName,
                  userId,
                  localPath: fullFolderPath,
                  niche: body.tematica || body.niche || cleanName,
                  folderStatus: 'CREATED'
                }
              }).catch(() => {});
            } catch {}
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Se crearon ${createdPaths.length} carpeta(s) exitosamente.`,
        created: createdPaths,
        base_path: targetParent.replace(/\\/g, '/')
      });
    }

    // ──────────────────────────────────────────────
    // ACCIÓN: ELIMINAR_CARPETAS
    // ──────────────────────────────────────────────
    if (accion === 'eliminar' || accion === 'eliminar_carpetas' || accion === 'borrar') {
      const candidatePaths: string[] = [];

      if (Array.isArray(body.paths)) candidatePaths.push(...body.paths);
      if (Array.isArray(body.rutas)) candidatePaths.push(...body.rutas);
      if (Array.isArray(body.folders)) candidatePaths.push(...body.folders);
      if (Array.isArray(body.carpetas)) candidatePaths.push(...body.carpetas);
      if (body.path) candidatePaths.push(body.path);
      if (body.ruta) candidatePaths.push(body.ruta);
      if (body.folder_name) candidatePaths.push(body.folder_name);

      if (body.channel_name && body.folder_name) {
        candidatePaths.push(path.join(wsRoot, sanitizeFolderName(body.channel_name), sanitizeFolderName(body.folder_name)));
      } else if (body.channel_name && candidatePaths.length === 0) {
        candidatePaths.push(path.join(wsRoot, sanitizeFolderName(body.channel_name)));
      }

      const deleted: string[] = [];
      const errors: string[] = [];

      for (const p of candidatePaths) {
        if (!p || typeof p !== 'string') continue;
        const target = path.isAbsolute(p) ? p : path.join(wsRoot, p);
        const resolved = path.resolve(target);

        // Protección estricta: No permitir borrar raíz del workspace ni carpetas de sistema
        if (resolved === path.resolve(wsRoot) || resolved === path.resolve(process.cwd())) {
          errors.push(`Operación bloqueada: No se puede eliminar la raíz del workspace (${p}).`);
          continue;
        }

        const baseName = path.basename(resolved).toLowerCase();
        if (SYSTEM_RESERVED_FOLDERS.includes(baseName)) {
          errors.push(`Operación bloqueada: "${baseName}" es una carpeta reservada del sistema.`);
          continue;
        }

        if (fs.existsSync(resolved)) {
          try {
            fs.rmSync(resolved, { recursive: true, force: true });
            deleted.push(resolved.replace(/\\/g, '/'));
          } catch (delErr: any) {
            errors.push(`Error eliminando "${p}": ${delErr.message}`);
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

      const targetFile = path.isAbsolute(rawPath) ? rawPath : path.join(wsRoot, rawPath);
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
        path: targetFile.replace(/\\/g, '/'),
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

      const targetFile = path.isAbsolute(rawPath) ? rawPath : path.join(wsRoot, rawPath);
      const parentDir = path.dirname(targetFile);

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      await fsPromises.writeFile(targetFile, String(content), 'utf-8');

      return NextResponse.json({
        success: true,
        message: `Archivo "${path.basename(targetFile)}" guardado correctamente.`,
        path: targetFile.replace(/\\/g, '/')
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
