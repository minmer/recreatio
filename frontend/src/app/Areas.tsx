/**
 * Obszary — die Schlüssel und wer an ihnen steht.
 *
 * <b>Drei Achsen, und diese ist die erste.</b> Ein Bereich ist ein benannter
 * Schlüssel; Rollen halten ihn, Seiten zeigen, was unter ihm liegt. Keine der
 * drei besitzt eine andere — deshalb steht diese Ansicht neben Rollen und
 * Seiten und nicht in einer von beiden.
 *
 * <b>Drei Bilder, nicht eines.</b> Die Liste, ein einzelner Bereich, und das
 * Anlegen — alle drei sind Adressen, und der Weg dorthin steht oben im Kopf.
 *
 * <b>Was hier NICHT mehr steht: die Erklärung.</b> Auf dieser Seite standen
 * fünf Absätze darüber, was ein Bereich ist, wie ein Epochenschlüssel entsteht
 * und warum es zwei Zeugnisse braucht. Wer hier ankommt, will einen Bereich
 * öffnen oder anlegen — er liest das nicht, und was er wirklich wissen muss
 * (dass ein geschlossener Bereich niemandem zurücknimmt, was er sich schon
 * abgeschrieben hat) ging darin unter. Jetzt steht ein Satz da, an der Stelle,
 * an der er gilt.
 *
 * <b>Und der Zustand steht nicht mehr in Prosa.</b> „epoka 3 · masz 2 ·
 * prowadzisz · wpuszczasz" war eine Zeile, die man lesen musste, um vier
 * Angaben zu erfahren. Vier Felder sagen dasselbe auf einen Blick.
 *
 * <b>Ohne Passwort sind die Schlüssel fort.</b> Nach einem Neuladen liegt der
 * PasswordKey nicht mehr im Tab (`session.ts`), und ohne ihn lässt sich nichts
 * unterschreiben und nichts auspacken. Die Ansicht fragt dann danach —
 * angemeldet bleibt man dabei.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  besideIt, chainTo, createArea, dropFromArea, inOrder, joinArea, loadAreas, loadMembers, myEpochKeys,
  setPublicLevel, setSeatLevel,
  PUBLIC_LEVELS, SEAT_LEVELS, type AreaRow, type Member, type PublicLevel
} from './area';
import { namesInArea, type Called } from './called';
import {
  areaKeys, loadAreaNames, loadChats, looksLikeCode, openNames, roleCard, setMemberName, startAreaChat, type ChatRow
} from './chat';
import { useCrumbs, type Crumb } from './crumbTrail';
import type { Ring, SealedRole } from './keys';
import { keysFor, forgetKeys } from './ringOf';
import { createRole, loadRoles, selfOf, type RoleGraphData } from './roles';
import { viewPath } from './routes';
import { WorkspaceError, type Who } from './session';
import { Unlock } from './Unlock';
import { AreaOptions } from './AreaOptions';
import { useTouched } from './Recent';
import { AccessLinks } from './AccessLinks';
import type { Desk } from './desk';
import { ShareButton } from './Share';
import { AreaOverview } from './WorkspaceHome';
import { AreaControllerSettings } from './AreaController';
import { Loading } from './ui/Loading';
import { Icon } from './ui/icons';
import { PageHeader } from './ui/PageHeader';
import { Segment } from './ui/Segment';

/**
 * Die Stufen in der Sprache, die im Haus gesprochen wird.
 *
 * <b>Kein `certify` darunter.</b> Es steht neben der Leiter (3.5) und heisst
 * etwas ganz anderes — „darf hineinlassen", nicht „darf mehr". In dieselbe
 * Liste gesetzt läse es sich als vierte Stufe, und genau der Fall, für den es
 * gedacht ist, ginge verloren. `admin` schliesst es ein: wer „prowadzi",
 * lässt auch hinein — und muss es deshalb nicht eigens dastehen haben.
 */
