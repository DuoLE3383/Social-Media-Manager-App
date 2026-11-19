import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
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
import LoginRequired from './components/LoginRequired';
import NextStepCard from './components/NextStepCard';

// Pseudo user shown to signed-out visitors so sample-data pages greet them
// properly ("Xin chào, Khách") instead of falling back to English "User".
const GUEST_USER = { id: 'guest', name: 'Khách', email: '', picture: '' };

// Renders a page followed by its "next step" card so the whole app works as a
// guided wizard: every stage suggests — and links to — the next one.
function WithNext({ next, children }) {
  return (
    <>
      {children}
      <NextStepCard next={next} />
    </>
  );
}

// After a successful sign-in, send the user back to the page that asked for
// the login (?next=/create-image) or to the Overview dashboard.
function PostLoginRedirect() {
  const [params] = useSearchParams();
  const next = params.get('next');
  return <Navigate to={next && next.startsWith('/') ? next : '/dashboard'} replace />;
}

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
          element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <PostLoginRedirect />}
        />
        {/* Guest-friendly layout: the shell always renders. In this build the
            WHOLE creation pipeline is free to try (ideas, agents, images,
            video — the server rate-limits guest AI usage per IP). Only
            publishing & account pages require sign-in, because they touch the
            user's real connected social accounts. */}
        <Route
          path="/*"
          element={
            <AppShell
              user={user}
              theme={theme}
              onToggleTheme={() => setTheme((c) => (c === 'dark' ? 'light' : 'dark'))}
              onLogout={handleLogout}
            >
              <Routes>
                {/* Free trial pages: light pages AND the whole 4-step creation
                    wizard (ideas -> agents -> images -> video) run without
                    sign-in — guests get rate-limited AI access by IP. */}
                <Route path="/dashboard" element={<Overview user={user || GUEST_USER} />} />
                <Route path="/overview" element={<Overview user={user || GUEST_USER} />} />
                <Route path="/feed" element={<WithNext next="publish"><Feed user={user || GUEST_USER} /></WithNext>} />
                <Route path="/reports" element={<WithNext next="smartPrompt"><Reports user={user || GUEST_USER} /></WithNext>} />
                <Route path="/prompts" element={<WithNext next="createImage"><AgentStudio user={user || GUEST_USER} /></WithNext>} />
                <Route path="/smart-prompt" element={<WithNext next="agents"><SmartPrompt user={user || GUEST_USER} /></WithNext>} />
                <Route path="/create-image" element={<WithNext next="library"><CreateImage user={user || GUEST_USER} /></WithNext>} />
                <Route path="/ai-library" element={<WithNext next="publish"><AILibrary user={user || GUEST_USER} /></WithNext>} />
                {/* Publishing & account pages: require sign-in (they operate on
                    the user's real connected social accounts). */}
                <Route path="/publish-plan" element={isAuthenticated ? <WithNext next="reports"><PublishPlan user={user} /></WithNext> : <LoginRequired page="publish" />} />
                <Route path="/settings" element={isAuthenticated ? <Connections user={user} /> : <LoginRequired page="accounts" />} />
                <Route path="/profile" element={isAuthenticated ? <Profile user={user} /> : <LoginRequired page="accounts" />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </AppShell>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
