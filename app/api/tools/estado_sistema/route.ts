import { NextRequest, NextResponse } from 'next/server';
import { detectDependencies } from '@/lib/setup/detector';
import path from 'path';
import fs from 'fs/promises';

export async function POST(req: NextRequest) {
  try {
    const dependencies = await detectDependencies();
    
    // Read manifest to get descriptions
    const manifestPath = path.join(process.cwd(), 'lib', 'setup', 'manifest.json');
    const manifestData = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestData);

    const report = dependencies.map(dep => {
      const def = manifest.dependencies.find((d: any) => d.id === dep.id);
      return {
        id: dep.id,
        name: dep.name,
        status: dep.status,
        description: def?.description || 'Herramienta del sistema.'
      };
    });

    return NextResponse.json({
      success: true,
      system_status: report,
      instructions_for_ai: "Si alguna herramienta importante tiene status 'missing', indícale al usuario que no puedes proceder porque falta esa dependencia y explícale su propósito usando el campo description. Pídele que vaya a la pestaña 'Sistema/Setup' en Configuración (engranaje) y haga clic en 'Instalar Motor'."
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
