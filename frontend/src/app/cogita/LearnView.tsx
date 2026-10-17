/**
 * NAUKA (0109, 0110) — `#/workspace/learn`: die Heimat von Cogita, neben der
 * Bibliothek.
 *
 * <code>
 *   learn                     was jetzt dran ist (über alle Bazy wiedzy), Sitzungen,
 *                             die Bazy wiedzy — und eine neue anlegen
 *   learn/<baza>/<reiter>/…   eine Baza wiedzy (CogitaHome)
 *   learn/bez-sieci/…         was das Gerät für die Zeit ohne Netz hält — dort
 *                             lässt es sich auch ohne Netz üben
 * </code>
 *
 * <b>0110 — eine Baza wiedzy ist keine Bibliothek.</b> Die Bibliothek ist eine
 * Sammlung von Büchern (Werke, Zitate, Texte); eine Baza wiedzy ist, was
 * Cogita lehrt, und verweist auf Bibliotheken und andere Bazy wiedzy, auch in
 * anderen Bereichen. Beide liegen im selben versiegelten Speicher.
 */

import { useEffect, useMemo, useState } from 'react';

import { ensurePrivateArea } from '../calendar/agenda';
import { loadAreas, type AreaRow } from '../areas/area';
import { AreaOptions } from '../areas/AreaOptions';
import { useCrumbs } from '../shell/crumbTrail';
import { createLibrary, isUuid, libraryKindOf, loadLibraries, openLibraries, type OpenLibrary } from '../library/library';
import { useLibraryStore } from '../library/libraryStore';
import { useMe, type Me } from '../core/me';
import { viewPath } from '../routes';
import { WorkspaceError, type Who } from '../core/session';
import { CogitaHome } from './CogitaHome';
import { BASES_CHANGED } from './sources';
import { holderOfMe } from './holders';
import { Learner, loadDue, targetOf, type DueRow } from './learn';
import { loadSessions, SESSION_KIND_LABEL, type SessionRow } from './live';
import { offlineList, openOffline, type OfflineRevision } from './offline';
import { readPlan } from './revision';
import { RevisionRun } from './RevisionRun';
import './cogita.css';
import { Loading } from '../ui/Loading';
import { Icon } from '../ui/icons';
import { MenuButton } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';
import { Modal } from '../ui/Modal';

export function LearnView({ who, trail }: { who: Who; trail: readonly string[] }) {
  const me = useMe(who);
  if (me === undefined) return <Loading label="Wczytywanie…" />;
  if (me === null) return <OfflineOnly trail={trail[0] === 'bez-sieci' ? trail.slice(1) : []} />;
  return <LearnHome me={me} who={who} trail={trail} />;
}

/** Ohne offenen Schlüsselbund (kein Netz, kein Passwort in dieser Karte): nur, was das Gerät hält. */
function OfflineOnly({ trail }: { trail: readonly string[] }) {
  return (
    <div className="cg">
      <p className="wk-note">Klucze nie są otwarte w tej karcie. Bez nich można powtarzać tylko to, co urządzenie trzyma bez internetu.</p>
      <OfflinePart me={null} trail={trail} />
    </div>
  );
}

