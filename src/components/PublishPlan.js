import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faChevronRight,
  faPlus,
  faClock,
  faGlobe,
  faImage,
  faVideo,
  faPen,
  faTrash,
  faCircle,
  faCheck,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', color: '#1877f2' },
  { id: 'instagram', label: 'Instagram', color: '#e1306c' },
  { id: 'threads', label: 'Threads', color: '#000' },
  { id: 'tiktok', label: 'TikTok', color: '#25f4ee' },
];

const STORE_KEY = 'aiSocialPublishPosts';
const HANDOFF_KEY = 'aiSocialPublishHandoff';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Sample posts seeded ONCE on first visit (after that the calendar is the
// user's real data — add/edit/delete persist in localStorage).
const SAMPLE_POSTS = (year, month1) => [
  { day: 3, time: '09:00', title: 'Video giới thiệu sản phẩm mới', platform: 'facebook', status: 'scheduled', type: 'video' },
  { day: 3, time: '18:30', title: 'Carousel ảnh chiến dịch mùa lễ', platform: 'instagram', status: 'scheduled', type: 'image' },
  { day: 7, time: '12:00', title: 'Bài đăng caption cảm xúc', platform: 'threads', status: 'scheduled', type: 'text' },
  { day: 12, time: '20:00', title: 'TikTok trend — choreo mới', platform: 'tiktok', status: 'draft', type: 'video' },
  { day: 15, time: '08:00', title: 'Ảnh quote Monday motivation', platform: 'instagram', status: 'scheduled', type: 'image' },
  { day: 15, time: '17:30', title: 'Video recap tuần qua', platform: 'facebook', status: 'scheduled', type: 'video' },
  { day: 22, time: '11:00', title: 'Mini-blog ẩm thực Hà Nội', platform: 'threads', status: 'draft', type: 'text' },
  { day: 28, time: '19:30', title: 'Reels mùa thu — Sapa', platform: 'instagram', status: 'scheduled', type: 'video' },
].map((p) => ({
  id: `seed-${year}-${month1}-${p.day}-${p.time.replace(':', '')}`,
  date: ymd(year, month1 - 1, p.day),
  time: p.time,
  title: p.title,
  platform: p.platform,
  status: p.status,
  type: p.type,
}));

function loadPosts() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (Array.isArray(raw)) return raw;
  } catch { /* ignore */ }
  const today = new Date();
  const seeded = SAMPLE_POSTS(today.getFullYear(), today.getMonth() + 1);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(seeded)); } catch { /* ignore */ }
  return seeded;
}

