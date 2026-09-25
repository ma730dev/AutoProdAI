export function getControladorUrl() {
  if (typeof window !== 'undefined') {
    const port = localStorage.getItem('autoprod_motor_port') || '8000';
    return `http://127.0.0.1:${port}`;
  }
  return 'http://127.0.0.1:8000';
};

export interface TTSVoice {
  id: string;
  name: string;
  provider: 'edge_tts' | 'openai';
  gender?: string;
  locale?: string;
  description?: string;
  sample_text?: string;
  lang?: string;
  style?: string;
}

export interface TTSVoicesResponse {
  providers?: {
    edge_tts: TTSVoice[];
    openai: TTSVoice[];
  };
  edge_tts?: TTSVoice[];
  openai?: TTSVoice[];
}

export interface TTSGenerateParams {
  provider: 'edge_tts' | 'openai';
  voice: string;
  text: string;
  targetPath?: string | null;
  channelName?: string | null;
  videoTitle?: string | null;
  apiKey?: string | null;
  rate?: string;
  filename?: string | null;
}

export interface TTSGenerateResponse {
  success: boolean;
  outputPath?: string;
  durationSeconds?: number;
  duration_seconds?: number;
  file_size_bytes?: number;
  file_path?: string;
  file_name?: string;
  provider?: string;
  voice?: string;
  error?: string;
}