function LearnHome({ me, who, trail }: { me: Me; who: Who; trail: readonly string[] }) {
  const [bases, setBases] = useState<readonly OpenLibrary[] | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [rows, found] = await Promise.all([loadLibraries(), loadAreas()]);
        const opened = await openLibraries(me.ring, rows.libraries);
        if (!alive) return;
        setBases(opened.filter((one) => libraryKindOf(one) === 'knowledge'));
        setAreas(found.areas);
        setFailed(null);
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać baz wiedzy.');
      }
    })();
    return () => { alive = false; };
  }, [me.ring, tick]);
  useEffect(() => {
    const again = () => setTick((n) => n + 1);
    window.addEventListener(BASES_CHANGED, again);
    return () => window.removeEventListener(BASES_CHANGED, again);
  }, []);

  const chosen = trail[0] !== undefined && isUuid(trail[0]) ? trail[0] : null;
  const current = chosen === null ? null : bases?.find((one) => one.libraryId === chosen) ?? null;
  useCrumbs(current === null ? [] : [{
    label: current.name,
    href: viewPath('learn', current.libraryId),
    beside: (bases ?? []).filter((one) => one.libraryId !== current.libraryId).map((one) => ({ label: one.name, href: viewPath('learn', one.libraryId) }))
  }]);

  if (trail[0] === 'bez-sieci') return <OfflinePart me={me} trail={trail.slice(1)} />;
  if (failed !== null) return <p className="wk-error">{failed}</p>;
  if (chosen !== null) {
    if (bases === null) return <Loading label="Wczytywanie…" />;
    if (current === null) return <p className="wk-empty">Tej bazy wiedzy nie ma albo nie masz do niej klucza. <a href={viewPath('learn')}>Wszystkie bazy wiedzy</a></p>;
    return <KnowledgeBase me={me} who={who} base={current} trail={trail.slice(1)} />;
  }
  return <Overview me={me} bases={bases} areas={areas} onCreated={() => setTick((n) => n + 1)} />;
}

/** Eine Baza wiedzy: ihr Speicher, abgeglichen, und darin Cogita. */
function KnowledgeBase({ me, who, base, trail }: { me: Me; who: Who; base: OpenLibrary; trail: readonly string[] }) {
  const { store, failed } = useLibraryStore(me.ring, base);
  if (store === null) return null;
  if (failed !== null && !store.loaded) return <p className="wk-error">{failed}</p>;
  if (!store.loaded) return <p className="wk-lede">Otwieranie bazy wiedzy…</p>;
  return (
    <>
      <PageHeader title={base.name} meta={`${base.entries} ${base.entries === 1 ? 'wpis' : 'wpisów'}${base.writes ? '' : ' · uczysz się'}`} />
      <CogitaHome me={me} who={who} library={base} store={store} trail={trail} />
    </>
  );
}

