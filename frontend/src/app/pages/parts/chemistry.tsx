/**
 * LABORATORIUM CHEMICZNE (2026-10-18) — ein Baustein mit einem fest
 * eingebauten Motor für Chemie in 2D (`lab/chem/`): Lösungen mit echtem pH,
 * Salze, die sich lösen und ausfallen, Metalle, Gase, Feuer, Wärme, Druck —
 * auf einem Labortisch mit Glas, Brenner, Schläuchen, Bürette und Gasspritze.
 *
 * <b>Der Motor ist Code, der Versuch ist gespeichert</b>: die Szene (`scene`,
 * JSON) sagt, was auf dem Tisch steht, was im Regal ist, welche Werkzeuge es
 * gibt, was man sieht (Werte, Zusammensetzung, Lupe), den Schreiber und die
 * Schritte (mit „Pokaż” und Fragen vorab); gezogene Werte machen ihn jedes
 * Mal etwas anders. Als Piaskownica (`mode: "sandbox"`) darf man alles.
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
const SANDBOX = { burners: [{ id: 'p', x: 22 }], vessels: [{ id: 'b1', type: 'beaker', size: 250, x: -10 }, { id: 't1', type: 'tube', size: 25, x: 6 }], allow: { vessels: true } };

const SCENE_DOCS: Readonly<Record<string, string>> = {
  '.room': 'Pracownia: temperatura (°C) i ciśnienie (kPa)',
  '.room.T': 'Temperatura pracowni w °C (zwykle 20)',
  '.room.p': 'Ciśnienie powietrza w kPa (zwykle 101,3)',
  '.vars': 'Wartości losowane przy każdym otwarciu (i przy „Nowe losowanie”) — w wyrażeniach "=…" i w tekstach "{nazwa}"',
  '.vars[].name': 'Nazwa wartości',
  '.vars[].from': 'Najmniej',
  '.vars[].to': 'Najwięcej',
  '.vars[].step': 'Krok',
  '.vars[].pick': 'Zamiast liczby: lista tekstów do wylosowania (np. identyfikatory odczynników)',
  '.vessels': 'Naczynia na stole (z zawartością)',
  '.vessels[].id': 'Nazwa naczynia (litery, cyfry, - _) — w krokach, rurkach i wykresie',
  '.vessels[].type': 'Rodzaj: beaker (zlewka), flask (kolba stożkowa), roundflask (kolba okrągłodenna), tube (probówka), cylinder (cylinder miarowy), dish (parownica), crucible (tygiel), jar (słój), burette (biureta), syringe (strzykawka gazowa)',
  '.vessels[].size': 'Pojemność w cm³',
  '.vessels[].x': 'Położenie środka na stole w cm',
  '.vessels[].label': 'Podpis pod naczyniem',
  '.vessels[].hidden': 'true — zawartość ukryta (zagadka: „roztwór X”)',
  '.vessels[].on': 'Palnik (id), na którego trójnogu stoi naczynie',
  '.vessels[].closed': 'true — zamknięte korkiem',
  '.vessels[].gauge': 'true — korek z manometrem (pokazuje nadciśnienie)',
  '.vessels[].T': 'Temperatura zawartości w °C na starcie',
  '.vessels[].fill': 'Co jest w naczyniu na starcie (po kolei)',
  '.vessels[].fill[].reagent': 'Odczynnik (identyfikator z półki, np. "water", "HCl", "Na", "phenolphthalein") albo "{nazwa}" wylosowana',
  '.vessels[].fill[].amount': 'Ilość: g (ciała stałe), cm³ (roztwory, ciecze, gazy z butli), krople (wskaźniki)',
  '.vessels[].gas': 'Gaz zamiast powietrza, udziały, np. { "CO2": 1 } albo { "O2": 1 }',
  '.vessels[].over': 'Biureta: nad którym naczyniem wisi',
  '.vessels[].drip': 'Biureta: kapanie na starcie (cm³/s, 0 — zamknięta)',
  '.vessels[].content': 'Zapisany stan zawartości (z eksportu piaskownicy)',
  '.burners': 'Palniki z trójnogiem',
  '.burners[].id': 'Nazwa palnika',
  '.burners[].x': 'Położenie na stole w cm',
  '.burners[].on': 'true — płonie od początku',
  '.burners[].air': 'false — dopływ powietrza zamknięty (płomień świecący, chłodniejszy)',
  '.links': 'Rurki: gaz z zamkniętego naczynia do drugiego (pod ciecz albo do strzykawki)',
  '.links[].from': 'Skąd (to naczynie dostaje korek z rurką)',
  '.links[].to': 'Dokąd',
  '.shelf': 'Odczynniki na półce: identyfikatory albo grupy (metale, kwasy, zasady, sole, tlenki, wskazniki, gazy, inne) — bez tego wszystkie',
  '.tools': 'Narzędzia: glow (żarzące się łuczywo), splint (płonące łuczywo), match, paper, wetpaper, loop (próba płomieniowa), stir, stopper, gauge, tube, spoon, probe (ciśnienie w cieczy), empty, delete',
  '.allow': 'Co wolno uczniom',
  '.allow.shelf': 'false — bez półki z odczynnikami',
  '.allow.vessels': 'true — można dodawać naczynia i palniki',
  '.allow.move': 'false — naczyń nie da się przesuwać ani przelewać',
  '.allow.burner': 'false — palników nie da się przesuwać',
  '.show': 'Co widać',
  '.show.values': 'false — bez temperatury, pH i ciśnienia pod naczyniami',
  '.show.composition': 'false — bez składu gazu i roztworu (zagadki)',
  '.show.micro': 'false — bez lupy z cząsteczkami',
  '.show.equations': 'false — obserwacje bez równań reakcji',
  '.graph': 'Wykres w czasie',
  '.graph.vessels': 'Naczynia (id)',
  '.graph.vessel': 'Jedno naczynie (id) — zamiast listy',
  '.graph.of': 'Wielkości: "T" (temperatura), "pH", "p" (ciśnienie gazu), "gas" (objętość gazu w strzykawce)',
  '.steps': 'Kroki doświadczenia — „Pokaż” wykonuje je po kolei',
  '.steps[].say': 'Polecenie dla ucznia',
  '.steps[].do': 'Akcja albo lista akcji: { "add", "to", "amount" }, { "pour", "to", "ml" }, { "burner", "on" }, { "use", "at" }, { "flame", "with" }, { "link": [a, b] }, { "seat", "on" }, { "drip", "rate" }, { "speed" }',
  '.steps[].do.add': 'Dodaj odczynnik (identyfikator)',
  '.steps[].do.to': 'Do którego naczynia',
  '.steps[].do.amount': 'Ile (g, cm³ albo krople)',
  '.steps[].do.pour': 'Przelej z tego naczynia (ciecz albo ciężki gaz)',
  '.steps[].do.ml': 'Ile cm³ przelać',
  '.steps[].do.burner': 'Palnik do zapalenia albo zgaszenia',
  '.steps[].do.on': 'true — zapal / palnik dla "seat"',
  '.steps[].do.use': 'Narzędzie (jak w "tools")',
  '.steps[].do.at': 'Na którym naczyniu',
  '.steps[].do.flame': 'Palnik: wprowadź drucik albo łyżeczkę do płomienia',
  '.steps[].do.with': '"loop" (drucik) albo "spoon" (łyżeczka)',
  '.steps[].do.link': 'Połącz rurką [skąd, dokąd]',
  '.steps[].do.seat': 'Postaw naczynie na palniku ("on") albo zdejmij je na stół',
  '.steps[].do.drip': 'Biureta, której kranik otworzyć',
  '.steps[].do.rate': 'Szybkość kapania w cm³/s (0 — zamknij)',
  '.steps[].do.speed': 'Tempo czasu (1 — jak naprawdę, 10 — dziesięć razy szybciej)',
  '.steps[].ask': 'Pytanie przed krokiem (przewidywanie) — krok czeka na odpowiedź',
  '.steps[].ask.q': 'Treść pytania',
  '.steps[].ask.options': 'Odpowiedzi do wyboru',
  '.steps[].ask.answer': 'Dobra odpowiedź: jej tekst albo "=nazwa" (numer z wartości losowanej); bez — tylko opinia',
  '.steps[].ask.why': 'Wyjaśnienie po odpowiedzi',
  '.steps[].wait': 'Ile sekund trwa krok przy „Pokaż”',
  '.speed': 'Tempo czasu na starcie',
  '.view': 'Co widać na starcie: [x0, y0, x1, y1] w cm (stół na y = 0)'
};

/* Das Beispiel: Natrium im Wasser (wie unter den fertigen Versuchen). */
const EXAMPLE_SCENE = {
  vessels: [{ id: 'na', type: 'beaker', size: 250, x: 0, label: 'woda z fenoloftaleiną', fill: [{ reagent: 'water', amount: 150 }, { reagent: 'phenolphthalein', amount: 3 }] }],
  shelf: ['Na', 'K', 'Li', 'water', 'phenolphthalein'],
  tools: ['splint', 'paper', 'stir'],
  show: { values: true, composition: true, micro: true },
  graph: { vessels: ['na'], of: ['T', 'pH'] },
  steps: [{
    say: 'Wrzuć do wody kawałek sodu.',
    ask: { q: 'Jaki kolor przyjmie roztwór?', options: ['pozostanie bezbarwny', 'malinowy'], answer: 'malinowy', why: 'Powstaje wodorotlenek sodu — fenoloftaleina barwi się w zasadzie na malinowo.' },
    do: { add: 'Na', to: 'na', amount: 0.2 },
    wait: 12
  }],
  view: [-14, -8, 14, 24]
};

