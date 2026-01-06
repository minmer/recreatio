import type { Copy } from '../content/types';
import type { Mode, RouteKey } from '../types/navigation';
import { AuthForm } from './AuthForm';

export function LoginCard({
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
  open,
  onClose,
  context
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
  open: boolean;
  onClose: () => void;
  context: RouteKey;
}) {
  if (!open) return null;

  const contextLabel =
    context === 'parish'
      ? copy.parish.title
      : context === 'cogita'
        ? copy.cogita.title
        : copy.loginCard.contextDefault;

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="login-card" onClick={(event) => event.stopPropagation()}>
        <div className="login-card-header">
          <img src="/logo_new.png" alt={copy.loginCard.title} />
          <span>{copy.loginCard.title}</span>
        </div>
        <p className="login-card-note">{contextLabel}</p>
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
          compact
        />
      </div>
    </div>
  );
}
