/**
 * COGITA — FORTSCHRITT (COGITA.md §6, §7): der eigene — je Art, Thema, Zbiór,
 * was sitzt, was wackelt, was nie gefragt wurde, gesperrte Karten, was ohne
 * Konto gelernt wurde —, und für die Lehrerin der aller Lernenden des
 * Bereichs, in dem die Antworten liegen [E10].
 */

import { Fragment, useEffect, useMemo, useState } from 'react';

import { loadAreas, type AreaRow } from '../areas/area';
import { areaKeys, loadAreaNames, openNames } from '../chat/chat';
import { plural } from '../core/plural';
import { loadIntake, openIntakeKey } from '../forms/intake';
import { loadSeats } from '../seats/seat';
import type { Card } from './cardBasics';
import { average, DEFAULT_SPACING, knownessOf, KNOWN, levelOf, LEVEL_LABEL, shareOf, type Level, type Spacing } from './knowness';
import { spacingFor } from './spacing';
import { gaugeFromMarks, itemDue, itemKnowness, ownKnowness } from './knowing';
import { adoptLocal, areaProgress, loadAnswerAreas, localProgress, marksOf, renamer, type AnswerArea, type Learner, type LearnerProgress, type Progress as Answers } from './learn';
import { answerIndex, answersOf, cardStats, holdsText, MODELS, spanText, summarize as statsOf, type CardStat, type Model } from './measures';
import { ClassKnowledge, KnowledgeStats } from './KnowCharts';
import { AnswerLog, cardLine } from './AnswerLog';
import { BadgesPage } from './BadgesPage';
import { baseLang, rewardWords } from './lang';
import { planFor } from './RevisionRun';
import { useBaseRewards } from './RewardsEditor';
import { ClassMaps, ClassQuestions, QuiltMaps, useQuiltViews } from './QuiltView';
import { EntityTitle, entityNameTex } from './ui';
import { TexText } from '../ui/tex/Tex';
import { offlineList, dropOffline } from './offline';
import { ProgressJsonPanel } from './ProgressJsonPanel';
import { Bar, percent, useAsync, useBusy, useCtx } from './ui';

/** Was sitzt, je Gruppe von Karten — aus den Antworten, gerechnet im Browser [E2, E7]. */
export function summarize(cards: readonly Card[], marks: (card: Card) => ReturnType<typeof marksOf>, now = Date.now(), spacing: Spacing = DEFAULT_SPACING): { levels: Record<Level, number>; knowness: number } {
  const levels: Record<Level, number> = { unseen: 0, learning: 0, known: 0 };
  const values: number[] = [];
  for (const card of cards) {
    const m = marks(card);
    levels[levelOf(m, now, spacing)] += 1;
    values.push(shareOf(knownessOf(m, now, spacing)));
  }
  return { levels, knowness: average(values) };
}

