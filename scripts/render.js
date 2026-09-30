import katex from '../vendor/katex/katex.mjs';
import { node } from './library-ui.js';
function inline(parent, text) {
  const pattern = /(\$\$[^]*?\$\$|\$[^\n$]+\$|\*\*[^*]+\*\*|`[^`]+`)/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(offset, match.index)));
    const token = match[0];
    if (token.startsWith('$')) {
      const display = token.startsWith('$$'), element = node(display ? 'div' : 'span');
      try { katex.render(token.slice(display ? 2 : 1, display ? -2 : -1), element, { displayMode: display, throwOnError: true, trust: false, strict: 'warn', maxExpand: 500, maxSize: 20 }); }
      catch { element.textContent = token; element.className = 'math-error'; element.title = 'Invalid LaTeX: edit this formula.'; }
      parent.append(element);
    } else parent.append(node(token.startsWith('**') ? 'strong' : 'code', token.slice(token.startsWith('**') ? 2 : 1, token.startsWith('**') ? -2 : -1)));
    offset = match.index + token.length;
  }
  parent.append(document.createTextNode(text.slice(offset)));
}
export function renderBody(parent, body) {
  const lines = String(body || '').split('\n');
  let paragraph = [], code = null, table = [];
  const flushParagraph = () => { if (paragraph.length) { const p = node('p'); inline(p, paragraph.join('\n')); parent.append(p); paragraph = []; } };
  const flushTable = () => {
    if (!table.length) return;
    const el = node('table');
    table.forEach((line, index) => {
      const cells = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
      if (cells.every(c => /^\s*:?-+:?\s*$/.test(c))) return;
      const row = node('tr'); for (const value of cells) { const cell = node(index === 0 ? 'th' : 'td'); inline(cell, value.trim()); row.append(cell); } el.append(row);
    }); parent.append(el); table = [];
  };
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      flushParagraph(); flushTable(); if (code !== null) { parent.append(node('pre', code.join('\n'))); code = null; } else code = []; continue;
    }
    if (code !== null) { code.push(line); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) { flushParagraph(); table.push(line); continue; }
    flushTable(); if (!line.trim()) flushParagraph(); else paragraph.push(line);
  }
  flushParagraph(); flushTable(); if (code !== null) parent.append(node('pre', code.join('\n')));
}
export function renderPaper(sheet, course) {
  const paper = document.getElementById('paper'), columns = document.getElementById('paper-columns');
  const { orientation, margin, fontSize } = sheet.layout;
  paper.style.width = orientation === 'portrait' ? '210mm' : '297mm'; paper.style.height = orientation === 'portrait' ? '297mm' : '210mm';
  paper.style.padding = margin+'mm'; paper.style.fontSize = fontSize+'pt'; columns.style.columnCount = sheet.layout.columns;
  document.getElementById('print-size').textContent = '@page { size: A4 '+orientation+'; margin: 0; }';
  document.getElementById('paper-title').textContent = sheet.title;
  document.getElementById('paper-meta').textContent = 'ZweeNotes · '+sheet.blocks.filter(b => b.included).length+' points';
  columns.replaceChildren();
  for (const block of sheet.blocks.filter(b => b.included)) {
    const el = node('section', undefined, 'sheet-block'); el.append(node('h2', block.title));
    const body = node('div', undefined, 'body'); renderBody(body, block.body); el.append(body);
    if (typeof block.image === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(block.image)) {
      const image = node('img'); image.alt=block.title+' diagram'; image.className='sheet-diagram';
      for (const event of ['load','error']) image.addEventListener(event,()=>dispatchEvent(new Event('zweenotes-image-ready')),{once:true});
      image.src=block.image; el.append(image);
    }
    if (sheet.layout.references && block.references?.length) {
      const markers = block.references.map(r => '['+(sheet.sourceIndex[r.sourceId]?.number || '?')+' · '+r.locator.label+']'); el.append(node('sup', markers.join(' ')));
    } columns.append(el);
  }
  const footer = document.getElementById('paper-sources');
  footer.textContent = sheet.layout.references ? Object.values(sheet.sourceIndex).map(s => '['+s.number+'] '+s.title).join('   |   ') : '';
  footer.hidden = !sheet.layout.references;
}
export function pageOverflow() {
  const paper = document.getElementById('paper'), columns = document.getElementById('paper-columns');
  if (columns.clientHeight < 20 || columns.scrollWidth > columns.clientWidth + 2 || paper.scrollHeight > paper.clientHeight + 2) return true;
  const area = columns.getBoundingClientRect();
  return [...columns.querySelectorAll('.sheet-block, pre, table, .katex-display, .katex')].some(el => [...el.getClientRects()].some(rect => rect.right > area.right + 1 || rect.bottom > area.bottom + 1 || rect.left < area.left - 1));
}
