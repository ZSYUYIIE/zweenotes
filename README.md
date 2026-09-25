# ZweeNotes — NUS Canvas Companion

A standalone prototype that keeps visible NUS Canvas course context beside Panopto recordings. It is a new development project, separate from the submitted Chrome Web Store listing for the Panopto downloader.

## What this prototype does

- Reads the current course ID, visible course name, current item title, item type, and page path from `canvas.nus.edu.sg` course pages.
- Keeps that context per browser tab in `chrome.storage.session`.
- Adds a ZweeNotes control beside the existing Panopto download control. The control opens Chrome’s side panel and records the current Panopto recording ID and title for that tab.
- Continues to support the existing authorized Panopto download flow.
- Treats modules, assignments, files, pages, discussions, quizzes, and external tools as Canvas items; it does not assume labs or tutorials have recordings.

The side panel is a context prototype. It does not summarize content, read assignment bodies or files, call an AI model, or upload course content.

## Load locally

1. Open `chrome://extensions` in Chrome 116 or newer.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this project folder.
4. Open an NUS Canvas course page, then open a Panopto recording launched from that course. The side panel can be opened from the extension toolbar icon or the new Panopto control.

## Source and privacy

Canvas is the course-structure source for this NUS-first prototype. Panopto supplies recording context and the existing download feature. Context is stored locally for the browser session and removed when its tab closes. See [PRIVACY.md](PRIVACY.md) for details.

This is an early prototype and has not been prepared for Chrome Web Store submission.

## License

This project is distributed under GPL-3.0. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md) for upstream attribution.
