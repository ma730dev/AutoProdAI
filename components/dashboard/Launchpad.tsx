'use client';

import { Language } from '@/app/translations';
import { toast } from 'sonner';

interface Props {
  lang: Language;
  onSelect: (role: 'channel' | 'video' | 'script' | 'prompt' | 'import_channel') => void;
  onSelectLooper?: () => void;
  onSelectSubtitles?: () => void;
  onSelectTTS?: () => void;
  onSelectAssets?: () => void;
  onSelectImages?: () => void;
  motorStatus?: boolean;
  workspacePath?: string | null;
  channelsCount?: number;
  onLinkWorkspace?: () => void;
}

interface Card {
  role: 'channel' | 'video' | 'script' | 'prompt' | 'import_channel';
  icon: string;
  labelEs: string;
  labelEn: string;
  descEs: string;
  descEn: string;
  color: 'purple' | 'indigo';
  badge: string;
}

const ACTIVE_CARDS: Card[] = [
  {
    role: 'import_channel',
    icon: '📥',
    labelEs: 'Analizar Canal de YouTube',
    labelEn: 'Analyze YouTube Channel',
    descEs: 'Investiga títulos y temas exitosos de un canal para inspirar nuevos contenidos y evitar repetir ideas.',
    descEn: 'Analyze high-performing video topics and tags to inspire fresh ideas and avoid duplicates.',
    color: 'indigo',
    badge: 'ESTRATEGIA SEO',
  },
  {
    role: 'channel',
    icon: '📺',
    labelEs: 'Crear Nuevo Canal',
    labelEn: 'Create New Channel',
    descEs: 'Crea el espacio de trabajo para un nuevo canal de YouTube con memoria de estilo y tono.',
    descEn: 'Set up a new workspace for a YouTube channel with audience, style, and tone memory.',
    color: 'purple',
    badge: 'IDENTIDAD DEL CANAL',
  },
  {
    role: 'video',
    icon: '🎬',
    labelEs: 'Nuevo Proyecto de Video',
    labelEn: 'New Video Project',
    descEs: 'Crea una carpeta de proyecto con todo organizado: guion, metraje, música y miniatura.',
    descEn: 'Set up a dedicated project folder: script, footage, music, and thumbnail ready.',
    color: 'purple',
    badge: 'PRODUCCIÓN',
  },
  {
    role: 'script',
    icon: '📔',
    labelEs: 'Redactor de Guiones IA',
    labelEn: 'AI Scriptwriter',
    descEs: 'Redacta guiones estructurados con ganchos de alta retención para mantener a la audiencia mirando.',
    descEn: 'Draft structured video scripts with strong hooks to maximize viewer retention.',
    color: 'purple',
    badge: 'ALTA RETENCIÓN',
  },
  {
    role: 'prompt',
    icon: '✨',
    labelEs: 'Plantillas de Producción',
    labelEn: 'Production Templates',
    descEs: 'Utiliza directivas y fórmulas probadas para generar contenidos consistentes en cada video.',
    descEn: 'Use proven production formulas and prompts to keep high consistency across your videos.',
    color: 'indigo',
    badge: 'FÓRMULAS PROBADAS',
  },
];

