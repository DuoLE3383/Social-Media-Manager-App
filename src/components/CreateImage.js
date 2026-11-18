import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faImage,
  faWandMagicSparkles,
  faDownload,
  faHeart,
  faTrash,
  faArrowsRotate,
  faLayerGroup,
} from '@fortawesome/free-solid-svg-icons';

const STYLES = [
  { id: 'realistic', label: 'Thực tế' },
  { id: 'anime', label: 'Anime' },
  { id: 'cinematic', label: 'Điện ảnh' },
  { id: 'digital-art', label: 'Digital Art' },
  { id: 'oil-painting', label: 'Sơn dầu' },
  { id: '3d-render', label: '3D Render' },
];

const RATIOS = [
  { id: '1:1', label: '1:1', w: 1, h: 1 },
  { id: '9:16', label: '9:16', w: 9, h: 16 },
  { id: '16:9', label: '16:9', w: 16, h: 9 },
  { id: '4:5', label: '4:5', w: 4, h: 5 },
];

const IDEA_PROMPTS = [
  'Một chú mèo cam ngồi trên thềm nhà tại phố cổ Hà Nội, ánh nắng chiều vàng ấm',
  'Bát phở bò nóng hổi khói bốc lên, gốm sứ truyền thống, nền tối sang trọng',
  'Hội đèn lồng Hội An ban đêm, phản chiếu trên sông, không khí lung linh',
  'Ruộng bậc thang Sapa lúc bình minh, mây sương bồng bềnh, ánh hồng kim',
  'Ly cà phê sữa đá Việt Nam trên bàn gỗ, giọt ngưng tụ, ánh sáng tự nhiên',
];

// Pre-generated gallery (uses picsum.photos with deterministic seeds).
const SAMPLE_GALLERY = [
  { id: 1, seed: 'createimg01', prompt: 'Orange cat on Hanoi street', style: 'realistic', ratio: '1:1', liked: true },
  { id: 2, seed: 'createimg02', prompt: 'Bowl of pho with steam', style: 'cinematic', ratio: '4:5', liked: false },
  { id: 3, seed: 'createimg03', prompt: 'Hoi An lantern festival at night', style: 'digital-art', ratio: '16:9', liked: true },
  { id: 4, seed: 'createimg04', prompt: 'Sapa rice terraces at sunrise', style: 'realistic', ratio: '1:1', liked: false },
  { id: 5, seed: 'createimg05', prompt: 'Vietnamese iced coffee close-up', style: 'cinematic', ratio: '1:1', liked: true },
  { id: 6, seed: 'createimg06', prompt: 'Woman in yellow ao dai by lake', style: 'oil-painting', ratio: '4:5', liked: false },
];

