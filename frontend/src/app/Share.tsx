/**
 * UDOSTĘPNIJ (0094) — ein Knopf an allem, was man jemandem zeigen will:
 * einer Seite, einem Bereich, einem Kalender, einem Formular.
 *
 * <b>Öffentliches braucht keinen Zugang</b>: dann steht die Adresse da, mit
 * Kopieren, Teilen und QR. <b>Alles andere bekommt einen Link mit Zugang</b>
 * (0065/0091): die Rolle ist schon gewählt — die erste, die zu allen Bereichen
 * des Dings führt —, der Link öffnet genau dieses Ding, und der Rest (wie
 * lange, einmalig) steht darunter, für wen es braucht. Ein Klick statt der
 * Wege über Obszary → Linki dostępu → Nowy link.
 */

import { useEffect, useMemo, useState } from 'react';

import { LinkShare } from './AccessLinks';
import type { AreaRow } from './area';
import { createCommonRole, type NewRoleDraft } from './commonRole';
import { CommonRoleChoice, EMPTY_DRAFT, NEW_ROLE, useGivableRoles } from './CommonRoleField';
import type { Ring, SealedRole } from './keys';
import { createLink } from './linkAccess';
import { Modal } from './Modal';
import { keysFor } from './ringOf';
import { selfOf } from './roles';
import { WorkspaceError, type Who } from './session';
import { areasNow, invalidate } from './viewData';

export interface ShareTarget {
  /** Wie es heisst — auch der Name des Links. */
  readonly title: string;
  /** Wohin der Link führt (der Weg hinter `#/`); `null`: auf die Seite „Dołącz". */
  readonly aim: string | null;
  /** Die Bereiche, zu denen er Zugang braucht. Leer und `open`: öffentlich. */
  readonly areaIds: readonly string[];
  /** Öffentlich lesbar — dann genügt die Adresse. */
  readonly open?: boolean;
}

const EXPIRY = [
  { days: 7, label: 'tydzień' },
  { days: 30, label: 'miesiąc' },
  { days: 90, label: '3 miesiące' },
  { days: 365, label: 'rok' }
];

const addressOf = (aim: string | null) => `${window.location.origin}${window.location.pathname}#/${aim ?? ''}`;

