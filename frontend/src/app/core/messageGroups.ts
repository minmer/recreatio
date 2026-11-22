/**
 * 2026-11-22 (A3) — GLEICHE MELDUNGEN ZUSAMMEN. Eine Vorschau eines Imports nennt oft hundertmal dasselbe, nur mit einem
 * anderen Namen („Wpis „A” używa koloru …", „Wpis „B” używa koloru …"). Hier wird daraus EINE Zeile mit der Zahl und den
 * Beispielen zum Aufklappen.
 *
 * Zusammen gehört, was gleich ist, sobald die Namen darin verdeckt sind: Text in Anführungszeichen („…”, „…“, "…", “…”,
 * «…», »…«), bleibende Namen (`@kurs/temat`), Kennungen (UUID), Stellen in Listen (`[3]`) — andere Zahlen bleiben (drei Fragen ≠ fünf Fragen ist oft ein
 * anderer Befund, und eine Zahl im Text unterscheidet selten nur den Namen). Die Reihenfolge ist die des ersten
 * Auftretens. Rein (ohne React, ohne DOM): dieselbe Gruppierung läuft im Browser (`ui/MessageList.tsx`) und im Dienst
 * (`importCheck/`, die Prüfung über MCP).
 */

export interface MessageGroup {
  /** Der Text mit verdeckten Namen („…") — bei einer einzigen Meldung ihr ganzer Text. */
  readonly text: string;
  readonly count: number;
  /** Die Meldungen selbst, in ihrer Reihenfolge (verschieden; gleiche zählen nur in `count`). */
  readonly examples: readonly string[];
}

/** Was ein Name ist: Zitat in Anführungszeichen, ein bleibender Name, eine Kennung. */
const NAMES: readonly RegExp[] = [
  /„[^„”“"\n]*[”“"]/g,
  /“[^“”\n]*”/g,
  /«[^«»\n]*»/g,
  /»[^«»\n]*«/g,
  /"[^"\n]*"/g,
  /@@?[\p{L}\p{N}_.~-]+(?::@?[\p{L}\p{N}_.~/-]+)?(?:\/[\p{L}\p{N}_.~-]+)*/gu,
  /\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\b/gi,
  /* Die Stelle in einer Liste (`appointments[3]`, `modules[12].config`) — dieselbe Meldung an anderer Stelle. */
  /\[\d+\]/g
];

/** Eine Meldung mit verdeckten Namen. */
export function messagePattern(line: string): string {
  let out = line;
  for (const re of NAMES) out = out.replace(re, (m) => (m.startsWith('@') ? '@…' : m.startsWith('[') ? '[…]' : /^[0-9a-f]/i.test(m) ? '…' : `${m[0]}…${m[m.length - 1]}`));
  return out;
}

/** Die Meldungen in Gruppen — gleiche (auch nur im Namen verschiedene) als eine Gruppe mit Zahl und Beispielen. */
export function groupMessages(lines: readonly string[]): MessageGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, { count: number; examples: string[]; seen: Set<string> }>();
  for (const line of lines) {
    if (typeof line !== 'string' || line.trim() === '') continue;
    const key = messagePattern(line.trim());
    let g = byKey.get(key);
    if (g === undefined) { g = { count: 0, examples: [], seen: new Set() }; byKey.set(key, g); order.push(key); }
    g.count += 1;
    if (!g.seen.has(line)) { g.seen.add(line); g.examples.push(line); }
  }
  return order.map((key) => {
    const g = byKey.get(key)!;
    return { text: g.examples.length === 1 ? g.examples[0]! : key, count: g.count, examples: g.examples };
  });
}
