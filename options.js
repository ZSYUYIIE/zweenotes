import { DEFAULT_BASE, validateBaseUrl } from './scripts/qwen.js';
const $ = id => document.getElementById(id);
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
async function load() {
  const values = await chrome.storage.local.get('qwen_preferences');
  const preferences = values.qwen_preferences || {};
  $('base').value = preferences.baseUrl || DEFAULT_BASE;
  $('model').value = preferences.model || 'qwen-plus';
  $('region').value = [...$('region').options].some(o => o.value === $('base').value) ? $('base').value : 'custom';
  const session = await chrome.storage.session.get('qwen_credentials');
  status(session.qwen_credentials?.key ? 'Connected for this Chrome session.' : 'No key connected.');
}
$('region').addEventListener('change', () => { if ($('region').value !== 'custom') $('base').value = $('region').value; });
$('connect').addEventListener('click', async () => {
  try {
    const baseUrl = validateBaseUrl($('base').value.trim());
    const model = $('model').value.trim(); const key = $('key').value.trim();
    if (!key || /\s/.test(key)) throw new Error('Enter a valid API key.');
    if (!/^[a-zA-Z0-9_.:/-]{1,100}$/.test(model)) throw new Error('Enter a valid model ID.');
    // Request host permission before an await, while this click still has user activation.
    const permission = chrome.permissions.request({ origins: [new URL(baseUrl).origin + '/*'] });
    $('connect').disabled = true;
    if (!await permission) throw new Error('Host access was not granted.');
    await chrome.storage.session.set({ qwen_credentials: { baseUrl, model, key } });
    await chrome.storage.local.set({ qwen_preferences: { baseUrl, model } });
    $('key').value = ''; status('Connected for this session. Selected text is sent only when you generate with Qwen.');
  } catch (error) { status(error.message, true); } finally { $('connect').disabled = false; }
});
$('clear').addEventListener('click', async () => {
  try { await chrome.storage.session.remove('qwen_credentials'); $('key').value = ''; status('Disconnected. Your local materials and sheets are still saved.'); }
  catch { status('Could not clear the connection.', true); }
});
load().catch(() => status('Could not load settings.', true));
