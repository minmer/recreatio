/**
 * Ein Bereich: Przegląd · Osoby · Dostęp · Ustawienia, und seine Rozmowa.
 */

import { useEffect, useState } from 'react';

import { type ChatRow, areaKeys, loadAreaNames, loadChats, openNames, startAreaChat } from '../chat/chat';
import type { Ring, SealedRole } from '../core/keys';
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
import { daysLeft, memberUntil, noteRenewal, RENEW_BEFORE_DAYS, renewalFailure, renewArea, WARN_BEFORE_DAYS } from './renew';
import { AREA_TABS, type AreaTab, KIND_NAME, LEVEL_NAME, OTHER_LEVEL } from './areaWords';

/* -- Ein Bereich, ganz ------------------------------------------------------ */

/** 0126 — Dostęp dla AI: erst geladen, wenn die Karte offen ist. */
const AiAccessPanel = later(() => import('../aiAccess/AiAccessPanel').then((m) => m.AiAccessPanel));

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
  if (iso === null) return null;
  const left = daysLeft(iso);
  const date = new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <span className={left < WARN_BEFORE_DAYS ? 'wk-person-until is-soon' : 'wk-person-until'} title="Dostęp przedłuża się sam rok przed tym terminem">
      do {date}
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
  const [members, setMembers] = useState<readonly Member[] | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, Called>>(new Map());
  const [note, setNote] = useState<string | null>(null);
  /* 2026-10-22 — was beim Erneuern nicht ging (hier oder zuletzt im Hintergrund). */
  const [renewError, setRenewError] = useState<string | null>(() => renewalFailure(area.areaId)?.message ?? null);

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
          const message = e instanceof WorkspaceError ? e.message : 'Nie udało się przedłużyć dostępu.';
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

    if (ring === null) throw new WorkspaceError('Bez hasła nie otworzysz obszaru.');

    const keys = await myEpochKeys(ring, area.areaId);
    const key = keys.get(area.currentEpoch);

    if (key === undefined) {
      throw new WorkspaceError('Nie masz klucza tej epoki — nie możesz jej otworzyć.');
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
        badge={area.personal === true ? <span className="wk-tag">prywatny</span>
          : area.publicLevel !== 'none' ? <span className="wk-tag wk-tag-open">{area.publicLevel === 'read' ? 'każdy czyta' : 'każdy pisze'}</span>
          : undefined}
        meta={<>
          {area.myLevel === null ? '' : `Ty: ${LEVEL_NAME[area.myLevel]}`}
          {parent !== null && <> · wewnątrz: <a href={viewPath('areas', parent.areaId)}>{parent.name}</a></>}
        </>}
        actions={area.mayCertify && area.personal !== true ? (
          <ShareButton who={who} label="Udostępnij" className="wk-btn"
            target={{ title: area.name, aim: null, areaIds: [area.areaId] }} />
        ) : undefined}
      />

      {/*
        „TYLKO JA" (0054): der eigene Bereich nimmt niemanden auf und öffnet
        sich nicht — also stehen hier auch keine Reiter, die es versprächen.
      */}
      {area.personal === true ? (
        <p className="wk-note">
          To Twoja prywatna przestrzeń: terminy i zadania zapisane jako „Tylko ja" widzisz tylko Ty.
          Nikogo tu nie dodasz i nie otworzysz jej dla innych — żeby coś pokazać innym, wybierz ich grupę.
        </p>
      ) : null}

      {/* 0126 — auch der eigene Bereich hält Bibliothek und Skryptorium: sein Link für eine KI steht gleich hier. */}
      {area.personal === true && tab !== 'ustawienia' && <AiAccessPanel area={area} ring={ring} />}

      {area.personal === true ? null : (
        <nav className="wk-tabs" aria-label={area.name}>
          {AREA_TABS.map((one) => (
            <a key={one.id} className={tab === one.id ? 'wk-tab wk-tab-on' : 'wk-tab'} aria-current={tab === one.id ? 'page' : undefined}
              href={one.id === 'przeglad' ? viewPath('areas', area.areaId) : viewPath('areas', area.areaId, one.id)} data-area-tab={one.id}>
              {one.label}
            </a>
          ))}
        </nav>
      )}

      {/* -- Przegląd: was neu ist, Termine, Rozmowy, Formulare, Menschen, Seiten, Zugang -- */}
      {area.personal !== true && tab === 'przeglad' && <AreaOverview who={who} desk={desk} area={area} />}

      {/* -- Ustawienia: Administrator danych (2026-10-17: EINE Stelle für alle Formulare), Rozmowa, Klucze -- */}
      {tab === 'ustawienia' && (
        <div className="wk-narrow ui-page">
          <section aria-labelledby="area-controller-h">
            <h2 className="wk-h2" id="area-controller-h">Administrator danych</h2>
            <p className="wk-hint">Stoi pod każdym formularzem tego obszaru i obszarów w nim, zanim ktoś coś wpisze.</p>
            <AreaControllerSettings areaId={area.areaId} editable={area.myLevel === 'admin'} />
          </section>

          <section aria-labelledby="area-chat-h">
            <h2 className="wk-h2" id="area-chat-h">Rozmowa obszaru</h2>
            <p className="wk-lede"><AreaChat area={area} ring={ring} busy={busy} onAct={onAct} /></p>
          </section>

          <details className="wk-fold">
            <summary>Klucze tego obszaru</summary>
            <dl className="wk-facts">
              <Fact label="Epoka">{area.currentEpoch}</Fact>
              <Fact label="Twoje klucze">{area.heldEpochs}</Fact>
              <Fact label="Ty">
                {area.myLevel === null ? '—' : LEVEL_NAME[area.myLevel]}
                {area.mayCertify && area.myLevel !== 'admin' && <span className="wk-tag">wpuszczasz</span>}
              </Fact>
            </dl>
            <p className="wk-hint">Nowa epoka zaczyna się, gdy ktoś traci dostęp — od niej nie przeczyta już nowych treści.</p>
          </details>
        </div>
      )}

      {/* -- 0065: Links mit Zugang ------------------------------------- */}

      {area.personal !== true && tab === 'dostep' && area.mayCertify && (
        <div className="wk-panel">
          <h2 className="wk-h2" style={{ marginTop: 0 }}>Linki z dostępem</h2>
          <AccessLinks ring={ring} self={self} areas={areas} focusAreaId={area.areaId} busy={busy} onAct={onAct} />
        </div>
      )}

      {/* -- 0126: Dostęp dla AI — jedes Mitglied sieht, dass es ihn gibt ------ */}

      {area.personal !== true && tab === 'dostep' && <AiAccessPanel area={area} ring={ring} />}

      {/* -- Wer hier ist ---------------------------------------------- */}

      {area.personal !== true && tab === 'osoby' && (
        <div className="wk-panel">
          {members === null ? (
            <Loading label="Wczytywanie…" />
          ) : members.length === 0 ? (
            <p className="wk-empty">Nikogo tu jeszcze nie ma.</p>
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
                      onClick={() => void onAct('Usuwanie…', async () => {
                        const out = await dropFromArea(area.areaId, m.roleId);
                        setNote(out.note);
                        setMembers((was) => (was ?? []).filter((x) => x.roleId !== m.roleId));
                      })}
                    >
                      Usuń
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
              Nie udało się przedłużyć dostępu w tym obszarze: {renewError}
              {area.mayCertify ? ' Spróbuj jeszcze raz, otwierając tę kartę ponownie.' : ''}
            </p>
          )}
          {members !== null && ring !== null && members.some((m) => ring.has(m.roleId) && (() => { const u = memberUntil(m.expires); return u !== null && daysLeft(u) < WARN_BEFORE_DAYS; })()) && (
            <p className="wk-warn">
              Twój dostęp do tego obszaru niedługo wygasa i nikt go jeszcze nie przedłużył. Przedłuża go automatycznie każdy, kto może tu wpuszczać, gdy otworzy aplikację — poproś prowadzącego, żeby ją otworzył.
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
          <h2 className="wk-h2" style={{ marginTop: 0 }}>Osoby z formularzy</h2>
          {mine ? (
            <Segment
              now={area.seatLevel}
              options={SEAT_LEVELS.map((level) => ({
                value: level,
                label: level === 'own' ? 'Tylko swoje'
                  : level === 'read' ? 'Czyta wspólne'
                  : 'Czyta i pisze wspólne'
              }))}
              busy={busy}
              onPick={(level) => void onAct('Zmiana dostępu…', () => setSeatLevel(area.areaId, level))}
            />
          ) : (
            <p className="wk-empty">Tym steruje ten, kto prowadzi obszar.</p>
          )}

          <p className="wk-hint">Swoje zgłoszenie taka osoba widzi zawsze.</p>

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
          <h2 className="wk-h2" style={{ marginTop: 0 }}>Dla wszystkich</h2>
          {mine ? (
            <Segment
              now={area.publicLevel}
              options={PUBLIC_LEVELS.map((level) => ({
                value: level,
                label: level === 'none' ? 'Zamknięty'
                  : level === 'read' ? 'Każdy czyta'
                  : 'Każdy czyta i pisze'
              }))}
              busy={busy || ring === null}
              onPick={(level) => void onAct('Zmiana jawności…', () => openTo(level))}
            />
          ) : (
            <p className="wk-empty">Tym steruje ten, kto prowadzi obszar.</p>
          )}

          {/*
            DER EINE SATZ, DER BLEIBEN MUSS. Hier standen vier Zeilen über
            Epochenschlüssel; darin ging unter, was wirklich zählt — und das
            steht jetzt allein da, und nur dann, wenn es etwas zu verlieren gibt.
          */}
          {area.publicLevel !== 'none' && (
            <p className="wk-warn">
              Zamknięcie nie odbiera klucza tym, którzy już go sobie zapisali.
            </p>
          )}
          {/* 2026-10-22 (Schritt 8) — was „jawny" für die Bibliotheken und Bazy wiedzy des Bereichs heisst. */}
          <p className="wk-note">
            {area.publicLevel === 'none' ? 'Gdy obszar stanie się jawny, każdy przeczyta' : 'Każdy czyta'} jego biblioteki i bazy wiedzy (te już otwarte) —
            bazy wiedzy w całości: wpisy, pytania razem z odpowiedziami, szkice, powtórki i przebiegi.
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
  if (own !== undefined) return <a className="wk-crumb-link" href={viewPath('chat', own.chatId)}>Otwórz</a>;

  const mayStart = ring !== null && (area.myLevel === 'write' || area.myLevel === 'admin');
  const one = (kind: 'area' | 'channel', label: string) => {
    const had = chats.find((c) => c.kind === kind);
    if (had !== undefined) return <a key={kind} className="wk-crumb-link" href={viewPath('chat', had.chatId)}>{label}</a>;
    if (!mayStart || ring === null) return null;
    return (
      <button key={kind} type="button" className="wk-link-btn" disabled={busy}
        onClick={() => void onAct(kind === 'channel' ? 'Zakładanie kanału…' : 'Zakładanie rozmowy…', async () => {
          const { members } = await loadMembers(area.areaId);
          /* Welche MEINER Rollen hier schreibt — sie legt die Rozmowa an. */
          const writer = members.find((m) => ring.has(m.roleId) && (m.capabilities.includes('write') || m.capabilities.includes('admin')));
          if (writer === undefined) throw new WorkspaceError('Żadna z Twoich ról nie pisze w tym obszarze.');
          const made = await startAreaChat(area.areaId, writer.roleId, kind === 'channel');
          window.location.hash = viewPath('chat', made);
        })}>
        Załóż: {label.toLowerCase()}
      </button>
    );
  };

  const shown = [one('area', 'Rozmowa'), one('channel', 'Kanał')].filter((x) => x !== null);
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
