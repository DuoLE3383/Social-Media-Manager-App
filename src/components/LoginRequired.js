import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLock,
  faCalendarDays,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';

const PAGE_ICONS = {
  publish: faCalendarDays,
  accounts: faUsers,
};

// Copy for the "sign in to continue" interstitial. Since the whole creation
// pipeline (Smart Prompt, Agent Builder, image & video) is FREE for guests,
// only publishing and account pages are gated: they operate on the user's real
// connected social accounts, so an account is required there.
const T = {
  vi: {
    title: 'Đăng nhập để đăng bài & kết nối tài khoản',
    signin: 'Đăng nhập',
    back: 'Về Tổng quan',
    freeIntro: 'Toàn bộ tính năng AI (gợi ý prompt, Agent Builder, tiến hoá agent, tạo ảnh, tạo video) đang mở cho khách dùng thử miễn phí. Tính năng này thao tác trên tài khoản mạng xã hội thật nên cần đăng nhập để bảo vệ bạn.',
    benefitsTitle: 'Đăng nhập để mở khoá:',
    benefits: [
      'Kết nối tài khoản mạng xã hội (Threads, Facebook)',
      'Lên lịch đăng bài & phát hành tự động',
      'Đăng bài trực tiếp lên kênh đã kết nối',
      'Dữ liệu thật thay vì dữ liệu mẫu',
    ],
    reasons: {
      publish: 'Đăng bài hoạt động cùng tài khoản mạng xã hội bạn kết nối — cần đăng nhập để bảo vệ tài khoản của bạn.',
      accounts: 'Trang này quản lý tài khoản mạng xã hội và tích hợp của bạn.',
    },
  },
  en: {
    title: 'Sign in to publish & connect accounts',
    signin: 'Sign in',
    back: 'Back to Overview',
    freeIntro: 'Every AI feature (prompt ideas, Agent Builder, agent evolution, image & video) is free to try as a guest. This page operates on your real social accounts, so it needs sign-in to protect you.',
    benefitsTitle: 'Sign in to unlock:',
    benefits: [
      'Connect social accounts (Threads, Facebook)',
      'Schedule posts & publish automatically',
      'Publish directly to connected channels',
      'Real data instead of sample data',
    ],
    reasons: {
      publish: 'Publishing works with the social accounts you connect — sign-in keeps your accounts safe.',
      accounts: 'This page manages your social accounts and integrations.',
    },
  },
};

// Shown in place of a gated page (publishing / accounts) when the visitor is
// not signed in.
export default function LoginRequired({ page = 'publish' }) {
  const [lang] = useLang();
  const t = T[lang] || T.vi;
  const location = useLocation();
  const next = encodeURIComponent(location.pathname + location.search);
  return (
    <div className="gated-wrap">
      <div className="gated-card">
        <div className="gated-icon"><FontAwesomeIcon icon={PAGE_ICONS[page] || faLock} /></div>
        <div className="gated-lock"><FontAwesomeIcon icon={faLock} /> {lang === 'vi' ? 'Cần đăng nhập' : 'Login required'}</div>
        <h2>{t.title}</h2>
        <p className="gated-reason">{t.reasons[page] || t.reasons.agents}</p>
        <p className="gated-intro">{t.freeIntro}</p>
        <div className="gated-benefits">
          <p className="gated-benefits-title">{t.benefitsTitle}</p>
          <ol className="gated-steps">
            {t.benefits.map((b, i) => (
              <li key={i}><span className="gated-step-no">{i + 1}</span>{b}</li>
            ))}
          </ol>
        </div>
        <div className="gated-actions">
          <Link className="app-login-btn gated-login" to={`/login?next=${next}`}>
            {t.signin}
          </Link>
          <Link className="gated-back" to="/dashboard">{t.back}</Link>
        </div>
      </div>
    </div>
  );
}
