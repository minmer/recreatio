import { useEffect, useState } from 'react';
import type { CogitaLibraryStats } from '../../../lib/api';
import { getCachedLibraryName, getCachedLibraryStats } from './cogitaMetaCache';

export function useCogitaLibraryMeta(libraryId: string) {
  const [libraryName, setLibraryName] = useState('Cogita library');
  const [stats, setStats] = useState<CogitaLibraryStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCachedLibraryName(libraryId)
      .then((name) => {
        if (cancelled || !name) return;
        setLibraryName(name);
      })
      .catch(() => {
        if (!cancelled) setLibraryName('Cogita library');
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  useEffect(() => {
    let cancelled = false;
    getCachedLibraryStats(libraryId)
      .then((next) => {
        if (cancelled) return;
        setStats(next);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  return { libraryName, stats };
}