const MONTH_NAMES = {
  vi: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const WEEKDAYS = {
  vi: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
};

const PublishPlan = () => {
  const [lang] = useLang();
  const vi = lang !== 'en';
  const T = {
    eyebrow: vi ? 'LỊCH TRÌNH' : 'SCHEDULE',
    today: vi ? 'Hôm nay' : 'Today',
    prevMonth: vi ? 'Tháng trước' : 'Previous month',
    nextMonth: vi ? 'Tháng sau' : 'Next month',
    queue: vi ? 'HÀNG ĐỢI' : 'QUEUE',
    allPosts: vi ? 'Tất cả bài đăng' : 'All posts',
    scheduledCount: (n) => vi ? `${n} bài đã lên lịch` : `${n} post(s) scheduled`,
    add: vi ? 'Thêm' : 'Add',
    addTitle: vi ? 'Lên bài mới vào ngày này' : 'Schedule a post on this day',
    statusScheduled: vi ? 'Đã lên lịch' : 'Scheduled',
    statusDraft: vi ? 'Bản nháp' : 'Draft',
    chipDraft: vi ? 'Nháp' : 'Draft',
    empty: vi ? 'Không có bài đăng nào. Bấm' : 'Nothing here. Press',
    emptyAfter: vi ? 'để lên lịch.' : 'to schedule one.',
    edit: vi ? 'Sửa' : 'Edit',
    del: vi ? 'Xoá' : 'Delete',
    formTitle: vi ? 'Bài đăng mới' : 'New post',
    formTitleEdit: vi ? 'Sửa bài đăng' : 'Edit post',
    labelTitle: vi ? 'Nội dung' : 'Content',
    phTitle: vi ? 'VD: Video giới thiệu sản phẩm mới…' : 'e.g. New product intro video…',
    labelPlatform: vi ? 'Nền tảng' : 'Platform',
    labelTime: vi ? 'Giờ đăng' : 'Time',
    labelType: vi ? 'Loại' : 'Type',
    typeText: vi ? 'Chữ' : 'Text',
    typeImage: vi ? 'Ảnh' : 'Image',
    typeVideo: vi ? 'Video' : 'Video',
    save: vi ? 'Lên lịch' : 'Schedule',
    saveEdit: vi ? 'Lưu thay đổi' : 'Save changes',
    cancel: vi ? 'Huỷ' : 'Cancel',
    needTitle: vi ? 'Hãy nhập nội dung bài đăng.' : 'Enter the post content first.',
    saved: vi ? 'Đã lên lịch bài đăng' : 'Post scheduled',
    updated: vi ? 'Đã cập nhật bài đăng' : 'Post updated',
    deleted: vi ? 'Đã xoá bài đăng' : 'Post deleted',
    handoffToast: vi ? 'Bài từ Bảng tin đã sẵn sàng — điền thêm giờ rồi bấm Lên lịch.' : 'Post from the Feed is ready — pick a time and press Schedule.',
    handoffTitle: vi ? 'Từ Bảng tin' : 'From the Feed',
    publishNote: vi ? 'Đây là nơi duy nhất thao tác lên tài khoản thật — mọi bài ở đây được đăng lên kênh đã kết nối.' : 'This is the one place that acts on real accounts — everything here gets published to connected channels.',
  };

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(null);
  const [posts, setPosts] = useState(loadPosts);
  const [form, setForm] = useState(null); // null | { editingId?, date, time, title, platform, type }
  const [toast, setToast] = useState('');
  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(''), 2600);
  };

  // Handoff from the Feed "Lên lịch" action: open the form with the post
  // content prefilled on today's date.
  useEffect(() => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || 'null');
      if (raw && typeof raw.title === 'string' && raw.title.trim()) {
        setForm({
          editingId: null,
          date: ymd(today.getFullYear(), today.getMonth(), today.getDate()),
          time: '09:00',
          title: raw.title,
          platform: 'facebook',
          type: 'text',
          status: 'draft',
        });
        sessionStorage.removeItem(HANDOFF_KEY);
        showToast(T.handoffToast);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (list) => {
    setPosts(list);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch { /* quota — session only */ }
  };

  const monthPosts = useMemo(() => {
    const prefix = `${year}-${pad(month + 1)}`;
    return posts.filter((p) => typeof p.date === 'string' && p.date.startsWith(prefix))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [posts, year, month]);

  const postsByDay = useMemo(() => {
    const m = {};
    monthPosts.forEach((p) => {
      const d = Number(p.date.slice(8, 10));
      (m[d] = m[d] || []).push(p);
    });
    return m;
  }, [monthPosts]);

  // Days in month + leading offset (Mon-first)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // shift Sun=0 to end

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
    setForm(null);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
    setForm(null);
  };

  const platformById = (id) => PLATFORMS.find((p) => p.id === id) || PLATFORMS[0];
  const dayPosts = selectedDay ? (postsByDay[selectedDay] || []) : [];

  // ---- CRUD (was dead buttons; now real, persisted) ----
  const openAddForm = () => {
    const day = selectedDay || today.getDate();
    setForm({
      editingId: null,
      date: ymd(year, month, day),
      time: '09:00',
      title: '',
      platform: 'facebook',
      type: 'text',
      status: 'scheduled',
    });
  };
  const openEditForm = (p) => {
    setForm({ editingId: p.id, date: p.date, time: p.time, title: p.title, platform: p.platform, type: p.type, status: p.status });
  };
  const submitForm = () => {
    if (!form || !form.title.trim()) { showToast(T.needTitle); return; }
    if (form.editingId) {
      persist(posts.map((p) => (p.id === form.editingId ? { ...p, ...form, title: form.title.trim() } : p)));
      showToast(T.updated);
    } else {
      const item = {
        id: `p${Date.now()}`,
        date: form.date,
        time: form.time,
        title: form.title.trim(),
        platform: form.platform,
        type: form.type,
        status: form.status,
      };
      persist([...posts, item]);
      showToast(T.saved);
    }
    setForm(null);
  };
  const deletePost = (id) => {
    persist(posts.filter((p) => p.id !== id));
    if (form?.editingId === id) setForm(null);
    showToast(T.deleted);
  };

  const statusCounts = useMemo(() => monthPosts.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1; return acc;
  }, {}), [monthPosts]);

  const listed = selectedDay ? dayPosts : monthPosts;

  return (
    <div className="pp-page">
      <div className="pp-layout">
        {/* Calendar */}
        <section className="pp-calendar-card">
          <header className="pp-cal-head">
            <div>
              <span className="eyebrow">{T.eyebrow}</span>
              <h2>{MONTH_NAMES[lang][month]} {year}</h2>
            </div>
            <div className="pp-cal-nav">
              <button type="button" onClick={prev} aria-label={T.prevMonth}>
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <button type="button" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(today.getDate()); setForm(null); }}>
                {T.today}
              </button>
              <button type="button" onClick={next} aria-label={T.nextMonth}>
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
          </header>

          <div className="pp-cal-weekdays">
            {WEEKDAYS[lang].map((w, i) => <span key={`${w}-${i}`}>{w}</span>)}
          </div>

          <div className="pp-cal-grid">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} className="pp-cal-cell empty" />;
              const dPosts = postsByDay[day] || [];
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = day === selectedDay;
              return (
                <button
                  type="button"
                  key={`d${day}`}
                  className={`pp-cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                  onClick={() => { setSelectedDay(day); setForm(null); }}
                >
                  <span className="pp-cal-day">{day}</span>
                  <div className="pp-cal-dots">
                    {dPosts.slice(0, 4).map((p) => (
                      <span key={p.id} className="pp-cal-dot" style={{ background: platformById(p.platform).color }} title={p.title} />
                    ))}
                    {dPosts.length > 4 && <span className="pp-cal-more">+{dPosts.length - 4}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pp-cal-legend">
            {PLATFORMS.map((p) => (
              <span key={p.id}><i style={{ background: p.color }} /> {p.label}</span>
            ))}
          </div>
        </section>

        {/* Day detail / queue */}
        <aside className="pp-side">
          <div className="pp-side-card">
            <header className="pp-side-head">
              <div>
                <span className="eyebrow">{selectedDay ? `${MONTH_NAMES[lang][month]} ${selectedDay}` : T.queue}</span>
                <h3>{selectedDay ? T.scheduledCount(dayPosts.length) : T.allPosts}</h3>
              </div>
              <button className="pp-add-btn" type="button" onClick={openAddForm} title={T.addTitle}>
                <FontAwesomeIcon icon={faPlus} /> {T.add}
              </button>
            </header>

            {!selectedDay && (
              <div className="pp-status-row">
                <div className="pp-status-chip scheduled">
                  <FontAwesomeIcon icon={faCircle} /> {T.statusScheduled}
                  <strong>{statusCounts.scheduled || 0}</strong>
                </div>
                <div className="pp-status-chip draft">
                  <FontAwesomeIcon icon={faCircle} /> {T.statusDraft}
                  <strong>{statusCounts.draft || 0}</strong>
                </div>
              </div>
            )}

            {/* Add / edit form (real scheduling = the login-required action) */}
            {form && (
              <div className="pp-form">
                <p className="pp-form-title">
                  {form.editingId ? T.formTitleEdit : T.formTitle}
                  {form.date && <small> · {form.date.split('-').reverse().join('/')}</small>}
                </p>
                <textarea
                  className="pp-form-input"
                  rows="2"
                  value={form.title}
                  placeholder={T.phTitle}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  autoFocus
                />
                <div className="pp-form-row">
                  <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} aria-label={T.labelPlatform}>
                    {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                  <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} aria-label={T.labelTime} />
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} aria-label={T.labelType}>
                    <option value="text">{T.typeText}</option>
                    <option value="image">{T.typeImage}</option>
                    <option value="video">{T.typeVideo}</option>
                  </select>
                </div>
                <div className="pp-form-actions">
                  <button type="button" className="pp-form-save" onClick={submitForm}>
                    <FontAwesomeIcon icon={form.editingId ? faCheck : faPlus} /> {form.editingId ? T.saveEdit : T.save}
                  </button>
                  <button type="button" className="pp-form-cancel" onClick={() => setForm(null)}>
                    <FontAwesomeIcon icon={faXmark} /> {T.cancel}
                  </button>
                </div>
              </div>
            )}

            <ul className="pp-queue">
              {listed.length === 0 && (
                <li className="pp-empty">
                  <FontAwesomeIcon icon={faClock} />
                  <p>{T.empty} <strong>{T.add}</strong> {T.emptyAfter}</p>
                </li>
              )}
              {listed.map((p) => {
                const plat = platformById(p.platform);
                return (
                  <li key={p.id} className="pp-queue-item">
                    <div className="pp-queue-time">
                      <strong>{p.time}</strong>
                      <small>{p.date.slice(8, 10)}/{p.date.slice(5, 7)}</small>
                    </div>
                    <div className="pp-queue-body">
                      <p>{p.title}</p>
                      <div className="pp-queue-meta">
                        <span className="pp-queue-platform" style={{ background: `${plat.color}22`, color: plat.color }}>
                          <FontAwesomeIcon icon={faGlobe} /> {plat.label}
                        </span>
                        {p.type === 'video' && <span className="pp-queue-type"><FontAwesomeIcon icon={faVideo} /> {T.typeVideo}</span>}
                        {p.type === 'image' && <span className="pp-queue-type"><FontAwesomeIcon icon={faImage} /> {T.typeImage}</span>}
                        <span className={`pp-queue-status ${p.status}`}>{p.status === 'scheduled' ? T.statusScheduled : T.chipDraft}</span>
                      </div>
                    </div>
                    <div className="pp-queue-actions">
                      <button type="button" title={T.edit} onClick={() => openEditForm(p)}><FontAwesomeIcon icon={faPen} /></button>
                      <button type="button" title={T.del} onClick={() => deletePost(p.id)}><FontAwesomeIcon icon={faTrash} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="pp-publish-note">{T.publishNote}</p>
          </div>
        </aside>
      </div>

      {toast && <div className="ai-toast">{toast}</div>}
    </div>
  );
};

export default PublishPlan;
