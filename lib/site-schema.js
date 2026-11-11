import { z } from 'zod';

const pageMeta = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(100),
  description: z.string().max(300).default(''),
  navVisible: z.boolean().default(true),
  cssFiles: z.array(z.string()).default([]),
});

export const siteDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
  site: z.object({
    title: z.string().min(1).max(100),
    description: z.string().max(300),
  }),
  pages: z.array(pageMeta).min(1),
  projectData: z.object({
    assets: z.array(z.any()).default([]),
    styles: z.array(z.any()).default([]),
    pages: z.array(z.any()).min(1),
  }).passthrough(),
}).superRefine((doc, ctx) => {
  const ids = new Set();
  const slugs = new Set();
  for (const page of doc.pages) {
    if (ids.has(page.id)) ctx.addIssue({ code: 'custom', message: `Duplicate page id: ${page.id}` });
    if (slugs.has(page.slug)) ctx.addIssue({ code: 'custom', message: `Duplicate page slug: ${page.slug}` });
    ids.add(page.id); slugs.add(page.slug);
    const projectPage = doc.projectData.pages.find((item) => item.id === page.id);
    if (!projectPage) {
      ctx.addIssue({ code: 'custom', message: `Missing project page: ${page.id}` });
      continue;
    }
    if (!(projectPage.component ?? projectPage.frames?.[0]?.component)) {
      ctx.addIssue({ code: 'custom', message: `Project page has no renderable component: ${page.id}` });
    }
  }
});

export function validateSiteDocument(value) {
  return siteDocumentSchema.parse(value);
}
