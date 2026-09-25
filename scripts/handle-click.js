function getCookie(name) {
  const prefix = name + "=";
  for (const raw of document.cookie.split(";")) {
    const cookie = raw.trim();
    if (cookie.startsWith(prefix)) return cookie.substring(prefix.length);
  }
  return null;
}

function extensionDownload(url, fileName, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const requestId = `psd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Extension download request timed out."));
    }, timeoutMs);
    function onMessage(event) {
      const msg = event.data;
      if (event.source !== window || msg?.source !== "PANOPTO_STUDY_EXTENSION" || msg?.requestId !== requestId) return;
      clearTimeout(timer); window.removeEventListener("message", onMessage);
      if (!msg.response?.ok) reject(new Error(msg.response?.error || "Download failed."));
      else resolve(msg.response);
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "PANOPTO_STUDY_PAGE", requestId, url, fileName }, "*");
  });
}

async function getVideoMetadata() {
  const queryParams = new URLSearchParams(window.location.search);
  const deliveryId = queryParams.get("id")
    ?? window.Panopto?.viewer?.data?.playlist?.initialDeliveryId
    ?? window.Panopto?.Embed?.instance?.deliveryId;
  if (!deliveryId) throw new Error("Unable to identify this Panopto recording.");

  const params = new URLSearchParams();
  params.append("deliveryId", deliveryId);
  params.append("isLiveNotes", "false"); params.append("refreshAuthCookie", "true");
  params.append("isActiveBroadcast", "false"); params.append("isEditing", "false");
  params.append("isKollectiveAgentInstalled", "false");
  params.append("isEmbed", window.location.pathname.toLowerCase().includes("embed.aspx") ? "true" : "false");
  params.append("responseType", "json");

  const headers = { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" };
  const csrfToken = getCookie("csrfToken"); if (csrfToken) headers["X-Csrf-Token"] = csrfToken;
  const appRoot = window.PanoptoApiClient?.getAppRootUrl?.() || "/Panopto";
  const endpoint = appRoot.replace(/\/$/, "") + "/Pages/Viewer/DeliveryInfo.aspx";
  const request = { body: params, credentials: "include", headers, method: "POST" };
  const response = window.PanoptoApiClient?.doFetch
    ? await window.PanoptoApiClient.doFetch(endpoint, request)
    : await fetch(endpoint, request);
  if (!response.ok) throw new Error(`Panopto returned HTTP ${response.status}.`);
  const body = await response.json();
  if (body?.ErrorCode) throw new Error(`Panopto returned error ${body.ErrorCode}.`);

  const delivery = body?.Delivery || {};
  const stream = delivery.Streams?.[0] || null;
  const podcast = delivery.PodcastStreams?.find?.(x => x?.StreamUrl || x?.StreamHttpUrl)
    || delivery.PodcastStreams?.[0] || null;
  let url = podcast?.StreamUrl || podcast?.StreamHttpUrl || null;
  if (!url) {
    const possible = stream?.StreamHttpUrl || stream?.StreamUrl || null;
    if (possible && /\.mp4(?:[?#]|$)/i.test(possible)) url = possible;
  }
  let fileName = podcast?.Name || stream?.Name || delivery.SessionName || "panopto_recording.mp4";
  if (/\.[^/.]+$/.test(fileName)) fileName = fileName.replace(/\.[^/.]+$/, ".mp4"); else fileName += ".mp4";
  if (!url) throw new Error("This recording does not expose a direct downloadable MP4. This public build does not send signed recording URLs to third-party conversion services.");
  return { url, fileName };
}

async function panoptoStudyDownload() {
  const container = document.getElementById("downloaderContainer");
  const text = document.getElementById("downloaderPopupText");
  if (!container || !text) return alert("ZweeNotes — Canvas Panopto Downloader is still initializing.");
  container.style.display = "flex"; text.textContent = "Preparing download...";
  try {
    const metadata = await getVideoMetadata();
    text.textContent = "Starting download...";
    await extensionDownload(metadata.url, metadata.fileName);
  } catch (error) {
    console.error("ZweeNotes — Canvas Panopto Downloader:", error);
    alert(`ZweeNotes — Canvas Panopto Downloader: ${error?.message || error}`);
  } finally { container.style.display = "none"; }
}
window.panoptoStudyDownload = panoptoStudyDownload;
