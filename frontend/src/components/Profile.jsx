import React, { useState, useMemo, useEffect } from 'react';
import './Profile.css';
import { currentUser, updateUser } from '../auth';
import { isValidSLPhone, normalizeSLPhone } from '../phone';
import { uploadAvatar } from '../api';
// removed protectedPing usage

export default function Profile({ user: initialUser, onUpdate, onLogout }) {
  // Load current user data properly
  const [user, setUser] = useState(() => initialUser || { name: '', email: '', phone: '', birthday: '', avatar: '' });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Editable fields - initialize from user data
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [birthday, setBirthday] = useState(user.birthday || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // removed pingOutput since Test Protected API is removed

  // Load fresh user data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!initialUser) {
        setRefreshing(true);
        try {
          const freshUser = await currentUser();
          if (freshUser) {
            setUser(freshUser);
            updateFormFields(freshUser);
          }
        } catch (err) {
          console.error('Failed to load user data:', err);
          setError('Failed to load user profile');
        } finally {
          setRefreshing(false);
        }
      }
    };

    loadUserData();
  }, [initialUser]);

  // Update form fields when user data changes
  const updateFormFields = (userData) => {
    setName(userData.name || '');
    setEmail(userData.email || '');
    setPhone(userData.phone || '');
    setBirthday(userData.birthday || '');
    setAvatar(userData.avatar || '');
  };

  // Update form fields when user prop changes
  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
      updateFormFields(initialUser);
    }
  }, [initialUser]);

  const initials = useMemo(() => {
    const n = (name || user.name || '').trim();
    if (!n) return 'U';
    const parts = n.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || '';
    const last = parts[parts.length - 1]?.[0] || '';
    return (first + last || first || 'U').toUpperCase();
  }, [name, user.name]);

  const startEdit = () => {
    setEditing(true);
    setSuccess('');
    setError('');
    // Reset form fields to current user data
    updateFormFields(user);
    // Clear password fields
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const cancelEdit = () => {
    setEditing(false);
    setError('');
    setSuccess('');
    // Reset all form fields to current user data
    updateFormFields(user);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // removed manual refreshProfile button; keep initial auto-refresh logic above

  const handleImageFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    const maxBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxBytes) {
      setError('Image too large (max 2MB)');
      return;
    }
    // Show local preview; keep File to upload later
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result || '');
      setAvatarFile(file);
      setError('');
    };
    reader.onerror = () => {
      setError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const onFileInput = (e) => {
    const f = e.target.files?.[0];
    handleImageFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    handleImageFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const removeAvatar = () => { setAvatar(''); setAvatarFile(null); };

  const validateForm = () => {
    if (!name.trim()) {
      setError('Name is required');
      return false;
    }

    if (!email.trim()) {
      setError('Email is required');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return false;
    }

    if (phone.trim() && !isValidSLPhone(phone)) {
      setError('Phone must be a valid Sri Lankan number (e.g., 077123456)');
      return false;
    }

    // Password validation
    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        setError('Current password is required to change password');
        return false;
      }

      if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
        return false;
      }

      if (newPassword.length < 8) {
        setError('New password must be at least 8 characters long');
        return false;
      }

      // Basic password strength check
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        setError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
        return false;
      }
    }

    return true;
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let avatarUrl = user.avatar || '';
      // If a new file was selected, upload it and use its URL
      if (avatarFile) {
        const url = await uploadAvatar(avatarFile);
        avatarUrl = url;
      } else if (!avatar) {
        // Explicitly cleared
        avatarUrl = '';
      } else if (avatar && avatar.startsWith('data:')) {
        // If user previously had only a data URL without selecting new file, block saving
        // to avoid exceeding Cognito attribute length
        throw new Error('Please reselect the image to upload');
      }

      const updateData = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() ? normalizeSLPhone(phone.trim()) : '',
        birthday: birthday,
        avatar: avatarUrl
      };

      const updatedUser = await updateUser(
        updateData,
        newPassword || undefined,
        currentPassword || undefined
      );

      setUser(updatedUser);
      updateFormFields(updatedUser);
      if (onUpdate) onUpdate(updatedUser);
      setEditing(false);
      setSuccess('Profile updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setAvatarFile(null);

    } catch (err) {
      console.error('Profile update error:', err);
      let errorMessage = err.message || 'Failed to update profile';
      if (err.code === 'NotAuthorizedException') errorMessage = 'Current password is incorrect';
      else if (err.code === 'InvalidParameterException') errorMessage = 'Invalid input data. Please check your information.';
      else if (err.code === 'LimitExceededException') errorMessage = 'Too many requests. Please wait a moment and try again.';
      else if (err.message?.includes('password')) errorMessage = 'Password update failed. Please check your current password.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // removed protected ping tester

  if (refreshing) {
    return (
      <div className="profile">
        <div className="profile-card">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile">
      <div className="profile-card">
        {/* Sidebar / Avatar */}
        <aside className="profile-aside">
          <div className="avatar">
            <div className="avatar__ring">
              {avatar ? (
                <img className="avatar__img" src={avatar} alt="User avatar" />
              ) : (
                <div className="avatar__initials" aria-label="User initials">{initials}</div>
              )}
            </div>

            <div className="avatar__meta">
              <h3 className="avatar__name">{user.name || 'Unnamed User'}</h3>
              <p className="avatar__email">{user.email || '—'}</p>
            </div>

            {editing ? (
              <div
                className="uploader"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  id="avatar-input"
                  type="file"
                  accept="image/*"
                  onChange={onFileInput}
                  hidden
                  disabled={loading}
                />
                <label className="uploader__label" htmlFor="avatar-input">
                  <span>Upload image</span>
                  <small>PNG, JPG up to 2MB</small>
                </label>
                {avatar && (
                  <button
                    className="uploader__clear"
                    type="button"
                    onClick={removeAvatar}
                    disabled={loading}
                  >
                    Remove
                  </button>
                )}
              </div>
            ) : (
              <button
                className="profile__btn outline"
                type="button"
                onClick={startEdit}
                disabled={loading}
              >
                Edit Profile
              </button>
            )}

            {!editing && (
              <button
                className="profile__btn danger outline"
                type="button"
                onClick={onLogout}
                disabled={loading}
              >
                Logout
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="profile-main">
          <header className="profile__header">
            <h2 className="profile__title">Profile</h2>
            {editing ? (
              <div className="profile__actions">
                <span className="text-dim">Editing profile...</span>
              </div>
            ) : (
              <div className="profile__actions">
                <button
                  className="profile__btn"
                  onClick={startEdit}
                  disabled={loading}
                >
                  Edit Details
                </button>
              </div>
            )}
          </header>

          {error && <div className="profile__error">{error}</div>}
          {success && <div className="profile__success">{success}</div>}

          {/* removed API response block */}

          {!editing ? (
            <div className="info-grid">
              <div className="info-item">
                <div className="info-label">Name</div>
                <div className="info-value">{user.name || '—'}</div>
              </div>
              <div className="info-item">
                <div className="info-label">Email</div>
                <div className="info-value">{user.email || '—'}</div>
              </div>
              <div className="info-item">
                <div className="info-label">Phone</div>
                <div className="info-value">{user.phone || '—'}</div>
              </div>
              <div className="info-item">
                <div className="info-label">Birthday</div>
                <div className="info-value">{user.birthday || '—'}</div>
              </div>
            </div>
          ) : (
            <form id="profile-form" onSubmit={handleSave} className="profile__edit-form" autoComplete="off">
              <div className="profile__row-split">
                <label className="profile__field">
                  Name <span style={{ color: 'red' }}>*</span>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Your full name"
                    autoComplete="off"
                    autoCapitalize="words"
                    autoCorrect="off"
                  />
                </label>
                <label className="profile__field">
                  Email <span style={{ color: 'red' }}>*</span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="your@email.com"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </label>
              </div>

              <div className="profile__row-split">
                <label className="profile__field">
                  Phone
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="077123456 (optional)"
                    disabled={loading}
                    autoComplete="off"
                    inputMode="tel"
                    autoCorrect="off"
                  />
                </label>
                <label className="profile__field">
                  Birthday
                  <input
                    type="date"
                    value={birthday}
                    onChange={e => setBirthday(e.target.value)}
                    disabled={loading}
                    autoComplete="bday"
                  />
                </label>
              </div>

              <div className="profile__section-divider"></div>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--dp-text-dim)' }}>Change Password</h4>

              <div className="profile__row-split">
                <label className="profile__field">
                  Current Password
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Required to change password"
                      disabled={loading}
                      name="current-password-block"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      readOnly
                      onFocus={e => e.target.removeAttribute('readonly')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--dp-text-dim)', fontSize: '0.55rem', cursor: 'pointer' }}
                    >{showPw ? 'HIDE' : 'SHOW'}</button>
                  </div>
                </label>
                <label className="profile__field">
                  New Password
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 8 chars, mixed case + numbers"
                      disabled={loading}
                      name="new-password-block"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      readOnly
                      onFocus={e => e.target.removeAttribute('readonly')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--dp-text-dim)', fontSize: '0.55rem', cursor: 'pointer' }}
                    >{showPw ? 'HIDE' : 'SHOW'}</button>
                  </div>
                </label>
              </div>

              <div className="profile__row-split">
                <label className="profile__field">
                  Confirm New Password
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      disabled={loading}
                      name="confirm-new-password-block"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      readOnly
                      onFocus={e => e.target.removeAttribute('readonly')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--dp-text-dim)', fontSize: '0.55rem', cursor: 'pointer' }}
                    >{showPw ? 'HIDE' : 'SHOW'}</button>
                  </div>
                </label>
                <div></div> {/* Empty div for grid alignment */}
              </div>

              <div className="profile__actions">
                <button
                  type="button"
                  className="profile__btn outline"
                  onClick={cancelEdit}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="profile__save"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}