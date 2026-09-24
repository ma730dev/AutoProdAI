'use client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

export default function ConfirmDeleteModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = '¿Eliminar conversación?',
  description = 'Esta acción no se puede deshacer. Se borrarán todos los mensajes y configuraciones asociados a este chat.'
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-[400px] shadow-2xl flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-red-500">⚠️</span> {title}
          </h2>
          <p className="text-sm text-zinc-400 mt-2">
            {description}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-red-600/90 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-red-500/20"
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
