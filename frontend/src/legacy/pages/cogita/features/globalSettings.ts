export type CogitaGlobalSettings = {
  questionCorrectness: number;
  dependencyCorrectness: number;
};

export const DEFAULT_QUESTION_CORRECTNESS = 70;
export const DEFAULT_DEPENDENCY_CORRECTNESS = 85;

const STORAGE_KEY = 'cogita.global.settings';

function clampPercent(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalize(raw: unknown): CogitaGlobalSettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    questionCorrectness: clampPercent(Number(source.questionCorrectness), DEFAULT_QUESTION_CORRECTNESS),
    dependencyCorrectness: clampPercent(Number(source.dependencyCorrectness), DEFAULT_DEPENDENCY_CORRECTNESS)
  };
}

export function getDefaultCogitaGlobalSettings(): CogitaGlobalSettings {
  return {
    questionCorrectness: DEFAULT_QUESTION_CORRECTNESS,
    dependencyCorrectness: DEFAULT_DEPENDENCY_CORRECTNESS
  };
}

export function loadCogitaGlobalSettings(): CogitaGlobalSettings {
  if (typeof window === 'undefined') return getDefaultCogitaGlobalSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultCogitaGlobalSettings();
    return normalize(JSON.parse(raw));
  } catch {
    return getDefaultCogitaGlobalSettings();
  }
}

export function saveCogitaGlobalSettings(settings: CogitaGlobalSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(settings)));
  } catch {
    // ignore storage failures
  }
}

