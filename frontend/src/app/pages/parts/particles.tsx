/**
 * LABORATORIUM CZĄSTEK (2026-10-19) — ein Baustein mit der Partikel-Engine
 * (`lab/particles/`, documentation/particles/): eine Kiste voll Luft, in die
 * man Stoffe malt und Geräte stellt; was geschieht, folgt aus lokalen Regeln
 * und der Stoffdatenbank — nichts ist vorgespielt. Meilenstein M1a: die
 * Mechanik (Flüssigkeit und Gas nach PBF, Wände, Oberflächenspannung,
 * Auftrieb); Wärme und Sieden folgen.
 *
 * <b>Alle Kerne</b>: auf einer Seite rechnet das Labor mit einem Faden; ein
 * Knopf öffnet es mit dem, was gebaut wurde, in einer eigenen Karte
 * (`lab.html`), die „cross-origin isolated“ ist und mit allen Kernen rechnet.
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
import { openFullLab } from '../../lab/particles/fullLab';

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
const Lab = later(() => import('../../lab/particles/ParticleLab').then((m) => m.ParticleLab));
const presets = () => import('../../lab/particles/particlePresets').then((m) => m.PARTICLE_PRESETS);

function Preview({ title, text: body, scene }: { title: string; text: readonly string[]; mode: 'sandbox' | 'experiment'; scene: unknown }) {
  return <Lab config={{ title, text: body, scene }} />;
}

/** Eine leere Kiste voll Luft (für den Editor, solange nichts eingestellt ist). */
const SANDBOX = {
  format: 'recreatio/particles', version: 1, seed: 1, box: { w: 0.3, h: 0.2, depth: 0.01 },
  ambient: { p: 101.325, T: 20, g: 9.81 }, sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' }, quality: 'very-high', ops: []
};

const SCENE_DOCS: Readonly<Record<string, string>> = {
  '.format': 'Zawsze "recreatio/particles"',
  '.version': 'Wersja formatu (1)',
  '.seed': 'Ziarno losowości — ta sama liczba, ten sam przebieg',
  '.box': 'Wnętrze skrzynki w metrach i grubość warstwy 2D',
  '.box.w': 'Szerokość wnętrza (m), zwykle 0.3',
  '.box.h': 'Wysokość wnętrza (m), zwykle 0.2',
  '.box.depth': 'Grubość warstwy (m), zwykle 0.01 — z niej masy i energie',
  '.ambient': 'Otoczenie: ciśnienie, temperatura, grawitacja, skład powietrza',
  '.ambient.p': 'Ciśnienie w kPa (101.325 — poziom morza; niżej w górach)',
  '.ambient.T': 'Temperatura pokoju w °C',
  '.ambient.g': 'Przyspieszenie ziemskie w m/s² (0 — nieważkość)',
  '.ambient.air': 'Skład powietrza — udziały masowe, np. { "N2": 0.7676, "O2": 0.2324 }',
  '.ambient.air.N2': 'Udział masowy azotu w powietrzu',
  '.ambient.air.O2': 'Udział masowy tlenu w powietrzu',
  '.sides': 'Każdy bok skrzynki: "wall" (ścianka) albo "open" (otwarty na pokój)',
  '.sides.left': 'Lewy bok',
  '.sides.right': 'Prawy bok',
  '.sides.bottom': 'Dno skrzynki',
  '.sides.top': 'Góra (zwykle "open")',
  '.quality': 'Rozdzielczość: "very-high" (cząstki 2 mm, zwykła), "high" (2,5 mm), "medium" (3 mm, dla słabszego komputera); urządzenie, na którym ktoś wybrał niższą, zostaje przy swojej',
  '.ops': 'Kroki budowy po kolei — układ startowy, nie przebieg',
  '.ops[].op': '"fill" (ciecz/gaz), "erase" (usuń — wraca powietrze), "solid" (nieruchome ciało stałe), "beaker" (zlewka), "hotplate" (płyta grzejna)',
  '.ops[].region': 'Obszar: rect, circle, poly albo line z width',
  '.ops[].region.rect': '[x0, y0, x1, y1] w metrach',
  '.ops[].region.circle': '[x, y, promień]',
  '.ops[].region.poly': 'Wielokąt [[x, y], …]',
  '.ops[].region.line': 'Odcinek [x0, y0, x1, y1] (ściana)',
  '.ops[].region.width': 'Grubość odcinka (m)',
  '.ops[].composition': 'Skład (udziały masowe), np. { "H2O": 1 } albo powietrze { "N2": 0.7676, "O2": 0.2324 }',
  '.ops[].composition.H2O': 'Udział masowy wody (H₂O) — inne substancje z bazy tak samo: N2, O2',
  '.ops[].phase': '"liquid" (ciecz) albo "gas" (gaz)',
  '.ops[].T': 'Temperatura w °C',
  '.ops[].material': 'Materiał: "glass" (szkło), "steel" (stal), "ceramic" (kamyczki wrzenne)',
  '.ops[].x': 'Środek aparatury (m)',
  '.ops[].y': 'Dół aparatury (m) — 0 to dno skrzynki',
  '.ops[].w': 'Szerokość zewnętrzna (m)',
  '.ops[].h': 'Wysokość zewnętrzna (m)',
  '.ops[].wall': 'Grubość ścianki zlewki (m) — co najmniej dwie cząstki',
  '.ops[].mode': 'Płyta grzejna: "power" (stała moc) albo "thermostat" (temperatura)',
  '.ops[].power': 'Moc płyty w W na grubość warstwy',
  '.ops[].target': 'Temperatura termostatu w °C',
  '.ops[].on': 'false — płyta wyłączona'
};

