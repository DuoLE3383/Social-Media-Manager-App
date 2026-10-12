import 'dotenv/config';
import http from 'node:http';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.API_PORT || process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const PROVIDER = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const COMFYUI_URL = (process.env.COMFYUI_URL || 'http://127.0.0.1:8188').replace(/\/$/, '');
const COMFYUI_CHECKPOINT = process.env.COMFYUI_CHECKPOINT || 'sd_xl_base_1.0.safetensors';
const MODEL = process.env.LLM_MODEL || 'qwen2.5:3b';
const MODEL_PREMIUM = process.env.LLM_MODEL_PREMIUM || '';
const MODEL_EMBED = process.env.LLM_MODEL_EMBED || 'nomic-embed-text';
const LLM_TIMEOUT_DEFAULT = positiveInt(process.env.LLM_TIMEOUT_DEFAULT, 90_000);
const LLM_TIMEOUT_PREMIUM = positiveInt(process.env.LLM_TIMEOUT_PREMIUM, 300_000);
const LLM_TIMEOUT_EMBED = positiveInt(process.env.LLM_TIMEOUT_EMBED, 30_000);
const LLM_FALLBACK_ENABLED = process.env.LLM_FALLBACK_ENABLED !== 'false';
const ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const ALLOWED_ORIGINS = new Set([ORIGIN, ...(process.env.CORS_ORIGINS || '').split(',')].map((origin) => origin.trim()).filter(Boolean));
const WINDOW_MS = 60_000;
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE || 20);
const requests = new Map();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_REDIRECT_URI = process.env.META_REDIRECT_URI;
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
const META_STATE_SECRET = process.env.META_STATE_SECRET || META_APP_SECRET;
const THREADS_APP_ID = process.env.THREADS_APP_ID || META_APP_ID;
const THREADS_APP_SECRET = process.env.THREADS_APP_SECRET || META_APP_SECRET;
const THREADS_REDIRECT_URI = process.env.THREADS_REDIRECT_URI || `http://localhost:${PORT}/api/threads/callback`;
const THREADS_STATE_SECRET = process.env.THREADS_STATE_SECRET || THREADS_APP_SECRET;
const THREADS_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'threads-media';
const authConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const pendingThreadsStates = new Map();
const OLLAMA_QUEUE_LIMIT = positiveInt(process.env.OLLAMA_QUEUE_LIMIT, 4);
let ollamaActive = false;
const ollamaQueue = [];
let ollamaModelsCache = { expiresAt: 0, names: [] };

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function llmTimeout(tier) {
  return tier === 'premium' ? LLM_TIMEOUT_PREMIUM : LLM_TIMEOUT_DEFAULT;
}

function abortError() { return Object.assign(new Error('Generation was cancelled.'), { code: 'CANCELLED', status: 499 }); }

function enqueueOllama(task, signal) {
  if (signal?.aborted) return Promise.reject(abortError());
  if (ollamaQueue.length + Number(ollamaActive) >= OLLAMA_QUEUE_LIMIT) {
    return Promise.reject(Object.assign(new Error('The local AI queue is full. Wait for another draft to finish.'), { code: 'QUEUE_FULL', status: 429 }));
  }
  return new Promise((resolve, reject) => {
    const job = { task, signal, resolve, reject, onAbort: null };
    job.onAbort = () => {
      const index = ollamaQueue.indexOf(job);
      if (index !== -1) ollamaQueue.splice(index, 1);
      reject(abortError());
    };
    signal?.addEventListener('abort', job.onAbort, { once: true });
    ollamaQueue.push(job);
    pumpOllamaQueue();
  });
}

async function pumpOllamaQueue() {
  if (ollamaActive) return;
  const job = ollamaQueue.shift();
  if (!job) return;
  job.signal?.removeEventListener('abort', job.onAbort);
  if (job.signal?.aborted) { job.reject(abortError()); pumpOllamaQueue(); return; }
  ollamaActive = true;
  try { job.resolve(await job.task()); }
  catch (error) { job.reject(error); }
  finally { ollamaActive = false; pumpOllamaQueue(); }
}

function clientAbortSignal(req, res) {
  const controller = new AbortController();
  res.once('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  req.once('aborted', () => controller.abort());
  return controller.signal;
}

if (HOST !== '127.0.0.1' && HOST !== '::1' && !authConfigured) {
  throw new Error('Refusing to expose the API without SUPABASE_URL and SUPABASE_ANON_KEY for request authentication.');
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function bodyText(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) throw Object.assign(new Error('Request is too large (64 KB maximum).'), { status: 413 });
  }
  return raw;
}

async function bodyJson(req) {
  const raw = await bodyText(req);
  try { return JSON.parse(raw || '{}'); }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}

function checkRateLimit(key) {
  const now = Date.now();
  const entry = requests.get(key);
  if (!entry || now - entry.startedAt > WINDOW_MS) {
    requests.set(key, { startedAt: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT;
}


async function authenticatedUser(req) {
  if (!authConfigured) return { id: req.socket.remoteAddress || 'local-demo' };
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw Object.assign(new Error('Sign in to run prompts.'), { status: 401 });
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw Object.assign(new Error('Your session is invalid or expired. Sign in again.'), { status: 401 });
  const user = await response.json();
  return { id: user.id };
}

function metaConfigured() {
  return Boolean(META_APP_ID && META_APP_SECRET && META_REDIRECT_URI && META_STATE_SECRET && SUPABASE_SERVICE_ROLE_KEY && encryptionKeyIsValid());
}

function encryptionKeyIsValid() {
  return Buffer.from(process.env.META_TOKEN_ENCRYPTION_KEY || '', 'base64').length === 32;
}

function metaError(message, status = 500) {
  return Object.assign(new Error(message), { status });
}

function makeMetaState(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: Date.now(), nonce: randomBytes(16).toString('hex') })).toString('base64url');
  const signature = createHmac('sha256', META_STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readMetaState(value) {
  const [payload, signature, extra] = (value || '').split('.');
  if (!payload || !signature || extra) throw metaError('Facebook authorization state is invalid. Start connecting again.', 400);
  const expected = createHmac('sha256', META_STATE_SECRET).update(payload).digest();
  let supplied;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { throw metaError('Facebook authorization state is invalid.', 400); }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw metaError('Facebook authorization state is invalid.', 400);
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw metaError('Facebook authorization state is invalid.', 400); }
  if (!data.userId || !Number.isFinite(data.issuedAt) || Date.now() - data.issuedAt > 10 * 60_000 || data.issuedAt > Date.now() + 30_000) {
    throw metaError('Facebook authorization expired. Start connecting again.', 400);
  }
  return data;
}

function readMetaSignedRequest(value) {
  const [signature, payload, extra] = (value || '').split('.');
  if (!signature || !payload || extra || !META_APP_SECRET) throw metaError('Facebook data deletion request is invalid.', 400);
  const expected = createHmac('sha256', META_APP_SECRET).update(payload).digest();
  let supplied;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { throw metaError('Facebook data deletion signature is invalid.', 400); }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw metaError('Facebook data deletion signature is invalid.', 400);
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw metaError('Facebook data deletion payload is invalid.', 400); }
  if (data.algorithm && data.algorithm.toUpperCase() !== 'HMAC-SHA256') throw metaError('Facebook data deletion algorithm is unsupported.', 400);
  if (typeof data.user_id !== 'string' || !data.user_id) throw metaError('Facebook user ID is missing from the deletion request.', 400);
  return data;
}

