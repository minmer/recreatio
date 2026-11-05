/**
 * NAUKA (0109, 0110) — `#/workspace/learn`: die Heimat von Cogita, neben der
 * Bibliothek. 2026-10-24 — und WIEDZA (`#/workspace/knowledge`): dieselben Bazy,
 * zwei Teile (`parts.ts`). Die Wiedza führt die Bazy (anlegen, Einträge, Schematy),
 * die Nauka das Lernen; eine Adresse, die in den anderen Teil gehört, führt dorthin.
 *
 * <code>
 *   learn                     was jetzt dran ist (über alle Bazy wiedzy), Sitzungen,
 *                             die Bazy wiedzy — und eine neue anlegen
 *   learn/<baza>/<reiter>/…   eine Baza wiedzy (CogitaHome)
 *   learn/bez-sieci/…         was das Gerät für die Zeit ohne Netz hält — dort
 *                             lässt es sich auch ohne Netz üben (AwayLearn.tsx;
 *                             ohne Netz und ohne Sitzung: shell/AloneShell.tsx)
 * </code>
 *
 * <b>0110 — eine Baza wiedzy ist keine Bibliothek.</b> Die Bibliothek ist eine
 * Sammlung von Büchern (Werke, Zitate, Texte); eine Baza wiedzy ist, was
 * Cogita lehrt, und verweist auf Bibliotheken und andere Bazy wiedzy, auch in
 * anderen Bereichen. Beide liegen im selben versiegelten Speicher.
 */

import { useEffect, useState } from 'react';

import { ensurePrivateArea } from '../calendar/agenda';
import { loadAreas, type AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { useCrumbs } from '../shell/crumbTrail';
import { createLibrary, isUuid, libraryKindOf, loadLibraries, openLibraries, type OpenLibrary } from '../library/library';
import { useLibraryStore } from '../library/libraryStore';
import { useMe, type Me } from '../core/me';
import { rich, useT } from '../core/i18n';
import { viewPath } from '../routes';
import { WorkspaceError, type Who } from '../core/session';
import { CogitaHome } from './CogitaHome';
import { cogitaTrail, type CogitaPart } from './parts';
import { WHOLE_BASE } from './visibility';
import { BASES_CHANGED } from './sources';
import { isDocKind } from './kinds';
import { loadDue, type DueRow } from './learn';
import { loadSessions, SESSION_KIND_LABEL, type SessionRow } from './live';
import { AwayLearn } from './AwayLearn';
import './cogita.css';
import { Loading } from '../ui/Loading';
import { Icon } from '../ui/icons';
import { MenuButton } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';
import { Modal } from '../ui/Modal';

export function LearnView({ who, trail, part = 'learn' }: { who: Who; trail: readonly string[]; part?: CogitaPart }) {
  const me = useMe(who);
  const t = useT();
  if (me === undefined) return <Loading label={t('common.loading')} />;
  /* Ohne offenen Schlüsselbund (kein Netz, kein Passwort in dieser Karte): nur, was das Gerät hält — nach der Anmeldung ohne Netz. */
  if (me === null) return <AwayLearn who={who} me={null} trail={trail[0] === 'bez-sieci' ? trail.slice(1) : []} />;
  return <LearnHome me={me} who={who} trail={trail} part={part} />;
}

function LearnHome({ me, who, trail, part }: { me: Me; who: Who; trail: readonly string[]; part: CogitaPart }) {
  const [bases, setBases] = useState<readonly OpenLibrary[] | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const t = useT();
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
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : t('cogitaLearnRun.learnView.loadFailed'));
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
    href: viewPath(part, current.libraryId),
    beside: (bases ?? []).filter((one) => one.libraryId !== current.libraryId).map((one) => ({ label: one.name, href: viewPath(part, one.libraryId) }))
  }]);
  /* 2026-10-24 — ein Weg, der in den anderen Teil gehört (oder ein alter Weg): dorthin, ersetzt, damit Zurück nicht im Kreis geht. */
  const moved = chosen === null ? null : (() => {
    const asked = trail.slice(1);
    const next = cogitaTrail(asked, part);
    return next.part === part && next.tail.join('/') === asked.join('/') ? null : viewPath(next.part, chosen, ...next.tail);
  })();
  useEffect(() => { if (moved !== null) window.location.replace(moved); }, [moved]);

  if (moved !== null) return <Loading label={t('cogitaLearnRun.learnView.redirecting')} />;
  if (trail[0] === 'bez-sieci' && part === 'learn') return <AwayLearn who={who} me={me} trail={trail.slice(1)} />;
  /* 2026-10-28 — ohne Netz: der Weg zu dem, was das Gerät hält, statt nur der Meldung. */
  if (failed !== null) {
    return (
      <div className="cg">
        <p className="wk-error">{failed}</p>
        {part === 'learn' && <p className="wk-note">{rich(t('cogitaLearnRun.learnView.offlineNote'), { a: (s) => <a className="wk-link" href={viewPath('learn', 'bez-sieci')}>{s}</a> })}</p>}
      </div>
    );
  }
  if (chosen !== null) {
    if (bases === null) return <Loading label={t('common.loading')} />;
    if (current === null) return <p className="wk-empty">{t('cogitaLearnRun.learnView.noBase')} <a href={viewPath(part)}>{t('cogitaLearnRun.learnView.allBases')}</a></p>;
    return <KnowledgeBase me={me} who={who} base={current} trail={trail.slice(1)} part={part} />;
  }
  return part === 'knowledge'
    ? <KnowledgeOverview me={me} bases={bases} areas={areas} onCreated={() => setTick((n) => n + 1)} />
    : <Overview me={me} bases={bases} areas={areas} />;
}

