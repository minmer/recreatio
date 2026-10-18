/**
 * LABORATORIUM CHEMICZNE (2026-10-18) — ein Baustein mit einer fest
 * eingebauten Piaskownica für Chemie in 2D (`lab/chem/`): der Labortisch als
 * Gitter aus 4-mm-Zellen, in jeder Temperatur, Lösung (mit echtem pH,
 * Löslichkeit, Niederschlägen) oder Schmelze, Feststoffe, Gase. Wärme
 * wandert, Metalle schmelzen und erstarren, Wasser kocht, Gase steigen oder
 * sinken, Flammen entstehen, wo Brennstoff und Sauerstoff zusammenkommen.
 *
 * <b>Der Motor ist Code, der Versuch ist gespeichert</b>: die Szene (`scene`,
 * JSON) sagt nur, was wo steht (Glas, Brenner, Dreifuss, Kerze, Thermometer,
 * Stäbe …) und was darin ist, was im Regal und unter den Werkzeugen liegt,
 * was man sieht, den Schreiber und die Schritte (mit „Pokaż”, Fragen vorab,
 * `before`/`warm` für Folien). Als Piaskownica (`mode: "sandbox"`) darf man alles.
 *
 * <b>Je Grösse</b>: im Streifen eine Karte mit Titel und Knopf (das Labor
 * öffnet sich im ganzen Fenster); als Block und hoch das Labor selbst.
 */

import { definePart, lines, text, type RawConfig } from '../part';
import { later } from '../../ui/later';
import { LabEditor } from '../../lab/LabEditor';
import type { ChemConfig } from '../../lab/chem/ChemLab';

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
const Lab = later(() => import('../../lab/chem/ChemLab').then((m) => m.ChemLab));
/** Die fertigen Versuche (für den Editor). */
const presets = () => import('../../lab/chem/chemPresets').then((m) => m.CHEM_PRESETS);

function Preview({ title, text: body, mode, scene }: { title: string; text: readonly string[]; mode: 'sandbox' | 'experiment'; scene: unknown }) {
  const config: ChemConfig = { title, text: body, mode, scene };
  return <Lab config={config} />;
}

/** Die Szene einer leeren Piaskownica (für den Editor, solange nichts eingestellt ist). */
const SANDBOX = {
  things: [{ id: 'palnik', kind: 'burner', x: 14 }, { id: 'trojnog', kind: 'tripod', x: 14 }, { id: 'zlewka', kind: 'beaker', size: 250, x: -10, fill: [{ reagent: 'water', amount: 150 }] }, { id: 'p1', kind: 'tube', size: 25, x: 0 }],
  allow: { things: true }
};

const ACTIONS = '{ "add", "to", "amount" } (albo "at": [x, y]), { "pour", "to", "ml" }, { "move", "to": [x, y] } (albo "on", "into"), { "burner", "on", "air", "gas" }, { "heat", "on", "power", "stir" }, { "ignite" }, { "use", "at" }, { "flame" }, { "tap", "rate" }, { "tilt", "angle" }, { "speed" }';

