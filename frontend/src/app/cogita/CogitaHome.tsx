/**
 * EINE BAZA WIEDZY (COGITA.md §13, §14). 0110 — neben der Bibliothek, nicht in ihr; ihre
 * Quellen (Bibliotheken zum Verweisen, andere Bazy wiedzy zum Wiederverwenden) lädt `useSources`.
 *
 * 2026-10-24 — ZWEI TEILE, EINE BAZA (`parts.ts`):
 * <code>
 *   WIEDZA  #/workspace/knowledge/&lt;baza&gt;/…
 *     wpisy         die Einträge — suchen, ein Rodzaj, ein Sposób wyświetlania; „Dostosuj" (was und wie);
 *                   ein Eintrag: öffnen, den Verweisen folgen, ändern — und „Ucz się tego" (Nauka)
 *     dodaj         ein einzelner Eintrag oder ein Sposób dodawania (mehrere verbundene auf einmal)
 *     schematy      Rodzaje wpisów · Sposoby dodawania · Sposoby wyświetlania (`KnowledgeParts.tsx`)
 *     Więcej:       ustawienia, json, do-zrobienia, propozycje, stare (solange es alte gibt)
 *     wer liest:    wpisy, zaproponuj
 *   NAUKA   #/workspace/learn/&lt;baza&gt;/…
 *     nauka         was jetzt dran ist: die Powtórki, die Przebiegi
 *     powtorki · przebiegi · sesje · postepy; Więcej: karty (Szablony kart), mapa, ustawienia
 *     wer liest:    nauka, przebiegi, sesje, postepy, mapa
 * </code>
 * Jeder Teil hat oben rechts den Weg in den anderen. Die Daten sind dieselben: gelernt wird aus
 * dem Wissen, ohne Kopie; eine Karte führt zurück zu ihrem Eintrag.
 */

import { useCallback, useMemo } from 'react';

import { areaKeys } from '../chat/chat';
import type { OpenLibrary } from '../library/library';
import type { LibraryStore } from '../library/libraryStore';
import type { Me } from '../core/me';
import { viewPath } from '../routes';
import type { Who } from '../core/session';
import { AddFormRun } from './AddFormRun';
import { AnchorsTab, EntityAnchors } from './AnchorList';
import { EntityStructure } from './StructureView';
import { CogitaJson } from './CogitaJson';
import { CogitaSettings } from './CogitaSettings';
import { Contributions, Propose } from './Contribute';
import { EntityEditor } from './EntityEditor';
import { EntityList } from './EntityList';
import { ExploreMap } from './ExploreMap';
import { FlowEditor } from './FlowEditor';
import { contentOfLibrary, FlowPlayer } from './FlowPlayer';
import { readFlow, resolveFlow } from './flow';
import { holderOfMe, useLearner } from './holders';
import { dueAt } from './knowness';
import { AddHub, LearnFrom, SchemaHub } from './KnowledgeParts';
import type { Learner } from './learn';
import { renamer } from './learn';
import { cogitaPath, KNOWLEDGE_MORE, KNOWLEDGE_READER_TABS, KNOWLEDGE_TABS, LEARN_MORE, LEARN_READER_TABS, LEARN_TABS, type CogitaPart } from './parts';
import { OfficeProgress, OwnProgress } from './Progress';
import { Pending } from './Pending';
import { REVISION_PRESETS } from './presets';
import { RevisionEditor } from './RevisionEditor';
import { RevisionRun } from './RevisionRun';
import { accountSources, useSources } from './sources';
import { SessionsTab } from './Sessions';
import { TemplateEditor } from './TemplateEditor';
import { CogitaContext, ForeignOnly, useAsync, useBusy, useCogita, useCtx, type CogitaCtx } from './ui';
import type { Card } from './cardBasics';
import { MenuButton } from '../ui/Menu';
import { Icon } from '../ui/icons';
import { OldEntries, oldEntriesOf } from '../library/OldEntries';
import { isOldInBase, oldInBaseLabel } from './oldInBase';

export function CogitaHome({ me, who, library, store, trail, part = 'knowledge' }: { me: Me; who: Who; library: OpenLibrary; store: LibraryStore; trail: readonly string[]; part?: CogitaPart }) {
  const lib = useCogita(store, library.writes);
  /* 0110 — die Quellen mit dem Zugang dieses Kontos: was es nicht liest, fehlt. */
  const open = useMemo(() => accountSources(me), [me]);
  const sources = useSources(lib, open);
  const keyIn = useCallback((areaId: string, epoch: number) =>
    areaKeys(me.ring, areaId).then((m) => m.get(epoch) ?? areaKeys(me.ring, areaId, true).then((f) => f.get(epoch))), [me]);
  const ctx = useMemo<CogitaCtx | null>(() => lib === null ? null : ({
    lib, name: library.name, writes: library.writes, me, who, sources, keyIn,
    keyOf: (epoch) => keyIn(library.areaId, epoch),
    /* 2026-10-24 — jeder Weg in den richtigen Teil, auch ein alter („schemat", „wpisy/dodaj/…"). */
    href: (...tail) => cogitaPath(library.libraryId, ...tail)
  }), [lib, library, me, who, sources, keyIn]);
  if (ctx === null) return null;
  return (
    <CogitaContext.Provider value={ctx}>
      <Hub trail={trail} part={part} />
    </CogitaContext.Provider>
  );
}

