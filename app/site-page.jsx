import { notFound } from 'next/navigation';
import PublicRenderer from '@/components/PublicRenderer';
import PublicInteractions from '@/components/PublicInteractions';
import { findPage, readPublishedSite } from '@/lib/site-data';
import { projectCss } from '@/lib/project-css';

export async function generateSiteMetadata(slug) {
  const found = findPage(await readPublishedSite(), slug);
  return found ? { title: found.meta.title, description: found.meta.description } : {};
}

export default async function SitePage({ slug }) {
  const doc = await readPublishedSite();
  const found = findPage(doc, slug);
  if (!found) notFound();
  return <>
    {found.meta.cssFiles.map((href) => <link key={href} rel="stylesheet" href={href} />)}
    <style dangerouslySetInnerHTML={{ __html: projectCss(doc.projectData) }} />
    <PublicRenderer component={found.page.component} pages={doc.pages} slug={found.meta.slug} />
    <PublicInteractions />
  </>;
}
