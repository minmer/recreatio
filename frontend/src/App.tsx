import { useMemo, useState } from 'react';
import { deriveH3, randomSalt } from './lib/crypto';
import { clearToken, loadSalt, storeSalt, storeToken } from './lib/storage';
import { login, logout, me, register, setSessionMode } from './lib/api';

const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

type Mode = 'login' | 'register';

type Status = {
  type: 'idle' | 'working' | 'success' | 'error';
  message?: string;
};

export default function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [status, setStatus] = useState<Status>({ type: 'idle' });
  const [loginId, setLoginId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [secureMode, setSecureMode] = useState(false);
  const [manualSalt, setManualSalt] = useState('');
  const [sessionInfo, setSessionInfo] = useState<string | null>(null);

  const storedSalt = useMemo(() => {
    if (!loginId) return null;
    return loadSalt(loginId);
  }, [loginId]);

  const saltForLogin = manualSalt || storedSalt;

  const resetStatus = () => setStatus({ type: 'idle' });

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    resetStatus();

    if (!loginId || !password) {
      setStatus({ type: 'error', message: 'Login ID and password are required.' });
      return;
    }

    if (password !== passwordConfirm) {
      setStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setStatus({ type: 'working', message: 'Deriving keys locally…' });
    const salt = randomSalt(32);
    const h3 = await deriveH3(password, salt);

    setStatus({ type: 'working', message: 'Registering account…' });
    await register({
      loginId,
      userSaltBase64: salt,
      h3Base64: h3,
      displayName: displayName || undefined
    });

    storeSalt(loginId, salt);
    setStatus({ type: 'success', message: 'Account created. You can now log in.' });
    setMode('login');
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    resetStatus();

    if (!loginId || !password) {
      setStatus({ type: 'error', message: 'Login ID and password are required.' });
      return;
    }

    if (!saltForLogin) {
      setStatus({
        type: 'error',
        message: 'No salt found for this login. Paste the salt or register on this device.'
      });
      return;
    }

    setStatus({ type: 'working', message: 'Deriving keys locally…' });
    const h3 = await deriveH3(password, saltForLogin);

    setStatus({ type: 'working', message: 'Signing in…' });
    const response = await login({
      loginId,
      h3Base64: h3,
      secureMode,
      deviceInfo
    });

    storeToken(response.token);
    setSessionInfo(`Session ${response.sessionId} (${response.secureMode ? 'Secure' : 'Normal'} mode)`);
    setStatus({ type: 'success', message: 'Signed in.' });
  }

  async function handleLogout() {
    resetStatus();
    setStatus({ type: 'working', message: 'Signing out…' });
    await logout();
    clearToken();
    setSessionInfo(null);
    setStatus({ type: 'success', message: 'Signed out.' });
  }

  async function handleCheckSession() {
    resetStatus();
    setStatus({ type: 'working', message: 'Checking session…' });
    const response = await me();
    setSessionInfo(`Session ${response.sessionId} (${response.isSecureMode ? 'Secure' : 'Normal'} mode)`);
    setStatus({ type: 'success', message: 'Session active.' });
  }

  async function handleToggleMode() {
    resetStatus();
    setStatus({ type: 'working', message: 'Updating session mode…' });
    const response = await setSessionMode(!secureMode);
    setSecureMode(response.isSecureMode);
    setSessionInfo(`Session ${response.sessionId} (${response.isSecureMode ? 'Secure' : 'Normal'} mode)`);
    setStatus({ type: 'success', message: 'Mode updated.' });
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="brand">
          <span className="brand-mark">R</span>
          <div>
            <h1>ReCreatio</h1>
            <p>Cryptographic access. Human clarity.</p>
          </div>
        </div>
        <div className="hero-card">
          <div className="tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              Create account
            </button>
          </div>

          {mode === 'register' ? (
            <form onSubmit={handleRegister} className="panel">
              <label>
                Login ID
                <input
                  type="text"
                  value={loginId}
                  onChange={(event) => setLoginId(event.target.value)}
                  placeholder="email or username"
                />
              </label>
              <label>
                Display name
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="optional"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                />
              </label>
              <button type="submit" className="primary">Create account</button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="panel">
              <label>
                Login ID
                <input
                  type="text"
                  value={loginId}
                  onChange={(event) => setLoginId(event.target.value)}
                  placeholder="email or username"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label className="stack">
                Salt (base64)
                <input
                  type="text"
                  value={manualSalt}
                  onChange={(event) => setManualSalt(event.target.value)}
                  placeholder={storedSalt ? 'Stored locally or paste a new one' : 'Paste the salt used on registration'}
                />
                <span className="hint">
                  {storedSalt ? 'Salt found in this browser.' : 'No local salt found yet.'}
                </span>
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={secureMode}
                  onChange={(event) => setSecureMode(event.target.checked)}
                />
                Secure mode (no session secret cache)
              </label>
              <button type="submit" className="primary">Sign in</button>
            </form>
          )}

          <div className={`status ${status.type}`}>
            <strong>Status</strong>
            <span>{status.message ?? 'Ready.'}</span>
          </div>

          <div className="session-actions">
            <button type="button" onClick={handleCheckSession}>Check session</button>
            <button type="button" onClick={handleToggleMode}>Toggle secure mode</button>
            <button type="button" onClick={handleLogout}>Logout</button>
          </div>
          {sessionInfo && <p className="session-info">{sessionInfo}</p>}
        </div>
      </header>
      <section className="notes">
        <div>
          <h2>Local cryptography</h2>
          <p>
            Your password never leaves the browser. The client derives H3 locally using PBKDF2 + SHA-256,
            and only H3 is sent to the server.
          </p>
        </div>
        <div>
          <h2>Salt handling</h2>
          <p>
            The salt is generated on registration and stored in this browser. If you sign in on another
            device, paste your salt or share it securely.
          </p>
        </div>
        <div>
          <h2>Secure mode</h2>
          <p>
            Secure mode disables the session secret cache so keys are derived per request. Use it for
            highly sensitive tasks.
          </p>
        </div>
      </section>
    </div>
  );
}