function encryptionKey() {
  const key = Buffer.from(process.env.META_TOKEN_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) throw metaError('META_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}

function encryptToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { encrypted_access_token: encrypted.toString('base64'), token_iv: iv.toString('base64'), token_auth_tag: cipher.getAuthTag().toString('base64') };
}

function decryptToken(row) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.token_iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.token_auth_tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(row.encrypted_access_token, 'base64')), decipher.final()]).toString('utf8');
}

function serviceHeaders(extra = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw metaError('Server-side Supabase service role is not configured.', 503);
  return { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...extra };
}

async function savePageConnection(userId, facebookUserId, page, expiresAt) {
  const encrypted = encryptToken(page.access_token);
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/meta_page_connections?on_conflict=user_id,page_id`, {
    method: 'POST', headers: serviceHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ user_id: userId, facebook_user_id: facebookUserId, page_id: page.id, page_name: page.name || 'Facebook Page', ...encrypted, token_expires_at: expiresAt })
  });
  if (!response.ok) throw metaError('Could not save the Facebook Page connection. Check the Supabase migration and server configuration.', 502);
}

async function deleteFacebookData(facebookUserId) {
  const params = new URLSearchParams({ facebook_user_id: `eq.${facebookUserId}` });
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/meta_page_connections?${params}`, {
    method: 'DELETE', headers: serviceHeaders({ Prefer: 'return=minimal' })
  });
  if (!response.ok) throw metaError('Could not delete Facebook connection data. Apply the latest Supabase migration and retry.', 502);
}

async function readPageConnections(userId, pageId) {
  const params = new URLSearchParams({ user_id: `eq.${userId}`, select: 'page_id,page_name,encrypted_access_token,token_iv,token_auth_tag,token_expires_at' });
  if (pageId) params.set('page_id', `eq.${pageId}`);
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/meta_page_connections?${params}`, { headers: serviceHeaders() });
  if (!response.ok) throw metaError('Could not load connected Facebook Pages from Supabase.', 502);
  return response.json();
}

async function deletePageConnection(userId, pageId) {
  const params = new URLSearchParams({ user_id: `eq.${userId}`, page_id: `eq.${pageId}` });
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/meta_page_connections?${params}`, { method: 'DELETE', headers: serviceHeaders() });
  if (!response.ok) throw metaError('Could not remove the Facebook Page connection.', 502);
}

function threadsMissingConfig() {
  return [
    ...(!authConfigured ? ['SUPABASE_URL, SUPABASE_ANON_KEY'] : []),
    ...(!SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
    ...(!THREADS_APP_ID ? ['THREADS_APP_ID (or META_APP_ID)'] : []),
    ...(!THREADS_APP_SECRET ? ['THREADS_APP_SECRET (or META_APP_SECRET)'] : []),
    ...(!THREADS_REDIRECT_URI ? ['THREADS_REDIRECT_URI'] : []),
    ...(!THREADS_STATE_SECRET ? ['THREADS_STATE_SECRET (or THREADS_APP_SECRET)'] : []),
    ...(!encryptionKeyIsValid() ? ['META_TOKEN_ENCRYPTION_KEY (base64-encoded 32-byte key)'] : [])
  ];
}

function threadsConfigured() { return threadsMissingConfig().length === 0; }

function makeThreadsState(userId) {
  const data = { userId, issuedAt: Date.now(), nonce: randomBytes(18).toString('hex') };
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = createHmac('sha256', THREADS_STATE_SECRET).update(payload).digest('base64url');
  pendingThreadsStates.set(data.nonce, data.issuedAt + 10 * 60_000);
  return `${payload}.${signature}`;
}

function readThreadsState(value) {
  const [payload, signature, extra] = (value || '').split('.');
  if (!payload || !signature || extra) throw metaError('Threads authorization state is invalid. Start connecting again.', 400);
  const expected = createHmac('sha256', THREADS_STATE_SECRET).update(payload).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw metaError('Threads authorization state is invalid.', 400);
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { throw metaError('Threads authorization state is invalid.', 400); }
  const expiry = pendingThreadsStates.get(data.nonce);
  if (!data.userId || !Number.isFinite(data.issuedAt) || !expiry || expiry < Date.now() || Date.now() - data.issuedAt > 10 * 60_000 || data.issuedAt > Date.now() + 30_000) {
    throw metaError('Threads authorization expired. Start connecting again.', 400);
  }
  pendingThreadsStates.delete(data.nonce);
  for (const [nonce, expiresAt] of pendingThreadsStates) if (expiresAt < Date.now()) pendingThreadsStates.delete(nonce);
  return data;
}

async function threadsApiRequest(path, params, method = 'GET') {
  const url = new URL(`https://graph.threads.net/v1.0/${path.replace(/^\//, '')}`);
  let response;
  if (method === 'POST') {
    response = await fetch(url, { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params), signal: AbortSignal.timeout(30_000) });
  } else {
    url.search = new URLSearchParams(params).toString();
    response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw metaError(data.error?.message || `Threads API request failed (${response.status}).`, 502);
  return data;
}

async function threadsTokenRequest(path, params) {
  const url = new URL(`https://graph.threads.net/${path.replace(/^\//, '')}`);
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw metaError(data.error?.message || data.error_message || `Threads token request failed (${response.status}).`, 502);
  return data;
}

async function saveThreadsConnection(userId, profile, token) {
  const encrypted = encryptToken(token.access_token);
  const expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null;
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/threads_connections?on_conflict=user_id`, {
    method: 'POST', headers: serviceHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ user_id: userId, threads_user_id: String(profile.id), threads_username: profile.username || null, ...encrypted, token_expires_at: expiresAt, updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw metaError('Could not save the Threads connection. Apply the Threads Supabase migration and retry.', 502);
}

async function readThreadsConnection(userId) {
  const params = new URLSearchParams({ user_id: `eq.${userId}`, select: 'threads_user_id,threads_username,encrypted_access_token,token_iv,token_auth_tag,token_expires_at' });
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/threads_connections?${params}`, { headers: serviceHeaders() });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    if (failure.code === 'PGRST205') throw metaError('Supabase Data API cannot see public.threads_connections (PGRST205). Apply 202610120001_threads.sql; if the tables already exist, run supabase/fixes/threads_data_api_access.sql in the Supabase SQL Editor.', 503);
    if (failure.code === '42501' || response.status === 403) throw metaError('Supabase denied the server role access to public.threads_connections. Run supabase/fixes/threads_data_api_access.sql in the Supabase SQL Editor.', 503);
    throw metaError(`Could not load the Threads connection (Supabase HTTP ${response.status}${failure.code ? `, ${failure.code}` : ''}).`, 502);
  }
  const [connection] = await response.json();
  return connection || null;
}

async function deleteThreadsMediaForUser(userId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  const bucket = encodeURIComponent(THREADS_STORAGE_BUCKET);
  const paths = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/list/${bucket}`, {
      method: 'POST', headers: serviceHeaders(),
      body: JSON.stringify({ prefix: `${userId}/`, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
    });
    if (response.status === 404) return;
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      if (response.status === 400 && /bucket.*not found/i.test(failure.message || '')) return;
      throw metaError('Could not remove uploaded Threads media during account deletion.', 502);
    }
    const files = await response.json();
    for (const file of files) if (file?.name) paths.push(file.name.startsWith(`${userId}/`) ? file.name : `${userId}/${file.name}`);
    if (!Array.isArray(files) || files.length < 1000) break;
  }
  for (let index = 0; index < paths.length; index += 100) {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${bucket}`, {
      method: 'DELETE', headers: serviceHeaders(), body: JSON.stringify({ prefixes: paths.slice(index, index + 100) })
    });
    if (!response.ok) throw metaError('Could not remove uploaded Threads media during account deletion.', 502);
  }
}

