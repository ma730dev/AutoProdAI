/**
 * shared/types.ts
 * Tipos e interfaces compartidos del VideoStudio.
 * Importar desde aquí en lugar de desde VideoStudio.tsx.
 */

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
