/**
 * DER GANG DES WERKS (2026-11-15) — die Ansicht für den, der ein sehr grosses Buch baut und sehen muss, wie die
 * Erklärung Schritt für Schritt aufgebaut ist: vom Kapitel über Unterkapitel und Paragraphen bis zum Akapit.
 *
 *   - je Stelle ihr Kernsatz (wie die Erklärung gebaut ist), Wörter und Akapity;
 *   - je Stelle die Wörter, die hier eingeführt (grün), definiert, als Beispiel gezeigt, gebraucht und wieder
 *     aufgenommen werden — zugeklappt die Summe des ganzen Teils darunter;
 *   - rot jedes Wort, das gebraucht wird, bevor es eingeführt ist — mit „Nächstes Problem", bis es keines mehr gibt;
 *   - daneben der Wortschatz in der Reihenfolge, in der der Leser ihn erwirbt, und was nie eingeführt wird;
 *   - ein Wort anklicken: es wird durch das ganze Werk verfolgt.
 *
 * Tiefe: bis zu den Kapiteln, … , bis zu den Akapity; jede Zeile lässt sich einzeln auf- und zuklappen.
 */

import { useEffect, useMemo, useState } from 'react';

import { useT, type T } from '../../core/i18n';
import { useRemembered } from '../../core/prefs';
import { MARK_ROLES } from '../../library/libraryKinds';
import { Icon } from '../../ui/icons';
import { courseOf, type Anchor, type Course, type CourseRow, type CourseUnit, type Mention, type VocabEntry } from './workCourse';
import { openNotes, roleOf, type MarkRole } from './workModel';
import { ParaNotes, ReviewChip, ReviewPanel } from './ReviewBox';
import { PathPick, pathKeyOf, type WorkCtx } from './WorkView';

/** Die Tiefe „bis zu den Akapity". */
const UNITS = 99;
/** Wie viele Wörter eine zugeklappte Zeile zeigt, bevor sie „+N" sagt. */
const SHOWN = 10;

const anchorId = (a: Pick<Anchor, 'node' | 'para'>): string => (a.para === undefined ? `course-${a.node}` : `course-${a.node}-${a.para}`);

