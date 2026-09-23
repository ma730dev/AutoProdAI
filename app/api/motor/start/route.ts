import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { getLocalBinPath } from '@/harness/setup/detector';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const port = body.port || 8000;
    const cwd = path.join(process.cwd(), 'controlador');

    const localBin = getLocalBinPath();
    const workspacePython = path.join(process.cwd(), '.autoprod', 'python', 'python.exe');

    let pythonCmd = 'python';

    if (fs.existsSync(workspacePython)) {
      pythonCmd = workspacePython;
    } else if (localBin) {
      const winPython = path.join(localBin, 'python.exe');
      const macPython = path.join(localBin, 'python3');
      if (fs.existsSync(winPython)) {
        pythonCmd = winPython;
      } else if (fs.existsSync(macPython)) {
        pythonCmd = macPython;
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'AutoProd no está instalado. Ve a Configuración (Engranaje) > Sistema > Instalar Motor para configurarlo.' },
        { status: 400 }
      );
    }

    const hasPythonSource = fs.existsSync(path.join(cwd, 'main.py'));

    // Si hay procesos residuales huérfanos del binario antiguo autoprod-motor.exe, los cerramos para liberar el puerto
    if (process.platform === 'win32') {
      try {
        const { execSync } = await import('child_process');
        execSync('taskkill /F /IM autoprod-motor.exe', { stdio: 'ignore' });
      } catch {
        // Silencioso si no existía el proceso
      }
    }

    // Si tenemos los scripts fuente de Python y el interprete, ejecutamos el código vivo
    if (hasPythonSource && pythonCmd) {
      const child = spawn(pythonCmd, ['-m', 'uvicorn', 'main:app', '--port', String(port)], {
        cwd,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: { ...process.env, PATH: `${localBin}${path.delimiter}${process.env.PATH}` }
      });
      child.unref();
      return NextResponse.json({ success: true, message: 'Motor local arrancado en segundo plano (Python)' });
    }

    const compiledExe = path.join(process.cwd(), 'dist', 'autoprod-motor.exe');
    const localExe = path.join(process.cwd(), 'autoprod-motor.exe');

    if (fs.existsSync(compiledExe) || fs.existsSync(localExe)) {
      const exeToRun = fs.existsSync(compiledExe) ? compiledExe : localExe;
      const child = spawn(exeToRun, [], {
        cwd: path.dirname(exeToRun),
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: { ...process.env, PATH: `${localBin}${path.delimiter}${process.env.PATH}` }
      });
      child.unref();
      return NextResponse.json({ success: true, message: 'Motor compilado arrancado en segundo plano' });
    }

    return NextResponse.json(
      { success: false, error: 'No se encontró el ejecutable ni el entorno Python para arrancar el motor local.' },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