function Overview({ me, bases, areas, onCreated }: { me: Me; bases: readonly OpenLibrary[] | null; areas: readonly AreaRow[]; onCreated: () => void }) {
  const [due, setDue] = useState<readonly DueRow[] | null>(null);
  const [sessions, setSessions] = useState<readonly SessionRow[]>([]);
  useEffect(() => {
    void loadDue().then((r) => setDue(r.due), () => setDue([]));
    void loadSessions().then((r) => setSessions(r.sessions.filter((s) => s.state === 'lobby' || s.state === 'running')), () => undefined);
  }, [me]);
  const names = new Map((bases ?? []).map((l) => [l.libraryId, l.name]));
  const now = Date.now();
  const waiting = (due ?? []).filter((d) => d.dueAt !== null && new Date(d.dueAt).getTime() <= now && d.dueCount > 0);
  const later = (due ?? []).filter((d) => d.dueAt !== null && new Date(d.dueAt).getTime() > now);
  const areaName = (id: string) => areas.find((a) => a.areaId === id)?.personal === true ? 'tylko Ty' : areas.find((a) => a.areaId === id)?.name ?? 'obszar';
  const [adding, setAdding] = useState(false);
  return (
    <div className="cg cg-overview wk-narrow">
      <PageHeader
        title="Nauka"
        actions={(
          <>
            <button type="button" className="wk-btn" onClick={() => setAdding(true)}><Icon name="plus" />Nowa baza wiedzy</button>
            <MenuButton label="Więcej: Nauka" items={[
              { label: 'Bez internetu na tym urządzeniu', icon: 'download', onSelect: () => { window.location.hash = viewPath('learn', 'bez-sieci').slice(1); } }
            ]} />
          </>
        )}
      />

      {/* 2026-10-17 — wie Teraz: Kästen mit Zeilen, eine Handlung im Kopf; die Erklärung der Baza wiedzy steht im leeren Zustand. */}
      <section className="wk-box" aria-labelledby="learn-now">
        <div className="wk-box-head"><h2 className="wk-box-title" id="learn-now">Na teraz</h2></div>
        {due === null ? <div className="wk-box-body"><Loading lines={1} /></div>
          : waiting.length === 0 ? <p className="wk-box-empty">Nic nie czeka — wszystko powtórzone.{later.length > 0 ? ` Następne: ${later.map((d) => `${names.get(d.libraryId) ?? 'Baza wiedzy'} ${new Date(d.dueAt!).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}`).slice(0, 3).join(' · ')}.` : ''}</p>
          : waiting.map((d) => (
            <a key={`${d.libraryId}:${d.holderRoleId}`} className="wk-line" href={viewPath('learn', d.libraryId, 'nauka')}>
              <span className="wk-line-ic is-warn"><Icon name="cap" /></span>
              <span className="wk-line-text">
                <span className="wk-line-title">{names.get(d.libraryId) ?? 'Baza wiedzy'}</span>
                <span className="wk-line-sub">{d.dueCount} {d.dueCount === 1 ? 'karta' : 'kart'} do powtórki</span>
              </span>
              <span className="wk-line-end"><Icon name="next" /></span>
            </a>
          ))}
      </section>

      {sessions.length > 0 && (
        <section className="wk-box" aria-labelledby="learn-live">
          <div className="wk-box-head"><h2 className="wk-box-title" id="learn-live">Sesje teraz</h2></div>
          {sessions.map((s) => (
            <a key={s.sessionId} className="wk-line" href={s.libraryId === null ? '#' : viewPath('learn', s.libraryId, 'sesje', s.sessionId)}>
              <span className="wk-line-ic is-ok"><Icon name="play" /></span>
              <span className="wk-line-text">
                <span className="wk-line-title">{SESSION_KIND_LABEL[s.kind]}</span>
                <span className="wk-line-sub">{[s.joinCode !== null ? `kod ${s.joinCode}` : null, s.host ? 'prowadzisz' : null].filter(Boolean).join(' · ') || 'trwa'}</span>
              </span>
              <span className="wk-line-end"><Icon name="next" /></span>
            </a>
          ))}
        </section>
      )}

      <section className="wk-box" aria-labelledby="learn-bases">
        <div className="wk-box-head"><h2 className="wk-box-title" id="learn-bases">Bazy wiedzy</h2></div>
        {bases === null ? <div className="wk-box-body"><Loading /></div>
          : bases.length === 0 ? (
            <div className="wk-box-body">
              <p className="wk-hint">Baza wiedzy to to, czego się uczy: wpisy, pytania, karty, powtórki i przebiegi. Załóż ją albo dołącz do kursu przez link.</p>
              <div className="wk-actions"><button type="button" className="wk-btn wk-btn-line" onClick={() => setAdding(true)}><Icon name="plus" />Nowa baza wiedzy</button></div>
            </div>
          )
          : bases.map((l) => (
            <a key={l.libraryId} className="wk-line" href={viewPath('learn', l.libraryId)}>
              <span className="wk-line-ic"><Icon name="book" /></span>
              <span className="wk-line-text">
                <span className="wk-line-title">{l.name}</span>
                <span className="wk-line-sub">{l.entries} wpisów · {areaName(l.areaId)}{l.writes ? '' : ' · uczysz się'}</span>
              </span>
              <span className="wk-line-end"><Icon name="next" /></span>
            </a>
          ))}
      </section>

      {adding && (
        <Modal title="Nowa baza wiedzy" onClose={() => setAdding(false)}>
          <NewBase me={me} areas={areas} onCreated={() => { setAdding(false); onCreated(); }} />
        </Modal>
      )}
    </div>
  );
}

