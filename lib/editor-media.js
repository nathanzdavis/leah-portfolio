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