async function createThreadsSignedMediaUrl(path) {
  const bucket = encodeURIComponent(THREADS_STORAGE_BUCKET);
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/sign/${bucket}/${encodedPath}`, {
    method: 'POST', headers: serviceHeaders(), body: JSON.stringify({ expiresIn: 7 * 24 * 60 * 60 }), signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.signedURL) throw metaError('Could not create a temporary media URL for the scheduled Threads post.', 502);
  const signedPath = data.signedURL.startsWith('/') ? data.signedURL : `/${data.signedURL}`;
  return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1${signedPath}`;
}

function comfyWorkflow(prompt) {
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: COMFYUI_CHECKPOINT } },
    '2': { class_type: 'EmptyLatentImage', inputs: { width: 768, height: 960, batch_size: 1 } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
    '4': { class_type: 'CLIPTextEncode', inputs: { text: 'text, letters, watermark, logo, low quality, blurry, distorted hands, extra fingers, duplicate people', clip: ['1', 1] } },
    '5': { class_type: 'KSampler', inputs: { seed: randomBytes(4).readUInt32LE(0), steps: 18, cfg: 6, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1, model: ['1', 0], positive: ['3', 0], negative: ['4', 0], latent_image: ['2', 0] } },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { filename_prefix: 'social-studio/threads', images: ['6', 0] } }
  };
}

async function generateLocalThreadsImage(imagePrompt) {
  if (!COMFYUI_URL) throw metaError('Local ComfyUI is not configured.', 503);
  const prompt = typeof imagePrompt === 'string' ? imagePrompt.trim() : '';
  if (!prompt || prompt.length > 4000) throw metaError('Image prompt is missing or too long.', 400);
  const clientId = randomBytes(12).toString('hex');
  const queuedResponse = await fetchWithTimeout(`${COMFYUI_URL}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: comfyWorkflow(prompt), client_id: clientId })
  }, 15_000);
  const queued = await queuedResponse.json().catch(() => ({}));
  if (!queuedResponse.ok || !queued.prompt_id) {
    const details = Object.values(queued.node_errors || {}).flatMap((node) => node.errors || []).map((item) => item.message).filter(Boolean).join('; ');
    throw metaError(`ComfyUI could not queue this image. Check the configured checkpoint and required nodes.${details ? ` ${details}` : ''}`, 502);
  }
  const deadline = Date.now() + positiveInt(process.env.COMFYUI_IMAGE_TIMEOUT_MS, 600_000);
  let imageInfo;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const historyResponse = await fetchWithTimeout(`${COMFYUI_URL}/history/${encodeURIComponent(queued.prompt_id)}`, {}, 15_000);
    if (!historyResponse.ok) continue;
    const history = await historyResponse.json().catch(() => ({}));
    const entry = history[queued.prompt_id];
    if (!entry) continue;
    if (entry.status?.status_str === 'error') throw metaError('ComfyUI image generation failed. Check its terminal for the workflow error.', 502);
    const images = Object.values(entry.outputs || {}).flatMap((output) => output.images || []);
    if (images.length) { imageInfo = images[0]; break; }
  }
  if (!imageInfo) throw metaError('ComfyUI image generation timed out. Check the model, GPU memory, and ComfyUI queue.', 504);
  const query = new URLSearchParams({ filename: imageInfo.filename, subfolder: imageInfo.subfolder || '', type: imageInfo.type || 'output' });
  const imageResponse = await fetchWithTimeout(`${COMFYUI_URL}/view?${query}`, {}, 30_000);
  if (!imageResponse.ok) throw metaError('ComfyUI created an image but the API could not download it.', 502);
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw metaError('Generated image is empty or larger than 12 MB.', 502);
  return bytes;
}

async function generateHordeThreadsImage(imagePrompt) {
  const base = 'https://aihorde.net/api/v2';
  const headers = { 'Content-Type': 'application/json', apikey: process.env.HORDE_API_KEY || '0000000000', 'Client-Agent': 'social-media-manager-app:0.2.0:github' };
  const request = await fetchWithTimeout(`${base}/generate/async`, {
    method: 'POST', headers,
    body: JSON.stringify({ prompt: `${imagePrompt}###text, letters, watermark, logo, low quality, blurry, distorted hands, extra fingers, duplicate people`, params: { width: 768, height: 960, steps: 20, n: 1 }, nsfw: false, models: ['stable_diffusion_xl'] })
  }, 20_000);
  const submitted = await request.json().catch(() => ({}));
  if (!request.ok || !submitted.id) throw metaError(`AI Horde could not accept the image job (${request.status}).`, 502);
  const deadline = Date.now() + positiveInt(process.env.HORDE_IMAGE_TIMEOUT_MS, 900_000);
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const checkResponse = await fetchWithTimeout(`${base}/generate/check/${encodeURIComponent(submitted.id)}`, { headers: { apikey: headers.apikey, 'Client-Agent': headers['Client-Agent'] } }, 15_000);
    const check = await checkResponse.json().catch(() => ({}));
    if (!checkResponse.ok) throw metaError(`AI Horde status request failed (${checkResponse.status}).`, 502);
    if (check.faulted) throw metaError('AI Horde could not fulfill this image job. Retry later.', 502);
    if (!check.done) continue;
    const resultResponse = await fetchWithTimeout(`${base}/generate/status/${encodeURIComponent(submitted.id)}`, { headers: { apikey: headers.apikey, 'Client-Agent': headers['Client-Agent'] } }, 20_000);
    const result = await resultResponse.json().catch(() => ({}));
    const imageUrl = result.generations?.[0]?.img;
    if (!resultResponse.ok || typeof imageUrl !== 'string') throw metaError('AI Horde finished without returning an image.', 502);
    let parsed;
    try { parsed = new URL(imageUrl); } catch { throw metaError('AI Horde returned an invalid image URL.', 502); }
    const trustedHordeImageHost = ['cdn.discordapp.com', 'aihorde.net', 'stablehorde.net'].includes(parsed.hostname) || parsed.hostname.endsWith('.r2.dev') || parsed.hostname.endsWith('.r2.cloudflarestorage.com');
    if (parsed.protocol !== 'https:' || !trustedHordeImageHost) throw metaError('AI Horde returned an unsupported image host.', 502);
    const imageResponse = await fetchWithTimeout(parsed.toString(), {}, 45_000);
    if (!imageResponse.ok || !imageResponse.headers.get('content-type')?.startsWith('image/')) throw metaError('Could not download the image returned by AI Horde.', 502);
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw metaError('AI Horde image is empty or larger than 12 MB.', 502);
    return bytes;
  }
  const timeoutMinutes = Math.ceil(positiveInt(process.env.HORDE_IMAGE_TIMEOUT_MS, 900_000) / 60_000);
  throw metaError(`AI Horde is still processing after ${timeoutMinutes} minutes. The image job has timed out; try again later.`, 504);
}

async function generateThreadsImage(imagePrompt) {
  const prompt = typeof imagePrompt === 'string' ? imagePrompt.trim() : '';
  if (!prompt || prompt.length > 4000) throw metaError('Image prompt is missing or too long.', 400);
  try {
    const bytes = await generateLocalThreadsImage(prompt);
    console.log('Threads image generated with local ComfyUI.');
    return bytes;
  } catch (localError) {
    console.warn('Local ComfyUI image generation unavailable; trying free AI Horde:', localError.message);
  }
  return generateHordeThreadsImage(prompt);
}

