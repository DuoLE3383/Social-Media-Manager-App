import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDna,
  faPlay,
  faCheck,
  faClockRotateLeft,
  faTriangleExclamation,
  faWandMagicSparkles,
  faBan,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { apiUrl } from '../lib/api';
import { readAgentRun } from '../lib/agentRuns';

// "Tiến hoá Agent" — the agent self-improvement loop. The AI analyses the
// agent's REAL results (its latest run transcript, and/or pasted post
// performance data like views/likes/comments), finds weaknesses and returns an
// improved version of the agent plus a list of concrete changes. Applying the
// result is up to the user (onApply), so nothing is overwritten silently.
const LANG_STRINGS = {
  vi: {
    title: 'Tiến hoá Agent',
    intro: 'AI phân tích kết quả thực tế (kết quả chạy agent hoặc số liệu bài đăng) rồi nâng cấp chính agent: viết lại prompt, thêm/bỏ bước, khắc phục điểm yếu.',
    pickLabel: 'Agent cần tiến hoá',
    resultsLabel: 'Kết quả thực tế để phân tích',
    resultsPh: 'Dán kết quả chạy agent gần nhất, hoặc số liệu bài đăng thực tế…\nVí dụ:\nBài 1: 1.2K views, 45 likes, 3 shares — nhiều người dừng 2 giây rồi lướt qua\nBài 2: 320 views, 8 likes — hook yếu, caption dài\n…hoặc để trống để AI cải thiện theo kinh nghiệm chung.',
    useLastRun: 'Dùng kết quả chạy gần nhất',
    noLastRun: 'Agent này chưa có kết quả chạy nào lưu trên máy này — hãy chạy agent ở tab Agent Builder trước, hoặc dán số liệu bài đăng vào ô trên.',
    lastRunInfo: 'Kết quả chạy gần nhất',
    analyze: 'Phân tích & tiến hoá',
    analyzing: 'Đang phân tích…',
    guestNote: 'Khách dùng thử vẫn chạy được — AI giới hạn số lần mỗi phút.',
    resultTitle: 'Phiên bản đã tiến hoá',
    improvementsTitle: 'AI sẽ cải thiện:',
    stepsTitle: 'Kịch bản mới',
    summaryTitle: 'Vì sao bản mới tốt hơn:',
    apply: 'Áp dụng vào agent',
    discard: 'Bỏ qua',
    retry: 'Phân tích lại',
    needAgent: 'Chọn một agent để tiến hoá.',
    runFailed: 'Không tiến hoá được agent.',
    parseWarn: 'Model trả về không đúng định dạng JSON — phản hồi gốc hiển thị bên dưới để bạn tham khảo.',
    keepVars: 'Mọi prompt vẫn dùng biến {{input}} / {{prev}} như bản gốc.',
  },
  en: {
    title: 'Evolve Agent',
    intro: 'The AI analyses real results (the latest agent run or post performance data) and upgrades the agent itself: rewritten prompts, steps added/removed, weaknesses fixed.',
    pickLabel: 'Agent to evolve',
    resultsLabel: 'Real results to analyse',
    resultsPh: 'Paste the latest agent run output, or real post metrics…\nExample:\nPost 1: 1.2K views, 45 likes, 3 shares — people stop for 2s then scroll on\nPost 2: 320 views, 8 likes — weak hook, caption too long\n…or leave empty to let the AI improve from best practices.',
    useLastRun: 'Use the latest run',
    noLastRun: 'This agent has no stored run on this device — run it in the Agent Builder tab first, or paste post metrics above.',
    lastRunInfo: 'Latest run',
    analyze: 'Analyse & evolve',
    analyzing: 'Analysing…',
    guestNote: 'Guests can try it too — AI usage is capped per minute.',
    resultTitle: 'Evolved version',
    improvementsTitle: 'The AI will improve:',
    stepsTitle: 'New pipeline',
    summaryTitle: 'Why this version is better:',
    apply: 'Apply to agent',
    discard: 'Discard',
    retry: 'Re-analyse',
    needAgent: 'Pick an agent to evolve.',
    runFailed: 'Could not evolve this agent.',
    parseWarn: 'The model did not return valid JSON — its raw response is shown below for reference.',
    keepVars: 'Every prompt still uses the {{input}} / {{prev}} variables like the original.',
  },
};

