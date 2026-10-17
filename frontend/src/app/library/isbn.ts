/**
 * DIE ISBN — gelesen, geprüft, verglichen. Dieselbe Regel wie im Dienst
 * (`LibraryCatalog.Isbn13`): erst wenn die Prüfziffer stimmt, ist es eine.
 *
 * Ein Buch trägt auf dem Rücken einen EAN-13-Strichcode, der mit 978 oder 979
 * beginnt — das IST die ISBN, ohne Striche. Im Feld steht sie oft mit
 * Strichen („978-83-63110-45-1"), bei älteren Büchern zehnstellig
 * („83-7006-458-X"), manchmal zwei (broschiert, gebunden) durch ein Komma.
 * Verglichen wird immer die dreizehnstellige Form.
 */

const chars = (text: string): string => text.replace(/[^0-9Xx]/g, '').toUpperCase();

function check13(twelve: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(twelve[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

/** Die ISBN als 13 Ziffern — oder `null`, wenn es keine ist (falsche Länge, falsche Prüfziffer, kein 978/979). */
export function isbn13(text: string): string | null {
  const raw = chars(text);
  if (raw.length === 10) {
    let sum = 0;
    for (let i = 0; i < 10; i += 1) {
      const c = raw[i]!;
      if (c === 'X' && i !== 9) return null;
      sum += (c === 'X' ? 10 : Number(c)) * (10 - i);
    }
    if (sum % 11 !== 0) return null;
    const body = `978${raw.slice(0, 9)}`;
    return body + check13(body);
  }
  if (raw.length !== 13 || raw.includes('X') || !(raw.startsWith('978') || raw.startsWith('979'))) return null;
  return check13(raw.slice(0, 12)) === raw[12] ? raw : null;
}

/** Alle ISBN in einem Feld — „978-…-1, 978-…-8" sind zwei. */
export function isbnsIn(text: string): string[] {
  const whole = isbn13(text);
  if (whole !== null) return [whole];
  const out = text.split(/[,;/|]|\s{2,}|\s+(?=97[89])/).map((part) => isbn13(part)).filter((one): one is string => one !== null);
  return [...new Set(out)];
}

/** Was mit dem Feld nicht stimmt — `null`, wenn es leer oder richtig ist. */
export function isbnProblem(text: string): string | null {
  if (text.trim() === '') return null;
  if (isbnsIn(text).length > 0) return null;
  const n = chars(text).length;
  if (n !== 10 && n !== 13) return `ISBN ma 10 albo 13 znaków, a tu jest ${n}.`;
  return 'Cyfra kontrolna się nie zgadza — sprawdź numer.';
}

/** Lesbar gruppiert („978-836311045-1") — richtig trennen liesse sich nur mit den Tabellen der Verlage. */
export const isbnDisplay = (isbn: string): string => (isbn.length === 13 ? `${isbn.slice(0, 3)}-${isbn.slice(3, 12)}-${isbn[12]}` : isbn);
