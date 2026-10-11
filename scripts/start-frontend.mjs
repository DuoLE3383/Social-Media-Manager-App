import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

function isAvailable(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

let port = Number(process.env.FRONTEND_PORT || 3000);
while (port < 3100 && !(await isAvailable(port))) port += 1;
if (port >= 3100) throw new Error('No available frontend port found between 3000 and 3099.');

console.log(`Starting React on http://localhost:${port}`);
const child = spawn(process.execPath, ['node_modules/react-scripts/scripts/start.js'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DANGEROUSLY_DISABLE_HOST_CHECK: 'true' }
});

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!stopping) { stopping = true; child.kill(signal); }
  });
}
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
