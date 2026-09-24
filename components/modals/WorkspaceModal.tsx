'use client';

import { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLinkWorkspace: (path: string) => void;
  onCreateNode?: (parentPath: string, folderName: string, folders: string[]) => void;
  parentPath?: string | null; 
  creationMode?: 'channel' | 'video' | null;
}

import { ControladorClient } from '@/lib/controlador-client';

const DEFAULT_FOLDERS = [
  { name: 'Musica', checked: true },
  { name: 'Videos', checked: true },
  { name: 'Imagenes', checked: true },
  { name: 'Guiones', checked: true },
  { name: 'Ambiente', checked: false },
  { name: 'Miniaturas', checked: false }
];

export default function WorkspaceModal({ isOpen, onClose, onLinkWorkspace, onCreateNode, parentPath, creationMode }: Props) {
  const [workspacePath, setWorkspacePath] = useState('');
  const [folderName, setFolderName] = useState('');
  const [folders, setFolders] = useState(DEFAULT_FOLDERS);
  const [customFolder, setCustomFolder] = useState('');
  const [isPicking, setIsPicking] = useState(false);

  if (!isOpen) return null;

  const handleToggleFolder = (index: number) => {
    const newFolders = [...folders];
    newFolders[index].checked = !newFolders[index].checked;
    setFolders(newFolders);
  };

  const handleAddCustomFolder = () => {
    if (customFolder.trim() && !folders.find(f => f.name === customFolder.trim())) {
      setFolders([...folders, { name: customFolder.trim(), checked: true }]);
      setCustomFolder('');
    }
  };

  const handlePickFolder = async () => {
    setIsPicking(true);
    try {
      const res = await ControladorClient.pickWorkspace();
      setWorkspacePath(res.path);
    } catch (e) {
      // User cancelled or error
    } finally {
      setIsPicking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parentPath && onCreateNode && creationMode) {
      const selectedFolders = creationMode === 'video' ? folders.filter(f => f.checked).map(f => f.name) : [];
      onCreateNode(parentPath, folderName, selectedFolders);
    } else {
      if (!workspacePath) return;
      onLinkWorkspace(workspacePath);
    }
    onClose();
  };

  const isCreating = !!creationMode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-[500px] shadow-2xl flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-white">
            {!isCreating 
              ? 'Vincular Proyecto Raíz' 
              : creationMode === 'channel' 
                ? 'Crear Nuevo Canal' 
                : 'Crear Nuevo Video'}
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {!isCreating 
              ? 'Selecciona la carpeta en tu computadora donde guardarás todos los canales.'
              : `Se creará dentro de: ${parentPath}`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isCreating ? (
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-2">Ruta del Proyecto</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  readOnly
                  value={workspacePath}
                  placeholder="Ninguna carpeta seleccionada..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-400 focus:outline-none cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={handlePickFolder}
                  disabled={isPicking}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors whitespace-nowrap"
                >
                  {isPicking ? 'Abriendo...' : '📂 Explorar...'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">
                  {creationMode === 'channel' ? 'Nombre del Canal' : 'Nombre del Video'}
                </label>
                <input
                  type="text"
                  required
                  value={folderName}
                  onChange={e => setFolderName(e.target.value)}
                  placeholder={creationMode === 'channel' ? "Ej: FilosofiaNocturna" : "Ej: Que es el existencialismo"}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {creationMode === 'video' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-2">Estructura Interna del Video</label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {folders.map((f, i) => (
                      <label key={f.name} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={f.checked} 
                          onChange={() => handleToggleFolder(i)}
                          className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-zinc-900" 
                        />
                        {f.name}
                      </label>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customFolder}
                      onChange={e => setCustomFolder(e.target.value)}
                      placeholder="Otra subcarpeta..."
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button 
                      type="button" 
                      onClick={handleAddCustomFolder}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm transition-colors"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
            >
              {!isCreating ? 'Vincular Proyecto' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
