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

const ROLES: { id: CogitaRole; image: string; title: string; subtitle: string }[] = [
  {
    id: 'student',
    image: '/cogita/Student.png',
    title: 'I want to learn',
    subtitle: 'Explore knowledge through stories, revision and guided challenges.'
  },
  {
    id: 'teacher',
    image: '/cogita/Teacher.png',
    title: 'I want to teach',
    subtitle: 'Build storyboards, create revision sets and guide others through knowledge.'
  },
  {
    id: 'explore',
    image: '/cogita/Workspace.png',
    title: 'I want to explore',
    subtitle: 'Discover everything Cogita can do — at your own pace.'
  }
];

export function CogitaRoleIntro({ onDone }: { onDone: (role: CogitaRole) => void }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setActive(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`cogita-role-intro${active ? ' is-active' : ''}`}>
      <div className="cogita-role-intro-inner">
        <p className="cogita-role-intro-kicker">Welcome to Cogita</p>
        <h1 className="cogita-role-intro-title">How would you like to begin?</h1>
        <div className="cogita-role-intro-cards">
          {ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              className="cogita-role-intro-card"
              onClick={() => onDone(role.id)}
            >
              <div className="cogita-role-intro-card-img">
                <img src={role.image} alt="" aria-hidden="true" />
              </div>
              <span className="cogita-role-intro-card-title">{role.title}</span>
              <span className="cogita-role-intro-card-sub">{role.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
