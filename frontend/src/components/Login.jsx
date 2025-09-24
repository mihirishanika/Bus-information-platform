import React, { useState, useEffect } from 'react';
import './Login.css';
import {
  login,
  rememberEmail,
  lastRememberedEmail,
  loginWithGoogle,
  resendConfirmation,
  startPasswordReset,
  finishPasswordReset,
  confirmRegistration,
  validatePassword
} from '../auth';
import { useAuth } from 'react-oidc-context';

// Error Boundary to safely contain optional OIDC UI when AuthProvider isn't mounted
class OidcErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    // eslint-disable-next-line no-console
    console.warn('OIDC UI disabled (no provider?):', err?.message || err);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// Child component that uses the OIDC hook; wrapped in boundary above
function HostedUiControls() {
  const oidc = useAuth();
  if (!oidc) return null;
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      {oidc.isAuthenticated ? (
        <>
          <div className="auth-alert" style={{ background: 'linear-gradient(135deg,#065f46,#10b981)', borderColor: 'rgba(16,185,129,.6)' }}>
            Signed in as {oidc.user?.profile?.email || 'user'} via Hosted UI
          </div>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button type="button" className="btn" onClick={() => oidc.removeUser()}>Sign out (clear local)</button>
            <button type="button" className="btn" onClick={() => oidc.signoutRedirect()}>Sign out (Hosted UI)</button>
          </div>
        </>
      ) : (
        <button type="button" className="btn" onClick={() => oidc.signinRedirect()}>Sign in with Hosted UI</button>
      )}
    </div>
  );
}