const EXAMPLE_SCENE = {
  format: 'recreatio/particles', version: 1, seed: 7, box: { w: 0.3, h: 0.2, depth: 0.01 },
  ambient: { p: 101.325, T: 20, g: 9.81, air: { N2: 0.7676, O2: 0.2324 } },
  sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' }, quality: 'very-high',
  ops: [
    { op: 'hotplate', x: 0.15, y: 0, w: 0.16, h: 0.012, material: 'steel', mode: 'power', power: 50, target: 150, on: true, T: 20 },
    { op: 'beaker', x: 0.15, y: 0.012, w: 0.07, h: 0.09, wall: 0.0025, material: 'glass', T: 20 },
    { op: 'fill', region: { rect: [0.116, 0.017, 0.184, 0.067] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 },
    { op: 'solid', region: { circle: [0.15, 0.019, 0.004] }, material: 'ceramic', T: 20 },
    { op: 'erase', region: { poly: [[0.02, 0.15], [0.05, 0.15], [0.035, 0.18]] } },
    { op: 'solid', region: { line: [0.24, 0.02, 0.28, 0.06], width: 0.005 }, material: 'glass', T: 20 }
  ]
};

export const particlesPart = definePart<Config>({
  kind: 'particles',
  label: 'Laboratorium cząstek',
  use: 'Laboratorium cząstek 2D: skrzynka pełna powietrza, w którą maluje się wodę i stawia aparaturę (zlewka, płyta grzejna) — wszystko liczy silnik z lokalnych reguł i bazy substancji. Etap M1a: mechanika (ciecz i gaz, ścianki, napięcie powierzchniowe, wypór); ciepło i wrzenie w kolejnych etapach. Pełny ekran; przycisk „Wszystkie rdzenie” otwiera je w nowej karcie, liczące na wszystkich rdzeniach.',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [],
  read,
  hasContent: () => true,
  missing: () => null,
  shows: (c, size) => size.height === 'strip'
    ? `${c.title || 'Laboratorium cząstek'} — karta z przyciskiem: laboratorium otwiera się na całym ekranie.`
    : `„${c.title || 'Laboratorium cząstek'}” — skrzynka z cząstkami, narzędzia obok albo pod nią, przycisk pełnego ekranu.`,
  fullscreen: true,
  Editor: (props) => (
    <LabEditor {...props} presets={presets} sandbox={SANDBOX} what="laboratorium cząstek" Preview={Preview}
      prompt={() => import('../../lab/particles/particleText').then((m) => m.particlePrompt())} />
  ),
  View: ({ config, ctx }) => {
    if (ctx.size.height === 'strip' && ctx.whole !== true) {
      return (
        <div className="lab-card">
          <strong>{config.title || 'Laboratorium cząstek'}</strong>
          {config.text[0] !== undefined && <p className="wk-card-muted">{config.text[0]}</p>}
          {ctx.openWhole !== undefined && <button type="button" className="wk-btn" onClick={ctx.openWhole}>Otwórz laboratorium</button>}
        </div>
      );
    }
    const fullPower = (scene: () => Promise<Record<string, unknown> | null>): void =>
      openFullLab(async () => ({ title: config.title, text: config.text, scene: (await scene()) ?? config.scene }));
    return <Lab config={{ title: config.title, text: config.text, scene: config.scene }} whole={ctx.whole === true} fullPower={fullPower} />;
  },
  example: {
    title: 'Zlewka na płycie grzejnej',
    text: 'W zlewce jest woda, pod nią płyta grzejna.\nZbadaj cząstki wody, szkła i powietrza.',
    mode: 'sandbox',
    scene: JSON.stringify(EXAMPLE_SCENE)
  },
  extra: [
    { key: 'title', shape: 'line', says: 'Tytuł laboratorium (nad skrzynką)' },
    { key: 'text', shape: 'lines', says: 'Tekst dla uczniów — co mają zrobić i zaobserwować (akapity)' },
    { key: 'mode', shape: 'line', says: '"sandbox" — piaskownica (wszystkie narzędzia), "experiment" — zarezerwowane dla doświadczeń z krokami' },
    { key: 'scene', shape: 'json', says: 'Układ startowy: skrzynka, otoczenie, boki, ziarno i kroki budowy (wypełnij, usuń, ciało stałe, zlewka, płyta grzejna) — silnik jest wbudowany, scena mówi, co na początku gdzie stoi', inside: SCENE_DOCS }
  ]
});
