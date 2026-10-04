import { uid, makeSource } from './core.js';
import { list, put, ensureCourse, removeSource } from './storage.js';
import { importFile } from './importers.js';
export const $ = id => document.getElementById(id);
export function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
export function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
export function download(name, data, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = node('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 20000);
}
export async function captureCanvas() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error('Open your NUS Canvas page first.');
  let response;
  try { response = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_CANVAS_SOURCE' }); }
  catch { throw new Error('Open or reload an NUS Canvas course page, then capture it from the side panel.'); }
  if (response?.error) throw new Error(response.error);
  if (!response?.context || !response.text) throw new Error('No Canvas study text found.');
  return response;
}
export function createLibrary(onChange, { capture = true } = {}) {
  let course, sources = [], busy = false;
  async function refresh(preferred = course?.id) {
    const courses = (await list('courses')).sort((a, b) => a.name.localeCompare(b.name));
    $('course').replaceChildren(...courses.map(c => { const option = node('option', c.name); option.value = c.id; return option; }));
    if (!courses.length) { const o = node('option', 'Add a course to begin'); o.value = ''; $('course').append(o); }
    course = courses.find(c => c.id === preferred) || courses[0];
    if (course) $('course').value = course.id;
    sources = course ? (await list('sources', course.id)).sort((a,b) => a.createdAt-b.createdAt) : [];
    await onChange(course, sources);
  }
  async function task(fn) {
    if (busy) return;
    busy = true;
    for (const id of ['add-course','import','paste','capture']) if ($(id)) $(id).disabled = true;
    $('course').disabled = true;
    try { await fn(); } catch (error) { status(error.message, true); }
    finally { busy = false; $('course').disabled = false; for (const id of ['add-course','import','paste','capture']) if ($(id)) $(id).disabled = false; }
  }
  function metadata() {
    if (!course) throw new Error('Add or select a course first.');
    return { courseId: course.id, title: $('material-title').value.trim(), activity: $('activity').value, week: $('week').value.trim() };
  }
  $('course').addEventListener('change', () => task(() => refresh($('course').value)));
  $('add-course').addEventListener('click', () => task(async () => {
    const name = $('course-name').value.trim();
    if (!name) throw new Error('Enter your course name, for example CS2106 AY26/27 S1.');
    const id = 'manual:' + uid();
    await put('courses', { id, name: name.slice(0,160), troubleTopics: [], updatedAt: Date.now() });
    $('course-name').value = ''; await refresh(id); status('Course saved locally.');
  }));
  $('paste').addEventListener('click', () => task(async () => {
    const source = makeSource({ ...metadata(), text: $('material-text').value });
    await put('sources', source); $('material-text').value = ''; $('material-title').value = '';
    await refresh(); status('Material saved in this course.');
  }));
  $('import').addEventListener('click', () => task(async () => {
    const files = [...$('files').files]; if (!files.length) throw new Error('Choose files to import.');
    const meta = metadata(); let completed = 0;
    try {
      for (const file of files) { const source = await importFile(file, { ...meta, title: files.length === 1 ? meta.title : '' }, status); await put('sources', source); completed++; }
      $('files').value = ''; $('material-title').value = ''; status(completed+' material(s) imported locally.');
    } finally { await refresh(); }
  }));
  if (capture) $('capture').addEventListener('click', () => task(async () => {
    const result = await captureCanvas(); const target = await ensureCourse(result.context);
    const source = makeSource({ courseId: target.id, title: result.context.itemTitle, format: 'canvas', activity: $('activity').value, week: $('week').value, text: result.text, url: result.context.pageUrl });
    await put('sources', source); await refresh(target.id); status('Canvas text saved locally. Review the source before generating.');
  }));
  return { refresh, get course() { return course; }, get sources() { return sources; }, async remove(id) { await removeSource(id, course.id); await refresh(); }, async adopt(context) { const target = await ensureCourse(context); await refresh(target.id); } };
}
export function sourceInfo(source) { return source.activity+(source.week ? ' · week '+source.week : '')+' · '+source.format.toUpperCase()+' · '+source.segments.length+' section(s)'; }
export function renderOutline(course) {
  const root = $('outline'); if (!root) return;
  root.replaceChildren();
  if (!course?.modules?.length) { root.append(node('p', 'Sync modules from the side panel on a Canvas course tab.', 'muted')); return; }
  for (const module of course.modules) {
    const details = node('details', undefined, 'list-item'); details.append(node('summary', module.title));
    for (const item of module.items || []) {
      const row = node('div', undefined, 'list-item'); row.append(node('small', item.type+' · '));
      if (/^https:\/\/canvas\.nus\.edu\.sg\/courses\//.test(item.url)) { const a = node('a', item.title); a.href=item.url; a.target='_blank'; a.rel='noreferrer'; row.append(a); }
      else row.append(node('span',item.title)); details.append(row);
    }
    root.append(details);
  }
}
export function sourceDialog(source) {
  const dialog = $('evidence'); const content = $('evidence-content'); content.replaceChildren();
  content.append(node('h2', source.title), node('p', sourceInfo(source),'muted'));
  for (const segment of source.segments) { content.append(node('h3', segment.locator.label), node('pre', segment.text)); }
  dialog.showModal();
}
