import assert from 'node:assert/strict';
import test from 'node:test';
import grapesjs from 'grapesjs';
import { setupDragModes } from '../lib/editor-interactions.js';
import { replaceImage } from '../lib/editor-media.js';

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
