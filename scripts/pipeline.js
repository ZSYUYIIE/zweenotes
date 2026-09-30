import { chunkSource, extractAtoms, composeSheet, SCHEMA_VERSION } from './core.js';
import { get, put } from './storage.js';
import { credentials, summarizeChunk } from './qwen.js';

export async function generateSheet(course, sources, options, progress, signal) {
  if (!sources.length) throw new Error('Select at least one material.');
  const atoms = [];
  const config = options.engine === 'qwen' ? await credentials() : null;
  if (config) config.courseName = course.name;
  const work = sources.flatMap(source => chunkSource(source).map((segments, index) => ({ source, segments, index })));
  if (work.length > 80) throw new Error('Select fewer materials for one run (maximum 80 chunks).');
  for (let cursor = 0; cursor < work.length; cursor++) {
    if (signal?.aborted) throw new Error('Generation cancelled. Completed chunks remain saved.');
    const { source, segments, index } = work[cursor];
    const id = JSON.stringify([SCHEMA_VERSION, source.id, source.revision, index, config?.baseUrl || 'local', config?.model || 'extract']);
    const cached = await get('chunks', id);
    progress(`${cached ? 'Reusing' : 'Summarizing'} ${source.title} · ${cursor + 1}/${work.length}`);
    let points = cached?.atoms;
    if (!points) {
      points = config ? await summarizeChunk(config, source, segments, signal) : extractAtoms({ ...source, segments });
      await put('chunks', { id, courseId: course.id, sourceId: source.id, atoms: points, createdAt: Date.now() });
    }
    atoms.push(...points);
  }
  if (signal?.aborted) throw new Error('Generation cancelled. Completed chunks remain saved.');
  if (!atoms.length) throw new Error('No knowledge points were found. Add readable study text.');
  const sheet = composeSheet(course, sources, atoms, options);
  await put('sheets', sheet);
  return sheet;
}
