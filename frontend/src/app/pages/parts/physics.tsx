/**
 * LABORATORIUM FIZYKI (2026-10-18) — ein Baustein mit einem fest
 * eingebauten Motor für Physik in 2D (`lab/physics/`): Körper aus echten
 * Stoffen, Stösse, Reibung, Gelenke, Seile, Stangen, Federn, Rollen —
 * und Flüssigkeiten mit Druck, Auftrieb, Löchern und verbundenen Gefässen.
 *
 * <b>Der Motor ist Code, der Versuch ist gespeichert</b>: die Szene (`scene`,
 * JSON) sagt, was in der Welt steht, was man sieht, was man darf, ein Ziel
 * und die Schritte; gezogene Werte machen ihn jedes Mal etwas anders. Als
 * Piaskownica (`mode: "sandbox"`) darf man alles und lädt fertige Versuche;
 * als Doświadczenie zeigt er genau seine Szene, mit „Pokaż”.
 *
 * <b>Je Grösse</b>: im Streifen eine Karte mit Titel und Knopf (das Labor
 * öffnet sich im ganzen Fenster); als Block und hoch das Labor selbst, mit
 * eigenem Knopf für den ganzen Bildschirm.
 */

import { definePart, lines, text, type RawConfig } from '../part';
import { later } from '../../ui/later';
import { LabEditor } from '../../lab/LabEditor';
import type { PhysConfig } from '../../lab/physics/PhysicsLab';

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
  mode: text(raw, 'mode') === 'sandbox' ? 'sandbox' : 'experiment',
  scene: parse(raw.scene ?? ''),
  raw
});

/** Das Labor — erst geladen, wenn es gezeigt wird (eine öffentliche Seite lädt den Motor nicht mit). */
const Lab = later(() => import('../../lab/physics/PhysicsLab').then((m) => m.PhysicsLab));
/** Die fertigen Versuche (für den Editor). */
const presets = () => import('../../lab/physics/physPresets').then((m) => m.PHYS_PRESETS);

function Preview({ title, text: body, mode, scene }: { title: string; text: readonly string[]; mode: 'sandbox' | 'experiment'; scene: unknown }) {
  const config: PhysConfig = { title, text: body, mode, scene };
  return <Lab config={config} />;
}

/** Die Szene einer leeren Piaskownica (für den Editor, solange nichts eingestellt ist). */
const SANDBOX = { world: { gravity: 9.81, air: 1 }, bodies: [], show: { values: true } };

