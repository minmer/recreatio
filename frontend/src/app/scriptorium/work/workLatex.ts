/**
 * DAS WERK GEDRUCKT (2026-11-15) — ein Projekt entlang EINES Weges (einer Ausgabe), ein Teil davon oder eine
 * Einheit, als LaTeX, das den Baum der Struktur spiegelt: jede Ebene wird zu ihrem Befehl (`levels[].latex`:
 * \part, \chapter, \section …), die Klasse folgt dem Projekt (Buch, Artikel, Heft mit Predigten, Blatt einer Lekcja).
 *
 * Dazu: ein Glossar der Begriffe mit Definition (und wo sie eingeführt werden), ein Register der Personen, Orte,
 * Begriffe mit den Seiten der Knoten, an denen sie auf diesem Weg vorkommen (von Hand gebaut — kein makeindex),
 * die Quellen aus der Bibliothek, Verweise über feste Etiketten (`\label{n:<kennung>}`), Zusammenfassungen sichtbar
 * markiert, auf Wunsch die Übersicht der Dimensionen als Tabelle. Im Entwurf stehen Zweck, Rolle und Kernsatz unter
 * den Überschriften, Ungeschriebenes als Platzhalter, die Befunde der Prüfung am Rand; die Endfassung ist sauber.
 *
 * Die Sprache des Dokuments ist die des Projekts (`lang`): babel und jedes Wort, das der Druck selbst schreibt
 * (`withLang`). Nur Standardpakete — es übersetzt mit pdflatex und lualatex.
 */

import { appLang, loadLang, t, withLang, type Lang } from '../../core/i18n';
import { str, type LibEntry } from '../../library/libraryKinds';
import { parseMarkup } from '../../library/libraryMarkup';
import { planOf } from '../sermon';
import { blocks, latexEscape, newLatexCtx, planLatex, PREAMBLE, sources, type Ctx } from '../latex';
import { checkPath, type Finding } from './workChecks';
import type { WorkKnowledge } from './workKnowledge';
import { occurrencesOf, textOf, type MarkLook } from './workMarks';
import { dimensionTable, levelOf, pathOf, pathsThrough, readWork, roleOf, type Placed, type WorkModel, type WorkPath } from './workModel';

export interface WorkLatexOptions {
  /** Der Weg (Schlüssel); fehlt er: der erste. */
  readonly path?: string;
  /** Nur dieser Knoten mit allem darunter. */
  readonly node?: string;
  readonly mode: 'draft' | 'final';
  /** Die Übersicht der Dimensionen als Tabelle. */
  readonly dimensionTable?: boolean;
  readonly author?: string;
}

const langOfProject = (project: LibEntry): Lang | null => {
  const lang = str(project.data, 'lang');
  return lang === 'pl' || lang === 'de' || lang === 'en' ? lang : null;
};

/** Die Sprache des Werks laden, bevor gedruckt wird (die Wörter des Drucks stehen in ihr). */
export async function workLatexReady(project: LibEntry): Promise<void> {
  const lang = langOfProject(project);
  if (lang !== null) await loadLang(lang);
}