function Hub({ trail, part }: { trail: readonly string[]; part: CogitaPart }) {
  const { lib, writes, me, href } = useCtx();
  const holder = useMemo(() => (me === null ? null : holderOfMe(me)), [me]);
  const { learner } = useLearner(lib, holder);
  const known = useCallback((_kind: string, entry: Parameters<typeof isOldInBase>[0]) => !isOldInBase(entry, (id) => lib.kind(id)), [lib]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const old = useMemo(() => (writes && part === 'knowledge' ? oldEntriesOf(lib.store, known).length : 0), [writes, part, lib.store, lib.revision, known]);
  const tabs: readonly (readonly [string, string])[] = part === 'knowledge' ? (writes ? KNOWLEDGE_TABS : KNOWLEDGE_READER_TABS) : (writes ? LEARN_TABS : LEARN_READER_TABS);
  const more: readonly (readonly [string, string])[] = !writes ? [] : part === 'knowledge'
    ? (old > 0 || trail[0] === 'stare' ? [...KNOWLEDGE_MORE, ['stare', `Stare wpisy (${old})`]] : KNOWLEDGE_MORE)
    : LEARN_MORE;
  const all = [...tabs, ...more];
  const tab = all.some(([slug]) => slug === trail[0]) ? trail[0]! : tabs[0]![0];
  /* „Ustawienia" gibt es in beiden Teilen — man bleibt, wo man ist. */
  const go = (...tail: string[]) => { window.location.hash = tail[0] === 'ustawienia' ? viewPath(part, lib.libraryId, ...tail) : href(...tail); };
  /* Karten nur, wo gelernt wird: die Wiedza rechnet keine. */
  const cards = useAsync(() => (part === 'learn' ? lib.cards('learn').then((r) => r.cards) : Promise.resolve(null)), [lib.revision, part]);
  const other = part === 'knowledge'
    ? { href: viewPath('learn', lib.libraryId), label: 'Ucz się z tej bazy', icon: 'cap' as const }
    : { href: viewPath('knowledge', lib.libraryId), label: 'Wiedza tej bazy', icon: 'branch' as const };

  return (
    <div className="cg" data-cogita-part={part}>
      <nav className="cg-subtabs cg-parttabs" aria-label={part === 'knowledge' ? 'Wiedza' : 'Nauka'}>
        {tabs.map(([slug, label]) => <a key={slug} className={slug === tab ? 'is-on' : ''} aria-current={slug === tab ? 'page' : undefined} href={href(slug)}>{label}</a>)}
        {more.length > 0 && (
          <MenuButton
            label={part === 'knowledge' ? 'Więcej: wiedza' : 'Więcej: nauka'}
            className={more.some(([slug]) => slug === tab) ? 'cg-subtabs-more is-on' : 'cg-subtabs-more'}
            trigger={<>{more.find(([slug]) => slug === tab)?.[1] ?? 'Więcej'}<Icon name="chevron" /></>}
            items={more.map(([slug, label]) => ({ label, checked: slug === tab, onSelect: () => go(slug) }))}
          />
        )}
        <a className="cg-other-part" href={other.href}><Icon name={other.icon} />{other.label}</a>
      </nav>
      {/* -- Wiedza -- */}
      {tab === 'wpisy' && <EntitiesTab trail={trail.slice(1)} go={go} />}
      {tab === 'dodaj' && <AddTab trail={trail.slice(1)} go={go} />}
      {tab === 'schematy' && <SchemaHub trail={trail.slice(1)} go={go} />}
      {tab === 'do-zrobienia' && <Pending onOpen={(id) => go('wpisy', id)} />}
      {tab === 'propozycje' && <Contributions />}
      {tab === 'wejscia' && <AnchorsTab key={trail[1] ?? ''} chosen={trail[1]} />}
      {tab === 'zaproponuj' && <Propose />}
      {tab === 'json' && <CogitaJson />}
      {tab === 'stare' && <OldEntries store={lib.store} known={known} writes={writes} labelOf={oldInBaseLabel}
        where="Rodzajów „Wiedza”, „Komentarz” i „Temat” już nie ma: wypowiedź to wpis własnego rodzaju z polem „Treść w blokach” (gotowy schemat: templates/cogita/komentarz.json), a porządek dają własne rodzaje (np. „Tajemnica”, „Obszar”)." />}
      {/* -- Nauka -- */}
      {tab === 'nauka' && <LearnTab trail={trail.slice(1)} learner={learner} cards={cards ?? null} go={go} />}
      {tab === 'karty' && <TemplateEditor chosenId={trail[1] ?? null} onChoose={(id) => go('karty', ...(id === null ? [] : [id]))} />}
      {tab === 'powtorki' && <RevisionEditor chosenId={trail[1] ?? null} onChoose={(id) => go('powtorki', ...(id === null ? [] : [id]))} onRun={(id) => go('nauka', id)} />}
      {tab === 'przebiegi' && <FlowsTab trail={trail.slice(1)} learner={learner} cards={cards ?? null} go={go} />}
      {tab === 'sesje' && <SessionsTab trail={trail.slice(1)} go={(...t) => go('sesje', ...t)} />}
      {tab === 'postepy' && (
        <div className="cg">
          <OwnProgress learner={learner} cards={cards ?? null} />
          {writes && <details className="cg-card"><summary>Postępy uczących się (dla nauczyciela)</summary><OfficeProgress cards={cards ?? null} /></details>}
        </div>
      )}
      {tab === 'mapa' && (cards === undefined ? <p className="wk-hint">Liczenie kart…</p> : <ExploreMap learner={learner} cards={cards ?? []} />)}
      {/* -- in beiden -- */}
      {tab === 'ustawienia' && <CogitaSettings />}
    </div>
  );
}

/* -- Nauka ------------------------------------------------------------------------------------ */

function LearnTab({ trail, learner, cards, go }: { trail: readonly string[]; learner: Learner | null; cards: readonly Card[] | null; go: (...tail: string[]) => void }) {
  const { lib, writes, who } = useCtx();
  const { busy, run } = useBusy();
  const revisions = lib.docs('revision');
  const chosen = trail[0];
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const source = useMemo(() => {
    const entry = revisions.find((e) => e.id === chosen);
    return entry === undefined ? null : { revisionId: entry.id, title: String(entry.data.name ?? 'Powtórka') };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, revisions.length]);
  if (source !== null) {
    return <RevisionRun lib={lib} learner={learner} source={source} keep={who?.keyKeeping === 'kept' && lib.settings().offline.includes(source.revisionId!)} onClose={() => go('nauka')} />;
  }
  const now = Date.now();
  const due = cards === null || learner === null ? null : cards.filter((c) => { const m = learner.marks(c.key, c.fingerprint, rename); const d = dueAt(m); return d !== null && d <= now; }).length;
  const fresh = cards === null || learner === null ? null : cards.filter((c) => learner.marks(c.key, c.fingerprint, rename).length === 0).length;
  return (
    <div className="cg">
      <div className="cg-card">
        <strong>{cards === null ? 'Liczenie kart…' : `${cards.length} kart w kursie`}</strong>
        {due !== null && <span className="cg-muted">Na teraz: {due} · nowe: {fresh}</span>}
      </div>
      {revisions.length === 0 ? (
        <div className="cg-card">
          <p className="wk-hint">Nie ma jeszcze powtórek.</p>
          {writes && <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(async () => { const made = await lib.saveDoc('revision', REVISION_PRESETS[0].make()); go('nauka', made.id); })}>Utwórz „Powtórkę codzienną" ze wszystkich kart</button>}
        </div>
      ) : (
        <div className="cg-grid">
          {revisions.map((e) => (
            <div key={e.id} className="cg-card">
              <strong>{String(e.data.name ?? 'Powtórka')}</strong>
              {typeof e.data.summary === 'string' && <span className="cg-muted">{e.data.summary}</span>}
              <button type="button" className="wk-btn" onClick={() => go('nauka', e.id)}>Powtarzaj</button>
            </div>
          ))}
        </div>
      )}
      {lib.docs('flow').length > 0 && (
        <div className="cg-grid">
          {lib.docs('flow').map((e) => (
            <div key={e.id} className="cg-card">
              <strong>{String(e.data.name ?? 'Przebieg')}</strong>
              <span className="cg-muted">{learner?.progress.positions.has(e.id) ? 'w trakcie' : 'przebieg'}</span>
              <button type="button" className="wk-link-btn" onClick={() => go('przebiegi', e.id, 'graj')}>{learner?.progress.positions.has(e.id) ? 'Wróć do miejsca' : 'Zacznij'}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -- Wiedza: Wpisy und Dodaj ------------------------------------------------------------------------ */

function EntitiesTab({ trail, go }: { trail: readonly string[]; go: (...tail: string[]) => void }) {
  const { lib, sources } = useCtx();
  if (trail[0] !== undefined && trail[0] !== 'widok' && lib.entity(trail[0]) !== undefined) {
    return (
      <div className="cg">
        <a className="wk-link" href={'#'} onClick={(e) => { e.preventDefault(); window.history.back(); }}>← wróć</a>
        {/* 2026-10-25 (Wywód) — der Weg von der Wurzel und was unter diesem Eintrag liegt, wenn seine Rodzaje Strukturfelder haben. */}
        <EntityStructure id={trail[0]} onOpen={(id) => go('wpisy', id)} />
        {/* 0110 — ein Eintrag aus einer Quelle: hier zu lesen, dort zu ändern. */}
        <ForeignOnly id={trail[0]} tab="wpisy">
          <EntityEditor entityId={trail[0]} onDone={(id) => go('wpisy', ...(id === null ? [] : [id]))} onOpen={(id) => go('wpisy', id)} />
        </ForeignOnly>
        <EntityAnchors key={trail[0]} entityId={trail[0]} />
        <LearnFrom id={trail[0]} go={go} />
      </div>
    );
  }
  /* 2026-10-25 — ein Eintrag (oder ein Widok an einem Eintrag) aus einer Quelle, die noch lädt: warten statt der Liste. */
  const waiting = (trail[0] !== undefined && trail[0] !== 'widok') || (trail[0] === 'widok' && trail[2] !== undefined && lib.entity(trail[2]) === undefined);
  if (waiting && sources?.loading === true) return <p className="wk-hint">Otwieranie bazy i jej źródeł…</p>;
  return <EntityList viewId={trail[0] === 'widok' ? trail[1] ?? null : null} startAt={trail[0] === 'widok' ? trail[2] ?? null : null}
    onOpen={(id) => go('wpisy', id)} onView={(id) => go('wpisy', ...(id === null ? [] : ['widok', id]))}
    onAdd={() => go('dodaj')} onDesign={(id) => go('schematy', 'wyswietlanie', ...(id === null ? [] : [id]))} />;
}

/** Dodaj: ein einzelner Eintrag (`dodaj/nowy/<rodzaj>`), ein Sposób dodawania ausfüllen (`dodaj/<formularz>`), sonst die Auswahl. Wer nur liest, schlägt vor. */
function AddTab({ trail, go }: { trail: readonly string[]; go: (...tail: string[]) => void }) {
  const { lib, writes } = useCtx();
  if (!writes) return <Propose />;
  if (trail[0] === 'nowy') {
    return <EntityEditor entityId={null} newKinds={[trail[1] ?? lib.kinds[0]?.id ?? 'question']} onDone={(id) => go(...(id === null ? ['dodaj'] : ['wpisy', id]))} onOpen={(id) => go('wpisy', id)} />;
  }
  if (trail[0] !== undefined) {
    /* 2026-10-17 — ein Formularz dodawania ausfüllen: viele Einträge, Zeile für Zeile (AddFormRun). */
    return <AddFormRun formId={trail[0]} onClose={() => go('dodaj')} onOpen={(id) => go('wpisy', id)} onEdit={(id) => go('schematy', 'dodawanie', id)} />;
  }
  return <AddHub go={go} />;
}

/* -- Przebiegi ---------------------------------------------------------------------------------- */

function FlowsTab({ trail, learner, cards, go }: { trail: readonly string[]; learner: Learner | null; cards: readonly Card[] | null; go: (...tail: string[]) => void }) {
  const { lib, writes } = useCtx();
  const entry = trail[0] === undefined ? undefined : lib.docs('flow').find((e) => e.id === trail[0]);
  const flow = useMemo(() => {
    if (entry === undefined) return null;
    const find = (x: string) => { const f = lib.docs('flow').find((one) => one.id === x); return f === undefined ? undefined : readFlow(f.id, f.data); };
    return resolveFlow(readFlow(entry.id, entry.data), find);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id, entry?.version]);
  const content = useMemo(() => (cards === null ? null : contentOfLibrary(lib, cards)), [lib, cards]);
  if (flow !== null && (trail[1] === 'graj' || !writes)) {
    if (content === null) return <p className="wk-hint">Przygotowywanie…</p>;
    return <FlowPlayer flow={flow} content={content} learner={learner} onClose={() => go(writes ? 'przebiegi' : 'nauka')} />;
  }
  if (!writes) {
    return (
      <div className="cg-grid">
        {lib.docs('flow').map((e) => <div key={e.id} className="cg-card"><strong>{String(e.data.name ?? 'Przebieg')}</strong><button type="button" className="wk-btn" onClick={() => go('przebiegi', e.id, 'graj')}>Zacznij</button></div>)}
        {lib.docs('flow').length === 0 && <p className="wk-empty">Nie ma jeszcze przebiegów.</p>}
      </div>
    );
  }
  return <FlowEditor chosenId={trail[0] ?? null} onChoose={(id) => go('przebiegi', ...(id === null ? [] : [id]))} />;
}
