/**
 * 2026-10-27 — DER BERICHT FÜR DEN ASSISTENTEN, in Worten (Markdown, Englisch;
 * was die Anwendung selbst sagt — Plan, Warnungen, Sätze der Bausteine — steht
 * wörtlich auf Polnisch, so wie es der Mensch beim Import liest).
 *
 * Bild und Bericht tragen dieselben Namen: M1, M2 … für Bausteine in der Folge
 * der Seite, S1, S2 … für Slajdy, die Kennung einer Szene mit ihrem Schritt.
 */

const KIND_WORD = { unknown: 'unknown', dropped: 'dropped', changed: 'changed' };

const sizeWord = (s) => `${s.colSpan}×${s.rowSpan} ${s.width}·${s.height}${s.folded ? ' (folded: title + button)' : ''}`;

/**
 * Ein Baustein in einer Zeile: was er ist, wo er im Dokument stand — und je
 * nach Art der Seite seine Grösse im Raster (je Bildschirm), als Slajd, oder
 * seine Plätze auf den Szenen.
 */
export function moduleLine(m, mode = 'page') {
  const where = m.docIndex === null ? 'already on the page' : `modules[${m.docIndex}]`;
  const title = m.title === '' ? '' : ` „${m.title}”`;
  let body;
  if (mode === 'slides') {
    body = m.slide.stage ? 'travels on the stage over the slides' : m.slide.beside !== null ? 'stands beside another slide’s module' : `own slide „${m.slide.label}”; shows: ${m.slideShows}`;
  } else if (mode === 'presentation') {
    body = m.show === null ? 'NOT on any scene — not shown'
      : `on ${Object.entries(m.show.places).map(([key, p]) => `${key} (x ${p.x}% y ${p.y}% w ${p.w}%)`).join(', ')}; skin ${m.show.skin}, type ${m.show.type}${m.show.travels ? ', travels' : ''}; shows: ${m.show.shows}${m.show.go.length > 0 ? `; buttons: ${m.show.go.join(', ')}` : ''}`;
  } else {
    const d = m.sizes.desktop, t = m.sizes.tablet, p = m.sizes.mobile;
    const shows = d.shows === p.shows ? `shows: ${d.shows}` : `desktop shows: ${d.shows} · phone shows: ${p.shows}`;
    body = `desktop ${sizeWord(d)} · tablet ${sizeWord(t)} · phone ${sizeWord(p)}; ${shows}`;
  }
  const flags = [
    m.known ? null : 'UNKNOWN KIND — the page shows „Moduł … nie jest znany”',
    m.visible ? null : 'HIDDEN for visitors (nothing to show)',
    m.missing === null ? null : `missing: ${m.missing}`,
    m.fullscreen && mode !== 'presentation' ? 'has a full-screen button' : null
  ].filter((one) => one !== null);
  return `- **M${m.n}** ${m.kind} (${m.label})${title} — ${where}; ${body}${flags.length === 0 ? '' : ` — ${flags.join('; ')}`}`;
}

function slidePart(m) {
  const s = m.slide;
  const bits = [
    s.transition !== 'scroll' ? `transition ${s.transition}` : null,
    s.enter !== 'none' ? `enter ${s.enter}` : null,
    s.layers > 0 ? `${s.layers} layer(s)` : null,
    s.motion > 0 ? `${s.motion} motion(s)` : null,
    s.stage ? 'on the stage (travels over slides)' : null,
    s.beside !== null ? 'beside another slide' : null
  ].filter((one) => one !== null);
  return bits.length === 0 ? '' : ` (${bits.join(', ')})`;
}

