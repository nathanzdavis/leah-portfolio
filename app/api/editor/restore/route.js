import { NextResponse } from 'next/server';
import { assertSameOrigin, isAuthenticated } from '@/lib/auth';
import { readPublishedVersion } from '@/lib/github';
import { saveDraft } from '@/lib/draft-store';
import { validateSiteDocument } from '@/lib/site-schema';

export async function POST(request) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertSameOrigin(request); const { sha } = await request.json(); if (!/^[a-f0-9]{40}$/i.test(sha)) throw new Error('Invalid version.'); const doc = validateSiteDocument(await readPublishedVersion(sha)); await saveDraft({ ...doc, updatedAt: new Date().toISOString() }); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
