'use client';

import { useState } from 'react';

export type FileNode = {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: FileNode[];
};

interface FileTreeProps {
  node: FileNode;
  level?: number;
  onAddNode?: (parentPath: string, type: 'channel' | 'video') => void;
  onOpenFile?: (path: string) => void;
}

export default function FileTree({ node, level = 0, onAddNode, onOpenFile }: FileTreeProps) {
  const [isOpen, setIsOpen] = useState(false); // All folders closed by default
  const isDir = node.type === 'directory';
  const nameLower = node.name.toLowerCase();
  const isMarkdown = !isDir && (nameLower.endsWith('.md') || nameLower.endsWith('.txt'));
  const isImage = !isDir && (nameLower.endsWith('.png') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.webp') || nameLower.endsWith('.gif'));
  const isVideo = !isDir && (nameLower.endsWith('.mp4') || nameLower.endsWith('.mov') || nameLower.endsWith('.mkv') || nameLower.endsWith('.webm') || nameLower.endsWith('.avi') || nameLower.endsWith('.m4v'));
  const isAudio = !isDir && (nameLower.endsWith('.mp3') || nameLower.endsWith('.wav') || nameLower.endsWith('.aac') || nameLower.endsWith('.m4a') || nameLower.endsWith('.flac') || nameLower.endsWith('.ogg'));
  const isPreviewable = isMarkdown || isImage || isVideo || isAudio;

  // Detección de Proyecto de Video (Nivel 1 dentro de canal, hermano de InfoCanal)
  const isVideoProject = isDir && level === 1 && nameLower !== 'infocanal';

  // Verificar si el proyecto de video tiene recursos de video válidos y accesibles
  const checkHasVideoResources = (n: FileNode): boolean => {
    if (!n.children || n.children.length === 0) return false;
    const vFolder = n.children.find(c => c.type === 'directory' && c.name.toLowerCase() === 'videos');
    if (vFolder && vFolder.children && vFolder.children.length > 0) {
      const hasClips = vFolder.children.some(f => {
        const nl = f.name.toLowerCase();
        return nl.endsWith('.mp4') || nl.endsWith('.mov') || nl.endsWith('.mkv') || nl.endsWith('.webm') || nl.endsWith('.avi') || nl.endsWith('.m4v');
      });
      if (hasClips) return true;
    }
    return n.children.some(f => {
      if (f.type !== 'file') return false;
      const nl = f.name.toLowerCase();
      return nl.endsWith('.mp4') || nl.endsWith('.mov') || nl.endsWith('.mkv') || nl.endsWith('.webm') || nl.endsWith('.avi') || nl.endsWith('.m4v');
    });
  };

  const isVideoProjectMissingResources = isVideoProject && !checkHasVideoResources(node);

  // Detección de carpeta Videos/ vacía o sin metraje reconocido dentro de un proyecto
  const isVideosSubfolder = isDir && nameLower === 'videos';
  const isVideosSubfolderEmpty = isVideosSubfolder && (
    !node.children ||
    node.children.length === 0 ||
    !node.children.some(f => {
      const nl = f.name.toLowerCase();
      return nl.endsWith('.mp4') || nl.endsWith('.mov') || nl.endsWith('.mkv') || nl.endsWith('.webm') || nl.endsWith('.avi') || nl.endsWith('.m4v');
    })
  );

  // Archivo no reconocido
  const isUnrecognizedFile = !isDir && !isPreviewable;

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('application/json', JSON.stringify({
      name: node.name,
      path: node.path,
      type: node.type,
      isVideo,
      isAudio
    }));
    e.dataTransfer.setData('text/plain', node.path);
  };

  const isRedAlert = isVideoProjectMissingResources || isVideosSubfolderEmpty || isUnrecognizedFile;

  return (
    <div className="text-sm">
      <div 
        draggable={true}
        onDragStart={handleDragStart}
        className={`flex items-center group py-1 px-2 rounded cursor-grab active:cursor-grabbing select-none transition-colors ${
          isRedAlert
            ? 'hover:bg-red-950/40 text-red-400 hover:text-red-300'
            : isPreviewable
            ? 'hover:bg-zinc-800/80 hover:text-indigo-400 text-zinc-400'
            : isDir
            ? (level === 0 ? 'hover:bg-zinc-800/50 font-semibold text-zinc-200' : 'hover:bg-zinc-800/50 text-zinc-300')
            : 'hover:bg-zinc-800/40 text-zinc-400'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (isDir) setIsOpen(!isOpen);
          else if (isPreviewable && onOpenFile) onOpenFile(node.path);
        }}
        title={
          isVideoProjectMissingResources
            ? '⚠️ Proyecto de video sin recursos de video (la carpeta Videos/ está ausente o no contiene clips)'
            : isVideosSubfolderEmpty
            ? '⚠️ Carpeta Videos sin clips o archivos reconocidos'
            : isUnrecognizedFile
            ? '⚠️ Archivo o recurso no reconocido'
            : node.name
        }
      >
        <span className="w-4 inline-block opacity-80 text-[10px] shrink-0">
          {isVideoProjectMissingResources
            ? '⚠️'
            : isVideosSubfolderEmpty
            ? '⚠️'
            : isDir
            ? (isOpen ? '▼' : '▶')
            : isMarkdown
            ? '📝'
            : isImage
            ? '🖼️'
            : isVideo
            ? '🎬'
            : isAudio
            ? '🎵'
            : '📄'}
        </span>
        <span className={`ml-1 truncate flex-1 ${isRedAlert ? 'text-red-400 font-medium' : ''}`}>
          {node.name}
        </span>

        {/* Badges de advertencia en rojo si no hay recursos */}
        {isVideoProjectMissingResources && (
          <span className="ml-1.5 px-1 py-0.2 rounded bg-red-950/80 border border-red-500/60 text-red-300 text-[9px] font-mono shrink-0 select-none">
            ⚠️ Sin videos
          </span>
        )}
        {isVideosSubfolderEmpty && (
          <span className="ml-1.5 px-1 py-0.2 rounded bg-red-950/60 border border-red-500/40 text-red-400 text-[9px] font-mono shrink-0 select-none">
            ⚠️ Vacía
          </span>
        )}
        {isUnrecognizedFile && (
          <span className="ml-1 text-[9px] text-red-400 font-mono shrink-0 select-none" title="Formato no reconocido">
            ⚠️ No reconocido
          </span>
        )}
        
        {/* Only show + on directories at level 0 (Channels) to create videos */}
        {isDir && onAddNode && level === 0 && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAddNode(node.path, 'video');
            }}
            className="opacity-50 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-zinc-700 hover:bg-indigo-600 text-white text-[10px] transition-all ml-1.5"
            title="Añadir Video"
          >
            + Añadir
          </button>
        )}
      </div>

      {isOpen && isDir && node.children && (
        <div className="flex flex-col">
          {node.children.length === 0 ? (
            <div 
              className="text-xs text-zinc-600 italic py-1"
              style={{ paddingLeft: `${(level + 1) * 12 + 28}px` }}
            >
              Carpeta vacía
            </div>
          ) : (
            node.children.map((child, i) => (
              <FileTree key={i} node={child} level={level + 1} onAddNode={onAddNode} onOpenFile={onOpenFile} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