const SCENE_DOCS: Readonly<Record<string, string>> = {
  '.room': 'Pracownia: temperatura (°C) i ciśnienie (kPa)',
  '.room.T': 'Temperatura pracowni w °C (zwykle 20)',
  '.room.p': 'Ciśnienie powietrza w kPa (zwykle 101,3)',
  '.world': 'Wielkość stołu (zwykle niepotrzebna — wynika z rzeczy na nim)',
  '.world.width': 'Szerokość w cm',
  '.world.height': 'Wysokość przestrzeni nad stołem w cm',
  '.world.depth': 'Głębokość warstwy powietrza w cm (zwykle 3)',
  '.vars': 'Wartości losowane przy każdym otwarciu (i przy „Nowe losowanie”) — w wyrażeniach "=…" i w tekstach "{nazwa}"',
  '.vars[].name': 'Nazwa wartości',
  '.vars[].from': 'Najmniej',
  '.vars[].to': 'Najwięcej',
  '.vars[].step': 'Krok',
  '.vars[].pick': 'Zamiast liczby: lista tekstów do wylosowania (np. identyfikatory odczynników)',
  '.things': 'Rzeczy na stole: naczynia, palniki, trójnogi, statywy, płyty grzejne, świece, termometry, pręty, kawałki substancji — każda w swoim miejscu; silnik robi resztę',
  '.things[].id': 'Nazwa rzeczy (litery, cyfry, - _) — w krokach, „on”, „in” i na wykresie',
  '.things[].kind': 'Rodzaj: beaker, flask, roundflask, tube, cylinder, dish, crucible, jar, burette, trough (naczynia); burner, hotplate, tripod, stand, candle, thermometer, rod, piece, splint, loop, spoon, stopper, plate',
  '.things[].x': 'Położenie środka w cm',
  '.things[].y': 'Wysokość dołu rzeczy w cm (bez — stoi na tym, co pod spodem; stół na y = 0)',
  '.things[].on': 'Rzecz (id), na której stoi: trójnóg, statyw z pierścieniem albo płyta grzejna',
  '.things[].in': 'Naczynie (id), w którym stoi: kawałek, termometr, pręt, probówka (np. zamknięta probówka w łaźni wodnej — woda podnosi się wokół niej)',
  '.things[].size': 'Pojemność naczynia w cm³; długość pręta, termometru, łuczywa w cm; wysokość świecy w cm; masa kawałka w g',
  '.things[].of': 'Z czego: pręt ("Cu", "Al", "Fe", "glass", "steel", "wood"), kawałek (substancja, np. "Sn", "Pb", "Field", "Na", "ice")',
  '.things[].angle': 'Obrót w stopniach (180 — odwrócone do góry dnem)',
  '.things[].label': 'Podpis pod naczyniem',
  '.things[].hidden': 'true — zawartość ukryta (zagadka: „roztwór X”)',
  '.things[].held': 'true — trzymane w powietrzu (nie spada): odwrócona probówka, łuczywo, termometr',
  '.things[].fill': 'Co jest w naczyniu na starcie (po kolei; leży już na dnie)',
  '.things[].fill[].reagent': 'Odczynnik (identyfikator z półki, np. "water", "HCl", "Sn", "phenolphthalein") albo "{nazwa}" wylosowana',
  '.things[].fill[].amount': 'Ilość: g (ciała stałe), cm³ (roztwory, ciecze, gazy z butli), krople (wskaźniki)',
  '.things[].T': 'Temperatura zawartości w °C na starcie',
  '.things[].gas': 'Naczynie: gaz zamiast powietrza — udziały mieszaniny, np. { "CO2": 1 } albo { "NO2": 0.4, "N2": 0.48, "O2": 0.12 } (wymieszana i już w równowadze, np. 2NO₂ ⇄ N₂O₄); palnik: dopływ gazu 0–1',
  '.things[].closed': 'true — naczynie zamknięte korkiem (wyskoczy przy ok. 40 kPa nadciśnienia)',
  '.things[].lit': 'true — palnik zapalony, płyta grzejna włączona, świeca płonie',
  '.things[].air': 'Palnik: dopływ powietrza 0–1 (0 — płomień świecący, żółty; 1 — nieświecący, niebieski)',
  '.things[].power': 'Płyta grzejna: moc w W',
  '.things[].stir': 'Płyta grzejna: true — mieszadło magnetyczne włączone (ciągle miesza ciecz w naczyniu, które na niej stoi; płyta nie musi przy tym grzać)',
  '.things[].height': 'Trójnóg, statyw: wysokość siatki w cm',
  '.things[].content': 'Zapisany stan zawartości (z eksportu piaskownicy)',
  '.shelf': 'Odczynniki na półce: identyfikatory albo grupy (metale, kwasy, zasady, sole, tlenki, wskazniki, gazy, inne) — bez tego wszystkie',
  '.tools': 'Narzędzia: match (zapałka), splint (płonące łuczywo), glow (żarzące się łuczywo), loop (drucik), stir (bagietka), stopper (korek), paper (papierek wskaźnikowy), thermometer, probe (sonda temperatury), empty, delete',
  '.allow': 'Co wolno uczniom',
  '.allow.shelf': 'false — bez półki z odczynnikami',
  '.allow.things': 'true — można dodawać sprzęt (naczynia, palniki, pręty …)',
  '.allow.move': 'false — rzeczy nie da się przesuwać ani przelewać',
  '.show': 'Co widać',
  '.show.values': 'false — bez temperatury, pH i ciśnienia pod naczyniami',
  '.show.composition': 'false — bez składu gazu i roztworu (zagadki)',
  '.show.micro': 'false — bez lupy z cząsteczkami',
  '.show.equations': 'false — obserwacje bez równań reakcji',
  '.show.heat': 'true — widok ciepła od początku (kolory pokazują temperaturę)',
  '.graph': 'Wykres w czasie',
  '.graph.things': 'Termometry albo naczynia (id)',
  '.graph.thing': 'Jedna rzecz (id) — zamiast listy',
  '.graph.of': 'Wielkości: "T" (temperatura), "pH", "p" (ciśnienie gazu w naczyniu)',
  '.before': `Akcje wykonane już przy budowie stołu (bez animacji) — tak slajd zaczyna się tam, gdzie skończył poprzedni: ${ACTIONS}`,
  '.warm': 'Ile sekund już upłynęło po "before" (silnik przewija czas przed startem)',
  '.steps': 'Kroki doświadczenia — „Pokaż” wykonuje je po kolei',
  '.steps[].say': 'Polecenie dla ucznia',
  '.steps[].do': `Akcja albo lista akcji: ${ACTIONS}`,
  '.steps[].do.add': 'Dodaj odczynnik (identyfikator)',
  '.steps[].do.to': 'Do której rzeczy',
  '.steps[].do.amount': 'Ile (g, cm³ albo krople)',
  '.steps[].do.pour': 'Przelej z tego naczynia (ciecz albo ciężki gaz) — naczynie przechyla się nad drugim',
  '.steps[].do.ml': 'Ile cm³ przelać',
  '.steps[].do.move': 'Przenieś rzecz (id)',
  '.steps[].do.burner': 'Palnik do zapalenia albo zgaszenia',
  '.steps[].do.on': 'true — zapal / włącz',
  '.steps[].do.heat': 'Płyta grzejna do włączenia albo wyłączenia',
  '.steps[].do.power': 'Płyta grzejna: moc w W',
  '.steps[].do.stir': 'Płyta grzejna: true — włącz mieszadło magnetyczne, false — wyłącz',
  '.steps[].do.use': 'Narzędzie (jak w "tools") użyte przy rzeczy',
  '.steps[].do.at': 'Przy której rzeczy',
  '.steps[].do.tap': 'Biureta, której kranik otworzyć',
  '.steps[].do.rate': 'Szybkość kapania w cm³/s (0 — zamknij)',
  '.steps[].do.speed': 'Tempo czasu (1 — jak naprawdę, 10 — dziesięć razy szybciej; do 300 — przyspieszenie dla rozpuszczania i dyfuzji)',
  '.steps[].ask': 'Pytanie przed krokiem (przewidywanie) — krok czeka na odpowiedź',
  '.steps[].ask.q': 'Treść pytania',
  '.steps[].ask.options': 'Odpowiedzi do wyboru',
  '.steps[].ask.answer': 'Dobra odpowiedź: jej tekst albo "=nazwa" (numer z wartości losowanej); bez — tylko opinia',
  '.steps[].ask.why': 'Wyjaśnienie po odpowiedzi',
  '.steps[].wait': 'Ile sekund (czasu doświadczenia, do 600) trwa krok przy „Pokaż”',
  '.speed': 'Tempo czasu na starcie (do 300)',
  '.view': 'Co widać na starcie: [x0, y0, x1, y1] w cm (stół na y = 0)'
};

