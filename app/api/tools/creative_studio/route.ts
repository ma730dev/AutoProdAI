import { NextRequest, NextResponse } from 'next/server';
import { POST as handleGenerarImagen } from '../generar_imagen/route';
import { POST as handleGenerarLocucion } from '../generar_locucion/route';

// ──────────────────────────────────────────────
// POST /api/tools/creative_studio
// Controlador unificado del dominio CREATIVE_STUDIO
// (Generación de Miniaturas / Imágenes y Voces TTS)
// ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const accion = String(body.accion || body.action || body.tipo_recurso || body.tipo || '').toLowerCase().trim();

    // 1. Despachar a GENERACIÓN DE IMAGEN / MINIATURA / BANNER
    if (accion.includes('imagen') || accion.includes('miniatura') || accion.includes('banner') || accion.includes('thumbnail') || body.prompt) {
      const clonedReq = new NextRequest(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(body)
      });
      return await handleGenerarImagen(clonedReq);
    }

    // 2. Despachar a GENERACIÓN DE LOCUCIÓN / VOZ / TTS
    if (accion.includes('locucion') || accion.includes('voz') || accion.includes('tts') || accion.includes('audio') || body.texto) {
      const clonedReq = new NextRequest(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(body)
      });
      return await handleGenerarLocucion(clonedReq);
    }

    return NextResponse.json({
      error: 'Acción no especificada en creative_studio. Usa "accion: imagen" (para miniaturas y portadas con DALL-E 3) o "accion: locucion" (para narraciones de audio con TTS).'
    }, { status: 400 });

  } catch (error: any) {
    console.error('[CreativeStudio Error]:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno en creative_studio.'
    }, { status: 500 });
  }
}
