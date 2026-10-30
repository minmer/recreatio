/**
 * COGITA — FORTSCHRITT (COGITA.md §6, §7): der eigene — je Art, Thema, Zbiór,
 * was sitzt, was wackelt, was nie gefragt wurde, gesperrte Karten, was ohne
 * Konto gelernt wurde —, und für die Lehrerin der aller Lernenden des
 * Bereichs, in dem die Antworten liegen [E10].
 */

import { Fragment, useEffect, useMemo, useState } from 'react';

import { areaKeys, loadAreaNames, openNames } from '../chat/chat';
import { loadIntake, openIntakeKey } from '../forms/intake';
import { loadSeats } from '../seats/seat';
import type { Card } from './cardBasics';
import { average, knownessOf, KNOWN, levelOf, LEVEL_LABEL, shareOf, type Level } from './knowness';
import { gaugeFromMarks, itemDue, itemKnowness, ownKnowness } from './knowing';
import { adoptLocal, areaProgress, localProgress, marksOf, renamer, type Learner, type LearnerProgress, type Progress as Answers } from './learn';
import { answersOf, cardStats, holdsText, MODELS, spanText, summarize as statsOf, type CardStat, type Model } from './measures';
import { planFor } from './RevisionRun';
import { entityName } from './ui';
import { offlineList, dropOffline } from './offline';
import { ProgressJsonPanel } from './ProgressJsonPanel';
import { Bar, percent, useAsync, useBusy, useCtx } from './ui';

