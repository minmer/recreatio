/**
 * 2026-11-04 — GRAPHEN ZUM PRÜFEN DER GEBIETE (`src/app/cogita/regions.ts`, `scripts/app-regions-check.mjs`):
 * Nachbildungen in der Gestalt echter Bazy, deterministisch (ein eigener Zufall mit Samen). Jede liefert die Eingabe von
 * `buildRegions` ({ ids, labels, needs, rank, names }) und dazu `meta` — was die Prüfung über die Gestalt wissen muss.
 *
 *   laagLike()   wie LAAG: 278 Felder in 8 Abschnitten „§1 …" bis „§8 …"; der Eintrag eines Abschnitts braucht die
 *                letzten Schritte seiner Ketten; Ketten innen, spätere Abschnitte bauen auf frühere, vorn kurze Ketten,
 *                hinten eine lange neben kürzeren; ein paar Felder ohne Kanten, zwei kleine Kreise
 *   boskoLike()  wie Bosko: 63 Erzähleinheiten in 8 Etappen („etap 1" …), kurze Ketten, ein paar Gabeln
 *   big(n)       ein Schulfach im Großen: Fächer → Bereiche → Haufen von Themen, ~2 Kanten je Thema, ein paar Kreise,
 *                ein paar Themen ohne Kanten; Namen je Bereich
 */

/** Ein kleiner, schneller Zufall mit Samen (mulberry32): dieselbe Folge bei jedem Lauf. */
export function random(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}

/** Baut die Eingabe aus einer Liste von Themen { id, label, name, needs: [Index] }. */
function assemble(topics, meta) {
  return {
    ids: topics.map((t) => t.id),
    labels: topics.map((t) => t.label),
    needs: topics.map((t) => [...new Set(t.needs)]),
    rank: topics.map((_, i) => i),
    names: topics.map((t) => (t.name === null ? [] : [t.name])),
    meta
  };
}

/* -- LAAG ------------------------------------------------------------------------------------------------------------- */

const LAAG_SECTIONS = [
  ['§1 Mengen und Abbildungen', 26, ['Menge', 'Teilmenge', 'Vereinigung und Durchschnitt', 'Differenzmenge', 'Potenzmenge', 'Kartesisches Produkt', 'Abbildung', 'Bild und Urbild', 'Injektivität', 'Surjektivität', 'Bijektivität', 'Komposition', 'Umkehrabbildung', 'Mächtigkeit', 'Vollständige Induktion']],
  ['§2 Gruppen', 30, ['Verknüpfung', 'Halbgruppe', 'Monoid', 'Gruppe', 'Abelsche Gruppe', 'Untergruppe', 'Gruppenhomomorphismus', 'Kern und Bild', 'Symmetrische Gruppe', 'Ordnung eines Elements', 'Zyklische Gruppe', 'Nebenklassen', 'Satz von Lagrange', 'Normalteiler', 'Faktorgruppe']],
  ['§3 Ringe und Körper', 32, ['Ring', 'Kommutativer Ring', 'Nullteiler', 'Integritätsbereich', 'Einheit', 'Körper', 'Unterring', 'Ringhomomorphismus', 'Ideal', 'Polynomring', 'Grad eines Polynoms', 'Polynomdivision', 'Nullstelle', 'Charakteristik', 'Komplexe Zahlen']],
  ['§4 Relationen und Restklassen', 36, ['Relation', 'Äquivalenzrelation', 'Äquivalenzklasse', 'Partition', 'Repräsentantensystem', 'Teilbarkeit', 'Division mit Rest', 'Kongruenz modulo m', 'Restklasse', 'Restklassenring ℤ/mℤ', 'Größter gemeinsamer Teiler', 'Euklidischer Algorithmus', 'Lemma von Bézout', 'Primzahl', 'Chinesischer Restsatz', 'Einheitengruppe', 'Eulersche φ-Funktion', 'Kleiner Satz von Fermat']],
  ['§5 Vektorräume', 38, ['Vektorraum', 'Untervektorraum', 'Linearkombination', 'Lineare Hülle', 'Erzeugendensystem', 'Lineare Unabhängigkeit', 'Summe von Unterräumen', 'Direkte Summe', 'Koordinaten', 'Standardraum Kⁿ', 'Funktionenräume', 'Durchschnitt von Unterräumen', 'Affiner Unterraum', 'Quotientenraum']],
  ['§6 Basis und Dimension', 38, ['Basis', 'Austauschlemma', 'Austauschsatz von Steinitz', 'Dimension', 'Basisergänzungssatz', 'Dimensionsformel für Unterräume', 'Endlich erzeugter Raum', 'Rang einer Familie', 'Basiswechsel', 'Koordinatenabbildung', 'Unendliche Dimension', 'Hamel-Basis']],
  ['§7 Lineare Abbildungen und Matrizen', 40, ['Lineare Abbildung', 'Kern', 'Bild', 'Rang', 'Dimensionsformel', 'Isomorphismus', 'Matrix', 'Darstellungsmatrix', 'Matrizenprodukt', 'Invertierbare Matrix', 'Transponierte', 'Lineares Gleichungssystem', 'Gauß-Algorithmus', 'Zeilenstufenform', 'Elementarmatrizen', 'Ähnlichkeit von Matrizen']],
  ['§8 Determinanten und Eigenwerte', 38, ['Permutation', 'Signum', 'Determinante', 'Leibniz-Formel', 'Laplace-Entwicklung', 'Multiplikativität der Determinante', 'Cramersche Regel', 'Eigenwert', 'Eigenvektor', 'Eigenraum', 'Charakteristisches Polynom', 'Diagonalisierbarkeit', 'Trigonalisierung', 'Satz von Cayley-Hamilton', 'Minimalpolynom', 'Jordan-Normalform']]
];
const LAAG_KINDS = ['Definition', 'Beispiel', 'Satz', 'Lemma', 'Bemerkung', 'Korollar', 'Beispiel', 'Satz'];
/** In diesen Abschnitten steht ein Feld ohne Kanten (eine historische Bemerkung). */
const LAAG_LONE = new Set([1, 3, 4, 6, 7]);

