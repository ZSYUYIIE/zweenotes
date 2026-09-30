# Privacy notes — ZweeNotes 0.2.0

Updated 2026-09-30. These notes describe the development Cheatsheet Studio project, not the previously submitted downloader-only Chrome Web Store package.

## Canvas and Panopto context

On NUS Canvas course pages, the extension reads the current course ID, visible name, item title/type and page path. Per-tab context is kept in Chrome session storage. Opening the panel from Panopto also records the recording ID, title and page path. Query parameters/fragments are removed from stored context URLs.

Clicking **Capture Canvas text** reads your selection or the current page's study-content container. Clicking **Sync this course's modules** performs read-only requests to that course's Canvas module API using the existing first-party Canvas login; it stores module titles, item titles/types and same-course navigation links locally. It does not automatically collect grades, submissions, student replies or assessment attempts. Capture selections are user-controlled: check what you have selected.

The existing downloader obtains a direct media URL from the logged-in Panopto player and asks Chrome Downloads to save it. ZweeNotes has no conversion server; signed media URLs are not sent to an AI service. Recording transcripts must currently be supplied as local VTT/SRT files.

## Local course library

Imported text/PDF/subtitle contents, source locators, course labels, knowledge points, personal trouble topics, sheet edits and user-added diagrams persist in IndexedDB in this Chrome profile. PDF text extraction and formula rendering run locally with packaged libraries. No ZweeNotes account, hosted database, analytics or tracking endpoint is present.

Local course data is not encrypted by the extension. People or software with access to this browser profile may be able to read it. Use separate Chrome profiles for different people. Export Project downloads a JSON file containing the current course's source text, knowledge and sheets, never API credentials. The export may contain private course material.

Deleting a source removes that material and its cached knowledge chunks. Existing sheets retain text and reference labels; deleted source text can no longer be viewed as evidence. To remove the entire library, clear the extension's profile storage or uninstall it. Export first if you need the materials later. There is no cloud sync or archive import in this version.

## Optional Qwen cloud processing

Qwen generation is an explicit action. It sends selected source text, course/material title, activity label and page/section/timestamp references directly to the configured official Alibaba Model Studio endpoint using your API account. Local diagrams, browser cookies, Canvas login credentials and Panopto signed URLs are not included in Qwen requests. Responses are saved locally as knowledge points and sheets.

The Qwen key is entered in AI settings and stored only in `chrome.storage.session`, available to trusted extension pages. It is cleared when the browser session ends, the extension is reloaded, or you disconnect. Only the nonsecret model ID and base URL persist in `chrome.storage.local`. There is no key in the repository, ZIP, IndexedDB or course export. The key is sent to your configured Alibaba endpoint in the Authorization header.

Alibaba processes the submitted text according to your Model Studio account, region and applicable service terms. API requests may incur charges. Match your key to its region/workspace and model. Successful chunk responses are cached locally so an identical run can reuse them; requests that did not complete may be sent again when you retry.

Qwen host access is optional and requested for the exact endpoint origin when you save a connection. Only official supported Alibaba endpoints are accepted. Disconnect removes the key; Chrome can separately revoke the granted host permission. No material is sent merely by opening the panel, importing a file or using source-extract mode.

## Permissions

- NUS Canvas host access: visible context, explicit content capture and read-only module discovery.
- Panopto host access: player controls, recording context and existing authorized download flow.
- Storage: session context/key, nonsecret settings and durable local materials.
- Side panel: study workspace entry point.
- Downloads: save Panopto media through Chrome.
- Optional Alibaba host access: user-triggered Qwen requests.

The extension does not request general browsing history, a Canvas API token, microphone access or access to arbitrary websites.
