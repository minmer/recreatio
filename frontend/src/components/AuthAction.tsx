import type { Copy } from '../content/types';
import { ProfileMenu } from './ProfileMenu';

export function AuthAction({
  copy,
  label,
  isAuthenticated,
  secureMode,
  onLogin,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  variant = 'cta'
}: {
  copy: Copy;
  label: string;
  isAuthenticated: boolean;
  secureMode: boolean;
  onLogin: () => void;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  variant?: 'cta' | 'ghost';
}) {
  if (isAuthenticated) {
    return (
      <ProfileMenu
        copy={copy}
        label={label}
        secureMode={secureMode}
        onNavigateProfile={onProfileNavigate}
        onToggleSecureMode={onToggleSecureMode}
        onLogout={onLogout}
      />
    );
  }

  return (
    <button type="button" className={variant} onClick={onLogin}>
      {label}
    </button>
  );
}
