/**
 * Der Unterbau einer übernommenen Adresse — zum Ziehen.
 *
 * <b>Eine Seite umzuhängen heisst: ihre ADRESSE ändert sich, ihr Inhalt nicht.</b>
 * Text, Bausteine und Formularfelder hängen an der Kennung, nicht am Pfad; was
 * mitzieht, sind die Unterseiten und die Verweise darauf. Das steht am Baum,
 * weil es die eine Frage ist, die jemand vor dem Loslassen hat.
 *
 * <b>Jede Zeile sagt, WER sie sieht.</b> Nicht „intern" — sondern der Name
 * dessen, dem sie gehört. Das ist die einzige Erklärung, die hier gebraucht
 * wird, und sie steht am Inhalt statt in einer Hilfe:
 *
 * <code>
 *   recreatio.pl/lo13        publiczny
 *     /anna                  tylko: Anna Kowalska
 * </code>
 *
 * <b>Nach oben ziehen geht nicht.</b> Eine oberste Adresse nimmt man mit einem
 * Code (0017); wäre Ziehen ein zweiter Weg dorthin, liesse sich der Code
 * umgehen. Der Dienst lehnt es ab — der Baum bietet es gar nicht erst an, damit
 * niemand erst nach dem Loslassen erfährt, dass es nicht ging.
 *
 * <b>Was hier NICHT entschieden wird.</b> Ob ein Zug erlaubt ist, entscheidet
 * der Dienst: zwei Schreibrechte, keine besetzte Zielzeile, kein Ast in sich
 * selbst. Die Prüfungen unten sind nur da, damit der Mauszeiger es früher sagt
 * — sie ersetzen nichts, und sie dürfen ruhig strenger sein als der Dienst.
 */

import { useCallback, useEffect, useState } from 'react';

import { openSubpage } from './access';
import { moveSlug, type Desk, type PageCard, type RoleCard } from './desk';
import type { Ring } from './keys';
import { keysFor } from './ringOf';
import { pagePath, PATH_SHAPE } from './routes';
import { WorkspaceError, type Who } from './session';
import type { Node } from './tree';

/** Nur ein Stück, keine Schrägstriche: an einer Stelle im Baum ist das der Name. */
const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function SlugTree({ nodes, desk, who, editing, onEdit, onChanged }: {
  nodes: readonly Node[];
  desk: Desk;
  who: Who;
  editing: string | null;
  onEdit: (path: string) => void;
  onChanged: () => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /*
   * Die Namen der Rollen sind versiegelt. Ohne Passwort in diesem Tab bleiben
   * sie es — dann steht in der Auswahl die ART und die halbe Kennung, und das
   * ist ehrlicher als ein erfundener Name.
   */
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [ring, setRing] = useState<Ring | null>(null);

  useEffect(() => {
    let alive = true;

    void keysFor(who)
      .then(async ({ ring: bund }) => {
        if (!alive || bund === null) return;
        const open = await bund.names();
        if (alive) { setRing(bund); setNames(open); }
      })
      .catch(() => undefined);

    return () => { alive = false; };
  }, [who]);

  const act = useCallback(async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);

    try {
      await todo();
      onChanged();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  }, [onChanged]);

  /*
   * In sich selbst lässt sich nichts hängen, und in den eigenen Ast auch nicht:
   * die Vorfahren wären danach die Nachfahren. Dorthin, wo es schon liegt,
   * ebenfalls nicht — das wäre ein Zug, der nichts tut, und ein Rahmen, der
   * etwas verspricht.
   */
  const allowed = useCallback((target: string): boolean =>
    dragging !== null
    && target !== ''
    && target !== dragging
    && !target.startsWith(dragging + '/')
    && target !== parentOf(dragging),
  [dragging]);

  const drop = (target: string) => {
    const from = dragging;

    setDragging(null);
    setOver(null);

    if (from === null || !allowed(target)) return;

    const leaf = from.slice(from.lastIndexOf('/') + 1);
    void act('Przenoszenie…', () => moveSlug(from, `${target}/${leaf}`));
  };

  const shared: Shared = {
    desk, names, ring, editing,
    dragging, over, allowed,
    busy: busy !== null,
    onEdit,
    onDragStart: setDragging,
    onDragEnd: () => { setDragging(null); setOver(null); },
    onOver: setOver,
    onDrop: drop,
    onAct: act
  };

  return (
    <>
      <p className="wk-hint">
        Przeciągnij adres na inny, żeby go pod niego wsunąć. <strong>Treść zostaje</strong> —
        zmienia się sam adres, razem z podstronami i odnośnikami do nich.
        Na najwyższy poziom nie da się przeciągnąć: tam wchodzi się kodem.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}

      <Branch nodes={nodes} depth={0} {...shared} />
    </>
  );
}

