/**
 * 0083 — PESEL und Geburtsdatum: was aus einer Antwort über das Alter folgt.
 *
 * <b>Geprüft wird hier, im Browser.</b> Der Dienst liest keine Antwort; eine
 * falsche Ziffer fiele erst auf, wenn der Versicherer die Liste zurückschickt.
 * Die Prüfziffer fängt einen Tippfehler, bevor er abgeschickt wird.
 *
 * <b>Aus dem PESEL folgt das Geburtsdatum</b> — der Monat trägt das
 * Jahrhundert (+80 für 18xx, +20 für 20xx, …). Daraus rechnet die Logik eines
 * Formulars das Alter (Knoten „Wiek"), gleich ob jemand ein Datum oder einen
 * PESEL angegeben hat.
 */

const WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3] as const;

/** Nur die Ziffern — Leerzeichen und Striche, wie man sie tippt, fallen weg. */
export const peselDigits = (value: string): string => value.replace(/[\s-]/g, '');

/** Das Geburtsdatum aus einem PESEL (`YYYY-MM-DD`) — oder `null`, wenn es keines ergibt. */
export function peselBirth(value: string): string | null {
  const d = peselDigits(value);
  if (!/^\d{11}$/.test(d)) return null;

  const yy = Number(d.slice(0, 2));
  const mm = Number(d.slice(2, 4));
  const dd = Number(d.slice(4, 6));
  const century = mm > 80 ? 1800 : mm > 60 ? 2200 : mm > 40 ? 2100 : mm > 20 ? 2000 : 1900;
  const month = mm % 20;
  const year = century + yy;

  const date = new Date(Date.UTC(year, month - 1, dd));
  if (month < 1 || month > 12 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== dd) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/** Ein gültiger PESEL: elf Ziffern, ein mögliches Geburtsdatum, die richtige Prüfziffer. */
export function peselValid(value: string): boolean {
  const d = peselDigits(value);
  if (!/^\d{11}$/.test(d) || peselBirth(d) === null) return false;
  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
  return (10 - (sum % 10)) % 10 === Number(d[10]);
}

/** Ein Geburtsdatum aus einer Antwort — ein Datum (`YYYY-MM-DD`) oder ein PESEL. */
export function birthOf(value: string | undefined | null): string | null {
  const t = (value ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso !== null) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(iso[3]) ? null : t;
  }
  return peselValid(t) ? peselBirth(t) : null;
}

/** Volle Jahre am Tag `on` (`YYYY-MM-DD`, sonst heute) — oder `null`. */
export function ageOn(birth: string, on?: string | null): number | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (b === null) return null;
  const at = on != null && /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : localToday();
  const [y, m, d] = at.split('-').map(Number);
  let age = y - Number(b[1]);
  if (m < Number(b[2]) || (m === Number(b[2]) && d < Number(b[3]))) age -= 1;
  return age;
}

const localToday = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
