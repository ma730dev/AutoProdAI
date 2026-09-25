'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { ControladorClient } from '@/lib/controlador-client';

export interface AuditChannelFolder {
  name: string;
  path: string;
  has_info_canal?: boolean;
  subfolders_count?: number;
  created_at?: string | null;
}

interface WorkspaceCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: AuditChannelFolder[];
  maxAllowed: number;
  planDisplayName: string;
  onCleanupComplete: () => void;
}

export default function WorkspaceCleanupModal({
  isOpen,
  onClose,
  folders,
  maxAllowed,
  planDisplayName,
  onCleanupComplete,
}: WorkspaceCleanupModalProps) {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  if (!isOpen) return null;

  const currentCount = folders.length;
  const excessCount = Math.max(0, currentCount - maxAllowed);
  const selectedCount = selectedPaths.length;
  const remainingAfter = currentCount - selectedCount;
  const isSatisfied = remainingAfter <= maxAllowed;

  const toggleSelect = (path: string) => {
    setSelectedPaths(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleExecuteCleanup = async () => {
    if (!isSatisfied) {
      toast.error(`Debes seleccionar al menos ${excessCount} carpeta(s) para cumplir con el límite de tu plan.`);
      return;
    }

    setIsDeleting(true);
    const toastId = toast.loading('Eliminando carpetas seleccionadas...');

    try {
      // 1. Eliminar físicamente las carpetas vía Motor Local
      await ControladorClient.deleteFolder(selectedPaths);

      // 2. Desvincular de la base de datos si existían registros asociados
      for (const path of selectedPaths) {
        const folderName = path.split(/[/\\]/).pop() || '';
        if (folderName) {
          try {
            await fetch('/api/channels', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: folderName })
            });
          } catch {
            // Ignorar si no existía en BD
          }
        }
      }

      toast.success(`Se eliminaron ${selectedCount} carpeta(s) correctamente. Tu espacio de trabajo está en regla.`, { id: toastId });
      setSelectedPaths([]);
      setConfirmStep(false);
      onCleanupComplete();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error durante la limpieza de carpetas', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-zinc-950 border border-amber-500/40 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header con advertencia */}
        <div className="bg-gradient-to-r from-amber-950/60 to-zinc-900 border-b border-amber-500/30 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-xl shrink-0">
              ⚠️
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Límite de Canales Excedido en tu Espacio de Trabajo
              </h2>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Ruta activa: <code className="text-zinc-300 font-mono">workspace/youtube</code>
              </p>
            </div>
          </div>
        </div>

        {/* Resumen del Límite */}
        <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/40 space-y-2">
          <p className="text-xs text-zinc-300 leading-relaxed">
            Se han detectado <span className="font-bold text-white">{currentCount} carpetas de canales</span> en tu disco local. Tu suscripción <span className="font-bold text-amber-400">{planDisplayName}</span> permite un máximo de <span className="font-bold text-white">{maxAllowed} canal(es)</span>.
          </p>
          <div className="flex items-center justify-between text-xs px-3 py-2 bg-zinc-950 rounded-lg border border-zinc-800">
            <span className="text-zinc-400">Carpetas que debes descartar:</span>
            <span className="font-mono font-bold text-amber-400">{excessCount} canal(es)</span>
          </div>
          <div className="flex items-center justify-between text-xs px-3 py-2 bg-zinc-950 rounded-lg border border-zinc-800">
            <span className="text-zinc-400">Seleccionadas para eliminar:</span>
            <span className={`font-mono font-bold ${isSatisfied ? 'text-emerald-400' : 'text-rose-400'}`}>
              {selectedCount} seleccionada(s) ({isSatisfied ? 'Límite alcanzado' : `Faltan ${Math.max(0, excessCount - selectedCount)}`})
            </span>
          </div>
        </div>

        {/* Lista interactiva de carpetas */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5 minimal-scrollbar">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Selecciona las carpetas que deseas eliminar de tu disco:
          </p>

          {folders.map((folder) => {
            const isChecked = selectedPaths.includes(folder.path);
            return (
              <div
                key={folder.path}
                onClick={() => toggleSelect(folder.path)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isChecked
                    ? 'bg-rose-950/30 border-rose-500/50 text-white'
                    : 'bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // controlado por onClick del contenedor
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-rose-500 focus:ring-rose-500"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate text-white">{folder.name}</span>
                      {folder.has_info_canal && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          InfoCanal
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                      {folder.path}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {isChecked ? (
                    <span className="text-[11px] font-semibold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800/60">
                      A eliminar
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-500">Conservar</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer y botones de acción */}
        <div className="p-5 border-t border-zinc-800/80 bg-zinc-950 flex flex-col gap-3">
          {confirmStep ? (
            <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-xl space-y-2">
              <p className="text-xs text-rose-200">
                ⚠️ ¿Confirmas la eliminación permanente de <span className="font-bold">{selectedCount} carpeta(s)</span> de tu disco local? Esta acción no se puede deshacer.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmStep(false)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCleanup}
                  disabled={isDeleting}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isDeleting ? 'Eliminando...' : 'Sí, eliminar definitivamente'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                disabled={!isSatisfied}
                onClick={() => setConfirmStep(true)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 ${
                  isSatisfied
                    ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20 cursor-pointer active:scale-95'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                }`}
              >
                <span>🧹</span>
                <span>Proceder con la limpieza</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