/* Das Beispiel: Zinn schmilzt im Tiegel über dem Brenner (wie unter den fertigen Versuchen). */
const EXAMPLE_SCENE = {
  things: [
    { id: 'palnik', kind: 'burner', x: 0, air: 1, gas: 0.8 },
    { id: 'trojnog', kind: 'tripod', x: 0 },
    { id: 'tygiel', kind: 'crucible', size: 30, on: 'trojnog', label: 'cyna', fill: [{ reagent: 'Sn', amount: 20 }] },
    { id: 'termometr', kind: 'thermometer', in: 'tygiel' }
  ],
  shelf: ['Sn', 'Pb', 'Field'],
  tools: ['match', 'probe'],
  graph: { things: ['termometr'], of: ['T'] },
  speed: 5,
  steps: [{
    say: 'Zapal palnik pod tyglem.',
    ask: { q: 'Co stanie się z temperaturą, kiedy cyna zacznie się topić?', options: ['będzie dalej rosła', 'zatrzyma się, aż cała cyna się stopi'], answer: 'zatrzyma się, aż cała cyna się stopi', why: 'Ciepło idzie na topnienie — temperatura stoi na 232 °C, aż cała cyna stanie się ciekła.' },
    do: { burner: 'palnik', on: true },
    wait: 45
  }]
};

