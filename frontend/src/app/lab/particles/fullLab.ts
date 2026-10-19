/**
 * PARTIKEL-LABOR — DIE KARTE MIT ALLEN KERNEN (`lab.html`): GitHub Pages
 * kann keine Kopfzeilen setzen, ohne die ein Browser keinen gemeinsamen
 * Speicher erlaubt (COOP/COEP, „cross-origin isolated“). Ein kleiner Service
 * Worker (`public/lab-sw.js`) setzt sie für genau diese eine Seite; die
 * übrige Seite bleibt, wie sie ist. Ein Baustein auf einer Seite rechnet mit
 * einem Faden und öffnet das Labor auf Wunsch dort — mit dem, was gebaut
 * wurde, in der Adresse (komprimiert, so lässt sie sich auch teilen).
 */

/** Was die Karte zeigt. */
export interface LabPayload {
  readonly title: string;
  readonly text: readonly string[];
  readonly scene: unknown;
}

/** Ob diese Seite gemeinsamen Speicher hat (dann rechnen Helfer mit). */
export const isolated = (): boolean => typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;

/**
 * Ob eine eigene Karte lohnt: die Seite ist nicht isoliert, der Rechner hat
 * mehr als zwei Kerne, und es ist ein Browser — nicht die App (Capacitor
 * öffnet keine zweite Karte, und auf dem Telefon rechnet das Labor ohnehin
 * gröber).
 */
export function fullLabUseful(): boolean {
  if (isolated() || typeof navigator === 'undefined') return false;
  const shell = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
  return !shell && (navigator.hardwareConcurrency || 2) > 2;
}

const toBase64Url = (bytes: Uint8Array): string => {
  let bin = '';
  for (let k = 0; k < bytes.length; k += 1) bin += String.fromCharCode(bytes[k]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k += 1) out[k] = bin.charCodeAt(k);
  return out;
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Die Adresse der Karte: `z=` komprimiert (deflate-raw), `j=` ohne, wo der Browser nicht komprimieren kann. */
export async function encodeLab(payload: LabPayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof CompressionStream === 'function') return `z=${toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
  return `j=${toBase64Url(bytes)}`;
}

export async function decodeLab(hash: string): Promise<LabPayload | null> {
  const h = hash.replace(/^#/, '');
  try {
    let bytes: Uint8Array;
    if (h.startsWith('z=') && typeof DecompressionStream === 'function') bytes = await pipe(fromBase64Url(h.slice(2)), new DecompressionStream('deflate-raw'));
    else if (h.startsWith('j=')) bytes = fromBase64Url(h.slice(2));
    else return null;
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as Partial<LabPayload>;
    return {
      title: typeof raw.title === 'string' ? raw.title : '',
      text: Array.isArray(raw.text) ? raw.text.filter((x): x is string => typeof x === 'string') : [],
      scene: raw.scene ?? null
    };
  } catch {
    return null;
  }
}

/**
 * Das Labor in einer neuen Karte öffnen. Die Karte wird sofort geöffnet (sonst
 * hält der Browser sie für ein Werbefenster) und bekommt ihre Adresse, sobald
 * die Szene verpackt ist.
 */
export function openFullLab(payload: () => Promise<LabPayload>): void {
  const tab = window.open('about:blank', '_blank');
  void payload().then(encodeLab).then((hash) => {
    const url = new URL('lab.html', document.baseURI);
    url.hash = hash;
    if (tab !== null) tab.location.href = url.href;
    else window.location.href = url.href;
  });
}
