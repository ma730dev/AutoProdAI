'use client';

import React from 'react';
import { Language } from '@/app/translations';
import { VideoItem } from '../shared/types';

export interface ClipsTabProps {
  lang: Language;
  fileInputRef: React.RefObject<HTMLInputElement>;
  projectClips: VideoItem[];
  missingMediaPaths: Set<string>;
  handleAddClipToTimeline: (path: string, name: string) => void;
}

export default function ClipsTab({
  lang,
  fileInputRef,
  projectClips,
  missingMediaPaths,
  handleAddClipToTimeline,
}: ClipsTabProps) {
  return (
    <div className="flex flex-col gap-2 flex-1 overflow-y-auto minimal-scrollbar">
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-2 px-2.5 rounded-xl border border-dashed border-purple-800/60 hover:border-purple-500 bg-purple-950/20 hover:bg-purple-950/40 text-purple-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
      >
        <span>➕</span>
        <span>{lang === 'es' ? 'Importar Video (PC)' : 'Import Video (PC)'}</span>
      </button>

      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
          {lang === 'es' ? 'Metraje del Proyecto' : 'Project Clips'} ({projectClips.length})
        </span>
        {projectClips.length === 0 ? (
          <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/50 text-center text-zinc-500 text-xs">
            {lang === 'es'
              ? 'No hay clips importados aún. Arrastra archivos desde el explorador o importa uno arriba.'
              : 'No clips imported yet.'}
          </div>
        ) : (
          projectClips.map((clip) => {
            const isMissing = missingMediaPaths.has(clip.path);
            return (
              <div
                key={clip.path}
                className={`flex items-center justify-between p-2 rounded-xl border transition-all text-xs ${
                  isMissing
                    ? 'bg-red-950/70 border-red-500/80 text-red-200'
                    : 'bg-zinc-950/80 border-zinc-800 hover:border-purple-700/60'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={isMissing ? 'text-red-400' : 'text-purple-400'}>
                    {isMissing ? '⚠️' : '🎬'}
                  </span>
                  <div className="flex flex-col truncate">
                    <span className={`font-semibold truncate ${isMissing ? 'text-red-200 font-medium' : 'text-zinc-200'}`}>
                      {clip.name}
                    </span>
                    <span className={`text-[10px] font-mono ${isMissing ? 'text-red-300/80' : 'text-zinc-500'}`}>
                      {isMissing
                        ? '⚠️ Archivo inaccesible / Offline'
                        : `${clip.durationFormatted || `${Math.round(clip.duration || 0)}s`} • ${clip.sizeMb ? `${clip.sizeMb}MB` : 'Video'}`}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleAddClipToTimeline(clip.path, clip.name)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer shrink-0 ${
                    isMissing
                      ? 'bg-red-900/60 hover:bg-red-800 text-red-200 border-red-600/70'
                      : 'bg-purple-950/80 hover:bg-purple-900 text-purple-200 border-purple-700/60'
                  }`}
                  title="Añadir a la línea de tiempo"
                >
                  + Añadir
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