/** Was der Import sagen würde, was er nicht nimmt, und alle Bausteine — ohne Bilder. */
export function checkText(check, { renderer }) {
  const out = [];
  const modeWord = { page: 'page with modules', slides: 'slides', presentation: 'presentation' }[check.mode] ?? check.mode;
  out.push(`# ${check.kind === 'page' ? 'Page' : check.kind === 'legacy' ? 'Legacy event document' : `Single ${check.kind}`} → /${check.path} · ${modeWord}`);
  out.push(`Renderer: ${renderer} · title: ${check.title === null ? '— (none: the import saves no title or lead)' : `„${check.title}”`} · theme: ${check.theme === 'auto' ? 'auto (follows the device: light or dark)' : check.theme}${check.menu === null ? '' : ` · menu: ${check.menu.items} item(s)${check.menu.from === null ? '' : ` from „${check.menu.from}”`}`}`);
  out.push('', '## What the import would do (the app’s own plan)');
  for (const line of check.lines) out.push(`- ${line}`);
  if (check.warnings.length > 0) {
    out.push('', `## Import warnings (${check.warnings.length})`);
    for (const line of check.warnings) out.push(`- ${line}`);
  }
  if (check.lint.length > 0) {
    out.push('', `## Keys the import ignores or reads differently (${check.lint.length})`);
    for (const one of check.lint.slice(0, 60)) out.push(`- ${KIND_WORD[one.kind] ?? one.kind} \`${one.path}\` — ${one.detail}`);
    if (check.lint.length > 60) out.push(`- … and ${check.lint.length - 60} more (report.json)`);
  } else out.push('', 'Every key in the document is read by the import.');
  if (check.notes.length > 0) {
    out.push('', '## How the preview differs from the imported page');
    for (const line of check.notes) out.push(`- ${line}`);
  }
  if (check.needs.length > 0) {
    out.push('', `## Files the document asks for ("images": ${check.needs.length})`);
    for (const n of check.needs) out.push(`- \`page-image:@${n.key}\` ${n.kind} „${n.label}”${n.description === '' ? '' : ` — ${n.description}`} (used ${n.uses}×${n.declared ? '' : ', not described in "images"'})`);
  }
  const grid = check.mode === 'page' ? '; grid: desktop 6 columns, tablet 4, phone 2' : check.mode === 'slides' ? '; each module is a full screen' : '; places in % of the stage';
  out.push('', `## Modules (${check.modules.length}) — M# is the order on the page${grid}`);
  for (const m of check.modules) out.push(`${moduleLine(m, check.mode)}${check.mode === 'slides' ? slidePart(m) : ''}`);

  if (check.deck !== null) {
    out.push('', `## Slides (${check.deck.slides.length})`);
    const number = new Map(check.modules.map((m) => [m.id, m.n]));
    check.deck.slides.forEach((s, i) => {
      out.push(`- S${i + 1} „${s.label}”${s.modules.length === 0 ? ' — title slide (page title and lead)' : ` — ${s.modules.map((id) => `M${number.get(id)}`).join(' + ')}`}`);
    });
    if (check.deck.stage.length > 0) out.push(`- On the stage over all slides: ${check.deck.stage.map((id) => `M${number.get(id)}`).join(', ')}`);
  }
  if (check.show !== null) {
    const s = check.show;
    out.push('', `## Presentation — ${s.scenes.length} scene(s), format ${s.format}, nav ${s.nav}${s.backdrop > 0 ? `, shared backdrop ${s.backdrop} layer(s)` : ''}${s.story ? ', storyboard (gates/questions)' : ''}`);
    out.push(`- Route without buttons: ${s.route.join(' → ') || '—'}`);
    if (s.offRoute.length > 0) out.push(`- Reached only through buttons: ${s.offRoute.join(', ')}`);
    if (s.unreachable.length > 0) out.push(`- UNREACHABLE (no way leads there): ${s.unreachable.join(', ')}`);
    for (const scene of s.scenes) {
      out.push(`- scene \`${scene.key}\`${scene.label === '' ? '' : ` „${scene.label}”`}: ${scene.steps} step(s), change ${scene.change}${scene.next === null ? '' : `, next → ${scene.next}`}${scene.layers > 0 ? `, ${scene.layers} layer(s)` : ''}; pieces ${scene.pieces.length === 0 ? '—' : scene.pieces.map((n) => `M${n}`).join(' ')}${scene.hint === '' ? '' : `; hint „${scene.hint}”`}`);
    }
  }
  return out.join('\n');
}

