/**
 * LABORATORIUM 2D (2026-10-20) — ein Baustein mit der Lab-Engine v2
 * (`lab/lab2d/`, documentation/lab2d/): eine Kiste voll Luft, in die man Wasser
 * malt und Zlewki und Heizplatten stellt; Wärme, Konvektion, Verdunsten,
 * Sieden, Kondensieren und Nebel folgen aus lokalen Gesetzen und der
 * Stoffdatenbank (Felder auf einem eulerschen Gitter, Wasser als
 * APIC-Teilchen, Blasen als Objekte) — nichts ist vorgespielt.
 *
 * <b>Die Engine ist Code, der Aufbau ist gespeichert</b>: `scene` (JSON) sagt,
 * was am Anfang wo steht — die Kiste, die Umgebung, die Seiten, der Samen und
 * die Handgriffe der Reihe nach.
 *
 * <b>Je Grösse</b>: im Streifen eine Karte mit Knopf (das Labor öffnet sich im
 * ganzen Fenster); als Block das Labor selbst, mit eigenem Vollbild-Knopf.
 */

import { definePart, lines, text, type RawConfig } from '../part';
import { later } from '../../ui/later';
import { LabEditor } from '../../lab/LabEditor';

interface Config {
  readonly title: string;
  readonly text: readonly string[];
  readonly mode: 'sandbox' | 'experiment';
  readonly scene: unknown;
  readonly raw: RawConfig;
}

const parse = (value: string): unknown => {
  try { return value.trim() === '' ? null : JSON.parse(value) as unknown; } catch { return null; }
};

const read = (raw: RawConfig): Config => ({
  title: text(raw, 'title'),
  text: lines(raw, 'text'),
  mode: text(raw, 'mode') === 'experiment' ? 'experiment' : 'sandbox',
  scene: parse(raw.scene ?? ''),
  raw
});

/** Das Labor — erst geladen, wenn es gezeigt wird (eine öffentliche Seite lädt die Engine nicht mit). */
const Lab = later(() => import('../../lab/lab2d/Lab2D').then((m) => m.Lab2D));
const presets = () => import('../../lab/lab2d/presets').then((m) => m.LAB2D_PRESETS);

function Preview({ title, text: body, scene }: { title: string; text: readonly string[]; mode: 'sandbox' | 'experiment'; scene: unknown }) {
  return <Lab config={{ title, text: body, scene }} />;
}

/** Eine leere Kiste voll Luft (für den Editor, solange nichts eingestellt ist). */
const SANDBOX = {
  format: 'recreatio/lab2d', version: 1, seed: 1, box: { w: 0.2, h: 0.15, depth: 0.01 },
  ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 }, sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' }, quality: 'high', ops: []
};

const SCENE_DOCS: Readonly<Record<string, string>> = {
  '.format': 'Zawsze "recreatio/lab2d"',
  '.version': 'Wersja formatu (1)',
  '.seed': 'Ziarno losowości — ta sama liczba, ten sam przebieg (np. wgłębienia ścianek, w których rodzą się pęcherze)',
  '.box': 'Wnętrze skrzynki w metrach i grubość warstwy 2D',
  '.box.w': 'Szerokość wnętrza (m), zwykle 0.2',
  '.box.h': 'Wysokość wnętrza (m), zwykle 0.15',
  '.box.depth': 'Grubość warstwy (m), zwykle 0.01 — z niej masy i energie',
  '.ambient': 'Otoczenie: ciśnienie, temperatura, wilgotność, grawitacja, skład powietrza',
  '.ambient.p': 'Ciśnienie w kPa (101.325 — poziom morza; 70 — wysoka góra; 200 — szybkowar)',
  '.ambient.T': 'Temperatura pokoju w °C',
  '.ambient.rh': 'Wilgotność względna powietrza, od 0 do 1',
  '.ambient.g': 'Przyspieszenie ziemskie w m/s², od 2.45 (1/4 g) do 19.6 (2 g)',
  '.ambient.air': 'Skład suchego powietrza — udziały masowe, np. { "N2": 0.7676, "O2": 0.2324 }',
  '.ambient.air.N2': 'Udział masowy azotu w powietrzu',
  '.ambient.air.O2': 'Udział masowy tlenu w powietrzu',
  '.sides': 'Każdy bok skrzynki: "wall" (ścianka) albo "open" (otwarty na pokój)',
  '.sides.left': 'Lewy bok',
  '.sides.right': 'Prawy bok',
  '.sides.bottom': 'Dno skrzynki',
  '.sides.top': 'Góra (zwykle "open")',
  '.quality': 'Wielkość komórki: "high" (2 mm, zwykła), "very-high" (1 mm, mocny komputer), "medium" (3 mm, słabszy komputer); urządzenie, na którym ktoś wybrał inną, zostaje przy swojej',
  '.ops': 'Kroki budowy po kolei — układ startowy, nie przebieg',
  '.ops[].op': '"fill" (woda albo powietrze), "erase" (usuń — wraca powietrze), "solid" (nieruchome ciało stałe), "beaker" (zlewka), "hotplate" (płyta grzejna)',
  '.ops[].region': 'Obszar: rect, circle, poly albo line z width',
  '.ops[].region.rect': '[x0, y0, x1, y1] w metrach',
  '.ops[].region.circle': '[x, y, promień]',
  '.ops[].region.poly': 'Wielokąt [[x, y], …]',
  '.ops[].region.line': 'Odcinek [x0, y0, x1, y1] (ścianka)',
  '.ops[].region.width': 'Grubość odcinka (m)',
  '.ops[].composition': 'Skład (udziały masowe): { "H2O": 1 } dla wody, { "N2": 0.7676, "O2": 0.2324 } dla powietrza',
  '.ops[].composition.H2O': 'Udział masowy wody (H₂O)',
  '.ops[].phase': '"liquid" (ciecz) albo "gas" (gaz)',
  '.ops[].T': 'Temperatura w °C',
  '.ops[].material': 'Materiał: "glass" (szkło borokrzemowe), "steel" (stal nierdzewna), "ceramic" (kamyczki wrzenne)',
  '.ops[].x': 'Środek aparatury (m)',
  '.ops[].y': 'Dół aparatury (m) — 0 to dno skrzynki',
  '.ops[].w': 'Szerokość zewnętrzna (m)',
  '.ops[].h': 'Wysokość zewnętrzna (m)',
  '.ops[].wall': 'Grubość ścianki zlewki (m) — co najmniej jedna komórka',
  '.ops[].lid': 'true — zlewka ze szczelną pokrywką (zamknięty obszar gazu)',
  '.ops[].mode': 'Płyta grzejna: "power" (stała moc) albo "thermostat" (temperatura płyty)',
  '.ops[].power': 'Moc płyty w W na grubość warstwy (w termostacie: moc największa)',
  '.ops[].target': 'Temperatura termostatu w °C',
  '.ops[].on': 'false — płyta wyłączona'
};

