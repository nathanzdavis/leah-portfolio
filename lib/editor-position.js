const containers = new Set(['div', 'main', 'section', 'header', 'footer', 'article', 'aside', 'body', 'figure', 'li']);
const round = number => Math.round(number * 100) / 100;
const px = number => `${round(number)}px`;

export function anchorOffsets(rect, bounds) {
  const left = rect.left - bounds.left;
  const right = bounds.right - rect.right;
  const top = rect.top - bounds.top;
  const bottom = bounds.bottom - rect.bottom;
  const useRight = (rect.left + rect.right) > (bounds.left + bounds.right);
  const useBottom = (rect.top + rect.bottom) > (bounds.top + bounds.bottom);
  return {
    left: useRight ? 'auto' : px(left), right: useRight ? px(right) : 'auto',
    top: useBottom ? 'auto' : px(top), bottom: useBottom ? px(bottom) : 'auto',
  };
}

function styleFor(element) {
  return element.ownerDocument.defaultView.getComputedStyle(element);
}

export function readPosition(model) {
  const element = model?.getEl();
  if (!element?.getBoundingClientRect || !model.parent()) return null;
  const rect = element.getBoundingClientRect();
  const view = element.ownerDocument.defaultView;
  const style = styleFor(element);
  const specified = model.getStyle?.() || {};
  const side = (start, end) => (specified[end] ?? style[end]) !== 'auto'
    && (specified[start] ?? style[start]) === 'auto' ? end : start;
  const anchor = style.position === 'absolute'
    ? `${side('top', 'bottom')} ${side('left', 'right')}`
    : null;
  return { x: round(rect.left + view.scrollX), y: round(rect.top + view.scrollY), anchor };
}

export function setPagePosition(model, x, y) {
  const current = readPosition(model);
  if (!current || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const style = styleFor(model.getEl());
  const dx = x - current.x;
  const dy = y - current.y;
  if (!dx && !dy) return true;

  if (current.anchor) {
    const [vertical, horizontal] = current.anchor.split(' ');
    model.addStyle({
      [horizontal]: px((parseFloat(style[horizontal]) || 0) + (horizontal === 'right' ? -dx : dx)),
      [vertical]: px((parseFloat(style[vertical]) || 0) + (vertical === 'bottom' ? -dy : dy)),
    });
  } else {
    const translations = (style.translate || '').split(/\s+/);
    const element = model.getEl();
    const [left, top] = translations.map((value, axis) => {
      const offset = Number.parseFloat(value) || 0;
      return value.endsWith('%') ? offset * (axis === 0 ? element.offsetWidth : element.offsetHeight) / 100 : offset;
    });
    model.addStyle({
      translate: `${px(left + dx)} ${px((top || 0) + dy)}`,
      ...(style.display === 'inline' && model.get('tagName') !== 'img' ? { display: 'inline-block' } : {}),
    });
  }
  return true;
}

function targetUnderPointer(editor, model, event) {
  const element = model.getEl();
  const doc = element.ownerDocument;
  const frame = editor.Canvas.getFrameEl();
  const frameBounds = frame.getBoundingClientRect();
  const inFrame = event.target?.ownerDocument === doc || event.view === doc.defaultView;
  const x = inFrame ? event.clientX : (event.clientX - frameBounds.left) * frame.clientWidth / frameBounds.width;
  const y = inFrame ? event.clientY : (event.clientY - frameBounds.top) * frame.clientHeight / frameBounds.height;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= frame.clientWidth || y >= frame.clientHeight) return null;
  const hits = new Set(doc.elementsFromPoint(x, y).filter(hit => !element.contains(hit)));
  const matches = new Map();
  const root = editor.getWrapper();
  function visit(candidate) {
    if (candidate === model) return;
    const tag = candidate.get('tagName');
    const el = candidate.getEl();
    if (hits.has(el) && (candidate === root || (containers.has(tag) && candidate.get('droppable')))) {
      if (!el.closest('.page-header__nav, .page-footer__nav')) matches.set(el, candidate);
    }
    candidate.components().forEach(visit);
  }
  visit(root);
  return Array.from(hits, hit => matches.get(hit)).find(Boolean) || null;
}

export function anchorFreeDrop(editor, model, event, before, originalStyle) {
  const element = model.getEl();
  if (!element || !event || !Number.isFinite(event.clientX)) return;
  const rect = element.getBoundingClientRect();
  if (Math.abs(rect.left - before.left) < 0.5 && Math.abs(rect.top - before.top) < 0.5) return;
  // Site navigation links are rendered in their original nav on publish.
  if (element.closest('.page-header__nav, .page-footer__nav')) return;
  const target = targetUnderPointer(editor, model, event);
  if (!target) return;
  const oldParent = model.parent();
  const imageInFlow = model.get('tagName') === 'img' && !['absolute', 'fixed'].includes(styleFor(element).position);
  if (imageInFlow && oldParent === target) return;
  const oldElement = imageInFlow && oldParent?.getEl();
  const oldHeight = oldElement?.offsetHeight;
  const container = target.getEl();
  const isPage = target === editor.getWrapper();
  if (!isPage && styleFor(container).position === 'static') target.addStyle({ position: 'relative' });
  const behindContent = Number(styleFor(element).zIndex) < 0;
  if (!isPage && behindContent) target.addStyle({ isolation: 'isolate' });
  const parentRect = container.getBoundingClientRect();
  const view = container.ownerDocument.defaultView;
  const left = isPage ? -view.scrollX : parentRect.left + container.clientLeft - container.scrollLeft;
  const top = isPage ? -view.scrollY : parentRect.top + container.clientTop - container.scrollTop;
  const right = left + (isPage ? container.ownerDocument.documentElement.clientWidth : container.clientWidth);
  const anchors = anchorOffsets(rect, { left, top, right, bottom: top + container.clientHeight });
  const transform = originalStyle.transform?.replace(/\btranslate(?:X|Y)?\([^)]*\)/gi, '').trim();
  model.addStyle({
    position: 'absolute', width: px(element.offsetWidth || rect.width), height: px(element.offsetHeight || rect.height),
    'box-sizing': 'border-box', margin: '0', transform: transform || 'none', translate: 'none',
    ...anchors,
    ...(isPage ? { top: px(rect.top - top), bottom: 'auto', ...(behindContent ? { 'z-index': 'auto' } : {}) } : {}),
  });
  if (oldParent !== target) model.move(target);
  if (oldHeight > oldElement?.offsetHeight) {
    const style = styleFor(oldElement);
    const extra = style.boxSizing === 'border-box' ? 0 : oldHeight - oldElement.clientHeight
      + (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    oldParent.addStyle({ 'min-height': px(oldHeight - extra) });
  }
  if (transform && model.getEl()?.isConnected) {
    setPagePosition(model, round(rect.left + view.scrollX), round(rect.top + view.scrollY));
  }
}
