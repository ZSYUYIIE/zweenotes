// Explicit private trial: production importers, generation pipeline and renderer in isolated Chrome.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ZWEE_PLAYWRIGHT_PATH || 'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const inputPath=path.resolve(process.argv[2]||'trial/cs3263/input.json');
const renderOnly=process.argv.includes('--render-only');
const output=path.dirname(inputPath), key=process.env.NVIDIA_API_KEY || process.env.ZWEE_LIVE_KEY;
if(!key && !renderOnly)throw Error('Supply NVIDIA_API_KEY only through this process environment.');
const input=JSON.parse(await readFile(inputPath,'utf8')), requests=[];
await mkdir(output,{recursive:true});
let archive;try{archive=JSON.parse(await readFile(path.join(output,'course.json'),'utf8'));}catch{}
let reviewed;try{reviewed=JSON.parse(await readFile(path.join(output,'reviewed-blocks.json'),'utf8'));}catch{}
if(renderOnly && !archive?.sheets?.length)throw Error('Generate and save a sheet before rendering without AI.');
const browser=await chromium.launch({executablePath:process.env.ZWEE_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const context=await browser.newContext({viewport:{width:1700,height:1100}});
  await context.addInitScript(({key})=>{
    const session={ai_credentials:{nemotron:{provider:'nemotron',key,baseUrl:'https://integrate.api.nvidia.com/v1',model:'nvidia/nemotron-3.5-lightning-30b-a3b'}}};
    const local={ai_preferences:{activeProvider:'nemotron'}};
    const store=data=>({get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,data[k]])),set:async changes=>Object.assign(data,changes)});
    window.chrome={runtime:{id:'trial',getURL:p=>'https://zweenotes.test/'+p},storage:{session:store(session),local:store(local),onChanged:{addListener(){}}},permissions:{contains:async()=>true}};
  },{key});
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin==='https://integrate.api.nvidia.com'){
      const started=Date.now();
      try {
        const response=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:req.postData(),signal:AbortSignal.timeout(90000),redirect:'error'});
        const body=await response.text();let usage={};try{usage=JSON.parse(body).usage||{};}catch{}
        requests.push({status:response.status,elapsedMs:Date.now()-started,usage});
        await route.fulfill({status:response.status,body,contentType:'application/json'});
      }catch{await route.abort();}
      return;
    }
    if(url.origin!=='https://zweenotes.test')return route.abort();
    const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!filename.startsWith(root))return route.abort();
    const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.png':'image/png'};
    try{await route.fulfill({body:await readFile(filename),contentType:mime[path.extname(filename)]||'application/octet-stream'});}catch{await route.fulfill({status:404,body:'Missing asset'});}
  });
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('trialProgress',msg=>console.log(msg));
  await page.exposeFunction('saveTrialArchive',async value=>writeFile(path.join(output,'course.json'),JSON.stringify(value,null,2)+'\n'));
  await page.goto('https://zweenotes.test/studio.html');
  const materials=archive?.sources?.length ? [] : await Promise.all(input.materials.map(async m=>m.segments?m:{...m,base64:(await readFile(m.path)).toString('base64')}));
  const result=await page.evaluate(async({input,materials,archive,reviewed,renderOnly})=>{
    const storage=await import('/scripts/storage.js'),{importFile}=await import('/scripts/importers.js'),{makeSource}=await import('/scripts/core.js'),{generateSheet}=await import('/scripts/pipeline.js'),{assessmentScope}=await import('/scripts/assessment.js');
    await storage.put('courses',input.course);
    if(archive){for(const s of archive.sources||[]){if(/\bTutorial\s+\d+\b/i.test(s.segments[0]?.text||'') && s.activity==='lecture'){s.activity='tutorial';s.classificationNote='Corrected from the source title page after extraction; existing summaries remain flagged for review.';}await storage.put('sources',s);}for(const c of archive.knowledge||[])await storage.put('chunks',c);}
    else for(const m of materials){
      let source;
      if(m.segments)source=makeSource({courseId:input.course.id,title:m.title,format:m.format,activity:m.activity,week:m.week,segments:m.segments});
      else{const bytes=Uint8Array.from(atob(m.base64),c=>c.charCodeAt(0));source=await importFile(new File([bytes],m.title),{courseId:input.course.id,activity:m.activity,week:m.week},()=>{});}
      await storage.put('sources',source);await window.trialProgress('Imported '+source.title+' · '+source.segments.length+' pages/slides');
    }
    const sources=await storage.list('sources',input.course.id);
    const save=async()=>window.saveTrialArchive({format:'zweenotes-course',version:1,course:input.course,sources,knowledge:await storage.list('chunks',input.course.id),sheets:await storage.list('sheets',input.course.id)});
    let saveQueue=Promise.resolve();
    let sheet;
    if(renderOnly){sheet=archive.sheets[0];if(reviewed)sheet.blocks=reviewed;sheet.layout.fontSize=7.5;sheet.omittedCount=Math.max(0,(archive.knowledge||[]).flatMap(c=>c.atoms).length-sheet.blocks.length);sheet.updatedAt=Date.now();await storage.put('sheets',sheet);await save();return {sources:sources.length,pages:sources.reduce((n,s)=>n+s.segments.length,0),sheetId:sheet.id,points:sheet.blocks.length,omitted:sheet.omittedCount};}
    try{
      sheet=await generateSheet(input.course,sources,{engine:'nemotron',blockLimit:44,emphasis:'methods'},msg=>{window.trialProgress(msg);saveQueue=saveQueue.then(save);});
    }catch(e){await saveQueue;await save();throw e;}
    await saveQueue;
    sheet.title=input.course.name+' · Midterm revision trial';
    sheet.assessment={...assessmentScope(input.course,'midterm'),reviewedAt:Date.now(),selectedSourceIds:sources.map(s=>s.id),note:'Trial selection reviewed against Canvas: CSP, propositional logic, FOL and planning. Not a claim that these local files cover every examinable topic.'};
    await storage.put('sheets',sheet);await save();
    return {sources:sources.length,pages:sources.reduce((n,s)=>n+s.segments.length,0),sheetId:sheet.id,points:sheet.blocks.length,omitted:sheet.omittedCount};
  },{input,materials,archive,reviewed,renderOnly});
  console.log(JSON.stringify({generated:result}));
  await page.reload();await page.waitForFunction(()=>document.querySelector('#history').value);
  await page.locator('#fit').click();await page.waitForTimeout(300);
  // Reduce the displayed selection if the fixed A4 page still cannot fit. Knowledge remains in the archive.
  let reductions=0;
  while(!await page.locator('#print').isEnabled()){
    const included=await page.locator('#blocks input[type=checkbox]').count();
    if(included-reductions<=12)throw Error('Content cannot fit legibly on one A4 page.');
    const checks=await page.locator('#blocks input[type=checkbox]').all();
    const check=checks[checks.length-1-reductions];await check.uncheck();reductions++;
    await page.waitForTimeout(200);await page.locator('#fit').click();await page.waitForTimeout(200);
  }
  await page.waitForTimeout(700);
  await page.evaluate(async()=>{const {list}=await import('/scripts/storage.js');const course=(await list('courses'))[0];await window.saveTrialArchive({format:'zweenotes-course',version:1,course,sources:await list('sources',course.id),knowledge:await list('chunks',course.id),sheets:await list('sheets',course.id)});});
  await page.emulateMedia({media:'print'});
  await page.evaluate(()=>document.querySelector('#paper').style.zoom=1);
  await page.pdf({path:path.join(output,'CS3263-midterm-zweenotes-trial.pdf'),preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
  await page.locator('#paper').screenshot({path:path.join(output,'CS3263-midterm-zweenotes-trial.png')});
  const paper=await page.locator('#paper').evaluate(el=>el.outerHTML);
  const html='<!doctype html><html><head><meta charset="utf-8"><title>CS3263 ZweeNotes trial</title><base href="../../"><link rel="stylesheet" href="studio.css"><link rel="stylesheet" href="vendor/katex/katex.min.css"><style>@page{size:A4 landscape;margin:0}body{margin:0;background:white}.paper{box-shadow:none}</style></head><body>'+paper+'</body></html>';
  await writeFile(path.join(output,'CS3263-midterm-zweenotes-trial.html'),html);
  const report={...result,requests,excludedFromPaper:reductions,fit:await page.locator('#fit-status').textContent(),pageErrors:errors,mathWarnings:await page.locator('#paper .math-error').count(),limitations:['MP4 speech was not transcribed; no VTT/SRT found.','The local FOL PPTX is a tutorial, not the main lecture; its activity label was corrected after extraction.','FOL supplementary slides are AY25/26; the current main FOL lecture is missing locally and Chrome blocked its Canvas download.','PPTX text was extracted by slide; images and visual equations were not interpreted.','Canvas final coverage is unknown.','Week-one materials and post-midterm topics are absent from this local trial.','AI facts require human review.']};
  await writeFile(path.join(output,'run-report.json'),JSON.stringify(report,null,2)+'\n');
  if(errors.length)throw Error('Browser errors recorded; inspect run-report.json.');
  console.log(JSON.stringify({result:'PASS',fit:report.fit,requests:requests.length,pdf:path.join(output,'CS3263-midterm-zweenotes-trial.pdf')}));
}finally{await browser.close();}
