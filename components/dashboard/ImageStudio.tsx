'use client';

import React, { useState } from 'react';
import { Language } from '@/app/translations';
import { toast } from 'sonner';

interface ChannelOption {
  id: string;
  name: string;
}

interface Props {
  lang: Language;
  channels: ChannelOption[];
  workspacePath: string | null;
  onBackToDashboard?: () => void;
  onOpenAssets?: () => void;
}

interface QuestionItem {
  id: string;
  question: string;
  options?: string[];
}

interface AnalysisResult {
  summary?: string;
  style?: string;
  lighting?: string;
  palette?: string;
  composition?: string;
  suggestedQuestions?: QuestionItem[];
  draftPrompt?: string;
}

const IDEA_INSPIRATIONS = [
  { label: 'Misterio Abisal', idea: 'Una expedición submarina descubriendo una estructura alienígena brillante en el fondo de la Fosa de las Marianas' },
  { label: 'Finanzas & Alerta', idea: 'Un operador de bolsa frente a pantallas rojas gigantes mientras una ola de criptomonedas doradas colapsa' },
  { label: 'Tecnología & IA', idea: 'Un androide cibernético translúcido ensamblando un procesador cuántico flotante con chispas azules' },
  { label: 'Historia Épica', idea: 'Un legionario romano solitario observando una fortaleza en llamas bajo una tormenta eléctrica' },
  { label: 'Lo-Fi Chill', idea: 'Una habitación estética con vista a Tokio lluvioso de noche, luces de neón suaves y una taza de café humeante' },
];

