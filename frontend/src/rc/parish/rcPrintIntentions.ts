/**
 * Intencje mszalne — arkusz A4 do gabloty.
 *
 * <b>Wzór jest cudzy i celowo nietknięty.</b> Ten arkusz wisi w gablocie od
 * lat i ludzie czytają go wzrokiem, który zna jego kształt: dzień wielkimi
 * literami, godzina w kolumnie po lewej, intencja obok. Zmiana układu nie jest
 * ulepszeniem — to zmuszenie kilkuset osób do ponownego uczenia się kartki,
 * którą umieją.
 *
 * <b>Numeruje się dopiero od dwóch.</b> Przy jednej intencji „1)" niczego nie
 * porządkuje, tylko dodaje znak. Tak jest na wzorze i tak zostaje.
 *
 * <b>Tekst idzie dosłownie.</b> Krzyżyk przy zmarłym, „(1 rocz. śm.)",
 * „w intencji od klasy VII b" — to wszystko wpisuje kancelaria i tylko ona wie,
 * co znaczy. Domyślanie się reguł z tego tekstu skończyłoby się arkuszem, który
 * poprawia człowieka tam, gdzie miał rację.
 *
 * <b>Skąd dane.</b> Z planu publicznego — czyli dokładnie to, co i tak jest
 * czytane na głos. Ofiarodawca i ofiara nie mają tu wstępu; arkusz idzie na
 * ścianę.
 *
 * <b>Zbiorowe idą na osobną stronę.</b> Przy mszy zbiorowej na pierwszej
 * stronie stoi tylko odesłanie — pełna lista jest dalej, numerowana, z pustym
 * miejscem pod spodem. To puste miejsce nie jest niedopatrzeniem: intencje
 * zbiorowe dopisuje się ręcznie przez cały tydzień, aż do samej mszy. Kartka,
 * która kończy się na ostatniej wydrukowanej pozycji, zmusza do drukowania jej
 * od nowa po każdym telefonie.
 *
 * Wciśnięcie ich w plan dnia dałoby jeden dzień na pół strony, a resztę
 * tygodnia zepchnęłoby poza kartkę.
 */

import { rcByDay, rcDayKey, rcHour, rcMassesOnly, type RcPublicMass } from './rcMass';

const WEEKDAYS = [
  'niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'
];

/** Dopełniacz — „31 sierpnia", nie „31 sierpień". */
const MONTHS = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
];

/**
 * Zakres jak w nagłówku: „31 sierpnia – 6 września 2026 roku".
 *
 * Rok pada raz, na końcu. Miesiąc przy pierwszej dacie tylko wtedy, gdy jest
 * inny niż przy drugiej — „1 – 6 września" czyta się lepiej niż „1 września –
 * 6 września", a właśnie tak stoi na wzorze.
 */
export function rcSheetRange(from: Date, to: Date): string {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '';

  const sameMonth = from.getFullYear() === to.getFullYear()
    && from.getMonth() === to.getMonth();

  const sameYear = from.getFullYear() === to.getFullYear();

  const left = sameMonth
    ? `${from.getDate()}`
    : `${from.getDate()} ${MONTHS[from.getMonth()]}${sameYear ? '' : ` ${from.getFullYear()}`}`;

  return `${left} – ${to.getDate()} ${MONTHS[to.getMonth()]} ${to.getFullYear()} roku`;
}

/** Nazwa dnia tygodnia, wielkimi literami jak na wzorze. */
export function rcSheetDay(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : WEEKDAYS[at.getDay()];
}

