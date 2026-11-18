import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate,
  faVideo,
  faCrown,
  faMagnifyingGlass,
  faFilter,
  faPlus,
  faPlay,
  faEllipsisVertical,
  faTrash,
  faDownload,
  faXmark,
  faWandMagicSparkles,
  faFilm,
  faImage,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';
import { apiUrl } from '../lib/api';
import { supabase } from '../lib/supabase';

const LIB_KEY = 'aiLibraryItems';
const W = 720;
const H = 1280;

const CATEGORIES = ['All', 'Food', 'Lifestyle', 'People', 'Products', 'Scenery'];

// Quick-start ideas for the video wizard — click one to fill the idea field.
const IDEA_VIDEO_SUGGESTIONS = [
  'Quán cà phê sữa đá mới mở tại Sài Gòn, hướng giới trẻ, vibe chill',
  'Combo trưa văn phòng 45k cho quán ăn, nhanh gọn no bụng',
  'Tour 30 giây quanh homestay view núi Đà Lạt, bình minh sương mù',
  'Ra mắt bộ sưu tập thời trang thu đông, tông màu ấm',
  'Khai trương phòng gym, ưu đãi tháng đầu cho 50 người đầu tiên',
  'Mỹ phẩm dưỡng da hữu cơ, da căng mọng, ánh sáng studio mềm',
];
const SORT_OPTIONS = [
  { value: 'newest', labelVi: 'Mới nhất', labelEn: 'Newest first' },
  { value: 'oldest', labelVi: 'Cũ nhất', labelEn: 'Oldest first' },
  { value: 'duration-desc', labelVi: 'Dài nhất', labelEn: 'Longest duration' },
  { value: 'duration-asc', labelVi: 'Ngắn nhất', labelEn: 'Shortest duration' },
];

