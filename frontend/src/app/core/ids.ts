/**
 * Anhang E — Kennungen, Browserseite.
 *
 * <b>Die Kennung entsteht HIER</b> (23.2), vor dem Absenden: sie ist Teil
 * dessen, was unterschrieben wird. Vergäbe sie der Dienst, käme sie eine Runde
 * zu spät — die Unterschrift müsste über etwas gebildet werden, das noch nicht
 * feststeht.
 *
 * UUIDv7 (RFC 9562): 48 Bit Zeitstempel, danach Zufall. Zeitlich sortierbar,
 * damit ein Index dicht bleibt; zufällig genug, dass niemand Bestandsgrössen
 * abzählen kann. `crypto.randomUUID()` liefert Fassung 4 und taugt dafür nicht.
 *
 * Muss zu `Kernel/Ids.cs` passen: Kleinbuchstaben mit Bindestrichen. Eine
 * zweite Schreibweise derselben Kennung landet irgendwann in einer AAD, und
 * dann geht die Hülle am gleichen Platz nicht mehr auf.
 */

const hex = (b: number): string => b.toString(16).padStart(2, '0');

export function newId(at: Date = new Date()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ms = at.getTime();

  if (ms < 0) throw new Error('Zeitpunkt vor 1970.');

  // 48 Bit Zeitstempel, big-endian. `Number` trägt 53 Bit sicher — für
  // Millisekunden reicht das bis weit ins nächste Jahrtausend.
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ms / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ms / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ms / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;

  bytes[6] = 0x70 | (bytes[6] & 0x0f); // Fassung 7
  bytes[8] = 0x80 | (bytes[8] & 0x3f); // Variante 10

  const s = Array.from(bytes, hex).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** 23.4 — Kleinbuchstaben mit Bindestrichen, 36 Zeichen. Sonst nichts. */
export const isId = (text: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(text);
