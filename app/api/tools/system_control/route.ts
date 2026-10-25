import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { detectDependencies, getWorkspacePath } from '@/lib/setup/detector';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';

// ──────────────────────────────────────────────
// POST /api/tools/system_control
// Controlador unificado del dominio SYSTEM
// ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const accion = String(body.accion || body.action || body.tipo || 'capacidades').toLowerCase().trim();

    // ──────────────────────────────────────────────
    // 1. ACCIÓN: ESTADO_SISTEMA / DIAGNOSTICO
    // ──────────────────────────────────────────────
    if (accion === 'estado_sistema' || accion === 'diagnostico' || accion === 'status') {
      const dependencies = await detectDependencies();

      let motorOnline = false;
      let motorVersion = 'desconocida';
      try {
        const checkRes = await fetch('http://127.0.0.1:8000/status', { signal: AbortSignal.timeout(1500) });
        if (checkRes.ok) {
          const motorData = await checkRes.json();
          motorOnline = true;
          motorVersion = motorData.version || '1.6.4';
        }
      } catch {
        motorOnline = false;
      }

      // Leer manifest si existe
      let manifestDeps: any[] = [];
      try {
        const manifestPath = path.join(process.cwd(), 'lib', 'setup', 'manifest.json');
        if (fsSync.existsSync(manifestPath)) {
          const manifestData = await fs.readFile(manifestPath, 'utf-8');
          manifestDeps = JSON.parse(manifestData).dependencies || [];
        }
      } catch {}

      const report = dependencies.map(dep => {
        const def = manifestDeps.find((d: any) => d.id === dep.id);
        return {
          id: dep.id,
          name: dep.name,
          status: dep.status,
          description: def?.description || 'Componente del sistema.'
        };
      });

      return NextResponse.json({
        success: true,
        motor_local: {
          online: motorOnline,
          port: 8000,
          version: motorVersion,
          mensaje: motorOnline ? 'Motor local activo y listo.' : 'Motor local desconectado (inícialo para renderizado y TTS local).'
        },
        dependencias: report,
        workspace_path: getWorkspacePath()
      });
    }

    // ──────────────────────────────────────────────
    // 2. ACCIÓN: CONSULTAR_PROMPTS / PROCEDIMIENTOS (SOP)
    // ──────────────────────────────────────────────
    if (accion === 'consultar_prompts' || accion === 'sop' || accion === 'procedimientos' || accion === 'plantilla') {
      const templateName = body.nombre || body.template || body.tipo_procedimiento || body.procedimiento;

      if (templateName && typeof templateName === 'string' && templateName.trim()) {
        const template = await db.promptTemplate.findFirst({
          where: { name: { equals: String(templateName).trim(), mode: 'insensitive' } }
        });

        if (!template) {
          const all = await db.promptTemplate.findMany({ select: { name: true, description: true } });
          return NextResponse.json({
            status: 'not_found',
            message: `No se encontró la plantilla exacta para "${templateName}". Procedimientos registrados: ${all.map(p => p.name).join(', ')}`,
            disponibles: all
          });
        }

        return NextResponse.json({
          status: 'success',
          nombre: template.name,
          descripcion: template.description,
          directiva: template.systemPrompt,
          welcomeText: template.welcomeText
        });
      }

      // Si no especificó nombre, devolver el catálogo disponible
      const allTemplates = await db.promptTemplate.findMany({
        select: { name: true, description: true, welcomeText: true }
      });

      return NextResponse.json({
        status: 'success',
        mensaje: 'Catálogo de procedimientos y guías de producción registradas en AutoProd:',
        procedimientos: allTemplates
      });
    }

    // ──────────────────────────────────────────────
    // 3. ACCIÓN: CAPACIDADES (Presentación del Sistema)
    // ──────────────────────────────────────────────
    const wsRoot = getWorkspacePath();
    let channels: string[] = [];
    try {
      if (fsSync.existsSync(wsRoot)) {
        channels = fsSync.readdirSync(wsRoot, { withFileTypes: true })
          .filter(e => e.isDirectory() && !e.name.startsWith('.'))
          .map(e => e.name);
      }
    } catch {}

    return NextResponse.json({
      success: true,
      sistema: 'AutoProd AI — Sistema Operativo para Proyectos de Contenido',
      pilares: [
        { pilar: 'CREA', descripcion: 'Desarrolla ideas con intención, temas y guiones estructurados.' },
        { pilar: 'PRODUCE', descripcion: 'Ensamble audiovisual, clips, bucles de video de 1 a 3 horas y subtítulos automáticos.' },
        { pilar: 'ANALIZA', descripcion: 'Referencias de nicho, enfoques temáticos y memoria histórica de lo ya cubierto.' },
        { pilar: 'ESCALA', descripcion: 'Gestión ordenada de carpetas y proyectos en tu propio disco duro.' }
      ],
      workspace: {
        ruta: wsRoot,
        total_proyectos: channels.length,
        proyectos_detectados: channels
      },
      dominios_herramientas: {
        workspace_control: 'Gestión de carpetas, proyectos y archivos en disco.',
        creative_studio: 'Generación de locuciones (voces en off) e imágenes/miniaturas con IA.',
        system_control: 'Procedimientos de producción, diagnóstico del motor y estado.'
      }
    });

  } catch (error: any) {
    console.error('[SystemControl Error]:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno en system_control.'
    }, { status: 500 });
  }
}
