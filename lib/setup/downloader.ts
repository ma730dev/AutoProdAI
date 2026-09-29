import fs from 'fs/promises';

export async function downloadFile(
  url: string,
  targetPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  if (!url) return;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error descargando archivo (${response.status}: ${response.statusText})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(targetPath, Buffer.from(arrayBuffer));
  if (onProgress) onProgress(100);
}
