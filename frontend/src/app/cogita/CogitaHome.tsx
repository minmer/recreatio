/**
 * COGITA IN DER BIBLIOTHEK (COGITA.md §13, §14): `#/workspace/library/<id>/cogita/<reiter>/…`.
 *
 * <code>
 *   nauka         lernen: die Wiederholungen, was fällig ist, und Abläufe zum Durchgehen
 *   wpisy         die Einträge — Tabelle, Baum, Leinwand; ein Eintrag bearbeiten
 *   schemat       die Arten
 *   karty         die Kartenvorlagen
 *   powtorki      die Wiederholungen bauen
 *   przebiegi     die Abläufe bauen (und spielen)
 *   sesje         Sitzungen führen und mitmachen
 *   postepy       der eigene Fortschritt — und der aller Lernenden für die Lehrerin
 *   mapa          die Karte zum Entdecken
 *   do-zrobienia  was offen ist und was gemeldet wurde
 *   propozycje    Vorschläge von Lesenden
 *   ustawienia    wohin die Antworten gehen, Motivation, Abhängigkeiten, Werte, Regeln, Aussehen
 *   json          der Kurs als JSON, und der Auftrag für die eigene KI
 * </code>
 *
 * Wer nur liest, sieht die Werkzeuge der Autoren nicht [L2]: Lernen, Abläufe,
 * Sitzungen, den eigenen Fortschritt, die Karte und das Vorschlagen.
 */

import { useMemo } from 'react';

import { areaKeys } from '../chat';
import type { OpenLibrary } from '../library';
import type { LibraryStore } from '../libraryStore';
import type { Me } from '../me';
import { viewPath } from '../routes';
import type { Who } from '../session';
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
import type { Learner } from './learn';
import { renamer } from './learn';
import { OfficeProgress, OwnProgress } from './Progress';
import { Pending } from './Pending';
import { REVISION_PRESETS } from './presets';
import { RevisionEditor } from './RevisionEditor';
import { RevisionRun } from './RevisionRun';
import { SchemaEditor } from './SchemaEditor';
import { SessionsTab } from './Sessions';
import { TemplateEditor } from './TemplateEditor';
import { CogitaContext, useAsync, useBusy, useCogita, useCtx, type CogitaCtx } from './ui';
import type { Card } from './cards';

const AUTHOR_TABS = [
  ['nauka', 'Nauka'], ['wpisy', 'Wpisy'], ['schemat', 'Schemat'], ['karty', 'Szablony kart'], ['powtorki', 'Powtórki'],
  ['przebiegi', 'Przebiegi'], ['sesje', 'Sesje'], ['postepy', 'Postępy'], ['mapa', 'Mapa'], ['do-zrobienia', 'Do zrobienia'],
  ['propozycje', 'Propozycje'], ['ustawienia', 'Ustawienia'], ['json', 'JSON']
] as const;

const READER_TABS = [['nauka', 'Nauka'], ['przebiegi', 'Przebiegi'], ['sesje', 'Sesje'], ['postepy', 'Postępy'], ['mapa', 'Mapa'], ['zaproponuj', 'Zaproponuj']] as const;

export function CogitaHome({ me, who, library, store, trail }: { me: Me; who: Who; library: OpenLibrary; store: LibraryStore; trail: readonly string[] }) {
  const lib = useCogita(store, library.writes);
  const ctx = useMemo<CogitaCtx | null>(() => lib === null ? null : ({
    lib, name: library.name, writes: library.writes, me, who,
    keyOf: (epoch) => areaKeys(me.ring, library.areaId).then((m) => m.get(epoch) ?? areaKeys(me.ring, library.areaId, true).then((f) => f.get(epoch))),
    href: (...tail) => viewPath('library', library.libraryId, 'cogita', ...tail)
  }), [lib, library, me, who]);
  if (ctx === null) return null;
  return (
    <CogitaContext.Provider value={ctx}>
      <Hub trail={trail} />
    </CogitaContext.Provider>
  );
}

function Hub({ trail }: { trail: readonly string[] }) {
  const { lib, writes, me, href } = useCtx();
  const holder = useMemo(() => (me === null ? null : holderOfMe(me)), [me]);
  const { learner } = useLearner(lib, holder);
  const tabs = writes ? AUTHOR_TABS : READER_TABS;
  const tab = tabs.some(([slug]) => slug === trail[0]) ? trail[0]! : 'nauka';
  const go = (...tail: string[]) => { window.location.hash = href(...tail); };
  const cards = useAsync(() => lib.cards('learn').then((r) => r.cards), [lib.revision]);

  return (
    <div className="cg">
      <nav className="cg-subtabs" aria-label="Cogita">
        {tabs.map(([slug, label]) => <a key={slug} className={slug === tab ? 'is-on' : ''} href={href(slug)}>{label}</a>)}
      </nav>
      {tab === 'nauka' && <LearnTab trail={trail.slice(1)} learner={learner} cards={cards ?? null} go={go} />}
      {tab === 'wpisy' && <EntitiesTab trail={trail.slice(1)} go={go} />}
      {tab === 'schemat' && <SchemaEditor chosenId={trail[1] ?? null} onChoose={(id) => go('schemat', ...(id === null ? [] : [id]))} />}
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
      {tab === 'do-zrobienia' && <Pending onOpen={(id) => go('wpisy', id)} />}
      {tab === 'propozycje' && <Contributions />}
      {tab === 'zaproponuj' && <Propose />}
      {tab === 'ustawienia' && <CogitaSettings />}
      {tab === 'json' && <CogitaJson />}
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

/* -- Wpisy ------------------------------------------------------------------------------------- */

function EntitiesTab({ trail, go }: { trail: readonly string[]; go: (...tail: string[]) => void }) {
  const { lib } = useCtx();
  if (trail[0] === 'nowy') {
    return <EntityEditor entityId={null} newKinds={trail[1] === undefined ? ['knowledge'] : [trail[1]]} onDone={(id) => go('wpisy', ...(id === null ? [] : [id]))} onOpen={(id) => go('wpisy', id)} />;
  }
  if (trail[0] !== undefined && trail[0] !== 'widok' && lib.entity(trail[0]) !== undefined) {
    return (
      <div className="cg">
        <a className="wk-link" href={'#'} onClick={(e) => { e.preventDefault(); window.history.back(); }}>← wróć</a>
        <EntityEditor entityId={trail[0]} onDone={(id) => go('wpisy', ...(id === null ? [] : [id]))} onOpen={(id) => go('wpisy', id)} />
      </div>
    );
  }
  return <EntityList viewId={trail[0] === 'widok' ? trail[1] ?? null : null} onOpen={(id) => go('wpisy', id)} onNew={(kind) => go('wpisy', 'nowy', kind)} onView={(id) => go('wpisy', ...(id === null ? [] : ['widok', id]))} />;
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
