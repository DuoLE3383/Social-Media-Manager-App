import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import ThreadsChannel from './ThreadsChannel';

export default function Connections({ user }) {
  const [configured, setConfigured] = useState(false);
  const [missingServerConfig, setMissingServerConfig] = useState([]);
  const [pages, setPages] = useState([]);
  const [messages, setMessages] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (path, options = {}) => {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }, []);

  const loadPages = useCallback(async () => {
    if (!supabase) return;
    try { const data = await request('/api/meta/pages'); setPages(data.pages || []); }
    catch (loadError) { if (!/not configured/i.test(loadError.message)) setError(loadError.message); }
  }, [request]);

  useEffect(() => {
    request('/api/meta/status').then((data) => { setConfigured(data.configured); setMissingServerConfig(data.missing || []); }).catch(() => setConfigured(false));
    loadPages();
    const query = new URLSearchParams(window.location.search);
    const outcome = query.get('facebook');
    const threadsOutcome = query.get('threads');
    if (outcome === 'connected') setNotice(`Facebook connected. ${query.get('count') || 'Your'} managed Page(s) are ready.`);
    else if (outcome === 'denied') setError('Facebook authorization was cancelled.');
    else if (outcome === 'error') setError('Facebook connection failed. Check the Meta app setup and try again.');
    else if (outcome === 'not_configured') setError('Add the Meta app credentials and token encryption key to the server environment first.');
    if (threadsOutcome === 'connected') setNotice('Threads account connected.');
    else if (threadsOutcome === 'denied') setError('Threads authorization was cancelled.');
    else if (threadsOutcome === 'error') setError('Threads connection failed. Check the Meta app setup and try again.');
    else if (threadsOutcome === 'not_configured') setError('Add the Threads API credentials and server configuration first.');
    if (outcome || threadsOutcome) { window.history.replaceState({}, '', '/settings'); }
  }, [loadPages, request]);

  const connect = async () => {
    setBusy(true); setError('');
    try { const data = await request('/api/meta/connect'); window.location.assign(data.authorizationUrl); }
    catch (connectError) { setError(connectError.message); setBusy(false); }
  };

  const publish = async (page) => {
    const message = (messages[page.id] || '').trim();
    if (!message) { setError('Write a post before publishing.'); return; }
    if (!window.confirm(`Publish this post publicly as ${page.name}?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await request(`/api/meta/pages/${encodeURIComponent(page.id)}/publish`, { method: 'POST', body: JSON.stringify({ message }) });
      setMessages((current) => ({ ...current, [page.id]: '' }));
      setNotice(`Published to ${data.pageName}. Facebook post ID: ${data.id}`);
    } catch (publishError) { setError(publishError.message); }
    finally { setBusy(false); }
  };

  const disconnect = async (page) => {
    if (!window.confirm(`Disconnect ${page.name}? This removes its saved token from this app.`)) return;
    setBusy(true); setError('');
    try { await request(`/api/meta/pages/${encodeURIComponent(page.id)}`, { method: 'DELETE' }); setPages((current) => current.filter((item) => item.id !== page.id)); setNotice(`${page.name} disconnected.`); }
    catch (disconnectError) { setError(disconnectError.message); }
    finally { setBusy(false); }
  };

  const connectDisabledReason = !supabase
    ? 'Set the frontend Supabase URL and anon key, then restart the frontend.'
    : !configured
      ? 'Complete the server Supabase and Meta API configuration, then restart the backend.'
      : '';

  return <main className="connections-shell">
    <header className="connections-heading"><div><span className="eyebrow">PUBLISHING CHANNELS</span><h1>Connections</h1><p>Connect a Facebook Page you manage and publish posts from this workspace.</p></div><span className={`service-pill ${configured ? 'online' : 'offline'}`}><span className="status-dot" />{configured ? 'Meta API configured' : 'Meta API needs setup'}</span></header>
    {!supabase && <div className="studio-alert">Facebook connections require Supabase authentication. This session is using demo sign-in. For local development, configure <code>REACT_APP_SUPABASE_URL</code> and <code>REACT_APP_SUPABASE_ANON_KEY</code> (or <code>REACT_APP_SUPABASE_PUBLISHABLE_KEY</code>) in <code>.env</code> and restart the frontend. For Cloudflare Pages, add these as build environment variables and redeploy.</div>}
    {!configured && <div className="studio-alert">Meta API setup is incomplete. Missing server configuration: <strong>{missingServerConfig.length ? missingServerConfig.join(', ') : 'API status unavailable'}</strong>. Add these to <code>.env</code> and restart the backend. Never share the service-role key or Meta app secret.</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    <section className="connection-card"><div className="connection-card-heading"><div><div className="facebook-mark">f</div><div><h2>Facebook Pages</h2><p>Publish text posts to Pages that you administer.</p></div></div><button className="btn btn-primary" disabled={!configured || !supabase || busy} title={connectDisabledReason || undefined} aria-describedby={connectDisabledReason ? 'connect-facebook-help' : undefined} onClick={connect}>{busy ? 'Working…' : 'Connect Facebook'}</button></div>
      {connectDisabledReason && <p id="connect-facebook-help" className="connect-facebook-help" role="note">{connectDisabledReason}</p>}
      <div className="connection-requirements"><strong>Before connecting</strong><span>Complete the Meta app OAuth setup and Pages permission review. Facebook profile posting is not supported by this integration.</span></div>
      {pages.map((page) => <article className="connected-page" key={page.id}><div className="connected-page-header"><div><span className="connected-dot" /><strong>{page.name}</strong><small>Page ID {page.id}</small></div><button className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => disconnect(page)}>Disconnect</button></div><label className="form-label" htmlFor={`post-${page.id}`}>Post text</label><textarea id={`post-${page.id}`} className="form-control" rows="3" maxLength="5000" placeholder="Write a post for this Facebook Page…" value={messages[page.id] || ''} onChange={(event) => setMessages((current) => ({ ...current, [page.id]: event.target.value }))} /><div className="publish-controls"><small>{(messages[page.id] || '').length}/5000 · publishing is immediate</small><button className="btn btn-primary btn-sm" disabled={busy || !configured || !(messages[page.id] || '').trim()} onClick={() => publish(page)}>{busy ? 'Working…' : 'Publish to Page'}</button></div></article>)}
      {supabase && configured && pages.length === 0 && <div className="no-pages">No Facebook Pages connected yet. Connect Facebook to choose Pages managed by your account.</div>}
    </section>
    <ThreadsChannel user={user} />
    <p className="connections-footnote">Signed in as {user?.email || user?.name || 'user'}. Page access tokens are encrypted by the server and are not returned to this browser.</p>
  </main>;
}
