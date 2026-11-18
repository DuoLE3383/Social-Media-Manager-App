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
  faShare,
} from '@fortawesome/free-solid-svg-icons';

// Sample AI-generated video library items.
// Thumbnails use picsum.photos with deterministic seeds so each card stays stable.
const SAMPLE_VIDEOS = [
  { id: 'v01', title: 'Orange cat on Hanoi old quarter street', seed: 'hanoicat', duration: '0:15', size: '3.2 MB', source: 'Muse', category: 'Animals', createdAt: '2026-11-16', status: 'ready' },
  { id: 'v02', title: 'Golden retriever running through park', seed: 'goldendog', duration: '0:22', size: '5.1 MB', source: 'Dola', category: 'Animals', createdAt: '2026-11-15', status: 'ready' },
  { id: 'v03', title: 'Woman in yellow ao dai walking by the lake', seed: 'aodai', duration: '0:18', size: '4.4 MB', source: 'Tạo trực tiếp', category: 'Lifestyle', createdAt: '2026-11-15', status: 'ready' },
  { id: 'v04', title: 'Ducklings on the green grass field', seed: 'ducklings', duration: '0:09', size: '2.3 MB', source: 'Muse', category: 'Animals', createdAt: '2026-11-14', status: 'ready' },
  { id: 'v05', title: 'Yellow bird perched on balcony railing', seed: 'yellowbird', duration: '0:12', size: '2.8 MB', source: 'Dola', category: 'Animals', createdAt: '2026-11-14', status: 'ready' },
  { id: 'v06', title: 'Puppy resting on the living room sofa', seed: 'sofapuppy', duration: '0:27', size: '6.2 MB', source: 'Tạo trực tiếp', category: 'Animals', createdAt: '2026-11-13', status: 'ready' },
  { id: 'v07', title: 'Vietnamese iced milk coffee close-up pour', seed: 'caphesua', duration: '0:32', size: '7.0 MB', source: 'Muse', category: 'Food', createdAt: '2026-11-13', status: 'ready' },
  { id: 'v08', title: 'Family dinner conversation drama scene', seed: 'family', duration: '0:25', size: '5.8 MB', source: 'Dola', category: 'People', createdAt: '2026-11-12', status: 'ready' },
  { id: 'v09', title: 'Blue flame black dragon figurine on shelf', seed: 'blackdragon', duration: '0:14', size: '3.6 MB', source: 'Tạo trực tiếp', category: 'Objects', createdAt: '2026-11-12', status: 'ready' },
  { id: 'v10', title: 'Rubber ducks floating on pond water', seed: 'pondducks', duration: '0:08', size: '2.0 MB', source: 'Muse', category: 'Animals', createdAt: '2026-11-11', status: 'ready' },
  { id: 'v11', title: 'Red-whiskered bulbul on tree branch', seed: 'bulbul', duration: '0:19', size: '4.1 MB', source: 'Dola', category: 'Animals', createdAt: '2026-11-11', status: 'ready' },
  { id: 'v12', title: 'Yellow warbler singing on twig', seed: 'warbler', duration: '0:11', size: '2.6 MB', source: 'Tạo trực tiếp', category: 'Animals', createdAt: '2026-11-10', status: 'ready' },
  { id: 'v13', title: 'Hanoi train street at golden hour', seed: 'trainstreet', duration: '0:21', size: '4.9 MB', source: 'Muse', category: 'Scenery', createdAt: '2026-11-10', status: 'ready' },
  { id: 'v14', title: 'Bowl of pho with steam rising', seed: 'pho', duration: '0:16', size: '3.8 MB', source: 'Dola', category: 'Food', createdAt: '2026-11-09', status: 'ready' },
  { id: 'v15', title: 'Lantern festival in Hoi An ancient town', seed: 'hoian', duration: '0:24', size: '5.5 MB', source: 'Tạo trực tiếp', category: 'Scenery', createdAt: '2026-11-09', status: 'ready' },
  { id: 'v16', title: 'Rice terraces at sunrise in Sapa', seed: 'sapa', duration: '0:30', size: '6.7 MB', source: 'Muse', category: 'Scenery', createdAt: '2026-11-08', status: 'ready' },
];

const CATEGORIES = ['All', 'Animals', 'Food', 'Lifestyle', 'People', 'Objects', 'Scenery'];
const SOURCES = ['All', 'Muse', 'Dola', 'Tạo trực tiếp'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'duration-desc', label: 'Longest duration' },
  { value: 'duration-asc', label: 'Shortest duration' },
  { value: 'size-desc', label: 'Largest size' },
];

const parseDuration = (d) => {
  const [m, s] = d.split(':').map(Number);
  return m * 60 + s;
};
const parseSize = (s) => parseFloat(s);

