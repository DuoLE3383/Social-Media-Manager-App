import React, { useState, useMemo } from 'react';
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
} from '@fortawesome/free-solid-svg-icons';

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', color: '#1877f2' },
  { id: 'instagram', label: 'Instagram', color: '#e1306c' },
  { id: 'threads', label: 'Threads', color: '#000' },
  { id: 'tiktok', label: 'TikTok', color: '#25f4ee' },
];

// Sample scheduled posts for the current month.
const buildMonthPosts = (year, month) => {
  // Use stable IDs based on y/m so React keys don't change between renders.
  const prefix = `${year}-${month}-`;
  return [
    { id: prefix + '03', day: 3, time: '09:00', title: 'Video giới thiệu sản phẩm mới', platform: 'facebook', status: 'scheduled', type: 'video' },
    { id: prefix + '03', day: 3, time: '18:30', title: 'Carousel ảnh chiến dịch mùa lễ', platform: 'instagram', status: 'scheduled', type: 'image' },
    { id: prefix + '07', day: 7, time: '12:00', title: 'Bài đăng caption cảm xúc', platform: 'threads', status: 'scheduled', type: 'text' },
    { id: prefix + '12', day: 12, time: '20:00', title: 'TikTok trend — choreo mới', platform: 'tiktok', status: 'draft', type: 'video' },
    { id: prefix + '15', day: 15, time: '08:00', title: 'Ảnh quote Monday motivation', platform: 'instagram', status: 'scheduled', type: 'image' },
    { id: prefix + '15', day: 15, time: '17:30', title: 'Video recap tuần qua', platform: 'facebook', status: 'scheduled', type: 'video' },
    { id: prefix + '22', day: 22, time: '11:00', title: 'Mini-blog ẩm thực Hà Nội', platform: 'threads', status: 'draft', type: 'text' },
    { id: prefix + '28', day: 28, time: '19:30', title: 'Reels mùa thu — Sapa', platform: 'instagram', status: 'scheduled', type: 'video' },
  ];
};

const MONTH_NAMES = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const PublishPlan = () => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(null);

  const posts = useMemo(() => buildMonthPosts(year, month + 1), [year, month]);
  const postsByDay = useMemo(() => {
    const m = {};
    posts.forEach((p) => { (m[p.day] = m[p.day] || []).push(p); });
    return m;
  }, [posts]);

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
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  };

  const platformById = (id) => PLATFORMS.find((p) => p.id === id);
  const dayPosts = selectedDay ? (postsByDay[selectedDay] || []) : [];

  const statusCounts = useMemo(() => posts.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1; return acc;
  }, {}), [posts]);

  return (
    <div className="pp-page">
      <div className="pp-layout">
        {/* Calendar */}
        <section className="pp-calendar-card">
          <header className="pp-cal-head">
            <div>
              <span className="eyebrow">LỊCH TRÌNH</span>
              <h2>{MONTH_NAMES[month]} {year}</h2>
            </div>
            <div className="pp-cal-nav">
              <button type="button" onClick={prev} aria-label="Tháng trước">
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <button type="button" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(today.getDate()); }}>
                Hôm nay
              </button>
              <button type="button" onClick={next} aria-label="Tháng sau">
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
          </header>

          <div className="pp-cal-weekdays">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>

          <div className="pp-cal-grid">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} className="pp-cal-cell empty" />;
              const dayPosts = postsByDay[day] || [];
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = day === selectedDay;
              return (
                <button
                  type="button"
                  key={`d${day}`}
                  className={`pp-cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelectedDay(day)}
                >
                  <span className="pp-cal-day">{day}</span>
                  <div className="pp-cal-dots">
                    {dayPosts.slice(0, 4).map((p) => (
                      <span key={p.id} className="pp-cal-dot" style={{ background: platformById(p.platform)?.color }} title={p.title} />
                    ))}
                    {dayPosts.length > 4 && <span className="pp-cal-more">+{dayPosts.length - 4}</span>}
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
                <span className="eyebrow">{selectedDay ? `${MONTH_NAMES[month]} ${selectedDay}` : 'HÀNG ĐỢI'}</span>
                <h3>{selectedDay ? `${dayPosts.length} bài đã lên lịch` : 'Tất cả bài đăng'}</h3>
              </div>
              <button className="pp-add-btn" type="button">
                <FontAwesomeIcon icon={faPlus} /> Thêm
              </button>
            </header>

            {!selectedDay && (
              <div className="pp-status-row">
                <div className="pp-status-chip scheduled">
                  <FontAwesomeIcon icon={faCircle} /> Đã lên lịch
                  <strong>{statusCounts.scheduled || 0}</strong>
                </div>
                <div className="pp-status-chip draft">
                  <FontAwesomeIcon icon={faCircle} /> Bản nháp
                  <strong>{statusCounts.draft || 0}</strong>
                </div>
              </div>
            )}

            <ul className="pp-queue">
              {(selectedDay ? dayPosts : posts).length === 0 && (
                <li className="pp-empty">
                  <FontAwesomeIcon icon={faClock} />
                  <p>Không có bài đăng nào. Bấm <strong>Thêm</strong> để lên lịch.</p>
                </li>
              )}
              {(selectedDay ? dayPosts : posts).map((p) => {
                const plat = platformById(p.platform);
                return (
                  <li key={`${p.id}-${p.time}`} className="pp-queue-item">
                    <div className="pp-queue-time">
                      <strong>{p.time}</strong>
                      <small>{plat.label}</small>
                    </div>
                    <div className="pp-queue-body">
                      <p>{p.title}</p>
                      <div className="pp-queue-meta">
                        <span className="pp-queue-platform" style={{ background: `${plat.color}22`, color: plat.color }}>
                          <FontAwesomeIcon icon={faGlobe} /> {plat.label}
                        </span>
                        {p.type === 'video' && <span className="pp-queue-type"><FontAwesomeIcon icon={faVideo} /> Video</span>}
                        {p.type === 'image' && <span className="pp-queue-type"><FontAwesomeIcon icon={faImage} /> Ảnh</span>}
                        <span className={`pp-queue-status ${p.status}`}>{p.status === 'scheduled' ? 'Đã lên lịch' : 'Nháp'}</span>
                      </div>
                    </div>
                    <div className="pp-queue-actions">
                      <button type="button" title="Sửa"><FontAwesomeIcon icon={faPen} /></button>
                      <button type="button" title="Xoá"><FontAwesomeIcon icon={faTrash} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PublishPlan;
