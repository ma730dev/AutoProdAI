import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const osParam = searchParams.get('os')?.toLowerCase();
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';

    const isMac = osParam === 'mac' || osParam === 'macos' || (!osParam && userAgent.includes('mac'));

    // 1. Streaming nativo desde GitHub Releases (oculta la URL del repositorio al usuario)
    const githubRepo = process.env.GITHUB_REPO || 'ma730dev/AutoProdAI';
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_RELEASE_TOKEN;
    const targetFileName = isMac ? 'AutoProd-Setup.dmg' : 'AutoProd-Setup.exe';
    const contentType = isMac ? 'application/x-apple-diskimage' : 'application/vnd.microsoft.portable-executable';

    if (githubRepo) {
      const releaseUrl = `https://github.com/${githubRepo}/releases/latest/download/${targetFileName}`;
      
      const fetchHeaders: HeadersInit = {
        'User-Agent': 'AutoProd-Installer-Downloader'
      };
      if (githubToken) {
        fetchHeaders['Authorization'] = `token ${githubToken}`;
      }

      try {
        const response = await fetch(releaseUrl, {
          headers: fetchHeaders,
          redirect: 'follow',
          cache: 'no-store'
        });

        if (response.ok && response.body) {
          const headers = new Headers();
          headers.set('Content-Type', contentType);
          headers.set('Content-Disposition', `attachment; filename="${targetFileName}"`);
          headers.set('Cache-Control', 'public, max-age=3600');
          
          const contentLength = response.headers.get('content-length');
          if (contentLength) {
            headers.set('Content-Length', contentLength);
          }

          return new NextResponse(response.body as any, {
            status: 200,
            headers
          });
        }
      } catch (fetchError) {
        console.warn('Fallo al obtener release remoto de GitHub, intentando fallback local...', fetchError);
      }
    }

    // 2. Servir archivo binario compilado local si existe en el servidor
    const fallbackExeName = isMac ? 'autoprod-motor' : 'autoprod-motor.exe';
    let filePath = path.join(process.cwd(), 'dist', targetFileName);
    if (!fsSync.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'dist', fallbackExeName);
    }

    if (fsSync.existsSync(filePath)) {
      const fileBuffer = await fs.readFile(filePath);

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${targetFileName}"`,
          'Cache-Control': 'no-store, max-age=0'
        }
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'El instalador oficial no está disponible en este momento. Por favor compila el paquete ejecutando scripts/build/build-windows.bat'
      },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error serving installer binary:', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo generar la descarga del instalador' },
      { status: 500 }
    );
  }
}
