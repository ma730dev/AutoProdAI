'use client';

import { useState, useEffect } from 'react';
import { Language } from '@/app/translations';
import { Conversation } from '@/components/dashboard/types';
import FileTree, { FileNode } from '@/components/workspace/FileTree';
import { ControladorClient } from '@/lib/controlador-client';
import { toast } from 'sonner';

interface Props {
  lang: Language;
  conversations: Conversation[];
  activeConversationId: string | null;
  activeView: 'home' | 'chat' | 'editor' | 'looper' | 'subtitles' | 'assets' | 'images' | 'tts' | 'channels';
  workspacePath: string | null;
  workspaceTree: FileNode[];
  motorStatus: boolean;
  motorUpdateInfo?: { currentVersion: string; latestVersion: string; downloadUrl?: string } | null;
  onTriggerMotorUpdate?: () => Promise<void>;
  isUpdatingMotor?: boolean;
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
  onOpenChannels?: () => void;
  onLinkWorkspace?: () => void;
  onToggleCollapse?: () => void;
}

export default function ConversationSidebar({
  lang,
  conversations,
  activeConversationId,
  activeView,
  workspacePath,
  workspaceTree,
  motorStatus,
  motorUpdateInfo,
  onTriggerMotorUpdate,
  isUpdatingMotor,
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
  onOpenChannels,
  onLinkWorkspace,
  onToggleCollapse,
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

      {/* Sidebar Header with Collapse button */}
      <div className="h-10 px-3.5 border-b border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <span>📁</span>
          <span>{lang === 'es' ? 'Navegación & Canales' : 'Explorer & Channels'}</span>
        </span>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title={lang === 'es' ? 'Ocultar panel izquierdo' : 'Collapse left panel'}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto minimal-scrollbar p-4 flex flex-col gap-6">

        {/* Motor Status Section */}
        <div className="flex flex-col bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/50 gap-2.5">
          <div className="flex items-center justify-between">
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
              {motorStatus && motorUpdateInfo?.currentVersion && (
                <span className="text-[10px] text-zinc-500 font-mono">v{motorUpdateInfo.currentVersion}</span>
              )}
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

          {/* Notificación de actualización 1-Clic */}
          {motorStatus && motorUpdateInfo && (
            <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                </span>
                <span className="text-[11px] font-medium text-purple-300 truncate">
                  v{motorUpdateInfo.latestVersion} disponible
                </span>
              </div>
              <button
                type="button"
                disabled={isUpdatingMotor}
                onClick={onTriggerMotorUpdate}
                className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600/90 hover:bg-purple-500 text-white shadow-sm hover:shadow-purple-500/20 transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                title={lang === 'es' ? 'Actualizar motor local en segundo plano' : 'Update local motor in background'}
              >
                {isUpdatingMotor ? (
                  <>
                    <svg className="animate-spin h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>{lang === 'es' ? 'Actualizando...' : 'Updating...'}</span>
                  </>
                ) : (
                  <>
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>{lang === 'es' ? 'Actualizar' : 'Update'}</span>
                  </>
                )}
              </button>
            </div>
          )}
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
                      className="opacity-50 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-zinc-700 hover:bg-indigo-600 text-white text-[10px] transition-all cursor-pointer"
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

        {/* ── MÓDULOS & ESTUDIOS ── */}
        <div className="space-y-1.5 shrink-0">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {lang === 'es' ? 'Estudios de Creación' : 'Creation Studios'}
            </span>
          </div>


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
                <span>Video Studio</span>
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
                <span>Image Studio</span>
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
            </button>
          )}

          {/* Cuentas y Canales Vinculados */}
          {onOpenChannels && (
            <button
              onClick={onOpenChannels}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer shrink-0 ${activeView === 'channels'
                ? 'bg-red-950/70 border-red-500 text-red-200 shadow-sm shadow-red-500/20'
                : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800 text-zinc-300 hover:text-white'
                }`}
            >
              <span className="flex items-center gap-2">
                <span>🌐</span>
                <span>{lang === 'es' ? 'Canales & Redes' : 'Linked Channels'}</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
