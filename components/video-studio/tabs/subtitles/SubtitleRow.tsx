'use client';

import React from 'react';
import { SubtitleItem } from '../../timeline/TimelinePro';

interface SubtitleRowProps {
  sub: SubtitleItem;
  globalIdx: number;
  isActive: boolean;
  dur: number;
  maxDuration: number;
  onSeek: () => void;
  onDelete: () => void;
  onTextChange: (text: string) => void;
}

/** Fila ultra-compacta de un subtítulo individual. */
export default function SubtitleRow({
  sub,
  globalIdx,
  isActive,
  dur,
  maxDuration,
  onSeek,
  onDelete,
  onTextChange,
}: SubtitleRowProps) {
  const durPct = Math.min(100, (dur / maxDuration) * 100);

  return (
    <div
      onClick={onSeek}
      className={`group relative flex flex-col gap-0.5 px-2 pt-1.5 pb-1 rounded-lg cursor-pointer transition-all border ${
        isActive
          ? 'bg-amber-950/40 border-amber-600/60 ring-1 ring-amber-500/30'
          : 'bg-transparent border-transparent hover:bg-zinc-900/60 hover:border-zinc-800/60'
      }`}
    >
      {/* Línea superior: número · timecode · barra de duración · botón borrar */}
      <div className="flex items-center gap-1.5">
        <span className={`text-[9px] font-mono font-bold w-5 text-right shrink-0 ${isActive ? 'text-amber-400' : 'text-zinc-600'}`}>
          {globalIdx + 1}
        </span>
        <span className="text-[9px] font-mono text-zinc-500 shrink-0">
          {sub.start.toFixed(1)}s→{sub.end.toFixed(1)}s
        </span>
        {/* Barra de duración proporcional */}
        <div className="flex-1 h-px bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isActive ? 'bg-amber-400' : 'bg-zinc-600'}`}
            style={{ width: `${durPct}%` }}
          />
        </div>
        <span className={`text-[9px] font-mono shrink-0 ${isActive ? 'text-amber-400/70' : 'text-zinc-600'}`}>
          {dur.toFixed(1)}s
        </span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="text-[9px] text-transparent group-hover:text-zinc-600 hover:!text-red-400 transition-colors px-0.5 shrink-0 leading-none"
          title="Eliminar"
        >✕</button>
      </div>

      {/* Texto editable */}
      <input
        type="text"
        value={sub.text}
        onClick={e => e.stopPropagation()}
        onChange={e => onTextChange(e.target.value)}
        className={`w-full bg-transparent text-[11px] leading-tight px-1 py-0 border-0 focus:outline-none focus:ring-0 truncate ${
          isActive ? 'text-amber-100' : 'text-zinc-300'
        }`}
        title={sub.text}
      />
    </div>
  );
}