const STRINGS = {
  vi: {
    createVideo: 'Tạo Video',
    searchPlaceholder: 'Tìm video theo tên…',
    videos: 'video',
    totalLength: 'tổng thời lượng',
    storage: 'dung lượng phiên',
    allCategories: 'Tất cả chủ đề',
    allSources: 'Tất cả nguồn',
    emptyTitle: 'Chưa có video nào',
    emptySub: 'Tạo video đầu tiên: AI viết kịch bản từng cảnh, sinh ảnh AI rồi ghép thành video slideshow .webm tải về được (không phải video AI chuyển động).',
    selected: 'đã chọn',
    delete: 'Xoá',
    clear: 'Bỏ chọn',
    showing: 'Hiển thị',
    of: 'trong',
    // modal
    modalTitle: 'Tạo video slideshow từ ý tưởng (AI thật)',
    slideshowNotice: 'Video hiện tại là SLIDESHOW: các ảnh AI của từng cảnh được ghép nối tiếp với chuyển cảnh mượt + caption — không phải video AI chuyển động thật (kiểu Sora / Veo / Runway).',
    modalSub: 'Cách dùng — Bước 1: LLM viết kịch bản từng cảnh · Bước 2: sinh ảnh AI cho mỗi cảnh · Bước 3: ghép thành video slideshow .webm trong trình duyệt.',
    suggestionLabel: 'Gợi ý ý tưởng — bấm để điền:',
    ideaLabel: 'Ý tưởng / sản phẩm',
    ideaPlaceholder: 'VD: Quán cà phê sữa đá mới mở tại Sài Gòn, hướng giới trẻ, vibe chill',
    scenesLabel: 'Số cảnh',
    fastImages: 'Tạo ảnh nhanh (dùng Pollinations AI, bỏ qua hàng chờ AI Horde)',
    scriptBtn: 'Viết kịch bản',
    scripting: 'AI đang viết kịch bản…',
    imagesBtn: 'Sinh ảnh cảnh',
    imagesRunning: 'Đang sinh ảnh',
    renderBtn: 'Render video (.webm)',
    rendering: 'Đang render…',
    startOver: 'Làm lại',
    saveBtn: 'Lưu vào thư viện',
    scriptError: 'Không đọc được kịch bản từ AI. Thử lại hoặc chỉnh ý tưởng rõ hơn.',
    needIdea: 'Nhập ý tưởng trước',
    sceneWord: 'Cảnh',
    seconds: 'giây',
    captions: 'caption',
    videoHint: 'Video giữ trong phiên trình duyệt này — bấm Tải xuống để lưu máy.',
    noRecorder: 'Trình duyệt không hỗ trợ ghi video. Hãy tải từng ảnh cảnh về và dựng bằng app khác.',
    addedToLibrary: 'Đã thêm video vào thư viện',
    downloadScenes: 'Tải ảnh từng cảnh',
    posterLabel: 'Poster dự phòng',
    aiLabel: 'AI ảnh thật',
    reloadHint: 'Video chỉ tồn tại trong phiên — hãy tải về trước khi đóng tab.',
  },
  en: {
    createVideo: 'Create Video',
    searchPlaceholder: 'Search videos by title…',
    videos: 'videos',
    totalLength: 'total length',
    storage: 'session storage',
    allCategories: 'All categories',
    allSources: 'All sources',
    emptyTitle: 'No videos yet',
    emptySub: 'Create your first video: the AI writes a scene-by-scene script, generates AI images, then stitches them into a downloadable .webm slideshow (not motion AI video).',
    selected: 'selected',
    delete: 'Delete',
    clear: 'Clear',
    showing: 'Showing',
    of: 'of',
    modalTitle: 'Create a slideshow video from an idea (real AI)',
    slideshowNotice: 'Current videos are SLIDESHOWS: AI-generated scene images stitched in order with smooth transitions + captions — not true motion AI video (Sora / Veo / Runway style).',
    modalSub: 'How it works — Step 1: LLM writes the scene script · Step 2: generates an AI image per scene · Step 3: stitches a .webm slideshow in your browser.',
    suggestionLabel: 'Idea suggestions — click to fill:',
    ideaLabel: 'Idea / product',
    ideaPlaceholder: 'e.g. A new iced-milk-coffee cafe in Saigon for young people, chill vibe',
    scenesLabel: 'Scenes',
    fastImages: 'Fast scene images (Pollinations AI, skips the slow AI Horde queue)',
    scriptBtn: 'Write script',
    scripting: 'AI is writing the script…',
    imagesBtn: 'Generate scene images',
    imagesRunning: 'Generating images',
    renderBtn: 'Render video (.webm)',
    rendering: 'Rendering…',
    startOver: 'Start over',
    saveBtn: 'Save to library',
    scriptError: 'Could not parse the AI script. Try again or make the idea clearer.',
    needIdea: 'Enter the idea first',
    sceneWord: 'Scene',
    seconds: 's',
    captions: 'caption',
    videoHint: 'The video lives in this browser session — press Download to keep it.',
    noRecorder: 'This browser cannot record video. Download the scene images and edit them elsewhere.',
    addedToLibrary: 'Video added to your library',
    downloadScenes: 'Download scene images',
    posterLabel: 'Poster fallback',
    aiLabel: 'Real AI image',
    reloadHint: 'Videos exist only in this session — download before closing the tab.',
  },
};

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseStoryboard(text, expected) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const scenes = [];
  for (const line of lines) {
    if (!line.includes('|')) continue;
    const parts = line.split('|');
    const seconds = Math.min(10, Math.max(2, parseInt(parts[0].replace(/[^0-9]/g, ''), 10) || 6));
    const imagePrompt = (parts[1] || '').trim().slice(0, 220);
    const caption = (parts[2] || '').trim().slice(0, 120);
    if (imagePrompt) scenes.push({ seconds, imagePrompt, caption });
    if (scenes.length >= expected) break;
  }
  if (!scenes.length) {
    // Fallback: treat plain lines as captions, use the idea as the image prompt.
    const plain = lines.slice(0, expected);
    for (let i = 0; i < plain.length; i += 1) {
      scenes.push({ seconds: 6, imagePrompt: `scene ${i + 1}, cinematic`, caption: plain[i].slice(0, 120) });
    }
  }
  return scenes;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawWrapped(ctx, text, x, y, maxWidth, lineCount) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (ctx.measureText(`${line} ${word}`).width > maxWidth && line) { lines.push(line); line = word; }
    else line = `${line} ${word}`.trim();
    if (lines.length >= lineCount) break;
  }
  if (line && lines.length < lineCount) lines.push(line);
  return lines;
}

