import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { getAuthUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isOrchestratorFreeForUser } from '@/lib/pricing-config';

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
    const { imageBase64, userIdea, userIntent, channelName, channelNiche, answers } = body;

    const ideaText = (userIdea || userIntent || '').trim();

    if (!imageBase64 && !ideaText) {
      return NextResponse.json(
        { error: 'Debes ingresar tu idea/temática o subir una imagen de referencia para que el asistente pueda ayudarte.' },
        { status: 400 }
      );
    }

    const { apiKey, isSystemKey } = await resolveOpenAiKey(user.id);

    // Obtener plan de suscripción del usuario
    const userWithSub = await db.user.findUnique({
      where: { id: user.id },
      include: { subscription: { include: { plan: true } } }
    });
    const userPlanName = userWithSub?.subscription?.plan?.name || 'FREE';

    // Determinar créditos requeridos para análisis con gpt-4o-mini
    let requiredCredits = 0;
    if (isSystemKey) {
      const isFree = isOrchestratorFreeForUser(userPlanName, 'gpt-4o-mini');
      requiredCredits = isFree ? 0 : 1; // 1 crédito para cuentas FREE, 0 para planes de pago
    }

    let wallet = null;
    if (isSystemKey && requiredCredits > 0) {
      wallet = await db.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet) {
        wallet = await db.wallet.create({ data: { userId: user.id, balance: 50 } });
      }

      if (wallet.balance < requiredCredits) {
        return NextResponse.json({
          error: `Has agotado tus créditos de prueba gratuita. Para continuar analizando y creando imágenes, suscríbete a un plan o añade créditos.`,
          requiresUpgrade: true
        }, { status: 402 });
      }
    }

    const systemPrompt = `Eres un Director de Arte y Co-pilot experto en Miniaturas de YouTube y Dirección Visual en AutoProd.
Tu misión es guiar al creador para construir una miniatura o arte visual de máximo impacto (alto CTR, excelente composición, iluminación dramática y estética profesional).

Debes responder SIEMPRE en formato JSON estricto con la siguiente estructura:
{
  "summary": "Resumen conciso (2 oraciones) de la dirección de arte propuesta.",
  "style": "Estilo visual recomendado (ej. Hiperrealismo cinematográfico 35mm, 3D Render Pixar/Disney, Cyberpunk oscuro, Fotografía documental, etc.)",
  "lighting": "Iluminación y atmósfera (ej. Luz dorada de borde con sombras profundas, Iluminación volumétrica de neón, etc.)",
  "palette": "Paleta cromática dominante (ej. Azul medianoche y ámbar contrastado, etc.)",
  "composition": "Encuadre y composición (ej. Primer plano con ángulo bajo, regla de tercios y fondo desenfocado bokeh)",
  "suggestedQuestions": [
    {
      "id": "q1",
      "question": "Pregunta 1 directa y contextual para aterrizar la visión del creador",
      "options": ["Opción A sugerida", "Opción B sugerida", "Opción C sugerida"]
    },
    {
      "id": "q2",
      "question": "Pregunta 2 sobre la emoción o el gancho visual clave",
      "options": ["Opción A sugerida", "Opción B sugerida", "Opción C sugerida"]
    }
  ],
  "draftPrompt": "Un prompt maestro en inglés ultra optimizado para DALL-E 3 que plasma esta dirección de arte con especificaciones técnicas (lente, iluminación, render, encuadre)."
}

Reglas:
- Si el usuario subió una imagen de referencia, analiza minuciosamente su estilo, iluminación y composición para trasladar esa vibra a su temática.
- Si el usuario NO subió imagen, conceptualiza la mejor escena visual basándote en su idea y el nicho de su canal.
- Si el usuario envió respuestas previas ("answers"), sintetízalas para perfeccionar el "draftPrompt" final y formula sugerencias de pulido o deja las preguntas vacías si ya está listo.
- Las opciones en "suggestedQuestions" deben ser cortas (2 a 5 palabras), concretas y atractivas para que el usuario pueda hacer clic y decidir rápidamente.`;

    let userPromptText = '';
    if (channelName || channelNiche) {
      userPromptText += `[Canal: ${channelName || 'Principal'}${channelNiche ? ` | Nicho: ${channelNiche}` : ''}]\n`;
    }

    if (ideaText) {
      userPromptText += `[Idea / Concepto del Creador]: "${ideaText}"\n`;
    }

    if (imageBase64) {
      userPromptText += `[Imagen de Referencia]: Se adjunta una imagen como inspiración visual de estilo/composición.\n`;
    }

    if (answers && Object.keys(answers).length > 0) {
      userPromptText += `[Respuestas del Creador a las preguntas previas]:\n`;
      Object.entries(answers).forEach(([key, val]) => {
        if (val) userPromptText += `- ${key}: ${val}\n`;
      });
      userPromptText += `\nPor favor sintetiza estas decisiones en el "draftPrompt" final para DALL-E 3.`;
    } else {
      userPromptText += `\nAnaliza la propuesta y genera el diagnóstico estético, 2 preguntas dinámicas con opciones de 1-clic para el creador y el borrador inicial de prompt maestro.`;
    }

    let messageContent: any;
    if (imageBase64) {
      const formattedImage = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;

      messageContent = [
        { type: 'text', text: userPromptText },
        {
          type: 'image_url',
          image_url: { url: formattedImage, detail: 'low' },
        },
      ];
    } else {
      messageContent = userPromptText;
    }

    const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: messageContent,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    if (!openAiRes.ok) {
      const err = await openAiRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error?.message || 'Error comunicándose con el asistente de OpenAI' },
        { status: 500 }
      );
    }

    const openAiData = await openAiRes.json();
    const content = openAiData.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || '{}');

    // Normalizar suggestedQuestions para soportar tanto objetos como strings
    if (Array.isArray(parsed.suggestedQuestions)) {
      parsed.suggestedQuestions = parsed.suggestedQuestions.map((q: any, idx: number) => {
        if (typeof q === 'string') {
          return {
            id: `q${idx + 1}`,
            question: q,
            options: ['Enfoque cinematográfico', 'Enfoque dramático y oscuro', 'Enfoque brillante y vibrante']
          };
        }
        return {
          id: q.id || `q${idx + 1}`,
          question: q.question || 'Pregunta de alineación',
          options: Array.isArray(q.options) ? q.options : []
        };
      });
    }

    // Descuento de créditos para usuarios FREE que usan la plataforma
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
              modelName: 'gpt-4o-mini',
              description: 'Asistencia de dirección de arte e imágenes con GPT-4o-mini'
            }
          })
        ]);
        newBalance = updatedWallet.balance;
      } catch (e: any) {
        console.warn('Error debiting analyze credits:', e.message);
      }
    }

    return NextResponse.json({
      success: true,
      analysis: parsed,
      newBalance
    });
  } catch (err: any) {
    console.error('Error in /api/images/analyze:', err);
    return NextResponse.json({ error: err.message || 'Error al procesar la solicitud con el asistente' }, { status: 500 });
  }
}
