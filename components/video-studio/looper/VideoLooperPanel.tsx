'use client';

import React from 'react';
import { Language } from '@/app/translations';
import { TimelineCut } from '../timeline/TimelinePro';
import { SongItem } from '../shared/types';

export interface VideoLooperPanelProps {
  lang: Language;
  timelineCuts: TimelineCut[];
  setTimelineCuts: React.Dispatch<React.SetStateAction<TimelineCut[]>>;
  selectedCut: TimelineCut | null;
  selectedLoopCuts: TimelineCut[];
  isLoopClipsSelectorOpen: boolean;
  setIsLoopClipsSelectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedLoopCutIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleToggleLoopCutSelection: (cutId: string) => void;
  handleMoveLoopCutOrder: (idx: number, direction: 'up' | 'down') => void;
  handleRemoveLoopCutFromSequence: (idx: number) => void;
  loopCycleDuration: number;
  looperDurationMode: 'time' | 'songs';
  setLooperDurationMode: React.Dispatch<React.SetStateAction<'time' | 'songs'>>;
  looperCustomMinutes: number;
  setLooperCustomMinutes: React.Dispatch<React.SetStateAction<number>>;
  looperCustomSeconds: number;
  setLooperCustomSeconds: React.Dispatch<React.SetStateAction<number>>;
  looperSongSelectionMode: 'track_a1' | 'choose_songs';
  setLooperSongSelectionMode: React.Dispatch<React.SetStateAction<'track_a1' | 'choose_songs'>>;
  maxAudioEnd: number;
  projectAudioList: SongItem[];
  looperSelectedSongPaths: string[];
  setLooperSelectedSongPaths: React.Dispatch<React.SetStateAction<string[]>>;
  looperAddSongsToTimeline: boolean;
  setLooperAddSongsToTimeline: React.Dispatch<React.SetStateAction<boolean>>;
  calculatedLoopDuration: number;
  calculatedLoopCycles: number;
  handleAdjustLoopDurationSeconds: (delta: number) => void;
  handleCreateOrApplyLoop: () => void;
  handleRemoveLoopFromCut: (cutId: string) => void;
}