const parentOf = (path: string): string => {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? '' : path.slice(0, cut);
};

/* -- Ein Ast --------------------------------------------------------------- */

interface Shared {
  readonly desk: Desk;
  readonly names: ReadonlyMap<string, string>;
  readonly ring: Ring | null;
  readonly editing: string | null;
  readonly dragging: string | null;
  readonly over: string | null;
  readonly allowed: (target: string) => boolean;
  readonly busy: boolean;
  readonly onEdit: (path: string) => void;
  readonly onDragStart: (path: string) => void;
  readonly onDragEnd: () => void;
  readonly onOver: (path: string | null) => void;
  readonly onDrop: (target: string) => void;
  readonly onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}

function Branch({ nodes, depth, ...rest }: Shared & {
  nodes: readonly Node[];
  depth: number;
}) {
  return (
    <ul className={depth === 0 ? 'wk-tree' : 'wk-tree wk-tree-sub'}>
      {nodes.map((node) => (
        <li key={node.path}>
          <Row node={node} depth={depth} {...rest} />

          {node.children.length > 0 && (
            <Branch nodes={node.children} depth={depth + 1} {...rest} />
          )}
        </li>
      ))}
    </ul>
  );
}

/* -- Eine Zeile ------------------------------------------------------------ */

function Row({ node, depth, desk, names, editing, dragging, over, allowed, busy,
  onEdit, onDragStart, onDragEnd, onOver, onDrop, onAct }: Shared & {
  node: Node;
  depth: number;
}) {
  const [open, setOpen] = useState(false);

  /*
   * Die Zeile EINMAL in eine eigene Bindung. `node.page?.aliasOf !== null` wäre
   * still falsch: fehlt die Zeile, ergibt die Kette `undefined`, und
   * `undefined !== null` stimmt — das Abzeichen erschiene ausgerechnet dort, wo
   * es gar keine Zeile gibt.
   */
  const page = node.page;

  const label = depth > 0 ? `/${node.name}`
    : node.path === '' ? 'recreatio.pl'
    : `recreatio.pl/${node.path}`;

  const target = allowed(node.path);
  const lifted = dragging === node.path;
  const marked = over === node.path && target;

  return (
    <div
      className="wk-row"
      draggable={page !== null && !busy}
      onDragStart={(e) => {
        if (page === null) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', node.path);
        onDragStart(node.path);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (!target) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (over !== node.path) onOver(node.path);
      }}
      onDragLeave={() => { if (over === node.path) onOver(null); }}
      onDrop={(e) => { e.preventDefault(); onDrop(node.path); }}
      style={{
        cursor: page !== null && !busy ? 'grab' : undefined,
        opacity: lifted ? 0.45 : undefined,
        outline: marked ? '2px solid var(--wk-accent)' : undefined,
        outlineOffset: marked ? '1px' : undefined
      }}
    >
      <span>
        {page === null ? (
          // Ein Zwischenstück, das niemand führt: keine Seite, aber eine Ebene.
          <code className="wk-tree-gap" title="Tego adresu nikt nie prowadzi">{label}</code>
        ) : (
          <a className="wk-link" href={pagePath(node.path)}><code>{label}</code></a>
        )}

        {page !== null && page.aliasOf !== null && (
          <span className="wk-row-side"> → <code>{page.aliasOf}</code></span>
        )}

        {page !== null && page.host !== null && (
          <span className="wk-row-side"> · <code>{page.host}</code></span>
        )}

        {/*
          WER SIE SIEHT — das Wichtigste an der Zeile, deshalb daneben und nicht
          hinter einem Klick.
        */}
        {page !== null && (
          <span className="wk-badge">
            {page.internalForRoleId === null
              ? 'publiczny'
              : `tylko: ${whose(page.internalForRoleId, names, desk)}`}
          </span>
        )}
      </span>

      <span className="wk-row-side">
        {page !== null && (
          <>
            <button type="button" className="wk-link-btn" onClick={() => setOpen(!open)}>
              {open ? 'Zwiń' : 'Ustawienia'}
            </button>
            {' · '}
            <button type="button" className="wk-link-btn" onClick={() => onEdit(node.path)}>
              {editing === node.path ? 'Zamknij stronę' : 'Edytuj stronę'}
            </button>
          </>
        )}
      </span>

      {open && page !== null && (
        <div className="wk-form" style={{ flexBasis: '100%' }}>
          <Rename page={page} busy={busy} onAct={onAct} />
          <AddChild parent={node.path} desk={desk} busy={busy} onAct={onAct} />
        </div>
      )}
    </div>
  );
}

