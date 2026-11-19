import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWandMagicSparkles,
  faLightbulb,
  faCopy,
  faRefresh,
  faChevronRight,
  faFire,
  faBullseye,
  faCalendar,
  faBolt,
  faRobot,
  faImage,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';

// Idea categories — each has a list of templates the assistant picks from.
const CATEGORIES = [
  { id: 'trending', label: 'Xu hướng', icon: faFire, color: '#e0653f' },
  { id: 'promo', label: 'Khuyến mãi', icon: faBullseye, color: '#6158d9' },
  { id: 'seasonal', label: 'Mùa lễ', icon: faCalendar, color: '#2aa17a' },
  { id: 'quick', label: 'Nhanh', icon: faBolt, color: '#d4a52e' },
];

const IDEAS = {
  trending: [
    '5 xu hướng nội dung video ngắn đang bùng nổ tuần này — kèm gợi ý áp dụng cho ngành {ngành}',
    'Phân tích 1 video viral trên TikTok Việt Nam: vì sao nó hoạt động, bạn có thể sao chép điều gì',
    'Câu chuyện thương hiệu dưới dạng 3 phần mini-series — khúc dạo đầu thu hút trong 3 giây đầu',
    'Reacts/duet 3 creator nổi tiếng trong lĩnh vực {ngành}, kèm góc nhìn chuyên môn của bạn',
  ],
  promo: [
    'Combo khuyến mãi cuối tuần: mua 2 tặng 1 — kèm hook "Chỉ 48 giờ"',
    'Câu chuyện khách hàng: từ lúc gặp vấn đề đến khi giải quyết bằng sản phẩm {sản phẩm}',
    'Minigame "Đoán tên — trọn quà": đăng ảnh mờ dần, gợi ý từng giờ',
    'Flash sale 24 giờ: 3 video ngắn trước-sau-trong khi dùng sản phẩm',
  ],
  seasonal: [
    'Bộ ảnh Giáng sinh 2026: tone đỏ - xanh ngọc - vàng kim, kèm caption "Một mùa an lành"',
    'Video Tết Nguyên Đán: recap một năm của thương hiệu, cảm ơn khách hàng',
    'Lễ Tết Trung Thu: chương trình vẽ đèn lồng cùng khách hàng — call for UGC',
    'Mùa hè: playlist 5 bài hát Việt Nam hoàn hảo cho buổi sáng cà phê của bạn',
  ],
  quick: [
    'Bài đăng quote 1 câu từ khách hàng — ảnh typography tối giản',
    'Poll / hỏi đáp: "Bạn thích cà phê đen hay sữa đá?" — tăng tương tác tức thì',
    'Carousel 3 ảnh: sản phẩm ở 3 góc độ khác nhau, caption 1 câu mỗi ảnh',
    'Behind-the-scenes 30 giây: một ngày trong xưởng sản xuất của bạn',
  ],
};

const PROMPT_TEMPLATES = [
  {
    id: 'hook',
    title: 'Hook 3 giây',
    body: 'Viết 5 cách mở đầu video ngắn 9:16 cho chủ đề "{chủ đề}" — mỗi hook phải khiến người xem dừng cuộn trong 3 giây đầu.',
  },
  {
    id: 'caption',
    title: 'Caption cảm xúc',
    body: 'Viết caption Facebook 80-120 từ cho bài đăng về "{sản phẩm}", giọng văn gần gũi, kết thúc bằng call-to-action rõ ràng.',
  },
  {
    id: 'hashtag',
    title: 'Bộ hashtag',
    body: 'Gợi ý 15 hashtag cho bài đăng về "{chủ đề}" trên Instagram, kết hợp hashtag phổ biến + ngách + thương hiệu.',
  },
  {
    id: 'script',
    title: 'Kịch bản 30 giây',
    body: 'Viết kịch bản video 30 giây cho sản phẩm "{sản phẩm}": 3 giây hook, 20 giây lợi ích, 7 giây CTA. Ngôn ngữ tiếng Việt tự nhiên.',
  },
];

