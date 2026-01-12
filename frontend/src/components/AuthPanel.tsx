import type { Copy } from '../content/types';
import type { Mode } from '../types/navigation';
import { AuthForm } from './AuthForm';

export function AuthPanel({
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
  status,
  onSubmit,
  onCheckSession,
  onToggleMode,
  onLogout,
  sessionInfo,
  compact = false,
  showSessionActions = true
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
  status: { type: 'idle' | 'working' | 'success' | 'error'; message?: string };
  onSubmit: (event: React.FormEvent) => void;
  onCheckSession?: () => void;
  onToggleMode?: () => void;
  onLogout?: () => void;
  sessionInfo?: string | null;
  compact?: boolean;
  showSessionActions?: boolean;
}) {
  return (
    <div className={`auth-panel ${compact ? 'auth-panel-compact' : ''}`.trim()}>
      <AuthForm
        copy={copy}
        mode={mode}
        onModeChange={onModeChange}
        loginId={loginId}
        onLoginIdChange={onLoginIdChange}
        displayName={displayName}
        onDisplayNameChange={onDisplayNameChange}
        password={password}
        onPasswordChange={onPasswordChange}
        passwordConfirm={passwordConfirm}
        onPasswordConfirmChange={onPasswordConfirmChange}
        secureMode={secureMode}
        onSecureModeChange={onSecureModeChange}
        availability={availability}
        passwordHint={passwordHint}
        onSubmit={onSubmit}
        compact={compact}
      />

      <div className={`status ${status.type}`}>
        <strong>{copy.access.statusTitle}</strong>
        <span>{status.message ?? copy.access.statusReady}</span>
      </div>

      {showSessionActions && onCheckSession && onToggleMode && onLogout && (
        <div className="session-actions">
          <button type="button" onClick={onCheckSession}>
            {copy.access.checkSession}
          </button>
          <button type="button" onClick={onToggleMode}>
            {copy.access.toggleMode}
          </button>
          <button type="button" onClick={onLogout}>
            {copy.access.logout}
          </button>
        </div>
      )}

      {sessionInfo && <p className="session-info">{sessionInfo}</p>}
    </div>
  );
}
