'use client';

import { useState, useEffect, useRef } from 'react';
import { Language, translations } from '@/app/translations';
import { Channel, Conversation, Message } from '@/components/dashboard/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import InteractiveQuestionCard from './InteractiveQuestionCard';

interface Checklist {
  cta: boolean;
  timestamps: boolean;
  tags: boolean;
  saveThumbnail: boolean;
}

interface Props {
  lang: Language;
  messages: Message[];
  activeConversation: Conversation | undefined;
  channels: Channel[];
  activeConversationId: string | null;
  inputPrompt: string;
  checklist: Checklist;
  onInputChange: (val: string) => void;
  onSend: (customText?: string, agentSlug?: string) => void;
  onChecklistChange: (key: keyof Checklist, val: boolean) => void;
  onAssociateChannel: (channelId: string | null) => void;
  isGenerating?: boolean;
  onCancel?: () => void;
  workspacePath?: string | null;
  onSuccess?: () => void;
  isDeepThinking?: boolean;
  onToggleDeepThinking?: (val: boolean) => void;
  promptTemplates?: any[];
  conversations?: Conversation[];
  onSelectConversation?: (id: string) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: (id: string) => void;
  onRenameConversation?: (id: string, newTitle: string) => void;
  onToggleCollapse?: () => void;
}

