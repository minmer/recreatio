/**
 * WAS ÄLTERE WEBVIEWS NOCH NICHT KENNEN — und ohne das die App nicht startet.
 *
 * Ein altes Telefon (das nur noch seine SMS ins Archiv beiträgt) hat oft eine
 * WebView ohne Aktualisierung. `crypto.randomUUID` gibt es erst ab Chrome 92;
 * ohne es öffnet sich der Schlüssel nach einem Neustart nicht. Hier nur, was
 * dafür nötig ist — der Rest der Seite sieht dort schlichter aus, geht aber.
 */

if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: (): `${string}-${string}-${string}-${string}-${string}` => {
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
  });
}

export {};