export function CourseView({ ctx }: { ctx: WorkCtx }) {
  const t = useT();
  const pathKey = pathKeyOf(ctx);
  const report = ctx.work.report(pathKey);
  const course = useMemo(() => (report === undefined ? null : courseOf(ctx.work.model, report.register, ctx.store, ctx.work.knowledge)),
    [report, ctx.work.model, ctx.store, ctx.work.knowledge]);
  const deepest = course === null ? 0 : Math.max(0, course.totals.perLevel.length - 1);
  const [depthText, setDepthText] = useRemembered(`scriptorium.work.course.depth.${ctx.project.id}`, String(Math.min(1, deepest)));
  const limit = Number(depthText) >= UNITS ? UNITS : Math.min(deepest, Math.max(0, Number(depthText) || 0));
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  /* Knoten, deren Akapity eigens gezeigt werden (unterhalb der Tiefe „Akapity"). */
  const [unitsOpen, setUnitsOpen] = useState<ReadonlySet<string>>(new Set());
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [thought, setThought] = useRemembered('scriptorium.work.course.thought', 'synopsis');
  const [follow, setFollow] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [problemAt, setProblemAt] = useState(-1);
  /* 2026-11-16 — die Durchsicht: welche Knoten ihr Feld offen haben (mit dem Akapit, zu dem eine Notiz gehen soll), welcher Filter. */
  const [reviewOpen, setReviewOpen] = useState<ReadonlyMap<string, number | undefined>>(new Map());
  const [reviewFilter, setReviewFilter] = useState('');

  /* Ein Sprung: erst aufklappen, dann (nach dem Zeichnen) hinscrollen. */
  useEffect(() => {
    void unitsOpen;
    if (focus === null) return;
    const el = document.getElementById(focus);
    if (el !== null) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('is-flash');
      const off = window.setTimeout(() => el.classList.remove('is-flash'), 1600);
      return () => window.clearTimeout(off);
    }
    return undefined;
  }, [focus, toggled, unitsOpen]);

  if (course === null) return null;

  const defaultOpen = (row: CourseRow) => limit === UNITS || row.depth < limit;
  const isOpen = (row: CourseRow) => defaultOpen(row) !== toggled.has(row.node.id);
  const showUnits = (row: CourseRow) => isOpen(row) && (limit === UNITS || unitsOpen.has(row.node.id));
  const flipIn = (set: Set<string>, id: string) => { if (set.has(id)) set.delete(id); else set.add(id); };
  /* Der Pfeil einer Zeile: auf und zu; ein Knoten ohne Kinder zeigt aufgeklappt gleich seine Akapity. */
  const toggle = (row: CourseRow) => {
    const next = new Set(toggled);
    flipIn(next, row.node.id);
    setToggled(next);
    if (row.children.length === 0) setUnitsOpen((was) => { const u = new Set(was); if (defaultOpen(row) !== next.has(row.node.id)) u.add(row.node.id); else u.delete(row.node.id); return u; });
  };
  const toggleUnits = (id: string) => setUnitsOpen((was) => { const u = new Set(was); flipIn(u, id); return u; });
  const setLimit = (value: number) => { setDepthText(String(value)); setToggled(new Set()); setUnitsOpen(new Set()); };

  /** Eine Stelle sichtbar machen: alle Vorfahren auf, der Knoten auf, bei einem Akapit seine Akapity — dann hinscrollen. */
  const reveal = (at: Pick<Anchor, 'node' | 'para'>) => {
    const target = course.byNode.get(at.node);
    if (target === undefined) return;
    const next = new Set(toggled);
    const open = (row: CourseRow) => { if (defaultOpen(row) === next.has(row.node.id)) flipIn(next, row.node.id); };
    let depth = target.depth;
    for (let i = course.rows.indexOf(target) - 1; i >= 0 && depth > 0; i -= 1) {
      const row = course.rows[i];
      if (row.depth < depth) { open(row); depth = row.depth; }
    }
    if (at.para !== undefined) {
      open(target);
      setUnitsOpen((was) => new Set([...was, target.node.id]));
    }
    setToggled(next);
    setFocus(anchorId(at));
  };

  const jumpProblem = (step: 1 | -1) => {
    if (course.problems.length === 0) return;
    const next = (problemAt + step + course.problems.length) % course.problems.length;
    setProblemAt(next);
    reveal(course.problems[next]);
  };

  const openReview = (id: string, para?: number) => setReviewOpen((was) => {
    const next = new Map(was);
    if (next.has(id) && para === undefined) next.delete(id); else next.set(id, para);
    return next;
  });
  /* Durchsicht: was der Filter zeigt — der Knoten selbst passt, oder etwas darunter (dann steht er als Weg da). */
  const matches = (row: CourseRow): boolean => reviewFilter === '' ? true
    : reviewFilter === 'notes' ? openNotes(row.node).length > 0
    : reviewFilter === 'none' ? row.node.review === '' : row.node.review === reviewFilter;
  const reviewShown = new Set<string>();
  if (reviewFilter !== '') {
    course.rows.forEach((row, i) => {
      if (!matches(row)) return;
      reviewShown.add(row.node.id);
      let depth = row.depth;
      for (let j = i - 1; j >= 0 && depth > 0; j -= 1) if (course.rows[j].depth < depth) { reviewShown.add(course.rows[j].node.id); depth = course.rows[j].depth; }
    });
  }
  const counts = {
    accepted: course.rows.filter((r) => r.node.review === 'accepted').length,
    revise: course.rows.filter((r) => r.node.review === 'revise').length,
    remove: course.rows.filter((r) => r.node.review === 'remove').length,
    none: course.rows.filter((r) => r.node.review === '').length,
    notes: course.rows.reduce((n, r) => n + openNotes(r.node).length, 0)
  };
  /* Zum nächsten noch nicht Durchgesehenen, in Lesereihenfolge — und sein Feld gleich auf. */
  const nextUnreviewed = () => {
    const from = focus === null ? -1 : course.rows.findIndex((r) => focus === anchorId({ node: r.node.id }));
    const next = course.rows.find((r, i) => i > from && r.node.review === '') ?? course.rows.find((r) => r.node.review === '');
    if (next === undefined) return;
    setReviewOpen((was) => new Map(was).set(next.node.id, undefined));
    reveal({ node: next.node.id });
  };

  const followed = follow === null ? null : course.vocabulary.find((v) => v.entity === follow) ?? course.unintroduced.find((v) => v.entity === follow) ?? null;
  const visible = (row: CourseRow): boolean => (!onlyProblems || row.below.problems > 0) && (follow === null || row.below.introduces.includes(follow) || row.below.uses.includes(follow))
    && (reviewFilter === '' || reviewShown.has(row.node.id));
  const levels = course.totals.perLevel;
  const ctxRow: RowCtx = { ctx, t, course, isOpen, showUnits, toggle, toggleUnits, limitIsUnits: limit === UNITS, visible, follow, setFollow, thought, onlyProblems, reveal, reviewOpen, openReview };
  const roots = course.rows.filter((r) => r.depth === 0 || !course.rows.some((p) => p.children.includes(r.node.id)));

  return (
    <div className="course">
      <section className="course-summary" aria-label={t('workUi.course.summary')}>
        <p className="course-lede">{t('workUi.course.lede')}</p>
        <dl className="course-totals">
          {levels.map((l, d) => <div key={d}><dt>{l.name || t('workUi.course.level', { n: d + 1 })}</dt><dd>{l.count}</dd></div>)}
          <div><dt>{t('workUi.course.units')}</dt><dd>{course.totals.units}</dd></div>
          <div><dt>{t('workUi.course.words')}</dt><dd>{course.totals.words}</dd></div>
          <div><dt>{t('workUi.course.vocabulary')}</dt><dd>{course.vocabulary.length}</dd></div>
          <div className={course.problems.length > 0 ? 'is-bad' : 'is-good'}><dt>{t('workUi.course.problems')}</dt><dd>{course.problems.length}</dd></div>
        </dl>
        {course.problems.length > 0 ? (
          <div className="course-problem-nav">
            <span className="course-problem-now" role="status">
              {problemAt < 0 ? t('workUi.course.problemsLead', { count: course.problems.length })
                : problemLine(t, course.problems[problemAt], problemAt, course.problems.length)}
            </span>
            <button type="button" className="wk-btn wk-btn-ghost" onClick={() => jumpProblem(-1)}><Icon name="prev" /> {t('workUi.course.prevProblem')}</button>
            <button type="button" className="wk-btn" onClick={() => jumpProblem(1)}>{t('workUi.course.nextProblem')} <Icon name="next" /></button>
          </div>
        ) : course.vocabulary.length > 0 ? <p className="course-ok">{t('workUi.course.allGood')}</p> : null}
        <div className="course-review-sum">
          <span className="course-review-progress">{t('workUi.review.progress', { done: course.rows.length - counts.none, total: course.rows.length })}</span>
          <progress max={Math.max(1, course.rows.length)} value={course.rows.length - counts.none} aria-label={t('workUi.review.progressLabel')} />
          <span className="review-chip is-accepted">{t('workUi.review.countAccepted', { count: counts.accepted })}</span>
          <span className="review-chip is-revise">{t('workUi.review.countRevise', { count: counts.revise })}</span>
          <span className="review-chip is-remove">{t('workUi.review.countRemove', { count: counts.remove })}</span>
          <span className="review-chip is-none">{t('workUi.review.countNotes', { count: counts.notes })}</span>
          {counts.none > 0 && <button type="button" className="wk-btn" onClick={nextUnreviewed}>{t('workUi.review.next')} <Icon name="next" /></button>}
        </div>
      </section>

      <div className="work-toolbar course-toolbar">
        <PathPick ctx={ctx} all={false} />
        <div className="wk-field">
          <span>{t('workUi.course.depth')}</span>
          <div className="wk-seg" role="group">
            {levels.map((l, d) => (
              <button key={d} type="button" className={limit === d ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={limit === d} onClick={() => setLimit(d)}>
                {l.name || t('workUi.course.level', { n: d + 1 })}
              </button>
            ))}
            <button type="button" className={limit === UNITS ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={limit === UNITS} onClick={() => setLimit(UNITS)}>{t('workUi.course.units')}</button>
          </div>
        </div>
        <label className="wk-field">
          <span>{t('workUi.course.thought')}</span>
          <select value={thought} onChange={(e) => setThought(e.target.value)}>
            <option value="synopsis">{t('workUi.course.thoughtSynopsis')}</option>
            <option value="purpose">{t('workUi.course.thoughtPurpose')}</option>
            <option value="all">{t('workUi.course.thoughtAll')}</option>
            <option value="none">{t('workUi.course.thoughtNone')}</option>
          </select>
        </label>
        <label className="wk-field">
          <span>{t('workUi.review.filter')}</span>
          <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}>
            <option value="">{t('workUi.review.filterAll')}</option>
            <option value="none">{t('workUi.review.filterNone')}</option>
            <option value="revise">{t('workUi.review.filterRevise')}</option>
            <option value="remove">{t('workUi.review.filterRemove')}</option>
            <option value="accepted">{t('workUi.review.filterAccepted')}</option>
            <option value="notes">{t('workUi.review.filterNotes')}</option>
          </select>
        </label>
        <label className="pe-check"><input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /><span>{t('workUi.course.onlyProblems')}</span></label>
      </div>

      <Legend t={t} />

      {followed !== null && <FollowBar t={t} entry={followed} course={course} onClose={() => setFollow(null)} reveal={reveal} />}

      <div className="course-split">
        <div className="course-main">
          {course.rows.length === 0 ? <p className="wk-empty">{t('workUi.course.empty')}</p> : (
            <ol className="course-tree">{roots.filter(visible).map((r) => <Row key={r.node.id} row={r} c={ctxRow} />)}</ol>
          )}
          {course.vocabulary.length === 0 && course.unintroduced.length === 0 && course.rows.length > 0 && <p className="wk-note course-hint">{t('workUi.course.noWords')}</p>}
        </div>
        <Vocabulary t={t} course={course} follow={follow} onFollow={(e) => { setFollow(e.entity === follow ? null : e.entity); if (e.intro !== null) reveal(e.intro); else if (e.firstUse !== null) reveal(e.firstUse); }} />
      </div>
    </div>
  );
}

