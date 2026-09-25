# Privacy notes

This development prototype reads only the current NUS Canvas course page URL and visible page labels needed to show course context. It stores the following in Chrome session storage, associated with the current tab:

- Canvas course ID and visible course name
- Visible current item title and a coarse item type (such as page, file, assignment, or module item)
- A Canvas page URL with query parameters and fragments removed
- When opened from Panopto, the recording ID, document title, and Panopto page path, with query parameters and fragments removed

The data stays in the browser and is cleared when the tab closes or the browser session ends. This prototype has no server, analytics, AI processing, transcript access, or content upload. The existing downloader uses the logged-in Panopto page to obtain a media URL and asks Chrome Downloads to save it; that URL is not sent to a ZweeNotes service.

The extension requires access to `canvas.nus.edu.sg` for course context and Panopto domains for the recording controls and downloader. It does not request access to other LMS sites or general browsing history.

This file describes the prototype and is not the privacy policy linked from the existing Chrome Web Store listing.
