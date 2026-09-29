import { NextRequest, NextResponse } from 'next/server';
import { setupEmitter } from '../stream/route';
import { detectDependencies, getWorkspacePath, getLocalBinPath } from '@/lib/setup/detector';
import { downloadFile } from '@/lib/setup/downloader';
import { installBinary, installPipPackage } from '@/lib/setup/installer';
import { createClient } from '@/lib/supabase/server';
import { db as prisma } from '@/src/prisma/db';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import fsSync from 'fs';
import { PLANS_CONFIG } from '@/lib/pricing-config';

export async function POST(req: NextRequest) {
  try {
    // 1. Validar permisos del plan para descargar el motor local
    const supabase = await createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();

    if (supabaseUser) {
      const userRecord = await prisma.user.findUnique({
        where: { id: supabaseUser.id },
        include: { subscription: { include: { plan: true } } }
      });

      const userPlan = (userRecord?.subscription?.plan?.name || 'FREE') as keyof typeof PLANS_CONFIG;
      const planConfig = PLANS_CONFIG[userPlan] || PLANS_CONFIG.FREE;
      if (!planConfig.canDownloadLocalMotor && userRecord?.role !== 'ADMIN') {
        return NextResponse.json({
          success: false,
          requiresUpgrade: true,
          error: 'La descarga e instalación del Motor Local no está habilitada para tu plan. Actualiza tu plan para desbloquear el motor.'
        }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    if (body.basePath) {
      const configPath = path.join(process.cwd(), '.autoprod-config.json');
      fsSync.writeFileSync(configPath, JSON.stringify({ basePath: body.basePath }, null, 2));
    }

    const manifestPath = path.join(process.cwd(), 'lib', 'setup', 'manifest.json');
    const manifestData = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestData);

    const dependencies = await detectDependencies();
    const toInstall = dependencies.filter(dep => dep.status !== 'installed');

    // Ejecutar instalación y configuración en background
    runSetupTask(toInstall, manifest).catch(err => {
      console.error('Setup task failed:', err);
      setupEmitter.emit('error', err.message);
    });

    return NextResponse.json({ success: true, message: 'Instalación iniciada' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function runSetupTask(toInstall: any[], manifest: any) {
  setupEmitter.emit('log', 'Iniciando proceso de instalación y configuración de AutoProd...');

  try {
    // 1. Crear estructura de carpetas base
    const workspacePath = getWorkspacePath();
    const binPath = getLocalBinPath();

    if (!workspacePath || !binPath) {
      throw new Error("No se ha configurado la ruta de instalación válida.");
    }
    
    setupEmitter.emit('log', `Creando carpeta de proyecto principal en: ${path.dirname(workspacePath)}`);
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(binPath, { recursive: true });
    setupEmitter.emit('log', 'Estructura de carpetas lista (bin, youtube).');
  } catch (err: any) {
    setupEmitter.emit('log', `❌ Error creando carpetas base: ${err.message}`);
    // No detenemos la instalación si falló crear las carpetas, installer.ts también crea bin si es necesario
  }

  if (toInstall.length === 0) {
    setupEmitter.emit('progress', 100);
    setupEmitter.emit('log', '✅ Todas las dependencias ya estaban instaladas. Workspace configurado.');
    setupEmitter.emit('complete');
    return;
  }

  for (let i = 0; i < toInstall.length; i++) {
    const depStatus = toInstall[i];
    const depDef = manifest.dependencies.find((d: any) => d.id === depStatus.id);
    
    if (!depDef) continue;
    
    setupEmitter.emit('progress', Math.round((i / toInstall.length) * 100));

    if (depDef.type === 'binary') {
      setupEmitter.emit('log', `Descargando ${depDef.name}...`);
      const url = process.platform === 'win32' ? depDef.windows_url : depDef.mac_url;
      
      if (!url) {
        setupEmitter.emit('log', `⚠️ No hay URL de descarga para ${depDef.name} en ${process.platform}. Saltando.`);
        continue;
      }
      
      const fileName = url.split('/').pop() || `${depDef.id}.download`;
      const tempPath = path.join(os.tmpdir(), fileName);
      
      try {
        await downloadFile(url, tempPath, (progress) => {
          // You could emit detailed progress here if desired, 
          // but for now just general progress is fine to avoid flooding SSE
        });
        
        await installBinary(depDef.id, tempPath, manifest, (msg) => {
          setupEmitter.emit('log', msg);
        });
      } catch (err: any) {
        setupEmitter.emit('log', `❌ Error instalando ${depDef.name}: ${err.message}`);
      }
    } else if (depDef.type === 'pip') {
      try {
        await installPipPackage(depDef.id, manifest, (msg) => {
          setupEmitter.emit('log', msg);
        });
      } catch (err: any) {
        setupEmitter.emit('log', `❌ Error instalando ${depDef.name}: ${err.message}`);
      }
    }
  }

  setupEmitter.emit('progress', 100);
  setupEmitter.emit('log', '✅ Proceso de instalación completado.');
  setupEmitter.emit('complete');
}