/* -- Namen ----------------------------------------------------------------- */

/**
 * Wem die Adresse gehört, in einem Wort.
 *
 * Drei Stufen, absteigend nach Gewissheit: der versiegelte Name, den dieser Tab
 * öffnen konnte; die Art der Rolle, wenn sie im eigenen Graphen hängt; sonst
 * die halbe Kennung. Die letzte Stufe ist der Normalfall bei einer FREMDEN
 * Rolle — Annas Name liegt unter Annas Schlüssel, nicht unter unserem, und das
 * soll man der Zeile ansehen.
 */
function whose(roleId: string, names: ReadonlyMap<string, string>, desk: Desk): string {
  const name = names.get(roleId);
  if (name !== undefined && name !== '') return name;

  const mine = desk.roles.find((r) => r.id === roleId);
  if (mine !== undefined) return kindName(mine);

  return roleId.slice(0, 8);
}

const kindName = (role: RoleCard): string =>
  role.isPersonal ? 'Twoja rola osobista'
  : role.kind === 'role' ? 'Rola'
  : role.kind === 'group' ? 'Grupa'
  : 'Osoba';

/* -- Wem die Adresse gehört ------------------------------------------------ */

/**
 * <b>Die Rolle muss nicht die eigene sein.</b> Eine Lehrerin richtet
 * `lo13/anna` für Anna ein, ohne Annas Rolle zu halten — deshalb steht neben
 * der Auswahl der eigenen Rollen ein Feld für eine fremde Kennung. Ohne das
 * liesse sich der Fall, für den das Ganze gebaut ist, gar nicht eintragen.
 */
/*
   „KTO MA WIDZIEĆ TĘ STRONĘ" — FORT.

   Es war ein zweites Schloss neben dem einzigen, das schliesst. Was
   geschützt ist, liegt unter einem Bereichsschlüssel; Titel, Text und
   Einstellungen einer Seite gehen offen hinaus. Eine Adresse zu verbergen
   schützte damit nichts — und sah aus, als täte es das, was schlimmer ist
   als gar kein Schloss.
*/
/* -- Umbenennen ------------------------------------------------------------ */

/**
 * Umbenennen IST Umhängen — derselbe Dienst, dasselbe Versprechen: der Inhalt
 * bleibt, die Adresse ändert sich. Ohne dieses Feld gäbe es keinen Weg, einen
 * Tippfehler zu heilen, ausser die Seite noch einmal anzulegen.
 */
