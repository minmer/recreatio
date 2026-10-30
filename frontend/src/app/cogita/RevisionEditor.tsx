/**
 * COGITA — WIEDERHOLUNGEN (COGITA.md §6, [F15]): ein Graph wählt die Karten
 * (Quellen — auch ein Widok — → Schritte, auch „Filtr znajomości" → ein Weg mit Kolejność und Wybór). Hier: anlegen aus einem Anfang,
 * bearbeiten, ausprobieren, für die Zeit ohne Netz behalten, als Aufgabe in
 * den Kalender stellen, und auf eine eigene Seite (`c/<kennung>`, [I13, F20]) —
 * 2026-10-22 (Schritt 8) ohne Kopie der Karten: wer sie dort sieht, sagt die Baza.
 */

import { useEffect, useState } from 'react';

import { publishModule, pageUrl } from './publish';
import { WhoSees } from './BaseWho';
import { graphJson, readGraph, type Graph } from './graph';
import { GraphEditor } from './GraphEditor';
import { refFieldKeys } from './ViewSteps';
import { migrateRevision, MODE_LABEL, ORDER_LABEL, PICK_LABEL, REVISION_PALETTE } from './revision';
import { REVISION_PRESETS } from './presets';
import { planFor } from './RevisionRun';
import { saveTask } from '../calendar/tasks';
import { ForeignOnly, kindLabel, useAsync, useBusy, useCtx } from './ui';
import { askText } from '../ui/dialogs';

export function RevisionEditor({ chosenId, onChoose, onRun }: { chosenId: string | null; onChoose: (id: string | null) => void; onRun: (id: string) => void }) {
  const { lib, writes } = useCtx();
  const entry = chosenId === null ? undefined : lib.docs('revision').find((e) => e.id === chosenId);
  return (
    <div className="cg">
      <div className="cg-row-between">
        <select value={chosenId ?? ''} onChange={(e) => onChoose(e.target.value === '' ? null : e.target.value)} aria-label="Powtórka">
          <option value="">— powtórki ({lib.docs('revision').length}) —</option>
          {lib.docs('revision').map((e) => <option key={e.id} value={e.id}>{typeof e.data.name === 'string' ? e.data.name : 'Powtórka'}{lib.isOwn(e.id) ? '' : ` · z: ${lib.origin(e.id)?.name ?? '?'}`}</option>)}
        </select>
        {writes && <NewRevision onMade={onChoose} />}
      </div>
      {entry === undefined
        ? <p className="wk-hint">Powtórka wybiera karty (wszystkie, z rodzaju, zbioru, listy albo z widoku), może je zawęzić — także według tego, co już umiesz (np. szczegóły dopiero, gdy ogólne jest znane) — i pyta wybranym sposobem, w wybranej kolejności.</p>
        : <ForeignOnly id={entry.id} tab="powtorki"><RevisionForm key={entry.id} id={entry.id} onRun={() => onRun(entry.id)} /></ForeignOnly>}
    </div>
  );
}

function NewRevision({ onMade }: { onMade: (id: string) => void }) {
  const { lib } = useCtx();
  const [preset, setPreset] = useState('temporal');
  const [from, setFrom] = useState<'all' | 'kind' | 'collection' | 'view'>('all');
  /* 2026-10-30 — ein gespeicherter Widok entscheidet, was in Frage kommt; die Powtórka wählt daraus. */
  const [viewId, setViewId] = useState(lib.docs('view')[0]?.id ?? '');
  const [kind, setKind] = useState(lib.materialKinds[0]?.id ?? '');
  /* 2026-10-22 — „Rodzaj … z …": eine Art der Bibliotheken (Cytaty) aus einer bestimmten Bibliothek. */
  const [library, setLibrary] = useState('');
  /* 2026-10-23 — Bibliotheken und Skryptoria (ihre Texte, ihre Rodzaje tekstów). */
  const books = lib.sourceList().filter((s) => s.kind === 'books' || s.kind === 'writing');
  const [collection, setCollection] = useState(lib.collections()[0]?.id ?? '');
  const { busy, failed, run } = useBusy();
  const p = REVISION_PRESETS.find((x) => x.id === preset)!;
  return (
    <details className="cg-card">
      <summary>+ Nowa powtórka</summary>
      <div className="cg">
        <label className="wk-field"><span>Sposób</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value)}>{REVISION_PRESETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
        </label>
        <p className="wk-hint">{p.says}</p>
        <label className="wk-field"><span>Z czego</span>
          <select value={from} onChange={(e) => setFrom(e.target.value as typeof from)}>
            <option value="all">wszystkie karty</option><option value="kind">rodzaj</option><option value="collection">zbiór</option>
            {lib.docs('view').length > 0 && <option value="view">widok (sposób wyświetlania)</option>}
          </select>
        </label>
        {from === 'view' && (
          <select value={viewId} aria-label="Widok" onChange={(e) => setViewId(e.target.value)}>
            {lib.docs('view').map((v) => <option key={v.id} value={v.id}>{typeof v.data.name === 'string' ? v.data.name : 'Widok'}</option>)}
          </select>
        )}
        {from === 'kind' && <select value={kind} aria-label="Rodzaj" onChange={(e) => { setKind(e.target.value); setLibrary(''); }}>{lib.materialKinds.map((k) => <option key={k.id} value={k.id}>{kindLabel(k)}</option>)}</select>}
        {from === 'kind' && lib.isForeignKind(kind) && books.length > 1 && (
          <select value={library} aria-label="Z której biblioteki" onChange={(e) => setLibrary(e.target.value)}>
            <option value="">ze wszystkich źródeł</option>
            {books.map((s) => <option key={s.store.libraryId} value={s.store.libraryId}>{s.name}</option>)}
          </select>
        )}
        {from === 'kind' && lib.isForeignKind(kind) && lib.templates().every((t) => !t.kinds.includes(kind)) && (
          <p className="wk-warn">Z tego rodzaju nie powstają jeszcze karty — dodaj w „Karty” szablon dla niego (np. „Luki w cytacie”).</p>
        )}
        {from === 'collection' && <select value={collection} onChange={(e) => setCollection(e.target.value)}>{lib.collections().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => {
          const doc = p.make(from === 'kind' ? { kind, library } : from === 'collection' && collection !== '' ? { collection } : from === 'view' && viewId !== '' ? { view: viewId } : undefined);
          const made = await lib.saveDoc('revision', doc);
          onMade(made.id);
        })}>Utwórz</button>
        {failed !== null && <p className="wk-error">{failed}</p>}
      </div>
    </details>
  );
}

