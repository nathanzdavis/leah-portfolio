import { NextResponse } from 'next/server';
import { assertSameOrigin, isAuthenticated } from '@/lib/auth';
import { loadDraft, saveDraft } from '@/lib/draft-store';

export const runtime = 'nodejs';
export async function GET() { if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); return NextResponse.json(await loadDraft()); }
export async function PUT(request) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertSameOrigin(request); const doc = await request.json(); await saveDraft(doc); return NextResponse.json({ ok: true, savedAt: new Date().toISOString() }); }
  catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
