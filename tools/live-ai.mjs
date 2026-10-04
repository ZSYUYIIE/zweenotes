// Optional, explicitly invoked live check. Keys come from process memory, never a project file.
import { mkdir, writeFile } from 'node:fs/promises';
import { makeSource, composeSheet } from '../scripts/core.js';
import { summarizeChunk } from '../scripts/ai.js';
import { PROVIDERS } from '../scripts/providers.js';
const key = process.env.NVIDIA_API_KEY || process.env.ZWEE_LIVE_KEY;
if (!key) { console.error('Set NVIDIA_API_KEY in this process before running the live check.'); process.exit(1); }
const config = { provider: 'nemotron', ...PROVIDERS.nemotron, key, courseName: 'Original OS revision examples' };
const course = { id: 'live-demo:os', name: config.courseName, troubleTopics: [] };
const examples = [
  { title: 'Address translation', activity: 'lecture', text: '# Paging\nFor page size 2^k, the low k bits of a virtual address are the offset. The remaining high bits identify the virtual page number. VA = VPN * 2^k + offset. Translate the VPN to a physical frame number while preserving the offset.\n\n# Scheduling metrics\nFor a process with one CPU burst: turnaround = completion - arrival, waiting = turnaround - burst, response = first run - arrival.' },
  { title: 'Critical-section practice', activity: 'tutorial', text: '# Shared counter\nTwo threads each increment a shared counter. A read-modify-write is not atomic, so an interleaving can lose an update. Protect the whole increment with the same mutex.\n\n# Solution method\nIdentify shared state, enumerate each read and write, protect the full operation, then check the mutex is released on every exit path.' },
  { title: 'C debugging checklist', activity: 'lab', text: '# Compile\n```sh\ncc -Wall -Wextra -g program.c -o program\n```\n\n# Diagnose\nCheck function return values before using outputs. Reproduce the failing input and isolate the smallest case. For a crash, inspect a debugger backtrace and state at the failing operation. Out-of-bounds access is undefined behavior even if the program appears to work.' }
];
const checks = [], allAtoms = [], sources = [], started = Date.now();
for (const example of examples) {
  const source = makeSource({ ...example, format: 'md', courseId: course.id }); sources.push(source);
  const usage = {}; const callStarted = Date.now();
  const fetcher = async (url, options) => {
    const response = await fetch(url, options);
    if (response.ok) {
      const body = await response.clone().json(); Object.assign(usage, body.usage || {});
      let data;try { data=JSON.parse(body.choices?.[0]?.message?.content); } catch {}
      const cited=data?.atoms?.flatMap(a=>Array.isArray(a.segmentIds)?a.segmentIds:[])||[];
      const invalid=[...new Set(cited.filter(id=>!source.segments.some(s=>s.id===id)))];
      const missing=data?.atoms?.some(a=>!Array.isArray(a.segmentIds)||!a.segmentIds.length);
      if(invalid.length||missing)console.log(JSON.stringify({suppliedSegments:source.segments.map(s=>s.id),returnedSegments:data?.atoms?.map(a=>a.segmentIds),invalidReferences:invalid}));
    }
    return response;
  };
  try {
    const atoms = await summarizeChunk(config, source, source.segments, undefined, fetcher);
    if (!atoms.every(a => a.engine === 'nemotron' && a.needsReview && a.references.every(r => r.sourceId === source.id && source.segments.some(s => s.id === r.segmentId)))) throw new Error('Provenance or review flags failed.');
    allAtoms.push(...atoms);
    const check = { activity: source.activity, atomCount: atoms.length, elapsedMs: Date.now()-callStarted, sourceReferencesValid: true, usage, titles: atoms.map(a=>a.title) };
    checks.push(check); console.log(JSON.stringify(check));
  } catch (error) { console.error(error.message.replaceAll(key,'[redacted]')); process.exitCode=1; break; }
}
if (!process.exitCode) {
  const sheet = composeSheet(course,sources,allAtoms,{blockLimit:24});
  const result = { provider: config.provider, model: config.model, totalElapsedMs: Date.now()-started, requests: checks.length, checks, composedSheetPoints: sheet.blocks.length, allSourceReferencesValid: true };
  if (process.argv.includes('--stdout')) console.log(JSON.stringify({report:result}));
  else {
    await mkdir(new URL('../release/',import.meta.url),{recursive:true});
    await writeFile(new URL('../release/nemotron-live-check.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  }
  console.log(JSON.stringify({result:'PASS',requests:checks.length,points:sheet.blocks.length,elapsedMs:result.totalElapsedMs}));
}
