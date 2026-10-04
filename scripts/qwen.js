// Compatibility exports for callers of the original Qwen-only adapter.
import { PROVIDERS, validateEndpoint } from './providers.js';
import { credentials as getCredentials, summarizeChunk as summarize, validateResponse as validate } from './ai.js';
export const DEFAULT_BASE = PROVIDERS.qwen.baseUrl;
export const validateBaseUrl = value => validateEndpoint('qwen', value);
export const credentials = () => getCredentials('qwen');
export const validateResponse = (raw, source, segments) => validate(raw, source, segments, 'qwen');
export const summarizeChunk = (config, ...args) => summarize({ ...config, provider: 'qwen' }, ...args);