function drawScene(ctx, image, scene, index, progress, total) {
  // Cover-fit with a subtle Ken Burns zoom.
  const zoom = 1 + 0.10 * progress;
  const scale = Math.max(W / image.width, H / image.height) * zoom;
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.fillStyle = '#0d0b1e';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh);

  // Bottom gradient band + caption.
  const grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
  grad.addColorStop(0, 'rgba(13,11,30,0)');
  grad.addColorStop(1, 'rgba(13,11,30,0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  ctx.font = '600 40px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  const captionLines = drawWrapped(ctx, scene.caption, 0, 0, W * 0.86, 3);
  const baseY = H - 150 - (captionLines.length - 1) * 52;
  captionLines.forEach((line, i) => ctx.fillText(line, W / 2, baseY + i * 52));

  // Scene counter + brand.
  ctx.font = '500 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`${index + 1}/${total}`, W / 2, 92);
  ctx.font = '500 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('AI Social', W / 2, H - 46);
}

async function renderStoryboardVideo(scenes, images, onProgress) {
  if (!window.MediaRecorder || typeof window.MediaRecorder.isTypeSupported !== 'function') {
    throw new Error('NO_RECORDER');
  }
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((m) => MediaRecorder.isTypeSupported(m));
  if (!mimeType) throw new Error('NO_RECORDER');

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })); });
  recorder.start(250);

  const sceneMs = scenes.map((s) => s.seconds * 1000);
  const totalMs = sceneMs.reduce((a, b) => a + b, 0);
  const started = performance.now();
  await new Promise((resolve) => {
    const draw = () => {
      const t = performance.now() - started;
      if (t >= totalMs) { resolve(); return; }
      let idx = 0;
      let acc = 0;
      for (let i = 0; i < sceneMs.length; i += 1) { if (t < acc + sceneMs[i]) { idx = i; break; } acc += sceneMs[i]; idx = i; }
      const local = Math.min(1, (t - acc) / sceneMs[idx]);
      drawScene(ctx, images[idx], scenes[idx], idx, local, scenes.length);
      onProgress(Math.round((t / totalMs) * 100));
      requestAnimationFrame(draw);
    };
    draw();
  });
  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  return stopped;
}

