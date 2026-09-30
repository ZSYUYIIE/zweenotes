import { KINDS, uid, topicKey } from './scripts/core.js';
import { list, get, put } from './scripts/storage.js';
import { $, node, status, createLibrary, sourceInfo, sourceDialog, download, renderOutline } from './scripts/library-ui.js';
import { generateSheet } from './scripts/pipeline.js';
import { renderPaper, pageOverflow } from './scripts/render.js';
import { loadDemo } from './scripts/demo.js';

let sheet = null, sheetHistory = [], selected = new Set(), knownSourceIds = new Set(), currentCourseId, controller, saveTimer, previewTimer;
let saveQueue = Promise.resolve(), loading = 0;
let savePending = false;
function safely(fn) { return (...args) => Promise.resolve().then(() => fn(...args)).catch(error => status(error.message, true)); }
function button(text, handler, className) { const el = node('button', text, className); el.type = 'button'; el.addEventListener('click', safely(handler)); return el; }
function queueSave(value) {
  const snapshot = structuredClone(value);
  saveQueue = saveQueue.catch(() => {}).then(() => put('sheets', snapshot));
  saveQueue.then(() => { if (sheet?.id === snapshot.id && sheet.updatedAt === snapshot.updatedAt) { savePending=false; $('save-status').textContent='Saved locally'; } }).catch(error => { $('save-status').textContent='Save failed'; status(error.message,true); });
  return saveQueue;
}
function flushSave() { clearTimeout(saveTimer); if (sheet) return queueSave(sheet); return saveQueue; }
function changed({ editor = false } = {}) {
  if (!sheet) return;
  savePending=true; $('save-status').textContent='Saving…';
  sheet.updatedAt = Date.now(); clearTimeout(saveTimer);
  const edited=structuredClone(sheet); saveTimer = setTimeout(() => queueSave(edited), 350);
  if (editor) renderEditor(); schedulePreview();
}
function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(updatePreview, 80); }
function updatePreview() {
  if (!sheet) { $('print').disabled = true; document.body.dataset.printBlocked = 'true'; return; }
  renderPaper(sheet, library.course);
  checkPageFit();
  const container = document.querySelector('.paper-scroll');
  // Zoom only the screen preview. Print always uses physical A4 dimensions.
  const width = sheet.layout.orientation === 'portrait' ? 793.7 : 1122.5;
  $('paper').style.zoom = Math.max(.3, Math.min(1, (container.clientWidth-20)/width));
}
function checkPageFit() {
  if (!sheet) return;
  const included = sheet.blocks.filter(b => b.included);
  const pending = included.filter(b => b.needsReview).length;
  $('point-count').textContent = included.length+' included · '+sheet.omittedCount+' not selected';
  const overflow = pageOverflow();
  const imageIssue = [...$('paper').querySelectorAll('img')].some(img => !img.complete || !img.naturalWidth);
  $('paper').classList.toggle('paper-overflow', overflow);
  $('fit-status').textContent = !included.length ? 'Include at least one point.' : imageIssue ? 'Waiting for diagrams to load. Replace any unreadable image before printing.' : overflow ? 'Content exceeds one page. Exclude points, shorten text, or fit the font.' : 'Fits one A4 page · '+sheet.layout.fontSize+' pt'+(pending ? ' · '+pending+' point(s) need review' : '');
  $('fit-status').classList.toggle('error', overflow);
  $('print').disabled = overflow || imageIssue || !included.length;
  document.body.dataset.printBlocked = String(overflow || imageIssue || !included.length);
}
async function history(course) {
  sheetHistory = course ? (await list('sheets',course.id)).sort((a,b) => b.updatedAt-a.updatedAt) : [];
  $('history').replaceChildren(...sheetHistory.map(s => { const o = node('option', s.title); o.value=s.id; return o; }));
  if (!sheetHistory.length) { const o=node('option','No saved sheets'); o.value=''; $('history').append(o); }
  if (sheet) $('history').value=sheet.id;
}
function troubleView(course) {
  const topics = course?.troubleTopics || []; $('trouble-topics').replaceChildren();
  if (!topics.length) $('trouble-topics').append(node('p','No starred topics yet.','muted'));
  for (const title of topics) {
    const item = node('div',undefined,'list-item'); item.append(node('span',title));
    item.append(button('Remove', async () => { course.troubleTopics=course.troubleTopics.filter(t=>t!==title); await put('courses',course); troubleView(course); renderEditor(); })); $('trouble-topics').append(item);
  }
}
function selectionInfo() {
  const sources=library.sources.filter(s=>selected.has(s.id));
  const chars=sources.reduce((total,s)=>total+s.segments.reduce((n,x)=>n+x.text.length,0),0);
  $('send-summary').textContent=$('engine').value==='qwen' ? sources.length+' material(s), '+chars.toLocaleString()+' characters selected. Generate sends this text to Qwen; usage is billed by your API account. Saved chunks are reused.' : sources.length+' material(s) selected. Extracts use your original text without AI rewriting.';
}
const library=createLibrary(async (course,sources) => {
  const token=++loading;
  const courseChanged=course?.id!==currentCourseId;
  if (courseChanged) { await flushSave(); currentCourseId=course?.id; sheet=null; selected=new Set(sources.map(s=>s.id)); }
  else { const ids=new Set(sources.map(s=>s.id)); selected=new Set([...selected].filter(id=>ids.has(id))); for(const id of ids)if(!knownSourceIds.has(id))selected.add(id); }
  knownSourceIds=new Set(sources.map(s=>s.id));
  $('materials').replaceChildren();
  renderOutline(course);
  if (!sources.length) $('materials').append(node('p','Import files or paste notes to start.','muted'));
  for (const source of sources) {
    const item=node('div',undefined,'list-item'); const label=node('label',undefined,'check'), check=node('input'); check.type='checkbox'; check.checked=selected.has(source.id);
    check.addEventListener('change',()=>{check.checked?selected.add(source.id):selected.delete(source.id);selectionInfo();});
    const copy=node('div'); copy.append(node('strong',source.title),node('div',sourceInfo(source),'muted')); label.append(check,copy); item.append(label);
    const row=node('div',undefined,'row'); row.append(button('View source',()=>sourceDialog(source)),button('Delete',async()=>{
      if (!confirm('Delete this material and its cached knowledge points? Existing sheets keep their text and references.')) return;
      await library.remove(source.id);
    },'danger')); item.append(row); $('materials').append(item);
  }
  await history(course); if(token!==loading)return;
  if(courseChanged && sheetHistory.length) sheet=await get('sheets',sheetHistory[0].id);
  if(token!==loading)return;
  activateSheet(); troubleView(course); selectionInfo();
},{capture:false});
function activateSheet() {
  $('sheet-title').disabled=!sheet; $('add-block').disabled=!sheet; $('sheet-title').value=sheet?.title||'';
  if(sheet) {
    $('history').value=sheet.id; $('orientation').value=sheet.layout.orientation; $('columns').value=sheet.layout.columns;
    $('font-size').value=sheet.layout.fontSize; $('margin').value=sheet.layout.margin; $('references').checked=sheet.layout.references;
  }
  renderEditor(); updatePreview();
  if(!sheet) { $('paper-title').textContent='Your course, on one page.'; $('paper-columns').replaceChildren(); $('paper-sources').textContent=''; $('paper-meta').textContent=''; $('fit-status').textContent='Select materials and generate a cheatsheet.'; $('point-count').textContent=''; }
}
async function evidence(block) {
  const content=$('evidence-content'); content.replaceChildren(node('h2',block.title));
  if(!block.references?.length)content.append(node('p','This is a manually added point.','muted'));
  for(const ref of block.references||[]) {
    const source=await get('sources',ref.sourceId); const segment=source?.segments.find(s=>s.id===ref.segmentId);
    const item=node('section',undefined,'evidence-ref'); item.append(node('h3',(source?.title||sheet.sourceIndex[ref.sourceId]?.title||'Deleted source')+' · '+ref.locator.label));
    item.append(node('pre',segment?.text||'Source text is no longer stored in this library.'));
    if(source?.url && /^https:\/\/canvas\.nus\.edu\.sg\//.test(source.url)) { const a=node('a','Open Canvas item ↗'); a.href=source.url; a.target='_blank'; a.rel='noreferrer'; item.append(a); } content.append(item);
  }
  $('evidence').showModal();
}
function renderEditor() {
  $('blocks').replaceChildren();
  if(!sheet) { $('blocks').append(node('div','Your revision points will appear here.','empty')); return; }
  sheet.blocks.forEach((block,index)=>{
    const card=node('section',undefined,'block-editor'+(block.included?'':' excluded'));
    const row=node('div',undefined,'row spread'), include=node('label',undefined,'check'), check=node('input'); check.type='checkbox';check.checked=block.included;
    check.addEventListener('change',()=>{block.included=check.checked;changed({editor:true});});include.append(check,node('span','Include'));
    const tools=node('div',undefined,'row'); const star=button('★',async()=>{
      const key=topicKey(block.title); const course=library.course; const set=new Set(course.troubleTopics||[]);set.has(key)?set.delete(key):set.add(key);course.troubleTopics=[...set];await put('courses',course);troubleView(course);renderEditor();
    },'star');star.title='Prioritize this topic in future cheatsheets';star.classList.toggle('active',(library.course?.troubleTopics||[]).includes(topicKey(block.title)));
    tools.append(star,button('↑',()=>{if(index){[sheet.blocks[index-1],sheet.blocks[index]]=[sheet.blocks[index],sheet.blocks[index-1]];changed({editor:true});}}),button('↓',()=>{if(index<sheet.blocks.length-1){[sheet.blocks[index+1],sheet.blocks[index]]=[sheet.blocks[index],sheet.blocks[index+1]];changed({editor:true});}}),button('×',()=>{sheet.blocks.splice(index,1);changed({editor:true});},'danger'));row.append(include,tools);card.append(row);
    const titleLabel=node('label','Topic'), title=node('input');title.value=block.title;title.maxLength=180;title.addEventListener('input',()=>{block.title=title.value;changed();});titleLabel.append(title);card.append(titleLabel);
    const bodyLabel=node('label','Revision text'), body=node('textarea');body.value=block.body;body.maxLength=15000;body.addEventListener('input',()=>{block.body=body.value;changed();});bodyLabel.append(body);card.append(bodyLabel);
    const bottom=node('div',undefined,'row'); const kind=node('select');for(const value of KINDS)kind.append(node('option',value));kind.value=block.kind;kind.title='Knowledge point type';kind.addEventListener('change',()=>{block.kind=kind.value;changed();});
    bottom.append(kind,button('Source',()=>evidence(block)));
    if(block.needsReview) bottom.append(button('Mark reviewed',()=>{block.needsReview=false;changed({editor:true});}));
    const figure=node('label','Diagram (PNG, JPG or WebP · up to 1 MB)'), image=node('input');image.type='file';image.accept='image/png,image/jpeg,image/webp';
    image.addEventListener('change',safely(async()=>{
      const file=image.files[0];if(!file)return;const owner=sheet.id;
      if(file.size>1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PNG, JPG or WebP smaller than 1 MB.');
      let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw new Error('This file is not a readable image.');}
      const large=bitmap.width>4000 || bitmap.height>4000;bitmap.close();if(large)throw new Error('Choose an image at most 4000 pixels wide and tall.');
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read image.'));reader.readAsDataURL(file);});
      if(sheet?.id!==owner)return;block.image=data;changed({editor:true});
    }));figure.append(image);card.append(figure);
    if(block.image)card.append(button('Remove diagram',()=>{delete block.image;changed({editor:true});}));
    card.append(bottom,node('div',block.needsReview?'Needs review · '+(block.engine==='qwen'?'AI generated':'source extract truncated'):'Reviewed / manually authored',block.needsReview?'review-label':'muted'));$('blocks').append(card);
  });
}
$('generate').addEventListener('click',safely(async()=>{
  if(controller)return;
  if(!library.course)throw new Error('Choose a course first.');
  const sources=library.sources.filter(s=>selected.has(s.id));if(!sources.length)throw new Error('Select at least one material.');
  await flushSave(); controller=new AbortController();
  $('library-controls').disabled=true;$('generate').disabled=true;$('cancel').hidden=false;$('demo').disabled=true;$('history').disabled=true;
  try {
    const generated=await generateSheet(library.course,sources,{engine:$('engine').value,blockLimit:$('budget').value,emphasis:$('emphasis').value},status,controller.signal);
    await flushSave();sheet=generated;
    await history(library.course);activateSheet();
    status('Saved locally. Review source links and edit your sheet. '+sheet.omittedCount+' point(s) remain in the knowledge library but were not selected for this sheet.');
  } finally {controller=null;$('library-controls').disabled=false;$('generate').disabled=false;$('cancel').hidden=true;$('demo').disabled=false;$('history').disabled=false;}
}));
$('cancel').addEventListener('click',()=>controller?.abort());
$('history').addEventListener('change',safely(async()=>{await flushSave();sheet=await get('sheets',$('history').value);activateSheet();}));
$('sheet-title').addEventListener('input',()=>{if(sheet){sheet.title=$('sheet-title').value.slice(0,200);changed();}});
$('add-block').addEventListener('click',()=>{if(sheet){sheet.blocks.push({id:uid(),title:'New topic',body:'',kind:'concept',included:true,engine:'manual',references:[],needsReview:false});changed({editor:true});}});
for(const id of ['orientation','columns','font-size','margin','references'])$(id).addEventListener('change',()=>{
  if(!sheet)return;sheet.layout={orientation:$('orientation').value,columns:Number($('columns').value),fontSize:Math.max(6,Math.min(12,Number($('font-size').value)||7.5)),margin:Math.max(3,Math.min(12,Number($('margin').value)||5)),references:$('references').checked};
  $('font-size').value=sheet.layout.fontSize;$('margin').value=sheet.layout.margin;changed();
});
$('fit').addEventListener('click',()=>{
  if(!sheet)return;
  // Only change type size; never drop or clip selected content.
  $('paper').style.zoom=1;renderPaper(sheet,library.course);
  while(pageOverflow() && sheet.layout.fontSize>6){sheet.layout.fontSize=Math.max(6,sheet.layout.fontSize-.25);renderPaper(sheet,library.course);}
  $('font-size').value=sheet.layout.fontSize;changed();updatePreview();
});
$('print').addEventListener('click',safely(async()=>{
  await flushSave();clearTimeout(previewTimer);updatePreview();await document.fonts.ready;
  await Promise.allSettled([...$('paper').querySelectorAll('img')].map(img=>img.decode()));
  checkPageFit();if($('print').disabled)return;window.print();
}));
addEventListener('beforeprint',()=>{checkPageFit();});
addEventListener('zweenotes-image-ready',checkPageFit);
$('close-evidence').addEventListener('click',()=>$('evidence').close());
$('engine').addEventListener('change',selectionInfo);
$('knowledge').addEventListener('click',safely(async()=>{
  if(!library.course)throw new Error('Choose a course first.');
  const chunks=await list('chunks',library.course.id), seen=new Set();
  const content=$('evidence-content'); content.replaceChildren(node('h2','Course knowledge library'));
  let count=0;
  for(const chunk of chunks) for(const atom of chunk.atoms) {
    const key=atom.sourceId+':'+topicKey(atom.title)+':'+atom.summary;
    if(seen.has(key))continue;seen.add(key);count++;
    const item=node('section',undefined,'evidence-ref');item.append(node('h3',atom.title),node('p',atom.summary));
    item.append(node('small',(sheet?.sourceIndex[atom.sourceId]?.title||library.sources.find(s=>s.id===atom.sourceId)?.title||'Source')+' · '+atom.kind));
    const add=button('Add to sheet',()=>{
      if(!sheet)throw new Error('Generate a sheet first.');
      if(!sheet.sourceIndex[atom.sourceId]){
        const source=library.sources.find(s=>s.id===atom.sourceId);sheet.sourceIndex[atom.sourceId]={number:Object.keys(sheet.sourceIndex).length+1,title:source?.title||'Source',url:source?.url||''};sheet.sourceIds.push(atom.sourceId);
      }
      sheet.blocks.push({...structuredClone(atom),included:true,body:[atom.summary,...atom.details.map(d=>'• '+d)].join('\n')});
      if(sheet.omittedCount>0)sheet.omittedCount--;changed({editor:true});add.disabled=true;
    });add.disabled=!sheet || sheet.blocks.some(b=>b.id===atom.id);item.append(add);content.append(item);
  }
  if(!count)content.append(node('p','Generate from materials to create the knowledge library.','muted'));
  $('evidence').showModal();
}));
$('reload').addEventListener('click',safely(()=>library.refresh()));
$('demo').addEventListener('click',safely(async()=>{const id=await loadDemo();await library.refresh(id);$('engine').value='source-extract';selectionInfo();status('Original sample materials loaded. Use source extracts to try the layout, or choose Qwen to summarize them.');}));
$('export').addEventListener('click',safely(async()=>{
  if(!library.course)throw new Error('Choose a course first.');await flushSave();
  const course=library.course;
  download('zweenotes-course.json',JSON.stringify({format:'zweenotes-course',version:1,exportedAt:new Date().toISOString(),course,sources:await list('sources',course.id),knowledge:await list('chunks',course.id),sheets:await list('sheets',course.id)},null,2));status('Course, source text and sheets exported. Treat this file as private course material.');
}));
addEventListener('resize',schedulePreview);
addEventListener('pagehide',()=>{flushSave();});
addEventListener('beforeunload',event=>{if(savePending){event.preventDefault();event.returnValue='';}});
document.fonts.ready.then(schedulePreview);
chrome.storage.onChanged.addListener((_changes,area)=>{if(area==='session')aiStatus();});
async function aiStatus(){const values=await chrome.storage.session.get('qwen_credentials');$('ai-status').textContent=values.qwen_credentials?.key?'Qwen connected for this session':'Qwen not connected';}
await library.refresh(new URLSearchParams(location.search).get('course')||undefined).catch(e=>status(e.message,true));
aiStatus().catch(()=>{$('ai-status').textContent='Open AI settings to connect';});
