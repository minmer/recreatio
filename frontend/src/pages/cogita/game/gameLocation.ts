export type GameLocationMode = 'far' | 'near' | 'active';

export type GameLocationZone = {
  zoneId: string;
  lat: number;
  lon: number;
  radiusM: number;
  isEnabled: boolean;
};

export type GameLocationSample = {
  latitude: number;
  longitude: number;
  accuracyM: number;
  speedMps?: number | null;
  headingDeg?: number | null;
  deviceTimeUtc: string;
};

export type GameLocationTracker = {
  getMode: () => GameLocationMode;
  stop: () => void;
};

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusM = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusM * c;
}

export function resolveLocationMode(nearestDistanceM: number): GameLocationMode {
  if (!Number.isFinite(nearestDistanceM)) return 'far';
  if (nearestDistanceM < 300) return 'active';
  if (nearestDistanceM <= 1200) return 'near';
  return 'far';
}

function modeIntervalMs(mode: GameLocationMode): number {
  if (mode === 'active') return 5_000;
  if (mode === 'near') return 20_000;
  return 120_000;
}

export function createAdaptiveGameLocationTracker(payload: {
  zones: GameLocationZone[];
  flushMs?: number;
  onModeChanged?: (mode: GameLocationMode, nearestDistanceM: number) => void;
  onBatch: (samples: GameLocationSample[], mode: GameLocationMode) => void;
}): GameLocationTracker {
  let disposed = false;
  let mode: GameLocationMode = 'far';
  let loopTimer = 0;
  let flushTimer = 0;
  let queued: GameLocationSample[] = [];
  const importModule = new Function('moduleName', 'return import(moduleName);') as (moduleName: string) => Promise<unknown>;
  let capacitorAvailable: boolean | null = null;

  const flush = () => {
    if (queued.length === 0 || disposed) return;
    const batch = queued;
    queued = [];
    payload.onBatch(batch, mode);
  };

  const scheduleFlush = () => {
    if (flushTimer) {
      window.clearTimeout(flushTimer);
    }
    flushTimer = window.setTimeout(flush, Math.max(10_000, payload.flushMs ?? 20_000));
  };

  const findNearestDistance = (latitude: number, longitude: number) => {
    const enabled = payload.zones.filter((zone) => zone.isEnabled);
    if (enabled.length === 0) {
      return Number.POSITIVE_INFINITY;
    }
    let nearest = Number.POSITIVE_INFINITY;
    for (const zone of enabled) {
      const centerDistance = distanceMeters(latitude, longitude, zone.lat, zone.lon);
      const edgeDistance = Math.max(0, centerDistance - zone.radiusM);
      if (edgeDistance < nearest) {
        nearest = edgeDistance;
      }
    }
    return nearest;
  };

  type RawLocation = {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    heading: number | null;
    timestamp: number;
  };

  const readBrowserLocation = async (currentMode: GameLocationMode): Promise<RawLocation | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return null;
    }

    return new Promise<RawLocation | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Math.max(0, position.coords.accuracy ?? 0),
            speed: Number.isFinite(position.coords.speed ?? NaN) ? position.coords.speed : null,
            heading: Number.isFinite(position.coords.heading ?? NaN) ? position.coords.heading : null,
            timestamp: position.timestamp || Date.now()
          });
        },
        () => resolve(null),
        {
          enableHighAccuracy: currentMode === 'active',
          timeout: modeIntervalMs(currentMode),
          maximumAge: currentMode === 'active' ? 1_000 : 15_000
        }
      );
    });
  };

  const isCapacitorNativeAvailable = async (): Promise<boolean> => {
    if (capacitorAvailable !== null) {
      return capacitorAvailable;
    }

    const maybeCapacitor = (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    capacitorAvailable = Boolean(maybeCapacitor?.isNativePlatform?.());
    return capacitorAvailable;
  };

  const readCapacitorLocation = async (currentMode: GameLocationMode): Promise<RawLocation | null> => {
    try {
      const module = (await importModule('@capacitor/geolocation')) as {
        Geolocation?: {
          getCurrentPosition: (options: {
            enableHighAccuracy?: boolean;
            timeout?: number;
            maximumAge?: number;
          }) => Promise<{
            coords: {
              latitude: number;
              longitude: number;
              accuracy: number;
              speed?: number | null;
              heading?: number | null;
            };
            timestamp: number;
          }>;
        };
      };

      if (!module?.Geolocation?.getCurrentPosition) {
        return null;
      }

      const result = await module.Geolocation.getCurrentPosition({
        enableHighAccuracy: currentMode === 'active',
        timeout: modeIntervalMs(currentMode),
        maximumAge: currentMode === 'active' ? 1_000 : 15_000
      });

      return {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: Math.max(0, result.coords.accuracy ?? 0),
        speed: Number.isFinite(result.coords.speed ?? NaN) ? result.coords.speed ?? null : null,
        heading: Number.isFinite(result.coords.heading ?? NaN) ? result.coords.heading ?? null : null,
        timestamp: result.timestamp || Date.now()
      };
    } catch {
      return null;
    }
  };

  const readLocation = async (currentMode: GameLocationMode): Promise<RawLocation | null> => {
    if (await isCapacitorNativeAvailable()) {
      const nativeLocation = await readCapacitorLocation(currentMode);
      if (nativeLocation) {
        return nativeLocation;
      }
    }

    return readBrowserLocation(currentMode);
  };

  const sampleOnce = async () => {
    if (disposed) return;

    const position = await readLocation(mode);
    if (disposed) return;

    if (!position) {
      if (loopTimer) {
        window.clearTimeout(loopTimer);
      }
      loopTimer = window.setTimeout(() => {
        void sampleOnce();
      }, modeIntervalMs('far'));
      return;
    }

    const nearestDistanceM = findNearestDistance(position.latitude, position.longitude);
    const nextMode = resolveLocationMode(nearestDistanceM);
    if (nextMode !== mode) {
      mode = nextMode;
      payload.onModeChanged?.(mode, nearestDistanceM);
    }

    const sample: GameLocationSample = {
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyM: position.accuracy,
      speedMps: position.speed,
      headingDeg: position.heading,
      deviceTimeUtc: new Date(position.timestamp || Date.now()).toISOString()
    };
    queued.push(sample);

    const boundaryCandidate = nearestDistanceM <= 30;
    if (queued.length >= 6 || boundaryCandidate) {
      flush();
    } else {
      scheduleFlush();
    }

    if (loopTimer) {
      window.clearTimeout(loopTimer);
    }
    loopTimer = window.setTimeout(() => {
      void sampleOnce();
    }, modeIntervalMs(mode));
  };

  void sampleOnce();

  return {
    getMode: () => mode,
    stop: () => {
      disposed = true;
      if (loopTimer) window.clearTimeout(loopTimer);
      if (flushTimer) window.clearTimeout(flushTimer);
      flush();
    }
  };
}