export default function ChatPanel({
  lang,
  messages,
  activeConversation,
  channels,
  activeConversationId,
  inputPrompt,
  checklist,
  onInputChange,
  onSend,
  onChecklistChange,
  onAssociateChannel,
  isGenerating,
  onCancel,
  workspacePath,
  onSuccess,
  isDeepThinking = false,
  onToggleDeepThinking,
  promptTemplates = [],
  conversations = [],
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onToggleCollapse,
}: Props) {
  const t = translations[lang];

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerStart, setTimerStart] = useState<number | null>(null);

  // ── Historial de conversaciones en el Copilot ──
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [searchConv, setSearchConv] = useState('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editConvTitle, setEditConvTitle] = useState('');

  const PROMPT_TEMPLATES: Record<string, string> = {
    import_channel: `[Extracción y Análisis de Canal de YouTube]
• URL o Handle del canal (ej. https://youtube.com/@micanal o @micanal): 
• Cantidad de videos a analizar (por defecto 50): 50
• Objetivo principal (analizar tags ganadoras, métricas y generar inventario anti-duplicados): `,

    channel: `[Configuración de Nuevo Canal de YouTube]
• Nombre del canal: 
• Nicho o temática (ej. Finanzas Personales, Misterio, Gaming, Tutoriales Tech): 
• Público objetivo (edad, país, intereses): 
• Estilo y tono del canal (ej. entretenido, analítico, formal, dinámico): 
• Estructura de carpetas requerida (ej. Guiones, Miniaturas, Videos, Ambiente, prompts): `,

    video: `[Planificación de Nuevo Video]
• Canal de destino: 
• Idea central o título preliminar: 
• Formato (Short vertical / Video Largo horizontal): 
• Duración aproximada deseada: 
• Mensaje o aprendizaje clave para la audiencia: 
• Objetivo principal (viralidad, conseguir suscriptores, retención máxima): `,

    script: `[Redacción de Guion para Video]
• Canal y Tema del video: 
• Gancho inicial deseado (primeros 5-10 segundos): 
• Tono del narrador (ej. dramático, entusiasta, sarcástico, educativo): 
• Puntos clave o estructura deseada: 
• Llamado a la acción (CTA) final: `,

    image: `[Diseño de Miniatura / Arte Visual]
• Canal / Video: 
• Idea visual o concepto central de la miniatura: 
• Emoción principal a transmitir (ej. asombro, curiosidad extrema, advertencia, éxito): 
• Elementos visuales clave (ej. rostro en primer plano, gráfico impactante, flecha): 
• Texto corto en la imagen (máx 3-4 palabras de alto CTR): 
• Paleta de colores o estética visual (ej. alto contraste, oscuro y neón, minimalista): `,

    editor: `[Pauta de Edición y Montaje]
• Canal y Video: 
• Ritmo de corte (rápido para shorts con cortes cada 2s / pausado y cinematográfico): 
• Estilo de subtítulos (ej. dinámicos con colores y emojis / limpios y elegantes): 
• Música de fondo sugerida y diseño de sonido (SFX): 
• Recursos visuales o B-rolls requeridos: `
  };

  const handleInsertTemplate = (key: string) => {
    const nameMap: Record<string, string> = {
      channel: 'crear_canal',
      video: 'crear_video',
      script: 'crear_guion',
      prompt: 'crear_prompt',
      import_channel: 'extraer_canal_youtube'
    };
    const targetName = nameMap[key] || key;
    const dbTpl = promptTemplates?.find((p: any) => p.name === targetName);
    const templateText = dbTpl?.welcomeText || PROMPT_TEMPLATES[key];

    if (templateText) {
      onInputChange(templateText);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
      }, 50);
    }
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isUp = scrollTop + clientHeight < scrollHeight - 50;
      setIsScrolledUp(isUp);
      if (!isUp) {
        setHasNewMessage(false);
      }
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
    setIsScrolledUp(false);
    setHasNewMessage(false);
  };

  useEffect(() => {
    if (!isScrolledUp) {
      scrollToBottom();
    } else {
      setHasNewMessage(true);
    }
  }, [messages]);

  useEffect(() => {
    const isGenerating = messages.some(m => m.isGenerating);
    if (isGenerating && !timerStart) {
      setTimerStart(Date.now());
    } else if (!isGenerating && timerStart) {
      setTimerStart(null);
      setElapsedMs(0);
    }
  }, [messages, timerStart]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerStart) {
      interval = setInterval(() => {
        setElapsedMs(Date.now() - timerStart);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [timerStart]);

  const activeChannelObj = channels.find(c => 
    c.id === activeConversation?.channelId || 
    c.name.toLowerCase() === activeConversation?.channelId?.toLowerCase()
  );


  if (showHistoryView) {
    const filteredConversations = conversations.filter(c =>
      c.title.toLowerCase().includes(searchConv.toLowerCase())
    );

    return (
      <div className="flex-1 flex flex-col relative h-full bg-[#0d0d10] animate-in fade-in duration-150">
        {/* Header de la vista de historial */}
        <div className="h-12 border-b border-zinc-800 bg-[#0f0f12] px-3.5 flex items-center justify-between shrink-0 gap-2 relative z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setShowHistoryView(false)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shrink-0"
              title={lang === 'es' ? 'Volver al chat' : 'Back to chat'}
            >
              <span className="text-sm">←</span>
              <span>{lang === 'es' ? 'Volver' : 'Back'}</span>
            </button>
            <div className="flex items-center gap-1.5 min-w-0">
              <svg className="w-4 h-4 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-bold text-white truncate">
                {lang === 'es' ? 'Historial de Conversaciones' : 'Conversation History'}
              </span>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded-full border border-zinc-700 shrink-0">
                {conversations.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onNewConversation && (
              <button
                type="button"
                onClick={() => {
                  onNewConversation();
                  setShowHistoryView(false);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-sm shadow-purple-500/20 active:scale-95"
                title={lang === 'es' ? 'Iniciar nueva conversación' : 'Start new conversation'}
              >
                <span>+</span>
                <span className="hidden sm:inline">{lang === 'es' ? 'Nueva' : 'New'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowHistoryView(false)}
              className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer shrink-0"
              title={lang === 'es' ? 'Volver al chat' : 'Back to chat'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Buscador de conversaciones */}
        <div className="p-3 border-b border-zinc-800 bg-[#0c0c0f]">
          <div className="relative">
            <input
              type="text"
              placeholder={lang === 'es' ? 'Buscar en conversaciones...' : 'Search conversations...'}
              value={searchConv}
              onChange={(e) => setSearchConv(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <svg className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0118 0z" />
            </svg>
            {searchConv && (
              <button
                type="button"
                onClick={() => setSearchConv('')}
                className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Lista scrolleable de conversaciones */}
        <div className="flex-1 overflow-y-auto minimal-scrollbar p-3 space-y-2">
          {filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEditing = editingConvId === conv.id;
            const messageCount = conv.messages?.length || 0;
            const formattedDate = conv.createdAt
              ? new Date(conv.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '';

            return (
              <div
                key={conv.id}
                onClick={() => {
                  if (onSelectConversation && !isEditing) {
                    onSelectConversation(conv.id);
                    setShowHistoryView(false);
                  }
                }}
                className={`group flex items-start justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-purple-950/40 border-purple-500/50 text-purple-200 shadow-sm shadow-purple-500/10'
                    : 'bg-zinc-900/50 hover:bg-zinc-800/70 border-zinc-800/80 hover:border-zinc-700 text-zinc-300'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  {isEditing ? (
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editConvTitle}
                        onChange={(e) => setEditConvTitle(e.target.value)}
                        onBlur={() => {
                          if (onRenameConversation && editConvTitle.trim()) {
                            onRenameConversation(conv.id, editConvTitle.trim());
                          }
                          setEditingConvId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (onRenameConversation && editConvTitle.trim()) {
                              onRenameConversation(conv.id, editConvTitle.trim());
                            }
                            setEditingConvId(null);
                          } else if (e.key === 'Escape') {
                            setEditingConvId(null);
                          }
                        }}
                        autoFocus
                        className="flex-1 bg-zinc-950 border border-purple-500 text-xs px-2 py-1 rounded-lg text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (onRenameConversation && editConvTitle.trim()) {
                            onRenameConversation(conv.id, editConvTitle.trim());
                          }
                          setEditingConvId(null);
                        }}
                        className="px-2 py-1 bg-purple-600 text-white text-[11px] rounded-lg font-bold"
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs shrink-0">💬</span>
                        <span className="text-xs font-semibold truncate text-zinc-100 group-hover:text-purple-200 transition-colors">
                          {conv.title}
                        </span>
                        {isActive && (
                          <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-mono shrink-0">
                            {lang === 'es' ? 'Activo' : 'Active'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500">
                        {formattedDate && <span>{formattedDate}</span>}
                        {formattedDate && <span>•</span>}
                        <span>
                          {messageCount} {lang === 'es' ? (messageCount === 1 ? 'mensaje' : 'mensajes') : (messageCount === 1 ? 'msg' : 'msgs')}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingConvId(conv.id);
                      setEditConvTitle(conv.title);
                    }}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white text-xs transition-colors"
                    title={lang === 'es' ? 'Renombrar' : 'Rename'}
                  >
                    ✏️
                  </button>
                  {onDeleteConversation && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="p-1.5 hover:bg-red-950/60 rounded-lg text-zinc-400 hover:text-red-400 text-xs transition-colors"
                      title={lang === 'es' ? 'Eliminar' : 'Delete'}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredConversations.length === 0 && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3 text-zinc-500">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-zinc-300 mb-1">
                {searchConv
                  ? (lang === 'es' ? 'No se encontraron conversaciones' : 'No conversations found')
                  : (lang === 'es' ? 'No hay conversaciones previas' : 'No previous conversations')}
              </p>
              <p className="text-[11px] text-zinc-500 max-w-[200px]">
                {searchConv
                  ? (lang === 'es' ? 'Prueba con otro término de búsqueda.' : 'Try a different search term.')
                  : (lang === 'es' ? 'Tus chats anteriores aparecerán aquí para fácil acceso.' : 'Your previous chats will appear here for easy access.')}
              </p>
              {onNewConversation && !searchConv && (
                <button
                  type="button"
                  onClick={() => {
                    onNewConversation();
                    setShowHistoryView(false);
                  }}
                  className="mt-4 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md shadow-purple-600/20"
                >
                  {lang === 'es' ? '+ Iniciar conversación' : '+ Start conversation'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Componentes personalizados de Markdown para el chat de AutoProd ──
  const markdownComponents = {
    img: ({ src, alt, ...props }: any) => {
      if (!src) return null;
      return (
        <div className="my-3 rounded-xl overflow-hidden border border-zinc-700/60 bg-zinc-950/80 shadow-2xl group relative max-w-lg">
          <img
            src={src}
            alt={alt || 'Imagen generada por AutoProd'}
            className="w-full max-h-[360px] object-contain mx-auto transition-transform duration-300 group-hover:scale-[1.01]"
            loading="lazy"
            {...props}
          />
          <div className="p-2.5 bg-zinc-900/90 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium truncate max-w-[70%] flex items-center gap-1.5">
              <span>🎨</span> {alt || 'Miniatura / Arte AutoProd'}
            </span>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Ver HD</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      );
    },
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-([a-zA-Z0-9_-]+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      const langType = match ? match[1].toLowerCase().replace(/-/g, '_') : '';

      const isInteractiveBlock = 
        langType === 'interactive_question' || 
        langType === 'interactive_card' || 
        langType === 'interactive_form' ||
        langType === 'questionnaire' ||
        langType === 'ask_question' ||
        langType === 'question' ||
        langType === 'form' ||
        (langType === 'json' && (codeString.includes('"question"') || codeString.includes('"questions"')));

      if (!inline && isInteractiveBlock) {
        return (
          <div className="my-3">
            <InteractiveQuestionCard
              dataJson={codeString}
              onSelect={(selectedText) => onSend(selectedText)}
              disabled={isGenerating}
            />
          </div>
        );
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col relative h-full bg-[#0d0d10]">
      {/* ── Copilot Header Bar ── */}
      <div className="h-12 border-b border-zinc-800 bg-[#0f0f12] px-3.5 flex items-center justify-between shrink-0 gap-2 relative z-30">
        {/* Título de la conversación activa */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm shrink-0">💬</span>
          <span className="text-xs font-semibold text-zinc-200 truncate" title={activeConversation?.title || (lang === 'es' ? 'Nueva conversación' : 'New conversation')}>
            {activeConversation?.title || (lang === 'es' ? 'Nueva conversación' : 'New conversation')}
          </span>
        </div>

        {/* Acciones: Reloj (Historial), Nueva y Cerrar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Botón Reloj para cambiar a la vista de historial de conversaciones */}
          <button
            type="button"
            onClick={() => setShowHistoryView(true)}
            className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-purple-500/50 text-zinc-400 hover:text-purple-300 flex items-center justify-center transition-all cursor-pointer shadow-sm group"
            title={lang === 'es' ? 'Historial de conversaciones' : 'Conversation history'}
          >
            <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Botón + Nueva */}
          {onNewConversation && (
            <button
              type="button"
              onClick={onNewConversation}
              className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-sm shadow-purple-500/20 active:scale-95"
              title={lang === 'es' ? 'Iniciar nueva conversación' : 'Start new conversation'}
            >
              <span>+</span>
              <span className="hidden sm:inline">{lang === 'es' ? 'Nueva' : 'New'}</span>
            </button>
          )}

          {/* Botón Colapsar Copilot */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer shrink-0"
              title={lang === 'es' ? 'Ocultar panel del agente' : 'Collapse agent panel'}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages log */}
      <div
        className="flex-1 overflow-y-auto minimal-scrollbar p-4 space-y-4"
        ref={chatContainerRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-4 my-auto h-full select-none">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center mb-2.5 shadow-lg shadow-purple-500/10">
              <span className="text-xl">✨</span>
            </div>
            <h3 className="text-xs font-bold text-white mb-1">
              {lang === 'es' ? 'Copilot Agéntico de AutoProd' : 'AutoProd Agentic Copilot'}
            </h3>
            <p className="text-[11px] text-zinc-400 max-w-[260px] leading-relaxed mb-4">
              {lang === 'es'
                ? 'Tu cerebro central para organizar canales, redactar guiones, analizar métricas y coordinar tools sin salir de tu pantalla activa.'
                : 'Your central brain to organize channels, write scripts, inspect metrics and run tools seamlessly.'}
            </p>

            <div className="flex flex-col gap-1.5 w-full max-w-[260px]">
              <button
                type="button"
                onClick={() => handleInsertTemplate('channel')}
                className="w-full text-left p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-purple-500/50 text-[11px] text-zinc-300 transition-all flex items-center gap-2 group cursor-pointer"
              >
                <span className="text-sm">🏗️</span>
                <span className="font-medium group-hover:text-purple-300 transition-colors">
                  {lang === 'es' ? 'Crear y configurar canal' : 'Create & setup channel'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleInsertTemplate('video')}
                className="w-full text-left p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-blue-500/50 text-[11px] text-zinc-300 transition-all flex items-center gap-2 group cursor-pointer"
              >
                <span className="text-sm">🎬</span>
                <span className="font-medium group-hover:text-blue-300 transition-colors">
                  {lang === 'es' ? 'Planificar nuevo video' : 'Plan a new video'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleInsertTemplate('script')}
                className="w-full text-left p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-indigo-500/50 text-[11px] text-zinc-300 transition-all flex items-center gap-2 group cursor-pointer"
              >
                <span className="text-sm">✍️</span>
                <span className="font-medium group-hover:text-indigo-300 transition-colors">
                  {lang === 'es' ? 'Redactar guion con ganchos' : 'Write script with hooks'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-3 max-w-3xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
          >
            <div className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs ${msg.sender === 'user'
              ? 'bg-purple-600 text-white'
              : 'bg-zinc-800 text-purple-400 border border-zinc-700'
              }`}>
              {msg.sender === 'user' ? 'U' : 'G'}
            </div>
            <div className={`rounded-xl p-4 text-sm leading-relaxed ${msg.sender === 'user'
              ? 'bg-purple-600/10 border border-purple-500/20 text-purple-100'
              : 'bg-[#18181b] border border-zinc-800 text-zinc-300'
              }`}>
              {msg.text.includes('🛑 Proceso cancelado por el usuario.') ? (
                <>
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed break-words">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {msg.text.replace('🛑 Proceso cancelado por el usuario.', '').trim()}
                    </ReactMarkdown>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm font-medium text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2 w-fit">
                    <span className="text-base">🛑</span> {lang === 'es' ? 'Proceso cancelado por el usuario.' : 'Process canceled by user.'}
                  </div>
                </>
              ) : (
                <div className="prose prose-invert max-w-none text-sm leading-relaxed break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              )}
              <div className="flex justify-between items-center mt-2 gap-4">
                <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-2 flex-wrap">
                  {msg.isQueued && <span className="text-amber-500 font-bold animate-pulse">⏳ {lang === 'es' ? 'En espera...' : 'Queued...'}</span>}
                  {msg.isDeepThinking && (
                    <span className="text-purple-300 bg-purple-950/70 border border-purple-800/50 rounded px-1.5 py-0.5 font-sans font-semibold flex items-center gap-1">
                      🧠 {lang === 'es' ? 'Pensamiento Profundo' : 'Deep Thinking'}
                    </span>
                  )}
                  <span className="text-zinc-400 font-medium flex items-center gap-1">
                    ✨ AutoProd
                  </span>
                  {msg.isGenerating && <span className="text-emerald-400 font-bold">⏳ {(elapsedMs / 1000).toFixed(1)}s</span>}
                  {!msg.isGenerating && msg.generationTimeMs && <span>⏱️ {(msg.generationTimeMs / 1000).toFixed(2)}s</span>}
                </span>
                <span className="text-[10px] text-zinc-500 text-right shrink-0">{msg.timestamp}</span>
              </div>
            </div>
          </div>
        ))
      )}
      </div>

      {/* Scroll to bottom button */}
      {hasNewMessage && isScrolledUp && (
        <div className="absolute bottom-[100px] left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={scrollToBottom}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce border border-purple-400/30"
          >
            ↓ {lang === 'es' ? 'Nuevo mensaje' : 'New message'}
          </button>
        </div>
      )}

      {/* Bottom input panel */}
      <div className="p-3 sm:p-4 border-t border-zinc-800 bg-[#0f0f12] flex flex-col gap-2.5">
        {/* Input bar */}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            rows={Math.min(6, Math.max(2, inputPrompt.split('\n').length))}
            placeholder={lang === 'es' ? 'Escribe tu mensaje... (Shift+Enter para salto de línea, Enter para enviar)' : 'Type a message... (Shift+Enter for newline, Enter to send)'}
            value={inputPrompt}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            className="flex-1 bg-[#18181b] border border-zinc-800 rounded-lg px-4 py-2.5 text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none font-sans leading-relaxed minimal-scrollbar max-h-48"
          />
          <button
            onClick={() => onSend()}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 shrink-0 h-[42px]"
          >
            {t.sendBtn}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          {isGenerating && (
            <button
              onClick={onCancel}
              className="bg-red-900/40 hover:bg-red-800/50 text-red-400 border border-red-500/30 font-bold text-sm px-4 rounded-lg transition-colors flex items-center gap-2 shrink-0 h-[42px]"
              title={lang === 'es' ? 'Cancelar generación' : 'Cancel generation'}
            >
              🛑
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
