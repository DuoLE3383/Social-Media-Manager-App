import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import Navbar from './components/Navbar';
import PromptStudio from './components/PromptStudio';
import { supabase } from './lib/supabase';
import Connections from './components/Connections';
import DataDeletion from './components/DataDeletion';
import AILibrary from './components/AILibrary';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('socialStudioTheme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('socialStudioTheme', theme);
  }, [theme]);

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
      <AppBody
        user={user}
        isAuthenticated={isAuthenticated}
        theme={theme}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      />
    </Router>
  );
}

function AppBody({ user, isAuthenticated, theme, onLogin, onLogout, onToggleTheme }) {
  const location = useLocation();
  const isLibraryRoute = location.pathname.startsWith('/ai-library');
  // AI Library renders its own full-screen sidebar layout; hide the global navbar there.
  const showTopNavbar = isAuthenticated && !isLibraryRoute;
  return (
    <div className="App">
      {showTopNavbar
        ? <Navbar user={user} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} />
        : <button className="theme-toggle floating-theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}><FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} /></button>}
      <div className={isLibraryRoute ? 'ai-page-host' : 'container-fluid'}>
          <Routes>
            <Route path="/privacy/data-deletion" element={<DataDeletion />} />
            <Route 
              path="/login" 
              element={
                !isAuthenticated ? 
                <Login onLogin={onLogin} /> : 
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
            <Route path="/ai-library" element={isAuthenticated ? <AILibrary user={user} /> : <Navigate to="/login" />} />
            <Route path="/settings" element={isAuthenticated ? <Connections user={user} /> : <Navigate to="/login" />} />
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
  );
}

export default App;
