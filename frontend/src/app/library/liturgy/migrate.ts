/**
 * 2026-11-09 — VON BLÖCKEN ZU EINEM BRZMIENIE (1.0 → 2.0).
 *
 * Ein Text der Fassung 1.0 (`structured_content`: Blöcke mit Vers, Sprecher, Rubrik) — gespeichert oder in einem Dokument
 * der ersten Formate (`recreatio.liturgy` 1.0/1.1, `recreatio/liturgy` 1) — wird hier zu einem `text` mit Struktur:
 *
 *   Blöcke              → das Brzmienie (Strophen/Absätze getrennt, Antworten je eine Zeile); Rubriken/Überschriften → `notes`
 *   Zeichen im Text     → " * " und " † " werden zu Enden von Einheiten und verschwinden aus dem Brzmienie
 *   metadata.performance_markers ({at, mark} je Block) → Einheiten: * Mediante, † Flexa, / Mediante (beim Wiederholen), ✢ ✣ Kreuz
 *   metadata.recitation_mark_variants mit anderen Stellen → bezeugte `layouts`
 *   Sprecher P/K/V → K. (cantor), W/R → W. (all); wiederholte Zeilen → `performance` mit Verweisen statt eines zweiten Wortlauts
 *   Psalm ohne Versgrenzen → Verse aus den Medianten gefolgert (Satzzeichen), markiert `verses_inferred`
 *   Hymne ohne Zeilengrenzen → Zeilen aus Grossbuchstaben, wenn ihre Zahl zur gedruckten passt (`lines_inferred`), sonst `lines`
 *   Bitten "A, — B." → Einleitung, Bitte, zweiter Teil; der Ruf (refrain_resource_id) als `response_ref`, Wiederkehr in `performance`
 *   Gebet → Hauptteil, Schluss (Przez naszego Pana … / Który żyje …), Amen als Antwort (W.); Einleitungsformel → `intro_formula`
 *   Lesung → `origin` (Herkunft), `reference`, Titel als Hinweis; Untertitelzeilen ohne Satzende sind der Anfang des Texts → `incipit`
 *   eingebettete „Chwała Ojcu …" in einem Psalm → herausgenommen (eigener Text), dort ein Teilende
 *
 * Was gefolgert ist, steht in `missing` (zu prüfen). `metadata` bleibt unverändert: Quellen, Vorkommen, bezeugte Abweichungen.
 */
import type { End, ResourceType, Role, Step, Unit } from './schema';

type Raw = Record<string, unknown>;
type Mark = { readonly at: number; readonly mark: string };
/**
 * Ein Stück des werdenden Brzmienie. `pre`: was im Original davor stand, im selben Block (Leerraum oder nichts) — so bleibt
 * der Wortlaut genau; ohne `pre` beginnt ein neuer Block und das Trennzeichen folgt aus dem Ende davor.
 */
type Piece = { text: string; pre?: string; end?: End; cross?: boolean; verse?: number; label?: string; role?: Role; kind?: Unit['kind']; style?: 'italic' | 'bold'; id?: string };

/** Ein Stück an Stelle `k` teilen, ohne den Wortlaut zu ändern: was dazwischen stand, wird das `pre` des zweiten. */
function splitPiece(p: Piece, k: number): [Piece, Piece] {
  const first = p.text.slice(0, k).trimEnd();
  const second = p.text.slice(k).trimStart();
  const { end: _end, id: _id, ...rest } = p;
  return [{ ...rest, text: first }, { ...rest, text: second, pre: p.text.slice(first.length, p.text.length - second.length), cross: undefined, label: undefined, ...(p.end === undefined ? {} : { end: p.end }) }];
}

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.flatMap((x) => (typeof x === 'string' && x.trim() !== '' ? [x.trim()] : [])) : typeof v === 'string' && v.trim() !== '' ? [v.trim()] : []);

