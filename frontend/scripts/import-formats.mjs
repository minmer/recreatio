/**
 * 2026-10-28 — DIE FORMATE DER JSON-IMPORTE FÜR DEN MCP-SERVER (`backend/Api/Library/ImportFormats.json`).
 *
 * Ein Assistent, der Recreatio über MCP liest (AiMcp.cs), schreibt oft genau das, was danach importiert werden
 * soll: Einträge einer Bibliothek, ein Werk mit vollem Text, eine Baza wiedzy, eine Seite. Den Import macht der
 * Mensch in der App, mit Vorschau — der Dienst schreibt nichts. Damit der Assistent das Format nicht raten muss,
 * gibt `get_import_format` dieselben Beschreibungen heraus, die neben jedem Import stehen, erzeugt aus der App
 * selbst; dazu die Leitfäden für die KI und die fertigen Schemata (`templates/cogita/`).
 *
 * Nur, was ohne einen bestimmten Ort gilt. Was von einem Formular, einem Werk oder einem Text abhängt (die Liste
 * eines Formulars, der Text eines bestimmten Werks, Plan und Wygłoszenie eines Textes), steht unter `contextual`:
 * dort sagt die App die Beschreibung selbst, mit dem, was sie an der Stelle weiss.
 *
 *   node scripts/import-formats.mjs          schreibt die Datei neu
 *   node scripts/import-formats.mjs --check  sagt nur, ob sie stimmt (Exit 1, wenn nicht)
 */

import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const OUT = '../backend/Api/Library/ImportFormats.json';
const TEMPLATES = '../templates/cogita/';