const AgentEvolve = ({ agents, account, idea, onApply }) => {
  const [lang] = useLang();
  const T = LANG_STRINGS[lang] || LANG_STRINGS.vi;
  // Reports hands its analysed post metrics over via sessionStorage
  // (aiSocialEvolveHandoff): prefill the results box (and pick the agent if
  // given) so "Tiến hoá Agent từ kết quả đăng bài" is one click away.
  // S4: consume once on mount — otherwise the same metrics would re-prefill
  // the box on every later visit to the Evolve tab.
  const handoff = useMemo(() => {
    try {
      const raw = JSON.parse(sessionStorage.getItem('aiSocialEvolveHandoff') || 'null');
      if (raw && (typeof raw.results === 'string' || typeof raw.agentId === 'string')) {
        try { sessionStorage.removeItem('aiSocialEvolveHandoff'); } catch { /* ignore */ }
        return raw;
      }
      return null;
    } catch { return null; }
  }, []);
  const [selectedId, setSelectedId] = useState(handoff?.agentId && agents.some((a) => a.id === handoff.agentId) ? handoff.agentId : (agents[0]?.id || ''));
  const [results, setResults] = useState(typeof handoff?.results === 'string' ? handoff.results.slice(0, 8000) : '');
  const [phase, setPhase] = useState('idle'); // idle | running | done
  const [result, setResult] = useState(null); // { ok, agent?, improvements?, summary?, raw?, message? }
  const [error, setError] = useState('');
  const [lastRunTs, setLastRunTs] = useState(null);

  const selected = useMemo(() => agents.find((a) => a.id === selectedId) || agents[0], [agents, selectedId]);

  // Once the prefilled metrics land, note the run badge state for the button row.
  useEffect(() => {
    if (selectedId) setLastRunTs(readAgentRun(selectedId)?.ts || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const pickAgent = (id) => {
    setSelectedId(id);
    setResult(null);
    setError('');
    setPhase('idle');
    const run = readAgentRun(id);
    setLastRunTs(run?.ts || null);
  };

  const fillLastRun = () => {
    const run = readAgentRun(selectedId);
    if (!run) return;
    const header = lang === 'vi' ? `— Kết quả chạy gần nhất (${new Date(run.ts).toLocaleString('vi-VN')}) —\nĐề bài: ${run.input || '(không lưu)'}\n\n` : `— Latest run (${new Date(run.ts).toLocaleString('en-GB')}) —\nTask: ${run.input || '(not saved)'}\n\n`;
    setResults(`${header}${run.transcript || ''}`.slice(0, 8000));
  };

  const authHeaders = async () => {
    const headers = { 'Content-Type': 'application/json' };
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    return headers;
  };

  const analyze = async () => {
    if (!selected) { setError(T.needAgent); return; }
    setError('');
    setResult(null);
    setPhase('running');
    try {
      const response = await fetch(apiUrl('/api/agent/evolve'), {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          agent: {
            name: selected.name,
            desc: selected.desc || '',
            language: selected.language || 'vi',
            account: account || '',
            idea: idea || '',
            steps: (selected.steps || []).map((s) => ({ title: s.title || '', prompt: s.prompt || '' })),
          },
          results: results.trim(),
          language: lang,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
      setResult(data);
      setPhase('done');
    } catch (e) {
      setError(e.message || T.runFailed);
      setPhase('idle');
    }
  };

  const evolved = result?.ok ? result.agent : null;

  return (
    <div className="as-wiz-card ae-card">
      <div className="ae-head">
        <span className="ae-head-icon"><FontAwesomeIcon icon={faDna} /></span>
        <div>
          <h3 className="ae-title">{T.title}</h3>
          <p className="ae-intro">{T.intro}</p>
        </div>
      </div>

      <label className="ae-label">{T.pickLabel}</label>
      <select className="ae-select" value={selected?.id || ''} onChange={(e) => pickAgent(e.target.value)}>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{`${a.emoji || '🤖'} ${a.name}${a.builtin ? (lang === 'vi' ? ' (mẫu)' : ' (preset)') : ''}`}</option>
        ))}
      </select>

      <label className="ae-label">{T.resultsLabel}</label>
      <textarea className="ae-results" rows="6" value={results} onChange={(e) => setResults(e.target.value)} placeholder={T.resultsPh} />
      <div className="ae-results-tools">
        <button type="button" className="as-ghost-btn" onClick={fillLastRun} disabled={!lastRunTs && !readAgentRun(selectedId)}>
          <FontAwesomeIcon icon={faClockRotateLeft} /> {T.useLastRun}
        </button>
        <span className="ae-run-note">
          {readAgentRun(selectedId)
            ? `${T.lastRunInfo}: ${new Date(readAgentRun(selectedId).ts).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB')}`
            : T.noLastRun}
        </span>
      </div>

      <div className="ae-actions">
        <button type="button" className="as-run-btn" onClick={analyze} disabled={phase === 'running'}>
          {phase === 'running'
            ? <><span className="spinner-border spinner-border-sm me-2" />{T.analyzing}</>
            : <><FontAwesomeIcon icon={faDna} /> {T.analyze}</>}
        </button>
        <span className="ae-guest-note"><FontAwesomeIcon icon={faWandMagicSparkles} /> {T.guestNote}</span>
      </div>

      {error && (
        <div className="ae-error"><FontAwesomeIcon icon={faTriangleExclamation} /> {error}</div>
      )}

      {phase === 'done' && evolved && (
        <div className="ae-result">
          <div className="ae-result-head">
            <span className="ae-result-badge"><FontAwesomeIcon icon={faCheck} /> {T.resultTitle}</span>
            {evolved.name && <strong className="ae-result-name">{evolved.name}</strong>}
          </div>
          {evolved.desc && <p className="ae-result-desc">{evolved.desc}</p>}
          {(result.improvements?.length || evolved.improvements?.length) ? (
            <>
              <p className="ae-sub">{T.improvementsTitle}</p>
              <ul className="ae-improvements">
                {(evolved.improvements || result.improvements || []).map((item, i) => (
                  <li key={i}><FontAwesomeIcon icon={faCheck} /> {item}</li>
                ))}
              </ul>
            </>
          ) : null}
          {result.summary && (
            <>
              <p className="ae-sub">{T.summaryTitle}</p>
              <p className="ae-summary">{result.summary}</p>
            </>
          )}
          <p className="ae-sub">{T.stepsTitle} ({evolved.steps.length}) <small className="ae-vars-note">{T.keepVars}</small></p>
          <div className="ae-steps">
            {evolved.steps.map((s, i) => (
              <div className="ae-step" key={i}>
                <span className="ae-step-no">{i + 1}</span>
                <div className="ae-step-body">
                  <strong>{s.title}</strong>
                  <pre>{s.prompt}</pre>
                </div>
              </div>
            ))}
          </div>
          <div className="ae-result-actions">
            <button type="button" className="as-primary-btn" onClick={() => onApply({ source: selected, evolved: { ...evolved, improvements: evolved.improvements || [], summary: result.summary || '' } })}>
              <FontAwesomeIcon icon={faCheck} /> {T.apply}
            </button>
            <button type="button" className="as-ghost-btn" onClick={() => { setResult(null); setPhase('idle'); }}>
              <FontAwesomeIcon icon={faBan} /> {T.discard}
            </button>
            <button type="button" className="as-ghost-btn" onClick={analyze} disabled={phase === 'running'}>
              <FontAwesomeIcon icon={faPlay} /> {T.retry}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && result && !result.ok && (
        <div className="ae-result ae-result-warn">
          <div className="ae-parse-warn"><FontAwesomeIcon icon={faTriangleExclamation} /> {result.message || T.parseWarn}</div>
          <pre className="ae-raw">{result.raw}</pre>
          <div className="ae-result-actions">
            <button type="button" className="as-ghost-btn" onClick={analyze}><FontAwesomeIcon icon={faPlay} /> {T.retry}</button>
            <button type="button" className="as-ghost-btn" onClick={() => { setResult(null); setPhase('idle'); }}><FontAwesomeIcon icon={faBan} /> {T.discard}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentEvolve;
