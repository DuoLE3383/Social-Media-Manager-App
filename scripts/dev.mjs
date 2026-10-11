import 'dotenv/config';
import { execFileSync, spawn } from 'node:child_process';
import { createServer as createTcpServer } from 'node:net';

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
let startBackend = true;
if (!(await portIsAvailable(apiPort))) {
  try {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/health`, { signal: AbortSignal.timeout(1500) });
    const health = await response.json();
    if (!response.ok || !health.ok) throw new Error('unexpected health response');
    startBackend = false;
    console.log(`Reusing the API already listening on port ${apiPort}.`);
  } catch {
    throw new Error(`Port ${apiPort} is busy but no Social Studio API is responding there. Stop that process or set API_PORT to a free port.`);
  }
}

const services = [
  { name: 'frontend', args: ['node_modules/react-scripts/scripts/start.js'], env: { PORT: String(frontendPort), HOST: '127.0.0.1', DANGEROUSLY_DISABLE_HOST_CHECK: 'true' } },
  ...(startBackend ? [{ name: 'backend', args: ['server/index.mjs'], env: { PORT: String(apiPort), APP_ORIGIN: `http://localhost:${frontendPort}` } }] : [])
];
const children = services.map(({ name, args, env }) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  child.on('exit', (code, signal) => {
    if (signal || code !== 0) {
      console.error(`${name} exited (${signal || code}); stopping the other service.`);
      stopAll();
    }
  });
  return child;
});
console.log(`Frontend will use http://localhost:${frontendPort}; API uses port ${process.env.PORT || 8787}.`);

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
