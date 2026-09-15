'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Language } from '@/app/translations';

export interface TimelineCut {
  id: string;
  clipPath: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  loopToAudio: boolean;
  panX?: number;
  panY?: number;
  zoom?: number;
  isReversed?: boolean;
}

export interface OverlayElement {
  id: string;
  type: 'subscribe_cta' | 'like_cta' | 'lower_third' | 'channel_logo' | 'text';
  text: string;
  xPercent: number;
  yPercent: number;
  scale: number;
  startTime: number;
  duration: number;
}

export interface TimelineAudioCut {
  id: string;
  audioPath: string;
  name: string;
  startTime: number;
  duration: number;
  volume: number;
}

export interface SubtitleItem {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface TimelineProProps {
  lang: Language;
  totalDuration: number;
  playheadTime: number;
  onSeek: (time: number) => void;
  // Clips
  cuts: TimelineCut[];
  onUpdateCuts: (cuts: TimelineCut[]) => void;
  selectedCutId: string | null;
  onSelectCut: (id: string | null) => void;
  onSplitAtPlayhead: () => void;
  // Overlays
  overlays: OverlayElement[];
  onUpdateOverlays: (overlays: OverlayElement[]) => void;
  selectedOverlayId: string | null;
  onSelectOverlay: (id: string | null) => void;
  // Audio Cuts (Pista A1 Multipista de Música)
  audioCuts?: TimelineAudioCut[];
  onUpdateAudioCuts?: (cuts: TimelineAudioCut[]) => void;
  selectedAudioCutId?: string | null;
  onSelectAudioCut?: (id: string | null) => void;
  // Audio legacy / global
  musicName?: string;
  musicVolume: number;
  onChangeMusicVolume: (vol: number) => void;
  muteOriginalAudio: boolean;
  onToggleMuteOriginal: () => void;
  onExtractAudio?: (clipPath: string) => void;
  onUploadMusic?: (files: File[]) => void;
  onDropMusicPath?: (path: string, name: string) => void;
  onClearMusic?: () => void;
  // Video uploads/drops
  onUploadVideos?: (files: File[]) => void;
  onDropVideoPath?: (path: string, name: string) => void;
  // Subtítulos
  subtitles?: SubtitleItem[];
}

export default function TimelinePro({
  lang,
  totalDuration,
  playheadTime,
  onSeek,
  cuts,
  onUpdateCuts,
  selectedCutId,
  onSelectCut,
  onSplitAtPlayhead,
  overlays,
  onUpdateOverlays,
  selectedOverlayId,
  onSelectOverlay,
  // Audio Cuts (Pista A1 Multipista de Música)
  audioCuts = [],
  onUpdateAudioCuts,
  selectedAudioCutId = null,
  onSelectAudioCut,
  // Audio legacy / global
  musicName,
  musicVolume,
  onChangeMusicVolume,
  muteOriginalAudio,
  onToggleMuteOriginal,
  onExtractAudio,
  onUploadMusic,
  onDropMusicPath,
  onClearMusic,
  onUploadVideos,
  onDropVideoPath,
  subtitles = [],
}: TimelineProProps) {
  // Zoom: píxeles por segundo (0.2 px/s para proyectos de 1h+ hasta 60 px/s para cortes finos)
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(20);
  const [isSnapping, setIsSnapping] = useState<boolean>(true);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState<boolean>(false);
  const [draggingOverlayId, setDraggingOverlayId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [overlayStartOrigin, setOverlayStartOrigin] = useState<number>(0);

  // ── Trimming & Arrastre Interactivo de Pistas de Audio (A1) ──
  const [trimmingAudioState, setTrimmingAudioState] = useState<{
    cutId: string;
    edge: 'left' | 'right';
    startX: number;
    originalStart: number;
    originalDuration: number;
  } | null>(null);
  const [draggingAudioId, setDraggingAudioId] = useState<string | null>(null);
  const [dragAudioStartX, setDragAudioStartX] = useState<number>(0);
  const [audioStartOrigin, setAudioStartOrigin] = useState<number>(0);

  // ── Trimming Interactivo de Overlays (Etiquetas: In/Out Duration Handles) ──
  const [trimmingOverlayState, setTrimmingOverlayState] = useState<{
    overlayId: string;
    edge: 'left' | 'right';
    startX: number;
    originalStart: number;
    originalDuration: number;
  } | null>(null);

  // ── Trimming Interactivo de Clips (In/Out Handles) ──
  const [trimmingState, setTrimmingState] = useState<{
    cutId: string;
    edge: 'left' | 'right';
    startX: number;
    originalStart: number;
    originalEnd: number;
    originalDuration: number;
  } | null>(null);
  const [draggedCutIndex, setDraggedCutIndex] = useState<number | null>(null);

  // Refs para inputs de subida directa
  const musicFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // ── Portapapeles & Menú Contextual (Clic Derecho) ──
  const [clipboard, setClipboard] = useState<{ type: 'cut' | 'overlay' | 'audio'; data: any } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    itemType: 'cut' | 'overlay' | 'audio' | 'track';
    itemId?: string;
  } | null>(null);

  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  const effectiveDuration = totalDuration > 0 ? totalDuration : 30;
  const timelineWidthPx = Math.max(effectiveDuration * pixelsPerSecond, 800);

  // Formatear segundos a [HH:]MM:SS.ms
  const formatTimecode = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  // Ajustar todo el proyecto visible a la pantalla (Fit to View / Shift+Z)
  const handleFitToView = useCallback(() => {
    if (!timelineScrollRef.current) return;
    const containerWidth = timelineScrollRef.current.clientWidth;
    if (containerWidth > 100 && effectiveDuration > 0) {
      const targetPps = Math.max(0.1, Math.min(100, Number(((containerWidth - 40) / effectiveDuration).toFixed(2))));
      setPixelsPerSecond(targetPps);
      timelineScrollRef.current.scrollLeft = 0;
    }
  }, [effectiveDuration]);

  // Auto-ajuste de escala cuando se carga un proyecto largo (evitar desbordes de 70.000px)
  const hasAutoFittedRef = useRef<boolean>(false);
  useEffect(() => {
    if (totalDuration > 300 && !hasAutoFittedRef.current) {
      hasAutoFittedRef.current = true;
      handleFitToView();
    }
  }, [totalDuration, handleFitToView]);

  // Zoom interactivo con Alt + Rueda / Ctrl + Rueda en la línea de tiempo
  useEffect(() => {
    const scrollEl = timelineScrollRef.current;
    if (!scrollEl) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.25 : 0.8;
        setPixelsPerSecond(prev => Math.max(0.1, Math.min(100, Number((prev * factor).toFixed(2)))));
      }
    };

    scrollEl.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => scrollEl.removeEventListener('wheel', handleNativeWheel);
  }, []);

  // ── ACCIONES: Copiar, Cortar, Pegar, Eliminar, Dividir ──
  const handleCopy = useCallback((targetId?: string, targetType?: 'cut' | 'overlay' | 'audio') => {
    const activeCutId = targetType === 'cut' ? targetId : (targetType ? undefined : selectedCutId);
    const activeOvId = targetType === 'overlay' ? targetId : (targetType ? undefined : selectedOverlayId);
    const activeAudioId = targetType === 'audio' ? targetId : (targetType ? undefined : selectedAudioCutId);

    if (activeCutId) {
      const cut = cuts.find(c => c.id === activeCutId);
      if (cut) setClipboard({ type: 'cut', data: { ...cut } });
    } else if (activeOvId) {
      const ov = overlays.find(o => o.id === activeOvId);
      if (ov) setClipboard({ type: 'overlay', data: { ...ov } });
    } else if (activeAudioId && audioCuts) {
      const audio = audioCuts.find(a => a.id === activeAudioId);
      if (audio) setClipboard({ type: 'audio', data: { ...audio } });
    }
    setContextMenu(null);
  }, [selectedCutId, selectedOverlayId, selectedAudioCutId, cuts, overlays, audioCuts]);

  const handleDelete = useCallback((targetId?: string, targetType?: 'cut' | 'overlay' | 'audio') => {
    const activeCutId = targetType === 'cut' ? targetId : (targetType ? undefined : selectedCutId);
    const activeOvId = targetType === 'overlay' ? targetId : (targetType ? undefined : selectedOverlayId);
    const activeAudioId = targetType === 'audio' ? targetId : (targetType ? undefined : selectedAudioCutId);

    if (activeCutId) {
      onUpdateCuts(cuts.filter(c => c.id !== activeCutId));
      if (selectedCutId === activeCutId) onSelectCut(null);
    } else if (activeOvId) {
      onUpdateOverlays(overlays.filter(o => o.id !== activeOvId));
      if (selectedOverlayId === activeOvId) onSelectOverlay(null);
    } else if (activeAudioId && onUpdateAudioCuts && audioCuts) {
      onUpdateAudioCuts(audioCuts.filter(a => a.id !== activeAudioId));
      if (selectedAudioCutId === activeAudioId) onSelectAudioCut?.(null);
    }
    setContextMenu(null);
  }, [selectedCutId, selectedOverlayId, selectedAudioCutId, cuts, overlays, audioCuts, onUpdateCuts, onUpdateOverlays, onUpdateAudioCuts, onSelectCut, onSelectOverlay, onSelectAudioCut]);

  const handleCut = useCallback((targetId?: string, targetType?: 'cut' | 'overlay' | 'audio') => {
    handleCopy(targetId, targetType);
    handleDelete(targetId, targetType);
  }, [handleCopy, handleDelete]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;

    if (clipboard.type === 'cut') {
      const cutData = clipboard.data as TimelineCut;
      const newCut: TimelineCut = {
        ...cutData,
        id: `cut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      };
      const newCuts = [...cuts, newCut];
      onUpdateCuts(newCuts);
      onSelectCut(newCut.id);
    } else if (clipboard.type === 'overlay') {
      const ovData = clipboard.data as OverlayElement;
      const newOverlay: OverlayElement = {
        ...ovData,
        id: `ov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        startTime: Number(playheadTime.toFixed(1)),
      };
      const newOverlays = [...overlays, newOverlay];
      onUpdateOverlays(newOverlays);
      onSelectOverlay(newOverlay.id);
    } else if (clipboard.type === 'audio' && onUpdateAudioCuts && audioCuts) {
      const audioData = clipboard.data as TimelineAudioCut;
      const newAudio: TimelineAudioCut = {
        ...audioData,
        id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        startTime: Number(playheadTime.toFixed(1)),
      };
      onUpdateAudioCuts([...audioCuts, newAudio]);
      onSelectAudioCut?.(newAudio.id);
    }
    setContextMenu(null);
  }, [clipboard, cuts, overlays, audioCuts, playheadTime, onUpdateCuts, onUpdateOverlays, onUpdateAudioCuts, onSelectCut, onSelectOverlay, onSelectAudioCut]);

  const handleToggleLoop = useCallback((cutId: string) => {
    onUpdateCuts(cuts.map(c => c.id === cutId ? { ...c, loopToAudio: !c.loopToAudio } : c));
    setContextMenu(null);
  }, [cuts, onUpdateCuts]);

  const handleToggleReverse = useCallback((cutId: string) => {
    onUpdateCuts(cuts.map(c => c.id === cutId ? { ...c, isReversed: !c.isReversed } : c));
    setContextMenu(null);
  }, [cuts, onUpdateCuts]);

  // Cerrar menú contextual al hacer clic fuera
  useEffect(() => {
    const handleWindowClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [contextMenu]);

  // ── ATAJOS DE TECLADO GLOBALES: Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+B, Supr ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        handleCopy();
      } else if (isCtrl && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        handlePaste();
      } else if (isCtrl && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        handleCut();
      } else if (isCtrl && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        onSplitAtPlayhead();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedCutId || selectedOverlayId || selectedAudioCutId) {
          e.preventDefault();
          handleDelete();
        }
      } else if (e.key === 'Escape') {
        setContextMenu(null);
        onSelectCut(null);
        onSelectOverlay(null);
        onSelectAudioCut?.(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste, handleCut, handleDelete, onSplitAtPlayhead, selectedCutId, selectedOverlayId, selectedAudioCutId, onSelectCut, onSelectOverlay, onSelectAudioCut]);

  // Mover Playhead al hacer clic o arrastrar en la regla de tiempo
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + (timelineScrollRef.current?.scrollLeft || 0);
    const newTime = Math.max(0, Math.min(clickX / pixelsPerSecond, effectiveDuration));
    onSeek(newTime);
    setIsDraggingPlayhead(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPlayhead && rulerRef.current) {
        const rect = rulerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left + (timelineScrollRef.current?.scrollLeft || 0);
        let newTime = Math.max(0, Math.min(clickX / pixelsPerSecond, effectiveDuration));
        
        // Snapping inteligente a cortes cercanos (<0.3s)
        if (isSnapping) {
          let accumulated = 0;
          for (const c of cuts) {
            accumulated += c.duration;
            if (Math.abs(newTime - accumulated) < 0.3) {
              newTime = accumulated;
              break;
            }
          }
        }
        onSeek(newTime);
      }

      // Arrastrar posición de Overlay en la línea de tiempo
      if (draggingOverlayId && !trimmingOverlayState) {
        const deltaX = e.clientX - dragStartX;
        const deltaTime = deltaX / pixelsPerSecond;
        const newStartTime = Math.max(0, overlayStartOrigin + deltaTime);
        onUpdateOverlays(
          overlays.map(o => o.id === draggingOverlayId ? { ...o, startTime: Number(newStartTime.toFixed(1)) } : o)
        );
      }

      // Trimming interactivo de Overlays / Etiquetas (In/Out Duration Handles)
      if (trimmingOverlayState) {
        const deltaX = e.clientX - trimmingOverlayState.startX;
        const deltaTime = deltaX / pixelsPerSecond;
        if (trimmingOverlayState.edge === 'right') {
          const newDuration = Math.max(0.4, Number((trimmingOverlayState.originalDuration + deltaTime).toFixed(1)));
          onUpdateOverlays(
            overlays.map(o => o.id === trimmingOverlayState.overlayId ? { ...o, duration: newDuration } : o)
          );
        } else {
          const origEnd = trimmingOverlayState.originalStart + trimmingOverlayState.originalDuration;
          const newStart = Math.max(0, Math.min(trimmingOverlayState.originalStart + deltaTime, origEnd - 0.4));
          const newDuration = Math.max(0.4, origEnd - newStart);
          onUpdateOverlays(
            overlays.map(o => o.id === trimmingOverlayState.overlayId ? {
              ...o,
              startTime: Number(newStart.toFixed(1)),
              duration: Number(newDuration.toFixed(1))
            } : o)
          );
        }
      }

      // Arrastrar posición de Audio Cut en la línea de tiempo
      if (draggingAudioId && !trimmingAudioState && onUpdateAudioCuts && audioCuts) {
        const deltaX = e.clientX - dragAudioStartX;
        const deltaTime = deltaX / pixelsPerSecond;
        const newStartTime = Math.max(0, audioStartOrigin + deltaTime);
        onUpdateAudioCuts(
          audioCuts.map(a => a.id === draggingAudioId ? { ...a, startTime: Number(newStartTime.toFixed(1)) } : a)
        );
      }

      // Trimming interactivo de Audio Cuts (In/Out Duration Handles)
      if (trimmingAudioState && onUpdateAudioCuts && audioCuts) {
        const deltaX = e.clientX - trimmingAudioState.startX;
        const deltaTime = deltaX / pixelsPerSecond;
        if (trimmingAudioState.edge === 'right') {
          const newDuration = Math.max(0.5, Number((trimmingAudioState.originalDuration + deltaTime).toFixed(1)));
          onUpdateAudioCuts(
            audioCuts.map(a => a.id === trimmingAudioState.cutId ? { ...a, duration: newDuration } : a)
          );
        } else {
          const origEnd = trimmingAudioState.originalStart + trimmingAudioState.originalDuration;
          const newStart = Math.max(0, Math.min(trimmingAudioState.originalStart + deltaTime, origEnd - 0.5));
          const newDuration = Math.max(0.5, origEnd - newStart);
          onUpdateAudioCuts(
            audioCuts.map(a => a.id === trimmingAudioState.cutId ? {
              ...a,
              startTime: Number(newStart.toFixed(1)),
              duration: Number(newDuration.toFixed(1))
            } : a)
          );
        }
      }

      // Trimming interactivo de clips (Left = Start Time, Right = End Time)
      if (trimmingState) {
        const deltaX = e.clientX - trimmingState.startX;
        const deltaTime = deltaX / pixelsPerSecond;
        if (trimmingState.edge === 'left') {
          const newStart = Math.max(0, Math.min(trimmingState.originalStart + deltaTime, trimmingState.originalEnd - 0.3));
          const newDuration = Math.max(0.3, trimmingState.originalEnd - newStart);
          onUpdateCuts(
            cuts.map(c => c.id === trimmingState.cutId ? {
              ...c,
              startTime: Number(newStart.toFixed(2)),
              duration: Number(newDuration.toFixed(2)),
            } : c)
          );
        } else {
          const newEnd = Math.max(trimmingState.originalStart + 0.3, trimmingState.originalEnd + deltaTime);
          const newDuration = Math.max(0.3, newEnd - trimmingState.originalStart);
          onUpdateCuts(
            cuts.map(c => c.id === trimmingState.cutId ? {
              ...c,
              endTime: Number(newEnd.toFixed(2)),
              duration: Number(newDuration.toFixed(2)),
            } : c)
          );
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      setDraggingOverlayId(null);
      setTrimmingState(null);
      setTrimmingOverlayState(null);
      setDraggingAudioId(null);
      setTrimmingAudioState(null);
    };

    if (isDraggingPlayhead || draggingOverlayId || trimmingState || trimmingOverlayState || draggingAudioId || trimmingAudioState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, draggingOverlayId, trimmingState, trimmingOverlayState, draggingAudioId, trimmingAudioState, pixelsPerSecond, effectiveDuration, isSnapping, cuts, dragStartX, overlayStartOrigin, overlays, dragAudioStartX, audioStartOrigin, audioCuts, onSeek, onUpdateOverlays, onUpdateCuts, onUpdateAudioCuts]);

  // Generar marcas adaptativas de la regla de tiempo (estilo Premiere / DaVinci)
  const rulerTicks = useMemo(() => {
    const ticks = [];
    let stepSeconds = 1;
    let majorInterval = 5;

    if (pixelsPerSecond >= 80) {
      stepSeconds = 0.5;
      majorInterval = 2;
    } else if (pixelsPerSecond >= 40) {
      stepSeconds = 1;
      majorInterval = 5;
    } else if (pixelsPerSecond >= 15) {
      stepSeconds = 2;
      majorInterval = 10;
    } else if (pixelsPerSecond >= 7) {
      stepSeconds = 5;
      majorInterval = 15;
    } else if (pixelsPerSecond >= 3) {
      stepSeconds = 10;
      majorInterval = 30;
    } else if (pixelsPerSecond >= 1.2) {
      stepSeconds = 30;
      majorInterval = 60; // 1 min
    } else if (pixelsPerSecond >= 0.5) {
      stepSeconds = 60; // 1 min
      majorInterval = 300; // 5 min
    } else if (pixelsPerSecond >= 0.2) {
      stepSeconds = 120; // 2 min
      majorInterval = 600; // 10 min
    } else {
      stepSeconds = 300; // 5 min
      majorInterval = 900; // 15 min
    }

    // Seguridad estricta para evitar congelamientos del DOM: nunca superar 350 nodos
    const maxAllowedTicks = 350;
    if (effectiveDuration / stepSeconds > maxAllowedTicks) {
      const minStep = Math.ceil(effectiveDuration / maxAllowedTicks);
      if (minStep > 600) stepSeconds = Math.ceil(minStep / 300) * 300;
      else if (minStep > 120) stepSeconds = Math.ceil(minStep / 60) * 60;
      else if (minStep > 30) stepSeconds = Math.ceil(minStep / 30) * 30;
      else if (minStep > 10) stepSeconds = Math.ceil(minStep / 10) * 10;
      else stepSeconds = Math.ceil(minStep / 5) * 5;
      majorInterval = stepSeconds * 5;
    }

    for (let sec = 0; sec <= effectiveDuration; sec += stepSeconds) {
      const roundedSec = Number(sec.toFixed(2));
      const isMajor = Math.abs(roundedSec % majorInterval) < 0.01 || Math.abs((roundedSec % majorInterval) - majorInterval) < 0.01;
      ticks.push({
        sec: roundedSec,
        left: roundedSec * pixelsPerSecond,
        isMajor,
      });
    }
    return ticks;
  }, [effectiveDuration, pixelsPerSecond]);

  return (
    <div className="flex flex-col bg-[#0b0b0f] border border-zinc-800/90 rounded-2xl overflow-hidden shadow-2xl select-none relative">
      
      {/* ── TOOLBAR DE EDICIÓN PRO ────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#121217] border-b border-zinc-800/80 text-xs">
        
        <div className="flex items-center gap-2">
          <span className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
            <span>🎛️</span>
            <span>Línea de Tiempo</span>
          </span>
        </div>

        {/* Timecode Actual del Playhead */}
        <div className="flex items-center gap-2 bg-black/60 border border-zinc-800 px-3 py-1 rounded-xl font-mono">
          <span className="text-zinc-500 text-[10px]">TIME</span>
          <span className="text-purple-300 font-bold text-sm tracking-wider">
            {formatTimecode(playheadTime)}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400 text-xs">
            {formatTimecode(effectiveDuration)}
          </span>
        </div>

        {/* Zoom Controls con soporte para proyectos largos y cortes finos */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleFitToView}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-purple-300 hover:text-white flex items-center gap-1 font-bold text-[10px] cursor-pointer transition-colors border border-zinc-700/60"
            title="Ajustar todo el proyecto a la pantalla (Shift + Z)"
          >
            <span>⛶</span>
            <span>Ajustar</span>
          </button>
          <button
            onClick={() => setPixelsPerSecond(prev => Math.max(0.1, Number((prev / 1.35).toFixed(2))))}
            className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold cursor-pointer text-xs"
            title="Alejar Zoom (Alt + Rueda abajo)"
          >
            -
          </button>
          <input
            type="range"
            min="0.1"
            max="100"
            step="0.1"
            value={pixelsPerSecond}
            onChange={(e) => setPixelsPerSecond(parseFloat(e.target.value) || 1)}
            className="w-24 accent-purple-500 cursor-pointer"
            title={`Escala: ${pixelsPerSecond.toFixed(1)} px/segundo (Alt + Rueda para zoom interactivo)`}
          />
          <button
            onClick={() => setPixelsPerSecond(prev => Math.min(100, Number((prev * 1.35).toFixed(2))))}
            className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold cursor-pointer text-xs"
            title="Acercar Zoom (Alt + Rueda arriba)"
          >
            +
          </button>
          <span className="text-[10px] font-mono text-zinc-400 min-w-[48px] text-right">
            {pixelsPerSecond < 1 ? `${pixelsPerSecond.toFixed(1)} px/s` : `${Math.round(pixelsPerSecond)} px/s`}
          </span>
        </div>
      </div>

      {/* ── CONTENEDOR MULTIPISTA CON SCROLL Y TRACK HEADERS ───────────────── */}
      <div className="flex flex-1 overflow-hidden relative min-h-[260px]">

        {/* ── COLUMNA FIJA IZQUIERDA: TRACK HEADERS (V1, T1, A1, A2, S1) ────── */}
        <div className="w-36 bg-[#0f0f14] border-r border-zinc-800/90 flex flex-col shrink-0 z-20 shadow-xl">
          
          {/* Header de la Regla */}
          <div className="h-8 border-b border-zinc-800/80 px-2.5 flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            <span>Pistas</span>
            <span>Mute</span>
          </div>

          {/* V1: Pista de Video */}
          <div className="h-20 border-b border-zinc-800/70 px-2.5 flex items-center justify-between bg-zinc-950/40">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-purple-950 text-purple-300 font-mono font-bold text-[10px] flex items-center justify-center border border-purple-800/60">
                V1
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-200">Video</span>
                <span className="text-[9px] text-zinc-500 font-mono">{cuts.length} clips</span>
              </div>
            </div>
            <button
              onClick={onToggleMuteOriginal}
              className={`text-xs p-1.5 rounded-lg border transition-all cursor-pointer ${
                muteOriginalAudio
                  ? 'bg-amber-950/70 border-amber-600/70 text-amber-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
              title={muteOriginalAudio ? 'Audio de video silenciado (Clic para activar)' : 'Audio de video activo (Clic para silenciar)'}
            >
              {muteOriginalAudio ? '🔇' : '🔊'}
            </button>
          </div>

          {/* T1: Pista de Overlays / Stickers */}
          <div className="h-12 border-b border-zinc-800/70 px-2.5 flex items-center justify-between bg-zinc-950/20">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-blue-950 text-blue-300 font-mono font-bold text-[10px] flex items-center justify-center border border-blue-800/60">
                T1
              </span>
              <span className="text-xs font-bold text-zinc-300">Overlays</span>
            </div>
            <span className="text-[9px] text-blue-400 font-mono">{overlays.length}</span>
          </div>

          {/* A1: Pista de Música & Soundscapes */}
          <div className="h-16 border-b border-zinc-800/70 px-2.5 flex flex-col justify-center gap-1 bg-zinc-950/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-indigo-950 text-indigo-300 font-mono font-bold text-[10px] flex items-center justify-center border border-indigo-800/60">
                  A1
                </span>
                <span className="text-xs font-bold text-zinc-200 truncate">Música</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={musicVolume}
                onChange={(e) => onChangeMusicVolume(parseFloat(e.target.value))}
                className="w-full h-1 accent-indigo-500 cursor-pointer"
              />
              <span className="text-[9px] font-mono text-zinc-400 w-5">{Math.round(musicVolume * 100)}%</span>
            </div>
          </div>

          {/* S1: Pista de Subtítulos */}
          <div className="h-12 px-2.5 flex items-center justify-between bg-zinc-950/20">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-emerald-950 text-emerald-300 font-mono font-bold text-[10px] flex items-center justify-center border border-emerald-800/60">
                S1
              </span>
              <span className="text-xs font-bold text-zinc-300">Subtítulos</span>
            </div>
            <span className="text-[9px] text-emerald-400 font-mono">{subtitles.length}</span>
          </div>
        </div>

        {/* ── AREA SCROLLABLE DERECHA: REGLA DE TIEMPO + PISTAS + PLAYHEAD ──── */}
        <div
          ref={timelineScrollRef}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({
              x: Math.min(e.clientX, window.innerWidth - 200),
              y: Math.min(e.clientY, window.innerHeight - 240),
              itemType: 'track',
            });
          }}
          className="flex-1 overflow-x-auto minimal-scrollbar relative bg-[#09090c]"
        >
          <div
            style={{ width: `${timelineWidthPx}px` }}
            className="flex flex-col relative h-full min-w-full"
          >
            {/* ── 1. REGLA GRADUADA SUPERIOR (RULER) ───────────────────────── */}
            <div
              ref={rulerRef}
              onMouseDown={handleRulerMouseDown}
              className="h-8 border-b border-zinc-800/90 relative bg-[#14141a] cursor-pointer"
            >
              {rulerTicks.map(t => (
                <div
                  key={t.sec}
                  style={{ left: `${t.left}px` }}
                  className="absolute top-0 bottom-0 flex flex-col justify-end"
                >
                  <div
                    className={`w-[1px] ${t.isMajor ? 'h-3.5 bg-zinc-500' : 'h-2 bg-zinc-700'}`}
                  />
                  {t.isMajor && (
                    <span className="absolute top-1 left-1 text-[9px] font-mono text-zinc-400 font-semibold select-none">
                      {t.sec >= 3600
                        ? `${Math.floor(t.sec / 3600)}:${(Math.floor((t.sec % 3600) / 60)).toString().padStart(2, '0')}:${(t.sec % 60).toString().padStart(2, '0')}`
                        : `${Math.floor(t.sec / 60)}:${(t.sec % 60).toString().padStart(2, '0')}`}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* ── 2. PISTA V1: VIDEO Y CORTES VIRTUALES (CON CANAL DE AUDIO EMBEBIDO) ── */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  onUploadVideos?.(Array.from(e.dataTransfer.files));
                } else {
                  const dataStr = e.dataTransfer.getData('application/json');
                  if (dataStr) {
                    try {
                      const data = JSON.parse(dataStr);
                      if (data.path) onDropVideoPath?.(data.path, data.name || data.path.split(/[/\\]/).pop() || 'Clip');
                    } catch {}
                  }
                }
              }}
              className="h-20 border-b border-zinc-800/60 relative flex items-center bg-zinc-950/30 px-0"
            >
              {cuts.length === 0 ? (
                <div
                  onClick={() => videoFileInputRef.current?.click()}
                  className="h-14 w-full rounded-lg border border-dashed border-purple-900/60 hover:border-purple-500/80 bg-purple-950/20 hover:bg-purple-950/40 flex items-center justify-center gap-2 text-xs text-purple-300/80 hover:text-purple-200 font-medium transition-all cursor-pointer select-none"
                >
                  <span className="text-base">🎬</span>
                  <span>{lang === 'es' ? 'Arrastra videos aquí o haz clic para importar (MP4/MOV)' : 'Drag video clips here or click to import (MP4/MOV)'}</span>
                </div>
              ) : (
                cuts.map((cut, idx) => {
                  const cutWidth = Math.max(cut.duration * pixelsPerSecond, 2);
                  const isSelected = selectedCutId === cut.id;
                  return (
                    <div
                      key={cut.id}
                      draggable={!trimmingState}
                      onDragStart={(e) => {
                        setDraggedCutIndex(idx);
                        e.dataTransfer.setData('text/plain', String(idx));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (draggedCutIndex !== null && draggedCutIndex !== idx) {
                          const newCuts = [...cuts];
                          const [moved] = newCuts.splice(draggedCutIndex, 1);
                          newCuts.splice(idx, 0, moved);
                          onUpdateCuts(newCuts);
                          setDraggedCutIndex(null);
                        }
                      }}
                      onClick={() => onSelectCut(cut.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectCut(cut.id);
                        setContextMenu({
                          x: Math.min(e.clientX, window.innerWidth - 200),
                          y: Math.min(e.clientY, window.innerHeight - 240),
                          itemType: 'cut',
                          itemId: cut.id,
                        });
                      }}
                      style={{ width: `${cutWidth}px` }}
                      className={`h-16 rounded-lg relative flex flex-col justify-between overflow-hidden ${
                        cutWidth >= 40 ? 'px-2 py-1.5' : 'p-0.5'
                      } select-none transition-all cursor-pointer border shrink-0 ${
                        isSelected
                          ? 'bg-zinc-900 border-purple-400 shadow-xl shadow-purple-950/50 ring-1 ring-purple-400'
                          : 'bg-zinc-950/90 border-zinc-800 hover:border-purple-600/70'
                      } ${cut.loopToAudio ? 'ring-1 ring-amber-400' : ''}`}
                      title={`Clip ${idx + 1}: ${cut.name} (${cut.duration.toFixed(1)}s)`}
                    >
                      {/* Handles de recorte interactivo (solo si cutWidth >= 24px) */}
                      {cutWidth >= 24 && (
                        <>
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectCut(cut.id);
                              setTrimmingState({
                                cutId: cut.id,
                                edge: 'left',
                                startX: e.clientX,
                                originalStart: cut.startTime,
                                originalEnd: cut.endTime,
                                originalDuration: cut.duration,
                              });
                            }}
                            className="absolute left-0 top-0 bottom-0 w-2 hover:w-3 bg-purple-500/30 hover:bg-purple-400 cursor-ew-resize z-20 flex items-center justify-center transition-all group/lhandle rounded-l-lg"
                            title="Recortar inicio (In-point)"
                          >
                            <div className="w-[1.5px] h-4 bg-white/70 group-hover/lhandle:bg-white rounded" />
                          </div>

                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectCut(cut.id);
                              setTrimmingState({
                                cutId: cut.id,
                                edge: 'right',
                                startX: e.clientX,
                                originalStart: cut.startTime,
                                originalEnd: cut.endTime,
                                originalDuration: cut.duration,
                              });
                            }}
                            className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-purple-500/30 hover:bg-purple-400 cursor-ew-resize z-20 flex items-center justify-center transition-all group/rhandle rounded-r-lg"
                            title="Recortar final (Out-point)"
                          >
                            <div className="w-[1.5px] h-4 bg-white/70 group-hover/rhandle:bg-white rounded" />
                          </div>
                        </>
                      )}

                      {/* Sub-capa Superior: Metadatos de Video */}
                      {cutWidth >= 40 && (
                        <div className="flex items-center justify-between text-[10px] font-bold text-white truncate gap-1 bg-zinc-900/60 px-1.5 py-0.5 rounded">
                          <span className="truncate flex items-center gap-1">
                            <span className="text-purple-400">🎬</span>
                            {cutWidth >= 70 && <span className="truncate">Clip {idx + 1}: {cut.name}</span>}
                          </span>
                          {cutWidth >= 115 && (
                            <div className="flex items-center gap-1 shrink-0">
                              {cut.isReversed && (
                                <span
                                  className="text-[8px] px-1 py-0.2 rounded font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-600/70"
                                  title="Clip invertido (reproduce de atrás hacia adelante)"
                                >
                                  ⏪ REV
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleLoop(cut.id);
                                }}
                                className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold transition-all border cursor-pointer ${
                                  cut.loopToAudio
                                    ? 'bg-amber-500/30 text-amber-300 border-amber-500/70 shadow-sm'
                                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:border-zinc-500'
                                }`}
                                title={cut.loopToAudio ? 'Bucle activo: El clip se repite continuamente' : 'Activar bucle en este clip'}
                              >
                                🔁 {cut.loopToAudio ? 'Loop ON' : 'Loop'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Si el corte es estrecho (entre 18 y 40px), mostrar icono centrado */}
                      {cutWidth >= 18 && cutWidth < 40 && (
                        <div className="flex flex-col items-center justify-center h-full text-purple-300 font-bold text-[10px]">
                          <span>🎬</span>
                        </div>
                      )}

                      {/* Sub-capa Inferior: Gráfica de Audio / Waveform */}
                      {cutWidth >= 60 && (
                        <div className={`flex items-center justify-between px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                          muteOriginalAudio
                            ? 'bg-amber-950/30 border-amber-900/40 text-amber-400/90'
                            : 'bg-indigo-950/40 border-indigo-900/40 text-indigo-300'
                        }`}>
                          <div className="flex items-center gap-1 truncate">
                            <span>{muteOriginalAudio ? '🔇' : '🔊'}</span>
                            {cutWidth >= 110 && (
                              <span className="truncate">
                                {muteOriginalAudio ? 'Audio Mudo' : 'Cámara (100%)'}
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-zinc-400 shrink-0 font-bold">{cut.duration.toFixed(1)}s</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <input
                type="file"
                ref={videoFileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onUploadVideos?.(Array.from(e.target.files));
                    e.target.value = '';
                  }
                }}
                multiple
                accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                className="hidden"
              />
            </div>

            {/* ── 3. PISTA T1: OVERLAYS Y STICKERS INTERACTIVOS ─────────────── */}
            <div className="h-12 border-b border-zinc-800/60 relative flex items-center bg-zinc-950/20 px-0">
              {overlays.length === 0 ? (
                <div className="h-8 w-full rounded border border-dashed border-zinc-900 flex items-center justify-center text-[10px] text-zinc-700 font-mono">
                  Sin stickers o elementos de texto (Inserta uno desde el visualizador)
                </div>
              ) : (
                overlays.map(ov => {
                  const ovLeft = ov.startTime * pixelsPerSecond;
                  const ovWidth = Math.max(ov.duration * pixelsPerSecond, 2);
                  const isSelected = selectedOverlayId === ov.id;
                  return (
                    <div
                      key={ov.id}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onSelectOverlay(ov.id);
                        if (!trimmingOverlayState) {
                          setDraggingOverlayId(ov.id);
                          setDragStartX(e.clientX);
                          setOverlayStartOrigin(ov.startTime);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectOverlay(ov.id);
                        setContextMenu({
                          x: Math.min(e.clientX, window.innerWidth - 200),
                          y: Math.min(e.clientY, window.innerHeight - 240),
                          itemType: 'overlay',
                          itemId: ov.id,
                        });
                      }}
                      style={{ left: `${ovLeft}px`, width: `${ovWidth}px` }}
                      className={`h-8 absolute rounded-lg border flex items-center justify-between ${
                        ovWidth >= 40 ? 'px-2' : 'px-0.5'
                      } text-[10px] font-bold select-none cursor-move transition-all overflow-hidden group/ovblock ${
                        isSelected
                          ? 'bg-blue-900/90 border-blue-400 text-white shadow-lg shadow-blue-950/50 ring-1 ring-blue-400 z-10'
                          : 'bg-blue-950/70 border-blue-800/80 text-blue-200 hover:border-blue-500 hover:bg-blue-950/90'
                      }`}
                      title={`Etiqueta: ${ov.text} (Inicio: ${ov.startTime.toFixed(1)}s, Duración: ${ov.duration.toFixed(1)}s)`}
                    >
                      {/* Handles de duración (solo si ovWidth >= 24px) */}
                      {ovWidth >= 24 && (
                        <>
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectOverlay(ov.id);
                              setTrimmingOverlayState({
                                overlayId: ov.id,
                                edge: 'left',
                                startX: e.clientX,
                                originalStart: ov.startTime,
                                originalDuration: ov.duration,
                              });
                            }}
                            className="absolute left-0 top-0 bottom-0 w-2 hover:w-3.5 bg-blue-500/40 hover:bg-blue-400 cursor-ew-resize z-20 flex items-center justify-center transition-all group/lov rounded-l-lg"
                            title="Ajustar inicio de la etiqueta"
                          >
                            <div className="w-[1.5px] h-3.5 bg-white/80 group-hover/lov:bg-white rounded" />
                          </div>

                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectOverlay(ov.id);
                              setTrimmingOverlayState({
                                overlayId: ov.id,
                                edge: 'right',
                                startX: e.clientX,
                                originalStart: ov.startTime,
                                originalDuration: ov.duration,
                              });
                            }}
                            className="absolute right-0 top-0 bottom-0 w-2 hover:w-3.5 bg-blue-500/40 hover:bg-blue-400 cursor-ew-resize z-20 flex items-center justify-center transition-all group/rov rounded-r-lg"
                            title="Ajustar tiempo que debe durar la etiqueta (Out-point)"
                          >
                            <div className="w-[1.5px] h-3.5 bg-white/80 group-hover/rov:bg-white rounded" />
                          </div>
                        </>
                      )}

                      {ovWidth >= 20 && (
                        <span className="truncate flex items-center gap-1 pl-1">
                          <span>{ov.type === 'subscribe_cta' ? '🔔' : (ov.type === 'like_cta' ? '👍' : '🏷️')}</span>
                          {ovWidth >= 55 && <span className="truncate">{ov.text}</span>}
                        </span>
                      )}
                      {ovWidth >= 80 && (
                        <span className="font-mono text-[9px] opacity-90 shrink-0 ml-1.5 bg-black/50 px-1 py-0.5 rounded border border-blue-700/60 text-blue-200">
                          {ov.duration.toFixed(1)}s
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* ── 4. PISTA A1: MÚSICA & AUDIO TRACK ──────────────────────────── */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  onUploadMusic?.(Array.from(e.dataTransfer.files));
                } else {
                  const dataStr = e.dataTransfer.getData('application/json');
                  if (dataStr) {
                    try {
                      const data = JSON.parse(dataStr);
                      if (data.path) onDropMusicPath?.(data.path, data.name || data.path.split(/[/\\]/).pop() || 'Musica');
                    } catch {}
                  }
                }
              }}
              className="h-16 border-b border-zinc-800/60 relative flex items-center bg-zinc-950/30 px-0"
            >
              {audioCuts && audioCuts.length > 0 ? (
                <>
                  {audioCuts.map((cut, idx) => {
                    const leftPx = cut.startTime * pixelsPerSecond;
                    const widthPx = Math.max(cut.duration * pixelsPerSecond, 2);
                    const isSelected = selectedAudioCutId === cut.id;

                    return (
                      <div
                        key={cut.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAudioCut?.(cut.id);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onSelectAudioCut?.(cut.id);
                          setDraggingAudioId(cut.id);
                          setDragAudioStartX(e.clientX);
                          setAudioStartOrigin(cut.startTime);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onSelectAudioCut?.(cut.id);
                          setContextMenu({
                            x: Math.min(e.clientX, window.innerWidth - 200),
                            y: Math.min(e.clientY, window.innerHeight - 240),
                            itemType: 'audio',
                            itemId: cut.id,
                          });
                        }}
                        style={{
                          left: `${leftPx}px`,
                          width: `${widthPx}px`,
                        }}
                        className={`absolute top-1.5 bottom-1.5 rounded-lg select-none cursor-grab active:cursor-grabbing border flex flex-col justify-between ${
                          widthPx >= 40 ? 'p-1.5' : 'p-0.5'
                        } overflow-hidden transition-all shadow-md group ${
                          isSelected
                            ? 'bg-gradient-to-r from-indigo-900/90 to-purple-900/90 border-indigo-400 ring-2 ring-indigo-400/80 shadow-indigo-950/80 z-20'
                            : 'bg-gradient-to-r from-indigo-950/80 to-zinc-900/80 border-indigo-700/50 hover:border-indigo-500/80 z-10'
                        }`}
                        title={`${cut.name} (${cut.duration.toFixed(1)}s, ${formatTimecode(cut.startTime)})`}
                      >
                        {/* Handles de audio (solo si widthPx >= 24px) */}
                        {widthPx >= 24 && (
                          <>
                            <div
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                onSelectAudioCut?.(cut.id);
                                setTrimmingAudioState({
                                  cutId: cut.id,
                                  edge: 'left',
                                  startX: e.clientX,
                                  originalStart: cut.startTime,
                                  originalDuration: cut.duration,
                                });
                              }}
                              className="absolute left-0 top-0 bottom-0 w-2 hover:w-3 bg-indigo-500/30 hover:bg-indigo-400 cursor-ew-resize z-20 flex items-center justify-center transition-all rounded-l-lg group/lhandle"
                              title="Ajustar inicio de audio"
                            >
                              <div className="w-[1.5px] h-3 bg-white/70 group-hover/lhandle:bg-white rounded" />
                            </div>

                            <div
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                onSelectAudioCut?.(cut.id);
                                setTrimmingAudioState({
                                  cutId: cut.id,
                                  edge: 'right',
                                  startX: e.clientX,
                                  originalStart: cut.startTime,
                                  originalDuration: cut.duration,
                                });
                              }}
                              className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-indigo-500/30 hover:bg-indigo-400 cursor-ew-resize z-20 flex items-center justify-center transition-all rounded-r-lg group/rhandle"
                              title="Ajustar duración de audio"
                            >
                              <div className="w-[1.5px] h-3 bg-white/70 group-hover/rhandle:bg-white rounded" />
                            </div>
                          </>
                        )}

                        {/* Icono cuando es estrecho (entre 18 y 40px) */}
                        {widthPx >= 18 && widthPx < 40 && (
                          <div className="flex items-center justify-center h-full text-indigo-300 font-bold text-[10px]">
                            <span>🎵</span>
                          </div>
                        )}

                        {/* Header: Track title, index, volume, delete */}
                        {widthPx >= 40 && (
                          <div className="flex items-center justify-between text-[10px] font-bold text-indigo-200 truncate gap-1 bg-zinc-900/60 px-1 py-0.5 rounded">
                            <span className="truncate flex items-center gap-1">
                              <span className="text-indigo-400">🎵</span>
                              {widthPx >= 70 && <span className="truncate">{cut.name}</span>}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {widthPx >= 100 && (
                                <span className="text-[9px] font-mono text-indigo-300">
                                  {Math.round((cut.volume ?? 1) * 100)}%
                                </span>
                              )}
                              {widthPx >= 80 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onUpdateAudioCuts) {
                                      onUpdateAudioCuts(audioCuts.filter(a => a.id !== cut.id));
                                      if (selectedAudioCutId === cut.id) onSelectAudioCut?.(null);
                                    }
                                  }}
                                  className="text-zinc-400 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer text-[10px]"
                                  title="Eliminar pista de audio"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Visual Waveform bars mock */}
                        {widthPx >= 70 && (
                          <div className="flex items-center gap-[2px] opacity-40 px-1 overflow-hidden h-2.5">
                            {Array.from({ length: Math.min(14, Math.floor(widthPx / 6)) }).map((_, barIdx) => (
                              <div
                                key={barIdx}
                                className="w-[3px] rounded-full bg-indigo-300 shrink-0"
                                style={{
                                  height: `${Math.sin(barIdx * 0.8 + idx) * 35 + 55}%`,
                                }}
                              />
                            ))}
                          </div>
                        )}

                        {/* Footer: Start & Duration */}
                        {widthPx >= 90 && (
                          <div className="flex items-center justify-between text-[9px] font-mono text-indigo-300/80 px-0.5">
                            <span>{formatTimecode(cut.startTime)}</span>
                            <span>{cut.duration.toFixed(1)}s</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                          <span>{formatTimecode(cut.startTime)}</span>
                          <span>{cut.duration.toFixed(1)}s</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Botón flotante para subir más canciones */}
                  <div
                    onClick={() => musicFileInputRef.current?.click()}
                    style={{
                      left: `${Math.max(...audioCuts.map(a => (a.startTime + a.duration) * pixelsPerSecond), 0) + 12}px`,
                    }}
                    className="absolute top-2 h-11 px-3 rounded-lg border border-dashed border-indigo-700/60 hover:border-indigo-400 bg-indigo-950/30 hover:bg-indigo-950/60 flex items-center gap-1.5 text-[11px] text-indigo-300 hover:text-white cursor-pointer select-none transition-all z-10 shadow-sm"
                    title="Añadir otra canción a la pista A1"
                  >
                    <span>+</span>
                    <span>{lang === 'es' ? 'Añadir audio' : 'Add audio'}</span>
                  </div>
                </>
              ) : musicName ? (
                <div
                  style={{ width: `${timelineWidthPx - 20}px` }}
                  className="h-12 rounded-lg bg-indigo-950/70 border border-indigo-700/60 flex flex-col justify-between p-2 shadow-inner"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-200">
                    <span className="flex items-center gap-1.5 truncate">
                      <span>🎵</span>
                      <span className="truncate">{musicName}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-indigo-300">
                        Volumen: {Math.round(musicVolume * 100)}%
                      </span>
                      {onClearMusic && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClearMusic();
                          }}
                          className="text-indigo-400 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer text-xs"
                          title="Quitar música de fondo"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-mono text-indigo-300/70">
                    <span>Pista de audio cargada</span>
                    <span>{formatTimecode(effectiveDuration)}</span>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => musicFileInputRef.current?.click()}
                  className="h-11 w-full rounded-lg border border-dashed border-indigo-900/60 hover:border-indigo-500/80 bg-indigo-950/20 hover:bg-indigo-950/40 flex items-center justify-center gap-2 text-xs text-indigo-300/80 hover:text-indigo-200 font-medium transition-all cursor-pointer select-none"
                >
                  <span className="text-base">🎵</span>
                  <span>{lang === 'es' ? 'Arrastra tus canciones o archivos de audio aquí (o clic para subir múltiples MP3/WAV)' : 'Drag your audio files here (or click to upload multiple MP3/WAV)'}</span>
                </div>
              )}
              <input
                type="file"
                ref={musicFileInputRef}
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onUploadMusic?.(Array.from(e.target.files));
                    e.target.value = '';
                  }
                }}
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
                className="hidden"
              />
            </div>

            {/* ── 5. PISTA S1: SUBTÍTULOS SINCRONIZADOS ──────────────────────── */}
            <div className="h-12 relative flex items-center bg-zinc-950/20 px-0">
              {subtitles.length > 0 ? (
                subtitles.map(sub => {
                  const subWidth = Math.max((sub.end - sub.start) * pixelsPerSecond, 2);
                  return (
                    <div
                      key={sub.id}
                      style={{
                        left: `${sub.start * pixelsPerSecond}px`,
                        width: `${subWidth}px`,
                      }}
                      className="h-7 absolute rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 px-1 flex items-center text-[10px] font-mono truncate overflow-hidden"
                      title={sub.text}
                    >
                      {subWidth >= 28 ? sub.text : ''}
                    </div>
                  );
                })
              ) : (
                <div className="h-8 w-full rounded border border-dashed border-zinc-900 flex items-center justify-center text-[10px] text-zinc-700 font-mono">
                  Sin subtítulos generados
                </div>
              )}
            </div>

            {/* ── CABEZAL PLAYHEAD VERTICAL (NEEDLE & SCRUBBER) ─────────────── */}
            <div
              style={{ left: `${playheadTime * pixelsPerSecond}px` }}
              className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center"
            >
              {/* Playhead Head */}
              <div className="w-3.5 h-3.5 bg-purple-500 border-2 border-white rounded-sm rotate-45 -mt-1 shadow-lg shadow-purple-500/50" />
              {/* Vertical Needle Line */}
              <div className="w-[2px] h-full bg-gradient-to-b from-purple-400 via-purple-500 to-indigo-500 shadow-md shadow-purple-500" />
            </div>

          </div>
        </div>
      </div>

      {/* ── MENÚ CONTEXTUAL FLOTANTE (CLIC DERECHO) ────────────────────────── */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[190px] bg-[#14141c]/95 backdrop-blur-md border border-zinc-700/80 rounded-xl shadow-2xl p-1 text-xs text-zinc-200 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.itemType === 'cut' && (
            <>
              <button
                onClick={() => {
                  onToggleMuteOriginal();
                  setContextMenu(null);
                }}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-purple-600/30 hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span>{muteOriginalAudio ? '🔊' : '🔇'}</span>
                  <span>{muteOriginalAudio ? 'Activar audio del video' : 'Silenciar audio del video'}</span>
                </span>
                <kbd className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.5 rounded border border-zinc-800">M</kbd>
              </button>

              {onExtractAudio && contextMenu.itemId && (
                <button
                  onClick={() => {
                    const cut = cuts.find(c => c.id === contextMenu.itemId);
                    if (cut) onExtractAudio(cut.clipPath);
                    setContextMenu(null);
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/30 text-indigo-300 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span>🎵</span>
                    <span>Extraer audio a Pista A1</span>
                  </span>
                </button>
              )}

              <div className="h-[1px] bg-zinc-800 my-0.5" />

              <button
                onClick={() => handleCut(contextMenu.itemId, 'cut')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-purple-600/30 hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2"><span>✂️</span><span>Cortar</span></span>
                <kbd className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.5 rounded border border-zinc-800">Ctrl+X</kbd>
              </button>

              <button
                onClick={() => handleCopy(contextMenu.itemId, 'cut')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-purple-600/30 hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2"><span>📋</span><span>Copiar</span></span>
                <kbd className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.5 rounded border border-zinc-800">Ctrl+C</kbd>
              </button>

              <button
                onClick={handlePaste}
                disabled={!clipboard}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  clipboard ? 'hover:bg-purple-600/30 hover:text-white' : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-2"><span>📥</span><span>Pegar</span></span>
                <kbd className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.5 rounded border border-zinc-800">Ctrl+V</kbd>
              </button>

              <div className="h-[1px] bg-zinc-800 my-0.5" />

              <button
                onClick={() => {
                  onSplitAtPlayhead();
                  setContextMenu(null);
                }}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-purple-600/30 hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2"><span>⚡</span><span>Dividir en cabezal</span></span>
                <kbd className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.5 rounded border border-zinc-800">Ctrl+B</kbd>
              </button>

              {contextMenu.itemId && (
                <>
                  <button
                    onClick={() => handleToggleLoop(contextMenu.itemId!)}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-purple-600/30 hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2"><span>🔁</span><span>Alternar Bucle</span></span>
                  </button>
                  <button
                    onClick={() => handleToggleReverse(contextMenu.itemId!)}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-rose-600/30 hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2"><span>⏪</span><span>Invertir Video (Reverse)</span></span>
                  </button>
                </>
              )}

              <div className="h-[1px] bg-zinc-800 my-0.5" />

              <button
                onClick={() => handleDelete(contextMenu.itemId, 'cut')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-red-950/60 text-red-300 hover:text-red-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2"><span>🗑️</span><span>Eliminar</span></span>
                <kbd className="text-[10px] font-mono text-red-400 bg-black/40 px-1 py-0.5 rounded border border-red-900/50">Supr</kbd>
              </button>
            </>
          )}

          {contextMenu.itemType === 'overlay' && (
            <>
              <button
                onClick={() => handleCut(contextMenu.itemId, 'overlay')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/30 hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2"><span>✂️</span><span>Cortar</span></span>
                <kbd className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.5 rounded border border-zinc-800">Ctrl+X</kbd>
              </button>

              <button
                onClick={() => handleCopy(contextMenu.itemId, 'overlay')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-600/30 hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2"><span>📋</span><span>Copiar</span></span>
                <kbd className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.5 rounded border border-zinc-800">Ctrl+C</kbd>
              </button>

              <button
                onClick={handlePaste}
                disabled={!clipboard}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  clipboard ? 'hover:bg-blue-600/30 hover:text-white' : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-2"><span>📥</span><span>Pegar en cabezal</span></span>
                <kbd className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.5 rounded border border-zinc-800">Ctrl+V</kbd>
              </button>

              <div className="h-[1px] bg-zinc-800 my-0.5" />

              <button
                onClick={() => handleDelete(contextMenu.itemId, 'overlay')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-red-950/60 text-red-300 hover:text-red-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2"><span>🗑️</span><span>Eliminar</span></span>
                <kbd className="text-[10px] font-mono text-red-400 bg-black/40 px-1 py-0.5 rounded border border-red-900/50">Supr</kbd>
              </button>
            </>
          )}

          {contextMenu.itemType === 'audio' && (
            <>
              <button
                onClick={() => handleCut(contextMenu.itemId, 'audio')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/30 hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2"><span>✂️</span><span>Cortar audio</span></span>
                <kbd className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.5 rounded border border-zinc-800">Ctrl+X</kbd>
              </button>

              <button
                onClick={() => handleCopy(contextMenu.itemId, 'audio')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/30 hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2"><span>📋</span><span>Copiar audio</span></span>
                <kbd className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.5 rounded border border-zinc-800">Ctrl+C</kbd>
              </button>

              <button
                onClick={handlePaste}
                disabled={!clipboard}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  clipboard ? 'hover:bg-indigo-600/30 hover:text-white' : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-2"><span>📥</span><span>Pegar en cabezal</span></span>
                <kbd className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.5 rounded border border-zinc-800">Ctrl+V</kbd>
              </button>

              <div className="h-[1px] bg-zinc-800 my-0.5" />

              <button
                onClick={() => handleDelete(contextMenu.itemId, 'audio')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-red-950/60 text-red-300 hover:text-red-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2"><span>🗑️</span><span>Eliminar de pista</span></span>
                <kbd className="text-[10px] font-mono text-red-400 bg-black/40 px-1 py-0.5 rounded border border-red-900/50">Supr</kbd>
              </button>
            </>
          )}

          {contextMenu.itemType === 'track' && (
            <>
              <button
                onClick={handlePaste}
                disabled={!clipboard}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  clipboard ? 'hover:bg-purple-600/30 hover:text-white' : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-2"><span>📥</span><span>Pegar aquí</span></span>
                <kbd className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1 py-0.5 rounded border border-zinc-800">Ctrl+V</kbd>
              </button>
            </>
          )}
        </div>
      )}

    </div>
  );
}
