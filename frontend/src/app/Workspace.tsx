/**
 * Der Arbeitsplatz — Kacheln, und eine davon ganz.
 *
 * <b>Zwei Spalten, auf schmalem Gerät eine.</b> Die Kacheln sind kein
 * Schmuck: sie sind die vier Dinge, die ein Mensch hier hat, nebeneinander
 * statt untereinander — man sieht mit einem Blick, wo etwas liegt.
 *
 * <b>Eine offene Kachel ist eine ADRESSE</b> (`#/workspace/pages`), kein
 * Zustand im Speicher. Deshalb lässt sie sich verschicken und neu laden, und
 * der Zurück-Pfeil des Browsers verlässt die Kachel statt den Arbeitsplatz.
 *
 * <b>Was leer ist, sagt warum.</b> Kalender und Rozmowy hängen an Bereichen,
 * und Bereiche entstehen mit dem ersten Körper. Eine Kachel, die „0" zeigt,
 * behauptet, gerechnet zu haben.
 */

import { useCallback, useEffect, useState } from 'react';

import { pagePath, tilesPath, viewPath, VIEWS, type Spot, type View } from './routes';
import { PageEditor } from './PageEditor';
import { RoleGraph } from './RoleGraph';
import { WorkspaceError, type Who } from './session';
import { claimSlug, loadDesk, type Desk, type RoleCard } from './desk';

export function Workspace({ spot, who }: { spot: Spot; who: Who }) {
  /** `undefined` = noch nicht nachgesehen, `null` = ging nicht. */
  const [desk, setDesk] = useState<Desk | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      setDesk(await loadDesk());
      setFailed(null);
    } catch (e) {
      setDesk(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać warsztatu.');
    }
  }, []);

  useEffect(() => { void look(); }, [look]);

  /*
   * Eine Ansicht, die es nicht gibt (`#/workspace/kalender`). Sie wird NICHT
   * stillschweigend zu den Kacheln — wer so einen Link bekommen hat, soll
   * erfahren, dass das Wort keine Ansicht ist.
   */
  if (spot.kind === 'stray') {
    return (
      <>
        <h1 className="wk-h1">Nie ma tu takiego widoku</h1>
        <p className="wk-lede">
          Warsztat nie zna części <code>{spot.word}</code>.
        </p>
        <p><a className="wk-link" href={tilesPath()}>Wróć do warsztatu</a></p>
      </>
    );
  }

  if (desk === undefined) return <p className="wk-lede">Wczytywanie…</p>;

  if (desk === null) {
    return (
      <>
        <h1 className="wk-h1">Warsztat</h1>
        <p className="wk-error">{failed}</p>
        <p>
          <button type="button" className="wk-btn" onClick={() => void look()}>Spróbuj ponownie</button>
        </p>
      </>
    );
  }

  if (spot.kind === 'view') {
    return (
      <>
        <div className="wk-view-head">
          <a className="wk-back" href={tilesPath()} aria-label="Wróć do warsztatu">←</a>
          <h1 className="wk-h1">{VIEWS[spot.view]}</h1>
        </div>
        <Inside view={spot.view} desk={desk} who={who} onChanged={() => void look()} />
      </>
    );
  }

  return <Tiles desk={desk} />;
}

/* -- Die Kacheln ----------------------------------------------------------- */

function Tiles({ desk }: { desk: Desk }) {
  return (
    <>
      <h1 className="wk-h1">Warsztat</h1>
      <p className="wk-lede">
        Tu jest to, do czego masz klucze. Kliknij kafelek, żeby otworzyć go na całość.
      </p>

      <div className="wk-tiles">
        <Tile view="calendar">
          <p className="wk-empty">Żaden kalendarz nie jest jeszcze podpięty.</p>
        </Tile>

        <Tile view="chat">
          <p className="wk-empty">Żadnej rozmowy.</p>
        </Tile>

        <Tile view="pages" count={desk.pages.length}>
          {desk.pages.length === 0 ? (
            <p className="wk-empty">Nie prowadzisz jeszcze żadnego adresu.</p>
          ) : (
            <ul className="wk-tile-lines">
              {desk.pages.slice(0, 3).map((page) => (
                <li key={page.path}><code>recreatio.pl/{page.path}</code></li>
              ))}
              {desk.pages.length > 3 && <li className="wk-empty">i {desk.pages.length - 3} więcej</li>}
            </ul>
          )}
        </Tile>

        <Tile view="roles" count={desk.roles.length}>
          <ul className="wk-tile-lines">
            {desk.roles.map((role) => <li key={role.id}>{roleName(role)}</li>)}
          </ul>
        </Tile>
      </div>
    </>
  );
}

function Tile({ view, count, children }: {
  view: View;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <a className="wk-tile" href={viewPath(view)}>
      <span className="wk-tile-head">
        <span className="wk-tile-name">{VIEWS[view]}</span>
        {count !== undefined && <span className="wk-tile-count">{count}</span>}
      </span>
      {children}
    </a>
  );
}

/* -- Eine Kachel ganz ------------------------------------------------------ */

