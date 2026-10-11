import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import Navbar from './components/Navbar';
import PromptStudio from './components/PromptStudio';
import { supabase } from './lib/supabase';

function App() {
  const [user, setUser] = useState(null);
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        const sessionUser = data.session?.user;
        if (sessionUser) setUser({ id: sessionUser.id, email: sessionUser.email, name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0], picture: '' });
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const sessionUser = session?.user;
        if (sessionUser) setUser({ id: sessionUser.id, email: sessionUser.email, name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0], picture: '' });
        else setUser(null);
      });
      return () => subscription.unsubscribe();
    }
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem('socialMediaUser');
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); }
      catch { localStorage.removeItem('socialMediaUser'); }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    if (!supabase) localStorage.setItem('socialMediaUser', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    if (supabase) supabase.auth.signOut();
    else localStorage.removeItem('socialMediaUser');
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
                <Navigate to="/prompts" />
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
            <Route path="/prompts" element={isAuthenticated ? <PromptStudio user={user} /> : <Navigate to="/login" />} />
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
                <Navigate to="/prompts" /> :
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
