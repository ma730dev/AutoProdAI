'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Language } from '@/app/translations';
import { ControladorClient, getControladorUrl } from '@/lib/controlador-client';
import { Channel } from '@/components/dashboard/types';
import { toast } from 'sonner';
import TimelinePro, { TimelineCut, OverlayElement, SubtitleItem, TimelineAudioCut } from './timeline/TimelinePro';
import ProjectHub, { VideoProjectRecord } from './ProjectHub';

export interface VideoItem {
  id?: string;
  name: string;
  path: string;
  duration?: number;
  durationFormatted?: string;
  width?: number;
  height?: number;
  sizeMb?: number;
  hasAudio?: boolean;
}

export interface SongItem {
  name: string;
  path: string;
  duration_seconds: number;
  duration_formatted: string;
  size_mb: number;
}

export interface FolderOption {
  name: string;
  path: string;
}

export interface VideoFormatPreset {
  id: string;
  name: string;
  category: 'youtube' | 'tiktok_reels' | 'instagram' | 'cinema' | 'classic';
  ratio: string;
  width: number;
  height: number;
  icon: string;
  badge: string;
  description: string;
  aspectClass: string;
}

export const VIDEO_FORMAT_PRESETS: VideoFormatPreset[] = [
  {
    id: 'yt_16x9',
    name: '16:9 Horizontal',
    category: 'youtube',
    ratio: '16:9',
    width: 1920,
    height: 1080,
    icon: '📺',
    badge: 'YouTube / TV',
    description: '1920x1080 Full HD estándar',
    aspectClass: 'w-full aspect-video max-h-[380px]',
  },
  {
    id: 'shorts_9x16',
    name: '9:16 Vertical',
    category: 'tiktok_reels',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    icon: '📱',
    badge: 'Shorts / TikTok / Reels',
    description: '1080x1920 Formato móvil',
    aspectClass: 'w-[220px] aspect-[9/16] max-h-[380px]',
  },
  {
    id: 'ig_4x5',
    name: '4:5 Retrato Feed',
    category: 'instagram',
    ratio: '4:5',
    width: 1080,
    height: 1350,
    icon: '📸',
    badge: 'Instagram Feed Pro',
    description: '1080x1350 Máxima altura en Feed',
    aspectClass: 'w-[272px] aspect-[4/5] max-h-[360px]',
  },
  {
    id: 'square_1x1',
    name: '1:1 Cuadrado',
    category: 'instagram',
    ratio: '1:1',
    width: 1080,
    height: 1080,
    icon: '⏹️',
    badge: 'Instagram / X / Facebook',
    description: '1080x1080 Post cuadrado',
    aspectClass: 'w-[320px] aspect-square max-h-[340px]',
  },
  {
    id: 'cinema_21x9',
    name: '21:9 UltraWide',
    category: 'cinema',
    ratio: '21:9',
    width: 2560,
    height: 1080,
    icon: '🎥',
    badge: 'CinemaScope UltraWide',
    description: '2560x1080 Formato Cine',
    aspectClass: 'w-full aspect-[21/9] max-h-[310px]',
  },
  {
    id: 'retro_4x3',
    name: '4:3 Retro TV',
    category: 'classic',
    ratio: '4:3',
    width: 1440,
    height: 1080,
    icon: '📼',
    badge: 'Retro / Clásico',
    description: '1440x1080 Estética vintage',
    aspectClass: 'w-[420px] aspect-[4/3] max-h-[360px]',
  },
];

interface VideoStudioProps {
  lang: Language;
  channels: Channel[];
  workspacePath?: string | null;
  onBack: () => void;
  onRefreshWorkspace?: () => void;
  initialMediaTab?: 'clips' | 'audio' | 'text' | 'subtitles';
}

