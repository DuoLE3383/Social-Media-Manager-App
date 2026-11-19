import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faVideo, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { promptTemplates } from '../data/promptTemplates';
import { supabase } from '../lib/supabase';
import { apiUrl } from '../lib/api';
import { getModelTier, setModelTier } from '../lib/modelTier';
import ModelTierToggle from './ModelTierToggle';
import { usePromptRunner } from '../hooks/usePromptRunner';

const HISTORY_KEY = 'socialMediaAiHistory';
const CATEGORIES = ['All', ...new Set(promptTemplates.map((item) => item.category))];

function readHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

// Small local models flip to English when given English instructions on a
// Vietnamese task — keep coaching instructions in the task's language.
const looksVietnamese = (text) => /[ăâêôơưđăâêôơưđàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(String(text || ''));

export default function PromptStudio({ user, embedded = false }) {
  const navigate = useNavigate();
  // Smart Prompt "Mở trong Prompt Studio" hands its prompt over via
  // sessionStorage — prefill the editor so the draft is one click away.
  const [selectedId, setSelectedId] = useState(promptTemplates[0].id);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [prompt, setPrompt] = useState(promptTemplates[0].prompt);
  const [brandVoice, setBrandVoice] = useState(localStorage.getItem('socialMediaBrandVoice') || '');
  const [mode, setMode] = useState('quick');
  const [tier, setTier] = useState(getModelTier);
  const [result, setResult] = useState('');
  const [resultMeta, setResultMeta] = useState(null);
  const [guidedQuestion, setGuidedQuestion] = useState('');
  const [guidedAnswer, setGuidedAnswer] = useState('');
  const [guidedAnswers, setGuidedAnswers] = useState([]);
  const [guidedStep, setGuidedStep] = useState(0);
  const [draftingGuided, setDraftingGuided] = useState(false);
  const [history, setHistory] = useState(readHistory);
  const [busy, setBusy] = useState(false);
  const [runningModel, setRunningModel] = useState('');
  const [notice, setNotice] = useState('');
  const [service, setService] = useState({ state: 'checking' });
  const [serviceRetrying, setServiceRetrying] = useState(false);
  const voiceSaveTimer = useRef(null);
  const runner = usePromptRunner();

  const checkService = useCallback((showSpinner = false) => {
    if (showSpinner) setServiceRetrying(true);
    fetch(apiUrl('/api/health')).then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => setService(response.ok ? { state: 'online', ...data } : { state: 'offline' }))
      .catch(() => setService({ state: 'offline' }))
      .finally(() => { if (showSpinner) setServiceRetrying(false); });
  }, []);

  useEffect(() => {
    checkService();
    // Prefill from the Smart Prompt handoff (opens with the crafted prompt).
    try {
      const raw = JSON.parse(sessionStorage.getItem('aiSocialQuickHandoff') || 'null');
      if (raw && typeof raw.prompt === 'string' && raw.prompt.trim()) {
        setPrompt(String(raw.prompt).slice(0, 4000));
        sessionStorage.removeItem('aiSocialQuickHandoff');
      }
    } catch { /* ignore */ }
    if (supabase && user?.id) {
      supabase.from('user_settings').select('brand_voice').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => { if (data) { setBrandVoice(data.brand_voice || ''); localStorage.setItem('socialMediaBrandVoice', data.brand_voice || ''); } });
      supabase.from('prompt_runs').select('id,prompt,output,provider,model,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
        .then(({ data }) => {
          if (!data?.length) return;
          const cloudRuns = data.map((item) => ({ id: item.id, template: 'Saved generation', prompt: item.prompt, text: item.output, provider: item.provider, model: item.model, createdAt: item.created_at }));
          const localRuns = readHistory();
          const merged = [...cloudRuns, ...localRuns].filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 30);
          setHistory(merged); localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
        });
    }
    return () => clearTimeout(voiceSaveTimer.current);
  }, [user?.id, checkService]);

  useEffect(() => {
    if (service.state === 'online' && !service.premiumModel && tier === 'premium') {
      setTier('default');
      setModelTier('default');
    }
  }, [service.state, service.premiumModel, tier]);

  const visibleTemplates = useMemo(() => promptTemplates.filter((item) =>
    (category === 'All' || item.category === category) && `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [category, query]);

  const chooseTemplate = (item) => {
    setSelectedId(item.id);
    setPrompt(item.prompt);
    setResult(''); setResultMeta(null);
    setNotice('');
    setGuidedQuestion(''); setGuidedAnswer(''); setGuidedAnswers([]); setGuidedStep(0);
  };

  const generateText = async (requestPrompt, system = '', selectedTier = tier) => {
    const startedAt = performance.now();
    const headers = { 'Content-Type': 'application/json' };
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    const data = await runner.run({ headers, body: { prompt: requestPrompt, system, tier: selectedTier } });
    return { ...data, durationMs: Math.round(performance.now() - startedAt) };
  };

  const saveGeneratedDraft = async (data, savedPrompt) => {
    const text = data.text || '(The model returned an empty response.)';
    const entry = { id: `${Date.now()}`, template: promptTemplates.find((item) => item.id === selectedId)?.title || 'Custom prompt', prompt: savedPrompt, text, provider: data.provider, model: data.model, tier: data.tier || tier, durationMs: data.durationMs, createdAt: data.createdAt || new Date().toISOString() };
    const next = [entry, ...readHistory()].slice(0, 30);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); setHistory(next); setResultMeta(entry);
    if (supabase && user?.id) {
      const { error: saveError } = await supabase.from('prompt_runs').insert({ user_id: user.id, provider: data.provider, model: data.model, prompt: savedPrompt, output: data.text || '' });
      if (saveError) setNotice('Draft generated, but cloud history could not be saved. Apply the Supabase migration and check your connection.');
    }
    return text;
  };

  const runPrompt = async () => {
    if (!prompt.trim()) return;
    setBusy(true); setNotice(''); setResult(''); setResultMeta(null); setRunningModel(tier === 'premium' ? service.premiumModel : service.model);
    try {
      const quickPrompt = looksVietnamese(prompt)
        ? `${prompt.trim()}\n\nViết bản nháp NGAY, không hỏi lại câu hỏi. Chi tiết chưa rõ [trong ngoặc] hãy tự điền giả định hợp lý dựa trên ngữ cảnh, giả định quan trọng thì ghi chú ngắn gọn.`
        : `${prompt.trim()}\n\nDraft immediately without asking follow-up questions. Fill unspecified bracketed details with sensible assumptions based on the available context. Keep assumptions conservative and briefly label any important assumption.`;
    const data = await generateText(quickPrompt, brandVoice ? `Brand voice and context: ${brandVoice}` : '', tier);
      setResult(await saveGeneratedDraft(data, quickPrompt));
    } catch (error) { setNotice(error.code === 'CANCELLED' ? 'Generation cancelled. You can run it again whenever you are ready.' : error.message); }
    finally { setBusy(false); setRunningModel(''); }
  };

  const askGuidedQuestion = async (answers, questionNumber) => {
    const knownAnswers = answers.length
      ? answers.map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`).join('\n')
      : (looksVietnamese(prompt) ? 'Chưa hỏi câu làm rõ nào.' : 'No clarifications have been collected yet.');
    const vi = looksVietnamese(prompt);
    const requestPrompt = vi
      ? `Nhiệm vụ nháp:\n${prompt}\n\nNgữ cảnh thương hiệu:\n${brandVoice || 'Chưa có.'}\n\nThông tin đã hỏi:\n${knownAnswers}\n\nHỏi câu làm rõ số ${questionNumber} trên 3. Chọn MỘT chi tiết chưa rõ hữu ích nhất (đối tượng, nền tảng, mục tiêu, ưu đãi hoặc ràng buộc). Chỉ hỏi đúng một câu ngắn bằng tiếng Việt. Không lặp lại câu hỏi, không thêm bình luận, chưa soạn nội dung.`
      : `Draft task:\n${prompt}\n\nBrand context:\n${brandVoice || 'Not provided.'}\n\nClarifications already collected:\n${knownAnswers}\n\nAsk clarification ${questionNumber} of 3. Choose the single most useful unanswered detail (such as audience, platform, goal, offer, or constraints). Ask exactly one short question in the same language as the task. Do not repeat a question, add commentary, or draft the content yet.`;
    const data = await generateText(requestPrompt, vi ? 'Bạn là người phỏng vấn lên kế hoạch nội dung, ngắn gọn. Chỉ trả về đúng một câu hỏi làm rõ bằng tiếng Việt.' : 'You are a concise content-planning interviewer. Return only one clear follow-up question.');
    return data.text?.trim();
  };

  const buildGuidedDraft = async (answers) => {
    const answerText = answers.length
      ? answers.map((item, index) => `${index + 1}. ${item.question}\n   Answer: ${item.answer}`).join('\n')
      : (looksVietnamese(prompt) ? 'Không có câu trả lời thêm. Hãy dùng giả định hợp lý cho phần còn thiếu.' : 'No extra answers. Use reasonable assumptions for missing details.');
    const finalPrompt = looksVietnamese(prompt)
      ? `${prompt.trim()}\n\nNgười dùng chọn chế độ hướng dẫn và cung cấp các thông tin:\n${answerText}\n\nGiờ hãy viết bản nháp hoàn chỉnh theo yêu cầu. Không hỏi thêm câu nào. Chi tiết nhỏ còn thiếu, dùng giả định hợp lý.`
      : `${prompt.trim()}\n\nThe user chose guided mode and provided these clarifications:\n${answerText}\n\nNow produce the finished requested draft. Do not ask any more questions. If a minor detail remains unknown, use a conservative assumption.`;
    setDraftingGuided(true);
    setRunningModel(tier === 'premium' ? service.premiumModel : service.model);
    try {
    const data = await generateText(finalPrompt, brandVoice ? `Brand voice and context: ${brandVoice}` : '', tier);
      setResult(await saveGeneratedDraft(data, finalPrompt));
      setGuidedQuestion('');
      setGuidedStep(4);
    } finally { setDraftingGuided(false); setRunningModel(''); }
  };

  const startGuided = async () => {
    if (!prompt.trim()) return;
    setBusy(true); setNotice(''); setResult(''); setResultMeta(null); setGuidedAnswers([]); setGuidedAnswer(''); setGuidedQuestion(''); setGuidedStep(0);
    try {
      const question = await askGuidedQuestion([], 1);
      if (!question) throw new Error('The AI did not return a question. Please try again.');
      setGuidedQuestion(question); setGuidedStep(1);
    } catch (error) { setNotice(error.code === 'CANCELLED' ? 'Generation cancelled. You can run it again whenever you are ready.' : error.message); }
    finally { setBusy(false); }
  };

  const continueGuided = async (event) => {
    event.preventDefault();
    if (!guidedAnswer.trim()) return;
    const nextAnswers = [...guidedAnswers, { question: guidedQuestion, answer: guidedAnswer.trim() }];
    setBusy(true); setNotice(''); setResult('');
    try {
      if (nextAnswers.length >= 3) {
        await buildGuidedDraft(nextAnswers);
      } else {
        const question = await askGuidedQuestion(nextAnswers, nextAnswers.length + 1);
        if (!question) throw new Error('The AI did not return a follow-up question. Please try again.');
        setGuidedAnswers(nextAnswers); setGuidedAnswer(''); setGuidedQuestion(question); setGuidedStep(nextAnswers.length + 1);
      }
    } catch (error) { setNotice(error.code === 'CANCELLED' ? 'Generation cancelled. You can run it again whenever you are ready.' : error.message); }
    finally { setBusy(false); }
  };

  const skipGuided = async () => {
    setBusy(true); setNotice(''); setResult('');
    const answers = guidedAnswer.trim() && guidedQuestion
      ? [...guidedAnswers, { question: guidedQuestion, answer: guidedAnswer.trim() }]
      : guidedAnswers;
    try { await buildGuidedDraft(answers); }
    catch (error) { setNotice(error.code === 'CANCELLED' ? 'Generation cancelled. You can run it again whenever you are ready.' : error.message); }
    finally { setBusy(false); }
  };

  const selectMode = (nextMode) => {
    setMode(nextMode); setResult(''); setResultMeta(null); setNotice(''); setGuidedQuestion(''); setGuidedAnswer(''); setGuidedAnswers([]); setGuidedStep(0);
  };

  // Wizard handoffs from the quick tab: the finished draft feeds the media
  // chain — images (step 3) and video (step 4) — exactly like the Agent
  // Builder done-step, so no dead end after a quick generation.
  const sendResultToImage = () => {
    try {
      sessionStorage.setItem('aiSocialImageHandoff', JSON.stringify({
        prompt: prompt.trim().slice(0, 800),
        idea: '',
        account: '',
        content: String(result || '').slice(0, 1200),
        ts: Date.now(),
      }));
    } catch { /* ignore */ }
    navigate('/create-image');
  };
  const sendResultToVideo = () => {
    try {
      sessionStorage.setItem('aiSocialVideoHandoff', JSON.stringify({
        idea: prompt.trim().slice(0, 300) || String(result || '').slice(0, 300),
        account: '',
        ts: Date.now(),
      }));
    } catch { /* ignore */ }
    navigate('/ai-library');
  };

  const saveVoice = (value) => {
    setBrandVoice(value); localStorage.setItem('socialMediaBrandVoice', value);
    if (supabase && user?.id) {
      clearTimeout(voiceSaveTimer.current);
      voiceSaveTimer.current = setTimeout(() => {
        supabase.from('user_settings').upsert({ user_id: user.id, brand_voice: value, updated_at: new Date().toISOString() })
          .then(({ error }) => { if (error) setNotice('Could not sync brand voice to Supabase. Your local copy is still saved.'); });
      }, 500);
    }
  };

  return (
    <main className={embedded ? 'studio-shell studio-embedded' : 'studio-shell'}>
      {!embedded && <header className="studio-header">
        <div><span className="eyebrow">SOCIAL MEDIA WORKSPACE</span><h1>Prompt Studio</h1><p>Plan, create, and refine content with 15 reusable workflows.</p></div>
        <div className={`service-pill ${service.state}`}><span className="status-dot" />{service.state === 'online' ? `${service.provider} · ${service.model}` : service.state === 'checking' ? 'Đang kiểm tra AI…' : 'AI offline'}</div>
      </header>}
      {service.state === 'offline' && <div className="studio-alert service-offline-alert">
        <strong>Máy chủ AI chưa kết nối được.</strong> Các tính năng tạo nội dung (Prompt Studio) cần API server. Trên server hãy chạy:
        <code>pm2 start ecosystem.config.cjs --update-env</code> hoặc <code>npm run server</code>, và đảm bảo Ollama đang chạy (<code>ollama serve</code>).
        Nếu dùng nginx, xem cấu hình mẫu <code>deploy/nginx.conf.example</code>.
        <button className="btn btn-sm btn-outline-secondary service-retry-btn" type="button" onClick={() => checkService(true)} disabled={serviceRetrying}>
          {serviceRetrying ? <><span className="spinner-border spinner-border-sm me-2" />Đang kiểm tra…</> : 'Kiểm tra lại kết nối'}
        </button>
      </div>}
      {service.state === 'online' && ['openai', 'anthropic'].includes(service.provider) && !service.keyConfigured && <div className="studio-alert">API đang chạy nhưng chưa cấu hình API key của nhà cung cấp cloud. Thêm key vào môi trường server rồi khởi động lại.</div>}

      <div className="studio-layout">
        <aside className="template-panel">
          <div className="panel-heading"><div><span className="eyebrow">LIBRARY</span><h2>Workflows</h2></div><span className="template-count">15</span></div>
          <input className="form-control studio-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows" aria-label="Search workflows" />
          <div className="category-scroll">{CATEGORIES.map((item) => <button key={item} className={`category-chip ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <div className="template-list">{visibleTemplates.map((item) => <button key={item.id} className={`template-item ${selectedId === item.id ? 'selected' : ''}`} onClick={() => chooseTemplate(item)}><span className="template-category">{item.category}</span><strong>{item.title}</strong><small>{item.description}</small></button>)}{!visibleTemplates.length && <p className="empty-state">No workflows match that search.</p>}</div>
          <div className="history-panel"><div className="panel-heading"><h3>Recent runs</h3><span>{history.length}</span></div>{history.slice(0, 4).map((item) => <button key={item.id} className="history-item" onClick={() => { setResult(item.text); setResultMeta(item); }}><span>{item.template}</span><small>{new Date(item.createdAt).toLocaleString()}</small></button>)}{history.length === 0 && <p className="muted-small">Your generated drafts will appear here.</p>}</div>
        </aside>

        <section className="workbench">
          <div className="workbench-top"><div><span className="eyebrow">{promptTemplates.find((item) => item.id === selectedId)?.category || 'CUSTOM'}</span><h2>{promptTemplates.find((item) => item.id === selectedId)?.title || 'Prompt'}</h2><p>{promptTemplates.find((item) => item.id === selectedId)?.description || 'Edit your prompt and generate a draft.'}</p></div><span className="draft-label">DRAFT</span></div>
          <fieldset className="mode-selector" disabled={busy}>
            <legend>Choose how to draft</legend>
            <label className={`mode-option ${mode === 'quick' ? 'active' : ''}`}><input type="radio" name="draft-mode" value="quick" checked={mode === 'quick'} onChange={() => selectMode('quick')} /><span><strong>Quick draft</strong><small>AI tự giả định, ra draft ngay</small></span></label>
            <label className={`mode-option ${mode === 'guided' ? 'active' : ''}`}><input type="radio" name="draft-mode" value="guided" checked={mode === 'guided'} onChange={() => selectMode('guided')} /><span><strong>Guided mode</strong><small>AI hỏi từng bước, chính xác hơn</small></span></label>
          </fieldset>
          <label className="form-label" htmlFor="brand-voice">Brand voice & context <span>saved in this browser</span></label>
          <textarea id="brand-voice" className="form-control context-input" rows="2" value={brandVoice} onChange={(event) => saveVoice(event.target.value)} placeholder="e.g. Friendly, practical, no hype. We help independent cafes plan social content." />
          <label className="form-label prompt-label" htmlFor="prompt-editor">Prompt <span>Fill in [bracketed] details before running</span></label>
          <textarea id="prompt-editor" className="form-control prompt-editor" value={prompt} onChange={(event) => setPrompt(event.target.value)} spellCheck="false" disabled={mode === 'guided' && guidedStep > 0 && guidedStep < 4} />
          <div className="prompt-studio-toolbar">
            <div className="tier-control"><ModelTierToggle value={tier} onChange={setTier} disabled={busy || service.state !== 'online'} defaultModel={service.model} premiumModel={service.premiumModel} />{tier === 'premium' && <p className="tier-hint">Higher quality model; generation can take longer on your computer.</p>}</div>
            <div className="run-row"><span className="muted-small">{mode === 'quick' ? `${prompt.length.toLocaleString()} characters · AI fills missing details` : 'Guided mode asks up to 3 short questions · saved runs stay on this device'}</span>{mode === 'quick' && (busy ? <button className="btn btn-outline-danger run-button" onClick={runner.cancel} type="button"><span className="spinner-border spinner-border-sm me-2" />{runningModel || 'AI'} · {runner.elapsed}s · Cancel</button> : <button className="btn btn-primary run-button" onClick={runPrompt} disabled={!prompt.trim() || service.state !== 'online'}>Generate draft</button>)}</div>
          </div>
          {busy && <div className="generation-progress" aria-live="polite"><div className="generation-progress__top"><span>{runner.status === 'preflight' ? 'Checking the model and preparing your request…' : `Still working with ${runningModel || 'the AI model'}…`}</span><strong>{runner.elapsed}s</strong></div><div className="generation-progress__track"><div className="generation-progress__fill" style={{ width: `${Math.min((runner.elapsed / (tier === 'premium' ? 300 : 90)) * 100, 95)}%` }} /></div><small>{runner.elapsed < 15 ? 'Warming up the model can take a moment.' : `Request is active · last UI heartbeat ${runner.lastHeartbeat ? new Date(runner.lastHeartbeat).toLocaleTimeString() : 'just now'}`}</small></div>}
          {mode === 'guided' && <section className="guided-panel" aria-live="polite">
            <div className="guided-panel-heading"><strong>{guidedStep > 0 && guidedStep < 4 ? `Question ${guidedStep} of 3` : guidedStep === 4 ? 'Guided draft complete' : 'A few details make the draft more specific'}</strong><span>{guidedStep === 4 ? 'Review the draft below.' : 'You can skip ahead whenever you have enough context.'}</span></div>
            {guidedStep === 0 && <button className="btn btn-primary" onClick={startGuided} disabled={busy || !prompt.trim() || service.state !== 'online'}>{busy ? <><span className="spinner-border spinner-border-sm me-2" />Preparing a question…</> : 'Start guided mode'}</button>}
            {guidedAnswers.map((item, index) => <div className="guided-answer-history" key={`${index}-${item.question}`}><strong>Q{index + 1}: {item.question}</strong><span>{item.answer}</span></div>)}
            {guidedQuestion && <form onSubmit={continueGuided}>
              <p className="guided-question">{guidedQuestion}</p>
              <label className="form-label" htmlFor="guided-answer">Your answer</label>
              <textarea id="guided-answer" className="form-control" rows="2" value={guidedAnswer} onChange={(event) => setGuidedAnswer(event.target.value)} placeholder="Add the detail that matters for this draft." disabled={busy} />
              <div className="guided-actions">{busy ? <button className="btn btn-outline-danger" type="button" onClick={runner.cancel}>Cancel · {runner.elapsed}s</button> : <><button className="btn btn-primary" type="submit" disabled={!guidedAnswer.trim() || service.state !== 'online'}>{guidedStep === 3 ? 'Create my draft' : 'Answer and continue'}</button><button className="btn btn-outline-secondary" type="button" onClick={skipGuided} disabled={service.state !== 'online'}>Skip and draft now</button></>}</div>
            </form>}
            {guidedStep === 4 && <button className="btn btn-outline-secondary" type="button" onClick={() => { setGuidedQuestion(''); setGuidedAnswer(''); setGuidedAnswers([]); setGuidedStep(0); setResult(''); setResultMeta(null); }}>Start guided mode again</button>}
            {busy && draftingGuided && <p className="guided-progress">Preparing your finished draft…</p>}
          </section>}
          {notice && <div className="alert alert-danger mt-3" role="alert">{notice}</div>}
          {(result || (busy && (mode === 'quick' || draftingGuided))) && <section className="result-card"><div className="result-heading"><div><span className="eyebrow">AI OUTPUT</span><h3>{mode === 'guided' ? 'Guided draft' : 'Draft'}</h3></div>{result && <button className="btn btn-sm btn-outline-secondary" onClick={() => navigator.clipboard?.writeText(result).then(() => setNotice('Copied to clipboard.'))}>Copy</button>}</div>{resultMeta && <div className="output-meta"><span className="chip">{resultMeta.model || 'Model unavailable'}</span><span className="chip">{resultMeta.tier === 'premium' ? 'Chất lượng' : 'Nhanh'}</span>{Number.isFinite(resultMeta.durationMs) && <span className="chip">{(resultMeta.durationMs / 1000).toFixed(1)}s</span>}{resultMeta.fallbackFrom && <span className="chip" title={resultMeta.fallbackReason}>Fallback from {resultMeta.fallbackFrom}</span>}</div>}{busy && !result ? <div className="result-loading"><span className="spinner-border spinner-border-sm me-2" />{draftingGuided ? `Finishing with ${runningModel || 'AI'}…` : `Working with ${runningModel || 'AI'}…`}</div> : <pre className="result-text">{result}</pre>}{!busy && result && <div className="ps-next-media">
              <div className="ps-next-media-btns">
                <button type="button" className="btn btn-primary ps-media-btn" onClick={sendResultToImage} title="Đưa nội dung này sang Tạo Ảnh (bước 3)">
                  <FontAwesomeIcon icon={faImage} /> Tạo ảnh minh họa — bước 3 →
                </button>
                <button type="button" className="btn btn-outline-secondary ps-media-btn" onClick={sendResultToVideo} title="Đưa ý tưởng sang Thư viện AI để ghép video (bước 4)">
                  <FontAwesomeIcon icon={faVideo} /> Tạo video — bước 4 →
                </button>
              </div>
              <p className="ps-chain-hint"><FontAwesomeIcon icon={faArrowRight} /> Trình tự: tạo ảnh (b3) → ghép video (b4) → Lịch đăng.</p>
            </div>}</section>}
        </section>
      </div>
      {!embedded && <footer className="studio-footer">Signed in as {user?.email || user?.name || 'demo user'} <span>·</span> {supabase ? 'Brand voice and prompt run history sync to your Supabase account.' : 'Draft history and brand context are stored in this browser.'}</footer>}
    </main>
  );
}
