'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Language } from '@/app/translations';
import { ControladorClient } from '@/lib/controlador-client';
import { toast } from 'sonner';

export interface AssetRecord {
  id: string;
  name: string;
  type: 'IMAGE' | 'THUMBNAIL' | 'SUBTITLE' | 'VIDEO' | 'AUDIO' | 'OTHER';
  format: string;
  prompt?: string | null;
  storageUrl?: string | null;
  localPath?: string | null;
  sizeBytes: number;
  channelId?: string | null;
  channelName?: string | null;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface ChannelOption {
  id: string;
  name: string;
}

interface Props {
  lang: Language;
  channels: ChannelOption[];
  workspacePath: string | null;
  motorStatus: boolean;
  onBackToDashboard?: () => void;
  onOpenLooper?: () => void;
  onOpenSubtitles?: () => void;
  onOpenImageStudio?: () => void;
  onOpenTTS?: () => void;
}

export default function AssetLibraryView({
  lang,
  channels,
  workspacePath,
  motorStatus,
  onBackToDashboard,
  onOpenLooper,
  onOpenSubtitles,
  onOpenImageStudio,
  onOpenTTS,
}: Props) {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'IMAGE' | 'SUBTITLE' | 'VIDEO' | 'AUDIO'>('ALL');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Stats
  const [stats, setStats] = useState({
    totalAssets: 0,
    cloudSizeBytes: 0,
    localSizeBytes: 0,
    cacheSizeBytes: 0,
    quotaBytes: 500 * 1024 * 1024,
    quotaUsedPercent: 0,
    countByType: {
      ALL: 0,
      IMAGE: 0,
      THUMBNAIL: 0,
      SUBTITLE: 0,
      VIDEO: 0,
      AUDIO: 0,
      OTHER: 0,
    } as Record<string, number>,
  });

  const [isClearingCache, setIsClearingCache] = useState(false);

  // Vaciar caché temporal de la nube
  const handleClearCache = async () => {
    if (!confirm(lang === 'es' 
      ? '¿Deseas vaciar el caché temporal (previews, proxies y temporales)? Tus canciones y archivos permanentes no se borrarán.' 
      : 'Do you want to clear temporary cache? Your permanent files and songs will not be deleted.')) {
      return;
    }

    try {
      setIsClearingCache(true);
      const res = await fetch('/api/assets/clear-cache', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al vaciar caché');
      toast.success(data.message || 'Caché vaciado correctamente');
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Error al vaciar caché');
    } finally {
      setIsClearingCache(false);
    }
  };

  // Modals state
  const [previewAsset, setPreviewAsset] = useState<AssetRecord | null>(null);
  const [editAsset, setEditAsset] = useState<AssetRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editChannelId, setEditChannelId] = useState<string>('');
  const [deleteAsset, setDeleteAsset] = useState<AssetRecord | null>(null);
  const [deleteAlsoLocal, setDeleteAlsoLocal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingCloudId, setIsUploadingCloudId] = useState<string | null>(null);

  // Subtitle content state for preview modal
  const [subtitleText, setSubtitleText] = useState<string | null>(null);
  const [loadingSubtitle, setLoadingSubtitle] = useState(false);

  // Load assets from database
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeTab !== 'ALL') params.set('type', activeTab);
      if (selectedChannelId !== 'ALL') params.set('channelId', selectedChannelId);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/assets?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Error al consultar recursos');
      }
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets || []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error cargando recursos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [activeTab, selectedChannelId]);

  // Handle Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAssets();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync with Local Disk
  const handleSyncLocalDisk = async () => {
    if (!motorStatus) {
      toast.error(lang === 'es' ? 'El motor local de Python debe estar Online para escanear el disco' : 'Python local motor must be Online to scan disk');
      return;
    }
    setSyncing(true);
    const toastId = toast.loading(lang === 'es' ? 'Escaneando carpetas de canales locales...' : 'Scanning local channels folders...');
    try {
      let channelName: string | undefined = undefined;
      if (selectedChannelId !== 'ALL') {
        const found = channels.find(c => c.id === selectedChannelId);
        if (found) channelName = found.name;
      }

      const res = await fetch('/api/assets/scan-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannelId !== 'ALL' ? selectedChannelId : undefined,
          channelName,
          workspacePath,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error escaneando medios locales');
      }

      toast.success(
        lang === 'es'
          ? `Sincronización completa: ${data.importedCount} nuevo(s) recurso(s) indexado(s) de ${data.totalFound} encontrados en disco.`
          : `Sync complete: ${data.importedCount} new asset(s) indexed from ${data.totalFound} found on disk.`,
        { id: toastId }
      );
      await fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Error durante la sincronización', { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  // Upload a local asset to Supabase cloud
  const handleUploadToCloud = async (asset: AssetRecord) => {
    setIsUploadingCloudId(asset.id);
    const toastId = toast.loading(lang === 'es' ? `Subiendo ${asset.name} a la nube...` : `Uploading ${asset.name} to cloud...`);
    try {
      const res = await fetch(`/api/assets/${asset.id}/upload-to-cloud`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error subiendo a la nube');

      toast.success(lang === 'es' ? 'Recurso respaldado en la nube con éxito' : 'Asset backed up to cloud successfully', { id: toastId });
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, storageUrl: data.asset?.storageUrl } : a));
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Error al respaldar en la nube', { id: toastId });
    } finally {
      setIsUploadingCloudId(null);
    }
  };

  // Copy local path to clipboard
  const handleCopyPath = (localPath?: string | null) => {
    if (!localPath) {
      toast.error(lang === 'es' ? 'No hay ruta local registrada para este archivo' : 'No local path recorded for this asset');
      return;
    }
    navigator.clipboard.writeText(localPath);
    toast.success(lang === 'es' ? 'Ruta local copiada al portapapeles' : 'Local path copied to clipboard');
  };

  // Open folder in OS explorer
  const handleOpenFolder = async (localPath?: string | null) => {
    if (!localPath) {
      toast.error(lang === 'es' ? 'No tiene ruta local' : 'No local path');
      return;
    }
    try {
      await ControladorClient.openFolder(localPath);
      toast.success(lang === 'es' ? 'Abriendo explorador de archivos...' : 'Opening file explorer...');
    } catch (e: any) {
      toast.error(e.message || 'Error abriendo carpeta');
    }
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editAsset) return;
    try {
      const res = await fetch(`/api/assets/${editAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          channelId: editChannelId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar');

      toast.success(lang === 'es' ? 'Recurso actualizado' : 'Asset updated');
      setEditAsset(null);
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Execute Delete
  const handleExecuteDelete = async () => {
    if (!deleteAsset) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/assets/${deleteAsset.id}?deleteLocal=${deleteAlsoLocal}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');

      toast.success(
        deleteAlsoLocal && data.localDeleted
          ? (lang === 'es' ? 'Recurso eliminado de BD y disco local' : 'Asset deleted from DB and local disk')
          : (lang === 'es' ? 'Recurso eliminado de la base de datos' : 'Asset deleted from database')
      );
      setDeleteAsset(null);
      setDeleteAlsoLocal(false);
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Load preview subtitle if applicable
  // Helper to get real streaming URL (works with local PC files and cloud URLs)
  const getAssetStreamUrl = (asset?: AssetRecord | null) => {
    if (!asset) return '';
    if (asset.storageUrl) return asset.storageUrl;
    if (asset.localPath) return `/api/assets/stream?path=${encodeURIComponent(asset.localPath)}`;
    return '';
  };

  // Load preview subtitle if applicable
  useEffect(() => {
    if (previewAsset && previewAsset.type === 'SUBTITLE') {
      const streamUrl = getAssetStreamUrl(previewAsset);
      if (streamUrl) {
        setLoadingSubtitle(true);
        fetch(streamUrl)
          .then(res => res.text())
          .then(t => setSubtitleText(t))
          .catch(() => setSubtitleText(null))
          .finally(() => setLoadingSubtitle(false));
      } else {
        setSubtitleText(null);
      }
    } else {
      setSubtitleText(null);
    }
  }, [previewAsset]);

  // Helpers
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStorageBadge = (asset: AssetRecord) => {
    if (asset.storageUrl && asset.localPath) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
          <span>🔄</span> Dual
        </span>
      );
    }
    if (asset.storageUrl) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
          <span>☁️</span> Nube
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
        <span>💻</span> Local
      </span>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'THUMBNAIL':
      case 'IMAGE':
        return '🖼️';
      case 'SUBTITLE':
        return '📝';
      case 'VIDEO':
        return '🎬';
      case 'AUDIO':
        return '🎵';
      default:
        return '📄';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#121214] text-zinc-200 overflow-hidden">
      
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="p-5 border-b border-zinc-800 bg-[#16161a]/90 backdrop-blur shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title={lang === 'es' ? 'Volver al Inicio' : 'Back to Dashboard'}
            >
              ←
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🗃️</span>
              <h1 className="text-lg font-bold text-white tracking-wide">
                {lang === 'es' ? 'Biblioteca de Recursos (CRUD)' : 'Resource Library & CRUD'}
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {stats.totalAssets} {lang === 'es' ? 'Recursos' : 'Assets'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {lang === 'es'
                ? 'Gestiona tus imágenes, subtítulos y videos generados con persistencia dual local y en la nube.'
                : 'Manage your images, subtitles, and generated videos with dual local and cloud storage.'}
            </p>
          </div>
        </div>

        {/* Cloud Quota & Actions */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Storage Quota Bar */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-2 min-w-[240px]">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-zinc-400 flex items-center gap-1 font-medium">
                <span>☁️</span> {lang === 'es' ? 'Almacenamiento Nube' : 'Cloud Storage'}
              </span>
              <span className="text-zinc-200 font-bold font-mono">
                {formatBytes(stats.cloudSizeBytes)} / {formatBytes(stats.quotaBytes)}
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  stats.quotaUsedPercent > 85 ? 'bg-amber-500' : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                }`}
                style={{ width: `${Math.max(3, stats.quotaUsedPercent)}%` }}
              />
            </div>
            {stats.cacheSizeBytes > 0 && (
              <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-zinc-800/60 text-[10px]">
                <span className="text-zinc-400 font-mono">⚡ Caché: {formatBytes(stats.cacheSizeBytes)}</span>
                <button
                  type="button"
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                  className="text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer disabled:opacity-50"
                  title="Eliminar renders temporales, proxies y previews sin tocar tus archivos fijos"
                >
                  {isClearingCache ? (lang === 'es' ? 'Vaciando...' : 'Clearing...') : (lang === 'es' ? 'Vaciar Caché' : 'Clear Cache')}
                </button>
              </div>
            )}
          </div>

          {/* Sync Local Button */}
          <button
            onClick={handleSyncLocalDisk}
            disabled={syncing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:border-purple-500/50"
            title={lang === 'es' ? 'Escanear e indexar archivos físicos en disco' : 'Scan and index physical files on disk'}
          >
            <span className={syncing ? 'animate-spin' : ''}>🔄</span>
            <span>{lang === 'es' ? 'Sincronizar Disco Local' : 'Sync Local Disk'}</span>
          </button>

          {/* Quick Create Studio Shortcuts */}
          {onOpenTTS && (
            <button
              onClick={onOpenTTS}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 hover:text-white border border-zinc-700 hover:border-purple-500/50 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title={lang === 'es' ? 'Generar locución y voz en off' : 'Generate voiceover'}
            >
              <span>🎙️</span>
              <span>{lang === 'es' ? 'Voz en Off' : 'Voiceover'}</span>
            </button>
          )}

          {onOpenImageStudio && (
            <button
              onClick={onOpenImageStudio}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>🎨</span>
              <span>{lang === 'es' ? 'Crear Imagen' : 'New Image'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── TOOLBAR: FILTERS, SEARCH & TABS ────────────────────────────────── */}
      <div className="p-4 border-b border-zinc-800/80 bg-[#141418] flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 overflow-x-auto minimal-scrollbar">
          {[
            { id: 'ALL', label: lang === 'es' ? 'Todos' : 'All', icon: '📁', count: stats.countByType.ALL || 0 },
            { id: 'IMAGE', label: lang === 'es' ? 'Imágenes' : 'Images', icon: '🖼️', count: stats.countByType.IMAGE || 0 },
            { id: 'SUBTITLE', label: lang === 'es' ? 'Subtítulos' : 'Subtitles', icon: '📝', count: stats.countByType.SUBTITLE || 0 },
            { id: 'VIDEO', label: lang === 'es' ? 'Videos' : 'Videos', icon: '🎬', count: stats.countByType.VIDEO || 0 },
            { id: 'AUDIO', label: lang === 'es' ? 'Audios' : 'Audio', icon: '🎵', count: stats.countByType.AUDIO || 0 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === tab.id ? 'bg-purple-800 text-purple-200' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Channel Dropdown & Search & View Mode */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Channel Filter */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5">
            <span>📺</span>
            <select
              value={selectedChannelId}
              onChange={e => setSelectedChannelId(e.target.value)}
              className="bg-transparent text-zinc-200 text-xs focus:outline-none cursor-pointer pr-2"
            >
              <option value="ALL" className="bg-zinc-900 text-zinc-200">
                {lang === 'es' ? 'Todos los Canales' : 'All Channels'}
              </option>
              <option value="UNASSIGNED" className="bg-zinc-900 text-purple-300 font-semibold">
                ⚡ {lang === 'es' ? 'Renders Temporales / General' : 'Temp Renders / General'}
              </option>
              {channels.map(ch => (
                <option key={ch.id} value={ch.id} className="bg-zinc-900 text-zinc-200">
                  {ch.name}
                </option>
              ))}
            </select>
          </div>


          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={lang === 'es' ? 'Buscar por nombre o prompt...' : 'Search name or prompt...'}
              className="w-52 md:w-64 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-zinc-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Toggle (Grid / List) */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                viewMode === 'grid' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={lang === 'es' ? 'Vista en Cuadrícula' : 'Grid View'}
            >
              🔲
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                viewMode === 'table' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={lang === 'es' ? 'Vista en Lista / Tabla' : 'List View'}
            >
              📑
            </button>
          </div>
        </div>
      </div>

      {/* ── CONTENT AREA ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto minimal-scrollbar p-6">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <span className="text-3xl animate-bounce">🗃️</span>
            <p className="text-xs">{lang === 'es' ? 'Cargando recursos de la biblioteca...' : 'Loading library assets...'}</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-center p-8 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl max-w-xl mx-auto mt-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-3xl mb-4">
              🗂️
            </div>
            <h3 className="text-base font-bold text-zinc-200 mb-1">
              {lang === 'es' ? 'No se encontraron recursos' : 'No assets found'}
            </h3>
            <p className="text-xs text-zinc-400 mb-5 max-w-md leading-relaxed">
              {lang === 'es'
                ? 'Aún no hay archivos registrados con los filtros seleccionados. Puedes sincronizar tus carpetas locales para indexar lo que ya tienes en disco o crear un nuevo recurso.'
                : 'No files recorded matching your filters. You can sync your local folders to index physical files from disk or generate a new asset.'}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSyncLocalDisk}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>🔄</span> {lang === 'es' ? 'Sincronizar Disco Local' : 'Sync Local Disk'}
              </button>
              {onOpenTTS && (
                <button
                  onClick={onOpenTTS}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 hover:text-white border border-zinc-700 text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  🎙️ {lang === 'es' ? 'Generar Locución' : 'Generate Voiceover'}
                </button>
              )}
              {onOpenImageStudio && (
                <button
                  onClick={onOpenImageStudio}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  🎨 {lang === 'es' ? 'Crear Miniatura con IA' : 'Generate Thumbnail'}
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* ── GRID MODE ─────────────────────────────────────────────────────── */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {assets.map(asset => (
              <div
                key={asset.id}
                className="bg-[#18181b]/70 border border-zinc-800 hover:border-purple-500/40 rounded-2xl p-3 flex flex-col justify-between transition-all group shadow-lg hover:shadow-purple-500/5 relative overflow-hidden"
              >
                {/* Top media preview box */}
                <div
                  onClick={() => setPreviewAsset(asset)}
                  className="w-full h-40 bg-zinc-950/80 rounded-xl overflow-hidden border border-zinc-800/80 relative cursor-pointer group-hover:border-zinc-700 transition-all flex items-center justify-center"
                >
                  {/* Thumbnail / Image Preview */}
                  {(asset.type === 'IMAGE' || asset.type === 'THUMBNAIL') && (asset.storageUrl || asset.localPath) ? (
                    <img
                      src={getAssetStreamUrl(asset)}
                      alt={asset.name}
                      onError={e => {
                        // Fallback icon on image error
                        (e.target as any).style.display = 'none';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : asset.type === 'VIDEO' && (asset.storageUrl || asset.localPath) ? (
                    <div className="relative w-full h-full bg-black flex items-center justify-center group/video overflow-hidden">
                      <video
                        src={`${getAssetStreamUrl(asset)}#t=0.5`}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors flex items-center justify-center">
                        <div className="w-9 h-9 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center text-xs backdrop-blur-sm shadow-lg group-hover/video:scale-110 group-hover/video:bg-purple-600 transition-all">
                          ▶
                        </div>
                      </div>
                    </div>
                  ) : asset.type === 'AUDIO' && (asset.storageUrl || asset.localPath) ? (
                    <div className="relative w-full h-full bg-gradient-to-br from-indigo-950/40 to-purple-950/20 flex flex-col items-center justify-center p-3 gap-1.5">
                      <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center text-base shadow-inner">
                        🎵
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 uppercase bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
                        {asset.format}
                      </span>
                      <audio
                        src={getAssetStreamUrl(asset)}
                        preload="none"
                        controls
                        onClick={e => e.stopPropagation()}
                        className="w-full h-7 opacity-80 hover:opacity-100 transition-opacity mt-0.5 scale-90"
                      />
                    </div>
                  ) : asset.type === 'SUBTITLE' ? (
                    <div className="p-3 w-full h-full flex flex-col justify-between text-zinc-400 font-mono text-[10px] bg-zinc-900/50">
                      <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-zinc-800 pb-1">
                        <span>📝 SUBTÍTULO</span>
                        <span>.{asset.format}</span>
                      </div>
                      <p className="line-clamp-4 text-zinc-400 font-mono italic text-[9px] leading-relaxed">
                        1<br />00:00:01,000 --&gt; 00:00:04,500<br />Transcripción de Whisper...
                      </p>
                      <span className="text-[9px] text-zinc-500">Clic para leer texto completo</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-zinc-400">
                      <span className="text-4xl">{getTypeIcon(asset.type)}</span>
                      <span className="text-[10px] font-mono uppercase bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                        {asset.format}
                      </span>
                    </div>
                  )}

                  {/* Overlay Badges */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    {getStorageBadge(asset)}
                    {asset.channelName ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-900/80 text-zinc-300 border border-zinc-700/80 backdrop-blur">
                        📺 {asset.channelName}
                      </span>
                    ) : asset.localPath?.toLowerCase().includes('temp_renders') ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/80 backdrop-blur">
                        ⚡ temp_renders
                      </span>
                    ) : null}
                  </div>


                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/70 text-zinc-300 border border-zinc-800 backdrop-blur">
                    {formatBytes(asset.sizeBytes)}
                  </div>
                </div>

                {/* Details Section */}
                <div className="mt-3 space-y-1">
                  <h4 className="text-xs font-bold text-zinc-100 truncate" title={asset.name}>
                    {asset.name}
                  </h4>
                  {asset.prompt && (
                    <p className="text-[10px] text-zinc-400 line-clamp-2 leading-tight" title={asset.prompt}>
                      ✨ {asset.prompt}
                    </p>
                  )}
                  <p className="text-[9px] text-zinc-500 font-mono">
                    {new Date(asset.createdAt).toLocaleDateString()} • {asset.format.toUpperCase()}
                  </p>
                </div>

                {/* Actions Footer */}
                <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    {/* Preview Button */}
                    <button
                      onClick={() => setPreviewAsset(asset)}
                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      title={lang === 'es' ? 'Previsualizar' : 'Preview'}
                    >
                      👁️
                    </button>

                    {/* Copy Local Path */}
                    {asset.localPath && (
                      <button
                        onClick={() => handleCopyPath(asset.localPath)}
                        className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                        title={lang === 'es' ? 'Copiar ruta local para CapCut/Premiere' : 'Copy local path'}
                      >
                        📋
                      </button>
                    )}

                    {/* Open in OS Explorer */}
                    {asset.localPath && motorStatus && (
                      <button
                        onClick={() => handleOpenFolder(asset.localPath)}
                        className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                        title={lang === 'es' ? 'Abrir en carpeta de Windows' : 'Open in Explorer'}
                      >
                        📂
                      </button>
                    )}

                    {/* Upload to Cloud if local-only */}
                    {!asset.storageUrl && asset.localPath && (
                      <button
                        onClick={() => handleUploadToCloud(asset)}
                        disabled={isUploadingCloudId === asset.id}
                        className="p-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900 border border-purple-800/50 text-purple-300 hover:text-white transition-colors cursor-pointer"
                        title={lang === 'es' ? 'Respaldar en la Nube' : 'Upload to Cloud'}
                      >
                        {isUploadingCloudId === asset.id ? '⏳' : '☁️'}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Edit Metadata */}
                    <button
                      onClick={() => {
                        setEditAsset(asset);
                        setEditName(asset.name);
                        setEditChannelId(asset.channelId || '');
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                      title={lang === 'es' ? 'Editar Metadatos' : 'Edit'}
                    >
                      ✏️
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => {
                        setDeleteAsset(asset);
                        setDeleteAlsoLocal(false);
                      }}
                      className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 text-red-400 hover:text-red-200 transition-colors cursor-pointer"
                      title={lang === 'es' ? 'Eliminar' : 'Delete'}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── TABLE / LIST MODE ─────────────────────────────────────────────── */
          <div className="bg-[#18181b]/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/90 text-zinc-400 uppercase text-[10px] tracking-wider font-bold">
                  <th className="p-3 w-12 text-center">Tipo</th>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Canal</th>
                  <th className="p-3">Almacenamiento</th>
                  <th className="p-3">Tamaño</th>
                  <th className="p-3">Ruta Local</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {assets.map(asset => (
                  <tr key={asset.id} className="hover:bg-zinc-800/40 transition-colors group">
                    <td className="p-3 text-center text-base">
                      {getTypeIcon(asset.type)}
                    </td>
                    <td className="p-3 font-semibold text-zinc-200">
                      <div className="flex flex-col">
                        <span className="truncate max-w-xs cursor-pointer hover:text-purple-400" onClick={() => setPreviewAsset(asset)}>
                          {asset.name}
                        </span>
                        {asset.prompt && (
                          <span className="text-[10px] text-zinc-500 line-clamp-1 italic font-normal">
                            ✨ {asset.prompt}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-zinc-400">
                      {asset.channelName ? (
                        <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 text-[10px] font-medium">
                          📺 {asset.channelName}
                        </span>
                      ) : asset.localPath?.toLowerCase().includes('temp_renders') ? (
                        <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/80 text-[10px] font-medium">
                          ⚡ temp_renders
                        </span>
                      ) : (
                        <span className="text-zinc-600 italic">General</span>
                      )}

                    </td>
                    <td className="p-3">{getStorageBadge(asset)}</td>
                    <td className="p-3 font-mono text-zinc-400">{formatBytes(asset.sizeBytes)}</td>
                    <td className="p-3 text-zinc-400 font-mono text-[10px] max-w-xs truncate" title={asset.localPath || ''}>
                      {asset.localPath || <span className="text-zinc-600 italic">Solo nube</span>}
                    </td>
                    <td className="p-3 text-zinc-500 text-[11px] whitespace-nowrap">
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreviewAsset(asset)}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                          title="Previsualizar"
                        >
                          👁️
                        </button>
                        {asset.localPath && (
                          <button
                            onClick={() => handleCopyPath(asset.localPath)}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                            title="Copiar Path Local"
                          >
                            📋
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditAsset(asset);
                            setEditName(asset.name);
                            setEditChannelId(asset.channelId || '');
                          }}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            setDeleteAsset(asset);
                            setDeleteAlsoLocal(false);
                          }}
                          className="p-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: PREVIEW ASSET ────────────────────────────────────────────── */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#18181b] border border-purple-500/40 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getTypeIcon(previewAsset.type)}</span>
                <div>
                  <h3 className="font-bold text-sm text-white">{previewAsset.name}</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    {previewAsset.format.toUpperCase()} • {formatBytes(previewAsset.sizeBytes)} • {previewAsset.channelName || 'General'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewAsset(null)}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto minimal-scrollbar flex-1 flex flex-col items-center justify-center">
              {previewAsset.type === 'IMAGE' || previewAsset.type === 'THUMBNAIL' ? (
                <div className="space-y-4 w-full flex flex-col items-center">
                  <div className="max-h-[60vh] max-w-full rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-black flex items-center justify-center">
                    <img
                      src={getAssetStreamUrl(previewAsset)}
                      alt={previewAsset.name}
                      className="max-h-[55vh] max-w-full object-contain"
                    />
                  </div>
                  {previewAsset.prompt && (
                    <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300">
                      <span className="font-bold text-purple-400 block mb-1">✨ Prompt de Generación:</span>
                      <p className="italic">{previewAsset.prompt}</p>
                    </div>
                  )}
                </div>
              ) : previewAsset.type === 'SUBTITLE' ? (
                <div className="w-full flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Contenido del archivo de subtítulos:</span>
                    {subtitleText && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(subtitleText);
                          toast.success('Texto copiado');
                        }}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
                      >
                        📋 Copiar todo
                      </button>
                    )}
                  </div>
                  <div className="w-full h-80 bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-emerald-400 overflow-y-auto whitespace-pre-wrap minimal-scrollbar">
                    {loadingSubtitle ? (
                      <div className="h-full flex items-center justify-center text-zinc-500">
                        Cargando subtítulos...
                      </div>
                    ) : subtitleText ? (
                      subtitleText
                    ) : (
                      <span className="text-zinc-600">No se pudo cargar la vista previa del archivo.</span>
                    )}
                  </div>
                </div>
              ) : previewAsset.type === 'VIDEO' ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <video
                    src={getAssetStreamUrl(previewAsset)}
                    controls
                    autoPlay
                    playsInline
                    className="w-full max-h-[60vh] rounded-xl border border-zinc-800 bg-black shadow-2xl"
                  />
                </div>
              ) : previewAsset.type === 'AUDIO' ? (
                <div className="w-full flex flex-col items-center justify-center py-10 gap-6">
                  <div className="w-24 h-24 rounded-3xl bg-indigo-950/60 border border-indigo-500/40 flex items-center justify-center text-5xl shadow-2xl shadow-indigo-950/50">
                    🎵
                  </div>
                  <div className="w-full max-w-md">
                    <audio
                      src={getAssetStreamUrl(previewAsset)}
                      controls
                      autoPlay
                      className="w-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center text-zinc-400 py-12">
                  <span className="text-4xl block mb-2">{getTypeIcon(previewAsset.type)}</span>
                  <p className="text-sm font-semibold">{previewAsset.name}</p>
                  <p className="text-xs text-zinc-500 mt-1">Vista previa no disponible para este formato.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex items-center justify-between gap-3">
              <div className="text-[11px] text-zinc-500 font-mono truncate max-w-sm">
                {previewAsset.localPath && `Ruta: ${previewAsset.localPath}`}
              </div>
              <div className="flex items-center gap-2">
                {previewAsset.localPath && (
                  <button
                    onClick={() => handleCopyPath(previewAsset.localPath)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>📋</span> Copiar Ruta Local
                  </button>
                )}
                {previewAsset.storageUrl && (
                  <a
                    href={previewAsset.storageUrl}
                    download={previewAsset.name}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>⬇️</span> Descargar
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT ASSET ──────────────────────────────────────────────── */}
      {editAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#18181b] border border-zinc-700 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <span>✏️</span> Editar Recurso
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 font-medium mb-1">Nombre del Archivo</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-medium mb-1">Canal Asignado</label>
                <select
                  value={editChannelId}
                  onChange={e => setEditChannelId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="">Sin canal (General)</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setEditAsset(null)}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE CONFIRMATION ─────────────────────────────────────── */}
      {deleteAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#18181b] border border-red-500/40 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <span className="text-2xl">🗑️</span>
              <h3 className="font-bold text-base text-white">
                {lang === 'es' ? '¿Eliminar este recurso?' : 'Delete this asset?'}
              </h3>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === 'es'
                ? `Estás a punto de eliminar el recurso "${deleteAsset.name}". Esta acción lo quitará de tu biblioteca en la nube y de la base de datos.`
                : `You are about to delete asset "${deleteAsset.name}". This will remove it from your cloud library and database.`}
            </p>

            {deleteAsset.localPath && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-red-950/30 border border-red-900/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteAlsoLocal}
                  onChange={e => setDeleteAlsoLocal(e.target.checked)}
                  className="mt-0.5 rounded text-red-600 focus:ring-0 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-red-300 block">
                    {lang === 'es' ? 'Eliminar también del disco local' : 'Also delete from local disk'}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {deleteAsset.localPath}
                  </span>
                </div>
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setDeleteAsset(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? 'Eliminando...' : 'Confirmar Eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
