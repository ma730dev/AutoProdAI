'use client';

import React from 'react';
import { Language } from '@/app/translations';
import { FolderOption } from '../shared/types';
import { VideoProjectRecord } from '../ProjectHub';
import { TimelineCut, TimelineAudioCut } from '../timeline/TimelinePro';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  exportDestinationMode: 'existing' | 'new';
  setExportDestinationMode: (v: 'existing' | 'new') => void;
  targetFolder: string;
  setTargetFolder: (v: string) => void;
  availableFolders: FolderOption[];
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  activeProject: VideoProjectRecord | null;
  outputFilename: string;
  setOutputFilename: (v: string) => void;
  resolution: string;
  setResolution: (v: string) => void;
  quality: string;
  setQuality: (v: string) => void;
  exportEngine: 'local' | 'cloud';
  setExportEngine: (v: 'local' | 'cloud') => void;
  timelineCuts: TimelineCut[];
  audioCuts: TimelineAudioCut[];
  sequenceDuration: number;
  isLoopActive: boolean;
  isRenderingPreview: boolean;
  isRenderingFull: boolean;
  handleExecuteRender: (previewOnly: boolean) => void;
  onOpenPlaylistModal: () => void;
}

export default function ExportModal({
  isOpen,
  onClose,
  lang,
  exportDestinationMode,
  setExportDestinationMode,
  targetFolder,
  setTargetFolder,
  availableFolders,
  newFolderName,
  setNewFolderName,
  activeProject,
  outputFilename,
  setOutputFilename,
  resolution,
  setResolution,
  quality,
  setQuality,
  exportEngine,
  setExportEngine,
  timelineCuts,
  audioCuts,
  sequenceDuration,
  isLoopActive,
  isRenderingPreview,
  isRenderingFull,
  handleExecuteRender,
  onOpenPlaylistModal,
}: ExportModalProps) {
  if (!isOpen) return null;

  return (
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
            onClick={onClose}
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
                  className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                    exportDestinationMode === 'existing'
                      ? 'bg-purple-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {lang === 'es' ? 'Existente' : 'Existing'}
                </button>
                <button
                  type="button"
                  onClick={() => setExportDestinationMode('new')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                    exportDestinationMode === 'new'
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
                className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  exportEngine === 'local'
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
                className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  exportEngine === 'cloud'
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
        <div className="px-5 py-3.5 border-t border-zinc-800 bg-[#16161f] flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onOpenPlaylistModal}
            className="px-3.5 py-2 rounded-xl bg-violet-950/60 hover:bg-violet-900/60 text-violet-300 border border-violet-800/60 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            title={lang === 'es' ? 'Ver lista de reproducción y timestamps para YouTube' : 'View tracklist and YouTube timestamps'}
          >
            <span>🎵</span>
            <span>{lang === 'es' ? 'Lista de Reproducción (YouTube)' : 'Tracklist (YouTube)'}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs cursor-pointer transition-colors"
            >
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
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
    </div>
  );
}
