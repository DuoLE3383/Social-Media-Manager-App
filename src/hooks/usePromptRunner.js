import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/api';

const HEARTBEAT_MS = 15_000;

// Friendly, actionable Vietnamese messages for common HTTP failure modes.
const FRIENDLY_STATUS = {
  400: 'Yêu cầu không hợp lệ (400). Hãy kiểm tra lại nội dung và thử lại.',
  401: 'Phiên đăng nhập đã hết hạn (401). Vui lòng đăng nhập lại.',
  403: 'Không có quyền thực hiện (403). Kiểm tra cấu hình Supabase trên server.',
  404: 'Không tìm thấy API (404). Có thể server chưa được cập nhật bản mới.',
  413: 'Nội dung quá dài (413). Hãy rút gọn prompt và thử lại.',
  429: 'Đã đạt giới hạn tốc độ (429). Chờ một phút rồi thử lại.',
  500: 'Lỗi máy chủ (500). Xem log API: pm2 logs ai-social-api',
  502: 'Máy chủ API không phản hồi (502 Bad Gateway). API server chưa chạy hoặc đã dừng. Trên server hãy chạy: pm2 start ecosystem.config.cjs --update-env  ·  xem log: pm2 logs ai-social-api',
  503: 'Dịch vụ AI chưa sẵn sàng (503). Kiểm tra Ollama đang chạy (ollama serve) và model đã tải (ollama list).',
  504: 'Hết thời gian chờ (504). Model AI trả lời quá lâu — thử model nhanh hơn hoặc rút gọn prompt. Nếu dùng nginx, tăng proxy_read_timeout (xem deploy/nginx.conf.example).',
};

function friendlyError(status, serverMessage) {
  if (serverMessage && serverMessage.length > 0) return serverMessage;
  return FRIENDLY_STATUS[status] || `Yêu cầu thất bại (${status}).`;
}

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
      let response;
      try {
        response = await fetch(apiUrl(url), { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      } catch (networkError) {
        if (controller.signal.aborted || networkError.name === 'AbortError') throw networkError;
        throw Object.assign(new Error('Không thể kết nối tới máy chủ API. API server chưa chạy — trên server hãy chạy: pm2 start ecosystem.config.cjs (hoặc npm run server).'), { code: 'NETWORK' });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(friendlyError(response.status, data.message || data.error)), { status: response.status });
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
