import { useEffect, useState } from 'react';
import { getCogitaLibraries, getCogitaLibraryStats, type CogitaLibraryStats } from '../../../lib/api';

export function useCogitaLibraryMeta(libraryId: string) {
  const [libraryName, setLibraryName] = useState('Cogita library');
  const [stats, setStats] = useState<CogitaLibraryStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCogitaLibraries()
      .then((libraries) => {
        if (cancelled) return;
        const match = libraries.find((library) => library.libraryId === libraryId);
        if (match) setLibraryName(match.name);
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
    getCogitaLibraryStats(libraryId)
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
