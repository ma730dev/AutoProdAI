import { NextResponse } from 'next/server';
import { detectDependencies } from '@/lib/setup/detector';

export async function GET() {
  try {
    const dependencies = await detectDependencies();
    const allInstalled = dependencies.every(dep => dep.status === 'installed');
    
    return NextResponse.json({
      status: allInstalled ? 'ready' : 'missing_deps',
      dependencies
    });
  } catch (error: any) {
    console.error('Error fetching setup status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