const CreateImage = () => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('realistic');
  const [ratio, setRatio] = useState('1:1');
  const [batch, setBatch] = useState(4);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [gallery, setGallery] = useState(SAMPLE_GALLERY);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2000);
  };

  const handleGenerate = () => {
    if (!prompt.trim()) { showToast('Hãy nhập prompt trước'); return; }
    setBusy(true);
    setResults([]);
    // Simulate generation: produce `batch` placeholder results then fill them.
    const placeholders = Array.from({ length: batch }, (_, i) => ({
      id: `gen-${Date.now()}-${i}`,
      seed: `gen${Date.now()}${i}`,
      prompt,
      style,
      ratio,
      loading: true,
    }));
    setResults(placeholders);
    setTimeout(() => {
      setResults((prev) => prev.map((r) => ({ ...r, loading: false })));
      setBusy(false);
      showToast('Đã tạo ' + batch + ' ảnh');
    }, 1500);
  };

  const handleSave = (r) => {
    const next = [{ id: r.id, seed: r.seed, prompt: r.prompt, style: r.style, ratio: r.ratio, liked: false }, ...gallery];
    setGallery(next);
    showToast('Đã lưu vào thư viện');
  };

  const handleToggleLike = (id) => {
    setGallery((g) => g.map((it) => (it.id === id ? { ...it, liked: !it.liked } : it)));
  };

  const handleDelete = (id) => {
    setGallery((g) => g.filter((it) => it.id !== id));
    showToast('Đã xoá');
  };

  const handleIdea = () => {
    const idea = IDEA_PROMPTS[Math.floor(Math.random() * IDEA_PROMPTS.length)];
    setPrompt(idea);
  };

  const aspectStyle = (r) => {
    const rt = RATIOS.find((x) => x.id === r) || RATIOS[0];
    return { aspectRatio: `${rt.w} / ${rt.h}` };
  };

  return (
    <div className="ci-page">
      <div className="ci-layout">
        {/* Left: prompt panel */}
        <aside className="ci-prompt-panel">
          <div className="ci-prompt-head">
            <span className="eyebrow">TẠO ẢNH AI</span>
            <h2>Mô tả ý tưởng</h2>
            <p className="muted">Viết prompt bằng tiếng Việt hoặc tiếng Anh. AI sẽ tự sinh ảnh theo phong cách bạn chọn.</p>
          </div>

          <label className="ci-label">Prompt</label>
          <textarea
            className="ci-textarea"
            rows="4"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="VD: Một chú mèo cam ngồi trên thềm nhà tại phố cổ Hà Nội, ánh nắng chiều vàng ấm..."
          />
          <button type="button" className="ci-idea-btn" onClick={handleIdea}>
            <FontAwesomeIcon icon={faWandMagicSparkles} /> Gợi ý prompt
          </button>

          <label className="ci-label">Phong cách</label>
          <div className="ci-chips">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={style === s.id ? 'active' : ''}
                onClick={() => setStyle(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <label className="ci-label">Tỉ lệ khung hình</label>
          <div className="ci-ratios">
            {RATIOS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={ratio === r.id ? 'active' : ''}
                onClick={() => setRatio(r.id)}
              >
                <span style={{ aspectRatio: `${r.w}/${r.h}`, width: '14px', background: 'currentColor', opacity: .5, borderRadius: '2px' }} />
                {r.label}
              </button>
            ))}
          </div>

          <label className="ci-label">Số lượng: <strong>{batch}</strong></label>
          <input
            type="range"
            min="1"
            max="8"
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value))}
            className="ci-range"
          />

          <button
            type="button"
            className="ci-gen-btn"
            onClick={handleGenerate}
            disabled={busy || !prompt.trim()}
          >
            {busy ? (
              <><span className="spinner-border spinner-border-sm me-2" /> Đang tạo...</>
            ) : (
              <><FontAwesomeIcon icon={faImage} /> Tạo {batch} ảnh</>
            )}
          </button>
        </aside>

        {/* Right: results + gallery */}
        <section className="ci-results-panel">
          <div className="ci-results-section">
            <header className="ci-section-head">
              <h3>Kết quả mới</h3>
              {results.length > 0 && (
                <button type="button" className="ci-ghost-btn" onClick={() => setResults([])}>
                  <FontAwesomeIcon icon={faTrash} /> Xoá tất cả
                </button>
              )}
            </header>
            {results.length === 0 ? (
              <div className="ci-empty">
                <FontAwesomeIcon icon={faImage} className="ci-empty-icon" />
                <p>Nhập prompt và bấm <strong>Tạo ảnh</strong> để bắt đầu.</p>
              </div>
            ) : (
              <div className="ci-results-grid">
                {results.map((r) => (
                  <div key={r.id} className="ci-result-card" style={aspectStyle(r.ratio)}>
                    {r.loading ? (
                      <div className="ci-result-loading">
                        <span className="spinner-border spinner-border-sm" />
                        <small>Đang sinh...</small>
                      </div>
                    ) : (
                      <>
                        <img src={`https://picsum.photos/seed/${r.seed}/400/400`} alt={r.prompt} />
                        <div className="ci-result-overlay">
                          <p>{r.prompt}</p>
                          <div className="ci-result-actions">
                            <button type="button" onClick={() => handleSave(r)} title="Lưu vào thư viện">
                              <FontAwesomeIcon icon={faLayerGroup} />
                            </button>
                            <a
                              href={`https://picsum.photos/seed/${r.seed}/800/800`}
                              target="_blank"
                              rel="noreferrer"
                              download
                              title="Tải xuống"
                            >
                              <FontAwesomeIcon icon={faDownload} />
                            </a>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ci-gallery-section">
            <header className="ci-section-head">
              <h3>Thư viện ảnh đã lưu</h3>
              <button type="button" className="ci-ghost-btn" onClick={() => showToast('Đã làm mới')}>
                <FontAwesomeIcon icon={faArrowsRotate} /> Làm mới
              </button>
            </header>
            {gallery.length === 0 ? (
              <div className="ci-empty">
                <p>Chưa có ảnh nào được lưu.</p>
              </div>
            ) : (
              <div className="ci-gallery-grid">
                {gallery.map((g) => (
                  <div key={g.id} className="ci-gallery-card" style={aspectStyle(g.ratio)}>
                    <img src={`https://picsum.photos/seed/${g.seed}/300/300`} alt={g.prompt} loading="lazy" />
                    <div className="ci-gallery-overlay">
                      <p title={g.prompt}>{g.prompt}</p>
                      <div className="ci-gallery-actions">
                        <button
                          type="button"
                          className={g.liked ? 'liked' : ''}
                          onClick={() => handleToggleLike(g.id)}
                          title="Yêu thích"
                        >
                          <FontAwesomeIcon icon={faHeart} />
                        </button>
                        <a
                          href={`https://picsum.photos/seed/${g.seed}/800/800`}
                          target="_blank"
                          rel="noreferrer"
                          download
                          title="Tải xuống"
                        >
                          <FontAwesomeIcon icon={faDownload} />
                        </a>
                        <button type="button" onClick={() => handleDelete(g.id)} title="Xoá">
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {toast && <div className="ai-toast">{toast}</div>}
    </div>
  );
};

export default CreateImage;