export function OwnProgress({ learner, cards }: { learner: Learner | null; cards: readonly Card[] | null }) {
  const { lib, who } = useCtx();
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const [tick, setTick] = useState(0);
  const local = useAsync(() => localProgress(lib.libraryId), [lib.libraryId, tick]);
  /* 2026-10-28 — die Abschriften gehören einem Konto (`offline.ts`): nur die eigenen. */
  const account = who?.accountId ?? null;
  const offline = useAsync(() => (account === null ? Promise.resolve([]) : offlineList(account)), [account, tick]);
  const { busy, failed, run } = useBusy();
  /* 2026-10-31 — die eigenen Antworten einmal nach Karte (für die Diagramme); neu, sobald eine dazukommt. */
  const answered = learner?.progress.answers.size ?? 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const byCard = useMemo(() => (learner === null ? null : answerIndex(learner.progress, rename)), [learner, rename, answered]);
  /* 2026-11-01 — die Mapy postępów: die Widoki der Baza im Modus „Mapa postępów" (ohne solchen Widok nichts). */
  const quilts = useQuiltViews();
  if (cards === null) return <p className="wk-hint">Liczenie kart…</p>;
  if (learner === null) return <p className="wk-hint">Bez konta postępy zostają w tej przeglądarce — zaloguj się, żeby je zachować.</p>;
  const marks = (card: Card) => learner.marks(card.key, card.fingerprint, rename);
  /* 2026-11-04 (Prompt 15) — die Abstände, die für ihn gelten. */
  const sp = spacingFor(lib, learner);
  const all = summarize(cards, marks, Date.now(), sp);
  const byKind = lib.kinds.map((k) => ({ k, s: summarize(cards.filter((c) => c.entity !== undefined && lib.entity(c.entity)?.kinds.includes(k.id) === true), marks, Date.now(), sp), n: cards.filter((c) => c.entity !== undefined && lib.entity(c.entity)?.kinds.includes(k.id) === true).length })).filter((x) => x.n > 0);
  const suspended = [...learner.progress.suspended];
  return (
    <div className="cg">
      <div className="cg-card">
        <strong>Całość: {percent(all.knowness)}</strong>
        <Bar value={all.knowness} />
        <span className="cg-muted">{(['known', 'learning', 'unseen'] as const).map((l) => `${LEVEL_LABEL[l]}: ${all.levels[l]}`).join(' · ')} · odpowiedzi: {learner.progress.answers.size}</span>
        {learner.waiting > 0 && <span className="wk-note">{learner.waiting} pakietów czeka na internet.</span>}
      </div>
      {/* 2026-11-01 — die Mapa postępów: jede Idee eine Kachel; ein Klick — lesen, die Fragen, „Ćwicz to". */}
      {quilts.length > 0 && byCard !== null && (
        <details className="cg-card" open data-own-quilt="">
          <summary>Mapa postępów</summary>
          <QuiltMaps cards={cards} answers={byCard} learner={learner} spacing={sp} />
        </details>
      )}
      {/* 2026-10-31 — Statystyki: wo die Karten stehen, Tag für Tag, was fällig wird, Themen, Rodzaje pytań, das Schwerste. */}
      {byCard !== null && (
        <details className="cg-card" open data-own-stats="">
          <summary>Statystyki — wykresy znajomości</summary>
          <KnowledgeStats lib={lib} cards={cards} answers={byCard} spacing={sp} />
        </details>
      )}
      <div className="cg-grid">
        {byKind.map(({ k, s, n }) => (
          <div key={k.id} className="cg-card">
            <strong>{k.name}</strong>
            <Bar value={s.knowness} label={k.name} />
            <span className="cg-muted">{n} kart · umiem {s.levels.known}</span>
          </div>
        ))}
      </div>
      {/* 2026-10-27 — Pytanie po pytaniu: ile razy, jak dobrze, jak długo, jak trwale — po wybranym sposobie liczenia. */}
      <details className="cg-card" data-own-questions="">
        <summary>Moje pytania — co umiem, ile to trwało, jak długo zostanie</summary>
        <Stats cards={cards} progress={learner.progress} />
      </details>
      {/* 2026-10-30 — die Kenntnis gehört dem Eintrag: aus seinen Karten (gewogen), dazu, was auf ihm aufbaut. */}
      <details className="cg-card" data-own-items="">
        <summary>Moje wpisy — znajomość wpisu z jego kart</summary>
        <ItemTable cards={cards} learner={learner} rename={rename} />
      </details>
      {lib.collections().length > 0 && (
        <div className="cg-grid">
          {lib.collections().map((c) => {
            const members = lib.members(c.id) ?? new Set<string>();
            const s = summarize(cards.filter((card) => card.entity !== undefined && members.has(card.entity)), marks, Date.now(), sp);
            return <div key={c.id} className="cg-card"><strong>{c.name}</strong><Bar value={s.knowness} /><span className="cg-muted">umiem {s.levels.known}</span></div>;
          })}
        </div>
      )}
      {suspended.length > 0 && (
        <details className="cg-card">
          <summary>Karty, o które nie pytać ({suspended.length})</summary>
          <ul>{suspended.map((key) => <li key={key} className="cg-row"><code>{key.slice(0, 40)}</code><button type="button" className="wk-link-btn" onClick={() => void learner.suspend(key, false)}>przywróć</button></li>)}</ul>
        </details>
      )}
      {local !== undefined && local !== null && local.length > 0 && (
        <div className="cg-card">
          <strong>W tej przeglądarce są postępy bez konta</strong>
          {local.map((l) => (
            <span key={l.key} className="cg-row">{l.answers} odpowiedzi
              <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => { await adoptLocal(l.key, learner); setTick((n) => n + 1); })}>Przenieś do konta</button>
            </span>
          ))}
        </div>
      )}
      {offline !== undefined && offline !== null && offline.length > 0 && (
        <details className="cg-card">
          <summary>Na tym urządzeniu bez internetu ({offline.length})</summary>
          <ul>{offline.map((o) => <li key={`${o.libraryId}:${o.revisionId}`} className="cg-row">{new Date(o.savedAt).toLocaleString('pl-PL')}<button type="button" className="wk-link-btn" onClick={() => { if (account !== null) void dropOffline(account, o.libraryId, o.revisionId).then(() => setTick((n) => n + 1)); }}>usuń</button></li>)}</ul>
        </details>
      )}
      {/* 2026-10-29 — die eigenen Antworten als JSON („recreatio/learn-progress"). */}
      <ProgressJsonPanel learner={learner} cards={cards} />
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

