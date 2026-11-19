import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBoxesStacked,
  faCalendarDays,
  faComments,
  faRobot,
  faChartLine,
  faUsers,
  faVideo,
  faImage,
  faWandMagicSparkles,
  faLock,
  faSignInAlt,
  faCrown,
  faMoon,
  faSun,
  faSignOutAlt,
  faUser,
  faBars,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';

const NAV_LABELS = {
  overview: { vi: 'Tổng quan', en: 'Overview' },
  publish: { vi: 'Lịch đăng', en: 'Publish Plan' },
  feed: { vi: 'Bảng tin', en: 'Feed' },
  agents: { vi: 'Agent Builder', en: 'Agent Builder' },
  reports: { vi: 'Báo cáo', en: 'Reports' },
  accounts: { vi: 'Kết nối', en: 'Connections' },
  createImage: { vi: 'Tạo Ảnh', en: 'Create Image' },
  smartPrompt: { vi: 'Gợi ý thông minh', en: 'Smart Prompt' },
  library: { vi: 'Thư viện AI', en: 'AI Library' },
  content: { vi: 'TẠO NỘI DUNG', en: 'CREATE CONTENT' },
  manage: { vi: 'QUẢN LÝ & XUẤT BẢN', en: 'MANAGE & PUBLISH' },
  media: { vi: 'HÌNH ẢNH & VIDEO', en: 'IMAGE & VIDEO' },
  account: { vi: 'TÀI KHOẢN', en: 'ACCOUNT' },
};

// Menu follows the real content pipeline, top to bottom:
//   1. Overview (see the big picture)
//   2. CREATE CONTENT   — ideas first (Smart Prompt), then writing (Agent Builder)
//   3. MANAGE & PUBLISH — review posts (Feed), schedule them (Publish Plan), measure (Reports)
//   4. IMAGE & VIDEO    — supporting media produced last (Create Image → AI Library)
//   5. ACCOUNT          — connections
// Everything is FREE for guests (trial mode): the whole creation pipeline and
// the AI behind it run with a per-IP rate limit on the server. Only items with
// locked:true touch the user's real connected social accounts (publishing,
// connections), so those still show a lock badge and a "sign in to continue"
// interstitial instead of the page.
const NAV_SECTIONS = [
  {
    items: [
      { to: '/dashboard', icon: faBoxesStacked, labelKey: 'overview', activeOn: ['/dashboard', '/overview'] },
    ],
  },
  {
    labelKey: 'content',
    items: [
      { to: '/smart-prompt', icon: faWandMagicSparkles, labelKey: 'smartPrompt', activeOn: ['/smart-prompt'] },
      { to: '/prompts', icon: faRobot, labelKey: 'agents', activeOn: ['/prompts'] },
    ],
  },
  {
    labelKey: 'manage',
    items: [
      { to: '/feed', icon: faComments, labelKey: 'feed', activeOn: ['/feed'] },
      { to: '/publish-plan', icon: faCalendarDays, labelKey: 'publish', activeOn: ['/publish-plan'], locked: true },
      { to: '/reports', icon: faChartLine, labelKey: 'reports', activeOn: ['/reports'] },
    ],
  },
  {
    labelKey: 'media',
    items: [
      { to: '/create-image', icon: faImage, labelKey: 'createImage', activeOn: ['/create-image'] },
      { to: '/ai-library', icon: faVideo, labelKey: 'library', activeOn: ['/ai-library'] },
    ],
  },
  {
    labelKey: 'account',
    items: [
      { to: '/settings', icon: faUsers, labelKey: 'accounts', activeOn: ['/settings'], locked: true },
    ],
  },
];

