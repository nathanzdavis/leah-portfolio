import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import grapesjs from 'grapesjs';
import { migrateGalleries } from '../lib/editor-gallery.js';
import { setupGalleryInteractions } from '../lib/editor-interactions.js';
import { galleryPhotoShadow } from '../lib/editor-shadows.js';

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

test('hover and selection resolve to the gallery rather than its photos', () => {
  const editor = grapesjs.init({ headless: true, storageManager: false });
  try {
    const [gallery, outside] = editor.addComponents([
      { tagName: 'div', attributes: { 'data-editor-gallery': 'true' }, components: [
        { type: 'link', components: [{ type: 'image', src: '/photo.jpg' }] },
      ] },
      { type: 'image', src: '/other.jpg' },
    ]);
    const link = gallery.components().at(0);
    const photo = link.components().at(0);
    const model = editor.getModel();
    setupGalleryInteractions(editor);
    model.setHovered(photo, { useValid: true });
    assert.equal(model.getHovered(), gallery);
    model.setHovered(link, { useValid: true });
    assert.equal(model.getHovered(), gallery);
    editor.select(photo, { useValid: true });
    assert.equal(editor.getSelected(), gallery);
    editor.select(link);
    assert.equal(editor.getSelected(), gallery);
    model.setHovered(outside, { useValid: true });
    assert.equal(model.getHovered(), outside);
    editor.select(outside);
    assert.equal(editor.getSelected(), outside);
  } finally {
    editor.destroy();
  }
});

test('a gallery shadow applies to one photo and follows its mask', () => {
  const editor = grapesjs.init({ headless: true, storageManager: false });
  try {
    const [link, other] = editor.addComponents(Array.from({ length: 2 }, () => ({
      type: 'link',
      attributes: { 'data-gallery-photo': 'true' },
      components: [{ type: 'image', src: '/photo.jpg' }],
    })));
    const image = link.components().at(0);
    galleryPhotoShadow(link, 'hard');
    assert.equal(image.getStyle()['box-shadow'], '5px 5px 0px #00000066');
    assert.equal(link.getStyle()['--gallery-photo-shadow'], 'drop-shadow(5px 5px 0px #00000066)');
    assert.equal(link.getAttributes()['data-gallery-shadow'], 'hard');
    assert.equal(other.components().at(0).getStyle()['box-shadow'], undefined);
    galleryPhotoShadow(link, 'none');
    assert.equal(image.getStyle()['box-shadow'], 'none');
    galleryPhotoShadow(link, 'default');
    assert.equal(image.getStyle()['box-shadow'], undefined);
    assert.equal(link.getStyle()['--gallery-photo-shadow'], undefined);
    assert.equal(link.getAttributes()['data-gallery-shadow'], undefined);
  } finally {
    editor.destroy();
  }
});