/**
 * 2026-11-01 — WESSEN UCZĄCY SIĘ: die Antworten gehen dorthin, wo gelernt wird (`answersTo.ts`) — eine Baza steht in
 * vielen Kursen, und jeder Kurs (jede Gruppe, jede Seite mit eigenem Bereich) hat seine Leute. Zur Wahl stehen die
 * Bereiche mit Antworten zu dieser Baza, die ich führe, dazu der aus dem Kurs (`chosen`, aus der Adresse) und der aus
 * den Ustawienia der Baza. Wer keinen davon führt und die Baza nicht schreibt, sieht hier nichts.
 */
export function LearnersProgress({ cards, chosen }: { cards: readonly Card[] | null; chosen: string | null }) {
  const { lib, writes } = useCtx();
  const found = useAsync(() => loadAnswerAreas(lib.libraryId).then((r) => r.areas, () => [] as readonly AnswerArea[]), [lib.libraryId]);
  const mine = useAsync(() => loadAreas().then((r) => r.areas, () => [] as readonly AreaRow[]), []);
  const [picked, setPicked] = useState<string | null>(null);
  if (found === undefined || found === null || mine === undefined || mine === null) return null;
  const storage = lib.settings().storageAreaId ?? null;
  const same = (a: string, b: string | null) => b !== null && a.toLowerCase() === b.toLowerCase();
  const leads = (id: string) => mine.some((a) => same(a.areaId, id) && (a.myLevel === 'admin' || a.myLevel === 'write'));
  const options: string[] = [];
  for (const id of [chosen, storage, ...found.map((a) => a.areaId)]) {
    if (id === null || options.some((o) => same(o, id))) continue;
    if (same(id, chosen) || leads(id)) options.push(id);
  }
  const fallback = writes ? storage ?? lib.areaId : null;
  const area = options.find((o) => same(o, picked)) ?? options[0] ?? fallback;
  if (area === null) return null;
  const nameOf = (id: string) => mine.find((a) => same(a.areaId, id))?.name ?? 'obszar';
  const countOf = (id: string) => found.find((a) => same(a.areaId, id))?.learners ?? 0;
  return (
    <details className="cg-card" open={chosen !== null || storage !== null || found.length > 0 || undefined} data-office-fold="">
      <summary>Postępy uczących się (dla nauczyciela)</summary>
      {options.length > 1 && (
        <label className="wk-field cg-office-area">
          <span>Uczący się z obszaru</span>
          <select value={area} onChange={(e) => setPicked(e.target.value)} data-office-area="">
            {options.map((id) => <option key={id} value={id}>{nameOf(id)} — {countOf(id)} {plural(countOf(id), 'uczący się', 'uczących się', 'uczących się')}</option>)}
          </select>
        </label>
      )}
      <OfficeProgress key={area} cards={cards} area={area} />
    </details>
  );
}

