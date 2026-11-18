import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUp,
  faArrowDown,
  faEye,
  faHeart,
  faShare,
  faUsers,
  faImage,
  faVideo,
} from '@fortawesome/free-solid-svg-icons';

// 12-week engagement series for the line chart.
const ENGAGEMENT_SERIES = [
  { label: 'T1', value: 4200 },
  { label: 'T2', value: 4800 },
  { label: 'T3', value: 4500 },
  { label: 'T4', value: 5300 },
  { label: 'T5', value: 6100 },
  { label: 'T6', value: 5800 },
  { label: 'T7', value: 7200 },
  { label: 'T8', value: 8100 },
  { label: 'T9', value: 7600 },
  { label: 'T10', value: 8900 },
  { label: 'T11', value: 9400 },
  { label: 'T12', value: 10200 },
];

const PLATFORM_BREAKDOWN = [
  { label: 'Facebook', value: 42, color: '#1877f2' },
  { label: 'Instagram', value: 28, color: '#e1306c' },
  { label: 'TikTok', value: 18, color: '#25f4ee' },
  { label: 'Threads', value: 12, color: '#888' },
];

const TOP_CONTENT = [
  { id: 1, type: 'video', title: 'Lantern festival in Hoi An ancient town', platform: 'instagram', views: '24.5K', likes: 4120, comments: 287, shares: 156 },
  { id: 2, type: 'image', title: 'Phở bò — đặc sản Việt', platform: 'facebook', views: '18.2K', likes: 3290, comments: 145, shares: 98 },
  { id: 3, type: 'video', title: 'Hanoi train street at golden hour', platform: 'tiktok', views: '32.1K', likes: 5800, comments: 412, shares: 245 },
  { id: 4, type: 'image', title: 'Bowl of pho with steam rising', platform: 'instagram', views: '12.7K', likes: 2480, comments: 96, shares: 54 },
];

const RANGE_OPTIONS = ['7 ngày', '30 ngày', '12 tuần', 'Năm nay'];

const StatTile = ({ icon, label, value, delta, dir }) => (
  <div className="rp-stat-tile">
    <div className="rp-stat-icon"><FontAwesomeIcon icon={icon} /></div>
    <div className="rp-stat-body">
      <span className="rp-stat-label">{label}</span>
      <span className="rp-stat-value">{value}</span>
      <span className={`rp-stat-delta ${dir}`}>
        <FontAwesomeIcon icon={dir === 'up' ? faArrowUp : faArrowDown} /> {delta}
      </span>
    </div>
  </div>
);

const Reports = () => {
  const [range, setRange] = useState('12 tuần');

  // Build SVG polyline points for engagement chart.
  const linePoints = useMemo(() => {
    const w = 100, h = 100;
    const max = Math.max(...ENGAGEMENT_SERIES.map((s) => s.value));
    const min = Math.min(...ENGAGEMENT_SERIES.map((s) => s.value));
    const span = max - min || 1;
    return ENGAGEMENT_SERIES.map((s, i) => {
      const x = (i / (ENGAGEMENT_SERIES.length - 1)) * w;
      const y = h - ((s.value - min) / span) * (h - 10) - 5;
      return `${x},${y}`;
    }).join(' ');
  }, []);

  const areaPoints = `0,100 ${linePoints} 100,100`;

  const totalReach = '128.4K';
  const engagementRate = '6.8%';
  const followers = '12.4K';
  const impressions = '512K';

  return (
    <div className="rp-page">
      <div className="rp-toolbar">
        <div className="rp-range">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={range === r ? 'active' : ''}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <button type="button" className="rp-export">Xuất CSV</button>
      </div>

      <div className="rp-stats-grid">
        <StatTile icon={faEye} label="Lượt tiếp cận" value={totalReach} delta="+18%" dir="up" />
        <StatTile icon={faHeart} label="Tỷ lệ tương tác" value={engagementRate} delta="+0.6 pp" dir="up" />
        <StatTile icon={faUsers} label="Người theo dõi" value={followers} delta="+1.2K" dir="up" />
        <StatTile icon={faShare} label="Lượt hiển thị" value={impressions} delta="-3%" dir="down" />
      </div>

      <div className="rp-grid-2">
        <section className="rp-card rp-line-card">
          <header className="rp-card-head">
            <div>
              <h3>Xu hướng tương tác</h3>
              <p className="muted">Lượt thích + bình luận + chia sẻ trong {range.toLowerCase()}</p>
            </div>
          </header>
          <div className="rp-line-chart">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="rp-line-svg">
              <defs>
                <linearGradient id="rpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6158d9" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#6158d9" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={areaPoints} fill="url(#rpFill)" />
              <polyline points={linePoints} fill="none" stroke="#6158d9" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {linePoints.split(' ').map((pt, i) => {
                const [x, y] = pt.split(',');
                return <circle key={i} cx={x} cy={y} r="0.8" fill="#6158d9" vectorEffect="non-scaling-stroke" />;
              })}
            </svg>
            <div className="rp-line-xaxis">
              {ENGAGEMENT_SERIES.map((s) => <span key={s.label}>{s.label}</span>)}
            </div>
          </div>
        </section>

        <section className="rp-card rp-donut-card">
          <header className="rp-card-head">
            <div>
              <h3>Theo nền tảng</h3>
              <p className="muted">Phân bổ tương tác theo kênh</p>
            </div>
          </header>
          <div className="rp-donut-wrap">
            <svg viewBox="0 0 42 42" className="rp-donut">
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#ece9f5" strokeWidth="6" />
              {(() => {
                let offset = 25;
                return PLATFORM_BREAKDOWN.map((p) => {
                  const dash = `${p.value} ${100 - p.value}`;
                  const el = (
                    <circle
                      key={p.label}
                      cx="21" cy="21" r="15.915"
                      fill="transparent"
                      stroke={p.color}
                      strokeWidth="6"
                      strokeDasharray={dash}
                      strokeDashoffset={offset}
                    />
                  );
                  offset -= p.value;
                  return el;
                });
              })()}
            </svg>
            <div className="rp-donut-center">
              <strong>100%</strong>
              <small>tương tác</small>
            </div>
          </div>
          <ul className="rp-donut-legend">
            {PLATFORM_BREAKDOWN.map((p) => (
              <li key={p.label}>
                <span><i style={{ background: p.color }} /> {p.label}</span>
                <strong>{p.value}%</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rp-card rp-top-card">
        <header className="rp-card-head">
          <div>
            <h3>Nội dung nổi bật</h3>
            <p className="muted">Top 4 bài có tương tác cao nhất trong {range.toLowerCase()}</p>
          </div>
        </header>
        <div className="rp-top-table">
          <div className="rp-top-row rp-top-head">
            <span>Nội dung</span>
            <span>Nền tảng</span>
            <span>Hiển thị</span>
            <span>Thích</span>
            <span>BL</span>
            <span>Chia sẻ</span>
          </div>
          {TOP_CONTENT.map((c) => (
            <div key={c.id} className="rp-top-row">
              <span className="rp-top-title">
                <FontAwesomeIcon icon={c.type === 'video' ? faVideo : faImage} className="rp-top-type-icon" />
                {c.title}
              </span>
              <span className="rp-top-platform">{c.platform}</span>
              <span>{c.views}</span>
              <span>{c.likes.toLocaleString()}</span>
              <span>{c.comments}</span>
              <span>{c.shares}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Reports;
