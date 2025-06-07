import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEdit, 
  faCamera, 
  faMapMarkerAlt, 
  faCalendarAlt, 
  faEnvelope,
  faPhone,
  faGlobe,
  faBriefcase,
  faGraduationCap,
  faHeart,
  faUserFriends
} from '@fortawesome/free-solid-svg-icons';

const Profile = ({ user }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user.name,
    email: user.email,
    bio: 'Passionate about technology and connecting with amazing people. Love to travel, read books, and explore new ideas.',
    location: 'San Francisco, CA',
    website: 'https://example.com',
    phone: '+1 (555) 123-4567',
    work: 'Software Engineer at Tech Corp',
    education: 'Computer Science, Stanford University',
    joinDate: 'January 2022'
  });

  const [stats] = useState({
    posts: 42,
    followers: 1234,
    following: 567,
    likes: 2891
  });

  const [userPosts] = useState([
    {
      id: 1,
      content: 'Just launched my new project! 🚀 Excited to share it with everyone.',
      timestamp: '2 days ago',
      likes: 24,
      comments: 8,
      image: 'https://via.placeholder.com/400x300?text=Project+Launch'
    },
    {
      id: 2,
      content: 'Beautiful morning hike! Nature is the best therapy. 🌲🏔️',
      timestamp: '1 week ago',
      likes: 56,
      comments: 12,
      image: 'https://via.placeholder.com/400x300?text=Mountain+Hike'
    },
    {
      id: 3,
      content: 'Learning never stops! Just finished reading an amazing book on AI and machine learning.',
      timestamp: '2 weeks ago',
      likes: 33,
      comments: 7,
      image: null
    }
  ]);

  const handleSaveProfile = () => {
    setIsEditing(false);
    // Here you would typically save to a backend
    console.log('Profile saved:', profileData);
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="profile-container py-4">
      <div className="row">
        {/* Profile Header */}
        <div className="col-12">
          <div className="card mb-4">
            {/* Cover Photo */}
            <div className="position-relative">
              <div 
                className="bg-gradient-primary" 
                style={{ height: '200px', backgroundColor: '#6f42c1' }}
              >
                <div className="position-absolute top-0 end-0 p-3">
                  <button className="btn btn-light btn-sm">
                    <FontAwesomeIcon icon={faCamera} className="me-1" />
                    Edit Cover
                  </button>
                </div>
              </div>
              
              {/* Profile Picture */}
              <div className="position-absolute" style={{ bottom: '-50px', left: '30px' }}>
                <div className="position-relative">
                  <img 
                    src={user.picture} 
                    alt="Profile" 
                    className="rounded-circle border border-4 border-white"
                    width="120" 
                    height="120"
                    style={{ objectFit: 'cover' }}
                  />
                  <button 
                    className="btn btn-primary btn-sm rounded-circle position-absolute"
                    style={{ bottom: '5px', right: '5px', width: '32px', height: '32px' }}
                  >
                    <FontAwesomeIcon icon={faCamera} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Profile Info */}
            <div className="card-body" style={{ marginTop: '60px' }}>
              <div className="row">
                <div className="col-md-8">
                  {isEditing ? (
                    <div>
                      <input 
                        type="text" 
                        className="form-control mb-2" 
                        value={profileData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                      />
                      <textarea 
                        className="form-control" 
                        rows="3" 
                        value={profileData.bio}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                      />
                    </div>
                  ) : (
                    <div>
                      <h2 className="mb-1">{profileData.name}</h2>
                      <p className="text-muted mb-3">{profileData.bio}</p>
                    </div>
                  )}
                  
                  <div className="d-flex flex-wrap gap-3 mb-3">
                    <span className="text-muted">
                      <FontAwesomeIcon icon={faMapMarkerAlt} className="me-1" />
                      {profileData.location}
                    </span>
                    <span className="text-muted">
                      <FontAwesomeIcon icon={faCalendarAlt} className="me-1" />
                      Joined {profileData.joinDate}
                    </span>
                    <span className="text-muted">
                      <FontAwesomeIcon icon={faGlobe} className="me-1" />
                      <a href={profileData.website} className="text-decoration-none">Website</a>
                    </span>
                  </div>
                </div>
                
                <div className="col-md-4 text-md-end">
                  {isEditing ? (
                    <div>
                      <button 
                        className="btn btn-success me-2"
                        onClick={handleSaveProfile}
                      >
                        Save Changes
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="btn btn-outline-primary"
                      onClick={() => setIsEditing(true)}
                    >
                      <FontAwesomeIcon icon={faEdit} className="me-1" />
                      Edit Profile
                    </button>
                  )}
                </div>
              </div>
              
              {/* Stats */}
              <div className="row text-center mt-4">
                <div className="col-3">
                  <div className="fw-bold fs-4">{stats.posts}</div>
                  <div className="text-muted">Posts</div>
                </div>
                <div className="col-3">
                  <div className="fw-bold fs-4">{stats.followers.toLocaleString()}</div>
                  <div className="text-muted">Followers</div>
                </div>
                <div className="col-3">
                  <div className="fw-bold fs-4">{stats.following}</div>
                  <div className="text-muted">Following</div>
                </div>
                <div className="col-3">
                  <div className="fw-bold fs-4">{stats.likes.toLocaleString()}</div>
                  <div className="text-muted">Likes</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="row">
        {/* Profile Details */}
        <div className="col-md-4">
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">About</h6>
            </div>
            <div className="card-body">
              {isEditing ? (
                <div>
                  <div className="mb-3">
                    <label className="form-label">
                      <FontAwesomeIcon icon={faEnvelope} className="me-2" />
                      Email
                    </label>
                    <input 
                      type="email" 
                      className="form-control" 
                      value={profileData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      <FontAwesomeIcon icon={faPhone} className="me-2" />
                      Phone
                    </label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      value={profileData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      <FontAwesomeIcon icon={faBriefcase} className="me-2" />
                      Work
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={profileData.work}
                      onChange={(e) => handleInputChange('work', e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      <FontAwesomeIcon icon={faGraduationCap} className="me-2" />
                      Education
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={profileData.education}
                      onChange={(e) => handleInputChange('education', e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-3">
                    <div className="text-muted">
                      <FontAwesomeIcon icon={faEnvelope} className="me-2" />
                      {profileData.email}
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="text-muted">
                      <FontAwesomeIcon icon={faPhone} className="me-2" />
                      {profileData.phone}
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="text-muted">
                      <FontAwesomeIcon icon={faBriefcase} className="me-2" />
                      {profileData.work}
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="text-muted">
                      <FontAwesomeIcon icon={faGraduationCap} className="me-2" />
                      {profileData.education}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Friends</h6>
            </div>
            <div className="card-body">
              <div className="row g-2">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="col-4">
                    <img 
                      src={`https://via.placeholder.com/80?text=Friend${i}`} 
                      alt={`Friend ${i}`} 
                      className="img-fluid rounded"
                    />
                  </div>
                ))}
              </div>
              <div className="text-center mt-3">
                <button className="btn btn-link text-decoration-none">See all friends</button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Posts */}
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Posts</h6>
            </div>
            <div className="card-body">
              {userPosts.map(post => (
                <div key={post.id} className="border-bottom pb-3 mb-3 last:border-bottom-0">
                  <div className="d-flex align-items-center mb-2">
                    <img 
                      src={user.picture} 
                      alt="Profile" 
                      className="rounded-circle me-3"
                      width="40" 
                      height="40"
                    />
                    <div>
                      <div className="fw-bold">{user.name}</div>
                      <small className="text-muted">{post.timestamp}</small>
                    </div>
                  </div>
                  
                  <p className="mb-3">{post.content}</p>
                  
                  {post.image && (
                    <img 
                      src={post.image} 
                      alt="Post" 
                      className="img-fluid rounded mb-3"
                    />
                  )}
                  
                  <div className="d-flex gap-3">
                    <span className="text-muted">
                      <FontAwesomeIcon icon={faHeart} className="me-1" />
                      {post.likes} likes
                    </span>
                    <span className="text-muted">
                      <FontAwesomeIcon icon={faUserFriends} className="me-1" />
                      {post.comments} comments
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