/** Eine Baza wiedzy: ihr Speicher, abgeglichen, und darin Cogita — der Teil Wiedza oder Nauka. */
function KnowledgeBase({ me, who, base, trail, part }: { me: Me; who: Who; base: OpenLibrary; trail: readonly string[]; part: CogitaPart }) {
  const { store, failed } = useLibraryStore(me.ring, base);
  const t = useT();
  if (store === null) return null;
  if (failed !== null && !store.loaded) return <p className="wk-error">{failed}</p>;
  if (!store.loaded) return <p className="wk-lede">{t('cogitaLearnRun.learnView.opening')}</p>;
  /* 2026-10-17 — gezählt im Speicher, nicht aus der Liste beim Öffnen: die Zahl wächst mit, während man hinzufügt (Formularze dodawania). */
  const entries = store.all().filter((e) => !isDocKind(e.kind)).length;
  return (
    <>
      <PageHeader title={base.name} meta={base.writes ? t('cogitaLearnRun.learnView.entries', { count: entries }) : t('cogitaLearnRun.learnView.entriesLearning', { count: entries })} />
      <CogitaHome me={me} who={who} library={base} store={store} trail={trail} part={part} />
    </>
  );
}

/**
 * 2026-10-24 — WIEDZA: die Bazy wiedzy, und eine neue anlegen. Wissen ist auch ohne Lernen
 * etwas wert: wer forscht, baut hier und braucht nie eine Powtórka.
 */
function KnowledgeOverview({ me, bases, areas, onCreated }: { me: Me; bases: readonly OpenLibrary[] | null; areas: readonly AreaRow[]; onCreated: () => void }) {
  const [adding, setAdding] = useState(false);
  const t = useT();
  const areaName = (id: string) => areas.find((a) => a.areaId === id)?.personal === true ? t('cogitaLearnRun.learnView.onlyYou') : areas.find((a) => a.areaId === id)?.name ?? t('cogitaLearnRun.learnView.area');
  return (
    <div className="cg cg-overview wk-narrow">
      <PageHeader title={t('cogitaLearnRun.learnView.knowledge')} actions={<button type="button" className="wk-btn" onClick={() => setAdding(true)}><Icon name="plus" />{t('cogitaLearnRun.learnView.newBase')}</button>} />
      <section className="wk-box" aria-labelledby="knowledge-bases">
        <div className="wk-box-head"><h2 className="wk-box-title" id="knowledge-bases">{t('cogitaLearnRun.learnView.bases')}</h2></div>
        {bases === null ? <div className="wk-box-body"><Loading /></div>
          : bases.length === 0 ? (
            <div className="wk-box-body">
              <p className="wk-box-empty">{t('cogitaLearnRun.learnView.basesEmpty')}</p>
              <div className="wk-actions"><button type="button" className="wk-btn wk-btn-line" onClick={() => setAdding(true)}><Icon name="plus" />{t('cogitaLearnRun.learnView.newBase')}</button></div>
            </div>
          )
          : bases.map((l) => (
            <a key={l.libraryId} className="wk-line" href={viewPath('knowledge', l.libraryId)}>
              <span className="wk-line-ic"><Icon name="branch" /></span>
              <span className="wk-line-text">
                <span className="wk-line-title">{l.name}</span>
                <span className="wk-line-sub">{t(l.writes ? 'cogitaLearnRun.learnView.lineWrite' : 'cogitaLearnRun.learnView.lineRead', { count: l.entries, area: areaName(l.areaId) })}</span>
              </span>
              <span className="wk-line-end"><Icon name="next" /></span>
            </a>
          ))}
      </section>
      {adding && (
        <Modal title={t('cogitaLearnRun.learnView.newBase')} onClose={() => setAdding(false)}>
          <NewBase me={me} areas={areas} onCreated={() => { setAdding(false); onCreated(); }} />
        </Modal>
      )}
    </div>
  );
}

