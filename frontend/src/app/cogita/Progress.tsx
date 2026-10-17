/**
 * COGITA — FORTSCHRITT (COGITA.md §6, §7): der eigene — je Art, Thema, Zbiór,
 * was sitzt, was wackelt, was nie gefragt wurde, gesperrte Karten, was ohne
 * Konto gelernt wurde —, und für die Lehrerin der aller Lernenden des
 * Bereichs, in dem die Antworten liegen [E10].
 */

import { useEffect, useMemo, useState } from 'react';

import { areaKeys, loadAreaNames, openNames } from '../chat/chat';
import { loadIntake, openIntakeKey } from '../forms/intake';
import { loadSeats } from '../seats/seat';
import type { Card } from './cardBasics';
import { average, knownessOf, levelOf, LEVEL_LABEL, shareOf, type Level } from './knowness';
import { adoptLocal, areaProgress, localProgress, marksOf, renamer, type Learner, type LearnerProgress } from './learn';
import { offlineList, dropOffline } from './offline';
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
  const { lib } = useCtx();
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const [tick, setTick] = useState(0);
  const local = useAsync(() => localProgress(lib.libraryId), [lib.libraryId, tick]);
  const offline = useAsync(() => offlineList(), [tick]);
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
          <ul>{offline.map((o) => <li key={`${o.libraryId}:${o.revisionId}`} className="cg-row">{new Date(o.savedAt).toLocaleString('pl-PL')}<button type="button" className="wk-link-btn" onClick={() => void dropOffline(o.libraryId, o.revisionId).then(() => setTick((n) => n + 1))}>usuń</button></li>)}</ul>
        </details>
      )}
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
  if (failed !== null) return <p className="wk-hint">{failed}</p>;
  if (rows === null || cards === null) return <p className="wk-hint">Otwieranie postępów…</p>;
  if (rows.length === 0) return <p className="wk-empty">Nikt jeszcze nie odpowiadał w tym obszarze.</p>;
  return (
    <div className="cg-table-wrap">
      <table className="cg-table">
        <thead><tr><th>Uczący się</th><th>Znajomość</th><th>Umie</th><th>W nauce</th><th>Odpowiedzi</th><th>Ostatnio</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const s = summarize(cards, (card) => marksOf(r.progress, card.key, card.fingerprint, rename));
            return (
              <tr key={r.holder}>
                <td>{names.get(r.holder) ?? (r.seatId !== null ? `osoba ${r.seatId.slice(-4)}` : `osoba ${r.roleId?.slice(-4) ?? ''}`)}</td>
                <td><Bar value={s.knowness} /> {percent(s.knowness)}</td>
                <td>{s.levels.known}</td>
                <td>{s.levels.learning}</td>
                <td>{r.progress.answers.size}</td>
                <td>{new Date(r.lastAt).toLocaleDateString('pl-PL')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
