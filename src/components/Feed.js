import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faComment,
  faShare,
  faImage,
  faVideo,
  faSmile,
  faThumbsUp,
  faCalendarAlt,
  faCalendarDays,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../lib/i18n';

const SAMPLE_POSTS = [
  {
    id: 1,
    author: { name: 'Cà phê Sài Gòn', picture: 'https://ui-avatars.com/api/?name=Cafe+SG&background=6f42c1&color=fff' },
    content: 'Buổi sáng thứ Hai bắt đầu với một ly cà phê sữa đá đúng điệu ☕️ Bạn đã thử cà phê phin truyền thống của chúng tôi chưa?',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    likes: 142,
    comments: [
      { id: 1, author: 'Minh Anh', content: 'Ly cà phê nhìn hấp dẫn quá!', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) },
      { id: 2, author: 'Trần Nam', content: 'Đặt một ly ngay bây giờ 🔥', timestamp: new Date(Date.now() - 30 * 60 * 1000) },
    ],
    shares: 12,
    media: { type: 'image', url: 'https://picsum.photos/seed/coffeesaigon/600/360' },
  },
  {
    id: 2,
    author: { name: 'Hanoi Travel', picture: 'https://ui-avatars.com/api/?name=HN+Travel&background=e0653f&color=fff' },
    content: 'Phố cổ Hà Nội lúc hoàng hôn — nơi mỗi góc phố đều kể một câu chuyện riêng 🌅',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    likes: 289,
    comments: [
      { id: 1, author: 'Lê Hoa', content: 'Đẹp quá!', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000) },
    ],
    shares: 34,
    media: { type: 'image', url: 'https://picsum.photos/seed/hanoistreet/600/360' },
  },
  {
    id: 3,
    author: { name: 'Foodie Vietnam', picture: 'https://ui-avatars.com/api/?name=Foodie&background=2aa17a&color=fff' },
    content: 'Bát phở bò nóng hổi khói bốc lên — đặc sản Việt Nam không thể bỏ qua! Cùng khám phá hành trình ẩm thực Việt trong tuần này.',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    likes: 412,
    comments: [],
    shares: 56,
    media: null,
  },
];

