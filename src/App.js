import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import Navbar from './components/Navbar';

function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem('socialMediaUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('socialMediaUser', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('socialMediaUser');
  };

  return (
    <Router>
      <div className="App">
        {isAuthenticated && <Navbar user={user} onLogout={handleLogout} />}
        <div className="container-fluid">
          <Routes>
            <Route 
              path="/login" 
              element={
                !isAuthenticated ? 
                <Login onLogin={handleLogin} /> : 
                <Navigate to="/dashboard" />
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                isAuthenticated ? 
                <Dashboard user={user} /> : 
                <Navigate to="/login" />
              } 
            />
            <Route 
              path="/profile" 
              element={
                isAuthenticated ? 
                <Profile user={user} /> : 
                <Navigate to="/login" />
              } 
            />
            <Route 
              path="/" 
              element={
                isAuthenticated ? 
                <Navigate to="/dashboard" /> : 
                <Navigate to="/login" />
              } 
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
