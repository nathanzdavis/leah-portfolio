const maxUpload = 4 * 1024 * 1024;

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
