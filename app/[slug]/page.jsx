import SitePage, { generateSiteMetadata } from '../site-page';
import { readPublishedSite } from '@/lib/site-data';

export async function generateStaticParams() {
  const doc = await readPublishedSite();
  return doc.pages.filter((p) => p.slug !== 'home').map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  return generateSiteMetadata((await params).slug);
}

export default async function DynamicPage({ params }) {
  return <SitePage slug={(await params).slug} />;
}
