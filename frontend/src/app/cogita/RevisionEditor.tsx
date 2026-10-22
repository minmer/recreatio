/**
 * COGITA — WIEDERHOLUNGEN (COGITA.md §6, [F15]): ein Graph wählt die Karten
 * (Quellen → Filter → Sperre → ein Weg). Hier: anlegen aus einem Anfang,
 * bearbeiten, ausprobieren, für die Zeit ohne Netz behalten, als Aufgabe in
 * den Kalender stellen, und direkt veröffentlichen (`c/<kennung>`, [I13, F20]).
 */

import { useEffect, useState } from 'react';

import { publishModule, pageUrl, publishBundle, publishMedia, revisionBundle, unpublishBundle } from './publish';
import { REVISION_BUNDLE } from './published';
import { graphJson, readGraph, type Graph } from './graph';
import { GraphEditor } from './GraphEditor';
import { REVISION_PALETTE, MODE_LABEL } from './revision';
import { REVISION_PRESETS } from './presets';
import { planFor } from './RevisionRun';
import { saveTask } from '../calendar/tasks';
import { BOOK_KINDS } from './store';
import { EntityPicker, ForeignOnly, kindLabel, useAsync, useBusy, useCtx } from './ui';
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
        ? <p className="wk-hint">Powtórka wybiera karty (wszystkie, z rodzaju, zbioru, tematu albo listy), może je zawęzić i zablokować te, do których brakuje podstaw — i pyta wybranym sposobem.</p>
        : <ForeignOnly id={entry.id} tab="powtorki"><RevisionForm key={entry.id} id={entry.id} onRun={() => onRun(entry.id)} /></ForeignOnly>}
    </div>
  );
}

function NewRevision({ onMade }: { onMade: (id: string) => void }) {
  const { lib } = useCtx();
  const [preset, setPreset] = useState('temporal');
  const [from, setFrom] = useState<'all' | 'kind' | 'topic' | 'collection'>('all');
  const [kind, setKind] = useState(lib.materialKinds[0]?.id ?? '');
  /* 2026-10-22 — „Rodzaj … z …": eine Art der Bibliotheken (Cytaty) aus einer bestimmten Bibliothek. */
  const [library, setLibrary] = useState('');
  const books = lib.sourceList().filter((s) => s.kind === 'books');
  const [topic, setTopic] = useState<string | null>(null);
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
            <option value="all">wszystkie karty</option><option value="kind">rodzaj</option><option value="topic">temat z podtematami</option><option value="collection">zbiór</option>
          </select>
        </label>
        {from === 'kind' && <select value={kind} aria-label="Rodzaj" onChange={(e) => { setKind(e.target.value); setLibrary(''); }}>{lib.materialKinds.map((k) => <option key={k.id} value={k.id}>{kindLabel(k)}</option>)}</select>}
        {from === 'kind' && BOOK_KINDS.has(kind) && books.length > 1 && (
          <select value={library} aria-label="Z której biblioteki" onChange={(e) => setLibrary(e.target.value)}>
            <option value="">ze wszystkich bibliotek</option>
            {books.map((s) => <option key={s.store.libraryId} value={s.store.libraryId}>{s.name}</option>)}
          </select>
        )}
        {from === 'kind' && BOOK_KINDS.has(kind) && lib.templates().every((t) => !t.kinds.includes(kind)) && (
          <p className="wk-warn">Z tego rodzaju nie powstają jeszcze karty — dodaj w „Karty” szablon dla niego (np. „Luki w cytacie”).</p>
        )}
        {from === 'topic' && <EntityPicker lib={lib} kinds={['topic']} refs value={topic} onPick={setTopic} />}
        {from === 'collection' && <select value={collection} onChange={(e) => setCollection(e.target.value)}>{lib.collections().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => {
          const doc = p.make(from === 'kind' ? { kind, library } : from === 'topic' && topic !== null ? { topic } : from === 'collection' && collection !== '' ? { collection } : undefined);
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
  const [graph, setGraph] = useState<Graph>(() => readGraph(entry.data.graph));
  const [dirty, setDirty] = useState(false);
  const { busy, failed, run } = useBusy();
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    if (dirty) return;
    setGraph(readGraph(entry.data.graph));
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
      <GraphEditor graph={graph} palette={REVISION_PALETTE} readOnly={!writes} onChange={(g) => { setGraph(g); setDirty(true); }} />
      <p className="cg-muted">
        {plan === undefined ? 'Liczenie kart…' : plan === null ? 'Podgląd się nie udał.'
          : plan.plan === null ? plan.problems.join(' ') : `${plan.plan.cards.length} kart · ${MODE_LABEL[plan.plan.mode]}${plan.plan.gate !== null ? ' · najpierw podstawy' : ''}`}
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
            <button type="button" className="wk-btn" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Zapisywanie…' : 'Zapisz powtórkę'}</button>
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => lib.saveSettings({ offline: offline ? settings.offline.filter((x) => x !== id) : [...settings.offline, id] }))}>
              {offline ? 'Nie trzymaj bez internetu' : 'Trzymaj na urządzeniach bez internetu'}
            </button>
            <button type="button" className="wk-link-btn" disabled={busy} onClick={async () => { if (await askText('Usunąć powtórkę? Odpowiedzi zostają.')) void run(() => lib.remove(id)); }}>Usuń</button>
          </div>
          <Share id={id} name={name} onSaid={setSaid} />
        </>
      )}
      {me !== null && <CalendarTask id={id} name={name} onSaid={setSaid} />}
    </div>
  );
}

