'use client';

import React, { useState } from 'react';
import { SubtitlesEstimateResponse, HardwareSpecs } from '@/lib/controlador-client';

interface PreExecutionEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (engine: 'openai_api' | 'local_gpu' | 'local_cpu') => void;
  estimateData: SubtitlesEstimateResponse | null;
  isLoading?: boolean;
  title?: string;
  actionButtonText?: string;
}

export const PreExecutionEstimateModal: React.FC<PreExecutionEstimateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  estimateData,
  isLoading = false,
  title = '⚡ Estimación de Hardware y Tiempo de Proceso',
  actionButtonText = 'Comenzar Procesamiento Seguro',
}) => {
  const [selectedEngine, setSelectedEngine] = useState<'openai_api' | 'local_gpu' | 'local_cpu'>(
    estimateData?.hardware_specs?.has_gpu ? 'local_gpu' : 'local_cpu'
  );

  if (!isOpen) return null;

  const specs: HardwareSpecs | undefined = estimateData?.hardware_specs;
  const estimates = estimateData?.estimate?.engine_estimates;

  const currentEstimate = estimates
    ? selectedEngine === 'openai_api'
      ? estimates.openai_api
      : selectedEngine === 'local_gpu'
      ? estimates.local_gpu
      : estimates.local_cpu
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Encabezado */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-zinc-900 via-[#1e1e24] to-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl">
              ⚡
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
              <p className="text-xs text-zinc-400">
                Control de capacidad del PC y equilibrio de tiempo vs consumo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          
          {/* Ficha Resumen de Medio a Procesar */}
          {estimateData && (
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-900/80 border border-white/5 text-center">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-400 block">Tipo de Tarea</span>
                <span className="text-sm font-semibold text-white capitalize mt-0.5 block">
                  {estimateData.target_type === 'songs_folder' ? '🎵 Carpeta Canciones' : '🎬 Video Individual'}
                </span>
              </div>
              <div className="border-x border-white/5">
                <span className="text-[11px] uppercase tracking-wider text-zinc-400 block">Pistas / Archivos</span>
                <span className="text-sm font-semibold text-emerald-400 mt-0.5 block">
                  {estimateData.total_files} {estimateData.total_files === 1 ? 'archivo' : 'audios'}
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-400 block">Duración Total</span>
                <span className="text-sm font-semibold text-amber-400 mt-0.5 block">
                  {estimateData.total_duration_formatted}
                </span>
              </div>
            </div>
          )}

          {/* Selector de Motor */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-3">
              Selecciona el Motor de Procesamiento:
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* Opción 1: Faster-Whisper GPU Local */}
              <div
                onClick={() => setSelectedEngine('local_gpu')}
                className={`cursor-pointer p-4 rounded-xl border transition-all relative ${
                  selectedEngine === 'local_gpu'
                    ? 'bg-indigo-500/10 border-indigo-500 shadow-md shadow-indigo-950/30'
                    : 'bg-zinc-900/60 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-indigo-400">🚀 Faster-Whisper GPU</span>
                  {specs?.has_gpu ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                      Recomendado
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      $0 Costo
                    </span>
                  )}
                </div>
                <div className="text-xl font-extrabold text-white">
                  ~{estimates?.local_gpu.formatted || 'Rápido'}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  100% local en tu GPU. Subtítulos palabra por palabra sin consumo de API.
                </p>
              </div>

              {/* Opción 2: Faster-Whisper CPU Local */}
              <div
                onClick={() => setSelectedEngine('local_cpu')}
                className={`cursor-pointer p-4 rounded-xl border transition-all relative ${
                  selectedEngine === 'local_cpu'
                    ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-950/30'
                    : 'bg-zinc-900/60 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-amber-400">⚖️ Faster-Whisper CPU</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                    100% Local ($0)
                  </span>
                </div>
                <div className="text-xl font-extrabold text-white">
                  ~{estimates?.local_cpu.formatted || 'Equilibrado'}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Hilos regulados automáticamente. No congela tu equipo ni requiere pagos.
                </p>
              </div>

              {/* Opción 3: Cloud Whisper API */}
              <div
                onClick={() => setSelectedEngine('openai_api')}
                className={`cursor-pointer p-4 rounded-xl border transition-all ${
                  selectedEngine === 'openai_api'
                    ? 'bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-950/30'
                    : 'bg-zinc-900/60 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-emerald-400">☁️ OpenAI API (Cloud)</span>
                </div>
                <div className="text-xl font-extrabold text-white">
                  ~{estimates?.openai_api.formatted || 'Nube'}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Opcional. Requiere tu propia clave OPENAI_API_KEY en .env.
                </p>
              </div>

            </div>
          </div>

          {/* Ficha de Recursos del Hardware */}
          {specs && (
            <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <span>💻</span> Recursos del Equipo Detectados
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                  specs.power_level === 'high'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : specs.power_level === 'medium'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                }`}>
                  Potencia: {specs.power_level === 'high' ? 'Alta' : specs.power_level === 'medium' ? 'Media' : 'Modesta'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-black/30">
                  <span className="text-zinc-400 block">Procesador (CPU):</span>
                  <span className="font-semibold text-white">
                    {specs.cpu_cores} Núcleos ({specs.safe_threads} hilos seguros)
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/30">
                  <span className="text-zinc-400 block">Memoria RAM:</span>
                  <span className="font-semibold text-white">
                    {specs.total_ram_gb} GB ({specs.avail_ram_gb} GB libres)
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/30">
                  <span className="text-zinc-400 block">Tarjeta Gráfica:</span>
                  <span className="font-semibold text-white truncate block" title={specs.gpu_name}>
                    {specs.gpu_name}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Advertencias Críticas Previas a la Ejecución */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs tracking-wide">
              <span>⚠️</span>
              <span>INSTRUCCIONES IMPORTANTES ANTES DE CONTINUAR:</span>
            </div>
            <ul className="text-xs text-zinc-300 space-y-1.5 pl-5 list-disc">
              <li>
                <strong className="text-white">No apagues ni suspendas el PC</strong> mientras la tarea esté en progreso.
              </li>
              <li>
                Si estás en un computador portátil, <strong className="text-white">mantén el cargador conectado</strong> para evitar throttling térmico o agotamiento de batería.
              </li>
              <li>
                <strong className="text-emerald-400">Protección activa de sistema:</strong> AutoProd modula la carga para que puedas seguir utilizando el computador de manera fluida durante el renderizado.
              </li>
            </ul>
          </div>

        </div>

        {/* Pie de Modal */}
        <div className="p-5 border-t border-white/10 bg-zinc-900 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            Tiempo estimado:{' '}
            <strong className="text-emerald-400 text-sm">
              {currentEstimate?.formatted || 'Calculando...'}
            </strong>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(selectedEngine)}
              disabled={isLoading}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Iniciando...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>{actionButtonText}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
