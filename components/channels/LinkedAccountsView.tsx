'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface ContentHistoryItem {
  id: string;
  platform: string;
  contentType: string;
  externalId?: string | null;
  externalUrl?: string | null;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
}

interface ChannelItem {
  id: string;
  name: string;
  youtubeChannelId?: string | null;
  profilePicture?: string | null;
  createdAt: string;
}

interface Props {
  onBack?: () => void;
}

export default function LinkedAccountsView({ onBack }: Props) {
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de Historial
  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null);
  const [historyItems, setHistoryItems] = useState<ContentHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/channels');
      if (!res.ok) throw new Error('Error al consultar canales');
      const data = await res.json();
      if (Array.isArray(data)) {
        setChannels(data);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('No se pudieron cargar los canales vinculados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();

    // Comprobar parámetros de éxito en URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('success') === 'connected') {
        const chName = urlParams.get('channel') || 'Canal';
        toast.success(`¡Canal "${chName}" conectado exitosamente con YouTube OAuth!`);
      } else if (urlParams.get('error')) {
        toast.error(`Error de vinculación: ${urlParams.get('error')}`);
      }
    }
  }, []);

  const handleOpenHistory = async (channel: ChannelItem) => {
    setSelectedChannel(channel);
    try {
      setLoadingHistory(true);
      const res = await fetch(`/api/channels/${channel.id}/history`);
      if (!res.ok) throw new Error('Error al obtener historial');
      const data = await res.json();
      setHistoryItems(data.history || []);
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar historial');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0c] text-neutral-100 overflow-y-auto">
      {/* ── HEADER ── */}
      <div className="border-b border-neutral-800/80 bg-neutral-950/70 backdrop-blur-md px-6 py-4 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors border border-neutral-800"
              title="Volver"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>🌐</span> Cuentas y Canales Vinculados
            </h1>
            <p className="text-xs text-neutral-400">
              Conexión legal mediante OAuth 2.0 y sincronización oficial de publicaciones
            </p>
          </div>
        </div>

        <div>
          <a
            href="/api/auth/youtube/login"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-red-600/10 transition-all active:scale-[0.98]"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <span>Vincular Canal de YouTube</span>
          </a>
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL ── */}
      <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Canales Conectados */}
        <div>
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-3">
            Canales de YouTube Conectados ({channels.filter(c => c.youtubeChannelId).length})
          </h2>

          {loading ? (
            <div className="py-12 flex justify-center text-neutral-500 text-xs">
              <div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mr-2" />
              Cargando cuentas...
            </div>
          ) : channels.filter(c => c.youtubeChannelId).length === 0 ? (
            <div className="p-8 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-center">
              <div className="w-12 h-12 rounded-xl bg-neutral-800/80 flex items-center justify-center text-xl mx-auto mb-3">
                📺
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Ningún canal de YouTube vinculado</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-4">
                Inicia sesión con tu cuenta de Google para verificar tu canal legalmente, leer tu historial de videos y analizar métricas.
              </p>
              <a
                href="/api/auth/youtube/login"
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl transition-colors"
              >
                <span>Conectar con Google</span>
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {channels
                .filter(c => c.youtubeChannelId)
                .map(channel => (
                  <div
                    key={channel.id}
                    className="p-5 rounded-2xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      {channel.profilePicture ? (
                        <img
                          src={channel.profilePicture}
                          alt={channel.name}
                          className="w-12 h-12 rounded-xl object-cover border border-neutral-700"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center text-lg">
                          📺
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white truncate">{channel.name}</h3>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            OAuth 2.0
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 font-mono mt-0.5 truncate">
                          ID: {channel.youtubeChannelId}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleOpenHistory(channel)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 hover:text-white transition-colors text-center"
                      >
                        📜 Ver Historial de Contenido
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Próximas Plataformas */}
        <div className="pt-4 border-t border-neutral-800/60">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
            Otras Plataformas (Próximamente)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
            <div className="p-4 rounded-xl border border-dashed border-neutral-800 bg-neutral-950 flex items-center gap-3">
              <span className="text-2xl">📸</span>
              <div>
                <h4 className="text-xs font-bold text-white">Instagram Graph API</h4>
                <p className="text-[10px] text-neutral-500">Sincronización de Reels y analíticas de retención.</p>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-dashed border-neutral-800 bg-neutral-950 flex items-center gap-3">
              <span className="text-2xl">🎵</span>
              <div>
                <h4 className="text-xs font-bold text-white">TikTok for Creators</h4>
                <p className="text-[10px] text-neutral-500">Publicación directa de videos cortos y métricas de audio.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL HISTORIAL DE CONTENIDO (CONTENT HISTORY) ── */}
      {selectedChannel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121217] border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📜</span> Historial de Contenido: {selectedChannel.name}
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Publicaciones oficiales sincronizadas desde YouTube
                </p>
              </div>
              <button
                onClick={() => setSelectedChannel(null)}
                className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {loadingHistory ? (
                <div className="py-12 flex justify-center text-neutral-500 text-xs">
                  <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mr-2" />
                  Consultando historial sincronizado...
                </div>
              ) : historyItems.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-8">
                  No hay videos registrados en el historial de este canal.
                </p>
              ) : (
                historyItems.map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 flex items-center gap-3.5 hover:border-neutral-700 transition-colors"
                  >
                    {item.thumbnailUrl && (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-20 aspect-video rounded-lg object-cover bg-neutral-950 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate" title={item.title}>
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-neutral-500 mt-0.5">
                        {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'Sin fecha'} • {item.platform}
                      </p>
                    </div>
                    {item.externalUrl && (
                      <a
                        href={item.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[11px] font-medium text-neutral-300 hover:text-white shrink-0 transition-colors"
                      >
                        Ver en YT ↗
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
