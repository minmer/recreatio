import { useEffect, useRef } from 'react';

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
  removeEventListener?: (type: 'release', listener: () => void) => void;
};

type WakeLockApiLike = {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
};

function getWakeLockApi(): WakeLockApiLike | null {
  if (typeof navigator === 'undefined') return null;
  const api = (navigator as Navigator & { wakeLock?: WakeLockApiLike }).wakeLock;
  if (!api || typeof api.request !== 'function') return null;
  return api;
}

export function useScreenWakeLock(enabled: boolean) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const wakeLock = getWakeLockApi();
    if (!wakeLock) return;

    let disposed = false;

    const releaseLock = async () => {
      const current = sentinelRef.current;
      sentinelRef.current = null;
      if (!current) return;
      current.removeEventListener?.('release', handleRelease);
      try {
        if (!current.released) {
          await current.release();
        }
      } catch {
        // Ignore release errors from browser wake lock internals.
      }
    };

    const requestLock = async () => {
      if (disposed || document.visibilityState !== 'visible') return;
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        const next = await wakeLock.request('screen');
        if (disposed) {
          try {
            await next.release();
          } catch {
            // Ignore cleanup errors after unmount/dispose.
          }
          return;
        }
        sentinelRef.current = next;
        next.addEventListener?.('release', handleRelease);
      } catch {
        // Browser denied lock (permissions, power-save mode, unsupported state, etc.).
      }
    };

    function handleRelease() {
      sentinelRef.current = null;
      if (!disposed && document.visibilityState === 'visible') {
        void requestLock();
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestLock();
      } else {
        void releaseLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    void requestLock();

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void releaseLock();
    };
  }, [enabled]);
}

