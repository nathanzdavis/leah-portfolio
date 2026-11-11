import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { githubConfigured, listPublishedVersions } from '@/lib/github';

export async function GET() {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!githubConfigured()) return NextResponse.json([]);
  const commits = await listPublishedVersions();
  return NextResponse.json(commits.map((item) => ({ sha: item.sha, message: item.commit.message, date: item.commit.author.date, author: item.commit.author.name, url: item.html_url })));
}