async function comfyImageServiceStatus() {
  try {
    const response = await fetchWithTimeout(`${COMFYUI_URL}/object_info/CheckpointLoaderSimple`, {}, 5_000);
    if (!response.ok) return { available: false, message: 'Start ComfyUI on this computer before scheduling image posts.' };
    const data = await response.json().catch(() => ({}));
    const checkpoints = data.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
    if (!checkpoints.includes(COMFYUI_CHECKPOINT)) return { available: false, message: `Install ${COMFYUI_CHECKPOINT} in ComfyUI and restart it.` };
    return { available: true, message: null };
  } catch { return { available: false, message: 'ComfyUI is not reachable. Start it on this computer before scheduling image posts.' }; }
}

async function storeScheduledThreadsImage(userId, postId, bytes) {
  const bucket = encodeURIComponent(THREADS_STORAGE_BUCKET);
  const path = `${userId}/scheduled-${postId}.png`;
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST', headers: serviceHeaders({ 'Content-Type': 'image/png', 'x-upsert': 'true' }), body: bytes, signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw metaError('Generated image could not be saved to the private Threads media bucket. Apply the Threads Storage migration.', 502);
  return path;
}

async function runThreadsImageWorker() {
  if (!threadsConfigured()) return;
  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/claim_threads_image_jobs`, {
      method: 'POST', headers: serviceHeaders(), body: JSON.stringify({ batch_size: 1 }), signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (response.status !== 404) console.error('Threads image job claim failed:', response.status, body.slice(0, 300));
      return;
    }
    const [job] = await response.json().catch(() => []);
    if (!job) return;
    try {
      let imagePrompt = job.image_prompt;
      if (PROVIDER === 'ollama') {
        try {
          const promptDraft = await generate(
            `Write one detailed English image-generation prompt for this Threads post. Topic: ${job.source_topic || ''}. Production direction: ${job.production_notes || ''}. Visual brief: ${job.image_prompt || ''}. Describe a single cinematic scene with natural expressions and readable composition. Vertical 4:5. Do not include words, lettering, logos, or watermarks. Return only the prompt.`,
            'You write concise, concrete prompts for local text-to-image models. Return only visual description; never add text to appear in the image.',
            'default'
          );
          if (promptDraft.text?.trim()) imagePrompt = promptDraft.text.trim().slice(0, 4000);
        } catch (error) { console.warn(`Using the prepared visual brief for ${job.id}:`, error.message); }
      }
      const bytes = await generateThreadsImage(imagePrompt);
      const imagePath = await storeScheduledThreadsImage(job.user_id, job.id, bytes);
      const params = new URLSearchParams({ id: `eq.${job.id}`, status: 'eq.image_generating' });
      const saved = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/threads_posts?${params}`, {
        method: 'PATCH', headers: serviceHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ status: 'scheduled', media_paths: [imagePath], error_message: null })
      });
      if (!saved.ok) throw metaError('Generated image could not be attached to its scheduled post.', 502);
      console.log(`Scheduled Threads post ${job.id} image generated and stored.`);
    } catch (error) {
      console.error(`Scheduled Threads image ${job.id} failed:`, error.message);
      const params = new URLSearchParams({ id: `eq.${job.id}`, status: 'eq.image_generating' });
      await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/threads_posts?${params}`, {
        method: 'PATCH', headers: serviceHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ status: 'failed', error_message: error.message.slice(0, 1000) })
      }).catch((saveError) => console.error('Could not mark Threads image job as failed:', saveError.message));
    }
  } catch (error) { console.error('Threads image worker is waiting for Supabase:', error.message); }
}

let threadsImageWorkerRunning = false;
async function scheduledThreadsImageTick() {
  if (threadsImageWorkerRunning) return;
  threadsImageWorkerRunning = true;
  try { await runThreadsImageWorker(); }
  finally { threadsImageWorkerRunning = false; }
}

async function runThreadsScheduler() {
  if (!threadsConfigured()) return;
  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/claim_due_threads_posts`, {
      method: 'POST', headers: serviceHeaders(), body: JSON.stringify({ batch_size: 3 }), signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (response.status !== 404) console.error('Threads scheduler claim failed:', response.status, body.slice(0, 300));
      return;
    }
    const jobs = await response.json().catch(() => []);
    await Promise.all((Array.isArray(jobs) ? jobs : []).map(async (job) => {
      try {
        const connection = await readThreadsConnection(job.user_id);
        const accessToken = await getThreadsAccessToken(job.user_id, connection);
        const media = [];
        for (const path of job.media_paths || []) media.push({ type: 'IMAGE', url: await createThreadsSignedMediaUrl(path) });
        const published = await publishThreadsPost(connection.threads_user_id, accessToken, job.text_content || '', media);
        const query = new URLSearchParams({ id: `eq.${job.id}`, status: 'eq.processing' });
        const saved = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/threads_posts?${query}`, {
          method: 'PATCH', headers: serviceHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ status: 'published', threads_post_id: published.postId, container_id: published.containerId, published_at: new Date().toISOString(), error_message: null })
        });
        if (!saved.ok) throw metaError('The post was sent to Threads but its schedule status could not be updated.', 502);
        console.log(`Scheduled Threads post ${job.id} published as ${published.postId}.`);
      } catch (error) {
        console.error(`Scheduled Threads post ${job.id} failed:`, error.message);
        const query = new URLSearchParams({ id: `eq.${job.id}`, status: 'eq.processing' });
        await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/threads_posts?${query}`, {
          method: 'PATCH', headers: serviceHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ status: 'failed', error_message: error.message.slice(0, 1000) })
        }).catch((saveError) => console.error('Could not mark scheduled Threads post as failed:', saveError.message));
      }
    }));
  } catch (error) { console.error('Threads scheduler is waiting for Supabase:', error.message); }
}

let threadsSchedulerRunning = false;
async function scheduledThreadsTick() {
  if (threadsSchedulerRunning) return;
  threadsSchedulerRunning = true;
  try { await runThreadsScheduler(); }
  finally { threadsSchedulerRunning = false; }
}

