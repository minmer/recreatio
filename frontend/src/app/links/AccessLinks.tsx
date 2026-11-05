/**
 * LINKI DOSTĘPU (0065) — anlegen, wieder zeigen, zurückziehen.
 *
 * <b>0091: ein Link gibt eine ROLLE.</b> Gewählt wird nicht mehr Bereich für
 * Bereich, sondern die Rolle, die sagt, wozu sie führt („Rada parafialna —
 * Rada pisze · Ogłoszenia czyta") — oder gleich hier eine neue. Ändert sich
 * die Rolle, ändert sich jeder Link mit. Alte Links (direkt zu Bereichen)
 * stehen weiter in der Liste und gelten.
 *
 * <b>Ein Link, mehrere Bereiche.</b> Wer ihn einlöst, steht danach in jedem
 * der gewählten Bereiche mit derselben Stufe — als Mensch mit eigenem Konto,
 * nicht als Platz. Deshalb die Frage „einmalig?": ein Link für EINE Person
 * hört nach dem Einlösen auf zu gelten; einer für eine Gruppe (die Rada, die
 * Schola) bleibt, bis er abläuft oder zurückgezogen wird.
 *
 * <b>Mit Ziel (0073).</b> Ein Link kann eine Adresse öffnen — die Seite der
 * Gruppe, ihren Kalender —, und dort gilt der Zugang sofort, auch ohne Konto:
 * der Browser behält den Link wie die persönlichen Links der Formulare, und
 * mehrere Links addieren sich. Das Ziel lässt sich später ändern; der Link
 * bleibt derselbe.
 *
 * <b>Zurückziehen hat zwei Stärken.</b> Nur den Link (wer drin ist, bleibt),
 * oder den Link UND alle, die über ihn hereinkamen. Das zweite nimmt ihnen
 * den Schlüssel für Neues; was sie schon gelesen haben, haben sie.
 */

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import {
  accessWords, aimOf, createLink, heldLinkKeys, linkState, linkStateWord, linkUrl, linkUrlOf, loadLinks, revokeLink, setLinkAim,
  type HeldInfo, type LinkRow
} from './linkAccess';
import { forgetLink } from './linkKeep';
import { createCommonRole, reachWords, type NewRoleDraft } from '../roles/commonRole';
import { CommonRoleChoice, EMPTY_DRAFT, NEW_ROLE, useGivableRoles } from '../roles/CommonRoleField';
import { markLinksSeen } from '../notify/notify';
import type { AreaRow } from '../areas/area';
import { loadDesk, type PageCard } from '../workspace/desk';
import type { Ring, SealedRole } from '../core/keys';
import { WorkspaceError } from '../core/session';
import { describeLink, useHeldLinksStamp } from './HeldLinkBar';
import { Loading } from '../ui/Loading';
import { rich, useT, type T } from '../core/i18n';

/**
 * Was in diesem Tab eben angelegt wurde — das Geheimnis, sofort wieder zu
 * zeigen (auch mit geändertem Ziel), bevor der Schlüsselbund die neue
 * Linkrolle kennt (er wird nach dem Anlegen neu gebaut).
 */
const madeHere = new Map<string, string>();

export const EXPIRY = [
  { days: 1, label: 'links.expiry.day' },
  { days: 7, label: 'links.expiry.week' },
  { days: 30, label: 'links.expiry.month' },
  { days: 90, label: 'links.expiry.months3' },
  { days: 365, label: 'links.expiry.year' }
];

/** Ziele, die man nicht tippen muss: die eigenen Seiten (die der gewählten Bereiche zuerst) und Ansichten des Arbeitsplatzes. */
const VIEW_AIMS: readonly { aim: string; label: string }[] = [
  { aim: 'workspace/calendar', label: 'links.aim.view.calendar' },
  { aim: 'workspace/chat', label: 'links.aim.view.chat' },
  { aim: 'workspace/areas', label: 'links.aim.view.areas' }
];

