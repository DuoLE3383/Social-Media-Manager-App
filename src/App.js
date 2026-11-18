import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import Login from './components/Login';
import Overview from './components/Overview';
import Feed from './components/Feed';
import PublishPlan from './components/PublishPlan';
import Reports from './components/Reports';
import CreateImage from './components/CreateImage';
import SmartPrompt from './components/SmartPrompt';
import Profile from './components/Profile';
import AgentStudio from './components/AgentStudio';
import { supabase } from './lib/supabase';
import Connections from './components/Connections';
import DataDeletion from './components/DataDeletion';
import AILibrary from './components/AILibrary';
import AppShell from './components/AppShell';

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
      <Routes>
        <Route path="/privacy/data-deletion" element={<DataDeletion />} />
        <Route
          path="/login"
          element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard" />}
        />
        {/* All authenticated routes share the AppShell layout (left sidebar + topbar). */}
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <AppShell
                user={user}
                theme={theme}
                onToggleTheme={() => setTheme((c) => (c === 'dark' ? 'light' : 'dark'))}
                onLogout={handleLogout}
              >
                <Routes>
                  <Route path="/dashboard" element={<Overview user={user} />} />
                  <Route path="/overview" element={<Overview user={user} />} />
                  <Route path="/feed" element={<Feed user={user} />} />
                  <Route path="/publish-plan" element={<PublishPlan user={user} />} />
                  <Route path="/reports" element={<Reports user={user} />} />
                  <Route path="/prompts" element={<AgentStudio user={user} />} />
                  <Route path="/create-image" element={<CreateImage user={user} />} />
                  <Route path="/smart-prompt" element={<SmartPrompt user={user} />} />
                  <Route path="/ai-library" element={<AILibrary user={user} />} />
                  <Route path="/settings" element={<Connections user={user} />} />
                  <Route path="/profile" element={<Profile user={user} />} />
                  <Route path="*" element={<Navigate to="/dashboard" />} />
                </Routes>
              </AppShell>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
