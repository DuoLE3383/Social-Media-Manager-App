import 'dotenv/config';
import { execFileSync, spawn } from 'node:child_process';
import { createServer as createTcpServer } from 'node:net';

const children = [];
let stopping = false;

function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      try { execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' }); } catch {}
    } else if (!child.killed) child.kill('SIGTERM');
  }
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

function startQuickTunnel(apiPort) {
  return new Promise((resolve, reject) => {
    const command = process.env.CLOUDFLARED_PATH || 'cloudflared';
    const tunnel = spawn(command, ['tunnel', '--url', `http://127.0.0.1:${apiPort}`], { stdio: ['inherit', 'pipe', 'pipe'] });
    children.push(tunnel);
    let output = '';
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('Timed out waiting for Cloudflare Quick Tunnel URL.')), 30000);

    function finish(error, url) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) {
        stopAll();
        reject(error);
      } else {
        resolve(url);
      }
    }

    function onData(chunk, stream) {
      const value = chunk.toString();
      stream.write(value);
      output = (output + value).slice(-12000);
      const url = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)?.[0];
      if (url) finish(null, url);
    }

    tunnel.stdout.on('data', (chunk) => onData(chunk, process.stdout));
    tunnel.stderr.on('data', (chunk) => onData(chunk, process.stderr));
    tunnel.once('error', (error) => finish(new Error(`Could not start cloudflared (${command}): ${error.message}`)));
    tunnel.once('exit', (code, signal) => {
      if (!settled) finish(new Error(`Cloudflare Tunnel exited before providing a URL (${signal || code}).`));
      else if (!stopping) {
        console.error(`Cloudflare Tunnel exited (${signal || code}); stopping the app.`);
        stopAll();
      }
    });
  });
}

async function portIsAvailable(port) {
  return new Promise((resolve) => {
    const probe = createTcpServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

let frontendPort = Number(process.env.FRONTEND_PORT || 3000);
while (frontendPort < 3100 && !(await portIsAvailable(frontendPort))) frontendPort += 1;
if (frontendPort >= 3100) throw new Error('No available frontend port found between 3000 and 3099.');

const apiPort = Number(process.env.API_PORT || process.env.PORT || 8787);
const tunnelEnabled = process.argv.includes('--tunnel') || /^(1|true|yes)$/i.test(process.env.DEV_CLOUDFLARE_TUNNEL || '');
let startBackend = true;
if (!(await portIsAvailable(apiPort))) {
  try {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/health`, { signal: AbortSignal.timeout(1500) });
    const health = await response.json();
    if (!response.ok || !health.ok) throw new Error('unexpected health response');
    startBackend = false;
    console.log(`Reusing the API already listening on port ${apiPort}.`);
  } catch {
    throw new Error(`Port ${apiPort} is busy but no AI Social API is responding there. Stop that process or set API_PORT to a free port.`);
  }
}

if (tunnelEnabled && !startBackend) {
  throw new Error('Cloudflare Tunnel needs the backend started by this script so it can receive the OAuth callback URL. Run npm run dev:clean, or stop the existing API first.');
}

let publicApiOrigin = process.env.PUBLIC_API_ORIGIN || '';
if (tunnelEnabled) {
  publicApiOrigin = await startQuickTunnel(apiPort);
  console.log(`Public API tunnel: ${publicApiOrigin}`);
  console.log('Add these exact callback URLs to the Meta app OAuth redirect URI allowlist:');
  console.log(`  ${publicApiOrigin}/api/meta/callback`);
  console.log(`  ${publicApiOrigin}/api/threads/callback`);
}

const services = [
  { name: 'frontend', args: ['node_modules/react-scripts/scripts/start.js'], env: { PORT: String(frontendPort), HOST: '127.0.0.1', DANGEROUSLY_DISABLE_HOST_CHECK: 'true' } },
  ...(startBackend ? [{ name: 'backend', args: ['server/index.mjs'], env: {
    PORT: String(apiPort), APP_ORIGIN: `http://localhost:${frontendPort}`,
    ...(publicApiOrigin ? { META_REDIRECT_URI: `${publicApiOrigin}/api/meta/callback`, THREADS_REDIRECT_URI: `${publicApiOrigin}/api/threads/callback` } : {})
  } }] : [])
];
for (const { name, args, env } of services) {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (signal || code !== 0) {
      console.error(`${name} exited (${signal || code}); stopping the other service.`);
      stopAll();
    }
  });
}
console.log(`Frontend will use http://localhost:${frontendPort}; API uses port ${apiPort}.`);
