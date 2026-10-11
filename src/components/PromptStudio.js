import React, { useEffect, useMemo, useRef, useState } from 'react';
import { promptTemplates } from '../data/promptTemplates';
import { supabase } from '../lib/supabase';

const HISTORY_KEY = 'socialMediaAiHistory';
const CATEGORIES = ['All', ...new Set(promptTemplates.map((item) => item.category))];

function readHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

export default function PromptStudio({ user }) {
  const [selectedId, setSelectedId] = useState(promptTemplates[0].id);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [prompt, setPrompt] = useState(promptTemplates[0].prompt);
  const [brandVoice, setBrandVoice] = useState(localStorage.getItem('socialMediaBrandVoice') || '');
  const [result, setResult] = useState('');
  const [history, setHistory] = useState(readHistory);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [service, setService] = useState({ state: 'checking' });
  const voiceSaveTimer = useRef(null);

  useEffect(() => {
    fetch('/api/health').then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => setService(response.ok ? { state: 'online', ...data } : { state: 'offline' }))
      .catch(() => setService({ state: 'offline' }));
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
  }, [user?.id]);

  const visibleTemplates = useMemo(() => promptTemplates.filter((item) =>
    (category === 'All' || item.category === category) && `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [category, query]);

  const chooseTemplate = (item) => {
    setSelectedId(item.id);
    setPrompt(item.prompt);
    setResult('');
    setNotice('');
  };

  const runPrompt = async () => {
    if (!prompt.trim()) return;
    setBusy(true); setNotice(''); setResult('');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch('/api/prompts/run', {
        method: 'POST', headers,
        body: JSON.stringify({ prompt, system: brandVoice ? `Brand voice and context: ${brandVoice}` : '' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Generation failed.');
      setResult(data.text || '(The model returned an empty response.)');
      const entry = { id: `${Date.now()}`, template: promptTemplates.find((item) => item.id === selectedId)?.title || 'Custom prompt', prompt, text: data.text || '', provider: data.provider, model: data.model, createdAt: data.createdAt };
      const next = [entry, ...readHistory()].slice(0, 30);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); setHistory(next);
      if (supabase && user?.id) {
        const { error: saveError } = await supabase.from('prompt_runs').insert({ user_id: user.id, provider: data.provider, model: data.model, prompt, output: data.text || '' });
        if (saveError) setNotice('Draft generated, but cloud history could not be saved. Apply the Supabase migration and check your connection.');
      }
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
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
    <main className="studio-shell">
      <header className="studio-header">
        <div><span className="eyebrow">SOCIAL MEDIA WORKSPACE</span><h1>Prompt Studio</h1><p>Plan, create, and refine content with 15 reusable workflows.</p></div>
        <div className={`service-pill ${service.state}`}><span className="status-dot" />{service.state === 'online' ? `${service.provider} · ${service.model}` : service.state === 'checking' ? 'Checking AI service' : 'AI service offline'}</div>
      </header>
      {service.state === 'offline' && <div className="studio-alert">Start the API with <code>npm run server</code>, then make sure Ollama is running or configure a cloud provider in <code>.env</code>.</div>}
      {service.state === 'online' && ['openai', 'anthropic'].includes(service.provider) && !service.keyConfigured && <div className="studio-alert">The API is running, but its cloud API key is not configured. Add it to the server environment.</div>}

      <div className="studio-layout">
        <aside className="template-panel">
          <div className="panel-heading"><div><span className="eyebrow">LIBRARY</span><h2>Workflows</h2></div><span className="template-count">15</span></div>
          <input className="form-control studio-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows" aria-label="Search workflows" />
          <div className="category-scroll">{CATEGORIES.map((item) => <button key={item} className={`category-chip ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <div className="template-list">{visibleTemplates.map((item) => <button key={item.id} className={`template-item ${selectedId === item.id ? 'selected' : ''}`} onClick={() => chooseTemplate(item)}><span className="template-category">{item.category}</span><strong>{item.title}</strong><small>{item.description}</small></button>)}{!visibleTemplates.length && <p className="empty-state">No workflows match that search.</p>}</div>
          <div className="history-panel"><div className="panel-heading"><h3>Recent runs</h3><span>{history.length}</span></div>{history.slice(0, 4).map((item) => <button key={item.id} className="history-item" onClick={() => setResult(item.text)}><span>{item.template}</span><small>{new Date(item.createdAt).toLocaleString()}</small></button>)}{history.length === 0 && <p className="muted-small">Your generated drafts will appear here.</p>}</div>
        </aside>

        <section className="workbench">
          <div className="workbench-top"><div><span className="eyebrow">{promptTemplates.find((item) => item.id === selectedId)?.category || 'CUSTOM'}</span><h2>{promptTemplates.find((item) => item.id === selectedId)?.title || 'Prompt'}</h2><p>{promptTemplates.find((item) => item.id === selectedId)?.description || 'Edit your prompt and generate a draft.'}</p></div><span className="draft-label">DRAFT</span></div>
          <label className="form-label" htmlFor="brand-voice">Brand voice & context <span>saved in this browser</span></label>
          <textarea id="brand-voice" className="form-control context-input" rows="2" value={brandVoice} onChange={(event) => saveVoice(event.target.value)} placeholder="e.g. Friendly, practical, no hype. We help independent cafes plan social content." />
          <label className="form-label prompt-label" htmlFor="prompt-editor">Prompt <span>Fill in [bracketed] details before running</span></label>
          <textarea id="prompt-editor" className="form-control prompt-editor" value={prompt} onChange={(event) => setPrompt(event.target.value)} spellCheck="false" />
          <div className="run-row"><span className="muted-small">{prompt.length.toLocaleString()} characters · saved runs stay on this device</span><button className="btn btn-primary run-button" onClick={runPrompt} disabled={busy || !prompt.trim() || service.state !== 'online'}>{busy ? <><span className="spinner-border spinner-border-sm me-2" />Generating…</> : 'Generate draft'}</button></div>
          {notice && <div className="alert alert-danger mt-3" role="alert">{notice}</div>}
          {(result || busy) && <section className="result-card"><div className="result-heading"><div><span className="eyebrow">AI OUTPUT</span><h3>Draft</h3></div>{result && <button className="btn btn-sm btn-outline-secondary" onClick={() => navigator.clipboard?.writeText(result).then(() => setNotice('Copied to clipboard.'))}>Copy</button>}</div>{busy ? <div className="result-loading"><span className="spinner-border spinner-border-sm me-2" />Working on your draft…</div> : <pre className="result-text">{result}</pre>}</section>}
        </section>
      </div>
      <footer className="studio-footer">Signed in as {user?.email || user?.name || 'demo user'} <span>·</span> {supabase ? 'Brand voice and prompt run history sync to your Supabase account.' : 'Draft history and brand context are stored in this browser.'}</footer>
    </main>
  );
}