const SCENE_DOCS: Readonly<Record<string, string>> = {
  '.world': 'Świat: grawitacja, opór powietrza, grubość ciał, podłoże, tempo',
  '.world.gravity': 'Przyspieszenie ziemskie w m/s² (Ziemia 9.81, Księżyc 1.62, 0 — nieważkość)',
  '.world.air': 'Opór powietrza: 1 — zwykły, 0 — próżnia, więcej — gęstsze powietrze',
  '.world.depth': 'Grubość ciał w metrach (z niej, gęstości i pola — masa); zwykle 0.1',
  '.world.ground': 'false — bez podłoża (stół widziany z góry, przestrzeń)',
  '.world.speed': 'Tempo czasu na starcie (1 — jak w rzeczywistości)',
  '.vars': 'Wartości losowane przy każdym otwarciu (i przy „Nowe losowanie”) — używane w wyrażeniach "=…" i w tekstach "{nazwa}"',
  '.vars[].name': 'Nazwa wartości',
  '.vars[].from': 'Najmniej',
  '.vars[].to': 'Najwięcej',
  '.vars[].step': 'Krok (np. 5 — tylko wielokrotności)',
  '.vars[].pick': 'Zamiast liczby: lista tekstów do wylosowania (np. ciecze)',
  '.bodies': 'Ciała: kule, klocki, wielokąty — z materiału albo własnej gęstości',
  '.bodies[].id': 'Nazwa ciała (litery, cyfry, - _) — w połączeniach, celu i wykresie',
  '.bodies[].label': 'Podpis przy ciele',
  '.bodies[].shape': '"circle" (r), "box" (w, h) albo "poly" (points — wielokąt wypukły)',
  '.bodies[].x': 'Położenie środka (poly: początku jego punktów) w metrach',
  '.bodies[].y': 'Wysokość (podłoże to 0)',
  '.bodies[].r': 'Promień koła',
  '.bodies[].w': 'Szerokość klocka',
  '.bodies[].h': 'Wysokość klocka',
  '.bodies[].points': 'Punkty wielokąta [[x, y], …] względem x, y',
  '.bodies[].angle': 'Obrót w stopniach (przeciwnie do wskazówek zegara)',
  '.bodies[].material': 'Materiał: wood, oak, cork, steel, aluminium, lead, gold, rubber, ice, stone, plastic, glass, paper, foam, ball, egg',
  '.bodies[].density': 'Własna gęstość w kg/m³ (zamiast materiałowej)',
  '.bodies[].friction': 'Własne tarcie (0 — śliskie)',
  '.bodies[].bounce': 'Własna sprężystość odbić (0–1)',
  '.bodies[].static': 'true — nieruchome (rampa, ściana, stół)',
  '.bodies[].vx': 'Prędkość początkowa w poziomie (m/s)',
  '.bodies[].vy': 'Prędkość początkowa w pionie (m/s)',
  '.bodies[].spin': 'Obroty na starcie (rad/s)',
  '.bodies[].drag': 'false — nie da się go chwycić',
  '.bodies[].trace': 'true — rysuje ślad ruchu',
  '.bodies[].color': 'Własny kolor, np. "#e8823a"',
  '.joints': 'Połączenia: oś obrotu, pręt, lina, sprężyna, bloczek',
  '.joints[].type': '"pin" (oś w punkcie "at"), "motor" (oś z napędem), "rod", "rope", "spring", "pulley"',
  '.joints[].a': 'Pierwsze ciało (id)',
  '.joints[].b': 'Drugie ciało (id) — pominięte: przyczepione do świata',
  '.joints[].at': 'Punkt w świecie (gdy brak "b") albo na ciele "b"; przy bloczku — pierwsze koło',
  '.joints[].on': 'Punkt na ciele "a" względem jego środka (domyślnie środek)',
  '.joints[].onB': 'Bloczek: punkt na ciele "b"',
  '.joints[].at2': 'Bloczek: drugie koło',
  '.joints[].length': 'Długość (domyślnie: jak daleko są końce)',
  '.joints[].k': 'Sprężyna: sztywność w N/m',
  '.joints[].damping': 'Sprężyna: tłumienie',
  '.joints[].speed': 'Silnik: prędkość obrotu (rad/s)',
  '.joints[].torque': 'Silnik: największy moment siły (N·m)',
  '.fluids': 'Zbiorniki z cieczą (szklane ścianki)',
  '.fluids[].id': 'Nazwa zbiornika',
  '.fluids[].x': 'Lewy brzeg wnętrza',
  '.fluids[].y': 'Dno wnętrza (wysokość)',
  '.fluids[].w': 'Szerokość wnętrza',
  '.fluids[].h': 'Wysokość wnętrza',
  '.fluids[].wall': 'Grubość ścianek',
  '.fluids[].layers': 'Warstwy cieczy od dołu (lżejsza sama wypływa na wierzch)',
  '.fluids[].layers[].liquid': 'Ciecz: water, saltwater, sea, oil, alcohol, glycerin, honey, mercury, milk',
  '.fluids[].layers[].height': 'Wysokość warstwy w pustym zbiorniku (m)',
  '.fluids[].holes': 'Otwory w ściankach (strumień wg prawa Torricellego)',
  '.fluids[].holes[].side': '"left", "right" albo "bottom"',
  '.fluids[].holes[].at': 'Wysokość nad dnem (przy "bottom": odległość od lewej ścianki)',
  '.fluids[].holes[].size': 'Szerokość otworu (m)',
  '.fluids[].holes[].open': 'true — otwarty od początku',
  '.pipes': 'Rury łączące zbiorniki (naczynia połączone)',
  '.pipes[].a': 'Pierwszy zbiornik (id)',
  '.pipes[].b': 'Drugi zbiornik (id)',
  '.pipes[].y': 'Wysokość rury',
  '.pipes[].size': 'Średnica rury',
  '.pipes[].open': 'false — zawór zamknięty',
  '.show': 'Co widać: strzałki, ślady, siatka, ciśnienie, wartości',
  '.show.vectors': 'Strzałki: "v" (prędkość), "g" (ciężar), "lift" (wypór), "net" (wypadkowa)',
  '.show.trace': 'Ciała (id), które rysują ślad',
  '.show.grid': 'true — siatka co metr',
  '.show.pressure': 'true — ciśnienie w cieczy jako ciemniejsza barwa w głębi',
  '.show.values': 'false — bez podpisów mas i sił',
  '.graph': 'Wykres w czasie dla jednego ciała',
  '.graph.body': 'Ciało (id)',
  '.graph.of': 'Wielkości: "h", "x", "v", "vx", "vy", "ek", "ep", "e", "a"',
  '.allow': 'Co wolno uczniom',
  '.allow.add': 'false — bez dodawania ciał',
  '.allow.palette': 'Co można dodać: ball, box, plank, wedge, ramp, wall, pendulum, spring, pulley, seesaw, basin',
  '.allow.tools': 'Narzędzia: pin, rope, rod, link (sprężyna), ruler, probe (ciśnienie), delete',
  '.allow.edit': 'false — bez zmiany materiałów i ustawień ciał',
  '.allow.drag': 'false — ciał nie da się chwytać',
  '.controls': 'Przełączniki świata w panelu: "air" (powietrze), "gravity" (planeta)',
  '.goal': 'Cel: ciało w obszarze przez chwilę — wtedy pojawia się napis',
  '.goal.body': 'Ciało (id)',
  '.goal.area': 'Obszar [x0, y0, x1, y1] (liczby albo wyrażenia)',
  '.goal.for': 'Ile sekund ma tam zostać',
  '.goal.say': 'Co powiedzieć, gdy się uda',
  '.steps': 'Kroki doświadczenia — „Pokaż” wykonuje je po kolei',
  '.steps[].say': 'Co robić w tym kroku',
  '.steps[].do': '"play", "pause", { "open": zbiornik, "hole": 0 } albo { "push": ciało, "vx", "vy" }',
  '.steps[].do.open': 'Zbiornik, którego otwór otworzyć',
  '.steps[].do.hole': 'Który otwór (od 0)',
  '.steps[].do.push': 'Ciało do popchnięcia',
  '.steps[].do.vx': 'Nowa prędkość w poziomie',
  '.steps[].do.vy': 'Nowa prędkość w pionie',
  '.steps[].wait': 'Ile sekund trwa krok przy „Pokaż”',
  '.view': 'Co widać na starcie: [x0, y0, x1, y1]'
};