/** NAUKA: was jetzt dran ist, Sitzungen, die Bazy zum Lernen — angelegt werden sie in der Wiedza. */
function Overview({ me, bases, areas }: { me: Me; bases: readonly OpenLibrary[] | null; areas: readonly AreaRow[] }) {
  const [due, setDue] = useState<readonly DueRow[] | null>(null);
  const [sessions, setSessions] = useState<readonly SessionRow[]>([]);
  const t = useT();
  useEffect(() => {
    void loadDue().then((r) => setDue(r.due), () => setDue([]));
    void loadSessions().then((r) => setSessions(r.sessions.filter((s) => s.state === 'lobby' || s.state === 'running')), () => undefined);
  }, [me]);
  const names = new Map((bases ?? []).map((l) => [l.libraryId, l.name]));
  const now = Date.now();
  const waiting = (due ?? []).filter((d) => d.dueAt !== null && new Date(d.dueAt).getTime() <= now && d.dueCount > 0);
  const later = (due ?? []).filter((d) => d.dueAt !== null && new Date(d.dueAt).getTime() > now);
  const areaName = (id: string) => areas.find((a) => a.areaId === id)?.personal === true ? t('cogitaLearnRun.learnView.onlyYou') : areas.find((a) => a.areaId === id)?.name ?? t('cogitaLearnRun.learnView.area');
  return (
    <div className="cg cg-overview wk-narrow">
      <PageHeader
        title={t('cogitaLearnRun.learnView.learning')}
        actions={(
          <>
            <MenuButton label={t('cogitaLearnRun.learnView.moreLearning')} items={[
              { label: t('cogitaLearnRun.learnView.offlineHere'), icon: 'download', onSelect: () => { window.location.hash = viewPath('learn', 'bez-sieci').slice(1); } }
            ]} />
          </>
        )}
      />

      {/* 2026-10-17 — wie Teraz: Kästen mit Zeilen, eine Handlung im Kopf; die Erklärung der Baza wiedzy steht im leeren Zustand. */}
      <section className="wk-box" aria-labelledby="learn-now">
        <div className="wk-box-head"><h2 className="wk-box-title" id="learn-now">{t('cogitaLearnRun.learnView.now')}</h2></div>
        {due === null ? <div className="wk-box-body"><Loading lines={1} /></div>
          : waiting.length === 0 ? <p className="wk-box-empty">{t('cogitaLearnRun.learnView.nothingDue')}{later.length > 0 ? t('cogitaLearnRun.learnView.later', { list: later.map((d) => `${names.get(d.libraryId) ?? t('cogitaLearnRun.learnView.base')} ${new Date(d.dueAt!).toLocaleString(t.locale, { dateStyle: 'short', timeStyle: 'short' })}`).slice(0, 3).join(' · ') }) : ''}</p>
          : waiting.map((d) => (
            <a key={`${d.libraryId}:${d.holderRoleId}`} className="wk-line" href={viewPath('learn', d.libraryId, 'nauka')}>
              <span className="wk-line-ic is-warn"><Icon name="cap" /></span>
              <span className="wk-line-text">
                <span className="wk-line-title">{names.get(d.libraryId) ?? t('cogitaLearnRun.learnView.base')}</span>
                <span className="wk-line-sub">{t('cogitaLearnRun.learnView.dueCards', { count: d.dueCount })}</span>
              </span>
              <span className="wk-line-end"><Icon name="next" /></span>
            </a>
          ))}
      </section>

      {sessions.length > 0 && (
        <section className="wk-box" aria-labelledby="learn-live">
          <div className="wk-box-head"><h2 className="wk-box-title" id="learn-live">{t('cogitaLearnRun.learnView.sessions')}</h2></div>
          {sessions.map((s) => (
            <a key={s.sessionId} className="wk-line" href={s.libraryId === null ? '#' : viewPath('learn', s.libraryId, 'sesje', s.sessionId)}>
              <span className="wk-line-ic is-ok"><Icon name="play" /></span>
              <span className="wk-line-text">
                <span className="wk-line-title">{SESSION_KIND_LABEL[s.kind]}</span>
                <span className="wk-line-sub">{[s.joinCode !== null ? t('cogitaLearnRun.learnView.code', { code: s.joinCode }) : null, s.host ? t('cogitaLearnRun.learnView.hosting') : null].filter(Boolean).join(' · ') || t('cogitaLearnRun.learnView.running')}</span>
              </span>
              <span className="wk-line-end"><Icon name="next" /></span>
            </a>
          ))}
        </section>
      )}

      <section className="wk-box" aria-labelledby="learn-bases">
        <div className="wk-box-head"><h2 className="wk-box-title" id="learn-bases">{t('cogitaLearnRun.learnView.bases')}</h2></div>
        {bases === null ? <div className="wk-box-body"><Loading /></div>
          : bases.length === 0 ? (
            <div className="wk-box-body">
              <p className="wk-box-empty">{t('cogitaLearnRun.learnView.learnEmpty')}</p>
              <div className="wk-actions"><a className="wk-btn wk-btn-line" href={viewPath('knowledge')}><Icon name="branch" />{t('cogitaLearnRun.learnView.toKnowledge')}</a></div>
            </div>
          )
          : bases.map((l) => (
            <a key={l.libraryId} className="wk-line" href={viewPath('learn', l.libraryId)}>
              <span className="wk-line-ic"><Icon name="book" /></span>
              <span className="wk-line-text">
                <span className="wk-line-title">{l.name}</span>
                <span className="wk-line-sub">{t(l.writes ? 'cogitaLearnRun.learnView.lineWrite' : 'cogitaLearnRun.learnView.lineLearn', { count: l.entries, area: areaName(l.areaId) })}</span>
              </span>
              <span className="wk-line-end"><Icon name="next" /></span>
            </a>
          ))}
      </section>

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
  const t = useT();
  const create = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const area = areaId === '' ? await ensurePrivateArea(me.ring, me.person, areas) : areaId;
      const id = await createLibrary(me.ring, area, name.trim() === '' ? t('cogitaLearnRun.learnView.myBase') : name, 'knowledge');
      onCreated();
      window.location.hash = viewPath('knowledge', id, 'wpisy');
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('cogitaLearnRun.learnView.createFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void create(); }}>
      <label className="wk-field">
        <span>{t('common.name')}</span>
        <input value={name} placeholder={t('cogitaLearnRun.learnView.namePlaceholder')} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label className="wk-field">
        <span>{t('cogitaLearnRun.learnView.whoSees')}</span>
        <AreaPick
          label={t('cogitaLearnRun.learnView.whoSees')} value={areaId} onChange={setAreaId} areas={areas} only={writable.filter((a) => a.personal !== true)}
          extras={[{ value: '', label: personal === undefined ? t('cogitaLearnRun.learnView.onlyMeNew') : t('cogitaLearnRun.learnView.onlyMe') }]}
        />
      </label>
      <p className="wk-hint">{t('cogitaLearnRun.learnView.whoHint')}</p>
      {/* 2026-10-22 (Schritt 8) — eine Baza folgt ihrem Bereich: in einem jawnym ist sie als Ganze öffentlich. */}
      {(areas.find((a) => a.areaId === areaId)?.publicLevel ?? 'none') !== 'none' && (
        <p className="wk-warn">{t('cogitaLearnRun.learnView.publicWarn', { whole: WHOLE_BASE })}</p>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy}>{busy ? t('cogitaLearnRun.learnView.creating') : t('cogitaLearnRun.learnView.create')}</button>
      </div>
    </form>
  );
}
