'use client';

import React from 'react';
import { Language } from '@/app/translations';

export interface TextTabProps {
  lang: Language;
  handleInsertOverlay: (presetType: 'subscribe_cta' | 'like_cta' | 'lower_third') => void;
}

export default function TextTab({ lang, handleInsertOverlay }: TextTabProps) {
  return (
    <div className="flex flex-col gap-2 flex-1 overflow-y-auto minimal-scrollbar">
      <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
        {lang === 'es' ? 'Plantillas de Texto & Stickers' : 'Text Overlays'}
      </span>
      <button
        onClick={() => handleInsertOverlay('subscribe_cta')}
        className="p-2.5 rounded-xl bg-red-950/30 border border-red-800/50 hover:border-red-500 text-left flex items-center justify-between text-xs cursor-pointer transition-all"
      >
        <div className="flex items-center gap-2 text-red-300 font-bold">
          <span>🔔</span>
          <span>{lang === 'es' ? 'Botón «Suscríbete»' : '«Subscribe» Button'}</span>
        </div>
        <span className="text-[10px] text-red-400">+ Insertar</span>
      </button>
      <button
        onClick={() => handleInsertOverlay('like_cta')}
        className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-800/50 hover:border-blue-500 text-left flex items-center justify-between text-xs cursor-pointer transition-all"
      >
        <div className="flex items-center gap-2 text-blue-300 font-bold">
          <span>👍</span>
          <span>{lang === 'es' ? 'Botón «Dale Like»' : '«Like» Button'}</span>
        </div>
        <span className="text-[10px] text-blue-400">+ Insertar</span>
      </button>
      <button
        onClick={() => handleInsertOverlay('lower_third')}
        className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-800/50 hover:border-purple-500 text-left flex items-center justify-between text-xs cursor-pointer transition-all"
      >
        <div className="flex items-center gap-2 text-purple-300 font-bold">
          <span>🏷️</span>
          <span>{lang === 'es' ? 'Título / Lower Third' : 'Title / Lower Third'}</span>
        </div>
        <span className="text-[10px] text-purple-400">+ Insertar</span>
      </button>
    </div>
  );
}
