import crypto from 'node:crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPasswordHash(password, stored) {
  if (!stored) return false;
  const [algorithm, salt, expected] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
