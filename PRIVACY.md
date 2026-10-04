# Privacy notes — ZweeNotes 0.2.1

Updated 2026-10-05. These notes describe the development Cheatsheet Studio project, not the previously submitted downloader-only Chrome Web Store package.

## Canvas and Panopto context

On NUS Canvas course pages, the extension reads the current course ID, visible name, item title/type and page path. Per-tab context is kept in Chrome session storage. Opening the panel from Panopto also records the recording ID, title and page path. Query parameters/fragments are removed from stored context URLs.

Clicking **Capture Canvas text** reads your selection or the current page's study-content container. Clicking **Sync this course's modules** performs read-only requests to that course's Canvas module API using the existing first-party Canvas login; it stores module titles, item titles/types and same-course navigation links locally. It does not automatically collect grades, submissions, student replies or assessment attempts. Capture selections are user-controlled: check what you have selected.

The existing downloader obtains a direct media URL from the logged-in Panopto player and asks Chrome Downloads to save it. ZweeNotes has no conversion server; signed media URLs are not sent to an AI service. Recording transcripts must currently be supplied as local VTT/SRT files.

## Local course library

Imported text/PDF/subtitle contents, source locators, course labels, knowledge points, personal trouble topics, sheet edits and user-added diagrams persist in IndexedDB in this Chrome profile. PDF text extraction and formula rendering run locally with packaged libraries. No ZweeNotes account, hosted database, analytics or tracking endpoint is present.

Local course data is not encrypted by the extension. People or software with access to this browser profile may be able to read it. Use separate Chrome profiles for different people. Export Project downloads a JSON file containing the current course's source text, knowledge and sheets, never API credentials. The export may contain private course material.

Deleting a source removes that material and its cached knowledge chunks. Existing sheets retain text and reference labels; deleted source text can no longer be viewed as evidence. To remove the entire library, clear the extension's profile storage or uninstall it. Export first if you need the materials later. There is no cloud sync or archive import in this version.

## Optional cloud AI processing

Generation is an explicit action. It sends selected source text, course/material title, activity label and page/section/timestamp references directly to your chosen NVIDIA or Alibaba Model Studio endpoint using your API account. Local diagrams, browser cookies, Canvas login credentials and Panopto signed URLs are not included in requests. Responses are saved locally as knowledge points and sheets.

Keys are entered in AI settings and stored separately per provider in `chrome.storage.session`, available to trusted extension pages. They are cleared when the browser session ends, the extension is reloaded, or you disconnect that provider. Only nonsecret provider/model/endpoint preferences persist in `chrome.storage.local`. Developer credentials are not embedded in the repository or ZIP; user keys are not saved in IndexedDB, course exports or screenshots. Authorization headers send your key only to the selected allowlisted endpoint.

NVIDIA uses the fixed `https://integrate.api.nvidia.com/v1` endpoint. Qwen uses supported official Alibaba regional/workspace endpoints; match the key to its region and model. Your provider processes submitted text according to its account and service terms. Provider usage limits and billing terms apply.

Saving settings sends no inference. Clicking **Test connection** submits a small original definition, without course materials. Successful chunks are cached locally with separate provider/model/endpoint/prompt-version identities. Identical runs can reuse them; switching providers or retrying incomplete work can create additional requests. There are no automatic paid retries.

Provider host access is optional and requested for the exact endpoint origin when you save a connection. Disconnect removes that provider's key; Chrome can separately revoke host permission. No material is sent merely by opening the panel, importing a file or using source-extract mode.

## Permissions

- NUS Canvas host access: visible context, explicit content capture and read-only module discovery.
- Panopto host access: player controls, recording context and existing authorized download flow.
- Storage: session context/key, nonsecret settings and durable local materials.
- Side panel: study workspace entry point.
- Downloads: save Panopto media through Chrome.
- Optional NVIDIA and Alibaba host access: user-triggered requests to the chosen AI provider.

The extension does not request general browsing history, a Canvas API token, microphone access or access to arbitrary websites.
