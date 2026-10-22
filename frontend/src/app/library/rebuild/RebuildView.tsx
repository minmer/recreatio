/**
 * PORZĄDKI — DER BILDSCHIRM DER UMBAUTEN (`#/workspace/library/porzadki`).
 *
 * Eine Seite je Umbau: zuerst, was sich ändern würde („Co się zmieni"), dann
 * ein Knopf, dann der Bericht. Nichts geschieht von selbst; der Besitzer
 * startet jeden Umbau auf seinen echten Daten. Die erste Seite ist die
 * Umstellung auf die Sichtbarkeit durch Bereiche (`LibraryTidy.tsx`), die
 * übrigen kommen aus `REBUILDS`.
 */

import { useEffect, useMemo, useState } from 'react';

import type { AreaRow } from '../../areas/area';
import type { Me } from '../../core/me';
import { viewPath } from '../../routes';
import { Segment } from '../../ui/Segment';
import { libraryKindOf, type OpenLibrary } from '../library';
import { storeOf } from '../libraryStore';
import { LibraryTidy } from '../LibraryTidy';
import type { Rebuild, RebuildCtx, RebuildPlan } from './rebuild';
import { REBUILDS } from './rebuilds';

export function RebuildView({ me, libraries, areas, onChanged }: {
  me: Me;
  /** Alle lesbaren Bibliotheken und Bazy wiedzy. */
  libraries: readonly OpenLibrary[];
  areas: readonly AreaRow[];
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<string>('widocznosc');
  const options = useMemo(() => [{ value: 'widocznosc', label: 'Widoczność i komentarze' }, ...REBUILDS.map((r) => ({ value: r.id, label: r.title }))], []);
  const rebuild = REBUILDS.find((r) => r.id === tab);
  const books = useMemo(() => libraries.filter((l) => libraryKindOf(l) === 'books'), [libraries]);

  return (
    <>
      <p><a className="wk-link" href={viewPath('library')}>← Biblioteki</a></p>
      <h1 className="wk-h1">Porządki</h1>
      <p className="wk-lede">
        Przebudowa danych biblioteki i Cogity. Każda zmiana najpierw pokazuje, co się zmieni; nic nie dzieje się samo
        i niczego się nie usuwa, zanim nie stoi na nowym miejscu.
      </p>
      <Segment now={tab} options={options} busy={false} onPick={setTab} />
      {rebuild === undefined
        ? <LibraryTidy me={me} libraries={books} areas={areas} onChanged={onChanged} embedded />
        : <RebuildPanel key={rebuild.id} rebuild={rebuild} me={me} libraries={libraries} areas={areas} onChanged={onChanged} />}
    </>
  );
}

function RebuildPanel({ rebuild, me, libraries, areas, onChanged }: {
  rebuild: Rebuild; me: Me; libraries: readonly OpenLibrary[]; areas: readonly AreaRow[]; onChanged: () => void;
}) {
  const stores = useMemo(() => new Map(libraries.map((l) => [l.libraryId, storeOf(me.ring, l)])), [libraries, me.ring]);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [plan, setPlan] = useState<RebuildPlan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<readonly string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const offs = [...stores.values()].map((s) => s.subscribe(() => setRevision((n) => n + 1)));
    void Promise.all([...stores.values()].map((s) => s.sync())).then(
      () => { if (alive) setLoaded(true); },
      () => { if (alive) setFailed('Nie udało się wczytać wszystkich bibliotek i baz wiedzy.'); });
    return () => { alive = false; offs.forEach((off) => off()); };
  }, [stores]);

  const ctx: RebuildCtx = useMemo(() => ({ me, areas, libraries, stores, progress: (line: string) => setBusy(line) }), [me, areas, libraries, stores]);

  useEffect(() => {
    if (!loaded || busy !== null) return undefined;
    let alive = true;
    void Promise.resolve(rebuild.plan(ctx)).then((p) => { if (alive) setPlan(p); }, (e: unknown) => { if (alive) setFailed(e instanceof Error ? e.message : 'Nie udało się policzyć planu.'); });
    return () => { alive = false; };
  }, [loaded, ctx, rebuild, revision, busy]);

  const doable = plan?.changes.filter((c) => c.ok) ?? [];
  const blocked = plan?.changes.filter((c) => !c.ok) ?? [];

  const run = async () => {
    if (plan === null) return;
    setBusy('Start…');
    setFailed(null);
    try {
      const lines = await rebuild.run(plan, ctx);
      setReport((was) => [...was, ...lines]);
      onChanged();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="wk-form">
      <h2 className="wk-h2">{rebuild.title}</h2>
      <p>{rebuild.says}</p>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {plan === null ? <p className="wk-lede">{loaded ? 'Liczenie planu…' : 'Wczytywanie bibliotek i baz wiedzy…'}</p> : (
        <>
          {plan.notes.map((note, i) => <p key={i} className="wk-note">{note}</p>)}
          {plan.changes.length === 0 && <p className="wk-note">Wszystko jest już po nowemu.</p>}
          {plan.changes.length > 0 && (
            <>
              <h3 className="lib-box-h">Co się zmieni ({doable.length})</h3>
              <PlanTable rows={doable} />
              {blocked.length > 0 && (
                <>
                  <h3 className="lib-box-h">Czego nie zmienię ({blocked.length})</h3>
                  <PlanTable rows={blocked} />
                </>
              )}
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy !== null || doable.length === 0} onClick={() => void run()}>
                  {busy ?? (doable.length === 0 ? 'Nic do zrobienia' : `Wykonaj (${doable.length})`)}
                </button>
              </div>
            </>
          )}
        </>
      )}
      {report.length > 0 && (
        <>
          <h3 className="lib-box-h">Raport</h3>
          <ul className="lib-list">{report.map((line, i) => <li key={i}>{line}</li>)}</ul>
        </>
      )}
    </section>
  );
}

function PlanTable({ rows }: { rows: RebuildPlan['changes'] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 200);
  return (
    <div className="lib-table-wrap">
      <table className="lib-table">
        <thead><tr><th scope="col">Gdzie</th><th scope="col">Co</th></tr></thead>
        <tbody>{shown.map((c) => <tr key={c.key}><td>{c.where}</td><td>{c.what}</td></tr>)}</tbody>
      </table>
      {rows.length > shown.length && <button type="button" className="wk-link-btn" onClick={() => setAll(true)}>Pokaż wszystkie ({rows.length})</button>}
    </div>
  );
}