const sourceBadgeClass = (source) => {
  if (source === 'Muse') return 'source-badge source-muse';
  if (source === 'Dola') return 'source-badge source-dola';
  return 'source-badge source-direct';
};

const AILibrary = forwardRef(({ user }, ref) => {
  const [items, setItems] = useState(SAMPLE_VIDEOS);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [source, setSource] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [view, setView] = useState('grid'); // grid | list
  const [selected, setSelected] = useState([]); // ids selected for bulk action
  const [activeItem, setActiveItem] = useState(null); // item open in preview modal
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Persist library in localStorage so user additions survive reloads.
  useEffect(() => {
    const stored = localStorage.getItem('aiLibraryItems');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) setItems(parsed);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('aiLibraryItems', JSON.stringify(items));
  }, [items]);

  const filtered = useMemo(() => {
    let list = items.filter((it) => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q || it.title.toLowerCase().includes(q) || it.category.toLowerCase().includes(q) || it.source.toLowerCase().includes(q);
      const matchCat = category === 'All' || it.category === category;
      const matchSrc = source === 'All' || it.source === source;
      return matchSearch && matchCat && matchSrc;
    });
    list = [...list];
    switch (sortBy) {
      case 'oldest': list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      case 'duration-desc': list.sort((a, b) => parseDuration(b.duration) - parseDuration(a.duration)); break;
      case 'duration-asc': list.sort((a, b) => parseDuration(a.duration) - parseDuration(b.duration)); break;
      case 'size-desc': list.sort((a, b) => parseSize(b.size) - parseSize(a.size)); break;
      default: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return list;
  }, [items, search, category, source, sortBy]);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2200);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      showToast('Library refreshed');
    }, 900);
  };

  const handleCreateVideo = () => {
    const newItem = {
      id: 'v' + Date.now(),
      title: 'New AI video ' + new Date().toLocaleString(),
      seed: 'new' + Date.now(),
      duration: '0:' + String(5 + Math.floor(Math.random() * 25)).padStart(2, '0'),
      size: (2 + Math.random() * 5).toFixed(1) + ' MB',
      source: 'Tạo trực tiếp',
      category: 'Lifestyle',
      createdAt: new Date().toISOString().slice(0, 10),
      status: 'processing',
    };
    setItems([newItem, ...items]);
    showToast('Video creation started — check back shortly');
  };

  // Expose createVideo to the parent shell so the sidebar "Create Video" item can trigger it.
  useImperativeHandle(ref, () => ({ createVideo: handleCreateVideo }));

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleDeleteSelected = () => {
    if (!selected.length) return;
    setItems((prev) => prev.filter((it) => !selected.includes(it.id)));
    showToast(selected.length + ' item(s) deleted');
    setSelected([]);
  };

  const handleDeleteOne = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (activeItem && activeItem.id === id) setActiveItem(null);
    showToast('Item deleted');
  };

  const totalDuration = useMemo(() => {
    const secs = items.reduce((acc, it) => acc + parseDuration(it.duration), 0);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  }, [items]);

  const totalSize = useMemo(() => {
    const mb = items.reduce((acc, it) => acc + parseSize(it.size), 0);
    return mb.toFixed(1) + ' MB';
  }, [items]);

  return (
    <div className="ai-library-page">
      {/* Page-specific toolbar */}
      <div className="ai-toolbar">
        <div className="ai-toolbar-left">
          <button className="ai-icon-btn" type="button" onClick={handleRefresh} title="Refresh" aria-label="Refresh">
            <FontAwesomeIcon icon={faArrowsRotate} spin={refreshing} />
          </button>
          <button className="ai-cta-btn" type="button" onClick={handleCreateVideo}>
            <FontAwesomeIcon icon={faVideo} /> Create Videos
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
              placeholder="Search videos by title, tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="ai-stats-row">
        <div className="ai-stat"><span className="ai-stat-num">{items.length}</span><span className="ai-stat-label">videos</span></div>
        <div className="ai-stat"><span className="ai-stat-num">{totalDuration}</span><span className="ai-stat-label">total length</span></div>
        <div className="ai-stat"><span className="ai-stat-num">{totalSize}</span><span className="ai-stat-label">storage</span></div>
      </div>

      <div className="ai-filters">
        <div className="ai-filter-group">
          <FontAwesomeIcon icon={faFilter} className="ai-filter-icon" />
          <select className="ai-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category filter">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
          </select>
        </div>
        <div className="ai-filter-group">
          <select className="ai-select" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source filter">
            {SOURCES.map((s) => <option key={s} value={s}>{s === 'All' ? 'All sources' : s}</option>)}
          </select>
        </div>
        <div className="ai-filter-group">
          <select className="ai-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort by">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          <span>{selected.length} selected</span>
          <button className="ai-bulk-btn danger" type="button" onClick={handleDeleteSelected}>
            <FontAwesomeIcon icon={faTrash} /> Delete
          </button>
          <button className="ai-bulk-btn" type="button" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      <div className="ai-results-meta">
        <span>Showing <strong>{filtered.length}</strong> of {items.length} videos</span>
      </div>

      {filtered.length === 0 ? (
        <div className="ai-empty">
          <FontAwesomeIcon icon={faVideo} className="ai-empty-icon" />
          <h3>No videos match your filters</h3>
          <p>Try adjusting the search or filters, or create a new AI video.</p>
          <button className="ai-cta-btn" type="button" onClick={handleCreateVideo}>
            <FontAwesomeIcon icon={faPlus} /> Create Video
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
                <img src={`https://picsum.photos/seed/${it.seed}/360/640`} alt={it.title} loading="lazy" />
                <span className={sourceBadgeClass(it.source)}>{it.source}</span>
                <span className="ai-duration">{it.duration}</span>
                <div className="ai-card-play"><FontAwesomeIcon icon={faPlay} /></div>
                {it.status === 'processing' && <span className="ai-status-processing">Processing…</span>}
              </div>
              <div className="ai-card-body">
                <p className="ai-card-title" title={it.title}>{it.title}</p>
                <div className="ai-card-meta">
                  <span>{it.size}</span>
                  <span className="ai-dot">·</span>
                  <span>{it.category}</span>
                </div>
              </div>
              <div className="ai-card-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" title="Select" className={selected.includes(it.id) ? 'checked' : ''} onClick={() => toggleSelect(it.id)}>
                  {selected.includes(it.id) ? '✓' : ''}
                </button>
                <button type="button" title="Download"><FontAwesomeIcon icon={faDownload} /></button>
                <button type="button" title="Delete" onClick={() => handleDeleteOne(it.id)}><FontAwesomeIcon icon={faTrash} /></button>
                <button type="button" title="More"><FontAwesomeIcon icon={faEllipsisVertical} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="ai-list">
          <div className="ai-list-head">
            <span></span><span>Title</span><span>Source</span><span>Category</span><span>Duration</span><span>Size</span><span>Date</span><span></span>
          </div>
          {filtered.map((it) => (
            <div key={it.id} className={'ai-list-row' + (selected.includes(it.id) ? ' selected' : '')} onClick={() => setActiveItem(it)}>
              <span className="ai-list-thumb"><img src={`https://picsum.photos/seed/${it.seed}/120/180`} alt={it.title} loading="lazy" /></span>
              <span className="ai-list-title">{it.title}</span>
              <span><span className={sourceBadgeClass(it.source)}>{it.source}</span></span>
              <span className="ai-list-muted">{it.category}</span>
              <span className="ai-list-muted">{it.duration}</span>
              <span className="ai-list-muted">{it.size}</span>
              <span className="ai-list-muted">{it.createdAt}</span>
              <span className="ai-list-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" title="Download"><FontAwesomeIcon icon={faDownload} /></button>
                <button type="button" title="Delete" onClick={() => handleDeleteOne(it.id)}><FontAwesomeIcon icon={faTrash} /></button>
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
              <img src={`https://picsum.photos/seed/${activeItem.seed}/540/960`} alt={activeItem.title} />
              <span className="ai-duration ai-modal-duration">{activeItem.duration}</span>
              <div className="ai-modal-play"><FontAwesomeIcon icon={faPlay} /></div>
            </div>
            <div className="ai-modal-info">
              <div className="ai-modal-tags">
                <span className={sourceBadgeClass(activeItem.source)}>{activeItem.source}</span>
                <span className="ai-modal-cat">{activeItem.category}</span>
              </div>
              <h2>{activeItem.title}</h2>
              <dl className="ai-modal-meta">
                <div><dt>Duration</dt><dd>{activeItem.duration}</dd></div>
                <div><dt>File size</dt><dd>{activeItem.size}</dd></div>
                <div><dt>Created</dt><dd>{activeItem.createdAt}</dd></div>
                <div><dt>Aspect</dt><dd>9:16 vertical</dd></div>
                <div><dt>Status</dt><dd>{activeItem.status === 'processing' ? 'Processing' : 'Ready'}</dd></div>
              </dl>
              <div className="ai-modal-actions">
                <button className="ai-cta-btn" type="button"><FontAwesomeIcon icon={faDownload} /> Download</button>
                <button className="ai-ghost-btn" type="button"><FontAwesomeIcon icon={faShare} /> Share</button>
                <button className="ai-ghost-btn danger" type="button" onClick={() => handleDeleteOne(activeItem.id)}><FontAwesomeIcon icon={faTrash} /> Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="ai-toast">{toast}</div>}
    </div>
  );
});

export default AILibrary;