function Inside({ view, desk, who, onChanged }: {
  view: View;
  desk: Desk;
  who: Who;
  onChanged: () => void;
}) {
  if (view === 'pages') return <Pages desk={desk} onClaimed={onChanged} />;
  if (view === 'roles') return <RoleGraph who={who} />;

  /*
   * Kalender und Rozmowy: die Kachel steht, die Quelle nicht. Das hier
   * auszuschreiben ist ehrlicher als eine leere Liste, die aussieht, als wäre
   * nichts eingetragen.
   */
  return (
    <p className="wk-note">
      {view === 'calendar'
        ? 'Kalendarz należy do obszaru — a obszar powstaje razem z pierwszą organizacją, grupą albo wydarzeniem. Dopóki żadnego nie prowadzisz, nie ma czego pokazać.'
        : 'Rozmowy należą do obszaru — a obszar powstaje razem z pierwszą organizacją, grupą albo wydarzeniem. Dopóki żadnego nie prowadzisz, nie ma czego pokazać.'}
    </p>
  );
}

/* -- Strony: übernehmen, nicht anlegen ------------------------------------- */

/** Dieselbe Form wie `ck_slug_path` und `Slug.Shape()` im Dienst. */
const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

function Pages({ desk, onClaimed }: { desk: Desk; onClaimed: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [wanted, setWanted] = useState('');
  const [code, setCode] = useState('');
  const [roleId, setRoleId] = useState(desk.roles[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const path = wanted.trim().toLowerCase().replace(/^\/+|\/+$/g, '');

  /* Ein grauer Knopf muss sagen, warum — sonst sieht es aus, als sei der
     Adress-Code schon abgelehnt worden. */
  const blocker =
    busy ? null
    : desk.roles.length === 0 ? 'Nie masz roli, która mogłaby przejąć adres.'
    : path === '' ? 'Wpisz adres.'
    : !SHAPE.test(path) ? 'Adres: małe litery, cyfry i myślniki; części oddziel ukośnikiem.'
    : path === 'workspace' || path.startsWith('workspace/') ? 'Adres „workspace” należy do samego warsztatu.'
    : code.trim() === '' ? 'Wpisz kod adresu.'
    : roleId === '' ? 'Wybierz rolę.'
    : null;

  const go = async () => {
    setBusy(true);
    setFailed(null);
    setDone(null);

    try {
      const page = await claimSlug(path, code.trim(), roleId);
      setDone(page.path);
      setWanted('');
      setCode('');
      onClaimed();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się przejąć adresu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {desk.pages.length === 0 ? (
        <p className="wk-lede">
          Nie prowadzisz jeszcze żadnego adresu. Adres się przejmuje: musi być
          na liście i trzeba mieć do niego kod.
        </p>
      ) : (
        <ul className="wk-list">
          {desk.pages.map((page) => (
            <li className="wk-row" key={page.path}>
              <span>
                <a className="wk-link" href={pagePath(page.path)}>
                  <code>recreatio.pl/{page.path}</code>
                </a>
              </span>

              <span className="wk-row-side">
                {roleOf(desk, page.roleId)}{' · '}
                <button
                  type="button"
                  className="wk-link-btn"
                  onClick={() => setEditing(editing === page.path ? null : page.path)}
                >
                  {editing === page.path ? 'Zamknij' : 'Edytuj stronę'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing !== null && <PageEditor path={editing} />}

      <h2 className="wk-h2">Przejmij adres</h2>

      <form
        className="wk-form"
        onSubmit={(e) => { e.preventDefault(); if (blocker === null) void go(); }}
      >
        <label className="wk-field">
          <span>Adres</span>
          <input value={wanted} onChange={(e) => setWanted(e.target.value)} placeholder="schola" />
        </label>

        <label className="wk-field">
          <span>Kod adresu</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
        </label>

        {/*
          NICHT „ja" przejmuję adres, tylko rola. To jedyne pole, które łatwo
          przeoczyć, a decyduje o tym, co się stanie, gdy ktoś odejdzie.
        */}
        <label className="wk-field">
          <span>Kto będzie odpowiadał</span>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {desk.roles.map((role) => (
              <option key={role.id} value={role.id}>{roleName(role)} · {short(role.id)}</option>
            ))}
          </select>
        </label>

        <p className="wk-hint">
          Wybrana rola odpowiada za ten adres i za wszystko pod nim —
          <code>{path === '' ? 'schola' : path}/…</code> idzie razem z nim.
        </p>

        {failed !== null && <p className="wk-error">{failed}</p>}
        {done !== null && <p className="wk-done">Adres <code>recreatio.pl/{done}</code> jest Twój.</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={blocker !== null || busy}>
            {busy ? 'Sprawdzanie…' : 'Przejmij'}
          </button>

          {blocker !== null && !busy && <span className="wk-blocker">{blocker}</span>}
        </div>
      </form>
    </>
  );
}

/* -- Namen ----------------------------------------------------------------- */

/**
 * Der Anzeigename einer Rolle ist versiegelt (`display_name_sealed`) — der
 * Dienst kann ihn nicht lesen, und der Browser hat die Schlüssel dafür noch
 * nicht. Bis dahin steht hier die ART, und die ist ehrlich.
 */
function roleName(role: RoleCard): string {
  if (role.isPersonal) return 'Twoja rola osobista';
  if (role.kind === 'office') return 'Urząd';
  if (role.kind === 'member') return 'Członkostwo';
  return 'Rola';
}

function roleOf(desk: Desk, roleId: string): string {
  const role = desk.roles.find((r) => r.id === roleId);
  return role === undefined ? short(roleId) : roleName(role);
}

const short = (id: string): string => id.slice(0, 8);

export default Workspace;
