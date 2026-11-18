import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) { setError('Enter an email and password to continue.'); return; }
    setError(''); setMessage('');
    if (supabase) {
      const { data, error: authError } = creatingAccount
        ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: email.split('@')[0] } } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) { setError(authError.message); return; }
      if (data.user && data.session) onLogin({ id: data.user.id, name: data.user.user_metadata?.name || email.split('@')[0], email: data.user.email, picture: '' });
      else setMessage('Check your email to confirm your account, then sign in.');
      return;
    }
    onLogin({ id: `demo_${email.trim().toLowerCase()}`, name: email.split('@')[0], email: email.trim(), picture: '', provider: 'demo' });
  };

  return <div className="login-container"><div className="row justify-content-center"><div className="col-md-6 col-lg-4"><div className="card shadow-lg"><div className="card-body p-5">
    <div className="text-center mb-4"><div className="login-mark"><img src={`${process.env.PUBLIC_URL || ''}/logo.svg`} alt="AI Social logo" /></div><h1 className="h3 card-title">AI Social</h1><p className="text-muted">Tạo, quản lý và đăng video, ảnh do AI sinh ra.</p></div>
    {supabase ? <div className="alert alert-success small">Secure email authentication is enabled with Supabase.</div> : <div className="alert alert-warning small">Demo sign-in stores a local profile in this browser. Configure Supabase Auth before using this app with real user accounts.</div>}
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {message && <div className="alert alert-info" role="status">{message}</div>}
    <form onSubmit={handleSubmit}><div className="mb-3"><label htmlFor="email" className="form-label">Email</label><input type="email" className="form-control" id="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
      <div className="mb-4"><label htmlFor="password" className="form-label">Password</label><input type="password" className="form-control" id="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Any value in demo mode" autoComplete="current-password" required /></div>
      <button type="submit" className="btn btn-primary btn-lg w-100">{supabase ? (creatingAccount ? 'Create account' : 'Sign in') : 'Continue in demo mode'}</button>
    </form>
    {supabase && <button type="button" className="btn btn-link w-100 mt-2" onClick={() => { setCreatingAccount(!creatingAccount); setError(''); setMessage(''); }}>{creatingAccount ? 'Already registered? Sign in' : 'New here? Create an account'}</button>}
  </div></div></div></div></div>;
}
