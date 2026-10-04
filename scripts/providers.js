export const PROVIDERS = Object.freeze({
  qwen: Object.freeze({ label: 'Qwen', company: 'Alibaba Model Studio', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', models: ['qwen-plus', 'qwen-flash'] }),
  nemotron: Object.freeze({ label: 'NVIDIA Nemotron', company: 'NVIDIA', baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'nvidia/nemotron-3.5-lightning-30b-a3b', models: ['nvidia/nemotron-3.5-lightning-30b-a3b', 'nvidia/nemotron-3-super-120b-a12b'] })
});
export const PROMPT_VERSION = 2;
const qwenHosts = /^(?:dashscope(?:-intl|-us)?\.aliyuncs\.com|cn-hongkong\.dashscope\.aliyuncs\.com|[a-z0-9-]+\.(?:cn-beijing|ap-southeast-1|us-east-1|cn-hongkong|eu-central-1|ap-northeast-1)\.maas\.aliyuncs\.com)$/;
export function providerInfo(provider) {
  if (!Object.hasOwn(PROVIDERS, provider)) throw new Error('Choose Qwen or NVIDIA Nemotron as the AI provider.');
  return PROVIDERS[provider];
}
export function validateEndpoint(provider, value) {
  providerInfo(provider);
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a valid AI base URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) throw new Error('Use an official HTTPS provider endpoint without credentials, ports or query parameters.');
  if (provider === 'nemotron') {
    if (url.hostname !== 'integrate.api.nvidia.com' || !/^\/v1\/?$/.test(url.pathname)) throw new Error('NVIDIA keys can only be used with https://integrate.api.nvidia.com/v1.');
    return PROVIDERS.nemotron.baseUrl;
  }
  if (!qwenHosts.test(url.hostname) || !/^\/compatible-mode\/v1\/?$/.test(url.pathname)) throw new Error('Use an official Alibaba Model Studio endpoint ending in /compatible-mode/v1.');
  return url.origin + '/compatible-mode/v1';
}
export function validateModel(provider, value) {
  providerInfo(provider);
  const model = String(value || '').trim();
  if (!/^[a-zA-Z0-9_.:/-]{1,100}$/.test(model)) throw new Error('Enter a valid model ID.');
  if (provider === 'nemotron' && !/^nvidia\/(?:llama[\w.-]*-)?nemotron[\w.-]*$/i.test(model)) throw new Error('Enter an NVIDIA Nemotron text model ID.');
  return model;
}
export async function credentials(provider) {
  const info = providerInfo(provider);
  const values = await chrome.storage.session.get(['ai_credentials', 'qwen_credentials']);
  const stored = values.ai_credentials?.[provider] || (provider === 'qwen' ? values.qwen_credentials : null);
  if (!stored?.key) throw new Error('Connect your '+info.label+' API key in AI settings first.');
  const config = { provider, baseUrl: validateEndpoint(provider, stored.baseUrl), model: validateModel(provider, stored.model || info.model), key: stored.key };
  if (!await chrome.permissions.contains({ origins: [new URL(config.baseUrl).origin+'/*'] })) throw new Error(info.label+' host access is missing. Reconnect in AI settings.');
  return config;
}
