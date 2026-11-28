import { migrateGalleries } from './editor-gallery.js';

const oldHeroAnchors = {
  promo__title: { left: '0px', top: '386px', width: '1340px' },
  promo__slogan: { left: '158px', top: '495px', width: '1024px' },
};
const positionProperties = new Set(['position', 'left', 'top', 'right', 'bottom', 'width', 'height']);

export function centerHomeHero(doc) {
  const home = doc.pages.find(page => page.slug === 'home');
  const page = doc.projectData.pages.find(page => page.id === home?.id);
  const root = page?.component ?? page?.frames?.[0]?.component;
  if (!root) return doc;
  const targets = new Map();

  function walk(node, inHero = false) {
    if (Array.isArray(node)) {
      node.forEach(child => walk(child, inHero));
      return;
    }
    if (!node || typeof node !== 'object') return;
    const classes = typeof node.classes === 'string' ? node.classes.split(/\s+/)
      : (node.classes || []).map(item => typeof item === 'string' ? item : item.name);
    const heading = classes.find(name => Object.hasOwn(oldHeroAnchors, name));
    const id = node.attributes?.id || node.id;
    if (inHero && id && heading) targets.set(`#${id}`, oldHeroAnchors[heading]);
    if (Array.isArray(node.components)) node.components.forEach(child => walk(child, inHero || classes.includes('promo')));
  }
  walk(root);

  let changed = false;
  const styles = doc.projectData.styles.flatMap(rule => {
    const selector = Array.isArray(rule.selectors) && rule.selectors.length === 1 ? rule.selectors[0] : rule.selectors;
    const anchor = targets.get(selector);
    if (rule.mediaText || !anchor || rule.style?.position !== 'absolute'
      || !Object.entries(anchor).every(([key, value]) => rule.style[key] === value)) return [rule];
    changed = true;
    const style = Object.fromEntries(Object.entries(rule.style).filter(([key]) => !positionProperties.has(key)));
    return Object.keys(style).length ? [{ ...rule, style }] : [];
  });
  return changed ? { ...doc, projectData: { ...doc.projectData, styles } } : doc;
}

export function migrateSiteDocument(doc) {
  return centerHomeHero(migrateGalleries(doc));
}