/* Das Beispiel: Schwimmen (aus den fertigen Versuchen — dieselben Dokumente). */
const EXAMPLE_SCENE = {
  world: { gravity: 9.81, air: 0.3 },
  fluids: [{ id: 'woda', x: 0.5, y: 0, w: 4, h: 1.6, layers: [{ liquid: 'water', height: 1 }], holes: [{ side: 'right', at: 0.2, size: 0.03, open: false }] }],
  bodies: [
    { id: 'korek', label: 'korek', shape: 'box', w: 0.4, h: 0.3, x: 1.2, y: 2.2, material: 'cork' },
    { id: 'lod', label: 'lód', shape: 'box', w: 0.4, h: 0.3, x: 2.4, y: 2.2, material: 'ice' },
    { id: 'stal', label: 'stal', shape: 'circle', r: 0.15, x: 3.6, y: 2.2, material: 'steel' }
  ],
  show: { vectors: ['g', 'lift'], values: true, pressure: true },
  allow: { add: false, tools: ['probe', 'ruler'] },
  view: [0, -0.3, 5.2, 2.8],
  steps: [{ say: 'Wrzuć klocki do wody.', do: 'play', wait: 4 }, { say: 'Otwórz otwór w ściance.', do: { open: 'woda', hole: 0 }, wait: 3 }]
};

export const physicsPart = definePart<Config>({
  kind: 'physics',
  label: 'Laboratorium fizyki',
  use: 'Laboratorium fizyki 2D: ciała z prawdziwych materiałów, równie, wahadła, sprężyny, bloczki, zderzenia, ciecze (ciśnienie, wypór, naczynia połączone, strumienie) — piaskownica albo gotowe doświadczenie szkolne; pełny ekran.',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [],
  read,
  hasContent: () => true,
  missing: () => null,
  shows: (c, size) => size.height === 'strip'
    ? `${c.title || 'Laboratorium fizyki'} — karta z przyciskiem: laboratorium otwiera się na całym ekranie.`
    : `${c.mode === 'sandbox' ? 'Piaskownica' : 'Doświadczenie'} „${c.title || 'Laboratorium fizyki'}” — scena, sterowanie obok albo pod nią, przycisk pełnego ekranu.`,
  fullscreen: true,
  Editor: (props) => (
    <LabEditor {...props} presets={presets} sandbox={SANDBOX} what="laboratorium fizyki" Preview={Preview}
      prompt={() => import('../../lab/physics/physText').then((m) => m.physPrompt())} />
  ),
  View: ({ config, ctx }) => {
    if (ctx.size.height === 'strip' && ctx.whole !== true) {
      return (
        <div className="lab-card">
          <strong>{config.title || 'Laboratorium fizyki'}</strong>
          {config.text[0] !== undefined && <p className="wk-card-muted">{config.text[0]}</p>}
          {ctx.openWhole !== undefined && <button type="button" className="wk-btn" onClick={ctx.openWhole}>Otwórz laboratorium</button>}
        </div>
      );
    }
    return <Lab config={{ title: config.title, text: config.text, mode: config.mode, scene: config.scene }} whole={ctx.whole === true} />;
  },
  example: {
    title: 'Pływanie ciał',
    text: 'Które ciała pływają, a które toną?\nUruchom i porównaj, jak głęboko zanurzają się korek i lód.',
    mode: 'experiment',
    scene: JSON.stringify(EXAMPLE_SCENE)
  },
  extra: [
    { key: 'title', shape: 'line', says: 'Tytuł doświadczenia (nad sceną)' },
    { key: 'text', shape: 'lines', says: 'Tekst dla uczniów — co mają zrobić i zaobserwować (akapity)' },
    { key: 'mode', shape: 'line', says: '"experiment" — dokładnie ta scena (z „Pokaż”), "sandbox" — piaskownica: wszystko wolno, gotowe doświadczenia do wczytania, zapis i eksport JSON' },
    { key: 'scene', shape: 'json', says: 'Scena: świat, ciała, połączenia, zbiorniki z cieczą, rury, co widać, co wolno, cel i kroki — silnik jest wbudowany, scena mówi, co w nim stoi', inside: SCENE_DOCS }
  ]
});

