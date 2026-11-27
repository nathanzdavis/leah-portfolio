'use client';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import BackgroundColorPicker from '@/components/BackgroundColorPicker';
import { GalleryDialog, ShadowDialog } from '@/components/EditorVisualDialogs';
import { galleryPhoto, mediaSource, migrateGalleries, newGallery } from '@/lib/editor-gallery';
import { createDraftHistory, draftHistoryData } from '@/lib/editor-history';
import { detachBackgroundImage, getBackgroundStyle, replaceImageTarget, uploadEditorMedia } from '@/lib/editor-media';
import { blockIcons, isImage, labelSelectionTools, setupDragModes } from '@/lib/editor-interactions';
import { readPosition, setPagePosition } from '@/lib/editor-position';

const canvasStyles = ['/static/css/screen.min.css','/static/css/custom.min.css','/static/css/about.css','/static/css/repertoire.css','/static/css/gallery.css','/static/css/sheet-music.css','/static/css/editor-gallery.css','https://fonts.googleapis.com/css?family=Roboto+Slab|Aguafina+Script|Albert+Sans|Aboreto&display=swap'];

export default function EditorClient() {
  const editorRef = useRef(null); const draftRef = useRef(null); const saveTimer = useRef(null);
  const mainRef = useRef(null);
  const readyRef = useRef(false);
  const [startupError, setStartupError] = useState('');
  const imageInputRef = useRef(null);
  const imageTargetRef = useRef(null);
  const undoRef = useRef(null);
  const saveQueue = useRef(Promise.resolve());
  const restoringRef = useRef(false);
  const [copiedPosition, setCopiedPosition] = useState(null);
  const [position, setPosition] = useState(null);
  const [colorTarget, setColorTarget] = useState(null);
  const [galleryTarget, setGalleryTarget] = useState(null);
  const [shadowTarget, setShadowTarget] = useState(null);
  const [doc,setDoc]=useState(null); const [leftTab,setLeftTab]=useState('blocks'); const [rightTab,setRightTab]=useState('styles'); const [device,setDevice]=useState('Desktop'); const [inspectorOpen,setInspectorOpen]=useState(false);
  const [selection,setSelection]=useState({count:0,canGroup:false,isGroup:false});
  const [status,setStatus]=useState('Loading draft…'); const [toast,setToast]=useState(null); const [history,setHistory]=useState(null); const [passwordOpen,setPasswordOpen]=useState(false); const router=useRouter();

  function notify(message,error=false){setToast({message,error});setTimeout(()=>setToast(null),3500)}
  function snapshot(editor=editorRef.current){ if(!editor||!draftRef.current)return null; return {...draftRef.current,updatedAt:new Date().toISOString(),projectData:editor.getProjectData()}; }
  function saveNow() {
    if (!readyRef.current) return Promise.resolve(false);
    clearTimeout(saveTimer.current);
    const save = async () => {
      const value = snapshot();
      if (!value) return false;
      setStatus('Saving draft…');
      try {
        const response = await fetch('/api/editor/draft', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Save failed');
        undoRef.current?.saved(value.updatedAt);
        draftRef.current = { ...draftRef.current, updatedAt: value.updatedAt };
        setStatus(`Draft saved ${new Date(data.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
        return true;
      } catch (error) {
        setStatus('Draft not saved');
        notify(error.message, true);
        return false;
      }
    };
    saveQueue.current = saveQueue.current.then(save);
    return saveQueue.current;
  }

  function scheduleSave() {
    if (restoringRef.current || !readyRef.current) return;
    const value = snapshot();
    if (value) undoRef.current?.record(draftHistoryData(value), editorRef.current.Pages.getSelected()?.id);
    clearTimeout(saveTimer.current);
    setStatus('Unsaved changes');
    saveTimer.current = setTimeout(saveNow, 1400);
  }

  function stepHistory(direction) {
    const editor = editorRef.current;
    const timeline = undoRef.current;
    const value = snapshot();
    if (!timeline || !editor || !value) return;
    const page = editor.Pages.getSelected()?.id;
    timeline.record(draftHistoryData(value), page);
    const entry = timeline.step(direction);
    if (!entry) return notify(direction < 0 ? 'No earlier edit in this tab.' : 'No edit to redo.');
    restoringRef.current = true;
    try {
      const restored = migrateGalleries({ ...draftRef.current, ...JSON.parse(entry.data) });
      draftRef.current = { ...draftRef.current, ...restored };
      const manager = editor.UndoManager;
      if (direction < 0 ? manager.hasUndo() : manager.hasRedo()) {
        if (direction < 0) manager.undo();
        else manager.redo();
      }
      if (draftHistoryData(snapshot()) !== entry.data) {
        const current = editor.getProjectData();
        const { styles, ...rest } = restored.projectData;
        const { styles: currentStyles, ...currentRest } = current;
        if (JSON.stringify(rest) === JSON.stringify(currentRest)) {
          editor.setStyle(styles);
        } else {
          editor.select();
          editor.loadProjectData(restored.projectData);
          editor.Pages.select(editor.Pages.get(entry.pageId) || editor.Pages.get(page) || editor.Pages.getMain());
        }
        manager.clear();
      }
      if (JSON.stringify(value.pages) !== JSON.stringify(restored.pages)) setDoc(draftRef.current);
      editor.refresh({ tools: true });
      timeline.normalize(draftHistoryData(snapshot()));
    } finally {
      restoringRef.current = false;
    }
    scheduleSave();
  }

  function applyPosition(coordinates) {
    const model = editorRef.current?.getSelected();
    if (setPagePosition(model, coordinates.x, coordinates.y)) {
      setPosition({ ...readPosition(model), id: model.cid });
      editorRef.current.refresh({ tools: true });
      scheduleSave();
    }
  }

  function chooseImage(target) {
    imageTargetRef.current = target;
    imageInputRef.current?.click();
  }

  function galleryAssets() {
    const assets = editorRef.current?.AssetManager.getAll().models || [];
    return Array.from(new Map(assets.filter(asset => asset.get('type') === 'image' && asset.getSrc()).map(asset => {
      const src = mediaSource(asset.getSrc());
      return [src, { src, name: asset.get('name') || src.split('/').pop() }];
    })).values());
  }

  async function uploadGalleryPhoto(file) {
    const editor = editorRef.current;
    if (file.type.startsWith('video/')) throw new Error('Choose an image');
    const asset = await uploadEditorMedia(file);
    if (editor !== editorRef.current || asset.type !== 'image') throw new Error('Choose an image');
    editor.AssetManager.add(asset);
    return { src: asset.src, name: asset.name || file.name };
  }

  function applyGallery({ items, layout, shape }) {
    const gallery = galleryTarget;
    if (!gallery?.parent()) return setGalleryTarget(null);
    const existing = new Set(items.map(item => item.link));
    const removed = gallery.components().models.filter(child =>
      child.getAttributes()['data-gallery-photo'] && !existing.has(child));
    removed.forEach(child => child.remove());
    items.forEach((item, index) => {
      if (item.link) {
        item.image.addAttributes({ alt: item.alt });
        if (item.link.index() !== index) item.link.move(gallery, { at: index });
      } else gallery.append(galleryPhoto(item.src, item.alt), { at: index });
    });
    gallery.addAttributes({ 'data-gallery-layout': layout, 'data-gallery-shape': shape });
    editorRef.current?.select(gallery);
    setGalleryTarget(null);
    scheduleSave();
  }

  function applyShadow(value) {
    const model = shadowTarget;
    if (model?.parent()) {
      model.addStyle({ 'box-shadow': value });
      const parent = model.parent();
      if (isImage(model) && parent.getAttributes()['data-gallery-photo']) {
        parent.addStyle({ '--gallery-photo-shadow': value === 'none' ? 'none' : `drop-shadow(${value})` });
      }
      scheduleSave();
    }
    setShadowTarget(null);
  }

  function detachImage(model) {
    const image = detachBackgroundImage(model);
    if (!image) return;
    editorRef.current?.select(image);
    scheduleSave();
    notify('Background detached. Hold Shift and drag its move handle to move the image.');
  }

  async function changeImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    const target = imageTargetRef.current;
    if (!file || !target) return;
    const editor = editorRef.current;
    notify('Uploading image…');
    try {
      const asset = await uploadEditorMedia(file);
      if (editor !== editorRef.current || !target.model.parent()) return;
      if (asset.type !== 'image') throw new Error('Choose an image file.');
      editor.AssetManager.add(asset);
      replaceImageTarget(target, asset.src);
      scheduleSave();
      notify('Image replaced');
    } catch (error) {
      notify(error.message, true);
    }
  }

  async function uploadAssets(event) {
    const files = Array.from(event.dataTransfer?.files || event.target?.files || []);
    if (!files.length) return;
    const editor = editorRef.current;
    notify('Uploading media…');
    try {
      for (const file of files) {
        const asset = await uploadEditorMedia(file);
        if (editor !== editorRef.current) return;
        editor.AssetManager.add(asset);
      }
      notify('Media uploaded');
    } catch (error) {
      notify(error.message, true);
    } finally {
      if (event.target?.type === 'file') event.target.value = '';
    }
  }

  function handleSave(event) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) saveNow();
    }
  }

  useEffect(() => {
    let disposed = false;
    const shortcut = new AbortController();
    const addSaveShortcut = target => target?.addEventListener('keydown', handleSave, { capture: true, signal: shortcut.signal });
    addSaveShortcut(window);

    async function initializeEditor() {
      const response = await fetch('/api/editor/draft', { cache: 'no-store', signal: shortcut.signal });
      if (response.status === 401) {
        router.replace('/editor/login');
        return;
      }
      if (!response.ok) throw new Error(`Could not load draft (HTTP ${response.status})`);
      const loaded = await response.json();
      const grapesjs = (await import('grapesjs')).default;
      if (disposed) return;

      let storage;
      try { storage = window.sessionStorage; } catch {}
      const originalData = draftHistoryData(loaded);
      const timeline = createDraftHistory(storage, loaded.updatedAt, originalData, loaded.pages[0].id);
      undoRef.current = timeline;
      const restored = timeline.current();
      const recovered = restored.data !== originalData;
      const current = migrateGalleries({ ...loaded, ...JSON.parse(restored.data) });
      draftRef.current = current;

      // GrapesJS resolves its canvas and sidebar targets synchronously.
      // Commit the shell before handing React-owned mount points to GrapesJS.
      flushSync(() => setDoc(current));
      const container = document.getElementById('gjs');
      if (!container) throw new Error('Editor canvas mount is missing');
      const editor = grapesjs.init({container,height:'100%',fromElement:false,projectData:current.projectData,storageManager:false,panels:{defaults:[]},canvas:{styles:canvasStyles},blockManager:{appendTo:'#blocks'},layerManager:{appendTo:'#layers'},styleManager:{appendTo:'#styles',sectors:[{name:'Layout',open:true,buildProps:['display','position','width','height','min-height','max-width','margin','padding','overflow','z-index','flex-direction','flex-wrap','justify-content','align-items','gap','grid-template-columns']},{name:'Typography',open:true,buildProps:['font-family','font-size','font-weight','line-height','letter-spacing','color','text-align','text-decoration']},{name:'Appearance',open:true,buildProps:['background-color','background','border','border-radius','box-shadow','opacity']},{name:'Effects',buildProps:['transform','transition']}]},traitManager:{appendTo:'#traits'},selectorManager:{appendTo:'#selectors'},deviceManager:{devices:[{id:'Desktop',name:'Desktop',width:''},{id:'Tablet',name:'Tablet',width:'768px',widthMedia:'992px'},{id:'Mobile',name:'Mobile',width:'390px',widthMedia:'600px'}]},assetManager:{assets:current.projectData.assets||[],upload:'/api/editor/media',uploadName:'files',uploadFile:uploadAssets}});
      editorRef.current=editor;
      editor.on('canvas:frame:load', ({ window: frameWindow }) => addSaveShortcut(frameWindow));
      addSaveShortcut(editor.Canvas.getWindow());
      setupDragModes(editor, notify);
      editor.Commands.add('core:undo', () => stepHistory(-1));
      editor.Commands.add('core:redo', () => stepHistory(1));
      editor.onReady(() => {
        if (disposed) return;
        const page = editor.Pages.get(restored.pageId);
        if (page) editor.Pages.select(page);
        timeline.normalize(draftHistoryData(snapshot()));
        readyRef.current = true;
        if (recovered) scheduleSave();
      });
      const blocks=[['text','Text','<p>Double-click to edit this text</p>'],['heading','Heading','<h2>New heading</h2>'],['button','Button','<a class="editor-button" href="#">Button</a>'],['image','Image',{type:'image'}],['section','Section','<section style="padding:60px 24px"><div style="max-width:1100px;margin:auto"><h2>New section</h2><p>Add content here.</p></div></section>'],['columns','Columns','<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px"><div>Column one</div><div>Column two</div></div>'],['card','Card','<article style="padding:24px;border:1px solid #ddd;border-radius:12px"><h3>Card title</h3><p>Card content</p></article>'],['divider','Divider','<hr>'],['spacer','Spacer','<div style="height:48px"></div>'],['video','Video',{type:'video'}],['gallery','Gallery',newGallery]];
      blocks.forEach(([id,label,content])=>editor.BlockManager.add(id,{
        label, content, media: `<span class="editor-block-icon" aria-hidden="true">${blockIcons[id]}</span>`,
        attributes: { title: `Drag to add ${label.toLowerCase()}` },
        category:['section','columns','gallery'].includes(id)?'Layout':'Basic',
      }));
      const syncSelection=()=>{const selected=editor.getSelectedAll();const parent=selected[0]?.parent();setSelection({count:selected.length,canGroup:selected.length>1&&selected.every(item=>item.parent()===parent),isGroup:selected.length===1&&selected[0].getAttributes?.()['data-editor-group']==='true'});};
      const clampToolbar = () => requestAnimationFrame(() => {
        if (editorRef.current !== editor) return;
        const next = readPosition(editor.getSelected());
        const id = editor.getSelected()?.cid;
        setPosition(previous => previous?.x === next?.x && previous?.y === next?.y && previous?.anchor === next?.anchor && previous?.id === id
          ? previous : next && { ...next, id });
        const toolbar = editor.Canvas.getToolbarEl();
        const canvas = editor.Canvas.getElement();
        if (!toolbar || !canvas || toolbar.offsetParent === null) return;
        labelSelectionTools(toolbar, editor.getSelected(), chooseImage, setColorTarget, detachImage, setGalleryTarget, setShadowTarget);
        const bar = toolbar.getBoundingClientRect();
        const bounds = canvas.getBoundingClientRect();
        const style = getComputedStyle(toolbar);
        const pad = 6;
        const top = Math.max(bounds.top + pad, Math.min(bar.top, bounds.bottom - pad - bar.height));
        const left = Math.max(bounds.left + pad, Math.min(bar.left, bounds.right - pad - bar.width));
        toolbar.style.top = `${(parseFloat(style.top) || 0) + top - bar.top}px`;
        toolbar.style.left = `${(parseFloat(style.left) || 0) + left - bar.left}px`;
      });
      editor.on('update',scheduleSave);editor.on('component:selected',(model)=>{if(model.get('tagName')!=='body')model.set({resizable:isImage(model)?{ratioDefault:true}:true,draggable:true,droppable:!isImage(model)},{silent:true});syncSelection();clampToolbar();});
      editor.on('component:deselected',syncSelection);editor.on('component:toggled',()=>{syncSelection();clampToolbar()});editor.on('canvas:tools:update',clampToolbar);editor.on('canvas:refresh',clampToolbar);
      setStatus('Draft loaded');
    }

    initializeEditor().catch(error => {
      if (disposed) return;
      console.error('Editor startup failed:', error);
      readyRef.current = false;
      clearTimeout(saveTimer.current);
      setStartupError('The editor could not open your draft.');
    });

    return () => {
      disposed = true;
      readyRef.current = false;
      shortcut.abort();
      clearTimeout(saveTimer.current);
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, []);

  function command(id){const e=editorRef.current;if(!e)return;if(id==='undo'||id==='redo')e.runCommand(`core:${id}`);else if(id==='preview')e.runCommand('preview');else if(id==='fullscreen')e.runCommand('fullscreen');}
  function switchDevice(name){setDevice(name);editorRef.current?.setDevice(name);requestAnimationFrame(()=>editorRef.current?.refresh({tools:true}))}
  function groupSelection(){const editor=editorRef.current;const items=editor?.getSelectedAll()||[];const parent=items[0]?.parent();if(items.length<2||!parent||!items.every(item=>item.parent()===parent))return notify('Select two or more elements in the same section to group them.',true);const measured=items.map(model=>({model,rect:model.getEl()?.getBoundingClientRect()}));if(measured.some(item=>!item.rect))return notify('Those elements are not ready to group yet.',true);const left=Math.min(...measured.map(item=>item.rect.left));const top=Math.min(...measured.map(item=>item.rect.top));const right=Math.max(...measured.map(item=>item.rect.right));const bottom=Math.max(...measured.map(item=>item.rect.bottom));const at=Math.min(...items.map(item=>item.index()));const group=parent.append({tagName:'div',name:'Group',attributes:{'data-editor-group':'true'},style:{position:'absolute',width:`${right-left}px`,height:`${bottom-top}px`},draggable:true,droppable:true,resizable:true})[0];group.move(parent,{at});const containingRect=group.getEl()?.offsetParent?.getBoundingClientRect()||parent.getEl()?.getBoundingClientRect();if(!containingRect){group.remove();return notify('Those elements cannot be grouped here.',true)}group.addStyle({left:`${left-containingRect.left}px`,top:`${top-containingRect.top}px`});measured.sort((a,b)=>a.model.index()-b.model.index()).forEach(({model,rect},index)=>{model.addStyle({position:'absolute',left:`${rect.left-left}px`,top:`${rect.top-top}px`,width:`${rect.width}px`,height:`${rect.height}px`,margin:'0'});model.move(group,{at:index})});editor.select(group);setSelection({count:1,canGroup:false,isGroup:true});notify(`Grouped ${items.length} elements`);scheduleSave()}
  function ungroupSelection(){const editor=editorRef.current;const group=editor?.getSelected();if(!group||group.getAttributes?.()['data-editor-group']!=='true')return;const parent=group.parent();const children=[...group.components().models];if(!parent||!children.length)return;const measured=children.map(model=>({model,rect:model.getEl()?.getBoundingClientRect()})).filter(item=>item.rect);const at=group.index();measured.forEach(({model,rect},index)=>{model.move(parent,{at:at+index});const containingRect=model.getEl()?.offsetParent?.getBoundingClientRect()||parent.getEl()?.getBoundingClientRect();if(containingRect)model.addStyle({position:'absolute',left:`${rect.left-containingRect.left}px`,top:`${rect.top-containingRect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,margin:'0'})});group.remove();editor.select(measured.map(item=>item.model));setSelection({count:measured.length,canGroup:measured.length>1,isGroup:false});notify('Group separated');scheduleSave()}
  function updatePages(next){const nextDoc={...draftRef.current,pages:next};draftRef.current=nextDoc;setDoc(nextDoc);scheduleSave()}
  function selectPage(id){editorRef.current?.Pages.select(id);setDoc({...draftRef.current})}
  function addPage(){const title=prompt('Page name');if(!title)return;const slug=(prompt('Page URL',title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''))||'').toLowerCase();if(!/^[a-z0-9-]+$/.test(slug)||doc.pages.some(p=>p.slug===slug))return notify('Choose a unique URL using letters, numbers, and hyphens.',true);const id=`page-${crypto.randomUUID()}`;editorRef.current.Pages.add({id,name:title,component:'<main><section style="padding:80px 24px;text-align:center"><h1>New page</h1><p>Start designing here.</p></section></main>'});updatePages([...doc.pages,{id,slug,title,description:'',navVisible:true,cssFiles:[]}]);selectPage(id)}
  function duplicatePage(page){const source=editorRef.current.Pages.get(page.id);const title=`${page.title} Copy`;const slug=`${page.slug}-copy`;const id=`page-${crypto.randomUUID()}`;editorRef.current.Pages.add({id,name:title,component:source.getMainComponent().clone()});updatePages([...doc.pages,{...page,id,title,slug}]);selectPage(id)}
  function deletePage(page){if(doc.pages.length===1||!confirm(`Delete “${page.title}”?`))return;editorRef.current.Pages.remove(page.id);updatePages(doc.pages.filter(p=>p.id!==page.id))}
  function editPage(page){const title=prompt('Page title',page.title);if(!title)return;const slug=(prompt('Page URL',page.slug)||'').toLowerCase();if(!/^[a-z0-9-]+$/.test(slug)||doc.pages.some(p=>p.id!==page.id&&p.slug===slug))return notify('Choose a unique URL using letters, numbers, and hyphens.',true);const description=prompt('SEO description',page.description)||'';const navVisible=confirm('Show this page in the website navigation?');updatePages(doc.pages.map(p=>p.id===page.id?{...p,title,slug,description,navVisible}:p));}
  async function publish(){if(!confirm('Publish this draft to the live website?'))return;if(!await saveNow())return;setStatus('Publishing to GitHub…');const res=await fetch('/api/editor/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot())});const data=await res.json();if(!res.ok){setStatus('Publish failed');return notify(data.error||'Publish failed',true)}draftRef.current={...draftRef.current,revision:data.revision};setStatus('Committed. Waiting for Vercel…');notify('Published to GitHub. Vercel deployment started.');pollDeployment(data.commitSha)}
  async function pollDeployment(sha){for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,5000));const res=await fetch(`/api/editor/deployment?sha=${sha}`);const data=await res.json();if(['ready','succeeded'].includes(data.state)){setStatus('Live on Vercel');notify('Your website is live.');return}if(['error','canceled','failed'].includes(data.state)){setStatus('Deployment failed');notify(data.message||'Vercel deployment failed',true);return}setStatus(data.message||`Vercel: ${data.state}`)}setStatus('Deployment still in progress')}
  async function openHistory(){const res=await fetch('/api/editor/history');setHistory(await res.json())}
  async function restore(sha){if(!confirm('Restore this version into your draft? Nothing goes live until you publish.'))return;clearTimeout(saveTimer.current);await saveQueue.current;const res=await fetch('/api/editor/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha})});const data=await res.json();if(!res.ok)return notify(data.error,true);undoRef.current?.clear();location.reload()}
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.replace('/editor/login');router.refresh()}
  if (startupError) return <main className="login-shell"><section className="login-card" role="alert">
    <h1>Editor couldn’t load</h1><p>{startupError} Try opening it again.</p>
    <button type="button" onClick={()=>window.location.reload()}>Retry</button>
  </section></main>;
  if(!doc)return <main className="login-shell">Loading editor…</main>;
  const selected=editorRef.current?.Pages.getSelected()?.id||doc.pages[0]?.id;
  return <div className="editor-app"><header className="editor-topbar"><div className="brand"><span className="brand-mark">LM</span><span className="brand-copy"><strong>Leah’s Studio</strong><small>Visual website editor</small></span></div><div className="topbar-group"><button className="tool-button" onClick={()=>command('undo')} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button><button className="tool-button" onClick={()=>command('redo')} title="Redo" aria-label="Redo">↷</button></div>{selection.count>1&&<button className="tool-button selection-button" onClick={groupSelection} disabled={!selection.canGroup} title={selection.canGroup?'Group selected elements':'Selected elements must be in the same section'}>Group {selection.count}</button>}{selection.isGroup&&<button className="tool-button selection-button" title="Ungroup selected elements" onClick={ungroupSelection}>Ungroup</button>}<div className="topbar-group">{['Desktop','Tablet','Mobile'].map(d=><button key={d} className={`device-button ${device===d?'active':''}`} title={`Preview at ${d.toLowerCase()} width`} onClick={()=>switchDevice(d)}>{d}</button>)}</div><div className="topbar-spacer"/><button className="tool-button inspector-toggle" title="Toggle design controls" onClick={()=>setInspectorOpen(v=>!v)}>Design</button><button className="tool-button" title="View published versions" onClick={openHistory}>History</button><button className="tool-button" title="Editor account settings" onClick={()=>setPasswordOpen(true)}>Account</button><button className="tool-button" title="Preview the site" onClick={()=>command('preview')}>Preview</button><button className="tool-button" title="Save the draft" onClick={saveNow}>Save</button><button className="tool-button publish-button" title="Publish the draft to the live website" onClick={publish}>Publish</button><button className="tool-button" title="Sign out of the editor" onClick={logout}>Log out</button></header>
    <main ref={mainRef} className="editor-main"><aside className="sidebar left"><SidebarResize side="left" mainRef={mainRef}/><div className="sidebar-tabs">{['blocks','pages','layers'].map(t=><button key={t} className={leftTab===t?'active':''} onClick={()=>setLeftTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div><div className="sidebar-body"><div id="blocks" style={{display:leftTab==='blocks'?'block':'none'}}/><div style={{display:leftTab==='pages'?'block':'none'}}><button className="mini-button" onClick={addPage}>＋ Add page</button><div className="panel-heading">Website pages</div><div className="page-list">{doc.pages.map(page => (
        <div className="page-row" key={page.id}>
          <button type="button" className={`page-name ${selected===page.id?'active':''}`} onClick={()=>selectPage(page.id)}
            title={`${page.title} (/${page.slug})`} aria-current={selected===page.id?'page':undefined}>
            {page.title.split(' | ')[0]}
          </button>
          <button type="button" className="page-action" onClick={()=>editPage(page)} title="Page settings" aria-label={`Settings for ${page.title}`}>✎</button>
          <button type="button" className="page-action" onClick={()=>duplicatePage(page)} title="Duplicate page" aria-label={`Duplicate ${page.title}`}>⧉</button>
          <button type="button" className="page-action page-delete" onClick={()=>deletePage(page)} title="Delete page"
            aria-label={`Delete ${page.title}`} disabled={doc.pages.length===1}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M9 6V3h6v3m4 0-1 15H6L5 6m5 4v7m4-7v7"/>
            </svg>
          </button>
        </div>
      ))}</div></div><div id="layers" style={{display:leftTab==='layers'?'block':'none'}}/></div></aside>
      <section className="canvas-shell"><input ref={imageInputRef} type="file" accept="image/*" hidden onChange={changeImage}/><div className="canvas-wrap" style={{maxWidth:device==='Tablet'?768:device==='Mobile'?390:'none'}}><div id="gjs"/></div></section>
      <aside className={`sidebar right ${inspectorOpen?'open':''}`}><SidebarResize side="right" mainRef={mainRef}/><div className="sidebar-tabs">{['styles','settings'].map(t=><button key={t} className={rightTab===t?'active':''} onClick={()=>setRightTab(t)}>{t==='styles'?'Design':'Settings'}</button>)}</div><div className="sidebar-body">{rightTab==='styles'&&position&&<PositionFields key={position.id}
        position={position} apply={applyPosition} copiedPosition={copiedPosition}
        onCopy={()=>{setCopiedPosition(position);notify('Position copied for use on another page.')}} />}
      <div id="selectors" style={{display:rightTab==='styles'?'block':'none'}}/><div id="styles" style={{display:rightTab==='styles'?'block':'none'}}/><div id="traits" style={{display:rightTab==='settings'?'block':'none'}}/>{rightTab==='settings'&&<p style={{color:'#777'}}>Select an element to edit its links, labels, alt text, and advanced attributes.</p>}</div></aside></main>
    {colorTarget && <BackgroundColorPicker
      currentColor={getBackgroundStyle(colorTarget)?.backgroundColor}
      onClose={() => setColorTarget(null)}
      onApply={color => {
        if (colorTarget.parent()) {
          colorTarget.addStyle({ 'background-color': color });
          scheduleSave();
        }
        setColorTarget(null);
      }}
    />}
    {galleryTarget && <GalleryDialog gallery={galleryTarget} assets={galleryAssets()} onApply={applyGallery}
      onUpload={uploadGalleryPhoto} onClose={()=>setGalleryTarget(null)} />}
    {shadowTarget && <ShadowDialog onApply={applyShadow} onClose={()=>setShadowTarget(null)} />}
    <footer className="editor-status"><span>{status}</span><span style={{marginLeft:'auto'}}>Revision {doc.revision} · autosave on</span></footer>{toast&&<div className={`toast ${toast.error?'error':''}`}>{toast.message}</div>}{history&&<div className="modal-backdrop" onClick={()=>setHistory(null)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="mini-button" style={{float:'right'}} onClick={()=>setHistory(null)}>×</button><h2>Published versions</h2>{history.length===0&&<p>No published editor versions yet.</p>}{history.map(item=><div className="history-item" key={item.sha}><div><strong>{item.message}</strong><small style={{display:'block'}}>{new Date(item.date).toLocaleString()} · {item.author}</small></div><button className="mini-button" onClick={()=>restore(item.sha)}>Restore draft</button></div>)}</div></div>}{passwordOpen&&<PasswordModal close={()=>setPasswordOpen(false)} notify={notify}/>}</div>;
}

function SidebarResize({ side, mainRef }) {
  const drag = useRef(null);
  const direction = side === 'left' ? 1 : -1;

  function resize(width) {
    const maximum = Math.min(520, window.innerWidth * 0.38);
    const minimum = Math.min(160, window.innerWidth * 0.22);
    mainRef.current?.style.setProperty(`--editor-sidebar-${side}`, `${Math.round(Math.max(minimum, Math.min(maximum, width)))}px`);
  }

  return <div className={`sidebar-resize sidebar-resize-${side}`} role="separator" aria-orientation="vertical"
    aria-label={`Resize ${side} sidebar`} tabIndex={0}
    onPointerDown={event => {
      if (event.button !== 0) return;
      drag.current = { x: event.clientX, width: event.currentTarget.parentElement.offsetWidth };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
        resize(drag.current.width + (event.clientX - drag.current.x) * direction);
      }
    }}
    onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      resize(event.currentTarget.parentElement.offsetWidth + (event.key === 'ArrowRight' ? 12 : -12) * direction);
    }} />;
}

function PositionFields({ position, apply, copiedPosition, onCopy }) {
  const formRef = useRef(null);
  function syncFields() {
    const form = formRef.current;
    if (!form) return;
    for (const axis of ['x', 'y']) {
      const field = form.elements.namedItem(axis);
      if (field !== document.activeElement) field.value = position[axis];
    }
  }
  useEffect(syncFields, [position]);

  function change(event) {
    const axis = event.target.name;
    const number = event.target.valueAsNumber;
    if (Number.isFinite(number)) apply({ ...position, [axis]: number });
  }

  return <form ref={formRef} className="position-fields" onSubmit={event => event.preventDefault()}>
    <strong>Position on page</strong>
    <div className="position-coordinates">
      <label>X (px)<input type="number" name="x" step="any" defaultValue={position.x} onChange={change} onBlur={syncFields} /></label>
      <label>Y (px)<input type="number" name="y" step="any" defaultValue={position.y} onChange={change} onBlur={syncFields} /></label>
    </div>
    <small>{position.anchor ? `Anchored ${position.anchor} in its container` : 'Measured from the top-left of the page'}</small>
    <div className="position-actions">
      <button type="button" onClick={onCopy} title="Copy position">Copy</button>
      <button type="button" disabled={!copiedPosition} onClick={()=>apply(copiedPosition)} title="Paste copied position">Paste</button>
    </div>
  </form>;
}

function PasswordModal({ close, notify }) {
  const [currentPassword,setCurrentPassword]=useState(''); const [newPassword,setNewPassword]=useState(''); const [confirmPassword,setConfirmPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(event){event.preventDefault();setError('');if(newPassword!==confirmPassword)return setError('The new passwords do not match.');setBusy(true);const response=await fetch('/api/editor/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword})});const data=await response.json();setBusy(false);if(!response.ok)return setError(data.error||'Password change failed.');notify('Editor password changed.');close()}
  return <div className="modal-backdrop" onClick={close}><form className="modal password-modal" onSubmit={submit} onClick={event=>event.stopPropagation()}><button type="button" className="mini-button" style={{float:'right'}} onClick={close}>×</button><p className="eyebrow">ACCOUNT SECURITY</p><h2>Change editor password</h2><p>The new password takes effect immediately for future logins. Existing sessions remain signed in until they expire or log out.</p><label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} required /></label><label>New password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={event=>setNewPassword(event.target.value)} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} required /></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="tool-button publish-button password-submit" disabled={busy}>{busy?'Changing…':'Change password'}</button></form></div>;
}
