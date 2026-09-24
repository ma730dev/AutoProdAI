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

export default function MarkdownEditor({ filePath, onClose }: Props) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  // Derive file name from path
  const fileName = filePath.split(/[/\\]/).pop() || 'Archivo';

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let active = true;
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
          onCloseRef.current(); // Close if we can't load it
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadFile();
    return () => { active = false; };
  }, [filePath]);

  const handleSave = async () => {
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

  // Keyboard shortcut for saving (Ctrl+S) and preview (Ctrl+Shift+V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save Shortcut
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
      // Preview Toggle Shortcut (Ctrl+Shift+V)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        const shortcutsEnabled = localStorage.getItem('autoprod_md_shortcuts_enabled') !== 'false';
        if (shortcutsEnabled) {
          e.preventDefault();
          setViewMode(prev => prev === 'edit' ? 'preview' : 'edit');
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [content, filePath]);

  const hasChanges = content !== originalContent;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#121214]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500 text-sm">Cargando {fileName}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#121214] overflow-hidden h-full">
      {/* Editor Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
            title="Cerrar editor"
          >
            ✕
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-200 flex items-center gap-2">
              📝 {fileName}
              {hasChanges && <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" title="Cambios sin guardar"></span>}
            </span>
            <span className="text-[10px] text-zinc-500 truncate max-w-md">{filePath}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-zinc-950 rounded-lg p-1 mr-4 border border-zinc-800">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${
                viewMode === 'edit' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              📝 Editar
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${
                viewMode === 'preview' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              👁️ Vista Previa
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-xs font-bold rounded shadow transition-all flex items-center gap-2"
          >
            {isSaving ? 'Guardando...' : '💾 Guardar'}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 p-4 relative overflow-y-auto minimal-scrollbar">
        {viewMode === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-[#18181b] text-zinc-300 font-mono text-sm p-4 rounded-lg border border-zinc-800 focus:border-indigo-500/50 focus:outline-none resize-none"
            spellCheck={false}
            placeholder="Escribe aquí tu contenido markdown..."
          />
        ) : (
          <div className="w-full h-full bg-[#18181b] p-6 rounded-lg border border-zinc-800 overflow-y-auto minimal-scrollbar prose prose-invert prose-purple max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || '*Sin contenido*'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
