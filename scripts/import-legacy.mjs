import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';

const root = process.cwd();
const sources = [
  { file:'home.html', id:'home', slug:'home', title:'Home | Leah Mosier', cssFiles:[] },
  { file:'about.html', id:'about', slug:'about', title:'About | Leah Mosier', cssFiles:['/static/css/about.css'] },
  { file:'repertoire.html', id:'repertoire', slug:'repertoire', title:'Repertoire | Leah Mosier', cssFiles:['/static/css/repertoire.css'] },
  { file:'gallery.html', id:'gallery', slug:'gallery', title:'Gallery | Leah Mosier', cssFiles:['/static/css/gallery.css'] },
  { file:'sheet-music.html', id:'sheet-music', slug:'sheet-music', title:'Sheet Music | Leah Mosier', cssFiles:['/static/css/sheet-music.css'] },
];

function styleObject(value='') { return Object.fromEntries(value.split(';').map(part=>part.trim()).filter(Boolean).map(part=>{const index=part.indexOf(':');return index<0?[part,'']:[part.slice(0,index).trim(),part.slice(index+1).trim()]})); }
function convert(node) {
  if (node.type === 'text') return node.data ? { type:'textnode', content:node.data } : null;
  if (node.type !== 'tag') return null;
  const attributes = { ...node.attribs }; const classValue = attributes.class || '';
  delete attributes.class; delete attributes.style; delete attributes.onclick;
  const textTags = new Set(['p','h1','h2','h3','h4','h5','h6','span','td','th','li','strong','em','label','button']);
  const component = { tagName:node.name, type:node.name === 'img' ? 'image' : node.name === 'a' ? 'link' : textTags.has(node.name) ? 'text' : undefined };
  if (classValue) component.classes = classValue.split(/\s+/).filter(Boolean);
  if (Object.keys(attributes).length) component.attributes = attributes;
  if (node.attribs?.style) component.style = styleObject(node.attribs.style);
  const children = (node.children || []).map(convert).filter(Boolean);
  if (children.length) component.components = children;
  return Object.fromEntries(Object.entries(component).filter(([,value])=>value!==undefined));
}

const pages=[]; const meta=[]; const assets=new Map();
for (const source of sources) {
  const html=await fs.readFile(path.join(root,'build',source.file),'utf8'); const $=cheerio.load(html,{decodeEntities:false});
  $('script').remove();
  const body=$('body').get(0); const component=(body.children||[]).map(convert).filter(Boolean);
  $('img').each((_,el)=>{const src=$(el).attr('src');if(src)assets.set(src,{src:`/${src.replace(/^\//,'')}`,name:path.basename(src)})});
  const description=$('meta[name="description"]').attr('content') || `${source.title.split(' | ')[0]} page for Leah Mosier.`;
  pages.push({id:source.id,name:source.title.split(' | ')[0],component}); meta.push({id:source.id,slug:source.slug,title:source.title,description,navVisible:true,cssFiles:source.cssFiles});
}
const document={schemaVersion:1,revision:0,updatedAt:new Date().toISOString(),site:{title:'Leah Mosier',description:'Portfolio of cellist, percussionist, and composer Leah Mosier.'},pages:meta,projectData:{assets:[...assets.values()],styles:[],pages}};
await fs.mkdir(path.join(root,'content'),{recursive:true}); await fs.writeFile(path.join(root,'content','site.json'),`${JSON.stringify(document,null,2)}\n`);
console.log(`Imported ${pages.length} pages and ${assets.size} media assets into content/site.json`);