const LEVEL_NAME: Record<'read' | 'write' | 'admin', string> = {
  read: 'czytasz',
  write: 'piszesz',
  admin: 'prowadzisz'
};

/** Dieselben Wörter, aber über jemand anderen gesagt. */
const OTHER_LEVEL: Record<string, string> = {
  read: 'czyta',
  write: 'pisze',
  admin: 'prowadzi',
  certify: 'wpuszcza'
};

const KIND_NAME: Record<Member['kind'], string> = {
  account: 'Konto',
  person: 'Osoba',
  group: 'Grupa',
  role: 'Rola'
};

/**
 * Welches der drei Bilder gerade dasteht — und zwar AUS DER ADRESSE.
 *
 * <b>`#/workspace/areas` ist die Liste, `#/workspace/areas/<kennung>` ein
 * Bereich, `#/workspace/areas/new` das Anlegen.</b> Als Zustand im Speicher
 * liess sich ein aufgeschlagener Bereich nicht verschicken, ein Neuladen warf
 * einen heraus, und der Zurück-Pfeil des Browsers verliess den Arbeitsplatz,
 * statt den Bereich zu schliessen.
 *
 * <b>`new` kann keine Kennung sein.</b> Kennungen sind UUIDs; das Wort ist
 * damit frei und muss nicht gesperrt werden.
 */
/** 2026-10-16 — die Reiter eines Bereichs, als Adresse: `areas/<kennung>/osoby`. */
type AreaTab = 'przeglad' | 'osoby' | 'dostep' | 'ustawienia';

const AREA_TABS: readonly { readonly id: AreaTab; readonly label: string }[] = [
  { id: 'przeglad', label: 'Przegląd' },
  { id: 'osoby', label: 'Osoby' },
  { id: 'dostep', label: 'Dostęp' },
  { id: 'ustawienia', label: 'Ustawienia' }
];

const tabOf = (word: string | undefined): AreaTab =>
  AREA_TABS.find((one) => one.id === word)?.id ?? 'przeglad';

type View =
  | { readonly at: 'list' }
  | { readonly at: 'area'; readonly areaId: string; readonly tab: AreaTab }
  | { readonly at: 'new' };

const NEW = 'new';

const viewOf = (trail: readonly string[]): View =>
  trail[0] === undefined ? { at: 'list' }
  : trail[0] === NEW ? { at: NEW }
  : { at: 'area', areaId: trail[0], tab: tabOf(trail[1]) };

