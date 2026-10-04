// Isolated Chrome with fake credentials and routed API fixtures; never uses the user's browser profile.
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.ZWEE_PLAYWRIGHT_PATH || 'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const executablePath=process.env.ZWEE_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser=await chromium.launch({executablePath,headless:true});
try {
  const context=await browser.newContext({viewport:{width:1600,height:1100}});
  const errors=[], requests=[];
  await context.addInitScript(()=>{
    const listeners=[];
    const values=()=>JSON.parse(localStorage.getItem('mock-chrome-storage')||'{"local":{},"session":{},"permissions":[]}');
    const save=value=>localStorage.setItem('mock-chrome-storage',JSON.stringify(value));
    const store=area=>({
      get:async(keys)=>{const data=values()[area];return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,data[key]]));},
      set:async(changes)=>{const value=values();Object.assign(value[area],changes);save(value);listeners.forEach(fn=>fn(changes,area));},
      remove:async(keys)=>{const value=values();for(const key of Array.isArray(keys)?keys:[keys])delete value[area][key];save(value);listeners.forEach(fn=>fn({},area));}
    });
    window.chrome={runtime:{id:'test-extension',getURL:p=>'https://zweenotes.test/'+p},storage:{local:store('local'),session:store('session'),onChanged:{addListener:fn=>listeners.push(fn)}},permissions:{
      contains:async({origins})=>origins.every(origin=>values().permissions.includes(origin)),
      request:async({origins})=>{const value=values();value.permissions=[...new Set([...value.permissions,...origins])];save(value);return true;}
    }};
  });
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin==='https://integrate.api.nvidia.com' || url.origin==='https://dashscope-intl.aliyuncs.com') {
      const body=route.request().postDataJSON();requests.push({host:url.hostname,body});
      const material=JSON.parse(body.messages[1].content), segment=material.segments[0];
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({atoms:[{title:material.material,kind:'concept',summary:segment.text.slice(0,350),details:[],priority:2,segmentIds:[segment.id]}]})}}]})});return;
    }
    if(url.origin!=='https://zweenotes.test')return route.abort();
    const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!filename.startsWith(root))return route.abort();
    const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.png':'image/png'};
    try { await route.fulfill({body:await readFile(filename),contentType:mime[path.extname(filename)]||'application/octet-stream'}); }
    catch { await route.fulfill({status:404,body:'Missing asset'}); }
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const generateAndWait=async()=>{
    const previous=await page.locator('#history').inputValue();await page.locator('#generate').click();
    await page.waitForFunction(id=>document.querySelector('#history').value && document.querySelector('#history').value!==id && !document.querySelector('#generate').disabled,previous);
  };
  await page.goto('https://zweenotes.test/options.html');
  await page.waitForFunction(()=>document.querySelector('#base').value==='https://integrate.api.nvidia.com/v1');
  assert.equal(await page.locator('#provider').inputValue(),'nemotron');assert.equal(await page.locator('#base').getAttribute('readonly'),'');
  await page.locator('#key').fill('nvapi-BROWSER-TEST-FAKE');await page.locator('#connect').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('connected for this session'));
  assert.equal(requests.length,0);assert.equal(await page.locator('#key').inputValue(),'');
  await page.locator('#test').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Connection verified'));
  assert.equal(requests.length,1);assert.equal(requests[0].body.response_format.type,'json_schema');
  await page.locator('#provider').selectOption('qwen');
  await page.waitForFunction(()=>!document.querySelector('#region-field').hidden);
  await page.locator('#key').fill('qwen-BROWSER-TEST-FAKE');await page.locator('#connect').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Qwen connected'));
  await page.locator('#provider').selectOption('nemotron');
  await page.waitForFunction(()=>document.querySelector('#base').readOnly);
  await page.locator('#key').fill('nvapi-BROWSER-TEST-FAKE');await page.locator('#connect').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('NVIDIA Nemotron connected'));
  const keys=await page.evaluate(()=>chrome.storage.session.get('ai_credentials'));
  assert.equal(keys.ai_credentials.qwen.key,'qwen-BROWSER-TEST-FAKE');assert.equal(keys.ai_credentials.nemotron.key,'nvapi-BROWSER-TEST-FAKE');
  await page.goto('https://zweenotes.test/studio.html');
  await page.waitForFunction(()=>document.querySelector('#ai-status').textContent.includes('NVIDIA Nemotron'));
  assert.equal(await page.locator('#engine').inputValue(),'nemotron');
  await page.locator('#demo').click();await page.waitForFunction(()=>document.querySelectorAll('#materials input[type=checkbox]').length===3);
  await page.locator('#engine').selectOption('nemotron');await page.locator('#generate').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Saved locally.'));
  assert.equal(await page.locator('#blocks .block-editor').count(),3);
  assert.ok((await page.locator('#point-count').textContent()).includes('3 included'));assert.equal(requests.length,4);
  assert.equal(await page.locator('#print').isEnabled(),true);
  const included=await page.locator('#blocks .block-editor textarea').first().inputValue();assert.ok(included.length>0);
  const sourceCount=await page.evaluate(async()=>{const {list}=await import('/scripts/storage.js');return (await list('sources','demo:os')).length;});assert.equal(sourceCount,3);
  await generateAndWait();
  assert.equal(requests.length,4,'Second generation reuses completed Nemotron chunks');
  await page.locator('#engine').selectOption('qwen');await generateAndWait();
  assert.equal(requests.length,7,'Qwen and Nemotron never share provider-specific cached results');
  assert.ok(requests.slice(4).every(r=>r.host==='dashscope-intl.aliyuncs.com' && r.body.response_format.type==='json_object'));
  const chunks=await page.evaluate(async()=>{const {list}=await import('/scripts/storage.js');return (await list('chunks','demo:os')).map(c=>c.atoms[0].engine);});
  assert.ok(chunks.includes('qwen') && chunks.includes('nemotron'));
  await page.locator('#engine').selectOption('nemotron');await generateAndWait();
  assert.equal(requests.length,7);
  await mkdir(path.join(root,'test-artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'test-artifacts','nemotron-studio.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS: provider settings, session isolation, connection check, course import, generation, provenance, page fit and cache separation (7 mocked API requests).');
} finally { await browser.close(); }
