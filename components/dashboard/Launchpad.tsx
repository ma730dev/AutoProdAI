'use client';

import { Language } from '@/app/translations';
import { toast } from 'sonner';

interface Props {
  lang: Language;
  onSelect?: (role: 'channel' | 'video' | 'script' | 'prompt' | 'import_channel') => void;
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

export default function Launchpad({
  lang,
  onSelectLooper,
  onSelectSubtitles,
  onSelectTTS,
  onSelectAssets,
  onSelectImages,
}: Props) {
  return (
    <div className="h-full overflow-y-auto minimal-scrollbar p-6 md:p-10 flex flex-col justify-start items-center w-full gap-8">

      {/* ── Encabezado Tipográfico Ultra-Limpio ── */}
      <div className="max-w-5xl w-full flex flex-col gap-1.5 text-left pt-2">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          {lang === 'es' ? '¿Qué deseas crear hoy?' : 'What would you like to create today?'}
        </h1>
        <p className="text-xs md:text-sm text-zinc-400 max-w-xl leading-relaxed">
          {lang === 'es'
            ? 'Selecciona un estudio de producción para comenzar o continúa editando los recursos de tus canales.'
            : 'Select a production studio to get started or continue editing your channel resources.'}
        </p>
      </div>

      {/* ── Las 5 Herramientas en Cuadrícula Homogénea ── */}
      <div className="max-w-5xl w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 pb-12">

        {/* 1. Video Studio & Editor */}
        <button
          onClick={onSelectLooper}
          className="h-56 text-left bg-[#131318]/90 hover:bg-[#181822] border border-zinc-800/80 hover:border-purple-500/70 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-950/20 group cursor-pointer relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div className="h-10 w-10 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-xl text-purple-300 group-hover:scale-110 transition-transform">
              🎬
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25 font-bold uppercase tracking-wider">
              {lang === 'es' ? 'Editor Pro' : 'Pro Editor'}
            </span>
          </div>
          <div className="space-y-1 mt-auto">
            <h3 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
              {lang === 'es' ? 'Video Studio' : 'Video Studio'}
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
              {lang === 'es'
                ? 'Montaje en pistas, recorte de clips, pistas de música, bucles y exportación acelerada.'
                : 'Multi-track timeline, clip trimming, music tracks, loops and GPU-accelerated export.'}
            </p>
          </div>
          <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-500 group-hover:text-purple-300 font-medium transition-colors">
            <span>{lang === 'es' ? 'Abrir estudio' : 'Open studio'}</span>
            <span className="transition-transform group-hover:translate-x-0.5">➔</span>
          </div>
        </button>

        {/* 2. Locución & Voz en Off */}
        <button
          onClick={onSelectTTS ? onSelectTTS : () => toast.info(lang === 'es' ? 'Locución Text-to-Speech' : 'Voiceover TTS')}
          className="h-56 text-left bg-[#131318]/90 hover:bg-[#181822] border border-zinc-800/80 hover:border-purple-500/70 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-950/20 group cursor-pointer relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div className="h-10 w-10 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-xl text-purple-300 group-hover:scale-110 transition-transform">
              🎙️
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25 font-bold uppercase tracking-wider">
              {lang === 'es' ? 'Voz en Off' : 'Voiceover'}
            </span>
          </div>
          <div className="space-y-1 mt-auto">
            <h3 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
              {lang === 'es' ? 'Locución TTS' : 'TTS Voiceover'}
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
              {lang === 'es'
                ? 'Convierte tus guiones en audio con síntesis vocal ilimitada o voces de alta fidelidad.'
                : 'Convert your scripts into speech with unlimited local synthesis or high-fidelity voices.'}
            </p>
          </div>
          <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-500 group-hover:text-purple-300 font-medium transition-colors">
            <span>{lang === 'es' ? 'Abrir estudio' : 'Open studio'}</span>
            <span className="transition-transform group-hover:translate-x-0.5">➔</span>
          </div>
        </button>

        {/* 3. Subtítulos Automáticos */}
        <button
          onClick={onSelectSubtitles ? onSelectSubtitles : () => toast.info(lang === 'es' ? 'Subtitulado automático' : 'Auto subtitles')}
          className="h-56 text-left bg-[#131318]/90 hover:bg-[#181822] border border-zinc-800/80 hover:border-emerald-500/70 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/20 group cursor-pointer relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div className="h-10 w-10 rounded-xl bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-xl text-emerald-300 group-hover:scale-110 transition-transform">
              🎧
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-bold uppercase tracking-wider">
              {lang === 'es' ? 'Whisper IA' : 'Whisper AI'}
            </span>
          </div>
          <div className="space-y-1 mt-auto">
            <h3 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
              {lang === 'es' ? 'Subtítulos' : 'Auto Subtitles'}
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
              {lang === 'es'
                ? 'Transcripción sincronizada palabra por palabra con estilos dinámicos para tus videos.'
                : 'Word-by-word synchronized captions with dynamic styles ready for your video projects.'}
            </p>
          </div>
          <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-500 group-hover:text-emerald-300 font-medium transition-colors">
            <span>{lang === 'es' ? 'Abrir estudio' : 'Open studio'}</span>
            <span className="transition-transform group-hover:translate-x-0.5">➔</span>
          </div>
        </button>

        {/* 4. Portadas y Miniaturas */}
        <button
          onClick={onSelectImages}
          className="h-56 text-left bg-[#131318]/90 hover:bg-[#181822] border border-zinc-800/80 hover:border-indigo-500/70 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-950/20 group cursor-pointer relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-xl text-indigo-300 group-hover:scale-110 transition-transform">
              🎯
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-bold uppercase tracking-wider">
              {lang === 'es' ? 'Alto CTR' : 'High CTR'}
            </span>
          </div>
          <div className="space-y-1 mt-auto">
            <h3 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
              {lang === 'es' ? 'Miniaturas' : 'Thumbnails'}
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
              {lang === 'es'
                ? 'Diseña portadas llamativas en formato horizontal 16:9 o vertical 9:16 Shorts.'
                : 'Design eye-catching thumbnails in horizontal 16:9 or vertical 9:16 Shorts format.'}
            </p>
          </div>
          <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-500 group-hover:text-indigo-300 font-medium transition-colors">
            <span>{lang === 'es' ? 'Abrir estudio' : 'Open studio'}</span>
            <span className="transition-transform group-hover:translate-x-0.5">➔</span>
          </div>
        </button>

        {/* 5. Biblioteca de Recursos */}
        <button
          onClick={onSelectAssets}
          className="h-56 text-left bg-[#131318]/90 hover:bg-[#181822] border border-zinc-800/80 hover:border-cyan-500/70 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-950/20 group cursor-pointer relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div className="h-10 w-10 rounded-xl bg-cyan-600/15 border border-cyan-500/30 flex items-center justify-center text-xl text-cyan-300 group-hover:scale-110 transition-transform">
              🗂️
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 font-bold uppercase tracking-wider">
              {lang === 'es' ? 'Media Hub' : 'Media Hub'}
            </span>
          </div>
          <div className="space-y-1 mt-auto">
            <h3 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
              {lang === 'es' ? 'Biblioteca' : 'Media Library'}
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
              {lang === 'es'
                ? 'Organiza y previsualiza tus pistas de música, efectos de sonido y metraje de cada canal.'
                : 'Keep and preview your music tracks, sound effects, and background clips by channel.'}
            </p>
          </div>
          <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-500 group-hover:text-cyan-300 font-medium transition-colors">
            <span>{lang === 'es' ? 'Abrir estudio' : 'Open studio'}</span>
            <span className="transition-transform group-hover:translate-x-0.5">➔</span>
          </div>
        </button>

      </div>

    </div>
  );
}