export function ShareButton({ who, target, label = 'Udostępnij', className = 'wk-btn wk-btn-quiet' }: {
  who: Who;
  target: ShareTarget;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} data-share="" onClick={() => setOpen(true)}>{label}</button>
      {open && <ShareDialog who={who} target={target} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ShareDialog({ who, target, onClose }: { who: Who; target: ShareTarget; onClose: () => void }) {
  const [keys, setKeys] = useState<{ ring: Ring | null; self: SealedRole | null } | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [picked, setPicked] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [draft, setDraft] = useState<NewRoleDraft>({ ...EMPTY_DRAFT, name: target.title, areas: target.areaIds.map((areaId) => ({ areaId, capability: 'read' as const })) });
  const [label, setLabel] = useState(target.title);
  const [days, setDays] = useState(30);
  const [once, setOnce] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);

  const open = target.open === true && target.areaIds.length === 0;

  useEffect(() => {
    if (open) return undefined;
    let alive = true;
    void keysFor(who).then(({ ring, graph }) => { if (alive) setKeys({ ring, self: selfOf(graph) }); }).catch(() => { if (alive) setKeys({ ring: null, self: null }); });
    void areasNow().then((found) => { if (alive) setAreas(found); }).catch(() => undefined);
    return () => { alive = false; };
  }, [who, open]);

  const { roles, failed: rolesFailed } = useGivableRoles(keys?.ring ?? null);

  /*
   * Die Rolle, die zu ALLEN Bereichen führt, zuerst — und sie ist gleich gewählt.
   * Gibt es keine (ein neuer Bereich), ist eine neue Rolle gewählt, mit dem Namen
   * des Dings und Lesen in seinen Bereichen: ein Klick auf „Utwórz link" genügt.
   *
   * Entschieden wird erst, wenn die Rollen DIESER Schlüssel da sind — ohne
   * Schlüssel meldet der Hook sofort eine leere Liste, und dann wäre immer
   * „Nowa rola" gewählt.
   */
  const fitting = useMemo(() => (roles ?? []).filter((r) => target.areaIds.every((id) => r.areas.some((a) => a.areaId === id))), [roles, target.areaIds]);
  const [rolesAsked, setRolesAsked] = useState(false);
  useEffect(() => { if (keys !== null && roles === null) setRolesAsked(true); }, [keys, roles]);
  const rolesReady = keys !== null && roles !== null && (keys.ring === null || rolesAsked);
  useEffect(() => {
    if (picked.size > 0 || !rolesReady) return;
    if (fitting.length > 0) setPicked(new Map([[fitting[0].roleId, false]]));
    else if (target.areaIds.length > 0) setPicked(new Map([[NEW_ROLE, false]]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesReady, fitting]);

  const create = async () => {
    if (keys?.ring == null || keys.self === null) { setFailed('Najpierw podaj hasło — klucze nie są otwarte w tej karcie.'); return; }
    setBusy(picked.has(NEW_ROLE) ? 'Tworzenie roli i linku…' : 'Tworzenie linku…');
    setFailed(null);
    try {
      let ring = keys.ring;
      const chosen = [...picked].filter(([id]) => id !== NEW_ROLE).map(([roleId, lead]) => ({ roleId, lead }));
      if (picked.has(NEW_ROLE)) {
        const role = await createCommonRole(ring, keys.self, draft, setBusy);
        ring = role.ring;
        chosen.push({ roleId: role.roleId, lead: picked.get(NEW_ROLE) === true });
      }
      if (chosen.length === 0) throw new WorkspaceError('Wybierz rolę, którą daje link.');
      const out = await createLink(ring, keys.self, { label: label.trim() || target.title, roles: chosen, once, expiresDays: days, aim: target.aim });
      invalidate();
      setMade(out.url);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się utworzyć linku.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title={`Udostępnij: ${target.title}`} onClose={onClose}>
      {open ? (
        <>
          <p className="wk-hint">To jest publiczne — wystarczy ten adres. Kto go otworzy, zobaczy to bez logowania.</p>
          <LinkShare url={addressOf(target.aim)} />
        </>
      ) : made !== null ? (
        <>
          <p className="wk-done" role="status">Link gotowy. Kto go otworzy, ma dostęp od razu.</p>
          <LinkShare url={made} />
        </>
      ) : (
        <form className="wk-form wk-share" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <p className="wk-hint">
            Link daje rolę — a rola dostęp do swoich obszarów. Otworzy się od razu tutaj{target.aim === null ? '' : `: recreatio.pl/#/${target.aim}`}.
          </p>
          <CommonRoleChoice roles={roles} failed={rolesFailed} areas={areas} focusAreaId={target.areaIds[0]} many busy={busy !== null}
            picked={picked} onPicked={setPicked} draft={draft} onDraft={setDraft} leadLabel="może też zapraszać innych" />
          <details className="wk-fold">
            <summary>Nazwa, ważność, jednorazowy</summary>
            <label className="wk-field">
              <span>Nazwa linku (widzi ją ten, kto go otworzy)</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <label className="wk-field">
              <span>Ważny przez</span>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {EXPIRY.map((x) => <option key={x.days} value={x.days}>{x.label}</option>)}
              </select>
            </label>
            <label className="wk-check">
              <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} />
              <span>Jednorazowy — dla jednej osoby</span>
            </label>
          </details>
          {failed !== null && <p className="wk-error">{failed}</p>}
          {busy !== null && <p className="wk-working" role="status">{busy}</p>}
          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy !== null || picked.size === 0 || keys === null}>Utwórz link</button>
            <button type="button" className="wk-link-btn" onClick={onClose}>Anuluj</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default ShareButton;
