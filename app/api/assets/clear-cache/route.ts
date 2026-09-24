import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { getAuthUser } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/assets/clear-cache
 * Purga todos los recursos temporales marcados como caché (isCache = true)
 * liberando almacenamiento en la nube y en base de datos.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    // 1. Obtener todos los assets de caché del usuario
    const cacheAssets = await db.asset.findMany({
      where: {
        userId: user.id,
        isCache: true
      },
      select: {
        id: true,
        storageUrl: true,
        localPath: true,
        sizeBytes: true,
        name: true
      }
    });

    if (cacheAssets.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        freedBytes: 0,
        message: 'No hay archivos de caché para eliminar.'
      });
    }

    let freedBytes = 0;
    const cloudFilePathsToRemove: string[] = [];

    for (const asset of cacheAssets) {
      freedBytes += Number(asset.sizeBytes) || 0;
      if (asset.storageUrl) {
        // Extraer path relativo dentro del bucket si es URL de Supabase Storage
        try {
          const urlObj = new URL(asset.storageUrl);
          const pathSegments = urlObj.pathname.split('/assets/');
          if (pathSegments.length > 1) {
            cloudFilePathsToRemove.push(decodeURIComponent(pathSegments[1]));
          }
        } catch (_) {
          // Si no es URL parseable estándar, continuar
        }
      }
    }

    // 2. Intentar purgar archivos en Supabase Storage si aplica
    if (cloudFilePathsToRemove.length > 0) {
      try {
        const supabase = getSupabaseClient();
        await supabase.storage.from('assets').remove(cloudFilePathsToRemove);
      } catch (storageErr) {
        console.warn('Advertencia al purgar archivos de storage en clear-cache:', storageErr);
      }
    }

    // 3. Eliminar los registros de la base de datos
    const deleteResult = await db.asset.deleteMany({
      where: {
        userId: user.id,
        isCache: true
      }
    });

    // Formatear tamaño liberado (MB / GB)
    const mb = (freedBytes / (1024 * 1024)).toFixed(1);
    const gb = (freedBytes / (1024 * 1024 * 1024)).toFixed(2);
    const freedFormatted = freedBytes > 1024 * 1024 * 1024 ? `${gb} GB` : `${mb} MB`;

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.count,
      freedBytes,
      freedFormatted,
      message: `Se vació el caché correctamente. Espacio liberado: ${freedFormatted}.`
    });
  } catch (err: any) {
    console.error('Error al vaciar caché de assets:', err);
    return NextResponse.json({ error: err.message || 'Error al vaciar caché' }, { status: 500 });
  }
}