export function laagLike(seed = 278) {
  const R = random(seed);
  const topics = [];
  const sections = [];
  const isolated = [];
  const cycles = [];
  for (let s = 1; s <= LAAG_SECTIONS.length; s += 1) {
    const [label, size, terms] = LAAG_SECTIONS[s - 1];
    const entry = topics.length;
    topics.push({ id: `laag-s${s}`, label, name: label, needs: [] });
    const lone = LAAG_LONE.has(s) ? 1 : 0;
    const m = size - 1 - lone;
    /* Vorn kurze Ketten, hinten eine lange neben kürzeren. */
    const lengths = [];
    let left = m;
    if (s >= 6) { const long = Math.min(left, R.int(14, 20)); lengths.push(long); left -= long; }
    while (left > 0) {
      const want = s <= 3 ? R.int(2, 4) : R.int(3, 6);
      const len = left - want < 2 ? left : want;
      lengths.push(len);
      left -= len;
    }
    let k = 0;
    const chains = [];
    for (let c = 0; c < lengths.length; c += 1) {
      const chain = [];
      for (let j = 0; j < lengths[c]; j += 1) {
        k += 1;
        const term = terms[(k - 1) % terms.length];
        const kind = LAAG_KINDS[(k - 1 + s) % LAAG_KINDS.length];
        const idx = topics.length;
        topics.push({ id: `laag-${s}-${k}`, label: `${term} (${kind} ${s}.${k})`, name: label, needs: [] });
        if (j > 0) topics[idx].needs.push(chain[j - 1]);
        chain.push(idx);
      }
      chains.push(chain);
      if (c === 0 && lone === 1) {
        k += 1;
        const idx = topics.length;
        topics.push({ id: `laag-${s}-${k}`, label: `Historische Bemerkung (Bemerkung ${s}.${k})`, name: label, needs: [] });
        isolated.push(idx);
      }
    }
    /* Gabeln und Zusammenführungen im Abschnitt. */
    for (let c = 1; c < chains.length; c += 1) {
      if (R() < 0.5) topics[chains[c][0]].needs.push(R.pick(R.pick(chains.slice(0, c))));
      for (let j = 1; j < chains[c].length; j += 1) if (R() < 0.15) topics[chains[c][j]].needs.push(R.pick(R.pick(chains.slice(0, c))));
    }
    /* Der Eintrag des Abschnitts braucht die letzten Schritte seiner Ketten. */
    for (const chain of chains) topics[entry].needs.push(chain[chain.length - 1]);
    /* Spätere Abschnitte bauen auf frühere. */
    if (s >= 2) {
      const before = sections[s - 2];
      topics[chains[0][0]].needs.push(R() < 0.5 ? before.entry : R.pick(before.members));
      for (let c = 1; c < chains.length; c += 1) {
        if (R() >= 0.4) continue;
        const from = R() < 0.7 ? before : R.pick(sections);
        topics[chains[c][0]].needs.push(R.pick(from.members));
      }
    }
    /* Zwei kleine Kreise, wie sie in rohen Voraussetzungen vorkommen. */
    if (s === 3 && chains[0].length >= 2) {
      const [a, b] = chains[0];
      topics[a].needs.push(b);
      cycles.push([a, b]);
    }
    if (s === 6 && chains.length >= 2 && chains[0].length >= 2) {
      const [a, b] = chains[0];
      const c = chains[1][0];
      topics[c].needs.push(b);
      topics[a].needs.push(c);
      cycles.push([a, b, c]);
    }
    sections.push({ label, entry, members: chains.flat(), chains, all: [entry, ...chains.flat(), ...isolated.filter((i) => i > entry)] });
  }
  return assemble(topics, { sections, isolated, cycles });
}

