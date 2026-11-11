import fs from 'node:fs/promises';
import path from 'node:path';
import { githubConfigured, loadDraftFromGithub, saveDraftToGithub } from './github';
import { readPublishedSite } from './site-data';
import { validateSiteDocument } from './site-schema';

const localPath = path.join(process.cwd(), '.editor', 'draft.json');

export async function loadDraft() {
  let value = null;
  if (githubConfigured()) value = await loadDraftFromGithub();
  else if (process.env.NODE_ENV !== 'production') {
    try { value = JSON.parse(await fs.readFile(localPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return validateSiteDocument(value || await readPublishedSite());
}

export async function saveDraft(doc) {
  const validated = validateSiteDocument(doc);
  if (githubConfigured()) return saveDraftToGithub(validated);
  if (process.env.NODE_ENV === 'production') throw new Error('GITHUB_EDITOR_TOKEN is required to persist production drafts.');
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, `${JSON.stringify(validated, null, 2)}\n`);
  return { local: true };
}
