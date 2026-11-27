export const galleryLayouts = {
  original: 'Original layout',
  equal: 'Same size',
  mixed: 'Mixed sizes',
  natural: 'Original proportions',
};
export const galleryShapes = { original: 'Original shape', square: 'Square', circle: 'Circle', diamond: 'Diamond', rounded: 'Rounded' };

function hasClass(node, name) {
  const classes = node?.classes;
  return typeof classes === 'string' ? classes.split(/\s+/).includes(name)
    : classes?.some(item => (typeof item === 'string' ? item : item.name) === name);
}

export function mediaSource(src) {
  return /^\.?\/?static\//.test(src || '') ? '/' + src.replace(/^\.?\//, '') : src;
}

export function galleryPhoto(src, alt = '', image, link) {
  const photo = { ...image, type: 'image', src, attributes: { ...image?.attributes, src, alt } };
  return {
    ...link,
    type: 'link',
    attributes: { ...link?.attributes, href: src, 'data-gallery-photo': 'true' },
    components: link ? link.components.map(item => item === image ? photo : item) : [photo],
  };
}

export const newGallery = {
  tagName: 'div',
  name: 'Gallery',
  attributes: { 'data-editor-gallery': 'true', 'data-gallery-layout': 'equal', 'data-gallery-shape': 'square' },
};

function nestHomeGallery(node) {
  const { 'data-editor-gallery': marker, 'data-gallery-layout': layout, 'data-gallery-shape': shape, ...attributes } = node.attributes;
  const photos = node.components.filter(child => child?.attributes?.['data-gallery-photo']);
  const children = node.components.filter(child => !photos.includes(child));
  return {
    ...node,
    name: node.name === 'Gallery' ? 'Photo section' : node.name,
    attributes: { ...attributes, 'data-gallery-container': 'home' },
    components: [{
      tagName: 'div',
      name: 'Gallery',
      attributes: {
        'data-editor-gallery': marker, 'data-gallery-layout': layout, 'data-gallery-shape': shape, 'data-gallery-kind': 'home',
      },
      components: photos,
    }, ...children],
  };
}

// Upgrade known sections on load without rewriting draft or published content.
export function migrateGalleries(doc) {
  function visit(node, legacyClass) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(child => visit(child, legacyClass));
    if (!Array.isArray(node.components)) return node;
    const home = legacyClass === 'services-images' && hasClass(node, legacyClass);
    if (node.attributes?.['data-editor-gallery']) return home ? nestHomeGallery(node) : node;
    if (node.attributes?.['data-gallery-container'] === 'home') return node;
    if (hasClass(node, legacyClass)) {
      const components = node.components.map(child => {
        const link = child?.type === 'link' ? child : undefined;
        const image = link ? link.components?.find(item => item?.type === 'image') : child;
        if (image?.type !== 'image') return child;
        const src = mediaSource(image.attributes?.src || image.src);
        return src ? galleryPhoto(src, image.attributes?.alt, image, link) : child;
      });
      const gallery = {
        ...node,
        name: 'Gallery',
        attributes: { ...node.attributes, 'data-editor-gallery': 'true', 'data-gallery-layout': 'original', 'data-gallery-shape': 'original' },
        components,
      };
      return home ? nestHomeGallery(gallery) : gallery;
    }
    const upgraded = node.components.map(child => visit(child, legacyClass));
    const replacedIds = new Set();
    node.components.forEach((child, index) => {
      if (!hasClass(child, legacyClass) || child.attributes?.['data-editor-gallery']) return;
      child.components?.forEach((link, photoIndex) => {
        const href = link?.attributes?.href;
        const converted = upgraded[index].components?.[photoIndex]?.attributes?.['data-gallery-photo'];
        if (converted && href?.startsWith('#')) replacedIds.add(href.slice(1));
      });
    });
    return {
      ...node,
      components: upgraded.filter(child => !hasClass(child, 'lightbox') || !replacedIds.has(child.attributes?.id)),
    };
  }

  const targets = new Map(doc.pages.flatMap(page => {
    const legacyClass = { home: 'services-images', gallery: 'picture-grid' }[page.slug];
    return legacyClass ? [[page.id, legacyClass]] : [];
  }));
  const pages = doc.projectData.pages.map(page => {
    const legacyClass = targets.get(page.id);
    if (!legacyClass) return page;
    return {
      ...page,
      ...(page.component ? { component: visit(page.component, legacyClass) } : {}),
      ...(page.frames ? { frames: page.frames.map(frame => ({ ...frame, component: visit(frame.component, legacyClass) })) } : {}),
    };
  });
  return { ...doc, projectData: { ...doc.projectData, pages } };
}

export function findGallery(model) {
  for (let current = model; current; current = current.parent()) {
    if (current.getAttributes()['data-editor-gallery'] === 'true') return current;
  }
  return null;
}
