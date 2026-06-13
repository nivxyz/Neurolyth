import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../firebase';
import { firebaseErrMsg } from '../utils/misc';

const provider = new GoogleAuthProvider();

export default function Auth({ onBack }) {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  function clearMessages() { setErr(''); setOk(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    clearMessages();
    setBusy(true);
    try {
      if (tab === 'login') {
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        await createUserWithEmailAndPassword(auth, email, pass);
      }
    } catch (ex) {
      setErr(firebaseErrMsg(ex.code));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    clearMessages();
    setBusy(true);
    try {
      await signInWithPopup(auth, provider);
    } catch (ex) {
      if (ex.code !== 'auth/popup-closed-by-user') setErr(firebaseErrMsg(ex.code));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email) { setErr('Enter your email address first.'); return; }
    clearMessages();
    try {
      await sendPasswordResetEmail(auth, email);
      setOk('Reset link sent — check your inbox.');
    } catch (ex) {
      setErr(firebaseErrMsg(ex.code));
    }
  }

  return (
    <div id="screen-auth">
      <div className="auth-card">
        <button className="auth-back" onClick={onBack}>← Back</button>
        <div className="auth-brand">Neuro<em>lyth</em></div>
        <div className="auth-sub">
          {tab === 'login' ? 'Welcome back' : 'Create your account'}
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => { setTab('login'); clearMessages(); }}
          >
            Sign in
          </button>
          <button
            className={`auth-tab${tab === 'signup' ? ' active' : ''}`}
            onClick={() => { setTab('signup'); clearMessages(); }}
          >
            Sign up
          </button>
        </div>

        <div className="auth-err">{err}</div>
        <div className="auth-ok">{ok}</div>

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className={`auth-input${err ? ' err' : ''}`}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); clearMessages(); }}
              required
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className={`auth-input${err ? ' err' : ''}`}
              type="password"
              placeholder={tab === 'signup' ? 'At least 6 characters' : 'Your password'}
              value={pass}
              onChange={e => { setPass(e.target.value); clearMessages(); }}
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {tab === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: 12 }}>
              <button
                type="button"
                onClick={handleReset}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}
              >
                Forgot password?
              </button>
            </div>
          )}

          <button className="auth-btn" type="submit" disabled={busy}>
            {busy ? '…' : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button className="google-btn" onClick={handleGoogle} disabled={busy}>
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19.1 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.4 4.3-4.4 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );
}
