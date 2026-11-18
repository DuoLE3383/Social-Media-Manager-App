import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWandMagicSparkles,
  faRobot,
  faImage,
  faVideo,
  faCalendarDays,
  faChartLine,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';

// The app-wide guided flow (wizard). Every page ends with a NextStepCard that
// suggests — and links to — the following stage of the content pipeline:
//   1. Smart Prompt (ideas) -> 2. Agent Builder (write) -> 3. Create Image ->
//   4. AI Library (video)  -> 5. Publish Plan -> 6. Reports -> back to 1.
const STEPS = {
  smartPrompt: { to: '/smart-prompt', icon: faWandMagicSparkles, step: 1, label: { vi: 'Gợi ý thông minh', en: 'Smart Prompt' } },
  agents: { to: '/prompts', icon: faRobot, step: 2, label: { vi: 'Agent Builder', en: 'Agent Builder' } },
  createImage: { to: '/create-image', icon: faImage, step: 3, label: { vi: 'Tạo Ảnh', en: 'Create Image' } },
  library: { to: '/ai-library', icon: faVideo, step: 4, label: { vi: 'Thư viện AI', en: 'AI Library' } },
  publish: { to: '/publish-plan', icon: faCalendarDays, step: 5, label: { vi: 'Lịch đăng', en: 'Publish Plan' } },
  reports: { to: '/reports', icon: faChartLine, step: 6, label: { vi: 'Báo cáo', en: 'Reports' } },
};

// Per-transition suggestion copy, keyed by "<current path>-><next path>".
const SUGGESTIONS = {
  '/smart-prompt->/prompts': {
    vi: 'Đã có ý tưởng? Đưa ý tưởng vào Agent Builder để AI viết bài hoàn chỉnh theo từng bước.',
    en: 'Got an idea? Feed it into Agent Builder and let AI write the full post step by step.',
  },
  '/prompts->/create-image': {
    vi: 'Bài viết đã xong? Tạo ảnh minh họa đúng chủ đề để bài đăng nổi bật hơn.',
    en: 'Post ready? Create on-topic AI images to make it stand out.',
  },
  '/create-image->/ai-library': {
    vi: 'Đã có ảnh? Ghép các ảnh thành video slideshow kèm chuyển cảnh mượt.',
    en: 'Have images? Stitch them into a slideshow video with smooth transitions.',
  },
  '/ai-library->/publish-plan': {
    vi: 'Nội dung đã đủ? Lên lịch đăng để phát hành đều đặn trên các kênh.',
    en: 'Content ready? Schedule it for consistent publishing across channels.',
  },
  '/feed->/publish-plan': {
    vi: 'Đã duyệt bài? Đưa bài vào lịch đăng để phát hành đúng giờ.',
    en: 'Posts reviewed? Put them on the publishing calendar at the right time.',
  },
  '/publish-plan->/reports': {
    vi: 'Đã lên lịch? Theo dõi tương tác và lượt tiếp cận ở Báo cáo.',
    en: 'Scheduled? Track engagement and reach in Reports.',
  },
  '/reports->/smart-prompt': {
    vi: 'Vòng nội dung mới: dùng chủ đề đang hiệu quả để lấy ý tưởng cho chu kỳ tiếp theo.',
    en: 'New cycle: turn what worked into fresh ideas for the next round.',
  },
};

const FALLBACK = {
  vi: 'Tiếp tục sang bước kế tiếp trong quy trình làm nội dung.',
  en: 'Continue to the next stage of the content workflow.',
};

const COPY = {
  vi: { eyebrow: 'BƯỚC TIẾP THEO', stepOf: 'Bước', btn: 'Tiếp tục', of: '/' },
  en: { eyebrow: 'NEXT STEP', stepOf: 'Step', btn: 'Continue', of: '/' },
};

// Rendered at the bottom of each workflow page (wrapped per-route in App.js).
export default function NextStepCard({ next }) {
  const [lang] = useLang();
  const t = COPY[lang] || COPY.vi;
  const location = useLocation();
  const target = STEPS[next];
  if (!target) return null;
  const sug = SUGGESTIONS[`${location.pathname}->${target.to}`] || FALLBACK;
  return (
    <section className="nsc-card">
      <span className="nsc-icon"><FontAwesomeIcon icon={target.icon} /></span>
      <div className="nsc-body">
        <span className="nsc-eyebrow">{t.eyebrow}</span>
        <div className="nsc-title-row">
          <strong className="nsc-title">{target.label[lang] || target.label.vi}</strong>
          {target.step && (
            <span className="nsc-step-badge">{t.stepOf} {target.step}{t.of}6</span>
          )}
        </div>
        <p className="nsc-suggestion">{sug[lang] || sug.vi}</p>
      </div>
      <Link className="nsc-btn" to={target.to}>
        {t.btn} <FontAwesomeIcon icon={faArrowRight} />
      </Link>
    </section>
  );
}
