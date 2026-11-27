'use client';

import { useEffect, useRef, useState } from 'react';
import { galleryLayouts, galleryShapes, mediaSource } from '@/lib/editor-gallery';
import { shadowPresets, shadowValue } from '@/lib/editor-shadows';

function VisualDialog({ title, onClose, children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className={`modal background-picker ${className}`} onCancel={onClose} aria-label={title}>
    <h2>{title}</h2>
    {children}
  </dialog>;
}

export function GalleryDialog({ gallery, assets, onClose, onApply, onUpload }) {
  const attrs = gallery.getAttributes();
  const hasOriginalLayout = attrs['data-gallery-kind'] === 'home' || gallery.getClasses().includes('picture-grid');
  const [items, setItems] = useState(() => gallery.components().models.flatMap(link => {
    if (!link.getAttributes()['data-gallery-photo']) return [];
    const image = link.components().models.find(child => child.get('tagName') === 'img');
    if (!image) return [];
    const { src, alt = '' } = image.getAttributes();
    const shadow = link.getAttributes()['data-gallery-shadow'] || (image.getStyle()['box-shadow'] ? 'existing' : 'default');
    return [{ key: link.cid, link, image, src: mediaSource(src), alt, shadow }];
  }));
  const [library, setLibrary] = useState(assets);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const selected = new Set(items.map(item => item.src));
  const addItems = newItems => setItems(existing => {
    const seen = new Set(existing.map(item => item.src));
    const additions = newItems.filter(item => {
      if (seen.has(item.src)) return false;
      seen.add(item.src);
      return true;
    });
    return [...existing, ...additions];
  });

  function move(index, offset) {
    setItems(existing => {
      const reordered = [...existing];
      const next = index + offset;
      [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
      return reordered;
    });
  }

  async function upload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError('');
    setBusy(true);
    const failed = [];
    for (const file of files) {
      try {
        const asset = await onUpload(file);
        setLibrary(existing => [...existing, asset]);
        addItems([{ ...asset, key: asset.src, alt: '' }]);
      } catch {
        failed.push(file.name);
      }
    }
    if (failed.length) setError(`Could not add ${failed.join(', ')}. Try a JPG, PNG, or WebP file.`);
    setBusy(false);
  }

  return <VisualDialog title="Edit gallery" onClose={onClose} className="gallery-dialog">
    <form onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      onApply({ items, layout: values.get('layout'), shape: values.get('shape') });
    }}>
    <div className="gallery-modal-options">
      <label>Layout<select name="layout" defaultValue={attrs['data-gallery-layout'] || 'equal'}>
        {Object.entries(galleryLayouts).filter(([value])=>value!=='original'||hasOriginalLayout).map(([value, name])=><option key={value} value={value}>{name}</option>)}
      </select></label>
      <label>Image shape<select name="shape" defaultValue={attrs['data-gallery-shape'] || 'original'}>
        {Object.entries(galleryShapes).map(([value, name])=><option key={value} value={value}>{name}</option>)}
      </select></label>
    </div>
    <h3>Gallery photos ({items.length})</h3>
    {items.length === 0 && <p>Choose photos from the library or upload new ones.</p>}
    <div className="gallery-modal-order">
      {items.map((item, index) => <div key={item.key} className="gallery-modal-photo">
        <img src={item.src} alt="" />
        <input aria-label={`Alt text for photo ${index+1}`} placeholder="Alt text" value={item.alt}
          onChange={event=>setItems(existing=>existing.map(other=>other===item?{...other,alt:event.target.value}:other))} />
        <select aria-label={`Shadow for photo ${index+1}`} title="Photo shadow" value={item.shadow || 'default'}
          onChange={event=>setItems(existing=>existing.map(other=>other===item?{...other,shadow:event.target.value}:other))}>
          <option value="default">Site default</option>
          {item.image?.getStyle()['box-shadow'] && !item.link?.getAttributes()['data-gallery-shadow'] && <option value="existing">Keep existing</option>}
          <option value="soft">Smooth</option>
          <option value="hard">Hard edge</option>
          <option value="subtle">Subtle</option>
          <option value="none">No shadow</option>
        </select>
        <button className="mini-button" type="button" title="Move earlier" aria-label={`Move photo ${index+1} earlier`} disabled={index===0} onClick={()=>move(index,-1)}>↑</button>
        <button className="mini-button" type="button" title="Move later" aria-label={`Move photo ${index+1} later`} disabled={index===items.length-1} onClick={()=>move(index,1)}>↓</button>
        <button className="mini-button" type="button" title="Remove from this gallery" aria-label={`Remove photo ${index+1}`}
          onClick={()=>setItems(existing=>existing.filter(other=>other!==item))}>×</button>
      </div>)}
    </div>
    <h3>Website media</h3>
    <div className="gallery-modal-options">
      <label>Find an image<input type="search" value={query} onChange={event=>setQuery(event.target.value)} /></label>
      <label>Upload photos<input type="file" accept="image/*" multiple disabled={busy} onChange={upload} /></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="gallery-modal-library">
      {library.filter(item=>item.name.toLowerCase().includes(query.trim().toLowerCase())).map(item=>
        <button key={item.src} type="button" aria-label={`Add ${item.name}`} title={item.name} disabled={selected.has(item.src)}
          onClick={()=>addItems([{ ...item, key: item.src, alt: '' }])}>
          <img src={item.src} alt="" loading="lazy" />
          {selected.has(item.src) && <span>Added</span>}
        </button>
      )}
    </div>
    <div className="background-picker-actions">
      <button type="button" className="mini-button" onClick={onClose}>Cancel</button>
      <button type="submit" className="tool-button" disabled={busy}>{busy?'Uploading…':'Apply gallery'}</button>
    </div>
    </form>
  </VisualDialog>;
}

export function ShadowDialog({ onClose, onApply }) {
  const [preset, setPreset] = useState('soft');
  const [settings, setSettings] = useState(shadowPresets.soft);
  const [color, setColor] = useState('#000000');
  const value = preset === 'none' ? 'none' : shadowValue(settings, color);
  return <VisualDialog title="Element shadow" onClose={onClose}>
    <div className="shadow-preview"><span style={{ boxShadow:value }}>Preview</span></div>
    <div className="gallery-modal-options">
      <label>Style<select value={preset} onChange={event=>{
        setPreset(event.target.value);
        if (shadowPresets[event.target.value]) setSettings(shadowPresets[event.target.value]);
      }}>
        <option value="soft">Smooth</option><option value="hard">Hard edge</option>
        <option value="subtle">Subtle</option><option value="custom">Custom</option><option value="none">No shadow</option>
      </select></label>
      <label>Color<input type="color" value={color} disabled={preset==='none'} onChange={event=>setColor(event.target.value)} /></label>
      {Object.entries({ x:['X offset',-50,50], y:['Y offset',-50,50], blur:['Blur',0,80], opacity:['Opacity',0,100] }).map(([key,[label,min,max]])=>
        <label key={key}>{label} ({settings[key]})<input type="range" min={min} max={max}
          disabled={preset==='none'} value={settings[key]} onChange={event=>{
            setPreset('custom');
            setSettings({ ...settings, [key]:Number(event.target.value) });
          }} /></label>
      )}
    </div>
    <div className="background-picker-actions">
      <button className="mini-button" type="button" onClick={onClose}>Cancel</button>
      <button className="tool-button" type="button" onClick={()=>onApply(value)}>Apply shadow</button>
    </div>
  </VisualDialog>;
}
