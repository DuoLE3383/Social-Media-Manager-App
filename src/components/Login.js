import React, { useState } from 'react';
import FacebookLogin from 'react-facebook-login';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook } from '@fortawesome/free-brands-svg-icons';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Facebook App ID - Replace with your actual Facebook App ID
  const FACEBOOK_APP_ID = '1230632838187127'; // You need to replace this with your actual Facebook App ID

  const handleFacebookResponse = (response) => {
    if (response.accessToken) {
      console.log('Facebook login successful:', response);
      const userData = {
        id: response.id,
        name: response.name,
        email: response.email,
        picture: response.picture.data.url,
        provider: 'facebook',
        accessToken: response.accessToken
      };
      onLogin(userData);
    } else {
      console.log('Facebook login failed');
      setError('Facebook login failed. Please try again.');
    }
  };

  const handleRegularLogin = (e) => {
    e.preventDefault();
    if (email && password) {
      // Simple demo login - in a real app, you'd validate against a backend
      const userData = {
        id: 'demo_user',
        name: 'Demo User',
        email: email,
        picture: 'https://via.placeholder.com/150',
        provider: 'regular'
      };
      onLogin(userData);
    } else {
      setError('Please enter both email and password');
    }
  };

  return (
    <div className="login-container">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-4">
          <div className="card shadow-lg">
            <div className="card-body p-5">
              <div className="text-center mb-4">
                <h2 className="card-title text-primary">Social Media App</h2>
                <p className="text-muted">Connect with friends and share your moments</p>
              </div>

              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              {/* Facebook Login */}
              <div className="mb-4">
                <FacebookLogin
                  appId={FACEBOOK_APP_ID}
                  autoLoad={false}
                  fields="name,email,picture"
                  callback={handleFacebookResponse}
                  cssClass="btn btn-primary btn-lg w-100 d-flex align-items-center justify-content-center"
                  icon={<FontAwesomeIcon icon={faFacebook} className="me-2" />}
                  textButton="Continue with Facebook"
                />
              </div>

              <div className="text-center mb-3">
                <span className="text-muted">or</span>
              </div>

              {/* Regular Login Form */}
              <form onSubmit={handleRegularLogin}>
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="password" className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>
                <button type="submit" className="btn btn-success btn-lg w-100">
                  Sign In
                </button>
              </form>

              <div className="text-center mt-3">
                <small className="text-muted">
                  Don't have an account? <button className="btn btn-link p-0 text-primary">Sign up</button>
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

