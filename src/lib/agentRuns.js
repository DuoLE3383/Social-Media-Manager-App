// Last agent-run transcripts, keyed by agent id. The "Tiến hoá Agent" (evolve)
// panel reads these so the AI can analyse the agent's REAL outputs — its most
// recent run — without the user having to copy/paste anything.
const RUNS_KEY = 'aiSocialAgentRuns';
const MAX_RUNS = 40;

export function readAgentRuns() {
  try {
    const raw = JSON.parse(localStorage.getItem(RUNS_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}

export function readAgentRun(agentId) {
  if (!agentId) return null;
  const runs = readAgentRuns();
  const run = runs[agentId];
  return run && typeof run.transcript === 'string' ? run : null;
}

export function saveAgentRun(agentId, run) {
  if (!agentId || !run) return;
  try {
    const runs = readAgentRuns();
    runs[agentId] = { ...run, ts: Date.now() };
    // Keep storage bounded: drop the oldest entries beyond MAX_RUNS.
    const ids = Object.keys(runs)
      .sort((a, b) => (runs[b]?.ts || 0) - (runs[a]?.ts || 0));
    const trimmed = {};
    for (const id of ids.slice(0, MAX_RUNS)) trimmed[id] = runs[id];
    localStorage.setItem(RUNS_KEY, JSON.stringify(trimmed));
  } catch { /* private mode / quota — ignore */ }
}
