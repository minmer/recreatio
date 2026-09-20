/**
 * Eine Nachricht, die an einen Menschen geht — mit seinen Angaben darin.
 *
 * <b>Die Kanzlei schreibt sie EINMAL</b>, mit Platzhaltern, und der Browser
 * setzt je Mensch ein, was dort steht:
 *
 * <code>
 *   Cześć {Imię i nazwisko}! Twoja strona: {link}
 *   → Cześć Anna Kowalska! Twoja strona: https://recreatio.pl/#/…
 * </code>
 *
 * <b>Der Platzhalter ist die FRAGE, nicht eine Nummer.</b> `{2}` wäre kürzer zu
 * tippen und bräche, sobald jemand eine Frage einfügt oder verschiebt; der
 * Beschriftungstext bleibt derselbe, auch wenn das Feld an eine andere Stelle
 * rutscht. Gross- und Kleinschreibung zählt nicht — abgetippt wird selten
 * genau.
 *
 * <b>Was nicht aufgeht, bleibt stehen.</b> Ein Platzhalter ohne Antwort wird
 * NICHT zu einer leeren Stelle: dann ginge eine Nachricht hinaus, in der ein
 * Satz fehlt, und niemand sähe es. Er bleibt sichtbar, und daneben steht, was
 * fehlt — <see cref="missingIn"/>.
 *
 * <b>Warum hier und nicht in der Ansicht.</b> Es ist reine Zeichenarbeit: Text
 * und Angaben hinein, Text heraus. So lässt es sich prüfen, ohne einen Browser
 * zu starten.
 */

/** Der eine Platzhalter, der kein Feld ist. */
export const LINK = 'link';

/** Was zwischen geschweiften Klammern steht — ohne Zeilenumbrüche darin. */
const HOLE = /\{([^{}\n]+)\}/g;

const key = (text: string): string => text.trim().toLowerCase();

/**
 * Die Nachricht für EINEN Menschen.
 *
 * `values` ist nach Beschriftung geschlüsselt, nicht nach Kennung: so steht im
 * Text dasselbe Wort wie im Formular.
 */
export function renderSms(
  template: string,
  values: ReadonlyMap<string, string>,
  link: string | null
): string {
  const byLabel = new Map<string, string>();
  for (const [label, value] of values) byLabel.set(key(label), value);

  return template.replace(HOLE, (whole, name: string) => {
    if (key(name) === LINK) return link ?? whole;

    const found = byLabel.get(key(name));
    return found === undefined || found.trim() === '' ? whole : found;
  });
}

/**
 * Welche Platzhalter leer blieben.
 *
 * Damit die Kanzlei es SIEHT, bevor sie kopiert — und nicht, nachdem sie
 * verschickt hat.
 */
export function missingIn(
  template: string,
  values: ReadonlyMap<string, string>,
  link: string | null
): readonly string[] {
  const byLabel = new Map<string, string>();
  for (const [label, value] of values) byLabel.set(key(label), value);

  const out: string[] = [];

  for (const match of template.matchAll(HOLE)) {
    const name = match[1];

    if (key(name) === LINK) {
      if (link === null && !out.includes(name)) out.push(name);
      continue;
    }

    const found = byLabel.get(key(name));
    if ((found === undefined || found.trim() === '') && !out.includes(name)) out.push(name);
  }

  return out;
}

/**
 * Die Platzhalter, die es in diesem Formular überhaupt gibt — für den Hinweis
 * unter dem Feld. Ohne ihn müsste jemand raten, wie eine Frage genau heisst.
 */
export const holesFor = (labels: readonly (string | null)[]): readonly string[] =>
  [LINK, ...labels.filter((l): l is string => l !== null && l.trim() !== '')];

/** Der Platzhalter, hinter dem der Bestätigungslink steckt (0030). */
export const VERIFY = 'weryfikacja';

/**
 * Benutzt diese Vorlage einen bestimmten Platzhalter?
 *
 * <b>Wofür es gebraucht wird.</b> Einen Bestätigungslink scharfzustellen
 * verbraucht einen: der neue setzt den vorigen ausser Kraft. Wer ihn würfelt,
 * ohne dass die Vorlage ihn überhaupt einsetzt, macht den zuletzt
 * verschickten ungültig und schickt dafür nichts.
 */
export const usesHole = (template: string, name: string): boolean => {
  for (const match of template.matchAll(HOLE)) {
    if (key(match[1]) === key(name)) return true;
  }
  return false;
};

/**
 * Der Verweis, der das Nachrichtenfenster mit fertigem Text öffnet.
 *
 * <b>Zwei Trennzeichen, und sie sind nicht austauschbar.</b> Android liest
 * `sms:<nummer>?body=…`, die Geräte von Apple `sms:<nummer>&body=…`. Wer nur
 * eines kennt, öffnet der anderen Hälfte ein LEERES Fenster — und das sieht
 * nicht nach einem Fehler aus, sondern danach, als sei die Nachricht
 * verlorengegangen. Der Altbestand hatte dieselbe Fallunterscheidung.
 */
export function smsHref(number: string, body: string): string {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const apple = /iPhone|iPad|iPod|Macintosh/.test(agent);

  return `sms:${number}${apple ? '&' : '?'}body=${encodeURIComponent(body)}`;
}
