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

import { besideIt, chainTo, inOrder, loadAreas, type AreaRow } from './area';
import { useCrumbs, type Crumb } from '../shell/crumbTrail';
import type { Ring, SealedRole } from '../core/keys';
import { keysFor, forgetKeys } from '../core/ringOf';
import { selfOf, type RoleGraphData } from '../roles/roles';
import { viewPath } from '../routes';
import { WorkspaceError, type Who } from '../core/session';
import { Unlock } from '../shell/Unlock';
import { useTouched } from '../workspace/Recent';
import { AccessLinks } from '../links/AccessLinks';
import type { Desk } from '../workspace/desk';
import { Loading } from '../ui/Loading';
import { Icon } from '../ui/icons';
import { PageHeader } from '../ui/PageHeader';
import { AREA_TABS, type AreaTab, LEVEL_NAME } from './areaWords';
import { AreaPage } from './AreaPage';
import { NewArea } from './NewArea';

const tabOf = (word: string | undefined): AreaTab =>
  AREA_TABS.find((one) => one.id === word)?.id ?? 'przeglad';

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

export default Areas;
