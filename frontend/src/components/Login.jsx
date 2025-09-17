import React, { useState, useEffect } from 'react';
import './Login.css';
import { login, rememberEmail, lastRememberedEmail, loginWithGoogle } from '../auth';

export default function Login({ onSuccess, goRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const last = lastRememberedEmail();
    if (last) { setEmail(last); setRemember(true); }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const user = login(email, password);
      if (remember) rememberEmail(email); else rememberEmail(null);
      onSuccess(user);
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-card">
        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-sub text-dim">Sign in to continue to <strong>BUS INFO LK</strong></p>
        {error && <div className="auth-alert">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field">
            <span>Email</span>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <div style={{position:'relative'}}>
              <input className="input" type={showPw? 'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required />
              <button type="button" onClick={()=>setShowPw(s=>!s)} style={{position:'absolute', right:'8px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--dp-text-dim)', fontSize:'0.55rem', cursor:'pointer'}}>{showPw? 'HIDE':'SHOW'}</button>
            </div>
          </label>
          <label style={{display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.55rem', letterSpacing:'.5px', color:'var(--dp-text-dim)'}}>
            <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{width:'14px', height:'14px'}} /> Remember Email
          </label>
          <button type="submit" className="btn-primary auth-action">Login</button>
        </form>
        <div style={{display:'flex', flexDirection:'column', gap:'0.75rem', marginTop:'0.25rem', marginBottom:'0.4rem'}}>
          <button type="button" className="google-btn" onClick={() => {
            try {
              const user = loginWithGoogle();
              onSuccess(user);
            } catch(e){ setError('Google sign-in failed'); }
          }}>Sign in with Google</button>
        </div>
        <div className="auth-switch" style={{marginTop:'0.2rem'}}>
          <button className="link-btn" onClick={goRegister}>Create account</button>
        </div>
      </div>
    </div>
  );
}
