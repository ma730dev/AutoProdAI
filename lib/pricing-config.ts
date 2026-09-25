// ─────────────────────────────────────────────────────────────────────────────
// AutoProd Pricing & Token Economics Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanConfig {
  id: string;
  name: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  displayName: string;
  priceUsd: number;
  tokenBudgetUsd: number; // Porción del precio destinada a consumo de IA
  maxChannels: number;
  maxVideosPerChannel: number;
  canRenderInCloud: boolean;
  hasAdvancedTemplates: boolean;
  canDownloadLocalMotor: boolean; // Gating de descarga e instalación del motor local
  whisperCloudMinutes: number;
  badge?: string;
  features: string[];
}

export const DEFAULT_PLATFORM_FEE_PERCENT = 10; // 10% de comisión AutoProd sobre tokens
export const CREDITS_PER_USD = 100; // 1 USD = 100 Créditos AutoProd (1 crédito = $0.01 USD)

export const PLANS_CONFIG: Record<'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE', PlanConfig> = {
  FREE: {
    id: 'free',
    name: 'FREE',
    displayName: 'Prueba Gratuita',
    priceUsd: 0,
    tokenBudgetUsd: 0.5, // 50 créditos de cortesía
    maxChannels: 1,
    maxVideosPerChannel: 5,
    canRenderInCloud: false,
    hasAdvancedTemplates: false,
    canDownloadLocalMotor: true,
    whisperCloudMinutes: 0,
    features: [
      '50 créditos iniciales para miniaturas y herramientas pesadas',
      '1 Canal de YouTube para pruebas',
      'AutoProd Brain™ (Copiloto de Prueba - Chat Base Gratuito con Rate Limiting)',
      '⚡ Descarga del Motor Local AutoProd (Render y gestión en tu PC)',
      'Video Looper Web hasta 720p (10 min)',
      'Soporte por documentación',
    ],
  },
  STARTER: {
    id: 'starter',
    name: 'STARTER',
    displayName: 'Plan Básico (Basic)',
    priceUsd: 70,
    tokenBudgetUsd: 20, // Con 10% de comisión: $18 netos = 1,800 créditos
    maxChannels: 3, // Hasta 3 canales profesionales
    maxVideosPerChannel: 50,
    canRenderInCloud: true,
    hasAdvancedTemplates: false,
    canDownloadLocalMotor: true,
    whisperCloudMinutes: 60,
    badge: 'Ideal Creadores',
    features: [
      'AutoProd Brain™ (Cerebro Autónomo 24/7): 100% GRATIS e ILIMITADO',
      '⚡ Descarga del Motor Local AutoProd (Render GPU/CPU offline en tu PC)',
      'Hasta 3 Canales de YouTube Profesionales (Totalmente automatizados)',
      'Bolsa mensual de 1,800 créditos de IA para modelos pesados y render',
      'Video Looper Studio hasta 1080p (1 hora)',
      'Whisper Local GPU/CPU sin límite + 60 min Cloud Whisper',
      'Exportación SRT / ASS compatible con CapCut',
      'Subida manual guiada a YouTube API v3',
      'Soporte estándar por correo',
    ],
  },
  PRO: {
    id: 'pro',
    name: 'PRO',
    displayName: 'Plan Pro',
    priceUsd: 100,
    tokenBudgetUsd: 30, // Con 10% de comisión: $27 netos = 2,700 créditos
    maxChannels: 7, // Hasta 7 canales simultáneos
    maxVideosPerChannel: 200,
    canRenderInCloud: true,
    hasAdvancedTemplates: true,
    canDownloadLocalMotor: true,
    whisperCloudMinutes: 180,
    badge: '🔥 MÁS POPULAR',
    features: [
      'AutoProd Brain™ (Cerebro Autónomo 24/7): 100% GRATIS e ILIMITADO',
      '⚡ Motor Local AutoProd Completo: Aceleración GPU CUDA y procesamiento local',
      'Hasta 7 Canales de YouTube simultáneos (Multi-nicho)',
      'Bolsa mensual de 2,700 créditos de IA para modelos pesados y render',
      'Video Looper Studio 4K (3 horas) + Batch Looper',
      'Modo Carpeta Canciones (Whisper Masivo Local/Cloud)',
      'Exportación con estilos para Premiere, DaVinci y CapCut',
      'Memoria Vectorial Semántica de canal activa',
      'Subida y programación automática con YouTube API v3',
      'Soporte prioritario vía WhatsApp / Discord',
    ],
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'ENTERPRISE',
    displayName: 'Plan Enterprise',
    priceUsd: 150,
    tokenBudgetUsd: 50, // Con 10% de comisión: $45 netos = 4,500 créditos
    maxChannels: 9999, // Canales ilimitados
    maxVideosPerChannel: 9999,
    canRenderInCloud: true,
    hasAdvancedTemplates: true,
    canDownloadLocalMotor: true,
    whisperCloudMinutes: 500,
    badge: '👑 MÁXIMA POTENCIA',
    features: [
      'AutoProd Brain™ (Cerebro Autónomo 24/7): 100% GRATIS e ILIMITADO',
      '⚡ Motor Local AutoProd Enterprise: Rendimiento extremo y render sin compresión',
      'Canales de YouTube ILIMITADOS (Redes de automatización masiva)',
      'Bolsa mensual de 4,500 créditos de IA para modelos pesados y render',
      'Video Looper 4K 60fps sin compresión + Pre-render background',
      'Whisper Studio masivo ilimitado local + 500 min Cloud',
      'Swarm de agentes autónomos continuos + Prompts VIP',
      'Embeddings vectoriales ilimitados por canal',
      'Publicación y automatización masiva programada',
      'Soporte VIP 1 a 1 y Onboarding asistido',
    ],
  },
};

