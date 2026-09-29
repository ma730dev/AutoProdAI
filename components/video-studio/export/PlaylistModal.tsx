'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Language } from '@/app/translations';
import { TimelineAudioCut, SubtitleItem } from '../timeline/TimelinePro';
import { toast } from 'sonner';

export interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioCuts?: TimelineAudioCut[];
  subtitles?: SubtitleItem[];
  lang: Language;
}

interface TrackEntry {
  id: string;
  startTime: number;
  duration: number;
  gapBefore: number; // Gap en segundos respecto al fin de la pista anterior (0 para la primera)
  title: string;
}

export function formatYouTubeTimestamp(secs: number): string {
  const safeSecs = Math.max(0, Math.floor(secs));
  const h = Math.floor(safeSecs / 3600);
  const m = Math.floor((safeSecs % 3600) / 60);
  const s = safeSecs % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PlaylistModal({
  isOpen,
  onClose,
  audioCuts = [],
  subtitles = [],
  lang,
}: PlaylistModalProps) {
  // Preferir fuente con datos disponibles: 'audio' o 'subtitles'
  const hasAudio = audioCuts.length > 0;
  const hasSubs = subtitles.length > 0;
  const [source, setSource] = useState<'audio' | 'subtitles'>(hasAudio ? 'audio' : 'subtitles');
  const [copied, setCopied] = useState<boolean>(false);
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (hasAudio && !hasSubs) setSource('audio');
    else if (!hasAudio && hasSubs) setSource('subtitles');
  }, [hasAudio, hasSubs]);

  // Limpiar nombre de archivo (eliminar extensiones como .mp3, .wav, .m4a y reemplazar guiones bajos)
  const cleanSongName = (rawName: string, fallbackIdx: number): string => {
    if (!rawName) return `${lang === 'es' ? 'Canción' : 'Track'} ${fallbackIdx + 1}`;
    let name = rawName.replace(/\.(mp3|wav|m4a|aac|flac|ogg|opus)$/i, '');
    name = name.replace(/^(\d+[-_.\s]+)/, ''); // Quitar prefijos numéricos como "01 - "
    name = name.replace(/[_-]+/g, ' ').trim();
    return name || `${lang === 'es' ? 'Canción' : 'Track'} ${fallbackIdx + 1}`;
  };

  // Calcular pistas y gaps reales según la fuente seleccionada
  const tracks: TrackEntry[] = useMemo(() => {
    if (source === 'audio') {
      const sorted = [...audioCuts].sort((a, b) => a.startTime - b.startTime);
      return sorted.map((cut, idx) => {
        const gapBefore = idx === 0 ? 0 : Math.max(0, cut.startTime - (sorted[idx - 1].startTime + sorted[idx - 1].duration));
        const defaultName = cleanSongName(cut.name, idx);
        return {
          id: cut.id,
          startTime: cut.startTime,
          duration: cut.duration,
          gapBefore,
          title: trackTitles[cut.id] ?? defaultName,
        };
      });
    } else {
      // Subtítulos agrupados por gaps de silencio >= 3.0s
      if (subtitles.length === 0) return [];
      const groups: { id: string; startTime: number; endTime: number }[] = [];
      let curStart = subtitles[0].start;
      let curEnd = subtitles[0].end;
      let groupIdx = 0;

      for (let i = 1; i < subtitles.length; i++) {
        const prevEnd = subtitles[i - 1].end;
        const subStart = subtitles[i].start;
        const gap = subStart - prevEnd;

        if (gap >= 3.0) {
          groups.push({
            id: `sub_group_${groupIdx}`,
            startTime: curStart,
            endTime: curEnd,
          });
          groupIdx++;
          curStart = subStart;
          curEnd = subtitles[i].end;
        } else {
          curEnd = Math.max(curEnd, subtitles[i].end);
        }
      }
      groups.push({
        id: `sub_group_${groupIdx}`,
        startTime: curStart,
        endTime: curEnd,
      });

      return groups.map((g, idx) => {
        const gapBefore = idx === 0 ? 0 : Math.max(0, g.startTime - groups[idx - 1].endTime);
        const defaultName = `${lang === 'es' ? 'Canción' : 'Track'} ${idx + 1}`;
        return {
          id: g.id,
          startTime: g.startTime,
          duration: g.endTime - g.startTime,
          gapBefore,
          title: trackTitles[g.id] ?? defaultName,
        };
      });
    }
  }, [source, audioCuts, subtitles, trackTitles, lang]);

  // Generar texto listo para la descripción de YouTube (formato estándar de capítulos)
  const youtubeDescriptionText = useMemo(() => {
    if (tracks.length === 0) return '';
    return tracks
      .map((t, idx) => {
        // YouTube requiere que el primer capítulo empiece en 00:00 si es el inicio del video
        const ts = idx === 0 && t.startTime < 2.0 ? '00:00' : formatYouTubeTimestamp(t.startTime);
        return `${ts} - ${t.title}`;
      })
      .join('\n');
  }, [tracks]);

  const handleCopy = () => {
    if (!youtubeDescriptionText) return;
    navigator.clipboard.writeText(youtubeDescriptionText).then(() => {
      setCopied(true);
      toast.success(lang === 'es' ? '✅ Lista de reproducción copiada al portapapeles' : '✅ Playlist copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      toast.error(lang === 'es' ? 'Error al copiar al portapapeles' : 'Failed to copy to clipboard');
    });
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    setTrackTitles(prev => ({ ...prev, [id]: newTitle }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-[#121217] border border-violet-500/40 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 bg-[#16161f] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🎵</span>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>{lang === 'es' ? 'Lista de Reproducción' : 'Tracklist & Timestamps'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-950/80 text-violet-300 border border-violet-800/60 font-mono">
                  YouTube Chapters
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {lang === 'es'
                  ? 'Gaps reales calculados automáticamente para la descripción de tu video'
                  : 'Real time gaps calculated for your YouTube description chapters'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 text-xs overflow-y-auto max-h-[75vh] minimal-scrollbar">
          {/* Selector de Fuente si hay ambas disponibles */}
          {hasAudio && hasSubs && (
            <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-[11px]">
              <button
                type="button"
                onClick={() => setSource('audio')}
                className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  source === 'audio'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>🎼</span>
                <span>{lang === 'es' ? `Pistas de Audio A1 (${audioCuts.length})` : `Audio Track A1 (${audioCuts.length})`}</span>
              </button>
              <button
                type="button"
                onClick={() => setSource('subtitles')}
                className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  source === 'subtitles'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>💬</span>
                <span>{lang === 'es' ? 'Segmentos Subtítulos S1' : 'Subtitles Segments S1'}</span>
              </button>
            </div>
          )}

          {tracks.length === 0 ? (
            <div className="p-8 rounded-xl border border-zinc-800 bg-zinc-950/60 text-center flex flex-col items-center gap-2.5">
              <span className="text-3xl opacity-50">🎧</span>
              <p className="text-zinc-400 font-semibold">
                {lang === 'es'
                  ? 'No hay canciones o subtítulos cargados en el proyecto.'
                  : 'No songs or subtitles found in the project.'}
              </p>
              <p className="text-[11px] text-zinc-500 max-w-sm">
                {lang === 'es'
                  ? 'Agrega pistas de audio en la línea de tiempo o genera subtítulos para calcular los timestamps con sus silencios reales.'
                  : 'Add audio tracks to the timeline or generate subtitles to calculate real timestamps and gaps.'}
              </p>
            </div>
          ) : (
            <>
              {/* Resumen de Métricas */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">
                    {lang === 'es' ? 'Total Pistas' : 'Total Tracks'}
                  </span>
                  <span className="text-sm font-mono font-bold text-violet-400">
                    {tracks.length}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">
                    {lang === 'es' ? 'Gaps Detectados' : 'Gaps Detected'}
                  </span>
                  <span className="text-sm font-mono font-bold text-amber-400">
                    {tracks.filter(t => t.gapBefore > 0.1).length}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">
                    {lang === 'es' ? 'Fin Secuencia' : 'Sequence End'}
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    {formatYouTubeTimestamp(
                      tracks.length > 0 ? tracks[tracks.length - 1].startTime + tracks[tracks.length - 1].duration : 0
                    )}
                  </span>
                </div>
              </div>

              {/* Lista editable de canciones y gaps */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden flex flex-col">
                <div className="px-3 py-2 bg-[#16161f] border-b border-zinc-800/80 flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  <span className="w-14">{lang === 'es' ? 'Inicio' : 'Start'}</span>
                  <span className="flex-1 px-2">{lang === 'es' ? 'Título de Canción / Capítulo' : 'Track Title / Chapter'}</span>
                  <span className="w-20 text-right">{lang === 'es' ? 'Duración' : 'Duration'}</span>
                  <span className="w-20 text-right">{lang === 'es' ? 'Silencio / Gap' : 'Gap / Pause'}</span>
                </div>

                <div className="divide-y divide-zinc-900 max-h-[220px] overflow-y-auto minimal-scrollbar">
                  {tracks.map((t, idx) => (
                    <div
                      key={t.id}
                      className="px-3 py-2 flex items-center gap-2 hover:bg-zinc-900/50 transition-colors"
                    >
                      {/* Timestamp YouTube */}
                      <span className="w-14 font-mono font-bold text-violet-400 text-[11px] shrink-0">
                        {idx === 0 && t.startTime < 2.0 ? '00:00' : formatYouTubeTimestamp(t.startTime)}
                      </span>

                      {/* Título editable */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={t.title}
                          onChange={(e) => handleTitleChange(t.id, e.target.value)}
                          className="w-full bg-transparent text-zinc-200 text-xs font-medium border-b border-transparent hover:border-zinc-700 focus:border-violet-500 focus:outline-none py-0.5 truncate transition-colors"
                          placeholder={`${lang === 'es' ? 'Canción' : 'Track'} ${idx + 1}`}
                        />
                      </div>

                      {/* Duración */}
                      <span className="w-20 text-right font-mono text-zinc-400 text-[11px] shrink-0">
                        {formatYouTubeTimestamp(t.duration)}
                      </span>

                      {/* Gap respecto a la canción anterior */}
                      <div className="w-20 text-right shrink-0">
                        {t.gapBefore > 0.1 ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 font-mono text-[9px] font-bold" title={lang === 'es' ? `Silencio de ${t.gapBefore.toFixed(1)}s antes de iniciar` : `${t.gapBefore.toFixed(1)}s gap before start`}>
                            +{t.gapBefore.toFixed(1)}s
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-600 font-mono">0.0s</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Caja de Copia Rápida para YouTube */}
              <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-800/40 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
                    <span>📋</span>
                    <span>{lang === 'es' ? 'Formato para Descripción de YouTube' : 'Ready for YouTube Description'}</span>
                  </span>
                  <span className="text-[9px] text-zinc-400">
                    {lang === 'es' ? 'Capítulos automáticos' : 'Auto chapters'}
                  </span>
                </div>
                <pre className="text-[11px] font-mono text-zinc-300 bg-zinc-950/90 p-2.5 rounded-lg border border-zinc-800/80 whitespace-pre-wrap max-h-28 overflow-y-auto minimal-scrollbar select-all leading-relaxed">
                  {youtubeDescriptionText}
                </pre>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-800 bg-[#16161f] flex items-center justify-between gap-2.5">
          <span className="text-[10px] text-zinc-500">
            {lang === 'es'
              ? 'Pega este bloque en la descripción de tu video para que YouTube active los capítulos automáticos.'
              : 'Paste this in your YouTube video description to activate automated chapters.'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs cursor-pointer transition-colors"
            >
              {lang === 'es' ? 'Cerrar' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={tracks.length === 0}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
                copied
                  ? 'bg-emerald-600 text-white shadow-emerald-950/50'
                  : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-violet-950/50'
              }`}
            >
              <span>{copied ? '✅' : '📋'}</span>
              <span>
                {copied
                  ? (lang === 'es' ? '¡Copiado!' : 'Copied!')
                  : (lang === 'es' ? 'Copiar Lista para YouTube' : 'Copy Tracklist for YouTube')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
