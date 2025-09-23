import React, { useState } from 'react';
import './Register.css';
import { register, confirmRegistration, login, resendConfirmation } from '../auth';
import { isValidSLPhone, normalizeSLPhone } from '../phone';

export default function Register({ onSuccess, goLogin }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [confirmNeeded, setConfirmNeeded] = useState(false);
  const [code, setCode] = useState('');
  const [pendingUsername, setPendingUsername] = useState('');
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Name required');
    if (password !== confirm) return setError('Passwords do not match');
    if (phone && !isValidSLPhone(phone)) return setError('Phone must be like 07xxxxxxxx');
    try {
      const res = await register(email, password, { username: username.trim(), name: name.trim(), phone: normalizeSLPhone(phone.trim()), birthday });
      setPendingUsername(res.username || username.trim() || email);
      setConfirmNeeded(true);
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const uname = pendingUsername || username.trim() || email;
      await confirmRegistration(uname, code.trim());
      // Sign in with the confirmed username (or provided username). This ensures
      // successful login even if the user pool doesn't allow email as a sign-in alias.
      const user = await login(uname, password);
      onSuccess(user);
    } catch (err) {
      setError(err.message || 'Confirmation failed');
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-card">
        <h2 className="auth-title">Create Account</h2>
        <p className="auth-sub text-dim">Join the community improving Sri Lanka bus info.</p>
        {error && <div className="auth-alert">{error}</div>}
        {!confirmNeeded ? (
          <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
            <label className="auth-field">
              <span>Name</span>
              <input className="input" value={name} onChange={e => setName(e.target.value)} required placeholder="Your full name" autoComplete="off" autoCapitalize="words" autoCorrect="off" />
            </label>
            <label className="auth-field">
              <span>Username (not an email)</span>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. john_doe" autoComplete="off" autoCapitalize="none" autoCorrect="off" />
            </label>
            <label className="auth-field">
              <span>Email</span>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="off" autoCapitalize="none" autoCorrect="off" />
            </label>
            <label className="auth-field">
              <span>Phone (Optional)</span>
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07x xxx xxxx" autoComplete="off" inputMode="tel" autoCorrect="off" />
            </label>
            <label className="auth-field">
              <span>Birthday (Optional)</span>
              <input className="input" type="date" value={birthday} onChange={e => setBirthday(e.target.value)} autoComplete="bday" />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min 6 characters" autoComplete="new-password" autoCapitalize="none" autoCorrect="off" />
                <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--dp-text-dim)', fontSize: '0.55rem', cursor: 'pointer' }}> {showPw ? 'HIDE' : 'SHOW'} </button>
              </div>
            </label>
            <label className="auth-field">
              <span>Confirm Password</span>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" autoCapitalize="none" autoCorrect="off" />
                <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--dp-text-dim)', fontSize: '0.55rem', cursor: 'pointer' }}> {showPw ? 'HIDE' : 'SHOW'} </button>
              </div>
            </label>
            <button type="submit" className="btn-primary auth-action">Register</button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="auth-form">
            <label className="auth-field">
              <span>Confirmation Code</span>
              <input className="input" value={code} onChange={e => setCode(e.target.value)} required placeholder="Enter code sent to your email" autoComplete="one-time-code" inputMode="numeric" />
            </label>
            {pendingUsername && (
              <p className="auth-sub" style={{ marginTop: '-.5rem' }}>Confirming username: <strong>{pendingUsername}</strong></p>
            )}
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', margin: '.25rem 0 .5rem' }}>
              <button
                type="button"
                className="btn"
                disabled={resending}
                onClick={async () => {
                  setError('');
                  setResending(true);
                  try {
                    const uname = pendingUsername || username.trim() || email;
                    await resendConfirmation(uname);
                    setError('Confirmation code resent. Check your email.');
                  } catch (e) {
                    setError(e.message || 'Could not resend code');
                  } finally {
                    setResending(false);
                  }
                }}
              >{resending ? 'Resending…' : 'Resend code'}</button>
            </div>
            <button type="submit" className="btn-primary auth-action">Confirm & Sign In</button>
          </form>
        )}
        {!confirmNeeded && (
          <div className="auth-switch" style={{ marginTop: '0.4rem' }}>
            <button className="link-btn link-btn--login" onClick={goLogin}>Already have account</button>
          </div>
        )}
      </div>
    </div>
  );
}
