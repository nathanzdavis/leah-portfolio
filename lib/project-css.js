function selectorText(rule) {
  if (typeof rule.selectors === 'string') return rule.selectors;
  if (Array.isArray(rule.selectors)) {
    return rule.selectors.map((s) => typeof s === 'string' ? s : `${s.type === 2 ? '#' : '.'}${s.name || s.label || ''}`).join('');
  }
  return rule.selector || '';
}

export function projectCss(projectData) {
  return (projectData.styles || []).map((rule) => {
    const selector = selectorText(rule);
    if (!selector || !rule.style) return '';
    const body = Object.entries(rule.style).map(([key, value]) => `${key}:${value}`).join(';');
    const css = `${selector}{${body}}`;
    return rule.mediaText ? `@media ${rule.mediaText}{${css}}` : css;
  }).join('\n');
}
