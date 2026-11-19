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

// The app-wide guided wizard, exactly 4 creation steps as defined by the owner:
//   1. Smart Prompt (prompt ideas) -> 2. Agent Builder (agent from the idea,
//   follows the project account) -> 3. Create Image (from steps 1 & 2) ->
//   4. AI Library video (from step 3 images). After step 4 the flow hands off
//   to publishing (unnumbered), and Reports loops back to step 1.
const STEPS = {
  smartPrompt: { to: '/smart-prompt', icon: faWandMagicSparkles, step: 1, label: { vi: 'Gợi ý tạo prompt', en: 'Prompt ideas' } },
  agents: { to: '/prompts', icon: faRobot, step: 2, label: { vi: 'Tạo Agent', en: 'Create Agent' } },
  createImage: { to: '/create-image', icon: faImage, step: 3, label: { vi: 'Tạo hình ảnh', en: 'Create images' } },
  library: { to: '/ai-library', icon: faVideo, step: 4, label: { vi: 'Tạo video', en: 'Create video' } },
  publish: { to: '/publish-plan', icon: faCalendarDays, step: null, label: { vi: 'Lịch đăng', en: 'Publish Plan' } },
  reports: { to: '/reports', icon: faChartLine, step: null, label: { vi: 'Báo cáo', en: 'Reports' } },
};

// Per-transition suggestion copy, keyed by "<current path>-><next path>".
const SUGGESTIONS = {
  '/smart-prompt->/prompts': {
    vi: 'Đã có prompt (bước 1)? Tạo agent từ ý tưởng này — agent sẽ bám theo tài khoản suốt dự án.',
    en: 'Got the prompt (step 1)? Build an agent from it — the agent sticks to your account for the whole project.',
  },
  '/prompts->/create-image': {
    vi: 'Agent đã chạy xong (bước 2)? Tạo ảnh minh họa (bước 3) từ prompt (b1) + bài viết của agent (b2), rồi ghép thành video (bước 4).',
    en: 'Agent run done (step 2)? Create images (step 3) from the prompt (S1) + agent copy (S2), then stitch them into a video (step 4).',
  },
  '/create-image->/ai-library': {
    vi: 'Đã có ảnh (bước 3)? Ghép thành video (bước 4) với chuyển cảnh mượt.',
    en: 'Images ready (step 3)? Stitch them into a video (step 4) with smooth transitions.',
  },
  '/ai-library->/publish-plan': {
    vi: 'Hoàn tất 4 bước! Đưa ảnh/video lên lịch đăng để phát hành đều đặn.',
    en: 'All 4 steps done! Schedule your images and videos for consistent publishing.',
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
    vi: 'Bắt đầu vòng mới từ bước 1: gợi ý prompt cho chủ đề tiếp theo.',
    en: 'Start a new cycle at step 1: prompt ideas for the next topic.',
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
            <span className="nsc-step-badge">{t.stepOf} {target.step}{t.of}4</span>
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
