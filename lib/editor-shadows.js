export const shadowPresets = {
  soft: { x: 0, y: 8, blur: 24, opacity: 24 },
  hard: { x: 5, y: 5, blur: 0, opacity: 40 },
  subtle: { x: 0, y: 3, blur: 8, opacity: 16 },
};

export function shadowValue({ x, y, blur, opacity }, color = '#000000') {
  const alpha = Math.round(opacity / 100 * 255).toString(16).padStart(2, '0');
  return `${x}px ${y}px ${blur}px ${color}${alpha}`;
}

export function applyElementShadow(model, value) {
  model.addStyle({ 'box-shadow': value });
  const parent = model.parent();
  if (model.get('tagName') === 'img' && parent?.getAttributes()['data-gallery-photo']) {
    parent.addStyle({ '--gallery-photo-shadow': value === 'none' ? 'none' : `drop-shadow(${value})` });
  }
}

export function galleryPhotoShadow(link, choice) {
  const image = link.components().models.find(child => child.get('tagName') === 'img');
  if (!image || choice === 'existing') return;
  if (choice === 'default') {
    if (!link.getAttributes()['data-gallery-shadow'] && !image.getStyle()['box-shadow']) return;
    image.removeStyle('box-shadow');
    link.removeStyle('--gallery-photo-shadow');
    link.removeAttributes('data-gallery-shadow');
  } else if (choice === 'none' || Object.hasOwn(shadowPresets, choice)) {
    const value = choice === 'none' ? 'none' : shadowValue(shadowPresets[choice]);
    applyElementShadow(image, value);
    link.addAttributes({ 'data-gallery-shadow': choice });
  }
}
