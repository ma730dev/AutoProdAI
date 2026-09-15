'use client';

import { useState, useEffect } from 'react';
import { Language } from '@/app/translations';
import { Conversation } from './types';
import FileTree, { FileNode } from './FileTree';
import { ControladorClient } from '@/lib/controlador-client';
import { toast } from 'sonner';

interface Props {
  lang: Language;
  conversations: Conversation[];
  activeConversationId: string | null;
  activeView: 'home' | 'chat' | 'editor' | 'looper' | 'subtitles' | 'assets' | 'images';
  workspacePath: string | null;
  workspaceTree: FileNode[];
  motorStatus: boolean;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onRenameConversation?: (id: string, newTitle: string) => void;
  onAddNode: (parentPath: string, type: 'channel' | 'video') => void;
  onOpenFile?: (path: string) => void;
  onRefreshWorkspace?: () => void;
  onOpenLooper?: () => void;
  onOpenSubtitles?: () => void;
  onOpenTTS?: () => void;
  onOpenAssets?: () => void;
  onOpenImages?: () => void;
  onLinkWorkspace?: () => void;
}

export default function ConversationSidebar({
  lang,
  conversations,
  activeConversationId,
  activeView,
  workspacePath,
  workspaceTree,
  motorStatus,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onAddNode,
  onOpenFile,
  onRefreshWorkspace,
  onOpenLooper,
  onOpenSubtitles,
  onOpenTTS,
  onOpenAssets,
  onOpenImages,
  onLinkWorkspace,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const startEditing = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveEditing = () => {
    if (editingId && onRenameConversation && editTitle.trim()) {
      onRenameConversation(editingId, editTitle);
    }
    setEditingId(null);
  };

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    const closeMenu = () => setActiveMenuId(null);
    if (activeMenuId) {
      document.addEventListener('click', closeMenu);
      document.addEventListener('contextmenu', closeMenu);
    }
    return () => {
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('contextmenu', closeMenu);
    };
  }, [activeMenuId]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto minimal-scrollbar p-4 flex flex-col gap-6">

        {/* Motor Status Section */}
        <div className="flex items-center justify-between bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/50">
          <div className="flex items-center gap-2">
            <div className="relative flex h-3 w-3">
              {motorStatus && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${motorStatus ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
            </div>
            <span className="text-xs font-semibold text-zinc-300">
              {motorStatus ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={motorStatus}
            onClick={async () => {
              if (motorStatus) {
                ControladorClient.shutdownMotor();
              } else {
                const toastId = toast.loading('Arrancando motor...');
                try {
                  await ControladorClient.startMotor();
                  toast.success('Motor listo y ejecutándose', { id: toastId });
                } catch (error: any) {
                  toast.error(error.message || 'Error validando motor', { id: toastId });
                }
              }
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${motorStatus ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${motorStatus ? 'translate-x-4' : 'translate-x-0'
                }`}
            />
          </button>
        </div>

        {/* Workspace / Project Section */}
        <div className="space-y-3 shrink-0">
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-[10px] font-bold text-zinc-500 tracking-wider">PROYECTO / WORKSPACE</h3>
            {onRefreshWorkspace && workspacePath && (
              <button
                onClick={onRefreshWorkspace}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-zinc-800 text-xs flex items-center gap-1 cursor-pointer"
                title={lang === 'es' ? 'Actualizar workspace' : 'Refresh workspace'}
              >
                <svg className="w-3.5 h-3.5 hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-2 border border-zinc-800/50">
            {!workspacePath ? (
              <div className="text-xs text-zinc-500 text-center py-2 italic">
                Sin ruta vinculada
              </div>
            ) : (
              <>
                {/* The root folder */}
                <div className="flex items-center group py-1 px-2 rounded hover:bg-zinc-800/50 transition-colors cursor-default mb-2">
                  <span className="text-yellow-500 mr-2">📁</span>
                  <span className="text-sm font-medium text-zinc-300 truncate flex-1" title={workspacePath || ''}>
                    {workspacePath}
                  </span>
                  {onAddNode && (
                    <button
                      onClick={() => onAddNode(workspacePath, 'channel')}
                      className="opacity-50 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-zinc-700 hover:bg-indigo-600 text-white text-[10px] transition-all"
                      title="Añadir Canal"
                    >
                      + Añadir
                    </button>
                  )}
                </div>

                {/* The File Tree */}
                <div className="overflow-x-auto overflow-y-auto max-h-[300px] pb-2 minimal-scrollbar pr-1">
                  {workspaceTree.map((node, i) => (
                    <FileTree key={i} node={node} onAddNode={onAddNode} onOpenFile={onOpenFile} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <span className="h-[1px] bg-zinc-800/50 shrink-0" />

        {/* New Conversation Button */}
        <button
          onClick={onNewConversation}
          className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 rounded-lg text-xs font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          💬 {lang === 'es' ? 'Nueva Conversación' : 'New Conversation'}
        </button>

        {/* Video Timeline Studio Button */}
        {onOpenLooper && (
          <button
            onClick={onOpenLooper}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer shrink-0 ${activeView === 'looper'
                ? 'bg-purple-950/70 border-purple-500 text-purple-200 shadow-sm shadow-purple-500/20'
                : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800 text-zinc-300 hover:text-white'
              }`}
          >
            <span className="flex items-center gap-2">
              <span>🎬</span>
              <span>{lang === 'es' ? 'Video Studio (Editor)' : 'Video Studio (Editor)'}</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold font-mono">
              PRO
            </span>
          </button>
        )}

        {/* Image Creator Studio Button */}
        {onOpenImages && (
          <button
            onClick={onOpenImages}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer shrink-0 ${activeView === 'images'
                ? 'bg-purple-950/70 border-purple-500 text-purple-200 shadow-sm shadow-purple-500/20'
                : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800 text-zinc-300 hover:text-white'
              }`}
          >
            <span className="flex items-center gap-2">
              <span>🎨</span>
              <span>{lang === 'es' ? 'Creador de Imágenes' : 'AI Image Studio'}</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold font-mono">
              DALL-E
            </span>
          </button>
        )}

        {/* Asset Library Button */}
        {onOpenAssets && (
          <button
            onClick={onOpenAssets}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer shrink-0 ${activeView === 'assets'
                ? 'bg-indigo-950/70 border-indigo-500 text-indigo-200 shadow-sm shadow-indigo-500/20'
                : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800 text-zinc-300 hover:text-white'
              }`}
          >
            <span className="flex items-center gap-2">
              <span>🗃️</span>
              <span>{lang === 'es' ? 'Biblioteca de Recursos' : 'Asset Library'}</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold font-mono">
              CRUD
            </span>
          </button>
        )}

        {/* Text-to-Speech Studio Button */}
        {onOpenTTS && (
          <button
            onClick={onOpenTTS}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer shrink-0 ${activeView === 'tts'
                ? 'bg-purple-950/70 border-purple-500 text-purple-200 shadow-sm shadow-purple-500/20'
                : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800 text-zinc-300 hover:text-white'
              }`}
          >
            <span className="flex items-center gap-2">
              <span>🎙️</span>
              <span>{lang === 'es' ? 'Locución & TTS' : 'Voiceover & TTS'}</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold font-mono">
              VOZ
            </span>
          </button>
        )}


        {/* Conversations History */}
        <div className="space-y-2 shrink-0">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {lang === 'es' ? 'Historial de Chats' : 'Chat History'}
          </h4>
          <div className="space-y-1">
            {conversations.map(conv => (
              <div
                key={conv.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveMenuId(conv.id);
                }}
                className={`relative w-full text-left py-2 px-2.5 rounded-lg text-xs transition-all flex flex-col gap-1 group ${activeView === 'chat' && activeConversationId === conv.id
                    ? 'bg-zinc-800 text-purple-400 font-semibold border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                  }`}
              >
                {editingId === conv.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={saveEditing}
                    onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                    autoFocus
                    className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 px-2 py-1 rounded outline-none"
                  />
                ) : (
                  <div className="flex justify-between items-center w-full group">
                    <button
                      className="truncate flex-1 font-medium text-left mr-2"
                      onClick={() => onSelectConversation(conv.id)}
                    >
                      {conv.title}
                    </button>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 items-center shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === conv.id ? null : conv.id);
                        }}
                        className="text-zinc-500 hover:text-white px-1.5 py-0.5 rounded hover:bg-zinc-700"
                        title="Opciones"
                      >
                        ⋮
                      </button>
                    </div>
                  </div>
                )}

                {editingId !== conv.id && (
                  <div className="flex justify-between items-center w-full text-[9px] text-zinc-600 font-mono">
                    <span>{conv.createdAt}</span>
                  </div>
                )}

                {/* Dropdown Menu */}
                {activeMenuId === conv.id && (
                  <div
                    className="absolute right-2 top-8 w-32 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setActiveMenuId(null);
                        startEditing(conv);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2"
                    >
                      ✏️ Renombrar
                    </button>
                    {onDeleteConversation && (
                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          onDeleteConversation(conv.id);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2"
                      >
                        🗑️ Eliminar
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