/** Für die Lehrerin: alle Lernenden eines Bereichs — mit dem Schlüssel der Annahme, den sie hält. */
export function OfficeProgress({ cards, area }: { cards: readonly Card[] | null; area: string }) {
  const { lib, me } = useCtx();
  const [rows, setRows] = useState<readonly LearnerProgress[] | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [failed, setFailed] = useState<string | null>(null);
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  useEffect(() => {
    if (me === null) return;
    let alive = true;
    void (async () => {
      try {
        /*
         * Die Przyjęcia des Bereichs — wenn es sie gibt und ich ihren Schlüssel halte. 2026-11-01: ohne sie lese ich
         * trotzdem, was im eigenen Bereich einer Person liegt (die „Obszary osób" eines Formulars): mit dem Schlüssel
         * jenes Bereichs, den mir die Regel gibt.
         */
        const intake = await loadIntake(area).then((row) => openIntakeKey(row, me.ring), () => null).catch(() => null);
        const found = await areaProgress(area, lib.libraryId, intake, (where, epoch) => areaKeys(me.ring, where).then((m) => m.get(epoch)));
        if (intake === null && found.length === 0) throw new Error('no intake');
        const named = new Map<string, string>();
        /*
         * 2026-11-01 — die Namen stehen dort, wo die Menschen sind: im Bereich der Antworten, in den Bereichen darüber
         * (die Uczący się eines Kurses schicken in den Bereich seiner Prowadzący darin) und im Bereich der Baza.
         */
        const mine = await loadAreas().then((r) => r.areas, () => [] as readonly AreaRow[]);
        const where: string[] = [];
        for (let at: string | null = area, n = 0; at !== null && n < 16 && !where.includes(at); n += 1) {
          where.push(at);
          const here: string = at;
          at = mine.find((a) => a.areaId.toLowerCase() === here.toLowerCase())?.parentAreaId ?? null;
        }
        for (const extra of [lib.areaId, lib.settings().storageAreaId]) if (extra !== undefined && !where.includes(extra)) where.push(extra);
        for (const one of where) {
          try { for (const s of (await loadSeats(one)).seats) if (s.recipientName !== null && !named.has(`s:${s.seatId}`)) named.set(`s:${s.seatId}`, s.recipientName); } catch { /* ohne Plätze */ }
          try {
            const keys = await areaKeys(me.ring, one);
            for (const [role, n] of await openNames(keys, one, (await loadAreaNames(one)).names)) if (!named.has(`r:${role}`)) named.set(`r:${role}`, n);
          } catch { /* ohne Namen */ }
        }
        for (const r of me.roles) if (me.names.has(r.id)) named.set(`r:${r.id}`, me.names.get(r.id)!);
        if (alive) { setRows(found); setNames(named); }
      } catch {
        if (alive) setFailed('Postępy w tym obszarze czyta ten, kto ma klucz jego przyjęć (Annahme). Obszar może nie mieć jeszcze przyjęć.');
      }
    })();
    return () => { alive = false; };
  }, [me, area, lib.libraryId]);
  const scope = useScope(cards);
  const [model, setModel] = useModel();
  const [open, setOpen] = useState<string | null>(null);
  const nameOf = (r: LearnerProgress) => names.get(r.holder) ?? (r.seatId !== null ? `osoba ${r.seatId.slice(-4)}` : `osoba ${r.roleId?.slice(-4) ?? ''}`);
  /* 2026-10-31 — jeder Uczący się mit seinen Antworten nach Karte geordnet: für die Diagramme aller und jedes Einzelnen. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const learners = useMemo(() => (rows ?? []).map((r) => ({ id: r.holder, name: nameOf(r), answers: answerIndex(r.progress, rename), spacing: spacingFor(lib, r) })), [rows, names, rename, lib, lib.revision]);
  /* 2026-11-01 — die Mapy postępów der Baza (Widoki im Modus „Mapa postępów"): die Klasse zusammen und jeder für sich. */
  const quilts = useQuiltViews();
  /* 2026-11-05 (Prompt 17) — die Nagrody der Nauka: „Odznaki i poziomy" jedes Uczący się. */
  const rewards = useBaseRewards();
  if (failed !== null) return <p className="wk-hint">{failed}</p>;
  if (rows === null || cards === null) return <p className="wk-hint">Otwieranie postępów…</p>;
  if (rows.length === 0) return <p className="wk-empty">Nikt jeszcze nie odpowiadał w tym obszarze.</p>;
  const now = Date.now();
  const shown = scope.cards ?? cards;
  const statsFor = (progress: Answers) => cardStats(shown, cards, (card) => answersOf(progress, card.key, card.fingerprint, rename), model, lib.dependencies(), now, spacingFor(lib, { progress }));
  return (
    <div className="cg" data-office-progress={rows.length}>
      <StatsControls scope={scope} model={model} onModel={setModel} />
      {/* 2026-10-31 — alle zusammen als Diagramme: Kacheln, jeder als Balken, Tematy × uczący się, Antworten je Tag, das Schwerste. */}
      <ClassKnowledge lib={lib} cards={shown} learners={learners} />
      {/* 2026-11-01 — wer was kann, auf der Karte des Kurses (Ideen unter Lektionen): alle zusammen, oder eine Person. */}
      {quilts.length > 0 && (
        <details className="cg-card" open data-class-quilt-fold="">
          <summary>Mapa postępów klasy — kto co umie</summary>
          <ClassMaps cards={cards} learners={learners} />
        </details>
      )}
      {/* 2026-11-01 — je Frage über alle: wo die Klasse scheitert, wie viele Versuche, Podpowiedzi, die häufigste falsche Antwort. */}
      <details className="cg-card" data-class-questions-fold="">
        <summary>Pytania — gdzie klasa się myli</summary>
        <ClassQuestions cards={shown} learners={learners} />
      </details>
      <span className="cg-muted">Kliknij imię — zobaczysz odpowiedzi tej osoby, pytanie po pytaniu, i jej wykresy.</span>
      <div className="cg-table-wrap">
        <table className="cg-table cg-stats-table">
          <thead><tr><th>Uczący się</th><th>Umie</th><th>W nauce</th><th>Jeszcze nie</th><th>Odpowiedzi</th><th>Czas nauki</th><th>Na odpowiedź</th><th>Ostatnio</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const all = statsOf(statsFor(r.progress));
              const share = all.cards === 0 ? 0 : all.known / all.cards;
              return (
                <Fragment key={r.holder}>
                  <tr data-learner-row={r.holder}>
                    <td><button type="button" className="cg-ref" aria-expanded={open === r.holder} onClick={() => setOpen(open === r.holder ? null : r.holder)}>{nameOf(r)}</button></td>
                    <td><Bar value={share} /> {all.known} z {all.cards}</td>
                    <td>{all.learning}</td>
                    <td>{all.unseen}</td>
                    <td>{all.answers}</td>
                    <td>{all.msTotal === 0 ? '—' : spanText(all.msTotal)}</td>
                    <td>{all.msPerAnswer === null ? '—' : spanText(all.msPerAnswer)}</td>
                    <td>{new Date(r.lastAt).toLocaleDateString('pl-PL')}</td>
                  </tr>
                  {open === r.holder && (
                    <tr className="cg-stats-open">
                      <td colSpan={8}>
                        {/* 2026-10-31 — dieselben Diagramme, die der Uczący się selbst sieht. */}
                        <KnowledgeStats lib={lib} cards={shown} answers={learners.find((l) => l.id === r.holder)?.answers ?? (() => [])} spacing={spacingFor(lib, r)} />
                        {/* 2026-11-01 — und seine Mapa postępów (ohne „Ćwicz to" — üben kann nur er selbst). */}
                        {quilts.length > 0 && (
                          <details className="cg-card" open data-learner-quilt={r.holder}>
                            <summary>Mapa postępów — {nameOf(r)}</summary>
                            <QuiltMaps cards={cards} answers={learners.find((l) => l.id === r.holder)?.answers ?? (() => [])} spacing={spacingFor(lib, r)} />
                          </details>
                        )}
                        {/* 2026-11-05 (Prompt 17) — seine Abzeichen und Stufen: dieselbe Seite, die er selbst sieht, ohne Handlungen. */}
                        <details className="cg-card" data-learner-badges={r.holder}>
                          <summary>{rewardWords(baseLang(lib)).titleOf(nameOf(r))}</summary>
                          <BadgesPage readOnly rules={rewards.rules} answers={r.progress.answers} values={r.progress.values} rename={rename} lang={baseLang(lib)} title="" />
                        </details>
                        {/* 2026-11-01 — was er geantwortet hat, Antwort für Antwort. */}
                        <details className="cg-card" open data-learner-answers={r.holder}>
                          <summary>Odpowiedzi — co odpowiedział(a)</summary>
                          <AnswerLog progress={r.progress} cards={cards} shown={shown} />
                        </details>
                        <QuestionTable stats={statsFor(r.progress)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -- 2026-10-27: Statystyki — zakres, sposób liczenia, pytanie po pytaniu ------------------------------------------ */

interface Scope {
  readonly id: string;
  readonly set: (id: string) => void;
  /** Die Karten der gewählten Powtórka — `null`: die ganze Baza. */
  readonly cards: readonly Card[] | null;
}

/** Der Zakres: die ganze Baza oder eine Powtórka (das, was man jemandem gegeben hat). */
function useScope(all: readonly Card[] | null): Scope {
  const { lib } = useCtx();
  const [id, setId] = useState('');
  const planned = useAsync(id === '' || all === null ? null : () => planFor(lib, id, null, 'stats').then((r) => r.plan?.cards ?? []), [lib, lib.revision, id, all === null]);
  return { id, set: setId, cards: id === '' ? null : planned ?? null };
}

const MODEL_KEY = 'cg-progress-model';

/** Der Sposób liczenia — gemerkt in diesem Browser (eine Bequemlichkeit, kein Zustand). */
function useModel(): [Model, (m: Model) => void] {
  const [model, setModel] = useState<Model>(() => {
    try { const v = window.localStorage.getItem(MODEL_KEY); return MODELS.some((m) => m.id === v) ? v as Model : 'memory'; } catch { return 'memory'; }
  });
  const set = (m: Model) => { setModel(m); try { window.localStorage.setItem(MODEL_KEY, m); } catch { /* bez pamięci */ } };
  return [model, set];
}

function StatsControls({ scope, model, onModel }: { scope: Scope; model: Model; onModel: (m: Model) => void }) {
  const { lib } = useCtx();
  const revisions = lib.docs('revision');
  return (
    <div className="cg cg-stats-controls">
      <div className="cg-row">
        <label className="wk-field"><span>Zakres</span>
          <select value={scope.id} onChange={(e) => scope.set(e.target.value)} data-stats-scope="">
            <option value="">cała baza wiedzy</option>
            {revisions.map((r) => <option key={r.id} value={r.id}>powtórka: {String(r.data.name ?? 'Powtórka')}</option>)}
          </select>
        </label>
        <div className="wk-field"><span>Kiedy „umie”</span>
          <div className="cg-chips" role="radiogroup" aria-label="Sposób liczenia">
            {MODELS.map((m) => <button key={m.id} type="button" role="radio" aria-checked={m.id === model} className={`cg-chip${m.id === model ? ' is-on' : ''}`} data-model={m.id} onClick={() => onModel(m.id)}>{m.label}</button>)}
          </div>
        </div>
      </div>
      <span className="cg-muted">{MODELS.find((m) => m.id === model)?.says}</span>
    </div>
  );
}

/** Für sich selbst: dieselben Zahlen, aus den eigenen Antworten. */
function Stats({ cards, progress }: { cards: readonly Card[]; progress: Answers }) {
  const { lib } = useCtx();
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const scope = useScope(cards);
  const [model, setModel] = useModel();
  const shown = scope.cards ?? cards;
  const stats = cardStats(shown, cards, (card) => answersOf(progress, card.key, card.fingerprint, rename), model, lib.dependencies(), Date.now(), spacingFor(lib, { progress }));
  const all = statsOf(stats);
  return (
    <div className="cg">
      <StatsControls scope={scope} model={model} onModel={setModel} />
      <span className="cg-muted" data-own-summary={all.known}>Umiem {all.known} z {all.cards} · w nauce {all.learning} · jeszcze nie {all.unseen} · czas nauki {all.msTotal === 0 ? '—' : spanText(all.msTotal)}{all.msPerAnswer === null ? '' : ` · średnio ${spanText(all.msPerAnswer)} na odpowiedź`}</span>
      <QuestionTable stats={stats} />
    </div>
  );
}

/**
 * 2026-10-30 — WPIS PO WPISIE: seine Kenntnis aus den Karten, die ihn prüfen (gewogen; nur beantwortete zählen), und
 * mit dem, co na nim buduje (A.3) — die Zahl, die widoki i powtórki widzą („Filtr znajomości"). Das Schwächste zuerst.
 */
function ItemTable({ cards, learner, rename }: { cards: readonly Card[]; learner: Learner; rename: ((key: string) => string) | undefined }) {
  const { lib } = useCtx();
  const now = Date.now();
  const fp = new Map(cards.map((c) => [c.key, c.fingerprint]));
  const g = gaugeFromMarks(cards, (key) => learner.marks(key, fp.get(key), rename), lib.dependencies(), now, undefined, spacingFor(lib, learner));
  const rows = [...g.testing.entries()].filter(([id]) => lib.entity(id) !== undefined).map(([id, tests]) => ({
    id, own: ownKnowness(g, id), total: itemKnowness(g, id), answered: tests.filter((t) => g.states.has(t.key)).length, all: tests.length, due: itemDue(g, id)
  }));
  rows.sort((a, b) => (a.answered === 0 ? 1 : 0) - (b.answered === 0 ? 1 : 0) || a.total - b.total);
  if (rows.length === 0) return <span className="cg-muted">Brak wpisów z kartami.</span>;
  return (
    <div className="cg-table-wrap">
      <table className="cg-table cg-stats-table" data-item-stats={rows.length}>
        <thead><tr><th>Wpis</th><th>Z jego kart</th><th>Z tym, co na nim buduje</th><th>Karty z odpowiedzią</th><th>Kiedy powtórzyć</th></tr></thead>
        <tbody>
          {rows.slice(0, 300).map((r) => (
            <tr key={r.id} className={r.total >= KNOWN ? 'is-known' : r.answered > 0 ? 'is-learning' : 'is-unseen'}>
              <td className="cg-stats-q"><EntityTitle lib={lib} id={r.id} /></td>
              <td>{r.answered === 0 ? '—' : percent(shareOf(r.own))}</td>
              <td>{r.total === 0 && r.answered === 0 ? '—' : percent(shareOf(r.total))}</td>
              <td>{r.answered} z {r.all}</td>
              <td>{r.due === null ? '—' : new Date(r.due).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 300 && <span className="cg-muted">Pokazano 300 najsłabszych z {rows.length}.</span>}
    </div>
  );
}

/**
 * PYTANIE PO PYTANIU: wie oft, wie oft richtig, wie lange je Antwort, wann zuletzt, die Kenntnis jetzt, wie lange sie
 * hält (Trwałość) und was in einer Woche bleibt — das Schwächste zuerst.
 */
function QuestionTable({ stats }: { stats: readonly CardStat[] }) {
  const { lib } = useCtx();
  /* 2026-11-01 — die Frage mit ihren Wzory (der Name eines Eintrags ebenso). */
  const name = (id: string) => entityNameTex(lib, id);
  const ordered = [...stats].sort((a, b) => Number(a.known) - Number(b.known) || a.now - b.now);
  if (ordered.length === 0) return <span className="cg-muted">Brak kart w tym zakresie.</span>;
  return (
    <div className="cg-table-wrap">
      <table className="cg-table cg-stats-table" data-question-stats={ordered.length}>
        <thead><tr><th>Pytanie</th><th>Odpowiedzi</th><th>Dobrze</th><th>Na odpowiedź</th><th>Ostatnio</th><th>Teraz</th><th>Trwałość</th><th>Za tydzień</th><th>Umie</th></tr></thead>
        <tbody>
          {ordered.slice(0, 300).map((s) => (
            <tr key={s.card.key} className={s.known ? 'is-known' : s.seen ? 'is-learning' : 'is-unseen'}>
              <td className="cg-stats-q"><TexText text={cardLine(s.card, name)} /></td>
              <td>{s.answers}</td>
              <td>{s.answers === 0 ? '—' : `${s.right} (${percent(s.share ?? 0)})`}</td>
              <td>{s.msAvg === null ? '—' : spanText(s.msAvg)}</td>
              <td>{s.lastAt === null ? '—' : new Date(s.lastAt).toLocaleDateString('pl-PL')}</td>
              <td>{s.seen ? percent(shareOf(s.now)) : '—'}</td>
              <td>{holdsText(s.holdsHours)}</td>
              <td>{s.seen ? percent(shareOf(s.inWeek)) : '—'}</td>
              <td>{s.known ? 'tak' : s.seen ? 'jeszcze nie' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {ordered.length > 300 && <span className="cg-muted">Pokazano 300 najsłabszych z {ordered.length}.</span>}
    </div>
  );
}
