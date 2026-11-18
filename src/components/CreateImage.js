import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faImage,
  faWandMagicSparkles,
  faDownload,
  faHeart,
  faTrash,
  faLayerGroup,
  faServer,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';
import { apiUrl } from '../lib/api';

const STYLES = [
  { id: 'realistic', labelVi: 'Thực tế', suffix: 'photorealistic, natural light, sharp focus, high detail' },
  { id: 'anime', labelVi: 'Anime', suffix: 'anime style, vibrant colors, clean line art' },
  { id: 'cinematic', labelVi: 'Điện ảnh', suffix: 'cinematic lighting, dramatic composition, film grain' },
  { id: 'digital-art', labelVi: 'Digital Art', suffix: 'digital art, trending on artstation, detailed illustration' },
  { id: 'oil-painting', labelVi: 'Sơn dầu', suffix: 'oil painting, thick brush strokes, classical art style' },
  { id: '3d-render', labelVi: '3D Render', suffix: '3d render, octane render, soft studio lighting' },
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

const GALLERY_KEY = 'aiSocialImageGallery';
const PERSIST_MAX_BYTES = 250_000; // keep small items (posters) in localStorage; big AI PNGs stay for the session

const STRINGS = {
  vi: {
    eyebrow: 'TẠO ẢNH AI',
    heading: 'Mô tả ý tưởng',
    sub: 'Prompt gửi thẳng tới engine ảnh thật của server: ComfyUI cục bộ → Pollinations AI (miễn phí) → AI Horde → poster dự phòng.',
    ideaBtn: 'Gợi ý prompt',
    styleLabel: 'Phong cách',
    ratioLabel: 'Tỉ lệ khung hình',
    batchLabel: 'Số lượng',
    generate: 'Tạo ảnh',
    generating: 'Đang tạo…',
    stopBtn: 'Dừng lại',
    resultsTitle: 'Kết quả mới',
    clearResults: 'Xoá tất cả',
    emptyHint: 'Nhập prompt và bấm Tạo ảnh — ảnh thật sẽ về lần lượt từng tấm.',
    galleryTitle: 'Thư viện ảnh đã lưu',
    needPrompt: 'Hãy nhập prompt trước',
    doneMsg: 'Đã tạo ảnh',
    failedMsg: 'Tạo ảnh thất bại',
    cancelled: 'Đã dừng tạo ảnh',
    provider: { comfyui: 'ComfyUI', pollinations: 'Pollinations AI', aihorde: 'AI Horde', poster: 'Poster dự phòng (không phải AI)' },
    engineTitle: 'Engine ảnh',
    engineComfy: 'ComfyUI cục bộ đang hoạt động — ảnh AI thật, nhanh.',
    enginePollinations: 'Pollinations AI (miễn phí, không cần key) — ảnh AI thật, thường 5–30 giây mỗi ảnh.',
    engineHorde: 'AI Horde (miễn phí) — ảnh AI thật, mỗi ảnh có thể chờ 1–5 phút.',
    enginePoster: 'Nếu mọi engine AI đều lỗi, server trả về poster dự phòng sinh từ prompt của bạn (không phải ảnh AI).',
    notePersist: 'Ảnh AI dung lượng lớn chỉ giữ trong phiên này — bấm tải xuống để lưu máy. Poster được lưu vào thư viện.',
    download: 'Tải xuống',
    save: 'Lưu vào thư viện',
    like: 'Yêu thích',
    del: 'Xoá',
  },
  en: {
    eyebrow: 'AI IMAGE STUDIO',
    heading: 'Describe your idea',
    sub: 'Prompts go straight to the server’s real image engines: local ComfyUI → Pollinations AI (free) → AI Horde → poster fallback.',
    ideaBtn: 'Suggest a prompt',
    styleLabel: 'Style',
    ratioLabel: 'Aspect ratio',
    batchLabel: 'Count',
    generate: 'Generate',
    generating: 'Generating…',
    stopBtn: 'Stop',
    resultsTitle: 'Latest results',
    clearResults: 'Clear all',
    emptyHint: 'Type a prompt and press Generate — real images arrive one by one.',
    galleryTitle: 'Saved gallery',
    needPrompt: 'Enter a prompt first',
    doneMsg: 'Images generated',
    failedMsg: 'Image generation failed',
    cancelled: 'Generation stopped',
    provider: { comfyui: 'ComfyUI', pollinations: 'Pollinations AI', aihorde: 'AI Horde', poster: 'Poster fallback (not AI)' },
    engineTitle: 'Image engine',
    engineComfy: 'Local ComfyUI is online — real AI images, fast.',
    enginePollinations: 'Pollinations AI (free, no key) — real AI images, usually 5–30 seconds each.',
    engineHorde: 'AI Horde (free) — real AI images, allow 1–5 minutes per image.',
    enginePoster: 'If every AI engine fails, the server returns a prompt-derived poster fallback (not AI-generated).',
    notePersist: 'Large AI images live only in this session — download to keep them. Posters are saved to the gallery.',
    download: 'Download',
    save: 'Save to gallery',
    like: 'Like',
    del: 'Delete',
  },
};

const CreateImage = () => {
  const [lang] = useLang();
  const T = STRINGS[lang];
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('realistic');
  const [ratio, setRatio] = useState('1:1');
  const [batch, setBatch] = useState(4);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [engine, setEngine] = useState(null);
  const [toast, setToast] = useState(null);
  const stopRef = useRef(false);

  // Load persisted gallery (posters + small images only).
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
      if (Array.isArray(stored)) setGallery(stored);
    } catch { /* ignore */ }
  }, []);

  // Ask the server which real engines are available.
  useEffect(() => {
    fetch(apiUrl('/api/images/status'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setEngine(data); })
      .catch(() => setEngine(null));
  }, []);

  const persistGallery = (list) => {
    setGallery(list);
    try {
      localStorage.setItem(GALLERY_KEY, JSON.stringify(list.filter((it) => (it.image || '').length <= PERSIST_MAX_BYTES)));
    } catch { /* quota exceeded — keep session copy */ }
  };

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2400);
  };

  const generateOne = async (fullPrompt, ratioId) => {
    const response = await fetch(apiUrl('/api/images/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: fullPrompt, ratio: ratioId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
    return data;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) { showToast(T.needPrompt); return; }
    stopRef.current = false;
    setBusy(true);
    const styleObj = STYLES.find((s) => s.id === style) || STYLES[0];
    const fullPrompt = `${prompt.trim()}, ${styleObj.suffix}`;
    const ids = Array.from({ length: batch }, (_, i) => `gen-${Date.now()}-${i}`);
    setResults(ids.map((id) => ({
      id, prompt: prompt.trim(), style, ratio, loading: true, image: null, provider: null, elapsedMs: null,
    })));
    let okCount = 0;
    for (let i = 0; i < ids.length; i += 1) {
      if (stopRef.current) break;
      try {
        const data = await generateOne(fullPrompt, ratio);
        setResults((prev) => prev.map((r) => (r.id === ids[i] ? { ...r, loading: false, image: data.image, provider: data.provider, elapsedMs: data.elapsedMs } : r)));
        okCount += 1;
      } catch (error) {
        setResults((prev) => prev.map((r) => (r.id === ids[i] ? { ...r, loading: false, error: error.message } : r)));
      }
    }
    setBusy(false);
    if (stopRef.current) showToast(T.cancelled);
    else if (okCount > 0) showToast(`${T.doneMsg} (${okCount}/${batch})`);
    else showToast(T.failedMsg);
  };

  const handleStop = () => { stopRef.current = true; };

  const handleSave = (r) => {
    persistGallery([{ id: r.id, image: r.image, prompt: r.prompt, style: r.style, ratio: r.ratio, provider: r.provider, liked: false }, ...gallery]);
    showToast(T.save);
  };

  const handleToggleLike = (id) => {
    persistGallery(gallery.map((it) => (it.id === id ? { ...it, liked: !it.liked } : it)));
  };

  const handleDelete = (id) => {
    persistGallery(gallery.filter((it) => it.id !== id));
    showToast(T.del);
  };

  const handleIdea = () => {
    setPrompt(IDEA_PROMPTS[Math.floor(Math.random() * IDEA_PROMPTS.length)]);
  };

  const download = (item) => {
    const data = item.image || '';
    const ext = data.startsWith('data:image/svg') ? 'svg' : data.startsWith('data:image/jpeg') ? 'jpg' : 'png';
    const a = document.createElement('a');
    a.href = data;
    a.download = `ai-social-${item.id}.${ext}`;
    a.click();
  };

  const aspectStyle = (r) => {
    const rt = RATIOS.find((x) => x.id === r) || RATIOS[0];
    return { aspectRatio: `${rt.w} / ${rt.h}` };
  };

  const engineText = !engine
    ? (lang === 'vi' ? 'Đang kiểm tra engine ảnh trên server…' : 'Checking image engines on the server…')
    : engine.comfyui?.available ? T.engineComfy : T.enginePollinations;

  return (
    <div className="ci-page">
      <div className="ci-engine-banner">
        <FontAwesomeIcon icon={faServer} />
        <div>
          <strong>{T.engineTitle}:</strong> {engineText}
          {engine && <small> · {T.notePersist}</small>}
        </div>
      </div>

      <div className="ci-layout">
        {/* Left: prompt panel */}
        <aside className="ci-prompt-panel">
          <div className="ci-prompt-head">
            <span className="eyebrow">{T.eyebrow}</span>
            <h2>{T.heading}</h2>
            <p className="muted">{T.sub}</p>
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
            <FontAwesomeIcon icon={faWandMagicSparkles} /> {T.ideaBtn}
          </button>

          <label className="ci-label">{T.styleLabel}</label>
          <div className="ci-chips">
            {STYLES.map((s) => (
              <button key={s.id} type="button" className={style === s.id ? 'active' : ''} onClick={() => setStyle(s.id)}>
                {lang === 'en' ? s.labelVi : s.labelVi}
              </button>
            ))}
          </div>

          <label className="ci-label">{T.ratioLabel}</label>
          <div className="ci-ratios">
            {RATIOS.map((r) => (
              <button key={r.id} type="button" className={ratio === r.id ? 'active' : ''} onClick={() => setRatio(r.id)}>
                <span style={{ aspectRatio: `${r.w}/${r.h}`, width: '14px', background: 'currentColor', opacity: .5, borderRadius: '2px' }} />
                {r.label}
              </button>
            ))}
          </div>

          <label className="ci-label">{T.batchLabel}: <strong>{batch}</strong></label>
          <input
            type="range"
            min="1"
            max="8"
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value))}
            className="ci-range"
            disabled={busy}
          />

          {busy ? (
            <div className="ci-gen-actions">
              <button type="button" className="ci-gen-btn" disabled>
                <><span className="spinner-border spinner-border-sm me-2" /> {T.generating}</>
              </button>
              <button type="button" className="ci-stop-btn" onClick={handleStop}>
                <FontAwesomeIcon icon={faXmark} /> {T.stopBtn}
              </button>
            </div>
          ) : (
            <button type="button" className="ci-gen-btn" onClick={handleGenerate} disabled={!prompt.trim()}>
              <FontAwesomeIcon icon={faImage} /> {T.generate} ({batch})
            </button>
          )}
        </aside>

        {/* Right: results + gallery */}
        <section className="ci-results-panel">
          <div className="ci-results-section">
            <header className="ci-section-head">
              <h3>{T.resultsTitle}</h3>
              {results.length > 0 && !busy && (
                <button type="button" className="ci-ghost-btn" onClick={() => setResults([])}>
                  <FontAwesomeIcon icon={faTrash} /> {T.clearResults}
                </button>
              )}
            </header>
            {results.length === 0 ? (
              <div className="ci-empty">
                <FontAwesomeIcon icon={faImage} className="ci-empty-icon" />
                <p>{T.emptyHint}</p>
              </div>
            ) : (
              <div className="ci-results-grid">
                {results.map((r) => (
                  <div key={r.id} className="ci-result-card" style={aspectStyle(r.ratio)}>
                    {r.loading ? (
                      <div className="ci-result-loading">
                        <span className="spinner-border spinner-border-sm" />
                        <small>{r.provider ? '' : '…'}</small>
                      </div>
                    ) : r.error ? (
                      <div className="ci-result-error"><small>{r.error}</small></div>
                    ) : (
                      <>
                        <img src={r.image} alt={r.prompt} />
                        {r.provider && (
                          <span className={`ci-provider-badge p-${r.provider}`}>{T.provider[r.provider] || r.provider}{r.elapsedMs ? ` · ${(r.elapsedMs / 1000).toFixed(1)}s` : ''}</span>
                        )}
                        <div className="ci-result-overlay">
                          <p>{r.prompt}</p>
                          <div className="ci-result-actions">
                            <button type="button" onClick={() => handleSave(r)} title={T.save}>
                              <FontAwesomeIcon icon={faLayerGroup} />
                            </button>
                            <button type="button" onClick={() => download(r)} title={T.download}>
                              <FontAwesomeIcon icon={faDownload} />
                            </button>
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
              <h3>{T.galleryTitle}</h3>
            </header>
            {gallery.length === 0 ? (
              <div className="ci-empty"><p>{lang === 'vi' ? 'Chưa có ảnh nào được lưu.' : 'No saved images yet.'}</p></div>
            ) : (
              <div className="ci-gallery-grid">
                {gallery.map((g) => (
                  <div key={g.id} className="ci-gallery-card" style={aspectStyle(g.ratio)}>
                    <img src={g.image} alt={g.prompt} loading="lazy" />
                    {g.provider && <span className={`ci-provider-badge p-${g.provider}`}>{T.provider[g.provider] || g.provider}</span>}
                    <div className="ci-gallery-overlay">
                      <p title={g.prompt}>{g.prompt}</p>
                      <div className="ci-gallery-actions">
                        <button type="button" className={g.liked ? 'liked' : ''} onClick={() => handleToggleLike(g.id)} title={T.like}>
                          <FontAwesomeIcon icon={faHeart} />
                        </button>
                        <button type="button" onClick={() => download(g)} title={T.download}>
                          <FontAwesomeIcon icon={faDownload} />
                        </button>
                        <button type="button" onClick={() => handleDelete(g.id)} title={T.del}>
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
