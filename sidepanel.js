const status = document.getElementById("status");
const courseCard = document.getElementById("course-card");
const recordingCard = document.getElementById("recording-card");
const emptyState = document.getElementById("empty-state");
let activeTabId = null;

function showText(id, value, fallback = "") {
  document.getElementById(id).textContent = value || fallback;
}

async function loadContext() {
  status.textContent = "Finding this tab’s study context…";
  courseCard.hidden = true;
  recordingCard.hidden = true;
  emptyState.hidden = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!Number.isInteger(tab?.id)) throw new Error("No active browser tab was found.");
    activeTabId = tab.id;
    const result = await chrome.runtime.sendMessage({ type: "GET_STUDY_CONTEXT", tabId: activeTabId });
    if (!result?.ok) throw new Error(result?.error || "Could not read this tab’s context.");

    const { canvas, recording } = result;
    if (canvas) {
      showText("course-name", canvas.courseName, "NUS Canvas course");
      showText("course-id", `Course ${canvas.courseId}`);
      showText("item-title", canvas.itemTitle, "Current Canvas item");
      showText("item-type", canvas.itemType, "course item");
      showText("module-name", canvas.moduleName ? `Module: ${canvas.moduleName}` : "");
      const link = document.getElementById("canvas-link");
      const url = new URL(canvas.pageUrl);
      if (url.origin === "https://canvas.nus.edu.sg") {
        link.href = url.href;
        link.hidden = false;
      } else {
        link.hidden = true;
      }
      courseCard.hidden = false;
    }
    if (recording) {
      showText("recording-title", recording.title, "Panopto recording");
      showText("recording-id", recording.recordingId ? `Recording ID ${recording.recordingId}` : "Recording details from the current tab");
      recordingCard.hidden = false;
    }
    status.textContent = canvas || recording ? "Context for the current tab" : "";
    emptyState.hidden = Boolean(canvas || recording);
  } catch (error) {
    status.textContent = error?.message || "Could not load study context.";
    emptyState.hidden = false;
  }
}

document.getElementById("refresh").addEventListener("click", loadContext);
chrome.runtime.onMessage.addListener(message => {
  if (message?.type === "STUDY_CONTEXT_UPDATED" && message.tabId === activeTabId) loadContext();
});

loadContext();
