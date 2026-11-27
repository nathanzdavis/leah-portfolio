import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraftHistory } from '../lib/editor-history.js';
import { anchorFreeDrop, anchorOffsets, readPosition, setPagePosition } from '../lib/editor-position.js';

test('undo and redo survive refresh and ignore a newer server draft', () => {
  const cache = new Map();
  const storage = { getItem: key => cache.get(key), setItem: (key, value) => cache.set(key, value) };
  const timeline = createDraftHistory(storage, 'server-1', 'before', 'home');
  timeline.record('after', 'about');
  timeline.saved('server-2');

  const reload = createDraftHistory(storage, 'server-2', 'after', 'home');
  assert.deepEqual(reload.step(-1), { data: 'before', pageId: 'home' });
  const reloadAfterUndo = createDraftHistory(storage, 'server-2', 'after', 'home');
  assert.equal(reloadAfterUndo.current().data, 'before');
  assert.deepEqual(reloadAfterUndo.step(1), { data: 'after', pageId: 'about' });

  const remoteEdit = createDraftHistory(storage, 'server-3', 'someone else’s changes', 'home');
  assert.equal(remoteEdit.step(-1), null);
});

test('free placement chooses the nearest horizontal and vertical edges of its container', () => {
  const bounds = { left: 100, top: 200, right: 600, bottom: 500 };
  assert.deepEqual(anchorOffsets({ left: 500, top: 425, right: 560, bottom: 475 }, bounds),
    { left: 'auto', right: '40px', top: 'auto', bottom: '25px' });
  assert.deepEqual(anchorOffsets({ left: 110, top: 210, right: 170, bottom: 260 }, bounds),
    { left: '10px', right: 'auto', top: '10px', bottom: 'auto' });
});

test('precise page coordinates honor page scroll and existing right and bottom anchors', () => {
  const mockStyle = { position: 'absolute', top: 'auto', bottom: '24px', left: 'auto', right: '10px' };
  const view = { scrollX: 0, scrollY: 100, getComputedStyle: () => mockStyle };
  let applied;
  const model = {
    parent: () => ({}),
    getEl: () => ({ getBoundingClientRect: () => ({ left: 100, top: 150 }), ownerDocument: { defaultView: view } }),
    addStyle: values => { applied = values; },
  };
  assert.deepEqual(readPosition(model), { x: 100, y: 250, anchor: 'bottom right' });
  assert.ok(setPagePosition(model, 95, 264));
  assert.deepEqual(applied, { right: '15px', bottom: '10px' });
});

test('a free drop reparents to the deepest eligible container and keeps the dropped coordinates', () => {
  const view = { scrollX: 0, scrollY: 0, getComputedStyle: element => ({ position: element.position }) };
  const doc = { defaultView: view };
  function box(left, top, width, height) {
    return {
      ownerDocument: doc, clientWidth: width, clientHeight: height, offsetWidth: width, offsetHeight: height,
      clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0, position: 'static',
      getBoundingClientRect: () => ({ left, top, right: left + width, bottom: top + height, width, height }),
      closest: () => null,
      contains(element) { return element === this; },
    };
  }
  function component(tag, element, children = []) {
    const styles = {};
    return {
      styles, get: key => key === 'tagName' ? tag : true, getEl: () => element,
      components: () => children, addStyle: value => Object.assign(styles, value),
    };
  }
  const image = component('img', box(420, 280, 60, 40));
  const oldParent = component('div', box(0, 0, 150, 150), [image]);
  const inner = component('div', box(250, 100, 250, 250));
  const section = component('section', box(200, 75, 500, 400), [inner]);
  const root = component('body', box(0, 0, 800, 600), [oldParent, section]);
  image.parent = () => oldParent;
  image.move = target => { image.parent = () => target; };
  doc.elementsFromPoint = () => [image.getEl(), inner.getEl(), section.getEl(), root.getEl()];
  const editor = { getWrapper: () => root, Canvas: { getFrameEl: () => root.getEl() } };
  anchorFreeDrop(editor, image, { view, clientX: 430, clientY: 300 }, { left: 20, top: 20 }, {});
  assert.equal(image.parent(), inner);
  assert.equal(image.styles.right, '20px');
  assert.equal(image.styles.bottom, '30px');
  assert.equal(inner.styles.position, 'relative');
});