/* -- Bosko ------------------------------------------------------------------------------------------------------------ */

const BOSKO = [
  ['Becchi', 'Sen dziewięciolatka', 'Mama Małgorzata', 'Sztukmistrz z Becchi', 'Śmierć ojca', 'Praca u Moglii', 'Ksiądz Calosso', 'Pierwsza szkoła'],
  ['Chieri', 'Towarzystwo Wesołości', 'Przyjaciel Comollo', 'Nauka i praca', 'Decyzja o kapłaństwie', 'Seminarium w Chieri', 'Święcenia', 'Prymicje'],
  ['Konwikt św. Franciszka', 'Ksiądz Cafasso', 'Więzienia Turynu', 'Bartłomiej Garelli', 'Oratorium wędrowne', 'Łąka Filippich', 'Szopa Pinardiego', 'Valdocco'],
  ['Mama Małgorzata w Valdocco', 'Pierwsi wychowankowie', 'Warsztaty', 'Umowy o pracę', 'Kościół św. Franciszka Salezego', 'Dominik Savio', 'System prewencyjny', 'List z Rzymu'],
  ['Rok 1859', 'Pierwsi salezjanie', 'Reguła', 'Zatwierdzenie zgromadzenia', 'Bazylika Wspomożycielki', 'Szary pies', 'Michał Rua', 'Jan Cagliero'],
  ['Maria Mazzarello', 'Mornese', 'Córki Maryi Wspomożycielki', 'Współpracownicy salezjańscy', 'Biuletyn Salezjański', 'Pierwsza wyprawa misyjna', 'Patagonia', 'Sny misyjne'],
  ['Francja i Hiszpania', 'Bazylika Najświętszego Serca', 'Podróże za jałmużną', 'Choroba', 'Ostatnie lata', 'Testament', 'Śmierć w Valdocco', 'Pogrzeb'],
  ['Proces beatyfikacyjny', 'Beatyfikacja', 'Kanonizacja', 'Patron młodzieży', 'Rodzina salezjańska dziś', 'Przegląd: ksiądz Bosko', 'Na koniec']
];

export function boskoLike(seed = 63) {
  const R = random(seed);
  const topics = [];
  const stages = [];
  for (let s = 1; s <= BOSKO.length; s += 1) {
    const name = `etap ${s}`;
    const units = [];
    for (let j = 0; j < BOSKO[s - 1].length; j += 1) {
      const idx = topics.length;
      topics.push({ id: `bosko-${s}-${j + 1}`, label: BOSKO[s - 1][j], name, needs: [] });
      /* Meist die vorige Einheit, manchmal eine Gabel von weiter vorn, ab und zu eine Zusammenführung. */
      if (j > 0) {
        const back = j >= 2 && R() < 0.3 ? R.int(2, Math.min(3, j)) : 1;
        topics[idx].needs.push(units[j - back]);
        if (j >= 3 && R() < 0.2) topics[idx].needs.push(units[R.int(0, j - 2)]);
      }
      units.push(idx);
    }
    /* Die Etappe beginnt, wo die vorige endet. */
    if (s >= 2) { const prev = stages[s - 2]; topics[units[0]].needs.push(prev[prev.length - 1]); }
    stages.push(units);
  }
  return assemble(topics, { stages });
}

