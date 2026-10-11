import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import ThreadsPlanner from './ThreadsPlanner';

const DEFAULT_STORAGE_BUCKET = process.env.REACT_APP_SUPABASE_STORAGE_BUCKET || 'threads-media';
const MAX_MEDIA = 20;

export default function ThreadsChannel({ user }) {
  const [status, setStatus] = useState({ loading: true, configured: false, missing: [] });
  const [text, setText] = useState('');
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const request = useCallback(async (path, options = {}) => {
    if (!supabase) throw new Error('Threads requires Supabase sign-in. Configure the frontend Supabase URL and anon key.');
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.access_token) headers.Authorization = `Bearer ${sessionData.session.access_token}`;
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Threads request failed.');
    return data;
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!supabase) { setStatus({ loading: false, configured: false, connected: false, missing: [] }); return; }
    try { setStatus({ loading: false, ...(await request('/api/threads/status')) }); }
    catch (statusError) { setStatus({ loading: false, configured: false, connected: false, missing: [], setupError: statusError.message }); setError(statusError.message); }
  }, [request]);

  useEffect(() => {
    refreshStatus();
    const timer = setInterval(refreshStatus, 30_000);
    return () => clearInterval(timer);
  }, [refreshStatus]);

  const connect = async () => {
    setError(''); setNotice('');
    try { const data = await request('/api/threads/connect'); window.location.assign(data.authorizationUrl); }
    catch (connectError) { setError(connectError.message); }
  };

  const uploadFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError(''); setNotice('');
    if (media.length + files.length > MAX_MEDIA) { setError('A Threads post can include up to 20 media items.'); return; }
    const hasVideo = media.some((item) => item.type === 'VIDEO') || files.some((file) => file.type === 'video/mp4');
    if (hasVideo && media.length + files.length > 1) { setError('A video post must contain one video only. Remove other media first.'); return; }
    for (const file of files) {
      const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      const isVideo = file.type === 'video/mp4';
      if ((!isImage && !isVideo) || file.size > (isImage ? 8 : 100) * 1024 * 1024) {
        setError('Choose JPEG, PNG, or WebP images up to 8 MB, or MP4 video up to 100 MB.'); return;
      }
    }
    if (!supabase || !user?.id) { setError('Sign in with Supabase before uploading media.'); return; }
    setUploading(true);
    const uploaded = [];
    try {
      for (const file of files) {
        const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(status.storageBucket || DEFAULT_STORAGE_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
        if (uploadError) throw new Error(uploadError.message || 'Media upload failed. Apply the Threads storage migration and check the bucket policies.');
        uploaded.push({ path, type: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE', file, previewUrl: URL.createObjectURL(file) });
      }
      setMedia((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      if (uploaded.length) {
        await supabase.storage.from(status.storageBucket || DEFAULT_STORAGE_BUCKET).remove(uploaded.map((item) => item.path));
        uploaded.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      }
      setError(uploadError.message);
    } finally { setUploading(false); }
  };

  const removeMedia = async (item) => {
    setMedia((current) => current.filter((candidate) => candidate.path !== item.path));
    URL.revokeObjectURL(item.previewUrl);
    const { error: removeError } = await supabase.storage.from(status.storageBucket || DEFAULT_STORAGE_BUCKET).remove([item.path]);
    if (removeError) setError('Removed from this draft, but could not delete the uploaded file from storage.');
  };

  const publish = async () => {
    if (!text.trim() && !media.length) { setError('Write a post or add media before publishing.'); return; }
    if (!window.confirm('Publish this post publicly to Threads now?')) return;
    setPublishing(true); setError(''); setNotice('');
    try {
      const signedMedia = [];
      for (const item of media) {
        const { data, error: signedError } = await supabase.storage.from(status.storageBucket || DEFAULT_STORAGE_BUCKET).createSignedUrl(item.path, 7 * 24 * 60 * 60);
        if (signedError || !data?.signedUrl) throw new Error(signedError?.message || 'Could not create a media URL for Threads.');
        signedMedia.push({ type: item.type, url: data.signedUrl });
      }
      const data = await request('/api/threads/publish', { method: 'POST', body: JSON.stringify({ text: text.trim(), media: signedMedia, mediaPaths: media.map((item) => item.path) }) });
      setNotice(`Published to Threads${data.username ? ` as @${data.username}` : ''}. Post ID: ${data.postId}`);
      setText('');
      media.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setMedia([]);
    } catch (publishError) { setError(publishError.message); }
    finally { setPublishing(false); }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect Threads? This deletes the encrypted connection token from this app.')) return;
    setError(''); setNotice('');
    try { await request('/api/threads/disconnect', { method: 'DELETE' }); setStatus((current) => ({ ...current, connected: false, username: null })); setNotice('Threads disconnected.'); }
    catch (disconnectError) { setError(disconnectError.message); }
  };

  const connectDisabledReason = !supabase
    ? 'Set the frontend Supabase URL and anon key, then restart the frontend.'
    : !status.configured
      ? 'Complete the Threads API and server Supabase configuration, then restart the backend.'
      : '';

  return <section className="connection-card threads-card">
    <div className="connection-card-heading">
      <div><div className="threads-mark">@</div><div><h2>Threads</h2><p>Publish text, images, video, or carousels to your Threads profile.</p></div></div>
      {status.connected
        ? <button className="btn btn-outline-secondary" disabled={publishing || uploading} onClick={disconnect}>Disconnect</button>
        : <button className="btn btn-primary" disabled={!status.configured || !supabase || status.loading || publishing || uploading} title={connectDisabledReason || undefined} onClick={connect}>{status.loading ? 'Checking…' : 'Connect Threads'}</button>}
    </div>
    {connectDisabledReason && !status.connected && <p className="connect-facebook-help">{connectDisabledReason}</p>}
    {!status.loading && !status.configured && supabase && <div className="connection-requirements"><strong>Threads setup required</strong><span>{status.setupError || `Missing server configuration: ${status.missing?.length ? status.missing.join(', ') : 'Threads API status unavailable'}. Apply the Threads Supabase migration and configure the server environment.`}</span></div>}
    {status.connected && <>
      <div className="threads-account"><span className="connected-dot" /><span>Connected as <strong>@{status.username || 'Threads user'}</strong></span><span className="threads-expiry">Token refreshes automatically before expiry.</span></div>
      {status.expiringSoon && <div className="alert alert-warning mt-3" role="status">Threads access token expires soon. The server will try to refresh it automatically; reconnect if publishing fails.</div>}
      {notice && <div className="alert alert-success mt-3" role="status">{notice}</div>}
      {error && <div className="alert alert-danger mt-3" role="alert">{error}</div>}
      <label className="form-label mt-3" htmlFor="threads-post-text">Post text</label>
      <textarea id="threads-post-text" className="form-control" rows="4" maxLength="500" placeholder="What would you like to share?" value={text} onChange={(event) => setText(event.target.value)} />
      <div className="threads-composer-meta"><small>{text.length}/500 characters · publishing is immediate</small><label className={`threads-upload-button ${uploading ? 'disabled' : ''}`}>{uploading ? 'Uploading media…' : 'Add image or video'}<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" multiple hidden disabled={uploading || publishing || media.length >= MAX_MEDIA} onChange={uploadFiles} /></label></div>
      {media.length > 0 && <div className="threads-media-grid">{media.map((item) => <div className="threads-media-preview" key={item.path}>{item.type === 'VIDEO' ? <video src={item.previewUrl} controls /> : <img src={item.previewUrl} alt={item.file.name} />}<span>{item.type === 'VIDEO' ? 'Video' : 'Image'}</span><button type="button" aria-label={`Remove ${item.file.name}`} onClick={() => removeMedia(item)} disabled={publishing}>×</button></div>)}</div>}
      {media.length > 1 && <p className="threads-hint">These {media.length} items will publish as one carousel. Threads accepts 2–20 images/videos per carousel.</p>}
      <div className="publish-controls"><small>{media.length ? `${media.length} media item${media.length === 1 ? '' : 's'} ready` : 'Text-only post or add media'}</small><button className="btn btn-primary" disabled={publishing || uploading || (!text.trim() && !media.length)} onClick={publish}>{publishing ? 'Publishing to Threads…' : 'Publish to Threads'}</button></div>
      <ThreadsPlanner request={request} imageGenerationConfigured={status.imageGenerationConfigured} imageGenerationMessage={status.imageGenerationMessage} />
    </>}
    {error && !status.connected && <div className="alert alert-danger mt-3" role="alert">{error}</div>}
    {notice && !status.connected && <div className="alert alert-success mt-3" role="status">{notice}</div>}
  </section>;
}