const Feed = ({ user }) => {
  const navigate = useNavigate();
  const [lang] = useLang();
  const t = {
    vi: {
      composerTrigger: 'Bạn muốn chia sẻ điều gì?',
      composerPh: 'Chia sẻ câu chuyện của bạn...',
      toolImage: 'Ảnh', toolVideo: 'Video', toolMood: 'Cảm xúc',
      cancel: 'Huỷ', post: 'Đăng bài',
      like: 'Thích', comment: 'Bình luận', share: 'Chia sẻ',
      schedule: 'Lên lịch', scheduleTitle: 'Đưa bài này vào Lịch đăng — đăng bài cần đăng nhập',
      commentPh: 'Viết bình luận...', send: 'Gửi',
      minAgo: 'phút trước', hourAgo: 'giờ trước', dayAgo: 'ngày trước',
    },
    en: {
      composerTrigger: 'What do you want to share?',
      composerPh: 'Share your story...',
      toolImage: 'Photo', toolVideo: 'Video', toolMood: 'Feeling',
      cancel: 'Cancel', post: 'Post',
      like: 'Like', comment: 'Comment', share: 'Share',
      schedule: 'Schedule', scheduleTitle: 'Put this post on the publishing calendar — sign-in required to publish',
      commentPh: 'Write a comment...', send: 'Send',
      minAgo: 'm ago', hourAgo: 'h ago', dayAgo: 'd ago',
    },
  }[lang] || {};
  const [posts, setPosts] = useState(SAMPLE_POSTS);
  const [newPost, setNewPost] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = () => {
    if (!newPost.trim()) return;
    const post = {
      id: Date.now(),
      author: { name: user?.name || 'User', picture: user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}` },
      content: newPost,
      timestamp: new Date(),
      likes: 0,
      comments: [],
      shares: 0,
      media: null,
    };
    setPosts([post, ...posts]);
    setNewPost('');
    setShowCreate(false);
  };

  const handleLike = (id) => {
    setPosts((p) => p.map((post) => (post.id === id ? { ...post, likes: post.likes + 1 } : post)));
  };

  const handleComment = (id, text) => {
    if (!text.trim()) return;
    setPosts((p) => p.map((post) => (post.id === id
      ? { ...post, comments: [...post.comments, { id: Date.now(), author: user?.name || 'User', content: text, timestamp: new Date() }] }
      : post)));
  };

  const handleShare = (id) => {
    setPosts((p) => p.map((post) => (post.id === id ? { ...post, shares: post.shares + 1 } : post)));
  };

  // Action-level gating: scheduling/publishing is the one step that needs an
  // account. Guests land on the LoginRequired interstitial (route keeps
  // ?next=/publish-plan so sign-in returns them straight to the calendar).
  const schedulePost = (post) => {
    try {
      sessionStorage.setItem('aiSocialPublishHandoff', JSON.stringify({
        title: String(post.content || '').slice(0, 140),
        ts: Date.now(),
      }));
    } catch { /* ignore */ }
    navigate('/publish-plan');
  };

  const fmt = (ts) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 60) return `${m} ${t.minAgo}`;
    if (h < 24) return `${h} ${t.hourAgo}`;
    return `${d} ${t.dayAgo}`;
  };

  return (
    <div className="feed-page">
      {/* Composer */}
      <div className="feed-composer">
        <img
          src={user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}`}
          alt="Profile"
          className="feed-avatar"
        />
        <div className="feed-composer-body">
          {!showCreate ? (
            <button className="feed-composer-trigger" onClick={() => setShowCreate(true)}>
              {t.composerTrigger}
            </button>
          ) : (
            <>
              <textarea
                className="feed-textarea"
                rows="3"
                placeholder={t.composerPh}
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                autoFocus
              />
              <div className="feed-composer-actions">
                <div className="feed-composer-tools">
                  <button type="button" className="feed-tool-btn">
                    <FontAwesomeIcon icon={faImage} /> {t.toolImage}
                  </button>
                  <button type="button" className="feed-tool-btn">
                    <FontAwesomeIcon icon={faVideo} /> {t.toolVideo}
                  </button>
                  <button type="button" className="feed-tool-btn">
                    <FontAwesomeIcon icon={faSmile} /> {t.toolMood}
                  </button>
                </div>
                <div className="feed-composer-submit">
                  <button type="button" className="feed-cancel-btn" onClick={() => setShowCreate(false)}>{t.cancel}</button>
                  <button type="button" className="feed-post-btn" onClick={handleCreate} disabled={!newPost.trim()}>
                    {t.post}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="feed-list">
        {posts.map((post) => (
          <article key={post.id} className="feed-post">
            <header className="feed-post-head">
              <img src={post.author.picture} alt={post.author.name} className="feed-avatar" />
              <div>
                <strong>{post.author.name}</strong>
                <small><FontAwesomeIcon icon={faCalendarAlt} /> {fmt(post.timestamp)}</small>
              </div>
            </header>
            <p className="feed-post-content">{post.content}</p>
            {post.media && post.media.type === 'image' && (
              <img src={post.media.url} alt="" className="feed-post-media" />
            )}
            <footer className="feed-post-actions">
              <button type="button" onClick={() => handleLike(post.id)}>
                <FontAwesomeIcon icon={faThumbsUp} /> {t.like} ({post.likes})
              </button>
              <button type="button">
                <FontAwesomeIcon icon={faComment} /> {t.comment} ({post.comments.length})
              </button>
              <button type="button" onClick={() => handleShare(post.id)}>
                <FontAwesomeIcon icon={faShare} /> {t.share} ({post.shares})
              </button>
              <button type="button" className="feed-schedule-btn" onClick={() => schedulePost(post)} title={t.scheduleTitle}>
                <FontAwesomeIcon icon={faCalendarDays} /> {t.schedule}
              </button>
            </footer>
            {/* The comment box ALWAYS renders — previously it only appeared
                when a post already had comments, so the Comment button was a
                dead end for posts with zero comments. */}
            <div className="feed-comments">
              {post.comments.map((c) => (
                <div key={c.id} className="feed-comment">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&background=ecebff&color=5047a8`}
                    alt=""
                    className="feed-avatar feed-avatar-sm"
                  />
                  <div className="feed-comment-body">
                    <strong>{c.author}</strong>
                    <p>{c.content}</p>
                    <small>{fmt(c.timestamp)}</small>
                  </div>
                </div>
              ))}
              <CommentBox onSubmit={(text) => handleComment(post.id, text)} user={user} placeholder={t.commentPh} sendLabel={t.send} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

const CommentBox = ({ onSubmit, user, placeholder, sendLabel }) => {
  const [text, setText] = useState('');
  return (
    <form
      className="feed-comment-box"
      onSubmit={(e) => { e.preventDefault(); onSubmit(text); setText(''); }}
    >
      <img
        src={user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}`}
        alt=""
        className="feed-avatar feed-avatar-sm"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" disabled={!text.trim()}>{sendLabel}</button>
    </form>
  );
};

export default Feed;