/** Wie die ersten Formate ihre Arten nannten → die Arten von 2.0. */
const TYPE_MAP: Readonly<Record<string, ResourceType>> = {
  psalm: 'psalm', psalm_fragment: 'psalm', psalm_text: 'psalm', canticle: 'canticle', gospel_canticle: 'canticle',
  antiphon: 'antiphon', hymn: 'hymn', reading: 'reading', responsory: 'responsory', dialog: 'dialog', versicle: 'versicle',
  intercessions: 'intercessions', intercession_refrain: 'response', response: 'response', prayer: 'prayer',
  blessing: 'blessing', blessing_and_conclusion: 'blessing', doxology: 'doxology', rubric_heading: 'rubric', rubric: 'rubric'
};
const ROLE_MAP: Readonly<Record<string, Role>> = { P: 'cantor', K: 'cantor', V: 'cantor', W: 'all', R: 'all', 'Przewodniczący': 'presider', Wszyscy: 'all', presider: 'presider', cantor: 'cantor', all: 'all', reader: 'reader' };

/* -- Zeichen am Text ----------------------------------------------------------------------------- */

/** " * " und " † " im Blocktext (so schrieben es manche Dokumente) → Zeichen an Stellen, der Text ohne sie. */
function liftInlineMarks(text: string, marks: readonly Mark[]): { text: string; marks: Mark[] } {
  let out = '';
  const moved: Mark[] = [];
  const given = [...marks].sort((a, b) => a.at - b.at);
  let g = 0;
  for (let i = 0; i < text.length; i++) {
    while (g < given.length && given[g].at <= i) moved.push({ at: out.length, mark: given[g++].mark });
    const c = text[i];
    if ((c === '*' || c === '†') && /\s/.test(text[i - 1] ?? ' ') && /\s/.test(text[i + 1] ?? ' ')) { moved.push({ at: out.length, mark: c }); i++; continue; }
    out += c;
  }
  while (g < given.length) moved.push({ at: out.length, mark: given[g++].mark });
  return { text: out, marks: moved };
}

/** Ein Block an seinen Zeichen geschnitten: Stücke mit Ende (* † /) und Kreuz (✢ ✣ vor dem Stück); der Wortlaut bleibt genau. */
function cutByMarks(text: string, marks: readonly Mark[], flags?: Set<string>): Piece[] {
  const out: Piece[] = [];
  let from = 0;
  let cross = false;
  let last = 0;
  const push = (a: number, b: number, end?: End) => {
    const raw = text.slice(a, b);
    const piece = raw.trim();
    if (piece === '') return false;
    const start = a + (raw.length - raw.trimStart().length);
    out.push({ text: piece, ...(out.length === 0 ? {} : { pre: text.slice(last, start) }), ...(end === undefined ? {} : { end }), ...(cross ? { cross: true } : {}) });
    last = start + piece.length;
    cross = false;
    return true;
  };
  for (const m of [...marks].sort((a, b) => a.at - b.at)) {
    const at = Math.max(from, Math.min(text.length, m.at));
    /* Ein Zeichen mitten im Wort ist ein Fehler der Vorlage: es bleibt eine Grenze, wird aber zum Prüfen vermerkt. */
    if (/\p{L}/u.test(text[at - 1] ?? '') && /\p{L}/u.test(text[at] ?? '')) flags?.add('marks_unverified');
    const end: End | undefined = m.mark === '*' || m.mark === '/' ? 'mediant' : m.mark === '†' ? 'flex' : undefined;
    if (end === undefined) {
      /* Ein Kreuz steht VOR dem Wort an seiner Stelle. */
      if (push(from, at)) from = at;
      cross = true;
      continue;
    }
    push(from, at, end);
    from = at;
  }
  push(from, text.length);
  return out;
}

/* -- Folgerungen --------------------------------------------------------------------------------- */

