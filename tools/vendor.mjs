import { mkdir, copyFile, cp } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const dest = new URL('vendor/', root);
await mkdir(new URL('pdfjs/', dest), { recursive: true });
for (const name of ['pdf.mjs', 'pdf.worker.mjs']) {
  await copyFile(new URL(`node_modules/pdfjs-dist/build/${name}`, root), new URL(`pdfjs/${name}`, dest));
}
for (const name of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(new URL(`node_modules/pdfjs-dist/${name}`, root), new URL(`pdfjs/${name}`, dest), { recursive: true });
}
await copyFile(new URL('node_modules/pdfjs-dist/LICENSE', root), new URL('pdfjs/LICENSE', dest));
await cp(new URL('node_modules/katex/dist/', root), new URL('katex/', dest), { recursive: true });
await copyFile(new URL('node_modules/katex/LICENSE', root), new URL('katex/LICENSE', dest));
console.log('Bundled PDF.js and KaTeX locally for the extension.');
