import React, { useCallback, useEffect, useState } from 'react';
import { threadsCalendar } from '../data/threadsCalendar';

function localDate(daysFromNow = 1) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function composePost(item) {
  const parts = [item.hook.trim(), item.topic.trim(), item.cta.trim()].filter(Boolean);
  let text = parts.join('\n\n');
  if (text.length > 500) {
    const overflow = text.length - 500;
    text = `${item.hook.trim()}\n\n${item.topic.trim().slice(0, Math.max(0, item.topic.length - overflow - 1))}\n\n${item.cta.trim()}`;
  }
  return text.slice(0, 500);
}

export default function ThreadsPlanner({ request, imageGenerationConfigured, imageGenerationMessage }) {
  const [items, setItems] = useState(threadsCalendar);
  const [startDate, setStartDate] = useState(() => localDate());
  const [postTime, setPostTime] = useState('09:00');
  const [scheduled, setScheduled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadScheduled = useCallback(async () => {
    try {
      const data = await request('/api/threads/scheduled');
      setScheduled(data.posts || []);
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => {
    loadScheduled();
    const timer = setInterval(loadScheduled, 15_000);
    return () => clearInterval(timer);
  }, [loadScheduled]);

  const updateItem = (day, changes) => setItems((current) => current.map((item) => item.day === day ? { ...item, ...changes } : item));

  const schedule = async () => {
    const selected = items.filter((item) => item.selected);
    if (!selected.length) { setError('Select at least one calendar day to schedule.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const payload = selected.map((item) => {
        const local = new Date(`${startDate}T${postTime}:00`);
        local.setDate(local.getDate() + item.day - 1);
        const imagePrompt = `Create a polished social media image for a short-drama creator brand. Topic: ${item.topic}. Visual direction: ${item.productionNotes}. No text, letters, logos, or watermarks. Cinematic lighting, expressive but natural people, vertical 4:5 composition.`;
        return {
          day: item.day,
          scheduledAt: local.toISOString(),
          text: composePost(item),
          pillar: item.pillar,
          format: item.format,
          topic: item.topic,
          hook: item.hook,
          cta: item.cta,
          productionNotes: item.productionNotes,
          imagePrompt,
          generateImage: true,
          mediaPaths: []
        };
      });
      const data = await request('/api/threads/scheduled', { method: 'POST', body: JSON.stringify({ posts: payload }) });
      setScheduled((current) => [...(data.posts || []), ...current].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)));
      setNotice(`${data.posts?.length || 0} Threads posts added to the schedule.`);
    } catch (scheduleError) { setError(scheduleError.message); }
    finally { setSaving(false); }
  };

  const cancel = async (post) => {
    try {
      await request(`/api/threads/scheduled/${encodeURIComponent(post.id)}`, { method: 'DELETE' });
      setScheduled((current) => current.filter((item) => item.id !== post.id));
    } catch (cancelError) { setError(cancelError.message); }
  };

  const pendingCount = scheduled.filter((post) => ['image_pending', 'image_generating', 'scheduled'].includes(post.status)).length;
  return <section className="threads-planner">
    <div className="threads-planner__heading"><div><span className="eyebrow">30-DAY CAMPAIGN</span><h3>Schedule from your content calendar</h3><p>Review the imported hooks, topics, CTAs, and production notes, then queue them for Threads.</p></div><span className="threads-planner__count">{pendingCount} queued</span></div>
    <div className="threads-planner__settings"><label>First post date<input type="date" className="form-control" value={startDate} min={localDate(0)} onChange={(event) => setStartDate(event.target.value)} /></label><label>Post time (your local time)<input type="time" className="form-control" value={postTime} onChange={(event) => setPostTime(event.target.value)} /></label><div><strong>Daily cadence</strong><small>Day 1 starts on your selected date; each following calendar row is one day later.</small></div></div>
    {error && <div className="alert alert-danger mt-3" role="alert">{error}</div>}
    {notice && <div className="alert alert-success mt-3" role="status">{notice}</div>}
    <details className="threads-planner__review"><summary>Review calendar · {items.filter((item) => item.selected).length} of {items.length} selected</summary><div className="threads-planner__list">{items.map((item) => <label key={item.day} className="threads-planner__item"><input type="checkbox" checked={item.selected} onChange={(event) => updateItem(item.day, { selected: event.target.checked })} /><span className="threads-planner__day">Day {item.day}<small>{item.weekday} · {item.pillar}</small></span><span><strong>{item.topic}</strong><small>{item.hook} · CTA: {item.cta}</small></span></label>)}</div></details>
    <div className="threads-planner__actions"><span>{imageGenerationConfigured ? `${imageGenerationMessage} If fallback is used, the prompt is sent to AI Horde community workers. Production notes guide each visual; generated images are saved to Supabase before scheduling. Horde may take several minutes. Video and live formats become Threads text-post ideas.` : (imageGenerationMessage || 'Set LLM_PROVIDER=ollama to enable automatic image scheduling.')}</span><button className="btn btn-primary" disabled={saving || !imageGenerationConfigured || !startDate || !postTime || !items.some((item) => item.selected)} onClick={schedule}>{saving ? 'Generating and scheduling…' : `Generate images & schedule ${items.filter((item) => item.selected).length}`}</button></div>
    <div className="threads-planner__queue"><h4>Scheduled and recent posts</h4>{loading ? <p className="muted-small">Loading schedule…</p> : !scheduled.length ? <p className="muted-small">No scheduled Threads posts yet.</p> : scheduled.map((post) => <article className="threads-planner__queue-item" key={post.id}><div><span className={`threads-planner__status ${post.status}`}>{({ image_pending: 'Waiting for image', image_generating: 'Creating image', scheduled: 'Scheduled', processing: 'Publishing', published: 'Published', failed: 'Failed', cancelled: 'Cancelled' })[post.status] || post.status}</span><strong>{post.calendar_day ? `Day ${post.calendar_day}: ` : ''}{post.source_topic || (post.text_content || '').slice(0, 80)}</strong><small>{post.scheduled_at ? new Date(post.scheduled_at).toLocaleString() : 'Published'}</small>{post.error_message && <small className="text-danger">{post.error_message}</small>}</div>{['scheduled', 'image_pending'].includes(post.status) && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => cancel(post)}>Cancel</button>}</article>)}</div>
  </section>;
}
