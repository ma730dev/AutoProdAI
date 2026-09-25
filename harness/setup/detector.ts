import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';

const execAsync = promisify(exec);

export type DependencyStatus = 'installed' | 'outdated' | 'missing';

export interface DependencyInfo {
  id: string;
  name: string;
  status: DependencyStatus;
  current_version?: string;
  required_version: string;
}

export function getAutoProdRoot(): string | null {
  const configPath = path.join(process.cwd(), '.autoprod-config.json');
  try {
    if (fsSync.existsSync(configPath)) {
      const data = fsSync.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(data);
      if (config.basePath) {
        return config.basePath;
      }
    }
  } catch (err) {
    // Ignore read/parse errors
  }
  return null;
}

export function getLocalBinPath(): string | null {
  const root = getAutoProdRoot();
  return root ? path.join(root, 'bin') : null;
}

export function getWorkspacePath(): string | null {
  const root = getAutoProdRoot();
  if (!root) return null;

  let youtubeDir: string;
  if (path.basename(root).toLowerCase() === 'youtube') {
    youtubeDir = root;
  } else if (fsSync.existsSync(path.join(root, 'workspace', 'youtube'))) {
    youtubeDir = path.join(root, 'workspace', 'youtube');
  } else if (fsSync.existsSync(path.join(root, 'workspace'))) {
    youtubeDir = path.join(root, 'workspace', 'youtube');
  } else if (fsSync.existsSync(path.join(root, 'youtube'))) {
    youtubeDir = path.join(root, 'youtube');
  } else {
    youtubeDir = path.join(root, 'workspace', 'youtube');
  }

  // Asegurar existencia física de la carpeta youtube
  try {
    if (!fsSync.existsSync(youtubeDir)) {
      fsSync.mkdirSync(youtubeDir, { recursive: true });
    }
  } catch {}

  return youtubeDir;
}

export async function detectDependencies(): Promise<DependencyInfo[]> {
  const manifestPath = path.join(process.cwd(), 'harness', 'setup', 'manifest.json');
  const manifestData = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestData);

  const results: DependencyInfo[] = [];
  const localBin = getLocalBinPath();

  for (const dep of manifest.dependencies) {
    let output = '';
    let isInstalled = false;
    let current_version = 'unknown';

    // Build the check command. Try local isolated path first if it's a binary
    let cmdToRun = dep.check_command;
    if (dep.type === 'binary') {
      const localExe = process.platform === 'win32' ? dep.local_path_win : dep.local_path_mac;
      if (localExe && localBin) {
        const fullPath = path.join(localBin, localExe);
        try {
          // Check if local file exists
          await fs.access(fullPath);
          // If it exists, replace the command prefix with the absolute path
          // E.g. "ffmpeg -version" -> "C:\...\ffmpeg.exe -version"
          cmdToRun = `"${fullPath}" ${dep.check_command.split(' ').slice(1).join(' ')}`;
        } catch (e) {
          // File doesn't exist locally, will fallback to global check_command
        }
      }
    }

    try {
      const { stdout, stderr } = await execAsync(cmdToRun);
      output = (stdout || stderr).trim();
      isInstalled = true;
      
      // Basic version extraction logic
      const versionMatch = output.match(/(\d+\.\d+(\.\d+)?)/);
      if (versionMatch) {
        current_version = versionMatch[1];
      } else if (output.toLowerCase().includes('yt-dlp')) {
        const dateMatch = output.match(/(\d{4}\.\d{2}\.\d{2})/);
        if (dateMatch) current_version = dateMatch[1];
      }

    } catch (err: any) {
      // Missing
    }

    if (isInstalled) {
      results.push({
        id: dep.id,
        name: dep.name,
        status: 'installed',
        current_version,
        required_version: dep.min_version
      });
    } else {
      results.push({
        id: dep.id,
        name: dep.name,
        status: 'missing',
        required_version: dep.min_version
      });
    }
  }

  return results;
}
