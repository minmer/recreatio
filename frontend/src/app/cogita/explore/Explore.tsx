/**
 * 2026-11-24 (Eigentümer) — DER PRZEGLĄD: die Lehrerin geht schnell durch, was gelernt wird — Folien nacheinander, die Fragen mit
 * ihrer richtigen Antwort, je Turm, Pfad, Gruppe —, sieht, was die Kontrolle der Welt findet, schreibt eine Uwaga für die KI und
 * kopiert ein Polecenie. EINE Umsetzung: im Reiter „Przegląd" der Klasse (auf die Teilwelt beschränkt) und in der Nauka einer
 * Baza (`…/przeglad`, für wer schreibt).
 *
 * <code>
 *   Desktop   links das Verzeichnis (Gruppen → Türme → Pfade, alle Folien, alle Fragen, Wege zu einer Frage), rechts EIN Strom mit
 *             klebenden Überschriften je Turm und Pfad
 *   Telefon   das Verzeichnis als Schublade oben, der Strom bleibt
 *   Leiste    Oba / Slajdy / Pytania, „tylko z problemami", 12 / 240 mit ↑ ↓ (auch j/k und Pfeile), Polecenie für die KI, Drucken
 *   Seiten    50 Dinge zugleich, mehr beim Scrollen (IntersectionObserver) — eine Baza kann Tausende haben
 * </code>
 *
 * Die KI bleibt draussen: eine Uwaga ist das Feedback der Baza (`FeedbackButton`, MCP `get_feedback`), das Polecenie ein Text.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useT } from '../../core/i18n';
import { Loading } from '../../ui/Loading';
import { TexText } from '../../ui/tex/Tex';
import { AnswerInput, answerText, CardPrompt, Verdict } from '../CardFace';
import type { Card } from '../cardBasics';
import { checkCard } from '../cards';
import { feedbackOf, type Feedback } from '../feedback';
import { FeedbackButton } from '../FeedbackButton';
import { choicesOf } from '../questionTypes';
import { SlideBody } from '../SlideView';
import { EntityReading } from '../EntityReading';
import { Markup, useAsync, useCtx } from '../ui';
import { worldChecks, type WorldFinding } from '../worldChecks';
import { baseWorldViewOf, classOnly, classViewOf } from '../classes/subWorld';
import { readView } from '../views';
import { WorldLandscape, type MapPick } from '../worldmap/WorldLandscape';
import type { ClassOf } from '../classes/classModel';
import { aiPrompt, buildExplore, flatItems, streamOf, type ExploreItem, type ExploreModel, type ExploreSection, type ExploreSelection, type ExploreShow, type PromptItem } from './exploreModel';
import './explore.css';

const PAGE = 50;

const selKey = (s: ExploreSelection): string => (s.kind === 'all' || s.kind === 'slides' || s.kind === 'questions' ? s.kind : `${s.kind}:${'id' in s ? s.id : 'key' in s ? s.key : s.flow}`);

export function Explore({ klass = null }: { klass?: ClassOf | null }) {
  const t = useT();
  const { lib, name: baseName } = useCtx();
  const cards = useAsync(() => lib.cards().then((r) => r.cards), [lib, lib.revision]);
  const only = klass === null ? null : classOnly(lib, klass.areaId);
  const [scoped, setScoped] = useState(true);
  const model = useMemo(() => (cards == null ? null : buildExplore(lib, cards, scoped ? only : null)), [lib, lib.revision, cards, scoped, JSON.stringify(only)]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Die Kontrolle der Welt — nach dem ersten Bild (sie rechnet bei einer grossen Welt Sekunden). */
  const [findings, setFindings] = useState<ReadonlyMap<string, readonly WorldFinding[]> | null>(null);
  useEffect(() => {
    if (cards == null) return undefined;
    let alive = true;
    const timer = window.setTimeout(() => {
      try {
        const by = new Map<string, WorldFinding[]>();
        for (const f of worldChecks(lib, { cards }).findings) if (f.entity !== undefined) by.set(f.entity.id, [...(by.get(f.entity.id) ?? []), f]);
        if (alive) setFindings(by);
      } catch { if (alive) setFindings(new Map()); }
    }, 60);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [lib, lib.revision, cards]);

  const notes = useMemo(() => {
    const by = new Map<string, Feedback[]>();
    for (const f of feedbackOf(lib)) if (f.state === 'open' && f.target.entity !== undefined) by.set(f.target.entity, [...(by.get(f.target.entity) ?? []), f]);
    return by;
  }, [lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sel, setSel] = useState<ExploreSelection>({ kind: 'all' });
  /*
   * 2026-11-25 (Eigentümer: „statt einer Liste die echte Karte — Turm und Pfad finden, dann der Überblick dieses Pfads") — DAS
   * VERZEICHNIS IST DIE KARTE: die ganze Welt (die der Klasse, oder alles), ein Klick auf einen Turm, einen Abschnitt (sein Pfad)
   * oder einen Weg wählt; darunter alle Folien und Fragen auf einmal (Kacheln), dann der Strom. Die Liste bleibt als zweiter Weg.
   */
  const viewId = klass !== null && scoped ? classViewOf(lib, klass) ?? baseWorldViewOf(lib) : baseWorldViewOf(lib);
  const viewDoc = viewId === null ? undefined : lib.docs('view').find((d) => d.id === viewId);
  const [nav, setNav] = useState<'map' | 'list'>('map');
  const navNow = viewDoc === undefined ? 'list' : nav;
  const mainRef = useRef<HTMLElement | null>(null);
  const onMapPick = (pk: MapPick) => {
    setSel(pk.kind === 'tower' ? { kind: 'tower', id: pk.id } : pk.kind === 'path' ? { kind: 'path', flow: pk.flow } : { kind: 'qpath', id: pk.id });
    window.setTimeout(() => mainRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  };
  const [show, setShow] = useState<ExploreShow>('both');
  const [problems, setProblems] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [cur, setCur] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const hasProblem = (it: ExploreItem) => (findings?.get(it.id)?.length ?? 0) > 0 || (notes.get(it.id)?.length ?? 0) > 0;
  const sections = useMemo(() => (model === null ? [] : streamOf(model, sel, show, problems ? hasProblem : null)), [model, selKey(sel), show, problems, findings, notes]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => flatItems(sections), [sections]);
  useEffect(() => { setLimit(PAGE); setCur(0); }, [selKey(sel), show, problems, model]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Mehr beim Scrollen. */
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (el === null || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setLimit((n) => n + PAGE); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [sections, limit]);

  /* Ding für Ding: j/k, Pfeile (nicht in einem Feld). */
  const go = (to: number) => {
    const n = Math.max(0, Math.min(items.length - 1, to));
    /* Gleich merken: zwei schnelle Tasten nacheinander sehen schon die neue Stelle (nicht erst nach dem nächsten Bild). */
    curRef.current = n;
    setCur(n);
    if (n >= limit) setLimit(n + PAGE);
    window.setTimeout(() => document.querySelector(`[data-explore-at="${n}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 30);
  };
  const goRef = useRef(go);
  goRef.current = go;
  const curRef = useRef(cur);
  curRef.current = cur;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el !== null && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); goRef.current(curRef.current + 1); }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); goRef.current(curRef.current - 1); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  if (cards === undefined || model === null) return <Loading label={t('cogitaExplore.loading')} />;
  if (cards === null) return <p className="wk-error">{t('cogitaExplore.failed')}</p>;

  const promptItems = (list: readonly ExploreItem[], all = false): PromptItem[] => list
    .filter((it) => all || hasProblem(it))
    .map((it) => ({
      ref: model.ref(it.id), kind: it.kind, label: model.label(it.id),
      where: [it.tower === null ? '' : model.label(it.tower), it.flow === null ? '' : `${t('cogitaExplore.path')}: ${pathName(model, it.flow)}`].filter(Boolean).join(', '),
      notes: (notes.get(it.id) ?? []).map((f) => `${f.category}: ${f.text}`.trim()),
      findings: (findings?.get(it.id) ?? []).map((f) => `${f.message} ${f.fix}`.trim())
    }));
  const handle = (lib.settings() as { readonly handle?: string }).handle ?? null;
  const pick = (s: ExploreSelection) => { setSel(s); setMenuOpen(false); };
  const problemCount = findings === null ? null : flatItems(model === null ? [] : streamOf(model, sel, show, null)).filter(hasProblem).length;

  let at = 0;
  let shown = 0;
  return (
    <div className={`cg-ex${menuOpen ? ' is-menu' : ''}${navNow === 'map' ? ' is-map' : ''}`} data-explore={selKey(sel)} data-explore-items={items.length} data-explore-nav={navNow}>
      {navNow === 'map' && viewDoc !== undefined && (
        <section className="cg-ex-mapnav" aria-label={t('cogitaExplore.mapLabel')} data-explore-map="">
          <div className="cg-ex-maphead">
            <NavSwitch nav={navNow} onNav={setNav} />
            {klass !== null && only !== null && <ScopeSwitch scoped={scoped} onScoped={setScoped} />}
            <span className="cg-muted cg-ex-maphint">{t('cogitaExplore.mapHint')}</span>
            <button type="button" className={`cg-ex-chip${sel.kind === 'all' ? ' is-on' : ''}`} onClick={() => pick({ kind: 'all' })} data-explore-pick="all">{t('cogitaExplore.everything')}</button>
          </div>
          <WorldLandscape key={`${viewDoc.id}:${scoped ? 1 : 0}`} view={readView(viewDoc.data)} cards={cards} learner={null} viewKey={`explore-${viewDoc.id}`} onPick={onMapPick} />
        </section>
      )}
      {navNow === 'list' && <nav className="cg-ex-menu" aria-label={t('cogitaExplore.menuLabel')} data-explore-menu="">
        {viewDoc !== undefined && <NavSwitch nav={navNow} onNav={setNav} />}
        {klass !== null && only !== null && <ScopeSwitch scoped={scoped} onScoped={setScoped} />}
        <ul className="cg-ex-tree">
          <MenuItem on={sel.kind === 'all'} onClick={() => pick({ kind: 'all' })} data="all">{t('cogitaExplore.everything')}</MenuItem>
          <MenuItem on={sel.kind === 'slides'} onClick={() => pick({ kind: 'slides' })} data="slides">{t('cogitaExplore.allSlides')} <span className="cg-ex-n">{model.slides.size}</span></MenuItem>
          <MenuItem on={sel.kind === 'questions'} onClick={() => pick({ kind: 'questions' })} data="questions">{t('cogitaExplore.allQuestions')} <span className="cg-ex-n">{model.questions.size}</span></MenuItem>
        </ul>
        {model.groups.map((g) => (
          <details key={g.key} className="cg-ex-group" open>
            <summary><button type="button" className={`cg-ex-link${sel.kind === 'group' && sel.key === g.key ? ' is-on' : ''}`} onClick={(e) => { e.preventDefault(); pick({ kind: 'group', key: g.key }); }} data-explore-group={g.key}>{g.label}</button></summary>
            <ul className="cg-ex-tree">
              {g.towers.map((id) => {
                const tw = model.towers.get(id);
                if (tw === undefined) return null;
                const open = (sel.kind === 'tower' && sel.id === id) || (sel.kind === 'path' && tw.paths.some((p) => p.flow === sel.flow));
                return (
                  <li key={id}>
                    <button type="button" className={`cg-ex-link is-tower${sel.kind === 'tower' && sel.id === id ? ' is-on' : ''}`} onClick={() => pick({ kind: 'tower', id })} data-explore-tower={id}><TexText text={tw.label} />{tw.paths.length > 0 && <span className="cg-ex-n">{t('cogitaExplore.pathsN', { count: tw.paths.length })}</span>}</button>
                    {open && tw.paths.length > 0 && (
                      <ul className="cg-ex-tree is-paths">
                        {tw.paths.map((p) => (
                          <MenuItem key={p.flow} on={sel.kind === 'path' && sel.flow === p.flow} onClick={() => pick({ kind: 'path', flow: p.flow })} data={`path:${p.flow}`}>{p.name}</MenuItem>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
        {model.loosePaths.length > 0 && (
          <details className="cg-ex-group">
            <summary>{t('cogitaExplore.loosePaths')}</summary>
            <ul className="cg-ex-tree">{model.loosePaths.map((p) => <MenuItem key={p.flow} on={sel.kind === 'path' && sel.flow === p.flow} onClick={() => pick({ kind: 'path', flow: p.flow })} data={`path:${p.flow}`}>{p.name}</MenuItem>)}</ul>
          </details>
        )}
        {model.qpaths.length > 0 && (
          <details className="cg-ex-group">
            <summary>{t('cogitaExplore.qpaths')}</summary>
            <ul className="cg-ex-tree">{model.qpaths.map((q) => <MenuItem key={q.id} on={sel.kind === 'qpath' && sel.id === q.id} onClick={() => pick({ kind: 'qpath', id: q.id })} data={`qpath:${q.id}`}>{q.title}</MenuItem>)}</ul>
          </details>
        )}
      </nav>}

      <section className="cg-ex-main" ref={mainRef} aria-label={t('cogitaExplore.streamLabel')}>
        <div className="cg-ex-bar" data-explore-bar="">
          {navNow === 'map' && <button type="button" className="wk-btn wk-btn-line is-small" onClick={() => document.querySelector('[data-explore-map]')?.scrollIntoView({ block: 'start', behavior: 'smooth' })} data-explore-to-map="">↑ {t('cogitaExplore.toMap')}</button>}
          {navNow === 'list' && <button type="button" className="wk-btn wk-btn-line is-small cg-ex-menubtn" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} data-explore-menu-toggle="">☰ {t('cogitaExplore.toc')}</button>}
          <div className="cg-ex-chips" role="group" aria-label={t('cogitaExplore.showLabel')}>
            {(['both', 'slides', 'questions'] as const).map((s) => (
              <button key={s} type="button" className={`cg-ex-chip${show === s ? ' is-on' : ''}`} aria-pressed={show === s} onClick={() => setShow(s)} data-explore-show={s}>{t(`cogitaExplore.show.${s}`)}</button>
            ))}
            <button type="button" className={`cg-ex-chip is-problems${problems ? ' is-on' : ''}`} aria-pressed={problems} onClick={() => setProblems((v) => !v)} disabled={findings === null} data-explore-problems={problemCount ?? ''}>
              {findings === null ? t('cogitaExplore.checking') : t('cogitaExplore.problems', { count: problemCount ?? 0 })}
            </button>
          </div>
          <span className="cg-ex-count" data-explore-counter={`${items.length === 0 ? 0 : cur + 1}/${items.length}`}>
            <button type="button" className="cg-ex-step" onClick={() => go(cur - 1)} disabled={cur <= 0} aria-label={t('cogitaExplore.prev')} data-explore-prev="">↑</button>
            {t('cogitaExplore.counter', { n: items.length === 0 ? 0 : cur + 1, total: items.length })}
            <button type="button" className="cg-ex-step" onClick={() => go(cur + 1)} disabled={cur >= items.length - 1} aria-label={t('cogitaExplore.next')} data-explore-next="">↓</button>
          </span>
          <span className="cg-ex-tools">
            <button type="button" className="wk-btn is-small" onClick={() => setPromptOpen((v) => !v)} aria-expanded={promptOpen} data-explore-prompt-open="">{t('cogitaExplore.forAi')}</button>
            <button type="button" className="wk-btn wk-btn-line is-small" onClick={() => { setLimit(items.length); window.setTimeout(() => window.print(), 400); }} data-explore-print="">{t('cogitaExplore.print')}</button>
          </span>
        </div>
        {promptOpen && <PromptPanel make={(note, all) => aiPrompt({ base: baseName, handle, items: promptItems(items, all), note })} count={items.filter(hasProblem).length} />}
        {sel.kind === 'tower' && model.towers.has(sel.id) && <TowerOverview id={sel.id} model={model} items={items} onPath={(flow) => pick({ kind: 'path', flow })} />}
        {(sel.kind === 'tower' || sel.kind === 'path' || sel.kind === 'qpath' || sel.kind === 'group') && items.length > 0 && (
          <Tiles items={items} model={model} cards={cards} cur={cur} onGo={go} title={sel.kind === 'path' ? pathName(model, sel.flow) : sel.kind === 'tower' ? model.label(sel.id) : sel.kind === 'qpath' ? model.qpaths.find((q) => q.id === sel.id)?.title ?? '' : model.groups.find((g) => g.key === sel.key)?.label ?? ''} />
        )}
        {items.length === 0 ? <p className="cg-muted" data-explore-empty="">{problems ? t('cogitaExplore.noProblems') : t('cogitaExplore.empty')}</p> : null}
        {sections.map((s) => {
          if (shown >= limit) return null;
          const head = <SectionHead model={model} section={s} />;
          const rows: ReactNode[] = [];
          for (const it of s.items) {
            const n = at++;
            if (shown >= limit) break;
            shown += 1;
            rows.push(<Item key={`${s.key}:${it.key}`} n={n} on={n === cur} item={it} model={model} cards={cards} findings={findings?.get(it.id) ?? []} onFocus={() => setCur(n)}
              prompt={() => aiPrompt({ base: baseName, handle, items: promptItems([it], true), note: '' })} />);
          }
          return <section key={s.key} className={`cg-ex-sec is-${s.kind}`} data-explore-section={s.key}>{head}{rows}</section>;
        })}
        {shown < items.length && <div ref={sentinel} className="cg-ex-more"><button type="button" className="wk-btn wk-btn-line" onClick={() => setLimit((n) => n + PAGE)} data-explore-more="">{t('cogitaExplore.more', { count: items.length - shown })}</button></div>}
      </section>
    </div>
  );
}

/**
 * 2026-11-25 (Eigentümer: „im Überblick einen Turm wählen und seinen Überblick sehen") — DER ÜBERBLICK EINES TURMS über seinem
 * Strom: was er ist (sein Text, gekürzt), wie viele Pfade, Folien und Fragen, und seine Pfade zum Hineinspringen.
 */
function TowerOverview({ id, model, items, onPath }: { id: string; model: ExploreModel; items: readonly ExploreItem[]; onPath: (flow: string) => void }) {
  const t = useT();
  const { lib } = useCtx();
  const tw = model.towers.get(id)!;
  const entity = lib.entity(id);
  const slides = items.filter((x) => x.kind === 'slide').length;
  const questions = items.filter((x) => x.kind === 'question').length;
  return (
    <section className="cg-ex-tower" data-explore-tower-overview={id}>
      <h2><TexText text={tw.label} /></h2>
      {entity !== undefined && <EntityReading lib={lib} entity={entity} variant="preview" />}
      <p className="cg-muted">{t('cogitaExplore.towerCounts', { paths: tw.paths.length, slides, questions })}</p>
      {tw.paths.length > 0 && (
        <div className="cg-ex-towerpaths">
          {tw.paths.map((p) => <button key={p.flow} type="button" className="wk-btn wk-btn-line is-small" onClick={() => onPath(p.flow)} data-explore-tower-path={p.flow}>{p.name}</button>)}
        </div>
      )}
    </section>
  );
}

/** Karte oder Liste als Verzeichnis. */
function NavSwitch({ nav, onNav }: { nav: 'map' | 'list'; onNav: (n: 'map' | 'list') => void }) {
  const t = useT();
  return (
    <div className="cg-ex-scope" role="group" aria-label={t('cogitaExplore.navLabel')}>
      {(['map', 'list'] as const).map((n) => (
        <button key={n} type="button" className={`cg-ex-chip${nav === n ? ' is-on' : ''}`} aria-pressed={nav === n} onClick={() => onNav(n)} data-explore-nav-pick={n}>{t(`cogitaExplore.nav.${n}`)}</button>
      ))}
    </div>
  );
}

function ScopeSwitch({ scoped, onScoped }: { scoped: boolean; onScoped: (v: boolean) => void }) {
  const t = useT();
  return (
    <div className="cg-ex-scope" role="group" aria-label={t('cogitaExplore.scope')}>
      <button type="button" className={`cg-ex-chip${scoped ? ' is-on' : ''}`} aria-pressed={scoped} onClick={() => onScoped(true)} data-explore-scope="class">{t('cogitaExplore.scopeClass')}</button>
      <button type="button" className={`cg-ex-chip${!scoped ? ' is-on' : ''}`} aria-pressed={!scoped} onClick={() => onScoped(false)} data-explore-scope="all">{t('cogitaExplore.scopeAll')}</button>
    </div>
  );
}

/**
 * 2026-11-25 — ALLE FOLIEN UND FRAGEN AUF EINMAL: je Ding eine Kachel in der Folge der Erzählung (Nummer, Folie oder Frage, ihr
 * Name, bei einer Frage ihre Frage). Ein Klick springt zu ihm im Strom darunter.
 */
function Tiles({ items, model, cards, cur, onGo, title }: { items: readonly ExploreItem[]; model: ExploreModel; cards: readonly Card[]; cur: number; onGo: (n: number) => void; title: string }) {
  const t = useT();
  const asks = useMemo(() => new Map(cards.map((c) => [c.question, c.prompt.map((x) => x.text).join(' ').trim().slice(0, 160)] as const)), [cards]);
  const slides = items.filter((x) => x.kind === 'slide').length;
  return (
    <section className="cg-ex-tiles" data-explore-tiles={items.length} aria-label={t('cogitaExplore.tilesLabel')}>
      <h2 className="cg-ex-tiles-title"><TexText text={title} /> <span className="cg-muted">{t('cogitaExplore.tilesCount', { slides, questions: items.length - slides })}</span></h2>
      <ol className="cg-ex-tilegrid">
        {items.map((it, n) => {
          const name = model.label(it.id);
          const ask = it.kind === 'question' ? asks.get(it.id) ?? '' : '';
          return (
            <li key={it.key}>
              <button type="button" className={`cg-ex-tile is-${it.kind}${n === cur ? ' is-on' : ''}${it.help ? ' is-help' : ''}`} onClick={() => onGo(n)} data-explore-tile={n} data-explore-tile-kind={it.kind}>
                <span className="cg-ex-tile-top"><span className="cg-ex-tile-n">{n + 1}</span><span className="cg-ex-tile-kind">{it.kind === 'slide' ? t('cogitaExplore.slide') : t('cogitaExplore.question')}</span></span>
                <span className="cg-ex-tile-name"><TexText text={name} /></span>
                {ask !== '' && ask !== name && <span className="cg-ex-tile-ask"><TexText text={ask} /></span>}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const pathName = (m: ExploreModel, flow: string): string =>
  [...m.towers.values()].flatMap((x) => x.paths).find((p) => p.flow === flow)?.name ?? m.loosePaths.find((p) => p.flow === flow)?.name ?? flow;

function MenuItem({ on, onClick, data, children }: { on: boolean; onClick: () => void; data: string; children: ReactNode }) {
  return <li><button type="button" className={`cg-ex-link${on ? ' is-on' : ''}`} aria-current={on ? 'true' : undefined} onClick={onClick} data-explore-pick={data}>{children}</button></li>;
}

function SectionHead({ model, section }: { model: ExploreModel; section: ExploreSection }) {
  const t = useT();
  const tower = section.tower === null ? null : model.towers.get(section.tower)?.label ?? model.label(section.tower);
  return (
    <h3 className="cg-ex-head" data-explore-head={section.kind}>
      {tower !== null && <span className="cg-ex-head-tower"><TexText text={tower} /></span>}
      {tower !== null && <span aria-hidden="true"> › </span>}
      <span>{section.kind === 'path' ? `${t('cogitaExplore.path')}: ` : ''}<TexText text={section.title} /></span>
      <span className="cg-ex-n">{section.items.length}</span>
    </h3>
  );
}

/** Ein Ding im Strom: Folie oder Frage, mit Kopf (Art, Name, bleibender Name, wo), Befunden, Uwaga, Polecenie. */
function Item({ n, on, item, model, cards, findings, onFocus, prompt }: {
  n: number; on: boolean; item: ExploreItem; model: ExploreModel; cards: readonly Card[]; findings: readonly WorldFinding[]; onFocus: () => void; prompt: () => string;
}) {
  const t = useT();
  const { lib } = useCtx();
  const entity = lib.entity(item.id);
  const [copied, setCopied] = useState(false);
  if (entity === undefined) return null;
  const label = model.label(item.id);
  return (
    <article className={`cg-ex-item is-${item.kind}${on ? ' is-current' : ''}${item.help ? ' is-help' : ''}`} data-explore-at={n} data-explore-item={item.id} data-explore-kind={item.kind} onClick={onFocus}>
      <header className="cg-ex-ihead">
        <span className={`cg-ex-kind is-${item.kind}`}>{item.kind === 'slide' ? t('cogitaExplore.slide') : t('cogitaExplore.question')}</span>
        {item.help && <span className="cg-ex-flag" title={t('cogitaExplore.helpSays')}>{t('cogitaExplore.help')}</span>}
        {item.predict && <span className="cg-ex-flag">{t('cogitaExplore.predict')}</span>}
        <strong className="cg-ex-title"><TexText text={label} /></strong>
        <code className="cg-ex-ref" title={t('cogitaExplore.refSays')}>{model.ref(item.id)}</code>
        <span className="cg-ex-acts">
          <FeedbackButton lib={lib} target={{ kind: item.kind === 'slide' ? 'slide' : 'question', entity: item.id, label }} />
          <button type="button" className="wk-link-btn" onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(prompt()).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }); }} data-explore-copy-one={item.id}>
            {copied ? t('cogitaExplore.copied') : t('cogitaExplore.copyOne')}
          </button>
        </span>
      </header>
      {findings.length > 0 && (
        <ul className="cg-ex-findings" data-explore-findings={findings.length}>
          {findings.map((f, i) => <li key={i} className={`is-${f.weight}`}><span className="cg-ex-weight">{t(`cogitaExplore.weight.${f.weight}`)}</span> {f.message} <span className="cg-muted">{f.fix}</span></li>)}
        </ul>
      )}
      {item.kind === 'slide' ? <SlideBody lib={lib} entity={entity} /> : <QuestionBody id={item.id} cards={cards} />}
    </article>
  );
}

/** Eine Frage zum Prüfen: Text, Möglichkeiten mit der richtigen (✓), je Möglichkeit Rückmeldung und Fehler-Tag, Hinweise, Erklärung, worüber — und „Spróbuj". */
function QuestionBody({ id, cards }: { id: string; cards: readonly Card[] }) {
  const t = useT();
  const { lib } = useCtx();
  const card = useMemo(() => cards.find((c) => c.question === id), [cards, id]);
  const d = (lib.entity(id)?.data ?? {}) as Readonly<Record<string, unknown>>;
  const [trying, setTrying] = useState(false);
  const [given, setGiven] = useState<{ value: unknown } | null>(null);
  const form = typeof d.form === 'string' ? d.form : '';
  const choice = form === 'one' || form === 'many' ? choicesOf(d) : null;
  const hints = (Array.isArray(d.hints) ? d.hints : typeof d.hints === 'string' ? [d.hints] : []).filter((h): h is string => typeof h === 'string' && h.trim() !== '');
  const refs = (key: string) => (Array.isArray(d[key]) ? d[key] as unknown[] : typeof d[key] === 'string' ? [d[key]] : []).filter((x): x is string => typeof x === 'string' && x !== '');
  const names = (key: string) => refs(key).map((r) => { const e = lib.entity(r); return e === undefined ? r : lib.label(e); });
  return (
    <div className="cg-ex-q" data-explore-question={id} data-explore-form={form}>
      {card !== undefined ? <div className="cg-ex-prompt"><CardPrompt parts={card.prompt} /></div> : <p className="wk-warn">{t('cogitaExplore.noCard')}</p>}
      {choice !== null ? (
        <ol className="cg-ex-options" type="A">
          {choice.options.map((o, i) => {
            const right = choice.correct.includes(i);
            return (
              <li key={i} className={right ? 'is-right' : ''} data-explore-option={right ? 'right' : 'wrong'}>
                <span className="cg-ex-mark" aria-label={right ? t('cogitaExplore.correct') : undefined}>{right ? '✓' : ''}</span>
                <TexText text={o} />
                {(choice.tags[i] ?? '') !== '' && <span className="cg-ex-tag">{choice.tags[i]}</span>}
                {(choice.feedback[i] ?? '') !== '' && <span className="cg-ex-said"><Markup text={choice.feedback[i]!} lib={lib} /></span>}
              </li>
            );
          })}
        </ol>
      ) : card !== undefined && <p className="cg-ex-answer"><span className="cg-muted">{t('cogitaExplore.answer')}:</span> <TexText text={answerText(card)} /></p>}
      {hints.length > 0 && <p className="cg-ex-meta"><span className="cg-muted">{t('cogitaExplore.hints')}:</span> {hints.join(' · ')}</p>}
      {typeof d.explanation === 'string' && d.explanation.trim() !== '' && <div className="cg-ex-meta"><span className="cg-muted">{t('cogitaExplore.explanation')}:</span> <Markup text={d.explanation} lib={lib} /></div>}
      {names('explain').length > 0 && <p className="cg-ex-meta"><span className="cg-muted">{t('cogitaExplore.explain')}:</span> {names('explain').join(', ')}</p>}
      {names('about').length > 0 && <p className="cg-ex-meta"><span className="cg-muted">{t('cogitaExplore.about')}:</span> {names('about').join(', ')}</p>}
      {names('needs').length > 0 && <p className="cg-ex-meta"><span className="cg-muted">{t('cogitaExplore.needs')}:</span> {names('needs').join(', ')}</p>}
      {card !== undefined && (
        <div className="cg-ex-try">
          <button type="button" className="wk-link-btn" aria-expanded={trying} onClick={() => { setTrying((v) => !v); setGiven(null); }} data-explore-try={id}>{trying ? t('cogitaExplore.tryHide') : t('cogitaExplore.try')}</button>
          {trying && (given === null
            ? <AnswerInput card={card} autoFocus={false} onSubmit={(g) => setGiven({ value: g })} />
            : <Verdict card={card} outcome={checkCard(card, given.value)} given={given.value} lib={lib} />)}
        </div>
      )}
    </div>
  );
}

/** Das Polecenie für die KI über den ganzen Strom: eine Notiz dazu, nur Dinge mit Problemen oder alle, kopieren. */
function PromptPanel({ make, count }: { make: (note: string, all: boolean) => string; count: number }) {
  const t = useT();
  const [note, setNote] = useState('');
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = make(note, all);
  return (
    <div className="cg-ex-prompt-panel" data-explore-prompt="">
      <p className="cg-muted">{t('cogitaExplore.promptSays', { count })}</p>
      <label className="wk-field"><span>{t('cogitaExplore.noteLabel')}</span>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('cogitaExplore.notePlaceholder')} data-explore-note="" />
      </label>
      <label className="wk-check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} data-explore-prompt-all="" /><span>{t('cogitaExplore.promptAll')}</span></label>
      <textarea className="cg-ex-prompt-text" rows={8} readOnly value={text} data-explore-prompt-text="" />
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => void navigator.clipboard?.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); })} data-explore-copy="">
          {copied ? t('cogitaExplore.copied') : t('cogitaExplore.copyAll')}
        </button>
      </div>
    </div>
  );
}