/** Wo ein Vers endet, zwischen der zweiten Vershälfte und der ersten des nächsten: am stärksten Satzzeichen, nahe der üblichen Länge. */
function verseBoundary(text: string, typical: number): number {
  const candidates: { at: number; strength: number }[] = [];
  for (let i = 1; i < text.length - 1; i++) {
    if (!/\s/.test(text[i])) continue;
    const before = text.slice(0, i).replace(/[»”"'’)]+$/, '');
    const c = before[before.length - 1];
    const strength = c === '.' || c === '!' || c === '?' ? 3 : c === ';' || c === ':' ? 2 : c === ',' ? 1 : 0;
    if (strength > 0) candidates.push({ at: i, strength });
  }
  if (candidates.length === 0) {
    /* Kein Satzzeichen: das Leerzeichen, das die übliche Halbverslänge am besten trifft. */
    let best = -1;
    for (let i = 1; i < text.length - 1; i++) if (/\s/.test(text[i]) && (best < 0 || Math.abs(i - typical) < Math.abs(best - typical))) best = i;
    return best;
  }
  const top = Math.max(...candidates.map((c) => c.strength));
  return candidates.filter((c) => c.strength === top).sort((a, b) => Math.abs(a.at - typical) - Math.abs(b.at - typical))[0].at;
}

/** Psalmstücke (an * und † geschnitten) zu Versen: jedes Stück nach einer Mediante trägt zwei Vershälften und wird geteilt. */
function inferVerses(pieces: Piece[]): Piece[] {
  const firsts = pieces.filter((p) => p.end === 'mediant').map((p) => p.text.length);
  const typical = firsts.length === 0 ? 40 : firsts.reduce((s, n) => s + n, 0) / firsts.length;
  const out: Piece[] = [];
  let verse = 1;
  let afterMediant = false;
  for (const p of pieces) {
    /* Nach einer Mediante: endet das Stück wieder an * oder †, trägt es den Schluss dieses Verses UND den Anfang des nächsten. */
    if (afterMediant && (p.end === 'mediant' || p.end === 'flex')) {
      const at = verseBoundary(p.text, typical);
      if (at > 0) {
        const [close, open] = splitPiece(p, at);
        out.push({ ...close, end: 'verse', verse });
        verse++;
        out.push({ ...open, verse });
        afterMediant = p.end === 'mediant';
        continue;
      }
    }
    if (afterMediant) {
      /* Nur der Schluss des Verses (das Ende eines Absatzes oder des Psalms). */
      out.push({ ...p, verse, end: p.end ?? 'verse' });
      verse++;
      afterMediant = false;
      continue;
    }
    out.push({ ...p, verse });
    afterMediant = p.end === 'mediant';
  }
  return out;
}

/** Hymnenzeilen aus Grossbuchstaben nach einem Leerzeichen — nur, wenn ihre Zahl zur gedruckten Zeilenzahl passt. */
function inferLines(stanza: string, printed: number | undefined): string[] | null {
  const starts = [0];
  for (let i = 1; i < stanza.length; i++) if (/\s/.test(stanza[i - 1]) && /\p{Lu}/u.test(stanza[i])) starts.push(i);
  /* Die gedruckte Zahl zählt Zeilenumbrüche — je nach Auszug mit oder ohne den letzten. */
  if (printed !== undefined && starts.length !== printed && starts.length !== printed + 1) return null;
  if (printed === undefined && (starts.length < 2 || starts.length > 12)) return null;
  return starts.map((s, k) => stanza.slice(s, starts[k + 1] ?? stanza.length));
}

const CONCLUSION = /\s(Przez naszego Pana|Przez Chrystusa|Przez Niego|Który żyje|Który żyjesz|Który z Tobą żyje|Który z Bogiem Ojcem|Bo Ty żyjesz|Through our Lord|Who lives and reigns|Through Christ)/;
const DOXOLOGY_START = 'Chwała Ojcu i Synowi';

/* -- Ein Text ------------------------------------------------------------------------------------ */

export interface Upgraded { readonly raw: Raw; readonly migrated: boolean }

/**
 * Ein Text in 2.0 — oder unverändert, wenn er schon ein `text` hat. Arbeitet auf rohen Objekten (vor zod); das Ergebnis
 * hat Einheiten als Stücke (`text`), wie ein Dokument sie schreibt — `liturgyJson.ts` legt sie auf das Brzmienie.
 */
export function upgradeText(input: Raw): Upgraded {
  if (typeof input.text === 'string' || !Array.isArray(input.structured_content)) return { raw: input, migrated: false };
  const meta = isObj(input.metadata) ? input.metadata : {};
  const blocks = (input.structured_content as unknown[]).filter(isObj);
  const markersOf = (k: number): Mark[] => {
    const all = Array.isArray(meta.performance_markers) ? meta.performance_markers : [];
    const mine = all[k];
    return Array.isArray(mine) ? mine.filter((m): m is Mark => isObj(m) && typeof m.at === 'number' && typeof m.mark === 'string') : [];
  };
  const original = String(input.resource_type ?? '');
  const hasSpeakers = blocks.some((b) => typeof b.speaker === 'string');
  const type: ResourceType = TYPE_MAP[original] ?? (original === 'office_rubric' ? (hasSpeakers ? 'dialog' : 'rubric') : 'other');
  const missing = new Set<string>(strs(input.missing));
  if (type === 'other') missing.add('resource_type');
  const notes: { type: string; text: string; at?: string }[] = [];
  /* `schema_version` bleibt: gespeichertes 1.0 erkennt der Import und schreibt es als 2.0 neu. */
  const out: Raw = { ...input, resource_type: type };
  delete out.structured_content;

  /* Rubriken und Überschriften sind Struktur, kein Brzmienie. */
  type B = { kind: string; text: string; marks: Mark[]; verse?: number; role?: Role; style?: 'italic' | 'bold'; label?: string };
  const body: B[] = [];
  blocks.forEach((b, k) => {
    const text = typeof b.text === 'string' ? b.text : '';
    if (b.type === 'rubric' || b.type === 'heading') { notes.push({ type: b.type === 'rubric' ? 'rubric' : 'heading', text, ...(body.length === 0 ? {} : { at: 'end' }) }); return; }
    const lifted = liftInlineMarks(text, markersOf(k));
    const speaker = typeof b.speaker === 'string' ? ROLE_MAP[b.speaker.replace(/[.:]$/, '')] : undefined;
    body.push({ kind: String(b.type ?? 'paragraph'), text: lifted.text, marks: lifted.marks, ...(typeof b.verse === 'number' ? { verse: b.verse } : {}),
      ...(speaker === undefined ? {} : { role: speaker }), ...(b.emphasis === 'italic' || b.emphasis === 'bold' ? { style: b.emphasis } : {}) });
  });

  /* Odpowiedzi in einem Absatz („Iz 1, 16 W. … K. …"): Stelle heraus, an den Rollenzeichen teilen. */
  if ((type === 'responsory' || type === 'versicle' || type === 'dialog') && body.length === 1 && body[0].role === undefined && /\s[WKR]\.\s/.test(` ${body[0].text}`)) {
    const only = body[0];
    const parts = splitRoleMarkers(only.text, only.marks);
    if (parts !== null) {
      body.splice(0, 1, ...parts.lines.map((l) => ({ kind: 'response', text: l.text, marks: l.marks, role: l.role })));
      if (parts.reference !== undefined && out.reference === undefined) out.reference = parts.reference;
      missing.add('roles_inferred');
    }
  }

  /* Lesung: Herkunft, Stelle, Titel, Incipit aus den gedruckten Zeilen. */
  if (type === 'reading') {
    const origin = strs(meta.source_author_or_book_attribution)[0];
    const reference = strs(meta.scripture_reference_as_printed)[0];
    if (origin !== undefined && out.origin === undefined) out.origin = origin;
    if (reference !== undefined && out.reference === undefined) out.reference = reference;
    const subtitles = strs(meta.reading_subtitle_as_printed);
    if (subtitles.length > 0) notes.unshift({ type: 'heading', text: subtitles[0] });
    const lead = subtitles.slice(1);
    if (lead.length > 0 && !/[.!?:…]$/.test(lead[lead.length - 1]) && body.length > 0) {
      body.unshift({ kind: 'incipit', text: lead.join(' '), marks: [] });
      out.incipit = { unit: 'incipit' };
      missing.add('incipit_unverified');
    }
  }
  if (type === 'canticle') {
    const headers = strs(meta.printed_canticle_headers);
    const ref = str(meta.biblical_reference_as_printed) ?? headers.find((h) => /\d/.test(h));
    if (ref !== undefined && out.biblical_reference === undefined) out.biblical_reference = ref;
    for (const h of headers) if (h !== ref) notes.push({ type: 'subtitle', text: h });
  }
  if (type === 'psalm' || type === 'canticle') {
    for (const line of strs(meta.printed_prefix_lines)) {
      const clean = line.replace(/^['’]\s*/, '');
      if (/^[IVXL]+$/.test(clean)) notes.push({ type: 'part', text: clean });
      else if (/^(Ps|Psalm)\s*\d/.test(clean)) { if (out.reference === undefined) out.reference = clean; }
      else notes.push({ type: notes.some((n) => n.type === 'subtitle') ? 'sentence' : 'subtitle', text: clean });
    }
    if (meta.doxology_needed === true && out.doxology === undefined) out.doxology = 'after';
    if (str(meta.doxology_resource_id) !== undefined && out.doxology_ref === undefined) out.doxology_ref = meta.doxology_resource_id;
    if (str(meta.psalm_subpart_label) !== undefined || (typeof out.reference === 'string' && /\d+\s*,\s*\d/.test(out.reference))) missing.add('full_text');
    if (typeof meta.numbering === 'object' || meta.psalm_number_as_printed !== undefined) out.numbering ??= 'as_printed';
  }
  const intro = str(meta.introduction_formula);
  if (intro !== undefined && out.intro_formula === undefined) out.intro_formula = intro;
  const refrain = str(meta.refrain_resource_id);
  if (refrain !== undefined && out.response_ref === undefined) out.response_ref = refrain;
  const group = str(meta.choice_group_source_id);
  if (group !== undefined && out.variant_group === undefined) out.variant_group = group.replace(/[^A-Za-z0-9._:-]/g, '-');

  /* -- Stücke -------------------------------------------------------------------------------------- */
  const pieces: Piece[] = [];
  const lineCounts = Array.isArray(meta.layout_summary) ? meta.layout_summary.map((x) => (isObj(x) && typeof x.pdf_linebreak_count === 'number' ? x.pdf_linebreak_count : undefined)) : [];
  const stanzaNumbers = Array.isArray(meta.stanza_numbers_as_printed) ? meta.stanza_numbers_as_printed : [];
  let linesInferred = false, linesMissing = false;

  body.forEach((b, k) => {
    let cut = cutByMarks(b.text, b.marks, missing);
    if (type === 'hymn' && cut.length === 1 && b.kind === 'stanza') {
      const lines = inferLines(cut[0].text, lineCounts[k]);
      if (lines === null) linesMissing = true;
      else {
        /* Was zwischen zwei Zeilen stand (der Leerraum am Ende der vorigen), bleibt im Brzmienie. */
        cut = lines.map((t, i) => ({ text: t.trim(), ...(i === 0 ? {} : { pre: lines[i - 1].slice(lines[i - 1].trimEnd().length) }) }));
        linesInferred = true;
      }
    }
    cut.forEach((p, i) => {
      const last = i === cut.length - 1;
      const piece: Piece = { ...p, ...(b.verse === undefined ? {} : { verse: b.verse, label: String(b.verse) }), ...(b.role === undefined ? {} : { role: b.role }), ...(b.style === undefined ? {} : { style: b.style }) };
      if (b.kind === 'incipit') { piece.kind = 'incipit'; piece.id = 'incipit'; }
      if (type === 'hymn') {
        piece.end = last ? 'stanza' : 'line';
        if (i === 0 && stanzaNumbers[k] !== undefined) piece.label = String(stanzaNumbers[k]);
      } else if (last && piece.end === undefined) {
        piece.end = b.kind === 'verse' ? 'verse' : b.kind === 'response' ? 'line' : b.kind === 'stanza' || b.kind === 'paragraph' ? 'stanza' : undefined;
      }
      pieces.push(piece);
    });
  });

  let finalPieces = pieces;
  if ((type === 'psalm' || type === 'canticle') && !body.some((b) => b.verse !== undefined) && pieces.some((p) => p.end === 'mediant')) {
    finalPieces = inferVerses(stripEmbeddedDoxology(pieces, missing));
    missing.add('verses_inferred');
  }
  if (type === 'prayer') finalPieces = splitPrayer(finalPieces, missing);
  if (type === 'intercessions') {
    const parsed = splitIntercessions(finalPieces, str(out.response_ref) === undefined);
    if (parsed === null) missing.add('petitions');
    else {
      finalPieces = parsed.pieces;
      out.performance = intercessionSteps(parsed.pieces, str(out.response_ref));
      const after = Array.isArray(meta.refrain_after_source_line) ? meta.refrain_after_source_line.length : undefined;
      if (after !== undefined && after !== parsed.petitions + 1) missing.add('performance_inferred');
    }
    if (str(out.response_ref) === undefined && !finalPieces.some((p) => p.id === 'response')) missing.add('response');
  }
  if (type === 'hymn') { if (linesMissing) missing.add('lines'); else if (linesInferred) missing.add('lines_inferred'); }

  /* Odpowiedzi: wiederholte Zeilen werden zu Verweisen in `performance`, das Brzmienie trägt jede einmal. */
  if ((type === 'responsory' || type === 'dialog' || type === 'versicle') && finalPieces.some((p) => p.role !== undefined)) {
    const folded = foldRepeats(finalPieces);
    finalPieces = folded.pieces;
    if (folded.steps !== null) out.performance = folded.steps;
  }

  /*
   * Das Brzmienie und die Stücke darüber. Innerhalb eines Blocks steht zwischen zwei Stücken genau, was im Original stand
   * (`pre`); zwischen Blöcken, was der Block wollte: Absatz nach Strophe oder Teil, Zeile nach einer Antwort, sonst ein Leerzeichen.
   */
  let text = '';
  finalPieces.forEach((p, k) => {
    if (k > 0) {
      const prev = finalPieces[k - 1];
      text += prev.end === 'stanza' || prev.end === 'part' ? '\n\n' : p.pre !== undefined ? p.pre : prev.end === 'line' && type !== 'hymn' ? '\n' : ' ';
    }
    text += p.text;
  });
  out.text = text;
  out.layout = finalPieces.map(({ text: piece, pre: _pre, ...rest }) => ({ text: piece, ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) }));

  /* Bezeugte andere Teilungen derselben Antiphon (andere Stellen, nicht nur * statt /). */
  const variants = Array.isArray(meta.recitation_mark_variants) ? meta.recitation_mark_variants.filter(isObj) : [];
  if (variants.length > 0 && body.length === 1 && type === 'antiphon') {
    const key = (ms: Mark[]) => ms.filter((m) => m.mark !== '✢' && m.mark !== '✣').map((m) => m.at).sort((a, b) => a - b).join(',');
    const mainKey = key(body[0].marks);
    const seen = new Set([mainKey]);
    const layouts: Raw[] = [];
    for (const v of variants) {
      const ms = Array.isArray(v.marks) ? v.marks.filter((m): m is Mark => isObj(m) && typeof m.at === 'number' && typeof m.mark === 'string') : [];
      const k = key(ms);
      if (seen.has(k)) continue;
      seen.add(k);
      const alt = cutByMarks(body[0].text, ms);
      layouts.push({ id: `attested-${layouts.length + 1}`, source: String(v.surface_sha256 ?? '').slice(0, 16) || undefined, units: alt.map(({ text: t, pre: _pre, ...rest }) => ({ text: t, ...Object.fromEntries(Object.entries(rest).filter(([, x]) => x !== undefined)) })) });
    }
    if (layouts.length > 0) out.layouts = layouts.map((l) => Object.fromEntries(Object.entries(l).filter(([, x]) => x !== undefined)));
  }
  if (notes.length > 0) out.notes = [...(Array.isArray(out.notes) ? out.notes : []), ...notes.map((n) => ({ type: n.type, text: n.text, ...(n.at === undefined ? {} : { at: n.at }) }))];
  if (missing.size > 0) out.missing = [...missing];
  return { raw: out, migrated: true };
}

/* -- Einzelne Regeln ----------------------------------------------------------------------------- */

/** „Iz 1, 16. 18. 17 W. Obmyjcie … K. …" → Stelle und Zeilen mit Rollen; Zeichen wandern mit. */
function splitRoleMarkers(text: string, marks: readonly Mark[]): { reference?: string; lines: { text: string; marks: Mark[]; role: Role }[] } | null {
  const re = /(^|\s)([WKR])\.\s/g;
  const hits: { at: number; end: number; role: Role }[] = [];
  for (let m = re.exec(text); m !== null; m = re.exec(text)) hits.push({ at: m.index + m[1].length, end: m.index + m[0].length, role: m[2] === 'K' ? 'cantor' : 'all' });
  if (hits.length < 2) return null;
  const reference = text.slice(0, hits[0].at).trim() || undefined;
  const lines = hits.map((h, k) => {
    const to = hits[k + 1]?.at ?? text.length;
    const raw = text.slice(h.end, to);
    const lead = raw.length - raw.trimStart().length;
    return { text: raw.trim(), role: h.role, marks: marks.filter((m) => m.at >= h.end && m.at < to).map((m) => ({ at: m.at - h.end - lead, mark: m.mark })) };
  });
  return { ...(reference === undefined ? {} : { reference }), lines };
}

/** Eingebettete „Chwała Ojcu … Amen." aus einem Psalm nehmen (ein eigener Text); davor endet ein Teil. */
function stripEmbeddedDoxology(pieces: Piece[], missing: Set<string>): Piece[] {
  const out: Piece[] = [];
  let skipping = false;
  for (const original of pieces) {
    let p = original;
    const at = skipping ? -1 : p.text.indexOf(DOXOLOGY_START);
    if (at >= 0) {
      /* Was davor steht, beschliesst den Teil; der Rest gehört zur Doxologie (bis „Amen."). */
      const before = p.text.slice(0, at).trim();
      if (before !== '') out.push({ ...p, text: before, end: 'part' });
      else if (out.length > 0) out[out.length - 1] = { ...out[out.length - 1], end: 'part' };
      p = { ...p, text: p.text.slice(at), cross: undefined };
      skipping = true;
      missing.add('doxology_removed');
    }
    if (skipping) {
      const amen = p.text.indexOf('Amen.');
      if (amen < 0) continue;
      skipping = false;
      const rest = p.text.slice(amen + 5).trim();
      if (rest !== '') out.push({ ...p, text: rest });
      continue;
    }
    out.push(p);
  }
  return out;
}

/** Ein Gebet: Hauptteil — Schluss (die Formel gehört zum Gebet) — Amen (die Antwort, W.). */
function splitPrayer(pieces: Piece[], missing: Set<string>): Piece[] {
  const out: Piece[] = [];
  let inConclusion = false;
  for (const p of pieces) {
    let rest = p;
    if (!inConclusion) {
      const m = CONCLUSION.exec(` ${rest.text}`);
      if (m !== null && m.index > 0) {
        /* Geteilt, ohne den Wortlaut zu ändern (`splitPiece`). */
        const [bodyPart, conclusionPart] = splitPiece(rest, m.index);
        out.push({ ...bodyPart, kind: 'body' });
        rest = conclusionPart;
        inConclusion = true;
      } else if (m !== null) inConclusion = true;
    }
    const amen = /\s?Amen\.?$/.exec(rest.text);
    if (amen !== null && rest.text.trim() !== 'Amen.' && rest.text.trim() !== 'Amen') {
      const [said, answer] = splitPiece(rest, amen.index);
      out.push({ ...said, kind: inConclusion ? 'conclusion' : 'body' });
      out.push({ text: answer.text, pre: answer.pre, kind: 'response', role: 'all', id: 'amen' });
      continue;
    }
    out.push({ ...rest, kind: rest.kind ?? (inConclusion ? 'conclusion' : 'body') });
  }
  if (!out.some((p) => p.kind === 'conclusion')) missing.add('conclusion');
  const filtered = out.filter((p) => p.text !== '');
  const conclusion = filtered.find((p) => p.kind === 'conclusion');
  if (conclusion !== undefined && conclusion.id === undefined) conclusion.id = 'conclusion';
  return filtered;
}

/** Bitten: Einleitung bis zum Doppelpunkt; dann je Bitte „erster Teil — zweiter Teil." (der Strich ist ein Zeichen, kein Wortlaut). */
function splitIntercessions(pieces: Piece[], keepResponse: boolean): { pieces: Piece[]; petitions: number; inlineResponse: boolean } | null {
  const all = pieces.map((p) => p.text).join(' ');
  const colon = all.indexOf(':');
  if (colon < 0 || !all.includes(' — ')) return null;
  const intro = all.slice(0, colon + 1).trim();
  let rest = all.slice(colon + 1).trim();
  const out: Piece[] = [{ text: intro, kind: 'intro', role: 'presider', id: 'intro', end: 'line' }];
  /* Steht der Ruf gleich nach der Einleitung (ein Satz vor der ersten Bitte), ist er die gemeinsame Antwort. */
  let inlineResponse = false;
  const firstDash = rest.indexOf(' — ');
  const stops = [...rest.slice(0, firstDash).matchAll(/[.!?](?=\s)/g)];
  if (stops.length > 0) {
    const end = (stops[stops.length - 1].index ?? 0) + 1;
    if (keepResponse) out.push({ text: rest.slice(0, end).trim(), kind: 'response', role: 'all', id: 'response', end: 'line' });
    inlineResponse = true;
    rest = rest.slice(end).trim();
  }
  let n = 0;
  let pos = 0;
  while (pos < rest.length) {
    const dash = rest.indexOf(' — ', pos);
    if (dash < 0) { const tail = rest.slice(pos).trim(); if (tail !== '') out.push({ text: tail, kind: 'petition', role: 'presider', end: 'line' }); break; }
    const first = rest.slice(pos, dash).trim();
    const afterDash = dash + 3;
    const nextDash = rest.indexOf(' — ', afterDash);
    const window = rest.slice(afterDash, nextDash < 0 ? rest.length : nextDash);
    let endAt = window.length;
    if (nextDash >= 0) {
      const stops = [...window.matchAll(/[.!?]\s/g)];
      if (stops.length > 0) endAt = (stops[stops.length - 1].index ?? window.length) + 1;
    }
    n++;
    out.push({ text: first, kind: 'petition', role: 'presider', id: `p${n}` });
    out.push({ text: window.slice(0, endAt).trim(), kind: 'petition_response', role: 'all', id: `p${n}b`, end: 'line' });
    pos = afterDash + endAt;
  }
  return n === 0 ? null : { pieces: out, petitions: n, inlineResponse };
}

/** Der Vortrag der Bitten: Einleitung, Ruf; je Bitte beide Teile und der Ruf (OWLG 190–193). Der Ruf: eigener Text oder Einheit. */
function intercessionSteps(pieces: readonly Piece[], response: string | undefined): Step[] {
  const inText = pieces.some((p) => p.id === 'response');
  const say = (): Step | null => (response !== undefined ? { resource: response, role: 'all' } : inText ? { say: ['response'], role: 'all' } : null);
  const steps: Step[] = [{ say: ['intro'], role: 'presider' }];
  const first = say();
  if (first !== null) steps.push(first);
  for (const p of pieces) {
    if (p.kind !== 'petition' || p.id === undefined) continue;
    steps.push({ say: [p.id], role: 'presider' });
    if (pieces.some((x) => x.id === `${p.id}b`)) steps.push({ say: [`${p.id}b`], role: 'all' });
    const again = say();
    if (again !== null) steps.push(again);
  }
  return steps;
}

/**
 * Wechselgesang: jede Zeile, die schon da war (ganz oder ihr Teil nach der Mediante), wird ein Verweis. Das Brzmienie
 * behält jede Zeile einmal; `performance` sagt, wer was wann wiederholt.
 */
function foldRepeats(pieces: Piece[]): { pieces: Piece[]; steps: Step[] | null } {
  const kept: Piece[] = [];
  const steps: Step[] = [];
  let repeats = 0;
  let n = 0;
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  /* Zeilen sind die Stücke bis zu einem Ende `line` (eine Zeile kann eine Mediante tragen). */
  const lines: Piece[][] = [];
  let cur: Piece[] = [];
  for (const p of pieces) { cur.push(p); if (p.end === 'line' || p.end === 'stanza' || p.end === 'verse') { lines.push(cur); cur = []; } }
  if (cur.length > 0) lines.push(cur);
  for (const line of lines) {
    const whole = norm(line.map((p) => p.text).join(' '));
    const role = line[0].role;
    const match = findEarlier(kept, whole, norm);
    if (match !== null) { repeats++; steps.push({ say: match, ...(role === undefined ? {} : { role }) }); continue; }
    const ids: string[] = [];
    for (const p of line) { n++; const id = p.id ?? `l${n}`; kept.push({ ...p, id }); ids.push(id); }
    steps.push({ say: ids, ...(role === undefined ? {} : { role }) });
  }
  return { pieces: kept, steps: repeats > 0 || pieces.some((p) => p.role !== undefined) ? steps : null };
}

/** Gibt es diese Zeile schon — ganz (eine oder mehrere Einheiten) oder als ihr Teil nach einer Mediante? */
function findEarlier(kept: readonly Piece[], whole: string, norm: (s: string) => string): string[] | null {
  for (let i = 0; i < kept.length; i++) {
    let acc = '';
    for (let j = i; j < kept.length; j++) {
      acc = norm(`${acc} ${kept[j].text}`);
      if (acc === whole) return kept.slice(i, j + 1).map((p) => p.id!);
      if (acc.length >= whole.length) break;
    }
  }
  return null;
}
