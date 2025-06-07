import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faUser, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';

const Navbar = ({ user, onLogout }) => {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary sticky-top">
      <div className="container">
        <Link className="navbar-brand fw-bold" to="/dashboard">
          📱 SocialConnect
        </Link>
        
        <button 
          className="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/dashboard">
                <FontAwesomeIcon icon={faHome} className="me-1" />
                Home
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/profile">
                <FontAwesomeIcon icon={faUser} className="me-1" />
                Profile
              </Link>
            </li>
          </ul>
          
          <div className="d-flex align-items-center">
            <div className="dropdown">
              <button 
                className="btn btn-outline-light dropdown-toggle d-flex align-items-center" 
                type="button" 
                data-bs-toggle="dropdown"
              >
                <img 
                  src={user?.picture || 'https://via.placeholder.com/32'} 
                  alt="Profile" 
                  className="rounded-circle me-2"
                  width="32" 
                  height="32"
                />
                {user?.name || 'User'}
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li>
                  <Link className="dropdown-item" to="/profile">
                    <FontAwesomeIcon icon={faUser} className="me-2" />
                    My Profile
                  </Link>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button className="dropdown-item" onClick={onLogout}>
                    <FontAwesomeIcon icon={faSignOutAlt} className="me-2" />
                    Logout
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

