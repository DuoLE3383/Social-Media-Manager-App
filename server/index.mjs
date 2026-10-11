import 'dotenv/config';
import http from 'node:http';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.API_PORT || process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const PROVIDER = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = process.env.LLM_MODEL || 'qwen2.5:3b';
const MODEL_PREMIUM = process.env.LLM_MODEL_PREMIUM || '';
const MODEL_EMBED = process.env.LLM_MODEL_EMBED || 'nomic-embed-text';
const ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
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
const threadsPublishWindows = new Map();

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

function checkThreadsPublishLimit(userId) {
  const now = Date.now();
  const window = threadsPublishWindows.get(userId);
  if (!window || now - window.startedAt >= 24 * 60 * 60_000) {
    threadsPublishWindows.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  if (window.count >= 250) return false;
  window.count += 1;
  return true;
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
  if (!response.ok) throw metaError('Could not load the Threads connection.', 502);
  const [connection] = await response.json();
  return connection || null;
}

async function getThreadsAccessToken(userId, connection) {
  if (!connection) throw metaError('Connect a Threads account first.', 400);
  let token = decryptToken(connection);
  let expiry = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (expiry && expiry - Date.now() < 7 * 24 * 60 * 60_000) {
    try {
      const refreshed = await threadsApiRequest('refresh_access_token', { grant_type: 'th_refresh_token', access_token: token });
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

async function generate(prompt, system, tier = 'default') {
  const model = pickModel(tier);
  if (PROVIDER === 'ollama') {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, messages: [{ role: 'system', content: system || 'You are a careful social media strategist. Be clear, useful, and honest about uncertainty.' }, { role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(120_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || `Ollama returned ${response.status}. Check that Ollama is running and the model is installed.`), { status: 502 });
    return { text: data.message?.content || '', model: data.model || model, provider: 'ollama', tier: tier === 'premium' && MODEL_PREMIUM ? 'premium' : 'default' };
  }
  if (PROVIDER === 'openai') {
    if (!process.env.OPENAI_API_KEY) throw Object.assign(new Error('OPENAI_API_KEY is missing from the server environment.'), { status: 503 });
    const response = await fetch(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system || 'You are a careful social media strategist. Be clear, useful, and honest about uncertainty.' }, { role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(120_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error?.message || `LLM provider returned ${response.status}.`), { status: 502 });
    return { text: data.choices?.[0]?.message?.content || '', model: data.model || model, provider: 'openai', tier };
  }
  if (PROVIDER === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) throw Object.assign(new Error('ANTHROPIC_API_KEY is missing from the server environment.'), { status: 503 });
    const response = await fetch(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 2048, system: system || 'You are a careful social media strategist. Be clear, useful, and honest about uncertainty.', messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(120_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error?.message || `LLM provider returned ${response.status}.`), { status: 502 });
    return { text: data.content?.filter((part) => part.type === 'text').map((part) => part.text).join('\n') || '', model: data.model || model, provider: 'anthropic', tier };
  }
  throw Object.assign(new Error('Unsupported LLM_PROVIDER. Choose ollama, openai, or anthropic.'), { status: 503 });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin === ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ORIGIN);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const metaCallback = `${ORIGIN.replace(/\/$/, '')}/settings?facebook=`;
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
    send(res, 200, { ok: true, provider: PROVIDER, model: MODEL, premiumModel: MODEL_PREMIUM || null, embedModel: MODEL_EMBED, keyConfigured, authRequired: authConfigured });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/embed') {
    try {
      const user = await authenticatedUser(req);
      if (!checkRateLimit(`embed:${user.id}`)) { send(res, 429, { error: 'Embedding rate limit reached. Wait a minute and try again.' }); return; }
      if (PROVIDER !== 'ollama') throw Object.assign(new Error('Embeddings are currently available with the Ollama provider.'), { status: 503 });
      const input = (await bodyJson(req)).input;
      const texts = Array.isArray(input) ? input : [input];
      if (!texts.length || texts.length > 64 || texts.some((text) => typeof text !== 'string' || !text.trim() || text.length > 20_000)) {
        send(res, 400, { error: 'Input must be a non-empty string or an array of up to 64 non-empty strings (20,000 characters each).' }); return;
      }
      const response = await fetch(`${OLLAMA_URL}/api/embed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL_EMBED, input: texts }), signal: AbortSignal.timeout(60_000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || `Ollama returned ${response.status}. Check that ${MODEL_EMBED} is installed.`), { status: 502 });
      if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length || data.embeddings.some((vector) => !Array.isArray(vector) || !vector.length || vector.some((value) => !Number.isFinite(value)))) {
        throw Object.assign(new Error('Ollama returned invalid embedding vectors.'), { status: 502 });
      }
      send(res, 200, { vectors: data.embeddings, model: MODEL_EMBED });
    } catch (error) { send(res, error.status || 502, { error: error.message || 'Could not create embeddings. Check Ollama and model configuration.' }); }
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/prompts/run') {
    try {
      const user = await authenticatedUser(req);
      if (!checkRateLimit(user.id)) { send(res, 429, { error: 'Rate limit reached. Wait a minute and try again.' }); return; }
      const input = await bodyJson(req);
      const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
      if (!prompt || prompt.length > 24_000) { send(res, 400, { error: 'Prompt is required and must be under 24,000 characters.' }); return; }
      if (input.tier !== undefined && !['default', 'premium'].includes(input.tier)) { send(res, 400, { error: 'tier must be default or premium.' }); return; }
      const tier = input.tier === 'premium' && MODEL_PREMIUM ? 'premium' : 'default';
      const result = await generate(prompt, typeof input.system === 'string' ? input.system.slice(0, 4_000) : '', tier);
      send(res, 200, { ...result, createdAt: new Date().toISOString() });
    } catch (error) {
      send(res, error.status || 502, { error: error.status ? error.message : `Could not reach ${PROVIDER}. Check provider configuration and connection.` });
    }
    return;
  }
  send(res, 404, { error: 'Not found.' });
});

server.listen(PORT, HOST, () => console.log(`Social Media AI API listening on http://${HOST}:${PORT} (${PROVIDER}/${MODEL})`));
