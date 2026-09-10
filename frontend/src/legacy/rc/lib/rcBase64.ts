/**
 * Base64URL ohne Füllzeichen (RFC 4648 §5).
 *
 * Muss mit `backend/Rc.Kernel/RcBase64Url.cs` übereinstimmen. Wenn Kopf und
 * Datenbank sich um ein Füllzeichen unterscheiden, sieht das für den Menschen
 * davor aus wie ein falsches Passwort — und man sucht drei Stunden an der
 * falschen Stelle.
 */

export function rcToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function rcFromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
