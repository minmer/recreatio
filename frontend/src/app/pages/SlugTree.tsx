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

import { openSubpage } from '../areas/access';
import { areaPath, loadAreas, type AreaRow } from '../areas/area';
import { AreaPickMany } from '../areas/AreaPick';
import { moveSlug, setPageAreas, takers, type Desk, type PageCard } from '../workspace/desk';
import { myRoleNames, roleLabel } from '../roles/roleNames';
import type { Ring } from '../core/keys';
import { keysFor } from '../core/ringOf';
import { pagePath, PATH_SHAPE } from '../routes';
import { WorkspaceError, type Who } from '../core/session';
import { ask } from '../ui/dialogs';
import type { Node } from '../core/tree';
import { rich, useT } from '../core/i18n';

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
  const t = useT();
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

  /* Die Bereiche, die ich sehe — für „Kto może otworzyć tę stronę" (0051). */
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  useEffect(() => {
    let alive = true;
    loadAreas().then((found) => { if (alive) setAreas(found.areas); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;

    void keysFor(who)
      .then(async ({ ring: bund }) => {
        if (!alive || bund === null) return;
        /* Personen mit Vor- und Nachnamen, Rollen mit ihrem Namen — überall derselbe (`roleNames`). */
        const open = await myRoleNames(who);
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
      setFailed(e instanceof WorkspaceError ? e.message : t('pages.editor.failed'));
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
    void act(t('pagesAddresses.tree.moving'), () => moveSlug(from, `${target}/${leaf}`));
  };

  const shared: Shared = {
    desk, names, ring, editing, areas,
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
      <p className="wk-hint">{rich(t('pagesAddresses.tree.dragHint'), { b: (s, k) => <strong key={k}>{s}</strong> })}</p>

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
  readonly areas: readonly AreaRow[];
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

function Row({ node, depth, desk, names, ring, areas, editing, dragging, over, allowed, busy,
  onEdit, onDragStart, onDragEnd, onOver, onDrop, onAct }: Shared & {
  node: Node;
  depth: number;
}) {
  const t = useT();
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
          <code className="wk-tree-gap" title={t('pagesAddresses.tree.nobody')}>{label}</code>
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
            {(page.accessAreaIds ?? []).length > 0
              ? t('${K}accessOnly', { areas: (page.accessAreaIds ?? []).map((id) => areas.some((a) => a.areaId === id) ? areaPath(areas, id).short : t('${K}area')).join(', ') })
              : t('${K}public')}
            {page.seal != null ? t('${K}sealedTag') : ''}
          </span>
        )}
      </span>

      <span className="wk-row-side">
        {page !== null && (
          <>
            <button type="button" className="wk-link-btn" onClick={() => setOpen(!open)}>
              {open ? t('pages.editor.fold') : t('pagesAddresses.tree.settings')}
            </button>
            {' · '}
            <button type="button" className="wk-link-btn" onClick={() => onEdit(node.path)}>
              {editing === node.path ? t('pagesAddresses.tree.closePage') : t('pages.public.edit')}
            </button>
          </>
        )}
      </span>

      {open && page !== null && (
        <div className="wk-form" style={{ flexBasis: '100%' }}>
          <Rename page={page} busy={busy} onAct={onAct} />
          <Visibility page={page} areas={areas} ring={ring} busy={busy} onAct={onAct} />
          <AddChild parent={node.path} desk={desk} names={names} busy={busy} onAct={onAct} />
        </div>
      )}
    </div>
  );
}

/* -- Namen ----------------------------------------------------------------- */

/* -- Wer die Seite öffnen darf ----------------------------------------------- */

/**
 * „KTO MOŻE OTWORZYĆ TĘ STRONĘ" — wieder da, mit dem, was es bewirkt, und
 * gebunden an BEREICHE, nicht an eine Rolle (Wunsch der Kanzlei, 2026-09-28).
 *
 * <b>Was es schützt.</b> Nicht die Daten der Menschen — die liegen ohnehin
 * unter Bereichsschlüsseln —, sondern WER HIER HANDELN DARF. Auf einer Seite
 * mit Terminen und Formularen nahm vorher auch ein alter Link aus einem
 * ANDEREN Formular einen Termin, und in der Kanzlei stand „bez nazwy". Nur
 * mit Zugang gilt hier: ein Link aus einem der gewählten Bereiche (oder zu
 * genau dieser Seite), eine Person mit Zugang zu einem dieser Bereiche, und
 * wer die Seite führt. Alle anderen lesen, dass es Zugang braucht.
 */
function Visibility({ page, areas, ring, busy, onAct }: {
  page: PageCard;
  areas: readonly AreaRow[];
  ring: Ring | null;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useT();
  const now = page.accessAreaIds ?? [];
  const [restricted, setRestricted] = useState(now.length > 0);
  const [chosen, setChosen] = useState<readonly string[]>(now);

  const same = restricted === (now.length > 0)
    && chosen.length === now.length && chosen.every((id) => now.includes(id));
  const toggle = (id: string) =>
    setChosen((was) => (was.includes(id) ? was.filter((one) => one !== id) : [...was, id]));

  /* Ein Bereich, der gebunden ist, den ich aber nicht (mehr) sehe, bleibt stehen. */
  const unseen = now.filter((id) => !areas.some((a) => a.areaId === id));

  return (
    <fieldset className="wk-field wk-access-pick">
      <legend>{t('pagesAddresses.tree.whoOpens')}</legend>

      <label className="wk-check">
        <input type="radio" name={`access-${page.path}`} checked={!restricted} disabled={busy}
          onChange={() => setRestricted(false)} />
        <span>{t('pagesAddresses.tree.everyone')}</span>
      </label>
      <label className="wk-check">
        <input type="radio" name={`access-${page.path}`} checked={restricted} disabled={busy}
          onChange={() => setRestricted(true)} />
        <span>{t('pagesAddresses.tree.onlyAreas')}</span>
      </label>

      {restricted && (
        <div className="wk-access-areas">
          {/* DER GANZE BAUM (AreaPickMany): „Kandydaci" gibt es in der Firmung und in der Erstkommunion — eingerückt, wie sie ineinander liegen. */}
          <AreaPickMany label={t('pagesAddresses.tree.areasLabel')} areas={areas} only={areas.filter((a) => a.personal !== true)} value={chosen.filter((id) => areas.some((a) => a.areaId === id))}
            onChange={(next) => { if (!busy) setChosen([...next, ...chosen.filter((id) => !areas.some((a) => a.areaId === id))]); }} />
          {chosen.filter((id) => areas.some((a) => a.areaId === id)).length > 0 && (
            <span className="wk-hint">
              {t('pagesAddresses.tree.chosen', { areas: chosen.filter((id) => areas.some((a) => a.areaId === id)).map((id) => areaPath(areas, id).full).join(' · ') })}
            </span>
          )}
          {unseen.map((id) => (
            <label key={id} className="wk-check">
              <input type="checkbox" checked={chosen.includes(id)} disabled={busy} onChange={() => toggle(id)} />
              <span>{t('pagesAddresses.tree.unseen')}</span>
            </label>
          ))}
        </div>
      )}

      <span className="wk-hint">
        {restricted
          ? t('pagesAddresses.tree.restrictedHint')
          : t('pagesAddresses.tree.publicHint')}
      </span>

      {!same && (restricted ? chosen.length > 0 : true) && (
        <span className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy}
            onClick={() => void onAct(t('pages.editor.saving'), async () => {
              await setPageAreas(page.path, restricted ? chosen : []);
              /* 0121 — eine versiegelte Seite bekommt gleich einen neuen Schlüssel: nur noch für die Bereiche, die jetzt gelten. */
              if (page.seal != null && restricted && ring !== null) {
                const { sealPage } = await import('./pageSealing');
                await sealPage(page.path, chosen, page.roleId, ring);
              }
            })}>
            {t('common.save')}
          </button>
        </span>
      )}
      {restricted && chosen.length === 0 && (
        <span className="wk-hint">{t('pagesAddresses.tree.pickOne')}</span>
      )}

      {/* 0121 — erst, wenn die Seite mit Zugang GESPEICHERT ist: versiegelt wird, was gilt. */}
      {now.length > 0 && same && restricted && (
        <Sealing page={page} areas={areas} ring={ring} busy={busy} onAct={onAct} />
      )}
    </fieldset>
  );
}

/* -- Versiegelt (0121) ------------------------------------------------------------ */

/**
 * „ZASZYFROWANA" — eine Seite mit Zugang, deren Inhalt der Dienst nicht mehr
 * liest. Was es kostet, steht dabei, nicht in einer Hilfe: Osoby z formularzy
 * kommen erst mit einer Rolle und einem übergebenen Schlüssel hinein, Bausteine
 * werden nicht mit anderen Seiten geteilt, und Dateien sind (noch) offen.
 */
function Sealing({ page, areas, ring, busy, onAct }: {
  page: PageCard;
  areas: readonly AreaRow[];
  ring: Ring | null;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useT();
  const sealed = page.seal != null;
  const [state, setState] = useState<{ unwrapped: readonly string[]; open: readonly string[] } | null>(null);

  useEffect(() => {
    let alive = true;
    void import('./pageSealing')
      .then(({ sealState }) => sealState(page))
      .then((found) => { if (alive) setState(found); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [page]);

  const named = (ids: readonly string[]) =>
    ids.map((id) => (areas.some((a) => a.areaId === id) ? areaPath(areas, id).full : t('pagesAddresses.tree.unseen'))).join(', ');

  const turnOn = async () => {
    if (ring === null) return;
    const yes = await ask({
      title: t('pagesAddresses.tree.seal.title'),
      body: t('pagesAddresses.tree.seal.body'),
      list: [t('pagesAddresses.tree.seal.form'), t('pagesAddresses.tree.seal.single'), t('pagesAddresses.tree.seal.lost'), t('pagesAddresses.tree.seal.files')],
      confirm: t('pagesAddresses.tree.seal.confirm')
    });
    if (!yes) return;
    const { sealPage } = await import('./pageSealing');
    await onAct(t('pagesAddresses.tree.seal.sealing'), () => sealPage(page.path, page.accessAreaIds ?? [], page.roleId, ring));
  };

  const turnOff = async () => {
    const yes = await ask({
      title: t('pagesAddresses.tree.unseal.title'),
      body: t('pagesAddresses.tree.unseal.body'),
      confirm: t('pagesAddresses.tree.unseal.confirm')
    });
    if (!yes) return;
    const { unsealPage } = await import('./pageSealing');
    await onAct(t('pagesAddresses.tree.unseal.working'), () => unsealPage(page.path));
  };

  const renew = async () => {
    if (ring === null) return;
    const { sealPage } = await import('./pageSealing');
    await onAct(t('pagesAddresses.tree.seal.renewing'), () => sealPage(page.path, page.accessAreaIds ?? [], page.roleId, ring));
  };

  return (
    <div className="wk-access-seal">
      <label className="wk-check">
        <input type="checkbox" checked={sealed} disabled={busy || ring === null}
          onChange={() => void (sealed ? turnOff() : turnOn())} />
        <span>{t('pagesAddresses.tree.seal.check')}</span>
      </label>
      {ring === null && <span className="wk-warn">{t('pagesAddresses.tree.seal.needKey')}</span>}
      {sealed && state !== null && state.unwrapped.length > 0 && (
        <span className="wk-warn">
          {t('pagesAddresses.tree.seal.unwrapped', { areas: named(state.unwrapped) })}{' '}
          <button type="button" className="wk-link-btn" disabled={busy || ring === null} onClick={() => void renew()}>{t('pagesAddresses.tree.seal.renew')}</button>
        </span>
      )}
      {state !== null && state.open.length > 0 && (
        <span className="wk-warn">{t('pagesAddresses.tree.seal.openArea', { areas: named(state.open) })}</span>
      )}
    </div>
  );
}

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
  const t = useT();
  const parent = parentOf(page.path);
  const leaf = page.path.slice(page.path.lastIndexOf('/') + 1);

  const [name, setName] = useState(leaf);
  const clean = name.trim().toLowerCase();

  /*
   * Eine oberste Adresse hat kein Elternteil — sie umzubenennen hiesse, eine
   * neue Wurzel zu nehmen, und die gibt es nur gegen einen Code.
   */
  if (parent === '') {
    return <p className="wk-hint">{t('pagesAddresses.tree.topLevel')}</p>;
  }

  const blocker =
    clean === '' ? t('pagesAddresses.tree.emptyName')
    : !SEGMENT.test(clean) ? t('pagesAddresses.tree.badName')
    : clean === 'portal' ? t('pagesAddresses.tree.portal')
    : null;

  return (
    <label className="wk-field">
      <span>{t('pagesAddresses.tree.stepName')}</span>
      <input value={name} disabled={busy} autoComplete="off"
        onChange={(e) => setName(e.target.value)} />

      {clean !== leaf && blocker === null && (
        <>
          <span className="wk-hint">{rich(t('pagesAddresses.tree.renameWill', { path: `${parent}/${clean}` }), { code: (s, k) => <code key={k}>{s}</code> })}</span>
          <span className="wk-actions">
            <button
              type="button" className="wk-btn" disabled={busy}
              onClick={() => void onAct(t('pagesAddresses.tree.renaming'),
                () => moveSlug(page.path, `${parent}/${clean}`))}
            >
              {t('pagesAddresses.tree.rename')}
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
function AddChild({ parent, desk, names, busy, onAct }: {
  names: ReadonlyMap<string, string>;
  parent: string;
  desk: Desk;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState(takers(desk.roles)[0]?.id ?? '');

  const clean = name.trim().toLowerCase();
  const wanted = `${parent}/${clean}`;

  const blocker =
    clean === '' ? null
    : !SEGMENT.test(clean) ? t('pagesAddresses.tree.badName')
    : clean === 'portal' ? t('pagesAddresses.tree.portal')
    : !PATH_SHAPE.test(wanted) ? t('pagesAddresses.tree.badPath')
    : null;

  return (
    <>
      <label className="wk-field">
        <span>{t('pagesAddresses.tree.addChild')}</span>
        <input value={name} placeholder={t('pagesAddresses.tree.addChildPlaceholder')} disabled={busy} autoComplete="off"
          onChange={(e) => setName(e.target.value)} />
      </label>

      {clean !== '' && blocker === null && (
        <p className="wk-hint">{rich(t('pagesAddresses.tree.addWill', { path: wanted }), { code: (s, k) => <code key={k}>{s}</code> })}</p>
      )}

      {blocker !== null && <p className="wk-blocker">{blocker}</p>}

      <label className="wk-field">
        <span>{t('pagesAddresses.tree.who')}</span>
        <select value={roleId} disabled={busy} onChange={(e) => setRoleId(e.target.value)}>
          {takers(desk.roles).map((r) => (
            <option key={r.id} value={r.id}>{roleLabel(r, names)}</option>
          ))}
        </select>
      </label>

      <div className="wk-actions">
        <button
          type="button" className="wk-btn"
          disabled={busy || clean === '' || blocker !== null || roleId === ''}
          onClick={() => {
            void onAct(t('pagesAddresses.tree.creating'), () => openSubpage(wanted, roleId));
            setName('');
          }}
        >
          {t('common.add')}
        </button>
      </div>
    </>
  );
}

export default SlugTree;
