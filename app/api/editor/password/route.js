import { NextResponse } from 'next/server';
import { assertSameOrigin, isAuthenticated, verifyPassword } from '@/lib/auth';
import { setActivePassword } from '@/lib/credential-store';

export const runtime = 'nodejs';

export async function POST(request) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    assertSameOrigin(request);
    const { currentPassword, newPassword } = await request.json();
    if (!await verifyPassword(String(currentPassword || ''))) return NextResponse.json({ error: 'The current password is incorrect.' }, { status: 403 });
    if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128) throw new Error('The new password must be between 12 and 128 characters.');
    if (newPassword === currentPassword) throw new Error('Choose a different password.');
    await setActivePassword(newPassword);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