interface RowCtx {
  readonly ctx: WorkCtx;
  readonly t: T;
  readonly course: Course;
  readonly isOpen: (row: CourseRow) => boolean;
  readonly showUnits: (row: CourseRow) => boolean;
  readonly toggle: (row: CourseRow) => void;
  readonly toggleUnits: (id: string) => void;
  readonly limitIsUnits: boolean;
  readonly visible: (row: CourseRow) => boolean;
  readonly follow: string | null;
  readonly setFollow: (id: string | null) => void;
  readonly thought: string;
  readonly onlyProblems: boolean;
  readonly reveal: (a: Pick<Anchor, 'node' | 'para'>) => void;
  readonly reviewOpen: ReadonlyMap<string, number | undefined>;
  readonly openReview: (id: string, para?: number) => void;
}

function Row({ row, c }: { row: CourseRow; c: RowCtx }) {
  const { t, ctx } = c;
  const open = c.isOpen(row);
  const units = c.showUnits(row);
  const role = roleOf(ctx.work.model, row.node.role);
  const children = row.children.map((id) => c.course.byNode.get(id)!).filter(c.visible);
  const hasMore = row.children.length > 0 || row.units.length > 0;
  const note = c.thought === 'purpose' ? row.node.purpose : c.thought === 'synopsis' ? row.node.synopsis || row.node.purpose : '';
  const reviewing = c.reviewOpen.has(row.node.id);
  const notes = openNotes(row.node).length;
  /* Zugeklappt: die Wörter des ganzen Teils; offen: nur, was am Knoten selbst steht (der Rest steht darunter). */
  const tally = open ? row.own : row.below;
  const own = open ? row.head : null;
  return (
    <li className={`course-row is-d${Math.min(row.depth, 5)}${row.below.problems > 0 ? ' has-problems' : ''}`}>
      <div className="course-head" id={anchorId({ node: row.node.id })}>
        <button type="button" className="course-twist" aria-expanded={open} disabled={!hasMore}
          aria-label={open ? t('workUi.course.collapse', { title: row.node.title }) : t('workUi.course.expand', { title: row.node.title })} onClick={() => c.toggle(row)}>
          <Icon name={open ? 'down' : 'next'} />
        </button>
        <span className="work-num">{row.number}</span>
        <a className="course-title" href={ctx.href('struktura', row.node.id)}>{row.node.title || t('work.untitled')}</a>
        {row.level !== '' && <span className="work-level">{row.level}</span>}
        {role !== undefined && <span className={`work-role is-${role.brings}`}>{role.label}</span>}
        <span className="course-stats">
          {t('workUi.course.wordsCount', { count: open ? row.own.words : row.below.words })}
          {(open ? row.own.units : row.below.units) > 0 && ` · ${t('workUi.course.unitsCount', { count: open ? row.own.units : row.below.units })}`}
        </span>
        {row.below.problems > 0 && <span className="work-count is-must" title={t('workUi.course.problemsHere', { count: row.below.problems })}>{t('workUi.course.problemsBadge', { count: row.below.problems })}</span>}
        <ReviewChip review={row.node.review} t={t} />
        <button type="button" className={reviewing ? 'wk-link-btn course-review-btn is-on' : 'wk-link-btn course-review-btn'} aria-expanded={reviewing} onClick={() => c.openReview(row.node.id)}>
          <Icon name="chat" />{notes > 0 ? t('workUi.review.notesCount', { count: notes }) : t('workUi.review.open')}
        </button>
        {open && !c.limitIsUnits && row.units.length > 0 && row.children.length > 0 && (
          <button type="button" className="wk-link-btn course-units-btn" aria-pressed={units} onClick={() => c.toggleUnits(row.node.id)}>
            {units ? t('workUi.course.hideUnits') : t('workUi.course.showUnits', { count: row.units.length })}
          </button>
        )}
      </div>
      {c.thought === 'all' ? <Essentials row={row} t={t} /> : note !== '' && <p className="course-thought">{note}</p>}
      {reviewing && <ReviewPanel ctx={ctx} node={row.node} paras={row.units.length} {...(c.reviewOpen.get(row.node.id) === undefined ? {} : { para: c.reviewOpen.get(row.node.id) })} />}
      {own === null
        ? <Words c={c} introduces={tally.introduces} uses={tally.uses} />
        : own.length > 0 && <Chips c={c} mentions={own} />}
      {units && row.units.length > 0 && (
        <ol className="course-units">
          {row.units.filter((u) => (!c.onlyProblems || u.mentions.some((m) => m.early)) && (c.follow === null || u.mentions.some((m) => m.entity === c.follow)))
            .map((u) => <Unit key={u.index} row={row} unit={u} c={c} />)}
        </ol>
      )}
      {open && children.length > 0 && <ol className="course-tree">{children.map((r) => <Row key={r.node.id} row={r} c={c} />)}</ol>}
    </li>
  );
}

