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

export interface QuestionStep {
  id?: string;
  question: string;
  description?: string;
  options: (string | QuestionOption)[];
  isMultiSelect?: boolean;
  allowCustomInput?: boolean;
  customInputPlaceholder?: string;
}

export interface InteractiveQuestionData {
  id?: string;
  title?: string;
  question?: string;
  description?: string;
  options?: (string | QuestionOption)[];
  isMultiSelect?: boolean;
  allowCustomInput?: boolean;
  customInputPlaceholder?: string;
  submitButtonText?: string;
  questions?: QuestionStep[];
}

interface Props {
  dataJson?: string;
  data?: InteractiveQuestionData;
  onSelect: (selectedText: string) => void;
  disabled?: boolean;
}

function cleanOptionText(text: string): string {
  if (!text) return '';
  return text
    .replace(/^\[.*?\]\s*/, '')
    .replace(/[✅⚡📝🎯✓🪙]/g, '')
    .trim();
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

  // Normalizar preguntas en pasos (Wizard)
  const steps: QuestionStep[] = React.useMemo(() => {
    if (!parsedData) return [];
    if (Array.isArray(parsedData.questions) && parsedData.questions.length > 0) {
      return parsedData.questions;
    }
    if (parsedData.question && Array.isArray(parsedData.options)) {
      return [{
        id: parsedData.id || 'step-0',
        question: parsedData.question,
        description: parsedData.description,
        options: parsedData.options,
        isMultiSelect: parsedData.isMultiSelect,
        allowCustomInput: parsedData.allowCustomInput ?? true,
        customInputPlaceholder: parsedData.customInputPlaceholder
      }];
    }
    return [];
  }, [parsedData]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedPicksByStep, setSelectedPicksByStep] = useState<Record<number, string[]>>({});
  const [customTextByStep, setCustomTextByStep] = useState<Record<number, string>>({});
  const [isOtherSelectedByStep, setIsOtherSelectedByStep] = useState<Record<number, boolean>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [finalSummary, setFinalSummary] = useState<string | null>(null);

  if (!parsedData || steps.length === 0) {
    return null;
  }

  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const isMultiStep = totalSteps > 1;

  // Normalizar opciones del paso actual
  const normalizedOptions: QuestionOption[] = (currentStep.options || []).map((opt, idx) => {
    if (typeof opt === 'string') {
      const isRec = opt.includes('(Recomendado)') || opt.includes('(Recommended)');
      const clean = cleanOptionText(opt).replace(/\(Recomendado\)|\(Recommended\)/gi, '').trim();
      return {
        id: `opt-${currentStepIndex}-${idx}`,
        label: clean,
        value: opt,
        recommended: isRec
      };
    }
    const clean = cleanOptionText(opt.label || opt.value || `Opción ${idx + 1}`).replace(/\(Recomendado\)|\(Recommended\)/gi, '').trim();
    return {
      id: opt.id || `opt-${currentStepIndex}-${idx}`,
      label: clean,
      value: opt.value || opt.label,
      description: opt.description,
      badge: opt.badge,
      cost: opt.cost,
      recommended: opt.recommended || opt.label?.includes('(Recomendado)')
    };
  });

  const isMulti = Boolean(currentStep.isMultiSelect);
  const allowCustom = currentStep.allowCustomInput ?? true;
  const currentSelections = selectedPicksByStep[currentStepIndex] || [];
  const currentCustomText = customTextByStep[currentStepIndex] || '';
  const isOtherActive = Boolean(isOtherSelectedByStep[currentStepIndex]);

  const submitFinalAnswers = (finalMap: Record<number, string[]>) => {
    const summaryLines: string[] = [];
    steps.forEach((st, idx) => {
      const answers = finalMap[idx] || [];
      summaryLines.push(`• ${st.question}: ${answers.join(', ') || 'Sin respuesta'}`);
    });

    const fullMessage = isMultiStep
      ? `[Respuestas del Formulario]:\n${summaryLines.join('\n')}`
      : `[Elección]: ${(finalMap[0] || []).join(', ')}`;

    setIsCompleted(true);
    setIsOpen(false);
    setFinalSummary((finalMap[0] || []).join(', '));
    onSelect(fullMessage);
  };

  const handleSelectOption = (opt: QuestionOption) => {
    if (disabled || isCompleted) return;
    const val = opt.value || opt.label;

    if (!isMulti) {
      setIsOtherSelectedByStep({ ...isOtherSelectedByStep, [currentStepIndex]: false });
      setSelectedPicksByStep({ ...selectedPicksByStep, [currentStepIndex]: [val] });
    } else {
      const exists = currentSelections.includes(val);
      const next = exists ? currentSelections.filter(v => v !== val) : [...currentSelections, val];
      setSelectedPicksByStep({ ...selectedPicksByStep, [currentStepIndex]: next });
    }
  };

  const handleSelectOther = () => {
    if (disabled || isCompleted) return;
    if (!isMulti) {
      setSelectedPicksByStep({ ...selectedPicksByStep, [currentStepIndex]: [] });
    }
    setIsOtherSelectedByStep({ ...isOtherSelectedByStep, [currentStepIndex]: true });
  };

  const handleConfirmStep = () => {
    if (disabled || isCompleted) return;

    let finalPicks = [...currentSelections];
    if (isOtherActive && currentCustomText.trim()) {
      if (!finalPicks.includes(currentCustomText.trim())) {
        finalPicks.push(currentCustomText.trim());
      }
    }

    if (finalPicks.length === 0) return;

    const nextMap = { ...selectedPicksByStep, [currentStepIndex]: finalPicks };
    setSelectedPicksByStep(nextMap);

    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      submitFinalAnswers(nextMap);
    }
  };

  const hasValidSelection = currentSelections.length > 0 || (isOtherActive && currentCustomText.trim().length > 0);

  // ──────────────────────────────────────────────
  // Estado: YA COMPLETADO (Tarjeta sutil en la conversación)
  // ──────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="my-2.5 p-3 bg-zinc-900/70 border border-purple-500/30 rounded-xl transition-all shadow-sm">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-300 gap-2">
          <span className="flex items-center gap-2 truncate">
            <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] shrink-0">✓</span>
            <span className="truncate">{parsedData.title || (isMultiStep ? 'Formulario completado' : currentStep.question)}</span>
          </span>
          <span className="text-[11px] text-purple-300 font-mono shrink-0 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/30">
            {finalSummary || 'Respuesta enviada'}
          </span>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // Estado: ACTIVO — FORMULARIO QUE EMERGE NATIVAMENTE DEL CHAT
  // ──────────────────────────────────────────────
  return (
    <div className="my-3 w-full rounded-2xl border border-purple-500/40 bg-gradient-to-b from-[#161622] via-[#121219] to-[#0e0e13] shadow-2xl shadow-purple-950/20 overflow-hidden font-sans transition-all duration-300 animate-in slide-in-from-bottom-2 fade-in">
      
      {/* Header del Formulario */}
      <div className="px-4 py-3 border-b border-zinc-800/80 bg-[#16161c]/90 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-[10px] text-purple-300 font-bold">
            {currentStepIndex + 1}
          </div>
          <div>
            <h3 className="text-[11px] font-bold text-white tracking-wider uppercase">
              {parsedData.title || (isMultiStep ? `Paso ${currentStepIndex + 1} de ${totalSteps}` : 'Formulario de Decisión')}
            </h3>
            {isMultiStep && (
              <span className="text-[10px] text-zinc-400">
                Paso {currentStepIndex + 1} de {totalSteps}
              </span>
            )}
          </div>
        </div>

        <span className="text-[10px] text-purple-400/80 font-mono uppercase bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/40">
          AutoProd Form
        </span>
      </div>

      {/* Barra de progreso de pasos */}
      {isMultiStep && (
        <div className="h-1 w-full bg-zinc-900 flex">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-full transition-all duration-300 ${
                idx <= currentStepIndex ? 'bg-gradient-to-r from-purple-500 to-indigo-500 flex-1' : 'bg-transparent flex-1'
              }`}
            />
          ))}
        </div>
      )}

      {/* Contenido scrolleable */}
      <div className="p-4 space-y-3.5">
        {/* Título de la Pregunta */}
        <div>
          <h4 className="text-xs sm:text-sm font-semibold text-zinc-100 leading-snug">
            {currentStep.question}
          </h4>
          {currentStep.description && (
            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
              {currentStep.description}
            </p>
          )}
        </div>

        {/* Lista de Opciones con Radio Buttons estilo Antigravity */}
        <div className="space-y-2">
          {normalizedOptions.map((opt) => {
            const val = opt.value || opt.label;
            const isSelected = currentSelections.includes(val);

            return (
              <div
                key={opt.id}
                onClick={() => handleSelectOption(opt)}
                className={`group flex items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-purple-950/40 border-purple-500 text-white shadow-md shadow-purple-950/30 ring-1 ring-purple-500/50'
                    : 'bg-zinc-900/60 hover:bg-zinc-800/70 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Radio Button circular nativo */}
                  <div className={`w-4 h-4 rounded-${isMulti ? 'md' : 'full'} shrink-0 flex items-center justify-center border transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-600'
                      : 'border-zinc-600 bg-transparent group-hover:border-zinc-500'
                  }`}>
                    {isSelected && (
                      isMulti ? <span className="text-[10px] text-white">✓</span> : <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>

                  {/* Texto */}
                  <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs ${isSelected ? 'font-semibold text-white' : 'font-normal text-zinc-200'}`}>
                      {opt.label}
                    </span>
                    {opt.recommended && (
                      <span className="text-[9px] bg-purple-900/50 text-purple-300 border border-purple-700/60 px-1.5 py-0.2 rounded font-medium">
                        (Recomendado)
                      </span>
                    )}
                  </div>
                </div>

                {/* Badge si tiene costo */}
                {(opt.badge || opt.cost !== undefined) && (
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium border shrink-0 ${
                    String(opt.badge || opt.cost).includes('0') || String(opt.badge).toLowerCase().includes('gratis')
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-400'
                      : 'bg-purple-950/80 border-purple-700/60 text-purple-300'
                  }`}>
                    {opt.badge || (opt.cost === 0 ? 'Gratis' : `${opt.cost} cr`)}
                  </span>
                )}
              </div>
            );
          })}

          {/* Opción Otra Respuesta (Other) */}
          {allowCustom && (
            <div
              onClick={handleSelectOther}
              className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${
                isOtherActive
                  ? 'bg-purple-950/30 border-purple-500/70 ring-1 ring-purple-500/40'
                  : 'bg-zinc-900/40 hover:bg-zinc-800/60 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2 shrink-0">
                <div className={`w-4 h-4 rounded-${isMulti ? 'md' : 'full'} shrink-0 flex items-center justify-center border transition-all ${
                  isOtherActive
                    ? 'border-purple-500 bg-purple-600'
                    : 'border-zinc-600 bg-transparent'
                }`}>
                  {isOtherActive && (
                    isMulti ? <span className="text-[10px] text-white">✓</span> : <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <span className="text-xs text-zinc-300 font-medium">
                  Otra respuesta:
                </span>
              </div>

              <input
                type="text"
                value={currentCustomText}
                onChange={(e) => {
                  setCustomTextByStep({ ...customTextByStep, [currentStepIndex]: e.target.value });
                  if (!isOtherActive) handleSelectOther();
                }}
                onFocus={handleSelectOther}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmStep();
                  }
                }}
                disabled={disabled}
                placeholder={currentStep.customInputPlaceholder || 'Escribe aquí tu propia respuesta...'}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer de Acciones */}
      <div className="px-4 py-3 border-t border-zinc-800/80 bg-[#16161c]/90 flex items-center justify-between gap-3 shrink-0">
        {/* Botón Atrás */}
        {isMultiStep && currentStepIndex > 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
            className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            ← Anterior
          </button>
        ) : (
          <div />
        )}

        {/* Botón Confirmar / Siguiente */}
        <button
          type="button"
          disabled={disabled || !hasValidSelection}
          onClick={handleConfirmStep}
          className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
        >
          {currentStepIndex < totalSteps - 1 ? 'Siguiente paso →' : (parsedData.submitButtonText || 'Confirmar')}
        </button>
      </div>
    </div>
  );
}

