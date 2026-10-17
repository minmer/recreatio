/**
 * WELCHE WOCHENTAGE EINE ZEILE MEINT — „wtorek", „pn–pt", „we wtorki i
 * czwartki", „codziennie".
 *
 * Für die Godziny-Kachel: wer sie aufschlägt, sucht EINEN Tag, und meistens
 * den heutigen. Die Zeile, die heute gilt, wird deshalb hervorgehoben.
 *
 * <b>Lieber nichts als falsch.</b> Was sich nicht sicher lesen lässt, meint
 * hier keinen Tag — dann wird eben nichts hervorgehoben. „czynne" beginnt wie
 * „czwartek" und „nieczynne" wie „niedziela"; deshalb gelten Kürzel nur als
 * ganzes Wort und Stämme nur, wo sie nichts anderes sein können.
 *
 * Tage wie `Date.getDay()`: 0 Sonntag, 1 Montag … 6 Samstag.
 */

/** Ganze Wörter, die einen Tag nennen. */
const WORDS: Record<string, number> = {
  nd: 0, ndz: 0, niedz: 0, niedziela: 0,
  pn: 1, pon: 1,
  wt: 2, wto: 2,
  śr: 3, sr: 3, śro: 3,
  cz: 4, czw: 4,
  pt: 5, pią: 5, pia: 5,
  sb: 6, sob: 6
};

/** Stämme — gebeugt steht der Tag in „we wtorki", „w środy", „piątkami". */
const STEMS: readonly (readonly [string, number])[] = [
  ['niedziel', 0], ['poniedzia', 1], ['wtor', 2], ['środ', 3], ['sród', 3], ['srod', 3],
  ['czwart', 4], ['piąt', 5], ['piat', 5], ['sobot', 6]
];

function dayOf(word: string): number | null {
  if (word in WORDS) return WORDS[word];
  const stem = STEMS.find(([prefix]) => word.startsWith(prefix));
  return stem === undefined ? null : stem[1];
}

/**
 * Die Tage, die eine Beschriftung nennt — oder eine leere Menge.
 *
 * Zwei Tage mit einem Strich dazwischen sind eine Spanne („pn–pt", auch über
 * das Wochenende: „pt–nd"); sonst gilt jeder genannte Tag für sich.
 */
export function weekdaysIn(label: string): ReadonlySet<number> {
  const lower = label.toLowerCase();
  if (/\bcodziennie\b/u.test(lower)) return new Set([0, 1, 2, 3, 4, 5, 6]);

  const found: { day: number; at: number; end: number }[] = [];
  for (const match of lower.matchAll(/\p{L}+/gu)) {
    const day = dayOf(match[0]);
    if (day !== null) found.push({ day, at: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  }

  if (found.length === 2 && /^\.?\s*[–—-]\s*$/u.test(lower.slice(found[0].end, found[1].at))) {
    const out = new Set<number>();
    for (let d = found[0].day; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === found[1].day || out.size === 7) break;
    }
    return out;
  }

  return new Set(found.map((one) => one.day));
}

/**
 * Eine Zeile in Beschriftung und Wert: „wtorek — 16:00–18:00". Getrennt wird
 * am langen Strich, sonst an einem Strich mit Leerzeichen — „16:00–18:00"
 * selbst trägt einen, ohne Leerzeichen.
 */
export function splitRow(row: string): { label: string; value: string | null } {
  const text = row.trim();
  const long = text.indexOf('—');
  if (long >= 0) return { label: text.slice(0, long).trim(), value: text.slice(long + 1).trim() || null };

  const spaced = /\s[–-]\s/u.exec(text);
  if (spaced !== null) {
    return { label: text.slice(0, spaced.index).trim(), value: text.slice(spaced.index + spaced[0].length).trim() || null };
  }

  return { label: text, value: null };
}
