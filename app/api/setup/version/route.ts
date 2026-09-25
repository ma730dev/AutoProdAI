import { NextRequest, NextResponse } from 'next/server';

interface VersionCache {
  data: any;
  timestamp: number;
}

let cachedVersion: VersionCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de caché en memoria

export async function GET(req: NextRequest) {
  try {
    const now = Date.now();
    if (cachedVersion && now - cachedVersion.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedVersion.data);
    }

    const githubRepo = process.env.GITHUB_REPO || 'ma730dev/AutoProdAI';
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_RELEASE_TOKEN;

    const headers: HeadersInit = {
      'User-Agent': 'AutoProd-Version-Checker',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }

    const response = await fetch(`https://api.github.com/repos/${githubRepo}/releases/latest`, {
      headers,
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      // Si GitHub devuelve 404 (ej. aún no hay release formal con ese tag) o rate limit
      const fallbackData = {
        success: true,
        isLatest: true,
        tag: 'v1.5.3',
        version: '1.5.3',
        publishedAt: new Date().toISOString(),
        assets: {
          windowsBinary: `https://github.com/${githubRepo}/releases/latest/download/autoprod-motor.exe`,
          macBinary: `https://github.com/${githubRepo}/releases/latest/download/autoprod-motor`,
          windowsInstaller: `https://github.com/${githubRepo}/releases/latest/download/AutoProd-Setup.exe`,
          macInstaller: `https://github.com/${githubRepo}/releases/latest/download/AutoProd-Setup.dmg`,
        },
        notes: 'Versión estable de producción con soporte de auto-update y gobernanza de canales.',
        cached: false
      };
      return NextResponse.json(fallbackData);
    }

    const release = await response.json();
    const tag = release.tag_name || 'v1.0.0';
    const version = tag.replace(/^v/, '');

    // Localizar URLs directas de los assets
    let windowsBinary = `https://github.com/${githubRepo}/releases/download/${tag}/autoprod-motor.exe`;
    let macBinary = `https://github.com/${githubRepo}/releases/download/${tag}/autoprod-motor`;
    let windowsInstaller = `https://github.com/${githubRepo}/releases/download/${tag}/AutoProd-Setup.exe`;
    let macInstaller = `https://github.com/${githubRepo}/releases/download/${tag}/AutoProd-Setup.dmg`;

    if (Array.isArray(release.assets)) {
      for (const asset of release.assets) {
        if (asset.name === 'autoprod-motor.exe') windowsBinary = asset.browser_download_url;
        else if (asset.name === 'autoprod-motor') macBinary = asset.browser_download_url;
        else if (asset.name === 'AutoProd-Setup.exe') windowsInstaller = asset.browser_download_url;
        else if (asset.name === 'AutoProd-Setup.dmg') macInstaller = asset.browser_download_url;
      }
    }

    const versionData = {
      success: true,
      tag,
      version,
      publishedAt: release.published_at || new Date().toISOString(),
      assets: {
        windowsBinary,
        macBinary,
        windowsInstaller,
        macInstaller,
      },
      notes: release.body || '',
      htmlUrl: release.html_url
    };

    cachedVersion = {
      data: versionData,
      timestamp: now
    };

    return NextResponse.json(versionData);
  } catch (error: any) {
    console.error('[Version Checker API Error]:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al consultar la versión de release'
    }, { status: 500 });
  }
}
