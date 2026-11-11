import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDraftBranch, githubConfigured, readJsonFile, writeJsonFile } from './github.js';
import { hashPassword } from './password.js';

const credentialPath = '.editor/auth.json';
const localCredentialPath = path.join(process.cwd(), credentialPath);

function key() {
  const secret = process.env.EDITOR_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('EDITOR_SESSION_SECRET must be at least 32 characters.');
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptCredential(hash) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(hash, 'utf8'), cipher.final()]);
  return { version: 1, algorithm: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64'), updatedAt: new Date().toISOString() };
}

export function decryptCredential(record) {
  if (record?.version !== 1 || record.algorithm !== 'aes-256-gcm') throw new Error('Unsupported credential record.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.data, 'base64')), decipher.final()]).toString('utf8');
}

export async function getActivePasswordHash() {
  if (!githubConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      try { return decryptCredential(JSON.parse(await fs.readFile(localCredentialPath, 'utf8'))); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return process.env.EDITOR_PASSWORD_HASH || null;
  }
  await ensureDraftBranch();
  const branch = process.env.GITHUB_DRAFT_BRANCH || 'editor-drafts';
  try { return decryptCredential((await readJsonFile(credentialPath, branch)).value); }
  catch (error) { if (error.status === 404) return process.env.EDITOR_PASSWORD_HASH || null; throw error; }
}

export async function setActivePassword(password) {
  if (!githubConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('GitHub credential storage is not configured.');
    await fs.mkdir(path.dirname(localCredentialPath), { recursive: true });
    await fs.writeFile(localCredentialPath, `${JSON.stringify(encryptCredential(hashPassword(password)), null, 2)}\n`);
    return;
  }
  await ensureDraftBranch();
  const branch = process.env.GITHUB_DRAFT_BRANCH || 'editor-drafts';
  await writeJsonFile(credentialPath, encryptCredential(hashPassword(password)), branch, 'Update encrypted editor credential');
}
