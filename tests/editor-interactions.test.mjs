import assert from 'node:assert/strict';
import test from 'node:test';
import grapesjs from 'grapesjs';
import { setupDragModes } from '../lib/editor-interactions.js';
import { getImageTarget, publishedMedia, replaceImage, replaceImageTarget } from '../lib/editor-media.js';

test('toolbar Shift enables unsnapped movement and normal drag stays in layout mode', () => {
  const editor = grapesjs.init({ headless: true, storageManager: false });
  try {
    let onMouseDown;
    editor.Canvas.getElement = () => ({
      addEventListener: (_name, callback) => { onMouseDown = callback; },
    });
    setupDragModes(editor, () => {});
    const [link] = editor.addComponents({ type: 'link' });
    const normal = { target: link, event: {} };
    editor.trigger('command:run:before:tlb-move', { options: normal });
    assert.equal(normal.mode, '');

    onMouseDown({ shiftKey: true });
    const free = { target: link, event: {} };
    editor.trigger('command:run:before:tlb-move', { options: free });
    editor.trigger('command:run:before:core:component-drag', { options: free });
    assert.equal(free.mode, 'translate');
    assert.deepEqual(free.dragger.snapGuides, { x: 0, y: 0 });

    const [image] = editor.addComponents({ type: 'image' });
    const imageDrag = { target: image, event: { shiftKey: false } };
    editor.trigger('command:run:before:tlb-move', { options: imageDrag });
    assert.equal(imageDrag.abort, true);
  } finally {
    editor.destroy();
  }
});

test('image replacement updates the GrapesJS source without touching its parent or siblings', () => {
  const editor = grapesjs.init({ headless: true, storageManager: false });
  try {
    const [parent] = editor.addComponents({
      components: [
        { type: 'image', attributes: { src: '/old.jpg', alt: 'Cello', srcset: '/old-large.jpg 1000w' } },
        { tagName: 'span' },
      ],
    });
    const [image, caption] = parent.components().models;
    replaceImage(image, '/replacement.webp');
    assert.deepEqual(parent.components().models, [image, caption]);
    assert.equal(image.get('src'), '/replacement.webp');
    assert.equal(image.getAttributes().src, '/replacement.webp');
    assert.equal(image.getAttributes().alt, 'Cello');
    assert.equal(image.getAttributes().srcset, undefined);
  } finally {
    editor.destroy();
  }
});

test('a hero background can be replaced and published without changing its other styles', () => {
  const editor = grapesjs.init({ headless: true, storageManager: false });
  try {
    const [hero] = editor.addComponents({
      tagName: 'section',
      style: { 'background-size': 'cover' },
      components: [{ tagName: 'h1' }],
    });
    const element = { ownerDocument: { defaultView: {
      getComputedStyle: () => ({ backgroundImage: 'linear-gradient(black, transparent), url("old.jpg")' }),
    } } };
    hero.getEl = () => element;
    const [heading] = hero.components().models;
    const target = getImageTarget(hero);
    const src = '/api/editor/media?path=public%2Fstatic%2Fuploads%2Fnew.webp';
    replaceImageTarget(target, src);
    assert.equal(hero.components().at(0), heading);
    assert.equal(hero.getStyle()['background-size'], 'cover');
    assert.equal(hero.getStyle()['background-image'], `linear-gradient(black, transparent), url("${src}")`);
    const published = JSON.stringify(publishedMedia(editor.getProjectData()));
    assert.match(published, /static\/uploads\/new\.webp/);
    assert.doesNotMatch(published, /api\/editor\/media/);
    assert.equal(publishedMedia(src), '/static/uploads/new.webp');
  } finally {
    editor.destroy();
  }
});

test('an empty div can gain a background image without losing its background color', () => {
  const editor = grapesjs.init({ headless: true, storageManager: false });
  try {
    const [div] = editor.addComponents({ tagName: 'div', style: { 'background-color': '#d18966' } });
    const target = getImageTarget(div);
    assert.equal(target.background, 'none');
    replaceImageTarget(target, '/static/uploads/new.webp');
    assert.equal(div.getStyle()['background-image'], 'url("/static/uploads/new.webp")');
    assert.equal(div.getStyle()['background-size'], 'cover');
    assert.equal(div.getStyle()['background-color'], '#d18966');
  } finally {
    editor.destroy();
  }
});