/** Was an einem Baustein auf diesem Bild auffällt — kurz. */
function itemLine(item, label, view) {
  const r = item.rect;
  const where = view === 'page' || view === 'matrix'
    ? `y ${r.y}–${r.y + r.h} (h ${r.h}), x ${r.x}, w ${r.w}`
    : `at ${r.x},${r.y} size ${r.w}×${r.h}${item.opacity < 0.98 ? `, opacity ${item.opacity}` : ''}`;
  const bits = [];
  if (item.folded) bits.push('folded (title + button)');
  if (item.says.length > 0) bits.push(`says „${item.says.join(' / ')}”`);
  if (item.images.total > 0) bits.push(`${item.images.total} image(s)${item.images.placeholder > 0 ? `, ${item.images.placeholder} placeholder(s)` : ''}`);
  const issues = item.findings.map((f) => `⚠ ${f.kind}: ${f.detail}`);
  return `- ${label} — ${where}${bits.length === 0 ? '' : ` · ${bits.join(' · ')}`}${issues.length === 0 ? '' : `\n  ${issues.join('\n  ')}`}`;
}

/**
 * Eine Aufnahme (Seite, Slajd, Schritt einer Szene) in Worten. Auf der Seite
 * jeder Baustein mit seinem Platz; auf Slajdy und Szenen eine Zeile, was zu
 * sehen ist, und ausführlich nur, woran etwas nicht stimmt.
 */
export function captureText(capture, labels) {
  const m = capture.measure;
  const out = [];
  const label = (id) => labels[id] ?? id.slice(0, 8);
  if (capture.view === 'page' || capture.view === 'matrix') {
    for (const item of m.items) out.push(itemLine(item, label(item.id), capture.view));
  } else {
    const seen = m.items.map((item) => `${label(item.id).split(' ')[0]}${item.opacity < 0.98 ? ` (${item.opacity})` : ''}`);
    out.push(`- visible: ${seen.length === 0 ? 'nothing' : seen.join(', ')}`);
    for (const item of m.items) if (item.findings.length > 0 || item.says.length > 0) out.push(itemLine(item, label(item.id), capture.view));
  }
  for (const o of m.overlaps) out.push(`- ⚠ overlap: ${label(o.a)} and ${label(o.b)} cover each other (${Math.round(o.share * 100)}% of the smaller one)`);
  if (m.overflowX > 1) out.push(`- ⚠ the page is ${m.overflowX} px wider than the screen (sideways scrolling): ${m.culprits.map((c) => `${c.id === null ? '' : `${label(c.id)} `}${c.what} +${c.right} px`).join('; ')}`);
  if (m.loading > 0) out.push(`- ⚠ ${m.loading}× still „Wczytywanie…” when the picture was taken`);
  for (const n of m.notices) out.push(`- page says: „${n}”`);
  return out;
}

export function viewHeading(view) {
  const v = view.vp;
  const cols = v.width < 640 ? 2 : v.width < 1024 ? 4 : 6;
  return `## ${v.name} ${v.width}×${v.height} · ${view.scheme}${view.reduced ? ' · reduced motion' : ''} — ${view.view}${view.view === 'page' ? ` (${cols} columns)` : ''}${view.settled.settled ? '' : ` — ⚠ still loading after ${Math.round(view.settled.ms / 1000)} s: ${view.settled.waiting.join(', ')}`}`;
}

/** Was die Seite vom Dienst holte und was in die Konsole ging. */
export function sideText(view) {
  const out = [];
  const live = view.fetches.filter((f) => f.via === 'live' || f.via === 'offline' || f.via === 'blocked');
  if (live.length > 0) {
    const seen = new Map();
    for (const f of live) seen.set(`${f.method} ${f.path.split('?')[0]} ${f.status} ${f.via}`, (seen.get(`${f.method} ${f.path.split('?')[0]} ${f.status} ${f.via}`) ?? 0) + 1);
    out.push(`- service requests: ${[...seen].slice(0, 12).map(([k, n]) => `${k}${n > 1 ? ` ×${n}` : ''}`).join('; ')}`);
  }
  const errors = view.console.filter((c) => c.level !== 'warning');
  if (errors.length > 0) {
    const unique = [...new Set(errors.map((c) => c.text.split('\n')[0]))];
    out.push(`- ⚠ console: ${errors.length} error(s) — ${unique.slice(0, 4).map((t) => `„${t.slice(0, 200)}”`).join('; ')}`);
  }
  return out;
}

/* -- 2026-11-03: eine Baza wiedzy aus JSON (preview_knowledge) ----------------------------------------------------- */

const MOOD_WORD = { known: 'known', due: 'due', forgotten: 'forgotten', wrong: 'last answered wrong', new: 'new' };