export default function Login({ onSuccess, goRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Show OAuth debug info only after user attempts Google sign-in
  const [showOAuthDebug, setShowOAuthDebug] = useState(false);

  // Confirmation flow states
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [confirmationUsername, setConfirmationUsername] = useState('');

  // Password reset states
  const [resetMode, setResetMode] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const last = lastRememberedEmail();
    if (last) {
      setEmail(last);
      setRemember(true);
    }
  }, []);

  const clearStates = () => {
    setError('');
    setUnconfirmed(false);
    setResetMode(false);
    setConfirmationCode('');
    setConfirmationUsername('');
    setResetCode('');
    setNewPassword('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError('Email/username and password are required');
      return;
    }

    setLoading(true);
    setError('');
    clearStates();

    try {
      const user = await login(email.trim(), password);

      // Handle email persistence
      if (remember) rememberEmail(email.trim());
      else rememberEmail(null);

      onSuccess(user);
    } catch (err) {
      console.error('Login error:', err);

      let errorMessage = err.message || 'Login failed';

      // Handle specific error cases
      if (err.code === 'UserNotConfirmedException') {
        setUnconfirmed(true);
        setConfirmationUsername(err.username || email.trim());
        errorMessage = 'Account not confirmed. Please enter the code sent to your email, or click "Resend Code".';
      } else if (err.code === 'NotAuthorizedException') {
        errorMessage = 'Incorrect username/email or password. Please check your credentials and try again.';
        if (email.includes('@')) {
          errorMessage += ' If you registered with a username (not email), try using that instead.';
        }
      } else if (err.code === 'UserNotFoundException') {
        errorMessage = 'User not found. Please check your username/email or create a new account.';
      } else if (err.code === 'PasswordResetRequiredException') {
        errorMessage = 'Password reset required. Click "Forgot password?" to reset it.';
      } else if (err.code === 'TooManyRequestsException') {
        errorMessage = 'Too many failed attempts. Please wait a few minutes and try again.';
      } else if (err.code === 'LimitExceededException') {
        errorMessage = 'Too many attempts. Please wait before trying again.';
      } else if (err.message?.includes('Network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmation = async (e) => {
    e.preventDefault();

    if (!confirmationCode.trim()) {
      setError('Please enter the confirmation code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await confirmRegistration(confirmationUsername, confirmationCode.trim());

      // After successful confirmation, try to log in again
      const user = await login(email.trim(), password);
      if (remember) rememberEmail(email.trim());

      onSuccess(user);
    } catch (err) {
      console.error('Confirmation error:', err);

      let errorMessage = err.message || 'Confirmation failed';
      if (err.code === 'ExpiredCodeException') {
        errorMessage = 'Confirmation code has expired. Please request a new one.';
      } else if (err.code === 'CodeMismatchException') {
        errorMessage = 'Invalid confirmation code. Please check the code and try again.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();

    if (!resetCode.trim() || !newPassword.trim()) {
      setError('Enter both reset code and new password');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await finishPasswordReset(email.trim(), resetCode.trim(), newPassword);
      setError('');
      setResetMode(false);
      setResetCode('');
      setNewPassword('');

      // Show success message
      setError('Password reset successful! You can now sign in with your new password.');
    } catch (err) {
      console.error('Password reset error:', err);

      let errorMessage = err.message || 'Could not reset password';
      if (err.code === 'ExpiredCodeException') {
        errorMessage = 'Reset code has expired. Please request a new one.';
      } else if (err.code === 'CodeMismatchException') {
        errorMessage = 'Invalid reset code. Please check the code and try again.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setError('Please enter your email/username first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await resendConfirmation(confirmationUsername || email.trim());
      setError('Confirmation code resent! Check your email.');
    } catch (err) {
      console.error('Resend confirmation error:', err);
      setError(err.message || 'Could not resend confirmation code');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPasswordReset = async () => {
    if (!email.trim()) {
      setError('Please enter your email/username first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await startPasswordReset(email.trim());
      setResetMode(true);
      setUnconfirmed(false);
      setError('Reset code sent to your email! Enter it below with a new password.');
    } catch (err) {
      console.error('Start password reset error:', err);
      setError(err.message || 'Could not start password reset');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // Reveal debug info only after user intentionally tries Google sign-in
    setShowOAuthDebug(true);
    setLoading(true);
    setError('');

    try {
      await loginWithGoogle();
      // Note: loginWithGoogle will redirect the page, so we won't reach this point
      // unless there's an error or the redirect is prevented
    } catch (e) {
      console.error('Google sign-in error:', e);
      setError(e.message || 'Google sign-in failed. Please try again or use email/password login.');
    } finally {
      setLoading(false);
    }
  };
  const handleSubmit = (e) => {
    if (unconfirmed) {
      return handleConfirmation(e);
    } else if (resetMode) {
      return handlePasswordReset(e);
    } else {
      return handleLogin(e);
    }
  };

  const getSubmitButtonText = () => {
    if (loading) return 'Please wait...';
    if (unconfirmed) return 'Confirm Account';
    if (resetMode) return 'Reset Password';
    return 'Login';
  };

  const goBackToLogin = () => {
    clearStates();
  };

  return (
    <div className="auth-root">
      <div className="auth-card">
        <h2 className="auth-title">
          {unconfirmed ? 'Confirm Account' : resetMode ? 'Reset Password' : 'Welcome Back'}
        </h2>
        <p className="auth-sub text-dim">
          {unconfirmed
            ? 'Enter the confirmation code sent to your email'
            : resetMode
              ? 'Enter the reset code and your new password'
              : 'Sign in to continue to'
          } <strong>BUS INFO LK</strong>
        </p>

        {error && (
          <div className={`auth-alert ${error.includes('successful') ? 'success' : ''}`}>
            {error}
          </div>
        )}

        <OidcErrorBoundary>
          <HostedUiControls />
        </OidcErrorBoundary>

        {import.meta.env.DEV && showOAuthDebug && (
          <div className="auth-alert" style={{ fontSize: '0.65rem', opacity: 0.9 }}>
            <div><strong>OAuth debug (dev only):</strong></div>
            <div>DOMAIN: {String(import.meta.env.VITE_COGNITO_DOMAIN || '(missing)')}</div>
            <div>REDIRECT: {String(import.meta.env.VITE_OIDC_REDIRECT_URI || window.location.origin)}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
          {!unconfirmed && !resetMode && (
            <>
              <label className="auth-field">
                <span>Username or Email</span>
                <input
                  className="input"
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="your username or email"
                  disabled={loading}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </label>
              <label className="auth-field">
                <span>Password</span>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--dp-text-dim)',
                      fontSize: '0.55rem',
                      cursor: 'pointer'
                    }}
                  >
                    {showPw ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </label>
            </>
          )}

          {unconfirmed && (
            <label className="auth-field">
              <span>Confirmation Code</span>
              <input
                className="input"
                value={confirmationCode}
                onChange={e => setConfirmationCode(e.target.value)}
                placeholder="Enter the code from your email"
                required
                disabled={loading}
              />
            </label>
          )}

          {resetMode && (
            <>
              <label className="auth-field">
                <span>Reset Code</span>
                <input
                  className="input"
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value)}
                  placeholder="Code sent to your email"
                  required
                  disabled={loading}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
              </label>
              <label className="auth-field">
                <span>New Password</span>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 8 characters)"
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--dp-text-dim)',
                      fontSize: '0.55rem',
                      cursor: 'pointer'
                    }}
                  >
                    {showPw ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </label>
            </>
          )}

          {!unconfirmed && !resetMode && (
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.55rem',
              letterSpacing: '.5px',
              color: 'var(--dp-text-dim)'
            }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                style={{ width: '14px', height: '14px' }}
                disabled={loading}
              />
              Remember Email
            </label>
          )}

          <button type="submit" className="btn-primary auth-action" disabled={loading}>
            {getSubmitButtonText()}
          </button>
        </form>

        <div style={{ display: 'flex', gap: '.5rem', marginTop: '.25rem', flexWrap: 'wrap' }}>
          {unconfirmed && (
            <>
              <button type="button" className="link-btn" onClick={handleResendConfirmation} disabled={loading}>
                Resend Code
              </button>
              <button type="button" className="link-btn" onClick={goBackToLogin} disabled={loading}>
                Back to Login
              </button>
            </>
          )}

          {resetMode && (
            <button type="button" className="link-btn" onClick={goBackToLogin} disabled={loading}>
              Back to Login
            </button>
          )}

          {!unconfirmed && !resetMode && (
            <button type="button" className="link-btn" onClick={handleStartPasswordReset} disabled={loading}>
              Forgot password?
            </button>
          )}
        </div>

        {!unconfirmed && !resetMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem', marginBottom: '0.4rem' }}>
            {(import.meta.env.DEV || import.meta.env.VITE_COGNITO_DOMAIN) ? (
              <button
                type="button"
                className="google-btn"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                Sign in with Google
              </button>
            ) : (
              <div className="auth-sub text-dim" style={{ fontSize: '0.7rem' }}>
                Enable Google sign-in by setting VITE_COGNITO_DOMAIN in frontend/.env and configuring Cognito Hosted UI.
              </div>
            )}
          </div>
        )}

        {!unconfirmed && !resetMode && (
          <div className="auth-switch" style={{ marginTop: '0.2rem' }}>
            <button className="link-btn" onClick={goRegister} disabled={loading}>
              Create account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}