'use client';

import React from 'react';
import { Language } from '@/app/translations';
import { SubtitleItem } from '../../timeline/TimelinePro';
import { toast } from 'sonner';
import SubtitleRow from './SubtitleRow';

/** Gap mínimo en segundos entre subs para considerar un nuevo grupo/canción */
export const GROUP_GAP_SECONDS = 3.0;

export interface SubtitlesPanelContentProps {
  subtitles: SubtitleItem[];
  setSubtitles: React.Dispatch<React.SetStateAction<SubtitleItem[]>>;
  subtitleLanguage: string;
  setSubtitleLanguage: (v: string) => void;
  subtitleEngine: string;
  setSubtitleEngine: (v: string) => void;
  isGeneratingSubtitles: boolean;
  handleGenerateSubtitles: () => void;
  subtitleFileInputRef: React.RefObject<HTMLInputElement>;
  subtitlesToSrt: (subs: SubtitleItem[]) => string;
  playheadTime: number;
  setPlayheadTime: (t: number) => void;
  lang: Language;
}

export default function SubtitlesPanelContent({
  subtitles,
  setSubtitles,
  subtitleLanguage,
  setSubtitleLanguage,
  subtitleEngine,
  setSubtitleEngine,
  isGeneratingSubtitles,
  handleGenerateSubtitles,
  subtitleFileInputRef,
  subtitlesToSrt,
  playheadTime,
  setPlayheadTime,
  lang,
}: SubtitlesPanelContentProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<number>>(new Set());

  // ── Estado de Lista de Reproducción ─────────────────────────────────────
  const [showPlaylist, setShowPlaylist] = React.useState(false);
  const [playlistCopied, setPlaylistCopied] = React.useState(false);
  const [songNames, setSongNames] = React.useState<string[]>([]);

  // Agrupar subtítulos por gaps de silencio ≥ GROUP_GAP_SECONDS
  const groups = React.useMemo(() => {
    if (subtitles.length === 0) return [];
    const result: { groupIdx: number; items: { sub: SubtitleItem; globalIdx: number }[] }[] = [];
    let currentGroup: { sub: SubtitleItem; globalIdx: number }[] = [];
    let groupIdx = 0;

    subtitles.forEach((sub, i) => {
      if (i === 0) {
        currentGroup.push({ sub, globalIdx: i });
      } else {
        const gap = sub.start - subtitles[i - 1].end;
        if (gap >= GROUP_GAP_SECONDS) {
          result.push({ groupIdx, items: currentGroup });
          groupIdx++;
          currentGroup = [{ sub, globalIdx: i }];
        } else {
          currentGroup.push({ sub, globalIdx: i });
        }
      }
    });
    if (currentGroup.length > 0) result.push({ groupIdx, items: currentGroup });
    return result;
  }, [subtitles]);

  const hasGroups = groups.length > 1;

  // Sincronizar nombres de canciones cuando cambian los grupos
  React.useEffect(() => {
    setSongNames(prev => {
      const next: string[] = [];
      for (let i = 0; i < groups.length; i++) {
        next.push(prev[i] ?? (lang === 'es' ? `Canción ${i + 1}` : `Song ${i + 1}`));
      }
      return next;
    });
  }, [groups.length, lang]);

  const toggleGroup = (idx: number) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  /** Formatea segundos a MM:SS / H:MM:SS para timestamps de YouTube */
  const fmtTimestamp = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  /** Genera el texto de playlist para la descripción de YouTube */
  const playlistText = React.useMemo(() => {
    return groups
      .map(({ groupIdx, items }) => {
        const start = items[0].sub.start;
        const name = songNames[groupIdx] ?? (lang === 'es' ? `Canción ${groupIdx + 1}` : `Song ${groupIdx + 1}`);
        return `${fmtTimestamp(start)} ${name}`;
      })
      .join('\n');
  }, [groups, songNames, lang]);

  const handleCopyPlaylist = () => {
    navigator.clipboard.writeText(playlistText).then(() => {
      setPlaylistCopied(true);
      toast.success(lang === 'es' ? '✅ Lista copiada al portapapeles' : '✅ Playlist copied!');
      setTimeout(() => setPlaylistCopied(false), 2500);
    });
  };

  const maxDuration = React.useMemo(
    () => Math.max(...subtitles.map(s => s.end - s.start), 0.1),
    [subtitles]
  );

  const filteredSubtitles = React.useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return subtitles.filter(s => s.text.toLowerCase().includes(q));
  }, [subtitles, searchQuery]);

  return (
    <div className="flex flex-col gap-2 flex-1 overflow-hidden">
      {/* ── Controles de Generación ─────────────────────────────────────── */}
      <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
            <span>🎧</span>
            <span>Subtitulador Whisper IA</span>
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 font-mono text-emerald-400 font-bold">
            PISTA S1
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] text-zinc-400 font-semibold block mb-0.5">Idioma</label>
            <select
              value={subtitleLanguage}
              onChange={e => setSubtitleLanguage(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs cursor-pointer focus:border-emerald-500 focus:outline-none"
            >
              <option value="es">🇪🇸 Español</option>
              <option value="en">🇺🇸 English</option>
              <option value="pt">🇧🇷 Português</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="de">🇩🇪 Deutsch</option>
              <option value="it">🇮🇹 Italiano</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-zinc-400 font-semibold block mb-0.5">Motor</label>
            <select
              value={subtitleEngine}
              onChange={e => setSubtitleEngine(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs cursor-pointer focus:border-emerald-500 focus:outline-none"
            >
              <option value="local_cpu">💻 CPU Local</option>
              <option value="local_gpu">⚡ GPU (CUDA)</option>
              <option value="openai_api">☁️ OpenAI API</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerateSubtitles}
          disabled={isGeneratingSubtitles}
          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-950/50 cursor-pointer transition-all disabled:opacity-50"
        >
          {isGeneratingSubtitles ? (
            <><span className="animate-spin">⏳</span><span>{lang === 'es' ? 'Analizando audio...' : 'Transcribing...'}</span></>
          ) : (
            <><span>✨</span><span>{lang === 'es' ? 'Generar Subtítulos con IA' : 'Generate AI Subtitles'}</span></>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => subtitleFileInputRef.current?.click()}
            className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-semibold border border-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <span>📂</span><span>Importar SRT</span>
          </button>
          {subtitles.length > 0 && (
            <button
              onClick={() => {
                const blob = new Blob([subtitlesToSrt(subtitles)], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `subtitulos_${Date.now()}.srt`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success(lang === 'es' ? 'Archivo SRT descargado' : 'SRT downloaded');
              }}
              className="py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-emerald-300 text-[11px] font-semibold border border-zinc-800 flex items-center gap-1 cursor-pointer"
              title="Descargar archivo .SRT"
            >
              <span>📥</span><span>SRT</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Header de la lista + búsqueda ───────────────────────────────── */}
      {subtitles.length > 0 && (
        <div className="flex flex-col gap-1.5 shrink-0">
          {/* Fila: contador + botón playlist + vaciar */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider shrink-0">
              {lang === 'es' ? `${subtitles.length} líneas` : `${subtitles.length} lines`}
              {hasGroups && (
                <span className="ml-1.5 text-zinc-600">· {groups.length} {lang === 'es' ? 'segs.' : 'segs.'}</span>
              )}
            </span>

            <div className="flex items-center gap-1.5 ml-auto">
              {hasGroups && (
                <button
                  onClick={() => setShowPlaylist(v => !v)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                    showPlaylist
                      ? 'bg-violet-900/60 border-violet-600/60 text-violet-300'
                      : 'bg-zinc-900 border-zinc-700/60 text-zinc-400 hover:border-violet-700/60 hover:text-violet-300'
                  }`}
                  title={lang === 'es' ? 'Generar lista de reproducción para YouTube' : 'Generate YouTube playlist timestamps'}
                >
                  <span>🎵</span>
                  <span>{lang === 'es' ? 'Lista YT' : 'YT List'}</span>
                </button>
              )}
              <button
                onClick={() => {
                  setSubtitles([]);
                  setShowPlaylist(false);
                  toast.info(lang === 'es' ? 'Pista S1 vaciada' : 'S1 track cleared');
                }}
                className="text-[10px] text-red-400/70 hover:text-red-300 cursor-pointer transition-colors"
              >
                {lang === 'es' ? 'Vaciar' : 'Clear'}
              </button>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-[11px]">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={lang === 'es' ? 'Buscar en subtítulos...' : 'Search subtitles...'}
              className="w-full pl-6 pr-3 py-1.5 text-[11px] bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-[11px]"
              >✕</button>
            )}
          </div>

          {/* ── Panel de Lista de Reproducción (expandible) ─────────────── */}
          {showPlaylist && hasGroups && (
            <div className="rounded-xl border border-violet-700/40 bg-violet-950/20 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-violet-700/30">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎵</span>
                  <div>
                    <p className="text-[11px] font-bold text-violet-300">
                      {lang === 'es' ? 'Lista de Reproducción' : 'Playlist Timestamps'}
                    </p>
                    <p className="text-[9px] text-zinc-500 mt-px">
                      {lang === 'es'
                        ? 'Edita los nombres y copia los timestamps para la descripción de YouTube'
                        : 'Edit names and copy timestamps for your YouTube description'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCopyPlaylist}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                    playlistCopied
                      ? 'bg-emerald-900/60 border-emerald-600/60 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-violet-600 hover:text-violet-300'
                  }`}
                >
                  <span>{playlistCopied ? '✅' : '📋'}</span>
                  <span>{playlistCopied ? (lang === 'es' ? 'Copiado' : 'Copied') : (lang === 'es' ? 'Copiar' : 'Copy')}</span>
                </button>
              </div>

              {/* Filas de canciones editables */}
              <div className="flex flex-col divide-y divide-violet-900/30 max-h-[200px] overflow-y-auto minimal-scrollbar">
                {groups.map(({ groupIdx, items }) => {
                  const startSec = items[0].sub.start;
                  const endSec = items[items.length - 1].sub.end;
                  const durationSec = Math.round(endSec - startSec);
                  return (
                    <div key={groupIdx} className="flex items-center gap-2 px-3 py-1.5 hover:bg-violet-900/10 transition-colors">
                      <span className="text-[11px] font-mono font-bold text-violet-400 shrink-0 w-12">
                        {fmtTimestamp(startSec)}
                      </span>
                      <input
                        type="text"
                        value={songNames[groupIdx] ?? ''}
                        onChange={e => setSongNames(prev => {
                          const next = [...prev];
                          next[groupIdx] = e.target.value;
                          return next;
                        })}
                        className="flex-1 bg-transparent text-[11px] text-zinc-200 border-b border-transparent focus:border-violet-500 focus:outline-none py-0 placeholder-zinc-600"
                        placeholder={lang === 'es' ? `Canción ${groupIdx + 1}` : `Song ${groupIdx + 1}`}
                      />
                      <span className="text-[9px] font-mono text-zinc-600 shrink-0">
                        {fmtTimestamp(durationSec)}
                      </span>
                      <span className="text-[9px] text-zinc-700 shrink-0">{items.length}L</span>
                    </div>
                  );
                })}
              </div>

              {/* Preview del texto generado */}
              <div className="px-3 py-2 border-t border-violet-700/30">
                <p className="text-[9px] uppercase font-bold text-zinc-600 mb-1">
                  {lang === 'es' ? 'Preview para descripción:' : 'Description preview:'}
                </p>
                <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed select-all">
                  {playlistText}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Lista principal ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0 flex-1 overflow-y-auto minimal-scrollbar pr-0.5">
        {subtitles.length === 0 ? (
          <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/50 text-center text-zinc-500 text-xs flex flex-col items-center gap-2 mt-1">
            <span className="text-2xl">🎧</span>
            <span>
              {lang === 'es'
                ? 'No hay subtítulos en la pista S1. Haz clic en «Generar con IA» o importa un .srt'
                : 'No subtitles on track S1. Click "Generate with AI" or import .srt'}
            </span>
          </div>
        ) : filteredSubtitles !== null ? (
          /* Modo búsqueda: lista plana filtrada */
          <div className="flex flex-col gap-px">
            {filteredSubtitles.length === 0 ? (
              <p className="text-center text-zinc-600 text-[11px] py-4">
                {lang === 'es' ? 'Sin resultados' : 'No results'}
              </p>
            ) : filteredSubtitles.map(sub => {
              const globalIdx = subtitles.indexOf(sub);
              const isActive = playheadTime >= sub.start && playheadTime <= sub.end;
              const dur = sub.end - sub.start;
              return (
                <SubtitleRow
                  key={sub.id}
                  sub={sub}
                  globalIdx={globalIdx}
                  isActive={isActive}
                  dur={dur}
                  maxDuration={maxDuration}
                  onSeek={() => setPlayheadTime(sub.start)}
                  onDelete={() => setSubtitles(prev => prev.filter(s => s.id !== sub.id))}
                  onTextChange={text => setSubtitles(prev => prev.map(s => s.id === sub.id ? { ...s, text } : s))}
                />
              );
            })}
          </div>
        ) : hasGroups ? (
          /* Modo agrupado: grupos colapsables */
          <div className="flex flex-col gap-1.5">
            {groups.map(({ groupIdx, items }) => {
              const isCollapsed = collapsedGroups.has(groupIdx);
              const groupStart = items[0].sub.start;
              const groupDurMin = Math.floor(groupStart / 60);
              const groupDurSec = Math.round(groupStart % 60);
              const activeInGroup = items.some(({ sub }) => playheadTime >= sub.start && playheadTime <= sub.end);

              return (
                <div key={groupIdx} className="flex flex-col gap-px">
                  <button
                    onClick={() => toggleGroup(groupIdx)}
                    className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left transition-all ${
                      activeInGroup
                        ? 'bg-amber-950/30 border border-amber-700/40'
                        : 'bg-zinc-900/60 border border-zinc-800/60 hover:border-zinc-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'} text-zinc-500`}>▶</span>
                      <span className={`text-[11px] font-bold truncate ${activeInGroup ? 'text-amber-300' : 'text-zinc-300'}`}>
                        {lang === 'es' ? `Segmento ${groupIdx + 1}` : `Segment ${groupIdx + 1}`}
                      </span>
                      {activeInGroup && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      )}
                    </div>
                    <span className="text-[9px] font-mono text-zinc-500 shrink-0">
                      {groupDurMin}:{String(groupDurSec).padStart(2, '0')} · {items.length} {lang === 'es' ? 'líneas' : 'lines'}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="flex flex-col gap-px ml-1 pl-2 border-l border-zinc-800/50">
                      {items.map(({ sub, globalIdx }) => {
                        const isActive = playheadTime >= sub.start && playheadTime <= sub.end;
                        const dur = sub.end - sub.start;
                        return (
                          <SubtitleRow
                            key={sub.id}
                            sub={sub}
                            globalIdx={globalIdx}
                            isActive={isActive}
                            dur={dur}
                            maxDuration={maxDuration}
                            onSeek={() => setPlayheadTime(sub.start)}
                            onDelete={() => setSubtitles(prev => prev.filter(s => s.id !== sub.id))}
                            onTextChange={text => setSubtitles(prev => prev.map(s => s.id === sub.id ? { ...s, text } : s))}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Modo sin grupos: lista plana compacta */
          <div className="flex flex-col gap-px">
            {subtitles.map((sub, globalIdx) => {
              const isActive = playheadTime >= sub.start && playheadTime <= sub.end;
              const dur = sub.end - sub.start;
              return (
                <SubtitleRow
                  key={sub.id}
                  sub={sub}
                  globalIdx={globalIdx}
                  isActive={isActive}
                  dur={dur}
                  maxDuration={maxDuration}
                  onSeek={() => setPlayheadTime(sub.start)}
                  onDelete={() => setSubtitles(prev => prev.filter(s => s.id !== sub.id))}
                  onTextChange={text => setSubtitles(prev => prev.map(s => s.id === sub.id ? { ...s, text } : s))}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
