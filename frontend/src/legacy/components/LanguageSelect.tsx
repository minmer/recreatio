import { useEffect, useRef, useState } from 'react';

type Language = 'pl' | 'en' | 'de';

export function LanguageSelect({
  value,
  onChange
}: {
  value: Language;
  onChange: (language: Language) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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

  const pick = (next: Language) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className={`lang-select ${open ? 'open' : ''}`} ref={wrapperRef}>
      <button type="button" className="lang-button" onClick={() => setOpen((prev) => !prev)}>
        {value.toUpperCase()}
      </button>
      <div className={`lang-menu ${open ? 'open' : ''}`}>
        <button type="button" onClick={() => pick('pl')}>
          PL
        </button>
        <button type="button" onClick={() => pick('en')}>
          EN
        </button>
        <button type="button" onClick={() => pick('de')}>
          DE
        </button>
      </div>
    </div>
  );
}