export default function VideoStudio({
  lang,
  channels,
  workspacePath,
  onBack,
  onRefreshWorkspace,
  initialMediaTab,
}: VideoStudioProps) {
  // ── GESTIÓN DE PROYECTOS Y PERSISTENCIA (LOCAL-FIRST & CLOUD) ──
  const [activeProject, setActiveProject] = useState<VideoProjectRecord | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [exportEngine, setExportEngine] = useState<'local' | 'cloud'>('local');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── PESTAÑA ACTIVA EN MEDIA BIN (IZQUIERDA: SOLO MEDIOS) ──
  const [activeMediaTab, setActiveMediaTab] = useState<'clips' | 'audio' | 'text' | 'subtitles'>(initialMediaTab || 'clips');
  const [dismissedSyncBar, setDismissedSyncBar] = useState<boolean>(false);

  // ── PESTAÑA ACTIVA EN INSPECTOR DERECHO ──
  const [activeInspectorTab, setActiveInspectorTab] = useState<'clip' | 'looper' | 'audio' | 'overlay'>('clip');

  useEffect(() => {
    if (initialMediaTab) {
      setActiveMediaTab(initialMediaTab);
    }
  }, [initialMediaTab]);

  // ── ESTADO CENTRAL DE LA LÍNEA DE TIEMPO (FUENTE DE VERDAD) ──
  const [timelineCuts, setTimelineCuts] = useState<TimelineCut[]>([]);
  const [selectedCutId, setSelectedCutId] = useState<string | null>(null);

  // ── BANDEJA DE RECURSOS DISPONIBLES EN EL PROYECTO ──
  const [projectClips, setProjectClips] = useState<VideoItem[]>([]);
  const [projectAudioList, setProjectAudioList] = useState<SongItem[]>([]);

  // ── CAPAS DE TEXTO Y OVERLAYS ──
  const [overlays, setOverlays] = useState<OverlayElement[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // ── PISTA S1: SUBTÍTULOS SINCRONIZADOS & IA (WHISPER) ──
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState<boolean>(false);
  const [subtitleLanguage, setSubtitleLanguage] = useState<string>('es');
  const [subtitleEngine, setSubtitleEngine] = useState<string>('local_cpu');
  const subtitleFileInputRef = useRef<HTMLInputElement>(null);

  // ── ASPECT RATIO Y FORMATO DE CANVAS ──
  const [selectedFormatId, setSelectedFormatId] = useState<string>('yt_16x9');
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState<boolean>(false);

  // ── PISTAS DE AUDIO GLOBALES & MULTIPISTA (A1) ──
  const [voiceAudioPath, setVoiceAudioPath] = useState<string>('');
  const [musicAudioPath, setMusicAudioPath] = useState<string>('');
  const [audioCuts, setAudioCuts] = useState<TimelineAudioCut[]>([]);
  const [selectedAudioCutId, setSelectedAudioCutId] = useState<string | null>(null);
  const [auditioningAudioPath, setAuditioningAudioPath] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState<number>(0.25);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState<boolean>(false);

  const selectedCut = timelineCuts.find(c => c.id === selectedCutId);
  const selectedOverlay = overlays.find(o => o.id === selectedOverlayId);
  const selectedAudioCut = audioCuts.find(a => a.id === selectedAudioCutId);

  // Sincronización contextual de pestañas según selección
  useEffect(() => {
    if (selectedCutId) {
      setActiveInspectorTab('clip');
    }
  }, [selectedCutId]);

  useEffect(() => {
    if (selectedAudioCutId) {
      setActiveInspectorTab('audio');
    }
  }, [selectedAudioCutId]);

  useEffect(() => {
    if (selectedOverlayId) {
      setActiveInspectorTab('overlay');
    }
  }, [selectedOverlayId]);

  // ── PLAYHEAD Y RELOJ MAESTRO DE REPRODUCCIÓN ──
  const [playheadTime, setPlayheadTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const musicPlayerRef = useRef<HTMLAudioElement>(null);
  const auditionPlayerRef = useRef<HTMLAudioElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  // ── CARPETA DESTINO Y EXPORTACIÓN ──
  const [availableFolders, setAvailableFolders] = useState<FolderOption[]>([]);
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [exportDestinationMode, setExportDestinationMode] = useState<'existing' | 'new'>('new');
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [outputFilename, setOutputFilename] = useState<string>('render_final.mp4');
  const [resolution, setResolution] = useState<string>('1080p');
  const [quality, setQuality] = useState<string>('high'); // 'master' | 'high' | 'balanced'

  // ── ESTADOS DE RENDERIZADO ──
  const [isRenderingPreview, setIsRenderingPreview] = useState<boolean>(false);
  const [isRenderingFull, setIsRenderingFull] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderMessage, setRenderMessage] = useState<string>('');
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [completedOutputPath, setCompletedOutputPath] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // ── ESTADOS DE INTERACCIÓN CON EL CANVAS (ARRASTRE DE ETIQUETAS Y PAN/ZOOM DE VIDEO) ──
  const [canvasDraggingOverlayId, setCanvasDraggingOverlayId] = useState<string | null>(null);
  const [isCanvasDraggingVideo, setIsCanvasDraggingVideo] = useState<boolean>(false);
  const [videoDragStart, setVideoDragStart] = useState<{ x: number; y: number; initialPanX: number; initialPanY: number }>({
    x: 0,
    y: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  // ── ESTADO DEL SUB-MÓDULO: HERRAMIENTA LOOPER EN INSPECTOR (-Video -> ------Looper) ──
  const [selectedLoopClipPaths, setSelectedLoopClipPaths] = useState<string[]>([]);
  const [isLoopClipsSelectorOpen, setIsLoopClipsSelectorOpen] = useState<boolean>(false);
  const [looperDurationMode, setLooperDurationMode] = useState<'time' | 'songs'>('time');
  const [looperCustomMinutes, setLooperCustomMinutes] = useState<number>(15);
  const [looperCustomSeconds, setLooperCustomSeconds] = useState<number>(0);
  const [looperSongSelectionMode, setLooperSongSelectionMode] = useState<'track_a1' | 'choose_songs'>('choose_songs');
  const [looperSelectedSongPaths, setLooperSelectedSongPaths] = useState<string[]>([]);
  const [looperAddSongsToTimeline, setLooperAddSongsToTimeline] = useState<boolean>(true);
  const [isScanningLooperAudio, setIsScanningLooperAudio] = useState<boolean>(false);
  const [looperTotalAudioSeconds, setLooperTotalAudioSeconds] = useState<number>(0);
  const [looperTotalAudioFormatted, setLooperTotalAudioFormatted] = useState<string>('0s');

  // Cargar carpetas del workspace al montar
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const folders = await ControladorClient.getVideoFolders();
        setAvailableFolders(folders);
        if (folders.length > 0 && !targetFolder) {
          setTargetFolder(folders[0].path);
        }
      } catch (err) {
        console.warn('Could not load video folders:', err);
      }
    };
    loadFolders();
  }, []);

  // Escanear metraje existente en la carpeta activa del workspace
  useEffect(() => {
    if (!targetFolder) return;
    const scanClipsInFolder = async () => {
      try {
        const videos = await ControladorClient.getFolderVideos(targetFolder);
        if (videos && videos.length > 0) {
          for (const v of videos) {
            inspectAndAttachMeta(v.path, v.name);
          }
        }
      } catch (err) {
        console.warn('Could not scan target folder videos:', err);
      }
    };
    scanClipsInFolder();
  }, [targetFolder]);

  // Auto-detectar carpeta de destino a partir de la ruta de un archivo
  const autoDetectTargetFolder = (filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/');
    const idx = normalized.lastIndexOf('/Videos');
    if (idx !== -1) {
      const detected = normalized.substring(0, idx + 7);
      setTargetFolder(detected.replace(/\//g, '\\'));
    }
  };

  // ── ARRASTRE DE ETIQUETAS (OVERLAYS) DIRECTAMENTE SOBRE EL CANVAS VIEWPORT ──
  useEffect(() => {
    if (!canvasDraggingOverlayId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = canvasContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const rawX = ((e.clientX - rect.left) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top) / rect.height) * 100;

      // Smart snapping magnético al centro (50%)
      let snappedX = rawX;
      if (Math.abs(rawX - 50) < 2.5) snappedX = 50;

      let snappedY = rawY;
      if (Math.abs(rawY - 50) < 2.5) snappedY = 50;

      const clampedX = Math.max(3, Math.min(97, Math.round(snappedX)));
      const clampedY = Math.max(3, Math.min(97, Math.round(snappedY)));

      setOverlays(prev => prev.map(o => o.id === canvasDraggingOverlayId ? {
        ...o,
        xPercent: clampedX,
        yPercent: clampedY,
      } : o));
    };

    const handleMouseUp = () => {
      setCanvasDraggingOverlayId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [canvasDraggingOverlayId]);

  // ── ARRASTRE / PANEO DEL VIDEO DENTRO DEL CANVAS VIEWPORT ──
  useEffect(() => {
    if (!isCanvasDraggingVideo || !selectedCutId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = canvasContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const deltaX = ((e.clientX - videoDragStart.x) / rect.width) * 100;
      const deltaY = ((e.clientY - videoDragStart.y) / rect.height) * 100;

      const newPanX = Math.max(-60, Math.min(60, Math.round(videoDragStart.initialPanX + deltaX)));
      const newPanY = Math.max(-60, Math.min(60, Math.round(videoDragStart.initialPanY + deltaY)));

      setTimelineCuts(prev => prev.map(c => c.id === selectedCutId ? {
        ...c,
        panX: newPanX,
        panY: newPanY,
      } : c));
    };

    const handleMouseUp = () => {
      setIsCanvasDraggingVideo(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isCanvasDraggingVideo, selectedCutId, videoDragStart]);

  // Mover posición de un clip en la secuencia (antes / después)
  const handleMoveCutOrder = (cutId: string, direction: 'left' | 'right') => {
    const idx = timelineCuts.findIndex(c => c.id === cutId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= timelineCuts.length) return;

    const updated = [...timelineCuts];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    setTimelineCuts(updated);
    toast.success(lang === 'es' ? 'Clip reordenado en la secuencia' : 'Clip reordered in sequence');
  };

  // Duplicar clip seleccionado en la línea de tiempo
  const handleDuplicateCut = (cutId: string) => {
    const target = timelineCuts.find(c => c.id === cutId);
    if (!target) return;
    const duplicated: TimelineCut = {
      ...target,
      id: `cut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `${target.name} (Copia)`,
    };
    const idx = timelineCuts.findIndex(c => c.id === cutId);
    const updated = [...timelineCuts];
    updated.splice(idx + 1, 0, duplicated);
    setTimelineCuts(updated);
    setSelectedCutId(duplicated.id);
    toast.success(lang === 'es' ? 'Clip duplicado en el timeline' : 'Clip duplicated');
  };

  // Duración acumulada de la secuencia de video en V1 (considerando bucles individuales elásticos)
  const sequenceDuration = useMemo(() => {
    return timelineCuts.reduce((acc, c) => {
      const eff = (c.loopToAudio && c.loopDuration && c.loopDuration > 0) ? c.loopDuration : c.duration;
      return acc + (eff || 0);
    }, 0);
  }, [timelineCuts]);

  // Si algún clip tiene activo el bucle virtual
  const isLoopActive = useMemo(() => {
    return timelineCuts.some(c => c.loopToAudio);
  }, [timelineCuts]);

  // Duración máxima de las pistas de audio en A1
  const maxAudioEnd = useMemo(() => {
    if (audioCuts.length === 0) return 0;
    return Math.max(...audioCuts.map(a => (a.startTime || 0) + (a.duration || 0)));
  }, [audioCuts]);

  // Duración máxima de los overlays y textos en T1
  const maxOverlayEnd = useMemo(() => {
    if (overlays.length === 0) return 0;
    return Math.max(...overlays.map(o => (o.startTime || 0) + (o.duration || 0)));
  }, [overlays]);

  // Duración total efectiva del timeline (Modelo Premiere: elemento más lejano en cualquier pista)
  const totalTimelineDuration = useMemo(() => {
    const targetBounds = Math.max(sequenceDuration, maxAudioEnd, maxOverlayEnd);
    return targetBounds > 0 ? targetBounds : 15;
  }, [sequenceDuration, maxAudioEnd, maxOverlayEnd]);

  // ── CARGAR PROYECTO SELECCIONADO DESDE PROJECT HUB ──
  const handleLoadProject = useCallback((project: VideoProjectRecord) => {
    setActiveProject(project);

    // Ajustar preset de aspect ratio
    if (project.aspectRatio) {
      const preset = VIDEO_FORMAT_PRESETS.find(p => p.ratio === project.aspectRatio);
      if (preset) setSelectedFormatId(preset.id);
    }

    if (project.title) {
      const cleanName = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      setOutputFilename(`${cleanName}.mp4`);
    }

    // Cargar datos de la línea de tiempo guardada
    const data = project.timelineData || {};
    if (Array.isArray(data.cuts)) {
      setTimelineCuts(data.cuts);
    } else {
      setTimelineCuts([]);
    }

    if (Array.isArray(data.audio)) {
      setAudioCuts(data.audio);
    } else {
      setAudioCuts([]);
    }

    if (Array.isArray(data.overlays)) {
      setOverlays(data.overlays);
    } else {
      setOverlays([]);
    }

    if (Array.isArray(data.subtitles)) {
      setSubtitles(data.subtitles);
    } else {
      setSubtitles([]);
    }

    if (typeof data.musicVolume === 'number') {
      setMusicVolume(data.musicVolume);
    }
    if (data.selectedFormatId) {
      setSelectedFormatId(data.selectedFormatId);
    }
    if (data.targetFolder) {
      setTargetFolder(data.targetFolder);
    }

    toast.success(`Proyecto abierto: ${project.title}`);
  }, []);

  // ── AUTO-GUARDADO PERSISTENTE DEL PROYECTO (DEBOUNCE 2S) ──
  useEffect(() => {
    if (!activeProject?.id) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        setIsAutoSaving(true);
        const currentPreset = VIDEO_FORMAT_PRESETS.find(p => p.id === selectedFormatId) || VIDEO_FORMAT_PRESETS[0];
        const payload = {
          cuts: timelineCuts,
          audio: audioCuts,
          overlays,
          subtitles,
          musicVolume,
          selectedFormatId,
          outputFilename,
          targetFolder,
          version: '1.0.0',
        };

        await fetch(`/api/video-projects/${activeProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timelineData: payload,
            durationSeconds: totalTimelineDuration || 0,
            aspectRatio: currentPreset.ratio,
          }),
        });

        setLastSavedTime(new Date());
      } catch (err) {
        console.error('Error en auto-guardado de proyecto:', err);
      } finally {
        setIsAutoSaving(false);
      }
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [
    activeProject?.id,
    timelineCuts,
    audioCuts,
    overlays,
    subtitles,
    musicVolume,
    selectedFormatId,
    outputFilename,
    targetFolder,
    totalTimelineDuration,
  ]);

  // Inspeccionar metadatos de un video para anexarlo a la bandeja
  const inspectAndAttachMeta = async (filePath: string, fileName: string) => {
    try {
      const meta = await ControladorClient.inspectMedia(filePath);
      const dur = meta.duration_seconds;
      setProjectClips(prev => {
        const normPath = filePath.replace(/\\/g, '/');
        const existing = prev.find(p => p.path === filePath || p.path.replace(/\\/g, '/') === normPath);
        if (existing) {
          return prev.map(p => (p.path === filePath || p.path.replace(/\\/g, '/') === normPath) ? {
            ...p,
            duration: dur || p.duration,
            durationFormatted: meta.duration_formatted || p.durationFormatted,
            width: meta.width || p.width,
            height: meta.height || p.height,
            sizeMb: meta.size_mb || p.sizeMb,
            hasAudio: meta.has_audio ?? p.hasAudio,
          } : p);
        }
        return [...prev, {
          name: fileName,
          path: filePath,
          duration: dur,
          durationFormatted: meta.duration_formatted,
          width: meta.width,
          height: meta.height,
          sizeMb: meta.size_mb,
          hasAudio: meta.has_audio,
        }];
      });

      // Actualizar duración del corte en el timeline si coincide
      if (dur && dur > 0) {
        setTimelineCuts(prev => prev.map(c => {
          const isTarget = c.clipPath === filePath || c.name === fileName || c.clipPath.replace(/\\/g, '/') === filePath.replace(/\\/g, '/');
          if (isTarget && (c.duration === 15 || !c.duration || c.endTime === 15)) {
            return {
              ...c,
              endTime: dur,
              duration: dur,
            };
          }
          return c;
        }));
      }
    } catch (err) {
      console.warn('Could not inspect media:', err);
    }
  };

  // Añadir clip a la línea de tiempo (con duración real y soporte de bucle elástico)
  const handleAddClipToTimeline = (filePath: string, fileName: string, loopToAudio: boolean = false, loopDuration?: number) => {
    autoDetectTargetFolder(filePath);
    const existing = projectClips.find(p => p.path === filePath || p.name === fileName || p.path.replace(/\\/g, '/') === filePath.replace(/\\/g, '/'));
    const initialDuration = existing?.duration && existing.duration > 0 ? existing.duration : 15;

    const newCut: TimelineCut = {
      id: `cut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      clipPath: filePath,
      name: fileName,
      startTime: 0,
      endTime: initialDuration,
      duration: initialDuration,
      loopToAudio,
      loopDuration: loopToAudio ? (loopDuration || Math.max(initialDuration, Number((initialDuration * 3).toFixed(1)))) : undefined,
    };
    setTimelineCuts(prev => [...prev, newCut]);
    setSelectedCutId(newCut.id);
    inspectAndAttachMeta(filePath, fileName);
    toast.success(loopToAudio
      ? (lang === 'es' ? `Bucle amarillo añadido: ${fileName}` : `Yellow loop added: ${fileName}`)
      : (lang === 'es' ? `Clip añadido: ${fileName}` : `Clip added: ${fileName}`));
  };

  // Subir videos desde explorador de archivos del PC (Streaming Directo con fallback)
  const processUploadedFiles = async (files: File[]) => {
    const videoFiles = Array.from(files).filter(file =>
      file.type.startsWith('video/') ||
      ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.ts'].some(ext => file.name.toLowerCase().endsWith(ext))
    );

    if (videoFiles.length === 0) {
      toast.info(lang === 'es' ? 'No se detectaron archivos de video compatibles' : 'No supported video files detected');
      return;
    }

    const toastId = toast.loading(lang === 'es' ? `Importando ${videoFiles.length} video(s)...` : `Importing ${videoFiles.length} video(s)...`);
    try {
      for (const file of videoFiles) {
        const saved = await ControladorClient.uploadStreamFile(file, targetFolder || undefined, 'Videos');

        if (saved && saved.path) {
          autoDetectTargetFolder(saved.path);
          await inspectAndAttachMeta(saved.path, file.name);
          setSelectedLoopClipPaths(prev => prev.length === 0 ? [saved.path] : prev);
        }
      }
      toast.success(
        lang === 'es'
          ? `${videoFiles.length} video(s) importado(s) a la bandeja de medios del proyecto`
          : `${videoFiles.length} video(s) imported to project media bin`,
        { id: toastId }
      );
    } catch (err: any) {
      toast.error(err.message || 'Error importando videos', { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── REPRODUCTOR DE PRUEBA RÁPIDA (AUDICIÓN EN BANDEJA) ──
  const toggleAuditionSong = (audioPath: string) => {
    const player = auditionPlayerRef.current;
    if (!player) return;

    if (auditioningAudioPath === audioPath && !player.paused) {
      player.pause();
      setAuditioningAudioPath(null);
    } else {
      player.src = `/api/assets/stream?path=${encodeURIComponent(audioPath)}`;
      player.load();
      player.play().catch(() => { });
      setAuditioningAudioPath(audioPath);
    }
  };

  // ── AÑADIR ARCHIVO DE AUDIO A LA PISTA A1 DE LA LÍNEA DE TIEMPO ──
  const handleAddAudioToTimeline = async (filePath: string, fileName: string, startTime?: number, duration?: number) => {
    let effectiveDuration = duration;
    if (!effectiveDuration) {
      try {
        const meta = await ControladorClient.inspectMedia(filePath);
        if (meta.duration_seconds) effectiveDuration = meta.duration_seconds;
      } catch { }
    }
    const finalDuration = effectiveDuration && effectiveDuration > 0 ? effectiveDuration : 180;

    let targetStart = startTime;
    if (targetStart === undefined) {
      // Colocar después del último audio en la pista A1
      targetStart = audioCuts.length > 0
        ? Math.max(...audioCuts.map(a => a.startTime + a.duration))
        : 0;
    }

    const newAudioCut: TimelineAudioCut = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      audioPath: filePath,
      name: fileName,
      startTime: Number(targetStart.toFixed(1)),
      duration: Number(finalDuration.toFixed(1)),
      volume: 1,
    };

    setAudioCuts(prev => [...prev, newAudioCut]);
    setSelectedAudioCutId(newAudioCut.id);
    if (!musicAudioPath) setMusicAudioPath(filePath);
    toast.success(lang === 'es' ? `Audio añadido a pista A1: ${fileName}` : `Audio added to A1: ${fileName}`);
  };

  // ── AÑADIR TODAS LAS CANCIONES DE LA BANDEJA A PISTA A1 EN CASCADA ──
  const handleAddAllAudiosToTimeline = () => {
    if (projectAudioList.length === 0) {
      toast.info(lang === 'es' ? 'No hay canciones en la bandeja de audio' : 'No songs in audio bin');
      return;
    }

    let cursor = audioCuts.length > 0
      ? Math.max(...audioCuts.map(a => a.startTime + a.duration))
      : 0;

    const newCuts: TimelineAudioCut[] = [];
    for (const song of projectAudioList) {
      const dur = song.duration_seconds > 0 ? song.duration_seconds : 180;
      newCuts.push({
        id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        audioPath: song.path,
        name: song.name,
        startTime: Number(cursor.toFixed(1)),
        duration: Number(dur.toFixed(1)),
        volume: 1,
      });
      cursor += dur;
    }

    setAudioCuts(prev => [...prev, ...newCuts]);
    if (!musicAudioPath && projectAudioList.length > 0) {
      setMusicAudioPath(projectAudioList[0].path);
    }
    toast.success(
      lang === 'es'
        ? `${newCuts.length} canciones añadidas en cascada a pista A1`
        : `${newCuts.length} songs added in cascade to A1`
    );
  };

  // ── SUBIR MÚLTIPLES ARCHIVOS DE AUDIO DESDE PC ──
  const processUploadedAudioFiles = async (files: File[]) => {
    const audioFiles = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'].includes(ext);
    });

    if (audioFiles.length === 0) return;
    const toastId = toast.loading(
      lang === 'es'
        ? `Importando ${audioFiles.length} archivo(s) de audio...`
        : `Importing ${audioFiles.length} audio file(s)...`
    );

    let nextStart = audioCuts.length > 0
      ? Math.max(...audioCuts.map(a => a.startTime + a.duration))
      : 0;

    const newlyImportedCuts: TimelineAudioCut[] = [];

    try {
      for (const file of audioFiles) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const base64Data = await base64Promise;

        const saved = await ControladorClient.saveBinaryFile({
          base64Data,
          fileName: file.name,
          targetPath: targetFolder || undefined,
          subfolder: 'Musica',
        });

        if (saved && saved.path) {
          let durationSeconds = 180;
          let durationFormatted = '3:00';
          let sizeMb = 0;

          try {
            const meta = await ControladorClient.inspectMedia(saved.path);
            if (meta.duration_seconds) {
              durationSeconds = meta.duration_seconds;
              durationFormatted = meta.duration_formatted || `${Math.round(meta.duration_seconds)}s`;
            }
            if (meta.size_mb) sizeMb = meta.size_mb;
          } catch { }

          // Anexar a la bandeja de audio del proyecto
          setProjectAudioList(prev => {
            if (prev.some(p => p.path === saved.path)) return prev;
            return [...prev, {
              name: file.name,
              path: saved.path,
              duration_seconds: durationSeconds,
              duration_formatted: durationFormatted,
              size_mb: sizeMb,
            }];
          });

          // Crear corte automático en la pista A1
          const cut: TimelineAudioCut = {
            id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            audioPath: saved.path,
            name: file.name,
            startTime: Number(nextStart.toFixed(1)),
            duration: Number(durationSeconds.toFixed(1)),
            volume: 1,
          };
          newlyImportedCuts.push(cut);
          nextStart += durationSeconds;
        }
      }

      if (newlyImportedCuts.length > 0) {
        setAudioCuts(prev => [...prev, ...newlyImportedCuts]);
        setSelectedAudioCutId(newlyImportedCuts[0].id);
        if (!musicAudioPath) setMusicAudioPath(newlyImportedCuts[0].audioPath);
        toast.success(
          lang === 'es'
            ? `${newlyImportedCuts.length} pista(s) de música añadidas a la pista A1`
            : `${newlyImportedCuts.length} audio track(s) added to A1`,
          { id: toastId }
        );
      }
    } catch (err: any) {
      toast.error(err.message || 'Error importando audio', { id: toastId });
    } finally {
      if (audioFileInputRef.current) audioFileInputRef.current.value = '';
    }
  };

  // Escanear carpeta de música para el Looper / Proyecto
  const scanAudioFolder = async (path: string) => {
    if (!path.trim()) return;
    setIsScanningLooperAudio(true);
    try {
      const res = await ControladorClient.scanAudioFolder(path);
      setProjectAudioList(res.songs || []);
      setLooperTotalAudioSeconds(res.total_duration_seconds || 0);
      setLooperTotalAudioFormatted(res.total_duration_formatted || '0s');
      if (res.songs && res.songs.length > 0) {
        setMusicAudioPath(res.songs[0].path);
      }
      toast.success(lang === 'es' ? `Escaneadas ${res.total_songs} pistas (${res.total_duration_formatted})` : `Found ${res.total_songs} tracks (${res.total_duration_formatted})`);
    } catch (err: any) {
      toast.error(err.message || 'Error escaneando carpeta de audio');
    } finally {
      setIsScanningLooperAudio(false);
    }
  };

  // Dividir clip en la posición actual del playhead (Blade Tool / Split)
  const handleSplitClipAtPlayhead = () => {
    if (timelineCuts.length === 0) return;
    let accumulated = 0;
    const cutIndex = timelineCuts.findIndex(c => {
      const end = accumulated + c.duration;
      if (playheadTime >= accumulated && playheadTime <= end) {
        return true;
      }
      accumulated = end;
      return false;
    });

    if (cutIndex === -1) {
      toast.info(lang === 'es' ? 'Ubica el cabezal sobre un clip para cortarlo' : 'Place playhead over a clip to split');
      return;
    }

    const targetCut = timelineCuts[cutIndex];
    const offsetInCut = playheadTime - (accumulated - targetCut.duration);
    if (offsetInCut <= 0.3 || offsetInCut >= targetCut.duration - 0.3) {
      toast.info(lang === 'es' ? 'El corte debe estar al menos a 0.3s de los bordes' : 'Split must be at least 0.3s from edges');
      return;
    }

    const firstHalf: TimelineCut = {
      ...targetCut,
      id: `cut-split-1-${Date.now()}`,
      endTime: targetCut.startTime + offsetInCut,
      duration: offsetInCut,
    };

    const secondHalf: TimelineCut = {
      ...targetCut,
      id: `cut-split-2-${Date.now()}`,
      startTime: targetCut.startTime + offsetInCut,
      duration: targetCut.duration - offsetInCut,
    };

    const updated = [...timelineCuts];
    updated.splice(cutIndex, 1, firstHalf, secondHalf);
    setTimelineCuts(updated);
    toast.success(lang === 'es' ? 'Clip dividido en 2 cortes' : 'Clip split into 2 cuts');
  };

  // Insertar plantilla de sticker / texto CTA
  const handleInsertOverlay = (type: 'subscribe_cta' | 'like_cta' | 'lower_third') => {
    const newOverlay: OverlayElement = {
      id: `ov-${Date.now()}`,
      type,
      text: type === 'subscribe_cta' ? '🔔 SUSCRÍBETE AL CANAL' : (type === 'like_cta' ? '👍 DALE LIKE AL VIDEO' : 'CAPÍTULO 1: INTRODUCCIÓN'),
      xPercent: 50,
      yPercent: type === 'lower_third' ? 88 : 80,
      scale: 1.0,
      startTime: Math.max(0, playheadTime),
      duration: 5,
    };
    setOverlays(prev => [...prev, newOverlay]);
    setSelectedOverlayId(newOverlay.id);
    toast.success(lang === 'es' ? 'Capa de texto insertada en el cabezal' : 'Text overlay added at playhead');
  };

  // ── FUNCIONES DE SUBTÍTULOS (PARSER SRT / VTT) ──
  const parseSrtToSubtitles = (srtText: string): SubtitleItem[] => {
    const items: SubtitleItem[] = [];
    const clean = srtText.replace(/\r/g, '').trim();
    const blocks = clean.split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;
      const timeLine = lines.find(l => l.includes('-->'));
      if (!timeLine) continue;
      const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
      const parseTime = (t: string) => {
        const p = t.replace(',', '.').split(':');
        if (p.length === 3) {
          return parseFloat(p[0]) * 3600 + parseFloat(p[1]) * 60 + parseFloat(p[2]);
        }
        return 0;
      };
      const start = parseTime(startStr);
      const end = parseTime(endStr);
      const textIdx = lines.indexOf(timeLine) + 1;
      const text = lines.slice(textIdx).join(' ').trim();
      if (text) {
        items.push({
          id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          start: Number(start.toFixed(2)),
          end: Number(end.toFixed(2)),
          text,
        });
      }
    }
    return items;
  };

  const subtitlesToSrt = (subs: SubtitleItem[]): string => {
    const formatSrtTime = (sec: number) => {
      const hrs = Math.floor(sec / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      const secs = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 1000);
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };
    return subs.map((s, i) => `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.text}\n`).join('\n');
  };

  const handleGenerateSubtitles = async () => {
    let sourcePath = '';
    if (timelineCuts.length > 0) {
      sourcePath = timelineCuts[0].clipPath;
    } else if (audioCuts.length > 0) {
      sourcePath = audioCuts[0].audioPath;
    } else if (musicAudioPath) {
      sourcePath = musicAudioPath;
    } else if (projectClips.length > 0) {
      sourcePath = projectClips[0].path;
    } else if (projectAudioList.length > 0) {
      sourcePath = projectAudioList[0].path;
    }

    if (!sourcePath) {
      toast.error(lang === 'es' ? 'Añade un video o audio al proyecto para subtitular' : 'Add a video or audio to generate subtitles');
      return;
    }

    setIsGeneratingSubtitles(true);
    const toastId = toast.loading(lang === 'es' ? 'Analizando audio y transcribiendo con Whisper IA...' : 'Transcribing audio with Whisper AI...');

    try {
      const res = await ControladorClient.generateSubtitles({
        targetType: 'video',
        path: sourcePath,
        engine: subtitleEngine,
        language: subtitleLanguage,
        formats: ['.srt', '.json'],
        burnToVideo: false,
      });

      const jobId = res.job_id;
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const status = await ControladorClient.getSubtitlesJobStatus(jobId);
          if (status.status === 'completed') {
            clearInterval(interval);
            setIsGeneratingSubtitles(false);
            if (status.results && status.results.length > 0) {
              const srtPath = status.results[0].srt_path;
              const srtContent = await ControladorClient.readFile(srtPath);
              const parsed = parseSrtToSubtitles(srtContent);
              setSubtitles(parsed);
              toast.success(
                lang === 'es'
                  ? `¡${parsed.length} subtítulos generados y colocados en la pista S1!`
                  : `Generated ${parsed.length} subtitles on track S1!`,
                { id: toastId }
              );
            } else {
              toast.info('Transcripción completada sin segmentos', { id: toastId });
            }
          } else if (status.status === 'error') {
            clearInterval(interval);
            setIsGeneratingSubtitles(false);
            toast.error(status.error || 'Error en transcripción', { id: toastId });
          }
        } catch {
          if (attempts > 60) {
            clearInterval(interval);
            setIsGeneratingSubtitles(false);
            toast.error('Tiempo de espera agotado al transcribir', { id: toastId });
          }
        }
      }, 1500);
    } catch (err: any) {
      setIsGeneratingSubtitles(false);
      toast.error(err.message || 'Error al conectar con el motor de subtítulos', { id: toastId });
    }
  };

  const handleImportSubtitleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const parsed = parseSrtToSubtitles(text);
        if (parsed.length > 0) {
          setSubtitles(parsed);
          toast.success(lang === 'es' ? `Cargados ${parsed.length} subtítulos a la pista S1` : `Loaded ${parsed.length} subtitles`);
        } else {
          toast.error(lang === 'es' ? 'No se detectaron bloques válidos en el archivo SRT' : 'Invalid SRT file');
        }
      }
    };
    reader.readAsText(file);
  };

  // ── RESOLVER CLIP ACTIVO PARA PREVISUALIZACIÓN DE VIDEO DOM ──
  const resolveClipAtTime = useCallback((time: number) => {
    if (timelineCuts.length === 0) return null;
    let accumulated = 0;

    for (let i = 0; i < timelineCuts.length; i++) {
      const cut = timelineCuts[i];
      const effectiveCutDur = (cut.loopToAudio && cut.loopDuration && cut.loopDuration > 0)
        ? cut.loopDuration
        : cut.duration;
      const cutEnd = accumulated + effectiveCutDur;

      if (time >= accumulated && time < cutEnd) {
        const elapsed = time - accumulated;
        const sourceCycleDur = cut.duration > 0 ? cut.duration : 15;
        // Si el corte individual tiene bucle activo, calcular residuo del ciclo
        const cycleElapsed = cut.loopToAudio ? (elapsed % sourceCycleDur) : elapsed;

        let activePath = cut.clipPath;
        let offsetInClip = cut.isReversed
          ? Math.max(cut.startTime, cut.endTime - cycleElapsed)
          : (cut.startTime + cycleElapsed);

        // Si es una secuencia de múltiples clips en bucle:
        if (cut.loopToAudio && cut.loopClips && cut.loopClips.length > 0) {
          let subAccum = 0;
          for (const sub of cut.loopClips) {
            const subDur = sub.duration > 0 ? sub.duration : 15;
            if (cycleElapsed >= subAccum && cycleElapsed < subAccum + subDur) {
              activePath = sub.path;
              offsetInClip = cycleElapsed - subAccum;
              break;
            }
            subAccum += subDur;
          }
        }

        return {
          cut,
          index: i,
          activeClipPath: activePath,
          offsetInClip,
          accumulatedStart: accumulated,
          effectiveCutDur,
          isLast: i === timelineCuts.length - 1,
        };
      }
      accumulated = cutEnd;
    }

    return null;
  }, [timelineCuts]);

  const currentResolvedClip = useMemo(() => {
    return resolveClipAtTime(playheadTime);
  }, [resolveClipAtTime, playheadTime]);

  // ── SUBTÍTULO ACTIVO EN EL CABEZAL DE TIEMPO ──
  const currentActiveSubtitle = useMemo(() => {
    if (subtitles.length === 0) return null;
    return subtitles.find(s => playheadTime >= s.start && playheadTime <= s.end) || null;
  }, [subtitles, playheadTime]);

  const activeVideoSrc = useMemo(() => {
    if (previewVideoUrl) return previewVideoUrl;
    if (!currentResolvedClip) return null;
    const clipPath = (currentResolvedClip as any).activeClipPath || currentResolvedClip.cut.clipPath;
    return `/api/assets/stream?path=${encodeURIComponent(clipPath)}`;
  }, [previewVideoUrl, currentResolvedClip]);

  // ── RELOJ MAESTRO DE REPRODUCCIÓN (REQUESTANIMATIONFRAME) ──
  const lastFrameTimeRef = useRef<number | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const playheadTimeRef = useRef<number>(playheadTime);
  playheadTimeRef.current = playheadTime;

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      lastFrameTimeRef.current = null;
      if (videoPlayerRef.current && !videoPlayerRef.current.paused) {
        videoPlayerRef.current.pause();
      }
      if (musicPlayerRef.current && !musicPlayerRef.current.paused) {
        musicPlayerRef.current.pause();
      }
      return;
    }

    const tick = (now: number) => {
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = now;
      }
      const deltaSeconds = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      let nextPlayhead = playheadTimeRef.current + deltaSeconds;
      const endLimit = totalTimelineDuration;

      if (endLimit > 0 && nextPlayhead >= endLimit) {
        nextPlayhead = endLimit;
        setPlayheadTime(endLimit);
        setIsPlaying(false);
        if (videoPlayerRef.current) videoPlayerRef.current.pause();
        if (musicPlayerRef.current) musicPlayerRef.current.pause();
        return;
      }

      setPlayheadTime(nextPlayhead);
      animationFrameIdRef.current = requestAnimationFrame(tick);
    };

    lastFrameTimeRef.current = performance.now();
    animationFrameIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [isPlaying, totalTimelineDuration]);

  // Sincronización del elemento HTML5 Video con el offset del clip
  useEffect(() => {
    const video = videoPlayerRef.current;
    if (!video) return;

    if (!currentResolvedClip) {
      if (!video.paused) video.pause();
      return;
    }

    const expectedClipPath = (currentResolvedClip as any).activeClipPath || currentResolvedClip.cut.clipPath;
    const targetOffset = currentResolvedClip.offsetInClip;
    const currentSrc = video.currentSrc || video.src || '';
    const hasDifferentSource = !currentSrc.includes(encodeURIComponent(expectedClipPath)) && !currentSrc.endsWith(expectedClipPath);

    if (hasDifferentSource) {
      const newSrcUrl = `${getControladorUrl()}/workspace/raw?path=${encodeURIComponent(expectedClipPath)}`;
      video.src = newSrcUrl;
      video.load();
      const onCanPlay = () => {
        video.currentTime = targetOffset;
        video.muted = muteOriginalAudio;
        if (isPlayingRef.current) {
          video.play().catch(() => { });
        }
        video.removeEventListener('canplay', onCanPlay);
      };
      video.addEventListener('canplay', onCanPlay);
    } else {
      const drift = Math.abs(video.currentTime - targetOffset);
      if (drift > 0.3) {
        video.currentTime = targetOffset;
      }
      if (isPlaying && video.paused && video.readyState >= 2) {
        video.play().catch(() => { });
      }
    }
  }, [currentResolvedClip?.cut.clipPath, currentResolvedClip?.offsetInClip, isPlaying, muteOriginalAudio]);

  // Resolver pista de audio activa en el playhead actual
  const currentResolvedAudioCut = useMemo(() => {
    if (audioCuts.length === 0) return null;
    return audioCuts.find(a => playheadTime >= a.startTime && playheadTime < (a.startTime + a.duration)) || null;
  }, [audioCuts, playheadTime]);

  // Sincronización de la Pista de Música (Multi-Track A1 & Legacy fallback)
  useEffect(() => {
    const audio = musicPlayerRef.current;
    if (!audio) return;

    // Caso 1: Pista A1 Multipista tiene clips
    if (audioCuts.length > 0) {
      if (!currentResolvedAudioCut) {
        // Hueco entre canciones o playhead fuera de los rangos de audio
        if (!audio.paused) audio.pause();
        return;
      }

      const activeCut = currentResolvedAudioCut;
      const expectedAudioSrc = `/api/assets/stream?path=${encodeURIComponent(activeCut.audioPath)}`;
      const targetAudioOffset = Math.max(0, playheadTime - activeCut.startTime);
      const effectiveVol = Math.max(0, Math.min(1, musicVolume * (activeCut.volume ?? 1)));
      const currentSrc = audio.currentSrc || audio.src || '';
      const hasDifferentSource = !currentSrc.includes(encodeURIComponent(activeCut.audioPath)) && !currentSrc.endsWith(activeCut.audioPath);

      if (hasDifferentSource) {
        audio.src = expectedAudioSrc;
        audio.volume = effectiveVol;
        audio.load();
        const onCanPlay = () => {
          audio.currentTime = targetAudioOffset;
          audio.volume = effectiveVol;
          if (isPlayingRef.current) {
            audio.play().catch(() => { });
          }
          audio.removeEventListener('canplay', onCanPlay);
        };
        audio.addEventListener('canplay', onCanPlay);
      } else {
        audio.volume = effectiveVol;
        const drift = Math.abs(audio.currentTime - targetAudioOffset);
        if (drift > 0.35) {
          audio.currentTime = targetAudioOffset;
        }
        if (isPlaying && audio.paused && audio.readyState >= 2) {
          audio.play().catch(() => { });
        } else if (!isPlaying && !audio.paused) {
          audio.pause();
        }
      }
      return;
    }

    // Caso 2: Fallback con una sola pista (musicAudioPath)
    if (!musicAudioPath) {
      if (!audio.paused) audio.pause();
      return;
    }

    const expectedAudioSrc = `/api/assets/stream?path=${encodeURIComponent(musicAudioPath)}`;
    const currentSrc = audio.currentSrc || audio.src || '';
    const hasDifferentSource = !currentSrc.includes(encodeURIComponent(musicAudioPath)) && !currentSrc.endsWith(musicAudioPath);

    if (hasDifferentSource) {
      audio.src = expectedAudioSrc;
      audio.volume = musicVolume;
      audio.load();
      const onCanPlay = () => {
        const dur = audio.duration || looperTotalAudioSeconds || 1;
        audio.currentTime = dur > 0 ? (playheadTimeRef.current % dur) : 0;
        audio.volume = musicVolume;
        if (isPlayingRef.current) {
          audio.play().catch(() => { });
        }
        audio.removeEventListener('canplay', onCanPlay);
      };
      audio.addEventListener('canplay', onCanPlay);
    } else {
      audio.volume = musicVolume;
      const dur = audio.duration || looperTotalAudioSeconds || 1;
      const targetAudioTime = dur > 0 ? (playheadTime % dur) : 0;
      const drift = Math.abs(audio.currentTime - targetAudioTime);
      if (drift > 0.35) {
        audio.currentTime = targetAudioTime;
      }
      if (isPlaying && audio.paused && audio.readyState >= 2) {
        audio.play().catch(() => { });
      } else if (!isPlaying && !audio.paused) {
        audio.pause();
      }
    }
  }, [audioCuts, currentResolvedAudioCut, musicAudioPath, playheadTime, isPlaying, musicVolume, looperTotalAudioSeconds]);

  // Atajo global: Espacio para Play / Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => {
          if (!prev) {
            const limit = isLoopActive ? totalTimelineDuration : sequenceDuration;
            if (playheadTimeRef.current >= limit - 0.1) {
              setPlayheadTime(0);
            }
            return true;
          }
          return false;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoopActive, totalTimelineDuration, sequenceDuration]);

  // ── EJECUCIÓN DEL RENDERIZADO DEL TIMELINE STUDIO ──
  const handleExecuteRender = async (isPreview: boolean = false) => {
    if (timelineCuts.length === 0) {
      toast.error(lang === 'es' ? 'Añade al menos un clip de video a la línea de tiempo.' : 'Add at least one video clip.');
      return;
    }

    if (isPreview) {
      setIsRenderingPreview(true);
      setPreviewVideoUrl(null);
    } else {
      setIsRenderingFull(true);
      setCompletedOutputPath(null);
    }

    setRenderProgress(10);
    setRenderMessage(lang === 'es' ? 'Inicializando composición multipista en GPU local...' : 'Initializing GPU composition...');

    try {
      let effectiveTargetFolder = targetFolder;

      // Si el usuario eligió crear una nueva carpeta para este video
      if (exportDestinationMode === 'new' && newFolderName.trim()) {
        const sanitized = newFolderName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
        const parentPath = activeProject?.channel?.name && workspacePath
          ? `${workspacePath}/${activeProject.channel.name}`
          : (workspacePath || '');

        if (parentPath && exportEngine === 'local') {
          try {
            await ControladorClient.createFolder(parentPath, sanitized, ['Guiones', 'Videos', 'Miniatura', 'Musica', 'Ambiente']);
            effectiveTargetFolder = `${parentPath}/${sanitized}/Videos`.replace(/\//g, '\\');
            setTargetFolder(effectiveTargetFolder);
          } catch (e) {
            console.warn('Could not auto-create video folder:', e);
            effectiveTargetFolder = `${parentPath}/${sanitized}`.replace(/\//g, '\\');
            setTargetFolder(effectiveTargetFolder);
          }
        }
      }

      // Si hay subtítulos en la pista S1, guardarlos como .srt para quemarlos en el render
      let subtitlePathToBurn: string | null = null;
      if (subtitles.length > 0) {
        try {
          const srtText = subtitlesToSrt(subtitles);
          const b64 = typeof window !== 'undefined' ? btoa(unescape(encodeURIComponent(srtText))) : Buffer.from(srtText).toString('base64');
          const savedSrt = await ControladorClient.saveBinaryFile({
            base64Data: `data:text/plain;base64,${b64}`,
            fileName: `subtitles_${Date.now()}.srt`,
            targetPath: effectiveTargetFolder || undefined,
            subfolder: 'Videos',
          });
          if (savedSrt && savedSrt.path) {
            subtitlePathToBurn = savedSrt.path;
          }
        } catch (srtErr) {
          console.warn('No se pudo guardar subtítulos para render:', srtErr);
        }
      }

      const res = await ControladorClient.renderTimeline({
        cuts: timelineCuts.flatMap(c => {
          const effectiveDur = (c.loopToAudio && c.loopDuration && c.loopDuration > 0)
            ? c.loopDuration
            : (c.loopToAudio ? totalTimelineDuration : c.duration);

          if (c.loopToAudio && c.loopClips && c.loopClips.length > 1) {
            const cycleClips = c.loopClips;
            const expandedCuts: any[] = [];
            let elapsed = 0;
            let cycleIdx = 0;

            while (elapsed < effectiveDur - 0.05) {
              const subClip = cycleClips[cycleIdx % cycleClips.length];
              const remaining = effectiveDur - elapsed;
              const subDur = Math.min(subClip.duration || 15, remaining);

              expandedCuts.push({
                clip_path: subClip.path,
                start_time: 0,
                end_time: subDur,
                duration: subDur,
                loop_to_duration: null,
                is_reversed: false,
              });

              elapsed += subDur;
              cycleIdx++;
            }
            return expandedCuts;
          }

          return [{
            clip_path: c.clipPath,
            start_time: c.startTime,
            end_time: c.endTime,
            duration: c.duration,
            loop_to_duration: (c.loopToAudio && c.loopDuration && c.loopDuration > 0)
              ? c.loopDuration
              : (c.loopToAudio ? totalTimelineDuration : null),
            is_reversed: !!c.isReversed,
          }];
        }),
        overlays: overlays.map(o => ({
          type: o.type,
          text: o.text,
          x_percent: o.xPercent,
          y_percent: o.yPercent,
          scale: o.scale,
          start_time: o.startTime,
          duration: o.duration,
        })),
        audio: {
          voice_audio_path: voiceAudioPath || null,
          music_audio_path: musicAudioPath || null,
          music_volume: musicVolume,
          mute_video_audio: muteOriginalAudio,
          music_tracks: audioCuts.map(a => ({
            id: a.id,
            path: a.audioPath,
            name: a.name,
            start_time: a.startTime,
            duration: a.duration,
            volume: a.volume ?? 1.0,
          })),
        },
        subtitlePath: subtitlePathToBurn,
        resolution,
        quality,
        aspectRatio: currentPreset.ratio,
        outputFolderPath: effectiveTargetFolder || null,
        outputFilename,
        isPreview,
      });

      const jobId = res.job_id;

      // Polling de estado reactivo
      const interval = setInterval(async () => {
        try {
          const statusData = await ControladorClient.getVideoLoopStatus(jobId);
          setRenderProgress(statusData.progress || 0);
          setRenderMessage(statusData.message || '');

          if (statusData.status === 'completed' && statusData.output_path) {
            clearInterval(interval);
            setIsRenderingPreview(false);
            setIsRenderingFull(false);
            if (isPreview) {
              setPreviewVideoUrl(`${getControladorUrl()}/workspace/raw?path=${encodeURIComponent(statusData.output_path)}`);
              toast.success(lang === 'es' ? 'Previsualización lista' : 'Preview ready');
            } else {
              setCompletedOutputPath(statusData.output_path);
              toast.success(lang === 'es' ? '¡Video exportado con éxito!' : 'Video exported successfully!');
              if (onRefreshWorkspace) onRefreshWorkspace();
            }
          } else if (statusData.status === 'error' || statusData.status === 'failed') {
            clearInterval(interval);
            setIsRenderingPreview(false);
            setIsRenderingFull(false);
            toast.error(statusData.error || 'Error durante el renderizado');
          }
        } catch {
          clearInterval(interval);
          setIsRenderingPreview(false);
          setIsRenderingFull(false);
        }
      }, 1200);

    } catch (err: any) {
      setIsRenderingPreview(false);
      setIsRenderingFull(false);
      toast.error(err.message || 'Error al iniciar renderizado');
    }
  };

  // ── HERRAMIENTAS Y CÁLCULOS DEL ÁRBOL LOOPER (-Video -> ------Looper) ──
  // Clips seleccionados para la secuencia del bucle
  const selectedLoopClips = useMemo(() => {
    if (selectedLoopClipPaths.length > 0) {
      return selectedLoopClipPaths
        .map(p => {
          const fromProj = projectClips.find(c => c.path === p);
          if (fromProj) return fromProj;
          if (selectedCut?.loopClips) {
            const fromCut = selectedCut.loopClips.find(c => c.path === p);
            if (fromCut) return { name: fromCut.name, path: fromCut.path, duration: fromCut.duration } as VideoItem;
          }
          const fromTimeline = timelineCuts.find(c => c.clipPath === p);
          if (fromTimeline) return { name: fromTimeline.name, path: fromTimeline.clipPath, duration: fromTimeline.duration } as VideoItem;
          return null;
        })
        .filter(Boolean) as VideoItem[];
    }
    if (selectedCut) {
      if (selectedCut.loopClips && selectedCut.loopClips.length > 0) {
        return selectedCut.loopClips.map(c => ({
          name: c.name,
          path: c.path,
          duration: c.duration,
        } as VideoItem));
      }
      const match = projectClips.find(c => c.path === selectedCut.clipPath);
      if (match) return [match];
      return [{
        name: selectedCut.name,
        path: selectedCut.clipPath,
        duration: selectedCut.duration,
      }];
    }
    if (projectClips.length > 0) {
      return [projectClips[0]];
    }
    if (timelineCuts.length > 0) {
      return [{
        name: timelineCuts[0].name,
        path: timelineCuts[0].clipPath,
        duration: timelineCuts[0].duration,
      }];
    }
    return [];
  }, [selectedLoopClipPaths, projectClips, selectedCut, timelineCuts]);

  // Duración de 1 ciclo completo (la vuelta completa de los clips seleccionados)
  const loopCycleDuration = useMemo(() => {
    if (selectedLoopClips.length === 0) return 15;
    return selectedLoopClips.reduce((sum, c) => sum + (c.duration && c.duration > 0 ? c.duration : 15), 0);
  }, [selectedLoopClips]);

  // Duración total objetivo del bucle
  const calculatedLoopDuration = useMemo(() => {
    if (looperDurationMode === 'time') {
      const mins = Math.max(0, looperCustomMinutes || 0);
      const secs = Math.max(0, looperCustomSeconds || 0);
      const total = mins * 60 + secs;
      return total > 0 ? total : 60;
    } else {
      // Modo 'songs'
      if (looperSongSelectionMode === 'track_a1') {
        return maxAudioEnd > 0 ? maxAudioEnd : 180;
      } else {
        if (looperSelectedSongPaths.length > 0) {
          const sum = projectAudioList
            .filter(s => looperSelectedSongPaths.includes(s.path))
            .reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
          return sum > 0 ? sum : 180;
        }
        if (maxAudioEnd > 0) return maxAudioEnd;
        if (projectAudioList.length > 0) {
          return projectAudioList.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) || 180;
        }
        return 180;
      }
    }
  }, [looperDurationMode, looperCustomMinutes, looperCustomSeconds, looperSongSelectionMode, looperSelectedSongPaths, maxAudioEnd, projectAudioList]);

  // Vueltas calculadas de la secuencia
  const calculatedLoopCycles = useMemo(() => {
    if (loopCycleDuration <= 0) return 1;
    return Number((calculatedLoopDuration / loopCycleDuration).toFixed(1));
  }, [calculatedLoopDuration, loopCycleDuration]);

  // Manejadores de selección y orden de clips para el bucle
  const handleToggleLoopClipSelection = (clipPath: string) => {
    setSelectedLoopClipPaths(prev => {
      const base = prev.length > 0 ? prev : selectedLoopClips.map(c => c.path);
      if (base.includes(clipPath)) {
        if (base.length <= 1) {
          toast.info(lang === 'es' ? 'El bucle debe tener al menos 1 video' : 'Loop must have at least 1 video');
          return base;
        }
        return base.filter(p => p !== clipPath);
      } else {
        return [...base, clipPath];
      }
    });
  };

  const handleMoveLoopClipOrder = (index: number, direction: 'up' | 'down') => {
    setSelectedLoopClipPaths(prev => {
      const next = prev.length > 0 ? [...prev] : selectedLoopClips.map(c => c.path);
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleRemoveLoopClipFromSequence = (index: number) => {
    setSelectedLoopClipPaths(prev => {
      const next = prev.length > 0 ? [...prev] : selectedLoopClips.map(c => c.path);
      if (next.length <= 1) {
        toast.info(lang === 'es' ? 'El bucle debe tener al menos 1 video' : 'Loop must have at least 1 video');
        return prev;
      }
      return next.filter((_, i) => i !== index);
    });
  };

  // Ajustar duración del bucle (Alargar o Acortar libremente en inspector)
  const handleAdjustLoopDurationSeconds = (deltaSeconds: number) => {
    const currentDur = calculatedLoopDuration;
    const newDur = Math.max(loopCycleDuration, Math.round(currentDur + deltaSeconds));
    const mins = Math.floor(newDur / 60);
    const secs = Math.round(newDur % 60);
    setLooperCustomMinutes(mins);
    setLooperCustomSeconds(secs);
    if (looperDurationMode !== 'time') {
      setLooperDurationMode('time');
    }
    if (selectedCut && selectedCut.loopToAudio) {
      setTimelineCuts(prev => prev.map(c => c.id === selectedCut.id ? {
        ...c,
        loopDuration: newDur,
      } : c));
    }
  };

  // Sincronizar selección de clips del bucle cuando cambia el corte seleccionado en timeline
  useEffect(() => {
    if (selectedCut && selectedCut.loopToAudio) {
      if (selectedCut.loopClips && selectedCut.loopClips.length > 0) {
        setSelectedLoopClipPaths(selectedCut.loopClips.map(c => c.path));
      } else if (selectedCut.clipPath) {
        setSelectedLoopClipPaths([selectedCut.clipPath]);
      }
      if (selectedCut.loopDuration) {
        const mins = Math.floor(selectedCut.loopDuration / 60);
        const secs = Math.round(selectedCut.loopDuration % 60);
        setLooperCustomMinutes(mins);
        setLooperCustomSeconds(secs);
      }
    }
  }, [selectedCut?.id, selectedCut?.loopToAudio, selectedCut?.loopDuration]);

  // Crear o aplicar bucle amarillo al timeline
  const handleCreateOrApplyLoop = () => {
    if (selectedLoopClips.length === 0) {
      toast.error(lang === 'es' ? 'Selecciona al menos un clip del proyecto para el bucle' : 'Select at least one clip for the loop');
      return;
    }

    // 1. Si se eligieron canciones del proyecto y se solicitó colocarlas en A1
    if (looperDurationMode === 'songs' && looperSongSelectionMode === 'choose_songs' && looperAddSongsToTimeline) {
      const songsToAdd = projectAudioList.filter(s => looperSelectedSongPaths.includes(s.path));
      if (songsToAdd.length > 0) {
        let currentAudioEnd = audioCuts.length > 0
          ? Math.max(...audioCuts.map(a => (a.startTime || 0) + (a.duration || 0)))
          : 0;

        const newCuts: TimelineAudioCut[] = [];
        for (const song of songsToAdd) {
          const alreadyPresent = audioCuts.some(a => a.audioPath === song.path);
          if (!alreadyPresent) {
            const songDur = song.duration_seconds && song.duration_seconds > 0 ? song.duration_seconds : 180;
            newCuts.push({
              id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              audioPath: song.path,
              name: song.name,
              startTime: Number(currentAudioEnd.toFixed(1)),
              duration: Number(songDur.toFixed(1)),
              volume: 1,
            });
            currentAudioEnd += songDur;
          }
        }
        if (newCuts.length > 0) {
          setAudioCuts(prev => [...prev, ...newCuts]);
          if (!musicAudioPath && newCuts[0]) setMusicAudioPath(newCuts[0].audioPath);
        }
      }
    }

    const loopSubClips = selectedLoopClips.map(c => ({
      path: c.path,
      name: c.name,
      duration: c.duration && c.duration > 0 ? c.duration : 15,
    }));

    const loopName = selectedLoopClips.length === 1
      ? selectedLoopClips[0].name
      : `Bucle (${selectedLoopClips.length} clips: ${selectedLoopClips.map(c => c.name).join(' → ')})`;

    // Si hay un clip seleccionado en el timeline, actualizarlo
    if (selectedCut) {
      setTimelineCuts(prev => prev.map(c => c.id === selectedCut.id ? {
        ...c,
        name: loopName,
        clipPath: selectedLoopClips[0].path,
        duration: loopCycleDuration,
        endTime: loopCycleDuration,
        loopToAudio: true,
        loopDuration: calculatedLoopDuration,
        loopClips: loopSubClips,
      } : c));
      toast.success(lang === 'es'
        ? `Bucle amarillo actualizado en timeline (${Math.floor(calculatedLoopDuration / 60)}m ${(calculatedLoopDuration % 60).toFixed(0)}s, ${calculatedLoopCycles} vueltas)`
        : `Yellow loop updated (${Math.floor(calculatedLoopDuration / 60)}m)`);
    } else {
      // Si no, añadir nuevo corte amarillo al timeline
      const newCut: TimelineCut = {
        id: `cut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        clipPath: selectedLoopClips[0].path,
        name: loopName,
        startTime: 0,
        endTime: loopCycleDuration,
        duration: loopCycleDuration,
        loopToAudio: true,
        loopDuration: calculatedLoopDuration,
        loopClips: loopSubClips,
      };
      setTimelineCuts(prev => [...prev, newCut]);
      setSelectedCutId(newCut.id);
      toast.success(lang === 'es'
        ? `Bucle amarillo creado en timeline (${Math.floor(calculatedLoopDuration / 60)}m ${(calculatedLoopDuration % 60).toFixed(0)}s, ${calculatedLoopCycles} vueltas)`
        : `Yellow loop created (${Math.floor(calculatedLoopDuration / 60)}m)`);
    }
  };

  const handleRemoveLoopFromCut = (cutId: string) => {
    setTimelineCuts(prev => prev.map(c => c.id === cutId ? {
      ...c,
      loopToAudio: false,
      loopDuration: undefined,
      loopClips: undefined,
    } : c));
    toast.info(lang === 'es' ? 'Bucle desactivado (clip restaurado a duración normal)' : 'Loop removed');
  };

  // ── RENDERIZADOR DEL INSPECTOR DERECHO CON PESTAÑAS (Clip | Looper | Audio | Capas) ──
  const renderRightInspector = () => {
    return (
      <div className="flex flex-col gap-3">
        {/* TABS DE SELECCIÓN DEL INSPECTOR */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800/80 shrink-0">
          <button
            type="button"
            onClick={() => setActiveInspectorTab('clip')}
            className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${activeInspectorTab === 'clip'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
          >
            <span>🎬</span>
            <span className="truncate">Clip</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveInspectorTab('looper')}
            className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${activeInspectorTab === 'looper'
              ? 'bg-amber-600 text-black shadow-sm font-extrabold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
          >
            <span>🔁</span>
            <span className="truncate">Looper</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveInspectorTab('audio')}
            className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${activeInspectorTab === 'audio'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
          >
            <span>🎵</span>
            <span className="truncate">Audio</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveInspectorTab('overlay')}
            className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${activeInspectorTab === 'overlay'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
          >
            <span>🏷️</span>
            <span className="truncate">Capas</span>
          </button>
        </div>

        {/* ── TAB 1: CLIP DE VIDEO ── */}
        {activeInspectorTab === 'clip' && (
          <div className="flex flex-col gap-3">
            {selectedCut ? (
              <>
                {/* Cabecera del Clip Seleccionado */}
                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-xs">🎬</span>
                    <span className="text-xs font-bold text-purple-300 truncate max-w-[130px]" title={selectedCut.name}>
                      {selectedCut.name}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                      ({selectedCut.duration.toFixed(1)}s)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTimelineCuts(prev => prev.filter(c => c.id !== selectedCut.id));
                      setSelectedCutId(null);
                      toast.info(lang === 'es' ? 'Clip eliminado de la línea de tiempo' : 'Clip removed from timeline');
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300 font-bold cursor-pointer shrink-0"
                  >
                    ✕ {lang === 'es' ? 'Eliminar' : 'Remove'}
                  </button>
                </div>

                {/* 1. Recorte In / Out Points */}
                <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1">
                    <span>✂️</span>
                    <span>{lang === 'es' ? 'Recorte de Clip' : 'Clip Trim'}</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-0.5">In-Point (s)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={selectedCut.startTime}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setTimelineCuts(prev => prev.map(c => c.id === selectedCut.id ? {
                            ...c,
                            startTime: val,
                            duration: Math.max(0.3, c.endTime - val)
                          } : c));
                        }}
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded px-2 py-1 text-zinc-200 font-mono text-xs focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-0.5">Out-Point (s)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.3"
                        value={selectedCut.endTime}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1;
                          setTimelineCuts(prev => prev.map(c => c.id === selectedCut.id ? {
                            ...c,
                            endTime: val,
                            duration: Math.max(0.3, val - c.startTime)
                          } : c));
                        }}
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded px-2 py-1 text-zinc-200 font-mono text-xs focus:border-purple-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-zinc-400 pt-0.5">
                    <span>{lang === 'es' ? 'Duración resultante:' : 'Resulting duration:'}</span>
                    <span className="font-mono text-purple-300 font-bold">{(selectedCut.endTime - selectedCut.startTime).toFixed(2)}s</span>
                  </div>
                </div>

                {/* 2. Reordenar Clip en la Secuencia & Duplicar */}
                <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1">
                    <span>⇄</span>
                    <span>{lang === 'es' ? 'Secuencia & Orden' : 'Sequence & Order'}</span>
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleMoveCutOrder(selectedCut.id, 'left')}
                      disabled={timelineCuts.findIndex(c => c.id === selectedCut.id) === 0}
                      className="py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 disabled:opacity-30 disabled:pointer-events-none text-zinc-300 text-xs font-semibold border border-zinc-800 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Mover clip hacia la izquierda (antes)"
                    >
                      <span>◀ {lang === 'es' ? 'Mover Antes' : 'Move Before'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveCutOrder(selectedCut.id, 'right')}
                      disabled={timelineCuts.findIndex(c => c.id === selectedCut.id) === timelineCuts.length - 1}
                      className="py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 disabled:opacity-30 disabled:pointer-events-none text-zinc-300 text-xs font-semibold border border-zinc-800 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Mover clip hacia la derecha (después)"
                    >
                      <span>{lang === 'es' ? 'Mover Después' : 'Move After'} ▶</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDuplicateCut(selectedCut.id)}
                    className="w-full py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-semibold border border-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer mt-0.5 transition-colors"
                  >
                    <span>📋</span>
                    <span>{lang === 'es' ? 'Duplicar este Clip' : 'Duplicate Clip'}</span>
                  </button>
                </div>

                {/* 3. Encuadre & Posición del Video (Pan & Zoom) */}
                <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-purple-300 uppercase font-bold flex items-center gap-1">
                      <span>📐</span>
                      <span>{lang === 'es' ? 'Encuadre & Paneo (Canvas)' : 'Framing & Pan'}</span>
                    </span>
                    {(selectedCut.panX || selectedCut.panY || (selectedCut.zoom && selectedCut.zoom !== 1)) && (
                      <button
                        type="button"
                        onClick={() => {
                          setTimelineCuts(prev => prev.map(c => c.id === selectedCut.id ? { ...c, panX: 0, panY: 0, zoom: 1 } : c));
                          toast.success(lang === 'es' ? 'Encuadre centrado' : 'Centered');
                        }}
                        className="text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer font-semibold"
                      >
                        {lang === 'es' ? 'Centrar 🎯' : 'Center 🎯'}
                      </button>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
                      <span>{lang === 'es' ? 'Zoom / Escala' : 'Zoom / Scale'}</span>
                      <span className="font-mono text-purple-300 font-bold">{Math.round((selectedCut.zoom || 1) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="2.5"
                      step="0.05"
                      value={selectedCut.zoom || 1}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1;
                        setTimelineCuts(prev => prev.map(c => c.id === selectedCut.id ? { ...c, zoom: val } : c));
                      }}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-400 block mb-0.5">Pan X: {selectedCut.panX || 0}%</span>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={selectedCut.panX || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setTimelineCuts(prev => prev.map(c => c.id === selectedCut.id ? { ...c, panX: val } : c));
                        }}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block mb-0.5">Pan Y: {selectedCut.panY || 0}%</span>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={selectedCut.panY || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setTimelineCuts(prev => prev.map(c => c.id === selectedCut.id ? { ...c, panY: val } : c));
                        }}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Invertir Video (Reverse) */}
                <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                    <span>⏪</span>
                    <span>{lang === 'es' ? 'Invertir Video (Reverse)' : 'Reverse Video'}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={!!selectedCut.isReversed}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setTimelineCuts(prev => prev.map(c => c.id === selectedCut.id ? {
                        ...c,
                        isReversed: checked
                      } : c));
                      toast.success(checked ? (lang === 'es' ? 'Clip invertido' : 'Clip reversed') : (lang === 'es' ? 'Reproducción normal' : 'Normal playback'));
                    }}
                    className="rounded accent-cyan-500 cursor-pointer w-4 h-4"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center gap-3 border border-dashed border-zinc-800/80 rounded-2xl bg-zinc-950/40">
                <span className="text-3xl">🎬</span>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-zinc-200">
                    {lang === 'es' ? 'Ningún clip seleccionado' : 'No clip selected'}
                  </span>
                  <p className="text-[11px] text-zinc-400 max-w-[220px]">
                    {lang === 'es'
                      ? 'Haz clic en un clip de la pista de video para editar su recorte, encuadre o posición.'
                      : 'Click on a video cut in the timeline to edit framing, trimming, or position.'}
                  </p>
                </div>
                {timelineCuts.length > 0 && (
                  <div className="w-full flex flex-col gap-1.5 pt-2 border-t border-zinc-850">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 text-left">
                      {lang === 'es' ? 'Clips en la secuencia:' : 'Sequence clips:'}
                    </span>
                    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto minimal-scrollbar">
                      {timelineCuts.map((cut, idx) => (
                        <button
                          key={cut.id}
                          type="button"
                          onClick={() => setSelectedCutId(cut.id)}
                          className="w-full p-2 rounded-lg bg-zinc-900/80 hover:bg-purple-950/40 border border-zinc-800 hover:border-purple-700/60 text-left flex items-center justify-between text-xs cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[10px] text-zinc-500 font-mono">{idx + 1}.</span>
                            <span className="truncate text-zinc-200">{cut.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-purple-300 shrink-0">
                            {cut.duration.toFixed(1)}s
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: LOOPER (GENERADOR DE BUCLES) ── */}
        {activeInspectorTab === 'looper' && (
          <div className="flex flex-col gap-3">
            {/* Encabezado del Looper */}
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🔁</span>
                <span className="text-xs font-bold text-amber-300">
                  {lang === 'es' ? 'Generador de Bucles' : 'Loop Generator'}
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/40">
                {selectedLoopClips.length} {selectedLoopClips.length === 1 ? 'clip' : 'clips'}
              </span>
            </div>

            {/* 1. SELECCIONAR VIDEOS DEL PROYECTO */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-300 flex items-center gap-1">
                  <span>🎬</span>
                  <span>{lang === 'es' ? 'Videos del Ciclo' : 'Cycle Videos'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsLoopClipsSelectorOpen(prev => !prev)}
                  className="text-[10px] text-amber-400 hover:text-amber-200 font-semibold cursor-pointer flex items-center gap-1"
                >
                  <span>{isLoopClipsSelectorOpen ? 'Ocultar' : 'Elegir videos'}</span>
                  <span>{isLoopClipsSelectorOpen ? '▲' : '▼'}</span>
                </button>
              </div>

              {isLoopClipsSelectorOpen && (
                <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-zinc-950 border border-zinc-800 max-h-48 overflow-y-auto minimal-scrollbar">
                  {projectClips.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-3 text-center gap-2 text-zinc-500 text-xs">
                      <span>{lang === 'es' ? 'No hay videos en la bandeja del proyecto.' : 'No videos in project bin.'}</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-[10px] font-bold border border-purple-700 cursor-pointer"
                      >
                        + {lang === 'es' ? 'Importar Video (PC)' : 'Import Video (PC)'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between pb-1 border-b border-zinc-850 text-[10px] text-zinc-400">
                        <span>{lang === 'es' ? 'Selecciona los que formarán el ciclo:' : 'Select cycle clips:'}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedLoopClipPaths(projectClips.map(c => c.path))}
                            className="text-amber-400 hover:underline cursor-pointer"
                          >
                            {lang === 'es' ? 'Todos' : 'All'}
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => setSelectedLoopClipPaths(projectClips[0] ? [projectClips[0].path] : [])}
                            className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                          >
                            {lang === 'es' ? 'Reiniciar' : 'Reset'}
                          </button>
                        </div>
                      </div>
                      {projectClips.map((clip) => {
                        const isChecked = selectedLoopClipPaths.length > 0
                          ? selectedLoopClipPaths.includes(clip.path)
                          : (selectedCut?.clipPath === clip.path);
                        return (
                          <label
                            key={clip.path}
                            className={`flex items-center justify-between p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${isChecked
                              ? 'bg-amber-950/40 border-amber-600/50 text-amber-100'
                              : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-300 hover:bg-zinc-900'
                              }`}
                          >
                            <div className="flex items-center gap-2 truncate pr-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleLoopClipSelection(clip.path)}
                                className="rounded accent-amber-500 cursor-pointer"
                              />
                              <span className="truncate text-[11px] font-medium">{clip.name}</span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                              {clip.durationFormatted || `${Math.round(clip.duration || 15)}s`}
                            </span>
                          </label>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {/* ORDEN DE LA SECUENCIA DEL BUCLE (CICLO REPETITIVO) */}
              {selectedLoopClips.length > 0 && (
                <div className="flex flex-col gap-1 pt-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">
                    {lang === 'es' ? 'Orden del Ciclo:' : 'Cycle Order:'}
                  </span>
                  <div className="flex flex-col gap-1 max-h-36 overflow-y-auto minimal-scrollbar">
                    {selectedLoopClips.map((clip, idx) => (
                      <div
                        key={`${clip.path}-${idx}`}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate text-zinc-200 text-[11px]">{clip.name}</span>
                          <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                            ({clip.duration ? `${clip.duration.toFixed(0)}s` : '15s'})
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveLoopClipOrder(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 text-[10px] cursor-pointer"
                            title="Mover antes en el ciclo"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveLoopClipOrder(idx, 'down')}
                            disabled={idx === selectedLoopClips.length - 1}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 text-[10px] cursor-pointer"
                            title="Mover después en el ciclo"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveLoopClipFromSequence(idx)}
                            disabled={selectedLoopClips.length <= 1}
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
            <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-amber-300">
                <span>{lang === 'es' ? 'Duración del Bucle' : 'Loop Duration'}</span>
                <span className="text-zinc-500 font-normal">2 {lang === 'es' ? 'Opciones' : 'Options'}</span>
              </div>

              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
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
                <div className="flex flex-col gap-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
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
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-amber-300 font-mono text-xs font-bold"
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
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-amber-300 font-mono text-xs font-bold"
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
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
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
                <div className="flex flex-col gap-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
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
                  {selectedCut?.loopToAudio
                    ? (lang === 'es' ? 'Actualizar Bucle Amarillo en Timeline' : 'Update Yellow Loop on Timeline')
                    : (lang === 'es' ? 'Crear Bucle Amarillo en Timeline' : 'Create Yellow Loop on Timeline')}
                </span>
              </button>

              {selectedCut?.loopToAudio && (
                <button
                  type="button"
                  onClick={() => handleRemoveLoopFromCut(selectedCut.id)}
                  className="w-full py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-300 text-[10px] font-semibold border border-zinc-800 cursor-pointer transition-colors"
                >
                  ✕ {lang === 'es' ? 'Desactivar Bucle (Restaurar a clip normal)' : 'Remove Loop (Restore to normal clip)'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: AUDIO & MÚSICA ── */}
        {activeInspectorTab === 'audio' && (
          <div className="flex flex-col gap-3">
            {/* Encabezado del Audio */}
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🎵</span>
                <span className="text-xs font-bold text-indigo-300">
                  {lang === 'es' ? 'Inspector de Audio & Música' : 'Audio & Music Inspector'}
                </span>
              </div>
              {selectedAudioCut && (
                <button
                  type="button"
                  onClick={() => {
                    setAudioCuts(prev => prev.filter(a => a.id !== selectedAudioCut.id));
                    setSelectedAudioCutId(null);
                  }}
                  className="text-[10px] text-red-400 hover:text-red-300 font-bold cursor-pointer"
                >
                  ✕ {lang === 'es' ? 'Quitar de pista' : 'Remove track'}
                </button>
              )}
            </div>

            {/* 1. CONTROLES MAESTROS GLOBALES */}
            <div className="flex flex-col gap-2.5 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs">
              <span className="text-[10px] text-indigo-300 uppercase font-bold flex items-center gap-1">
                <span>🎚️</span>
                <span>{lang === 'es' ? 'Mezcla General del Video' : 'Master Audio Mix'}</span>
              </span>

              <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                  <span>🔇</span>
                  <span>{lang === 'es' ? 'Silenciar audio de videos' : 'Mute original clip audio'}</span>
                </span>
                <input
                  type="checkbox"
                  checked={muteOriginalAudio}
                  onChange={() => setMuteOriginalAudio(!muteOriginalAudio)}
                  className="rounded accent-indigo-500 cursor-pointer w-4 h-4"
                />
              </label>

              <div className="pt-2 border-t border-zinc-800/60 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 font-bold">{lang === 'es' ? 'Volumen Música de Fondo' : 'Music Volume'}</span>
                  <span className="text-[10px] font-mono text-indigo-300 font-bold">
                    {Math.round(musicVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {/* 2. PISTA DE AUDIO INDIVIDUAL (TRACK A1) */}
            {selectedAudioCut ? (
              <div className="flex flex-col gap-2.5 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs">
                <span className="text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1">
                  <span>🎼</span>
                  <span>{lang === 'es' ? 'Pista Seleccionada (A1)' : 'Selected Track (A1)'}</span>
                </span>

                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold truncate text-[11px]" title={selectedAudioCut.name}>
                  {selectedAudioCut.name}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">{lang === 'es' ? 'Volumen individual:' : 'Track volume:'}</span>
                    <span className="text-[10px] font-mono text-indigo-300 font-bold">
                      {Math.round((selectedAudioCut.volume ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={selectedAudioCut.volume ?? 1}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setAudioCuts(prev => prev.map(a => a.id === selectedAudioCut.id ? { ...a, volume: val } : a));
                    }}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const duplicated: TimelineAudioCut = {
                      ...selectedAudioCut,
                      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      startTime: Number((selectedAudioCut.startTime + selectedAudioCut.duration).toFixed(1)),
                    };
                    setAudioCuts(prev => [...prev, duplicated]);
                    setSelectedAudioCutId(duplicated.id);
                    toast.success(lang === 'es' ? 'Pista de audio duplicada' : 'Audio track duplicated');
                  }}
                  className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>📋</span>
                  <span>{lang === 'es' ? 'Duplicar Pista de Audio' : 'Duplicate Audio Track'}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 text-xs">
                <span className="text-[10px] uppercase font-bold text-zinc-500">
                  {lang === 'es' ? 'Pistas en Línea de Tiempo (A1):' : 'Timeline Audio Tracks:'}
                </span>
                {audioCuts.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 text-center py-2">
                    {lang === 'es'
                      ? 'No hay pistas añadidas en la línea de tiempo. Ve a la pestaña Audio a la izquierda para insertar música.'
                      : 'No audio cuts on timeline.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-36 overflow-y-auto minimal-scrollbar">
                    {audioCuts.map((cut, idx) => (
                      <button
                        key={cut.id}
                        type="button"
                        onClick={() => setSelectedAudioCutId(cut.id)}
                        className="w-full p-2 rounded-lg bg-zinc-900/80 hover:bg-indigo-950/40 border border-zinc-800 hover:border-indigo-700/60 text-left flex items-center justify-between text-xs cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px] text-zinc-500 font-mono">{idx + 1}.</span>
                          <span className="truncate text-zinc-200">{cut.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-indigo-300 shrink-0">
                          {cut.duration.toFixed(1)}s
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: CAPAS DE TEXTO Y OVERLAYS ── */}
        {activeInspectorTab === 'overlay' && (
          <div className="flex flex-col gap-3">
            {/* Encabezado de Capas */}
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🏷️</span>
                <span className="text-xs font-bold text-blue-300">
                  {lang === 'es' ? 'Inspector de Capas & Texto' : 'Overlay & Text Inspector'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleInsertOverlay('lower_third')}
                className="text-[10px] px-2 py-0.5 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 font-bold border border-blue-700 cursor-pointer transition-colors"
              >
                + {lang === 'es' ? 'Nueva Etiqueta' : 'New Overlay'}
              </button>
            </div>

            {selectedOverlay ? (
              <div className="flex flex-col gap-3">
                {/* Cabecera del Overlay Seleccionado */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold">{lang === 'es' ? 'Capa Activa' : 'Active Overlay'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setOverlays(prev => prev.filter(o => o.id !== selectedOverlay.id));
                      setSelectedOverlayId(null);
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300 font-bold cursor-pointer"
                  >
                    ✕ {lang === 'es' ? 'Eliminar' : 'Delete'}
                  </button>
                </div>

                {/* Texto de la Etiqueta */}
                <div className="flex flex-col gap-1 text-xs">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">{lang === 'es' ? 'Texto' : 'Text'}</span>
                  <input
                    type="text"
                    value={selectedOverlay.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOverlays(prev => prev.map(o => o.id === selectedOverlay.id ? { ...o, text: val } : o));
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 text-xs font-semibold focus:border-blue-500"
                  />
                </div>

                {/* Sincronización & Duración */}
                <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-blue-950/30 border border-blue-800/50 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-blue-300 flex items-center gap-1">
                      <span>⏱️</span>
                      <span>{lang === 'es' ? 'Duración en Pantalla' : 'Screen Duration'}</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {selectedOverlay.startTime.toFixed(1)}s ➔ {(selectedOverlay.startTime + selectedOverlay.duration).toFixed(1)}s
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold block mb-1">Inicia en (s)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={selectedOverlay.startTime}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setOverlays(prev => prev.map(o => o.id === selectedOverlay.id ? { ...o, startTime: val } : o));
                        }}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold block mb-1">Duración (s)</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.4"
                        value={selectedOverlay.duration}
                        onChange={(e) => {
                          const val = Math.max(0.4, parseFloat(e.target.value) || 0.4);
                          setOverlays(prev => prev.map(o => o.id === selectedOverlay.id ? { ...o, duration: val } : o));
                        }}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-blue-300 font-bold font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOverlays(prev => prev.map(o => o.id === selectedOverlay.id ? { ...o, startTime: Number(playheadTime.toFixed(1)) } : o));
                        toast.success(`Etiqueta fijada al cabezal actual (${playheadTime.toFixed(1)}s)`);
                      }}
                      className="w-full py-1 px-2 rounded bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-300 font-semibold border border-zinc-800 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>📍 Iniciar en Cabezal Actual ({playheadTime.toFixed(1)}s)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOverlays(prev => prev.map(o => o.id === selectedOverlay.id ? {
                          ...o,
                          startTime: 0,
                          duration: Number(totalTimelineDuration.toFixed(1))
                        } : o));
                        toast.success('Etiqueta configurada para durar todo el video');
                      }}
                      className="w-full py-1 px-2 rounded bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-300 font-semibold border border-zinc-800 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>♾️ Durar Todo el Video ({totalTimelineDuration.toFixed(0)}s)</span>
                    </button>
                  </div>
                </div>

                {/* Posición y Escala */}
                <div className="flex flex-col gap-2.5 text-xs">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">{lang === 'es' ? 'Posición en Pantalla (Arrastrable)' : 'Screen Position'}</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-400 block mb-0.5">X: {selectedOverlay.xPercent}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedOverlay.xPercent}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setOverlays(prev => prev.map(o => o.id === selectedOverlay.id ? { ...o, xPercent: val } : o));
                        }}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block mb-0.5">Y: {selectedOverlay.yPercent}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedOverlay.yPercent}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setOverlays(prev => prev.map(o => o.id === selectedOverlay.id ? { ...o, yPercent: val } : o));
                        }}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] text-zinc-400">{lang === 'es' ? 'Escala / Tamaño:' : 'Scale / Size:'}</span>
                      <span className="text-[10px] font-mono text-blue-300 font-bold">{Math.round((selectedOverlay.scale || 1) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={selectedOverlay.scale || 1}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1;
                        setOverlays(prev => prev.map(o => o.id === selectedOverlay.id ? { ...o, scale: val } : o));
                      }}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 text-xs">
                <span className="text-[10px] uppercase font-bold text-zinc-500">
                  {lang === 'es' ? 'Etiquetas en el Proyecto:' : 'Project Overlays:'}
                </span>
                {overlays.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-4 text-center gap-2">
                    <span className="text-2xl">🏷️</span>
                    <p className="text-[11px] text-zinc-500">
                      {lang === 'es'
                        ? 'No hay etiquetas creadas aún. Haz clic arriba en "+ Nueva Etiqueta" para añadir títulos o llamados a la acción.'
                        : 'No overlays created yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto minimal-scrollbar">
                    {overlays.map((ov, idx) => (
                      <button
                        key={ov.id}
                        type="button"
                        onClick={() => setSelectedOverlayId(ov.id)}
                        className="w-full p-2 rounded-lg bg-zinc-900/80 hover:bg-blue-950/40 border border-zinc-800 hover:border-blue-700/60 text-left flex items-center justify-between text-xs cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px] text-zinc-500 font-mono">{idx + 1}.</span>
                          <span className="truncate text-zinc-200">{ov.text}</span>
                        </div>
                        <span className="text-[10px] font-mono text-blue-300 shrink-0">
                          {ov.startTime.toFixed(1)}s
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const currentPreset = VIDEO_FORMAT_PRESETS.find(p => p.id === selectedFormatId) || VIDEO_FORMAT_PRESETS[0];

  // Si no hay proyecto activo, mostrar el Hub de Proyectos (Launcher)
  if (!activeProject) {
    return (
      <ProjectHub
        channels={channels}
        onOpenProject={handleLoadProject}
        onBackToDashboard={onBack}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#08080b] text-zinc-200 overflow-y-auto minimal-scrollbar p-3 lg:p-4 gap-3">

      {/* ── 1. TOP HEADER & ACCIONES RÁPIDAS ─────────────────────────────── */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2.5 border-b border-zinc-800/80 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveProject(null)}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700"
            title="Volver al Hub de Proyectos"
          >
            ← {lang === 'es' ? ' Proyectos' : ' Projects'}
          </button>

        </div>

        {/* CONTROLES DE EXPORTACIÓN */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botón Exportar Video Final */}
          <button
            onClick={() => {
              if (activeProject?.title && !newFolderName) {
                setNewFolderName(activeProject.title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_'));
              }
              setIsExportModalOpen(true);
            }}
            disabled={isRenderingPreview || isRenderingFull}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-950/50 transition-all cursor-pointer disabled:opacity-50"
          >
            <span>🚀</span>
            <span>{isRenderingFull ? 'Exportando...' : (lang === 'es' ? 'Exportar Video' : 'Export Video')}</span>
          </button>
        </div>
      </header>

      {/* BANNER DE PROGRESO DE RENDERIZADO */}
      {(isRenderingPreview || isRenderingFull) && (
        <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-purple-300 flex items-center gap-1.5">
              ⚡ {renderMessage}
            </span>
            <span className="font-mono text-purple-200 font-bold">{renderProgress}%</span>
          </div>
          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full transition-all duration-300"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── 2. WORKSPACE CENTRAL EN 3 PANELES (MEDIA BIN • CANVAS • INSPECTOR) ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-[360px]">

        {/* ── PANEL IZQUIERDO: MEDIA & TOOLS BIN (3 COLS) ──────────────────── */}
        <div className="lg:col-span-3 bg-[#0e0e13] border border-zinc-800/80 rounded-2xl p-2.5 flex flex-col gap-2.5 overflow-hidden">
          {/* Tabs de Navegación de Recursos (Solo Medios) */}
          <div className="grid grid-cols-4 gap-1 p-0.5 bg-zinc-950 rounded-xl border border-zinc-800/80 text-[10px] font-semibold text-zinc-400">
            <button
              onClick={() => setActiveMediaTab('clips')}
              className={`py-1 rounded-lg transition-all cursor-pointer truncate ${activeMediaTab === 'clips' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60 font-bold' : 'hover:text-white'}`}
              title="Metraje y Clips"
            >
              🎬 Clips
            </button>
            <button
              onClick={() => setActiveMediaTab('audio')}
              className={`py-1 rounded-lg transition-all cursor-pointer truncate ${activeMediaTab === 'audio' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60 font-bold' : 'hover:text-white'}`}
              title="Audio y Música"
            >
              🎵 Audio
            </button>
            <button
              onClick={() => setActiveMediaTab('text')}
              className={`py-1 rounded-lg transition-all cursor-pointer truncate ${activeMediaTab === 'text' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60 font-bold' : 'hover:text-white'}`}
              title="Textos y CTAs"
            >
              🏷️ Textos
            </button>
            <button
              onClick={() => setActiveMediaTab('subtitles')}
              className={`py-1 rounded-lg transition-all cursor-pointer truncate ${activeMediaTab === 'subtitles' ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/60 font-bold' : 'hover:text-white'}`}
              title="Subtítulos con IA"
            >
              🎧 Subs {subtitles.length > 0 && `(${subtitles.length})`}
            </button>
          </div>

          {/* TAB 1: CLIPS DE VIDEO */}
          {activeMediaTab === 'clips' && (
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
                    {lang === 'es' ? 'No hay clips importados aún. Arrastra archivos desde el explorador o importa uno arriba.' : 'No clips imported yet.'}
                  </div>
                ) : (
                  projectClips.map((clip) => (
                    <div
                      key={clip.path}
                      className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-purple-700/60 transition-all text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-purple-400">🎬</span>
                        <div className="flex flex-col truncate">
                          <span className="font-semibold text-zinc-200 truncate">{clip.name}</span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {clip.durationFormatted || `${Math.round(clip.duration || 0)}s`} • {clip.sizeMb ? `${clip.sizeMb}MB` : 'Video'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddClipToTimeline(clip.path, clip.name)}
                        className="px-2 py-1 rounded bg-purple-950/80 hover:bg-purple-900 text-purple-200 text-[10px] font-bold border border-purple-700/60 cursor-pointer shrink-0"
                        title="Añadir a la línea de tiempo"
                      >
                        + Añadir
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AUDIO Y MÚSICA (MULTIPISTA) */}
          {activeMediaTab === 'audio' && (
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
                    <span>{lang === 'es' ? 'No hay canciones en la bandeja. Sube múltiples archivos de audio para incorporarlos a tu video.' : 'No songs in bin. Upload multiple audio files to add to video.'}</span>
                  </div>
                ) : (
                  projectAudioList.map((song, idx) => {
                    const isAuditioning = auditioningAudioPath === song.path;
                    const isAlreadyOnTimeline = audioCuts.some(a => a.audioPath === song.path);

                    return (
                      <div
                        key={song.path || idx}
                        className={`p-2 rounded-xl border flex flex-col gap-1.5 text-xs transition-all ${isAuditioning
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
                              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-all ${isAuditioning
                                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/50 animate-pulse'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                                }`}
                              title={isAuditioning ? 'Pausar audición' : 'Escuchar vista previa'}
                            >
                              <span className="text-[10px]">{isAuditioning ? '⏸' : '▶'}</span>
                            </button>
                            <div className="flex flex-col truncate">
                              <span className="font-semibold text-zinc-200 truncate">{song.name}</span>
                              <span className="text-[10px] font-mono text-zinc-500">
                                {song.duration_formatted || `${Math.round(song.duration_seconds)}s`} • {song.size_mb ? `${song.size_mb}MB` : 'Audio'}
                              </span>
                            </div>
                          </div>

                          {/* Acciones para añadir a pista A1 */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAddAudioToTimeline(song.path, song.name)}
                              className="px-2 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 text-[10px] font-bold border border-indigo-700/60 cursor-pointer transition-all hover:scale-105"
                              title="Añadir al final de la pista A1"
                            >
                              + A1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddAudioToTimeline(song.path, song.name, playheadTime)}
                              className="px-1.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-indigo-200 text-[10px] border border-zinc-800 cursor-pointer"
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
                      onClick={() => {
                        setAudioCuts([]);
                        setSelectedAudioCutId(null);
                        setMusicAudioPath('');
                        toast.info(lang === 'es' ? 'Pista A1 vaciada' : 'Track A1 cleared');
                      }}
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
          )}

          {/* TAB 3: TEXTOS Y CTAS */}
          {activeMediaTab === 'text' && (
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
                  <span>Botón «Suscríbete»</span>
                </div>
                <span className="text-[10px] text-red-400">+ Insertar</span>
              </button>
              <button
                onClick={() => handleInsertOverlay('like_cta')}
                className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-800/50 hover:border-blue-500 text-left flex items-center justify-between text-xs cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2 text-blue-300 font-bold">
                  <span>👍</span>
                  <span>Botón «Dale Like»</span>
                </div>
                <span className="text-[10px] text-blue-400">+ Insertar</span>
              </button>
              <button
                onClick={() => handleInsertOverlay('lower_third')}
                className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-800/50 hover:border-purple-500 text-left flex items-center justify-between text-xs cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2 text-purple-300 font-bold">
                  <span>🏷️</span>
                  <span>Título / Lower Third</span>
                </div>
                <span className="text-[10px] text-purple-400">+ Insertar</span>
              </button>
            </div>
          )}

          {/* TAB 4: SUBTÍTULOS IA (WHISPER) */}
          {activeMediaTab === 'subtitles' && (
            <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto minimal-scrollbar">
              {/* Controles de Generación */}
              <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                    <span>🎧</span>
                    <span>Subtitulador Whisper IA</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 font-mono text-emerald-400 font-bold">
                    PISTA S1
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-semibold block mb-0.5">Idioma</label>
                    <select
                      value={subtitleLanguage}
                      onChange={(e) => setSubtitleLanguage(e.target.value)}
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
                      onChange={(e) => setSubtitleEngine(e.target.value)}
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
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>{lang === 'es' ? 'Analizando audio...' : 'Transcribing...'}</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>{lang === 'es' ? 'Generar Subtítulos con IA' : 'Generate AI Subtitles'}</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => subtitleFileInputRef.current?.click()}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-semibold border border-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span>📂</span>
                    <span>Importar SRT</span>
                  </button>
                  {subtitles.length > 0 && (
                    <button
                      onClick={() => {
                        const srtContent = subtitlesToSrt(subtitles);
                        const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
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
                      <span>📥</span>
                      <span>SRT</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de Bloques de Subtítulos */}
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Líneas de Subtítulo ({subtitles.length})
                  </span>
                  {subtitles.length > 0 && (
                    <button
                      onClick={() => {
                        setSubtitles([]);
                        toast.info(lang === 'es' ? 'Pista S1 vaciada' : 'S1 track cleared');
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                {subtitles.length === 0 ? (
                  <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/50 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
                    <span className="text-2xl">🎧</span>
                    <span>
                      {lang === 'es'
                        ? 'No hay subtítulos en la pista S1. Haz clic en «Generar con IA» o importa un archivo .srt'
                        : 'No subtitles on track S1. Click "Generate with AI" or import .srt'}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto minimal-scrollbar pr-1">
                    {subtitles.map((sub, idx) => {
                      const isActive = playheadTime >= sub.start && playheadTime <= sub.end;
                      return (
                        <div
                          key={sub.id}
                          onClick={() => setPlayheadTime(sub.start)}
                          className={`p-2 rounded-xl border transition-all text-xs cursor-pointer flex flex-col gap-1 ${isActive
                            ? 'bg-amber-950/40 border-amber-500/80 text-amber-200 ring-1 ring-amber-500/40'
                            : 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700 text-zinc-300'
                            }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                            <span className="font-bold text-amber-400/90">#{idx + 1}</span>
                            <span>
                              {sub.start.toFixed(1)}s ➔ {sub.end.toFixed(1)}s ({(sub.end - sub.start).toFixed(1)}s)
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubtitles(prev => prev.filter(s => s.id !== sub.id));
                              }}
                              className="text-zinc-500 hover:text-red-400 px-1 font-bold"
                              title="Eliminar este subtítulo"
                            >
                              ✕
                            </button>
                          </div>
                          <input
                            type="text"
                            value={sub.text}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const newText = e.target.value;
                              setSubtitles(prev => prev.map(s => s.id === sub.id ? { ...s, text: newText } : s));
                            }}
                            className="bg-transparent border-0 border-b border-zinc-800 focus:border-amber-400 text-zinc-200 text-xs px-0 py-0.5 focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── PANEL CENTRAL: CANVAS PLAYER & OVERLAYS (6 COLS) ──────────────── */}
        <div className="lg:col-span-6 bg-[#0e0e13] border border-zinc-800/80 rounded-2xl p-3 flex flex-col items-center justify-between relative shadow-2xl overflow-hidden">
          {/* Top Bar del Canvas */}
          <div className="w-full flex items-center justify-between pb-2 text-xs border-b border-zinc-800/60">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Canvas</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-purple-300 font-mono flex items-center gap-1">
                <span>{currentPreset.icon}</span>
                <span>{currentPreset.ratio}</span>
              </span>
            </div>

            {/* Selector de Aspect Ratio / Formato */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsFormatMenuOpen(!isFormatMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-700/80 transition-all cursor-pointer shadow-sm"
              >
                <span>{currentPreset.icon}</span>
                <span>{currentPreset.name}</span>
                <span className="text-[10px] opacity-60">▼</span>
              </button>

              {isFormatMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-40 w-64 bg-[#14141c]/95 backdrop-blur-md border border-zinc-700 rounded-xl shadow-2xl p-1.5 text-xs text-zinc-200 flex flex-col gap-1 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                    Formato de Salida
                  </div>
                  {VIDEO_FORMAT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedFormatId(p.id);
                        setIsFormatMenuOpen(false);
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg text-left transition-all cursor-pointer border ${p.id === selectedFormatId ? 'bg-purple-950/60 border-purple-500 text-white' : 'hover:bg-zinc-800'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{p.icon}</span>
                        <span className="font-semibold">{p.name}</span>
                      </div>
                      <span className="text-[9px] font-mono text-purple-300">{p.ratio}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Viewport del Video Responsivo */}
          <div
            ref={canvasContainerRef}
            onMouseDown={(e) => {
              if (selectedCutId && !canvasDraggingOverlayId) {
                setIsCanvasDraggingVideo(true);
                const currentCut = timelineCuts.find(c => c.id === selectedCutId);
                setVideoDragStart({
                  x: e.clientX,
                  y: e.clientY,
                  initialPanX: currentCut?.panX || 0,
                  initialPanY: currentCut?.panY || 0,
                });
              }
            }}
            className={`relative bg-black rounded-xl overflow-hidden border border-zinc-800/80 shadow-inner my-2 flex items-center justify-center transition-all select-none ${currentPreset.aspectClass} ${selectedCutId ? 'cursor-move' : ''}`}
          >
            {activeVideoSrc ? (
              <video
                ref={videoPlayerRef}
                src={activeVideoSrc}
                muted={muteOriginalAudio}
                playsInline
                style={{
                  transform: `scale(${currentResolvedClip?.cut?.zoom || 1}) translate(${currentResolvedClip?.cut?.panX || 0}%, ${currentResolvedClip?.cut?.panY || 0}%)`,
                  transition: isCanvasDraggingVideo ? 'none' : 'transform 0.15s ease-out',
                }}
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : timelineCuts.length > 0 ? (
              <div className="w-full h-full flex items-center justify-center bg-black select-none pointer-events-none">
                {/* Pantalla negra limpia / Black Slug para huecos y tramos de audio */}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 hover:border-purple-500/60 rounded-xl p-4 text-center cursor-pointer transition-all"
              >
                <span className="text-3xl mb-1">🎬</span>
                <p className="text-xs font-semibold text-zinc-300">
                  {lang === 'es' ? 'Arrastra clips o haz clic para importar' : 'Drag clips or click to import'}
                </p>
                <span className="text-[10px] text-zinc-500 mt-1">MP4, MOV, WEBM</span>
              </div>
            )}

            {/* Overlays DOM Arrastrables y con Sincronización Temporal Estricta */}
            {overlays.map(ov => {
              const isWithinTime = playheadTime >= ov.startTime && playheadTime <= (ov.startTime + ov.duration);
              const isSelected = selectedOverlayId === ov.id;

              // Ocultar la etiqueta si su ventana de tiempo terminó (a menos que esté seleccionada para edición)
              if (!isWithinTime && !isSelected) return null;

              const isGhost = !isWithinTime && isSelected;

              return (
                <div
                  key={ov.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setSelectedOverlayId(ov.id);
                    setSelectedCutId(null);
                    setCanvasDraggingOverlayId(ov.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${ov.xPercent}%`,
                    top: `${ov.yPercent}%`,
                    transform: `translate(-50%, -50%) scale(${ov.scale || 1})`,
                    cursor: canvasDraggingOverlayId === ov.id ? 'grabbing' : 'grab',
                    zIndex: isSelected ? 30 : 20,
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase select-none transition-all shadow-2xl backdrop-blur-md flex items-center gap-1.5 border group cursor-grab active:cursor-grabbing ${isGhost
                    ? 'opacity-65 border-dashed border-amber-400 bg-black/85 text-amber-300 ring-1 ring-amber-400'
                    : ov.type === 'subscribe_cta'
                      ? 'bg-red-600/95 text-white border-white/80'
                      : ov.type === 'like_cta'
                        ? 'bg-blue-600/95 text-white border-white/80'
                        : 'bg-zinc-900/95 text-purple-200 border-purple-500/80'
                    } ${isSelected ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-black scale-105' : 'hover:ring-1 hover:ring-white/50'}`}
                  title={`Arrastra para mover en el video (X: ${ov.xPercent}%, Y: ${ov.yPercent}%) • Activo: ${ov.startTime.toFixed(1)}s a ${(ov.startTime + ov.duration).toFixed(1)}s`}
                >
                  <span>{ov.type === 'subscribe_cta' ? '🔔' : (ov.type === 'like_cta' ? '👍' : '🏷️')}</span>
                  <span>{ov.text}</span>
                  <span className="font-mono text-[9px] opacity-75 ml-1 bg-black/40 px-1 py-0.5 rounded border border-white/20">
                    {ov.duration.toFixed(1)}s
                  </span>
                  {isGhost && (
                    <span className="text-[8px] bg-amber-500/30 text-amber-200 px-1 py-0.5 rounded font-mono border border-amber-400/40">
                      ⏳ {ov.startTime.toFixed(1)}s - {(ov.startTime + ov.duration).toFixed(1)}s
                    </span>
                  )}
                </div>
              );
            })}

            {/* Subtítulo Activo en Canvas (Overlay S1 sincronizado) */}
            {currentActiveSubtitle && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '12%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  maxWidth: '85%',
                  textAlign: 'center',
                  zIndex: 35,
                  pointerEvents: 'none',
                }}
                className="px-3.5 py-1.5 rounded-lg bg-black/85 backdrop-blur-sm border border-amber-400/40 text-amber-300 font-extrabold text-sm sm:text-base tracking-wide shadow-2xl uppercase select-none"
              >
                <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {currentActiveSubtitle.text}
                </span>
              </div>
            )}

            {/* HUD Flotante de Coordenadas de Arrastre */}
            {canvasDraggingOverlayId && (
              <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md border border-purple-500/80 px-2 py-0.5 rounded-md text-[10px] font-mono text-purple-300 pointer-events-none z-40">
                📍 Moviendo etiqueta: X: {overlays.find(o => o.id === canvasDraggingOverlayId)?.xPercent}% | Y: {overlays.find(o => o.id === canvasDraggingOverlayId)?.yPercent}%
              </div>
            )}
            {isCanvasDraggingVideo && selectedCutId && (
              <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md border border-amber-500/80 px-2 py-0.5 rounded-md text-[10px] font-mono text-amber-300 pointer-events-none z-40">
                🎥 Encuadre de Video: Pan X: {timelineCuts.find(c => c.id === selectedCutId)?.panX || 0}% | Pan Y: {timelineCuts.find(c => c.id === selectedCutId)?.panY || 0}%
              </div>
            )}
          </div>

          {/* Controles de Transporte (Scrubber & Playback) */}
          <div className="w-full flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/60 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setPlayheadTime(0);
                  if (videoPlayerRef.current) videoPlayerRef.current.currentTime = 0;
                  if (musicPlayerRef.current) musicPlayerRef.current.currentTime = 0;
                }}
                className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer border border-zinc-800"
                title="Ir al inicio"
              >
                ⏮
              </button>
              <button
                onClick={() => {
                  if (isPlaying) {
                    setIsPlaying(false);
                  } else {
                    const limit = isLoopActive ? totalTimelineDuration : sequenceDuration;
                    if (playheadTime >= limit - 0.1) setPlayheadTime(0);
                    setIsPlaying(true);
                  }
                }}
                className="w-7 h-7 rounded-lg bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center font-bold cursor-pointer shadow-sm"
                title="Reproducir / Pausar (Espacio)"
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <span className="font-mono text-xs text-purple-300 font-bold ml-1">
                {Math.floor(playheadTime / 60)}:{(playheadTime % 60).toFixed(1).padStart(4, '0')} / {Math.floor(totalTimelineDuration / 60)}:{(totalTimelineDuration % 60).toFixed(0).padStart(2, '0')}
              </span>
            </div>

            {/* Herramientas de Edición Rápida */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSplitClipAtPlayhead}
                className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-semibold border border-zinc-800 flex items-center gap-1 cursor-pointer"
                title="Dividir en cabezal (Ctrl+B)"
              >
                <span>✂️</span>
                <span>Dividir</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── PANEL DERECHO: INSPECTOR MULTI-PESTAÑA (3 COLS) ───────────────── */}
        <div className="lg:col-span-3 bg-[#0e0e13] border border-zinc-800/80 rounded-2xl p-3 flex flex-col gap-3 overflow-y-auto minimal-scrollbar">
          {renderRightInspector()}
        </div>
      </div>

      {/* ── BARRA ASISTENTE INTELIGENTE (SMART SYNC BAR) ─────────────────── */}
      {timelineCuts.length > 0 && maxAudioEnd > (sequenceDuration + 2) && !isLoopActive && !dismissedSyncBar && (
        <div className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-purple-950/80 via-indigo-950/70 to-zinc-950 border border-purple-500/40 shadow-lg flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-purple-200">
            <span className="text-base">💡</span>
            <span>
              {lang === 'es' ? (
                <>
                  Tienes <strong>{Math.floor(maxAudioEnd / 60)}:{(Math.floor(maxAudioEnd % 60)).toString().padStart(2, '0')}</strong> de música y <strong>{sequenceDuration.toFixed(1)}s</strong> de video.
                </>
              ) : (
                <>
                  You have <strong>{Math.floor(maxAudioEnd / 60)}:{(Math.floor(maxAudioEnd % 60)).toString().padStart(2, '0')}</strong> of audio and <strong>{sequenceDuration.toFixed(1)}s</strong> of video.
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTimelineCuts(prev => prev.map(c => ({ ...c, loopToAudio: true })));
                toast.success(lang === 'es' ? 'Bucle activado para cubrir la música' : 'Loop enabled to match music');
              }}
              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow transition-all"
            >
              <span>🔁</span>
              <span>{lang === 'es' ? 'Repetir videos hasta la música' : 'Loop videos to match audio'}</span>
            </button>
            <button
              onClick={() => {
                if (audioCuts.length > 0) {
                  const updated = audioCuts
                    .filter(a => a.startTime < sequenceDuration)
                    .map(a => {
                      if (a.startTime + a.duration > sequenceDuration) {
                        return { ...a, duration: Math.max(0.5, sequenceDuration - a.startTime) };
                      }
                      return a;
                    });
                  setAudioCuts(updated);
                  toast.success(lang === 'es' ? 'Música ajustada a la duración del video' : 'Audio trimmed to match video');
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
            >
              <span>✂️</span>
              <span>{lang === 'es' ? 'Recortar música al video' : 'Trim audio to video'}</span>
            </button>
            <button
              onClick={() => setDismissedSyncBar(true)}
              className="w-5 h-5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-xs cursor-pointer ml-1"
              title="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── 3. LÍNEA DE TIEMPO MULTIPISTA PRO INFERIOR (FULL WIDTH) ───────── */}
      <div className="w-full shrink-0">
        <TimelinePro
          lang={lang}
          totalDuration={totalTimelineDuration}
          playheadTime={playheadTime}
          onSeek={(newTime) => {
            setPlayheadTime(newTime);
            const resolved = resolveClipAtTime(newTime);
            if (resolved && videoPlayerRef.current) {
              const expectedPath = resolved.cut.clipPath;
              const currentSrc = videoPlayerRef.current.currentSrc || videoPlayerRef.current.src || '';
              if (!currentSrc.includes(encodeURIComponent(expectedPath)) && !currentSrc.endsWith(expectedPath)) {
                videoPlayerRef.current.src = `${getControladorUrl()}/workspace/raw?path=${encodeURIComponent(expectedPath)}`;
                videoPlayerRef.current.load();
                const onCanPlay = () => {
                  if (videoPlayerRef.current) {
                    videoPlayerRef.current.currentTime = resolved.offsetInClip;
                    if (isPlayingRef.current) videoPlayerRef.current.play().catch(() => { });
                  }
                  videoPlayerRef.current?.removeEventListener('canplay', onCanPlay);
                };
                videoPlayerRef.current.addEventListener('canplay', onCanPlay);
              } else {
                videoPlayerRef.current.currentTime = resolved.offsetInClip;
              }
            } else if (!resolved && videoPlayerRef.current) {
              if (!videoPlayerRef.current.paused) videoPlayerRef.current.pause();
            }
            if (musicPlayerRef.current) {
              if (audioCuts.length > 0) {
                const activeCut = audioCuts.find(a => newTime >= a.startTime && newTime < (a.startTime + a.duration));
                if (activeCut) {
                  const offset = Math.max(0, newTime - activeCut.startTime);
                  musicPlayerRef.current.currentTime = offset;
                } else {
                  musicPlayerRef.current.pause();
                }
              } else if (musicAudioPath) {
                const dur = musicPlayerRef.current.duration || looperTotalAudioSeconds || 1;
                musicPlayerRef.current.currentTime = dur > 0 ? (newTime % dur) : 0;
              }
            }
          }}
          cuts={timelineCuts}
          onUpdateCuts={(newCuts) => {
            setTimelineCuts(newCuts);
            if (newCuts.length === 0) {
              setSelectedCutId(null);
              setPlayheadTime(0);
              if (videoPlayerRef.current) videoPlayerRef.current.pause();
              if (musicPlayerRef.current) musicPlayerRef.current.pause();
              setIsPlaying(false);
            }
          }}
          selectedCutId={selectedCutId}
          onSelectCut={(id) => {
            setSelectedCutId(id);
            if (id) setActiveInspectorTab('clip');
          }}
          onSplitAtPlayhead={handleSplitClipAtPlayhead}
          overlays={overlays}
          onUpdateOverlays={setOverlays}
          selectedOverlayId={selectedOverlayId}
          onSelectOverlay={(id) => {
            setSelectedOverlayId(id);
            if (id) setActiveInspectorTab('overlay');
          }}
          audioCuts={audioCuts}
          onUpdateAudioCuts={setAudioCuts}
          selectedAudioCutId={selectedAudioCutId}
          onSelectAudioCut={(id) => {
            setSelectedAudioCutId(id);
            if (id) setActiveInspectorTab('audio');
          }}
          musicName={musicAudioPath ? musicAudioPath.split(/[/\\]/).pop() : undefined}
          musicVolume={musicVolume}
          onChangeMusicVolume={setMusicVolume}
          muteOriginalAudio={muteOriginalAudio}
          onToggleMuteOriginal={() => setMuteOriginalAudio(!muteOriginalAudio)}
          onExtractAudio={(clipPath) => {
            handleAddAudioToTimeline(clipPath, clipPath.split(/[/\\]/).pop() || 'Audio extraído');
            setMuteOriginalAudio(true);
            toast.success(lang === 'es' ? 'Audio extraído a la pista A1' : 'Audio extracted to A1 track');
          }}
          onUploadMusic={(files) => processUploadedAudioFiles(files)}
          onDropMusicPath={(path, name) => {
            handleAddAudioToTimeline(path, name);
          }}
          onClearMusic={() => {
            setAudioCuts([]);
            setSelectedAudioCutId(null);
            setMusicAudioPath('');
            toast.info(lang === 'es' ? 'Pista de música vaciada' : 'Music track cleared');
          }}
          onUploadVideos={(files) => processUploadedFiles(files)}
          onDropVideoPath={(path, name) => {
            handleAddClipToTimeline(path, name);
          }}
          subtitles={subtitles}
        />
      </div>

      {/* Inputs nativos ocultos para subida directa */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processUploadedFiles(Array.from(e.target.files));
          }
        }}
        multiple
        accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
        className="hidden"
      />
      <input
        type="file"
        ref={audioFileInputRef}
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processUploadedAudioFiles(Array.from(e.target.files));
          }
        }}
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
        className="hidden"
      />
      <input
        type="file"
        ref={subtitleFileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleImportSubtitleFile(e.target.files[0]);
          }
        }}
        accept=".srt,.vtt,.txt"
        className="hidden"
      />
      <audio
        ref={musicPlayerRef}
        preload="auto"
        className="hidden"
      />
      <audio
        ref={auditionPlayerRef}
        onEnded={() => setAuditioningAudioPath(null)}
        className="hidden"
      />

      {/* ── MODAL DE EXPORTACIÓN Y CONFIGURACIÓN DEL PROYECTO ── */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#121217] border border-purple-500/30 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-800 bg-[#16161f] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base text-purple-400">⚙️</span>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    {lang === 'es' ? 'Configuración de Exportación' : 'Export Configuration'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {lang === 'es' ? 'Ajusta los parámetros finales antes de procesar el video' : 'Configure final parameters before rendering'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col gap-4 text-xs">
              {/* Ubicación y Destino del Video */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-zinc-300 font-bold flex items-center gap-1.5">
                    <span>📁</span>
                    <span>{lang === 'es' ? 'Ubicación y Destino del Video' : 'Video Location & Destination'}</span>
                  </label>
                  <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg text-[10px]">
                    <button
                      type="button"
                      onClick={() => setExportDestinationMode('existing')}
                      className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${exportDestinationMode === 'existing'
                        ? 'bg-purple-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                      {lang === 'es' ? 'Existente' : 'Existing'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportDestinationMode('new')}
                      className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${exportDestinationMode === 'new'
                        ? 'bg-purple-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                      {lang === 'es' ? '+ Nueva Carpeta' : '+ New Folder'}
                    </button>
                  </div>
                </div>

                {exportDestinationMode === 'existing' ? (
                  <div className="bg-zinc-950 border border-zinc-800 focus-within:border-purple-500 rounded-xl px-3 py-2 text-xs">
                    <select
                      value={targetFolder}
                      onChange={(e) => setTargetFolder(e.target.value)}
                      className="w-full bg-transparent text-purple-300 font-mono focus:outline-none cursor-pointer text-xs"
                    >
                      <option value="" className="bg-zinc-900 text-zinc-500">
                        {lang === 'es' ? '— Selecciona una carpeta del workspace —' : '— Select a workspace folder —'}
                      </option>
                      {availableFolders.map((f) => (
                        <option key={f.path} value={f.path} className="bg-zinc-900 text-zinc-200">
                          {f.name}
                        </option>
                      ))}
                      {targetFolder && !availableFolders.some(f => f.path === targetFolder) && (
                        <option value={targetFolder} className="bg-zinc-900 text-purple-300">
                          {targetFolder.split(/[/\\]/).slice(-2).join('/')}
                        </option>
                      )}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 p-3 rounded-xl bg-purple-950/20 border border-purple-800/40">
                    <div className="text-[10px] text-purple-300 font-medium flex items-center gap-1.5">
                      <span>✨</span>
                      <span>{lang === 'es' ? 'Crear carpeta del video automáticamente con sus subcarpetas:' : 'Automatically create video folder with production subfolders:'}</span>
                    </div>
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Nombre_Del_Video"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-zinc-200 font-mono text-xs outline-none"
                    />
                    <div className="text-[10px] text-zinc-400 font-mono truncate">
                      {activeProject?.channel ? (
                        <span>Canal: <strong className="text-zinc-300">{activeProject.channel.name}</strong>/{newFolderName || '...'}/Videos</span>
                      ) : (
                        <span>Workspace: <strong className="text-zinc-300">Raíz</strong>/{newFolderName || '...'}/Videos</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Nombre del Archivo */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-zinc-300 font-bold">
                  {lang === 'es' ? 'Nombre del Archivo' : 'Filename'}
                </label>
                <input
                  type="text"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 rounded-xl px-3 py-2 text-zinc-200 font-mono text-xs outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-zinc-300 font-bold">
                    {lang === 'es' ? 'Resolución de Exportación' : 'Resolution'}
                  </label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 rounded-xl px-3 py-2 text-zinc-200 text-xs cursor-pointer outline-none transition-colors"
                  >
                    <option value="1080p">📺 1080p Full HD</option>
                    <option value="4k">💎 4K Ultra HD</option>
                    <option value="720p">⚡ 720p Rápido</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-zinc-300 font-bold">
                    {lang === 'es' ? 'Calidad CRF (H.264)' : 'CRF Quality'}
                  </label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 rounded-xl px-3 py-2 text-zinc-200 text-xs cursor-pointer outline-none transition-colors"
                  >
                    <option value="high">✨ Alta Nitidez (CRF 17)</option>
                    <option value="master">💎 Master Ultra (CRF 14)</option>
                    <option value="balanced">⚖️ Equilibrado (CRF 21)</option>
                  </select>
                </div>
              </div>

              {/* Motor de Cómputo (Local vs Nube) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-zinc-300 font-bold flex items-center justify-between">
                  <span>{lang === 'es' ? 'Motor de Cómputo' : 'Compute Engine'}</span>
                  <span className="text-[10px] text-purple-400 font-mono">Híbrido</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportEngine('local')}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${exportEngine === 'local'
                      ? 'bg-purple-950/40 border-purple-500 text-white shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                  >
                    <span className="text-base">⚡</span>
                    <div>
                      <div className="font-bold text-[11px]">Mi PC (Local)</div>
                      <div className="text-[9px] text-zinc-400">$0 costo • GPU nativa</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportEngine('cloud')}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${exportEngine === 'cloud'
                      ? 'bg-purple-950/40 border-purple-500 text-white shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                  >
                    <span className="text-base">☁️</span>
                    <div>
                      <div className="font-bold text-[11px]">En la Nube</div>
                      <div className="text-[9px] text-zinc-400">Worker remoto</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Resumen de Producción */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col gap-1.5 text-xs font-mono text-zinc-400">
                <div className="flex justify-between">
                  <span>Clips en secuencia:</span>
                  <span className="text-zinc-200 font-bold">{timelineCuts.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pistas de audio (A1):</span>
                  <span className="text-indigo-300 font-bold">{audioCuts.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duración neta:</span>
                  <span className="text-purple-300 font-bold">{sequenceDuration.toFixed(1)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Modo Bucle:</span>
                  <span className={isLoopActive ? 'text-amber-300 font-bold' : 'text-zinc-500'}>
                    {isLoopActive ? 'Activado' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-5 py-3.5 border-t border-zinc-800 bg-[#16161f] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs cursor-pointer transition-colors"
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExportModalOpen(false);
                  handleExecuteRender(false);
                }}
                disabled={isRenderingPreview || isRenderingFull}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 cursor-pointer transition-all disabled:opacity-50"
              >
                🚀 {lang === 'es' ? 'Iniciar Exportación' : 'Start Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