export const chemistryPart = definePart<Config>({
  kind: 'chemistry',
  label: 'Laboratorium chemiczne',
  use: 'Laboratorium chemiczne 2D jako prawdziwa piaskownica: rzeczy stoją tam, gdzie je postawisz, a silnik liczy resztę — ciepło przepływa (przewodzenie, konwekcja, płomień), metale się topią i krzepną, woda wrze, gazy unoszą się albo opadają, roztwory mieszają się i reagują (pH, osady, metale z wodą i kwasami), płomień tam, gdzie gaz palny spotyka tlen; widok ciepła, lupa z cząsteczkami; piaskownica albo doświadczenie (ograniczona piaskownica z krokami); pełny ekran.',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [],
  read,
  hasContent: () => true,
  missing: () => null,
  shows: (c, size) => size.height === 'strip'
    ? `${c.title || 'Laboratorium chemiczne'} — karta z przyciskiem: laboratorium otwiera się na całym ekranie.`
    : `${c.mode === 'sandbox' ? 'Piaskownica' : 'Doświadczenie'} „${c.title || 'Laboratorium chemiczne'}” — stół z rzeczami, półka, narzędzia i obserwacje obok albo pod nim, przycisk pełnego ekranu.`,
  fullscreen: true,
  Editor: (props) => (
    <LabEditor {...props} presets={presets} sandbox={SANDBOX} what="laboratorium chemiczne" Preview={Preview}
      prompt={() => import('../../lab/chem/chemText').then((m) => m.chemPrompt())} />
  ),
  View: ({ config, ctx }) => {
    if (ctx.size.height === 'strip' && ctx.whole !== true) {
      return (
        <div className="lab-card">
          <strong>{config.title || 'Laboratorium chemiczne'}</strong>
          {config.text[0] !== undefined && <p className="wk-card-muted">{config.text[0]}</p>}
          {ctx.openWhole !== undefined && <button type="button" className="wk-btn" onClick={ctx.openWhole}>Otwórz laboratorium</button>}
        </div>
      );
    }
    return <Lab config={{ title: config.title, text: config.text, mode: config.mode, scene: config.scene }} whole={ctx.whole === true} />;
  },
  example: {
    title: 'Topnienie cyny',
    text: 'Co dzieje się z temperaturą cyny, gdy się topi?\nObserwuj wykres termometru w tyglu.',
    mode: 'experiment',
    scene: JSON.stringify(EXAMPLE_SCENE)
  },
  extra: [
    { key: 'title', shape: 'line', says: 'Tytuł doświadczenia (nad stołem)' },
    { key: 'text', shape: 'lines', says: 'Tekst dla uczniów — co mają zrobić i zaobserwować (akapity)' },
    { key: 'mode', shape: 'line', says: '"experiment" — dokładnie ten stół (z „Pokaż”), "sandbox" — piaskownica: wszystko wolno, gotowe doświadczenia do wczytania, zapis i eksport JSON' },
    { key: 'scene', shape: 'json', says: 'Stół: rzeczy z położeniem i zawartością, półka, narzędzia, co widać, wykres, "before"/"warm" i kroki — silnik (prawdziwa piaskownica) jest wbudowany, scena mówi tylko, co gdzie stoi', inside: SCENE_DOCS }
  ]
});