function RevisionForm({ id, onRun }: { id: string; onRun: () => void }) {
  const { lib, writes, me } = useCtx();
  const entry = lib.docs('revision').find((e) => e.id === id)!;
  const [name, setName] = useState(typeof entry.data.name === 'string' ? entry.data.name : 'Powtórka');
  const [summary, setSummary] = useState(typeof entry.data.summary === 'string' ? entry.data.summary : '');
  const [storage, setStorage] = useState(typeof entry.data.storageAreaId === 'string' ? entry.data.storageAreaId : '');
  /* 2026-10-30 — ein alter Knoten „Najpierw podstawy" erscheint als die allgemeinen Schritte, die dasselbe tun; gespeichert wird die neue Gestalt. */
  const stored = readGraph(entry.data.graph);
  const migrated = stored.nodes.some((n) => n.type === 'gate');
  const [graph, setGraph] = useState<Graph>(() => migrateRevision(stored));
  const [dirty, setDirty] = useState(false);
  const { busy, failed, run } = useBusy();
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    if (dirty) return;
    setGraph(migrateRevision(readGraph(entry.data.graph)));
    setName(typeof entry.data.name === 'string' ? entry.data.name : 'Powtórka');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.version]);

  const plan = useAsync(() => planFor(lib, id, null, 'podglad'), [id, lib.revision]);
  const settings = lib.settings();
  const offline = settings.offline.includes(id);

  const save = () => run(async () => {
    await lib.saveDoc('revision', { ...entry.data, name: name.trim() || 'Powtórka', summary: summary.trim() || undefined, storageAreaId: storage || undefined, graph: graphJson(graph) }, id);
    setDirty(false);
  });

  return (
    <div className="cg">
      <div className="cg-row">
        <label className="wk-field"><span>Nazwa</span><input value={name} disabled={!writes} onChange={(e) => { setName(e.target.value); setDirty(true); }} /></label>
        <label className="wk-field"><span>Krótki opis</span><input value={summary} disabled={!writes} onChange={(e) => { setSummary(e.target.value); setDirty(true); }} /></label>
        <button type="button" className="wk-btn" onClick={onRun}>Powtarzaj</button>
      </div>
      {migrated && writes && !dirty && (
        <p className="wk-note" data-revision-migrated="">Ta powtórka miała krok „Najpierw podstawy” — teraz to zwykłe kroki: „Idź po kolejności nauki”, „Filtr znajomości” i kolejność „najpierw ogólne”. Działa tak samo; zapisz, żeby została w nowej postaci.</p>
      )}
      <GraphEditor graph={graph} palette={REVISION_PALETTE} fieldKeys={refFieldKeys(lib)} readOnly={!writes} onChange={(g) => { setGraph(g); setDirty(true); }} />
      <p className="cg-muted">
        {plan === undefined ? 'Liczenie kart…' : plan === null ? 'Podgląd się nie udał.'
          : plan.plan === null ? plan.problems.join(' ')
          : [`${plan.plan.cards.length} kart`, MODE_LABEL[plan.plan.mode], ORDER_LABEL[plan.plan.order],
            ...(plan.plan.mode === 'levels' || plan.plan.mode === 'temporal' ? [PICK_LABEL[plan.plan.pick]] : []),
            ...(plan.plan.when === undefined ? [] : [`${Object.keys(plan.plan.when).length} z warunkiem znajomości`])].join(' · ')}
      </p>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {said !== null && <p className="wk-hint">{said}</p>}
      {writes && (
        <>
          <details>
            <summary>Gdzie zapisują się odpowiedzi (dla tej powtórki)</summary>
            <p className="wk-hint">Domyślnie tam, gdzie mówi baza wiedzy (Ustawienia), a bez tego — w prywatnym obszarze uczącego się. Nauczyciel, który czyta wybrany obszar, widzi postępy.</p>
            <input value={storage} placeholder="identyfikator obszaru (puste — jak w bazie wiedzy)" onChange={(e) => { setStorage(e.target.value.trim()); setDirty(true); }} />
          </details>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy || !(dirty || migrated)} onClick={() => void save()}>{busy ? 'Zapisywanie…' : 'Zapisz powtórkę'}</button>
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => lib.saveSettings({ offline: offline ? settings.offline.filter((x) => x !== id) : [...settings.offline, id] }))}>
              {offline ? 'Nie trzymaj bez internetu' : 'Trzymaj na urządzeniach bez internetu'}
            </button>
            <button type="button" className="wk-link-btn" disabled={busy} onClick={async () => { if (await askText('Usunąć powtórkę? Odpowiedzi zostają.')) void run(() => lib.remove(id)); }}>Usuń</button>
          </div>
          <WhoSees id={id} />
          <Share id={id} name={name} onSaid={setSaid} />
        </>
      )}
      {me !== null && <CalendarTask id={id} name={name} onSaid={setSaid} />}
    </div>
  );
}

