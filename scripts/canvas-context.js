(() => {
  const COURSE_PATH = /^\/courses\/(\d+)(?:\/|$)/;
  let lastFingerprint = "";
  let updateTimer;

  function textOf(element) {
    return element?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function cleanPageUrl() {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    return url.href;
  }

  function itemTypeFor(pathname) {
    if (/\/modules(?:\/|$)/.test(pathname)) return "module item";
    if (/\/assignments(?:\/|$)/.test(pathname)) return "assignment";
    if (/\/files(?:\/|$)/.test(pathname)) return "file";
    if (/\/pages(?:\/|$)/.test(pathname)) return "page";
    if (/\/external_tools(?:\/|$)/.test(pathname)) return "external tool";
    if (/\/discussion_topics(?:\/|$)/.test(pathname)) return "discussion";
    if (/\/quizzes(?:\/|$)/.test(pathname)) return "quiz";
    if (pathname.replace(/\/$/, "") === `/courses/${courseIdFromPath()}`) return "course home";
    return "course item";
  }

  function courseIdFromPath() {
    return location.pathname.match(COURSE_PATH)?.[1] || "";
  }

  function breadcrumbLabels() {
    const root = document.querySelector("#breadcrumbs, nav[aria-label='Breadcrumb'], [aria-label='Breadcrumb']");
    return root ? Array.from(root.querySelectorAll("a, li, span"))
      .map(textOf)
      .filter((label, index, list) => label && list.indexOf(label) === index) : [];
  }

  function currentContext() {
    const match = location.pathname.match(COURSE_PATH);
    if (!match) return null;
    const courseId = match[1];
    const courseCrumb = Array.from(document.querySelectorAll("#breadcrumbs a, nav[aria-label='Breadcrumb'] a"))
      .find(anchor => {
        try { return new URL(anchor.href, location.href).pathname.replace(/\/$/, "") === `/courses/${courseId}`; }
        catch { return false; }
      });
    const courseName = textOf(courseCrumb)
      || textOf(document.querySelector("[data-course-name]"))
      || (location.pathname.replace(/\/$/, "") === `/courses/${courseId}` ? textOf(document.querySelector("h1")) : "")
      || `NUS Canvas course ${courseId}`;
    const itemTitle = textOf(document.querySelector("main h1, #content h1, h1")) || document.title || courseName;
    const crumbs = breadcrumbLabels();
    let moduleName = "";
    if (/\/modules(?:\/|$)/.test(location.pathname) && crumbs.length > 1) {
      moduleName = crumbs[crumbs.length - 2];
      if (moduleName === courseName || moduleName === itemTitle || /^(modules?|course modules?)$/i.test(moduleName)) moduleName = "";
    }
    return {
      courseId,
      courseName,
      moduleName,
      itemTitle,
      itemType: itemTypeFor(location.pathname),
      pageUrl: cleanPageUrl()
    };
  }

  function publishIfChanged() {
    const context = currentContext();
    if (!context) return;
    const fingerprint = JSON.stringify(context);
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;
    chrome.runtime.sendMessage({ type: "CANVAS_CONTEXT_UPDATE", context }).catch(() => {});
  }

  function schedulePublish() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(publishIfChanged, 250);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GET_NUS_CANVAS_CONTEXT") {
      sendResponse(currentContext());
    }
  });

  publishIfChanged();
  addEventListener("popstate", schedulePublish);
  addEventListener("hashchange", schedulePublish);
  const observer = new MutationObserver(schedulePublish);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
