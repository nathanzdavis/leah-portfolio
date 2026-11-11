import fs from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import { validateSiteDocument } from './site-schema';

export const readPublishedSite = cache(async () => {
  const file = path.join(process.cwd(), 'content', 'site.json');
  return validateSiteDocument(JSON.parse(await fs.readFile(file, 'utf8')));
});

export function findPage(doc, slug) {
  const normalized = !slug || slug === 'home' ? 'home' : slug;
  const meta = doc.pages.find((page) => page.slug === normalized);
  if (!meta) return null;
  const page = doc.projectData.pages.find((item) => item.id === meta.id);
  return page ? { meta, page } : null;
}
