# ZweeNotes — NUS Cheatsheet Studio

A NUS-first Chrome extension for collecting Canvas study materials, summarizing them with your NVIDIA Nemotron or Qwen API account, and composing editable one-page cheatsheets. Development version **0.2.2** lives in [ZSYUYIIE/zweenotes](https://github.com/ZSYUYIIE/zweenotes).

## What is implemented

- Read Canvas syllabus and assessment announcements on demand; review Midterm/Final coverage with evidence links and conservative week/topic suggestions.
- Detect NUS Canvas course context and read the current course's module/item directory on demand.
- Capture selected/current Canvas study text; import local PDF, TXT, Markdown, VTT or SRT.
- Separate course libraries by Canvas course ID, with lecture/tutorial/lab/reference labels and optional weeks.
- Generate structured knowledge points using Nemotron or Qwen, with page/section/cue references and review flags.
- Reuse completed chunks after cancellation, failure or a second generation attempt.
- Browse retained knowledge, emphasize formulas/methods/mistakes, and prioritize your starred trouble topics.
- Edit, reorder, include/exclude or manually add points; render LaTeX, fenced code, simple tables and local diagrams.
- Compose A4 landscape four-column sheets by default; adjust orientation, columns, font and margins.
- Detect page overflow, fit the font down to 6 pt, and print/save PDF once the sheet fits.
- Save sources and sheets locally, export a course JSON archive, and retain the existing Panopto MP4 downloader.

The layout is an original compact NUS-style revision template. ZweeNotes is not affiliated with NUS, Canvas, Panopto or Studocu and does not bundle other students' notes.

## Build and load

Use Node.js 24+ and Chrome 138+.

```sh
npm ci --ignore-scripts
npm run build
```

Then:

1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Select this project folder (the one containing `manifest.json`).
3. Reload an NUS Canvas course page. Click the extension icon to open the study panel.
4. Sync modules and **assessment guidance** from the side panel on your Canvas course tab. Capture study text, sync the module directory, or import files. Open **Studio**.
5. Open **AI settings**, choose NVIDIA Nemotron or Qwen, enter your key and model, then save and grant the endpoint permission. **Test connection** optionally summarizes a short original example.
6. Select materials, optionally choose Midterm/Final and review the guidance, then choose the connected provider and generate. Materials without a week stay unresolved; final coverage is not inferred from the midterm date. Review the source links, edit points, and fit the page.
7. Use **Print / Save PDF**. Choose A4, the matching orientation, 100% scale, no margins and no browser headers/footers.

The default NVIDIA model is `nvidia/nemotron-3.5-lightning-30b-a3b`, using the fixed `https://integrate.api.nvidia.com/v1` endpoint. Nemotron Super is also selectable but has not been live-tested here. Existing Qwen preferences are preserved. Provider keys and cached results are kept separate; switching providers can create new requests.

Keys are session-only: reconnect after Chrome restarts. Never put an API key in source code, a course archive or a GitHub issue. Workspace-specific Alibaba base URLs are supported; see the [official region/endpoint guide](https://www.alibabacloud.com/help/en/model-studio/regions/).

For a key-free demonstration, click **Load example**, choose **Source extracts (no AI)**, then generate. The sample text is newly authored, not copied from a cheatsheet.

## Package

```sh
npm run build
npm run package
```

The Windows packaging command writes `release/zweenotes-0.2.2.zip` (or a timestamped filename if that archive already exists). It includes only extension files and bundled runtime dependencies. Extract the ZIP into a folder before using Load unpacked. Source checkouts need the build step; the ZIP already includes the generated vendor files.

## Boundaries of this version

- Assessment suggestions recognize English exam labels, explicit week ranges and simple named exclusions. They do not fully interpret topic synonyms, mixed-scope files or arbitrary instructor language. You review the selected materials before generation. Dates/module order are suggestions; the final may be cumulative.
- Canvas sync discovers module links; it does not bulk-download course files. Open an item to capture text or import its file.
- Panopto supplies recording context and the existing download control. Supply subtitles manually; automatic captions, transcription and recording-to-notes are not implemented yet.
- PDF parsing extracts text, not a visual reconstruction. Scans need OCR elsewhere; native slide decks must be exported to PDF.
- Your selected AI provider sees selected source text when you generate. Model output requires review even when references are valid.
- Closing Studio stops in-flight work. Successful chunks remain available for a later attempt. Use one Studio tab per course to avoid concurrent edits or duplicate API requests.
- A one-page content budget cannot preserve every detail of a full course. Omitted points remain in the knowledge library.
- Course archives are export-only in this version. Browser/profile removal or uninstalling the extension can erase local materials.
- This is a development build. Live Nemotron checks passed on three short original examples. Live Canvas integration, full-course PDFs and final printer/PDF-driver output still need checking with actual course materials before a store release.

## Integration checks

```sh
npm test
npm run test:browser
npm run test:canvas
```

Unit checks cover provider isolation, endpoint validation, source references, errors and cancellation. Browser checks use an isolated headless Chrome with fake keys and mocked API responses; install the development dependencies first. They do not use your browser session.

For an optional live NVIDIA check, supply `NVIDIA_API_KEY` only through the process environment and run `npm run test:live -- --stdout`. Do not create a project key file. This sends three original examples, uses your provider quota, and does not automatically retry. See [TESTING.md](TESTING.md) for recorded results and limits.

## Architecture and privacy

See [ARCHITECTURE.md](ARCHITECTURE.md) for the data model, Canvas adapter, provider job flow, one-page renderer and expansion path. See [PRIVACY.md](PRIVACY.md) and [THIRD_PARTY.md](THIRD_PARTY.md) for data handling and bundled dependencies.

This project is separate from the earlier Panopto downloader v1.1.1 Chrome Web Store package. It has not been submitted as a store update.

## License

GPL-3.0-only. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