export class ControladorClient {
  /**
   * Verifica si el controlador local está corriendo y accesible.
   */
  static async checkStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${getControladorUrl()}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // Timeout corto para no colgar la UI si no está
        signal: AbortSignal.timeout(2000) 
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Arranca el motor de Python llamando a la API local de Next.js
   */
  static async startMotor(port: number = 8000): Promise<void> {
    try {
      const response = await fetch('/api/motor/start', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port })
      });
      
      if (response.status === 409) {
        throw new Error('PORT_IN_USE');
      }
      
      if (!response.ok) {
        throw new Error('Error al arrancar el motor');
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Error desconocido arrancando el motor');
      }
    } catch (error) {
      console.error('Controlador Client: startMotor failed', error);
      throw error;
    }
  }

  /**
   * Apaga el motor local de Python
   */
  static async shutdownMotor(): Promise<void> {
    try {
      await fetch(`${getControladorUrl()}/shutdown`, { method: 'POST' });
    } catch (e) {
      console.warn('Motor apagado', e);
    }
  }

  /**
   * Envía un mensaje a la consola local de IA
   */
  static async askConsoleAI(prompt: string, commandTemplate: string): Promise<string> {
    try {
      const response = await fetch(`${getControladorUrl()}/chat/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, command_template: commandTemplate }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Error en la consola de IA');
      }
      return data.response;
    } catch (error) {
      console.error('Controlador Client: askConsoleAI failed', error);
      throw error;
    }
  }

  /**
   * Abre el explorador de archivos nativo del SO para que el usuario elija una carpeta.
   */
  static async pickWorkspace(): Promise<{ path: string }> {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/pick`);
      if (!response.ok) {
        throw new Error('No se seleccionó carpeta o hubo un error');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: pickWorkspace failed', error);
      throw error;
    }
  }

  /**
   * Obtiene la ruta por defecto del workspace de AutoProd
   */
  static async getDefaultWorkspace(): Promise<{ path: string }> {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/default`);
      if (!response.ok) {
        throw new Error('No se pudo obtener la ruta por defecto');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: getDefaultWorkspace failed', error);
      throw error;
    }
  }

  /**
   * Abre la carpeta del workspace en el explorador de archivos nativo de Windows / macOS
   */
  static async openWorkspaceFolder(folderPath?: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/open_folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath || null }),
      });
      if (!response.ok) {
        throw new Error('No se pudo abrir la carpeta en el explorador');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: openWorkspaceFolder failed', error);
      throw error;
    }
  }

  /**
   * Obtiene la información detallada del motor local (versión, ruta, estado)
   */
  static async getMotorInfo(): Promise<{ status: string; message: string; version: string; workspace_path: string } | null> {
    try {
      const response = await fetch(`${getControladorUrl()}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Lista el contenido del workspace.
   */
  static async getWorkspace(basePath: string) {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/?base_path=${encodeURIComponent(basePath)}`);
      if (!response.ok) {
        throw new Error('Error fetching workspace');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: getWorkspace failed', error);
      throw error;
    }
  }

  /**
   * Crea una nueva carpeta, opcionalmente con subcarpetas.
   */
  static async createFolder(targetPath: string, folderName: string, subfolders?: string[]) {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_path: targetPath,
          folder_name: folderName,
          subfolders: subfolders || []
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error initializing workspace');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: initVideoWorkspace failed', error);
    }
  }

  static async initVideoWorkspace(basePath: string, channelName: string, _structureName?: string, folders?: string[]) {
    return this.createFolder(basePath, channelName, folders);
  }

  /**
   * Crea un nuevo canal en la rama youtube con su estructura modular completa y plantillas Markdown.
   */
  static async createChannel(channelName: string, niche?: string, targetPath?: string) {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_name: channelName,
          target_path: targetPath,
          niche: niche || channelName,
          is_channel: true,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al crear canal');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: createChannel failed', error);
      throw error;
    }
  }

  /**
   * Audita las carpetas físicas de canales presentes en workspace/youtube.
   */
  static async auditChannels() {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/audit_channels`);
      if (!response.ok) {
        throw new Error('Error al auditar canales físicos');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: auditChannels failed', error);
      return null;
    }
  }

  /**
   * Elimina una o múltiples carpetas físicas en el workspace.
   */
  static async deleteFolder(paths: string | string[]) {
    try {
      const pathList = Array.isArray(paths) ? paths : [paths];
      const response = await fetch(`${getControladorUrl()}/workspace/delete_folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: pathList }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Error al eliminar carpeta(s)');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: deleteFolder failed', error);
      throw error;
    }
  }

  /**
   * Lee el contenido de un archivo
   */
  static async readFile(path: string): Promise<string> {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/file?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error leyendo el archivo');
      }
      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error('Controlador Client: readFile failed', error);
      throw error;
    }
  }

  /**
   * Guarda el contenido en un archivo
   */
  static async saveFile(path: string, content: string): Promise<void> {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error guardando el archivo');
      }
    } catch (error) {
      console.error('Controlador Client: saveFile failed', error);
      throw error;
    }
  }

  /**
   * Inspecciona las propiedades de un archivo de video o audio
   */
  static async inspectMedia(filePath: string): Promise<any> {
    try {
      const response = await fetch(`${getControladorUrl()}/video/inspect_media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error inspeccionando medio');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: inspectMedia failed', error);
      throw error;
    }
  }

  /**
   * Escanea una carpeta en busca de canciones y calcula la duración total
   */
  static async scanAudioFolder(folderPath: string): Promise<any> {
    try {
      const response = await fetch(`${getControladorUrl()}/video/scan_audio_folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error escaneando carpeta de audio');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: scanAudioFolder failed', error);
      throw error;
    }
  }

  /**
   * Inicia el renderizado de un loop de video (previsualización o export completo)
   */
  static async createVideoLoop(params: {
    videoPaths: string[];
    durationMode?: 'custom' | 'audio_folder';
    targetDurationSeconds?: number;
    audioFolderPath?: string | null;
    resolution?: string;
    quality?: string;
    isPreview?: boolean;
    muteOriginalAudio?: boolean;
    outputChannel?: string | null;
    outputFolderPath?: string | null;
    outputFilename?: string | null;
  }): Promise<{ job_id: string; status: string; is_preview: boolean; message: string }> {
    try {
      const response = await fetch(`${getControladorUrl()}/video/create_loop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_paths: params.videoPaths,
          duration_mode: params.durationMode || 'custom',
          target_duration_seconds: params.targetDurationSeconds || 300,
          audio_folder_path: params.audioFolderPath || null,
          resolution: params.resolution || '1080p',
          quality: params.quality || 'high',
          is_preview: params.isPreview ?? false,
          mute_original_audio: params.muteOriginalAudio ?? false,
          output_channel: params.outputChannel || null,
          output_folder_path: params.outputFolderPath || null,
          output_filename: params.outputFilename || null,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error iniciando loop de video');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: createVideoLoop failed', error);
      throw error;
    }
  }

  /**
   * Obtiene la lista de carpetas de video disponibles en el workspace
   */
  static async getVideoFolders(): Promise<Array<{ name: string; path: string }>> {
    try {
      const response = await fetch(`${getControladorUrl()}/video/video_folders`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.folders || [];
    } catch {
      return [];
    }
  }


  /**
   * Consulta el estado y progreso de un job de renderizado
   */
  static async getVideoJobStatus(jobId: string): Promise<any> {
    try {
      const response = await fetch(`${getControladorUrl()}/video/status/${encodeURIComponent(jobId)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error consultando estado del render');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: getVideoJobStatus failed', error);
      throw error;
    }
  }

  static async getVideoLoopStatus(jobId: string): Promise<any> {
    return this.getVideoJobStatus(jobId);
  }

  /**
   * Inicia el renderizado multipista del Timeline Studio (cortes, mezcla de audio, overlays)
   */
  static async renderTimeline(params: {
    cuts: Array<{
      clip_path: string;
      start_time?: number;
      end_time?: number | null;
      duration?: number | null;
      loop_to_duration?: number | null;
      is_reversed?: boolean;
    }>;
    overlays?: Array<{
      type: string;
      text?: string | null;
      path?: string | null;
      x_percent?: number;
      y_percent?: number;
      scale?: number;
      start_time?: number;
      duration?: number;
    }>;
    audio?: {
      voice_audio_path?: string | null;
      music_audio_path?: string | null;
      music_tracks?: Array<{
        id?: string;
        path: string;
        name?: string;
        start_time: number;
        duration?: number | null;
        volume?: number;
      }>;
      music_volume?: number;
      mute_video_audio?: boolean;
    };
    subtitlePath?: string | null;
    resolution?: string;
    quality?: string;
    aspectRatio?: string;
    outputFolderPath?: string | null;
    outputFilename?: string | null;
    isPreview?: boolean;
  }): Promise<{ job_id: string; status: string; is_preview: boolean; message: string }> {
    try {
      const response = await fetch(`${getControladorUrl()}/video/render_timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuts: params.cuts,
          overlays: params.overlays || [],
          audio: params.audio || null,
          subtitle_path: params.subtitlePath || null,
          resolution: params.resolution || '1080p',
          quality: params.quality || 'high',
          aspect_ratio: params.aspectRatio || '16:9',
          output_folder_path: params.outputFolderPath || null,
          output_filename: params.outputFilename || 'render_final.mp4',
          is_preview: params.isPreview ?? false,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error en composición de timeline');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: renderTimeline failed', error);
      throw error;
    }
  }

  /**
   * Retorna la URL directa para streaming de la previsualización
   */
  static getPreviewVideoUrl(jobId: string): string {
    return `${getControladorUrl()}/video/preview/${encodeURIComponent(jobId)}`;
  }

  // ──────────────────────────────────────────────
  // Gestión de Hardware & Subtítulos (Whisper)
  // ──────────────────────────────────────────────

  /**
   * Consulta las especificaciones de hardware y el estado de la cola en tiempo real
   */
  static async getHardwareInfo(): Promise<HardwareSpecs> {
    try {
      const response = await fetch(`${getControladorUrl()}/system/hardware`);
      if (!response.ok) {
        throw new Error('No se pudo obtener información del hardware');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: getHardwareInfo failed', error);
      throw error;
    }
  }

  /**
   * Estima la duración y el tiempo de procesamiento de subtítulos para el modal previo
   */
  static async estimateSubtitles(params: {
    targetType: 'video' | 'songs_folder';
    path: string;
    engine?: string;
  }): Promise<SubtitlesEstimateResponse> {
    try {
      const response = await fetch(`${getControladorUrl()}/subtitles/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: params.targetType,
          path: params.path,
          engine: params.engine || 'openai_api',
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error calculando estimación de subtítulos');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: estimateSubtitles failed', error);
      throw error;
    }
  }

  /**
   * Inicia el trabajo de subtitulado (video o lote de canciones)
   */
  static async generateSubtitles(params: {
    targetType: 'video' | 'songs_folder';
    path: string;
    channelName?: string;
    engine?: string;
    language?: string;
    formats?: string[];
    burnToVideo?: boolean;
  }): Promise<{ job_id: string; status: string; slot_acquired: boolean; message: string }> {
    try {
      const response = await fetch(`${getControladorUrl()}/subtitles/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: params.targetType,
          path: params.path,
          channel_name: params.channelName || null,
          engine: params.engine || 'openai_api',
          language: params.language || 'es',
          formats: params.formats || ['.srt', '.vtt', '.json'],
          burn_to_video: params.burnToVideo ?? false,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error iniciando generación de subtítulos');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: generateSubtitles failed', error);
      throw error;
    }
  }

  /**
   * Consulta el progreso y estado en tiempo real del trabajo de subtitulado
   */
  static async getSubtitlesJobStatus(jobId: string): Promise<SubtitlesJobStatus> {
    try {
      const response = await fetch(`${getControladorUrl()}/subtitles/status/${encodeURIComponent(jobId)}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error consultando estado de subtítulos');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: getSubtitlesJobStatus failed', error);
      throw error;
    }
  }

  /**
   * Obtiene el contenido de un archivo de subtítulo para previsualizar/editar
   */
  static async previewSubtitleFile(path: string): Promise<{ path: string; name: string; content: string }> {
    try {
      const response = await fetch(`${getControladorUrl()}/subtitles/preview_file?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error leyendo archivo de subtítulo');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: previewSubtitleFile failed', error);
      throw error;
    }
  }

  /**
   * Guarda cambios realizados en el archivo de subtítulo
   */
  static async saveSubtitleFile(path: string, content: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${getControladorUrl()}/subtitles/save_file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error guardando archivo de subtítulo');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: saveSubtitleFile failed', error);
      throw error;
    }
  }

  /**
   * Guarda un archivo binario (ej. imagen base64 de DALL-E) físicamente en el workspace local
   */
  static async saveBinaryFile(params: {
    base64Data: string;
    fileName: string;
    channelName?: string | null;
    subfolder?: string;
    targetPath?: string | null;
  }): Promise<{ status: string; path: string; name: string; format: string; sizeBytes: number }> {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/save_binary_file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64_data: params.base64Data,
          file_name: params.fileName,
          channel_name: params.channelName || null,
          subfolder: params.subfolder || 'Miniaturas',
          target_path: params.targetPath || null,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error guardando archivo binario en disco local');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: saveBinaryFile failed', error);
      throw error;
    }
  }

  /**
   * Sube archivos de video o audio de cualquier tamaño (100MB, 2GB, 10GB+)
   * mediante streaming multipart directamente al disco sin pasar por Base64
   */
  static async uploadStreamFile(
    file: File,
    targetPath?: string | null,
    subfolder: string = 'Videos'
  ): Promise<{ status: string; path: string; name: string; size_bytes: number; size_mb: number }> {
    try {
      const baseUrl = getControladorUrl();
      const params = new URLSearchParams();
      params.set('filename', file.name);
      if (targetPath) params.set('target_path', targetPath);
      params.set('subfolder', subfolder);

      const response = await fetch(`${baseUrl}/workspace/upload_stream?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Filename': encodeURIComponent(file.name),
          ...(targetPath ? { 'X-Target-Path': encodeURIComponent(targetPath) } : {}),
          'X-Subfolder': encodeURIComponent(subfolder),
        },
        body: file,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Error en subida de archivo (${response.status})`);
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: uploadStreamFile failed', error);
      throw error;
    }
  }

  /**
   * Obtiene la lista de videos existentes en una carpeta del workspace
   */
  static async getFolderVideos(folderPath: string): Promise<Array<{ name: string; path: string; size_mb: number }>> {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/folder_videos?folder_path=${encodeURIComponent(folderPath)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.videos || [];
    } catch {
      return [];
    }
  }

  /**
   * Elimina un archivo físico específico del workspace
   */
  static async deleteFile(path: string): Promise<{ status: string; message: string; deleted_path: string }> {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/delete_file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error eliminando archivo físico');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: deleteFile failed', error);
      throw error;
    }
  }

  // ──────────────────────────────────────────────
  // Text-to-Speech (Locución Multi-Motor)
  // ──────────────────────────────────────────────

  /**
   * Obtiene el catálogo de voces de Edge-TTS y OpenAI TTS
   */
  static async getTTSVoices(): Promise<TTSVoicesResponse> {
    try {
      const response = await fetch(`${getControladorUrl()}/tts/voices`);
      if (!response.ok) {
        throw new Error('Error al consultar voces del motor');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: getTTSVoices failed', error);
      throw error;
    }
  }

  /**
   * Genera un fragmento de audio MP3 para previsualización inmediata
   */
  static async previewTTS(params: {
    provider: 'edge_tts' | 'openai';
    voice: string;
    text: string;
    apiKey?: string;
    rate?: string;
  }): Promise<Blob> {
    try {
      const response = await fetch(`${getControladorUrl()}/tts/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: params.provider,
          voice: params.voice,
          text: params.text,
          api_key: params.apiKey || null,
          rate: params.rate || '+0%',
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error en preview de voz');
      }
      return await response.blob();
    } catch (error) {
      console.error('Controlador Client: previewTTS failed', error);
      throw error;
    }
  }

  /**
   * Genera el archivo MP3 completo de locución en el workspace local
   */
  static async generateTTS(params: TTSGenerateParams): Promise<TTSGenerateResponse> {
    try {
      const response = await fetch(`${getControladorUrl()}/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: params.provider,
          voice: params.voice,
          text: params.text,
          target_path: params.targetPath || null,
          channel_name: params.channelName || null,
          video_title: params.videoTitle || null,
          filename: params.filename || null,
          api_key: params.apiKey || null,
          rate: params.rate || '+0%',
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error generando archivo de locución');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: generateTTS failed', error);
      throw error;
    }
  }

  /**
   * Abre el explorador de archivos nativo de Windows / macOS / Linux en la carpeta del archivo
   */
  static async openFolder(path: string): Promise<{ status: string; opened: string }> {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/open_folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error abriendo carpeta en explorador');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: openFolder failed', error);
      throw error;
    }
  }

  /**
   * Escanea las carpetas de un canal o ruta en busca de archivos multimedia (imágenes, subtítulos, videos, audios)
   */
  static async scanMedia(params: {
    channelName?: string | null;
    targetPath?: string | null;
  }): Promise<{ status: string; target_path: string; channel: string; count: number; files: Array<{
    name: string;
    format: string;
    type: string;
    localPath: string;
    relativePath: string;
    sizeBytes: number;
    modifiedAt: string;
  }> }> {
    try {
      const response = await fetch(`${getControladorUrl()}/workspace/scan_media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_name: params.channelName || null,
          target_path: params.targetPath || null,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error escaneando medios locales');
      }
      return await response.json();
    } catch (error) {
      console.error('Controlador Client: scanMedia failed', error);
      throw error;
    }
  }
}

// ──────────────────────────────────────────────
// Tipos de Hardware & Subtítulos
// ──────────────────────────────────────────────

export interface HardwareSpecs {
  cpu_cores: number;
  safe_threads: number;
  total_ram_gb: number;
  avail_ram_gb: number;
  memory_load_percent: number;
  gpu_name: string;
  has_gpu: boolean;
  has_cuda: boolean;
  power_level: 'high' | 'medium' | 'low';
  is_busy: boolean;
  active_job: any;
  queue_length: number;
}

export interface EngineEstimate {
  estimated_seconds: number;
  formatted: string;
  cpu_impact: string;
  speed_multiplier: string;
  recommended?: boolean;
  supported?: boolean;
}

export interface SubtitlesEstimateResponse {
  target_type: 'video' | 'songs_folder';
  path: string;
  total_files: number;
  files: Array<{ name: string; duration_seconds: number; duration_formatted: string }>;
  total_duration_seconds: number;
  total_duration_formatted: string;
  hardware_specs: HardwareSpecs;
  estimate: {
    media_duration_seconds: number;
    media_duration_formatted: string;
    engine_estimates: {
      openai_api: EngineEstimate;
      local_gpu: EngineEstimate;
      local_cpu: EngineEstimate;
    };
    selected_engine: string;
    selected_estimate: string;
    power_warning: string;
    charger_warning: string;
  };
}

export interface SubtitleResultItem {
  file_name: string;
  srt_path: string;
  vtt_path: string;
  json_path: string;
  segments_count: number;
  text_snippet: string;
}

export interface SubtitlesJobStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  current_track: string;
  total_tracks: number;
  processed_tracks: number;
  results: SubtitleResultItem[];
  output_folder?: string;
  subtitled_video_path?: string;
  burn_warning?: string;
  error?: string;
}
