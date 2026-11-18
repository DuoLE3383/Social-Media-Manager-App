import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faVideo,
  faImage,
  faCalendarCheck,
  faUsers,
  faArrowUp,
  faArrowDown,
  faWandMagicSparkles,
  faBolt,
  faClock,
} from '@fortawesome/free-solid-svg-icons';

// Sample 7-day activity series (vertical bars in Overview chart).
const WEEK_ACTIVITY = [
  { day: 'Mon', videos: 4, images: 12, posts: 8 },
  { day: 'Tue', videos: 6, images: 9, posts: 5 },
  { day: 'Wed', videos: 2, images: 15, posts: 7 },
  { day: 'Thu', videos: 8, images: 11, posts: 6 },
  { day: 'Fri', videos: 5, images: 14, posts: 9 },
  { day: 'Sat', videos: 9, images: 18, posts: 4 },
  { day: 'Sun', videos: 7, images: 10, posts: 6 },
];

const RECENT_ACTIVITY = [
  { id: 1, type: 'video', title: 'Generated video: "Orange cat on Hanoi old quarter street"', time: '12 phút trước', icon: faVideo, color: '#6158d9' },
  { id: 2, type: 'image', title: 'Created 4 images for "Phở ad campaign"', time: '48 phút trước', icon: faImage, color: '#e0653f' },
  { id: 3, type: 'schedule', title: 'Scheduled post to Facebook Page "Cà phê Sài Gòn"', time: '2 giờ trước', icon: faCalendarCheck, color: '#2aa17a' },
  { id: 4, type: 'prompt', title: 'Saved prompt: "Caption Hành trình cà phê Việt"', time: '5 giờ trước', icon: faWandMagicSparkles, color: '#d4a52e' },
  { id: 5, type: 'video', title: 'Generated video: "Lantern festival in Hoi An"', time: 'Hôm qua', icon: faVideo, color: '#6158d9' },
];

const StatCard = ({ icon, label, value, delta, deltaDir, accent }) => {
  const isUp = deltaDir === 'up';
  return (
    <div className="ov-stat-card" style={{ '--accent': accent }}>
      <div className="ov-stat-icon">
        <FontAwesomeIcon icon={icon} />
      </div>
      <div className="ov-stat-body">
        <span className="ov-stat-label">{label}</span>
        <span className="ov-stat-value">{value}</span>
        <span className={`ov-stat-delta ${isUp ? 'up' : 'down'}`}>
          <FontAwesomeIcon icon={isUp ? faArrowUp : faArrowDown} />
          {delta} <span className="muted">tuần này</span>
        </span>
      </div>
    </div>
  );
};

const Overview = ({ user }) => {
  const maxActivity = useMemo(() => {
    return Math.max(...WEEK_ACTIVITY.map((d) => d.videos + d.images + d.posts), 1);
  }, []);

  return (
    <div className="ov-page">
      {/* Greeting */}
      <div className="ov-greeting">
        <div>
          <span className="eyebrow">TỔNG QUAN</span>
          <h2>Xin chào, {user?.name || 'User'} 👋</h2>
          <p className="ov-greeting-sub">Đây là hoạt động AI Social của bạn trong 7 ngày qua.</p>
        </div>
        <Link to="/create-image" className="ov-cta">
          <FontAwesomeIcon icon={faBolt} /> Tạo nội dung mới
        </Link>
      </div>

      {/* Stat cards */}
      <div className="ov-stats-grid">
        <StatCard icon={faVideo} label="Video đã tạo" value="41" delta="+12%" deltaDir="up" accent="#6158d9" />
        <StatCard icon={faImage} label="Ảnh đã tạo" value="89" delta="+8%" deltaDir="up" accent="#e0653f" />
        <StatCard icon={faCalendarCheck} label="Bài đã lên lịch" value="23" delta="+5%" deltaDir="up" accent="#2aa17a" />
        <StatCard icon={faUsers} label="Người theo dõi" value="12.4K" delta="-2%" deltaDir="down" accent="#d4a52e" />
      </div>

      {/* Activity chart + recent */}
      <div className="ov-grid-2">
        <section className="ov-card ov-chart-card">
          <header className="ov-card-head">
            <div>
              <h3>Hoạt động 7 ngày</h3>
              <p className="muted">Tổng số video, ảnh và bài đăng đã tạo</p>
            </div>
            <div className="ov-chart-legend">
              <span><i style={{ background: '#6158d9' }} /> Video</span>
              <span><i style={{ background: '#e0653f' }} /> Ảnh</span>
              <span><i style={{ background: '#2aa17a' }} /> Bài đăng</span>
            </div>
          </header>
          <div className="ov-chart">
            {WEEK_ACTIVITY.map((d) => {
              const total = d.videos + d.images + d.posts;
              const h = (total / maxActivity) * 100;
              const vH = (d.videos / total) * h;
              const iH = (d.images / total) * h;
              const pH = (d.posts / total) * h;
              return (
                <div className="ov-chart-bar-wrap" key={d.day}>
                  <div className="ov-chart-bar" style={{ height: `${h}%` }} title={`${d.day}: ${total} mục`}>
                    <div style={{ height: `${(vH / h) * 100}%`, background: '#6158d9' }} />
                    <div style={{ height: `${(iH / h) * 100}%`, background: '#e0653f' }} />
                    <div style={{ height: `${(pH / h) * 100}%`, background: '#2aa17a' }} />
                  </div>
                  <span className="ov-chart-day">{d.day}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ov-card ov-activity-card">
          <header className="ov-card-head">
            <div>
              <h3>Hoạt động gần đây</h3>
              <p className="muted">Mọi tạo tác AI và bài đăng của bạn</p>
            </div>
            <Link to="/feed" className="ov-link">Xem tất cả</Link>
          </header>
          <ul className="ov-activity-list">
            {RECENT_ACTIVITY.map((a) => (
              <li key={a.id} className="ov-activity-item">
                <span className="ov-activity-icon" style={{ background: `${a.color}22`, color: a.color }}>
                  <FontAwesomeIcon icon={a.icon} />
                </span>
                <div className="ov-activity-text">
                  <p>{a.title}</p>
                  <small><FontAwesomeIcon icon={faClock} /> {a.time}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Quick actions */}
      <section className="ov-card ov-quick-card">
        <header className="ov-card-head">
          <div>
            <h3>Bắt đầu nhanh</h3>
            <p className="muted">Truy cập nhanh các công cụ AI</p>
          </div>
        </header>
        <div className="ov-quick-grid">
          <Link to="/ai-library" className="ov-quick-item">
            <FontAwesomeIcon icon={faVideo} />
            <strong>Create Video</strong>
            <small>Tạo video 9:16 bằng AI</small>
          </Link>
          <Link to="/create-image" className="ov-quick-item">
            <FontAwesomeIcon icon={faImage} />
            <strong>Create Image</strong>
            <small>Sinh ảnh từ prompt</small>
          </Link>
          <Link to="/smart-prompt" className="ov-quick-item">
            <FontAwesomeIcon icon={faWandMagicSparkles} />
            <strong>Smart Prompt</strong>
            <small>Ý tưởng nội dung tức thì</small>
          </Link>
          <Link to="/publish-plan" className="ov-quick-item">
            <FontAwesomeIcon icon={faCalendarCheck} />
            <strong>Publish Plan</strong>
            <small>Lên lịch đăng bài</small>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Overview;
