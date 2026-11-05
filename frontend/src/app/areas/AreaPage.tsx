/**
 * Ein Bereich: Przegląd · Osoby · Dostęp · Ustawienia, und seine Rozmowa.
 * 0133 — mit einer Art davor ein Reiter, der wie sie heisst (`AreaKindPanel`).
 */

import { useCallback, useEffect, useState } from 'react';

import { type ChatRow, areaKeys, loadAreaNames, loadChats, openNames, startAreaChat } from '../chat/chat';
import type { Ring, SealedRole } from '../core/keys';
import { fmtDate, useT } from '../core/i18n';
import { type Who, WorkspaceError } from '../core/session';
import { AccessLinks } from '../links/AccessLinks';
import { ShareButton } from '../links/Share';
import { type Called, namesInArea } from '../roles/called';
import type { RoleGraphData } from '../roles/roles';
import { viewPath } from '../routes';
import { later } from '../ui/later';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { Segment } from '../ui/Segment';
import type { Desk } from '../workspace/desk';
import { AreaOverview } from '../workspace/WorkspaceHome';
import { AddRole } from './AddRole';
import { type AreaRow, type Member, PUBLIC_LEVELS, type PublicLevel, SEAT_LEVELS, dropFromArea, loadMembers, myEpochKeys, setPublicLevel, setSeatLevel } from './area';
import { AreaControllerSettings } from './AreaController';
import { AreaKindPanel, AreaKindSetting } from './AreaKindPanel';
import { CONTROLLER_EVENT } from './controllers';
import { kindLabel, loadProfile, type Profile, type ProfileState } from './profile';
import { daysLeft, memberUntil, noteRenewal, RENEW_BEFORE_DAYS, renewalFailure, renewArea, WARN_BEFORE_DAYS } from './renew';
import { AREA_TABS, type AreaTab, KIND_NAME, LEVEL_NAME, OTHER_LEVEL } from './areaWords';
import { ManagedBy } from '../communities/ManagedBy';

/* -- Ein Bereich, ganz ------------------------------------------------------ */

/** 0126 — Dostęp dla AI: erst geladen, wenn die Karte offen ist. */
const AiAccessPanel = later(() => import('../aiAccess/AiAccessPanel').then((m) => m.AiAccessPanel));
/* 0133 — der ganze Bereich als JSON (für eine KI): auch für einen Bereich, der noch keinen Rodzaj hat. */
const AreaJsonPanel = later(() => import('./AreaJsonPanel').then((m) => m.AreaJsonPanel));

/** Welcher Abschnitt offen ist. Einer ist es immer. */

/**
 * Ein Bereich mit allem, was an ihm hängt — aber jeweils nur EIN Abschnitt.
 *
 * <b>Warum nicht alles untereinander.</b> Die drei Abschnitte beantworten drei
 * verschiedene Fragen, und wer eine davon stellt, stellt die anderen gerade
 * nicht.
 *
 * <b>Und einer steht offen.</b> Vorher war beim Ankommen keiner offen, und die
 * Seite zeigte einen Namen, vier Angaben und drei Knöpfe — man musste erst
 * etwas tun, um überhaupt etwas zu sehen. „Wer ist hier" ist die Frage, mit der
 * fast jeder kommt.
 */