/* -- Groß -------------------------------------------------------------------------------------------------------------- */

const BIG_SUBJECTS = [
  ['Mathematik', ['Zahlen', 'Algebra', 'Geometrie', 'Funktionen', 'Analysis', 'Stochastik', 'Lineare Algebra', 'Trigonometrie', 'Folgen und Reihen', 'Vektorgeometrie']],
  ['Physik', ['Mechanik', 'Thermodynamik', 'Elektrizität', 'Magnetismus', 'Optik', 'Schwingungen', 'Wellen', 'Atomphysik', 'Kernphysik', 'Relativität']],
  ['Chemie', ['Stoffe', 'Atombau', 'Periodensystem', 'Bindungen', 'Reaktionen', 'Säuren und Basen', 'Redox', 'Organik', 'Kinetik', 'Gleichgewichte']],
  ['Informatik', ['Algorithmen', 'Datenstrukturen', 'Programmieren', 'Rekursion', 'Sortieren', 'Graphen', 'Automaten', 'Logik', 'Netze', 'Datenbanken']],
  ['Biologie', ['Zelle', 'Genetik', 'Evolution', 'Ökologie', 'Stoffwechsel', 'Nerven', 'Hormone', 'Immunsystem', 'Pflanzen', 'Verhalten']]
];

/** `dense`: je Thema die Wahrscheinlichkeit einer weiteren Kante zurück im Bereich (0,6 → etwa 2,5 Kanten je Thema). */
export function big(n = 5000, seed = 5000, dense = 0) {
  const R = random(seed);
  const areas = [];
  for (const [subject, list] of BIG_SUBJECTS) for (const area of list) areas.push({ subject, area, name: `${subject} · ${area}` });
  const topics = [];
  const areaOf = [];
  const cycles = [];
  const isolated = [];
  const per = Math.floor(n / areas.length);
  const extra = n - per * areas.length;
  const areaTopics = [];
  const subjectAreas = new Map();
  areas.forEach((a, ai) => {
    const count = per + (ai < extra ? 1 : 0);
    const own = [];
    const clusters = [];
    let left = count;
    let c = 0;
    while (left > 0) {
      const want = R.int(6, 16);
      const len = left - want < 4 ? left : want;
      c += 1;
      const cluster = [];
      for (let k = 1; k <= len; k += 1) {
        const idx = topics.length;
        topics.push({ id: `big-${ai}-${c}-${k}`, label: `${a.area} ${c}.${k}`, name: a.name, needs: [] });
        areaOf.push(ai);
        own.push(idx);
        /* Ein paar Themen ohne Kanten (etwa 0,5 %). */
        if (R() < 0.005) { isolated.push(idx); cluster.push(idx); continue; }
        const local = cluster.filter((x) => !isolated.includes(x));
        if (local.length > 0) {
          /* Meist eines der letzten drei im Haufen, oft dazu ein zweites (ein anderes) davor. */
          const first = local[Math.max(0, local.length - R.int(1, 3))];
          topics[idx].needs.push(first);
          const others = local.filter((x) => x !== first);
          if (others.length > 0 && R() < 0.8) topics[idx].needs.push(R.pick(others));
        }
        if (clusters.length > 0 && (k === 1 ? R() < 0.8 : R() < 0.25)) topics[idx].needs.push(R.pick(R.pick(clusters)));
        cluster.push(idx);
      }
      clusters.push(cluster.filter((x) => !isolated.includes(x)));
      left -= len;
    }
    areaTopics.push(own);
    if (!subjectAreas.has(a.subject)) subjectAreas.set(a.subject, []);
    subjectAreas.get(a.subject).push(ai);
  });
  /* Über Bereiche desselben Fachs (selten), über Fächer (sehr selten) — immer nur zurück. */
  const lone = new Set(isolated);
  for (let idx = 0; idx < topics.length; idx += 1) {
    if (lone.has(idx)) continue;
    const ai = areaOf[idx];
    const sameSubject = subjectAreas.get(areas[ai].subject).filter((x) => x < ai);
    /* (Bei kleinem n kann ein Bereich leer sein: dann keine Kante — die Folge des Zufalls bleibt dieselbe.) */
    if (sameSubject.length > 0 && R() < 0.1) { const p = R.pick(areaTopics[R.pick(sameSubject)].filter((x) => !lone.has(x))); if (p !== undefined) topics[idx].needs.push(p); }
    if (ai >= 10 && R() < 0.01) { const p = R.pick(areaTopics[R.int(0, Math.min(9, ai - 1))].filter((x) => !lone.has(x))); if (p !== undefined) topics[idx].needs.push(p); }
  }
  /* Dichter (nur auf Wunsch — sonst bleibt die Folge des Zufalls und damit der Graph derselbe). */
  if (dense > 0) {
    for (let idx = 0; idx < topics.length; idx += 1) {
      if (lone.has(idx) || R() >= dense) continue;
      const p = idx - R.int(1, 30);
      if (p >= 0 && areaOf[p] === areaOf[idx] && !lone.has(p) && !topics[idx].needs.includes(p)) topics[idx].needs.push(p);
    }
  }
  /* Ein paar Kreise: ein Thema braucht ein späteres, das (über die Kette) schon auf ihm aufbaut. */
  for (let i = 0; i < 8; i += 1) {
    const ai = R.int(0, areas.length - 1);
    const own = areaTopics[ai].filter((x) => !lone.has(x));
    if (own.length < 4) continue;
    const at = R.int(0, own.length - 4);
    const a = own[at];
    const b = own[at + 1];
    if (!topics[b].needs.includes(a)) topics[b].needs.push(a);
    topics[a].needs.push(b);
    cycles.push([a, b]);
  }
  return assemble(topics, { areas, areaOf, cycles, isolated });
}

