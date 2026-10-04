import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSource, chunkSource, composeSheet } from '../scripts/core.js';
import { PROVIDERS, validateEndpoint, validateModel, credentials } from '../scripts/providers.js';
import { buildRequest, validateResponse, summarizeChunk } from '../scripts/ai.js';
import { DEFAULT_BASE, validateBaseUrl } from '../scripts/qwen.js';
const source = makeSource({ courseId:'demo:os',title:'Paging',activity:'lecture',text:'# Address bits\nFor a page size of 2^k, the low k bits are the offset.\n\n# Translation\nTranslate the virtual page number to a physical frame number.' });
const config = { provider:'nemotron', ...PROVIDERS.nemotron, key:'nvapi-FAKE-UNIT-TEST-ONLY' };
const point = { title:'Page offset',kind:'formula',summary:'For page size $2^k$, the offset uses $k$ bits.',details:[],priority:3,segmentIds:['s1'] };
const result = JSON.stringify({atoms:[point]});
test('NVIDIA endpoint is exact and cannot route a key to another host',()=>{
  assert.equal(validateEndpoint('nemotron',PROVIDERS.nemotron.baseUrl+'/'),PROVIDERS.nemotron.baseUrl);
  for(const url of ['http://integrate.api.nvidia.com/v1','https://integrate.api.nvidia.com.evil.test/v1','https://user:secret@integrate.api.nvidia.com/v1','https://integrate.api.nvidia.com:8443/v1','https://integrate.api.nvidia.com/v1?key=secret','https://integrate.api.nvidia.com/v1#x',PROVIDERS.qwen.baseUrl])assert.throws(()=>validateEndpoint('nemotron',url));
  assert.throws(()=>validateEndpoint('__proto__',PROVIDERS.nemotron.baseUrl));
});
test('Qwen compatibility and official workspace endpoints are preserved',()=>{
  assert.equal(validateBaseUrl(DEFAULT_BASE),PROVIDERS.qwen.baseUrl);
  assert.equal(validateEndpoint('qwen','https://ws-example.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/'),'https://ws-example.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1');
  assert.throws(()=>validateEndpoint('qwen',PROVIDERS.nemotron.baseUrl));
  assert.throws(()=>validateEndpoint('qwen','https://dashscope-intl.aliyuncs.com.evil.test/compatible-mode/v1'));
});
test('model validation rejects invalid IDs and non-Nemotron NVIDIA models',()=>{
  assert.equal(validateModel('nemotron',PROVIDERS.nemotron.model),PROVIDERS.nemotron.model);
  assert.equal(validateModel('nemotron','nvidia/llama-3.1-nemotron-70b-instruct'),'nvidia/llama-3.1-nemotron-70b-instruct');
  assert.throws(()=>validateModel('nemotron','nvidia/other-model'));
  assert.throws(()=>validateModel('qwen','model\nnew-line'));
});
test('NVIDIA uses a schema restricted to actual source IDs and disables thinking',()=>{
  const body=buildRequest(config,source,source.segments);
  assert.equal(body.response_format.type,'json_schema');
  assert.deepEqual(body.response_format.json_schema.schema.properties.atoms.items.properties.segmentIds.items.enum,['s1','s2']);
  assert.equal(body.response_format.json_schema.schema.properties.atoms.items.properties.segmentIds.minItems,1);
  assert.equal(body.chat_template_kwargs.enable_thinking,false);assert.equal(body.stream,false);assert.equal(body.enable_thinking,undefined);
  assert.ok(!JSON.stringify(body).includes(config.key));
});
test('Qwen uses its own JSON mode and thinking parameter',()=>{
  const body=buildRequest({...config,provider:'qwen',model:'qwen-plus'},source,source.segments);
  assert.equal(body.response_format.type,'json_object');assert.equal(body.enable_thinking,false);assert.equal(body.chat_template_kwargs,undefined);
});
test('valid output retains page/section evidence and AI review flags',()=>{
  const atoms=validateResponse(result,source,source.segments,'nemotron');
  assert.equal(atoms[0].engine,'nemotron');assert.equal(atoms[0].needsReview,true);
  assert.deepEqual(atoms[0].references[0],{sourceId:source.id,segmentId:'s1',locator:source.segments[0].locator});
  const sheet=composeSheet({id:source.courseId,name:'OS'},[source],atoms,{blockLimit:10});
  assert.equal(sheet.layout.columns,4);assert.equal(sheet.layout.orientation,'landscape');assert.equal(sheet.blocks.length,1);assert.ok(sheet.blocks[0].body.includes('$2^k$'));
});
test('invalid, empty and invented references are rejected rather than repaired',()=>{
  for(const ids of [[],['s99'],['s1','s99'],null])assert.throws(()=>validateResponse({atoms:[{...point,segmentIds:ids}]},source,source.segments,'nemotron'),/source segment/);
  assert.throws(()=>validateResponse('not JSON',source,source.segments,'nemotron'),/invalid JSON/);
  assert.throws(()=>validateResponse({atoms:[{...point,kind:'unsupported'}]},source,source.segments,'nemotron'),/malformed/);
});
test('Nemotron request authenticates only to the fixed endpoint',async()=>{
  let calls=0;
  const atoms=await summarizeChunk(config,source,source.segments,undefined,async(url,options)=>{
    calls++;assert.equal(url,'https://integrate.api.nvidia.com/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer '+config.key);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    assert.ok(!options.body.includes(config.key));assert.equal(JSON.parse(options.body).response_format.type,'json_schema');
    return Response.json({choices:[{finish_reason:'stop',message:{content:result}}]});
  });assert.equal(calls,1);assert.equal(atoms[0].engine,'nemotron');
});
test('provider errors and network exceptions do not echo a key or remote error body',async()=>{
  for(const status of [401,403,404,429,500]){
    await assert.rejects(()=>summarizeChunk(config,source,source.segments,undefined,async()=>new Response(config.key,{status})),error=>!error.message.includes(config.key));
  }
  await assert.rejects(()=>summarizeChunk(config,source,source.segments,undefined,async()=>{throw new Error(config.key);}),error=>/Could not reach NVIDIA/.test(error.message)&&!error.message.includes(config.key));
});
test('truncated and unparseable API responses are not accepted',async()=>{
  await assert.rejects(()=>summarizeChunk(config,source,source.segments,undefined,async()=>Response.json({choices:[{finish_reason:'length',message:{content:result}}]})),/truncated/);
  await assert.rejects(()=>summarizeChunk(config,source,source.segments,undefined,async()=>new Response('bad json',{status:200})),/unreadable/);
});
test('cancelled jobs do not start another model request',async()=>{
  const controller=new AbortController();controller.abort();let called=false;
  await assert.rejects(()=>summarizeChunk(config,source,source.segments,controller.signal,async()=>{called=true;}),/cancelled/);assert.equal(called,false);
});
test('stored keys are isolated per provider and legacy Qwen sessions still work',async()=>{
  const previous=globalThis.chrome;
  let values={qwen_credentials:{key:'legacy-qwen-unit-key',baseUrl:PROVIDERS.qwen.baseUrl,model:'qwen-plus'}};
  globalThis.chrome={storage:{session:{get:async()=>values}},permissions:{contains:async()=>true}};
  try{
    assert.equal((await credentials('qwen')).key,'legacy-qwen-unit-key');
    await assert.rejects(()=>credentials('nemotron'),/Connect your NVIDIA/);
    values={ai_credentials:{nemotron:{key:config.key,baseUrl:PROVIDERS.nemotron.baseUrl,model:config.model}}};
    assert.equal((await credentials('nemotron')).provider,'nemotron');await assert.rejects(()=>credentials('qwen'),/Connect your Qwen/);
    globalThis.chrome.permissions.contains=async()=>false;await assert.rejects(()=>credentials('nemotron'),/host access/);
  }finally{globalThis.chrome=previous;}
});
test('chunking preserves references across long materials',()=>{
  const long=makeSource({courseId:'course:other',title:'Long source',text:'x'.repeat(30000)});
  const chunks=chunkSource(long);assert.equal(chunks.length,3);assert.ok(chunks.every(c=>c.reduce((n,s)=>n+s.text.length,0)<=11000));assert.ok(chunks.flat().every(s=>s.id==='s1'));
});
