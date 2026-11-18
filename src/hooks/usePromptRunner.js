import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/api';

const HEARTBEAT_MS = 15_000;

export function usePromptRunner() {
  const [status, setStatus] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const controllerRef = useRef(null);
  const startedAtRef = useRef(0);
  const elapsedTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);

  const clearTimers = useCallback(() => {
    clearInterval(elapsedTimerRef.current);
    clearInterval(heartbeatTimerRef.current);
    elapsedTimerRef.current = null;
    heartbeatTimerRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    if (!controllerRef.current) return;
    controllerRef.current.abort();
    controllerRef.current = null;
    clearTimers();
    setStatus('cancelled');
  }, [clearTimers]);

  const run = useCallback(async ({ url = '/api/prompts/run', headers, body }) => {
    if (controllerRef.current) throw new Error('A generation request is already running.');
    const controller = new AbortController();
    controllerRef.current = controller;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setLastHeartbeat(new Date().toISOString());
    setStatus('preflight');
    elapsedTimerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    heartbeatTimerRef.current = setInterval(() => setLastHeartbeat(new Date().toISOString()), HEARTBEAT_MS);
    try {
      setStatus('running');
      const response = await fetch(apiUrl(url), { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status}).`);
      setStatus('done');
      return data;
    } catch (error) {
      if (controller.signal.aborted || error.name === 'AbortError') {
        setStatus('cancelled');
        throw Object.assign(new Error('Generation cancelled.'), { code: 'CANCELLED' });
      }
      setStatus('error');
      throw error;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      clearTimers();
    }
  }, [clearTimers]);

  useEffect(() => () => {
    controllerRef.current?.abort();
    clearTimers();
  }, [clearTimers]);

  return { run, cancel, status, elapsed, lastHeartbeat, isRunning: status === 'preflight' || status === 'running' };
}