/* -- Viele kurze Ketten nebeneinander ------------------------------------------------------------------------------------ */

const PARALLEL_SECTIONS = ['Dzieciństwo', 'Lata szkolne', 'Seminarium', 'Pierwsze lata kapłaństwa', 'Narodziny oratorium', 'Valdocco',
  'Salezjanie', 'Córki Maryi Wspomożycielki', 'Misje', 'Ostatnie lata', 'Świętość', 'Dziedzictwo'];
const PARALLEL_UNITS = ['Opowieść', 'Scena', 'Wspomnienie', 'List', 'Sen', 'Spotkanie', 'Rozmowa', 'Świadectwo'];

/**
 * Wie die Bosko-Kopie auf LocalDB (416 Themen, Abschnitte als Namen): je Abschnitt ein Eintrag (sein Name) und viele
 * kurze Ketten nebeneinander (1–3 Einheiten), deren letzte der Eintrag braucht; eine Kette beginnt oft beim Eintrag des
 * vorigen Abschnitts. Schwer für die Größen: um den Eintrag passt nur ein Teil der Ketten, der Rest hängt an nichts
 * anderem — er muss sich nach dem Namen zusammenfinden, ohne winzige Gruppen.
 */
export function parallelLike(n = 416, seed = 416) {
  const R = random(seed);
  const topics = [];
  const sections = [];
  const per = Math.floor(n / PARALLEL_SECTIONS.length);
  const extra = n - per * PARALLEL_SECTIONS.length;
  PARALLEL_SECTIONS.forEach((label, s) => {
    const size = per + (s < extra ? 1 : 0);
    const entry = topics.length;
    topics.push({ id: `par-${s + 1}`, label, name: label, needs: [] });
    const chains = [];
    let left = size - 1;
    let k = 0;
    while (left > 0) {
      const u = R();
      const len = Math.min(left, u < 0.3 ? 1 : u < 0.7 ? 2 : 3);
      const chain = [];
      for (let j = 0; j < len; j += 1) {
        k += 1;
        const idx = topics.length;
        topics.push({ id: `par-${s + 1}-${k}`, label: `${label}: ${PARALLEL_UNITS[(k - 1) % PARALLEL_UNITS.length]} ${k}`, name: label, needs: j > 0 ? [chain[j - 1]] : [] });
        chain.push(idx);
      }
      if (s > 0) {
        const before = sections[s - 1];
        const v = R();
        if (v < 0.5) topics[chain[0]].needs.push(before.entry);
        else if (v < 0.7) topics[chain[0]].needs.push(R.pick(before.members));
      }
      chains.push(chain);
      left -= len;
    }
    for (const chain of chains) topics[entry].needs.push(chain[chain.length - 1]);
    sections.push({ label, entry, members: chains.flat(), chains });
  });
  return assemble(topics, { sections });
}

