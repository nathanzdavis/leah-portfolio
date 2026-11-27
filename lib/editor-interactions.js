export const blockIcons = {
  text: '¶', heading: 'H', button: '▣', image: '▧', section: '▤',
  columns: '◫', card: '▱', divider: '━', spacer: '↕', video: '▶',
};

export const isImage = component => component?.get('tagName') === 'img';

const tooltips = {
  'tlb-move': 'Drag to snap or reorder. Hold Shift to move freely.',
  'tlb-clone': 'Duplicate element',
  'tlb-delete': 'Delete element',
};

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
    if (element && !isImage(options.target) && element.ownerDocument.defaultView.getComputedStyle(element).display === 'inline') {
      // CSS transforms do not apply to ordinary inline boxes.
      options.addStyle = ({ component, styles, partial }) => {
        component.addStyle({ ...styles, display: 'inline-block' }, { avoidStore: partial });
      };
    }
  });
}

export function labelSelectionTools(toolbar, model, changeImage) {
  const controls = toolbar.querySelectorAll('.gjs-toolbar-item');
  model?.get('toolbar')?.forEach((item, index) => {
    const title = item.command === 'tlb-move' && isImage(model)
      ? 'Hold Shift and drag to move only the image'
      : tooltips[item.command] || (typeof item.command === 'function' ? 'Select parent element' : null);
    if (!title || !controls[index]) return;
    controls[index].title = title;
    controls[index].setAttribute('aria-label', title);
  });
  let imageButton = toolbar.querySelector('.editor-change-image');
  if (!isImage(model)) {
    imageButton?.remove();
    return;
  }
  if (!imageButton) {
    imageButton = toolbar.ownerDocument.createElement('button');
    imageButton.type = 'button';
    imageButton.className = 'editor-change-image';
    imageButton.textContent = 'Change image';
    imageButton.title = 'Choose a replacement image from your computer';
    toolbar.append(imageButton);
  }
  imageButton.onclick = () => changeImage(model);
}
