import { useEffect, useRef, useState } from 'react';
import { usePersonContext } from '../lib/personContext';

export function PersonCard() {
  const {
    persons,
    activePerson,
    personCardOpen,
    personCardForced,
    setActivePerson,
    closePersonCard,
    createPerson
  } = usePersonContext();

  const [mounted, setMounted] = useState(personCardOpen);
  const [active, setActive] = useState(false);
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (personCardOpen) {
      setMounted(true);
      setActive(false);
      const raf = window.requestAnimationFrame(() => setActive(true));
      return () => window.cancelAnimationFrame(raf);
    }
    if (!personCardOpen && mounted) {
      setActive(false);
      const timeout = window.setTimeout(() => setMounted(false), 720);
      return () => window.clearTimeout(timeout);
    }
  }, [personCardOpen, mounted]);

  useEffect(() => {
    if (personCardOpen) {
      const raf = window.requestAnimationFrame(() => inputRef.current?.focus());
      return () => window.cancelAnimationFrame(raf);
    }
  }, [personCardOpen]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const label = name.trim();
    if (!label) {
      setErrorMsg('A name is required.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const person = await createPerson(label);
      setName('');
      setActivePerson(person);
    } catch {
      setErrorMsg('Failed to create profile. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  const hasPersons = persons.length > 0;

  return (
    <div
      className={`login-overlay ${active ? 'is-active' : ''}`}
      onClick={personCardForced ? undefined : closePersonCard}
    >
      <div className="login-card person-card" onClick={(e) => e.stopPropagation()}>
        <div className="login-card-header">
          <img src="/logo_new.png" alt="Recreatio" />
          <span>Recreatio</span>
        </div>

        {hasPersons ? (
          <>
            <p className="login-card-note">Who is using the app?</p>
            <div className="person-card-list">
              {persons.map((person) => (
                <button
                  key={person.roleId}
                  type="button"
                  className={`person-card-item${activePerson?.roleId === person.roleId ? ' is-active' : ''}`}
                  onClick={() => setActivePerson(person)}
                >
                  <span className="person-card-avatar">{person.label[0]?.toUpperCase() ?? '?'}</span>
                  <span className="person-card-name">{person.label}</span>
                </button>
              ))}
            </div>
            <details className="person-card-add">
              <summary>Add another person</summary>
              <form onSubmit={handleCreate} className="person-card-form">
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrorMsg(null); }}
                  placeholder="Name"
                  disabled={saving}
                  className="person-card-input"
                  autoComplete="off"
                />
                <button type="submit" className="cta" disabled={saving || !name.trim()}>
                  {saving ? 'Creating...' : 'Create'}
                </button>
                {errorMsg ? <p className="person-card-error">{errorMsg}</p> : null}
              </form>
            </details>
          </>
        ) : (
          <>
            <p className="login-card-note">Create a profile to get started.</p>
            <form onSubmit={handleCreate} className="person-card-form">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setErrorMsg(null); }}
                placeholder="Your name"
                disabled={saving}
                className="person-card-input"
                autoComplete="off"
              />
              <button type="submit" className="cta" disabled={saving || !name.trim()}>
                {saving ? 'Creating...' : 'Create profile'}
              </button>
              {errorMsg ? <p className="person-card-error">{errorMsg}</p> : null}
            </form>
          </>
        )}

        {!personCardForced ? (
          <button type="button" className="ghost person-card-close" onClick={closePersonCard}>
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}