const SmartPrompt = () => {
  const navigate = useNavigate();
  const [lang] = useLang();
  const [activeCat, setActiveCat] = useState('trending');
  const [ideas, setIdeas] = useState(IDEAS.trending);
  const [business, setBusiness] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2000);
  };

  const pickIdeas = (cat) => {
    setActiveCat(cat);
    setIdeas(IDEAS[cat]);
  };

  const refreshIdeas = () => {
    // Shuffle ideas within current category.
    const shuffled = [...IDEAS[activeCat]].sort(() => Math.random() - 0.5);
    setIdeas(shuffled);
    showToast('Đã làm mới ý tưởng');
  };

  const pickIdea = (idea) => {
    const filled = idea
      .replace('{ngành}', business || 'F&B')
      .replace('{sản phẩm}', business || 'cà phê sữa đá')
      .replace('{chủ đề}', business || 'ẩm thực Việt');
    setGeneratedPrompt(filled);
    showToast('Đã chọn ý tưởng — xem prompt bên phải');
  };

  const generateFromTemplate = (tpl) => {
    const filled = tpl.body
      .replace('{chủ đề}', business || 'ẩm thực Việt')
      .replace('{sản phẩm}', business || 'cà phê sữa đá');
    setGeneratedPrompt(filled);
    showToast('Đã tạo prompt từ template');
  };

  const copyPrompt = () => {
    if (!generatedPrompt) return;
    navigator.clipboard?.writeText(generatedPrompt).then(() => showToast('Đã sao chép vào clipboard'));
  };

  // Wizard step 2 handoff: carry the crafted prompt into the Agent Builder.
  // The agent will follow the project account for the whole project, so we
  // pass the prompt (idea) and the industry along via sessionStorage.
  const sendToAgent = () => {
    if (!generatedPrompt) return;
    try {
      sessionStorage.setItem('aiSocialIdeaHandoff', JSON.stringify({
        prompt: generatedPrompt,
        business: business.trim(),
        ts: Date.now(),
      }));
    } catch { /* private mode */ }
    navigate('/prompts');
  };

  // "Mở trong Prompt Studio" used to be a fake toast — now it really opens the
  // quick-prompt tab of the Agent Builder with this prompt prefilled.
  const sendToQuickStudio = () => {
    if (!generatedPrompt) return;
    try {
      sessionStorage.setItem('aiSocialQuickHandoff', JSON.stringify({
        prompt: generatedPrompt,
        ts: Date.now(),
      }));
    } catch { /* private mode */ }
    navigate('/prompts?tab=quick');
  };

  // Shortcut: skip the agent and go straight to images (wizard step 3) with
  // this prompt. Keeps the media chain reachable from step 1 as well.
  const sendToImage = () => {
    if (!generatedPrompt) return;
    try {
      sessionStorage.setItem('aiSocialImageHandoff', JSON.stringify({
        prompt: generatedPrompt,
        idea: generatedPrompt,
        account: '',
        content: '',
        ts: Date.now(),
      }));
    } catch { /* private mode */ }
    navigate('/create-image');
  };

  const surprise = () => {
    const allCats = Object.keys(IDEAS);
    const cat = allCats[Math.floor(Math.random() * allCats.length)];
    const list = IDEAS[cat];
    const idea = list[Math.floor(Math.random() * list.length)];
    setActiveCat(cat);
    pickIdea(idea);
  };

  return (
    <div className="sp-page">
      <div className="sp-layout">
        {/* Left: idea generator */}
        <aside className="sp-ideas-panel">
          <div className="sp-head">
            <span className="eyebrow">SMART PROMPT</span>
            <h2>Ý tưởng nội dung</h2>
            <p className="muted">Chọn danh mục, nhận ý tưởng tức thì. Kéo sang prompt bên phải để hoàn thiện.</p>
          </div>

          <label className="sp-label">Ngành / sản phẩm của bạn</label>
          <input
            type="text"
            className="sp-input"
            placeholder="VD: cà phê, thời trang, du lịch..."
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
          />

          <div className="sp-cat-row">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`sp-cat-chip${activeCat === c.id ? ' active' : ''}`}
                style={{ '--c-color': c.color }}
                onClick={() => pickIdeas(c.id)}
              >
                <FontAwesomeIcon icon={c.icon} /> {c.label}
              </button>
            ))}
          </div>

          <div className="sp-ideas-actions">
            <button type="button" className="sp-refresh-btn" onClick={refreshIdeas}>
              <FontAwesomeIcon icon={faRefresh} /> Làm mới
            </button>
            <button type="button" className="sp-surprise-btn" onClick={surprise}>
              <FontAwesomeIcon icon={faLightbulb} /> Ngẫu nhiên
            </button>
          </div>

          <ul className="sp-idea-list">
            {ideas.map((idea, i) => (
              <li key={`${activeCat}-${i}`}>
                <button type="button" onClick={() => pickIdea(idea)}>
                  <span className="sp-idea-text">{idea}</span>
                  <FontAwesomeIcon icon={faChevronRight} className="sp-idea-arrow" />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Right: prompt builder */}
        <section className="sp-prompt-panel">
          <div className="sp-head">
            <span className="eyebrow">PROMPT CHI TIẾT</span>
            <h2>Hoàn thiện prompt</h2>
            <p className="muted">Chọn một template hoặc chỉnh sửa prompt đã tạo để đưa vào Prompt Studio.</p>
          </div>

          <label className="sp-label">Templates nhanh</label>
          <div className="sp-tpl-grid">
            {PROMPT_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="sp-tpl-card"
                onClick={() => generateFromTemplate(t)}
              >
                <FontAwesomeIcon icon={faWandMagicSparkles} />
                <strong>{t.title}</strong>
                <small>{t.body.slice(0, 60)}…</small>
              </button>
            ))}
          </div>

          <label className="sp-label">Prompt đã chọn</label>
          <textarea
            className="sp-prompt-area"
            rows="8"
            value={generatedPrompt}
            onChange={(e) => setGeneratedPrompt(e.target.value)}
            placeholder="Prompt sẽ xuất hiện tại đây sau khi bạn chọn ý tưởng hoặc template..."
          />

          <div className="sp-prompt-actions">
            <button
              type="button"
              className="sp-copy-btn"
              onClick={copyPrompt}
              disabled={!generatedPrompt}
            >
              <FontAwesomeIcon icon={faCopy} /> Sao chép
            </button>
            <button
              type="button"
              className="sp-run-btn"
              disabled={!generatedPrompt}
              onClick={sendToQuickStudio}
            >
              <FontAwesomeIcon icon={faWandMagicSparkles} /> Mở trong Prompt Studio
            </button>
          </div>
          <button
            type="button"
            className="sp-agent-btn"
            onClick={sendToAgent}
            disabled={!generatedPrompt}
            title={lang === 'vi' ? 'Bước 2: tạo agent bám theo tài khoản suốt dự án' : 'Step 2: create an agent that follows your account for the whole project'}
          >
            <FontAwesomeIcon icon={faRobot} /> Tạo Agent từ prompt này — bước 2 →
          </button>
          <button
            type="button"
            className="sp-image-btn"
            onClick={sendToImage}
            disabled={!generatedPrompt}
            title={lang === 'vi' ? 'Bỏ qua agent, tạo ảnh minh hoạ ngay từ prompt này (bước 3)' : 'Skip the agent and create images from this prompt right away (step 3)'}
          >
            <FontAwesomeIcon icon={faImage} /> Tạo ảnh trực tiếp — bước 3 →
          </button>
        </section>
      </div>

      {toast && <div className="ai-toast">{toast}</div>}
    </div>
  );
};

export default SmartPrompt;
