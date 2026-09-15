'use client';

/**
 * 🎬 VideoLooperStudio (Compatibilidad hacia atrás)
 * Este archivo re-exporta el componente unificado VideoStudio, donde el editor de video
 * multipista es la funcionalidad Core y el Looper es una feature integrada.
 */
import VideoStudio, {
  VIDEO_FORMAT_PRESETS,
  VideoItem,
  SongItem,
  FolderOption,
  VideoFormatPreset
} from './VideoStudio';

export { VIDEO_FORMAT_PRESETS };
export type { VideoItem, SongItem, FolderOption, VideoFormatPreset };
export default VideoStudio;
