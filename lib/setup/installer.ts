export async function installBinary(
  id: string,
  tempPath: string,
  manifest: any,
  logCb?: (msg: string) => void
): Promise<void> {
  if (logCb) logCb(`Instalando binario ${id}...`);
}

export async function installPipPackage(
  id: string,
  manifest: any,
  logCb?: (msg: string) => void
): Promise<void> {
  if (logCb) logCb(`Instalando paquete pip ${id}...`);
}
