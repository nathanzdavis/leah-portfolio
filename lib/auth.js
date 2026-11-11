import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'leah_editor_session';
const MAX_AGE = 60 * 60 * 12;

function secret() {
  const value = process.env.EDITOR_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('EDITOR_SESSION_SECRET must be at least 32 characters.');
  return value;
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({ role: 'owner', exp: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}

export async function isAuthenticated() {
  return verifySessionToken((await cookies()).get(COOKIE)?.value);
}

export async function setSessionCookie() {
  (await cookies()).set(COOKIE, createSessionToken(), { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE });
}

export async function clearSessionCookie() { (await cookies()).delete(COOKIE); }

export function verifyPassword(password) {
  const stored = process.env.EDITOR_PASSWORD_HASH;
  if (!stored) return false;
  const [algorithm, salt, expected] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const requestUrl = new URL(request.url);
  if (new URL(origin).host !== requestUrl.host) throw new Error('Invalid request origin.');
}