/*
 * 2026-11-04 (Prompt 12) — ACHT GEBIETE: Bazy mit 8 Abschnitten zu 5–12 Themen, innen kleine Ketten mit Gabeln.
 *   kette8()   jeder Abschnitt baut auf den vorigen (eine Kette von Gebieten — wie Bosko heute)
 *   zweige8()  ein Anfang, darauf eine breite flache Schicht von vier Abschnitten, auf drei davon je ein tieferer
 */
const SECTIONS8 = ['Początki w Becchi', 'Szkoła w Chieri i seminarium', 'Pierwsze oratorium wędrowne', 'Sanktuarium, kolegium i oratorium w Turynie',
  'Salezjanie: reguła i pierwsze śluby', 'Dzieło wychodzi w świat: pierwsze misje', 'Córki Maryi Wspomożycielki', 'Ostatnie lata i dziedzictwo'];
const SIZES8 = [6, 9, 7, 11, 8, 5, 10, 8];

function section8(rnd, s, size, topics, base) {
  const first = topics.length;
  for (let k = 0; k < size; k += 1) {
    const needs = [];
    /* Innen: eine Kette mit Gabeln (Tiefe 3–5). */
    if (k > 0) needs.push(first + Math.max(0, k - 1 - (rnd() < 0.35 ? 1 : 0)));
    if (k > 1 && rnd() < 0.7) needs.push(first + rnd.int(0, k - 2));
    if (k > 2 && rnd() < 0.5) needs.push(first + rnd.int(0, k - 3));
    if (k === 0) needs.push(...base);
    topics.push({ id: `${base.length === 0 && s === 0 ? 'a' : 's'}${s}-${k}`, label: `${SECTIONS8[s].split(/[ :,]/)[0]} ${k + 1}`, name: SECTIONS8[s], needs });
  }
  /* Was der nächste braucht: die letzten zwei. */
  return [topics.length - 1];
}

export function kette8(seed = 8) {
  const rnd = random(seed);
  const topics = [];
  let exits = [];
  SIZES8.forEach((size, s) => { exits = section8(rnd, s, size, topics, exits); });
  return assemble(topics, { sections: SECTIONS8, sizes: SIZES8 });
}

export function zweige8(seed = 9) {
  const rnd = random(seed);
  const topics = [];
  const start = section8(rnd, 0, SIZES8[0], topics, []);
  const layer = [1, 2, 3, 4].map((s) => section8(rnd, s, SIZES8[s], topics, start));
  section8(rnd, 5, SIZES8[5], topics, layer[0]);
  section8(rnd, 6, SIZES8[6], topics, layer[1]);
  section8(rnd, 7, SIZES8[7], topics, [...layer[2].slice(0, 1), ...layer[3].slice(0, 1)]);
  return assemble(topics, { sections: SECTIONS8, sizes: SIZES8 });
}

/*
 * 2026-11-04 (Prompt 14) — FLACH: sieben Abschnitte zu 7–10 Themen, die meisten ohne Voraussetzungen, Ketten höchstens drei
 * lang (wie „Flach zz-probe"): viele Gebiete beginnen zugleich am Anfang.
 */
export function flach7(seed = 7) {
  const rnd = random(seed);
  const sizes = [7, 9, 9, 7, 8, 10, 9];
  const names = ['Musikinstrumente', 'Sport und Bewegung', 'Pflanzen im Garten', 'Kochen und Backen', 'Wetter und Klima', 'Europas Länder, Hauptstädte und Landschaften', 'Tiere des Waldes'];
  const topics = [];
  const depth = [];
  sizes.forEach((size, s) => {
    const first = topics.length;
    for (let k = 0; k < size; k += 1) {
      const needs = [];
      if (k > 0 && rnd() < 0.55) { const p = first + rnd.int(0, k - 1); if (depth[p] < 2) needs.push(p); }
      depth.push(needs.length === 0 ? 0 : depth[needs[0]] + 1);
      topics.push({ id: `f${s}-${k}`, label: `${names[s].split(/[ ,]/)[0]} ${k + 1}`, name: names[s], needs });
    }
  });
  return assemble(topics, { sections: names, sizes });
}
