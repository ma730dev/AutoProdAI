'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { translations, Language } from '@/app/translations';
import { createClient } from '@/lib/supabase/client';
import { ControladorClient } from '@/lib/controlador-client';

import dynamic from 'next/dynamic';

import ConversationSidebar from '@/components/dashboard/ConversationSidebar';
import Launchpad from '@/components/dashboard/Launchpad';
import ChatPanel from '@/components/dashboard/ChatPanel';
import CreditCounter from '@/components/dashboard/CreditCounter';
import ProfileDropdown from '@/components/dashboard/ProfileDropdown';
import { AutoProdLogo } from '@/components/AutoProdLogo';

// Dynamic lazy imports for heavy studios and modals to minimize initial bundle size and optimize PageSpeed
const UserSettingsModal = dynamic(() => import('@/components/dashboard/UserSettingsModal'), { ssr: false });
const SubscriptionPlansModal = dynamic(() => import('@/components/dashboard/SubscriptionPlansModal'), { ssr: false });
const VideoStudio = dynamic(() => import('@/components/dashboard/VideoStudio'), { ssr: false });
const VideoSubtitlesStudio = dynamic(() => import('@/components/dashboard/VideoSubtitlesStudio'), { ssr: false });
const AssetLibraryView = dynamic(() => import('@/components/dashboard/AssetLibraryView'), { ssr: false });
const ImageStudio = dynamic(() => import('@/components/dashboard/ImageStudio'), { ssr: false });
const TextToSpeechStudio = dynamic(() => import('@/components/dashboard/TextToSpeechStudio'), { ssr: false });
const FilePreviewer = dynamic(() => import('@/components/dashboard/FilePreviewer'), { ssr: false });
const WorkspaceModal = dynamic(() => import('@/components/dashboard/WorkspaceModal'), { ssr: false });
const ConfirmDeleteModal = dynamic(() => import('@/components/dashboard/ConfirmDeleteModal'), { ssr: false });
const MarkdownEditor = dynamic(() => import('@/components/dashboard/MarkdownEditor'), { ssr: false });

