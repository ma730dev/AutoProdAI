'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Language, translations } from '@/app/translations';
import { ControladorClient } from '@/lib/controlador-client';


interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  user: { name: string; email: string } | null;
  isAdminMode?: boolean;
  onOpenPlans?: () => void;
}

export default function UserSettingsModal({ isOpen, onClose, lang, user, isAdminMode = false, onOpenPlans }: UserSettingsModalProps) {
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'ai' | 'system' | 'commands' | 'profile' | 'billing' | 'password'>('general');
  const [subscriptionInfo, setSubscriptionInfo] = useState<{ planName: string; credits: number; currentPeriodEnd?: string } | null>(null);
  const t = translations[lang];
  const [detectedClis, setDetectedClis] = useState<any[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  const [systemDeps, setSystemDeps] = useState<any[]>([]);
  const [isSystemDetecting, setIsSystemDetecting] = useState(false);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installPath, setInstallPath] = useState('');
  const [isPickingPath, setIsPickingPath] = useState(false);
  const [motorInfo, setMotorInfo] = useState<{ status: string; version: string; workspace_path: string } | null>(null);

  const checkSystemStatus = async () => {
    setIsSystemDetecting(true);
    try {
      const res = await fetch('/api/setup/status');
      const data = await res.json();
      setSystemDeps(data.dependencies || []);

      // 1. Consultar estado y versión del Motor Local
      try {
        const mInfo = await ControladorClient.getMotorInfo();
        if (mInfo) {
          setMotorInfo(mInfo);
          if (mInfo.workspace_path) {
            setInstallPath(mInfo.workspace_path);
            if (typeof window !== 'undefined') {
              localStorage.setItem('autoprod_workspace_path', mInfo.workspace_path);
            }
          }
        }
      } catch (err) {
        setMotorInfo(null);
      }

      // 2. Fallback de workspace si no se obtuvo del motor
      if (!installPath) {
        try {
          const ws = await ControladorClient.getDefaultWorkspace();
          if (ws && ws.path) {
            setInstallPath(ws.path);
          }
        } catch {
          const saved = typeof window !== 'undefined' ? localStorage.getItem('autoprod_workspace_path') : null;
          if (saved) {
            setInstallPath(saved);
          } else {
            const wsRes = await fetch('/api/setup/workspace');
            const wsData = await wsRes.json();
            if (wsData.success && wsData.path) {
              setInstallPath(wsData.path);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSystemDetecting(false);
    }
  };

  useEffect(() => {
    if (activeSettingsTab === 'system' || activeSettingsTab === 'billing') {
      if (activeSettingsTab === 'system') {
        checkSystemStatus();
      }
      fetch('/api/user/wallet')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setSubscriptionInfo(prev => ({
              planName: data.planName || prev?.planName || 'FREE',
              credits: data.balance ?? 0,
            }));
          }
        })
        .catch(() => {});
    }
  }, [activeSettingsTab]);

  // Removed detectEngines and related useEffect as model detection is no longer needed.

  const handleLogin = async (providerId: string) => {
    try {
      const res = await fetch(`/api/chat/auth/${providerId}`, { method: 'POST' });
      if (res.ok) {
        toast.info(lang === 'es' ? 'Sigue las instrucciones en la ventana de terminal que se acaba de abrir.' : 'Follow the instructions in the terminal window that just opened.');
      } else {
        toast.error('Error al abrir la autenticación.');
      }
    } catch (err) {
      toast.error('No se pudo contactar con el motor local.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#121214] border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[450px]">
        {/* Modal Sidebar */}
        <div className="w-full md:w-48 bg-[#0f0f12] border-r border-zinc-800 p-4 flex flex-col gap-1 shrink-0">
          <div className="mb-4 px-2">
            <h3 className="font-bold text-white text-sm">{t.configGeneral}</h3>
            <p className="text-[10px] text-zinc-500">{user?.email || 'demo@autoprod.io'}</p>
          </div>

          {isAdminMode ? (
            <button
              onClick={() => setActiveSettingsTab('ai')}
              className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center gap-2 ${activeSettingsTab === 'ai'
                ? 'bg-purple-500/10 text-purple-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
            >
              🔑 {lang === 'es' ? 'Llaves del Sistema' : 'System Keys'}
            </button>
          ) : (
            <>
              <button
                onClick={() => setActiveSettingsTab('general')}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center gap-2 ${activeSettingsTab === 'general'
                  ? 'bg-purple-500/10 text-purple-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
              >
                {lang === 'es' ? 'General' : 'General'}
              </button>
              <button
                onClick={() => setActiveSettingsTab('ai')}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center gap-2 ${activeSettingsTab === 'ai'
                  ? 'bg-purple-500/10 text-purple-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
              >
                🧠 {lang === 'es' ? 'Inteligencia Artificial' : 'Artificial Intelligence'}
              </button>
              <button
                onClick={() => setActiveSettingsTab('system')}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center gap-2 ${activeSettingsTab === 'system'
                  ? 'bg-purple-500/10 text-purple-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
              >
                ⚡ {lang === 'es' ? 'Sistema / Setup' : 'System / Setup'}
              </button>
              <button
                onClick={() => setActiveSettingsTab('commands')}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center gap-2 ${activeSettingsTab === 'commands'
                  ? 'bg-purple-500/10 text-purple-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
              >
                {lang === 'es' ? 'Comandos Rápidos' : 'Shortcuts'}
              </button>
              <button
                onClick={() => setActiveSettingsTab('profile')}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center gap-2 ${activeSettingsTab === 'profile'
                  ? 'bg-purple-500/10 text-purple-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
              >
                {t.myInfo}
              </button>
              <button
                onClick={() => setActiveSettingsTab('billing')}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center gap-2 ${activeSettingsTab === 'billing'
                  ? 'bg-purple-500/10 text-purple-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
              >
                {t.billingPlan}
              </button>
              <button
                onClick={() => setActiveSettingsTab('password')}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center gap-2 ${activeSettingsTab === 'password'
                  ? 'bg-purple-500/10 text-purple-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
              >
                {t.changePassword}
              </button>
            </>
          )}

          <button
            onClick={onClose}
            className="mt-auto w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors text-center cursor-pointer"
          >
            {lang === 'es' ? 'Cerrar' : 'Close'}
          </button>
        </div>

        {/* Modal Content Panel */}
        <div className="flex-1 p-6 overflow-y-auto minimal-scrollbar flex flex-col bg-[#121214]">
          {/* General Tab */}
          {activeSettingsTab === 'general' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">
                {lang === 'es' ? 'Configuración General' : 'General Settings'}
              </h4>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-zinc-500 block mb-1">
                    {lang === 'es' ? 'Puerto del Motor (Predeterminado: 8000)' : 'Motor Port (Default: 8000)'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      id="motorPortInput"
                      defaultValue={typeof window !== 'undefined' ? localStorage.getItem('autoprod_motor_port') || '8000' : '8000'}
                      placeholder="8000"
                      className="w-full bg-[#18181b] border border-zinc-800 rounded p-2 text-white focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => {
                        const val = (document.getElementById('motorPortInput') as HTMLInputElement)?.value;
                        if (val && typeof window !== 'undefined') {
                          localStorage.setItem('autoprod_motor_port', val);
                          toast.success(lang === 'es' ? 'Puerto guardado' : 'Port saved');
                          // Simple reload to reconnect
                          window.location.reload();
                        }
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {lang === 'es' ? 'Guardar Puerto' : 'Save Port'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Settings Tab */}
          {activeSettingsTab === 'ai' && (
            <div className="space-y-6 overflow-y-auto pr-2 max-h-[350px] minimal-scrollbar">
              {/* Cloud Engines (API Keys) */}
              <div>
                <h4 className="text-sm font-bold text-white border-b border-zinc-800 pb-2 mb-3">
                  {isAdminMode ? (lang === 'es' ? 'Llaves del Sistema' : 'System Keys') : (lang === 'es' ? 'Motores en la Nube (API Keys)' : 'Cloud Engines (API Keys)')}
                </h4>
                <p className="text-[10px] text-zinc-400 mb-3">
                  {lang === 'es'
                    ? 'Ingresa tus API Keys para usar motores premium. Tus llaves se encriptan de forma segura en nuestra base de datos (Supabase Vault).'
                    : 'Enter your API Keys to use premium engines. Your keys are securely encrypted in our database (Supabase Vault).'}
                </p>
                <div className="space-y-3">
                  <div className="bg-[#18181b] border border-zinc-800 rounded-lg p-3">
                    <label className="text-xs font-bold text-zinc-200 block mb-1">Google Gemini API Key</label>
                    <input
                      type="password"
                      id="geminiKeyInput"
                      placeholder="AIzaSy..."
                      className="w-full bg-[#0f0f12] border border-zinc-700 rounded p-2 text-white text-xs focus:outline-none focus:border-purple-500 mb-2"
                    />
                    <button
                      onClick={async () => {
                        const val = (document.getElementById('geminiKeyInput') as HTMLInputElement)?.value;
                        if (!val) return;
                        try {
                          const res = await fetch('/api/settings/keys', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ provider: 'gemini', apiKey: val })
                          });
                          if (res.ok) {
                            toast.success(lang === 'es' ? 'Llave de Gemini guardada' : 'Gemini Key saved');
                            window.dispatchEvent(new Event('settingsUpdated'));
                          } else toast.error(lang === 'es' ? 'Error al guardar' : 'Error saving key');
                        } catch (e) {
                          toast.error('Error de conexión');
                        }
                      }}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] rounded font-bold transition-colors"
                    >
                      {lang === 'es' ? 'Guardar Llave' : 'Save Key'}
                    </button>
                  </div>

                  <div className="bg-[#18181b] border border-zinc-800 rounded-lg p-3">
                    <label className="text-xs font-bold text-zinc-200 block mb-1">OpenAI API Key (ChatGPT)</label>
                    <input
                      type="password"
                      id="openaiKeyInput"
                      placeholder="sk-..."
                      className="w-full bg-[#0f0f12] border border-zinc-700 rounded p-2 text-white text-xs focus:outline-none focus:border-purple-500 mb-2"
                    />
                    <button
                      onClick={async () => {
                        const val = (document.getElementById('openaiKeyInput') as HTMLInputElement)?.value;
                        if (!val) return;
                        try {
                          const res = await fetch('/api/settings/keys', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ provider: 'openai', apiKey: val })
                          });
                          if (res.ok) {
                            toast.success(lang === 'es' ? 'Llave de OpenAI guardada' : 'OpenAI Key saved');
                            window.dispatchEvent(new Event('settingsUpdated'));
                          } else toast.error(lang === 'es' ? 'Error al guardar' : 'Error saving key');
                        } catch (e) {
                          toast.error('Error de conexión');
                        }
                      }}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] rounded font-bold transition-colors"
                    >
                      {lang === 'es' ? 'Guardar Llave' : 'Save Key'}
                    </button>
                  </div>

                  <div className="bg-[#18181b] border border-zinc-800 rounded-lg p-3">
                    <label className="text-xs font-bold text-zinc-200 block mb-1">Anthropic API Key (Claude)</label>
                    <input
                      type="password"
                      id="anthropicKeyInput"
                      placeholder="sk-ant-..."
                      className="w-full bg-[#0f0f12] border border-zinc-700 rounded p-2 text-white text-xs focus:outline-none focus:border-purple-500 mb-2"
                    />
                    <button
                      onClick={async () => {
                        const val = (document.getElementById('anthropicKeyInput') as HTMLInputElement)?.value;
                        if (!val) return;
                        try {
                          const res = await fetch('/api/settings/keys', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ provider: 'anthropic', apiKey: val })
                          });
                          if (res.ok) {
                            toast.success(lang === 'es' ? 'Llave de Anthropic guardada' : 'Anthropic Key saved');
                            window.dispatchEvent(new Event('settingsUpdated'));
                          } else toast.error(lang === 'es' ? 'Error al guardar' : 'Error saving key');
                        } catch (e) {
                          toast.error('Error de conexión');
                        }
                      }}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] rounded font-bold transition-colors"
                    >
                      {lang === 'es' ? 'Guardar Llave' : 'Save Key'}
                    </button>
                  </div>

                  <div className="bg-[#18181b] border border-zinc-800 rounded-lg p-3">
                    <label className="text-xs font-bold text-zinc-200 block mb-1">YouTube Data API v3 Key</label>
                    <p className="text-[10px] text-zinc-500 mb-2">
                      {lang === 'es'
                        ? 'Utilizada para la extracción y análisis de canales, histórico de videos y etiquetas (tags).'
                        : 'Used for extracting and analyzing channels, past videos, and tags.'}
                    </p>
                    <input
                      type="password"
                      id="youtubeKeyInput"
                      placeholder="AIzaSy..."
                      className="w-full bg-[#0f0f12] border border-zinc-700 rounded p-2 text-white text-xs focus:outline-none focus:border-purple-500 mb-2"
                    />
                    <button
                      onClick={async () => {
                        const val = (document.getElementById('youtubeKeyInput') as HTMLInputElement)?.value;
                        if (!val) return;
                        try {
                          const res = await fetch('/api/settings/keys', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ provider: 'youtube', apiKey: val })
                          });
                          if (res.ok) {
                            toast.success(lang === 'es' ? 'Llave de YouTube guardada' : 'YouTube Key saved');
                            window.dispatchEvent(new Event('settingsUpdated'));
                          } else toast.error(lang === 'es' ? 'Error al guardar' : 'Error saving key');
                        } catch (e) {
                          toast.error('Error de conexión');
                        }
                      }}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] rounded font-bold transition-colors"
                    >
                      {lang === 'es' ? 'Guardar Llave' : 'Save Key'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeSettingsTab === 'system' && (
            <div className="space-y-4">
              <div className="border-b border-zinc-800 pb-2 flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">
                  {lang === 'es' ? 'Estado del Sistema & Motor Local' : 'System Status & Local Motor'}
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <span>⚡</span> {lang === 'es' ? 'Motor Habilitado' : 'Motor Enabled'}
                </span>
              </div>

              {/* Sección de Descarga del Instalador 1-Clic */}
              <div className="bg-gradient-to-r from-purple-950/40 via-zinc-900 to-indigo-950/40 border border-purple-500/30 rounded-xl p-4 text-xs space-y-3 shadow-md">
                <div className="flex items-center gap-2 text-purple-300 font-bold">
                  <span className="text-base">⚡</span>
                  <span className="text-sm">{lang === 'es' ? 'Instalador Automático 1-Clic' : '1-Click Automatic Installer'}</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  {lang === 'es'
                    ? 'Descarga el asistente que abrirá el explorador para elegir tu carpeta, configurará FFmpeg, yt-dlp y arrancará el Motor Local en tu PC automáticamente.'
                    : 'Download the wizard that opens the native folder selector, sets up FFmpeg, yt-dlp, and launches the Local Motor on your PC automatically.'}
                </p>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <a
                    href="/api/setup/download-installer?os=windows"
                    download="AutoProd-Setup.exe"
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold rounded-lg text-xs transition-opacity shadow-sm cursor-pointer"
                  >
                    <span>🪟</span>
                    <span>{lang === 'es' ? 'Descargar para Windows (.exe)' : 'Download for Windows (.exe)'}</span>
                  </a>
                  <a
                    href="/api/setup/download-installer?os=mac"
                    download="AutoProd-Setup.dmg"
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg text-xs transition-colors border border-zinc-700 shadow-sm cursor-pointer"
                  >
                    <span>🍎</span>
                    <span>{lang === 'es' ? 'Descargar para macOS (.dmg)' : 'Download for macOS (.dmg)'}</span>
                  </a>
                </div>

                <div className="text-[11px] text-zinc-400 bg-black/40 rounded-lg p-2.5 space-y-1 border border-zinc-800/60">
                  <div className="font-semibold text-zinc-200">{lang === 'es' ? 'Pasos rápidos:' : 'Quick steps:'}</div>
                  <ol className="list-decimal list-inside space-y-0.5 text-zinc-400">
                    <li>{lang === 'es' ? 'Descarga el instalador (.exe o .dmg) y ejecútalo en tu PC.' : 'Download the installer (.exe or .dmg) and run it on your PC.'}</li>
                    <li>{lang === 'es' ? 'El asistente configurará las herramientas y te pedirá elegir la carpeta de tu canal.' : 'The wizard will set up the tools and prompt you to choose your channel folder.'}</li>
                    <li>{lang === 'es' ? '¡Listo! El motor arrancará y esta consola se conectará en verde de inmediato.' : 'Ready! The motor starts and this console connects in green right away.'}</li>
                  </ol>
                </div>
              </div>


              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  {lang === 'es'
                    ? 'Estado del Motor Local y sincronización del espacio de trabajo.'
                    : 'Local Motor status and workspace synchronization.'}
                </p>
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                  motorInfo?.status === 'online'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${motorInfo?.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                  {motorInfo?.status === 'online' 
                    ? `Motor v${motorInfo.version || '1.0.0'} Online` 
                    : 'Motor Desconectado'}
                </span>
              </div>

              {/* ── Tarjeta de Workspace Canónico (Fijado por el Instalador) ── */}
              <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📁</span>
                    <div>
                      <h5 className="text-xs font-bold text-zinc-200">
                        {lang === 'es' ? 'Workspace Canónico de AutoProd' : 'AutoProd Canonical Workspace'}
                      </h5>
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                        {lang === 'es' ? 'Fijado por el Instalador' : 'Locked by Installer'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await ControladorClient.openWorkspaceFolder(installPath);
                        toast.success(lang === 'es' ? 'Carpeta abierta en el explorador.' : 'Folder opened in explorer.');
                      } catch (e: any) {
                        toast.error(lang === 'es' ? 'No se pudo abrir la carpeta.' : 'Could not open folder.');
                      }
                    }}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Abrir en el Explorador de archivos del sistema"
                  >
                    📂 {lang === 'es' ? 'Abrir Carpeta' : 'Open Folder'}
                  </button>
                </div>

                <div className="bg-black/60 border border-zinc-800/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 break-all select-all flex items-center justify-between">
                  <span>{installPath || (lang === 'es' ? 'Detectando ruta...' : 'Detecting path...')}</span>
                  <span className="text-[10px] text-zinc-500 font-sans ml-2 shrink-0">Solo Lectura</span>
                </div>

                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {lang === 'es'
                    ? 'Esta es la ubicación única oficial. Toda la producción, canales, videos, audios y renders se almacenan y sincronizan automáticamente en esta ruta.'
                    : 'This is the single official location. All production, channels, videos, audio, and renders are automatically stored and synced here.'}
                </p>
              </div>

              {/* ── Lista de Dependencias ── */}
              <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between items-center mb-1">
                  <h5 className="text-xs font-bold text-zinc-200">
                    {lang === 'es' ? 'Componentes del Sistema' : 'System Components'}
                  </h5>
                  <button 
                    onClick={checkSystemStatus}
                    className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
                  >
                    {isSystemDetecting ? '↻...' : '↻ Refrescar'}
                  </button>
                </div>
                {systemDeps.map(dep => (
                  <div key={dep.id} className="flex items-center justify-between py-1.5 border-t border-zinc-800/50 text-xs">
                    <span className="text-zinc-300 font-medium">{dep.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${dep.status === 'installed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {dep.status === 'installed' ? '🟢 Instalado' : '🔴 Faltante'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commands (Shortcuts) Tab */}
          {activeSettingsTab === 'commands' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">
                {lang === 'es' ? 'Comandos y Atajos' : 'Commands \u0026 Shortcuts'}
              </h4>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between bg-[#18181b] border border-zinc-800 rounded p-3">
                  <div>
                    <label className="text-zinc-300 font-bold block mb-1">
                      {lang === 'es' ? 'Atajo Vista Previa (Markdown)' : 'Markdown Preview Shortcut'}
                    </label>
                    <p className="text-zinc-500 text-[10px]">
                      {lang === 'es' ? 'Alterna entre vista previa y edición con Ctrl+Shift+V' : 'Toggle between preview and edit mode with Ctrl+Shift+V'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={typeof window !== 'undefined' ? localStorage.getItem('autoprod_md_shortcuts_enabled') !== 'false' : true}
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const isEnabled = localStorage.getItem('autoprod_md_shortcuts_enabled') !== 'false';
                        localStorage.setItem('autoprod_md_shortcuts_enabled', (!isEnabled).toString());
                        toast.success(lang === 'es' ? 'Atajos actualizados' : 'Shortcuts updated');
                        // Simple re-render trigger by updating local variable or reloading
                        window.location.reload();
                      }
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      (typeof window !== 'undefined' ? localStorage.getItem('autoprod_md_shortcuts_enabled') !== 'false' : true) ? 'bg-purple-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        (typeof window !== 'undefined' ? localStorage.getItem('autoprod_md_shortcuts_enabled') !== 'false' : true) ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeSettingsTab === 'profile' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">{t.myInfo}</h4>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-zinc-500 block mb-1">
                    {lang === 'es' ? 'Nombre Completo' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    defaultValue={user?.name || ''}
                    key={user?.name}
                    className="w-full bg-[#18181b] border border-zinc-800 rounded p-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">
                    {lang === 'es' ? 'Correo Electrónico' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full bg-[#18181b] border border-zinc-800 rounded p-2 text-zinc-500 cursor-not-allowed focus:outline-none"
                  />
                </div>
                <button
                  onClick={() =>
                    toast.success(
                      lang === 'es'
                        ? 'Datos guardados correctamente.'
                        : 'Data saved successfully.'
                    )
                  }
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold transition-colors cursor-pointer"
                >
                  {lang === 'es' ? 'Guardar Cambios' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeSettingsTab === 'billing' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">{t.billingPlan}</h4>
              <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white flex items-center gap-2">
                      <span>{lang === 'es' ? 'Plan Actual:' : 'Current Plan:'}</span>
                      <span className="text-purple-400 uppercase font-extrabold tracking-wide">
                        {subscriptionInfo?.planName || 'FREE'}
                      </span>
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      🪙 Saldo: <strong className="text-amber-300">{(subscriptionInfo?.credits ?? 0).toLocaleString()}</strong> créditos AutoProd
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 font-bold border border-purple-500/30 text-[10px]">
                    {subscriptionInfo?.planName === 'ENTERPRISE' ? '$150/mes' : subscriptionInfo?.planName === 'PRO' ? '$100/mes' : subscriptionInfo?.planName === 'STARTER' ? '$70/mes' : '$0 USD'}
                  </span>
                </div>
                <div className="border-t border-zinc-800 pt-3">
                  <p className="text-zinc-400 mb-3 leading-relaxed">
                    {lang === 'es'
                      ? 'Desbloquea orquestación ilimitada con gpt-4o-mini sin costo de tokens, canales ilimitados, Video Looper 4K y bolsa de créditos para Whisper y modelos avanzados.'
                      : 'Unlock unlimited gpt-4o-mini orchestration at 0 token cost, multiple channels, 4K Video Looper, and monthly token credits for Whisper and heavy models.'}
                  </p>
                  <button
                    onClick={() => {
                      if (onOpenPlans) {
                        onClose();
                        onOpenPlans();
                      } else {
                        toast.info(lang === 'es' ? 'Abriendo planes...' : 'Opening plans...');
                      }
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:opacity-95 rounded-xl font-bold text-white transition-opacity cursor-pointer shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2"
                  >
                    <span>⚡</span>
                    <span>{lang === 'es' ? 'Ver Planes & Actualizar Suscripción' : 'View Plans & Upgrade Subscription'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Password Tab */}
          {activeSettingsTab === 'password' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">{t.changePassword}</h4>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-zinc-500 block mb-1">
                    {lang === 'es' ? 'Contraseña Actual' : 'Current Password'}
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-[#18181b] border border-zinc-800 rounded p-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">
                    {lang === 'es' ? 'Nueva Contraseña' : 'New Password'}
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-[#18181b] border border-zinc-800 rounded p-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