export default function Launchpad({
  lang,
  onSelect,
  onSelectLooper,
  onSelectSubtitles,
  onSelectTTS,
  onSelectAssets,
  onSelectImages,
  motorStatus = false,
  workspacePath = null,
  channelsCount = 0,
  onLinkWorkspace,
}: Props) {
  return (
    <div className="h-full overflow-y-auto minimal-scrollbar p-6 flex flex-col justify-start items-center w-full gap-6">
      
      {/* Top Welcome / System Status Banner */}
      <div className="max-w-5xl w-full bg-[#14141a]/80 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <h2 className="text-lg font-black text-white tracking-tight">
              {lang === 'es' ? 'Centro de Creación de Contenido' : 'Content Creation Hub'}
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold uppercase">
              AutoProd Studio
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {lang === 'es'
              ? 'Selecciona una herramienta para comenzar o pídele al asistente que prepare tu próximo video.'
              : 'Pick a creation tool to get started or ask the assistant to outline your next video.'}
          </p>
        </div>

        {/* Quick Diagnostic Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className={`px-3 py-1 rounded-lg border flex items-center gap-2 ${
            motorStatus 
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 font-semibold' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${motorStatus ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
            <span>{motorStatus ? (lang === 'es' ? 'Motor Listo' : 'Engine Ready') : (lang === 'es' ? 'Modo Nube' : 'Cloud Mode')}</span>
          </div>

          <div 
            onClick={onLinkWorkspace}
            className="px-3 py-1 rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-white hover:border-zinc-700 cursor-pointer flex items-center gap-1.5 transition-colors"
            title={workspacePath ? `Ruta: ${workspacePath}` : 'Haz clic para vincular carpeta de trabajo'}
          >
            <span>📁</span>
            <span className="truncate max-w-[160px]">
              {workspacePath ? workspacePath.split(/[\\/]/).pop() || 'Proyectos' : (lang === 'es' ? 'Carpeta de Proyectos' : 'Projects Folder')}
            </span>
          </div>

          <div className="px-3 py-1 rounded-lg border border-purple-800/40 bg-purple-950/30 text-purple-300 font-bold">
            📺 {channelsCount} {lang === 'es' ? 'Canal(es)' : 'Channel(s)'}
          </div>
        </div>
      </div>

      {/* Main Specialized Creation Studios */}
      <div className="max-w-5xl w-full space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <span>✨</span>
            <span>{lang === 'es' ? 'Estudios de Creación de Video' : 'Video Creation Studios'}</span>
          </h3>
          <span className="text-[10px] text-zinc-500">
            {lang === 'es' ? 'Acelerado por hardware local' : 'Hardware-accelerated local tools'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Video Studio & Editor */}
          <button
            onClick={onSelectLooper}
            className="h-44 text-left bg-gradient-to-b from-[#181822] to-[#121217] border border-purple-500/30 hover:border-purple-500/80 rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] transition-all group shadow-lg cursor-pointer relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-xl text-purple-300 group-hover:scale-110 transition-transform">
                🎬
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                {lang === 'es' ? 'EDITOR PRO' : 'PRO EDITOR'}
              </span>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                {lang === 'es' ? 'Video Studio & Editor' : 'Video Studio & Editor'}
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
                {lang === 'es'
                  ? 'Montaje en pistas, recorte de clips, pistas de música, bucles infinitos y exportación acelerada.'
                  : 'Multi-track timeline, clip trimming, music tracks, seamless loops and GPU-accelerated export.'}
              </p>
            </div>
          </button>

          {/* Locución & TTS Studio */}
          <button
            onClick={onSelectTTS ? onSelectTTS : () => toast.info(lang === 'es' ? 'Locución Text-to-Speech' : 'Voiceover TTS')}
            className="h-44 text-left bg-gradient-to-b from-[#1b1420] to-[#140e18] border border-purple-500/30 hover:border-purple-500/80 rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] transition-all group shadow-lg cursor-pointer relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-xl text-purple-300 group-hover:scale-110 transition-transform">
                🎙️
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                MULTI-MOTOR
              </span>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                {lang === 'es' ? 'Locución & Voz en Off' : 'Voiceover & Speech'}
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
                {lang === 'es'
                  ? 'Convierte tus guiones en audio con opción gratuita ilimitada o voces premium de OpenAI.'
                  : 'Synthesize your scripts into audio with unlimited free tier or premium OpenAI voices.'}
              </p>
            </div>
          </button>

          {/* Subtitulador Whisper Studio */}
          <button
            onClick={onSelectSubtitles ? onSelectSubtitles : () => toast.info(lang === 'es' ? 'Subtitulado automático' : 'Auto subtitles')}
            className="h-44 text-left bg-gradient-to-b from-[#141b18] to-[#101513] border border-emerald-500/30 hover:border-emerald-500/80 rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] transition-all group shadow-lg cursor-pointer relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-xl text-emerald-300 group-hover:scale-110 transition-transform">
                🎧
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                SINCRONIZADO
              </span>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                {lang === 'es' ? 'Subtítulos Automáticos' : 'Auto Subtitles'}
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
                {lang === 'es'
                  ? 'Subtítulos palabra por palabra con estilo dinámico listos para exportar a CapCut o Premiere.'
                  : 'Word-by-word dynamic captions ready to export directly into CapCut or Premiere.'}
              </p>
            </div>
          </button>

          {/* Image & Thumbnail Studio */}
          <button
            onClick={onSelectImages}
            className="h-44 text-left bg-gradient-to-b from-[#1a1722] to-[#121118] border border-indigo-500/30 hover:border-indigo-500/80 rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] transition-all group shadow-lg cursor-pointer relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-xl text-indigo-300 group-hover:scale-110 transition-transform">
                🎯
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                ALTO CTR
              </span>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                {lang === 'es' ? 'Portadas y Miniaturas' : 'Thumbnails & Covers'}
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
                {lang === 'es'
                  ? 'Diseña miniaturas llamativas en 16:9 clásica o 9:16 Shorts que destacan en el feed de YouTube.'
                  : 'Design eye-catching thumbnails in 16:9 and 9:16 Shorts format to maximize clicks.'}
              </p>
            </div>
          </button>

          {/* Asset Resource Library */}
          <button
            onClick={onSelectAssets}
            className="h-44 text-left bg-gradient-to-b from-[#131922] to-[#0f141a] border border-cyan-500/30 hover:border-cyan-500/80 rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] transition-all group shadow-lg cursor-pointer relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-xl text-cyan-300 group-hover:scale-110 transition-transform">
                🗂️
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                RECURSOS
              </span>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                {lang === 'es' ? 'Biblioteca de Recursos' : 'Asset Media Hub'}
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
                {lang === 'es'
                  ? 'Guarda pistas de música, efectos de sonido y fondos visuales organizados por canal.'
                  : 'Keep your music tracks, sound effects, and visual clips organized by channel.'}
              </p>
            </div>
          </button>

        </div>
      </div>

      {/* Production Automation Actions (Agente & Orquestador) */}
      <div className="max-w-5xl w-full space-y-3 pb-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <span>💡</span>
            <span>{lang === 'es' ? 'Acciones Rápidas con el Asistente' : 'Quick Assistant Actions'}</span>
          </h3>
          <span className="text-[10px] text-zinc-500">Planificación de Contenido</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ACTIVE_CARDS.map(card => (
            <button
              key={card.role}
              onClick={() => onSelect(card.role)}
              className="h-36 text-left bg-[#15151b]/70 border border-zinc-800 hover:border-purple-500/40 hover:bg-[#181822] rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-md cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-lg group-hover:scale-110 transition-transform ${
                  card.color === 'indigo'
                    ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400'
                    : 'bg-purple-600/10 border border-purple-500/20 text-purple-400'
                }`}>
                  {card.icon}
                </div>
                <span className="text-[8px] px-2 py-0.5 rounded bg-black/40 border border-zinc-800 text-zinc-400 font-bold">
                  {card.badge}
                </span>
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                  {lang === 'es' ? card.labelEs : card.labelEn}
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                  {lang === 'es' ? card.descEs : card.descEn}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
