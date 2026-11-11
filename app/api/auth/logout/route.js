import { NextResponse } from 'next/server';
import { assertSameOrigin, clearSessionCookie } from '@/lib/auth';
export async function POST(request) { assertSameOrigin(request); await clearSessionCookie(); return NextResponse.json({ ok: true }); }
