import { NextResponse } from 'next/server';
import { getWorkspacePath } from '@/lib/setup/detector';

export async function GET() {
  try {
    const workspace = getWorkspacePath();
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace configured' }, { status: 404 });
    }
    return NextResponse.json({ success: true, path: workspace });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
