/**
 * LABORATORIUM 2D — SCENARIUSZE (B, 2026-10-23): eine Seite mit einem Labor,
 * in dem die Schüler zwischen allen fertigen Szenariusze wählen (die
 * Voreinstellungen aus lab/lab2d/presets.ts), und einem zweiten, das beim
 * Öffnen gleich ein Nachweis backt (start: "bake").
 *
 *   node scripts/lab2d-scenarios.mjs   → scripts/fixtures/lab2d-scenariusze.json (zum Import einer Seite)
 *
 * Die Szenen kommen aus den Voreinstellungen: ändert sich eine, schreibt dieser
 * Lauf die Seite neu.
 */
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'lab2d-scenarios-'));
try {
  const entry = join(workspace, 'entry.ts');
  const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
  await writeFile(entry, `export { LAB2D_PRESETS } from '${app}lab/lab2d/presets';\n`);
  await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(workspace, 'entry.mjs'), logLevel: 'error' });
  const { LAB2D_PRESETS } = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const preset = (key) => {
    const p = LAB2D_PRESETS.find((x) => x.key === key);
    if (p === undefined) throw new Error(`preset ${key}`);
    return p;
  };
  /* Die Reihenfolge der Wahl: vom Erwärmen über das Sieden zu Öl, Salz und Nebel, dann Körper (M3a). */
  const order = ['zlewka-na-plycie', 'konwekcja', 'wrzenie', 'szybkowar', 'wysoka-gora', 'woda-pod-olejem', 'olej-i-woda', 'solanka-wrze-pozniej', 'solanka-pod-woda', 'odparowanie-solanki', 'mgla', 'co-plywa', 'przewrocona-zlewka'];
  const [first, ...rest] = order.map(preset);
  const scenario = (p) => ({ title: p.title, text: p.text, scene: p.scene });
  const boiling = preset('wrzenie');
  const page = {
    format: 'recreatio/page',
    version: 1,
    path: 'laboratorium-2d-scenariusze',
    title: 'Laboratorium 2D — scenariusze',
    lead: 'Jedno laboratorium, wiele doświadczeń: wybierz scenariusz, uruchom go na żywo albo upiecz nagranie i odtwarzaj je płynnie. Wszystko wynika z praw fizyki i bazy materiałów — nic nie jest odegrane.',
    mode: 'page',
    theme: { mode: 'light', accent: '#2f6fb0', ink: '#13212b', ground: '#f6f8f9', muted: '#5b6b74' },
    modules: [
      {
        id: 'lab2d-scen-wstep',
        kind: 'text',
        size: { colSpan: 6, rowSpan: 2 },
        config: {
          title: 'Jak pracować',
          body: 'Laboratorium nic nie liczy samo. Po otwarciu czeka: „Uruchom na żywo” liczy symulację w tej chwili (na słabszym komputerze wolniej niż w rzeczywistości), „Upiecz” liczy wybrany scenariusz raz, jak najszybciej, i zapisuje nagranie w tej przeglądarce.\n## Nagranie\nUpieczone nagranie odtwarza się płynnie, bez liczenia — także na telefonie: przewijaj suwakiem czasu, zmieniaj tempo i nakładki. „Na żywo od tej chwili” liczy dalej dokładnie od pokazanego obrazu; wtedy znów działają narzędzia.\n## Scenariusze\nNad tekstem po prawej wybierasz scenariusz: od nagrzewania wody przez wrzenie (także w szybkowarze i w górach) po olej, solankę, mgłę i ciała, które pływają, toną albo się przewracają. Każdy ma własne nagranie.'
        }
      },
      {
        id: 'lab2d-scen-lab',
        kind: 'lab2d',
        size: { colSpan: 6, rowSpan: 5 },
        config: {
          title: first.title,
          text: first.text,
          mode: 'sandbox',
          scene: first.scene,
          start: 'button',
          seconds: '30',
          scenarios: rest.map(scenario)
        }
      },
      {
        id: 'lab2d-scen-nagranie',
        kind: 'lab2d',
        size: { colSpan: 6, rowSpan: 5 },
        config: {
          title: `${boiling.title} — nagranie`,
          text: ['To laboratorium piecze nagranie samo, zaraz po otwarciu strony (10 s wrzenia). Gdy jest gotowe, odtwarza się od razu — przy następnej wizycie bez czekania.', ...boiling.text],
          mode: 'sandbox',
          scene: boiling.scene,
          start: 'bake',
          seconds: '10'
        }
      }
    ]
  };
  const out = join(process.cwd(), 'scripts/fixtures/lab2d-scenariusze.json');
  await writeFile(out, `${JSON.stringify(page, null, 2)}\n`);
  console.log(`wrote ${out}: ${1 + rest.length} scenarios in one lab, one lab that bakes on opening`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