const EXAMPLE_SCENE = {
  format: 'recreatio/lab2d', version: 1, seed: 7, box: { w: 0.2, h: 0.15, depth: 0.01 },
  ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81, air: { N2: 0.7676, O2: 0.2324 } },
  sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' }, quality: 'high',
  ops: [
    { op: 'hotplate', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power: 40, target: 150, on: true, T: 20 },
    { op: 'beaker', x: 0.1, y: 0.008, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T: 20, lid: false },
    { op: 'fill', region: { rect: [0.067, 0.010, 0.133, 0.06] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 },
    { op: 'solid', region: { circle: [0.1, 0.011, 0.002] }, material: 'ceramic', T: 20 },
    { op: 'erase', region: { poly: [[0.02, 0.12], [0.05, 0.12], [0.035, 0.14]] } },
    { op: 'solid', region: { line: [0.17, 0.02, 0.19, 0.05], width: 0.004 }, material: 'glass', T: 20 }
  ]
};

export const lab2dPart = definePart<Config>({
  kind: 'lab2d',
  label: 'Laboratorium 2D',
  use: 'Laboratorium 2D (silnik v2): skrzynka pełna powietrza, w której stawia się zlewki i płyty grzejne i maluje wodę — ciepło, konwekcja, parowanie, wrzenie z pęcherzami, skraplanie i mgła wynikają z praw fizyki i bazy materiałów. Narzędzia: badanie punktu, widok pęcherza z siłami, nakładki (temperatura, ciśnienie, wilgotność, para), wykresy, dwa poziomy. Pełny ekran.',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [],
  read,
  hasContent: () => true,
  missing: () => null,
  shows: (c, size) => size.height === 'strip'
    ? `${c.title || 'Laboratorium 2D'} — karta z przyciskiem: laboratorium otwiera się na całym ekranie.`
    : `„${c.title || 'Laboratorium 2D'}” — skrzynka z wodą i aparaturą, narzędzia obok albo pod nią, przycisk pełnego ekranu.`,
  fullscreen: true,
  Editor: (props) => (
    <LabEditor {...props} presets={presets} sandbox={SANDBOX} what="laboratorium 2D" Preview={Preview}
      prompt={() => import('../../lab/lab2d/text').then((m) => m.lab2dPrompt())} />
  ),
  View: ({ config, ctx }) => {
    if (ctx.size.height === 'strip' && ctx.whole !== true) {
      return (
        <div className="lab-card">
          <strong>{config.title || 'Laboratorium 2D'}</strong>
          {config.text[0] !== undefined && <p className="wk-card-muted">{config.text[0]}</p>}
          {ctx.openWhole !== undefined && <button type="button" className="wk-btn" onClick={ctx.openWhole}>Otwórz laboratorium</button>}
        </div>
      );
    }
    return <Lab config={{ title: config.title, text: config.text, scene: config.scene }} whole={ctx.whole === true} />;
  },
  example: {
    title: 'Zlewka na płycie grzejnej',
    text: 'W zlewce jest woda, pod nią płyta grzejna.\nObserwuj pęcherze przy dnie i wykres temperatury.',
    mode: 'sandbox',
    scene: JSON.stringify(EXAMPLE_SCENE)
  },
  extra: [
    { key: 'title', shape: 'line', says: 'Tytuł laboratorium (nad skrzynką)' },
    { key: 'text', shape: 'lines', says: 'Tekst dla uczniów — co mają zrobić i zaobserwować (akapity)' },
    { key: 'mode', shape: 'line', says: '"sandbox" — piaskownica (wszystkie narzędzia), "experiment" — zarezerwowane dla doświadczeń z krokami' },
    { key: 'scene', shape: 'json', says: 'Układ startowy: skrzynka, otoczenie, boki, ziarno i kroki budowy (woda, powietrze, ciało stałe, zlewka, płyta grzejna, usuń) — silnik jest wbudowany, scena mówi, co na początku gdzie stoi', inside: SCENE_DOCS }
  ]
});
