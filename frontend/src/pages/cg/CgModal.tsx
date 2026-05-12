import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  width?: string;
  children: React.ReactNode;
}

export function CgModal({ isOpen, onClose, title, width = '44rem', children }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        background: 'rgba(0,0,0,0.45)',
      }}
    >
      <div style={{
        background: 'var(--cg-surface)',
        border: '1px solid var(--cg-border)',
        borderRadius: 'var(--cg-radius)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.45)',
        width: '100%',
        maxWidth: width,
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header — only rendered if title is provided */}
        {title !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.9rem 1.25rem',
            borderBottom: '1px solid var(--cg-border)',
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--cg-text)' }}>
              {title}
            </span>
            <button className="cg-btn cg-btn-ghost cg-btn-sm" type="button" onClick={onClose}>
              ✕
            </button>
          </div>
        )}
        {/* Scrollable body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