export default function VideoLooperPanel({
  lang,
  timelineCuts,
  setTimelineCuts,
  selectedCut,
  selectedLoopCuts,
  isLoopClipsSelectorOpen,
  setIsLoopClipsSelectorOpen,
  setSelectedLoopCutIds,
  handleToggleLoopCutSelection,
  handleMoveLoopCutOrder,
  handleRemoveLoopCutFromSequence,
  loopCycleDuration,
  looperDurationMode,
  setLooperDurationMode,
  looperCustomMinutes,
  setLooperCustomMinutes,
  looperCustomSeconds,
  setLooperCustomSeconds,
  looperSongSelectionMode,
  setLooperSongSelectionMode,
  maxAudioEnd,
  projectAudioList,
  looperSelectedSongPaths,
  setLooperSelectedSongPaths,
  looperAddSongsToTimeline,
  setLooperAddSongsToTimeline,
  calculatedLoopDuration,
  calculatedLoopCycles,
  handleAdjustLoopDurationSeconds,
  handleCreateOrApplyLoop,
  handleRemoveLoopFromCut,
}: VideoLooperPanelProps) {
  const isLoopActiveOnCut = !!selectedCut?.loopToAudio;

  return (
    <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
      {/* Encabezado del Looper */}
      <div className="flex items-center justify-between pb-1 border-b border-zinc-850">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">🔁</span>
          <span className="text-xs font-bold text-amber-300">
            {lang === 'es' ? 'Generador de Bucles (Looper)' : 'Loop Generator (Looper)'}
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/40">
          {selectedLoopCuts.length} {selectedLoopCuts.length === 1 ? 'clip' : 'clips'}
        </span>
      </div>

      {/* 1. SELECCIONAR CLIPS DE LA LÍNEA DE TIEMPO */}
      <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-amber-300 flex items-center gap-1">
            <span>🎬</span>
            <span>{lang === 'es' ? 'Clips de la Línea de Tiempo' : 'Timeline Clips for Cycle'}</span>
          </span>
          <button
            type="button"
            onClick={() => setIsLoopClipsSelectorOpen(prev => !prev)}
            className="text-[10px] text-amber-400 hover:text-amber-200 font-semibold cursor-pointer flex items-center gap-1"
          >
            <span>{isLoopClipsSelectorOpen ? (lang === 'es' ? 'Ocultar' : 'Hide') : (lang === 'es' ? 'Elegir clips' : 'Pick clips')}</span>
            <span>{isLoopClipsSelectorOpen ? '▲' : '▼'}</span>
          </button>
        </div>

        {isLoopClipsSelectorOpen && (
          <div className="flex flex-col gap-1.5 p-1.5 rounded-lg bg-zinc-950 border border-zinc-800/80 max-h-48 overflow-y-auto minimal-scrollbar">
            {timelineCuts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-3 text-center gap-1 text-zinc-500 text-xs">
                <span>{lang === 'es' ? 'No hay clips en la línea de tiempo.' : 'No clips on timeline.'}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-1 border-b border-zinc-850 text-[10px] text-zinc-400">
                  <span>{lang === 'es' ? 'Selecciona clips para el ciclo:' : 'Select cycle clips:'}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedLoopCutIds(timelineCuts.map(c => c.id))}
                      className="text-amber-400 hover:underline cursor-pointer"
                    >
                      {lang === 'es' ? 'Todos' : 'All'}
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedLoopCutIds(selectedCut ? [selectedCut.id] : (timelineCuts[0] ? [timelineCuts[0].id] : []))}
                      className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      {lang === 'es' ? 'Reiniciar' : 'Reset'}
                    </button>
                  </div>
                </div>
                {timelineCuts.map((cut, idx) => {
                  const isChecked = selectedLoopCuts.some(c => c.id === cut.id);
                  return (
                    <label
                      key={cut.id}
                      className={`flex items-center justify-between p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${isChecked
                        ? 'bg-amber-950/40 border-amber-600/50 text-amber-100'
                        : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-300 hover:bg-zinc-900'
                        }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleLoopCutSelection(cut.id)}
                          className="rounded accent-amber-500 cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-zinc-500">{idx + 1}.</span>
                        <span className="truncate text-[11px] font-medium">{cut.name}</span>
                        {cut.isReversed && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-mono font-bold shrink-0">
                            ⏪ REV
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                        {cut.duration.toFixed(1)}s
                      </span>
                    </label>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ORDEN DE LA SECUENCIA DEL BUCLE (CICLO REPETITIVO) */}
        {selectedLoopCuts.length > 0 && (
          <div className="flex flex-col gap-1 pt-1">
            <span className="text-[10px] uppercase font-bold text-zinc-500">
              {lang === 'es' ? 'Orden del Ciclo:' : 'Cycle Order:'}
            </span>
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto minimal-scrollbar">
              {selectedLoopCuts.map((clip, idx) => (
                <div
                  key={`${clip.id}-${idx}`}
                  className="flex items-center justify-between p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate text-zinc-200 text-[11px]">{clip.name}</span>
                    {clip.isReversed && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-mono font-bold shrink-0">
                        ⏪ REV
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                      ({clip.duration ? `${clip.duration.toFixed(1)}s` : '15s'})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveLoopCutOrder(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 text-[10px] cursor-pointer"
                      title="Mover antes en el ciclo"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveLoopCutOrder(idx, 'down')}
                      disabled={idx === selectedLoopCuts.length - 1}
                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 text-[10px] cursor-pointer"
                      title="Mover después en el ciclo"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveLoopCutFromSequence(idx)}
                      disabled={selectedLoopCuts.length <= 1}
                      className="p-1 rounded bg-red-950/40 hover:bg-red-900/60 disabled:opacity-20 text-red-300 text-[10px] cursor-pointer"
                      title="Quitar del ciclo"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-amber-300/90 bg-amber-950/40 px-2 py-1 rounded border border-amber-600/30">
              <span>{lang === 'es' ? '1 Ciclo Completo (Vuelta):' : '1 Complete Cycle:'}</span>
              <span className="font-bold text-amber-200">{loopCycleDuration.toFixed(1)}s</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. DURACIÓN DEL BUCLE */}
      <div className="flex flex-col gap-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-amber-300">
          <span>{lang === 'es' ? 'Duración del Bucle' : 'Loop Duration'}</span>
          <span className="text-zinc-500 font-normal">2 {lang === 'es' ? 'Opciones' : 'Options'}</span>
        </div>

        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => setLooperDurationMode('time')}
            className={`py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${looperDurationMode === 'time'
              ? 'bg-amber-600 text-black font-bold shadow'
              : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <span>⏱️</span>
            <span>{lang === 'es' ? 'Poner Tiempo' : 'Set Time'}</span>
          </button>
          <button
            type="button"
            onClick={() => setLooperDurationMode('songs')}
            className={`py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${looperDurationMode === 'songs'
              ? 'bg-amber-600 text-black font-bold shadow'
              : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <span>🎵</span>
            <span>{lang === 'es' ? 'Elegir Canciones' : 'Pick Songs'}</span>
          </button>
        </div>

        {/* OPCION A: TIEMPO DIRECTO */}
        {looperDurationMode === 'time' && (
          <div className="flex flex-col gap-2 p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">{lang === 'es' ? 'Minutos:' : 'Minutes:'}</span>
                <input
                  type="number"
                  min="0"
                  max="600"
                  value={looperCustomMinutes}
                  onChange={(e) => {
                    const m = Math.max(0, parseInt(e.target.value) || 0);
                    setLooperCustomMinutes(m);
                    const targetTotal = m * 60 + looperCustomSeconds;
                    if (selectedCut && selectedCut.loopToAudio) {
                      setTimelineCuts(prev => prev.map(c => c.id === selectedCut.id ? { ...c, loopDuration: targetTotal } : c));
                    }
                  }}
                  className="w-full bg-zinc-900 border border-zinc-750 rounded px-2 py-1 text-amber-300 font-mono text-xs font-bold"
                />
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">{lang === 'es' ? 'Segundos:' : 'Seconds:'}</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={looperCustomSeconds}
                  onChange={(e) => {
                    const s = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                    setLooperCustomSeconds(s);
                    const targetTotal = looperCustomMinutes * 60 + s;
                    if (selectedCut && selectedCut.loopToAudio) {
                      setTimelineCuts(prev => prev.map(c => c.id === selectedCut.id ? { ...c, loopDuration: targetTotal } : c));
                    }
                  }}
                  className="w-full bg-zinc-900 border border-zinc-750 rounded px-2 py-1 text-amber-300 font-mono text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              {[5, 15, 30, 60].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setLooperCustomMinutes(mins);
                    setLooperCustomSeconds(0);
                    if (selectedCut && selectedCut.loopToAudio) {
                      setTimelineCuts(prev => prev.map(c => c.id === selectedCut.id ? { ...c, loopDuration: mins * 60 } : c));
                    }
                  }}
                  className={`flex-1 py-1 rounded text-[10px] font-mono font-semibold border cursor-pointer transition-all ${looperCustomMinutes === mins && looperCustomSeconds === 0
                    ? 'bg-amber-500 text-black border-amber-400 font-bold'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-850'
                    }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>
        )}

        {/* OPCION B: CANCIONES */}
        {looperDurationMode === 'songs' && (
          <div className="flex flex-col gap-2 p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-300">
                <input
                  type="radio"
                  name="song_mode"
                  checked={looperSongSelectionMode === 'track_a1'}
                  onChange={() => setLooperSongSelectionMode('track_a1')}
                  className="accent-amber-500"
                />
                <span>
                  {lang === 'es' ? 'Sincronizar con Audio de Pista A1' : 'Match Track A1 Audio'}
                  {maxAudioEnd > 0 && <span className="text-amber-300 font-mono ml-1">({maxAudioEnd.toFixed(1)}s)</span>}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-300">
                <input
                  type="radio"
                  name="song_mode"
                  checked={looperSongSelectionMode === 'choose_songs'}
                  onChange={() => setLooperSongSelectionMode('choose_songs')}
                  className="accent-amber-500"
                />
                <span>{lang === 'es' ? 'Elegir canciones del proyecto' : 'Choose project songs'}</span>
              </label>
            </div>

            {looperSongSelectionMode === 'choose_songs' && (
              <div className="flex flex-col gap-1 pt-1 max-h-36 overflow-y-auto minimal-scrollbar">
                {projectAudioList.length === 0 ? (
                  <div className="p-2 text-center text-[10px] text-zinc-500">
                    {lang === 'es' ? 'No hay canciones en la carpeta Música' : 'No songs in Music folder'}
                  </div>
                ) : (
                  projectAudioList.map(song => {
                    const isSongSelected = looperSelectedSongPaths.includes(song.path);
                    return (
                      <label
                        key={song.path}
                        className={`flex items-center justify-between p-1.5 rounded-lg border text-xs cursor-pointer ${isSongSelected
                          ? 'bg-amber-950/40 border-amber-600/50 text-amber-100'
                          : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                          }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <input
                            type="checkbox"
                            checked={isSongSelected}
                            onChange={() => {
                              setLooperSelectedSongPaths(prev =>
                                prev.includes(song.path)
                                  ? prev.filter(p => p !== song.path)
                                  : [...prev, song.path]
                              );
                            }}
                            className="rounded accent-amber-500 cursor-pointer"
                          />
                          <span className="truncate text-[11px]">{song.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                          {song.duration_formatted || `${song.duration_seconds}s`}
                        </span>
                      </label>
                    );
                  })
                )}

                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={looperAddSongsToTimeline}
                    onChange={(e) => setLooperAddSongsToTimeline(e.target.checked)}
                    className="rounded accent-amber-500"
                  />
                  <span>{lang === 'es' ? 'Insertar canciones seleccionadas en pista A1' : 'Insert selected songs into Track A1'}</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* ALARGAR O ACORTAR EL BUCLE */}
        <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-amber-950/30 border border-amber-500/40">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-amber-200/90 font-medium">
              {lang === 'es' ? 'Alargar / Acortar Bucle:' : 'Stretch / Shorten Loop:'}
            </span>
            <span className="font-mono font-bold text-amber-300">
              {Math.floor(calculatedLoopDuration / 60)}m {Math.round(calculatedLoopDuration % 60)}s
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => handleAdjustLoopDurationSeconds(-60)}
              className="py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-700 cursor-pointer text-center"
              title="Acortar 1 minuto"
            >
              - 1m
            </button>
            <button
              type="button"
              onClick={() => handleAdjustLoopDurationSeconds(-10)}
              className="py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-700 cursor-pointer text-center"
              title="Acortar 10 segundos"
            >
              - 10s
            </button>
            <button
              type="button"
              onClick={() => handleAdjustLoopDurationSeconds(10)}
              className="py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-700 cursor-pointer text-center"
              title="Alargar 10 segundos"
            >
              + 10s
            </button>
            <button
              type="button"
              onClick={() => handleAdjustLoopDurationSeconds(60)}
              className="py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-700 cursor-pointer text-center"
              title="Alargar 1 minuto"
            >
              + 1m
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-amber-300/90 bg-amber-950/60 px-2 py-1 rounded border border-amber-600/30">
            <span>{lang === 'es' ? 'Vueltas estimadas:' : 'Estimated cycles:'}</span>
            <span className="font-bold text-amber-200">↻ {calculatedLoopCycles} vueltas</span>
          </div>
        </div>
      </div>

      {/* 3. BOTÓN DE ACCIÓN */}
      <div className="flex flex-col gap-1.5 pt-1">
        <button
          type="button"
          onClick={handleCreateOrApplyLoop}
          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-[0.98]"
        >
          <span>⚡</span>
          <span>
            {isLoopActiveOnCut
              ? (lang === 'es' ? 'Actualizar Bucle Amarillo en Timeline' : 'Update Yellow Loop on Timeline')
              : (lang === 'es' ? 'Generar Bucle con Clips Seleccionados' : 'Generate Loop with Selected Clips')}
          </span>
        </button>

        {isLoopActiveOnCut && (
          <button
            type="button"
            onClick={() => handleRemoveLoopFromCut(selectedCut.id)}
            className="w-full py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-300 text-[10px] font-semibold border border-zinc-800 cursor-pointer transition-colors"
          >
            ✕ {lang === 'es' ? 'Desactivar Bucle (Restaurar clips a timeline)' : 'Deactivate Loop (Restore clips to timeline)'}
          </button>
        )}
      </div>
    </div>
  );
}
