import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { migrateGalleries } from '../lib/editor-gallery.js';

function collect(node, predicate) {
  return [
    ...(predicate(node) ? [node] : []),
    ...(Array.isArray(node?.components) ? node.components.flatMap(child => collect(child, predicate)) : []),
  ];
}

test('the existing photo groups migrate once and preserve photo order, captions and video content', async () => {
  const site = JSON.parse(await readFile(new URL('../content/site.json', import.meta.url), 'utf8'));
  const migrated = migrateGalleries(site);
  assert.deepEqual(migrateGalleries(migrated), migrated);
  for (const [pageId, legacyClass] of [['home', 'services-images'], ['gallery', 'picture-grid']]) {
    const root = (doc) => {
      const page = doc.projectData.pages.find(page => page.id === pageId);
      return page.component ?? page.frames[0].component;
    };
    const [original] = collect(root(site), node => node?.classes?.includes(legacyClass));
    const [gallery] = collect(root(migrated), node => node?.attributes?.['data-editor-gallery']);
    assert.ok(gallery);
    assert.equal(gallery.attributes['data-gallery-layout'], 'original');
    const photos = node => collect(node, child => child?.type === 'image')
      .map(child => [child.attributes.src.replace(/^\//, ''), child.attributes.alt || '']);
    assert.deepEqual(photos(gallery), photos(original));
    assert.equal(collect(gallery, node => node?.attributes?.['data-gallery-photo']).length, photos(original).length);
    if (pageId === 'home') {
      const [wrapper] = collect(root(migrated), node => node?.attributes?.['data-gallery-container'] === 'home');
      assert.equal(wrapper.components[0], gallery);
      assert.equal(wrapper.attributes['data-editor-gallery'], undefined);
      assert.equal(gallery.attributes['data-gallery-kind'], 'home');
    }
    assert.deepEqual(collect(root(migrated), node => node?.tagName === 'iframe'),
      collect(root(site), node => node?.tagName === 'iframe'));
  }
});
