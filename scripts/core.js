export const SCHEMA_VERSION = 1;
export const KINDS = ['concept', 'formula', 'algorithm', 'pattern', 'pitfall'];
export const uid = () => crypto.randomUUID();
export const normalizeText = text => String(text || '').replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim();
export const topicKey = title => String(title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function makeSource({ courseId, title, format = 'text', activity = 'lecture', week = '', segments, text, url = '' }) {
  if (!courseId) throw new Error('Choose a course first.');
  const content = (segments || textSegments(text)).filter(s => normalizeText(s.text));
  if (!content.length) throw new Error('This material contains no readable text.');
  const size = content.reduce((total, s) => total + s.text.length, 0);
  if (size > 350000) throw new Error('Material is too long. Split it into smaller files (350,000 characters each).');
  return {
    id: uid(), courseId, title: String(title || 'Untitled material').slice(0, 200), format,
    activity, week: String(week).slice(0, 40), url, createdAt: Date.now(), revision: uid(),
    segments: content.map((segment, index) => ({ id: `s${index + 1}`, text: normalizeText(segment.text), locator: segment.locator || { label: `Section ${index + 1}` } })).filter(s => s.text)
  };
}

export function textSegments(text) {
  const clean = normalizeText(text);
  if (!clean) return [];
  // Headings inside code fences are content, not section boundaries.
  const parts = []; let lines = [], fence = false, math = false;
  for (const line of clean.split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    if (!fence && /^\s*\$\$\s*$/.test(line)) math = !math;
    if (!fence && !math && /^#{1,4}\s/.test(line) && lines.length) { parts.push(lines.join('\n')); lines = []; }
    lines.push(line);
  }
  if (lines.length) parts.push(lines.join('\n'));
  return parts.map((part, i) => ({ text: part, locator: { label: `Section ${i + 1}` } }));
}

export function transcriptSegments(text) {
  const cues = [];
  const lines = normalizeText(text).split('\n');
  const stamp = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(stamp);
    if (!match) continue;
    const startSeconds = Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
    const words = [];
    while (++i < lines.length && lines[i].trim()) words.push(lines[i].replace(/<[^>]*>/g, ''));
    const body = words.join(' ').trim();
    if (body) cues.push({ text: body, locator: { startSeconds, label: formatTime(startSeconds) } });
  }
  if (!cues.length) throw new Error('No subtitle cues found. Use a valid VTT or SRT transcript.');
  return cues;
}

export function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function chunkSource(source, budget = 11000) {
  const chunks = [];
  let current = [];
  let length = 0;
  const flush = () => { if (current.length) chunks.push(current); current = []; length = 0; };
  for (const segment of source.segments) {
    // Every split retains the original segment ID and locator, so references stay valid.
    for (let offset = 0; offset < segment.text.length; offset += budget) {
      const part = { ...segment, text: segment.text.slice(offset, offset + budget) };
      if (length + part.text.length > budget) flush();
      current.push(part); length += part.text.length;
    }
  }
  flush();
  return chunks;
}

export function kindFor(text) {
  if (/mistake|pitfall|warning|confus|deadlock|race condition|注意|误区/i.test(text)) return 'pitfall';
  if (/algorithm|pseudocode|\bsteps?\b|```|步骤|算法/i.test(text)) return 'algorithm';
  if (/\$|\\frac|\\sum|[=∑∫≤≥]|formula|公式/.test(text)) return 'formula';
  if (/question|recognise|recognize|\bmethod\b|solution|题型|解法/i.test(text)) return 'pattern';
  return 'concept';
}

export function extractAtoms(source) {
  const atoms = [];
  for (const segment of source.segments) {
    const sections = textSegments(segment.text).map(s => s.text);
    for (const section of sections) {
      const heading = section.match(/^#{1,4}\s+(.+)/)?.[1];
      const body = section.replace(/^#{1,4}\s+[^\n]+\n?/, '').trim();
      if (!body) continue;
      const paragraphs = []; let lines = [], fence = false, math = false;
      for (const line of body.split('\n')) {
        if (/^\s*```/.test(line)) fence = !fence;
        if (!fence && /^\s*\$\$\s*$/.test(line)) math = !math;
        if (!line.trim() && !fence && !math && lines.length) { paragraphs.push(lines.join('\n')); lines = []; }
        else lines.push(line);
      }
      if (lines.some(l => l.trim())) paragraphs.push(lines.join('\n'));
      for (const paragraph of paragraphs) {
        const kind = kindFor(paragraph);
        // Preserve formulas, numbered methods, and code verbatim. Extractive mode never invents prose.
        const summary = paragraph.length <= 1000 ? paragraph : paragraph.slice(0, 1000);
        atoms.push({
          id: uid(), sourceId: source.id, title: heading || paragraph.split(/[\n.!?]/)[0].slice(0, 70) || source.title,
          kind, summary, details: [], priority: kind === 'concept' ? 2 : 3,
          references: [{ sourceId: source.id, segmentId: segment.id, locator: segment.locator }],
          engine: 'source-extract', needsReview: paragraph.length > 1000
        });
      }
    }
  }
  return atoms;
}

