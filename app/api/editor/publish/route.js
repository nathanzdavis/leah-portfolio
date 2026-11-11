import { NextResponse } from 'next/server';
import { assertSameOrigin, isAuthenticated } from '@/lib/auth';
import { githubConfigured, publishToGithub } from '@/lib/github';
import { saveDraft } from '@/lib/draft-store';
import { validateSiteDocument } from '@/lib/site-schema';

let publishing = false;
function publishedMedia(value) {
  if (Array.isArray(value)) return value.map(publishedMedia);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,publishedMedia(item)]));
  if (typeof value === 'string' && value.startsWith('/api/editor/media?path=')) {
    const repoPath = decodeURIComponent(value.slice(value.indexOf('=') + 1));
    return repoPath.startsWith('public/') ? `/${repoPath.slice(7)}` : value;
  }
  return value;
}
export async function POST(request) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (publishing) return NextResponse.json({ error: 'A publish is already in progress.' }, { status: 409 });
  try {
    assertSameOrigin(request); publishing = true;
    if (!githubConfigured()) throw new Error('GitHub publishing is not configured.');
    const doc = validateSiteDocument(publishedMedia(await request.json()));
    const published = { ...doc, revision: doc.revision + 1, updatedAt: new Date().toISOString() };
    await saveDraft(published);
    const commit = await publishToGithub(published);
    const commitSha = commit.sha || commit.object?.sha;
    return NextResponse.json({ ok: true, commitSha, commitUrl: commit.html_url || null, revision: published.revision, deployment: 'pending' });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
  finally { publishing = false; }
}