async function getThreadsAccessToken(userId, connection) {
  if (!connection) throw metaError('Connect a Threads account first.', 400);
  let token = decryptToken(connection);
  let expiry = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (expiry && expiry - Date.now() < 7 * 24 * 60 * 60_000) {
    try {
      const refreshed = await threadsTokenRequest('refresh_access_token', { grant_type: 'th_refresh_token', access_token: token });
      if (refreshed.access_token) {
        token = refreshed.access_token;
        expiry = Date.now() + Number(refreshed.expires_in || 5_184_000) * 1000;
        const encrypted = encryptToken(token);
        const params = new URLSearchParams({ user_id: `eq.${userId}` });
        const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/threads_connections?${params}`, {
          method: 'PATCH', headers: serviceHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ ...encrypted, token_expires_at: new Date(expiry).toISOString(), updated_at: new Date().toISOString() })
        });
        if (!response.ok) throw metaError('Could not update the refreshed Threads token.', 502);
      }
    } catch (error) {
      if (expiry <= Date.now()) throw metaError('Threads token expired. Reconnect your account.', 401);
      console.error('Threads token refresh failed:', error.message);
    }
  }
  if (expiry && expiry <= Date.now()) throw metaError('Threads token expired. Reconnect your account.', 401);
  return token;
}

async function createThreadsContainer(userId, accessToken, { text, media, carouselItem = false, children }) {
  const params = { access_token: accessToken };
  if (children) {
    params.media_type = 'CAROUSEL'; params.children = children.join(',');
    if (text) params.text = text;
  } else if (!media) {
    params.media_type = 'TEXT'; params.text = text;
  } else {
    params.media_type = media.type;
    params[media.type === 'IMAGE' ? 'image_url' : 'video_url'] = media.url;
    if (text) params.text = text;
    if (carouselItem) params.is_carousel_item = 'true';
  }
  const result = await threadsApiRequest(`${encodeURIComponent(userId)}/threads`, params, 'POST');
  if (!result.id) throw metaError('Threads did not return a media container ID.', 502);
  return result.id;
}

async function waitForThreadsContainer(containerId, accessToken, maxWaitMs = 120_000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const status = await threadsApiRequest(encodeURIComponent(containerId), { fields: 'status,error_message', access_token: accessToken });
    if (status.status === 'FINISHED') return;
    if (status.status === 'ERROR' || status.status === 'EXPIRED') throw metaError(`Threads media processing ${status.status.toLowerCase()}: ${status.error_message || 'check the media URL and format.'}`, 502);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw metaError('Threads media processing timed out. Try again with a smaller or supported media file.', 504);
}

async function publishThreadsPost(userId, accessToken, text, media) {
  let containerId;
  if (media.length > 1) {
    const children = [];
    for (const item of media) children.push(await createThreadsContainer(userId, accessToken, { media: item, carouselItem: true }));
    containerId = await createThreadsContainer(userId, accessToken, { text, children });
  } else {
    containerId = await createThreadsContainer(userId, accessToken, { text, media: media[0] || null });
  }
  if (media.length) await waitForThreadsContainer(containerId, accessToken);
  const published = await threadsApiRequest(`${encodeURIComponent(userId)}/threads_publish`, { creation_id: containerId, access_token: accessToken }, 'POST');
  if (!published.id) throw metaError('Threads did not return a published post ID.', 502);
  return { postId: published.id, containerId };
}

async function metaRequest(path, params, options = {}) {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path.replace(/^\//, '')}`);
  if (options.method === 'POST') {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params), signal: AbortSignal.timeout(20_000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw metaError(data.error?.message || 'Facebook Graph API request failed.', 502);
    return data;
  }
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw metaError(data.error?.message || 'Facebook Graph API request failed.', 502);
  return data;
}

function pickModel(tier = 'default') {
  return tier === 'premium' && MODEL_PREMIUM ? MODEL_PREMIUM : MODEL;
}

async function fetchWithTimeout(url, options, timeoutMs, signal) {
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (timedOut) throw Object.assign(new Error(`The model took longer than ${Math.ceil(timeoutMs / 1000)} seconds.`), { code: 'TIMEOUT', status: 504 });
    throw Object.assign(new Error(`Could not reach the AI provider: ${error.message}`), { code: 'PROVIDER_DOWN', status: 503 });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function availableOllamaModels(signal) {
  if (ollamaModelsCache.expiresAt > Date.now()) return ollamaModelsCache.names;
  const response = await fetchWithTimeout(`${OLLAMA_URL}/api/tags`, { method: 'GET' }, 5_000, signal);
  if (!response.ok) throw Object.assign(new Error('Ollama is not responding. Check that `ollama serve` is running.'), { code: 'PROVIDER_DOWN', status: 503 });
  const data = await response.json().catch(() => null);
  if (!Array.isArray(data?.models)) throw Object.assign(new Error('Ollama returned an invalid model list.'), { code: 'PROVIDER_DOWN', status: 503 });
  ollamaModelsCache = { names: data.models.map((item) => item.name).filter(Boolean), expiresAt: Date.now() + 5_000 };
  return ollamaModelsCache.names;
}

function hasOllamaModel(names, model) {
  return names.some((name) => name === model || name.replace(/:latest$/, '') === model.replace(/:latest$/, ''));
}

async function ollamaChat(prompt, system, model, tier, signal) {
  const timeoutMs = llmTimeout(tier);
  let lastError;
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${OLLAMA_URL}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: false, messages: [{ role: 'system', content: system || 'You are a careful social media strategist. Be clear, useful, and honest about uncertainty.' }, { role: 'user', content: prompt }] })
      }, timeoutMs, signal);
      const data = await response.json().catch(() => ({}));
      if (response.status === 404) throw Object.assign(new Error(`Ollama model "${model}" is not installed. Run: ollama pull ${model}`), { code: 'MODEL_NOT_FOUND', status: 404 });
      if (response.status === 429) throw Object.assign(new Error('Ollama is busy. Please try again shortly.'), { code: 'RATE_LIMITED', status: 429 });
      if (response.status >= 500) throw Object.assign(new Error(`Ollama returned ${response.status}. Check that the Ollama service is healthy.`), { code: 'PROVIDER_DOWN', status: 503 });
      if (!response.ok) throw Object.assign(new Error(data.error || `Ollama rejected the request (${response.status}).`), { code: 'PROVIDER_ERROR', status: 502 });
      const text = data.message?.content?.trim();
      if (!text) throw Object.assign(new Error('The model returned an empty response. Try a clearer or shorter prompt.'), { code: 'INVALID_RESPONSE', status: 502 });
      return { text, model: data.model || model, provider: 'ollama', tier };
    } catch (error) {
      lastError = error;
      if (error.code === 'CANCELLED' || error.code === 'MODEL_NOT_FOUND' || error.code === 'INVALID_RESPONSE' || error.code === 'PROVIDER_ERROR') throw error;
      if (attempt < 2) await waitForRetry(1000 * (2 ** attempt), signal);
    }
  }
  throw lastError;
}