/** Welche Befehle eine Klasse kennt. */
const ARTICLE_LEVELS = ['part', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];
const BOOK_LEVELS = ['part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];

/** DAS WERK ALS EIN `.tex`. */
export function workToLatex(project: LibEntry, look: MarkLook, knowledge: WorkKnowledge, options: WorkLatexOptions): string {
  return withLang(langOfProject(project) ?? appLang(), () => build(project, look, knowledge, options));
}

function build(project: LibEntry, look: MarkLook, knowledge: WorkKnowledge, options: WorkLatexOptions): string {
  const model = readWork(project, look);
  const cls = str(project.data, 'latexClass') || 'book';
  const bookLike = cls === 'book' || cls === 'booklet';
  const draft = options.mode === 'draft';
  const startNode = options.node === undefined ? undefined : model.nodes.get(options.node);
  /* Ein Knoten, der nicht auf dem gewählten Weg liegt: der erste Weg durch ihn. */
  let path: WorkPath = pathOf(model, options.path);
  if (startNode !== undefined && !pathsThrough(model, startNode).some((p) => p.key === path.key)) path = pathsThrough(model, startNode)[0] ?? path;
  const occurrences = occurrencesOf(model, look, knowledge);
  const report = checkPath({ model, look, knowledge, occurrences }, path);
  const all = report.register.placed;
  const placed = startNode === undefined ? all : subtreeOf(all, startNode.id);
  const ctx = newLatexCtx(look, str(project.data, 'citationStyle') === 'authorYear' ? 'authorYear' : 'notes');
  const allowed = bookLike ? BOOK_LEVELS : ARTICLE_LEVELS;
  const findings = new Map<string, Finding[]>();
  for (const f of report.findings) if (f.node !== undefined) findings.set(f.node, [...(findings.get(f.node) ?? []), f]);

  /* Jede Ebene druckt mit ihrem Befehl — auch ein einzelner Teil: ein Kapitel bleibt ein Kapitel. Was die Klasse nicht kennt, rückt nach. */
  const levelCmd = (depth: number): string => {
    const wanted = levelOf(model, depth).latex;
    return allowed.includes(wanted) ? wanted : wanted === 'chapter' ? 'section' : 'subparagraph';
  };

  const body: string[] = [];
  for (const at of placed) body.push(nodeLatex(model, at, look, ctx, levelCmd(at.node.depth), draft, findings.get(at.node.id) ?? []));

  const glossary = glossaryLatex(knowledge, report.register, placed);
  const index = indexLatex(knowledge, report.register, placed, bookLike);
  const dims = options.dimensionTable === true ? dimensionsLatex(model, bookLike) : '';
  const heading = (title: string) => (bookLike ? `\\chapter*{${latexEscape(title)}}\n\\addcontentsline{toc}{chapter}{${latexEscape(title)}}` : `\\section*{${latexEscape(title)}}\n\\addcontentsline{toc}{section}{${latexEscape(title)}}`);
  const title = startNode === undefined ? str(project.data, 'title') || t('workLatex.untitled') : startNode.title || t('workLatex.untitled');
  const subtitle = [startNode === undefined ? str(project.data, 'subtitle') : str(project.data, 'title'), path.name].filter((s) => s.trim() !== '').join(' — ');
  const geometry = cls === 'booklet'
    ? (draft ? '\\usepackage[a5paper,margin=1.6cm,right=4.2cm,marginparwidth=3cm]{geometry}' : '\\usepackage[a5paper,margin=1.6cm]{geometry}')
    : cls === 'handout'
      ? (draft ? '\\usepackage[a4paper,margin=1.8cm,right=5.5cm,marginparwidth=4cm]{geometry}' : '\\usepackage[a4paper,margin=1.8cm]{geometry}')
      : (draft ? '\\usepackage[a4paper,right=6cm,marginparwidth=4.5cm]{geometry}' : '');
  const preamble = (bookLike ? PREAMBLE('book') : PREAMBLE('article'))
    .replace('[11pt,a4paper', cls === 'booklet' ? '[10pt,a5paper' : cls === 'handout' ? '[10pt,a4paper' : '[11pt,a4paper');
  const toc = placed.length > 3 && cls !== 'handout';

  return [
    preamble,
    geometry,
    '\\setcounter{secnumdepth}{3}',
    '\\setcounter{tocdepth}{2}',
    draft ? '\\setlength{\\marginparsep}{0.6em}' : '',
    '',
    `\\title{${latexEscape(title)}${subtitle === '' ? '' : `\\\\\\large ${latexEscape(subtitle)}`}}`,
    `\\author{${latexEscape(options.author ?? '')}}`,
    `\\date{${draft ? latexEscape(t('workLatex.draft')) : ''}}`,
    '',
    '\\begin{document}',
    cls === 'handout' ? `\\noindent{\\Large\\bfseries ${latexEscape(title)}}\\par${subtitle === '' ? '' : `\\noindent ${latexEscape(subtitle)}\\par`}\\medskip` : '\\maketitle',
    !bookLike || str(project.data, 'description') === '' || startNode !== undefined ? '' : `\\begin{center}\\begin{minipage}{0.8\\linewidth}\\small ${latexEscape(str(project.data, 'description'))}\\end{minipage}\\end{center}`,
    toc ? '\\tableofcontents' : '',
    dims === '' ? '' : `${heading(t('workLatex.dimensions'))}\n${dims}`,
    '',
    body.join('\n\n'),
    '',
    glossary === '' ? '' : `${heading(t('workLatex.glossary'))}\n${glossary}`,
    index === '' ? '' : `${heading(t('workLatex.index'))}\n${index}`,
    sources(ctx, heading(t('workLatex.sources'))),
    '\\end{document}',
    ''
  ].filter((line, i, list) => !(line === '' && list[i - 1] === '')).join('\n');
}

/** Die Stellen eines Teilbaums auf dem Weg. */
function subtreeOf(placed: readonly Placed[], id: string): Placed[] {
  const start = placed.findIndex((p) => p.node.id === id);
  if (start < 0) return [];
  const out: Placed[] = [placed[start]];
  for (let i = start + 1; i < placed.length && placed[i].node.depth > placed[start].node.depth; i += 1) out.push(placed[i]);
  return out;
}

/** Ein Rahmen über die ganze Zeilenbreite — ohne Paket. */
const framed = (inner: string): string =>
  `\\par\\noindent\\fbox{\\parbox{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule\\relax}{\\small ${inner}}}\\par\\medskip`;

function nodeLatex(model: WorkModel, at: Placed, look: MarkLook, ctx: Ctx, cmd: string, draft: boolean, findings: readonly Finding[]): string {
  const node = at.node;
  const title = latexEscape(node.title || t('workLatex.untitled'));
  const out: string[] = [`\\${cmd}{${title}}\\label{n:${node.id}}`];
  const role = roleOf(model, node.role);
  if (role?.brings === 'nothing') out.push(`\\noindent{\\small\\textsc{${latexEscape(role.label)}}}\\par\\smallskip`);
  if (draft) {
    const lines = [
      node.role === '' ? '' : `\\textbf{${latexEscape(t('workLatex.role'))}:} ${latexEscape(role?.label ?? node.role)}`,
      node.purpose === '' ? '' : `\\textbf{${latexEscape(t('workLatex.purpose'))}:} ${latexEscape(node.purpose)}`,
      node.synopsis === '' ? '' : `\\textbf{${latexEscape(t('workLatex.synopsis'))}:} ${latexEscape(node.synopsis)}`,
      node.brings === '' ? '' : `\\textbf{${latexEscape(t('workLatex.brings'))}:} ${latexEscape(node.brings)}`
    ].filter((s) => s !== '');
    if (lines.length > 0) out.push(framed(lines.join('\\\\ ')));
    for (const f of findings.slice(0, 4)) out.push(`\\marginpar{\\raggedright\\footnotesize\\textbf{${latexEscape(t(`workLatex.weight.${f.weight}`))}:} ${latexEscape(f.message)}}`);
    if (findings.length > 4) out.push(`\\marginpar{\\raggedright\\footnotesize ${latexEscape(t('workLatex.moreFindings', { count: findings.length - 4 }))}}`);
  }
  const text = textOf(node, look);
  const bodySource = text === undefined ? '' : str(text.data, 'body');
  if (bodySource.trim() !== '') out.push(blocks(parseMarkup(bodySource), ctx, 1));
  else if (text !== undefined && planOf(text.data).length > 0) out.push(planLatex(planOf(text.data), ctx));
  else if (draft && node.children.length === 0) out.push(framed(`\\textit{${latexEscape(t('workLatex.unwritten'))}}`));
  return out.join('\n');
}

/** Das Glossar: Begriffe mit Definition, die auf diesem Weg vorkommen, mit der Seite ihrer Einführung. */
function glossaryLatex(knowledge: WorkKnowledge, register: ReturnType<typeof checkPath>['register'], placed: readonly Placed[]): string {
  const shown = new Set(placed.map((p) => p.node.id));
  const items: { label: string; line: string }[] = [];
  for (const [entity, reg] of register.byEntity) {
    const e = knowledge.get(entity);
    if (e === undefined || e.definition.trim() === '') continue;
    if (!reg.occ.some((o) => shown.has(o.node))) continue;
    const intro = reg.firstIntro === null ? null : register.placed[reg.firstIntro].node.id;
    const where = intro === null || !shown.has(intro) ? '' : ` (${latexEscape(t('workLatex.introducedOn'))}~\\pageref{n:${intro}})`;
    const usage = e.usage.trim() === '' ? '' : ` \\emph{${latexEscape(e.usage)}}`;
    items.push({ label: e.preferred || e.label, line: `  \\item[${latexEscape(e.preferred || e.label)}] ${latexEscape(e.definition)}${usage}${where}` });
  }
  if (items.length === 0) return '';
  items.sort((a, b) => a.label.localeCompare(b.label));
  return ['\\begin{description}', ...items.map((i) => i.line), '\\end{description}'].join('\n');
}

/** Das Register: jeder Eintrag des Wissens mit den Seiten der Knoten, an denen er auf diesem Weg vorkommt, nach Rodzaj. */
function indexLatex(knowledge: WorkKnowledge, register: ReturnType<typeof checkPath>['register'], placed: readonly Placed[], bookLike: boolean): string {
  const shown = new Set(placed.map((p) => p.node.id));
  const byKind = new Map<string, { label: string; refs: string[] }[]>();
  for (const [entity, reg] of register.byEntity) {
    const e = knowledge.get(entity);
    if (e === undefined || e.phaseOf !== undefined) continue;
    const nodes = [...new Set(reg.occ.map((o) => o.node).filter((n) => shown.has(n)))];
    if (nodes.length === 0) continue;
    const list = byKind.get(e.kind) ?? [];
    list.push({ label: e.label, refs: nodes.map((n) => `\\pageref{n:${n}}`) });
    byKind.set(e.kind, list);
  }
  if (byKind.size === 0) return '';
  const out: string[] = [];
  for (const kind of [...byKind.keys()].sort((a, b) => a.localeCompare(b))) {
    out.push(`${bookLike ? '\\section*' : '\\subsection*'}{${latexEscape(kind)}}`);
    out.push('\\begin{itemize}[label={},leftmargin=1.5em,itemindent=-1.5em]');
    for (const one of byKind.get(kind)!.sort((a, b) => a.label.localeCompare(b.label))) out.push(`  \\item ${latexEscape(one.label)}, ${one.refs.join(', ')}`);
    out.push('\\end{itemize}');
  }
  return out.join('\n');
}

/** Die Übersicht der Dimensionen: oberste Knoten × Werte, je Zelle ihr Stand. */
function dimensionsLatex(model: WorkModel, bookLike: boolean): string {
  const out: string[] = [];
  for (const dim of model.dimensions) {
    const rows = dimensionTable(model, { columns: dim.key, level: 0 }).filter((r) => !r.single);
    const deeper = rows.length === 0 ? dimensionTable(model, { columns: dim.key, level: 1 }).filter((r) => !r.single) : rows;
    if (deeper.length === 0) continue;
    const cols = dim.values.length;
    out.push(`${bookLike ? '\\section*' : '\\subsection*'}{${latexEscape(dim.name)}}`);
    out.push(`{\\small\\begin{tabular}{|p{0.3\\linewidth}|${Array.from({ length: cols + 1 }, () => `p{${(0.6 / (cols + 1)).toFixed(3)}\\linewidth}`).join('|')}|}`);
    out.push('\\hline');
    out.push(`& ${latexEscape(t('workLatex.shared'))} & ${dim.values.map((v) => `\\textbf{${latexEscape(v.name)}}`).join(' & ')} \\\\ \\hline`);
    for (const row of deeper) {
      const cell = (key: string) => {
        const c = row.cells[key];
        if (c.skipped !== null) return `\\emph{${latexEscape(t('workLatex.notNeeded'))}}`;
        if (c.gap) return `\\textbf{${latexEscape(t('workLatex.gap'))}}`;
        if (c.specific.length === 0) return '---';
        return latexEscape(c.specific.map((n) => t(`workLatex.status.${n.status === '' ? 'idea' : n.status}`)).join(', '));
      };
      out.push(`${latexEscape(row.node?.title ?? '')} & ${row.shared.length === 0 ? '---' : String(row.shared.length)} & ${dim.values.map((v) => cell(v.key)).join(' & ')} \\\\ \\hline`);
    }
    out.push('\\end{tabular}}');
  }
  return out.join('\n');
}
