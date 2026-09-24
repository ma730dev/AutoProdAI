'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ControladorClient,
  TTSVoice,
  TTSVoicesResponse,
  TTSGenerateResponse
} from '@/lib/controlador-client';
import { toast } from 'sonner';

interface TextToSpeechStudioProps {
  lang: 'es' | 'en';
  channels: Array<{ id: string; name: string; localPath?: string | null }>;
  workspacePath: string | null;
  workspaceTree?: any[];
  motorStatus: boolean;
  onBackToDashboard: () => void;
  onOpenSubtitlesStudio?: (audioPath?: string) => void;
}

export const TextToSpeechStudio: React.FC<TextToSpeechStudioProps> = ({
  lang,
  channels,
  workspacePath,
  workspaceTree = [],
  motorStatus,
  onBackToDashboard,
  onOpenSubtitlesStudio,
}) => {
  // Estados de Configuración
  const [selectedProvider, setSelectedProvider] = useState<'edge_tts' | 'openai'>('edge_tts');
  const [selectedVoice, setSelectedVoice] = useState<string>('es-ES-AlvaroNeural');
  const [scriptText, setScriptText] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<string>('+0%');
  
  // Selección de Destino
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [videoFolders, setVideoFolders] = useState<string[]>([]);

  // Estados de Voces y Reproducción
  const [voicesData, setVoicesData] = useState<TTSVoicesResponse | null>(null);
  const [isLoadingVoices, setIsLoadingVoices] = useState<boolean>(true);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Estados de Generación
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedResult, setGeneratedResult] = useState<TTSGenerateResponse | null>(null);
  const generatedAudioRef = useRef<HTMLAudioElement | null>(null);

  // Cargar catálogo de voces al montar
  useEffect(() => {
    let isMounted = true;
    const loadVoices = async () => {
      try {
        setIsLoadingVoices(true);
        const data = await ControladorClient.getTTSVoices();
        if (isMounted) {
          setVoicesData(data);
        }
      } catch (err) {
        console.warn('No se pudieron cargar voces dinámicas del motor local:', err);
      } finally {
        if (isMounted) setIsLoadingVoices(false);
      }
    };

    if (motorStatus) {
      loadVoices();
    }
    return () => {
      isMounted = false;
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
    };
  }, [motorStatus]);

  // Actualizar lista de videos cuando cambia el canal seleccionado
  useEffect(() => {
    if (!selectedChannel || !workspaceTree) {
      setVideoFolders([]);
      setSelectedVideo('');
      return;
    }

    const channelNode = workspaceTree.find(
      (node: any) => node.name.toLowerCase() === selectedChannel.toLowerCase()
    );

    if (channelNode && channelNode.children) {
      const videos = channelNode.children
        .filter((child: any) => child.type === 'directory' && child.name !== 'InfoCanal')
        .map((child: any) => child.name);
      setVideoFolders(videos);
      if (videos.length > 0) {
        setSelectedVideo(videos[0]);
      } else {
        setSelectedVideo('');
      }
    } else {
      setVideoFolders([]);
      setSelectedVideo('');
    }
  }, [selectedChannel, workspaceTree]);

  // Inicializar primer canal por defecto
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0].name);
    }
  }, [channels, selectedChannel]);

  // Manejar reproducción de muestra de voz (Preview)
  const handlePreviewVoice = async (voice: TTSVoice) => {
    try {
      if (previewingVoiceId === voice.id && audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        setPreviewingVoiceId(null);
        return;
      }

      setPreviewingVoiceId(voice.id);
      const blob = await ControladorClient.previewTTS({
        provider: selectedProvider,
        voice: voice.id,
        text: voice.sample_text,
        rate: speechRate,
      });

      const audioUrl = URL.createObjectURL(blob);
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      audioPreviewRef.current = audio;
      audio.onended = () => setPreviewingVoiceId(null);
      audio.onerror = () => {
        setPreviewingVoiceId(null);
        toast.error('Error al reproducir muestra de voz.');
      };
      await audio.play();
    } catch (err: any) {
      setPreviewingVoiceId(null);
      toast.error(`Error en preview: ${err.message || 'Fallo de audio'}`);
    }
  };

  // Manejar Generación Final
  const handleGenerateSpeech = async () => {
    if (!scriptText.trim()) {
      toast.error('Por favor escribe o pega el texto que deseas narrar.');
      return;
    }

    if (!motorStatus) {
      toast.error('El Motor Local de AutoProd debe estar ejecutándose para generar la locución.');
      return;
    }

    setIsGenerating(true);
    setGeneratedResult(null);

    try {
      const result = await ControladorClient.generateTTS({
        provider: selectedProvider,
        voice: selectedVoice,
        text: scriptText.trim(),
        channelName: selectedChannel || undefined,
        videoTitle: selectedVideo || undefined,
        rate: speechRate,
      });

      setGeneratedResult(result);
      toast.success('¡Locución generada exitosamente!');
    } catch (err: any) {
      toast.error(`Error generando locución: ${err.message || 'Fallo en síntesis'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Calcular métricas del texto
  const wordsCount = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0;
  const charsCount = scriptText.length;
  // Estimación promedio: 130 palabras por minuto
  const estimatedSeconds = Math.round((wordsCount / 130) * 60);
  const estimatedTimeFormatted = `${Math.floor(estimatedSeconds / 60)}m ${estimatedSeconds % 60}s`;

  const currentVoices = voicesData?.providers[selectedProvider]?.voices || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#121214] text-white overflow-hidden">
      
      {/* ── Encabezado ── */}
      <div className="p-5 border-b border-white/10 bg-zinc-900/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Regresar al inicio"
          >
            ←
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎙️</span>
              <h2 className="text-lg font-bold text-white tracking-tight">Locución Studio & Text-to-Speech</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Multi-Motor
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Genera voces en off para tus guiones con opción gratuita ilimitada o alta fidelidad OpenAI.
            </p>
          </div>
        </div>

        {/* Estado del Motor Local */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs">
          <span className={`w-2 h-2 rounded-full ${motorStatus ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-zinc-300 font-medium">
            {motorStatus ? 'Motor Local Conectado' : 'Motor Desconectado'}
          </span>
        </div>
      </div>

      {/* ── Cuerpo Principal en 2 Columnas ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* Columna Izquierda: Texto del Guion y Destino (7 Cols) */}
        <div className="lg:col-span-7 p-6 border-r border-white/10 flex flex-col overflow-y-auto space-y-5 custom-scrollbar">
          
          {/* Destino en Workspace */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/5 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <span>📁</span> Ubicación de Producción en el Workspace
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Canal de Destino:</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full bg-[#18181b] border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  {channels.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Proyecto de Video (Hermano de InfoCanal):</label>
                <select
                  value={selectedVideo}
                  onChange={(e) => setSelectedVideo(e.target.value)}
                  className="w-full bg-[#18181b] border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  {videoFolders.length > 0 ? (
                    videoFolders.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))
                  ) : (
                    <option value="">(Raíz del canal / Sin video)</option>
                  )}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 italic">
              El archivo generado se guardará automáticamente en <code className="text-purple-300">Ambiente/locucion.mp3</code> dentro del video seleccionado.
            </p>
          </div>

          {/* Editor de Texto del Guion */}
          <div className="flex-1 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <span>📝</span> Guion o Diálogo para Narrar
              </label>
              <span className="text-[11px] text-zinc-400 font-mono">
                {wordsCount} palabras • {charsCount} caracteres • ~{estimatedTimeFormatted}
              </span>
            </div>

            <textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Pega aquí el texto de tu guion, la introducción de tu video o los diálogos de las escenas..."
              className="flex-1 w-full min-h-[220px] bg-[#18181b] border border-white/10 rounded-xl p-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 transition-all font-sans leading-relaxed resize-none"
            />
          </div>

          {/* Ajuste de Velocidad */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/30 border border-white/5">
            <span className="text-xs text-zinc-400 font-medium">Velocidad de habla:</span>
            <div className="flex gap-2">
              {['-10%', '+0%', '+10%', '+20%'].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setSpeechRate(rate)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    speechRate === rate
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {rate === '+0%' ? 'Normal' : rate}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Selección de Motor, Voces y Acción (5 Cols) */}
        <div className="lg:col-span-5 p-6 flex flex-col justify-between overflow-y-auto space-y-6 custom-scrollbar bg-[#101013]">
          
          <div className="space-y-5">
            {/* Selector de Motor */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-3">
                Selecciona el Motor de Síntesis:
              </span>
              <div className="grid grid-cols-2 gap-3">
                
                {/* Motor 1: Edge-TTS */}
                <div
                  onClick={() => {
                    setSelectedProvider('edge_tts');
                    setSelectedVoice('es-ES-AlvaroNeural');
                  }}
                  className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                    selectedProvider === 'edge_tts'
                      ? 'bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-950/20'
                      : 'bg-zinc-900/40 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-400">🟢 Edge-TTS</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      $0 Gratis
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Ilimitado y local. Voces neuronales de gran fluidez sin API key.
                  </p>
                </div>

                {/* Motor 2: OpenAI TTS */}
                <div
                  onClick={() => {
                    setSelectedProvider('openai');
                    setSelectedVoice('onyx');
                  }}
                  className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                    selectedProvider === 'openai'
                      ? 'bg-purple-500/10 border-purple-500 shadow-lg shadow-purple-950/20'
                      : 'bg-zinc-900/40 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-purple-400">🟡 OpenAI TTS</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      Económico
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Voces profesionales (Onyx, Nova). Descuenta créditos o usa BYOK.
                  </p>
                </div>

              </div>
            </div>

            {/* Selector de Voces */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Voces Disponibles ({currentVoices.length})
                </span>
                <span className="text-[10px] text-zinc-500">Pulsa 🔊 para escuchar</span>
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                {currentVoices.map((v) => {
                  const isSelected = selectedVoice === v.id;
                  const isPlaying = previewingVoiceId === v.id;

                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVoice(v.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-purple-600/15 border-purple-500'
                          : 'bg-zinc-900/50 border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                            isSelected ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {v.gender === 'Femenino' ? '👩' : '👨'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{v.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-medium">
                              {v.lang}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400 block mt-0.5">{v.style}</span>
                        </div>
                      </div>

                      {/* Botón de Preview */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewVoice(v);
                        }}
                        className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                          isPlaying
                            ? 'bg-purple-500 text-white animate-pulse'
                            : 'bg-white/5 hover:bg-white/15 text-zinc-300'
                        }`}
                        title="Escuchar muestra"
                      >
                        {isPlaying ? '⏸️ Parar' : '🔊 Probar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Resultado o Botón de Acción */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            
            {/* Audio Generado con Éxito */}
            {generatedResult && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span>✅</span> Locución Lista
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {generatedResult.duration_seconds} seg • {(generatedResult.file_size_bytes / 1024).toFixed(0)} KB
                  </span>
                </div>

                {/* Reproductor de Audio Nativo */}
                <audio
                  ref={generatedAudioRef}
                  controls
                  className="w-full h-8"
                  src={`http://127.0.0.1:8000/workspace/file?path=${encodeURIComponent(generatedResult.file_path)}`}
                />

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] text-zinc-400 truncate max-w-[200px]" title={generatedResult.file_name}>
                    📁 {generatedResult.file_name}
                  </span>

                  {/* Puente a Faster-Whisper Subtitulador */}
                  {onOpenSubtitlesStudio && (
                    <button
                      onClick={() => onOpenSubtitlesStudio(generatedResult.file_path)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <span>🎙️</span> Subtitular con Whisper
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Botón Principal Generar */}
            <button
              onClick={handleGenerateSpeech}
              disabled={isGenerating || !scriptText.trim() || !motorStatus}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                isGenerating
                  ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                  : selectedProvider === 'edge_tts'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30'
              }`}
            >
              {isGenerating ? (
                <>
                  <span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                  <span>Sintetizando locución de audio...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>
                    Generar Locución {selectedProvider === 'edge_tts' ? '($0 Costo)' : '(OpenAI TTS)'}
                  </span>
                </>
              )}
            </button>

            <p className="text-[11px] text-zinc-500 text-center">
              {selectedProvider === 'edge_tts'
                ? '🟢 Generación 100% gratuita ejecutada de forma local por tu PC.'
                : '🟡 OpenAI TTS se factura a través de tus créditos o tu clave personal.'}
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};

export default TextToSpeechStudio;