/** Eine neue Baza wiedzy — in einem Bereich, in dem ich schreiben darf (oder nur für mich). */
function NewBase({ me, areas, onCreated }: { me: Me; areas: readonly AreaRow[]; onCreated: () => void }) {
  const writable = areas.filter((a) => (a.myLevel === 'write' || a.myLevel === 'admin') && a.heldEpochs > 0);
  const personal = areas.find((a) => a.personal === true);
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState(personal?.areaId ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const area = areaId === '' ? await ensurePrivateArea(me.ring, me.person, areas) : areaId;
      const id = await createLibrary(me.ring, area, name.trim() === '' ? 'Moja baza wiedzy' : name, 'knowledge');
      onCreated();
      window.location.hash = viewPath('learn', id, 'wpisy');
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się założyć bazy wiedzy.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void create(); }}>
      <label className="wk-field">
        <span>Nazwa</span>
        <input value={name} placeholder="np. Bierzmowanie 2027" onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label className="wk-field">
        <span>Kto ją widzi</span>
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">{personal === undefined ? 'Tylko ja (utworzy się prywatny obszar)' : 'Tylko ja'}</option>
          <AreaOptions areas={areas} only={writable.filter((a) => a.personal !== true)} />
        </select>
      </label>
      <p className="wk-hint">Kto czyta obszar, uczy się z tej bazy; kto w nim pisze, ją buduje.</p>
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Zakładanie…' : 'Załóż'}</button>
      </div>
    </form>
  );
}

/** Was das Gerät hält — und ein Lauf daraus, ohne Netz. */
function OfflinePart({ me, trail }: { me: Me | null; trail: readonly string[] }) {
  const [list, setList] = useState<readonly { libraryId: string; revisionId: string; savedAt: number }[] | null>(null);
  const [open, setOpen] = useState<OfflineRevision | null | undefined>(undefined);
  const [learner, setLearner] = useState<Learner | null>(null);
  useEffect(() => { void offlineList().then(setList); }, []);
  const chosen = trail[0];
  useEffect(() => {
    if (chosen === undefined) { setOpen(undefined); return; }
    const [libraryId, revisionId] = chosen.split(':');
    void openOffline(libraryId, revisionId).then(async (copy) => {
      setOpen(copy);
      if (copy !== null && me !== null) {
        const target = copy.target === null ? null : await targetOf(copy.target.areaId).catch(() => ({ areaId: copy.target!.areaId, intake: null }));
        const made = new Learner(copy.libraryId, holderOfMe(me), target);
        await made.load().catch(() => undefined);
        setLearner(made);
      }
    });
  }, [chosen, me]);
  const source = useMemo(() => (open == null ? null : { plan: readPlan(open.cards, null, open.plan), cards: open.cards, deps: open.deps, title: open.name }), [open]);
  if (chosen !== undefined) {
    if (open === undefined) return <p className="wk-hint">Otwieranie…</p>;
    if (open === null || source === null) return <p className="wk-error">Tej powtórki nie ma na tym urządzeniu.</p>;
    return <RevisionRun lib={null} learner={learner} source={source} onClose={() => { window.location.hash = viewPath('learn', 'bez-sieci'); }} />;
  }
  return (
    <section className="cg-card">
      <h3>Na tym urządzeniu bez internetu</h3>
      {list === null ? <span className="wk-hint">Sprawdzanie…</span> : list.length === 0 ? <span className="wk-hint">Nic. Autor może oznaczyć powtórkę „Trzymaj na urządzeniach bez internetu" — wtedy po pierwszym przejściu zostanie tutaj (tylko gdy klucz jest zapamiętany na tym urządzeniu).</span> : (
        <ul>{list.map((o) => <li key={`${o.libraryId}:${o.revisionId}`}><a href={viewPath('learn', 'bez-sieci', `${o.libraryId}:${o.revisionId}`)}>Powtórka z {new Date(o.savedAt).toLocaleDateString('pl-PL')}</a></li>)}</ul>
      )}
    </section>
  );
}
