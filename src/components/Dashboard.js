import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faComment, 
  faShare, 
  faImage, 
  faVideo,
  faSmile,
  faThumbsUp,
  faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';

const Dashboard = ({ user }) => {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);

  // Sample initial posts
  useEffect(() => {
    const samplePosts = [
      {
        id: 1,
        author: {
          name: 'John Doe',
          picture: 'https://via.placeholder.com/40'
        },
        content: 'Just finished an amazing workout session! 💪 Feeling energized and ready to tackle the day. What\'s everyone up to today?',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        likes: 15,
        comments: [
          { id: 1, author: 'Jane Smith', content: 'Keep up the great work!', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) },
          { id: 2, author: 'Mike Johnson', content: 'Motivation! 🔥', timestamp: new Date(Date.now() - 30 * 60 * 1000) }
        ],
        shares: 3,
        media: null
      },
      {
        id: 2,
        author: {
          name: 'Sarah Wilson',
          picture: 'https://via.placeholder.com/40'
        },
        content: 'Beautiful sunset from my evening walk 🌅 Nature never fails to amaze me!',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        likes: 23,
        comments: [
          { id: 1, author: 'Alex Brown', content: 'Absolutely stunning!', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000) }
        ],
        shares: 1,
        media: {
          type: 'image',
          url: 'https://via.placeholder.com/500x300?text=Beautiful+Sunset'
        }
      }
    ];
    setPosts(samplePosts);
  }, []);

  const handleCreatePost = () => {
    if (newPost.trim()) {
      const post = {
        id: Date.now(),
        author: {
          name: user.name,
          picture: user.picture
        },
        content: newPost,
        timestamp: new Date(),
        likes: 0,
        comments: [],
        shares: 0,
        media: selectedMedia
      };
      setPosts([post, ...posts]);
      setNewPost('');
      setSelectedMedia(null);
      setShowCreatePost(false);
    }
  };

  const handleLike = (postId) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, likes: post.likes + 1 }
        : post
    ));
  };

  const handleComment = (postId, commentText) => {
    if (commentText.trim()) {
      const newComment = {
        id: Date.now(),
        author: user.name,
        content: commentText,
        timestamp: new Date()
      };
      
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, comments: [...post.comments, newComment] }
          : post
      ));
    }
  };

  const handleShare = (postId) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, shares: post.shares + 1 }
        : post
    ));
    alert('Post shared!');
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  };

  return (
    <div className="dashboard-container py-4">
      <div className="row">
        {/* Sidebar */}
        <div className="col-lg-3">
          <div className="card mb-4">
            <div className="card-body text-center">
              <img 
                src={user.picture} 
                alt="Profile" 
                className="rounded-circle mb-3"
                width="80" 
                height="80"
              />
              <h5 className="card-title">{user.name}</h5>
              <p className="text-muted">{user.email}</p>
            </div>
          </div>
          
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Quick Stats</h6>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between mb-2">
                <span>Posts</span>
                <span className="badge bg-primary">{posts.filter(p => p.author.name === user.name).length}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span>Likes Given</span>
                <span className="badge bg-success">0</span>
              </div>
              <div className="d-flex justify-content-between">
                <span>Comments</span>
                <span className="badge bg-info">0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="col-lg-6">
          {/* Create Post */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <img 
                  src={user.picture} 
                  alt="Profile" 
                  className="rounded-circle me-3"
                  width="40" 
                  height="40"
                />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="What's on your mind?"
                  onClick={() => setShowCreatePost(true)}
                  readOnly
                />
              </div>
              
              {showCreatePost && (
                <div>
                  <textarea 
                    className="form-control mb-3" 
                    rows="3" 
                    placeholder="Share your thoughts..."
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                  />
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <button className="btn btn-outline-primary btn-sm me-2">
                        <FontAwesomeIcon icon={faImage} className="me-1" />
                        Photo
                      </button>
                      <button className="btn btn-outline-primary btn-sm me-2">
                        <FontAwesomeIcon icon={faVideo} className="me-1" />
                        Video
                      </button>
                      <button className="btn btn-outline-primary btn-sm">
                        <FontAwesomeIcon icon={faSmile} className="me-1" />
                        Feeling
                      </button>
                    </div>
                    <div>
                      <button 
                        className="btn btn-secondary btn-sm me-2"
                        onClick={() => setShowCreatePost(false)}
                      >
                        Cancel
                      </button>
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={handleCreatePost}
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Posts Feed */}
          {posts.map(post => (
            <PostCard 
              key={post.id} 
              post={post} 
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
              formatTimestamp={formatTimestamp}
              currentUser={user}
            />
          ))}
        </div>

        {/* Right Sidebar */}
        <div className="col-lg-3">
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">Trending Topics</h6>
            </div>
            <div className="card-body">
              <div className="mb-2">
                <button className="btn btn-link p-0 text-decoration-none">#ReactJS</button>
                <small className="text-muted d-block">1.2k posts</small>
              </div>
              <div className="mb-2">
                <button className="btn btn-link p-0 text-decoration-none">#WebDevelopment</button>
                <small className="text-muted d-block">856 posts</small>
              </div>
              <div className="mb-2">
                <button className="btn btn-link p-0 text-decoration-none">#SocialMedia</button>
                <small className="text-muted d-block">432 posts</small>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Suggested Friends</h6>
            </div>
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <img 
                  src="https://via.placeholder.com/40" 
                  alt="Friend" 
                  className="rounded-circle me-3"
                  width="40" 
                  height="40"
                />
                <div className="flex-grow-1">
                  <div className="fw-bold">Emma Johnson</div>
                  <small className="text-muted">2 mutual friends</small>
                </div>
                <button className="btn btn-primary btn-sm">Add</button>
              </div>
              <div className="d-flex align-items-center">
                <img 
                  src="https://via.placeholder.com/40" 
                  alt="Friend" 
                  className="rounded-circle me-3"
                  width="40" 
                  height="40"
                />
                <div className="flex-grow-1">
                  <div className="fw-bold">David Lee</div>
                  <small className="text-muted">5 mutual friends</small>
                </div>
                <button className="btn btn-primary btn-sm">Add</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Separate PostCard component
const PostCard = ({ post, onLike, onComment, onShare, formatTimestamp, currentUser }) => {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (newComment.trim()) {
      onComment(post.id, newComment);
      setNewComment('');
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-body">
        {/* Post Header */}
        <div className="d-flex align-items-center mb-3">
          <img 
            src={post.author.picture} 
            alt="Author" 
            className="rounded-circle me-3"
            width="40" 
            height="40"
          />
          <div>
            <div className="fw-bold">{post.author.name}</div>
            <small className="text-muted">
              <FontAwesomeIcon icon={faCalendarAlt} className="me-1" />
              {formatTimestamp(post.timestamp)}
            </small>
          </div>
        </div>

        {/* Post Content */}
        <p className="mb-3">{post.content}</p>

        {/* Post Media */}
        {post.media && post.media.type === 'image' && (
          <img 
            src={post.media.url} 
            alt="Post media" 
            className="img-fluid rounded mb-3"
          />
        )}

        {/* Post Actions */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <button 
              className="btn btn-outline-primary btn-sm me-2"
              onClick={() => onLike(post.id)}
            >
              <FontAwesomeIcon icon={faThumbsUp} className="me-1" />
              Like ({post.likes})
            </button>
            <button 
              className="btn btn-outline-secondary btn-sm me-2"
              onClick={() => setShowComments(!showComments)}
            >
              <FontAwesomeIcon icon={faComment} className="me-1" />
              Comment ({post.comments.length})
            </button>
            <button 
              className="btn btn-outline-info btn-sm"
              onClick={() => onShare(post.id)}
            >
              <FontAwesomeIcon icon={faShare} className="me-1" />
              Share ({post.shares})
            </button>
          </div>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="border-top pt-3">
            {post.comments.map(comment => (
              <div key={comment.id} className="d-flex mb-2">
                <img 
                  src="https://via.placeholder.com/32" 
                  alt="Commenter" 
                  className="rounded-circle me-2"
                  width="32" 
                  height="32"
                />
                <div className="bg-light rounded p-2 flex-grow-1">
                  <div className="fw-bold">{comment.author}</div>
                  <div>{comment.content}</div>
                  <small className="text-muted">{formatTimestamp(comment.timestamp)}</small>
                </div>
              </div>
            ))}
            
            {/* Add Comment */}
            <form onSubmit={handleCommentSubmit} className="d-flex mt-3">
              <img 
                src={currentUser.picture} 
                alt="Your profile" 
                className="rounded-circle me-2"
                width="32" 
                height="32"
              />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm ms-2">
                Post
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

