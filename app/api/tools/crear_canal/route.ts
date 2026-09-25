import { NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { getWorkspacePath } from '@/harness/setup/detector';
import { PLANS_CONFIG } from '@/lib/pricing-config';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, ' - ').replace(/\s+/g, ' ').trim() || 'Nuevo_Canal';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      nombre_canal,
      nombre,
      channel_name,
      name,
      tematica,
      niche,
      nicho,
      tema,
      contexto_del_usuario,
      description,
      estilo_tono,
      estilo,
      tono,
      style,
      audiencia,
      publico_objetivo,
      audience,
      _userContext
    } = body;

    const rawName = (nombre_canal || nombre || channel_name || name || '').trim();
    if (!rawName) {
      return NextResponse.json({ error: 'El nombre del canal es obligatorio.' }, { status: 400 });
    }

    const cleanChannelName = sanitizeFolderName(rawName);
    const channelNiche = (tematica || niche || nicho || tema || contexto_del_usuario || description || cleanChannelName).trim();
    const channelTone = (estilo_tono || estilo || tono || style || 'Cercano, profesional y enfocado en aportar valor al creador').trim();
    const channelAudience = (audiencia || publico_objetivo || audience || 'Público interesado en la temática del canal').trim();

    let userId = _userContext?.id || _userContext?.userId;
    if (!userId) {
      try {
        const { createClient: createServerClient } = require('@/lib/supabase/server');
        const supabaseServer = await createServerClient();
        const { data: authData } = await supabaseServer.auth.getUser();
        userId = authData?.user?.id;
      } catch (authErr: any) {
        console.warn('[Tool/crear_canal] Auth fallback warning:', authErr?.message);
      }
    }

    // ──────────────────────────────────────────────
    // 1. Validar Límites de Suscripción del Usuario (si hay usuario autenticado)
    // ──────────────────────────────────────────────
    let userPlan = 'FREE';
    let planConfig = PLANS_CONFIG.FREE;
    let maxChannels = 1;
    let existingChannel: any = null;

    if (userId) {
      const dbUser = await db.user.findUnique({
        where: { id: userId },
        include: {
          subscription: {
            include: {
              plan: {
                include: { limits: true }
              }
            }
          }
        }
      });

      userPlan = (dbUser?.subscription?.plan?.name as 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE') || 'FREE';
      planConfig = PLANS_CONFIG[userPlan as keyof typeof PLANS_CONFIG] || PLANS_CONFIG.FREE;
      maxChannels = dbUser?.role === 'ADMIN' ? 9999 : (dbUser?.subscription?.plan?.limits?.maxChannels ?? planConfig.maxChannels);

      // Comprobar si el canal ya existe para este usuario (por nombre insensible a mayúsculas)
      existingChannel = await db.channel.findFirst({
        where: {
          userId,
          name: { equals: cleanChannelName, mode: 'insensitive' }
        }
      });

      const currentChannelsCount = await db.channel.count({
        where: { userId }
      });

      if (!existingChannel && currentChannelsCount >= maxChannels) {
        return NextResponse.json({
          error: 'LIMIT_REACHED',
          code: 'MAX_CHANNELS_REACHED',
          currentCount: currentChannelsCount,
          maxAllowed: maxChannels,
          userPlan,
          message: `Has alcanzado el límite máximo de ${maxChannels} canal(es) de tu plan actual (${planConfig.displayName}). Actualiza a Pro o Enterprise para gestionar más canales simultáneos.`
        }, { status: 403 });
      }
    }

    // ──────────────────────────────────────────────
    // 2. Resolver Ruta Física en Workspace
    // ──────────────────────────────────────────────
    const workspaceRoot = _userContext?.workspacePath || getWorkspacePath() || process.cwd();
    const channelFolderPath = path.join(/*turbopackIgnore: true*/ workspaceRoot, cleanChannelName);
    const channelLocalPath = channelFolderPath.replace(/\\/g, '/');
    const infoCanalFolderPath = path.join(channelFolderPath, 'InfoCanal');

    // ──────────────────────────────────────────────
    // 3. Crear Físicamente la Estructura en Disco
    // ──────────────────────────────────────────────
    await fs.mkdir(channelFolderPath, { recursive: true });
    await fs.mkdir(infoCanalFolderPath, { recursive: true });

    // ──────────────────────────────────────────────
    // 3. Registrar o Actualizar en Base de Datos (Prisma & Supabase)
    // ──────────────────────────────────────────────
    let channelRecord;
    if (existingChannel) {
      channelRecord = await db.channel.update({
        where: { id: existingChannel.id },
        data: {
          localPath: channelLocalPath,
          niche: channelNiche,
          folderStatus: 'CREATED',
        }
      });
    } else {
      channelRecord = await db.channel.create({
        data: {
          userId,
          name: cleanChannelName,
          localPath: channelLocalPath,
          niche: channelNiche,
          folderStatus: 'CREATED',
        }
      });
    }

    const supabase = getSupabaseClient();
    try {
      await supabase.from('channelContext').upsert({
        channelId: channelRecord.id,
        userId,
        channelUrl: `local://${encodeURIComponent(cleanChannelName)}`,
        title: cleanChannelName,
        description: `Canal enfocado en: ${channelNiche}. Tono: ${channelTone}. Audiencia: ${channelAudience}.`,
        contextSummary: `Canal temático: "${cleanChannelName}". Nicho: ${channelNiche}. Audiencia: ${channelAudience}. Estilo: ${channelTone}.`,
        updatedAt: new Date().toISOString()
      }, { onConflict: 'channelId' });
    } catch (ctxErr) {
      console.warn('[CrearCanal] Advertencia al actualizar channelContext:', ctxErr);
    }

    // ──────────────────────────────────────────────
    // 4. Crear Físicamente la Estructura en Disco
    // ──────────────────────────────────────────────
    const guionesFolder = path.join(channelFolderPath, 'Guiones');
    const videosFolder = path.join(channelFolderPath, 'Videos');
    const miniaturaFolder = path.join(channelFolderPath, 'Miniatura');
    const musicaFolder = path.join(channelFolderPath, 'Musica');
    const imagenesFolder = path.join(channelFolderPath, 'Imagenes');

    await fs.mkdir(infoCanalFolderPath, { recursive: true });
    await fs.mkdir(guionesFolder, { recursive: true });
    await fs.mkdir(videosFolder, { recursive: true });
    await fs.mkdir(miniaturaFolder, { recursive: true });
    await fs.mkdir(musicaFolder, { recursive: true });
    await fs.mkdir(imagenesFolder, { recursive: true });

    // 5. Generar los 4 Archivos de Memoria Canónica en InfoCanal/
    const contextoContent = `# 🧠 Contexto y ADN del Canal — ${cleanChannelName}

## 📌 Visión y Propuesta de Valor
- **Canal:** ${cleanChannelName}
- **Nicho Principal:** ${channelNiche}
- **Público Objetivo:** ${channelAudience}
- **Tono y Estilo:** ${channelTone}

---

## 🎯 Pilares Editoriales y Enfoque de Contenido
1. **Intención:** Crear contenido estructurado que aporte valor genuino a la audiencia.
2. **Identidad:** Respetar la voz y el estilo definidos sin recurrir a clichés ni marketing agresivo.
3. **Calidad:** Cuidar la coherencia temática en cada video para construir autoridad y audiencia recurrente.

---

## 🧭 Directivas de Producción para el Orquestador
- Consultar siempre este documento antes de planificar un nuevo video.
- Mantener las propuestas de títulos y guiones 100% alineadas con la audiencia: *${channelAudience}*.
- Utilizar las subcarpetas estándar: \`Guiones/\`, \`Videos/\`, \`Miniatura/\`, \`Musica/\`, \`Imagenes/\`.
`;

    const metricasContent = `# 📊 Métricas y Pilares Temáticos — ${cleanChannelName}

## 🏷️ Palabras Clave y Etiquetas Principales de Nicho
- ${channelNiche}
- ${cleanChannelName.toLowerCase()}
- contenido de valor
- producción audiovisual

---

## 📈 Objetivos de Rendimiento
- **Retención Promedio:** Superar el 50% de retención en los primeros 30 segundos.
- **Frecuencia:** Publicación constante y predecible.
- **Diferenciación:** Tratar temas con ángulos originales evitando repetir fórmulas agotadas.

*(Este archivo se actualizará automáticamente a medida que produzcas y analices nuevos videos en AutoProd).*
`;

    const historialContent = `# 📜 Historial de Producción — ${cleanChannelName}

> **Registro de temas ya cubiertos:** Este documento sirve como memoria histórica para que el Orquestador y el creador **NUNCA** repitan un tema, título o ángulo ya producido.

| # | Título del Video | Fecha de Planificación | Estado |
|---|---|---|---|
| — | *(Aún no hay videos registrados. Planifica tu primer video con el orquestador)* | — | — |
`;

    const brandingContent = `# 🎨 Guía de Branding y Recursos Visuales — ${cleanChannelName}

Directivas estéticas para los elementos gráficos del canal (archivos a ubicar en \`InfoCanal/\`):

1. **\`logo.jpg\` (Avatar de Perfil):**
   - **Formato:** 1:1 Cuadrado (800 x 800 px).
   - **Diseño sugerido:** Icono distintivo o símbolo memorable que represente el nicho: *${channelNiche}*.
   - **Paleta recomendada:** Colores contrastantes y limpios, legibles en formato circular móvil.

2. **\`banner.jpg\` (Encabezado de YouTube):**
   - **Formato:** 16:9 Panorámico (2560 x 1440 px).
   - **Diseño sugerido:** Composición horizontal con área segura central de 1546 x 423 px.
   - **Contenido:** Nombre del canal, propuesta de valor clara y estilo visual: *${channelTone}*.

3. **\`marca_de_agua.jpg\` (Botón de Suscripción):**
   - **Formato:** 1:1 Cuadrado (150 x 150 px).
   - **Diseño:** Botón gráfico limpio para la esquina inferior derecha de cada render audiovisual.
`;

    const plantillaGuionContent = `# 📝 Plantilla de Guion — ${cleanChannelName}

## 🎣 Gancho Inicial (0:00 - 0:30)
- Planteamiento del problema principal y qué descubrirá el espectador.

## 📖 Desarrollo Principal (0:30 - 7:00)
- **Punto 1:** Concepto clave y contexto
- **Punto 2:** Ejemplo práctico, demostración o historia
- **Punto 3:** Conclusión accionable

## 🚀 Llamado a la Acción y Cierre (7:00 - 8:00)
- Pregunta detonante para comentarios y despedida.
`;

    const plantillaMiniaturaContent = `# 🖼️ Conceptos e Ideas de Miniaturas — ${cleanChannelName}

- **Idea 1:** Sujeto con expresión marcada + elemento central de contraste.
- **Tipografía:** Máximo 3 palabras grandes y legibles en formato móvil.
- **Esquema de color:** Colores de acento vivos sobre fondo con viñeta oscura.
`;

    const pathContexto = path.join(infoCanalFolderPath, 'Contexto_canal.md');
    const pathMetricas = path.join(infoCanalFolderPath, 'Metricas_canal.md');
    const pathHistorial = path.join(infoCanalFolderPath, 'Historial_canal.md');
    const pathBranding = path.join(infoCanalFolderPath, 'Branding_canal.md');
    const pathGuion = path.join(guionesFolder, 'Plantilla_Guion.md');
    const pathMiniatura = path.join(miniaturaFolder, 'Ideas_Miniaturas.md');
    const pathVideosReadme = path.join(videosFolder, 'README.md');
    const pathMusicaReadme = path.join(musicaFolder, 'README.md');
    const pathImagenesReadme = path.join(imagenesFolder, 'README.md');

    await fs.writeFile(pathContexto, contextoContent, 'utf-8');
    await fs.writeFile(pathMetricas, metricasContent, 'utf-8');
    await fs.writeFile(pathHistorial, historialContent, 'utf-8');
    await fs.writeFile(pathBranding, brandingContent, 'utf-8');
    await fs.writeFile(pathGuion, plantillaGuionContent, 'utf-8');
    await fs.writeFile(pathMiniatura, plantillaMiniaturaContent, 'utf-8');
    await fs.writeFile(pathVideosReadme, `# Videos y Clips (${cleanChannelName})\nAlmacena aquí el metraje bruto, tomas y renders finales.\n`, 'utf-8');
    await fs.writeFile(pathMusicaReadme, `# Pistas de Música (${cleanChannelName})\nPistas de audio de fondo libres de copyright.\n`, 'utf-8');
    await fs.writeFile(pathImagenesReadme, `# Recursos Visuales e Imágenes (${cleanChannelName})\nBanners, capturas y miniaturas generadas con IA.\n`, 'utf-8');

    return NextResponse.json({
      status: 'success',
      channel: {
        id: channelRecord.id,
        name: channelRecord.name,
        localPath: channelLocalPath,
        niche: channelRecord.niche,
        folderStatus: channelRecord.folderStatus,
      },
      infoCanalPath: infoCanalFolderPath,
      filesCreated: [
        'InfoCanal/Contexto_canal.md',
        'InfoCanal/Metricas_canal.md',
        'InfoCanal/Historial_canal.md',
        'InfoCanal/Branding_canal.md',
        'Guiones/Plantilla_Guion.md',
        'Miniatura/Ideas_Miniaturas.md',
      ],
      message: `Canal "${cleanChannelName}" creado e inicializado exitosamente en ${channelLocalPath} con su estructura modular completa (InfoCanal, Guiones, Videos, Miniatura, Musica, Imagenes) y plantillas Markdown.`
    });

  } catch (error: any) {
    console.error('[Error crear_canal]:', error);
    return NextResponse.json({ error: error.message || 'Error interno al crear el canal' }, { status: 500 });
  }
}
