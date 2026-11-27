import { getDetachableBackground, getImageTarget } from './editor-media.js';
import { findGallery } from './editor-gallery.js';
import { anchorFreeDrop } from './editor-position.js';

export const blockIcons = {
  text: '¶', heading: 'H', button: '▣', image: '▧', section: '▤',
  columns: '◫', card: '▱', divider: '━', spacer: '↕', video: '▶', gallery: '▦',
};

export const isImage = component => component?.get('tagName') === 'img';

const tooltips = {
  'tlb-move': 'Drag to snap or reorder. Hold Shift to move freely.',
  'tlb-clone': 'Duplicate element',
  'tlb-delete': 'Delete element',
};

export function setupGalleryHover(editor) {
  const model = editor.getModel();
  editor.on('component:hover:before', (component, options) => {
    const gallery = findGallery(component);
    if (!gallery || gallery === component || options.abort) return;
    options.abort = true;
    if (model.getHovered() !== gallery) model.setHovered(gallery);
  });
}

export function setupDragModes(editor, notify) {
  // The floating toolbar forwards a coordinate-adjusted copy of the mouse
  // event. Capture Shift before that copy, which drops native event getters.
  let toolbarShift = false;
  editor.Canvas.getElement().addEventListener('mousedown', event => {
    toolbarShift = event.shiftKey;
  }, true);

  editor.on('command:run:before:tlb-move', ({ options }) => {
    const target = Array.isArray(options.target) ? options.target.at(-1) : options.target || editor.getSelected();
    if (!target) return;
    const freeMove = options.event?.shiftKey ?? toolbarShift;
    toolbarShift = false;
    if (options.abort) return;
    if (isImage(target) && !freeMove) {
      options.abort = true;
      notify('Hold Shift and drag the move handle to move just the image.');
      return;
    }
    if (!freeMove && target.getEl()?.matches('.page-header__nav-link, .page-footer__nav-link')) {
      const parent = target.parent();
      parent?.set('droppable', true, { silent: true });
      target.set('draggable', (source, destination) => source.parent() === destination, { silent: true });
    }
    // Translation keeps the element in its original layout slot and parent.
    options.mode = freeMove ? 'translate' : '';
  });

  editor.on('command:run:before:core:component-drag', ({ options }) => {
    if (options.mode !== 'translate') return;
    options.guidesInfo = 0;
    options.dragger = { ...options.dragger, snapGuides: { x: 0, y: 0 } };
    const element = options.target?.getEl();
    if (element) {
      const before = element.getBoundingClientRect();
      const originalStyle = options.target.getStyle();
      const onEnd = options.onEnd;
      options.onEnd = (event, result, data) => {
        if (!result.cancelled) anchorFreeDrop(editor, options.target, event, before, originalStyle);
        onEnd?.(event, result, data);
      };
    }
    if (element && !isImage(options.target) && element.ownerDocument.defaultView.getComputedStyle(element).display === 'inline') {
      // CSS transforms do not apply to ordinary inline boxes.
      options.addStyle = ({ component, styles, partial }) => {
        component.addStyle({ ...styles, display: 'inline-block' }, { avoidStore: partial });
      };
    }
  });
}

function setToolbarButton(toolbar, className, label, icon, onClick) {
  let button = toolbar.querySelector(`.${className}`);
  if (!onClick) {
    button?.remove();
    return;
  }
  if (!button) {
    button = toolbar.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = `gjs-toolbar-item editor-background-tool ${className}`;
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
    toolbar.append(button);
  }
  button.title = label;
  button.setAttribute('aria-label', label);
  button.onclick = onClick;
}

export function labelSelectionTools(toolbar, model, changeImage, changeColor, detachImage, editGallery, editShadow) {
  const controls = toolbar.querySelectorAll('.gjs-toolbar-item');
  model?.get('toolbar')?.forEach((item, index) => {
    const title = item.command === 'tlb-move' && isImage(model)
      ? 'Hold Shift and drag to move only the image'
      : tooltips[item.command] || (typeof item.command === 'function' ? 'Select parent element' : null);
    if (!title || !controls[index]) return;
    controls[index].title = title;
    controls[index].setAttribute('aria-label', title);
  });
  const target = getImageTarget(model);
  const label = target?.background ? 'Change background image' : 'Change image';
  setToolbarButton(toolbar, 'editor-change-image', label,
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    target ? () => changeImage(target) : null);
  setToolbarButton(toolbar, 'editor-change-background-color', 'Change background color',
    '<path d="M12 3c-2.5 4-6 7.8-6 12a6 6 0 0 0 12 0c0-4.2-3.5-8-6-12Z"/><path d="M14.5 16a2.7 2.7 0 0 1-2.5 2"/>',
    model ? () => changeColor(model) : null);
  setToolbarButton(toolbar, 'editor-detach-background-image', 'Detach background image',
    '<path d="M3 7V3h4m10 0h4v4m0 10v4h-4M7 21H3v-4"/><rect x="7" y="7" width="10" height="10" rx="1"/><path d="m8 15 3-3 2 2 2-2 2 2"/>',
    getDetachableBackground(model) ? () => detachImage(model) : null);
  const gallery = findGallery(model);
  setToolbarButton(toolbar, 'editor-edit-gallery', 'Edit gallery',
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 10h18M10 10v11"/>',
    gallery ? () => editGallery(gallery) : null);
  setToolbarButton(toolbar, 'editor-edit-shadow', 'Element shadow',
    '<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M20 9v9a2 2 0 0 1-2 2H9"/>',
    model && model.get('tagName') !== 'body' ? () => editShadow(model) : null);
}