export const chemistryPart = definePart<Config>({
  kind: 'chemistry',
  label: 'Laboratorium chemiczne',
  use: 'Laboratorium chemiczne 2D: roztwory z prawdziwym pH, osady, metale z wodą i kwasami, gazy (pęcherzyki, próby łuczywem, woda wapienna), spalanie, ciepło reakcji, wrzenie, ciśnienie, próba płomieniowa, lupa z cząsteczkami — piaskownica albo gotowe doświadczenie szkolne; pełny ekran.',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [],
  read,
  hasContent: () => true,
  missing: () => null,
  shows: (c, size) => size.height === 'strip'
    ? `${c.title || 'Laboratorium chemiczne'} — karta z przyciskiem: laboratorium otwiera się na całym ekranie.`
    : `${c.mode === 'sandbox' ? 'Piaskownica' : 'Doświadczenie'} „${c.title || 'Laboratorium chemiczne'}” — stół z naczyniami, półka, narzędzia i obserwacje obok albo pod nim, przycisk pełnego ekranu.`,
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
    title: 'Sód w wodzie',
    text: 'Co dzieje się z sodem w wodzie?\nObserwuj metal, barwę roztworu z fenoloftaleiną i temperaturę.',
    mode: 'experiment',
    scene: JSON.stringify(EXAMPLE_SCENE)
  },
  extra: [
    { key: 'title', shape: 'line', says: 'Tytuł doświadczenia (nad stołem)' },
    { key: 'text', shape: 'lines', says: 'Tekst dla uczniów — co mają zrobić i zaobserwować (akapity)' },
    { key: 'mode', shape: 'line', says: '"experiment" — dokładnie ten stół (z „Pokaż”), "sandbox" — piaskownica: wszystko wolno, gotowe doświadczenia do wczytania, zapis i eksport JSON' },
    { key: 'scene', shape: 'json', says: 'Stół: naczynia z zawartością, palniki, rurki, półka, narzędzia, co widać, wykres i kroki — silnik chemii jest wbudowany, scena mówi, co na nim stoi', inside: SCENE_DOCS }
  ]
});
