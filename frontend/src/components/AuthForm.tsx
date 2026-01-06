import type { Mode } from '../types/navigation';
import type { Copy } from '../content/types';

export function AuthForm({
  copy,
  mode,
  onModeChange,
  loginId,
  onLoginIdChange,
  displayName,
  onDisplayNameChange,
  password,
  onPasswordChange,
  passwordConfirm,
  onPasswordConfirmChange,
  secureMode,
  onSecureModeChange,
  availability,
  passwordHint,
  onSubmit,
  compact
}: {
  copy: Copy;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  loginId: string;
  onLoginIdChange: (value: string) => void;
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  passwordConfirm: string;
  onPasswordConfirmChange: (value: string) => void;
  secureMode: boolean;
  onSecureModeChange: (value: boolean) => void;
  availability: string | null;
  passwordHint: string | null;
  onSubmit: (event: React.FormEvent) => void;
  compact?: boolean;
}) {
  return (
    <>
      <div className="tabs">
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => onModeChange('login')}>
          {copy.access.login}
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'active' : ''}
          onClick={() => onModeChange('register')}
        >
          {copy.access.register}
        </button>
      </div>

      {mode === 'register' ? (
        <form onSubmit={onSubmit} className={`panel ${compact ? 'compact' : ''}`.trim()}>
          <label>
            {copy.access.loginId}
            <input type="text" value={loginId} onChange={(event) => onLoginIdChange(event.target.value)} />
          </label>
          <label>
            {copy.access.displayName}
            <input type="text" value={displayName} onChange={(event) => onDisplayNameChange(event.target.value)} />
          </label>
          <label>
            {copy.access.password}
            <input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} />
          </label>
          {passwordHint && <span className="hint">{passwordHint}</span>}
          <label>
            {copy.access.confirm}
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => onPasswordConfirmChange(event.target.value)}
            />
          </label>
          {availability && <span className="hint">{availability}</span>}
          <button type="submit" className="cta">
            {copy.access.create}
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className={`panel ${compact ? 'compact' : ''}`.trim()}>
          <label>
            {copy.access.loginId}
            <input type="text" value={loginId} onChange={(event) => onLoginIdChange(event.target.value)} />
          </label>
          <label>
            {copy.access.password}
            <input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={secureMode}
              onChange={(event) => onSecureModeChange(event.target.checked)}
            />
            {copy.access.secureMode}
          </label>
          <button type="submit" className="cta">
            {copy.access.signIn}
          </button>
        </form>
      )}
    </>
  );
}