function waitForRetry(delayMs, signal) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const timer = setTimeout(() => { cleanup(); resolve(); }, delayMs);
    const onAbort = () => { clearTimeout(timer); cleanup(); reject(abortError()); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function generate(prompt, system, tier = 'default', signal) {
  if (PROVIDER === 'ollama') {
    return enqueueOllama(async () => {
      const names = await availableOllamaModels(signal);
      let model = pickModel(tier);
      let actualTier = tier === 'premium' && MODEL_PREMIUM ? 'premium' : 'default';
      let fallbackFrom = null;
      if (!hasOllamaModel(names, model)) {
        if (actualTier === 'premium' && LLM_FALLBACK_ENABLED && hasOllamaModel(names, MODEL)) {
          fallbackFrom = model;
          model = MODEL;
          actualTier = 'default';
        } else {
          throw Object.assign(new Error(`Model "${model}" is not installed. Run: ollama pull ${model}`), { code: 'MODEL_NOT_FOUND', status: 503 });
        }
      }
      try {
        const result = await ollamaChat(prompt, system, model, actualTier, signal);
        return { ...result, fallbackFrom, ...(fallbackFrom ? { fallbackReason: 'Premium model is not installed; used the default model.' } : {}) };
      } catch (error) {
        if (signal?.aborted) throw abortError();
        if (actualTier !== 'premium' || !LLM_FALLBACK_ENABLED || !hasOllamaModel(names, MODEL)) throw error;
        const fallback = await ollamaChat(prompt, system, MODEL, 'default', signal);
        return { ...fallback, fallbackFrom: model, fallbackReason: `Premium model failed (${error.code || 'provider error'}); used the default model.` };
      }
    }, signal);
  }
  const timeoutMs = llmTimeout(tier);
  const postJson = async (url, options) => {
    const response = await fetchWithTimeout(url, options, timeoutMs, signal);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error?.message || data.error || `LLM provider returned ${response.status}.`), { code: 'PROVIDER_ERROR', status: response.status === 429 ? 429 : 502 });
    return data;
  };
  if (PROVIDER === 'openai') {
    if (!process.env.OPENAI_API_KEY) throw Object.assign(new Error('OPENAI_API_KEY is missing from the server environment.'), { status: 503 });
    const data = await postJson(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: pickModel(tier), messages: [{ role: 'system', content: system || 'You are a careful social media strategist. Be clear, useful, and honest about uncertainty.' }, { role: 'user', content: prompt }] })
    });
    return { text: data.choices?.[0]?.message?.content || '', model: data.model || pickModel(tier), provider: 'openai', tier };
  }
  if (PROVIDER === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) throw Object.assign(new Error('ANTHROPIC_API_KEY is missing from the server environment.'), { status: 503 });
    const data = await postJson(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: pickModel(tier), max_tokens: 2048, system: system || 'You are a careful social media strategist. Be clear, useful, and honest about uncertainty.', messages: [{ role: 'user', content: prompt }] })
    });
    return { text: data.content?.filter((part) => part.type === 'text').map((part) => part.text).join('\n') || '', model: data.model || pickModel(tier), provider: 'anthropic', tier };
  }
  throw Object.assign(new Error('Unsupported LLM_PROVIDER. Choose ollama, openai, or anthropic.'), { status: 503 });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const metaCallback = `${ORIGIN.replace(/\/$/, '')}/settings?facebook=`;
  const threadsCallback = `${ORIGIN.replace(/\/$/, '')}/settings?threads=`;
  if (req.method === 'GET' && url.pathname === '/api/threads/callback') {
    if (!threadsConfigured()) { res.writeHead(302, { Location: `${threadsCallback}not_configured` }); res.end(); return; }
    if (url.searchParams.has('error')) { res.writeHead(302, { Location: `${threadsCallback}denied` }); res.end(); return; }
    try {
      const { userId } = readThreadsState(url.searchParams.get('state'));
      const code = url.searchParams.get('code');
      if (!code) throw metaError('Threads did not return an authorization code.', 400);
      const tokenUrl = new URL('https://graph.threads.net/oauth/access_token');
      tokenUrl.search = new URLSearchParams({ client_id: THREADS_APP_ID, client_secret: THREADS_APP_SECRET, grant_type: 'authorization_code', redirect_uri: THREADS_REDIRECT_URI, code }).toString();
      const tokenResponse = await fetch(tokenUrl, { method: 'POST', signal: AbortSignal.timeout(20_000) });
      const shortToken = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !shortToken.access_token) throw metaError(shortToken.error_message || shortToken.error?.message || 'Threads token exchange failed.', 502);
      const longToken = await threadsTokenRequest('access_token', { grant_type: 'th_exchange_token', client_secret: THREADS_APP_SECRET, access_token: shortToken.access_token });
      if (!longToken.access_token) throw metaError('Threads did not return a long-lived access token.', 502);
      const profile = await threadsApiRequest('me', { fields: 'id,username', access_token: longToken.access_token });
      if (!profile.id) throw metaError('Threads did not return the authorized profile.', 502);
      await saveThreadsConnection(userId, profile, longToken);
      res.writeHead(302, { Location: `${threadsCallback}connected` }); res.end();
    } catch (error) {
      console.error('Threads OAuth callback failed:', error.message);
      res.writeHead(302, { Location: `${threadsCallback}error` }); res.end();
    }
    return;
  }
  if (url.pathname.startsWith('/api/threads/')) {
    try {
      if (!authConfigured) throw metaError('Configure Supabase authentication before using Threads.', 503);
      const user = await authenticatedUser(req);
      if (req.method === 'GET' && url.pathname === '/api/threads/status') {
        const missing = threadsMissingConfig();
        let connection = null;
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) connection = await readThreadsConnection(user.id);
        const expiry = connection?.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
        const imageService = await comfyImageServiceStatus();
        const imageGenerationConfigured = PROVIDER === 'ollama';
        const imageGenerationMessage = PROVIDER !== 'ollama'
          ? 'Set LLM_PROVIDER=ollama to keep image-prompt writing local.'
          : imageService.available
            ? 'Images use local ComfyUI first, then free community AI Horde if local generation fails.'
            : 'ComfyUI is unavailable; image generation can use free community AI Horde, which may queue slowly.';
        send(res, 200, { configured: missing.length === 0, missing, storageBucket: THREADS_STORAGE_BUCKET, imageGenerationConfigured, imageGenerationMessage, connected: Boolean(connection), username: connection?.threads_username || null, expiresAt: connection?.token_expires_at || null, expiringSoon: Boolean(expiry && expiry - Date.now() < 7 * 24 * 60 * 60_000) });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/threads/scheduled') {
        const params = new URLSearchParams({ user_id: `eq.${user.id}`, select: 'id,text_content,media_paths,status,scheduled_at,published_at,error_message,calendar_day,content_pillar,content_format,source_topic,opening_hook,call_to_action,production_notes,image_prompt,threads_post_id', order: 'scheduled_at.asc', limit: '100' });
        const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/threads_posts?${params}`, { headers: serviceHeaders() });
        if (!response.ok) throw metaError('Could not load scheduled Threads posts. Apply the scheduling migration first.', 502);
        send(res, 200, { posts: await response.json() });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/threads/scheduled') {
        if (!threadsConfigured()) throw metaError('Threads API is not configured yet.', 503);
        const input = await bodyJson(req);
        if (!Array.isArray(input.posts) || !input.posts.length || input.posts.length > 50) throw metaError('Schedule between 1 and 50 posts at a time.', 400);
        if (input.posts.some((post) => post.generateImage)) {
          if (PROVIDER !== 'ollama') throw metaError('Set LLM_PROVIDER=ollama for private local image-prompt writing before scheduling image posts.', 503);
        }
        const minimumTime = Date.now() + 30_000;
        const records = input.posts.map((post) => {
          const text = typeof post.text === 'string' ? post.text.trim() : '';
          const scheduleMs = Date.parse(post.scheduledAt);
          const mediaPaths = Array.isArray(post.mediaPaths) ? post.mediaPaths : [];
          if (!text || text.length > 500) throw metaError('Every scheduled Threads post needs text under 500 characters.', 400);
          if (!Number.isFinite(scheduleMs) || scheduleMs < minimumTime) throw metaError('Every scheduled time must be at least 30 seconds in the future.', 400);
          if (mediaPaths.length > 1 || mediaPaths.some((path) => typeof path !== 'string' || !path.startsWith(`${user.id}/`) || path.includes('..') || path.includes('\\'))) throw metaError('Scheduled images must be stored in your own Threads media folder.', 400);
          if (post.generateImage && mediaPaths.length) throw metaError('Choose either an existing image or automatic image generation for each post.', 400);
          if (post.generateImage && (typeof post.imagePrompt !== 'string' || !post.imagePrompt.trim())) throw metaError('Every automatic image needs an image prompt.', 400);
          if (post.imagePrompt && typeof post.imagePrompt !== 'string') throw metaError('Image prompts must be text.', 400);
          return {
            user_id: user.id, text_content: text, media_paths: mediaPaths, status: post.generateImage ? 'image_pending' : 'scheduled', scheduled_at: new Date(scheduleMs).toISOString(),
            image_prompt: typeof post.imagePrompt === 'string' ? post.imagePrompt.slice(0, 4000) : null,
            calendar_day: Number.isInteger(post.day) ? post.day : null,
            content_pillar: typeof post.pillar === 'string' ? post.pillar.slice(0, 100) : null,
            content_format: typeof post.format === 'string' ? post.format.slice(0, 100) : null,
            source_topic: typeof post.topic === 'string' ? post.topic.slice(0, 500) : null,
            opening_hook: typeof post.hook === 'string' ? post.hook.slice(0, 1000) : null,
            call_to_action: typeof post.cta === 'string' ? post.cta.slice(0, 500) : null,
            production_notes: typeof post.productionNotes === 'string' ? post.productionNotes.slice(0, 2000) : null
          };
        });
        const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/threads_posts`, {
          method: 'POST', headers: serviceHeaders({ Prefer: 'return=representation' }), body: JSON.stringify(records)
        });
        if (!response.ok) throw metaError('Could not save scheduled posts. Apply the Threads scheduling migration and retry.', 502);
        send(res, 201, { posts: await response.json() });
        return;
      }
      const scheduledMatch = url.pathname.match(/^\/api\/threads\/scheduled\/([^/]+)$/);
      if (req.method === 'DELETE' && scheduledMatch) {
        const params = new URLSearchParams({ id: `eq.${decodeURIComponent(scheduledMatch[1])}`, user_id: `eq.${user.id}`, status: 'in.(scheduled,image_pending)' });
        const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/threads_posts?${params}`, { method: 'DELETE', headers: serviceHeaders({ Prefer: 'return=representation' }) });
        if (!response.ok) throw metaError('Could not cancel this scheduled post.', 502);
        const deleted = await response.json();
        if (!deleted.length) throw metaError('This post is already publishing or is no longer scheduled.', 409);
        const [removed] = deleted;
        for (const path of removed?.media_paths || []) {
          const bucket = encodeURIComponent(THREADS_STORAGE_BUCKET);
          await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: serviceHeaders(), body: JSON.stringify({ prefixes: [path] }) }).catch(() => {});
        }
        send(res, 200, { ok: true });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/threads/connect') {
        const missing = threadsMissingConfig();
        if (missing.length) throw metaError(`Threads API setup is incomplete. Missing server configuration: ${missing.join(', ')}.`, 503);
        const state = makeThreadsState(user.id);
        const authorize = new URL('https://threads.net/oauth/authorize');
        authorize.search = new URLSearchParams({ client_id: THREADS_APP_ID, redirect_uri: THREADS_REDIRECT_URI, scope: 'threads_basic,threads_content_publish', response_type: 'code', state }).toString();
        send(res, 200, { authorizationUrl: authorize.toString() });
        return;
      }
      if (req.method === 'DELETE' && url.pathname === '/api/threads/disconnect') {
        const params = new URLSearchParams({ user_id: `eq.${user.id}` });
        const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/threads_connections?${params}`, { method: 'DELETE', headers: serviceHeaders() });
        if (!response.ok) throw metaError('Could not disconnect Threads.', 502);
        send(res, 200, { ok: true });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/threads/publish') {
        if (!threadsConfigured()) throw metaError('Threads API is not configured yet.', 503);
        if (!checkRateLimit(`threads:${user.id}`)) throw metaError('Publishing rate limit reached. Wait a minute and try again.', 429);
        const input = await bodyJson(req);
        const text = typeof input.text === 'string' ? input.text.trim() : '';
        const media = Array.isArray(input.media) ? input.media : [];
        if (text.length > 500) throw metaError('Threads post text must be no more than 500 characters.', 400);
        if (media.length > 20 || media.some((item) => !item || !['IMAGE', 'VIDEO'].includes(item.type) || typeof item.url !== 'string' || item.url.length > 4096)) {
          throw metaError('Media must contain up to 20 image or video URLs.', 400);
        }
        if (!text && !media.length) throw metaError('Add text or media before publishing.', 400);
        if (media.some((item) => { try { return new URL(item.url).protocol !== 'https:'; } catch { return true; } })) throw metaError('Threads media URLs must be valid public HTTPS URLs.', 400);
        const mediaPaths = Array.isArray(input.mediaPaths) ? input.mediaPaths : [];
        if (mediaPaths.length > 20 || mediaPaths.some((path) => typeof path !== 'string' || !path.startsWith(`${user.id}/`) || path.includes('..') || path.includes('\\'))) {
          throw metaError('Threads media paths must point to files in your own storage folder.', 400);
        }
        const connection = await readThreadsConnection(user.id);
        const accessToken = await getThreadsAccessToken(user.id, connection);
        const published = await publishThreadsPost(connection.threads_user_id, accessToken, text, media);
        const saved = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/threads_posts`, {
          method: 'POST', headers: serviceHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ user_id: user.id, threads_post_id: published.postId, container_id: published.containerId, text_content: text || null, media_paths: mediaPaths, status: 'published' })
        });
        if (!saved.ok) console.error('Threads post was published but history could not be saved.');
        send(res, 200, { ok: true, postId: published.postId, containerId: published.containerId, username: connection.threads_username });
        return;
      }
      send(res, 404, { error: 'Not found.' });
    } catch (error) { send(res, error.status || 502, { error: error.message || 'Threads request failed.' }); }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/meta/callback') {
    if (!metaConfigured()) { res.writeHead(302, { Location: `${metaCallback}not_configured` }); res.end(); return; }
    if (url.searchParams.has('error')) { res.writeHead(302, { Location: `${metaCallback}denied` }); res.end(); return; }
    try {
      const { userId } = readMetaState(url.searchParams.get('state'));
      const code = url.searchParams.get('code');
      if (!code) throw metaError('Facebook did not return an authorization code.', 400);
      const shortToken = await metaRequest('oauth/access_token', { client_id: META_APP_ID, client_secret: META_APP_SECRET, redirect_uri: META_REDIRECT_URI, code });
      const longToken = await metaRequest('oauth/access_token', { grant_type: 'fb_exchange_token', client_id: META_APP_ID, client_secret: META_APP_SECRET, fb_exchange_token: shortToken.access_token });
      const facebookUser = await metaRequest('me', { fields: 'id', access_token: longToken.access_token });
      const pages = await metaRequest('me/accounts', { fields: 'id,name,access_token,tasks', limit: '100', access_token: longToken.access_token });
      const expiresAt = longToken.expires_in ? new Date(Date.now() + Number(longToken.expires_in) * 1000).toISOString() : null;
      for (const page of pages.data || []) if (page.id && page.access_token) await savePageConnection(userId, facebookUser.id, page, expiresAt);
      res.writeHead(302, { Location: `${metaCallback}connected&count=${(pages.data || []).length}` }); res.end();
    } catch (error) {
      console.error('Facebook OAuth callback failed:', error.message);
      res.writeHead(302, { Location: `${metaCallback}error` }); res.end();
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/meta/connect') {
    try {
      if (!authConfigured) throw metaError('Configure Supabase authentication before connecting Facebook.', 503);
      if (!metaConfigured()) throw metaError('Configure the Meta and server-side Supabase credentials first.', 503);
      const user = await authenticatedUser(req);
      const authorize = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
      authorize.search = new URLSearchParams({ client_id: META_APP_ID, redirect_uri: META_REDIRECT_URI, state: makeMetaState(user.id), response_type: 'code', scope: 'pages_show_list,pages_read_engagement,pages_manage_posts' }).toString();
      send(res, 200, { authorizationUrl: authorize.toString() });
    } catch (error) { send(res, error.status || 502, { error: error.message }); }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/meta/status') {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_ANON_KEY ? ['SUPABASE_ANON_KEY'] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
      ...(!META_APP_ID ? ['META_APP_ID'] : []),
      ...(!META_APP_SECRET ? ['META_APP_SECRET'] : []),
      ...(!META_REDIRECT_URI ? ['META_REDIRECT_URI'] : []),
      ...(!encryptionKeyIsValid() ? ['META_TOKEN_ENCRYPTION_KEY (base64-encoded 32-byte key)'] : [])
    ];
    send(res, 200, { configured: Boolean(authConfigured && metaConfigured()), missing, graphVersion: META_GRAPH_VERSION });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/meta/data-deletion') {
    try {
      if (!META_APP_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw metaError('Facebook data deletion is not configured.', 503);
      const contentType = req.headers['content-type'] || '';
      let signedRequest;
      if (contentType.includes('application/json')) signedRequest = (await bodyJson(req)).signed_request;
      else if (contentType.includes('application/x-www-form-urlencoded')) signedRequest = new URLSearchParams(await bodyText(req)).get('signed_request');
      else throw metaError('Facebook data deletion request must be form-encoded.', 400);
      const data = readMetaSignedRequest(signedRequest);
      await deleteFacebookData(data.user_id);
      const confirmationCode = randomBytes(16).toString('hex');
      send(res, 200, { url: `${ORIGIN.replace(/\/$/, '')}/privacy/data-deletion?request=${confirmationCode}`, confirmation_code: confirmationCode });
    } catch (error) {
      console.error('Facebook data deletion failed:', error.message);
      send(res, error.status || 500, { error: error.message || 'Facebook data deletion failed.' });
    }
    return;
  }
  if (req.method === 'DELETE' && url.pathname === '/api/account') {
    try {
      if (!authConfigured || !SUPABASE_SERVICE_ROLE_KEY) throw metaError('Account deletion is not configured.', 503);
      const user = await authenticatedUser(req);
      await deleteThreadsMediaForUser(user.id);
      const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'DELETE', headers: serviceHeaders(), signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) throw metaError('Supabase could not delete this account. Check server permissions and try again.', 502);
      send(res, 200, { deleted: true });
    } catch (error) { send(res, error.status || 502, { error: error.message || 'Account deletion failed.' }); }
    return;
  }
  if (url.pathname.startsWith('/api/meta/') && url.pathname !== '/api/meta/callback' && url.pathname !== '/api/meta/connect' && url.pathname !== '/api/meta/status') {
    try {
      if (!authConfigured || !metaConfigured()) throw metaError('Facebook integration is not configured yet.', 503);
      const user = await authenticatedUser(req);
      if (req.method === 'GET' && url.pathname === '/api/meta/pages') {
        const pages = await readPageConnections(user.id);
        send(res, 200, { pages: pages.map(({ page_id, page_name, token_expires_at }) => ({ id: page_id, name: page_name, tokenExpiresAt: token_expires_at })) });
        return;
      }
      const pageMatch = url.pathname.match(/^\/api\/meta\/pages\/([^/]+)(?:\/(publish))?$/);
      if (!pageMatch) { send(res, 404, { error: 'Not found.' }); return; }
      const pageId = decodeURIComponent(pageMatch[1]);
      if (req.method === 'DELETE' && !pageMatch[2]) {
        await deletePageConnection(user.id, pageId); send(res, 200, { ok: true }); return;
      }
      if (req.method === 'POST' && pageMatch[2]) {
        const input = await bodyJson(req);
        const message = typeof input.message === 'string' ? input.message.trim() : '';
        if (!message || message.length > 5_000) throw metaError('Post text is required and must be under 5,000 characters.', 400);
        const [connection] = await readPageConnections(user.id, pageId);
        if (!connection) throw metaError('That Facebook Page is not connected to your account.', 404);
        const accessToken = decryptToken(connection);
        const published = await metaRequest(`${encodeURIComponent(pageId)}/feed`, { message, access_token: accessToken }, { method: 'POST' });
        send(res, 200, { id: published.id, pageId, pageName: connection.page_name }); return;
      }
      send(res, 404, { error: 'Not found.' });
    } catch (error) { send(res, error.status || 502, { error: error.message || 'Facebook request failed.' }); }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/health') {
    const keyConfigured = PROVIDER === 'openai' ? Boolean(process.env.OPENAI_API_KEY) : PROVIDER === 'anthropic' ? Boolean(process.env.ANTHROPIC_API_KEY) : true;
    send(res, 200, { ok: true, provider: PROVIDER, model: MODEL, premiumModel: MODEL_PREMIUM || null, embedModel: MODEL_EMBED, keyConfigured, authRequired: authConfigured, timeouts: { default: LLM_TIMEOUT_DEFAULT, premium: LLM_TIMEOUT_PREMIUM, embed: LLM_TIMEOUT_EMBED }, fallbackEnabled: LLM_FALLBACK_ENABLED });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/embed') {
    try {
      const abortSignal = clientAbortSignal(req, res);
      const user = await authenticatedUser(req);
      if (!checkRateLimit(`embed:${user.id}`)) { send(res, 429, { error: 'Embedding rate limit reached. Wait a minute and try again.' }); return; }
      if (PROVIDER !== 'ollama') throw Object.assign(new Error('Embeddings are currently available with the Ollama provider.'), { status: 503 });
      const input = (await bodyJson(req)).input;
      const texts = Array.isArray(input) ? input : [input];
      if (!texts.length || texts.length > 64 || texts.some((text) => typeof text !== 'string' || !text.trim() || text.length > 20_000)) {
        send(res, 400, { error: 'Input must be a non-empty string or an array of up to 64 non-empty strings (20,000 characters each).' }); return;
      }
      const response = await fetchWithTimeout(`${OLLAMA_URL}/api/embed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL_EMBED, input: texts })
      }, LLM_TIMEOUT_EMBED, abortSignal);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || `Ollama returned ${response.status}. Check that ${MODEL_EMBED} is installed.`), { status: 502 });
      if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length || data.embeddings.some((vector) => !Array.isArray(vector) || !vector.length || vector.some((value) => !Number.isFinite(value)))) {
        throw Object.assign(new Error('Ollama returned invalid embedding vectors.'), { status: 502 });
      }
      send(res, 200, { vectors: data.embeddings, model: MODEL_EMBED });
    } catch (error) { if (!res.destroyed) send(res, error.status || 502, { error: error.message || 'Could not create embeddings. Check Ollama and model configuration.' }); }
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/prompts/run') {
    try {
      const abortSignal = clientAbortSignal(req, res);
      const user = await authenticatedUser(req);
      if (!checkRateLimit(user.id)) { send(res, 429, { error: 'Rate limit reached. Wait a minute and try again.' }); return; }
      const input = await bodyJson(req);
      const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
      if (!prompt || prompt.length > 24_000) { send(res, 400, { error: 'Prompt is required and must be under 24,000 characters.' }); return; }
      if (input.tier !== undefined && !['default', 'premium'].includes(input.tier)) { send(res, 400, { error: 'tier must be default or premium.' }); return; }
      const tier = input.tier === 'premium' && MODEL_PREMIUM ? 'premium' : 'default';
      const result = await generate(prompt, typeof input.system === 'string' ? input.system.slice(0, 4_000) : '', tier, abortSignal);
      send(res, 200, { ...result, createdAt: new Date().toISOString() });
    } catch (error) {
      if (error.code === 'CANCELLED' && (res.destroyed || res.writableEnded)) return;
      const messages = {
        TIMEOUT: 'The model took too long. Try the Fast model or shorten the requested output.',
        PROVIDER_DOWN: 'The AI provider is not responding. Check that Ollama is running and try again.',
        MODEL_NOT_FOUND: error.message,
        INVALID_RESPONSE: error.message,
        RATE_LIMITED: error.message,
        QUEUE_FULL: error.message,
        PROVIDER_ERROR: error.message
      };
      send(res, error.status || 502, { error: error.code || 'INTERNAL', message: messages[error.code] || error.message || `Could not reach ${PROVIDER}. Check provider configuration and connection.` });
    }
    return;
  }
  send(res, 404, { error: 'Not found.' });
});

server.listen(PORT, HOST, () => {
  console.log(`Social Media AI API listening on http://${HOST}:${PORT} (${PROVIDER}/${MODEL})`);
  setInterval(scheduledThreadsTick, 15_000).unref();
  setInterval(scheduledThreadsImageTick, 15_000).unref();
  scheduledThreadsTick();
  scheduledThreadsImageTick();
});
