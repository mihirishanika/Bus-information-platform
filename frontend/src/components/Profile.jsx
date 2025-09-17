import React, { useState } from 'react';
import './Profile.css';
import { currentUser, updateUser } from '../auth';

export default function Profile({ user: initialUser, onUpdate, onLogout }) {
  const [user, setUser] = useState(() => initialUser || currentUser() || { name:'', email:'', phone:'', birthday:'' });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [birthday, setBirthday] = useState(user.birthday || '');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const startEdit = () => { setEditing(true); setSuccess(''); setError(''); };
  const cancelEdit = () => { setEditing(false); setError(''); setSuccess(''); setPassword(''); setPassword2(''); setName(user.name); setEmail(user.email); setPhone(user.phone||''); setBirthday(user.birthday||''); };

  const handleSave = (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!name.trim()) return setError('Name required');
    if (!email.trim()) return setError('Email required');
    if (password || password2) {
      if (password !== password2) return setError('Passwords do not match');
      if (password.length < 6) return setError('Password too short');
    }
  const updated = { ...user, name: name.trim(), email: email.trim(), phone: phone.trim(), birthday };
  const persisted = updateUser(updated, password || undefined) || updated;
  setUser(persisted);
  onUpdate && onUpdate(persisted, password || null);
    setEditing(false);
    setSuccess('Profile updated');
  };

  return (
    <div className="profile">
      <div className="profile__header">
        <h2 className="profile__title">Profile</h2>
        {!editing && <button className="profile__btn" onClick={startEdit}>Edit Details</button>}
      </div>

      {!editing && (
        <div>
          <p className="profile__view-row"><span className="profile__label">Name:</span> {user.name || '—'}</p>
            <p className="profile__view-row"><span className="profile__label">Email:</span> {user.email || '—'}</p>
            <p className="profile__view-row"><span className="profile__label">Phone:</span> {user.phone || '—'}</p>
            <p className="profile__view-row"><span className="profile__label">Birthday:</span> {user.birthday || '—'}</p>
          <div className="profile__actions">
            <button className="profile__btn outline" onClick={onLogout}>Logout</button>
          </div>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} className="profile__edit-form">
          {error && <div className="profile__error">{error}</div>}
          {success && <div className="profile__success">{success}</div>}
          <div className="profile__row-split">
            <label className="profile__field">Name
              <input value={name} onChange={e=>setName(e.target.value)} />
            </label>
            <label className="profile__field">Email
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} />
            </label>
          </div>
          <div className="profile__row-split">
            <label className="profile__field">Phone
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Optional" />
            </label>
            <label className="profile__field">Birthday
              <input type="date" value={birthday} onChange={e=>setBirthday(e.target.value)} />
            </label>
          </div>
          <div className="profile__section-divider"></div>
          <div className="profile__row-split">
            <label className="profile__field">Change Password
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Leave blank to keep" />
            </label>
            <label className="profile__field">Re-enter Password
              <input type="password" value={password2} onChange={e=>setPassword2(e.target.value)} />
            </label>
          </div>
          <div style={{display:'flex', gap:'0.6rem', marginTop:'0.2rem'}}>
            <button type="submit" className="profile__save">Save</button>
            <button type="button" className="profile__btn outline" onClick={cancelEdit}>Cancel</button>
            <button type="button" className="profile__btn outline" onClick={onLogout}>Logout</button>
          </div>
        </form>
      )}
    </div>
  );
}
