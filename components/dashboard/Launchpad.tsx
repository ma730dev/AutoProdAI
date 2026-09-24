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

      {/* ── Las 4 Herramientas en Cuadrícula ── */}
      <div className="max-w-5xl w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-12">

        {/* 1. Video Studio */}
        <button
          onClick={onSelectLooper}
          className="h-48 text-left bg-[#131318]/90 hover:bg-[#181822] border border-zinc-800/80 hover:border-purple-500/70 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-950/20 group cursor-pointer"
        >
          <div className="h-10 w-10 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-xl text-purple-300 group-hover:scale-110 transition-transform">
            🎬
          </div>
          <div className="space-y-1.5 mt-auto">
            <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
              Video Studio
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
              {lang === 'es'
                ? 'Edición y montaje de clips, pistas de música, bucles y exportación.'
                : 'Timeline editing, video clips, music tracks, loops and rendering.'}
            </p>
          </div>
          <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between text-[11px] text-zinc-500 group-hover:text-purple-300 font-medium transition-colors">
            <span>{lang === 'es' ? 'Abrir' : 'Open'}</span>
            <span className="transition-transform group-hover:translate-x-0.5">➔</span>
          </div>
        </button>

        {/* 2. Texto a Voz */}
        <button
          onClick={onSelectTTS ? onSelectTTS : () => toast.info(lang === 'es' ? 'Texto a Voz' : 'Text to Speech')}
          className="h-48 text-left bg-[#131318]/90 hover:bg-[#181822] border border-zinc-800/80 hover:border-purple-500/70 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-950/20 group cursor-pointer"
        >
          <div className="h-10 w-10 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-xl text-purple-300 group-hover:scale-110 transition-transform">
            🎙️
          </div>
          <div className="space-y-1.5 mt-auto">
            <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
              Texto a Voz
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
              {lang === 'es'
                ? 'Generación de locuciones y audio a partir de tus guiones.'
                : 'Synthesize voiceovers and speech directly from your scripts.'}
            </p>
          </div>
          <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between text-[11px] text-zinc-500 group-hover:text-purple-300 font-medium transition-colors">
            <span>{lang === 'es' ? 'Abrir' : 'Open'}</span>
            <span className="transition-transform group-hover:translate-x-0.5">➔</span>
          </div>
        </button>

        {/* 3. Imagenes */}
        <button
          onClick={onSelectImages}
          className="h-48 text-left bg-[#131318]/90 hover:bg-[#181822] border border-zinc-800/80 hover:border-indigo-500/70 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-950/20 group cursor-pointer"
        >
          <div className="h-10 w-10 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-xl text-indigo-300 group-hover:scale-110 transition-transform">
            🎯
          </div>
          <div className="space-y-1.5 mt-auto">
            <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
              Imagenes
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
              {lang === 'es'
                ? 'Diseño y generación de miniaturas y portadas para tus canales.'
                : 'Design and generation of thumbnails and covers for your channels.'}
            </p>
          </div>
          <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between text-[11px] text-zinc-500 group-hover:text-indigo-300 font-medium transition-colors">
            <span>{lang === 'es' ? 'Abrir' : 'Open'}</span>
            <span className="transition-transform group-hover:translate-x-0.5">➔</span>
          </div>
        </button>

        {/* 4. Biblioteca */}
        <button
          onClick={onSelectAssets}
          className="h-48 text-left bg-[#131318]/90 hover:bg-[#181822] border border-zinc-800/80 hover:border-cyan-500/70 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-950/20 group cursor-pointer"
        >
          <div className="h-10 w-10 rounded-xl bg-cyan-600/15 border border-cyan-500/30 flex items-center justify-center text-xl text-cyan-300 group-hover:scale-110 transition-transform">
            🗂️
          </div>
          <div className="space-y-1.5 mt-auto">
            <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
              Biblioteca
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
              {lang === 'es'
                ? 'Organización de pistas de música, efectos de sonido y recursos.'
                : 'Media asset library for music tracks, sound effects and footage.'}
            </p>
          </div>
          <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between text-[11px] text-zinc-500 group-hover:text-cyan-300 font-medium transition-colors">
            <span>{lang === 'es' ? 'Abrir' : 'Open'}</span>
            <span className="transition-transform group-hover:translate-x-0.5">➔</span>
          </div>
        </button>

      </div>

    </div>
  );
}