/** Wspólna powtórka [I13, F20]: kopia kart wychodzi na zewnątrz (bez postępów), a pod nowym adresem stoi moduł „Powtórka". */
function Share({ id, name, onSaid }: { id: string; name: string; onSaid: (s: string) => void }) {
  const { lib, me, keyIn } = useCtx();
  const entry = lib.entry(id);
  const { busy, failed, run } = useBusy();
  const published = entry?.publishedAs != null;
  const roles = me?.roles.filter((r) => r.kind !== 'account') ?? [];
  const [role, setRole] = useState(me?.person.id ?? '');
  return (
    <section className="cg-card">
      <h3>Udostępnij jako otwartą powtórkę</h3>
      <p className="wk-hint">Każdy z linkiem powtarza bez konta (postępy zostają w jego przeglądarce). Wychodzi kopia kart — bez odpowiedzi uczących się i bez reszty bazy wiedzy.</p>
      <div className="cg-row">
        <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => {
          const bundle = await revisionBundle(lib, id);
          if ('error' in bundle) throw new Error(bundle.error);
          /* Die Bilder und Töne der Karten gehen offen daneben — sonst sähe die Seite nur ihre Namen. */
          const files = await publishMedia(lib, bundle.files ?? [], keyIn);
          await publishBundle(lib, id, { ...bundle, format: REVISION_BUNDLE });
          onSaid(`Opublikowano ${bundle.cards.length} kart${files > 0 ? ` i ${files} plików` : ''}.`);
        })}>{published ? 'Zaktualizuj kopię kart' : 'Opublikuj kopię kart'}</button>
        {published && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => unpublishBundle(lib, id))}>Wycofaj</button>}
      </div>
      {published && me !== null && (
        <div className="cg-row">
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Czyja strona">{roles.map((r) => <option key={r.id} value={r.id}>{me.names.get(r.id) ?? 'rola'}</option>)}</select>
          <button type="button" className="wk-btn" disabled={busy || role === ''} onClick={() => void run(async () => {
            const path = await publishModule({ roleId: role, title: name, parts: [{ kind: 'cogita-revision', config: { library: lib.libraryId, revision: id } }] });
            await navigator.clipboard?.writeText(pageUrl(path)).catch(() => undefined);
            onSaid(`Strona gotowa: ${pageUrl(path)} (skopiowano).`);
          })}>Utwórz stronę z tą powtórką</button>
        </div>
      )}
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
