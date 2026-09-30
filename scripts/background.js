function safeFilename(name) {
  const cleaned = String(name || "video_download.mp4")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/[\u0000-\u001f]/g, "")
    .trim();
  return cleaned || "video_download.mp4";
}

function isCanvasSender(sender) {
  try {
    const url = new URL(sender.url);
    return url.origin === "https://canvas.nus.edu.sg" && /^\/courses\/\d+/.test(url.pathname);
  } catch {
    return false;
  }
}

function isPanoptoSender(sender) {
  try {
    const url = new URL(sender.url);
    return url.protocol === "https:" && (url.hostname === "panopto.com" || url.hostname.endsWith(".panopto.com") || url.hostname === "panopto.eu" || url.hostname.endsWith(".panopto.eu"));
  } catch {
    return false;
  }
}

function cleanText(value, limit = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function cleanPathUrl(value, allowedOrigin) {
  try {
    const url = new URL(value);
    if (url.origin !== allowedOrigin) return "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

function storageKey(kind, tabId) {
  return `${kind}:${tabId}`;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.session.remove([
    storageKey("canvas-context", tabId),
    storageKey("recording-context", tabId)
  ]).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !Number.isInteger(tab.openerTabId) || !isPanoptoSender({ url: tab.url })) return;
  const targetKey=storageKey('canvas-context',tabId), openerKey=storageKey('canvas-context',tab.openerTabId);
  chrome.storage.session.get([targetKey,openerKey]).then(values => {
    if (!values[targetKey] && values[openerKey]) return chrome.storage.session.set({[targetKey]:values[openerKey]}).then(()=>chrome.runtime.sendMessage({type:'STUDY_CONTEXT_UPDATED',tabId}).catch(()=>{}));
  }).catch(()=>{});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PANOPTO_STUDY_DOWNLOAD") {
    if (!isPanoptoSender(sender) && !sender.url?.startsWith(chrome.runtime.getURL('scripts/popup.html'))) {
      sendResponse({ ok: false, error: "Download from the Panopto player." }); return false;
    }
    const url = message.url;
    if (!url || !/^https:\/\//i.test(url)) {
      sendResponse({ ok: false, error: "No valid HTTPS download URL was supplied." });
      return false;
    }
    chrome.downloads.download({ url, filename: safeFilename(message.fileName), saveAs: false })
      .then(downloadId => sendResponse({ ok: true, downloadId }))
      .catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  if (message?.type === "CANVAS_CONTEXT_UPDATE") {
    if (!isCanvasSender(sender) || !Number.isInteger(sender.tab?.id)) {
      sendResponse({ ok: false, error: "Canvas context can only be read from an NUS Canvas course tab." });
      return false;
    }
    const courseId = cleanText(message.context?.courseId, 30);
    if (!/^\d+$/.test(courseId)) {
      sendResponse({ ok: false, error: "Invalid Canvas course identifier." });
      return false;
    }
    const context = {
      courseId,
      courseName: cleanText(message.context?.courseName),
      moduleName: cleanText(message.context?.moduleName),
      itemTitle: cleanText(message.context?.itemTitle),
      itemType: cleanText(message.context?.itemType, 40),
      pageUrl: cleanPathUrl(message.context?.pageUrl, "https://canvas.nus.edu.sg"),
      updatedAt: Date.now()
    };
    chrome.storage.session.set({ [storageKey("canvas-context", sender.tab.id)]: context })
      .then(() => {
        chrome.runtime.sendMessage({ type: "STUDY_CONTEXT_UPDATED", tabId: sender.tab.id }).catch(() => {});
        sendResponse({ ok: true });
      })
      .catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  if (message?.type === "OPEN_STUDY_PANEL") {
    const tabId = sender.tab?.id;
    if (!isPanoptoSender(sender) || !Number.isInteger(tabId)) {
      sendResponse({ ok: false, error: "Open the study panel from a Panopto recording." });
      return false;
    }

    // Start the panel open while this message is still in the click's call chain.
    const panelPromise = chrome.sidePanel.open({ tabId });
    const pageUrl = cleanPathUrl(sender.url, new URL(sender.url).origin);
    const recording = {
      recordingId: cleanText(message.recordingId, 100),
      title: cleanText(message.title),
      pageUrl,
      updatedAt: Date.now()
    };
    chrome.storage.session.set({ [storageKey("recording-context", tabId)]: recording })
      .then(() => panelPromise)
      .then(() => {
        chrome.runtime.sendMessage({ type: "STUDY_CONTEXT_UPDATED", tabId }).catch(() => {});
        sendResponse({ ok: true });
      })
      .catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  if (message?.type === "GET_STUDY_CONTEXT") {
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')) || !Number.isInteger(message.tabId)) {
      sendResponse({ ok: false, error: "Invalid study context request." });
      return false;
    }
    const tabId = message.tabId;
    chrome.storage.session.get([
      storageKey("canvas-context", tabId),
      storageKey("recording-context", tabId)
    ]).then(values => sendResponse({
      ok: true,
      canvas: values[storageKey("canvas-context", tabId)] || null,
      recording: values[storageKey("recording-context", tabId)] || null
    })).catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  return false;
});
