'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';

export interface VideoProjectRecord {
  id: string;
  userId: string;
  channelId?: string | null;
  title: string;
  aspectRatio: string;
  resolution: string;
  timelineData: any;
  thumbnailUrl?: string | null;
  durationSeconds: number;
  status: string;
  storageMode: string;
  localPath?: string | null;
  createdAt: string;
  updatedAt: string;
  channel?: {
    id: string;
    name: string;
    profilePicture?: string | null;
  } | null;
}

interface ChannelOption {
  id: string;
  name: string;
}

interface ProjectHubProps {
  channels: ChannelOption[];
  onOpenProject: (project: VideoProjectRecord) => void;
  onBackToDashboard?: () => void;
}

export default function ProjectHub({
  channels,
  onOpenProject,
  onBackToDashboard,
}: ProjectHubProps) {
  const [projects, setProjects] = useState<VideoProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>('ALL');
  const [selectedStorageFilter, setSelectedStorageFilter] = useState<'ALL' | 'LOCAL' | 'CLOUD'>('ALL');

  // Modal Nuevo Proyecto
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAspectRatio, setNewAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [newChannelId, setNewChannelId] = useState<string>('');
  const [newStorageMode, setNewStorageMode] = useState<'LOCAL' | 'CLOUD'>('LOCAL');
  const [isCreating, setIsCreating] = useState(false);

  // Cargar proyectos
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/video-projects');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al cargar proyectos');
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.projects)) {
        setProjects(data.projects);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'No se pudieron cargar los proyectos de video');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Crear nuevo proyecto
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error('Por favor escribe un título para el proyecto');
      return;
    }

    try {
      setIsCreating(true);
      const res = await fetch('/api/video-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          aspectRatio: newAspectRatio,
          resolution: '1080p',
          channelId: newChannelId || null,
          storageMode: newStorageMode,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al crear proyecto');
      }

      const data = await res.json();
      if (data.success && data.project) {
        toast.success('Proyecto creado con éxito');
        setIsNewModalOpen(false);
        setNewTitle('');
        // Abrir inmediatamente el nuevo proyecto en el editor
        onOpenProject(data.project);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al crear proyecto');
    } finally {
      setIsCreating(false);
    }
  };

  // Duplicar proyecto
  const handleDuplicate = async (project: VideoProjectRecord) => {
    try {
      const res = await fetch('/api/video-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${project.title} (Copia)`,
          aspectRatio: project.aspectRatio,
          resolution: project.resolution,
          channelId: project.channelId || null,
          storageMode: project.storageMode,
          initialTimelineData: project.timelineData,
        }),
      });

      if (!res.ok) throw new Error('No se pudo duplicar el proyecto');
      toast.success('Proyecto duplicado');
      fetchProjects();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Eliminar proyecto
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Estás seguro de eliminar el proyecto "${title}"?`)) return;

    try {
      const res = await fetch(`/api/video-projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar proyecto');
      toast.success('Proyecto eliminado');
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Filtrado de proyectos
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // Búsqueda por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesChannel = p.channel?.name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesChannel) return false;
      }

      // Filtro de canal
      if (selectedChannelFilter !== 'ALL') {
        if (selectedChannelFilter === 'UNASSIGNED') {
          if (p.channelId) return false;
        } else {
          if (p.channelId !== selectedChannelFilter) return false;
        }
      }

      // Filtro de almacenamiento
      if (selectedStorageFilter !== 'ALL') {
        if (p.storageMode !== selectedStorageFilter) return false;
      }

      return true;
    });
  }, [projects, searchQuery, selectedChannelFilter, selectedStorageFilter]);

  // Formato relativo de tiempo
  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 2) return 'Justo ahora';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0c] text-neutral-100 overflow-y-auto">
      {/* ── BARRA SUPERIOR DE ENCABEZADO ── */}
      <div className="border-b border-neutral-800/80 bg-neutral-950/70 backdrop-blur-md px-6 py-4 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="p-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors border border-neutral-800"
              title="Volver a la consola"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>🎬</span> Proyectos de Video
            </h1>
            <p className="text-xs text-neutral-400">
              Mesa de montaje, edición multipista y composiciones guardadas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-semibold text-sm rounded-xl shadow-lg shadow-amber-500/10 transition-all active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>Nuevo Proyecto</span>
          </button>
        </div>
      </div>

      {/* ── BARRA DE FILTROS & BÚSQUEDA ── */}
      <div className="px-6 py-3 border-b border-neutral-800/40 bg-neutral-900/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[260px] max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por título de proyecto..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-neutral-900 border border-neutral-800 focus:border-amber-500/50 focus:outline-none text-neutral-200 placeholder:text-neutral-500 transition-colors"
            />
            <svg className="w-4 h-4 text-neutral-500 absolute left-2.5 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 1114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de Canal */}
          <select
            value={selectedChannelFilter}
            onChange={e => setSelectedChannelFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 focus:border-amber-500/50 focus:outline-none"
          >
            <option value="ALL">📺 Todos los canales</option>
            <option value="UNASSIGNED">⚪ Sin canal (Libre)</option>
            {channels.map(ch => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>

          {/* Filtro Local / Nube */}
          <div className="flex rounded-lg bg-neutral-900 border border-neutral-800 p-0.5 text-xs">
            <button
              onClick={() => setSelectedStorageFilter('ALL')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                selectedStorageFilter === 'ALL'
                  ? 'bg-neutral-800 text-white font-medium'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setSelectedStorageFilter('LOCAL')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                selectedStorageFilter === 'LOCAL'
                  ? 'bg-neutral-800 text-amber-400 font-medium'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              💻 Local
            </button>
            <button
              onClick={() => setSelectedStorageFilter('CLOUD')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                selectedStorageFilter === 'CLOUD'
                  ? 'bg-neutral-800 text-sky-400 font-medium'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ☁️ Nube
            </button>
          </div>
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL: GRID DE PROYECTOS ── */}
      <div className="p-6 flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-neutral-500">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-3" />
            <p className="text-xs">Cargando tus proyectos de edición...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-neutral-800/80 rounded-2xl bg-neutral-950/40 text-center max-w-xl mx-auto my-12 p-8">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center text-3xl mb-4 border border-neutral-800 shadow-inner">
              🎬
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              {searchQuery ? 'No se encontraron proyectos' : 'No tienes proyectos aún'}
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mb-6">
              {searchQuery
                ? 'Prueba modificando tus términos de búsqueda o filtros.'
                : 'Crea tu primer proyecto de edición multipista. Puedes trabajar con o sin canal vinculado.'}
            </p>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs rounded-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Crear Proyecto Ahora</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProjects.map(project => {
              const isVertical = project.aspectRatio === '9:16';
              const isSquare = project.aspectRatio === '1:1';

              return (
                <div
                  key={project.id}
                  className="group flex flex-col rounded-2xl bg-neutral-900/40 hover:bg-neutral-900/80 border border-neutral-800/80 hover:border-neutral-700/80 transition-all duration-200 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-black/40"
                >
                  {/* Vista Previa de Formato */}
                  <div
                    onClick={() => onOpenProject(project)}
                    className="relative w-full aspect-video bg-neutral-950 flex items-center justify-center cursor-pointer overflow-hidden border-b border-neutral-800/40"
                  >
                    {project.thumbnailUrl ? (
                      <img
                        src={project.thumbnailUrl}
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      /* Canvas Mockup de Formato */
                      <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-neutral-900/60 to-neutral-950">
                        <div
                          className={`rounded border border-dashed border-neutral-700/60 flex flex-col items-center justify-center p-2 text-neutral-500 group-hover:border-amber-500/60 group-hover:text-amber-400/80 transition-colors ${
                            isVertical
                              ? 'w-16 h-28 aspect-[9/16]'
                              : isSquare
                              ? 'w-24 h-24 aspect-square'
                              : 'w-36 h-20 aspect-video'
                          }`}
                        >
                          <span className="text-lg">▶</span>
                          <span className="text-[10px] font-mono mt-1">{project.aspectRatio}</span>
                        </div>
                      </div>
                    )}

                    {/* Badge Formato */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono font-medium text-neutral-300 border border-white/10">
                        {project.aspectRatio}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium backdrop-blur-md border ${
                        project.storageMode === 'CLOUD'
                          ? 'bg-sky-950/70 text-sky-300 border-sky-800/50'
                          : 'bg-amber-950/70 text-amber-300 border-amber-800/50'
                      }`}>
                        {project.storageMode === 'CLOUD' ? '☁️ Nube' : '💻 Local'}
                      </span>
                    </div>

                    {/* Duración */}
                    {project.durationSeconds > 0 && (
                      <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono text-white">
                        {Math.floor(project.durationSeconds / 60)}:
                        {String(Math.floor(project.durationSeconds % 60)).padStart(2, '0')}
                      </div>
                    )}
                  </div>

                  {/* Metadatos y Acciones */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <h4
                        onClick={() => onOpenProject(project)}
                        className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors truncate cursor-pointer"
                        title={project.title}
                      >
                        {project.title}
                      </h4>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400">
                        {project.channel ? (
                          <span className="flex items-center gap-1 text-neutral-300 truncate max-w-[140px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            {project.channel.name}
                          </span>
                        ) : (
                          <span className="text-neutral-500">⚪ Sin canal</span>
                        )}
                        <span>•</span>
                        <span className="text-neutral-500">{formatRelativeTime(project.updatedAt)}</span>
                      </div>
                    </div>

                    {/* Botonera Inferior */}
                    <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between gap-2">
                      <button
                        onClick={() => onOpenProject(project)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors text-center"
                      >
                        Abrir Editor
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDuplicate(project)}
                          className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                          title="Duplicar proyecto"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(project.id, project.title)}
                          className="p-1.5 rounded-lg hover:bg-red-950/60 text-neutral-400 hover:text-red-400 transition-colors"
                          title="Eliminar proyecto"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL NUEVO PROYECTO ── */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <span>✨</span> Crear Nuevo Proyecto de Video
            </h3>
            <p className="text-xs text-neutral-400 mb-5">
              Configura tu mesa de montaje. Podrás editar y guardar sin límites.
            </p>

            <form onSubmit={handleCreateProject} className="space-y-4">
              {/* Título */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Nombre del Proyecto *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="ej. Lo-Fi Lluvia 3h / Shorts Finanzas #12"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-700/80 focus:border-amber-500 focus:outline-none text-white placeholder:text-neutral-500"
                />
              </div>

              {/* Formato / Relación de Aspecto */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Formato de Pantalla
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewAspectRatio('16:9')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      newAspectRatio === '16:9'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div className="text-sm mb-0.5">📺</div>
                    <div className="text-xs font-bold">16:9</div>
                    <div className="text-[10px] text-neutral-500">Horizontal</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewAspectRatio('9:16')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      newAspectRatio === '9:16'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div className="text-sm mb-0.5">📱</div>
                    <div className="text-xs font-bold">9:16</div>
                    <div className="text-[10px] text-neutral-500">Shorts/Reels</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewAspectRatio('1:1')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      newAspectRatio === '1:1'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div className="text-sm mb-0.5">⏹️</div>
                    <div className="text-xs font-bold">1:1</div>
                    <div className="text-[10px] text-neutral-500">Cuadrado</div>
                  </button>
                </div>
              </div>

              {/* Canal Vinculado (Opcional) */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Canal Asignado <span className="text-neutral-500 font-normal">(Opcional)</span>
                </label>
                <select
                  value={newChannelId}
                  onChange={e => setNewChannelId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-700/80 text-neutral-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">⚪ Sin canal (Edición libre / Freelance)</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>
                      📺 {ch.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-500 mt-1">
                  Puedes editar sin ningún canal. Si en el futuro vinculas uno, podrás asignárselo.
                </p>
              </div>

              {/* Modo de Almacenamiento */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Almacenamiento del Proyecto
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStorageMode('LOCAL')}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      newStorageMode === 'LOCAL'
                        ? 'bg-neutral-900 border-amber-500/80 text-white'
                        : 'bg-neutral-900/50 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <span className="text-lg">💻</span>
                    <div>
                      <div className="text-xs font-semibold">Local (Disco)</div>
                      <div className="text-[10px] text-neutral-500">$0, rápido en tu PC</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewStorageMode('CLOUD')}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      newStorageMode === 'CLOUD'
                        ? 'bg-neutral-900 border-sky-500/80 text-white'
                        : 'bg-neutral-900/50 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <span className="text-lg">☁️</span>
                    <div>
                      <div className="text-xs font-semibold">En la Nube</div>
                      <div className="text-[10px] text-neutral-500">Zero-Disk en tu PC</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Botones */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/10 transition-all disabled:opacity-50"
                >
                  {isCreating ? 'Creando...' : 'Crear y Abrir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
