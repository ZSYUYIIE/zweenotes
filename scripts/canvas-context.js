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

  async function moduleOutline() {
    const courseId = courseIdFromPath();
    if (!courseId) throw new Error('Open a Canvas course first.');
    const prefix = `/api/v1/courses/${courseId}/modules`;
    let requests = 0;
    async function pages(path) {
      const results = [];
      let next = new URL(path, location.origin).href;
      while (next) {
        const url = new URL(next);
        if (url.origin !== location.origin || !(url.pathname === prefix || new RegExp(`^${prefix}/[0-9]+/items$`).test(url.pathname))) throw new Error('Canvas returned an unexpected pagination link.');
        if (++requests > 60) throw new Error('This course has too many module pages for one sync. Open individual items instead.');
        const response = await fetch(url.href, { credentials: 'same-origin', headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`Canvas module access failed (HTTP ${response.status}). Check your Canvas login and course access.`);
        let values;
        try { values = JSON.parse((await response.text()).replace(/^\s*while\(1\);\s*/, '')); }
        catch { throw new Error('Canvas returned an unreadable module list.'); }
        if (!Array.isArray(values)) throw new Error('Canvas did not return a module list.');
        results.push(...values);
        if (results.length > 3000) throw new Error('This course outline is too large. Open individual module items.');
        next = (response.headers.get('Link') || '').split(',').map(link => link.match(/<([^>]+)>;\s*rel="next"/)).find(Boolean)?.[1] || '';
      }
      return results;
    }
    const modules = await pages(prefix + '?include[]=items&per_page=100');
    const outline = [];
    for (const module of modules) {
      if (!/^\d+$/.test(String(module.id))) continue;
      const items = Array.isArray(module.items) && module.items.length === Number(module.items_count) ? module.items : await pages(prefix + `/${module.id}/items?per_page=100`);
      outline.push({ id: String(module.id), title: String(module.name || 'Module').slice(0,200), items: items.map(item => {
        let url = '';
        try { const parsed = new URL(item.html_url); if (parsed.origin === location.origin && parsed.pathname.startsWith(`/courses/${courseId}/`)) { parsed.search = ''; parsed.hash = ''; url = parsed.href; } } catch {}
        return { id: String(item.id), title: String(item.title || 'Untitled item').slice(0,200), type: String(item.type || 'Item').slice(0,40), url };
      }) });
    }
    return { context: currentContext(), modules: outline };
  }

  async function assessmentEvidence() {
    const courseId=courseIdFromPath();
    if (!courseId) throw new Error('Open a Canvas course first.');
    const text=html=>{const doc=new DOMParser().parseFromString(String(html||''),'text/html');doc.querySelectorAll('script,style,iframe').forEach(el=>el.remove());doc.querySelectorAll('p,li,br,h1,h2,h3').forEach(el=>el.append(doc.createTextNode('\n')));return (doc.body.textContent||'').trim().slice(0,100000);};
    const read=async path=>{const response=await fetch(new URL(path,location.origin),{credentials:'same-origin',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Canvas assessment access failed (HTTP '+response.status+').');return {data:JSON.parse((await response.text()).replace(/^\s*while\(1\);\s*/,'')),link:response.headers.get('Link')||''};};
    const course=await read('/api/v1/courses/'+courseId+'?include[]=syllabus_body');
    const documents=[{title:'Course syllabus',text:text(course.data.syllabus_body),url:location.origin+'/courses/'+courseId+'/assignments/syllabus'}];
    // Use the course's announcement list, with pagination; no grades, replies or submissions.
    let next='/api/v1/courses/'+courseId+'/discussion_topics?only_announcements=true&per_page=100';
    for(let page=0;next && page<10;page++) {
      const url=new URL(next,location.origin);
      if(url.origin!==location.origin || url.pathname!=='/api/v1/courses/'+courseId+'/discussion_topics' || url.searchParams.get('only_announcements')!=='true')throw new Error('Unexpected Canvas assessment pagination.');
      const result=await read(url.href);if(!Array.isArray(result.data))throw new Error('Unreadable Canvas announcements.');
      for(const item of result.data) {
        const body=text(item.message), title=String(item.title||'');
        if(!/mid[\s-]?term|final(?:\s+exam|\s+assessment|\s+test)|exam\s+scope|assessment\s+coverage/i.test(title+' '+body))continue;
        if(!/^\d+$/.test(String(item.id)))continue;
        documents.push({title:title.slice(0,200),text:body,postedAt:item.posted_at||'',url:location.origin+'/courses/'+courseId+'/discussion_topics/'+item.id});
      }
      next=result.link.split(',').map(l=>l.match(/<([^>]+)>;\s*rel="next"/)).find(Boolean)?.[1]||'';
      if(page===9 && next)throw new Error('Too many announcements; capture the assessment guidance manually.');
    }
    documents.sort((a,b)=>(b.postedAt||'').localeCompare(a.postedAt||''));
    return {context:currentContext(),documents,syncedAt:Date.now()};
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return false;
    if (message?.type === 'SYNC_CANVAS_ASSESSMENTS') {
      assessmentEvidence().then(sendResponse).catch(error=>sendResponse({error:error.message||'Assessment sync failed.'}));return true;
    }
    if (message?.type === 'SYNC_CANVAS_MODULES') {
      moduleOutline().then(sendResponse).catch(error => sendResponse({ error: error.message || 'Canvas sync failed.' }));
      return true;
    }
    if (message?.type === "GET_NUS_CANVAS_CONTEXT") {
      sendResponse(currentContext());
    }
    if (message?.type === 'CAPTURE_CANVAS_SOURCE') {
      const selected = getSelection()?.toString().trim();
      const root = document.querySelector('.wiki_page .user_content, .description.user_content, #assignment_show .user_content, #course_home_content .user_content, main .user_content, #content .user_content');
      const text = selected || root?.innerText?.trim();
      if (!text) return sendResponse({ error: 'Select study text on this page, or import the course file in the panel.' });
      if (text.length > 350000) return sendResponse({ error: 'This page is too long. Select a smaller section.' });
      sendResponse({ context: currentContext(), text, selection: Boolean(selected) });
    }
  });

  publishIfChanged();
  addEventListener("popstate", schedulePublish);
  addEventListener("hashchange", schedulePublish);
  const observer = new MutationObserver(schedulePublish);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
