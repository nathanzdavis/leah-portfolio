import { readPosition, setPagePosition } from './editor-position.js';

const maxUpload = 4 * 1024 * 1024;
const cssImageUrl = /url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/i;

async function prepareFile(file) {
  if (file.size <= maxUpload && /^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm))$/.test(file.type)) return file;
  if (file.type.startsWith('video/') || /^image\/(svg\+xml|gif)$/.test(file.type)) {
    throw new Error('Use a supported file under 4 MB.');
  }
  const image = await createImageBitmap(file).catch(() => {
    throw new Error('This image could not be read. Try exporting it as JPG or PNG.');
  });
  try {
    const canvas = document.createElement('canvas');
    for (const size of [2400, 1600, 1000]) {
      const scale = Math.min(1, size / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.88));
      if (blob && blob.size <= maxUpload) {
        const extension = blob.type === 'image/webp' ? 'webp' : 'png';
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + extension, { type: blob.type });
      }
    }
    throw new Error('This image is too large to upload.');
  } finally {
    image.close();
  }
}

export async function uploadEditorMedia(original) {
  const file = await prepareFile(original);
  const body = new FormData();
  body.append('files', file);
  const response = await fetch('/api/editor/media', { method: 'POST', body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.data?.[0]) throw new Error(result.error || 'Upload failed. Try again.');
  return result.data[0];
}

export function replaceImage(component, src) {
  const attributes = { ...component.getAttributes(), src };
  delete attributes.srcset;
  delete attributes.sizes;
  component.setAttributes(attributes);
  component.set('src', src);
}

export function getBackgroundStyle(model) {
  const element = model?.getEl();
  return element?.ownerDocument.defaultView?.getComputedStyle(element);
}

export function supportsBackground(model) {
  return ['div', 'section', 'header', 'footer', 'main', 'article', 'aside', 'nav'].includes(model?.get('tagName'));
}

export function getImageTarget(model) {
  if (model?.get('tagName') === 'img') return { model };
  const background = getBackgroundStyle(model)?.backgroundImage;
  return supportsBackground(model) || (background && cssImageUrl.test(background))
    ? { model, background: background || 'none' }
    : null;
}

export function replaceImageTarget({ model, background }, src) {
  if (!background) return replaceImage(model, src);
  const replacement = `url(${JSON.stringify(src)})`;
  if (cssImageUrl.test(background)) {
    model.addStyle({ 'background-image': background.replace(cssImageUrl, () => replacement) });
    return;
  }
  model.addStyle({
    'background-image': background === 'none' ? replacement : `${background}, ${replacement}`,
    'background-position': 'center',
    'background-repeat': 'no-repeat',
    'background-size': 'cover',
  });
}

export function getDetachableBackground(model) {
  if (!supportsBackground(model) || model.get('tagName') === 'nav') return null;
  const style = getBackgroundStyle(model);
  const match = style?.backgroundImage?.match(cssImageUrl);
  if (!match) return null;

  const rawUrl = match[0].slice(4, -1).trim().replace(/^(['"])(.*)\1$/, '$2');
  const documentUrl = model.getEl().ownerDocument.baseURI;
  try {
    const url = new URL(rawUrl, documentUrl);
    if (!/^https?:$/.test(url.protocol) && !/^data:image\//i.test(rawUrl)) return null;
    const src = url.origin === new URL(documentUrl).origin ? url.pathname + url.search + url.hash : url.href;
    return { model, src };
  } catch {
    return null;
  }
}

export function detachBackgroundImage(model) {
  const target = getDetachableBackground(model);
  if (!target) return null;
  const style = getBackgroundStyle(model);
  const remaining = style.backgroundImage.replace(cssImageUrl, 'none');
  const size = style.backgroundSize?.split(',')[0].trim();
  const position = style.backgroundPosition?.split(',')[0].trim();
  const positionedChildren = [];
  function remember(child) {
    if (getBackgroundStyle(child)?.position === 'absolute') {
      const point = readPosition(child);
      if (point) positionedChildren.push([child, point]);
    }
    child.components().forEach(remember);
  }
  if (style.position === 'static') model.components().forEach(remember);
  const [image] = model.append({
    type: 'image',
    name: 'Detached background image',
    attributes: { src: target.src, alt: '' },
    style: {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      'max-width': 'none',
      'object-fit': size === 'contain' ? 'contain' : 'cover',
      'object-position': position || 'center',
      'z-index': '-1',
    },
  });
  if (!image) return null;
  // The isolated stacking context keeps the image behind the content and
  // above the section's background color, without putting it in layout flow.
  model.addStyle({
    'background-image': remaining,
    isolation: 'isolate',
    ...(style.position === 'static' ? { position: 'relative' } : {}),
  });
  // A new containing block can change the offsets of existing overlays.
  // Rebase their offsets to keep their page coordinates intact.
  for (const [child, point] of positionedChildren) setPagePosition(child, point.x, point.y);
  return image;
}

// Draft uploads are private until published. Convert both image sources and
// CSS image URLs to the static asset path on the production branch.
export function publishedMedia(value) {
  if (Array.isArray(value)) return value.map(publishedMedia);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, publishedMedia(item)]));
  }
  if (typeof value !== 'string') return value;
  const draftUrl = /\/api\/editor\/media\?path=public%2fstatic%2fuploads%2f([a-z0-9._-]+)(?=$|["')])/gi;
  return value.replace(draftUrl, '/static/uploads/$1');
}
