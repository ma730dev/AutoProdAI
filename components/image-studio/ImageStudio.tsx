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

export default function ImageStudio({
  lang,
  channels,
  workspacePath,
  onBackToDashboard,
  onOpenAssets,
}: Props) {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(channels[0]?.id || '');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [prompt, setPrompt] = useState('');
  const [refImageBase64, setRefImageBase64] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState('');

  // AI Prompt Enhancement States
  const [enhancing, setEnhancing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Generation States
  const [generating, setGenerating] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<any | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);

  // Handle image upload from file picker or drop
  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(
        lang === 'es'
          ? 'Por favor sube un archivo de imagen válido (.png, .jpg, .webp)'
          : 'Please upload a valid image file (.png, .jpg, .webp)'
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRefImageBase64(reader.result as string);
      toast.success(
        lang === 'es'
          ? 'Imagen de referencia cargada'
          : 'Reference image loaded'
      );
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

  // AI Prompt Enhancement
  const handleEnhancePrompt = async (customAnswers?: Record<string, string>) => {
    const currentText = prompt.trim();
    if (!currentText && !refImageBase64) {
      toast.error(
        lang === 'es'
          ? 'Escribe una idea o sube una imagen de referencia antes de mejorar'
          : 'Enter an idea or upload a reference image before enhancing'
      );
      return;
    }

    setEnhancing(true);
    const toastId = toast.loading(
      lang === 'es' ? 'Optimizando composición y detalles visuales...' : 'Enhancing composition and visual details...'
    );

    try {
      const selectedChannel = channels.find(c => c.id === selectedChannelId);
      const res = await fetch('/api/images/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIdea: currentText || undefined,
          imageBase64: refImageBase64 || undefined,
          channelName: selectedChannel?.name || undefined,
          answers: customAnswers || answers,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al analizar la imagen');

      if (typeof data.newBalance === 'number') {
        window.dispatchEvent(new CustomEvent('autoprod:wallet-updated', { detail: { balance: data.newBalance } }));
      }

      setAnalysisResult(data.analysis);
      if (data.analysis?.draftPrompt) {
        setPrompt(data.analysis.draftPrompt);
      }

      toast.success(
        lang === 'es' ? 'Descripción enriquecida con éxito' : 'Description enhanced successfully',
        { id: toastId }
      );
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setEnhancing(false);
    }
  };

  // Option pill selection for AI questions
  const handleSelectOption = (questionId: string, optionValue: string) => {
    const updated = { ...answers, [questionId]: optionValue };
    setAnswers(updated);
  };

  // Generate Image
  const handleGenerate = async () => {
    const promptToUse = prompt.trim();
    if (!promptToUse) {
      toast.error(
        lang === 'es'
          ? 'Por favor escribe una descripción para la imagen'
          : 'Please enter a description for the image'
      );
      return;
    }

    setGenerating(true);
    setGeneratedAsset(null);
    const toastId = toast.loading(
      lang === 'es'
        ? 'Generando imagen en alta resolución...'
        : 'Generating high-resolution image...'
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
          type: 'IMAGE',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar la imagen');

      if (typeof data.newBalance === 'number') {
        window.dispatchEvent(new CustomEvent('autoprod:wallet-updated', { detail: { balance: data.newBalance } }));
      }

      setGeneratedAsset(data.asset);
      toast.success(
        lang === 'es' ? 'Imagen generada y guardada en el canal' : 'Image generated and saved to channel',
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
    <div
      className="h-full flex flex-col bg-[#0f0f12] text-zinc-200 overflow-hidden select-none"
      onPaste={handlePaste}
    >
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="px-6 py-3.5 border-b border-zinc-800/80 bg-[#141418] shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="p-2 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title={lang === 'es' ? 'Volver al Inicio' : 'Back to Home'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight">
              {lang === 'es' ? 'Imágenes' : 'Images'}
            </h1>
            <p className="text-xs text-zinc-400">
              {lang === 'es'
                ? 'Genera miniaturas y recursos visuales para tus canales y proyectos'
                : 'Create thumbnails and visual assets for your channels and projects'}
            </p>
          </div>
        </div>

        {onOpenAssets && (
          <button
            onClick={onOpenAssets}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-200 hover:text-white flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
          >
            <span>📁</span>
            <span>{lang === 'es' ? 'Biblioteca' : 'Library'}</span>
          </button>
        )}
      </header>

      {/* ── TOOLBAR / CONTROLS ──────────────────────────────────────────────── */}
      <div className="px-6 py-2.5 border-b border-zinc-800/60 bg-[#111115] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Channel Selector */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 shadow-sm text-xs">
            <span className="text-zinc-400">{lang === 'es' ? 'Canal:' : 'Channel:'}</span>
            <select
              value={selectedChannelId}
              onChange={e => setSelectedChannelId(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-1"
            >
              {channels.map(ch => (
                <option key={ch.id} value={ch.id} className="bg-zinc-900 text-white">
                  {ch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Aspect Ratio Pills */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-sm text-xs">
            {[
              { id: '16:9', label: '16:9', desc: lang === 'es' ? 'Horizontal' : 'Landscape' },
              { id: '9:16', label: '9:16', desc: lang === 'es' ? 'Vertical' : 'Portrait' },
              { id: '1:1', label: '1:1', desc: lang === 'es' ? 'Cuadrado' : 'Square' },
            ].map(aspect => (
              <button
                key={aspect.id}
                onClick={() => setAspectRatio(aspect.id as any)}
                className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
                  aspectRatio === aspect.id
                    ? 'bg-zinc-800 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="font-semibold">{aspect.label}</span>
                <span className="text-[11px] text-zinc-500 font-normal">{aspect.desc}</span>
              </button>
            ))}
          </div>

        </div>

        <div className="text-[11px] text-zinc-500 hidden sm:flex items-center gap-1.5">
          <span>💡</span>
          <span>{lang === 'es' ? 'Puedes pegar imágenes directamente con Ctrl+V' : 'You can paste reference images with Ctrl+V'}</span>
        </div>
      </div>

      {/* ── WORKSPACE (2 EQUILIBRATED COLUMNS) ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto minimal-scrollbar p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ── LEFT COLUMN (6 COLS): CREATION PANEL ────────────────────────── */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-[#16161c] border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-xl">

              {/* Prompt Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">
                    {lang === 'es' ? 'Descripción de la imagen' : 'Image description'}
                  </label>
                  {prompt && (
                    <button
                      onClick={() => setPrompt('')}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      {lang === 'es' ? 'Limpiar' : 'Clear'}
                    </button>
                  )}
                </div>

                <textarea
                  rows={4}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder={
                    lang === 'es'
                      ? 'Describe la escena, elementos principales, atmósfera y composición...'
                      : 'Describe the scene, main elements, atmosphere and composition...'
                  }
                  className="w-full bg-[#111115] border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 leading-relaxed shadow-inner resize-none transition-colors"
                />

                {/* AI Prompt Enhancer Action */}
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleEnhancePrompt()}
                    disabled={enhancing || (!prompt.trim() && !refImageBase64)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-300 hover:text-white border border-zinc-700/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>{enhancing ? '⏳' : '✨'}</span>
                    <span>
                      {enhancing
                        ? (lang === 'es' ? 'Mejorando...' : 'Enhancing...')
                        : (lang === 'es' ? 'Mejorar descripción con IA' : 'Enhance with AI')}
                    </span>
                  </button>

                  <span className="text-[11px] text-zinc-500 font-mono">
                    {prompt.length} {lang === 'es' ? 'caracteres' : 'chars'}
                  </span>
                </div>
              </div>

              {/* Dynamic AI Questions (Compact, only when available) */}
              {analysisResult?.suggestedQuestions && analysisResult.suggestedQuestions.length > 0 && (
                <div className="bg-[#121216] border border-zinc-800/80 rounded-xl p-3.5 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <span>🎯</span>
                      <span>{lang === 'es' ? 'Sugerencias para afinar la imagen' : 'Refinement suggestions'}</span>
                    </span>
                    <button
                      onClick={() => setAnalysisResult(null)}
                      className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
                      title={lang === 'es' ? 'Ocultar sugerencias' : 'Hide suggestions'}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {analysisResult.suggestedQuestions.map((qItem, idx) => {
                      const currentVal = answers[qItem.id || `q${idx + 1}`] || '';
                      return (
                        <div key={qItem.id || idx} className="space-y-1.5">
                          <p className="text-[11px] font-medium text-zinc-400">
                            {qItem.question}
                          </p>
                          {qItem.options && qItem.options.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {qItem.options.map((opt, optIdx) => {
                                const isSelected = currentVal === opt;
                                return (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    onClick={() => handleSelectOption(qItem.id || `q${idx + 1}`, opt)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-all border ${
                                      isSelected
                                        ? 'bg-zinc-700 text-white border-zinc-600 shadow-sm'
                                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleEnhancePrompt(answers)}
                    disabled={enhancing}
                    className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer transition-colors"
                  >
                    {enhancing
                      ? (lang === 'es' ? 'Aplicando...' : 'Applying...')
                      : (lang === 'es' ? 'Aplicar mejoras a la descripción' : 'Apply refinements to description')}
                  </button>
                </div>
              )}

              {/* Reference Image (Optional) */}
              <div className="pt-2 border-t border-zinc-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <span>🖼️</span>
                    <span>{lang === 'es' ? 'Imagen de referencia' : 'Reference image'}</span>
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    {lang === 'es' ? 'Opcional' : 'Optional'}
                  </span>
                </div>

                {!refImageBase64 ? (
                  <label className="border border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl p-3.5 flex items-center justify-center gap-3 cursor-pointer bg-[#121216]/60 hover:bg-[#121216] transition-colors text-center group">
                    <span className="text-xl text-zinc-500 group-hover:text-zinc-300 transition-colors">📷</span>
                    <div className="text-left">
                      <p className="text-xs font-medium text-zinc-300">
                        {lang === 'es' ? 'Selecciona o arrastra una imagen de referencia' : 'Upload or drag a reference image'}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {lang === 'es'
                          ? 'Se utilizará como guía visual para el estilo y la iluminación'
                          : 'Used as visual guide for style and lighting'}
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
                  <div className="rounded-xl border border-zinc-800 bg-[#121216] p-2.5 flex items-center gap-3">
                    <img
                      src={refImageBase64}
                      alt="Referencia"
                      className="w-16 h-12 object-cover rounded-lg border border-zinc-700 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-200">
                        {lang === 'es' ? 'Referencia vinculada' : 'Reference attached'}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {lang === 'es'
                          ? 'Guiará la estética visual de la imagen generada'
                          : 'Guides the aesthetic of the generated image'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRefImageBase64(null);
                        setAnalysisResult(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-medium transition-colors cursor-pointer shrink-0"
                    >
                      {lang === 'es' ? 'Quitar' : 'Remove'}
                    </button>
                  </div>
                )}
              </div>

              {/* Custom File Name (Discreet, Optional) */}
              <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  {lang === 'es' ? 'Nombre de archivo' : 'File name'}
                  <span className="text-[10px] text-zinc-500 font-normal ml-1">
                    ({lang === 'es' ? 'opcional' : 'optional'})
                  </span>
                </label>
                <input
                  type="text"
                  value={customFileName}
                  onChange={e => setCustomFileName(e.target.value)}
                  placeholder="ej. escena_fondo_01"
                  className="w-full bg-[#111115] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* Main Generate Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || !prompt.trim()}
                  className="w-full py-3 bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                      <span>{lang === 'es' ? 'Generando imagen...' : 'Generating image...'}</span>
                    </>
                  ) : (
                    <>
                      <span>🎨</span>
                      <span>{lang === 'es' ? 'Generar imagen' : 'Generate image'}</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>

          {/* ── RIGHT COLUMN (6 COLS): PREVIEW CANVAS ───────────────────────── */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-[#16161c] border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-xl">

              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <h2 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <span>🖼️</span>
                  <span>{lang === 'es' ? 'Vista previa' : 'Preview'}</span>
                </h2>
                <span className="text-[10px] font-mono font-medium text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-md">
                  {aspectRatio}
                </span>
              </div>

              {/* Dynamic Aspect Ratio Canvas */}
              <div className="flex items-center justify-center min-h-[360px] bg-[#111115] border border-zinc-800/80 rounded-xl p-4 overflow-hidden">
                {!generatedAsset && !generating && (
                  <div className="text-center p-6 space-y-2.5 max-w-sm">
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl mx-auto text-zinc-400">
                      🎨
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-300">
                        {lang === 'es' ? 'Tu imagen aparecerá aquí' : 'Your image will appear here'}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                        {lang === 'es'
                          ? 'Escribe tu descripción a la izquierda y pulsa Generar imagen.'
                          : 'Enter your description on the left and click Generate image.'}
                      </p>
                    </div>
                  </div>
                )}

                {generating && (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-10 h-10 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-medium text-zinc-300">
                      {lang === 'es' ? 'Creando imagen en alta resolución...' : 'Creating high-resolution image...'}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {lang === 'es'
                        ? 'Se guardará automáticamente en los recursos del canal'
                        : 'Will be saved automatically to channel resources'}
                    </p>
                  </div>
                )}

                {generatedAsset && !generating && (
                  <div
                    onClick={() => setShowFullPreview(true)}
                    className={`relative rounded-lg overflow-hidden border border-zinc-700 bg-black cursor-zoom-in group shadow-xl ${
                      aspectRatio === '16:9'
                        ? 'w-full aspect-video'
                        : aspectRatio === '9:16'
                        ? 'h-[420px] aspect-[9/16]'
                        : 'w-full max-w-[340px] aspect-square'
                    }`}
                  >
                    <img
                      src={
                        generatedAsset.storageUrl ||
                        `http://127.0.0.1:8000/workspace/file?path=${encodeURIComponent(
                          generatedAsset.localPath || ''
                        )}`
                      }
                      alt={generatedAsset.name}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1.5">
                      <span>🔍</span>
                      <span>{lang === 'es' ? 'Ver en pantalla completa' : 'View full resolution'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions & Asset Information (When asset is present) */}
              {generatedAsset && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800/80 pb-2">
                    <span className="font-medium text-zinc-200 truncate max-w-[200px]">
                      {generatedAsset.name}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      {aspectRatio} • {generatedAsset.format?.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {generatedAsset.storageUrl && (
                      <a
                        href={generatedAsset.storageUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={generatedAsset.name}
                        className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-medium transition-colors text-center cursor-pointer shadow-sm"
                      >
                        {lang === 'es' ? '⬇️ Descargar' : '⬇️ Download'}
                      </a>
                    )}

                    {generatedAsset.localPath && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            generatedAsset.localPath,
                            lang === 'es' ? 'Ruta local copiada al portapapeles' : 'Local path copied to clipboard'
                          )
                        }
                        className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-medium transition-colors cursor-pointer shadow-sm"
                      >
                        {lang === 'es' ? '📋 Copiar ruta local' : '📋 Copy local path'}
                      </button>
                    )}
                  </div>

                  {onOpenAssets && (
                    <button
                      type="button"
                      onClick={onOpenAssets}
                      className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>📁</span>
                      <span>{lang === 'es' ? 'Ver en Biblioteca de Recursos' : 'View in Asset Library'}</span>
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      {/* ── FULLSCREEN PREVIEW MODAL ────────────────────────────────────────── */}
      {showFullPreview && generatedAsset && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setShowFullPreview(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setShowFullPreview(false)}
              className="absolute -top-10 right-0 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium cursor-pointer transition-colors"
            >
              ✕ {lang === 'es' ? 'Cerrar' : 'Close'}
            </button>
            <img
              src={
                generatedAsset.storageUrl ||
                `http://127.0.0.1:8000/workspace/file?path=${encodeURIComponent(
                  generatedAsset.localPath || ''
                )}`
              }
              alt={generatedAsset.name}
              className="max-h-[85vh] max-w-full rounded-xl shadow-2xl object-contain border border-zinc-800"
            />
          </div>
        </div>
      )}
    </div>
  );
}
