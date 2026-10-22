/**
 * PORZĄDKI — der Bildschirm der Umstellung (2026-10-22, `libraryMigrate.ts`).
 *
 * Zeigt, was wohin kommt, bevor etwas geschieht; Schritt 1 legt Komentarze
 * an (die alten Werte bleiben), Schritt 2 räumt erst nach ausdrücklicher
 * Bestätigung auf. `#/workspace/library/porzadki`.
 */

import { useEffect, useMemo, useState } from 'react';

import type { AreaRow } from '../areas/area';
import type { Me } from '../core/me';
import { viewPath } from '../routes';
import { kindOf } from './libraryKinds';
import type { OpenLibrary } from './library';
import { PERSONAL, planTidy, type EntryMove, type TidyLibrary } from './libraryMigrate';
import { finish, prepare } from './libraryTidyRun';
import { storeOf } from './libraryStore';

const FIELD_WORDS: Record<string, string> = { description: 'opis', notes: 'notatki', 'plan.note': 'notatka przy punkcie planu' };

export function LibraryTidy({ me, libraries, areas, onChanged }: {
  me: Me; libraries: readonly OpenLibrary[]; areas: readonly AreaRow[]; onChanged: () => void;
}) {
  const libs: TidyLibrary[] = useMemo(() => libraries.map((library) => ({ library, store: storeOf(me.ring, library) })), [libraries, me.ring]);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [choices, setChoices] = useState<ReadonlyMap<string, string | null>>(new Map());
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<readonly string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const offs = libs.map(({ store }) => store.subscribe(() => setRevision((n) => n + 1)));
    void Promise.all(libs.map(({ store }) => store.sync())).then(() => { if (alive) setLoaded(true); }, () => { if (alive) setFailed('Nie udało się wczytać wszystkich bibliotek.'); });
    return () => { alive = false; offs.forEach((off) => off()); };
  }, [libs]);

  const personalArea = areas.find((a) => a.personal === true)?.areaId ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plan = useMemo(() => (loaded ? planTidy(libs, personalArea) : null), [loaded, libs, personalArea, revision]);
  if (failed !== null && plan === null) return <p className="wk-error">{failed}</p>;
  if (plan === null) return <p className="wk-lede">Wczytywanie bibliotek…</p>;

  const nameOf = (id: string | null) => (id === null ? 'zostaje, gdzie jest'
    : id === PERSONAL ? 'Prywatna biblioteka (powstanie — tylko Ty)'
    : libraries.find((l) => l.libraryId === id)?.name ?? 'biblioteka');
  const titleOf = (entryId: string) => {
    for (const { store } of libs) { const e = store.own(entryId); if (e !== undefined) return `${kindOf(e.kind)?.label ?? e.kind}: ${store.title(e)}`; }
    return entryId;
  };
  const whereOf = (move: EntryMove) => (choices.has(move.entryId) ? choices.get(move.entryId)! : move.target);
  const todo = plan.comments.filter((c) => c.existing === null).length;
  const nothing = plan.comments.length === 0 && plan.moves.length === 0 && plan.strip.length === 0 && plan.settle.length === 0;

  const run = async (label: string, work: () => Promise<readonly string[]>) => {
    setBusy(label);
    setFailed(null);
    try {
      const lines = await work();
      setLog((was) => [...was, ...lines]);
      onChanged();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };
  const ctx = { me, areas, libs, progress: (line: string) => setBusy(line) };

  const setAll = (from: string, reason: EntryMove['reason'], target: string | null) => {
    const next = new Map(choices);
    for (const m of plan.moves) if (m.from === from && m.reason === reason) next.set(m.entryId, target);
    setChoices(next);
  };
  const groups = [...new Set(plan.moves.map((m) => `${m.from}|${m.reason}`))].map((k) => {
    const [from, reason] = k.split('|') as [string, EntryMove['reason']];
    return { from, reason, moves: plan.moves.filter((m) => m.from === from && m.reason === reason) };
  });

  return (
    <>
      <p><a className="wk-link" href={viewPath('library')}>← Biblioteki</a></p>
      <h1 className="wk-h1">Porządki: komentarze i widoczność</h1>
      <p className="wk-lede">
        Od teraz o tym, kto widzi wpis, decyduje wyłącznie obszar jego biblioteki — nie ma już publikowania pojedynczych wpisów ani pól prywatnych.
        Opisy i notatki stają się komentarzami. Nic nie zmienia się samo: najpierw zobacz, co trafi gdzie.
      </p>
      {nothing && <p className="wk-note">Wszystko jest już po nowemu.</p>}
      {plan.blocked.length > 0 && (
        <p className="wk-warn">Tylko do czytania (stare pola zostają, dopóki ktoś z prawem zapisu nie zrobi porządków): {plan.blocked.map(nameOf).join(', ')}.</p>
      )}

      {plan.comments.length > 0 && (
        <section className="wk-form">
          <h2 className="wk-h2">1. Opisy i notatki → komentarze</h2>
          <p className="wk-hint">Notatki trafiają do biblioteki prywatnej (widzisz je tylko Ty), opisy zostają obok swojego wpisu i idą z nim, jeśli się przenosi. Stare wartości zostają na miejscu aż do kroku 2.</p>
          <div className="lib-table-wrap">
            <table className="lib-table">
              <thead><tr><th scope="col">Wpis</th><th scope="col">Pole</th><th scope="col">Dokąd</th><th scope="col">Stan</th></tr></thead>
              <tbody>
                {plan.comments.map((c) => (
                  <tr key={c.key}>
                    <td>{titleOf(c.entryId)}</td>
                    <td>{FIELD_WORDS[c.field] ?? c.field}</td>
                    <td>{c.target === 'with-entry' ? `obok wpisu (${nameOf(c.from)})` : nameOf(c.target)}</td>
                    <td>{c.existing === null ? 'do utworzenia' : <a href={viewPath('library', libs.find((l) => l.store.own(c.existing!) !== undefined)?.library.libraryId ?? c.from, c.existing)}>jest ✓</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy !== null || todo === 0}
              onClick={() => void run('Krok 1…', async () => { const r = await prepare(plan, ctx); return [`Utworzono komentarzy: ${r.made}.`, ...r.failed]; })}>
              {todo === 0 ? 'Krok 1 zrobiony' : `Krok 1: utwórz ${todo} komentarzy`}
            </button>
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section className="wk-form">
          <h2 className="wk-h2">2. Widoczność wpisów</h2>
          {groups.map(({ from, reason, moves }) => (
            <div key={`${from}-${reason}`} className="lib-tidy-group">
              <h3 className="lib-box-h">{nameOf(from)}</h3>
              <p>
                {reason === 'exposure'
                  ? `Obszar jest publiczny, ale tych ${moves.length} wpisów nikt spoza obszaru dotąd nie widział (nie były opublikowane). Jeśli zostaną, zobaczy je każdy.`
                  : `Te ${moves.length} wpisów były opublikowane, a obszar nie jest publiczny. Jeśli zostaną, zobaczą je tylko członkowie obszaru.`}
              </p>
              <label className="wk-field">
                <span>Wszystkim</span>
                <select disabled={busy !== null} onChange={(e) => setAll(from, reason, e.target.value === '' ? null : e.target.value)} defaultValue="-">
                  <option value="-" disabled>— wybierz —</option>
                  {moves[0].options.map((o) => <option key={o ?? ''} value={o ?? ''}>{o === null ? (reason === 'exposure' ? 'zostaw — niech będą publiczne' : 'zostaw — tylko dla członków') : `przenieś: ${nameOf(o)}`}</option>)}
                </select>
              </label>
              <ul className="lib-list">
                {moves.map((m) => (
                  <li key={m.entryId} className="lib-tidy-row">
                    <span>{titleOf(m.entryId)}</span>
                    <select value={whereOf(m) ?? ''} disabled={busy !== null} aria-label="Dokąd"
                      onChange={(e) => setChoices(new Map(choices).set(m.entryId, e.target.value === '' ? null : e.target.value))}>
                      {m.options.map((o) => <option key={o ?? ''} value={o ?? ''}>{o === null ? 'zostaw' : `przenieś: ${nameOf(o)}`}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {!nothing && (
        <section className="wk-form">
          <h2 className="wk-h2">3. Zatwierdź</h2>
          <p>
            Usuwa stare pola ({plan.strip.length} wpisów: opisy, notatki, notatki przy punktach, „Nie publikuj”), przenosi wybrane wpisy,
            wycofuje stare publiczne kopie i oznacza biblioteki jako przejrzane ({plan.settle.length}) — dopiero wtedy publiczny obszar pokazuje swoją bibliotekę wszystkim.
          </p>
          {todo > 0 && <p className="wk-warn">Najpierw krok 1 — {todo} wartości nie ma jeszcze w komentarzach.</p>}
          <label className="pe-check">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span>Sprawdziłem komentarze i wybory powyżej.</span>
          </label>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy !== null || todo > 0 || !checked}
              onClick={() => void run('Krok 2…', () => finish(plan, choices, ctx))}>Krok 2: zatwierdź</button>
          </div>
        </section>
      )}

      {busy !== null && <p className="wk-lede" role="status">{busy}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {log.length > 0 && <ul className="lib-list">{log.map((line, i) => <li key={i}>{line}</li>)}</ul>}
    </>
  );
}