function Unit({ row, unit, c }: { row: CourseRow; unit: CourseUnit; c: RowCtx }) {
  const { t } = c;
  const early = unit.mentions.some((m) => m.early);
  return (
    <li className={`course-unit is-${unit.kind}${early ? ' has-problems' : ''}`} id={anchorId({ node: row.node.id, para: unit.index })}>
      <span className="course-para" title={t('workUi.course.paraTitle', { n: unit.index + 1, words: unit.words })}>{unit.kind === 'point' ? t('workUi.course.point', { n: unit.index + 1 }) : t('workUi.course.para', { n: unit.index + 1 })}</span>
      <span className="course-excerpt">{unit.excerpt === '' ? t('workUi.course.noText') : unit.excerpt}
        <button type="button" className="wk-link-btn course-para-note" title={t('workUi.review.noteOnPara', { n: unit.index + 1 })} aria-label={t('workUi.review.noteOnPara', { n: unit.index + 1 })} onClick={() => c.openReview(row.node.id, unit.index)}><Icon name="chat" /></button>
      </span>
      <ParaNotes node={row.node} para={unit.index} t={t} />
      {unit.mentions.length > 0 && <Chips c={c} mentions={unit.mentions} />}
    </li>
  );
}

const roleWord = (role: MarkRole): string => MARK_ROLES.find((r) => r.value === role)?.label ?? role;
const where = (t: T, a: Anchor | undefined): string =>
  a === undefined ? t('workUi.course.nowhere') : a.para === undefined ? `${a.number} ${a.title}` : t('workUi.course.at', { number: a.number, title: a.title, n: a.para + 1 });