/** Was sitzt, je Gruppe von Karten — aus den Antworten, gerechnet im Browser [E2, E7]. */
export function summarize(cards: readonly Card[], marks: (card: Card) => ReturnType<typeof marksOf>, now = Date.now()): { levels: Record<Level, number>; knowness: number } {
  const levels: Record<Level, number> = { unseen: 0, learning: 0, known: 0 };
  const values: number[] = [];
  for (const card of cards) {
    const m = marks(card);
    levels[levelOf(m, now)] += 1;
    values.push(shareOf(knownessOf(m, now)));
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
  if (cards === null) return <p className="wk-hint">Liczenie kart…</p>;
  if (learner === null) return <p className="wk-hint">Bez konta postępy zostają w tej przeglądarce — zaloguj się, żeby je zachować.</p>;
  const marks = (card: Card) => learner.marks(card.key, card.fingerprint, rename);
  const all = summarize(cards, marks);
  const byKind = lib.kinds.map((k) => ({ k, s: summarize(cards.filter((c) => c.entity !== undefined && lib.entity(c.entity)?.kinds.includes(k.id) === true), marks), n: cards.filter((c) => c.entity !== undefined && lib.entity(c.entity)?.kinds.includes(k.id) === true).length })).filter((x) => x.n > 0);
  const suspended = [...learner.progress.suspended];
  return (
    <div className="cg">
      <div className="cg-card">
        <strong>Całość: {percent(all.knowness)}</strong>
        <Bar value={all.knowness} />
        <span className="cg-muted">{(['known', 'learning', 'unseen'] as const).map((l) => `${LEVEL_LABEL[l]}: ${all.levels[l]}`).join(' · ')} · odpowiedzi: {learner.progress.answers.size}</span>
        {learner.waiting > 0 && <span className="wk-note">{learner.waiting} pakietów czeka na internet.</span>}
      </div>
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
            const s = summarize(cards.filter((card) => card.entity !== undefined && members.has(card.entity)), marks);
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

/** Für die Lehrerin: alle Lernenden des Speicherbereichs — mit dem Schlüssel der Annahme, den sie hält. */
export function OfficeProgress({ cards }: { cards: readonly Card[] | null }) {
  const { lib, me } = useCtx();
  const area = lib.settings().storageAreaId ?? lib.areaId;
  const [rows, setRows] = useState<readonly LearnerProgress[] | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [failed, setFailed] = useState<string | null>(null);
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  useEffect(() => {
    if (me === null) return;
    let alive = true;
    void (async () => {
      try {
        const intake = await openIntakeKey(await loadIntake(area), me.ring);
        const found = await areaProgress(area, lib.libraryId, intake);
        const named = new Map<string, string>();
        try { for (const s of (await loadSeats(area)).seats) if (s.recipientName !== null) named.set(`s:${s.seatId}`, s.recipientName); } catch { /* ohne Plätze */ }
        try {
          const keys = await areaKeys(me.ring, area);
          for (const [role, n] of await openNames(keys, area, (await loadAreaNames(area)).names)) named.set(`r:${role}`, n);
        } catch { /* ohne Namen */ }
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
  if (failed !== null) return <p className="wk-hint">{failed}</p>;
  if (rows === null || cards === null) return <p className="wk-hint">Otwieranie postępów…</p>;
  if (rows.length === 0) return <p className="wk-empty">Nikt jeszcze nie odpowiadał w tym obszarze.</p>;
  const nameOf = (r: LearnerProgress) => names.get(r.holder) ?? (r.seatId !== null ? `osoba ${r.seatId.slice(-4)}` : `osoba ${r.roleId?.slice(-4) ?? ''}`);
  const now = Date.now();
  const shown = scope.cards ?? cards;
  const statsFor = (progress: Answers) => cardStats(shown, cards, (card) => answersOf(progress, card.key, card.fingerprint, rename), model, lib.dependencies(), now);
  return (
    <div className="cg" data-office-progress={rows.length}>
      <StatsControls scope={scope} model={model} onModel={setModel} />
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
                    <tr className="cg-stats-open"><td colSpan={8}><QuestionTable stats={statsFor(r.progress)} /></td></tr>
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
  const stats = cardStats(shown, cards, (card) => answersOf(progress, card.key, card.fingerprint, rename), model, lib.dependencies(), Date.now());
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
  const g = gaugeFromMarks(cards, (key) => learner.marks(key, fp.get(key), rename), lib.dependencies(), now);
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
              <td className="cg-stats-q">{entityName(lib, r.id).slice(0, 140)}</td>
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

/** Was eine Karte fragt, in Worten — für die Liste. */
function cardText(card: Card, name: (id: string) => string): string {
  const prompt = card.prompt.map((p) => p.text).join(' ').trim();
  const base = prompt !== '' ? prompt : card.entity !== undefined ? name(card.entity) : card.question;
  return card.label === undefined ? base : `${base}: ${card.label}`;
}

/**
 * PYTANIE PO PYTANIU: wie oft, wie oft richtig, wie lange je Antwort, wann zuletzt, die Kenntnis jetzt, wie lange sie
 * hält (Trwałość) und was in einer Woche bleibt — das Schwächste zuerst.
 */
function QuestionTable({ stats }: { stats: readonly CardStat[] }) {
  const { lib } = useCtx();
  const name = (id: string) => entityName(lib, id);
  const ordered = [...stats].sort((a, b) => Number(a.known) - Number(b.known) || a.now - b.now);
  if (ordered.length === 0) return <span className="cg-muted">Brak kart w tym zakresie.</span>;
  return (
    <div className="cg-table-wrap">
      <table className="cg-table cg-stats-table" data-question-stats={ordered.length}>
        <thead><tr><th>Pytanie</th><th>Odpowiedzi</th><th>Dobrze</th><th>Na odpowiedź</th><th>Ostatnio</th><th>Teraz</th><th>Trwałość</th><th>Za tydzień</th><th>Umie</th></tr></thead>
        <tbody>
          {ordered.slice(0, 300).map((s) => (
            <tr key={s.card.key} className={s.known ? 'is-known' : s.seen ? 'is-learning' : 'is-unseen'}>
              <td className="cg-stats-q">{cardText(s.card, name).slice(0, 140)}</td>
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