/** 2026-10-22 — bis wann eine Mitgliedschaft gilt; erneuert wird von selbst, ein Jahr vorher. */
function Until({ iso }: { iso: string | null }) {
  const t = useT();
  if (iso === null) return null;
  const left = daysLeft(iso);
  const date = fmtDate(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric' }, t.lang);
  return (
    <span className={left < WARN_BEFORE_DAYS ? 'wk-person-until is-soon' : 'wk-person-until'} title={t('areas.page.untilTitle')}>
      {t('areas.page.until', { date })}
    </span>
  );
}

export function AreaPage({ who, desk, tab, area, areas, ring, graph, self, busy, onAct }: {
  who: Who;
  desk: Desk;
  tab: AreaTab;
  area: AreaRow;
  areas: readonly AreaRow[];
  ring: Ring | null;
  graph: RoleGraphData | null;
  self: SealedRole | null;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useT();
  const [members, setMembers] = useState<readonly Member[] | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, Called>>(new Map());
  const [note, setNote] = useState<string | null>(null);
  /* 2026-10-22 — was beim Erneuern nicht ging (hier oder zuletzt im Hintergrund). */
  const [renewError, setRenewError] = useState<string | null>(() => renewalFailure(area.areaId)?.message ?? null);

  /* 0133 — die Art des Bereichs (Profil): zu welchem Bereich sie gehört, damit beim Wechsel nichts Fremdes aufblitzt. */
  const [kind, setKind] = useState<{ readonly areaId: string; readonly state: ProfileState | 'failed' } | null>(null);
  const [kindRound, setKindRound] = useState(0);

  useEffect(() => {
    if (area.personal === true) return undefined;
    let alive = true;
    void loadProfile(area.areaId).then(
      (state) => { if (alive) setKind({ areaId: area.areaId, state }); },
      () => { if (alive) setKind({ areaId: area.areaId, state: 'failed' }); });
    return () => { alive = false; };
  }, [area.areaId, area.personal, kindRound]);

  /* Ändert sich der Administrator danych (in den Ustawienia), stimmt „was fehlt" nicht mehr. */
  useEffect(() => {
    const again = () => setKindRound((n) => n + 1);
    window.addEventListener(CONTROLLER_EVENT, again);
    return () => window.removeEventListener(CONTROLLER_EVENT, again);
  }, []);

  /** Neu laden — mit dem eben gespeicherten Profil gleich, damit der Reiter sofort da ist. */
  const kindChanged = useCallback((saved?: Profile | null) => {
    if (saved !== undefined) {
      setKind((was) => (was !== null && was.areaId === area.areaId && was.state !== 'failed'
        ? { areaId: was.areaId, state: { ...was.state, profile: saved } } : was));
    }
    setKindRound((n) => n + 1);
  }, [area.areaId]);

  const kindState = kind !== null && kind.areaId === area.areaId && kind.state !== 'failed' ? kind.state : null;
  const kindFailed = kind !== null && kind.areaId === area.areaId && kind.state === 'failed';
  const profile = kindState?.profile ?? null;

  /*
   * Ohne Rodzaj zeigt der Reiter den Import (das Dokument bringt die Art mit). Er bleibt an
   * seiner Stelle, wenn der Import das Profil anlegt — mit den Links, die nur einmal zu sehen sind.
   */
  const [jsonFirst, setJsonFirst] = useState<string | null>(null);
  useEffect(() => {
    if (tab === 'profil' && kindState !== null && kindState.profile === null) setJsonFirst(area.areaId);
  }, [tab, kindState, area.areaId]);
  const jsonHere = jsonFirst === area.areaId;
  const tabs = AREA_TABS
    .filter((one) => one.id !== 'profil' || profile !== null)
    .map((one) => (one.id === 'profil' && profile !== null ? { ...one, label: kindLabel(profile.kind) } : one));

  useEffect(() => {
    if (tab !== 'osoby') return;

    let dropped = false;

    void (async () => {
      let found: readonly Member[] = [];
      try { found = (await loadMembers(area.areaId)).members; } catch { /* leer */ }
      if (dropped) return;

      setMembers(found);

      /*
       * 2026-10-22 — FÄLLIGES GLEICH HIER ERNEUERN: wer aufnehmen darf und
       * einen Schlüsselbund hat, unterschreibt, was weniger als ein Jahr übrig
       * hat (dasselbe tut die Glocke im Hintergrund). Geht es nicht, steht es
       * unten als Warnung.
       */
      const due = found.some((m) => { const until = memberUntil(m.expires); return until !== null && daysLeft(until) < RENEW_BEFORE_DAYS; });
      if (due && area.mayCertify && ring !== null) {
        try {
          if (await renewArea(ring, area.areaId) > 0) {
            noteRenewal(area.areaId, null);
            if (!dropped) setRenewError(null);
            found = (await loadMembers(area.areaId)).members;
            if (!dropped) setMembers(found);
          }
        } catch (e) {
          const message = e instanceof WorkspaceError ? e.message : t('areas.page.renewFailed');
          noteRenewal(area.areaId, message);
          if (!dropped) setRenewError(message);
        }
      }
      if (dropped) return;

      /*
       * NAMEN STATT KENNUNGEN, wo es geht — und bei Menschen der echte Name:
       * der Spitzname oder Vor- und Nachname, nicht bloss die Bezeichnung der
       * Rolle (`called.ts`). Für wen nichts davon lesbar ist, bleibt die
       * Kennung, und DAS ist die ehrliche Antwort: „nicht für dich" und nicht
       * „namenlos".
       */
      if (ring === null || graph === null) return;

      const read = await namesInArea(ring, graph, area.areaId, found.map((m) => m.roleId));

      /*
       * UND DIE NAMEN, DIE MENSCHEN IN DIESEM BEREICH TRAGEN (0052) — auch
       * die aus anderen Konten, versiegelt unter dem Schlüssel des Bereichs.
       * Ohne sie stünde hier für jeden Fremden nur die halbe Kennung.
       */
      try {
        const sealed = (await loadAreaNames(area.areaId)).names;
        const open = await openNames(await areaKeys(ring, area.areaId), area.areaId, sealed);
        for (const [roleId, name] of open) if (!read.has(roleId)) read.set(roleId, { name, also: null });
      } catch {
        // Ohne Schlüssel oder ohne Namen — dann eben die Kennung.
      }

      if (!dropped) setNames(read);
    })();

    return () => { dropped = true; };
  }, [tab, area.areaId, ring, graph]);

  const parent = area.parentAreaId === null
    ? null
    : areas.find((a) => a.areaId === area.parentAreaId) ?? null;

  /**
   * Den Bereich nach aussen öffnen oder schliessen.
   *
   * <b>Der Schlüssel kommt aus der EIGENEN Zuteilung</b> und liegt nirgends
   * zwischen. Beim Schliessen wird keiner gebraucht: es wird einer weggenommen.
   */
  const openTo = async (level: PublicLevel) => {
    if (level === 'none') {
      await setPublicLevel(area.areaId, level);
      return;
    }

    if (ring === null) throw new WorkspaceError(t('areas.page.openNeedsPassword'));

    const keys = await myEpochKeys(ring, area.areaId);
    const key = keys.get(area.currentEpoch);

    if (key === undefined) {
      throw new WorkspaceError(t('areas.page.noEpochKey'));
    }

    await setPublicLevel(area.areaId, level, key);
  };

  const mine = area.myLevel === 'admin';

  return (
    <>
      {/*
        2026-10-16 — EIN KOPF, VIER REITER. Vorher: ein Auswahlfeld „Sposób
        wyświetlania" zwischen einem Widok obszaru und den Einzelheiten, darüber
        eine Reihe Angaben (Epoka, Twoje klucze …). Jetzt: Name, eine Zeile, wer
        man hier ist, „Udostępnij" — und Przegląd · Osoby · Dostęp · Ustawienia.
      */}
      <PageHeader
        title={area.name}
        badge={area.personal === true ? <span className="wk-tag">{t('areas.page.private')}</span>
          : area.publicLevel !== 'none' ? <span className="wk-tag wk-tag-open">{area.publicLevel === 'read' ? t('areas.page.anyoneReads') : t('areas.page.anyoneWrites')}</span>
          : undefined}
        meta={<>
          {area.myLevel === null ? '' : t('areas.page.you', { level: LEVEL_NAME[area.myLevel] })}
          {parent !== null && <> · {t('areas.page.inside')} <a href={viewPath('areas', parent.areaId)}>{parent.name}</a></>}
        </>}
        actions={area.mayCertify && area.personal !== true ? (
          <ShareButton who={who} label={t('areas.page.share')} className="wk-btn"
            target={{ title: area.name, aim: null, areaIds: [area.areaId] }} />
        ) : undefined}
      />

      {/* 0137 — ein Bereich einer Wspólnota sagt, wer ihn einstellt, und führt dorthin. */}
      {area.personal !== true && <ManagedBy areaId={area.areaId} ring={ring} />}

      {/*
        „TYLKO JA" (0054): der eigene Bereich nimmt niemanden auf und öffnet
        sich nicht — also stehen hier auch keine Reiter, die es versprächen.
      */}
      {area.personal === true ? (
        <p className="wk-note">
          {t('areas.page.privateNote')}
        </p>
      ) : null}

      {/* 0126 — auch der eigene Bereich hält Bibliothek und Skryptorium: sein Link für eine KI steht gleich hier. */}
      {area.personal === true && tab !== 'ustawienia' && <AiAccessPanel area={area} ring={ring} />}

      {area.personal === true ? null : (
        <nav className="wk-tabs" aria-label={area.name}>
          {tabs.map((one) => (
            <a key={one.id} className={tab === one.id ? 'wk-tab wk-tab-on' : 'wk-tab'} aria-current={tab === one.id ? 'page' : undefined}
              href={one.id === 'przeglad' ? viewPath('areas', area.areaId) : viewPath('areas', area.areaId, one.id)} data-area-tab={one.id}>
              {one.label}
            </a>
          ))}
        </nav>
      )}

      {/* -- 0133: die Art — Wizytówka, was fehlt, Werkzeuge -- */}
      {area.personal !== true && tab === 'profil' && (
        <div className="wk-narrow ui-page">
          {kindFailed ? <p className="wk-error">{t('areas.page.kindFailed')}</p>
            : kindState === null ? <Loading lines={3} />
            : profile === null ? (
              <p className="wk-note">
                {t('areas.page.noKind')} <a className="wk-link" href={viewPath('areas', area.areaId, 'ustawienia')}>{t('areas.page.setKind')}</a>
                {kindState.admin ? t('areas.page.orImport') : '.'}
              </p>
            ) : (
              <AreaKindPanel who={who} area={area} areas={areas} ring={ring} state={kindState} profile={profile} onChanged={kindChanged} withJson={!jsonHere} />
            )}
          {jsonHere && kindState?.admin === true && (
            <section className="wk-kind-sec" aria-labelledby="area-json-h">
              <h2 className="wk-h2" id="area-json-h">{t('areas.page.jsonTitle')}</h2>
              <AreaJsonPanel area={area} ring={ring} who={who} onImported={() => kindChanged()} />
            </section>
          )}
        </div>
      )}

      {/* -- Przegląd: was neu ist, Termine, Rozmowy, Formulare, Menschen, Seiten, Zugang -- */}
      {area.personal !== true && tab === 'przeglad' && <AreaOverview who={who} desk={desk} area={area} />}

      {/* -- Ustawienia: Administrator danych (2026-10-17: EINE Stelle für alle Formulare), Rozmowa, Klucze -- */}
      {tab === 'ustawienia' && (
        <div className="wk-narrow ui-page">
          <section aria-labelledby="area-controller-h">
            <h2 className="wk-h2" id="area-controller-h">{t('areas.page.controller')}</h2>
            <AreaControllerSettings areaId={area.areaId} areaName={area.name} editable={area.myLevel === 'admin'} ring={ring} />
          </section>

          {/* 0133 — die Art des Bereichs: Zwykły obszar, Wydarzenie, Grupa, Parafia, Kurs (ersetzt die Marke „Wydarzenie" von 0131). */}
          {area.personal !== true && (
            <section aria-labelledby="area-kind-h">
              <h2 className="wk-h2" id="area-kind-h">{t('areas.page.kind')}</h2>
              {kindFailed
                ? <p className="wk-error">{t('areas.page.kindFailed')}</p>
                : <AreaKindSetting area={area} areas={areas} state={kindState} onChanged={kindChanged} />}
            </section>
          )}

          <section aria-labelledby="area-chat-h">
            <h2 className="wk-h2" id="area-chat-h">{t('areas.page.chat')}</h2>
            <p className="wk-lede"><AreaChat area={area} ring={ring} busy={busy} onAct={onAct} /></p>
          </section>

          <details className="wk-fold">
            <summary>{t('areas.page.keys')}</summary>
            <dl className="wk-facts">
              <Fact label={t('areas.page.epoch')}>{area.currentEpoch}</Fact>
              <Fact label={t('areas.page.yourKeys')}>{area.heldEpochs}</Fact>
              <Fact label={t('areas.page.youFact')}>
                {area.myLevel === null ? '—' : LEVEL_NAME[area.myLevel]}
                {area.mayCertify && area.myLevel !== 'admin' && <span className="wk-tag">{t('areas.page.youLetIn')}</span>}
              </Fact>
            </dl>
            <p className="wk-hint">{t('areas.page.epochHint')}</p>
          </details>
        </div>
      )}

      {/* -- 0065: Links mit Zugang ------------------------------------- */}

      {area.personal !== true && tab === 'dostep' && area.mayCertify && (
        <div className="wk-panel">
          <h2 className="wk-h2 wk-area-h">{t('areas.page.links')}</h2>
          <AccessLinks ring={ring} self={self} areas={areas} focusAreaId={area.areaId} busy={busy} onAct={onAct} />
        </div>
      )}

      {/* -- 0126: Dostęp dla AI — jedes Mitglied sieht, dass es ihn gibt ------ */}

      {area.personal !== true && tab === 'dostep' && <AiAccessPanel area={area} ring={ring} />}

      {/* -- Wer hier ist ---------------------------------------------- */}

      {area.personal !== true && tab === 'osoby' && (
        <div className="wk-panel">
          {members === null ? (
            <Loading label={t('common.loading')} />
          ) : members.length === 0 ? (
            <p className="wk-empty">{t('areas.page.nobody')}</p>
          ) : (
            <ul className="wk-people">
              {members.map((m) => (
                <li className="wk-person" key={m.roleId}>
                  <span className="wk-person-who">
                    <span className="wk-tag">{KIND_NAME[m.kind]}</span>
                    {names.has(m.roleId) ? (
                      <>
                        <strong>{names.get(m.roleId)?.name}</strong>
                        {names.get(m.roleId)?.also != null && (
                          <span className="wk-person-also">{names.get(m.roleId)?.also}</span>
                        )}
                      </>
                    ) : (
                      <code className="wk-person-id">{m.roleId.slice(0, 8)}</code>
                    )}
                  </span>

                  <span className="wk-person-can">
                    {/* „prowadzi" schliesst „wpuszcza" ein — zweimal dasselbe
                        zu zeigen hiesse, es gäbe einen Unterschied. */}
                    {m.capabilities
                      .filter((c) => c !== 'certify' || !m.capabilities.includes('admin'))
                      .map((c) => (
                        <span className="wk-tag" key={c}>{OTHER_LEVEL[c] ?? c}</span>
                      ))}
                    <Until iso={memberUntil(m.expires)} />
                  </span>

                  {area.mayCertify && (
                    <button
                      type="button" className="wk-link-btn" disabled={busy}
                      onClick={() => void onAct(t('areas.page.removing'), async () => {
                        const out = await dropFromArea(area.areaId, m.roleId);
                        setNote(out.note);
                        setMembers((was) => (was ?? []).filter((x) => x.roleId !== m.roleId));
                      })}
                    >
                      {t('common.remove')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/*
            HIER STAND DIE VORAUSSETZUNG DER VERSCHACHTELUNG — „wejść tu może
            tylko ktoś, kto jest już w …". Sie ist gefallen: jeder Bereich hat
            seine eigenen Rollen, und wer innen steht, muss aussen nicht stehen.
          */}
          {note !== null && <p className="wk-note">{note}</p>}

          {/* 2026-10-22 — Dostęp się przedłuża sam; gdy to nie wychodzi albo termin jest blisko, mówimy to wprost. */}
          {renewError !== null && (
            <p className="wk-warn">
              {t('areas.page.renewError', { error: renewError })}
              {area.mayCertify ? ` ${t('areas.page.renewRetry')}` : ''}
            </p>
          )}
          {members !== null && ring !== null && members.some((m) => ring.has(m.roleId) && (() => { const u = memberUntil(m.expires); return u !== null && daysLeft(u) < WARN_BEFORE_DAYS; })()) && (
            <p className="wk-warn">
              {t('areas.page.expiresSoon')}
            </p>
          )}

          {area.mayCertify && ring !== null && graph !== null && members !== null && (
            <AddRole
              area={area}
              ring={ring}
              graph={graph}
              self={self}
              members={members}
              names={names}
              busy={busy}
              onAct={onAct}
            />
          )}
        </div>
      )}

      {/* -- Wer über ein Formular hereinkommt -------------------------- */}

      {area.personal !== true && tab === 'dostep' && (
        <div className="wk-panel">
          <h2 className="wk-h2 wk-area-h">{t('areas.page.seats')}</h2>
          {mine ? (
            <Segment
              now={area.seatLevel}
              options={SEAT_LEVELS.map((level) => ({
                value: level,
                label: level === 'own' ? t('areas.page.seatOwn')
                  : level === 'read' ? t('areas.page.seatRead')
                  : t('areas.page.seatWrite')
              }))}
              busy={busy}
              onPick={(level) => void onAct(t('areas.page.changingAccess'), () => setSeatLevel(area.areaId, level))}
            />
          ) : (
            <p className="wk-empty">{t('areas.page.leaderControls')}</p>
          )}

          <p className="wk-hint">{t('areas.page.seatHint')}</p>

          {/*
            HIER STANDEN DIE PLÄTZE — und das Ausstellen von Hand.

            Es war dieselbe Sache zweimal: wer ein Formular führt, sieht
            jede Einsendung mitsamt Namen, Antworten und Link an einer
            Stelle (`FormOffice`). Der Knopf hier erzeugte daneben einen
            Platz OHNE Einsendung — einen, den danach nur eine zweite Liste
            wiederfand.

            Was an dieser Stelle bleibt, ist die Einstellung darüber: WIE
            VIEL so jemand ausser seinem Eigenen sieht. Das ist eine
            Eigenschaft des Bereichs und gehört nirgendwo sonst hin.
          */}
        </div>
      )}

      {/* -- Nach aussen ------------------------------------------------ */}

      {area.personal !== true && tab === 'dostep' && (
        <div className="wk-panel">
          <h2 className="wk-h2 wk-area-h">{t('areas.page.public')}</h2>
          {mine ? (
            <Segment
              now={area.publicLevel}
              options={PUBLIC_LEVELS.map((level) => ({
                value: level,
                label: level === 'none' ? t('areas.page.publicNone')
                  : level === 'read' ? t('areas.page.publicRead')
                  : t('areas.page.publicWrite')
              }))}
              busy={busy || ring === null}
              onPick={(level) => void onAct(t('areas.page.changingPublic'), () => openTo(level))}
            />
          ) : (
            <p className="wk-empty">{t('areas.page.leaderControls')}</p>
          )}

          {/*
            DER EINE SATZ, DER BLEIBEN MUSS. Hier standen vier Zeilen über
            Epochenschlüssel; darin ging unter, was wirklich zählt — und das
            steht jetzt allein da, und nur dann, wenn es etwas zu verlieren gibt.
          */}
          {area.publicLevel !== 'none' && (
            <p className="wk-warn">
              {t('areas.page.closeWarn')}
            </p>
          )}
          {/* 2026-10-22 (Schritt 8) — was „jawny" für die Bibliotheken und Bazy wiedzy des Bereichs heisst. */}
          <p className="wk-note">
            {area.publicLevel === 'none' ? t('areas.page.publicNoteWhen') : t('areas.page.publicNoteNow')}
          </p>
        </div>
      )}
    </>
  );
}

/**
 * ROZMOWY TEGO OBSZARU (0052) — dieselben Menschen, dieselben Schlüssel. Wer
 * hier hineinkommt, ist in der Rozmowa; wer dort hinzugefügt wird, steht hier.
 *
 * 0080 — zwei nebeneinander: die Rozmowa, in der alle schreiben, und der
 * Kanał, in dem die Schreibenden schreiben und die anderen lesen. Die mit
 * einzelnen Menschen aus Formularen stehen in „Rozmowy", nicht hier.
 */
function AreaChat({ area, ring, busy, onAct }: {
  area: AreaRow;
  ring: Ring | null;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useT();
  const [chats, setChats] = useState<readonly ChatRow[] | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void loadChats()
      .then((found) => { if (alive) setChats(found.chats.filter((c) => c.areaId === area.areaId)); })
      .catch(() => { if (alive) setChats([]); });
    return () => { alive = false; };
  }, [area.areaId]);

  if (chats === undefined) return <>…</>;

  /* Ein eigener Bereich einer Gruppe, eines Gesprächs zu zweit, der Notatki: er IST die Rozmowa. */
  const own = chats.find((c) => c.kind === 'group' || c.kind === 'direct' || c.kind === 'self');
  if (own !== undefined) return <a className="wk-crumb-link" href={viewPath('chat', own.chatId)}>{t('common.open')}</a>;

  const mayStart = ring !== null && (area.myLevel === 'write' || area.myLevel === 'admin');
  const one = (kind: 'area' | 'channel', label: string) => {
    const had = chats.find((c) => c.kind === kind);
    if (had !== undefined) return <a key={kind} className="wk-crumb-link" href={viewPath('chat', had.chatId)}>{label}</a>;
    if (!mayStart || ring === null) return null;
    return (
      <button key={kind} type="button" className="wk-link-btn" disabled={busy}
        onClick={() => void onAct(kind === 'channel' ? t('areas.page.creatingChannel') : t('areas.page.creatingChat'), async () => {
          const { members } = await loadMembers(area.areaId);
          /* Welche MEINER Rollen hier schreibt — sie legt die Rozmowa an. */
          const writer = members.find((m) => ring.has(m.roleId) && (m.capabilities.includes('write') || m.capabilities.includes('admin')));
          if (writer === undefined) throw new WorkspaceError(t('areas.page.noWriter'));
          const made = await startAreaChat(area.areaId, writer.roleId, kind === 'channel');
          window.location.hash = viewPath('chat', made);
        })}>
        {kind === 'channel' ? t('areas.page.startChannel') : t('areas.page.startChat')}
      </button>
    );
  };

  const shown = [one('area', t('areas.page.chatLink')), one('channel', t('areas.page.channelLink'))].filter((x) => x !== null);
  if (shown.length === 0) return <>—</>;
  return <>{shown.map((x, i) => <span key={i}>{i > 0 ? ' · ' : ''}{x}</span>)}</>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="wk-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
