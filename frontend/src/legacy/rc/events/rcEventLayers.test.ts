/**
 * Reihenfolge der Teile und ihr Hintergrund.
 *
 * <b>Zwei Dinge, die still danebengehen.</b>
 *
 * Die REIHENFOLGE ist die Adresse: `…/event/recreatio/3` meint den dritten
 * Teil. Sortiert sie sich beim naechsten Laden anders, fuehrt ein Link, den
 * jemand verschickt hat, woandershin — und nichts daran sieht kaputt aus.
 *
 * Die HINTERGRUENDE kommen als Text aus der Datenbank und gehen direkt in
 * `style`. Was dort ungeprueft durchgeht, ist eine CSS-Einschleusung; CSS kann
 * ein Bild von einem fremden Server holen und damit verraten, wer diese Seite
 * liest.
 */

import { rcLayerStyle, rcPartsOf } from './rcEventLayers';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const part = (partId: string, sortOrder: number, extra: Record<string, unknown> = {}) => ({
  partId, kind: 'text', isPublic: true, sortOrder,
  menuLabel: null, title: null, intro: null, configJson: null,
  isVisible: true, unreadable: null, fields: [],
  ...extra
});

const page = (pageId: string, sortOrder: number, parts: unknown[], isVisible = true) => ({
  pageId, slug: pageId, title: pageId, sortOrder, isVisible, parts
});

// -- Die Reihenfolge ist die Adresse ------------------------------------------

const event = {
  pages: [
    page('b', 2, [part('b2', 1), part('b1', 0)]),
    page('a', 1, [part('a1', 0)])
  ]
} as never;

ok('Seiten nach ihrer Ordnung, Teile innerhalb',
  rcPartsOf(event).map((p) => p.partId), ['a1', 'b1', 'b2']);

/*
 * Bei gleicher Ordnung entscheidet die Kennung — irgendetwas Festes muss
 * entscheiden. Ohne das haengt die Reihenfolge an der Laune der Sortierung,
 * und „Teil 3" ist morgen ein anderer.
 */
const tied = { pages: [page('p', 1, [part('zz', 5), part('aa', 5)])] } as never;
ok('Gleichstand entscheidet die Kennung',
  rcPartsOf(tied).map((p) => p.partId), ['aa', 'zz']);

/* Zweimal gelesen ergibt dieselbe Reihenfolge — sonst waere sie keine. */
ok('Zweimal dasselbe',
  rcPartsOf(event).map((p) => p.partId), rcPartsOf(event).map((p) => p.partId));

// -- Was nicht sichtbar ist, ist nicht da -------------------------------------

const hidden = {
  pages: [
    page('h', 1, [part('x', 0, { isVisible: false }), part('y', 1)]),
    page('g', 2, [part('z', 0)], false)
  ]
} as never;

ok('Ein unsichtbarer Teil faellt weg', rcPartsOf(hidden).map((p) => p.partId), ['y']);

ok('Leeres bleibt leer', rcPartsOf({ pages: [] } as never), []);
ok('Ohne Seiten auch', rcPartsOf({} as never), []);

// -- Hintergruende ------------------------------------------------------------

const withConfig = (config: unknown) =>
  rcLayerStyle(part('p', 0, { configJson: JSON.stringify(config) }) as never);

ok('Ein Verlauf wird gesetzt',
  withConfig({ layers: [{ kind: 'gradient', from: '#102030', to: '#405060', angle: 120 }] }),
  { background: 'linear-gradient(120deg, #102030, #405060)' });

ok('Mit Zwischenfarbe',
  withConfig({ layers: [{ kind: 'gradient', from: '#111', via: '#222', to: '#333', angle: 90 }] }),
  { background: 'linear-gradient(90deg, #111, #222, #333)' });

ok('Eine Vollfarbe',
  withConfig({ layers: [{ kind: 'solid', color: 'rgb(10, 20, 30)' }] }),
  { background: 'rgb(10, 20, 30)' });

ok('Die Tinte kommt mit',
  withConfig({ layers: [{ kind: 'solid', color: '#fff', ink: '#111' }] }),
  { background: '#fff', color: '#111' });

// -- Was NICHT durchgehen darf ------------------------------------------------

/*
 * DAS IST DER EIGENTLICHE PUNKT.
 *
 * Der Text stammt aus der Datenbank und geht in `style`. Eine URL darin holte
 * beim Anzeigen ein Bild von einem fremden Server — und damit erfaehrt dessen
 * Betreiber, wer diese Seite gerade liest.
 */
ok('Keine fremde Adresse als Farbe',
  withConfig({ layers: [{ kind: 'solid', color: 'url(https://fremd.example/pixel.png)' }] }), {});

ok('Kein Ausbruch aus der Regel',
  withConfig({ layers: [{ kind: 'solid', color: '#fff; background-image: url(x)' }] }), {});

ok('Kein Ausdruck', withConfig({ layers: [{ kind: 'solid', color: 'expression(alert(1))' }] }), {});

/* Ein Verlauf mit halber Angabe ist keiner — lieber ohne Hintergrund. */
ok('Halber Verlauf faellt weg',
  withConfig({ layers: [{ kind: 'gradient', from: '#111' }] }), {});

// -- Kaputte Angaben duerfen die Seite nicht kosten ---------------------------

/*
 * Der Text kommt aus einem Eingabefeld. Kaputtes JSON in EINEM Teil darf nicht
 * die ganze Veranstaltung nehmen: ohne Hintergrund ist die Seite schlichter,
 * ohne Inhalt ist sie weg.
 */
ok('Kaputtes JSON', rcLayerStyle(part('p', 0, { configJson: '{nicht' }) as never), {});
ok('Leerer Text', rcLayerStyle(part('p', 0, { configJson: '' }) as never), {});
ok('Gar nichts', rcLayerStyle(part('p', 0) as never), {});
ok('Eine Liste statt eines Objekts', rcLayerStyle(part('p', 0, { configJson: '[1,2]' }) as never), {});
ok('Schichten, die keine Liste sind', withConfig({ layers: 'blau' }), {});
ok('Eine leere Schichtenliste', withConfig({ layers: [] }), {});

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
