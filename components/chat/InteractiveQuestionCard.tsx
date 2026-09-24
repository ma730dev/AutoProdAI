'use client';

import React, { useState } from 'react';

export interface QuestionOption {
  id?: string;
  label: string;
  value?: string;
  description?: string;
  badge?: string;
  cost?: number | string;
  recommended?: boolean;
}

export interface InteractiveQuestionData {
  id?: string;
  question: string;
  description?: string;
  options: (string | QuestionOption)[];
  isMultiSelect?: boolean;
  allowCustomInput?: boolean;
  customInputPlaceholder?: string;
  submitButtonText?: string;
}

interface Props {
  dataJson?: string;
  data?: InteractiveQuestionData;
  onSelect: (selectedText: string) => void;
  disabled?: boolean;
}

export default function InteractiveQuestionCard({ dataJson, data: directData, onSelect, disabled = false }: Props) {
  let parsedData: InteractiveQuestionData | null = directData || null;

  if (!parsedData && dataJson) {
    try {
      parsedData = JSON.parse(dataJson.trim());
    } catch (e) {
      console.warn('[InteractiveQuestionCard] Error al parsear JSON:', e);
    }
  }

  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [customText, setCustomText] = useState('');
  const [answeredText, setAnsweredText] = useState<string | null>(null);

  if (!parsedData || !parsedData.question || !Array.isArray(parsedData.options)) {
    return (
      <div className="bg-red-950/20 border border-red-800/40 text-red-400 text-xs p-3 rounded-lg">
        ⚠️ Bloque de pregunta interactiva malformado.
      </div>
    );
  }

  // Normalizar opciones a objetos QuestionOption
  const normalizedOptions: QuestionOption[] = parsedData.options.map((opt, idx) => {
    if (typeof opt === 'string') {
      const isRec = opt.includes('(Recomendado)') || opt.includes('(Recommended)');
      return {
        id: `opt-${idx}`,
        label: opt,
        value: opt,
        recommended: isRec
      };
    }
    return {
      id: opt.id || `opt-${idx}`,
      label: opt.label || opt.value || `Opción ${idx + 1}`,
      value: opt.value || opt.label,
      description: opt.description,
      badge: opt.badge,
      cost: opt.cost,
      recommended: opt.recommended || opt.label?.includes('(Recomendado)')
    };
  });

  const isMulti = Boolean(parsedData.isMultiSelect);
  const allowCustom = parsedData.allowCustomInput ?? true;

  const handleOptionClick = (opt: QuestionOption) => {
    if (disabled || answeredText) return;

    const val = opt.value || opt.label;

    if (!isMulti) {
      // Selección única de 1-clic
      const finalMsg = `[Elección]: ${val}`;
      setAnsweredText(val);
      onSelect(finalMsg);
    } else {
      // Multi-selección con checkboxes
      setSelectedValues(prev =>
        prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
      );
    }
  };

  const handleMultiSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (disabled || answeredText) return;

    const allPicks = [...selectedValues];
    if (customText.trim() && !allPicks.includes(customText.trim())) {
      allPicks.push(customText.trim());
    }

    if (allPicks.length === 0) return;

    const finalMsg = `[Elección]: ${allPicks.join(', ')}`;
    setAnsweredText(allPicks.join(', '));
    onSelect(finalMsg);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || answeredText || !customText.trim()) return;

    const finalMsg = `[Elección personalizada]: ${customText.trim()}`;
    setAnsweredText(customText.trim());
    onSelect(finalMsg);
  };

  // ──────────────────────────────────────────────
  // Estado: YA RESPONDIDO
  // ──────────────────────────────────────────────
  if (answeredText) {
    return (
      <div className="my-3 p-3.5 bg-emerald-950/20 border border-emerald-500/40 rounded-xl shadow-lg animate-in fade-in transition-all">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
          <span className="text-base">✅</span>
          <span>{parsedData.question}</span>
        </div>
        <div className="mt-2 text-xs text-emerald-200/90 font-mono bg-emerald-950/50 border border-emerald-800/40 rounded px-2.5 py-1.5 w-fit">
          Respuesta confirmada: <strong className="text-emerald-100">{answeredText}</strong>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // Estado: ACTIVO (INTERACTIVO)
  // ──────────────────────────────────────────────
  return (
    <div className="my-4 bg-gradient-to-b from-[#16161c] to-[#0f0f13] border border-purple-500/30 hover:border-purple-500/50 rounded-xl p-4 shadow-xl shadow-purple-950/20 transition-all">
      {/* Header */}
      <div className="flex items-start gap-2.5 mb-3">
        <span className="text-lg shrink-0">🎯</span>
        <div>
          <h4 className="text-sm font-bold text-purple-200 leading-snug">
            {parsedData.question}
          </h4>
          {parsedData.description && (
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              {parsedData.description}
            </p>
          )}
        </div>
      </div>

      {/* Lista de Opciones */}
      <div className="grid grid-cols-1 gap-2 my-2">
        {normalizedOptions.map((opt) => {
          const val = opt.value || opt.label;
          const isSelected = selectedValues.includes(val);

          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => handleOptionClick(opt)}
              className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-purple-950/50 border-purple-500 text-purple-100 shadow-md shadow-purple-900/30'
                  : 'bg-[#1a1a22]/70 hover:bg-purple-950/30 border-zinc-800/90 hover:border-purple-500/50 text-zinc-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center gap-2.5">
                {isMulti ? (
                  <span className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                    isSelected ? 'bg-purple-600 border-purple-400 text-white' : 'border-zinc-700 bg-zinc-900'
                  }`}>
                    {isSelected && '✓'}
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-purple-500/40 group-hover:bg-purple-400 shrink-0 transition-colors" />
                )}

                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-white group-hover:text-purple-200 transition-colors">
                      {opt.label}
                    </span>
                    {opt.recommended && (
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.2 rounded-full font-medium">
                        Recomendado
                      </span>
                    )}
                  </div>
                  {opt.description && (
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
                      {opt.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Badge de Costo o Tipo */}
              {(opt.badge || opt.cost !== undefined) && (
                <div className="shrink-0 self-start sm:self-center">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-medium border ${
                    String(opt.badge || opt.cost).includes('0') || String(opt.badge).toLowerCase().includes('gratis')
                      ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
                      : 'bg-purple-950/60 border-purple-700/50 text-purple-300'
                  }`}>
                    {opt.badge || (opt.cost === 0 ? '⚡ 0 créditos (Gratis)' : `🪙 ~${opt.cost} créditos`)}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Input de Opción Libre (Personalizada) */}
      {allowCustom && (
        <form onSubmit={isMulti ? handleMultiSubmit : handleCustomSubmit} className="mt-3 flex gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            disabled={disabled}
            placeholder={parsedData.customInputPlaceholder || 'O escribe otra opción personalizada...'}
            className="flex-1 bg-[#121216] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition-all"
          />
          <button
            type="submit"
            disabled={disabled || !customText.trim()}
            className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            Enviar ↵
          </button>
        </form>
      )}

      {/* Botón de Confirmación para Selección Múltiple */}
      {isMulti && (
        <div className="mt-3 pt-2 border-t border-zinc-800/80 flex justify-end">
          <button
            type="button"
            disabled={disabled || (selectedValues.length === 0 && !customText.trim())}
            onClick={() => handleMultiSubmit()}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            Confirmar Selección ({selectedValues.length}) →
          </button>
        </div>
      )}
    </div>
  );
}