const AILibrary = forwardRef(({ user }, ref) => {
  const [lang] = useLang();
  const T = STRINGS[lang];
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [view, setView] = useState('grid');
  const [selected, setSelected] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Storyboard modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [idea, setIdea] = useState('');
  const [sceneCount, setSceneCount] = useState(4);
  const [fastImages, setFastImages] = useState(true);
  const [stage, setStage] = useState('input'); // input | scripting | images | ready | rendering
  const [scenes, setScenes] = useState([]);
  const [imageProgress, setImageProgress] = useState(0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [modalNotice, setModalNotice] = useState('');

  // Load persisted metadata (videos themselves are session-only blobs).
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LIB_KEY) || '[]');
      if (Array.isArray(stored)) {
        setItems(stored.map((it) => ({ ...it, videoUrl: null, ephemeral: true })));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LIB_KEY, JSON.stringify(items.map(({ videoUrl, ...meta }) => ({ ...meta, videoUrl: undefined, ephemeral: true }))));
    } catch { /* ignore */ }
  }, [items]);

  // Wizard step 4 handoff (b3 -> b4): arriving from Create Image pre-fills the
  // idea (the same prompt behind the generated images) and opens the builder.
  useEffect(() => {
    try {
      const raw = JSON.parse(sessionStorage.getItem('aiSocialVideoHandoff') || 'null');
      if (raw && typeof raw.idea === 'string' && raw.idea.trim()) {
        setIdea(String(raw.idea).slice(0, 400));
        setModalOpen(true);
        setStage('input');
      }
    } catch { /* ignore */ }
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2400);
  };

  const openModal = () => {
    setModalOpen(true);
    setStage('input');
    setScenes([]);
    setImageProgress(0);
    setRenderProgress(0);
    setModalNotice('');
  };

  // Exposed so the sidebar "Create Video" action opens the real modal.
  useImperativeHandle(ref, () => ({ createVideo: openModal }));

  const authHeaders = async () => {
    const headers = { 'Content-Type': 'application/json' };
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    return headers;
  };

  const writeScript = async () => {
    if (!idea.trim()) { setModalNotice(T.needIdea); return; }
    setModalNotice('');
    setStage('scripting');
    try {
      const prompt = `Bạn sẽ viết kịch bản video 30 giây cho: ${idea.trim()}\nTrả về ĐÚNG ${sceneCount} dòng, mỗi dòng có đúng 3 phần ngăn cách bởi dấu | :\nphần 1: thời lượng cảnh tính bằng giây (số nguyên 4-8)\nphần 2: image prompt TIẾNG ANH ngắn (dưới 18 từ) mô tả cảnh để vẽ ảnh dọc 9:16\nphần 3: caption TIẾNG VIỆT ngắn (dưới 12 từ) hiển thị trên màn hình\nTổng thời lượng các cảnh khoảng 30 giây. Không viết gì khác ngoài ${sceneCount} dòng đó.`;
      const response = await fetch(apiUrl('/api/prompts/run'), {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ prompt, system: 'Bạn là đạo diễn video quảng cáo. Chỉ trả về đúng định dạng được yêu cầu.', tier: 'default' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
      const parsed = parseStoryboard(data.text, sceneCount);
      if (!parsed.length) throw new Error(T.scriptError);
      setScenes(parsed);
      setStage('images');
      generateSceneImages(parsed);
    } catch (error) {
      setStage('input');
      setModalNotice(error.message || T.scriptError);
    }
  };

  const generateSceneImages = async (sourceScenes) => {
    const list = sourceScenes || scenes;
    if (!list.length) return;
    setStage('images');
    setImageProgress(0);
    const updated = [...list];
    for (let i = 0; i < updated.length; i += 1) {
      try {
        const response = await fetch(apiUrl('/api/images/generate'), {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ prompt: `${updated[i].imagePrompt}, vertical composition, high detail`, ratio: '9:16', allowHorde: !fastImages }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.image) updated[i] = { ...updated[i], image: data.image, provider: data.provider };
      } catch { /* leave scene without image — poster canvas still renders background */ }
      setImageProgress(Math.round(((i + 1) / updated.length) * 100));
    }
    setScenes(updated);
    setStage('ready');
  };

  const renderVideo = async () => {
    if (!scenes.length) return;
    setModalNotice('');
    setStage('rendering');
    try {
      const withImages = scenes.filter((s) => s.image);
      if (!withImages.length) throw new Error(T.noRecorder);
      const images = await Promise.all(withImages.map((s) => loadImage(s.image)));
      const blob = await renderStoryboardVideo(withImages, images, setRenderProgress);
      if (!blob.size) throw new Error(T.noRecorder);
      const videoUrl = URL.createObjectURL(blob);
      const totalSeconds = withImages.reduce((acc, s) => acc + s.seconds, 0);
      const newItem = {
        id: `v${Date.now()}`,
        title: idea.trim().slice(0, 70) || 'AI video',
        poster: withImages[0].image,
        scenes: withImages.map((s) => ({ caption: s.caption, imagePrompt: s.imagePrompt })),
        duration: formatDuration(totalSeconds),
        size: `${(blob.size / 1_000_000).toFixed(1)} MB`,
        source: 'Storyboard',
        category: 'Lifestyle',
        createdAt: new Date().toISOString().slice(0, 10),
        status: 'ready',
        videoUrl,
        ephemeral: true,
      };
      setItems((prev) => [newItem, ...prev]);
      setModalOpen(false);
      setActiveItem(newItem);
      showToast(T.addedToLibrary);
    } catch (error) {
      setStage('ready');
      setModalNotice(error.message === 'NO_RECORDER' ? T.noRecorder : (error.message || T.scriptError));
    }
  };

  const downloadScenes = () => {
    scenes.forEach((scene, i) => {
      if (!scene.image) return;
      const ext = scene.image.startsWith('data:image/svg') ? 'svg' : scene.image.startsWith('data:image/jpeg') ? 'jpg' : 'png';
      const a = document.createElement('a');
      a.href = scene.image;
      a.download = `scene-${i + 1}.${ext}`;
      a.click();
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); showToast(lang === 'vi' ? 'Đã làm mới' : 'Refreshed'); }, 700);
  };

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const deleteItems = (ids) => {
    setItems((prev) => {
      prev.filter((it) => ids.includes(it.id)).forEach((it) => { if (it.videoUrl) URL.revokeObjectURL(it.videoUrl); });
      return prev.filter((it) => !ids.includes(it.id));
    });
    if (activeItem && ids.includes(activeItem.id)) setActiveItem(null);
    setSelected([]);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((it) => {
      const matchSearch = !q || it.title.toLowerCase().includes(q) || it.category.toLowerCase().includes(q);
      const matchCat = category === 'All' || it.category === category;
      return matchSearch && matchCat;
    });
    list = [...list];
    switch (sortBy) {
      case 'oldest': list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      case 'duration-desc': case 'duration-asc': break;
      default: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return list;
  }, [items, search, category, sortBy]);

  const totalSeconds = useMemo(() => items.reduce((acc, it) => {
    const [m, s] = (it.duration || '0:0').split(':').map(Number);
    return acc + m * 60 + s;
  }, 0), [items]);

  const downloadItem = (item) => {
    if (!item.videoUrl) return;
    const a = document.createElement('a');
    a.href = item.videoUrl;
    a.download = `${item.title.replace(/\s+/g, '-').toLowerCase() || 'ai-social-video'}.webm`;
    a.click();
  };

  return (
    <div className="ai-library-page">
      <div className="ai-toolbar">
        <div className="ai-toolbar-left">
          <button className="ai-icon-btn" type="button" onClick={handleRefresh} title="Refresh" aria-label="Refresh">
            <FontAwesomeIcon icon={faArrowsRotate} spin={refreshing} />
          </button>
          <button className="ai-cta-btn" type="button" onClick={openModal}>
            <FontAwesomeIcon icon={faVideo} /> {T.createVideo}
          </button>
          <button className="ai-pro-pill" type="button" title="PRO plan">
            <FontAwesomeIcon icon={faCrown} /> PRO
          </button>
        </div>
        <div className="ai-toolbar-right">
          <div className="ai-search">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="ai-search-icon" />
            <input
              type="text"
              placeholder={T.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="ai-stats-row">
        <div className="ai-stat"><span className="ai-stat-num">{items.length}</span><span className="ai-stat-label">{T.videos}</span></div>
        <div className="ai-stat"><span className="ai-stat-num">{formatDuration(totalSeconds)}</span><span className="ai-stat-label">{T.totalLength}</span></div>
        <div className="ai-stat"><span className="ai-stat-num">{items.length ? formatDuration(totalSeconds) : '0:00'}</span><span className="ai-stat-label">{T.storage}</span></div>
      </div>

      <div className="ai-filters">
        <div className="ai-filter-group">
          <FontAwesomeIcon icon={faFilter} className="ai-filter-icon" />
          <select className="ai-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category filter">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'All' ? T.allCategories : c}</option>)}
          </select>
        </div>
        <div className="ai-filter-group">
          <select className="ai-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort by">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{lang === 'en' ? o.labelEn : o.labelVi}</option>)}
          </select>
        </div>
        <div className="ai-filter-spacer" />
        <div className="ai-view-toggle" role="group" aria-label="View mode">
          <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>Grid</button>
          <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="ai-bulk-bar">
          <span>{selected.length} {T.selected}</span>
          <button className="ai-bulk-btn danger" type="button" onClick={() => deleteItems(selected)}>
            <FontAwesomeIcon icon={faTrash} /> {T.delete}
          </button>
          <button className="ai-bulk-btn" type="button" onClick={() => setSelected([])}>{T.clear}</button>
        </div>
      )}

      <div className="ai-results-meta">
        <span>{T.showing} <strong>{filtered.length}</strong> {T.of} {items.length} {T.videos}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="ai-empty">
          <FontAwesomeIcon icon={faVideo} className="ai-empty-icon" />
          <h3>{T.emptyTitle}</h3>
          <p>{T.emptySub}</p>
          <button className="ai-cta-btn" type="button" onClick={openModal}>
            <FontAwesomeIcon icon={faPlus} /> {T.createVideo}
          </button>
        </div>
      ) : view === 'grid' ? (
        <div className="ai-grid">
          {filtered.map((it) => (
            <article
              key={it.id}
              className={'ai-card' + (selected.includes(it.id) ? ' selected' : '')}
              onClick={() => setActiveItem(it)}
            >
              <div className="ai-card-thumb">
                {it.poster
                  ? <img src={it.poster} alt={it.title} loading="lazy" />
                  : <div className="ai-card-thumb-fallback"><FontAwesomeIcon icon={faFilm} /></div>}
                <span className="source-badge source-direct">{it.source}</span>
                <span className="ai-duration">{it.duration}</span>
                <div className="ai-card-play"><FontAwesomeIcon icon={faPlay} /></div>
              </div>
              <div className="ai-card-body">
                <p className="ai-card-title" title={it.title}>{it.title}</p>
                <div className="ai-card-meta">
                  <span>{it.size}</span>
                  <span className="ai-dot">·</span>
                  <span>{it.category}</span>
                  {it.ephemeral && !it.videoUrl && <span className="ai-dot">·</span>}
                  {it.ephemeral && !it.videoUrl && <span className="ai-ephemeral-tag">session</span>}
                </div>
              </div>
              <div className="ai-card-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" title={lang === 'vi' ? 'Chọn' : 'Select'} className={selected.includes(it.id) ? 'checked' : ''} onClick={() => toggleSelect(it.id)}>
                  {selected.includes(it.id) ? '✓' : ''}
                </button>
                <button type="button" title={T.createVideo} disabled={!it.videoUrl} onClick={() => downloadItem(it)}>
                  <FontAwesomeIcon icon={faDownload} />
                </button>
                <button type="button" title={T.delete} onClick={() => deleteItems([it.id])}><FontAwesomeIcon icon={faTrash} /></button>
                <button type="button" title="More"><FontAwesomeIcon icon={faEllipsisVertical} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="ai-list">
          <div className="ai-list-head">
            <span></span><span>{lang === 'vi' ? 'Tên' : 'Title'}</span><span>{lang === 'vi' ? 'Nguồn' : 'Source'}</span><span>{lang === 'vi' ? 'Chủ đề' : 'Category'}</span><span>{lang === 'vi' ? 'Thời lượng' : 'Duration'}</span><span>{lang === 'vi' ? 'Dung lượng' : 'Size'}</span><span>{lang === 'vi' ? 'Ngày' : 'Date'}</span><span></span>
          </div>
          {filtered.map((it) => (
            <div key={it.id} className={'ai-list-row' + (selected.includes(it.id) ? ' selected' : '')} onClick={() => setActiveItem(it)}>
              <span className="ai-list-thumb">
                {it.poster ? <img src={it.poster} alt={it.title} loading="lazy" /> : <FontAwesomeIcon icon={faFilm} />}
              </span>
              <span className="ai-list-title">{it.title}</span>
              <span><span className="source-badge source-direct">{it.source}</span></span>
              <span className="ai-list-muted">{it.category}</span>
              <span className="ai-list-muted">{it.duration}</span>
              <span className="ai-list-muted">{it.size}</span>
              <span className="ai-list-muted">{it.createdAt}</span>
              <span className="ai-list-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" disabled={!it.videoUrl} onClick={() => downloadItem(it)}><FontAwesomeIcon icon={faDownload} /></button>
                <button type="button" onClick={() => deleteItems([it.id])}><FontAwesomeIcon icon={faTrash} /></button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {activeItem && (
        <div className="ai-modal-backdrop" onClick={() => setActiveItem(null)}>
          <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
            <button className="ai-modal-close" type="button" onClick={() => setActiveItem(null)}>×</button>
            <div className="ai-modal-media">
              {activeItem.videoUrl ? (
                <video src={activeItem.videoUrl} controls autoPlay playsInline style={{ width: '100%', borderRadius: '12px', display: 'block' }} />
              ) : (
                <>
                  {activeItem.poster
                    ? <img src={activeItem.poster} alt={activeItem.title} style={{ width: '100%', borderRadius: '12px', display: 'block' }} />
                    : <div className="ai-card-thumb-fallback tall"><FontAwesomeIcon icon={faFilm} /></div>}
                  <p className="ai-reload-hint">{T.reloadHint}</p>
                </>
              )}
            </div>
            <div className="ai-modal-info">
              <div className="ai-modal-tags">
                <span className="source-badge source-direct">{activeItem.source}</span>
                <span className="ai-modal-cat">{activeItem.category}</span>
              </div>
              <h2>{activeItem.title}</h2>
              {activeItem.scenes?.length > 0 && (
                <div className="ai-scene-list">
                  {activeItem.scenes.map((s, i) => (
                    <div key={i} className="ai-scene-row"><strong>{i + 1}</strong><span>{s.caption || s.imagePrompt}</span></div>
                  ))}
                </div>
              )}
              <dl className="ai-modal-meta">
                <div><dt>{lang === 'vi' ? 'Thời lượng' : 'Duration'}</dt><dd>{activeItem.duration}</dd></div>
                <div><dt>{lang === 'vi' ? 'Dung lượng' : 'File size'}</dt><dd>{activeItem.size}</dd></div>
                <div><dt>{lang === 'vi' ? 'Ngày tạo' : 'Created'}</dt><dd>{activeItem.createdAt}</dd></div>
              </dl>
              <div className="ai-modal-actions">
                <button className="ai-cta-btn" type="button" disabled={!activeItem.videoUrl} onClick={() => downloadItem(activeItem)}>
                  <FontAwesomeIcon icon={faDownload} /> Download
                </button>
                <button className="ai-ghost-btn danger" type="button" onClick={() => { deleteItems([activeItem.id]); }}>
                  <FontAwesomeIcon icon={faTrash} /> {T.delete}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storyboard creation modal */}
      {modalOpen && (
        <div className="ai-modal-backdrop" onClick={() => { if (stage !== 'scripting' && stage !== 'images' && stage !== 'rendering') setModalOpen(false); }}>
          <div className="ai-modal ai-modal-wide" onClick={(e) => e.stopPropagation()}>
            <button className="ai-modal-close" type="button" onClick={() => setModalOpen(false)}><FontAwesomeIcon icon={faXmark} /></button>
            <h2 className="ai-modal-title"><FontAwesomeIcon icon={faWandMagicSparkles} /> {T.modalTitle}</h2>
            <div className="ai-notice" role="note">
              <FontAwesomeIcon icon={faCircleInfo} />
              <span>{T.slideshowNotice}</span>
            </div>
            <p className="ai-modal-sub">{T.modalSub}</p>

            {stage === 'input' && (
              <div className="ai-storyboard-form">
                <label className="ai-label">{T.ideaLabel}</label>
                <textarea
                  className="ai-textarea"
                  rows="3"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder={T.ideaPlaceholder}
                />
                <div className="ai-idea-chips">
                  <span className="ai-idea-chips-label">{T.suggestionLabel}</span>
                  <div className="ai-idea-chips-row">
                    {IDEA_VIDEO_SUGGESTIONS.map((s) => (
                      <button key={s} type="button" className="ai-idea-chip" onClick={() => setIdea(s)}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="ai-form-row">
                  <label className="ai-label">{T.scenesLabel}: <strong>{sceneCount}</strong></label>
                  <input type="range" min="3" max="5" value={sceneCount} onChange={(e) => setSceneCount(Number(e.target.value))} />
                </div>
                <label className="ai-checkbox">
                  <input type="checkbox" checked={fastImages} onChange={(e) => setFastImages(e.target.checked)} />
                  {T.fastImages}
                </label>
                <button type="button" className="ai-cta-btn" onClick={writeScript}>
                  <FontAwesomeIcon icon={faWandMagicSparkles} /> {T.scriptBtn}
                </button>
              </div>
            )}

            {stage === 'scripting' && (
              <div className="ai-stage-status">
                <span className="spinner-border spinner-border-sm" />
                <span>{T.scripting}</span>
              </div>
            )}

            {(stage === 'images' || stage === 'ready' || stage === 'rendering') && (
              <div className="ai-scenes-panel">
                <div className="ai-stage-status">
                  {stage === 'images' && <><span className="spinner-border spinner-border-sm" /><span>{T.imagesRunning} {imageProgress}%</span></>}
                  {stage === 'ready' && <><FontAwesomeIcon icon={faImage} /><span>{T.imagesBtn}: {scenes.filter((s) => s.image).length}/{scenes.length}</span></>}
                  {stage === 'rendering' && <><span className="spinner-border spinner-border-sm" /><span>{T.rendering} {renderProgress}%</span></>}
                </div>
                <div className="ai-progress-track"><div className="ai-progress-fill" style={{ width: `${stage === 'rendering' ? renderProgress : imageProgress}%` }} /></div>
                <div className="ai-scene-editor">
                  {scenes.map((scene, i) => (
                    <div key={i} className="ai-scene-card">
                      <div className="ai-scene-thumb">
                        {scene.image
                          ? <img src={scene.image} alt={scene.caption} />
                          : <div className="ai-card-thumb-fallback"><span className="spinner-border spinner-border-sm" /></div>}
                        {scene.provider && <span className={`ci-provider-badge p-${scene.provider}`}>{scene.provider === 'poster' ? T.posterLabel : T.aiLabel}</span>}
                      </div>
                      <div className="ai-scene-info">
                        <strong>{T.sceneWord} {i + 1} · {scene.seconds}{T.seconds}</strong>
                        <p>{scene.caption}</p>
                        <small>{scene.imagePrompt}</small>
                      </div>
                    </div>
                  ))}
                </div>
                {stage === 'ready' && (
                  <div className="ai-modal-actions">
                    <button type="button" className="ai-cta-btn" onClick={renderVideo}>
                      <FontAwesomeIcon icon={faFilm} /> {T.renderBtn}
                    </button>
                    <button type="button" className="ai-ghost-btn" onClick={downloadScenes}>
                      <FontAwesomeIcon icon={faDownload} /> {T.downloadScenes}
                    </button>
                    <button type="button" className="ai-ghost-btn" onClick={() => { setStage('input'); setScenes([]); }}>
                      {T.startOver}
                    </button>
                  </div>
                )}
              </div>
            )}

            {modalNotice && <div className="alert alert-danger mt-3" role="alert">{modalNotice}</div>}
          </div>
        </div>
      )}

      {toast && <div className="ai-toast">{toast}</div>}
    </div>
  );
});

export default AILibrary;