/**
 * Calcula la bolsa de créditos netos para un plan aplicando la comisión de plataforma.
 */
export function calculatePlanCredits(
  tokenBudgetUsd: number,
  feePercent: number = DEFAULT_PLATFORM_FEE_PERCENT,
  creditsPerUsd: number = CREDITS_PER_USD
) {
  const feeAmountUsd = Number((tokenBudgetUsd * (feePercent / 100)).toFixed(2));
  const netTokenUsd = Number((tokenBudgetUsd - feeAmountUsd).toFixed(2));
  const creditsToGrant = Math.round(netTokenUsd * creditsPerUsd);
  return { feeAmountUsd, netTokenUsd, creditsToGrant };
}

/**
 * Determina si el orquestador base es gratuito para este usuario según su plan y modelo.
 * Regla de negocio:
 * - El orquestador base (gpt-4o-mini, gemini-1.5-flash o default) es 100% GRATIS (0 créditos) para todos los usuarios
 *   (incluyendo cuentas FREE, protegido con Rate Limiting de ráfaga y cuota diaria).
 * - Los modelos pesados (gpt-4o, claude-3-5-sonnet, gemini-1.5-pro) y herramientas pesadas (DALL-E 3, Whisper Cloud)
 *   consumen créditos de la billetera.
 */
export function isOrchestratorFreeForUser(
  userPlanName: string | null | undefined,
  modelName: string | null | undefined
): boolean {
  const cleanModel = (modelName || '').toLowerCase().trim();
  const isBaseOrchestrator = !cleanModel || cleanModel === 'default' || cleanModel === 'gpt-4o-mini' || cleanModel === 'gemini-1.5-flash';
  
  if (isBaseOrchestrator) {
    return true; // Gratuito para todos para que los créditos de prueba se usen en outputs reales (miniaturas, audio, etc.)
  }

  return false; // Modelos pesados (gpt-4o, claude, etc.) descuentan créditos
}

export const DEFAULT_SERVICE_PRICING = [
  {
    serviceType: 'CHAT',
    modelName: 'gpt-4o-mini',
    costPerUnit: 0, // Orquestador base 100% gratuito (protegido con Rate Limit)
    unitType: 'PER_REQUEST',
    description: 'Orquestador Base (Gratuito para todos los planes con Rate Limiting)',
  },
  {
    serviceType: 'CHAT',
    modelName: 'gemini-1.5-flash',
    costPerUnit: 0, // Flash rápido gratuito
    unitType: 'PER_REQUEST',
    description: 'Google Gemini Flash para respuestas ultra rápidas (Gratuito)',
  },

  {
    serviceType: 'CHAT',
    modelName: 'gpt-4o',
    costPerUnit: 3,
    unitType: 'PER_REQUEST',
    description: 'ChatGPT 4o Razonamiento y Redacción Avanzada',
  },
  {
    serviceType: 'CHAT',
    modelName: 'claude-3-5-sonnet',
    costPerUnit: 4,
    unitType: 'PER_REQUEST',
    description: 'Anthropic Claude 3.5 Sonnet Nivel Maestro',
  },
  {
    serviceType: 'CHAT',
    modelName: 'gemini-1.5-pro',
    costPerUnit: 3,
    unitType: 'PER_REQUEST',
    description: 'Google Gemini Pro con Pensamiento Profundo',
  },
  {
    serviceType: 'TOOL',
    modelName: 'whisper-1',
    costPerUnit: 1,
    unitType: 'PER_MINUTE',
    description: 'Transcripción Whisper en la Nube (1 crédito por minuto de audio)',
  },
  {
    serviceType: 'TOOL',
    modelName: 'dall-e-3',
    costPerUnit: 5,
    unitType: 'PER_REQUEST',
    description: 'Generación de Miniatura / Arte con DALL-E 3',
  },
];
