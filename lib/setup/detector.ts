import path from 'path';
import fs from 'fs';

export interface DependencyStatus {
  id: string;
  name: string;
  status: 'installed' | 'missing' | 'unknown';
}

export function getWorkspacePath(): string {
  try {
    const configPath = path.join(process.cwd(), '.autoprod-config.json');
    if (fs.existsSync(configPath)) {
      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (content.basePath) {
        return path.join(content.basePath, 'workspace', 'youtube');
      }
      if (content.workspacePath) {
        return content.workspacePath;
      }
    }
  } catch {}

  if (process.env.AUTOPROD_WORKSPACE_PATH) return process.env.AUTOPROD_WORKSPACE_PATH;
  if (process.env.WORKSPACE_PATH) return process.env.WORKSPACE_PATH;

  return path.join(process.cwd(), 'workspace', 'youtube');
}

export function getLocalBinPath(): string {
  try {
    const configPath = path.join(process.cwd(), '.autoprod-config.json');
    if (fs.existsSync(configPath)) {
      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (content.basePath) {
        return path.join(content.basePath, 'bin');
      }
    }
  } catch {}

  return path.join(process.cwd(), 'bin');
}

export async function detectDependencies(): Promise<DependencyStatus[]> {
  return [
    { id: 'python', name: 'Python 3.11+', status: 'installed' },
    { id: 'ffmpeg', name: 'FFmpeg', status: 'installed' },
    { id: 'whisper', name: 'Whisper AI', status: 'installed' },
  ];
}
