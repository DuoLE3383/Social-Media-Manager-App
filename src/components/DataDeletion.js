import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { apiUrl } from '../lib/api';

export default function DataDeletion() {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleted, setDeleted] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const hasMetaRequestCode = new URLSearchParams(window.location.search).has('request');

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => subscription.unsubscribe();
  }, []);

  const deleteAccount = async (event) => {
    event.preventDefault();
    if (confirmation !== 'DELETE') return;
    if (!window.confirm('Permanently delete your Social Studio account and its stored data? This cannot be undone.')) return;
    setBusy(true); setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sign in again before deleting your account.');
      const response = await fetch(apiUrl('/api/account'), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Account deletion failed. Please try again.');
      await supabase.auth.signOut();
      ['socialMediaUser', 'socialMediaBrandVoice', 'socialMediaAiHistory', 'ss.modelTier'].forEach((key) => localStorage.removeItem(key));
      setDeleted(true);
    } catch (deleteError) { setError(deleteError.message); }
    finally { setBusy(false); }
  };

  if (deleted) return <main className="deletion-page"><section className="deletion-card"><span className="eyebrow">PRIVACY</span><h1>Account deleted</h1><p>Your Social Studio account and its associated workspace data have been deleted.</p><Link className="btn btn-primary" to="/login">Return to sign in</Link></section></main>;

  return <main className="deletion-page"><section className="deletion-card">
    <span className="eyebrow">PRIVACY &amp; DATA</span>
    <h1>Data deletion</h1>
    {hasMetaRequestCode && <div className="alert alert-success" role="status">Meta’s data deletion callback completed. To check for any remaining connected Pages, sign in and disconnect them from Connections.</div>}
    <p>Social Studio stores Facebook Page access tokens so you can publish to Pages you manage. It also stores workspace information such as your brand voice and prompt history when you use a signed-in account.</p>
    <h2>Remove Facebook data</h2>
    <ol>
      <li>Sign in to Social Studio and open <Link to="/settings">Connections</Link>.</li>
      <li>Select <strong>Disconnect</strong> for each connected Facebook Page. This removes its saved access token from Social Studio.</li>
      <li>You can also remove Social Studio from your Facebook account’s Business Integrations settings to revoke its Facebook permissions.</li>
    </ol>
    <h2>Delete your Social Studio account</h2>
    {supabase ? <>
      <p>Sign in with the account you want to delete, enter <strong>DELETE</strong>, then confirm. This permanently removes your account and associated workspace records, including profile, brands, prompt templates, content, metrics, settings, prompt history, and connected Page tokens.</p>
      <form onSubmit={deleteAccount}>
        <label className="form-label" htmlFor="delete-confirmation">Type DELETE to confirm</label>
        <input id="delete-confirmation" className="form-control mb-3" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} />
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {!signedIn && <p className="small text-muted"><Link to="/login">Sign in</Link> with the account you want to delete first.</p>}
        <button className="btn btn-danger" type="submit" disabled={busy || !signedIn || confirmation !== 'DELETE'}>{busy ? 'Deleting account…' : 'Permanently delete my account'}</button>
      </form>
    </> : <p>Account deletion is available after Supabase authentication is configured. To remove Facebook Page tokens now, sign in and disconnect each Page from <Link to="/settings">Connections</Link>.</p>}
    <p className="deletion-footnote">Meta can also submit an automated deletion request to this app. For that callback to work, the app must be deployed at a public HTTPS URL and the callback URL must be configured in Meta for Developers.</p>
  </section></main>;
}
