import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { getAuthUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

interface ApiKeyResolution {
  apiKey: string;
  isSystemKey: boolean;
}

async function resolveOpenAiKey(userId: string): Promise<ApiKeyResolution> {
  const supabase = await createClient();

  // 1. PRIORIDAD 1: BYOK en User Vault (openaiVaultId)
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
    console.warn('Error reading user openaiVaultId:', e);
  }

  // 1b. PRIORIDAD 2: BYOK vía RPC get_api_key
  try {
    const { data: rpcKey } = await supabase.rpc('get_api_key', { p_user_id: userId, p_provider: 'openai' });
    if (rpcKey && typeof rpcKey === 'string' && rpcKey.trim() !== '') {
      return { apiKey: rpcKey.trim(), isSystemKey: false };
    }
  } catch (e) {
    console.warn('Error fetching key from Vault via RPC:', e);
  }

  // 2. PRIORIDAD 3: Llave Maestra del Sistema (Admin / Servidor)
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
    console.warn('Error reading systemSettings vault for openai:', e);
  }

  throw new Error('No se encontró ninguna clave de OpenAI (OPENAI_API_KEY) configurada ni en BYOK ni en el servidor.');
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body = await req.json();
    const {
      prompt,
      aspectRatio = '16:9',
      channelId,
      channelName,
      customFileName,
      type = 'THUMBNAIL',
    } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: 'El prompt es obligatorio' }, { status: 400 });
    }

    const { apiKey, isSystemKey } = await resolveOpenAiKey(user.id);
    const requiredCredits = isSystemKey ? 5 : 0; // DALL-E 3 cuesta 5 créditos si usa llave de plataforma

    // Validar saldo de créditos antes de invocar DALL-E 3
    let wallet = null;
    if (isSystemKey) {
      wallet = await db.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet) {
        wallet = await db.wallet.create({ data: { userId: user.id, balance: 50 } });
      }

      if (wallet.balance < requiredCredits) {
        return NextResponse.json({
          error: `Créditos insuficientes (${wallet.balance} disponibles, necesitas ${requiredCredits} créditos para generar una imagen HD con DALL-E 3). Por favor recarga tu saldo o mejora tu plan para continuar.`,
          requiresUpgrade: true
        }, { status: 402 });
      }
    }

    // Dimensiones según aspecto para DALL-E 3
    let size = '1792x1024'; // 16:9 YouTube Thumbnail
    if (aspectRatio === '9:16') {
      size = '1024x1792'; // 9:16 Shorts
    } else if (aspectRatio === '1:1') {
      size = '1024x1024'; // Cuadrado
    }

    // 1. Llamar a OpenAI DALL-E 3
    const openAiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt.trim(),
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

    const data = await openAiRes.json();
    let b64Data = data.data?.[0]?.b64_json;
    const imageUrl = data.data?.[0]?.url;
    const revisedPrompt = data.data?.[0]?.revised_prompt || prompt;

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
    const cleanName = customFileName
      ? customFileName.replace(/[^a-zA-Z0-9_-]/g, '_')
      : `imagen_${timestamp}`;
    const fileName = `${cleanName}.png`;

    // 2. Guardar físicamente en el disco local a través del Motor de Python
    let localPath: string | null = null;
    let sizeBytes = 0;
    try {
      const subfolder = type === 'THUMBNAIL' ? 'Miniaturas' : 'Imagenes';
      const motorRes = await fetch('http://127.0.0.1:8000/workspace/save_binary_file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64_data: b64Data,
          file_name: fileName,
          channel_name: channelName || null,
          subfolder,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (motorRes.ok) {
        const motorData = await motorRes.json();
        localPath = motorData.path || null;
        sizeBytes = motorData.sizeBytes || 0;
      }
    } catch (e) {
      console.warn('Motor no disponible para guardado local directo:', e);
    }

    if (!sizeBytes) sizeBytes = imageBuffer.length;

    // 3. Subir a Supabase Storage
    let storageUrl: string | null = null;
    try {
      const supabase = await createClient();
      const storagePath = `${user.id}/images/${timestamp}_${fileName}`;
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
      } else {
        console.warn('Supabase storage upload error:', uploadError.message);
      }
    } catch (e) {
      console.warn('Could not upload to Supabase storage:', e);
    }

    if (!storageUrl && imageUrl) {
      storageUrl = imageUrl;
    }

    // 4. Registrar en la base de datos (Prisma Asset)
    let resolvedChannelId: string | null = null;
    const isUuid = Boolean(channelId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId));
    if (isUuid) {
      resolvedChannelId = channelId;
    } else if (channelName || channelId) {
      try {
        const found = await db.channel.findFirst({
          where: {
            userId: user.id,
            name: channelName || channelId,
          },
          select: { id: true },
        });
        if (found) resolvedChannelId = found.id;
      } catch (e) {
        console.warn('Could not resolve channel ID:', e);
      }
    }

    const asset = await db.asset.create({
      data: {
        userId: user.id,
        channelId: resolvedChannelId,
        name: fileName,
        type: type || 'IMAGE',
        format: 'png',
        prompt: prompt.trim(),
        storageUrl: storageUrl || null,
        localPath: localPath || null,
        sizeBytes: BigInt(sizeBytes),
        metadata: {
          revisedPrompt,
          aspectRatio,
          dalleResolution: size,
          engine: 'dall-e-3',
        },
      },
      include: {
        channel: { select: { id: true, name: true } },
      },
    });

    // 5. Descuento atómico de créditos si usó llave del sistema
    let newBalance: number | null = null;
    if (isSystemKey && wallet && requiredCredits > 0) {
      try {
        const [updatedWallet] = await db.$transaction([
          db.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: requiredCredits } }
          }),
          db.creditConsumption.create({
            data: {
              walletId: wallet.id,
              creditsUsed: requiredCredits,
              serviceType: 'TOOL',
              modelName: 'dall-e-3',
              description: `Generación miniatura/imagen HD con DALL-E 3: ${fileName}`
            }
          })
        ]);
        newBalance = updatedWallet.balance;
      } catch (e: any) {
        console.warn('Error debiting DALL-E credits:', e.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Imagen generada y guardada exitosamente.',
      asset: {
        ...asset,
        sizeBytes: Number(asset.sizeBytes),
        channelName: asset.channel?.name || null,
      },
      revisedPrompt,
      newBalance
    });
  } catch (err: any) {
    console.error('Error in image generation:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno durante la generación de imagen' },
      { status: 500 }
    );
  }
}
