import { makeSource, textSegments, transcriptSegments } from './core.js';

export async function importFile(file, metadata, progress = () => {}) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a file smaller than 20 MB.');
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'pdf') {
    const pdfjs = await import('../vendor/pdfjs/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false,
      cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href, cMapPacked: true,
      standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href,
      wasmUrl: new URL('../vendor/pdfjs/wasm/', import.meta.url).href
    });
    const segments = [];
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 300) throw new Error('This PDF has more than 300 pages. Split it before importing.');
      let size = 0;
      for (let number = 1; number <= pdf.numPages; number++) {
        progress(`Reading PDF page ${number}/${pdf.numPages}…`);
        const page = await pdf.getPage(number);
        const content = await page.getTextContent();
        const lines = []; let line = ''; let lastY;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const y = item.transform?.[5];
          if (lastY !== undefined && Math.abs(y - lastY) > 3 && line) { lines.push(line); line = ''; }
          line += item.str + (item.hasEOL ? '\n' : ' '); lastY = y;
        }
        if (line) lines.push(line);
        const text = lines.join('\n').trim();
        size += text.length;
        if (size > 350000) throw new Error('PDF text is too long. Import fewer pages at a time.');
        if (text) segments.push({ text, locator: { page: number, label: `p. ${number}` } });
        page.cleanup();
      }
      if (!segments.length) throw new Error('No text was found. This may be a scanned PDF; OCR is not supported yet.');
      return makeSource({ ...metadata, title: metadata.title || file.name, format: 'pdf', segments });
    } finally { await task.destroy(); }
  }
  if (!['txt', 'md', 'vtt', 'srt'].includes(extension)) throw new Error('Import PDF, TXT, Markdown, VTT, or SRT. Export slides to PDF first.');
  const text = await file.text();
  const segments = ['vtt', 'srt'].includes(extension) ? transcriptSegments(text) : textSegments(text);
  return makeSource({ ...metadata, title: metadata.title || file.name, format: extension, segments });
}