export default function ImageStudio({
  lang,
  channels,
  workspacePath,
  onBackToDashboard,
  onOpenAssets,
}: Props) {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(channels[0]?.id || '');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [customFileName, setCustomFileName] = useState('');

  // 1. Creative Idea & Visual Reference
  const [userIdea, setUserIdea] = useState('');
  const [refImageBase64, setRefImageBase64] = useState<string | null>(null);

  // 2. Co-Pilot / GPT Art Director States
  const [analyzing, setAnalyzing] = useState(false);
  const [refiningPrompt, setRefiningPrompt] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // 3. Final Master Prompt & Rendering States
  const [finalPrompt, setFinalPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<any | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);

  // Handle image upload from file picker or drop
  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(lang === 'es' ? 'Por favor sube un archivo de imagen válido (.png, .jpg, .webp)' : 'Please upload a valid image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRefImageBase64(reader.result as string);
      toast.success(lang === 'es' ? 'Imagen de referencia cargada como ancla visual' : 'Reference image loaded as visual anchor');
    };
    reader.readAsDataURL(file);
  };

  // Handle Ctrl+V paste anywhere
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleImageUpload(file);
          break;
        }
      }
    }
  };

  // Co-Pilot Consultation: calls /api/images/analyze
  const handleConsultCoPilot = async (customAnswers?: Record<string, string>) => {
    const idea = userIdea.trim();
    if (!idea && !refImageBase64) {
      toast.error(
        lang === 'es'
          ? 'Por favor escribe la idea de tu video o sube una imagen de referencia'
          : 'Please describe your video idea or upload a reference image'
      );
      return;
    }

    const isRefining = Boolean(customAnswers && Object.keys(customAnswers).length > 0);
    if (isRefining) {
      setRefiningPrompt(true);
    } else {
      setAnalyzing(true);
    }

    const toastId = toast.loading(
      isRefining
        ? (lang === 'es' ? 'El Co-Pilot está afinando el prompt con tus respuestas...' : 'Co-Pilot is refining the prompt with your answers...')
        : (lang === 'es' ? 'El Asistente GPT está analizando la visión estética...' : 'AI Co-Pilot is analyzing your visual vision...')
    );

    try {
      const selectedChannel = channels.find(c => c.id === selectedChannelId);
      const res = await fetch('/api/images/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIdea: idea || undefined,
          imageBase64: refImageBase64 || undefined,
          channelName: selectedChannel?.name || undefined,
          answers: customAnswers || answers,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al consultar con el asistente');

      if (typeof data.newBalance === 'number') {
        window.dispatchEvent(new CustomEvent('autoprod:wallet-updated', { detail: { balance: data.newBalance } }));
      }

      setAnalysisResult(data.analysis);
      if (data.analysis?.draftPrompt) {
        setFinalPrompt(data.analysis.draftPrompt);
      }

      toast.success(
        isRefining
          ? (lang === 'es' ? '¡Prompt maestro actualizado y optimizado!' : 'Master prompt updated and optimized!')
          : (lang === 'es' ? '¡Diagnóstico estético formulado por el Co-Pilot!' : 'Art direction formulated by Co-Pilot!'),
        { id: toastId }
      );
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setAnalyzing(false);
      setRefiningPrompt(false);
    }
  };

  // Quick answer selection for dynamic questions
  const handleSelectOption = (questionId: string, optionValue: string) => {
    const updated = { ...answers, [questionId]: optionValue };
    setAnswers(updated);
  };

  // Generate image with DALL-E 3
  const handleGenerate = async () => {
    const promptToUse = finalPrompt.trim() || userIdea.trim();
    if (!promptToUse) {
      toast.error(lang === 'es' ? 'Se requiere un prompt maestro para renderizar' : 'A master prompt is required to render');
      return;
    }

    setGenerating(true);
    setGeneratedAsset(null);
    const toastId = toast.loading(
      lang === 'es'
        ? 'Renderizando imagen HD con DALL-E 3 y guardando en disco...'
        : 'Rendering HD image with DALL-E 3 and saving locally...'
    );

    try {
      const selectedChannel = channels.find(c => c.id === selectedChannelId);
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToUse,
          aspectRatio,
          channelId: selectedChannelId || undefined,
          channelName: selectedChannel?.name || undefined,
          customFileName: customFileName.trim() || undefined,
          type: aspectRatio === '16:9' ? 'THUMBNAIL' : 'IMAGE',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar la imagen');

      if (typeof data.newBalance === 'number') {
        window.dispatchEvent(new CustomEvent('autoprod:wallet-updated', { detail: { balance: data.newBalance } }));
      }

      setGeneratedAsset(data.asset);
      toast.success(
        lang === 'es' ? '¡Imagen generada y guardada dualmente con éxito!' : 'Image generated and dual saved successfully!',
        { id: toastId }
      );
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyText = (text: string, successMsg: string) => {
    navigator.clipboard.writeText(text);
    toast.success(successMsg);
  };

  return (
    <div className="h-full flex flex-col bg-[#111114] text-zinc-200 overflow-hidden select-none" onPaste={handlePaste}>
      
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-zinc-800 bg-[#16161b]/95 backdrop-blur shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm"
              title={lang === 'es' ? 'Volver al Inicio' : 'Back to Home'}
            >
              ←
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎨</span>
              <h1 className="text-base font-bold text-white tracking-wide">
                {lang === 'es' ? 'Estudio Creativo de Imágenes & Miniaturas' : 'AI Image & Thumbnail Studio'}
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Co-Pilot GPT + DALL-E 3
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {lang === 'es'
                ? 'Plasma la visión de tu video con orientación artística dinámica, referencias visuales y generación HD con guardado dual.'
                : 'Bring your video vision to life with dynamic art direction, visual references, and dual-saved HD renders.'}
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-3">
          {onOpenAssets && (
            <button
              onClick={onOpenAssets}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 hover:text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <span>🗃️</span>
              <span>{lang === 'es' ? 'Biblioteca de Recursos' : 'Asset Library'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── CONFIGURATION TOOLBAR ────────────────────────────────────────────── */}
      <div className="px-6 py-2.5 border-b border-zinc-800/80 bg-[#141418] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 flex-wrap text-xs">
          {/* Channel Picker */}
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-1.5 shadow-inner">
            <span className="text-zinc-400">📺 {lang === 'es' ? 'Canal:' : 'Channel:'}</span>
            <select
              value={selectedChannelId}
              onChange={e => setSelectedChannelId(e.target.value)}
              className="bg-transparent text-white font-medium text-xs focus:outline-none cursor-pointer"
            >
              {channels.map(ch => (
                <option key={ch.id} value={ch.id} className="bg-zinc-900 text-white">
                  {ch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Aspect Ratio Selector */}
          <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 rounded-xl p-1 shadow-inner">
            {[
              { id: '16:9', label: '16:9 Miniatura', desc: '1792×1024' },
              { id: '9:16', label: '9:16 Shorts/Reels', desc: '1024×1792' },
              { id: '1:1', label: '1:1 Cuadrado', desc: '1024×1024' },
            ].map(aspect => (
              <button
                key={aspect.id}
                onClick={() => setAspectRatio(aspect.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                  aspectRatio === aspect.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>{aspect.label}</span>
                <span className="text-[10px] opacity-70 font-mono">({aspect.desc})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{lang === 'es' ? 'Pega cualquier imagen con Ctrl+V' : 'Paste any image with Ctrl+V'}</span>
        </div>
      </div>

      {/* ── MAIN CREATIVE WORKSPACE ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto minimal-scrollbar p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6">

          {/* ── LEFT COLUMN (7 COLS): CREATIVE INPUT & CO-PILOT FLOW ──────────── */}
          <div className="xl:col-span-7 space-y-6">

            {/* STEP 1: Vision & Concept + Visual Reference */}
            <div className="bg-[#17171c] border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-bold border border-purple-500/30">
                    1
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    {lang === 'es' ? 'Tu Idea, Temática o Enfoque del Video' : 'Your Video Idea & Concept'}
                  </h3>
                </div>
                <span className="text-[11px] text-zinc-400">
                  {lang === 'es' ? 'Describe qué quieres transmitir' : 'Describe your vision'}
                </span>
              </div>

              {/* Idea Textarea */}
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={userIdea}
                  onChange={e => setUserIdea(e.target.value)}
                  placeholder={
                    lang === 'es'
                      ? 'Ej: Miniatura para un video sobre los misterios de la Fosa de las Marianas. Quiero una atmósfera aterradora y misteriosa, con un submarino iluminando una criatura colosal oculta en la oscuridad...'
                      : 'E.g.: Thumbnail for a documentary on the Mariana Trench mysteries. Ominous, awe-inspiring atmosphere with a research sub shining lights on a colossal creature...'
                  }
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 leading-relaxed shadow-inner"
                />

                {/* Quick Inspiration Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mr-1">
                    {lang === 'es' ? 'Inspiración rápida:' : 'Quick ideas:'}
                  </span>
                  {IDEA_INSPIRATIONS.map(insp => (
                    <button
                      key={insp.label}
                      onClick={() => setUserIdea(insp.idea)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {insp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Reference Anchor (Optional) */}
              <div className="pt-2 border-t border-zinc-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <span>🖼️</span>
                    <span>{lang === 'es' ? 'Imagen de Referencia Estética (Opcional)' : 'Visual Reference (Optional)'}</span>
                  </label>
                  <span className="text-[10px] text-zinc-500">
                    {lang === 'es' ? 'Arrastra, busca o presiona Ctrl+V' : 'Drag, browse or Ctrl+V'}
                  </span>
                </div>

                {!refImageBase64 ? (
                  <label className="border border-dashed border-zinc-700/80 hover:border-purple-500/70 rounded-xl p-4 flex items-center justify-center gap-3 cursor-pointer bg-zinc-950/40 hover:bg-zinc-900/60 transition-all text-center group">
                    <span className="text-2xl group-hover:scale-110 transition-transform">📸</span>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-zinc-300">
                        {lang === 'es' ? 'Sube o pega una miniatura o arte que te inspire' : 'Upload or paste an inspiring thumbnail'}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {lang === 'es'
                          ? 'La IA extraerá su paleta, luz y composición para adaptarla a tu tema'
                          : 'AI will extract lighting, palette & composition to match your topic'}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                    />
                  </label>
                ) : (
                  <div className="relative rounded-xl border border-zinc-800 bg-black/60 p-2 flex items-center gap-4">
                    <img
                      src={refImageBase64}
                      alt="Referencia"
                      className="w-24 h-16 object-cover rounded-lg border border-zinc-700 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-purple-300 flex items-center gap-1">
                        <span>✨</span> {lang === 'es' ? 'Referencia Visual Conectada' : 'Visual Reference Connected'}
                      </p>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {lang === 'es'
                          ? 'El Co-Pilot usará esta estética como guía para tu video'
                          : 'Co-Pilot will merge this aesthetic with your topic'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setRefImageBase64(null);
                        setAnalysisResult(null);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-950/80 hover:text-red-300 border border-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    >
                      {lang === 'es' ? 'Quitar' : 'Remove'}
                    </button>
                  </div>
                )}
              </div>

              {/* Consultation Button */}
              <button
                onClick={() => handleConsultCoPilot()}
                disabled={analyzing || (!userIdea.trim() && !refImageBase64)}
                className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{analyzing ? '⏳' : '✨'}</span>
                <span>
                  {analyzing
                    ? (lang === 'es' ? 'El Co-Pilot está diseñando la propuesta...' : 'Co-Pilot is structuring your vision...')
                    : (lang === 'es' ? 'Consultar con el Asistente IA (Co-Pilot Director de Arte)' : 'Consult AI Art Director Co-Pilot')}
                </span>
              </button>
            </div>

            {/* STEP 2: Co-Pilot Artistic Diagnosis & Interactive Alignment Questions */}
            {analysisResult && (
              <div className="bg-[#17171c] border border-indigo-900/40 rounded-2xl p-5 space-y-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold border border-indigo-500/30">
                      2
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      {lang === 'es' ? 'Diagnóstico Estético & Preguntas del Co-Pilot' : 'Co-Pilot Art Direction & Alignment'}
                    </h3>
                  </div>
                  <span className="text-[10px] text-indigo-400 font-mono font-semibold">
                    GPT-4o-mini Art Director
                  </span>
                </div>

                {/* Summary & Aesthetic Badges */}
                <div className="bg-indigo-950/20 border border-indigo-800/30 rounded-xl p-3.5 space-y-3 text-xs">
                  <p className="text-zinc-200 text-xs leading-relaxed font-medium">
                    {analysisResult.summary}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] pt-2 border-t border-indigo-800/20">
                    <div className="bg-black/30 p-2 rounded-lg border border-indigo-900/30">
                      <span className="text-indigo-400 font-bold block uppercase tracking-wider">Estilo</span>
                      <span className="text-zinc-300 font-medium truncate block">{analysisResult.style || 'Cinematográfico'}</span>
                    </div>
                    <div className="bg-black/30 p-2 rounded-lg border border-indigo-900/30">
                      <span className="text-indigo-400 font-bold block uppercase tracking-wider">Iluminación</span>
                      <span className="text-zinc-300 font-medium truncate block">{analysisResult.lighting || 'Dramática'}</span>
                    </div>
                    <div className="bg-black/30 p-2 rounded-lg border border-indigo-900/30">
                      <span className="text-indigo-400 font-bold block uppercase tracking-wider">Composición</span>
                      <span className="text-zinc-300 font-medium truncate block">{analysisResult.composition || 'Regla de Tercios'}</span>
                    </div>
                    <div className="bg-black/30 p-2 rounded-lg border border-indigo-900/30">
                      <span className="text-indigo-400 font-bold block uppercase tracking-wider">Paleta</span>
                      <span className="text-zinc-300 font-medium truncate block">{analysisResult.palette || 'Alto Contraste'}</span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Questions Generated by GPT */}
                {analysisResult.suggestedQuestions && analysisResult.suggestedQuestions.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                        <span>🎯</span>
                        <span>{lang === 'es' ? 'Preguntas del Asistente para Afinar tu Imagen' : 'Alignment Questions to Perfect the Result'}</span>
                      </h4>
                      <span className="text-[10px] text-zinc-500">
                        {lang === 'es' ? 'Elige una opción rápida o escribe tu respuesta' : 'Click a quick option or write custom'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {analysisResult.suggestedQuestions.map((qItem, idx) => {
                        const currentVal = answers[qItem.id || `q${idx + 1}`] || '';
                        return (
                          <div key={qItem.id || idx} className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3 space-y-2">
                            <label className="text-xs font-semibold text-zinc-200 block">
                              {idx + 1}. {qItem.question}
                            </label>

                            {/* Quick 1-click option pills */}
                            {qItem.options && qItem.options.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {qItem.options.map((opt, optIdx) => {
                                  const isSelected = currentVal === opt;
                                  return (
                                    <button
                                      key={optIdx}
                                      onClick={() => handleSelectOption(qItem.id || `q${idx + 1}`, opt)}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Custom text answer */}
                            <input
                              type="text"
                              value={currentVal}
                              onChange={e => handleSelectOption(qItem.id || `q${idx + 1}`, e.target.value)}
                              placeholder={lang === 'es' ? 'O escribe tu respuesta específica aquí...' : 'Or type your specific response here...'}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-sans"
                            />
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => handleConsultCoPilot(answers)}
                      disabled={refiningPrompt}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-900/20"
                    >
                      <span>{refiningPrompt ? '⏳' : '🪄'}</span>
                      <span>
                        {refiningPrompt
                          ? (lang === 'es' ? 'Sintetizando respuestas con GPT...' : 'Synthesizing answers with GPT...')
                          : (lang === 'es' ? 'Aplicar Respuestas y Refinar Prompt Maestro' : 'Apply Answers & Refine Master Prompt')}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Master Prompt & Render Trigger */}
            <div className="bg-[#17171c] border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                    3
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    {lang === 'es' ? 'Prompt Maestro para DALL-E 3' : 'Master Prompt for DALL-E 3'}
                  </h3>
                </div>
                {finalPrompt && (
                  <button
                    onClick={() => handleCopyText(finalPrompt, lang === 'es' ? 'Prompt copiado al portapapeles' : 'Prompt copied')}
                    className="text-[11px] text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    📋 {lang === 'es' ? 'Copiar' : 'Copy'}
                  </button>
                )}
              </div>

              {/* Master Prompt Textarea */}
              <div className="space-y-1.5">
                <textarea
                  rows={4}
                  value={finalPrompt}
                  onChange={e => setFinalPrompt(e.target.value)}
                  placeholder={
                    lang === 'es'
                      ? 'El prompt maestro generado por el Co-Pilot aparecerá aquí. También puedes escribir o editarlo libremente en inglés...'
                      : 'Master prompt created by Co-Pilot will appear here. You can also edit it freely...'
                  }
                  className="w-full bg-zinc-950/90 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed shadow-inner"
                />
              </div>

              {/* Optional Custom Filename */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-medium block">
                  {lang === 'es' ? 'Nombre de archivo en disco (opcional):' : 'Custom file name (optional):'}
                </label>
                <input
                  type="text"
                  value={customFileName}
                  onChange={e => setCustomFileName(e.target.value)}
                  placeholder="ej. miniatura_fosa_marianas_01"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Final Render Button */}
              <button
                onClick={handleGenerate}
                disabled={generating || (!finalPrompt.trim() && !userIdea.trim())}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:opacity-95 text-white font-bold text-sm rounded-xl shadow-xl shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{generating ? '⏳' : '🚀'}</span>
                <span>
                  {generating
                    ? (lang === 'es' ? 'Renderizando con DALL-E 3 & Guardando Dualmente...' : 'Rendering with DALL-E 3 & Dual Saving...')
                    : (lang === 'es' ? 'Renderizar Imagen HD y Guardar en Disco' : 'Render HD Image & Save to Disk')}
                </span>
              </button>
            </div>

          </div>

          {/* ── RIGHT COLUMN (5 COLS): STAGE & DUAL STORAGE RESULT ────────────── */}
          <div className="xl:col-span-5 space-y-6">

            <div className="bg-[#17171c] border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl sticky top-6">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🖼️</span>
                  <span>{lang === 'es' ? 'Escenario de Renderizado' : 'Rendering Stage'}</span>
                </h3>
                {generatedAsset && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                    💾 {lang === 'es' ? 'Guardado Dual Listo' : 'Dual Saved'}
                  </span>
                )}
              </div>

              {/* Rendering or Empty State */}
              {!generatedAsset ? (
                <div className="h-96 bg-zinc-950/60 border border-dashed border-zinc-800/80 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-3xl shadow-inner">
                    {generating ? '⚙️' : '🎨'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300">
                      {generating
                        ? (lang === 'es' ? 'Procesando en DALL-E 3...' : 'Processing in DALL-E 3...')
                        : (lang === 'es' ? 'Tu imagen final aparecerá aquí' : 'Your final image will appear here')}
                    </h4>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-xs leading-relaxed">
                      {generating
                        ? (lang === 'es' ? 'Generando resolución de estudio y escribiendo físicamente en la carpeta del canal...' : 'Generating studio resolution and writing directly to channel disk...')
                        : (lang === 'es' ? 'Diseña tu idea a la izquierda y pulsa Renderizar. El archivo se guardará automáticamente en tu disco local y en la nube.' : 'Design your idea on the left and render. Image will be saved to your local disk and cloud.')}
                    </p>
                  </div>
                </div>
              ) : (
                /* Generated Image Showcase */
                <div className="space-y-4 animate-in zoom-in-95 duration-300">
                  <div
                    onClick={() => setShowFullPreview(true)}
                    className="relative rounded-2xl overflow-hidden border border-purple-500/40 bg-black shadow-2xl flex items-center justify-center max-h-80 cursor-zoom-in group"
                  >
                    <img
                      src={generatedAsset.storageUrl || `http://127.0.0.1:8000/workspace/file?path=${encodeURIComponent(generatedAsset.localPath || '')}`}
                      alt={generatedAsset.name}
                      className="w-full max-h-80 object-contain group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                      <span>🔍</span> {lang === 'es' ? 'Clic para ampliar' : 'Click to zoom'}
                    </div>
                  </div>

                  {/* Dual Persistence Breakdown */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 space-y-2.5 text-xs font-mono">
                    <div className="flex items-center justify-between text-purple-300 font-bold border-b border-zinc-800 pb-1.5">
                      <span className="truncate">{generatedAsset.name}</span>
                      <span className="shrink-0">{aspectRatio} • {generatedAsset.format.toUpperCase()}</span>
                    </div>

                    {/* Local Disk Path (Premiere / CapCut) */}
                    {generatedAsset.localPath && (
                      <div className="space-y-1">
                        <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1 font-sans">
                          <span>💻</span> {lang === 'es' ? 'RUTA FÍSICA LOCAL (CapCut / Premiere):' : 'LOCAL DISK PATH:'}
                        </span>
                        <div className="flex items-center justify-between gap-2 bg-black/60 p-2 rounded-lg border border-zinc-800 text-[10px] text-zinc-300">
                          <span className="truncate">{generatedAsset.localPath}</span>
                          <button
                            onClick={() => handleCopyText(generatedAsset.localPath, lang === 'es' ? 'Ruta local copiada' : 'Local path copied')}
                            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white shrink-0 cursor-pointer font-sans text-[10px]"
                          >
                            {lang === 'es' ? 'Copiar' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Supabase Storage Cloud Link */}
                    {generatedAsset.storageUrl && (
                      <div className="space-y-1">
                        <span className="text-purple-400 font-bold text-[10px] flex items-center gap-1 font-sans">
                          <span>☁️</span> {lang === 'es' ? 'RESPALDO EN LA NUBE (Supabase):' : 'CLOUD BACKUP (Supabase):'}
                        </span>
                        <div className="flex items-center justify-between gap-2 bg-black/60 p-2 rounded-lg border border-zinc-800 text-[10px] text-zinc-300">
                          <span className="truncate">{generatedAsset.storageUrl}</span>
                          <a
                            href={generatedAsset.storageUrl}
                            target="_blank"
                            rel="noreferrer"
                            download={generatedAsset.name}
                            className="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white shrink-0 cursor-pointer font-sans text-[10px]"
                          >
                            {lang === 'es' ? 'Descargar' : 'Download'}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Open in Asset Library */}
                  {onOpenAssets && (
                    <button
                      onClick={onOpenAssets}
                      className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <span>🗃️</span>
                      <span>{lang === 'es' ? 'Administrar en la Biblioteca de Recursos' : 'Manage in Asset Library'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* ── FULL RESOLUTION PREVIEW MODAL ────────────────────────────────────── */}
      {showFullPreview && generatedAsset && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in"
          onClick={() => setShowFullPreview(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setShowFullPreview(false)}
              className="absolute -top-10 right-0 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold cursor-pointer"
            >
              ✕ {lang === 'es' ? 'Cerrar' : 'Close'}
            </button>
            <img
              src={generatedAsset.storageUrl || `http://127.0.0.1:8000/workspace/file?path=${encodeURIComponent(generatedAsset.localPath || '')}`}
              alt={generatedAsset.name}
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain border border-zinc-800"
            />
          </div>
        </div>
      )}

    </div>
  );
}