function Rename({ page, busy, onAct }: {
  page: PageCard;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const parent = parentOf(page.path);
  const leaf = page.path.slice(page.path.lastIndexOf('/') + 1);

  const [name, setName] = useState(leaf);
  const clean = name.trim().toLowerCase();

  /*
   * Eine oberste Adresse hat kein Elternteil — sie umzubenennen hiesse, eine
   * neue Wurzel zu nehmen, und die gibt es nur gegen einen Code.
   */
  if (parent === '') {
    return <p className="wk-hint">Adres najwyższego poziomu zmienia się tylko kodem.</p>;
  }

  const blocker =
    clean === '' ? 'Nazwa nie może być pusta.'
    : !SEGMENT.test(clean) ? 'Nazwa: małe litery, cyfry i myślniki.'
    : clean === 'portal' ? 'Słowo „portal" jest zajęte — za nim zaczynają się miejsca.'
    : null;

  return (
    <label className="wk-field">
      <span>Nazwa tego kroku</span>
      <input value={name} disabled={busy} autoComplete="off"
        onChange={(e) => setName(e.target.value)} />

      {clean !== leaf && blocker === null && (
        <>
          <span className="wk-hint">
            Powstanie <code>{parent}/{clean}</code>. Treść zostaje.
          </span>
          <span className="wk-actions">
            <button
              type="button" className="wk-btn" disabled={busy}
              onClick={() => void onAct('Zmiana nazwy…',
                () => moveSlug(page.path, `${parent}/${clean}`))}
            >
              Zmień nazwę
            </button>
          </span>
        </>
      )}

      {clean !== leaf && blocker !== null && <span className="wk-blocker">{blocker}</span>}
    </label>
  );
}

/* -- Eine Unterseite dazu -------------------------------------------------- */

/**
 * <b>Ohne Code.</b> Wer die Adresse darüber führt, erreicht sich selbst; ein
 * Geheimnis, das man sich selbst schickt, wäre Umstand ohne Gewinn (0017).
 */
function AddChild({ parent, desk, busy, onAct }: {
  parent: string;
  desk: Desk;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState(desk.roles[0]?.id ?? '');

  const clean = name.trim().toLowerCase();
  const wanted = `${parent}/${clean}`;

  const blocker =
    clean === '' ? null
    : !SEGMENT.test(clean) ? 'Nazwa: małe litery, cyfry i myślniki.'
    : clean === 'portal' ? 'Słowo „portal" jest zajęte — za nim zaczynają się miejsca.'
    : !PATH_SHAPE.test(wanted) ? 'Taki adres nie przejdzie.'
    : null;

  return (
    <>
      <label className="wk-field">
        <span>Dodaj podstronę</span>
        <input value={name} placeholder="klasy" disabled={busy} autoComplete="off"
          onChange={(e) => setName(e.target.value)} />
      </label>

      {clean !== '' && blocker === null && (
        <p className="wk-hint">
          Powstanie <code>{wanted}</code> — bez kodu, bo prowadzisz to, co wyżej.
        </p>
      )}

      {blocker !== null && <p className="wk-blocker">{blocker}</p>}

      <label className="wk-field">
        <span>Kto będzie odpowiadał</span>
        <select value={roleId} disabled={busy} onChange={(e) => setRoleId(e.target.value)}>
          {desk.roles.map((r) => (
            <option key={r.id} value={r.id}>{kindName(r)} · {r.id.slice(0, 8)}</option>
          ))}
        </select>
      </label>

      <div className="wk-actions">
        <button
          type="button" className="wk-btn"
          disabled={busy || clean === '' || blocker !== null || roleId === ''}
          onClick={() => {
            void onAct('Zakładanie…', () => openSubpage(wanted, roleId));
            setName('');
          }}
        >
          Dodaj
        </button>
      </div>
    </>
  );
}

export default SlugTree;
