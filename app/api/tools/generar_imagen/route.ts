import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { createClient } from '@/lib/supabase/server';
import { getWorkspacePath } from '@/harness/setup/detector';
import fs from 'fs';
import path from 'path';

// ──────────────────────────────────────────────
// POST /api/tools/generar_imagen
// Tool oficial de AutoProd para generación y persistencia de miniaturas e imágenes
// ──────────────────────────────────────────────

interface ApiKeyResolution {
  apiKey: string;
  isSystemKey: boolean;
}

async function resolveOpenAiKey(userId?: string | null): Promise<ApiKeyResolution> {
  const supabase = await createClient();

  // 1. BYOK en User Vault (openaiVaultId) si hay usuario
  if (userId) {
    try {
      const userRecord = await db.user.findUnique({
        where: { id: userId },
        select: { openaiVaultId: true }
      });
      if (userRecord?.openaiVaultId) {
        const { data: secretData } = await supabase.rpc('get_decrypted_secret', { p_secret_id: userRecord.openaiVaultId });
        if (secretData) {
          const key = typeof secretData === 'string' ? secretData : secretData.get_decrypted_secret || secretData;
          if (key && key.trim()) {
            return { apiKey: key.trim(), isSystemKey: false };
          }
        }
      }
    } catch (e) {
      console.warn('[Tool/generar_imagen] Error reading user openaiVaultId:', e);
    }

    // 1b. BYOK vía RPC get_api_key
    try {
      const { data: rpcKey } = await supabase.rpc('get_api_key', { p_user_id: userId, p_provider: 'openai' });
      if (rpcKey && typeof rpcKey === 'string' && rpcKey.trim() !== '') {
        return { apiKey: rpcKey.trim(), isSystemKey: false };
      }
    } catch (e) {
      console.warn('[Tool/generar_imagen] Error fetching key from Vault via RPC:', e);
    }
  }

  // 2. Llave Maestra del Sistema (Admin / Servidor)
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
    return { apiKey: process.env.OPENAI_API_KEY.trim(), isSystemKey: true };
  }

  // 2b. Buscar en SystemSettings Vault
  try {
    const sysSettings = await db.systemSettings.findUnique({ where: { id: 'global' } });
    if (sysSettings?.openaiVaultId) {
      const { data: sysKey } = await supabase.rpc('get_decrypted_secret', { p_secret_id: sysSettings.openaiVaultId });
      if (sysKey) {
        const key = typeof sysKey === 'string' ? sysKey : sysKey.get_decrypted_secret || sysKey;
        if (key && key.trim()) {
          return { apiKey: key.trim(), isSystemKey: true };
        }
      }
    }
  } catch (e) {
    console.warn('[Tool/generar_imagen] Error reading systemSettings vault for openai:', e);
  }

  throw new Error('No se encontró ninguna clave de OpenAI (OPENAI_API_KEY) configurada ni en BYOK ni en el servidor.');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      prompt,
      aspect_ratio = '16:9',
      aspectRatio,
      channel_name,
      channelName,
      video_title,
      videoTitle,
      video_name,
      tipo = 'THUMBNAIL',
      type,
      _userContext
    } = body;

    const finalPrompt = (prompt || '').trim();
    if (!finalPrompt) {
      return NextResponse.json({ error: 'El prompt de la imagen es obligatorio.' }, { status: 400 });
    }

    const finalAspectRatio = aspect_ratio || aspectRatio || '16:9';
    const finalTipo = (tipo || type || 'THUMBNAIL').toUpperCase();
    const targetChannel = channel_name || channelName || null;
    const targetVideo = video_title || videoTitle || video_name || null;

    // Obtener contexto de usuario y workspace
    let userId = _userContext?.userId || null;
    let workspaceRoot = _userContext?.workspacePath || getWorkspacePath() || null;

    if (!userId) {
      try {
        const supabase = await createClient();
        const { data: authData } = await supabase.auth.getUser();
        userId = authData?.user?.id || null;
      } catch (authErr) {
        console.warn('[Tool/generar_imagen] Auth fallback error:', authErr);
      }
    }

    const { apiKey, isSystemKey } = await resolveOpenAiKey(userId);
    const requiredCredits = isSystemKey ? 5 : 0; // 5 créditos con llave de sistema

    // Validar saldo si usa llave del sistema
    let userWallet: any = null;
    if (isSystemKey && userId) {
      try {
        userWallet = await db.wallet.findUnique({ where: { userId } });
        if (!userWallet) {
          userWallet = await db.wallet.create({ data: { userId, balance: 50 } });
        }

        if (userWallet.balance < requiredCredits) {
          return NextResponse.json({
            status: 'insufficient_credits',
            error: `Créditos insuficientes (${userWallet.balance} disponibles, necesitas ${requiredCredits} para generar una imagen con DALL-E 3). Recarga tu saldo para continuar.`,
            requiredCredits,
            currentBalance: userWallet.balance
          }, { status: 402 });
        }
      } catch (wErr: any) {
        console.warn('[Tool/generar_imagen] Error al consultar wallet:', wErr.message);
      }
    }

    // Dimensiones DALL-E 3
    let size = '1792x1024'; // 16:9 YouTube Thumbnail
    if (finalAspectRatio === '9:16') {
      size = '1024x1792'; // 9:16 Shorts
    } else if (finalAspectRatio === '1:1') {
      size = '1024x1024'; // Logo / Avatar
    }

    // 1. Invocar DALL-E 3
    const openAiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size,
        quality: 'standard',
      }),
    });

    if (!openAiRes.ok) {
      const err = await openAiRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error?.message || 'Error al generar la imagen con DALL-E 3' },
        { status: 500 }
      );
    }

    const oaiData = await openAiRes.json();
    let b64Data = oaiData.data?.[0]?.b64_json;
    const imageUrl = oaiData.data?.[0]?.url;
    const revisedPrompt = oaiData.data?.[0]?.revised_prompt || finalPrompt;

    let imageBuffer: Buffer;
    if (b64Data) {
      imageBuffer = Buffer.from(b64Data, 'base64');
    } else if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        throw new Error('No se pudo descargar la imagen generada por OpenAI desde su URL temporal');
      }
      const arrayBuf = await imgRes.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuf);
      b64Data = imageBuffer.toString('base64');
    } else {
      return NextResponse.json({ error: 'No se recibieron datos de imagen de OpenAI' }, { status: 500 });
    }

    const timestamp = Date.now();
    const cleanPromptSlug = finalPrompt
      .toLowerCase()
      .slice(0, 30)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const fileName = `miniatura_${cleanPromptSlug || timestamp}.png`;

    // 2. Guardar físicamente en el disco según la taxonomía estricta de AutoProd
    let localSavedPath: string | null = null;
    let targetDirectory: string | null = null;

    if (workspaceRoot) {
      if (targetChannel && targetVideo) {
        // En proyecto de video: /{workspace}/{channel}/{video}/Miniatura/
        targetDirectory = path.join(workspaceRoot, targetChannel, targetVideo, 'Miniatura');
      } else if (targetChannel) {
        // En canal: /{workspace}/{channel}/InfoCanal/ o /{workspace}/{channel}/Miniatura/
        targetDirectory = finalTipo === 'BANNER' || finalTipo === 'LOGO'
          ? path.join(workspaceRoot, targetChannel, 'InfoCanal')
          : path.join(workspaceRoot, targetChannel, 'Miniatura');
      } else {
        // Carpeta general de recursos
        targetDirectory = path.join(workspaceRoot, 'Recursos', 'Miniaturas');
      }

      try {
        if (!fs.existsSync(targetDirectory)) {
          fs.mkdirSync(targetDirectory, { recursive: true });
        }
        const fullFilePath = path.join(targetDirectory, fileName);
        fs.writeFileSync(fullFilePath, imageBuffer);
        localSavedPath = fullFilePath;
      } catch (fsErr: any) {
        console.warn('[Tool/generar_imagen] Error al escribir en disco local directamente:', fsErr.message);
      }
    }

    // 3. Subir a Supabase Storage como respaldo en la nube
    let storageUrl: string | null = null;
    if (userId) {
      try {
        const supabase = await createClient();
        const storagePath = `${userId}/images/${timestamp}_${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('assets')
          .upload(storagePath, imageBuffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('assets')
            .getPublicUrl(storagePath);
          storageUrl = publicUrl;
        }
      } catch (stErr: any) {
        console.warn('[Tool/generar_imagen] Fallo al subir a Supabase Storage:', stErr.message);
      }
    }

    if (!storageUrl && imageUrl) {
      storageUrl = imageUrl;
    }

    // 4. Registrar en la base de datos (Asset)
    let channelRecord: any = null;
    if (userId && targetChannel) {
      try {
        channelRecord = await db.channel.findFirst({
          where: { userId, name: { equals: targetChannel, mode: 'insensitive' } },
          select: { id: true, name: true }
        });
      } catch { /* ignorar */ }
    }

    let assetRecord: any = null;
    if (userId) {
      try {
        assetRecord = await db.asset.create({
          data: {
            userId,
            channelId: channelRecord?.id || null,
            name: fileName,
            type: finalTipo,
            format: 'png',
            prompt: finalPrompt,
            storageUrl: storageUrl || null,
            localPath: localSavedPath || null,
            sizeBytes: BigInt(imageBuffer.length),
            metadata: {
              revisedPrompt,
              aspectRatio: finalAspectRatio,
              dalleResolution: size,
              engine: 'dall-e-3',
              channelName: targetChannel,
              videoTitle: targetVideo
            }
          }
        });
      } catch (assetErr: any) {
        console.warn('[Tool/generar_imagen] Error guardando Asset en BD:', assetErr.message);
      }
    }

    // 5. Descuento de créditos de la plataforma si usó llave del sistema
    let newBalance: number | null = null;
    if (isSystemKey && userWallet && requiredCredits > 0) {
      try {
        const [updatedWallet] = await db.$transaction([
          db.wallet.update({
            where: { id: userWallet.id },
            data: { balance: { decrement: requiredCredits } }
          }),
          db.creditConsumption.create({
            data: {
              walletId: userWallet.id,
              creditsUsed: requiredCredits,
              serviceType: 'TOOL',
              modelName: 'dall-e-3',
              description: `Generación de imagen (${finalTipo}) con DALL-E 3: ${fileName}`
            }
          })
        ]);
        newBalance = updatedWallet.balance;
      } catch (cErr: any) {
        console.warn('[Tool/generar_imagen] Error descontando créditos:', cErr.message);
      }
    }

    // URL para servir la imagen localmente o vía storage
    const serveUrl = localSavedPath 
      ? `/api/assets/stream?path=${encodeURIComponent(localSavedPath)}`
      : (storageUrl || imageUrl || '');

    const markdownEmbed = `\n\n![${finalTipo}: ${cleanPromptSlug || 'Imagen'}](${serveUrl})\n\n`;

    return NextResponse.json({
      status: 'success',
      message: `Imagen generada y guardada correctamente como "${fileName}".`,
      fileName,
      filePath: localSavedPath,
      imageUrl: serveUrl,
      markdown: markdownEmbed,
      revisedPrompt,
      aspectRatio: finalAspectRatio,
      dimensions: size,
      newBalance,
      assetId: assetRecord?.id || null,
      channel: targetChannel,
      video: targetVideo
    });
  } catch (err: any) {
    console.error('[Tool/generar_imagen Error]:', err);
    return NextResponse.json({ error: err.message || 'Error interno al generar imagen' }, { status: 500 });
  }
}