/** Was die Baza ist: Import (Plan, Warnungen), Rodzaje, Karten, Reihenfolge des Lernens, Widoki. */
export function knowledgeText(summary, { renderer }) {
  const out = [];
  out.push(`# Knowledge base „${summary.name}” (${summary.format || 'no "format"'})`);
  out.push(`Renderer: ${renderer} · imported into a memory store (nothing is saved, no service) · ${summary.entries} entr${summary.entries === 1 ? 'y' : 'ies'}, ${summary.questions} question(s), ${summary.templates} card template(s), ${summary.revisions} revision(s), ${summary.cards} card(s)`);
  out.push(`- kinds: ${summary.kinds.map((k) => `${k.name} ${k.count}`).join(', ') || '—'}`);
  out.push(`- learning order: ${summary.levels === 0 ? 'none declared (no "prerequisite" fields, no dependencies) — a landscape puts everything not learned on the ring' : `${summary.levels} level(s) from the fundamentals`}`);
  if (summary.circles.length > 0) out.push(`- ⚠ cycles in the learning order (the edge that closes a cycle is dropped; the app lists it under „Do zrobienia”): ${summary.circles.slice(0, 8).join('; ')}${summary.circles.length > 8 ? ` … +${summary.circles.length - 8}` : ''}`);
  out.push(`- views: ${summary.views.length === 0 ? 'none' : summary.views.map((v) => `${v.ref ?? v.id} „${v.name}” (${v.mode})`).join('; ')}`);
  out.push(`- modes this build draws: ${summary.modes.join(', ')}`);
  out.push('', '## What the import would do (the app’s own plan)');
  for (const line of summary.lines) out.push(`- ${line}`);
  if (summary.warnings.length > 0) {
    /* Warnungen derselben Gestalt (nur die Namen in „…” anders) einmal, mit ihrer Zahl und einem Beispiel. */
    const shapes = new Map();
    for (const w of summary.warnings) {
      const shape = w.replace(/„[^”]*”/g, '„…”').replace(/@[\w/.-]+/g, '@…').replace(/\b\d+\b/g, 'N');
      const had = shapes.get(shape);
      if (had === undefined) shapes.set(shape, { first: w, n: 1 }); else had.n += 1;
    }
    const library = [...shapes.values()].filter((s) => /bibliotek|dzieła/.test(s.first));
    out.push('', `## Import warnings (${summary.warnings.length}, ${shapes.size} kind${shapes.size === 1 ? '' : 's'})`);
    for (const s of [...shapes.values()].slice(0, 30)) out.push(`- ${s.n > 1 ? `${s.n}× like: ` : ''}${s.first}`);
    if (shapes.size > 30) out.push(`- … and ${shapes.size - 30} more kinds`);
    if (library.length > 0) out.push('- (references to works of a library lead nowhere here — the preview has no library; in the app the base must use that library as a source)');
  }
  return out.join('\n');
}

/** Ein Bild der Baza: welcher Widok, welcher Fortschritt, was gemessen wurde. */
export function knowledgeCaptureText(capture) {
  const r = capture.loaded;
  const v = capture.vp;
  const out = [];
  const counts = Object.entries(r.progress.counts).filter(([, n]) => n > 0).map(([k, n]) => `${MOOD_WORD[k] ?? k} ${n}`).join(', ');
  out.push(`## ${r.progress.name} · ${v.name} ${v.width}×${v.height} · ${capture.scheme} — view „${r.shown.name}” as ${r.shown.mode}${r.settled.settled ? '' : ` — ⚠ still loading after ${Math.round(r.settled.ms / 1000)} s: ${r.settled.waiting.join(', ')}`}`);
  out.push(`- progress: ${r.progress.label}${counts === '' ? '' : ` — cards: ${counts}`}`);
  if (r.shown.note !== null) out.push(`- note: ${r.shown.note}`);
  const m = capture.measure;
  out.push(`- page ${m.page.w}×${m.page.h} px`);
  for (const item of m.items) {
    /* Der Widok ist keine Kachel fester Grösse: was „herausragt" oder „leer bleibt", sagt hier nichts. */
    const issues = item.findings.filter((f) => f.kind !== 'spills' && f.kind !== 'sparse').map((f) => `⚠ ${f.kind}: ${f.detail}`);
    out.push(`- V1 (the view) — ${item.rect.w}×${item.rect.h} px${item.says.length > 0 ? ` · says „${item.says.join(' / ')}”` : ''}${issues.length === 0 ? '' : `\n  ${issues.join('\n  ')}`}`);
  }
  if (m.overflowX > 1) out.push(`- ⚠ the page is ${m.overflowX} px wider than the screen (sideways scrolling): ${m.culprits.map((c) => `${c.what} +${c.right} px`).join('; ')}`);
  if (m.loading > 0) out.push(`- ⚠ ${m.loading}× still „Wczytywanie…” when the picture was taken`);
  const errors = capture.console.filter((c) => c.level !== 'warning');
  if (errors.length > 0) out.push(`- ⚠ console: ${errors.length} error(s) — ${[...new Set(errors.map((c) => c.text.split('\n')[0]))].slice(0, 3).map((t) => `„${t.slice(0, 200)}”`).join('; ')}`);
  return out;
}

