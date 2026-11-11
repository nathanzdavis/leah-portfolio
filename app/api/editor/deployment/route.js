import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sha = new URL(request.url).searchParams.get('sha');
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId || !sha) return NextResponse.json({ state: 'unknown', message: 'Vercel status tracking is not configured.' });
  const team = process.env.VERCEL_TEAM_ID ? `&teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : '';
  const response = await fetch(`https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=20${team}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) return NextResponse.json({ state: 'error', message: `Vercel API returned ${response.status}.` }, { status: 502 });
  const data = await response.json();
  const deployment = data.deployments?.find((item) => item.meta?.githubCommitSha === sha || item.meta?.gitCommitSha === sha);
  if (!deployment) return NextResponse.json({ state: 'pending', message: 'Waiting for Vercel to detect the commit.' });
  const state = String(deployment.readyState || deployment.state || 'QUEUED').toLowerCase();
  return NextResponse.json({ state, url: deployment.url ? `https://${deployment.url}` : null, createdAt: deployment.createdAt });
}
