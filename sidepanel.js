import { $, node, status, createLibrary, sourceInfo, sourceDialog, renderOutline } from './scripts/library-ui.js';
import { ensureCourse, put } from './scripts/storage.js';
const library = createLibrary(async (course, sources) => {
  renderOutline(course);
  $('materials').replaceChildren();
  if (!sources.length) $('materials').append(node('p', 'No materials yet. Capture a page, paste notes or import a file.', 'muted'));
  for (const source of sources) {
    const item = node('div', undefined, 'list-item'); item.append(node('strong', source.title), node('div', sourceInfo(source), 'muted'));
    const view = node('button', 'View'); view.addEventListener('click', () => sourceDialog(source)); item.append(view); $('materials').append(item);
  }
});
$('studio').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('studio.html') + (library.course ? '?course='+encodeURIComponent(library.course.id) : '') }));
$('close-evidence').addEventListener('click', () => $('evidence').close());
$('sync-modules').addEventListener('click', async () => {
  $('sync-modules').disabled = true; status('Reading your Canvas module directory…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) throw new Error('Open a Canvas course tab first.');
    let result;
    try { result = await chrome.tabs.sendMessage(tab.id,{ type:'SYNC_CANVAS_MODULES' }); } catch { throw new Error('Open or reload your NUS Canvas course tab first.'); }
    if (result?.error) throw new Error(result.error);
    if (!result?.context || !Array.isArray(result.modules)) throw new Error('No Canvas course outline found.');
    const course = await ensureCourse(result.context); course.modules=result.modules;course.outlineUpdatedAt=Date.now();await put('courses',course);
    await library.refresh(course.id);status('Module directory saved locally. Open an item to capture its text or import its file.');
  } catch (error) { status(error.message,true); } finally { $('sync-modules').disabled=false; }
});
let activeTab, revision = 0;
async function contextChanged() {
  const token = ++revision;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); activeTab = tab?.id;
  if (!activeTab) return;
  let canvas;
  try { canvas = await chrome.tabs.sendMessage(activeTab, { type: 'GET_NUS_CANVAS_CONTEXT' }); } catch {}
  const context = await chrome.runtime.sendMessage({ type: 'GET_STUDY_CONTEXT', tabId: activeTab });
  if (token !== revision) return;
  if (!canvas && /^https:\/\/(canvas\.nus\.edu\.sg|[^/]+\.panopto\.(com|eu))\//.test(tab.url || '')) canvas = context?.canvas;
  $('context').textContent = canvas ? canvas.courseName+'\n'+canvas.itemTitle : context?.recording ? 'Panopto: '+context.recording.title+'\nSelect the course and import a transcript.' : 'Open a course on NUS Canvas to connect it.';
  if (canvas) await library.adopt(canvas);
}
chrome.tabs.onActivated.addListener(() => contextChanged().catch(e => status(e.message,true)));
chrome.runtime.onMessage.addListener(message => { if (message?.type === 'STUDY_CONTEXT_UPDATED' && message.tabId === activeTab) contextChanged().catch(e => status(e.message,true)); });
library.refresh().then(contextChanged).catch(e => status(e.message,true));