/** Die Beschreibungen, wie die App sie neben ihre Importe stellt. */
async function appTexts() {
  const out = await mkdtemp(join(tmpdir(), 'import-formats-'));
  try {
    const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
    const entry = join(out, 'entry.ts');
    await writeFile(entry, [
      `export { libraryDescription } from '${app}library/libraryJson';`,
      `export { workWithTextPrompt } from '${app}library/sourceImport';`,
      `export { sourceTextDescription } from '${app}library/sourceText';`,
      `export { courseDescription, formDescription } from '${app}cogita/json';`,
      `export { scriptoriumDescription } from '${app}scriptorium/scriptoriumJson';`,
      `export { pageDescription } from '${app}pages/pageJsonText';`,
      `export { areaDescription } from '${app}areas/areaJsonText';`,
      `export { describe } from '${app}core/jsonTree';`,
      `export { SCHEME_JSON, PLAN_JSON } from '${app}calendar/schemeJson';`,
      `export { registryDescription } from '${app}registry/postalJson';`
    ].join('\n'));
    await build({
      entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error', jsx: 'automatic',
      loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
    });
    globalThis.BroadcastChannel = undefined;
    const m = await import(pathToFileURL(join(out, 'entry.js')).href);
    return {
      library: m.libraryDescription(),
      workWithText: m.workWithTextPrompt(),
      sourceText: m.sourceTextDescription(),
      knowledge: m.courseDescription(),
      forms: m.formDescription(),
      scriptorium: m.scriptoriumDescription(),
      page: m.pageDescription(),
      area: m.areaDescription(),
      scheme: m.describe(m.SCHEME_JSON),
      plan: m.describe(m.PLAN_JSON),
      registry: m.registryDescription()
    };
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

/**
 * IN TEILEN — die Seite allein sind über 250 000 Zeichen, und ein Werkzeug soll nicht mehr als ein paar tausend
 * Wörter auf einmal liefern. Geteilt wird an Überschriften (`#`…), ein zu grosser Abschnitt an Leerzeilen; das
 * Inhaltsverzeichnis (Überschriften bis `####`, die Arten der Module eingeschlossen) sagt, in welchem Teil was steht.
 */
export const PART_LIMIT = 24000;

const NL = '\n';

export function partsOf(text) {
  const lines = text.split('\r\n').join(NL).split(NL);
  const sections = [];
  let current = [];
  for (const line of lines) {
    if (/^#{1,4} /.test(line) && current.length > 0) { sections.push(current.join(NL)); current = []; }
    current.push(line);
  }
  if (current.length > 0) sections.push(current.join(NL));
  /*
   * Ein Abschnitt, der allein zu gross ist, an Leerzeilen — und ein Block ohne Leerzeile (die Animacja: über
   * 100 000 Zeichen Schlüssel) an Zeilen; jedes Stück danach sagt, wessen Fortsetzung es ist.
   */
  const byLines = (block, heading) => {
    const out = [];
    let chunk = '';
    for (const line of block.split(NL)) {
      const next = chunk === '' ? line : chunk + NL + line;
      if (next.length > PART_LIMIT && chunk !== '') { out.push(chunk); chunk = (heading === '' ? '' : `(ciąg dalszy: ${heading})${NL}`) + line; } else chunk = next;
    }
    if (chunk !== '') out.push(chunk);
    return out;
  };
  const pieces = [];
  for (const section of sections) {
    if (section.length <= PART_LIMIT) { pieces.push(section); continue; }
    const first = section.split(NL, 1)[0];
    const heading = /^#{1,4} /.test(first) ? first.replace(/^#+ /, '') : '';
    let chunk = '';
    for (const block of section.split(NL + NL).flatMap((one) => (one.length > PART_LIMIT ? byLines(one, heading) : [one]))) {
      const next = chunk === '' ? block : chunk + NL + NL + block;
      if (next.length > PART_LIMIT && chunk !== '') { pieces.push(chunk); chunk = block; } else chunk = next;
    }
    if (chunk !== '') pieces.push(chunk);
  }
  const parts = [];
  let part = '';
  for (const piece of pieces) {
    const next = part === '' ? piece : part + NL + NL + piece;
    if (next.length > PART_LIMIT && part !== '') { parts.push(part); part = piece; } else part = next;
  }
  if (part !== '') parts.push(part);
  const contents = [];
  parts.forEach((one, i) => {
    for (const line of one.split(NL)) {
      const m = /^(#{1,4}) (.+)$/.exec(line);
      if (m !== null) contents.push({ level: m[1].length, title: m[2].trim(), part: i + 1 });
    }
  });
  return { parts: parts.map((one) => one.trimEnd()), contents: parts.length > 1 ? contents : [] };
}

const IMPORT_NOTE = 'Import robi człowiek w aplikacji: wkleja albo wczytuje JSON, widzi listę zmian (z ostrzeżeniami) i dopiero wtedy zatwierdza. Niczego nie zapisuje się stąd.';

/** Die ganze Liste — in der Reihenfolge, in der sie der Assistent sieht. */
export async function formats() {
  const t = await appTexts();
  const file = async (name) => (await readFile(`${TEMPLATES}${name}`, 'utf8')).replace(/\r\n/g, '\n');
  const schemeOf = async (name) => {
    const text = await file(name);
    const doc = JSON.parse(text);
    return { name: doc.name ?? name, text };
  };
  const list = [
    { id: 'library', group: 'Biblioteka', title: 'Biblioteka — wpisy (źródła, cytaty, osoby, muzyka)', what: 'Dzieła, cytaty, osoby, utwory i ich odwołania; nowe wpisy i zmiany istniejących.', where: 'Biblioteka → biblioteka → zakładka „Import / eksport” → „JSON biblioteki — eksport i import” (#/workspace/library/<id>/json); także pod każdą zakładką listy i przy każdym wpisie („Import / eksport JSON”).', text: t.library },
    { id: 'work-with-text', group: 'Biblioteka', title: 'Dzieło z pełnym tekstem', what: 'Nowe dzieło (książka, artykuł, rozdział) z autorami i CAŁYM tekstem podzielonym na części, z granicami stron. To polecenie aplikacja daje do skopiowania dla AI.', where: 'Biblioteka → biblioteka → zakładka „Źródła” → „Dzieło z tekstem (JSON)” → „Dzieło z pełnym tekstem — import JSON”.', text: t.workWithText },
    { id: 'source-text', group: 'Biblioteka', title: 'Tekst źródła — do istniejącego dzieła', what: 'Pełny tekst (albo kolejne części) dzieła, które już jest w Bibliotece: części, bloki, miejsca, strony, przypisy.', where: 'Biblioteka → biblioteka → „Źródła” → dzieło → ramka „Tekst źródła” → „Dodaj tekst (JSON)” albo „Dodaj lub zmień części (JSON)”. Aplikacja dopisuje tam klucz dzieła i jego sposób liczenia miejsc.', text: t.sourceText },
    { id: 'knowledge-base', group: 'Cogita', title: 'Baza wiedzy (Cogita) — rodzaje, wpisy, pytania, powtórki', what: 'Cała baza wiedzy albo jej część: rodzaje wpisów (schemat), wpisy, pytania, szablony kart, powtórki, ścieżki, widoki, ustawienia.', where: 'Wiedza → baza wiedzy → „Więcej” → „Import i eksport (JSON)” (#/workspace/knowledge/<id>/json); sam schemat także w „Schematy → Rodzaje wpisów → Schemat jako JSON”.', text: t.knowledge },
    { id: 'knowledge-forms', group: 'Cogita', title: 'Formularze dodawania (Cogita)', what: 'Sposoby dodawania wpisów do bazy wiedzy: pola, wiersze, wartości wybierane raz dla wielu wierszy.', where: 'Wiedza → baza wiedzy → „Schematy” → „Sposoby dodawania” → „Formularz” → „Z JSON (wklej)…”, albo formularz → „Formularz jako JSON”.', text: t.forms },
    { id: 'scriptorium', group: 'Skryptorium', title: 'Skryptorium — własne teksty, wygłoszenia, projekty', what: 'Teksty (np. kazania z planem), ich wygłoszenia, projekty i rodzaje tekstów.', where: 'Skryptorium → skryptorium → zakładka „Import / eksport” → „JSON skryptorium — eksport i import” (#/workspace/scriptorium/<id>/json); także przy każdym wpisie.', text: t.scriptorium },
    { id: 'page', group: 'Strony', title: 'Strona (JSON strony)', what: 'Strona publiczna albo z dostępem: moduły w siatce, slajdy albo prezentacja, menu, wygląd, logika.', where: 'Strony → strona → „Edytuj” → „JSON strony — eksport i import” (#/workspace/pages/<ścieżka>).', text: t.page },
    { id: 'area', group: 'Obszary', title: 'Obszar z rodzajem (wydarzenie, grupa, parafia, kurs, szkoła, klasa)', what: 'Wizytówka i narzędzia obszaru danego rodzaju, razem ze stronami.', where: 'Obszary → obszar → zakładka jego rodzaju („Wydarzenie”, „Grupa”, „Parafia / organizacja”, „Kurs”, „Szkoła”, „Klasa”) → „Import i eksport (JSON dla AI)” (#/workspace/areas/<id>/profil).', text: t.area },
    { id: 'calendar-scheme', group: 'Kalendarz', title: 'Schemat terminów kalendarza', what: 'Pola, które mają terminy danego rodzaju (np. msza: intencja, celebrans), z regułami.', where: 'Kalendarz → „Kalendarze” → „Ustawienia” kalendarza → „Schematy terminów” → schemat → „JSON schematu — eksport i import”.', text: t.scheme },
    { id: 'calendar-plan', group: 'Kalendarz', title: 'Plan kalendarza', what: 'Plan, który rozkłada terminy (np. tygodniowy porządek mszy) z przepływem reguł.', where: 'Kalendarz → „Kalendarze” → „Ustawienia” kalendarza → „Plany” → plan → „JSON planu — eksport i import”.', text: t.plan },
    { id: 'registry', group: 'Parafia', title: 'Kartoteka (adresy, domy, kolęda)', what: 'Adresy i miejsca kartoteki obszaru (dane domów są zapieczętowane w przeglądarce).', where: 'Kartoteka i kolęda → „Kartoteka obszaru” → zakładka „Import i JSON” → „Kartoteka jako JSON”.', text: t.registry },
    { id: 'guide-book', group: 'Przewodniki dla AI', title: 'Przewodnik: książka → Biblioteka i baza wiedzy', what: 'Jak z książki albo artykułu zrobić dzieło z pełnym tekstem, a potem bazę wiedzy z pytaniami (z gotowym schematem). Z dodatkami wygenerowanymi z aplikacji.', where: 'Plik templates/cogita/ksiazka-AI.md; importy jak w „work-with-text” i „knowledge-base”.', text: await file('ksiazka-AI.md') },
    { id: 'guide-argument', group: 'Przewodniki dla AI', title: 'Przewodnik: rekonstrukcja wywodu dzieła (Wywód)', what: 'Jak odtworzyć tok argumentacji dzieła krok po kroku, z odwołaniami do miejsc w tekście.', where: 'Plik templates/cogita/wywod-AI.md; import jako „knowledge-base” do bazy ze schematem „scheme-wywod”.', text: await file('wywod-AI.md') }
  ];
  for (const [id, name] of [['scheme-fakty', 'fakty.json'], ['scheme-zbior', 'zbior.json'], ['scheme-wywod', 'wywod.json'], ['scheme-podstawy', 'podstawy.json'], ['scheme-pytania', 'pytania.json'], ['example-atom', 'przyklad-atom.json']]) {
    const s = await schemeOf(name);
    list.push({
      id, group: id.startsWith('example') ? 'Przykłady' : 'Gotowe schematy baz wiedzy',
      title: `${id.startsWith('example') ? 'Przykład kursu' : 'Schemat'}: ${s.name}`,
      what: id.startsWith('example') ? 'Mała, kompletna baza wiedzy (rodzaje, wpisy, pytania, powtórka) — wzór dokumentu w formacie „knowledge-base”.' : 'Gotowy schemat (rodzaje wpisów, szablony kart, sposoby dodawania, widoki) do zaimportowania w bazie wiedzy, zanim doda się wpisy.',
      where: `Plik templates/cogita/${name}; import w Wiedza → baza wiedzy → „Więcej” → „Import i eksport (JSON)”.`,
      text: s.text,
      /* Ein Dokument zum Importieren bleibt ganz — in Teilen liesse es sich nicht einfügen. */
      whole: true
    });
  }
  const contextual = [
    { title: 'JSON listy (zgłoszenia formularza)', where: 'Formularze → formularz → zakładka „Zgłoszenia” → „JSON listy — eksport i import”.', why: 'Opis zależy od pytań i rozszerzeń danego formularza — aplikacja pokazuje go przy nim.' },
    { title: 'Tekst konkretnego dzieła', where: 'Biblioteka → dzieło → „Tekst źródła” → „Dodaj tekst (JSON)”.', why: 'Polecenie zawiera klucz i sposób liczenia miejsc tego dzieła; ogólny format to „source-text”.' },
    { title: 'Plan tekstu i wygłoszenie (Skryptorium)', where: 'Skryptorium → tekst → „Plan z treści — przez AI we własnym czacie”; wygłoszenie → „Z nagrania albo zapisu — przez AI we własnym czacie”.', why: 'Polecenie zawiera treść tego tekstu.' },
    { title: 'Moduł strony', where: 'Strony → strona → moduł → „JSON tego modułu”; Moduły → „JSON modułu”.', why: 'Format każdego rodzaju modułu jest częścią „page”.' }
  ];
  const formats = list.map(({ text, whole, ...rest }) => ({ ...rest, size: text.length, ...(whole === true ? { parts: [text.trimEnd()], contents: [] } : partsOf(text)) }));
  return { about: `Formaty JSON importów Recreatio, wygenerowane z aplikacji (frontend/scripts/import-formats.mjs). ${IMPORT_NOTE}`, formats, contextual };
}

export const render = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const next = render(await formats());
  let had = '';
  try { had = (await readFile(OUT, 'utf8')).replace(/\r\n/g, '\n'); } catch { had = ''; }
  if (process.argv.includes('--check')) {
    console.log(next === had ? 'Formaty importu dla MCP stimmen.' : 'ImportFormats.json weicht von der App ab — node scripts/import-formats.mjs');
    process.exit(next === had ? 0 : 1);
  }
  await writeFile(OUT, next);
  const sizes = JSON.parse(next).formats.map((f) => `${f.id} ${Math.round(f.size / 1024)}k/${f.parts.length}`).join(', ');
  console.log(`${next === had ? 'War schon aktuell' : 'Neu geschrieben'}: ${OUT} — ${sizes}`);
}
