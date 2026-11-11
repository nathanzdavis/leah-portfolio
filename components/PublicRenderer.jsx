import React from 'react';

const blockedTags = new Set(['script', 'style', 'object']);
const voidTags = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'area', 'base', 'embed', 'param', 'track', 'wbr']);

function classNameOf(component) {
  const classes = component.classes || component.class || [];
  if (typeof classes === 'string') return classes;
  return classes.map((item) => typeof item === 'string' ? item : item.name || item.label || '').filter(Boolean).join(' ');
}

function reactStyle(style) {
  return Object.fromEntries(Object.entries(style || {}).map(([key, value]) => {
    if (key.startsWith('--')) return [key, value];
    const camel = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/^ms-/, 'ms');
    return [camel, value];
  }));
}

function safeAttributes(component) {
  const source = { ...(component.attributes || {}) };
  const className = classNameOf(component);
  if (className) source.className = className;
  if (component.style && Object.keys(component.style).length) source.style = reactStyle(component.style);
  if (component.id) source.id = component.id;
  const attrs = {};
  for (const [key, value] of Object.entries(source)) {
    if (/^on/i.test(key) || key === 'contenteditable') continue;
    if ((key === 'href' || key === 'src') && /^javascript:/i.test(String(value))) continue;
    if (key === 'class') attrs.className = value;
    else if (key === 'for') attrs.htmlFor = value;
    else if (key === 'frameborder') attrs.frameBorder = value;
    else if (key === 'allowfullscreen') attrs.allowFullScreen = true;
    else attrs[key] = value;
  }
  return attrs;
}

function renderNode(node, key, context) {
  if (node == null) return null;
  if (typeof node === 'string') return node;
  if (node.type === 'textnode') return node.content || '';
  const tag = String(node.tagName || ({ text: 'div', image: 'img', link: 'a' }[node.type]) || 'div').toLowerCase();
  if (blockedTags.has(tag)) return null;
  const attrs = { ...safeAttributes(node), key };
  const classes = attrs.className || '';
  const { key: reactKey, ...elementAttrs } = attrs;
  if (tag === 'nav' && classes.includes('page-header__nav')) {
    return <nav key={reactKey} {...elementAttrs}><div className="page-header__nav-link2"><a className="page-header__nav-link3" href="/" style={{fontWeight:'bold',fontSize:26,color:'#3a3a3a',fontFamily:'Aguafina Script, cursive'}}>LM</a></div><span>{context.pages.filter(p=>p.navVisible).map(p=><a key={p.id} className={`page-header__nav-link ${p.slug===context.slug?'page-header__nav-link_selected':''}`} href={p.slug==='home'?'/':`/${p.slug}`}>{p.title.split(' | ')[0]}</a>)}</span></nav>;
  }
  if (tag === 'nav' && classes.includes('page-footer__nav')) {
    return <nav key={reactKey} {...elementAttrs}>{context.pages.filter(p=>p.navVisible).map(p=><a key={p.id} className={`page-footer__nav-link ${p.slug===context.slug?'page-footer__nav-link_selected':''}`} href={p.slug==='home'?'/':`/${p.slug}`}>{p.title.split(' | ')[0]}</a>)}</nav>;
  }
  if (voidTags.has(tag)) return React.createElement(tag, attrs);
  const children = Array.isArray(node.components) ? node.components.map((child, index) => renderNode(child, `${key}-${index}`, context)) : (node.content || node.components || null);
  return React.createElement(tag, attrs, children);
}

export default function PublicRenderer({ component, pages, slug }) {
  const nodes = Array.isArray(component) ? component : component?.components || [component];
  return <>{nodes.map((node, index) => renderNode(node, `site-${index}`, { pages, slug }))}</>;
}