const ROUTE_TITLES = {
  '/dashboard': {
    vi: { title: 'Tổng quan', sub: 'Hoạt động AI Social của bạn trong 7 ngày qua.' },
    en: { title: 'Overview', sub: 'Your AI Social activity over the last 7 days.' },
  },
  '/overview': {
    vi: { title: 'Tổng quan', sub: 'Hoạt động AI Social của bạn trong 7 ngày qua.' },
    en: { title: 'Overview', sub: 'Your AI Social activity over the last 7 days.' },
  },
  '/feed': {
    vi: { title: 'Bảng tin', sub: 'Nội dung từ các kênh bạn quản lý.' },
    en: { title: 'Feed', sub: 'Content from the channels you manage.' },
  },
  '/publish-plan': {
    vi: { title: 'Lịch đăng', sub: 'Lịch đăng bài theo tháng và theo nền tảng.' },
    en: { title: 'Publish Plan', sub: 'Monthly publishing calendar across platforms.' },
  },
  '/reports': {
    vi: { title: 'Báo cáo', sub: 'Phân tích tương tác, lượt tiếp cận và hiệu suất nội dung.' },
    en: { title: 'Reports', sub: 'Engagement, reach and content performance analytics.' },
  },
  '/prompts': {
    vi: { title: 'Agent Builder', sub: 'Dựng agent nội dung nhiều bước bằng wizard từng bước khép kín.' },
    en: { title: 'Agent Builder', sub: 'Build multi-step content agents with a guided, closed-loop wizard.' },
  },
  '/create-image': {
    vi: { title: 'Tạo Ảnh', sub: 'Ảnh AI thật từ prompt — ComfyUI, Pollinations, AI Horde hoặc poster dự phòng.' },
    en: { title: 'Create Image', sub: 'Real AI images from prompts — ComfyUI, Pollinations, AI Horde or poster fallback.' },
  },
  '/smart-prompt': {
    vi: { title: 'Gợi ý thông minh', sub: 'Trợ lý ý tưởng nội dung và template prompt.' },
    en: { title: 'Smart Prompt', sub: 'Content idea assistant and prompt templates.' },
  },
  '/ai-library': {
    vi: { title: 'Thư viện AI', sub: 'Tạo video slideshow từ kịch bản AI (ảnh từng cảnh ghép chuyển cảnh) và quản lý video/ảnh AI đã tạo.' },
    en: { title: 'AI Library', sub: 'Create slideshow videos from AI scripts (scene images stitched with transitions) and manage generated media.' },
  },
  '/settings': {
    vi: { title: 'Kết nối', sub: 'Quản lý tài khoản mạng xã hội và tích hợp.' },
    en: { title: 'Connections', sub: 'Manage social accounts and integrations.' },
  },
  '/profile': {
    vi: { title: 'Hồ sơ', sub: 'Thông tin tài khoản và tuỳ chọn.' },
    en: { title: 'Profile', sub: 'Account details and preferences.' },
  },
};

const isMatch = (activeOn, pathname) => Array.isArray(activeOn) && activeOn.some((p) => pathname === p || pathname.startsWith(p + '/'));

