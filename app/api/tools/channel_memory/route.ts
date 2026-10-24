import { NextRequest, NextResponse } from 'next/server';
import { POST as handleExtraerCanal } from '../extraer_canal_youtube/route';
import { getWorkspacePath } from '@/lib/setup/detector';
import path from 'path';
import fs from 'fs';

// ──────────────────────────────────────────────
// POST /api/tools/channel_memory
// Controlador unificado del dominio CHANNEL_MEMORY
// (Extracción de YouTube, análisis de ADN y memoria histórica)
// ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const accion = String(body.accion || body.action || '').toLowerCase().trim();

    // 1. Extracción de YouTube vía scraper/API
    if (accion === 'extraer' || accion === 'extraer_canal' || body.url_canal || body.url || body.channel_url) {
      const clonedReq = new NextRequest(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(body)
      });
      return await handleExtraerCanal(clonedReq);
    }

    // 2. Consulta de memoria física del canal
    if (accion === 'consultar' || accion === 'adn' || accion === 'info') {
      const wsRoot = getWorkspacePath();
      const channelName = body.channel_name || body.channel || body.canal || '';

      if (!channelName) {
        return NextResponse.json({ error: 'Debes indicar el canal a consultar.' }, { status: 400 });
      }

      const infoDir = path.join(wsRoot, channelName, 'InfoCanal');
      if (!fs.existsSync(infoDir)) {
        return NextResponse.json({
          exists: false,
          message: `El canal "${channelName}" no cuenta con carpeta InfoCanal/ en disco.`
        });
      }

      const files: Record<string, string> = {};
      const targetFiles = ['Contexto_canal.md', 'Metricas_canal.md', 'Historial_canal.md', 'Branding_canal.md'];
      for (const tf of targetFiles) {
        const fp = path.join(infoDir, tf);
        if (fs.existsSync(fp)) {
          files[tf] = fs.readFileSync(fp, 'utf-8');
        }
      }

      return NextResponse.json({
        success: true,
        channel: channelName,
        memory_files: files
      });
    }

    return NextResponse.json({
      error: 'Acción no especificada en channel_memory. Acciones disponibles: "extraer" (para importar canal de YouTube) o "consultar" (para leer el ADN e historial del canal).'
    }, { status: 400 });

  } catch (error: any) {
    console.error('[ChannelMemory Error]:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno en channel_memory.'
    }, { status: 500 });
  }
}