/** Znaki, które w HTML znaczą co innego niż w nazwisku. */
function esc(raw: string): string {
  return raw
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

/** Numerowana lista „1)", „2)" — ta sama na obu stronach. */
function numbered(texts: readonly string[]): string {
  return `<ol class="many">${
    texts.map((text) => `<li>${esc(text)}</li>`).join('')
  }</ol>`;
}

const single = (mass: RcPublicMass) =>
  (mass.intentions ?? []).filter((i) => i.kind !== 'collective');

const collective = (mass: RcPublicMass) =>
  (mass.intentions ?? []).filter((i) => i.kind === 'collective');

/**
 * Jak nazwać mszę zbiorową na kartce.
 *
 * Bierze nazwę wpisaną przez parafię („Msza św. nowennowa"), bo to ona wie, jak
 * u niej się to nazywa. Bez nazwy zostaje neutralne „Intencje zbiorowe" —
 * zgadywanie, że każda zbiorowa jest nowenną, byłoby nazwaniem cudzej mszy nie
 * jej imieniem.
 */
const collectiveName = (mass: RcPublicMass) =>
  (mass.title ?? '').trim() === '' ? 'Intencje zbiorowe' : (mass.title ?? '').trim();

/**
 * Intencje jednej mszy — na PIERWSZEJ stronie.
 *
 * Jedna stoi bez numeru, kilka dostaje „1)", „2)" — dokładnie jak na wzorze.
 * Msza bez intencji nie znika: godzina zostaje, bo msza się odbędzie.
 *
 * Zbiorowe nie wchodzą tu w całości, tylko jako odesłanie. Pełna lista rośnie
 * przez cały tydzień i rozsadziłaby plan dnia.
 */
function intentionsOf(mass: RcPublicMass): string {
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
 * Druga strona: pełne listy intencji zbiorowych.
 *
 * Każda msza zbiorowa dostaje własną stronę — nie z rozrzutności, tylko dlatego,
 * że pod listą musi zostać miejsce na dopiski. Tak wygląda ta kartka w
 * kancelarii: wydrukowane cztery pozycje i piąta dopisana długopisem.
 */
function collectiveSheets(masses: readonly RcPublicMass[]): string {
  return masses
    .filter((mass) => collective(mass).length > 0)
    .map((mass) => `
      <div class="sheet collective">
        <h1>${esc(collectiveName(mass))}</h1>
        <p class="range">${esc(rcSheetDay(mass.startsUtc))}, ${esc(rcHour(mass.startsUtc))}</p>
        ${numbered(collective(mass).map((i) => i.text))}
      </div>`)
    .join('');
}

/**
 * Złożyć arkusz.
 *
 * Osobno od otwierania okna, bo to ta część daje się sprawdzić — a wydruku o
 * dwunastu mszach nikt nie ogląda dwanaście razy.
 */
export function rcIntentionsSheetHtml(
  masses: readonly RcPublicMass[], from: Date, to: Date
): string {
  const days = rcByDay(rcMassesOnly(masses).filter((m) => m.status !== 'cancelled'))
    .map((group) => {
      const rows = group.masses.map((mass) => `
        <div class="mass">
          <div class="hour">${esc(rcHour(mass.startsUtc))}</div>
          <div class="what">${intentionsOf(mass)}</div>
        </div>`).join('');

      return `
      <section class="day">
        <h2>${esc(rcSheetDay(group.masses[0].startsUtc))}</h2>
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
      Szeryfowy — arkusz w gablocie czyta się z odległości metra, a szeryfy
      prowadzą wzrok wzdłuż linii. Wzór też jest szeryfowy.
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

  /* Linia nad każdym dniem — tak dzieli je wzór. */
  .day { border-top: 1px solid #111; padding-top: 0.35rem; margin-bottom: 0.7rem; }

  .day h2 {
    margin: 0 0 0.25rem;
    font-size: 0.92rem;
    font-variant: small-caps;
    letter-spacing: 0.08em;
    font-weight: 700;
  }

  /*
    Godzina w wąskiej kolumnie, wyrównana do prawej; treść obok. Dzięki temu
    długa intencja łamie się z wcięciem pod samą sobą, a nie pod godziną —
    oko wraca zawsze do tej samej pionowej linii.
  */
  .mass {
    display: grid;
    grid-template-columns: 4.2rem minmax(0, 1fr);
    gap: 0 0.9rem;
    margin-bottom: 0.18rem;
  }

  .hour { text-align: right; font-variant-numeric: tabular-nums; }

  .one { margin: 0; }

  /* „1)" i „2)" — nawias zamykający, jak na wzorze. */
  .many { margin: 0; padding: 0; list-style: none; counter-reset: intencja; }
  .many li {
    counter-increment: intencja;
    padding-left: 1.5rem;
    text-indent: -1.5rem;
  }
  .many li::before { content: counter(intencja) ") "; }

  /*
    Odesłanie do drugiej strony — kapitalikami, jak na wzorze. Nie jest to
    intencja, tylko wskazanie, gdzie ich szukać, więc nie ma numeru.
  */
  .pointer {
    font-variant: small-caps;
    letter-spacing: 0.04em;
  }

  /* Każda msza zbiorowa zaczyna nową stronę — pod listą ma zostać miejsce. */
  .collective { page-break-before: always; break-before: page; }

  .collective h1 {
    font-size: 1.25rem;
    text-align: left;
    letter-spacing: 0.04em;
  }

  .collective .range { text-align: left; margin-bottom: 0.9rem; }

  /*
    Lista zbiorowa jest luźniejsza od planu dnia: dopisuje się do niej ręcznie,
    a między wierszami musi zmieścić się pismo odręczne.
  */
  .collective .many li { margin-bottom: 0.35rem; }

  @page { size: A4 portrait; margin: 16mm; }

  @media print {
    html, body { background: #fff; }
    .note { display: none; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; border: none; }

    /* Dzień nie rozrywa się między stronami. */
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
  <p class="range">${esc(rcSheetRange(from, to))}</p>
  ${days}
</div>

${collectiveSheets(rcMassesOnly(masses).filter((m) => m.status !== 'cancelled'))}

<script>window.addEventListener('load', function () { window.print(); });</script>
</body>
</html>`;
}

/**
 * Otworzyć wydruk.
 *
 * Zwraca `false`, gdy przeglądarka nie dała okna — to nie wyjątek, tylko
 * blokada wyskakujących okien, i strona ma o niej powiedzieć zamiast milczeć.
 */
export function rcPrintIntentions(
  masses: readonly RcPublicMass[], from: Date, to: Date
): boolean {
  const opened = window.open('about:blank', '_blank');
  if (opened === null) return false;

  opened.document.open();
  opened.document.write(rcIntentionsSheetHtml(masses, from, to));
  opened.document.close();
  return true;
}

/**
 * Poniedziałek tygodnia, w którym leży ta data — i niedziela na jego końcu.
 *
 * Arkusz idzie od poniedziałku do niedzieli, bo tak układa się tydzień w
 * parafii: niedziela jest jego szczytem, nie początkiem.
 */
export function rcSheetWeek(around: Date): { readonly from: string; readonly to: string } {
  const start = new Date(around);
  const day = start.getDay();

  // getDay(): niedziela to 0. Cofnięcie o 6 dni, a nie o -1.
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));

  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return { from: rcDayKey(start.toISOString()), to: rcDayKey(end.toISOString()) };
}
