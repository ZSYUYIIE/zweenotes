(() => {
  const BUTTON_ID = "panoptoStudyDownloaderButton";
  const STUDY_BUTTON_ID = "zweeNotesStudyPanelButton";
  let pageBridgeInstalled = false;
  let downloaderScriptInstalled = false;

  function installBridge() {
    if (pageBridgeInstalled || window.__panoptoStudyDownloaderBridgeInstalled) return;
    pageBridgeInstalled = true;
    window.__panoptoStudyDownloaderBridgeInstalled = true;
    window.addEventListener("message", async event => {
      const msg = event.data;
      if (event.source !== window || msg?.source !== "PANOPTO_STUDY_PAGE" || !msg?.requestId) return;
      try {
        const response = await chrome.runtime.sendMessage({
          type: "PANOPTO_STUDY_DOWNLOAD", url: msg.url, fileName: msg.fileName
        });
        window.postMessage({ source: "PANOPTO_STUDY_EXTENSION", requestId: msg.requestId, response }, "*");
      } catch (error) {
        window.postMessage({ source: "PANOPTO_STUDY_EXTENSION", requestId: msg.requestId,
          response: { ok: false, error: error?.message || String(error) } }, "*");
      }
    });
  }

  async function ensurePopup() {
    if (document.getElementById("downloaderContainer")) return;
    const response = await fetch(chrome.runtime.getURL("scripts/popup.html"));
    const container = document.createElement("div");
    container.id = "downloaderContainer";
    container.style.display = "none";
    container.innerHTML = await response.text();
    document.body.appendChild(container);
  }

  function appendIcon(button, pathData) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    for (const data of pathData) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", data);
      svg.appendChild(path);
    }
    button.appendChild(svg);
  }

  function makeDownloadButton() {
    const button = document.createElement("div");
    button.id = BUTTON_ID;
    button.classList.add("button-control", "transport-button");
    button.title = "Download recording for offline study";
    button.setAttribute("role", "button");
    button.setAttribute("aria-label", "Download recording");
    button.setAttribute("tabindex", "0");
    button.setAttribute("onclick", "window.panoptoStudyDownload()");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 512 512");
    svg.setAttribute("fill", "none");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", "M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32v242.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64h384c35.3 0 64-28.7 64-64v-32c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64z");
    svg.appendChild(path);
    button.appendChild(svg);
    return button;
  }

  function getRecordingId() {
    const url = new URL(location.href);
    return url.searchParams.get("id") || url.searchParams.get("sessionID") || "";
  }

  function makeStudyButton() {
    const button = document.createElement("div");
    button.id = STUDY_BUTTON_ID;
    button.classList.add("button-control", "transport-button");
    button.title = "Open ZweeNotes study panel";
    button.setAttribute("role", "button");
    button.setAttribute("aria-label", "Open ZweeNotes study panel");
    button.setAttribute("tabindex", "0");
    appendIcon(button, ["M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z", "M4 5.5v16", "M8 7h8", "M8 10h8"]);

    const openPanel = async () => {
      button.title = "Opening ZweeNotes study panel…";
      try {
        const response = await chrome.runtime.sendMessage({
          type: "OPEN_STUDY_PANEL",
          recordingId: getRecordingId(),
          title: document.title
        });
        if (!response?.ok) throw new Error(response?.error || "Could not open the study panel.");
        button.title = "ZweeNotes study panel opened";
      } catch (error) {
        button.title = error?.message || "Could not open the study panel.";
      }
    };
    button.addEventListener("click", openPanel);
    button.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPanel();
      }
    });
    return button;
  }

  function injectDownloaderPageScript() {
    if (downloaderScriptInstalled) return;
    downloaderScriptInstalled = true;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("scripts/handle-click.js");
    script.onload = function () { this.remove(); };
    (document.head || document.documentElement).appendChild(script);
  }

  async function install() {
    installBridge();
    const captions = document.getElementById("captionsButton");
    const nav = document.getElementById("navigationControls");
    if (!captions && !nav) return false;

    let downloaderButton = document.getElementById(BUTTON_ID);
    if (!downloaderButton) {
      injectDownloaderPageScript();
      downloaderButton = makeDownloadButton();
      if (captions) captions.insertAdjacentElement("afterend", downloaderButton);
      else if (nav?.lastElementChild) nav.insertBefore(downloaderButton, nav.lastElementChild);
      else nav?.appendChild(downloaderButton);
      await ensurePopup();
    }

    if (!document.getElementById(STUDY_BUTTON_ID)) {
      const studyButton = makeStudyButton();
      const anchor = document.getElementById(BUTTON_ID) || captions || nav?.lastElementChild;
      anchor?.insertAdjacentElement("afterend", studyButton);
    }
    return Boolean(document.getElementById(BUTTON_ID) && document.getElementById(STUDY_BUTTON_ID));
  }

  install().catch(console.error);
  const observer = new MutationObserver(() => {
    install().then(done => { if (done) observer.disconnect(); }).catch(console.error);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
