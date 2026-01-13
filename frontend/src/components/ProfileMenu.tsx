import { useEffect, useRef, useState } from 'react';
import type { Copy } from '../content/types';

export function ProfileMenu({
  copy,
  label,
  secureMode,
  onNavigateProfile,
  onToggleSecureMode,
  onLogout
}: {
  copy: Copy;
  label: string;
  secureMode: boolean;
  onNavigateProfile: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pointerTypeRef = useRef<'mouse' | 'touch' | 'pen' | 'unknown'>('unknown');

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div
      className={`profile-menu ${open ? 'open' : ''}`}
      ref={wrapperRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onPointerDown={(event) => {
        pointerTypeRef.current = event.pointerType as typeof pointerTypeRef.current;
      }}
    >
      <button
        type="button"
        className="profile-button"
        onClick={(event) => {
          if (pointerTypeRef.current === 'touch' || pointerTypeRef.current === 'pen') {
            event.preventDefault();
            setOpen((prev) => !prev);
            return;
          }
          onNavigateProfile();
        }}
      >
        {label}
      </button>
      <div className={`profile-dropdown ${open ? 'open' : ''}`}>
        <button
          type="button"
          onClick={() => {
            onNavigateProfile();
            setOpen(false);
          }}
        >
          {copy.accountMenu.profile}
        </button>
        <button
          type="button"
          onClick={() => {
            onToggleSecureMode();
            setOpen(false);
          }}
        >
          {secureMode ? copy.accountMenu.secureModeOff : copy.accountMenu.secureModeOn}
        </button>
        <button
          type="button"
          onClick={() => {
            onLogout();
            setOpen(false);
          }}
        >
          {copy.accountMenu.logout}
        </button>
      </div>
    </div>
  );
}
