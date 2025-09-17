import React, { useState } from 'react';
import './Register.css';
import { register } from '../auth';

export default function Register({ onSuccess, goLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Name required');
    if (password !== confirm) return setError('Passwords do not match');
    try {
      const user = register(email, password, { name: name.trim(), phone: phone.trim(), birthday });
      onSuccess(user);
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-card">
        <h2 className="auth-title">Create Account</h2>
        <p className="auth-sub text-dim">Join the community improving Sri Lanka bus info.</p>
        {error && <div className="auth-alert">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field">
            <span>Name</span>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} required placeholder="Your full name" />
          </label>
          <label className="auth-field">
            <span>Email</span>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com" />
          </label>
          <label className="auth-field">
            <span>Phone (Optional)</span>
            <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="07x xxx xxxx" />
          </label>
          <label className="auth-field">
            <span>Birthday (Optional)</span>
            <input className="input" type="date" value={birthday} onChange={e=>setBirthday(e.target.value)} />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <div style={{position:'relative'}}>
              <input className="input" type={showPw? 'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Min 6 characters" />
              <button type="button" onClick={()=>setShowPw(s=>!s)} style={{position:'absolute', right:'8px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--dp-text-dim)', fontSize:'0.55rem', cursor:'pointer'}}> {showPw? 'HIDE':'SHOW'} </button>
            </div>
          </label>
          <label className="auth-field">
            <span>Confirm Password</span>
            <input className="input" type={showPw? 'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} required />
          </label>
          <button type="submit" className="btn-primary auth-action">Register</button>
        </form>
        <div className="auth-switch" style={{marginTop:'0.4rem'}}>
          <button className="link-btn" onClick={goLogin}>Already have account</button>
        </div>
      </div>
    </div>
  );
}
