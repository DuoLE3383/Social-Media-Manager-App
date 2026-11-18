import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLock,
  faRobot,
  faWandMagicSparkles,
  faImage,
  faVideo,
  faCalendarDays,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';

const PAGE_ICONS = {
  agents: faRobot,
  smartPrompt: faWandMagicSparkles,
  createImage: faImage,
  library: faVideo,
  publish: faCalendarDays,
  accounts: faUsers,
};

// Copy for the "sign in to continue" interstitial. Each gated page explains WHY
// it needs an account: because it burns AI/server resources or touches the
// user's connected social accounts. Everything else stays open to guests.
const T = {
  vi: {
    title: 'Đăng nhập để dùng tính năng này',
    signin: 'Đăng nhập',
    back: 'Về Tổng quan',
    freeIntro: 'Bạn đang dùng thử miễn phí ở chế độ khách. Tính năng này tiêu tốn nhiều tài nguyên AI hoặc liên quan đến tài khoản nên cần đăng nhập.',
    benefitsTitle: 'Đăng nhập để mở khoá:',
    benefits: [
      'Tạo ảnh & video AI từ prompt (tự động dịch tiếng Việt)',
      'Agent Builder viết bài nhiều bước tự động',
      'Gợi ý ý tưởng nội dung bằng AI',
      'Kết nối tài khoản & lên lịch đăng bài',
    ],
    reasons: {
      agents: 'Agent Builder chạy mô hình AI nhiều bước trên server — tiêu tốn tài nguyên tính toán.',
      smartPrompt: 'Gợi ý thông minh gọi AI tạo ý tưởng trực tiếp — tiêu tốn tài nguyên.',
      createImage: 'Sinh ảnh AI tiêu tốn tài nguyên render trên các engine ảnh.',
      library: 'Tạo video cần LLM viết kịch bản và sinh nhiều ảnh AI — nặng tài nguyên.',
      publish: 'Lên lịch đăng bài hoạt động cùng tài khoản mạng xã hội bạn kết nối.',
      accounts: 'Trang này quản lý tài khoản mạng xã hội và tích hợp của bạn.',
    },
  },
  en: {
    title: 'Sign in to use this feature',
    signin: 'Sign in',
    back: 'Back to Overview',
    freeIntro: 'You are trying the app for free as a guest. This feature uses heavy AI resources or touches your accounts, so it needs sign-in.',
    benefitsTitle: 'Sign in to unlock:',
    benefits: [
      'Create AI images & videos from prompts (auto-translated)',
      'Agent Builder writes posts automatically, step by step',
      'AI content idea suggestions',
      'Connect accounts & schedule publishing',
    ],
    reasons: {
      agents: 'Agent Builder runs multi-step AI models on the server — compute-heavy.',
      smartPrompt: 'Smart Prompt calls the AI directly for ideas — resource-heavy.',
      createImage: 'AI image generation consumes rendering resources across image engines.',
      library: 'Video creation needs an LLM script plus multiple AI images — resource-heavy.',
      publish: 'Publish planning works with the social accounts you connect.',
      accounts: 'This page manages your social accounts and integrations.',
    },
  },
};

// Shown in place of a gated page when the visitor is not signed in.
export default function LoginRequired({ page = 'agents' }) {
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
          <ul>{t.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul>
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
