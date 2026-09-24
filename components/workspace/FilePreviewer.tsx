'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ControladorClient } from '@/lib/controlador-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  filePath: string;
  onClose: () => void;
}

export default function FilePreviewer({ filePath, onClose }: Props) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');

  const fileName = filePath.split(/[/\\]/).pop() || 'Archivo';
  const nameLower = fileName.toLowerCase();
  const isImage = nameLower.endsWith('.png') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.webp') || nameLower.endsWith('.gif');
  const isVideo = nameLower.endsWith('.mp4') || nameLower.endsWith('.mov') || nameLower.endsWith('.mkv') || nameLower.endsWith('.webm') || nameLower.endsWith('.avi');
  const isAudio = nameLower.endsWith('.mp3') || nameLower.endsWith('.wav') || nameLower.endsWith('.aac') || nameLower.endsWith('.m4a') || nameLower.endsWith('.flac') || nameLower.endsWith('.ogg');
  const isMedia = isImage || isVideo || isAudio;

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let active = true;
    
    if (isMedia) {
      setIsLoading(false);
      return;
    }

    const loadFile = async () => {
      setIsLoading(true);
      try {
        const data = await ControladorClient.readFile(filePath);
        if (active) {
          setContent(data);
          setOriginalContent(data);
        }
      } catch (error: any) {
        if (active) {
          toast.error(error.message || 'Error al cargar el archivo');
          onCloseRef.current();
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadFile();
    return () => { active = false; };
  }, [filePath, isMedia]);

  const handleSave = async () => {
    if (isMedia) return;
    setIsSaving(true);
    const toastId = toast.loading('Guardando...');
    try {
      await ControladorClient.saveFile(filePath, content);
      setOriginalContent(content);
      toast.success('Archivo guardado correctamente', { id: toastId });
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (isMedia) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setViewMode(prev => prev === 'edit' ? 'preview' : 'edit');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [content, filePath, isMedia]);

  const hasChanges = !isMedia && content !== originalContent;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#09090b] h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500 text-sm">Cargando {fileName}...</p>
        </div>
      </div>
    );
  }

  const mediaUrl = `http://127.0.0.1:8000/workspace/raw?path=${encodeURIComponent(filePath)}`;

  return (
    <div className="flex-1 flex flex-col bg-[#09090b] overflow-hidden h-full">
      <div className="h-14 border-b border-zinc-800 bg-[#0f0f12] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cerrar vista previa"
          >
            ✕
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-200 flex items-center gap-2">
              {isImage ? '🖼️' : isVideo ? '🎬' : isAudio ? '🎵' : '📝'} {fileName}
              {hasChanges && <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" title="Cambios sin guardar"></span>}
            </span>
            <span className="text-[10px] text-zinc-500 truncate max-w-[200px] xl:max-w-md">{filePath}</span>
          </div>
        </div>
        {!isMedia ? (
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-950 rounded-lg p-1 mr-2 border border-zinc-800">
              <button
                onClick={() => setViewMode('edit')}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                  viewMode === 'edit' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                📝 Editar
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                  viewMode === 'preview' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                👁️ Previa
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-xs font-bold rounded shadow transition-all cursor-pointer"
            >
              💾 Guardar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(mediaUrl, '_blank')}
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold rounded transition-colors cursor-pointer"
              title="Abrir en ventana completa"
            >
              ↗ Abrir archivo
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 relative overflow-y-auto minimal-scrollbar flex justify-center bg-[#09090b]">
        {isVideo ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-2">
            <video 
              src={mediaUrl} 
              controls
              autoPlay
              className="max-w-full max-h-[75vh] rounded-xl border border-zinc-800 shadow-2xl bg-black object-contain"
            />
          </div>
        ) : isAudio ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 gap-4">
            <span className="text-5xl">🎵</span>
            <p className="text-sm font-semibold text-zinc-300">{fileName}</p>
            <audio 
              src={mediaUrl} 
              controls
              className="w-full max-w-md"
            />
          </div>
        ) : isImage ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={mediaUrl} 
              alt={fileName}
              className="max-w-full max-h-full object-contain rounded-lg border border-zinc-800/50 shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `/${fileName}`;
              }}
            />
          </div>
        ) : viewMode === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-[#18181b] text-zinc-300 font-mono text-sm p-4 rounded-lg border border-zinc-800 focus:border-indigo-500/50 focus:outline-none resize-none shadow-inner"
            spellCheck={false}
            placeholder="Escribe aquí tu contenido markdown..."
          />
        ) : (
          <div className="w-full h-full bg-[#18181b] p-6 rounded-lg border border-zinc-800 overflow-y-auto minimal-scrollbar prose prose-invert prose-purple max-w-none shadow-inner">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || '*Sin contenido*'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