/** Die Wörter an einer Stelle: eingeführt, definiert, Beispiel, gebraucht, aufgenommen — und zu früh. */
function Chips({ c, mentions }: { c: RowCtx; mentions: readonly Mention[] }) {
  const { t } = c;
  return (
    <ul className="course-words">
      {mentions.map((m) => (
        <li key={m.entity}>
          <button type="button"
            className={`course-word is-${m.role}${m.early ? ' is-early' : ''}${m.implicit ? ' is-implicit' : ''}${c.follow === m.entity ? ' is-followed' : ''}`}
            title={m.early ? t('workUi.course.earlyTitle', { word: m.label, at: where(t, m.introAt) }) : t('workUi.course.wordTitle', { word: m.label, role: roleWord(m.role), kind: m.kind, at: where(t, m.introAt) })}
            onClick={() => c.setFollow(c.follow === m.entity ? null : m.entity)}>
            {m.early && <Icon name="alert" />}{m.label}
            {m.role !== 'use' && <span className="course-word-role">{roleWord(m.role)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Zugeklappt: was der ganze Teil einführt und was er braucht. */
function Words({ c, introduces, uses }: { c: RowCtx; introduces: readonly string[]; uses: readonly string[] }) {
  const { t, course } = c;
  if (introduces.length === 0 && uses.length === 0) return null;
  const label = (id: string) => course.vocabulary.find((v) => v.entity === id)?.label ?? course.unintroduced.find((v) => v.entity === id)?.label ?? id;
  const line = (ids: readonly string[], cls: string, head: string) => ids.length === 0 ? null : (
    <p className="course-sum">
      <span className="course-sum-head">{head}</span>
      {ids.slice(0, SHOWN).map((id) => (
        <button key={id} type="button" className={`course-word ${cls}${c.follow === id ? ' is-followed' : ''}`} onClick={() => c.setFollow(c.follow === id ? null : id)}>{label(id)}</button>
      ))}
      {ids.length > SHOWN && <span className="course-more">{t('workUi.course.more', { count: ids.length - SHOWN })}</span>}
    </p>
  );
  return (
    <div className="course-sums">
      {line(introduces, 'is-intro', t('workUi.course.introduces', { count: introduces.length }))}
      {line(uses.filter((u) => !introduces.includes(u)), 'is-use', t('workUi.course.uses', { count: uses.filter((u) => !introduces.includes(u)).length }))}
    </div>
  );
}

function Legend({ t }: { t: T }) {
  return (
    <ul className="course-legend" aria-label={t('workUi.course.legend')}>
      {(['intro', 'def', 'ex', 'use', 'recall'] as const).map((r) => <li key={r}><span className={`course-word is-${r}`}>{roleWord(r)}</span></li>)}
      <li><span className="course-word is-use is-implicit">{t('workUi.course.legendImplicit')}</span></li>
      <li><span className="course-word is-use is-early"><Icon name="alert" />{t('workUi.course.legendEarly')}</span></li>
    </ul>
  );
}

function FollowBar({ t, entry, course, onClose, reveal }: { t: T; entry: VocabEntry; course: Course; onClose: () => void; reveal: (a: Anchor) => void }) {
  const early = course.problems.filter((p) => p.entity === entry.entity);
  return (
    <div className="course-follow" role="status">
      <span className="course-follow-word">{t('workUi.course.following', { word: entry.label })}</span>
      {entry.intro !== null
        ? <button type="button" className="wk-link-btn" onClick={() => reveal(entry.intro!)}>{t('workUi.course.followIntro', { at: where(t, entry.intro) })}</button>
        : <span className="wk-danger">{t('workUi.course.followNever')}</span>}
      {entry.defined !== null && <button type="button" className="wk-link-btn" onClick={() => reveal(entry.defined!)}>{t('workUi.course.followDefined', { at: where(t, entry.defined) })}</button>}
      <span>{t('workUi.course.followUses', { count: entry.uses })}</span>
      {early.length > 0 && <button type="button" className="wk-link-btn wk-danger" onClick={() => reveal(early[0])}>{t('workUi.course.followEarly', { count: early.length })}</button>}
      <button type="button" className="wk-link-btn" onClick={onClose}>{t('workUi.course.followStop')}</button>
    </div>
  );
}

/** Der Wortschatz in der Reihenfolge der Einführung — und was nie eingeführt wird. */
function Vocabulary({ t, course, follow, onFollow }: { t: T; course: Course; follow: string | null; onFollow: (e: VocabEntry) => void }) {
  const [query, setQuery] = useState('');
  const low = query.trim().toLowerCase();
  const match = (e: VocabEntry) => low === '' || e.label.toLowerCase().includes(low) || e.kind.toLowerCase().includes(low);
  const item = (e: VocabEntry, i: number | null) => (
    <li key={e.entity}>
      <button type="button" className={`course-vocab-item${follow === e.entity ? ' is-on' : ''}${e.early > 0 ? ' has-problems' : ''}`} onClick={() => onFollow(e)}>
        {i !== null && <span className="course-vocab-n">{i + 1}</span>}
        <span className="course-vocab-word">{e.label}</span>
        <span className="course-vocab-where">{e.intro !== null ? (e.intro.para === undefined ? e.intro.number : `${e.intro.number} ¶${e.intro.para + 1}`) : e.firstUse?.number ?? ''}</span>
        <span className="course-vocab-meta">
          {e.kind}{e.defined === null && e.intro !== null ? ` · ${t('workUi.course.vocabUndefined')}` : ''} · {t('workUi.course.vocabUses', { count: e.uses })}
          {e.early > 0 && <strong className="wk-danger"> · {t('workUi.course.vocabEarly', { count: e.early })}</strong>}
        </span>
      </button>
    </li>
  );
  return (
    <aside className="course-vocab" aria-label={t('workUi.course.vocabTitle')}>
      <h2 className="lib-box-h">{t('workUi.course.vocabTitle')}</h2>
      <p className="wk-note">{t('workUi.course.vocabLede')}</p>
      <input type="search" value={query} placeholder={t('workUi.course.vocabSearch')} aria-label={t('workUi.course.vocabSearch')} onChange={(e) => setQuery(e.target.value)} />
      {course.unintroduced.some(match) && (
        <>
          <h3 className="work-h4 wk-danger">{t('workUi.course.unintroduced', { count: course.unintroduced.length })}</h3>
          <ul className="course-vocab-list">{course.unintroduced.filter(match).map((e) => item(e, null))}</ul>
        </>
      )}
      <h3 className="work-h4">{t('workUi.course.inOrder', { count: course.vocabulary.length })}</h3>
      <ol className="course-vocab-list">{course.vocabulary.map((e, i) => (match(e) ? item(e, i) : null))}</ol>
    </aside>
  );
}

function problemLine(t: T, p: Course['problems'][number], i: number, total: number): string {
  return t('workUi.course.problemNow', { n: i + 1, total, word: p.label, here: where(t, p), at: where(t, p.introAt) });
}

/** 2026-11-16 — das Wichtigste über einen Teil auf einen Blick: Kernsatz, Zweck, was er bringt. */
function Essentials({ row, t }: { row: CourseRow; t: T }) {
  const n = row.node;
  const lines = [
    ['synopsis', n.synopsis], ['purpose', n.purpose], ['brings', n.brings]
  ].filter(([, v]) => v !== '');
  if (lines.length === 0) return null;
  return (
    <dl className="course-essentials">
      {lines.map(([k, v]) => <div key={k}><dt>{t(`workUi.course.essential.${k}`)}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}