/**
 * Wspólna powtórka [I13, F20] — 2026-10-22 (Schritt 8) ohne Kopie der Karten:
 * unter einer neuen Adresse steht der Baustein „Powtórka", der die Baza selbst
 * liest. Wer ihn sieht, sagt die Baza („Kto widzi"); ohne Konto bleiben die
 * Fortschritte im Browser.
 */
function Share({ id, name, onSaid }: { id: string; name: string; onSaid: (s: string) => void }) {
  const { lib, me } = useCtx();
  const { busy, failed, run } = useBusy();
  const roles = me?.roles.filter((r) => r.kind !== 'account') ?? [];
  const [role, setRole] = useState(me?.person.id ?? '');
  if (me === null) return null;
  return (
    <section className="cg-card">
      <h3>Strona z tą powtórką</h3>
      <p className="cg-muted">Powtarzają na niej ci, którzy mogą czytać tę bazę wiedzy (zob. „Kto widzi” wyżej) — bez konta postępy zostają w ich przeglądarce.</p>
      <div className="cg-row">
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Czyja strona">{roles.map((r) => <option key={r.id} value={r.id}>{me.names.get(r.id) ?? 'rola'}</option>)}</select>
        <button type="button" className="wk-btn" disabled={busy || role === ''} onClick={() => void run(async () => {
          const path = await publishModule({ roleId: role, title: name, parts: [{ kind: 'cogita-revision', config: { library: lib.libraryId, revision: id } }] });
          await navigator.clipboard?.writeText(pageUrl(path)).catch(() => undefined);
          onSaid(`Strona gotowa: ${pageUrl(path)} (skopiowano).`);
        })}>Utwórz stronę z tą powtórką</button>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/** Powtórka w kalendarzu [P02]: zadanie co dzień, z linkiem do powtórki. */
function CalendarTask({ id, name, onSaid }: { id: string; name: string; onSaid: (s: string) => void }) {
  const { lib, me, href } = useCtx();
  const { busy, failed, run } = useBusy();
  const [time, setTime] = useState('18:00');
  if (me === null) return null;
  return (
    <section className="cg-card">
      <h3>Codzienna powtórka w zadaniach</h3>
      <div className="cg-row">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="O której" />
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(async () => {
          const { personalArea } = await import('./holders');
          const area = (await personalArea()) ?? lib.areaId;
          const link = `${window.location.origin}${window.location.pathname}${href('nauka', id)}`;
          const today = new Date();
          const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          await saveTask(me.ring, {
            title: `Powtórka: ${name}`, notes: link, areaId: area, ownerRoleId: me.person.id, kind: 'window', date, time,
            windowMinutes: 120, everyMinutes: null, repeat: 'daily', every: 1, weekdays: 0, until: null, remind: 1
          });
          onSaid('Dodano codzienne zadanie z linkiem do powtórki.');
        })}>Dodaj do moich zadań</button>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
