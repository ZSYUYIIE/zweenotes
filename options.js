import { PROVIDERS, providerInfo, validateEndpoint, validateModel, credentials } from './scripts/providers.js';
import { summarizeChunk } from './scripts/ai.js';
import { makeSource } from './scripts/core.js';
const $ = id => document.getElementById(id);
let preferences = {}, currentProvider = 'nemotron', revision = 0;
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function lock(value) { for (const id of ['connect','test','clear','provider']) $(id).disabled = value; }
async function showProvider(provider) {
  const token=++revision; currentProvider=provider;
  const info=providerInfo(provider), saved=preferences[provider]||{};
  $('base').value=saved.baseUrl||info.baseUrl; $('base').readOnly=provider==='nemotron';
  $('model').value=saved.model||info.model; $('key').value='';
  $('models').replaceChildren(...info.models.map(value=>{const option=document.createElement('option');option.value=value;return option;}));
  $('region-field').hidden=provider!=='qwen';
  $('region').value=[...$('region').options].some(o=>o.value===$('base').value)?$('base').value:'custom';
  $('provider-description').textContent='Generation sends selected course text to '+info.company+'. Keys stay in this browser session and are cleared when Chrome restarts.';
  $('endpoint-note').textContent=provider==='nemotron'?'Use an NVIDIA Build API key and a currently available Nemotron text model. The default is Nemotron 3.5 Lightning.':'Use the Qwen key, endpoint and model from the same region/workspace. Copy your compatible-mode base URL from Model Studio.';
  $('endpoint-guide').href=provider==='nemotron'?'https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b':'https://www.alibabacloud.com/help/en/model-studio/regions/';
  const session=await chrome.storage.session.get(['ai_credentials','qwen_credentials']);
  if(token!==revision)return;
  const connected=session.ai_credentials?.[provider] || (provider==='qwen'?session.qwen_credentials:null);
  status(connected?.key?info.label+' connected for this Chrome session.':'No '+info.label+' key connected.');
}
async function load() {
  const values=await chrome.storage.local.get(['ai_preferences','qwen_preferences']);
  preferences=values.ai_preferences?.providers||{};
  if(!preferences.qwen && values.qwen_preferences)preferences.qwen=values.qwen_preferences;
  const selected=values.ai_preferences?.activeProvider || (values.qwen_preferences?'qwen':'nemotron');
  $('provider').value=Object.hasOwn(PROVIDERS,selected)?selected:'nemotron';
  await showProvider($('provider').value);
}
$('provider').addEventListener('change',()=>{
  preferences[currentProvider]={baseUrl:$('base').value,model:$('model').value};
  showProvider($('provider').value).catch(()=>status('Could not load provider settings.',true));
});
$('region').addEventListener('change',()=>{if($('region').value!=='custom')$('base').value=$('region').value;});
$('connect').addEventListener('click',async()=>{
  try {
    const provider=$('provider').value, info=providerInfo(provider);
    const baseUrl=validateEndpoint(provider,$('base').value.trim()), model=validateModel(provider,$('model').value);
    const key=$('key').value.trim();if(!key || /\s/.test(key))throw new Error('Enter a valid API key for '+info.label+'.');
    // Ask before awaiting storage, to preserve this click's user activation.
    const permission=chrome.permissions.request({origins:[new URL(baseUrl).origin+'/*']}); lock(true);
    if(!await permission)throw new Error('Host access was not granted.');
    const session=await chrome.storage.session.get('ai_credentials');
    await chrome.storage.session.set({ai_credentials:{...session.ai_credentials,[provider]:{baseUrl,model,key}}});
    if(provider==='qwen')await chrome.storage.session.remove('qwen_credentials');
    preferences[provider]={baseUrl,model};
    await chrome.storage.local.set({ai_preferences:{activeProvider:provider,providers:preferences}});
    $('key').value='';status(info.label+' connected for this session. Choose this provider in Studio to generate.');
  } catch(error){status(error.message,true);}finally{lock(false);}
});
$('test').addEventListener('click',async()=>{
  lock(true);
  try{
    if($('key').value.trim())throw new Error('Save the connection first, then test the saved key.');
    const config=await credentials($('provider').value);config.courseName='Connection check';
    status('Checking '+providerInfo(config.provider).label+' with a tiny sample…');
    const source=makeSource({courseId:'connection-check',title:'Sample definition',activity:'lecture',text:'A process is a running instance of a program.'});
    const points=await summarizeChunk(config,source,source.segments);
    status('Connection verified: '+points.length+' source-linked point(s) returned by '+config.model+'.');
  }catch(error){status(error.message,true);}finally{lock(false);}
});
$('clear').addEventListener('click',async()=>{
  lock(true);
  try{
    const provider=$('provider').value;const values=await chrome.storage.session.get('ai_credentials');
    const keys={...values.ai_credentials};delete keys[provider];await chrome.storage.session.set({ai_credentials:keys});
    if(provider==='qwen')await chrome.storage.session.remove('qwen_credentials');
    $('key').value='';status(providerInfo(provider).label+' disconnected. Your local materials and sheets are still saved.');
  }catch{status('Could not clear the connection.',true);}finally{lock(false);}
});
load().catch(()=>status('Could not load settings.',true));
