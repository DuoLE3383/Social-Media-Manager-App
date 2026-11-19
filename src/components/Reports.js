import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  faDna,
  faDownload,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';

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
  const navigate = useNavigate();
  const [lang] = useLang();
  const vi = lang !== 'en';
  const T = {
    ranges: vi ? ['7 ngày', '30 ngày', '12 tuần', 'Năm nay'] : ['7 days', '30 days', '12 weeks', 'This year'],
    exportCsv: vi ? 'Xuất CSV' : 'Export CSV',
    reach: vi ? 'Lượt tiếp cận' : 'Reach',
    engagement: vi ? 'Tỷ lệ tương tác' : 'Engagement rate',
    followers: vi ? 'Người theo dõi' : 'Followers',
    impressions: vi ? 'Lượt hiển thị' : 'Impressions',
    trendTitle: vi ? 'Xu hướng tương tác' : 'Engagement trend',
    trendSub: (r) => vi ? `Lượt thích + bình luận + chia sẻ trong ${r.toLowerCase()}` : `Likes + comments + shares in ${r.toLowerCase()}`,
    platformTitle: vi ? 'Theo nền tảng' : 'By platform',
    platformSub: vi ? 'Phân bổ tương tác theo kênh' : 'Engagement split by channel',
    topTitle: vi ? 'Nội dung nổi bật' : 'Top content',
    topSub: (r) => vi ? `Top 4 bài có tương tác cao nhất trong ${r.toLowerCase()}` : `Top 4 posts by engagement in ${r.toLowerCase()}`,
    colContent: vi ? 'Nội dung' : 'Content',
    colPlatform: vi ? 'Nền tảng' : 'Platform',
    colViews: vi ? 'Hiển thị' : 'Views',
    colLikes: vi ? 'Thích' : 'Likes',
    colComments: vi ? 'BL' : 'Comm.',
    colShares: vi ? 'Chia sẻ' : 'Shares',
    evolveTitle: vi ? 'Tiến hoá Agent từ kết quả này' : 'Evolve your Agent from these results',
    evolveSub: vi ? 'AI phân tích số liệu bài đăng (hiển thị, thích, chia sẻ…) rồi tự nâng cấp agent: viết lại prompt, rút gọn hook, tập trung CTA.' : 'The AI analyses post metrics (views, likes, shares…) and upgrades the agent itself: rewritten prompts, tighter hooks, sharper CTAs.',
    evolveBtn: vi ? 'Tiến hoá Agent — bước tiếp theo →' : 'Evolve Agent — the next step →',
    evolveNote: vi ? 'Mở tab "Tiến hoá Agent" với số liệu dưới đây đã điền sẵn.' : 'Opens the "Evolve Agent" tab with these metrics prefilled.',
    sampleWarn: vi ? 'Số liệu đang là dữ liệu mẫu. Kết nối kênh thật ở trang Kết nối để có số liệu thật.' : 'Metrics are sample data. Connect real channels in Connections to see real data.',
    csvDone: vi ? 'Đã tải file CSV' : 'CSV downloaded',
  };
  const [range, setRange] = useState(T.ranges[2]);
  const [toast, setToast] = useState('');
  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(''), 2200);
  };

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

  // Real CSV export of the stats + top-content table (was a dead button).
  const exportCsv = () => {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [];
    rows.push([T.reach, T.engagement, T.followers, T.impressions].map(esc).join(','));
    rows.push([totalReach, engagementRate, followers, impressions].map(esc).join(','));
    rows.push('');
    rows.push([T.colContent, T.colPlatform, T.colViews, T.colLikes, T.colComments, T.colShares].map(esc).join(','));
    TOP_CONTENT.forEach((c) => rows.push([c.title, c.platform, c.views, c.likes, c.comments, c.shares].map(esc).join(',')));
    const blob = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-social-report.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast(T.csvDone);
  };

  // The user's requested loop: after analysing publishing results, hand the
  // metrics to the Agent Evolution panel (prefilled) so the agent can improve
  // itself from real data. S7: also send the most recently used agentId so the
  // Evolve panel picks the right agent automatically (instead of always
  // defaulting to agents[0]).
  const evolveFromResults = () => {
    const metrics = TOP_CONTENT.map((c, i) => {
      const viLine = `Bài ${i + 1} (${c.platform}, ${c.type === 'video' ? 'video' : 'ảnh'}): "${c.title}" — ${c.views} hiển thị, ${c.likes.toLocaleString('vi-VN')} thích, ${c.comments} bình luận, ${c.shares} chia sẻ`;
      const enLine = `Post ${i + 1} (${c.platform}, ${c.type === 'video' ? 'video' : 'image'}): "${c.title}" — ${c.views} views, ${c.likes.toLocaleString('en-US')} likes, ${c.comments} comments, ${c.shares} shares`;
      return vi ? viLine : enLine;
    }).join('\n');
    let agentId = null;
    try {
      const agents = JSON.parse(localStorage.getItem('aiSocialAgents') || '[]');
      if (Array.isArray(agents) && agents.length) {
        // Most recently added/edited user agent is at the end of the array.
        agentId = agents[agents.length - 1]?.id || null;
      }
    } catch { /* ignore */ }
    try {
      sessionStorage.setItem('aiSocialEvolveHandoff', JSON.stringify({ results: metrics, agentId, ts: Date.now() }));
    } catch { /* ignore */ }
    navigate('/prompts?tab=evolve');
  };

  return (
    <div className="rp-page">
      <div className="rp-sample-notice" role="note">
        <FontAwesomeIcon icon={faTriangleExclamation} />
        <span>{T.sampleWarn}</span>
      </div>
      <div className="rp-toolbar">
        <div className="rp-range">
          {T.ranges.map((r) => (
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
        <button type="button" className="rp-export" onClick={exportCsv}>
          <FontAwesomeIcon icon={faDownload} /> {T.exportCsv}
        </button>
      </div>

      <div className="rp-stats-grid">
        <StatTile icon={faEye} label={T.reach} value={totalReach} delta="+18%" dir="up" />
        <StatTile icon={faHeart} label={T.engagement} value={engagementRate} delta="+0.6 pp" dir="up" />
        <StatTile icon={faUsers} label={T.followers} value={followers} delta="+1.2K" dir="up" />
        <StatTile icon={faShare} label={T.impressions} value={impressions} delta="-3%" dir="down" />
      </div>

      <div className="rp-grid-2">
        <section className="rp-card rp-line-card">
          <header className="rp-card-head">
            <div>
              <h3>{T.trendTitle}</h3>
              <p className="muted">{T.trendSub(range)}</p>
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
              <h3>{T.platformTitle}</h3>
              <p className="muted">{T.platformSub}</p>
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
              <small>{vi ? 'tương tác' : 'engagement'}</small>
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
            <h3>{T.topTitle}</h3>
            <p className="muted">{T.topSub(range)}</p>
          </div>
        </header>
        <div className="rp-top-table">
          <div className="rp-top-row rp-top-head">
            <span>{T.colContent}</span>
            <span>{T.colPlatform}</span>
            <span>{T.colViews}</span>
            <span>{T.colLikes}</span>
            <span>{T.colComments}</span>
            <span>{T.colShares}</span>
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

      {/* Close the loop: analyse publishing results -> evolve the agent. */}
      <section className="rp-card rp-evolve-card">
        <span className="rp-evolve-icon"><FontAwesomeIcon icon={faDna} /></span>
        <div className="rp-evolve-body">
          <h3>{T.evolveTitle}</h3>
          <p className="muted">{T.evolveSub}</p>
        </div>
        <button type="button" className="rp-evolve-btn" onClick={evolveFromResults} title={T.evolveNote}>
          <FontAwesomeIcon icon={faDna} /> {T.evolveBtn}
        </button>
      </section>

      {toast && <div className="ai-toast">{toast}</div>}
    </div>
  );
};

export default Reports;
