/**
 * 2026-11-10 — WELTEN VERSCHIEDENER GESTALT für die Prüfungen der Weltkarte (Eigentümer: „nicht nur eine Datei, sondern Kette,
 * Gabelung, mehrere Gabelungen hintereinander, ein Tor mit einem oder mehreren verlangten Türmen, ein Abstecher, ganz ohne
 * Gabelung"). Gebaut mit dem `FlowBuilder` der Testwelten; jede Welt ist ein `WorldInput` (Einträge, Karten, Abläufe).
 *
 * Ein Turm `T` mit n Karten: je Karte eine Folie `s/T/i` (zeigt über `o_czym` auf den Turm) und gleich danach ihre Frage
 * `q/T/i` (die Karte erklärt durch die Folie). Eine Wegfolie `w/…` zeigt keinen Turm.
 */

export function shapes(F) {
  const ref = (field, to, extra = {}) => ({ field, to, ...extra });
  const needs = (to) => ref('wymaga', to, { prerequisite: 'up', structure: 'up' });

  const world = () => {
    const w = { entries: [], cards: [], flows: [], towers: new Map() };
    w.tower = (id, n = 3, req = []) => {
      w.entries.push({ id, kinds: ['turm'], label: `Turm ${id}`, refs: req.map(needs) });
      const list = [];
      for (let i = 0; i < n; i += 1) {
        const s = `s/${id}/${i}`;
        const q = `q/${id}/${i}`;
        w.entries.push({ id: s, kinds: ['folie'], label: `Folie ${id} ${i + 1}`, refs: [ref('o_czym', id)] });
        w.entries.push({ id: q, kinds: ['question'], label: `Frage ${id} ${i + 1}`, refs: [ref('about', id)] });
        w.cards.push({ key: q, question: q, about: [id], explain: [s] });
        list.push([s, q]);
      }
      w.towers.set(id, list);
      return id;
    };
    let ways = 0;
    /** Eine Wegfolie (kein Turm). */
    w.way = () => { ways += 1; const id = `w/${ways}`; w.entries.push({ id, kinds: ['folie'], label: `Weg ${ways}`, refs: [] }); return id; };
    w.unit = (id, req = []) => { w.entries.push({ id, kinds: ['einheit'], label: `Einheit ${id}`, refs: req.map(needs) }); return id; };
    /** Der Inhalt eines Turms in einer Erzählung: Folie, Frage, Folie, Frage … */
    w.stop = (b, id) => { for (const [s, q] of w.towers.get(id)) { b.show(s); b.ask(q); } };
    w.ways = (b, n) => { for (let i = 0; i < n; i += 1) b.show(w.way()); };
    w.story = (id, data, build) => { const b = new F.FlowBuilder(id.replace(/\W/g, '')); build(b); if (b.open.length > 0) b.end(); const f = b.flow(id, { name: data.name ?? id, ...data }); w.flows.push(f); return f; };
    w.input = () => ({ entries: w.entries, cards: w.cards, flows: w.flows });
    return w;
  };

  /** Eine Gabelung mit Halt: `hold: true` (der Lernende wählt immer, auch mit nur einer offenen Möglichkeit). */
  const fork = (b, options, branches) => {
    const id = b.choice(options, branches.map((build) => (x) => { build(x); x.end(); }));
    const n = b.nodes.find((x) => x.id === id);
    n.config.hold = true;
    b.open = [];
    return id;
  };

  return {
    /** Eine Kette: Haus → A → B → C in einer Erzählung. */
    chain() {
      const w = world();
      w.tower('A'); w.tower('B'); w.tower('C');
      w.unit('u/1');
      w.story('f/1', { unit: 'u/1' }, (b) => { w.stop(b, 'A'); w.ways(b, 1); w.stop(b, 'B'); w.stop(b, 'C'); });
      return w.input();
    },
    /** Eine Gabelung: A, zwei Wegfolien, dann B oder C (jeder Zweig endet an seinem Turm). */
    fork() {
      const w = world();
      w.tower('A'); w.tower('B', 3, ['A']); w.tower('C', 4, ['A']);
      w.unit('u/1');
      let choice = '';
      w.story('f/1', { unit: 'u/1' }, (b) => {
        w.stop(b, 'A'); w.ways(b, 2);
        choice = fork(b, [{ label: 'zu B' }, { label: 'zu C' }], [(x) => w.stop(x, 'B'), (x) => w.stop(x, 'C')]);
      });
      return { input: w.input(), choice };
    },
    /** Mehrere Gabelungen hintereinander: A → (B → (D | E) | C), mit je einer Wegfolie davor. */
    forks() {
      const w = world();
      w.tower('A'); w.tower('B', 3, ['A']); w.tower('C', 3, ['A']); w.tower('D', 2, ['B']); w.tower('E', 2, ['B']);
      w.unit('u/1');
      const ids = {};
      w.story('f/1', { unit: 'u/1' }, (b) => {
        w.stop(b, 'A'); w.ways(b, 1);
        ids.first = fork(b, [{ label: 'B' }, { label: 'C' }], [
          (x) => { w.stop(x, 'B'); w.ways(x, 1); ids.second = fork(x, [{ label: 'D' }, { label: 'E' }], [(y) => w.stop(y, 'D'), (y) => w.stop(y, 'E')]); },
          (x) => w.stop(x, 'C')
        ]);
      });
      return { input: w.input(), ids };
    },
    /** Ein Tor an einem Zweig (verlangt einen Turm) und eine Linie, die zwei Türme verlangt (ein Tor-Knoten). */
    gates() {
      const w = world();
      w.tower('A'); w.tower('K'); w.tower('B', 3, ['A']); w.tower('C', 3, ['A']); w.tower('Z', 3, ['B', 'K']);
      w.unit('u/a'); w.unit('u/k'); w.unit('u/z', ['B', 'K']);
      let choice = '';
      w.story('f/a', { unit: 'u/a' }, (b) => {
        w.stop(b, 'A'); w.ways(b, 1);
        choice = fork(b, [{ label: 'B', condition: { type: 'knowness', of: 'K', band: 'known' } }, { label: 'C' }], [(x) => w.stop(x, 'B'), (x) => w.stop(x, 'C')]);
      });
      w.story('f/k', { unit: 'u/k' }, (b) => w.stop(b, 'K'));
      w.story('f/z', { unit: 'u/z' }, (b) => { w.ways(b, 1); w.stop(b, 'Z'); });
      return { input: w.input(), choice };
    },
    /** Ein Abstecher (ohne eigene Einheit) und einer mit eigener Einheit (behält seinen Weg). */
    detour() {
      const w = world();
      w.tower('A'); w.tower('B', 3, ['A']); w.tower('X', 2); w.tower('Y', 2);
      w.unit('u/1'); w.unit('u/y', ['A']);
      w.story('f/x', {}, (b) => w.stop(b, 'X'));
      w.story('f/y', { unit: 'u/y' }, (b) => w.stop(b, 'Y'));
      let call = '';
      let call2 = '';
      w.story('f/1', { unit: 'u/1' }, (b) => {
        w.stop(b, 'A');
        call = b.detour('f/x');
        b.nodes.find((n) => n.id === call).config.optional = true;
        call2 = b.detour('f/y');
        w.stop(b, 'B');
      });
      return { input: w.input(), call, call2 };
    },
    /** Ganz ohne Gabelung: zwei einfache Erzählungen, die zweite beginnt am Ende der ersten. */
    plain() {
      const w = world();
      w.tower('A'); w.tower('B', 3, ['A']);
      w.unit('u/1'); w.unit('u/2', ['A']);
      w.story('f/1', { unit: 'u/1' }, (b) => w.stop(b, 'A'));
      w.story('f/2', { unit: 'u/2' }, (b) => { w.ways(b, 2); w.stop(b, 'B'); });
      return w.input();
    },
    /** Dieselben Karten in drei Verpackungen (sie treffen sich vor den gemeinsamen Fragen), am Anfang eines Zweiges. */
    packaging() {
      const w = world();
      w.tower('A'); w.tower('P', 3, ['A']); w.tower('Q', 2, ['A']);
      w.unit('u/1');
      const ids = {};
      w.story('f/1', { unit: 'u/1' }, (b) => {
        w.stop(b, 'A'); w.ways(b, 1);
        ids.fork = fork(b, [{ label: 'P' }, { label: 'Q' }], [
          (x) => {
            const style = (n) => (y) => { for (let i = 0; i < n; i += 1) { const s = `s/P/style${n}/${i}`; w.entries.push({ id: s, kinds: ['folie'], label: s, refs: [ref('o_czym', 'P')] }); y.show(s); } };
            ids.packaging = x.choice([{ label: 'Kinder' }, { label: 'Schule' }, { label: 'Erwachsene' }], [style(2), style(3), style(4)]);
            for (const [, q] of w.towers.get('P')) x.ask(q);
          },
          (x) => w.stop(x, 'Q')
        ]);
      });
      return { input: w.input(), ids };
    },
    /** Ein Przegląd, danach eine Schlussfolie und eine Gabelung: was nach dem Przegląd kommt, wird gezeichnet. */
    review() {
      const w = world();
      w.tower('A'); w.tower('B', 2, ['A']); w.tower('C', 2, ['A']);
      w.unit('u/1');
      w.story('f/1', { unit: 'u/1', review: 'rv' }, (b) => {
        w.stop(b, 'A');
        b.step('review', { of: 'story', threshold: 0.9 }, ['passed'], 'rv');
        w.ways(b, 1);
        fork(b, [{ label: 'B' }, { label: 'C' }], [(x) => w.stop(x, 'B'), (x) => w.stop(x, 'C')]);
      });
      return w.input();
    },
    /** Ein Turm mit einer Voraussetzung, zu der kein Weg führt (eine Erzählung vom Haus direkt zu ihm): die Voraussetzung ist nur als Spur zu sehen. */
    requirement() {
      const w = world();
      w.tower('A'); w.tower('M', 3, ['A']);
      w.unit('u/a'); w.unit('u/m');
      w.story('f/a', { unit: 'u/a' }, (b) => w.stop(b, 'A'));
      w.story('f/m', { unit: 'u/m' }, (b) => w.stop(b, 'M'));
      return w.input();
    },
    /** Eine Kette von Voraussetzungen über verschiedene Erzählungen: Z verlangt R1 und R2, R2 verlangt R1; keine Erzählung führt direkt. */
    prerequisites() {
      const w = world();
      w.tower('R1'); w.tower('R2', 3, ['R1']); w.tower('Z', 3, ['R2']); w.tower('O');
      w.unit('u/r1'); w.unit('u/o'); w.unit('u/r2', ['R1']); w.unit('u/z', ['R2']);
      w.story('f/r1', { unit: 'u/r1' }, (b) => w.stop(b, 'R1'));
      w.story('f/o', { unit: 'u/o' }, (b) => w.stop(b, 'O'));
      w.story('f/r2', { unit: 'u/r2' }, (b) => { w.ways(b, 1); w.stop(b, 'R2'); });
      w.story('f/z', { unit: 'u/z' }, (b) => { w.ways(b, 1); w.stop(b, 'Z'); });
      return w.input();
    }
  };
}
