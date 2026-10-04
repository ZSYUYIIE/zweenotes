import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.ZWEE_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({executablePath:process.env.ZWEE_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const context=await browser.newContext(),calls=[];let badPagination=false;
  await context.addInitScript(()=>{
    let handler;
    window.chrome={runtime:{id:'fixture',getURL:p=>'chrome-extension://fixture/'+p,sendMessage:async()=>{},onMessage:{addListener:fn=>handler=fn}}};
    window.requestAssessment=()=>new Promise(resolve=>handler({type:'SYNC_CANVAS_ASSESSMENTS'},{id:'fixture',url:'chrome-extension://fixture/sidepanel.html'},resolve));
  });
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());calls.push(url.href);
    if(url.origin!=='https://canvas.nus.edu.sg')throw Error('Unexpected network destination.');
    if(url.pathname==='/courses/123')return route.fulfill({contentType:'text/html',body:'<title>Fixture course</title><nav id="breadcrumbs"><a href="/courses/123">Course ABC</a></nav><main><h1>Course ABC</h1></main>'});
    if(url.pathname==='/api/v1/courses/123')return route.fulfill({contentType:'application/json',body:JSON.stringify({syllabus_body:'<p>Final exam covers weeks 1-12.</p><script>malicious()</script>'})});
    if(url.pathname==='/api/v1/courses/123/discussion_topics'){
      assert.equal(url.searchParams.get('only_announcements'),'true');
      return route.fulfill({contentType:'application/json',headers:badPagination?{Link:'<https://canvas.nus.edu.sg/api/v1/courses/999/discussion_topics?only_announcements=true>; rel="next"'}:{},body:JSON.stringify([{id:7,title:'Midterm',message:'<p>Include planning.</p><p>Exclude probabilistic reasoning.</p>',posted_at:'2026-09-23'},{id:8,title:'Office hours',message:'Unrelated announcement; do not retain.'}])});
    }
    return route.fulfill({status:404,body:'No fixture'});
  });
  const page=await context.newPage();await page.goto('https://canvas.nus.edu.sg/courses/123');
  await page.addScriptTag({content:await readFile(new URL('../scripts/canvas-context.js',import.meta.url),'utf8')});
  const result=await page.evaluate(()=>window.requestAssessment());
  assert.equal(result.context.courseId,'123');assert.equal(result.documents.length,2);
  assert.ok(result.documents.find(d=>d.title==='Midterm').text.includes('Exclude probabilistic'));
  assert.ok(!result.documents.find(d=>d.title==='Course syllabus').text.includes('malicious'));
  assert.equal(calls.filter(url=>url.includes('/api/v1/')).length,2);
  badPagination=true;const bad=await page.evaluate(()=>window.requestAssessment());assert.ok(bad.error.includes('Unexpected'));
  assert.ok(!calls.some(url=>url.includes('/courses/999/')));
  console.log('PASS: same-course syllabus/announcement collection, filtering, HTML sanitization and pagination isolation (mocked Canvas).');
}finally{await browser.close();}
