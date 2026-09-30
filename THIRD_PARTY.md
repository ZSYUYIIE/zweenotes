# Bundled dependencies

Production dependencies are pinned in `package-lock.json` and copied into `vendor/` by `npm run build`. Runtime scripts, workers, styles and fonts load from the extension package, with no CDN.

| Dependency | Version | License | Purpose |
| --- | --- | --- | --- |
| [PDF.js](https://github.com/mozilla/pdf.js) / pdfjs-dist | 6.3.289 | Apache-2.0 | Local extraction of text and page locators from PDFs |
| [KaTeX](https://github.com/KaTeX/KaTeX) | 0.18.9 | MIT | Local rendering of mathematical notation |

Their license files are included in the packaged `vendor/pdfjs/` and `vendor/katex/` directories. See `NOTICE.md` for the downloader's upstream attribution. Demo course text is newly authored for this project. No Studocu document, logo or template asset is bundled.