function useAimChoices(areaIds: ReadonlySet<string>): readonly { aim: string; label: string }[] {
  const t = useT();
  const [pages, setPages] = useState<readonly PageCard[]>([]);
  useEffect(() => {
    let alive = true;
    loadDesk().then((desk) => { if (alive) setPages(desk.pages.filter((p) => p.aliasOf === null && p.path !== '')); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return useMemo(() => {
    const bound = (p: PageCard) => (p.accessAreaIds ?? []).some((a) => areaIds.has(a));
    const sorted = [...pages].sort((a, b) => Number(bound(b)) - Number(bound(a)) || a.path.localeCompare(b.path));
    return [
      ...sorted.map((p) => ({ aim: p.path, label: bound(p) ? t('links.aim.pageBound') : (p.accessAreaIds ?? []).length > 0 ? t('links.aim.pageAccess') : t('links.aim.page') })),
      ...VIEW_AIMS.map((one) => ({ aim: one.aim, label: t(one.label) }))
    ];
  }, [pages, areaIds, t]);
}

/** Wo der Link aufgeht — ein Weg hier, für Menschen lesbar. */
const aimWords = (aim: string | null, t: T): string => (aim === null ? t('links.aim.joinPage') : `recreatio.pl/#/${aim}`);

export function AccessLinks({ ring, self, areas, focusAreaId, busy, onAct }: {
  ring: Ring | null;
  self: SealedRole | null;
  areas: readonly AreaRow[];
  /** Im Bereich geöffnet: nur seine Links, und er ist vorgewählt. */
  focusAreaId?: string;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useT();
  const [links, setLinks] = useState<readonly LinkRow[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [made, setMade] = useState<{ url: string; label: string } | null>(null);
  const [shown, setShown] = useState<{ id: string; url: string | null } | null>(null);

  const look = useCallback(async () => {
    try {
      setLinks((await loadLinks()).invites);
      setFailed(null);
      /* 0090 — wer über Links hereinkam, steht hier: für das Konto gesehen. */
      markLinksSeen();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('links.list.loadFailed'));
    }
  }, [t]);

  useEffect(() => { void look(); }, [look]);

  const urlOf = async (row: LinkRow): Promise<string | null> => {
    const token = madeHere.get(row.invitationId);
    if (token !== undefined) return linkUrl(token, row.aim);
    return ring === null ? null : linkUrlOf(ring, row);
  };

  /* Ein anderer Bereich: was hier eben angelegt oder gezeigt wurde, gehört nicht dorthin. */
  useEffect(() => { setMade(null); setShown(null); }, [focusAreaId]);

  /* Ein gezeigter Link folgt seinem Ziel, wenn es sich ändert (dasselbe Geheimnis, eine andere Adresse). */
  const shownId = shown?.id ?? null;
  useEffect(() => {
    if (shownId === null || links === null) return undefined;
    const row = links.find((l) => l.invitationId === shownId);
    if (row === undefined) return undefined;
    let alive = true;
    void urlOf(row).then((url) => { if (alive) setShown((was) => (was?.id === shownId && was.url !== url ? { id: shownId, url } : was)); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, shownId]);

  const mine = useMemo(() => (links ?? []).filter((l) =>
    focusAreaId === undefined || l.areas.some((a) => a.areaId === focusAreaId)), [links, focusAreaId]);

  const open = mine.filter((l) => linkState(l) === 'active');
  const closed = mine.filter((l) => linkState(l) !== 'active');

  return (
    <div className="wk-links">
      {failed !== null && <p className="wk-error">{failed}</p>}

      {made !== null && (
        <div className="wk-link-made" role="status">
          <h3 className="wk-h2">{t('links.list.ready', { label: made.label })}</h3>
          <LinkShare url={made.url} />
          <button type="button" className="wk-link-btn" onClick={() => setMade(null)}>{t('common.close')}</button>
        </div>
      )}

      <NewLink
        key={focusAreaId ?? 'all'}
        ring={ring}
        self={self}
        areas={areas}
        focusAreaId={focusAreaId}
        busy={busy}
        onCreate={(what) => onAct(what.draft === null ? t('links.busy.create') : t('links.busy.createRole'), async () => {
          if (ring === null || self === null) throw new WorkspaceError(t('links.needPassword'));
          /* 0091 — eine neue Rolle zuerst; der Link hält sie danach wie jede andere. */
          let bund = ring;
          const roles = [...what.roles];
          if (what.draft !== null) {
            const made = await createCommonRole(ring, self, what.draft.role);
            bund = made.ring;
            roles.push({ roleId: made.roleId, lead: what.draft.lead });
          }
          const out = await createLink(bund, self, { label: what.label, roles, once: what.once, expiresDays: what.expiresDays, aim: what.aim });
          setMade({ url: out.url, label: what.label.trim() || 'Link' });
          madeHere.set(out.invitationId, out.token);
          await look();
        })}
      />

      <h3 className="wk-h2">{t('links.list.active')}</h3>
      {links === null ? <Loading />
        : open.length === 0 ? <p className="wk-empty">{t('links.list.noActive')}</p>
        : (
          <ul className="wk-link-list">
            {open.map((row) => (
              <LinkItem key={row.invitationId} row={row} ring={ring} busy={busy}
                shown={shown?.id === row.invitationId ? shown.url : undefined}
                onShow={async () => setShown({ id: row.invitationId, url: await urlOf(row) })}
                onHide={() => setShown(null)}
                onAim={(aim) => onAct(t('links.busy.aim'), async () => {
                  await setLinkAim(row.invitationId, aim);
                  await look();
                })}
                onRevoke={(drop) => onAct(drop ? t('links.busy.revokeAll') : t('links.busy.revoke'), async () => {
                  await revokeLink(row.invitationId, drop);
                  await look();
                })} />
            ))}
          </ul>
        )}

      {closed.length > 0 && (
        <details className="wk-links-old">
          <summary>{t('links.list.inactive', { count: closed.length })}</summary>
          <ul className="wk-link-list">
            {closed.map((row) => (
              <LinkItem key={row.invitationId} row={row} ring={ring} busy={busy}
                onRevoke={(drop) => onAct(t('links.busy.takeAccess'), async () => { await revokeLink(row.invitationId, drop); await look(); })} />
            ))}
          </ul>
        </details>
      )}

      <HeldHere ring={ring} />
    </div>
  );
}

/** Was ein neuer Link gibt (0091): Rollen — und vielleicht eine neue, die erst beim Absenden entsteht. */
export interface NewLinkWhat {
  label: string;
  roles: { roleId: string; lead: boolean }[];
  draft: { role: NewRoleDraft; lead: boolean } | null;
  once: boolean;
  expiresDays: number;
  aim: string | null;
}

function NewLink({ ring, self, areas, focusAreaId, busy, onCreate }: {
  ring: Ring | null;
  self: SealedRole | null;
  areas: readonly AreaRow[];
  focusAreaId?: string;
  busy: boolean;
  onCreate: (what: NewLinkWhat) => Promise<void>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [once, setOnce] = useState(true);
  const [days, setDays] = useState(30);
  const [aimText, setAimText] = useState('');
  /* 0091 — gewählte Rollen (→ führt, wer den Link einlöst, sie mit?) und der Entwurf einer neuen. */
  const [picked, setPicked] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [draft, setDraft] = useState<NewRoleDraft>(EMPTY_DRAFT);
  const { roles, failed } = useGivableRoles(open ? ring : null);

  /* Wohin die gewählten Rollen führen — die Seiten dieser Bereiche stehen beim Ziel vorne. */
  const reached = useMemo(() => new Set([
    ...(roles ?? []).filter((r) => picked.has(r.roleId)).flatMap((r) => r.areas.map((a) => a.areaId)),
    ...(picked.has(NEW_ROLE) ? draft.areas.map((a) => a.areaId) : [])
  ]), [roles, picked, draft]);
  const choices = useAimChoices(reached);
  const aim = aimOf(aimText);

  const blocker =
    ring === null ? t('links.needPassword')
    : self === null ? t('links.new.noPerson')
    : picked.size === 0 ? t('links.new.pickRole')
    : picked.has(NEW_ROLE) && draft.name.trim() === '' ? t('links.new.nameRole')
    : picked.has(NEW_ROLE) && draft.areas.length === 0 ? t('links.new.pickAreas')
    : label.trim() === '' ? t('links.new.nameLink')
    : 'error' in aim ? aim.error
    : null;

  if (!open) {
    return (
      <button type="button" className="wk-tree-add" disabled={busy} onClick={() => setOpen(true)}>
        <span aria-hidden="true">+</span> {t('links.new.title')}
      </button>
    );
  }

  return (
    <form className="wk-form wk-add-role" onSubmit={(e) => {
      e.preventDefault();
      if (blocker !== null || 'error' in aim) return;
      void onCreate({
        label,
        roles: [...picked].filter(([roleId]) => roleId !== NEW_ROLE).map(([roleId, lead]) => ({ roleId, lead })),
        draft: picked.has(NEW_ROLE) ? { role: draft, lead: picked.get(NEW_ROLE) === true } : null,
        once, expiresDays: days, aim: aim.aim
      }).then(() => {
        setOpen(false);
        setLabel('');
        setAimText('');
        setPicked(new Map());
        setDraft(EMPTY_DRAFT);
      });
    }}>
      <h3 className="wk-h2">{t('links.new.title')}</h3>

      <label className="wk-field">
        <span>{t('links.new.label')}</span>
        <input value={label} placeholder={t('links.new.labelPlaceholder')} autoComplete="off" onChange={(e) => setLabel(e.target.value)} />
        <span className="wk-hint">{t('links.new.labelHint')}</span>
      </label>

      <CommonRoleChoice roles={roles} failed={failed} areas={areas} focusAreaId={focusAreaId} many busy={busy}
        picked={picked} onPicked={setPicked} draft={draft} onDraft={setDraft}
        leadLabel={t('links.new.lead')} />
      <p className="wk-hint">{t('links.new.roleHint')}</p>

      <AimField value={aimText} onChange={setAimText} choices={choices} />

      <label className="wk-check">
        <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} />
        <span>{t('links.new.once')}</span>
      </label>

      <label className="wk-field">
        <span>{t('links.new.validFor')}</span>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {EXPIRY.map((x) => <option key={x.days} value={x.days}>{t(x.label)}</option>)}
        </select>
      </label>

      {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || blocker !== null}>{t('links.new.create')}</button>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setOpen(false)}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

/**
 * Braucht dieses Ziel ein Konto? Der Arbeitsplatz ja — bis auf den Kalender,
 * der mit einem Link auch ohne Konto aufgeht (`LinkCalendar`). Das Formular
 * sagte vorher bei jedem Ziel „także bez konta", und für die Rozmowy stimmte
 * es nicht.
 */
const needsAccount = (aim: string): boolean => {
  const [part, view] = aim.split('?')[0].split('/');
  return part === 'workspace' && view !== 'calendar';
};

/** Das Ziel: tippen, einfügen oder aus der Liste wählen. */
function AimField({ value, onChange, choices }: {
  value: string;
  onChange: (next: string) => void;
  choices: readonly { aim: string; label: string }[];
}) {
  const t = useT();
  const parsed = aimOf(value);
  const listId = useId();
  return (
    <label className="wk-field wk-link-aim">
      <span>{t('links.aim.label')}</span>
      <input list={listId} value={value} autoComplete="off" spellCheck={false}
        placeholder={t('links.aim.placeholder')}
        onChange={(e) => onChange(e.target.value)} />
      <datalist id={listId}>
        {choices.map((c) => <option key={c.aim} value={c.aim}>{c.label}</option>)}
      </datalist>
      {'error' in parsed
        ? <span className="wk-error">{parsed.error}</span>
        : parsed.aim === null
          ? <span className="wk-hint">{t('links.aim.empty')}</span>
          : <span className="wk-hint">{t('links.aim.willOpen')} <a href={`#/${parsed.aim}`} target="_blank" rel="noopener noreferrer">{aimWords(parsed.aim, t)}</a> — {needsAccount(parsed.aim)
            ? t('links.aim.needsAccount')
            : t('links.aim.noAccount')}</span>}
    </label>
  );
}

/** 0091 — die Namen der Rollen, die ein Link gibt (offen, wo mein Bund sie kennt). */
function useRoleNames(ring: Ring | null, ids: readonly string[]): readonly string[] {
  const t = useT();
  const [names, setNames] = useState<readonly string[]>([]);
  const key = ids.join(',');
  useEffect(() => {
    let alive = true;
    void (async () => {
      const out: string[] = [];
      for (const id of ids) out.push((ring === null ? null : await ring.name(id)) ?? t('links.item.someRole'));
      if (alive) setNames(out);
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ring, key, t]);
  return names;
}

function LinkItem({ row, ring, busy, shown, onShow, onHide, onAim, onRevoke }: {
  row: LinkRow;
  ring: Ring | null;
  busy: boolean;
  /** `undefined`: zu; `null`: lässt sich nicht mehr zeigen; sonst die Adresse. */
  shown?: string | null;
  onShow?: () => Promise<void>;
  onHide?: () => void;
  onAim?: (aim: string | null) => Promise<void>;
  onRevoke: (dropMembers: boolean) => Promise<void>;
}) {
  const t = useT();
  const state = linkState(row);
  const active = row.redeemed.filter((r) => r.active).length;
  const [asking, setAsking] = useState(false);
  const [aiming, setAiming] = useState(false);
  const roleNames = useRoleNames(ring, row.roles ?? []);

  return (
    <li className="wk-link-item">
      <div className="wk-link-head">
        <strong>{row.label ?? 'Link'}</strong>
        <span className={state === 'active' ? 'wk-tag wk-tag-open' : 'wk-tag'}>{linkStateWord(state, t.lang)}</span>
      </div>
      {roleNames.length > 0 && <p className="wk-link-roles">{rich(t('links.item.roles', { count: roleNames.length, names: roleNames.join(', ') }), { b: (s) => <strong>{s}</strong> })}{row.capability === 'admin' ? ` ${t('links.item.canInvite')}` : ''}</p>}
      <p className="wk-hint">
        {roleNames.length > 0 ? reachWords(row.areas) : accessWords(row.areas)}
        {' · '}{row.maxUses === 1 ? t('links.item.once') : row.maxUses === null ? t('links.item.many') : t('links.item.upTo', { count: row.maxUses })}
        {' · '}{active > 0 ? t('links.item.usedActive', { count: row.used, active }) : t('links.item.used', { count: row.used })}
        {' · '}{t('links.item.validUntil', { date: new Date(row.expiresAt).toLocaleDateString(t.locale) })}
      </p>
      <p className="wk-hint wk-link-aim-now">
        {t('links.item.opens')} {row.aim === null ? t('links.item.joinPage') : <a href={`#/${row.aim}`}>{aimWords(row.aim, t)}</a>}
        {state === 'active' && onAim !== undefined && !aiming && (
          <> · <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setAiming(true)}>{t('links.item.changeAim')}</button></>
        )}
      </p>

      {aiming && onAim !== undefined && <AimEdit row={row} busy={busy} onAim={onAim} onDone={() => setAiming(false)} />}

      {shown !== undefined && (
        shown === null
          ? <p className="wk-note">{t('links.item.cannotShow')}</p>
          : <LinkShare url={shown} />
      )}

      <div className="wk-actions">
        {state === 'active' && onShow !== undefined && (shown === undefined
          ? <button type="button" className="wk-link-btn" disabled={ring === null && !madeHere.has(row.invitationId)} onClick={() => void onShow()}>{t('links.item.show')}</button>
          : <button type="button" className="wk-link-btn" onClick={onHide}>{t('links.item.hide')}</button>)}
        {state === 'active' && (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setAsking(true)}>{t('links.item.disable')}</button>
        )}
        {state !== 'active' && active > 0 && (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void onRevoke(true)}>{t('links.item.takeAccess', { count: active })}</button>
        )}
      </div>

      {asking && (
        <div className="wk-confirm">
          <p>{active > 0 ? t('links.item.revokeAskCount', { count: active }) : t('links.item.revokeAsk')}</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy} onClick={() => { setAsking(false); void onRevoke(false); }}>{t('links.item.keep')}</button>
            <button type="button" className="wk-btn wk-btn-danger" disabled={busy} onClick={() => { setAsking(false); void onRevoke(true); }}>{t('links.item.dropToo')}</button>
            <button type="button" className="wk-link-btn" onClick={() => setAsking(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Das Ziel eines bestehenden Links ändern — die Vorschläge werden erst hier geladen. */
function AimEdit({ row, busy, onAim, onDone }: { row: LinkRow; busy: boolean; onAim: (aim: string | null) => Promise<void>; onDone: () => void }) {
  const t = useT();
  const [value, setValue] = useState(row.aim ?? '');
  const choices = useAimChoices(useMemo(() => new Set(row.areas.map((a) => a.areaId)), [row.areas]));
  const parsed = aimOf(value);
  return (
    <form className="wk-link-aim-edit" onSubmit={(e) => {
      e.preventDefault();
      if ('error' in parsed) return;
      void onAim(parsed.aim).then(onDone);
    }}>
      <AimField value={value} onChange={setValue} choices={choices} />
      <p className="wk-hint">{t('links.item.aimHint')}</p>
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || 'error' in parsed}>{t('links.item.saveAim')}</button>
        <button type="button" className="wk-link-btn" onClick={onDone}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

/**
 * LINKI W TEJ PRZEGLĄDARCE (0073) — die Links, die hier geöffnet wurden: was
 * sie geben, ob sie noch gelten, ob sie schon im Konto sind; dem Konto
 * hinzufügen oder aus dem Browser nehmen.
 */
function HeldHere({ ring }: { ring: Ring | null }) {
  const t = useT();
  const stamp = useHeldLinksStamp();
  const [held, setHeld] = useState<readonly HeldInfo[] | null>(null);

  useEffect(() => {
    let alive = true;
    if (stamp === '') { setHeld([]); return undefined; }
    heldLinkKeys().then((k) => { if (alive) setHeld(k.links); }).catch(() => { if (alive) setHeld([]); });
    return () => { alive = false; };
  }, [stamp]);

  if (held === null || held.length === 0) return null;

  return (
    <section className="wk-held-here">
      <h3 className="wk-h2">{t('links.held.title')}</h3>
      <p className="wk-hint">{t('links.held.lede')}</p>
      <ul className="wk-link-list">
        {held.map((h) => {
          const owned = h.info !== null && ring !== null && ring.has(h.info.roleId);
          return (
            <li key={h.token} className="wk-link-item">
              <div className="wk-link-head">
                <strong>{h.label ?? 'Link'}</strong>
                <span className={h.info === null ? 'wk-tag' : 'wk-tag wk-tag-open'}>{h.info === null ? t('links.held.dead') : owned ? t('links.held.onAccount') : t('links.held.inBrowser')}</span>
              </div>
              {h.info !== null && <p className="wk-hint">{describeLink(h.info)} · {t('links.item.validUntil', { date: new Date(h.info.expiresAt).toLocaleDateString(t.locale) })}</p>}
              <div className="wk-actions">
                {h.info !== null && <a className="wk-link-btn" href={h.aim === null ? `#/dolacz/${h.token}` : `#/${h.aim}`}>{t('common.open')}</a>}
                {h.info !== null && !owned && <a className="wk-link-btn" href={`#/dolacz/${h.token}`}>{t('links.held.addToAccount')}</a>}
                <button type="button" className="wk-link-btn" onClick={() => forgetLink(h.token)}>{t('links.held.forget')}</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Adresse, Kopieren, Teilen, QR. */
export function LinkShare({ url }: { url: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  return (
    <div className="wk-link-share">
      <input className="wk-link-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); });
        }}>{copied ? t('common.copied') : t('common.copy')}</button>
        {typeof navigator.share === 'function' && (
          <button type="button" className="wk-link-btn" onClick={() => void navigator.share({ url, title: t('links.share.title') }).catch(() => undefined)}>
            {t('common.share')}
          </button>
        )}
      </div>
      <div className="wk-link-qr"><QRCodeSVG value={url} size={168} marginSize={2} /></div>
      <p className="wk-hint">{t('links.share.warn')}</p>
    </div>
  );
}

export default AccessLinks;