import { Conversation, Message } from '@/components/dashboard/types';
import { FileNode } from '@/components/dashboard/FileTree';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMessages(raw: any[]): Message[] {
  return raw.map((m) => ({
    sender: m.sender.toLowerCase() as 'user' | 'gemini',
    text: m.text,
    timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClient();

  // ── Language ──
  const [lang, setLang] = useState<Language>('es');
  useEffect(() => {
    const saved = localStorage.getItem('autoprod_lang') as Language;
    if (saved === 'es' || saved === 'en') setLang(saved);
  }, []);
  const toggleLanguage = () => {
    const next: Language = lang === 'es' ? 'en' : 'es';
    setLang(next);
    localStorage.setItem('autoprod_lang', next);
  };
  const t = translations[lang];

  // ── Auth & profile ──
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; role: string; maxChannels: number } | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);
  const [currentPlanName, setCurrentPlanName] = useState<string>('FREE');
  const [currentCredits, setCurrentCredits] = useState<number | null>(null);

  // ── Workspace State ──
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [workspaceTree, setWorkspaceTree] = useState<FileNode[]>([]);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [modalParentPath, setModalParentPath] = useState<string | null>(null);
  const [creationMode, setCreationMode] = useState<'channel' | 'video' | null>(null);
  const [motorStatus, setMotorStatus] = useState<boolean>(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const loadWorkspaceTree = async (path: string) => {
    try {
      const data = await ControladorClient.getWorkspace(path);
      setWorkspaceTree(data.tree || []);
    } catch (error) {
      console.warn("Could not load workspace tree:", error);
    }
  };

  useEffect(() => {
    let treeLoaded = false;
    // Poll Motor Status every 5 seconds
    const checkMotor = async () => {
      const isOnline = await ControladorClient.checkStatus();
      setMotorStatus(isOnline);
      if (isOnline) {
        // Only load tree if we haven't loaded it yet since coming online
        if (!treeLoaded) {
          let resolvedPath: string | null = null;
          try {
            // 1. Siempre priorizar la ruta maestra directamente desde el Motor Local (localhost:8000)
            const localWs = await ControladorClient.getDefaultWorkspace();
            if (localWs && localWs.path) {
              resolvedPath = localWs.path;
            }
          } catch (e) {
            // Motor no respondió al endpoint de workspace
          }

          if (!resolvedPath) {
            // 2. Fallback a API de servidor Next.js
            try {
              const res = await fetch('/api/setup/workspace');
              if (res.ok) {
                const data = await res.json();
                if (data.success && data.path) {
                  resolvedPath = data.path;
                }
              }
            } catch (err) {
              // Fallback final a localStorage
              resolvedPath = localStorage.getItem('autoprod_workspace_path');
            }
          }

          if (resolvedPath) {
            localStorage.setItem('autoprod_workspace_path', resolvedPath);
            setWorkspacePath(resolvedPath);
            loadWorkspaceTree(resolvedPath);
            treeLoaded = true;
          }
        }
      } else {
        treeLoaded = false;
      }
    };
    checkMotor();
    const interval = setInterval(checkMotor, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const savedPath = localStorage.getItem('autoprod_workspace_path');
    if (savedPath) {
      setWorkspacePath(savedPath);
      if (motorStatus) loadWorkspaceTree(savedPath);
    }
  }, [motorStatus]);

  const handleLinkWorkspace = (path: string) => {
    localStorage.setItem('autoprod_workspace_path', path);
    setWorkspacePath(path);
    loadWorkspaceTree(path);
    toast.success('Ruta maestra vinculada');
  };

  const handleCreateNode = async (parentPath: string, folderName: string, subfolders: string[]) => {
    try {
      await ControladorClient.createFolder(parentPath, folderName, subfolders);
      if (workspacePath) {
        loadWorkspaceTree(workspacePath);
      }
    } catch (error) {
      alert("Error al crear carpeta");
    }
  };

  const handleCreateChannel = async (basePath: string, channelName: string, folders: string[]) => {
    const maxChannels = userProfile?.maxChannels ?? 1;
    const channelLocalPath = `${basePath}/${channelName}`.replace(/\\/g, '/');
    const toastId = toast.loading(lang === 'es' ? 'Validando límites y creando canal...' : 'Validating limits and creating channel...');
    try {
      // 1. Validar y registrar en base de datos con control estricto de límite de plan
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: channelName,
          localPath: channelLocalPath,
          niche: channelName,
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 403 || errorData.code === 'MAX_CHANNELS_REACHED') {
          toast.error(errorData.message || (lang === 'es'
            ? `Límite alcanzado. Tu plan permite un máximo de ${maxChannels} canal(es). Mejora a Pro o Enterprise para agregar más canales.`
            : `Limit reached. Your plan allows a maximum of ${maxChannels} channel(s). Upgrade to Pro or Enterprise.`), { id: toastId, duration: 6000 });
          setIsPlansModalOpen(true);
          return;
        }
        throw new Error(errorData.error || 'Error al registrar el canal en base de datos');
      }

      // 2. Si el registro en BD fue exitoso, crear las carpetas físicas en disco local
      await ControladorClient.initVideoWorkspace(basePath, channelName, "Estructura_Base", folders);
      toast.success(lang === 'es' ? 'Canal y carpetas creadas correctamente' : 'Channel and folders created successfully', { id: toastId });

      await fetchDbChannels();
      if (workspacePath) loadWorkspaceTree(workspacePath);
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  useEffect(() => {
    let active = true;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      let role = 'USER';
      let maxChannels = 1;
      try {
        const res = await fetch('/api/auth/sync', { method: 'POST' });
        if (res.ok && active) {
          const syncData = await res.json();
          role = syncData?.role ?? 'USER';
          maxChannels = syncData?.maxChannels ?? syncData?.user?.maxChannels ?? 1;
          const plan = syncData?.planName ?? syncData?.plan?.name ?? syncData?.user?.plan ?? 'FREE';
          const creds = syncData?.creditsBalance ?? syncData?.wallet?.balance ?? syncData?.user?.creditsBalance ?? 50;
          setCurrentPlanName(plan);
          setCurrentCredits(creds);
        }
      } catch { /* non-fatal */ }

      // Detectar confirmación de pago Lemon Squeezy
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment') === 'success') {
          toast.success('¡Suscripción confirmada!', {
            description: 'Tu plan y bolsa de tokens han sido actualizados con éxito.',
            duration: 6000,
          });
          // Limpiar query param de la URL sin recargar
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      if (active) {
        setUserProfile({
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
          email: user.email || '',
          role,
          maxChannels,
        });
      }
    };
    init();
    return () => { active = false; };
  }, [supabase]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Sesión cerrada', { description: 'Vuelve pronto.' });
      setTimeout(() => { router.push('/'); router.refresh(); }, 1200);
    } catch (err: any) {
      toast.error(err.message || 'Error al cerrar sesión');
    }
  };

  // ── Navigation State ──
  const [activeView, setActiveView] = useState<'home' | 'chat' | 'editor' | 'looper' | 'subtitles' | 'assets' | 'images' | 'tts'>('home');
  const [videoStudioTab, setVideoStudioTab] = useState<'clips' | 'audio' | 'text' | 'subtitles'>('clips');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeEditorPath, setActiveEditorPath] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(true);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [rightChatWidth, setRightChatWidth] = useState<number>(420);

  // ── Data State ──
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [dbChannels, setDbChannels] = useState<any[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<any[]>([]);
  const [geminiKey, setGeminiKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [loadedConversations, setLoadedConversations] = useState<Record<string, boolean>>({});

  const fetchDbChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/channels');
      if (res.ok) {
        const data = await res.json();
        setDbChannels(data);
      }
    } catch (e) {
      console.warn('Error al cargar canales de BD:', e);
    }
  }, []);

  // ── Derived Variables ──
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const messages = activeConversation?.messages ?? [];

  // Canales derivados: prioridad canales registrados en BD con UUIDs y metadatos de nicho
  const channels = (() => {
    const list: any[] = dbChannels.map(ch => ({
      id: ch.id,
      name: ch.name,
      localPath: ch.localPath,
      niche: ch.niche || ch.name,
      context: ch.context,
      videos: ch.videos || []
    }));

    // Complementar con carpetas de workspace físicas que no estén aún en BD
    for (const node of workspaceTree) {
      if (!list.some(c => c.name.toLowerCase() === node.name.toLowerCase())) {
        list.push({
          id: node.name,
          name: node.name,
          localPath: workspacePath ? `${workspacePath}/${node.name}`.replace(/\\/g, '/') : null,
          niche: node.name,
          videos: []
        });
      }
    }
    return list;
  })();

  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) { setGeminiKey(saved); setIsKeySaved(true); }
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    let active = true;
    const load = async () => {
      try {
        const [pr, co, ch] = await Promise.all([
          fetch('/api/tools/prompts'),
          fetch('/api/conversations'),
          fetch('/api/channels'),
        ]);
        if (!active) return;
        if (pr.ok) setPromptTemplates(await pr.json());
        if (ch.ok) setDbChannels(await ch.json());
        if (co.ok) {
          const raw = await co.json();
          const formatted: Conversation[] = raw.map((c: any) => ({
            ...c,
            messages: [], // Initialize empty for lazy loading
          }));
          setConversations(formatted);
          if (formatted.length > 0) {
            setActiveConversationId(formatted[0].id);
          } else {
            await createInitialConversation();
          }
        }
      } catch (e) { console.error('load error', e); }
    };
    load();
    return () => { active = false; };
  }, [userProfile]);

  // ── Lazy Load Messages Effect ──
  useEffect(() => {
    if (!activeConversationId) return;

    // Check if we already loaded or are currently loading this conversation
    if (loadedConversations[activeConversationId]) return;

    const fetchMessages = async () => {
      // Mark as loaded before fetching to prevent concurrent requests for the same ID
      setLoadedConversations(prev => ({ ...prev, [activeConversationId]: true }));
      try {
        const res = await fetch(`/api/conversations/${activeConversationId}/messages`);
        if (res.ok) {
          const rawMessages = await res.json();
          const formatted = formatMessages(rawMessages);
          setConversations(prev => prev.map(c =>
            c.id === activeConversationId ? { ...c, messages: formatted } : c
          ));
        } else {
          // If failed, reset state so it can be retried if clicked again
          setLoadedConversations(prev => ({ ...prev, [activeConversationId]: false }));
        }
      } catch (err) {
        console.error('Error lazy loading messages:', err);
        setLoadedConversations(prev => ({ ...prev, [activeConversationId]: false }));
      }
    };
    fetchMessages();
  }, [activeConversationId]);

  // ── Conversation actions ──
  const createInitialConversation = async () => {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nueva conversación' }),
    });
    if (res.ok) {
      const raw = await res.json();
      const conv: Conversation = { ...raw, messages: formatMessages(raw.messages) };
      setConversations([conv]);
      setActiveConversationId(conv.id);
    }
  };

  const handleNewConversation = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: lang === 'es' ? 'Nueva conversación' : 'New conversation' }),
      });
      if (res.ok) {
        const raw = await res.json();
        const conv: Conversation = { ...raw, messages: formatMessages(raw.messages) };
        setConversations(prev => [conv, ...prev]);
        setActiveConversationId(conv.id);
        setIsChatOpen(true);
        toast.success(lang === 'es' ? 'Nueva conversación creada' : 'New conversation created');
      }
    } catch { toast.error('Error al crear conversación'); }
  };

  const confirmDeleteConversation = async () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationId === id) {
          const remaining = conversations.filter(c => c.id !== id);
          setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
        }
        toast.success(lang === 'es' ? 'Conversación eliminada' : 'Conversation deleted');
      } else {
        toast.error('Error al eliminar conversación');
      }
    } catch {
      toast.error('Error al eliminar conversación');
    }
    setDeleteTargetId(null);
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
        toast.success(lang === 'es' ? 'Nombre actualizado' : 'Name updated');
      } else {
        toast.error('Error al renombrar');
      }
    } catch {
      toast.error('Error al renombrar');
    }
  };

  const handleNewConversationWithRole = async (roleType: 'channel' | 'video' | 'script' | 'prompt' | 'import_channel') => {
    const maxChannels = userProfile?.maxChannels ?? 1;
    if ((roleType === 'channel' || roleType === 'import_channel') && userProfile?.role !== 'ADMIN' && workspaceTree.length >= maxChannels) {
      toast.error(lang === 'es'
        ? `Has alcanzado el límite de ${maxChannels} canal(es) de tu plan actual. Actualiza a Plan Pro o Enterprise para gestionar múltiples canales.`
        : `You have reached the limit of ${maxChannels} channel(s) for your plan. Upgrade to Pro or Enterprise.`);
      setIsPlansModalOpen(true);
      return;
    }

    const nameMap: Record<string, string> = {
      channel: 'crear_canal',
      video: 'crear_video',
      script: 'crear_guion',
      prompt: 'crear_prompt',
      import_channel: 'extraer_canal_youtube'
    };
    const targetTemplateName = nameMap[roleType] || roleType;
    const template = promptTemplates.find(p => p.name === targetTemplateName);

    const titleMap: Record<string, { es: string; en: string }> = {
      crear_canal: { es: 'Crear Canal 📺', en: 'Create Channel 📺' },
      crear_video: { es: 'Crear Video 🎬', en: 'Create Video 🎬' },
      crear_guion: { es: 'Crear Guion 📄', en: 'Create Script 📄' },
      crear_prompt: { es: 'Crear Prompt ✨', en: 'Create Prompt ✨' },
      extraer_canal_youtube: { es: 'Extraer Canal 📥', en: 'Extract Channel 📥' },
    };

    const title = titleMap[targetTemplateName]?.[lang] || template?.name || (lang === 'es' ? 'Nueva conversación' : 'New conversation');
    const systemPrompt = template?.systemPrompt || '';
    const welcomeText = template?.welcomeText || (lang === 'es' ? '¡Hola! ¿En qué te puedo colaborar hoy?' : 'Hello! How can I help you today?');

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, systemPrompt, welcomeText }),
      });
      if (res.ok) {
        const raw = await res.json();
        const conv: Conversation = { ...raw, messages: formatMessages(raw.messages) };
        setConversations(prev => [conv, ...prev]);
        setActiveConversationId(conv.id);
        setIsChatOpen(true);
        toast.success(lang === 'es' ? 'Chat de trabajo inicializado' : 'Workspace chat initialized');
      }
    } catch { toast.error('Error al iniciar el chat de trabajo'); }
  };

  // ── Chat ──
  const [isGeneratingGlobal, setIsGeneratingGlobal] = useState(false);
  const [messageQueue, setMessageQueue] = useState<{ text: string, conversationId: string, agentSlug?: string }[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Estado para el Preview del Arnés
  const [actionPreview, setActionPreview] = useState<{
    endpoint: string;
    content: string;
    agent: string;
    stepName: string;
  } | null>(null);

  const cancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // ── Credit Confirmation State ──
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [pendingChatMessage, setPendingChatMessage] = useState<{ customText?: string, agentSlug?: string } | null>(null);
  const [dontAskCreditAgain, setDontAskCreditAgain] = useState(false);


  const [inputPrompt, setInputPrompt] = useState('');
  const [isDeepThinking, setIsDeepThinking] = useState(false);
  const [checklist, setChecklist] = useState({ cta: true, timestamps: false, tags: true, saveThumbnail: true });
  const [seoOutput, setSeoOutput] = useState({
    title: '',
    tags: '',
    description: '',
  });

  const handleSendMessage = async (customText?: string, agentSlug?: string) => {
    const textToSend = customText ?? inputPrompt;
    const conversationId = activeConversationId;

    if (!textToSend.trim() || !conversationId) return;

    if (!customText) {
      setInputPrompt('');
    }

    if (isGeneratingGlobal) {
      const tempMsg: Message = { sender: 'user', text: textToSend, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isTemp: true, isQueued: true };
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, messages: [...c.messages, tempMsg] } : c));
      setMessageQueue(prev => [...prev, { text: textToSend, conversationId, agentSlug }]);
      return;
    }

    setIsGeneratingGlobal(true);
    const text = textToSend;
    const tempMsg: Message = { sender: 'user', text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isTemp: true };

    try {
      // 1. Obtener el modelo y deducir el proveedor seleccionado (Por defecto OpenAI GPT-4o Mini)
      let model = typeof window !== 'undefined' ? localStorage.getItem('autoprod_ai_model') || 'openai:gpt-4o-mini' : 'openai:gpt-4o-mini';
      if (model === 'default') model = 'openai:gpt-4o-mini';

      let provider = 'openai';
      let actualModel = 'gpt-4o-mini';
      let friendlyModelName = 'GPT-4o Mini';
      const firstColonIndex = model.indexOf(':');
      if (firstColonIndex !== -1) {
        provider = model.substring(0, firstColonIndex);
        actualModel = model.substring(firstColonIndex + 1);
      } else {
        if (model.includes('gpt')) provider = 'openai';
        else if (model.includes('claude')) provider = 'anthropic';
        else if (model.includes('gemini')) provider = 'gemini';
      }

      if (provider === 'openai') friendlyModelName = actualModel.includes('mini') ? 'GPT-4o Mini' : 'GPT-4o';
      else if (provider === 'gemini') friendlyModelName = 'Gemini Flash';
      else if (provider === 'anthropic') friendlyModelName = 'Claude 3.5 Sonnet';
      else if (provider === 'imagen3') friendlyModelName = 'Imagen 3';

      const startTime = Date.now();
      const tempAiMsg: Message = {
        sender: 'gemini',
        text: isDeepThinking ? (lang === 'es' ? 'Razonando en profundidad...' : 'Deep reasoning...') : 'Pensando...',
        timestamp: '',
        modelName: friendlyModelName,
        isGenerating: true,
        isTemp: true,
        isDeepThinking
      };

      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, messages: [...c.messages, tempMsg, tempAiMsg] } : c));

      // 2. Mapear a comando CLI o llamar a API REST Cloud
      let aiResponseText = '';

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        if (provider === 'imagen3') {
          // Motor Local (Imágenes)
          const commandTemplate = 'gemini-cli image "{prompt}"';
          aiResponseText = await ControladorClient.askConsoleAI(text, commandTemplate);
        } else {
          // Orquestador Central vía Vercel AI SDK
          // Build history, skipping the first assistant message which is a static UI greeting
          // and should not be sent to the model as it incorrectly primes its behavior.
          const allMessages = activeConversation?.messages || [];
          const firstUserIndex = allMessages.findIndex(m => m.sender === 'user');
          const messagesForApi = firstUserIndex >= 0 ? allMessages.slice(firstUserIndex) : allMessages;

          const chatHistory = messagesForApi.map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
          }));

          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [...chatHistory, { role: 'user', content: text }],
              provider,
              model: actualModel,
              workspacePath: workspacePath || '',
              channelId: activeConversation?.channelId || null,
              agentSlug,
              deepThinking: isDeepThinking,
              confirmCreditUsage: typeof window !== 'undefined' ? localStorage.getItem('autoprod_always_confirm_credits') === 'true' : false
            }),
            signal: abortController.signal
          });

          if (res.status === 402) {
            const errorData = await res.json().catch(() => ({}));
            setIsGeneratingGlobal(false);
            setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, messages: c.messages.filter(m => !m.isTemp) } : c));
            if (errorData.requiresUpgrade) {
              toast.error(errorData.error || 'Saldo de créditos insuficiente. Actualiza tu plan para continuar.', {
                duration: 5000,
              });
              setIsPlansModalOpen(true);
            } else {
              setPendingChatMessage({ customText: textToSend, agentSlug });
              setIsCreditModalOpen(true);
            }
            return;
          }

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error conectando con la IA');
          }

          // Leer headers para el Arnés
          const reqPreview = res.headers.get('X-AutoProd-Requires-Preview') === 'true';
          const agentNameHeader = decodeURIComponent(res.headers.get('X-AutoProd-Agent') || '');
          const stepNameHeader = decodeURIComponent(res.headers.get('X-AutoProd-Step-Name') || '');
          const endpointHeader = decodeURIComponent(res.headers.get('X-AutoProd-Action-Endpoint') || '');

          // Read the JSON response from the AI (non-streaming)
          const data = await res.json();
          aiResponseText = data.text || '';

          if (typeof data.newBalance === 'number') {
            setCurrentCredits(data.newBalance);
            window.dispatchEvent(new CustomEvent('autoprod:wallet-updated', { detail: { balance: data.newBalance } }));
          }

          if (reqPreview) {
            setActionPreview({
              content: aiResponseText,
              agent: agentNameHeader,
              stepName: stepNameHeader,
              endpoint: endpointHeader
            });
          }

          // Actualizar inmediatamente el árbol del workspace si la IA ejecutó acciones o devolvió respuesta
          if (workspacePath) {
            loadWorkspaceTree(workspacePath);
          }
          if (data.workspaceModified) {
            toast.success(lang === 'es' ? 'Workspace sincronizado con los cambios de la IA' : 'Workspace synchronized with AI changes');
          }

          // Update UI with AI response and bind channelId if newly detected
          setConversations(prev => prev.map(c => {
            if (c.id !== conversationId) return c;
            const newMsgs = [...c.messages];
            newMsgs[newMsgs.length - 1] = {
              ...tempAiMsg,
              text: aiResponseText,
              modelName: data.modelName || friendlyModelName,
              isDeepThinking: data.isDeepThinking !== undefined ? data.isDeepThinking : isDeepThinking
            };
            return {
              ...c,
              messages: newMsgs,
              channelId: data.channelId || c.channelId
            };
          }));

          if (data.channelId && data.channelId !== activeConversation?.channelId) {
            fetch(`/api/conversations/${conversationId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ channelId: data.channelId })
            }).catch(() => { });
          }
        }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          aiResponseText += `\n\n🛑 Proceso cancelado por el usuario.`;
        } else {
          aiResponseText = `❌ Error de IA: ${e.message}. Verifica tus API Keys en Ajustes o si tu motor local está encendido.`;
        }
      }

      const generationTimeMs = Date.now() - startTime;

      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, checklist, aiResponseText, modelName: actionPreview?.agent || friendlyModelName }),
      });

      if (res.ok) {
        const data = await res.json();
        const userMsg: Message = { sender: 'user', text: data.userMessage.text, timestamp: new Date(data.userMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        const geminiMsg: Message = {
          sender: 'gemini',
          text: data.geminiMessage.text,
          timestamp: new Date(data.geminiMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelName: data.modelName || friendlyModelName,
          generationTimeMs,
          isGenerating: false
        };
        setConversations(prev => prev.map(c => {
          if (c.id !== conversationId) return c;
          // Filtramos los temporales usando isTemp y ponemos los reales
          return { ...c, title: data.conversationTitle, messages: [...c.messages.filter(m => !m.isTemp), userMsg, geminiMsg] };
        }));

        // Simular SEO Update si era chat de texto
        if (provider !== 'imagen3') {
          setSeoOutput({
            title: `Optimizado: ${text.substring(0, 45)}...`,
            tags: 'seo, gemini, autoprod, youtube automation',
            description: `Metadatos generados para: "${text}".\n\n📌 SEO aplicado.${checklist.cta ? '\n\n¡Dale Like y Suscríbete! 👍' : ''}`,
          });
        }
      }
    } catch {
      toast.error('Error al enviar mensaje');
      // Revertir mensajes temporales en caso de error fatal
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, messages: c.messages.filter(m => !m.isTemp) } : c));
    } finally {
      setIsGeneratingGlobal(false);
      if (workspacePath) {
        loadWorkspaceTree(workspacePath);
      }
    }
  };

  const handleConfirmCreditUsage = () => {
    if (dontAskCreditAgain) {
      localStorage.setItem('autoprod_always_confirm_credits', 'true');
    }
    setIsCreditModalOpen(false);
    if (pendingChatMessage) {
      handleSendMessage(pendingChatMessage.customText, pendingChatMessage.agentSlug);
      setPendingChatMessage(null);
    }
  };

  useEffect(() => {
    if (!isGeneratingGlobal && messageQueue.length > 0) {
      const nextMsg = messageQueue[0];
      setMessageQueue(prev => prev.slice(1));

      // Eliminar el mensaje en cola visualmente antes de enviarlo de verdad
      setConversations(prev => prev.map(c => {
        if (c.id === nextMsg.conversationId) {
          return { ...c, messages: c.messages.filter(m => !(m.isTemp && m.isQueued && m.text === nextMsg.text)) };
        }
        return c;
      }));

      handleSendMessage(nextMsg.text, nextMsg.agentSlug);
    }
  }, [isGeneratingGlobal, messageQueue]);

  const handleAssociateChannel = async (channelId: string | null) => {
    if (!activeConversationId) return;
    try {
      const res = await fetch(`/api/conversations/${activeConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      });
      if (res.ok) {
        const data = await res.json();
        const savedChannelId = data.conversation?.channelId ?? channelId;
        setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, channelId: savedChannelId } : c));
        toast.success(lang === 'es' ? 'Canal asociado correctamente' : 'Channel associated successfully');
        fetchDbChannels();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || (lang === 'es' ? 'Error al asociar canal' : 'Error associating channel'));
      }
    } catch {
      toast.error(lang === 'es' ? 'Error al asociar canal' : 'Error associating channel');
    }
  };

  // ── Render simulator ──
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  useEffect(() => {
    if (!isRendering || renderProgress >= 100) return;
    const iv = setInterval(() => setRenderProgress(p => {
      if (p >= 100) { setIsRendering(false); clearInterval(iv); return 100; }
      return p + 5;
    }), 300);
    return () => clearInterval(iv);
  }, [isRendering, renderProgress]);

  // ── Layout resize ──
  const [leftWidth, setLeftWidth] = useState(256);

  const makeDragHandler = (
    current: number,
    set: (v: number) => void,
    min: number,
    max: number,
    invert = false,
  ) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const onMove = (mv: MouseEvent) => {
      const delta = mv.clientX - startX;
      set(Math.max(min, Math.min(max, current + (invert ? -delta : delta))));
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleExecutePreview = async () => {
    if (!actionPreview) return;

    // Convertir el Súper Prompt a los parámetros requeridos por la ruta simplificada
    let channelName = "Nuevo_Canal";
    const nameMatch = actionPreview.content.match(/Canal[:\-]\s*(.+)/i);
    if (nameMatch && nameMatch[1]) channelName = nameMatch[1].trim().replace(/\s+/g, '_');

    toast.loading("Ejecutando switch en la nube...", { id: 'exec-switch' });
    try {
      const res = await fetch(actionPreview.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspacePath,
          channelName,
          superPrompt: actionPreview.content
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("¡Operación completada con éxito!", { id: 'exec-switch' });
        setActionPreview(null);
        if (workspacePath) loadWorkspaceTree(workspacePath);
      } else {
        throw new Error(data.error || "Error al ejecutar");
      }
    } catch (e: any) {
      toast.error(e.message, { id: 'exec-switch' });
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen bg-[#09090b] text-zinc-200 flex flex-col font-sans overflow-hidden">

      {/* ── Header ── */}
      <header className="h-12 border-b border-zinc-800 bg-[#0f0f12] flex items-center justify-between px-4 shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveView('home'); }}
            className="flex items-center gap-2.5 cursor-pointer focus:outline-none group"
          >
            <div className="h-7 w-7 flex items-center justify-center group-hover:scale-105 transition-transform">
              <AutoProdLogo className="h-6 w-6 drop-shadow-[0_0_10px_rgba(134,41,254,0.5)]" />
            </div>
            <span className="font-logo font-extrabold tracking-tight text-sm text-white">AutoProd Console</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleLanguage}
            className="text-xs font-semibold px-2 py-0.5 rounded border border-zinc-800 hover:border-zinc-700 transition-colors text-zinc-400 hover:text-white"
          >
            {lang === 'es' ? '🇺🇸 EN' : '🇪🇸 ES'}
          </button>

          <div className="flex items-center gap-3 text-xs relative">
            <CreditCounter onClick={() => setIsPlansModalOpen(true)} planName={currentPlanName} />
            <span className="text-zinc-400 border-l border-zinc-700 pl-3">{userProfile?.email || 'demo@autoprod.io'}</span>

            <ProfileDropdown
              userProfile={userProfile}
              lang={lang}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
              onOpenPlans={() => setIsPlansModalOpen(true)}
            />
          </div>
        </div>
      </header>

      {/* ── 3-column workspace ── */}
      <div className="flex-1 flex overflow-hidden w-full relative">
        {/* Botón lateral izquierdo para abrir panel */}
        {!isLeftSidebarOpen && (
          <button
            onClick={() => setIsLeftSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-40 bg-[#121217] hover:bg-zinc-800 border-r border-y border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white h-12 w-5 rounded-r-lg shadow-xl cursor-pointer transition-all flex items-center justify-center group"
            title={lang === 'es' ? 'Abrir panel izquierdo' : 'Open left panel'}
          >
            <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {/* Left sidebar */}
        {isLeftSidebarOpen && (
          <>
            <aside style={{ width: `${leftWidth}px` }} className="bg-[#0f0f12] shrink-0 overflow-hidden">
              <ConversationSidebar
                lang={lang}
                conversations={conversations}
                activeConversationId={activeConversationId}
                activeView={activeView}
                workspacePath={workspacePath}
                workspaceTree={workspaceTree}
                motorStatus={motorStatus}
                onRefreshWorkspace={() => workspacePath && loadWorkspaceTree(workspacePath)}
                onNewConversation={handleNewConversation}
                onSelectConversation={(id) => { setActiveConversationId(id); setIsChatOpen(true); }}
                onDeleteConversation={(id) => setDeleteTargetId(id)}
                onRenameConversation={handleRenameConversation}
                onLinkWorkspace={() => {
                  setModalParentPath(null);
                  setCreationMode(null);
                  setIsWorkspaceModalOpen(true);
                }}
                onAddNode={(parentPath, type) => {
                  const maxChannels = userProfile?.maxChannels ?? 1;
                  if (type === 'channel' && userProfile?.role !== 'ADMIN' && workspaceTree.length >= maxChannels) {
                    toast.error(lang === 'es'
                      ? `Límite alcanzado. Tu plan permite un máximo de ${maxChannels} canal(es).`
                      : `Limit reached. Your plan allows a maximum of ${maxChannels} channel(s).`);
                    return;
                  }
                  setModalParentPath(parentPath);
                  setCreationMode(type);
                  setIsWorkspaceModalOpen(true);
                }}
                onOpenFile={(path) => {
                  setActiveEditorPath(path);
                }}
                onOpenLooper={() => setActiveView('looper')}
                onOpenSubtitles={() => setActiveView('subtitles')}
                onOpenAssets={() => setActiveView('assets')}
                onOpenImages={() => setActiveView('images')}
                onOpenTTS={() => setActiveView('tts')}
                onToggleCollapse={() => setIsLeftSidebarOpen(false)}
              />
            </aside>

            {/* Resize handle left */}
            <div
              onMouseDown={makeDragHandler(leftWidth, setLeftWidth, 180, 450)}
              className="w-[3px] hover:w-[5px] hover:bg-purple-500/40 active:bg-purple-500 cursor-col-resize h-full transition-all shrink-0 bg-zinc-800/40 relative z-30"
            />
          </>
        )}

        {/* Center — Launchpad, Looper, Subtitles, Assets, Images or TTS */}
        <main className="flex-1 flex flex-col bg-[#121214] overflow-hidden relative min-w-0">
          {(activeView === 'home' || activeView === 'chat') ? (
            <Launchpad
              lang={lang}
              onSelect={handleNewConversationWithRole}
              onSelectLooper={() => {
                setVideoStudioTab('clips');
                setActiveView('looper');
              }}
              onSelectSubtitles={() => {
                setVideoStudioTab('subtitles');
                setActiveView('looper');
              }}
              onSelectAssets={() => setActiveView('assets')}
              onSelectImages={() => setActiveView('images')}
              onSelectTTS={() => setActiveView('tts')}
              motorStatus={motorStatus}
              workspacePath={workspacePath}
              channelsCount={channels.length}
              onLinkWorkspace={() => {
                setModalParentPath(null);
                setCreationMode(null);
                setIsWorkspaceModalOpen(true);
              }}
            />
          ) : (activeView === 'looper' || activeView === 'subtitles') ? (
            <VideoStudio
              lang={lang}
              channels={channels}
              workspacePath={workspacePath}
              initialMediaTab={activeView === 'subtitles' ? 'subtitles' : videoStudioTab}
              onBack={() => setActiveView('home')}
              onRefreshWorkspace={() => {
                if (workspacePath) {
                  loadWorkspaceTree(workspacePath);
                }
              }}
            />
          ) : activeView === 'assets' ? (
            <AssetLibraryView
              lang={lang}
              channels={channels}
              workspacePath={workspacePath}
              motorStatus={motorStatus}
              onBackToDashboard={() => setActiveView('home')}
              onOpenLooper={() => setActiveView('looper')}
              onOpenSubtitles={() => setActiveView('subtitles')}
              onOpenImageStudio={() => setActiveView('images')}
              onOpenTTS={() => setActiveView('tts')}
            />
          ) : activeView === 'images' ? (
            <ImageStudio
              lang={lang}
              channels={channels}
              workspacePath={workspacePath}
              onBackToDashboard={() => setActiveView('home')}
              onOpenAssets={() => setActiveView('assets')}
            />
          ) : activeView === 'tts' ? (
            <TextToSpeechStudio
              lang={lang}
              channels={channels}
              workspacePath={workspacePath}
              workspaceTree={workspaceTree}
              motorStatus={motorStatus}
              onBackToDashboard={() => setActiveView('home')}
              onOpenSubtitlesStudio={() => setActiveView('subtitles')}
            />
          ) : null}

          {/* Action Preview Floating Panel */}
          {actionPreview && (
            <div className="absolute top-4 right-4 w-96 bg-[#18181b] border border-purple-500/50 shadow-2xl rounded-xl flex flex-col overflow-hidden z-40 animate-in slide-in-from-right-8 fade-in">
              <div className="bg-purple-900/30 border-b border-purple-800/40 px-4 py-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-purple-200">🔍 {actionPreview.agent}</h3>
                  <p className="text-[10px] text-purple-400 font-mono uppercase mt-0.5">{actionPreview.stepName}</p>
                </div>
                <button onClick={() => setActionPreview(null)} className="text-zinc-500 hover:text-white transition-colors">
                  ✕
                </button>
              </div>

              <div className="p-4 bg-black/40">
                <p className="text-xs text-zinc-400 mb-2 font-semibold tracking-wide uppercase">Previsualización de Estructura:</p>
                <div className="bg-[#0f0f12] border border-zinc-800 p-3 rounded-lg text-xs font-mono text-zinc-300 h-48 overflow-y-auto whitespace-pre-wrap">
                  {actionPreview.content}
                </div>
              </div>

              <div className="p-4 border-t border-zinc-800 bg-[#18181b] flex flex-col gap-2">
                <button
                  onClick={handleExecutePreview}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-lg shadow-lg flex justify-center items-center gap-2 transition-all"
                >
                  🚀 Aprobar y Ejecutar en la Nube
                </button>
                <p className="text-[9px] text-center text-zinc-500 leading-tight">
                  Al ejecutar, el orquestador llamará a <strong>{actionPreview.endpoint}</strong> para construir el proyecto y consumirá tokens de Gemini.
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right Panel: Copilot Agéntico / File Previewer */}
        {(isChatOpen || activeEditorPath) && (
          <>
            {/* Resize handle right */}
            <div
              onMouseDown={makeDragHandler(rightChatWidth, setRightChatWidth, 320, 700, true)}
              className="w-[3px] hover:w-[5px] hover:bg-purple-500/40 active:bg-purple-500 cursor-col-resize h-full transition-all shrink-0 bg-zinc-800/40 relative z-30"
            />
            <aside style={{ width: `${rightChatWidth}px` }} className="bg-[#0f0f12] shrink-0 overflow-hidden flex flex-col relative z-20">
              {activeEditorPath ? (
                <div className="flex flex-col h-full">
                  <div className="h-10 border-b border-zinc-800 bg-[#0c0c0e] px-3 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-xs font-semibold text-zinc-300 truncate">
                        📄 {activeEditorPath.split(/[/\\]/).pop()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setActiveEditorPath(null)}
                        className="text-xs px-2 py-1 rounded bg-purple-950/70 hover:bg-purple-900 border border-purple-500/40 text-purple-200 transition-colors cursor-pointer"
                        title={lang === 'es' ? 'Volver al Copilot IA' : 'Back to AI Copilot'}
                      >
                        ✨ {lang === 'es' ? 'Ver Copilot' : 'View Copilot'}
                      </button>
                      <button
                        onClick={() => setActiveEditorPath(null)}
                        className="w-6 h-6 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                        title={lang === 'es' ? 'Cerrar archivo' : 'Close file'}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <FilePreviewer
                      filePath={activeEditorPath}
                      onClose={() => setActiveEditorPath(null)}
                    />
                  </div>
                </div>
              ) : (
                <ChatPanel
                  lang={lang}
                  messages={messages}
                  activeConversation={activeConversation}
                  channels={channels}
                  activeConversationId={activeConversationId}
                  inputPrompt={inputPrompt}
                  checklist={checklist}
                  onInputChange={setInputPrompt}
                  onSend={handleSendMessage}
                  onChecklistChange={(key, val) => setChecklist(prev => ({ ...prev, [key]: val }))}
                  onAssociateChannel={handleAssociateChannel}
                  isGenerating={isGeneratingGlobal}
                  onCancel={cancelGeneration}
                  workspacePath={workspacePath}
                  onSuccess={() => {
                    if (workspacePath) {
                      loadWorkspaceTree(workspacePath);
                    }
                  }}
                  isDeepThinking={isDeepThinking}
                  onToggleDeepThinking={setIsDeepThinking}
                  promptTemplates={promptTemplates}
                  conversations={conversations}
                  onSelectConversation={(id) => setActiveConversationId(id)}
                  onNewConversation={handleNewConversation}
                  onDeleteConversation={(id) => setDeleteTargetId(id)}
                  onRenameConversation={handleRenameConversation}
                  onToggleCollapse={() => setIsChatOpen(false)}
                />
              )}
            </aside>
          </>
        )}

      </div>

      {/* Burbuja inferior derecha para abrir el chat */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-4 py-2.5 rounded-full shadow-2xl shadow-purple-900/50 flex items-center gap-2 text-xs transition-all hover:scale-105 active:scale-95 cursor-pointer border border-purple-400/40"
        >
          <span className="text-base">✨</span>
          <span>{lang === 'es' ? 'Copilot IA' : 'AI Copilot'}</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </button>
      )}


      {/* Credit Confirmation Modal */}
      {isCreditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#18181b] border border-purple-500/30 w-[400px] rounded-xl shadow-2xl p-6 relative flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🪙</span>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              {lang === 'es' ? 'Consumo de Créditos AutoProd' : 'AutoProd Credits Usage'}
            </h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              {lang === 'es'
                ? 'No tienes una API Key personal configurada (BYOK). Esta acción consumirá créditos de la plataforma AutoProd. ¿Deseas continuar?'
                : "You don't have a personal API Key (BYOK) configured. This action will consume AutoProd platform credits. Do you want to continue?"}
            </p>

            <label className="flex items-center gap-2 mb-6 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={dontAskCreditAgain}
                onChange={(e) => setDontAskCreditAgain(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-black text-purple-500 focus:ring-purple-500 focus:ring-offset-black"
              />
              {lang === 'es' ? 'No volver a preguntar' : "Don't ask again"}
            </label>

            <div className="flex w-full gap-3">
              <button
                onClick={() => {
                  setIsCreditModalOpen(false);
                  setPendingChatMessage(null);
                }}
                className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors"
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmCreditUsage}
                className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors shadow-lg shadow-purple-500/20"
              >
                {lang === 'es' ? 'Aceptar' : 'Accept'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <UserSettingsModal
        isOpen={isSettingsModalOpen}
        lang={lang}
        user={userProfile ? { name: userProfile.name, email: userProfile.email } : null}
        onClose={() => setIsSettingsModalOpen(false)}
        onOpenPlans={() => setIsPlansModalOpen(true)}
      />

      {/* Subscription Plans & Token Economics Modal */}
      <SubscriptionPlansModal
        isOpen={isPlansModalOpen}
        onClose={() => setIsPlansModalOpen(false)}
        currentPlanName={currentPlanName}
        currentCredits={currentCredits}
        userEmail={userProfile?.email}
        lang={lang}
      />

      {/* Profile/Workspace Setup Modals */}
      <WorkspaceModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        onLinkWorkspace={handleLinkWorkspace}
        onCreateNode={handleCreateNode}
        parentPath={modalParentPath}
        creationMode={creationMode}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteConversation}
        title={lang === 'es' ? '¿Eliminar conversación?' : 'Delete conversation?'}
        description={lang === 'es'
          ? 'Esta acción no se puede deshacer. Se borrarán todos los mensajes asociados a este chat.'
          : 'This action cannot be undone. All messages associated with this chat will be deleted.'}
      />
    </div>
  );
}
