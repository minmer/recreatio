import { useEffect, useState } from 'react';

export type CogitaRole = 'student' | 'teacher' | 'explore';

const STORAGE_PREFIX = 'recreatio.cogita.role.';

export function getStoredCogitaRole(personRoleId: string): CogitaRole | null {
  try {
    const val = localStorage.getItem(STORAGE_PREFIX + personRoleId);
    if (val === 'student' || val === 'teacher' || val === 'explore') return val;
    return null;
  } catch {
    return null;
  }
}

export function saveStoredCogitaRole(personRoleId: string, role: CogitaRole) {
  try {
    localStorage.setItem(STORAGE_PREFIX + personRoleId, role);
  } catch {}
}

const ROLE_IMAGES: Record<CogitaRole, string> = {
  student: '/cogita/Student.png',
  teacher: '/cogita/Teacher.png',
  explore: '/cogita/Workspace.png'
};

const ROLE_IDS: CogitaRole[] = ['student', 'teacher', 'explore'];

export function CogitaRoleIntro({
  kicker,
  title,
  roles,
  onDone
}: {
  kicker: string;
  title: string;
  roles: Record<CogitaRole, { title: string; subtitle: string }>;
  onDone: (role: CogitaRole) => void;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setActive(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`cogita-role-intro${active ? ' is-active' : ''}`}>
      <div className="cogita-role-intro-inner">
        <p className="cogita-role-intro-kicker">{kicker}</p>
        <h1 className="cogita-role-intro-title">{title}</h1>
        <div className="cogita-role-intro-cards">
          {ROLE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="cogita-role-intro-card"
              onClick={() => onDone(id)}
            >
              <div className="cogita-role-intro-card-img">
                <img src={ROLE_IMAGES[id]} alt="" aria-hidden="true" />
              </div>
              <span className="cogita-role-intro-card-title">{roles[id].title}</span>
              <span className="cogita-role-intro-card-sub">{roles[id].subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