export function Areas({ who, trail, desk }: { who: Who; trail: readonly string[]; desk: Desk }) {
  /* 0094 — einfach: der Widok obszaru; erweitert: die Einzelheiten (Schlüssel, Rollen, Stufen). */
  const [areas, setAreas] = useState<readonly AreaRow[] | null | undefined>(undefined);
  const [ring, setRing] = useState<Ring | null>(null);
  const [person, setPerson] = useState<SealedRole | null>(null);
  const [graph, setGraph] = useState<RoleGraphData | null>(null);
  const view = viewOf(trail);

  /* 0054 — was offen ist, kommt in „Ostatnio" nach vorn (gemerkt versiegelt). */
  useTouched('areas', view.at === 'area' ? view.areaId : null);

  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      const { ring: bund, graph } = await keysFor(who);

      setRing(bund);
      setGraph(graph);
      // Die eigene PERSON hält einen neuen Bereich, nicht das Konto (0040).
      setPerson(selfOf(graph));
      setAreas((await loadAreas()).areas);
      setFailed(null);
    } catch (e) {
      setAreas(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać obszarów.');
    }
  }, [who]);

  useEffect(() => { void look(); }, [look]);

  /*
   * DER WEG OBEN IM KOPF.
   *
   * In der Adresse steht eine Kennung; ein Mensch liest darin nichts. Was
   * dort stehen soll, ist „Parafia › Schola" — und das weiss nur diese
   * Ansicht, weil sie die Bereiche ohnehin geladen hat.
   *
   * <b>Jede Stufe nimmt ihre Geschwister mit.</b> Wer in einem Unterbereich
   * steht, will meistens in den daneben; hinauf und wieder hinunter sind zwei
   * Klicks für etwas, das einer sein sollte.
   */
  const list = areas ?? [];

  const crumbs: Crumb[] = view.at === NEW
    ? [{ label: 'Nowy obszar', href: null }]
    : view.at === 'area'
      ? chainTo(list, view.areaId).map((step) => ({
          label: step.name,
          href: viewPath('areas', step.areaId),
          beside: besideIt(list, step)
            .map((other) => ({ label: other.name, href: viewPath('areas', other.areaId) }))
        }))
      : [];

  useCrumbs(crumbs);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);

    try {
      await todo();
      forgetKeys();
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  if (areas === undefined) return <Loading />;

  if (areas === null) {
    return (
      <>
        <p className="wk-error">{failed}</p>
        <p><button type="button" className="wk-btn" onClick={() => void look()}>Spróbuj ponownie</button></p>
      </>
    );
  }

  /*
   * Der geöffnete Bereich, frisch aus der Liste geholt. NICHT beim Öffnen
   * weggelegt: nach einer Änderung stünde sonst der alte Stand da, und man
   * sähe seine eigene Änderung nicht.
   */
  const shown = view.at === 'area'
    ? areas.find((a) => a.areaId === view.areaId) ?? null
    : null;

  const head = (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-working">{busy}</p>}

      {ring === null && (
        <Unlock who={who} why="Bez hasła nie otworzysz klucza." onDone={() => void look()} />
      )}
    </>
  );

  /* -- Ein einzelner Bereich, ganz ----------------------------------------- */

  if (view.at === 'area') {
    if (shown === null) {
      /* Weggefallen, während er offen war. */
      return <p className="wk-empty">Tego obszaru już nie ma.</p>;
    }

    return (
      <>
        {head}
        <AreaPage
          who={who}
          desk={desk}
          tab={shown.personal === true ? 'ustawienia' : view.tab}
          area={shown}
          areas={areas}
          ring={ring}
          graph={graph}
          self={person}
          busy={busy !== null}
          onAct={act}
        />
      </>
    );
  }

  /* -- Anlegen, ganz ------------------------------------------------------- */

  if (view.at === 'new') {
    return (
      <>
        {head}
        <NewArea
          ring={ring}
          person={person}
          areas={areas}
          busy={busy !== null}
          onAct={act}
          onDone={() => { window.location.hash = viewPath('areas'); }}
        />
      </>
    );
  }

  /* -- Die Liste ----------------------------------------------------------- */

  return (
    <>
      {/* 2026-10-17 — der eigene Kopf: „+ Nowy obszar" ist die eine Handlung dieser Seite. */}
      <PageHeader title="Obszary" actions={<a className="wk-btn" href={viewPath('areas', NEW)}><Icon name="plus" />Nowy obszar</a>} />
      {head}

      {/*
        DIE TIEFE STEHT AN DER ZEILE, nicht im Markup. Verschachtelte Listen
        wären eine zweite Struktur neben `parent_area_id`, und zwei Strukturen
        laufen auseinander.
      */}
      {areas.length > 0 && (
        <ul className="wk-box wk-area-list">
          {inOrder(areas).map(({ area, depth }) => (
            <li key={area.areaId}>
              <a className="wk-line" href={viewPath('areas', area.areaId)} style={{ '--depth': depth } as React.CSSProperties}>
                <span className="wk-line-ic"><Icon name={area.personal === true ? 'lock' : 'layers'} /></span>
                <span className="wk-line-text">
                  <span className="wk-line-title">{area.personal === true ? 'Tylko Ty (prywatny)' : area.name}</span>
                  <span className="wk-line-sub">{area.myLevel !== null ? LEVEL_NAME[area.myLevel] : 'bez dostępu'}</span>
                </span>
                <span className="wk-line-end"><Tags area={area} /><Icon name="next" /></span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {areas.length === 0 && (
        <p className="wk-empty">Obszar to klucz. Bez niego nie ma gdzie niczego zamknąć.</p>
      )}

      {/*
        0065 — LINKI DOSTĘPU über alle Bereiche: ein Link kann mehrere öffnen.
        Nur, wenn ich irgendwo hineinlassen darf.
      */}
      {areas.some((a) => a.mayCertify && a.personal !== true) && (
        <details className="wk-fold wk-links-all">
          <summary>Linki dostępu</summary>
          <p className="wk-hint">
            Link daje rolę, a rola — dostęp do jej obszarów: od razu w tej przeglądarce, po dodaniu do konta wszędzie.
          </p>
          <AccessLinks ring={ring} self={person} areas={areas} busy={busy !== null} onAct={act} />
        </details>
      )}
    </>
  );
}

/* -- Was an einem Bereich auffällt ----------------------------------------- */

/**
 * Nur, was vom Normalfall ABWEICHT.
 *
 * Ein Plättchen an jeder Zeile wäre keines: stünde „zamknięty" überall, liesse
 * sich das Offene nicht mehr herauslesen. Was dasteht, ist das, was auffallen
 * soll.
 */
function Tags({ area }: { area: AreaRow }) {
  return (
    <span className="wk-tags">
      {area.publicLevel !== 'none' && (
        <span className="wk-tag wk-tag-open" title="Bez konta, dla każdego">
          {area.publicLevel === 'write' ? 'jawny · pisze' : 'jawny'}
        </span>
      )}

      {area.seatLevel !== 'own' && (
        <span className="wk-tag" title="Co widzi osoba z formularza poza swoim">
          formularz: {area.seatLevel === 'write' ? 'pisze' : 'czyta'}
        </span>
      )}
    </span>
  );
}

/* -- Ein Bereich, ganz ------------------------------------------------------ */

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
function AreaPage({ who, desk, tab, area, areas, ring, graph, self, busy, onAct }: {
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

  useEffect(() => {
    if (tab !== 'osoby') return;

    let dropped = false;

    void (async () => {
      let found: readonly Member[] = [];
      try { found = (await loadMembers(area.areaId)).members; } catch { /* leer */ }
      if (dropped) return;

      setMembers(found);

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
      ) : (
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
        </div>
      )}
    </>
  );
}

/* -- Eine Rolle dazunehmen -------------------------------------------------- */

type Level = 'read' | 'write' | 'admin';

/**
 * Eine Rolle in DIESEN Bereich — eine neue oder eine, die ich schon habe.
 *
 * <b>Jeder Bereich hat seine eigenen Rollen.</b> Die übliche Bewegung ist
 * deshalb nicht „such dir aus dem Graphen etwas", sondern „leg hier an, was
 * dieser Bereich braucht" — Katecheci, Animatorzy, Rada. Die neue Rolle hält
 * die eigene Person; wer sie später übernimmt, bekommt sie im Rollengraphen.
 *
 * <b>Unterschrieben von der Rolle, die hier hineinlässt</b> — nicht von
 * irgendeiner meiner Rollen. Das Zertifikat nennt, wer die Tür aufgemacht
 * hat, und das soll dieselbe Rolle sein, die dazu befugt ist.
 */
function AddRole({ area, ring, graph, self, members, names, busy, onAct }: {
  area: AreaRow;
  ring: Ring;
  graph: RoleGraphData;
  self: SealedRole | null;
  members: readonly Member[];
  names: ReadonlyMap<string, Called>;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<'new' | 'mine' | 'code'>('new');
  const [code, setCode] = useState('');
  const [codeName, setCodeName] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'role' | 'group'>('role');
  const [pick, setPick] = useState('');
  const [level, setLevel] = useState<Level>('write');
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    let alive = true;
    void ring.names().then((read) => { if (alive) setLabels(read); });
    return () => { alive = false; };
  }, [ring]);

  const present = new Set(members.map((m) => m.roleId));
  const candidates = graph.roles.filter((r) => !r.isPersonal && ring.has(r.id) && !present.has(r.id));
  const chosen = candidates.find((r) => r.id === pick) ?? candidates[0] ?? null;

  /* Wer hier hineinlässt: `certify`, oder `admin`, das es einschliesst. */
  const issuer = members.find((m) =>
    (m.capabilities.includes('admin') || m.capabilities.includes('certify')) && ring.maySign(m.roleId))?.roleId ?? null;

  const blocker =
    issuer === null ? 'Żadna z Twoich ról nie może tu nikogo wpuścić.'
    : from === 'new' && self === null ? 'Konto nie prowadzi jeszcze żadnej osoby — załóż ją w Rolach.'
    : from === 'new' && name.trim() === '' ? 'Nazwij rolę.'
    : from === 'mine' && chosen === null ? 'Wszystkie Twoje role już tu są.'
    : from === 'code' && !looksLikeCode(code) ? 'Wklej kod do rozmów tej osoby — w całości.'
    : from === 'code' && codeName.trim() === '' ? 'Wpisz, jak ta osoba ma się tu nazywać.'
    : null;

  if (!open) {
    return (
      <button type="button" className="wk-tree-add" disabled={busy} onClick={() => setOpen(true)}>
        <span aria-hidden="true">+</span> Dodaj rolę
      </button>
    );
  }

  const add = async () => {
    if (blocker !== null || issuer === null) return;

    let done = false;

    await onAct(from === 'new' ? 'Liczenie kluczy nowej roli…' : 'Dodawanie…', async () => {
      /*
       * KTOŚ Z INNEGO KONTA — po jego kodzie do rozmów (0052). Dostaje klucz
       * obszaru i zaświadczenie jak każda rola, a nazwa, pod którą go
       * wpisujesz, zostaje zapieczętowana kluczem obszaru.
       */
      if (from === 'code') {
        const card = await roleCard(code);
        if (present.has(card.roleId)) throw new WorkspaceError('Ta osoba już jest w tym obszarze.');
        await joinArea(ring, area.areaId, { id: card.roleId, kind: card.kind, wrapPublicKey: card.wrapPublicKey }, issuer, level);
        await setMemberName(area.areaId, await areaKeys(ring, area.areaId, true), card.roleId, codeName, issuer).catch(() => undefined);
        setCode('');
        setCodeName('');
        done = true;
        return;
      }

      let role: SealedRole;

      if (from === 'new') {
        if (self === null) return;
        const { id } = await createRole(ring, self, { kind, name });
        const made = (await loadRoles()).roles.find((r) => r.id === id);
        if (made === undefined) throw new WorkspaceError('Rola powstała, ale jeszcze jej nie widać — odśwież.');
        role = made;
      } else {
        if (chosen === null) return;
        role = chosen;
      }

      await joinArea(ring, area.areaId, role, issuer, level);
      done = true;
    });

    if (done) {
      setName('');
      setPick('');
      setOpen(false);
    }
  };

  const who = (id: string) => names.get(id)?.name ?? labels.get(id) ?? 'bez nazwy';

  return (
    <form className="wk-form wk-add-role" onSubmit={(e) => { e.preventDefault(); void add(); }}>
      <h3 className="wk-h2">Dodaj rolę</h3>

      <Segment
        now={from}
        options={[
          { value: 'new' as const, label: 'Nowa dla tego obszaru' },
          { value: 'mine' as const, label: 'Jedna z moich' },
          { value: 'code' as const, label: 'Osoba z kodem' }
        ]}
        busy={busy}
        onPick={setFrom}
      />

      {from === 'new' ? (
        <>
          <label className="wk-field">
            <span>Nazwa</span>
            <input value={name} placeholder="np. Katecheci" autoComplete="off"
              onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="wk-field">
            <span>Rodzaj</span>
            <Segment
              now={kind}
              options={[
                { value: 'role' as const, label: 'Rola — funkcja' },
                { value: 'group' as const, label: 'Grupa — ci, którzy należą' }
              ]}
              busy={busy}
              onPick={setKind}
            />
          </div>

          {self !== null && (
            <p className="wk-hint">Prowadzi ją {who(self.id)}. Komu ją przekazać, ustawisz w Rolach.</p>
          )}
        </>
      ) : from === 'code' ? (
        <>
          <label className="wk-field">
            <span>Kod do rozmów tej osoby</span>
            <input value={code} placeholder="np. 01a0…" autoComplete="off" onChange={(e) => setCode(e.target.value)} />
            <span className="wk-hint">Każda osoba ma go u siebie w „Rozmowach". Kod pozwala tylko zaprosić — niczego nie otwiera.</span>
          </label>
          <label className="wk-field">
            <span>Jak ma się tu nazywać</span>
            <input value={codeName} placeholder="np. Anna Nowak" autoComplete="off" onChange={(e) => setCodeName(e.target.value)} />
            <span className="wk-hint">Nazwę widzą tylko osoby z tego obszaru.</span>
          </label>
        </>
      ) : candidates.length > 0 ? (
        <label className="wk-field">
          <span>Rola</span>
          <select value={chosen?.id ?? ''} onChange={(e) => setPick(e.target.value)}>
            {candidates.map((r) => (
              <option key={r.id} value={r.id}>{who(r.id)} · {KIND_NAME[r.kind]}</option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="wk-field">
        <span>Co może w tym obszarze</span>
        <Segment
          now={level}
          options={[
            { value: 'read' as const, label: 'Czyta' },
            { value: 'write' as const, label: 'Pisze' },
            { value: 'admin' as const, label: 'Prowadzi' }
          ]}
          busy={busy}
          onPick={setLevel}
        />
        {level === 'admin' && <span className="wk-hint">Kto prowadzi, może też wpuszczać innych.</span>}
      </div>

      {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || blocker !== null}>Dodaj</button>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setOpen(false)}>Anuluj</button>
      </div>
    </form>
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

/* Eine Stufe aus wenigen — seit 2026-10-17 in `ui/Segment.tsx`; hier weitergereicht für die, die es von hier holen. */
export { Segment };

/* -- Anlegen ---------------------------------------------------------------- */

function NewArea({ ring, person, areas, busy, onAct, onDone }: {
  ring: Ring | null;
  person: SealedRole | null;
  areas: readonly AreaRow[];
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [inside, setInside] = useState('');

  /*
   * NUR DORT, WO ICH PROWADZĘ. Der Dienst verlangt `admin` auf dem äusseren
   * Bereich (0035); eine Auswahl, die mehr anböte, führte zu einem Knopf, der
   * beim Drücken absagt.
   */
  const canNest = areas.filter((a) => a.myLevel === 'admin');

  const blocker =
    busy ? null
    : ring === null ? 'Najpierw podaj hasło.'
    : person === null ? 'Konto nie prowadzi jeszcze żadnej osoby — załóż ją w Rolach.'
    : name.trim() === '' ? 'Nazwij obszar.'
    : null;

  return (
    <form
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (blocker !== null || ring === null || person === null) return;

        void onAct('Zakładanie…',
          () => createArea(ring, person, name, inside === '' ? undefined : inside))
          .then(onDone);
      }}
    >
      <h1 className="wk-h1">Nowy obszar</h1>

      <label className="wk-field">
        <span>Nazwa</span>
        <input
          value={name}
          placeholder="np. Kancelaria"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      {canNest.length > 0 && (
        <label className="wk-field">
          <span>Wewnątrz</span>
          <select value={inside} onChange={(e) => setInside(e.target.value)}>
            <option value="">Nigdzie — osobny obszar</option>
            <AreaOptions areas={areas} only={canNest} />
          </select>
        </label>
      )}

      {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null}>Załóż</button>
      </div>
    </form>
  );
}

export default Areas;
