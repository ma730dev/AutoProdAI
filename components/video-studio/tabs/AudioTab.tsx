'use client';

import React from 'react';
import { Language } from '@/app/translations';
import { SongItem } from '../shared/types';
import { TimelineAudioCut } from '../timeline/TimelinePro';

export interface AudioTabProps {
  lang: Language;
  audioFileInputRef: React.RefObject<HTMLInputElement>;
  projectAudioList: SongItem[];
  missingMediaPaths: Set<string>;
  auditioningAudioPath: string | null;
  toggleAuditionSong: (path: string) => void;
  audioCuts: TimelineAudioCut[];
  handleAddAudioToTimeline: (path: string, name: string, insertAt?: number) => void;
  handleAddAllAudiosToTimeline: () => void;
  playheadTime: number;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  onClearAudioTrack: () => void;
}

export default function AudioTab({
  lang,
  audioFileInputRef,
  projectAudioList,
  missingMediaPaths,
  auditioningAudioPath,
  toggleAuditionSong,
  audioCuts,
  handleAddAudioToTimeline,
  handleAddAllAudiosToTimeline,
  playheadTime,
  musicVolume,
  setMusicVolume,
  onClearAudioTrack,
}: AudioTabProps) {
  return (
    <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto minimal-scrollbar">
      {/* Botones de acción superior */}
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => audioFileInputRef.current?.click()}
          className="w-full py-2 px-2.5 rounded-xl border border-dashed border-indigo-700/60 hover:border-indigo-400 bg-indigo-950/30 hover:bg-indigo-950/60 text-indigo-200 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
        >
          <span className="text-sm">🎵</span>
          <span>{lang === 'es' ? '+ Subir canciones (MP3/WAV)' : '+ Upload Songs (MP3/WAV)'}</span>
        </button>

        {projectAudioList.length > 1 && (
          <button
            onClick={handleAddAllAudiosToTimeline}
            className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 hover:text-white border border-indigo-700/60 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
            title="Coloca todas las canciones en orden secuencial en la pista A1"
          >
            <span>⚡</span>
            <span>{lang === 'es' ? 'Añadir Todas en Cascada a Pista A1' : 'Add All in Cascade to Track A1'}</span>
          </button>
        )}
      </div>

      {/* Lista de canciones en la bandeja del proyecto */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
          <span>{lang === 'es' ? 'Canciones Disponibles' : 'Available Songs'}</span>
          <span className="font-mono text-indigo-400">{projectAudioList.length}</span>
        </div>

        {projectAudioList.length === 0 ? (
          <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
            <span className="text-2xl opacity-40">🎼</span>
            <span>
              {lang === 'es'
                ? 'No hay canciones en la bandeja. Sube múltiples archivos de audio para incorporarlos a tu video.'
                : 'No songs in bin. Upload multiple audio files to add to video.'}
            </span>
          </div>
        ) : (
          projectAudioList.map((song, idx) => {
            const isAuditioning = auditioningAudioPath === song.path;
            const isAlreadyOnTimeline = audioCuts.some(a => a.audioPath === song.path);
            const isSongMissing = missingMediaPaths.has(song.path);

            return (
              <div
                key={song.path || idx}
                className={`p-2 rounded-xl border flex flex-col gap-1.5 text-xs transition-all ${
                  isSongMissing
                    ? 'bg-red-950/70 border-red-500/80 text-red-200'
                    : isAuditioning
                    ? 'bg-indigo-950/60 border-indigo-500/70 ring-1 ring-indigo-500/40'
                    : 'bg-zinc-950/80 border-zinc-800/80 hover:border-indigo-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    {/* Botón de audición rápida */}
                    <button
                      type="button"
                      onClick={() => toggleAuditionSong(song.path)}
                      disabled={isSongMissing}
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isSongMissing
                          ? 'bg-red-950/90 text-red-400 border border-red-500/50 cursor-not-allowed opacity-60'
                          : isAuditioning
                          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/50 animate-pulse cursor-pointer'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer'
                      }`}
                      title={isSongMissing ? 'Archivo no accesible' : isAuditioning ? 'Pausar audición' : 'Escuchar vista previa'}
                    >
                      <span className="text-[10px]">{isSongMissing ? '⚠️' : isAuditioning ? '⏸' : '▶'}</span>
                    </button>
                    <div className="flex flex-col truncate">
                      <span className={`font-semibold truncate ${isSongMissing ? 'text-red-200 font-medium' : 'text-zinc-200'}`}>
                        {song.name}
                      </span>
                      <span className={`text-[10px] font-mono ${isSongMissing ? 'text-red-300/80' : 'text-zinc-500'}`}>
                        {isSongMissing
                          ? '⚠️ Archivo inaccesible en disco'
                          : `${song.duration_formatted || `${Math.round(song.duration_seconds)}s`} • ${song.size_mb ? `${song.size_mb}MB` : 'Audio'}`}
                      </span>
                    </div>
                  </div>

                  {/* Acciones para añadir a pista A1 */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAddAudioToTimeline(song.path, song.name)}
                      className={`px-2 py-1 rounded text-[10px] font-bold border transition-all hover:scale-105 cursor-pointer ${
                        isSongMissing
                          ? 'bg-red-900/60 hover:bg-red-800 text-red-200 border-red-600/70'
                          : 'bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border-indigo-700/60'
                      }`}
                      title="Añadir al final de la pista A1"
                    >
                      + A1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddAudioToTimeline(song.path, song.name, playheadTime)}
                      className={`px-1.5 py-1 rounded text-[10px] border cursor-pointer ${
                        isSongMissing
                          ? 'bg-red-950 hover:bg-red-900 text-red-300 border-red-800/60'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-indigo-200 border-zinc-800'
                      }`}
                      title="Añadir en la posición actual del cabezal"
                    >
                      📍
                    </button>
                  </div>
                </div>

                {isAlreadyOnTimeline && (
                  <div className="flex items-center gap-1 text-[9px] font-mono text-indigo-400/80">
                    <span>✓</span>
                    <span>{lang === 'es' ? 'Presente en Pista A1' : 'Placed on A1'}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Resumen de la Pista A1 en el Timeline */}
      <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/60">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
          <span>{lang === 'es' ? 'Estado Pista A1' : 'Track A1 Status'}</span>
          {audioCuts.length > 0 && (
            <button
              onClick={onClearAudioTrack}
              className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer lowercase"
            >
              {lang === 'es' ? 'vaciar todo' : 'clear all'}
            </button>
          )}
        </div>

        <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-900/40 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
              <span>🎚️</span>
              <span>{audioCuts.length} {lang === 'es' ? 'pista(s) en línea de tiempo' : 'clip(s) on timeline'}</span>
            </span>
            <span className="text-[10px] font-mono text-indigo-400">
              {Math.round(musicVolume * 100)}% vol
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-400">Volumen General:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
              className="flex-1 accent-indigo-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
