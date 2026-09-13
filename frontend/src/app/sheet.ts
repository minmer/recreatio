/**
 * Intencje mszalne — der A4-Bogen für den Schaukasten.
 *
 * <b>Die Vorlage ist fremd und absichtlich unangetastet.</b> Dieser Bogen hängt
 * seit Jahren im Kasten, und die Leute lesen ihn mit einem Blick, der seine
 * Form kennt: der Tag in Grossbuchstaben, die Uhrzeit in der Spalte links, die
 * Intention daneben. Die Anordnung zu ändern ist keine Verbesserung — es
 * zwingt ein paar hundert Menschen, einen Zettel neu zu lernen, den sie können.
 *
 * <b>Nummeriert wird erst ab zwei.</b> Bei einer Intention ordnet „1)" nichts,
 * es fügt nur ein Zeichen hinzu. So steht es auf der Vorlage, und so bleibt es.
 *
 * <b>Der Text geht wörtlich hinaus.</b> Das Kreuz beim Verstorbenen, „(1 rocz.
 * śm.)", „w intencji od klasy VII b" — das schreibt die Kanzlei, und nur sie
 * weiss, was es heisst. Regeln daraus zu erraten endete mit einem Bogen, der
 * den Menschen dort verbessert, wo er recht hatte.
 *
 * <b>Woher die Daten.</b> Aus dem ÖFFENTLICHEN Plan — also genau das, was
 * ohnehin laut vorgelesen wird. Geber und Gabe haben hier keinen Zutritt; der
 * Bogen geht an die Wand.
 *
 * <b>Zusammengelegte kommen auf eine eigene Seite.</b> Auf der ersten steht nur
 * ein Verweis; die volle Liste folgt, nummeriert, mit leerem Platz darunter.
 * Dieser leere Platz ist kein Versehen: zusammengelegte Intentionen werden die
 * ganze Woche über von Hand nachgetragen, bis zur Messe. Ein Blatt, das mit der
 * letzten gedruckten Zeile endet, zwingt dazu, nach jedem Anruf neu zu drucken.
 *
 * <b>Ein Unterschied zum Altbestand, und nur einer:</b> dort filterte der Bogen
 * abgesagte Messen heraus (`status !== 'cancelled'`). Hier gibt es diesen Stand
 * nicht — eine Messe steht im Plan oder steht nicht darin. Der Filter fiele
 * also auf ein Feld, das es nicht gibt, und ein Filter, der nie greift, sieht
 * aus wie einer, der greift.
 */

import { byDay, hour, massesOnly, type PublicMass } from './mass';

const WEEKDAYS = [
  'niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'
];

/** Genitiv — „31 sierpnia", nicht „31 sierpień". */
const MONTHS = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
];

/**
 * Der Zeitraum wie in der Überschrift: „31 sierpnia – 6 września 2026 roku".
 *
 * Das Jahr fällt einmal, am Ende. Der Monat beim ersten Datum nur dann, wenn er
 * ein anderer ist als beim zweiten — „1 – 6 września" liest sich besser als
 * „1 września – 6 września", und genau so steht es auf der Vorlage.
 */
export function sheetRange(from: Date, to: Date): string {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '';

  const sameMonth = from.getFullYear() === to.getFullYear()
    && from.getMonth() === to.getMonth();

  const sameYear = from.getFullYear() === to.getFullYear();

  const left = sameMonth
    ? `${from.getDate()}`
    : `${from.getDate()} ${MONTHS[from.getMonth()]}${sameYear ? '' : ` ${from.getFullYear()}`}`;

  return `${left} – ${to.getDate()} ${MONTHS[to.getMonth()]} ${to.getFullYear()} roku`;
}

/** Der Name des Wochentags, wie auf der Vorlage. */
export function sheetDay(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : WEEKDAYS[at.getDay()];
}

