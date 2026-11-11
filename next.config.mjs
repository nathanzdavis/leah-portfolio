import path from 'node:path';
export default {
  turbopack: { root: path.resolve('.') },
  async redirects() {
    return ['home','about','repertoire','gallery','sheet-music'].map((slug) => ({
      source: `/${slug}.html`,
      destination: slug === 'home' ? '/' : `/${slug}`,
      permanent: true,
    }));
  },
};