const valueWord = (v) => (Array.isArray(v) ? `[${v.map(valueWord).join(', ')}]` : typeof v === 'string' ? v : JSON.stringify(v));

/** Die Generatoren mit ihren Proben. */
export function samplesText(samples) {
  const out = [];
  if (samples === null) return out;
  /* 2026-11-05 (Prompt 23, D3) — die Rysunki do poruszania: geprüft wie beim Import, die Lösung bis zum Ende gerechnet. */
  const drawings = samples.drawings ?? [];
  if (drawings.length > 0) {
    out.push('', `# Interactive drawings (${drawings.length})`);
    for (const d of drawings) {
      const goal = d.goals.length > 0 ? `goals in order: ${d.goals.join(' → ')}` : d.goal !== null ? `goal: ${d.goal}` : 'goal: the drawing rules with "goal": true';
      const sol = d.solution === null ? 'no solution' : `solution ${Object.entries(d.solution).map(([k, v]) => `${k}=${valueWord(v)}`).join(', ')}`;
      const verdict = d.solved === null ? '' : d.solved ? ' → the solution REACHES the goal ✓' : ' → ⚠ the solution does NOT reach the goal';
      out.push(`- ${d.ref ?? d.id} „${d.name}” — ${goal} · check ${d.check} · ${d.controls} control(s) · ${sol}${verdict}`);
      for (const p of d.problems.slice(0, 5)) out.push(`  - ⚠ ${p}`);
    }
    out.push('To see a drawing move: preview_page with a page module "animation" holding the same drawing JSON.');
  }
  const gens = samples.generators;
  out.push('', `# Generators (${gens.length})`);
  if (gens.length === 0) {
    out.push('No question with "params"/"let" and no card template with a "random" or "generate" node.');
    return out;
  }
  const failing = gens.filter((g) => g.problems.length > 0 || g.made < g.tried);
  if (failing.length > 0) {
    out.push(`## Failing generators (${failing.length})`);
    for (const g of failing) out.push(`- ⚠ ${g.kind} ${g.ref ?? g.id} „${g.name}” — ${g.made}/${g.tried} instance(s)${g.problems.length > 0 ? `: ${g.problems.slice(0, 3).join(' | ')}` : ''}`);
  }
  for (const g of gens) {
    out.push('', `## ${g.kind === 'question' ? 'Question' : 'Template'} ${g.ref ?? g.id} „${g.name}” — ${g.made}/${g.tried} instance(s)${g.draws === null ? '' : ` · draws per instance ≈ ${String(g.draws)}${g.draws > 1.5 ? ' (many redraws: widen the ranges or soften "require")' : ''}`}`);
    g.samples.forEach((s, i) => {
      const values = s.values === undefined ? '' : ` · values ${Object.entries(s.values).map(([k, v]) => `${k}=${valueWord(v)}`).join(', ')}`;
      out.push(`${i + 1}. ${s.entry === undefined ? '' : `[${s.entry}] `}${s.prompt || '(no prompt text)'} → **${s.answer}**${s.options === undefined ? '' : ` · options: ${s.options.join(' / ')}`}${values}`);
      /* Hints and solution of the first few instances — enough to see whether the values landed in them. */
      if (i < 3 && (s.hints !== undefined || s.explanation !== undefined)) {
        out.push(`   ${[s.hints === undefined ? '' : `hints: ${s.hints.join(' / ')}`, s.explanation === undefined ? '' : `solution: ${s.explanation}`].filter(Boolean).join(' · ')}`);
      }
    });
  }
  return out;
}