const AppShell = ({ user, theme, onToggleTheme, onLogout, children }) => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useLang();
  // Guest mode: signed-out visitors can browse the light pages for free; the
  // resource-heavy / account-related pages show a sign-in interstitial instead.
  const isGuest = !user;
  const loginHref = `/login?next=${encodeURIComponent(location.pathname)}`;
  const [guestBannerClosed, setGuestBannerClosed] = useState(() => {
    try { return sessionStorage.getItem('aiSocialGuestBanner') === '1'; } catch { return false; }
  });
  const dismissGuestBanner = () => {
    setGuestBannerClosed(true);
    try { sessionStorage.setItem('aiSocialGuestBanner', '1'); } catch { /* private mode */ }
  };
  // NAV_LABELS is keyed by labelKey with per-language values: { overview: {vi, en}, ... }
  const labelFor = (key) => NAV_LABELS[key]?.[lang] ?? NAV_LABELS[key]?.vi ?? '';

  const routeInfo = ROUTE_TITLES[location.pathname] ? ROUTE_TITLES[location.pathname][lang] : { title: 'AI Social', sub: '' };

  const handleNavClick = (e, to) => {
    if (to === location.pathname) {
      e.preventDefault();
    }
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {mobileOpen && <div className="app-shell-overlay" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`app-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="app-sidebar-brand">
          <Link to="/dashboard" className="app-brand-link" onClick={() => setMobileOpen(false)}>
            <span className="app-brand-mark"><img src={`${process.env.PUBLIC_URL || ''}/logo-mark.svg`} alt="AI Social logo" /></span>
            <span className="app-brand-text">AI Social</span>
          </Link>
          <button className="app-sidebar-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <nav className="app-nav">
          {NAV_SECTIONS.map((section, i) => (
            <div className="app-nav-section" key={i}>
              {section.labelKey && (
                <div className="app-nav-group-label">{labelFor(section.labelKey)}</div>
              )}
              {section.items.map((item) => {
                const active = isMatch(item.activeOn, location.pathname);
                return (
                  <Link
                    key={item.labelKey}
                    className={`app-nav-item${active ? ' active' : ''}`}
                    to={item.to}
                    onClick={(e) => handleNavClick(e, item.to)}
                  >
                    <FontAwesomeIcon icon={item.icon} /> <span>{labelFor(item.labelKey)}</span>
                    {isGuest && item.locked && <FontAwesomeIcon icon={faLock} className="app-nav-lock" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-pro-card">
            <FontAwesomeIcon icon={faCrown} className="app-pro-icon" />
            <div className="app-pro-text">
              <div className="app-pro-title">PRO</div>
              <div className="app-pro-sub">{lang === 'vi' ? 'Gói không giới hạn' : 'Unlimited renders'}</div>
            </div>
            <button className="app-pro-btn" type="button">{lang === 'vi' ? 'Nâng cấp' : 'Upgrade'}</button>
          </div>
          <div className="app-sidebar-user">
            {isGuest ? (
              <>
                <span className="app-sidebar-avatar app-guest-avatar"><FontAwesomeIcon icon={faUser} /></span>
                <div className="app-sidebar-user-info">
                  <div className="app-sidebar-user-name">{lang === 'vi' ? 'Khách' : 'Guest'}</div>
                  <Link className="app-sidebar-user-link" to={loginHref}>{lang === 'vi' ? 'Đăng nhập để đăng bài' : 'Sign in to publish'}</Link>
                </div>
              </>
            ) : (
              <>
                <img
                  src={user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=ecebff&color=5047a8`}
                  alt="Profile"
                  className="app-sidebar-avatar"
                />
                <div className="app-sidebar-user-info">
                  <div className="app-sidebar-user-name">{user?.name || 'User'}</div>
                  <Link className="app-sidebar-user-link" to="/profile" onClick={() => setMobileOpen(false)}>{lang === 'vi' ? 'Xem hồ sơ' : 'View profile'}</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="app-main-col">
        <header className="app-topbar">
          <button className="app-menu-btn" type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <FontAwesomeIcon icon={faBars} />
          </button>
          <div className="app-topbar-title">
            <h1>{routeInfo.title}</h1>
            {routeInfo.sub && <p>{routeInfo.sub}</p>}
          </div>
          <div className="app-topbar-actions">
            <div className="app-lang-toggle" role="group" aria-label="Language / Ngôn ngữ">
              <button type="button" className={lang === 'vi' ? 'active' : ''} onClick={() => setLang('vi')}>VI</button>
              <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
            <button className="app-icon-btn" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
            </button>
            {isGuest ? (
              <Link className="app-login-btn" to={loginHref}>
                <FontAwesomeIcon icon={faSignInAlt} /> {lang === 'vi' ? 'Đăng nhập' : 'Sign in'}
              </Link>
            ) : (
            <div className={`app-user-menu${menuOpen ? ' open' : ''}`}>
              <button className="app-user-trigger" type="button" onClick={() => setMenuOpen((v) => !v)}>
                <img
                  src={user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=ecebff&color=5047a8`}
                  alt="Profile"
                  className="app-user-avatar"
                />
                <span className="app-user-name">{user?.name || 'User'}</span>
              </button>
              {menuOpen && (
                <>
                  <div className="app-menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="app-user-dropdown">
                    <Link to="/profile" onClick={() => setMenuOpen(false)} className="app-dropdown-item">
                      <FontAwesomeIcon icon={faUser} /> {lang === 'vi' ? 'Hồ sơ của tôi' : 'My Profile'}
                    </Link>
                    <div className="app-dropdown-divider" />
                    <button className="app-dropdown-item danger" type="button" onClick={() => { setMenuOpen(false); onLogout(); }}>
                      <FontAwesomeIcon icon={faSignOutAlt} /> {lang === 'vi' ? 'Đăng xuất' : 'Logout'}
                    </button>
                  </div>
                </>
              )}
            </div>
            )}
          </div>
        </header>

        {isGuest && !guestBannerClosed && (
          <div className="app-guest-banner">
            <FontAwesomeIcon icon={faWandMagicSparkles} className="app-guest-banner-icon" />
            <div className="app-guest-banner-text">
              {lang === 'vi'
                ? <>Bạn đang <b>dùng thử</b> — toàn bộ tính năng AI (gợi ý, agent, ảnh, video) mở miễn phí. Chỉ <b>đăng bài &amp; kết nối tài khoản</b> cần <b>đăng nhập</b>.</>
                : <>You are in <b>trial mode</b> — every AI feature (ideas, agents, images, video) is free to try. Only <b>publishing &amp; accounts</b> need <b>sign-in</b>.</>}
            </div>
            <Link className="app-login-btn app-guest-banner-btn" to={loginHref}>{lang === 'vi' ? 'Đăng nhập' : 'Sign in'}</Link>
            <button className="app-guest-banner-close" type="button" onClick={dismissGuestBanner} aria-label={lang === 'vi' ? 'Ẩn thông báo' : 'Dismiss notice'}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        )}

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
