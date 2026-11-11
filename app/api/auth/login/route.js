import { NextResponse } from 'next/server';
import { assertSameOrigin, setSessionCookie, verifyPassword } from '@/lib/auth';

const attempts = new Map();
export async function POST(request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 403 }); }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
  const now = Date.now(); const record = attempts.get(ip) || { count: 0, reset: now + 15 * 60_000 };
  if (record.reset < now) { record.count = 0; record.reset = now + 15 * 60_000; }
  if (record.count >= 8) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  const { password } = await request.json();
  if (!await verifyPassword(String(password || ''))) { record.count += 1; attempts.set(ip, record); return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 }); }
  attempts.delete(ip); await setSessionCookie();
  return NextResponse.json({ ok: true });
}
