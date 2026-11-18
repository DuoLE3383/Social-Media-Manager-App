// scripts/kill-ports.mjs
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PORTS = [8787, 3000, 3001];

async function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.split('\n').filter((l) => l.includes('LISTENING'));
      const pids = new Set(
        lines
          .map((l) => l.trim().split(/\s+/).pop())
          .filter((pid) => pid && /^\d+$/.test(pid))
      );
      for (const pid of pids) {
        await execAsync(`taskkill /PID ${pid} /F`).catch(() => {});
        console.log(`✅ Killed PID ${pid} on port ${port}`);
      }
    } else {
      await execAsync(`lsof -ti:${port} | xargs kill -9`).catch(() => {});
      console.log(`✅ Freed port ${port}`);
    }
  } catch {
    // Port trống, không cần làm gì
  }
}

for (const port of PORTS) await killPort(port);
console.log('🧹 Port cleanup done.\n');