import { useEffect, useMemo, useState } from 'react';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import { checkPasswordStrength } from '../../lib/passwordPolicy';
import { changePasswordWithPassword } from '../../lib/authClient';
import { getProfile, issueCsrf, updateProfile } from '../../lib/api';
import { RoleGraphSection } from './RoleGraphSection';

export function AccountPage({
  copy,
  loginId,
  onLoginIdChange,
  secureMode,
  onToggleSecureMode,
  onLogout,
  onNavigate,
  language,
  onLanguageChange
}: {
  copy: Copy;
  loginId: string;
  onLoginIdChange: (value: string) => void;
  secureMode: boolean;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
}) {
  const sections = useMemo(
    () => [
      { id: 'overview', label: copy.account.sections.overview },
      { id: 'profile', label: copy.account.sections.profile },
      { id: 'roles', label: copy.account.sections.roles },
      { id: 'security', label: copy.account.sections.security }
    ],
    [copy.account.sections]
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [nicknameStatus, setNicknameStatus] = useState<{ type: 'idle' | 'working' | 'success' | 'error'; message?: string }>(
    { type: 'idle' }
  );
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'idle' | 'working' | 'success' | 'error'; message?: string }>({
    type: 'idle'
  });

  useEffect(() => {
    if (!newPassword) {
      setPasswordHint(null);
      return;
    }

    const check = checkPasswordStrength(newPassword, {
      tooShort: copy.access.passwordTooShort,
      common: copy.access.passwordCommon,
      weak: copy.access.passwordWeak,
      strong: copy.access.passwordStrong
    });
    setPasswordHint(check.message);
  }, [
    copy.access.passwordCommon,
    copy.access.passwordStrong,
    copy.access.passwordTooShort,
    copy.access.passwordWeak,
    newPassword
  ]);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        await issueCsrf();
        const profile = await getProfile();
        if (!active) return;
        onLoginIdChange(profile.loginId);
        setNickname(profile.displayName ?? '');
      } catch {
        if (!active) return;
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [onLoginIdChange]);

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setMenuOpen(false);
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordStatus({ type: 'idle' });

    if (!loginId || !currentPassword || !newPassword) {
      setPasswordStatus({ type: 'error', message: copy.access.loginRequired });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: copy.access.passwordMismatch });
      return;
    }

    const strength = checkPasswordStrength(newPassword, {
      tooShort: copy.access.passwordTooShort,
      common: copy.access.passwordCommon,
      weak: copy.access.passwordWeak,
      strong: copy.access.passwordStrong
    });
    if (!strength.ok) {
      setPasswordStatus({ type: 'error', message: strength.message });
      return;
    }

    setPasswordStatus({ type: 'working', message: copy.account.passwordWorking });
    try {
      await issueCsrf();
      await changePasswordWithPassword({
        loginId,
        currentPassword,
        newPassword
      });
      setPasswordStatus({ type: 'success', message: copy.account.passwordSuccess });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOpen(false);
    } catch {
      setPasswordStatus({ type: 'error', message: copy.account.passwordError });
    }
  };

  const handleNicknameSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNicknameStatus({ type: 'working', message: copy.account.nicknameWorking });
    try {
      const response = await updateProfile({ displayName: nickname || null });
      setNickname(response.displayName ?? '');
      setNicknameStatus({ type: 'success', message: copy.account.nicknameSuccess });
      setNicknameOpen(false);
    } catch {
      setNicknameStatus({ type: 'error', message: copy.account.nicknameError });
    }
  };

  return (
    <div className="portal-page account-page">
      <header className="portal-header">
        <button type="button" className="portal-brand" onClick={() => onNavigate('home')}>
          <img src="/logo_new.svg" alt={copy.loginCard.title} />
        </button>
        <LanguageSelect value={language} onChange={onLanguageChange} />
        <AuthAction
          copy={copy}
          label={copy.nav.account}
          isAuthenticated
          secureMode={secureMode}
          onLogin={() => onNavigate('home')}
          onProfileNavigate={() => {}}
          onToggleSecureMode={onToggleSecureMode}
          onLogout={onLogout}
          variant="ghost"
        />
      </header>
      <main className="account-main">
        <div className="account-shell">
          <aside className={`account-nav ${menuOpen ? 'open' : ''}`}>
            <button type="button" className="account-menu-toggle" onClick={() => setMenuOpen((prev) => !prev)}>
              {copy.account.menuLabel}
            </button>
            <nav>
              {sections.map((section) => (
                <button key={section.id} type="button" onClick={() => scrollToSection(section.id)}>
                  {section.label}
                </button>
              ))}
            </nav>
          </aside>
          <div className="account-content">
            <section className="account-intro" id="overview">
              <p className="tag">{copy.nav.account}</p>
              <h2>{copy.account.title}</h2>
              <p className="lead">{copy.account.subtitle}</p>
              <p className="note">{copy.account.overviewLead}</p>
            </section>

            <section className="account-card" id="profile">
              <h3>{copy.account.sections.profile}</h3>
              <div className="account-row">
                <div>
                  <strong>{copy.account.nicknameLabel}</strong>
                  <p className="note">{nickname || copy.account.nicknamePlaceholder}</p>
                </div>
                <button type="button" className="ghost" onClick={() => setNicknameOpen((prev) => !prev)}>
                  {copy.account.nicknameToggle}
                </button>
              </div>
              {nicknameOpen && (
                <form className="account-form" onSubmit={handleNicknameSubmit}>
                  <label>
                    {copy.account.nicknameLabel}
                    <input
                      type="text"
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      placeholder={copy.account.nicknamePlaceholder}
                    />
                  </label>
                  <p className="hint">{copy.account.nicknameHint}</p>
                  <button type="submit" className="ghost">
                    {copy.account.nicknameAction}
                  </button>
                </form>
              )}
              {nicknameStatus.type !== 'idle' && (
                <div className={`status ${nicknameStatus.type === 'working' ? '' : nicknameStatus.type}`}>
                  <strong>{copy.access.statusTitle}</strong>
                  <span>{nicknameStatus.message ?? copy.access.statusReady}</span>
                </div>
              )}
            </section>

            <RoleGraphSection copy={copy} />

            <section className="account-card" id="security">
              <h3>{copy.account.sections.security}</h3>
              <div className="account-readonly">
                <strong>{copy.account.loginIdLabel}</strong>
                <span>{loginId}</span>
              </div>
              <p className="hint">{copy.account.loginIdHint}</p>
              <button type="button" className="ghost" onClick={() => setPasswordOpen((prev) => !prev)}>
                {copy.account.passwordToggle}
              </button>
              {passwordOpen && (
                <form className="account-form" onSubmit={handlePasswordSubmit}>
                  <label>
                    {copy.account.currentPassword}
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                  </label>
                  <label>
                    {copy.account.newPassword}
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </label>
                  {passwordHint && <span className="hint">{passwordHint}</span>}
                  <label>
                    {copy.account.confirmPassword}
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </label>
                  <button type="submit" className="cta">
                    {copy.account.passwordAction}
                  </button>
                </form>
              )}
              {passwordStatus.type !== 'idle' && (
                <div className={`status ${passwordStatus.type}`}>
                  <strong>{copy.access.statusTitle}</strong>
                  <span>{passwordStatus.message ?? copy.access.statusReady}</span>
                </div>
              )}
              <div className="account-security">
                <div>
                  <strong>{copy.account.secureModeTitle}</strong>
                  <p className="note">{copy.account.secureModeNote}</p>
                </div>
                <button type="button" className="ghost" onClick={onToggleSecureMode}>
                  {secureMode ? copy.account.secureModeDisable : copy.account.secureModeEnable}
                </button>
              </div>
              <div className="account-security">
                <div>
                  <strong>{copy.account.logoutAction}</strong>
                </div>
                <button type="button" className="ghost" onClick={onLogout}>
                  {copy.account.logoutAction}
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