export function composeSheet(course, sources, atoms, options = {}) {
  const limit = Math.max(1, Math.min(80, Number(options.blockLimit) || 24));
  const allowed = options.kinds || KINDS;
  const trouble = new Set(course.troubleTopics || []);
  const ranked = atoms.filter(atom => allowed.includes(atom.kind)).map((atom, order) => ({
    ...atom, order, trouble: trouble.has(topicKey(atom.title)),
    rank: Number(atom.priority || 2) + (trouble.has(topicKey(atom.title)) ? 10 : 0)
      - (/example|\bquery\b|proof\s+of|unification\s+of|solutions?\s+count/i.test(atom.title) ? 4 : 0)
      + (options.emphasis === 'methods' && ['formula','algorithm','pattern'].includes(atom.kind) ? 3 : 0)
      + (options.emphasis === 'pitfalls' && atom.kind === 'pitfall' ? 3 : 0)
  })).sort((a, b) => b.rank - a.rank || a.order - b.order);
  const selected = [];
  const used = new Set();
  const seen = new Set();
  const add = atom => {
    const fingerprint = `${topicKey(atom.title)}:${normalizeText(atom.summary).toLowerCase()}`;
    if (selected.length >= limit || used.has(atom.id) || seen.has(fingerprint)) return;
    selected.push(atom); used.add(atom.id); seen.add(fingerprint);
  };
  // Include trouble spots first, then reserve representation for each selected source.
  ranked.filter(a => a.trouble).forEach(add);
  for (const source of sources) { const candidate = ranked.find(a => a.sourceId === source.id); if (candidate) add(candidate); }
  // Distribute the remaining budget across materials so one long lecture cannot monopolize the page.
  const queues=sources.map(source=>ranked.filter(a=>a.sourceId===source.id && !used.has(a.id)));
  for(let round=0;selected.length<limit && queues.some(q=>q.length);round++)for(const queue of queues){const atom=queue.shift();if(atom)add(atom);}
  const sourceIndex = Object.fromEntries(sources.map((source, i) => [source.id, { number: i + 1, title: source.title, url: source.url }]));
  return {
    id: uid(), courseId: course.id, title: `${course.name} · Cheatsheet`, schemaVersion: SCHEMA_VERSION,
    createdAt: Date.now(), updatedAt: Date.now(), sourceIds: sources.map(s => s.id), sourceIndex,
    omittedCount: Math.max(0, atoms.length - selected.length),
    layout: { orientation: 'landscape', columns: 4, fontSize: 7.5, margin: 5, references: true },
    blocks: selected.map(atom => ({ ...atom, included: true, body: [atom.summary, ...atom.details.map(d => `• ${d}`)].join('\n') }))
  };
}