/** Zeichen, die in HTML etwas anderes heissen als in einem Namen. */
function esc(raw: string): string {
  return raw
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

/** Nummerierte Liste „1)", „2)" — dieselbe auf beiden Seiten. */
function numbered(texts: readonly string[]): string {
  return `<ol class="many">${texts.map((text) => `<li>${esc(text)}</li>`).join('')}</ol>`;
}

const single = (mass: PublicMass) => mass.intentions.filter((i) => i.kind !== 'collective');
const collective = (mass: PublicMass) => mass.intentions.filter((i) => i.kind === 'collective');

/**
 * Wie eine zusammengelegte Messe auf dem Blatt heisst.
 *
 * Nimmt den Namen, den die Pfarrei eingetragen hat („Msza św. nowennowa"), denn
 * sie weiss, wie es bei ihr heisst. Ohne Namen bleibt das neutrale „Intencje
 * zbiorowe" — zu raten, jede zusammengelegte sei eine Novene, hiesse, eine
 * fremde Messe nicht bei ihrem Namen zu nennen.
 */
const collectiveName = (mass: PublicMass) =>
  (mass.title ?? '').trim() === '' ? 'Intencje zbiorowe' : (mass.title ?? '').trim();

/**
 * Die Intentionen einer Messe — auf der ERSTEN Seite.
 *
 * Eine steht ohne Nummer, mehrere bekommen „1)", „2)". Eine Messe ohne
 * Intention verschwindet nicht: die Uhrzeit bleibt, denn die Messe findet statt.
 */
function intentionsOf(mass: PublicMass): string {
  const ones = single(mass).map((i) => i.text);
  const many = collective(mass);

  const pointer = many.length === 0
    ? ''
    : `<div class="pointer">${esc(collectiveName(mass))}</div>`;

  if (ones.length === 0) return pointer;
  if (ones.length === 1) return `<div class="one">${esc(ones[0])}</div>${pointer}`;

  return `${numbered(ones)}${pointer}`;
}

/**
 * Die zweite Seite: die vollen Listen der zusammengelegten Intentionen.
 *
 * Jede zusammengelegte Messe bekommt eine eigene Seite — nicht aus
 * Verschwendung, sondern weil unter der Liste Platz für Nachträge bleiben muss.
 * So sieht dieses Blatt in der Kanzlei aus: vier gedruckte Zeilen und eine
 * fünfte mit Kugelschreiber.
 */
function collectiveSheets(masses: readonly PublicMass[]): string {
  return masses
    .filter((mass) => collective(mass).length > 0)
    .map((mass) => `
      <div class="sheet collective">
        <h1>${esc(collectiveName(mass))}</h1>
        <p class="range">${esc(sheetDay(mass.startsAt))}, ${esc(hour(mass.startsAt))}</p>
        ${numbered(collective(mass).map((i) => i.text))}
      </div>`)
    .join('');
}

/**
 * Den Bogen setzen.
 *
 * Getrennt vom Öffnen des Fensters, weil sich dieser Teil prüfen lässt — und
 * einen Druck mit zwölf Messen sieht sich niemand zwölfmal an.
 */
export function intentionsSheetHtml(
  masses: readonly PublicMass[], from: Date, to: Date
): string {
  const onlyMasses = massesOnly(masses);

  const days = byDay(onlyMasses).map((group) => {
    const rows = group.masses.map((mass) => `
        <div class="mass">
          <div class="hour">${esc(hour(mass.startsAt))}</div>
          <div class="what">${intentionsOf(mass)}</div>
        </div>`).join('');

    return `
      <section class="day">
        <h2>${esc(sheetDay(group.masses[0].startsAt))}</h2>
        ${rows}
      </section>`;
  }).join('');

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Intencje mszalne</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #f3f4f7;
    color: #111;
    /*
      Mit Serifen — ein Bogen im Schaukasten wird aus einem Meter Entfernung
      gelesen, und Serifen führen das Auge an der Zeile entlang. Die Vorlage
      hat sie auch.
    */
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    line-height: 1.4;
  }

  .note {
    max-width: 210mm;
    margin: 16px auto;
    padding: 10px 14px;
    border: 1px solid #d6dae2;
    border-radius: 10px;
    background: #fff;
    font-family: system-ui, sans-serif;
    font-size: 0.9rem;
  }
  .note p { margin: 0; }

  .sheet {
    width: 210mm;
    min-height: 297mm;
    margin: 14px auto;
    padding: 18mm 20mm;
    background: #fff;
    border: 1px solid #cfd5df;
  }

  h1 {
    margin: 0;
    font-size: 1.9rem;
    font-variant: small-caps;
    letter-spacing: 0.06em;
    text-align: center;
    font-weight: 700;
  }

  .range {
    margin: 0.2rem 0 1.4rem;
    font-size: 1.02rem;
    font-style: italic;
    text-align: center;
  }

  /* Eine Linie über jedem Tag — so trennt sie die Vorlage. */
  .day { border-top: 1px solid #111; padding-top: 0.35rem; margin-bottom: 0.7rem; }

  .day h2 {
    margin: 0 0 0.25rem;
    font-size: 0.92rem;
    font-variant: small-caps;
    letter-spacing: 0.08em;
    font-weight: 700;
  }

  /*
    Die Uhrzeit in einer schmalen Spalte, rechtsbündig; der Inhalt daneben. So
    bricht eine lange Intention mit Einzug unter sich selbst um und nicht unter
    die Uhrzeit — das Auge kehrt immer zu derselben senkrechten Linie zurück.
  */
  .mass {
    display: grid;
    grid-template-columns: 4.2rem minmax(0, 1fr);
    gap: 0 0.9rem;
    margin-bottom: 0.18rem;
  }

  .hour { text-align: right; font-variant-numeric: tabular-nums; }

  .one { margin: 0; }

  /* „1)" und „2)" — schliessende Klammer, wie auf der Vorlage. */
  .many { margin: 0; padding: 0; list-style: none; counter-reset: intencja; }
  .many li {
    counter-increment: intencja;
    padding-left: 1.5rem;
    text-indent: -1.5rem;
  }
  .many li::before { content: counter(intencja) ") "; }

  /*
    Der Verweis auf die zweite Seite — in Kapitälchen, wie auf der Vorlage. Es
    ist keine Intention, sondern der Hinweis, wo sie stehen, also ohne Nummer.
  */
  .pointer {
    font-variant: small-caps;
    letter-spacing: 0.04em;
  }

  /* Jede zusammengelegte Messe beginnt eine neue Seite — darunter bleibt Platz. */
  .collective { page-break-before: always; break-before: page; }

  .collective h1 {
    font-size: 1.25rem;
    text-align: left;
    letter-spacing: 0.04em;
  }

  .collective .range { text-align: left; margin-bottom: 0.9rem; }

  /*
    Die zusammengelegte Liste steht lockerer als der Tagesplan: sie wird von
    Hand ergänzt, und zwischen die Zeilen muss eine Handschrift passen.
  */
  .collective .many li { margin-bottom: 0.35rem; }

  @page { size: A4 portrait; margin: 16mm; }

  @media print {
    html, body { background: #fff; }
    .note { display: none; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; border: none; }

    /* Ein Tag zerreisst nicht zwischen zwei Seiten. */
    .day { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="note">
  <p>Arkusz A4. Nazwa niedzieli w roku liturgicznym nie jest jeszcze
  prowadzona w systemie — dopisz ją ręcznie, jeśli ma być na kartce.</p>
</div>

<div class="sheet">
  <h1>Intencje mszalne</h1>
  <p class="range">${esc(sheetRange(from, to))}</p>
  ${days}
</div>

${collectiveSheets(onlyMasses)}

<script>window.addEventListener('load', function () { window.print(); });</script>
</body>
</html>`;
}

/**
 * Den Druck öffnen.
 *
 * Gibt `false`, wenn der Browser kein Fenster gab — das ist keine Ausnahme,
 * sondern eine Sperre gegen Aufklappfenster, und die Seite soll es sagen statt
 * zu schweigen.
 */
export function printIntentions(
  masses: readonly PublicMass[], from: Date, to: Date
): boolean {
  const opened = globalThis.open('about:blank', '_blank');
  if (opened === null) return false;

  opened.document.open();
  opened.document.write(intentionsSheetHtml(masses, from, to));
  opened.document.close();
  return true;
}

/**
 * Der Montag der Woche, in der dieses Datum liegt — und der Sonntag an ihrem
 * Ende.
 *
 * Der Bogen geht von Montag bis Sonntag, denn so liegt die Woche in der
 * Pfarrei: der Sonntag ist ihr Gipfel, nicht ihr Anfang.
 */
export function sheetWeek(around: Date): { readonly from: string; readonly to: string } {
  const start = new Date(around);
  const day = start.getDay();

  // getDay(): der Sonntag ist 0. Also sechs Tage zurück, nicht einen vor.
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));

  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const key = (at: Date) =>
    `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`
    + `-${String(at.getDate()).padStart(2, '0')}`;

  return { from: key(start), to: key(end) };
}
