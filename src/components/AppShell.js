import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBoxesStacked,
  faCalendarDays,
  faComments,
  faNewspaper,
  faChartLine,
  faUsers,
  faVideo,
  faImage,
  faWandMagicSparkles,
  faBook,
  faCrown,
  faMoon,
  faSun,
  faSignOutAlt,
  faUser,
  faBars,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';

// Each item has an `activeOn` field: the route(s) on which THIS item is the
// primary highlight. Only one item should be active per route.
const NAV_SECTIONS = [
  {
    items: [
      { to: '/dashboard', icon: faBoxesStacked, label: 'Overview', activeOn: ['/dashboard', '/overview'] },
      { to: '/publish-plan', icon: faCalendarDays, label: 'Publish Plan', activeOn: ['/publish-plan'] },
      { to: '/feed', icon: faComments, label: 'Feed', activeOn: ['/feed'] },
      { to: '/prompts', icon: faNewspaper, label: 'Posts', activeOn: ['/prompts'] },
      { to: '/reports', icon: faChartLine, label: 'Reports', activeOn: ['/reports'] },
      { to: '/settings', icon: faUsers, label: 'Accounts', activeOn: ['/settings'] },
    ],
  },
];

const AI_STUDIO_ITEMS = [
  { to: '/ai-library', icon: faVideo, label: 'Create Video', activeOn: [], isAction: true },
  { to: '/create-image', icon: faImage, label: 'Create Image', activeOn: ['/create-image'] },
  { to: '/smart-prompt', icon: faWandMagicSparkles, label: 'Smart Prompt', activeOn: ['/smart-prompt'] },
  { to: '/ai-library', icon: faBook, label: 'AI Library', activeOn: ['/ai-library'] },
];

const ROUTE_TITLES = {
  '/dashboard': { title: 'Overview', sub: 'Tổng quan hoạt động AI Social của bạn trong 7 ngày qua.' },
  '/overview': { title: 'Overview', sub: 'Tổng quan hoạt động AI Social của bạn trong 7 ngày qua.' },
  '/feed': { title: 'Feed', sub: 'Bảng tin nội dung từ các kênh bạn quản lý.' },
  '/publish-plan': { title: 'Publish Plan', sub: 'Lịch đăng bài theo tuần và theo nền tảng.' },
  '/reports': { title: 'Reports', sub: 'Phân tích tương tác, lượt tiếp cận và hiệu suất nội dung.' },
  '/prompts': { title: 'Prompt Studio', sub: 'Lập kế hoạch, soạn và tinh chỉnh nội dung với AI.' },
  '/create-image': { title: 'Create Image', sub: 'Sinh ảnh AI từ prompt — chọn phong cách và tỉ lệ khung hình.' },
  '/smart-prompt': { title: 'Smart Prompt', sub: 'Trợ lý ý tưởng nội dung và template prompt.' },
  '/ai-library': { title: 'AI Library', sub: 'Duyệt, tìm và quản lý video/ảnh AI đã tạo.' },
  '/settings': { title: 'Connections', sub: 'Quản lý tài khoản mạng xã hội và tích hợp.' },
  '/profile': { title: 'Profile', sub: 'Thông tin tài khoản và tuỳ chọn.' },
};

const isMatch = (activeOn, pathname) => Array.isArray(activeOn) && activeOn.some((p) => pathname === p || pathname.startsWith(p + '/'));

const AppShell = ({ user, theme, onToggleTheme, onLogout, onCreateVideo, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const routeInfo = ROUTE_TITLES[location.pathname] || { title: 'AI Social', sub: '' };

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
          <Link to="/ai-library" className="app-brand-link" onClick={() => setMobileOpen(false)}>
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
              {section.items.map((item) => {
                const active = isMatch(item.activeOn, location.pathname);
                return (
                  <Link
                    key={item.label}
                    className={`app-nav-item${active ? ' active' : ''}`}
                    to={item.to}
                    onClick={(e) => handleNavClick(e, item.to)}
                  >
                    <FontAwesomeIcon icon={item.icon} /> <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}

          <div className="app-nav-group-label">AI Studio</div>
          <div className="app-nav-section">
            {AI_STUDIO_ITEMS.map((item) => {
              const active = isMatch(item.activeOn, location.pathname);
              return (
                <Link
                  key={item.label}
                  className={`app-nav-item${active ? ' active' : ''}`}
                  to={item.to}
                  onClick={(e) => {
                    if (item.isAction && onCreateVideo) {
                      e.preventDefault();
                      onCreateVideo();
                      navigate('/ai-library');
                    }
                    setMobileOpen(false);
                  }}
                >
                  <FontAwesomeIcon icon={item.icon} /> <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-pro-card">
            <FontAwesomeIcon icon={faCrown} className="app-pro-icon" />
            <div className="app-pro-text">
              <div className="app-pro-title">PRO Plan</div>
              <div className="app-pro-sub">Unlimited renders</div>
            </div>
            <button className="app-pro-btn" type="button">Upgrade</button>
          </div>
          <div className="app-sidebar-user">
            <img
              src={user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=ecebff&color=5047a8`}
              alt="Profile"
              className="app-sidebar-avatar"
            />
            <div className="app-sidebar-user-info">
              <div className="app-sidebar-user-name">{user?.name || 'User'}</div>
              <Link className="app-sidebar-user-link" to="/profile" onClick={() => setMobileOpen(false)}>View profile</Link>
            </div>
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
            <button className="app-icon-btn" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
            </button>
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
                      <FontAwesomeIcon icon={faUser} /> My Profile
                    </Link>
                    <div className="app-dropdown-divider" />
                    <button className="app-dropdown-item danger" type="button" onClick={() => { setMenuOpen(false); onLogout(); }}>
                      <FontAwesomeIcon icon={faSignOutAlt} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
