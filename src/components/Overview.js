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
  faRobot,
  faBolt,
  faClock,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';

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

const DAY_LABELS = {
  Mon: { vi: 'T2', en: 'Mon' }, Tue: { vi: 'T3', en: 'Tue' }, Wed: { vi: 'T4', en: 'Wed' },
  Thu: { vi: 'T5', en: 'Thu' }, Fri: { vi: 'T6', en: 'Fri' }, Sat: { vi: 'T7', en: 'Sat' },
  Sun: { vi: 'CN', en: 'Sun' },
};

const StatCard = ({ icon, label, value, delta, deltaDir, accent, weekNote }) => {
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
          {delta} <span className="muted">{weekNote}</span>
        </span>
      </div>
    </div>
  );
};

const Overview = ({ user }) => {
  const [lang] = useLang();
  const vi = lang !== 'en';
  const t = {
    eyebrow: vi ? 'TỔNG QUAN' : 'OVERVIEW',
    greetSub: vi ? 'Đây là hoạt động AI Social của bạn trong 7 ngày qua.' : 'Here is your AI Social activity over the last 7 days.',
    newContent: vi ? 'Tạo nội dung mới' : 'Create new content',
    statVideos: vi ? 'Video đã tạo' : 'Videos created',
    statImages: vi ? 'Ảnh đã tạo' : 'Images created',
    statScheduled: vi ? 'Bài đã lên lịch' : 'Posts scheduled',
    statFollowers: vi ? 'Người theo dõi' : 'Followers',
    weekNote: vi ? 'tuần này' : 'this week',
    chartTitle: vi ? 'Hoạt động 7 ngày' : '7-day activity',
    chartSub: vi ? 'Tổng số video, ảnh và bài đăng đã tạo' : 'Total videos, images and posts created',
    legendVideos: vi ? 'Video' : 'Video',
    legendImages: vi ? 'Ảnh' : 'Images',
    legendPosts: vi ? 'Bài đăng' : 'Posts',
    recentTitle: vi ? 'Hoạt động gần đây' : 'Recent activity',
    recentSub: vi ? 'Mọi tạo tác AI và bài đăng của bạn' : 'Every AI artefact and post of yours',
    seeAll: vi ? 'Xem tất cả' : 'See all',
    quickTitle: vi ? 'Bắt đầu nhanh' : 'Quick start',
    quickSub: vi ? 'Theo đúng quy trình 4 bước: nội dung → ảnh → video → đăng' : 'Follow the 4-step flow: content → images → video → publish',
    qSmart: vi ? 'Ý tưởng nội dung tức thì' : 'Instant content ideas',
    qAgent: vi ? 'Viết bài tự động theo kịch bản' : 'Automated multi-step writing',
    qImage: vi ? 'Sinh ảnh từ prompt (bước 3)' : 'AI images from prompts (step 3)',
    qVideo: vi ? 'Tạo video slideshow bằng AI (bước 4)' : 'AI slideshow video (step 4)',
    qPublish: vi ? 'Lên lịch đăng bài' : 'Schedule & publish',
  };
  const maxActivity = useMemo(() => {
    return Math.max(...WEEK_ACTIVITY.map((d) => d.videos + d.images + d.posts), 1);
  }, []);

  return (
    <div className="ov-page">
      {/* Greeting */}
      <div className="ov-greeting">
        <div>
          <span className="eyebrow">{t.eyebrow}</span>
          <h2>{vi ? 'Xin chào' : 'Hello'}, {user?.name || 'User'} 👋</h2>
          <p className="ov-greeting-sub">{t.greetSub}</p>
        </div>
        <Link to="/smart-prompt" className="ov-cta">
          <FontAwesomeIcon icon={faBolt} /> {t.newContent}
        </Link>
      </div>

      {/* Stat cards */}
      <div className="ov-stats-grid">
        <StatCard icon={faVideo} label={t.statVideos} value="41" delta="+12%" deltaDir="up" accent="#6158d9" weekNote={t.weekNote} />
        <StatCard icon={faImage} label={t.statImages} value="89" delta="+8%" deltaDir="up" accent="#e0653f" weekNote={t.weekNote} />
        <StatCard icon={faCalendarCheck} label={t.statScheduled} value="23" delta="+5%" deltaDir="up" accent="#2aa17a" weekNote={t.weekNote} />
        <StatCard icon={faUsers} label={t.statFollowers} value="12.4K" delta="-2%" deltaDir="down" accent="#d4a52e" weekNote={t.weekNote} />
      </div>

      {/* Activity chart + recent */}
      <div className="ov-grid-2">
        <section className="ov-card ov-chart-card">
          <header className="ov-card-head">
            <div>
              <h3>{t.chartTitle}</h3>
              <p className="muted">{t.chartSub}</p>
            </div>
            <div className="ov-chart-legend">
              <span><i style={{ background: '#6158d9' }} /> {t.legendVideos}</span>
              <span><i style={{ background: '#e0653f' }} /> {t.legendImages}</span>
              <span><i style={{ background: '#2aa17a' }} /> {t.legendPosts}</span>
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
                  <div className="ov-chart-bar" style={{ height: `${h}%` }} title={`${d.day}: ${total}`}>
                    <div style={{ height: `${(vH / h) * 100}%`, background: '#6158d9' }} />
                    <div style={{ height: `${(iH / h) * 100}%`, background: '#e0653f' }} />
                    <div style={{ height: `${(pH / h) * 100}%`, background: '#2aa17a' }} />
                  </div>
                  <span className="ov-chart-day">{DAY_LABELS[d.day]?.[lang] || d.day}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ov-card ov-activity-card">
          <header className="ov-card-head">
            <div>
              <h3>{t.recentTitle}</h3>
              <p className="muted">{t.recentSub}</p>
            </div>
            <Link to="/feed" className="ov-link">{t.seeAll}</Link>
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
            <h3>{t.quickTitle}</h3>
            <p className="muted">{t.quickSub}</p>
          </div>
        </header>
        <div className="ov-quick-grid">
          {/* EXACTLY the 4-step wizard order, then the publishing step:
              1 Smart Prompt -> 2 Agent Builder -> 3 Create Image ->
              4 AI Library video -> Publish Plan (login required). */}
          <Link to="/smart-prompt" className="ov-quick-item">
            <FontAwesomeIcon icon={faWandMagicSparkles} />
            <strong>Smart Prompt</strong>
            <small>{t.qSmart}</small>
          </Link>
          <Link to="/prompts" className="ov-quick-item">
            <FontAwesomeIcon icon={faRobot} />
            <strong>Agent Builder</strong>
            <small>{t.qAgent}</small>
          </Link>
          <Link to="/create-image" className="ov-quick-item">
            <FontAwesomeIcon icon={faImage} />
            <strong>Create Image</strong>
            <small>{t.qImage}</small>
          </Link>
          <Link to="/ai-library" className="ov-quick-item">
            <FontAwesomeIcon icon={faVideo} />
            <strong>Create Video</strong>
            <small>{t.qVideo}</small>
          </Link>
          <Link to="/publish-plan" className="ov-quick-item">
            <FontAwesomeIcon icon={faCalendarCheck} />
            <strong>Publish Plan</strong>
            <small>{t.qPublish}</small>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Overview;
