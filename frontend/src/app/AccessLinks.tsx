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
  accessWords, aimOf, createLink, heldLinkKeys, linkState, linkUrl, linkUrlOf, loadLinks, revokeLink, setLinkAim,
  type HeldInfo, type LinkRow
} from './linkAccess';
import { forgetLink } from './linkKeep';
import { createCommonRole, reachWords, type NewRoleDraft } from './commonRole';
import { CommonRoleChoice, EMPTY_DRAFT, NEW_ROLE, useGivableRoles } from './CommonRoleField';
import { markLinksSeen } from './notify';
import type { AreaRow } from './area';
import { loadDesk, type PageCard } from './desk';
import type { Ring, SealedRole } from './keys';
import { WorkspaceError } from './session';
import { describeLink, useHeldLinksStamp } from './HeldLinkBar';

/**
 * Was in diesem Tab eben angelegt wurde — das Geheimnis, sofort wieder zu
 * zeigen (auch mit geändertem Ziel), bevor der Schlüsselbund die neue
 * Linkrolle kennt (er wird nach dem Anlegen neu gebaut).
 */
const madeHere = new Map<string, string>();

const EXPIRY = [
  { days: 1, label: 'dzień' },
  { days: 7, label: 'tydzień' },
  { days: 30, label: 'miesiąc' },
  { days: 90, label: '3 miesiące' },
  { days: 365, label: 'rok' }
];

/** Ziele, die man nicht tippen muss: die eigenen Seiten (die der gewählten Bereiche zuerst) und Ansichten des Arbeitsplatzes. */
const VIEW_AIMS: readonly { aim: string; label: string }[] = [
  { aim: 'workspace/calendar', label: 'Kalendarz w warsztacie' },
  { aim: 'workspace/chat', label: 'Rozmowy w warsztacie' },
  { aim: 'workspace/areas', label: 'Obszary w warsztacie' }
];

function useAimChoices(areaIds: ReadonlySet<string>): readonly { aim: string; label: string }[] {
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
      ...sorted.map((p) => ({ aim: p.path, label: bound(p) ? 'strona tylko z dostępem dla wybranego obszaru' : (p.accessAreaIds ?? []).length > 0 ? 'strona tylko z dostępem' : 'strona' })),
      ...VIEW_AIMS
    ];
  }, [pages, areaIds]);
}

/** Wo der Link aufgeht — ein Weg hier, für Menschen lesbar. */
const aimWords = (aim: string | null): string => (aim === null ? 'strona dołączenia' : `recreatio.pl/#/${aim}`);

export function AccessLinks({ ring, self, areas, focusAreaId, busy, onAct }: {
  ring: Ring | null;
  self: SealedRole | null;
  areas: readonly AreaRow[];
  /** Im Bereich geöffnet: nur seine Links, und er ist vorgewählt. */
  focusAreaId?: string;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
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
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać linków.');
    }
  }, []);

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

  const open = mine.filter((l) => linkState(l) === 'działa');
  const closed = mine.filter((l) => linkState(l) !== 'działa');

  return (
    <div className="wk-links">
      {failed !== null && <p className="wk-error">{failed}</p>}

      {made !== null && (
        <div className="wk-link-made" role="status">
          <h3 className="wk-h2">Link gotowy: {made.label}</h3>
          <LinkShare url={made.url} />
          <button type="button" className="wk-link-btn" onClick={() => setMade(null)}>Zamknij</button>
        </div>
      )}

      <NewLink
        key={focusAreaId ?? 'all'}
        ring={ring}
        self={self}
        areas={areas}
        focusAreaId={focusAreaId}
        busy={busy}
        onCreate={(what) => onAct(what.draft === null ? 'Tworzenie linku…' : 'Tworzenie roli i linku…', async () => {
          if (ring === null || self === null) throw new WorkspaceError('Najpierw podaj hasło.');
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

      <h3 className="wk-h2">Działające linki</h3>
      {links === null ? <p className="wk-empty">Wczytywanie…</p>
        : open.length === 0 ? <p className="wk-empty">Nie ma działających linków.</p>
        : (
          <ul className="wk-link-list">
            {open.map((row) => (
              <LinkItem key={row.invitationId} row={row} ring={ring} busy={busy}
                shown={shown?.id === row.invitationId ? shown.url : undefined}
                onShow={async () => setShown({ id: row.invitationId, url: await urlOf(row) })}
                onHide={() => setShown(null)}
                onAim={(aim) => onAct('Zmiana celu linku…', async () => {
                  await setLinkAim(row.invitationId, aim);
                  await look();
                })}
                onRevoke={(drop) => onAct(drop ? 'Wycofywanie linku i dostępu…' : 'Wycofywanie linku…', async () => {
                  await revokeLink(row.invitationId, drop);
                  await look();
                })} />
            ))}
          </ul>
        )}

      {closed.length > 0 && (
        <details className="wk-links-old">
          <summary>Nieaktywne ({closed.length})</summary>
          <ul className="wk-link-list">
            {closed.map((row) => (
              <LinkItem key={row.invitationId} row={row} ring={ring} busy={busy}
                onRevoke={(drop) => onAct('Odbieranie dostępu…', async () => { await revokeLink(row.invitationId, drop); await look(); })} />
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
    ring === null ? 'Najpierw podaj hasło.'
    : self === null ? 'Konto nie prowadzi jeszcze żadnej osoby.'
    : picked.size === 0 ? 'Wybierz rolę, którą daje link — albo utwórz nową.'
    : picked.has(NEW_ROLE) && draft.name.trim() === '' ? 'Nazwij nową rolę.'
    : picked.has(NEW_ROLE) && draft.areas.length === 0 ? 'Zaznacz obszary, do których nowa rola daje dostęp.'
    : label.trim() === '' ? 'Nazwij link — np. „Rada parafialna" albo imię osoby.'
    : 'error' in aim ? aim.error
    : null;

  if (!open) {
    return (
      <button type="button" className="wk-tree-add" disabled={busy} onClick={() => setOpen(true)}>
        <span aria-hidden="true">+</span> Nowy link dostępu
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
      <h3 className="wk-h2">Nowy link dostępu</h3>

      <label className="wk-field">
        <span>Dla kogo / po co</span>
        <input value={label} placeholder="np. Rada parafialna" autoComplete="off" onChange={(e) => setLabel(e.target.value)} />
        <span className="wk-hint">Nazwę widzi ten, kto otworzy link — zanim dołączy.</span>
      </label>

      <CommonRoleChoice roles={roles} failed={failed} areas={areas} focusAreaId={focusAreaId} many busy={busy}
        picked={picked} onPicked={setPicked} draft={draft} onDraft={setDraft}
        leadLabel="może też zapraszać innych do tej roli" />
      <p className="wk-hint">Kto ma link, ma to, co daje rola. Zmienisz obszary roli — zmienią się dla wszystkich jej linków i formularzy.</p>

      <AimField value={aimText} onChange={setAimText} choices={choices} />

      <label className="wk-check">
        <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} />
        <span>Jednorazowy — po dołączeniu jednej osoby do konta link przestaje działać (wcześniej działa w każdej przeglądarce, w której go otwarto)</span>
      </label>

      <label className="wk-field">
        <span>Ważny przez</span>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {EXPIRY.map((x) => <option key={x.days} value={x.days}>{x.label}</option>)}
        </select>
      </label>

      {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || blocker !== null}>Utwórz link</button>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setOpen(false)}>Anuluj</button>
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
  const parsed = aimOf(value);
  const listId = useId();
  return (
    <label className="wk-field wk-link-aim">
      <span>Gdzie otwiera się link</span>
      <input list={listId} value={value} autoComplete="off" spellCheck={false}
        placeholder="np. parish/grzegorzki/oaza — albo wklej adres strony"
        onChange={(e) => onChange(e.target.value)} />
      <datalist id={listId}>
        {choices.map((c) => <option key={c.aim} value={c.aim}>{c.label}</option>)}
      </datalist>
      {'error' in parsed
        ? <span className="wk-error">{parsed.error}</span>
        : parsed.aim === null
          ? <span className="wk-hint">Puste: link otwiera stronę dołączenia. Z celem: otwiera tę stronę i od razu daje na niej dostęp — także bez konta, w tej przeglądarce.</span>
          : <span className="wk-hint">Otworzy: <a href={`#/${parsed.aim}`} target="_blank" rel="noopener noreferrer">{aimWords(parsed.aim)}</a> — {needsAccount(parsed.aim)
            ? 'ta część warsztatu wymaga konta: kto otworzy link, zaloguje się i doda go do konta. Bez konta działają strony i kalendarz.'
            : 'z dostępem od razu, także bez konta.'}</span>}
    </label>
  );
}

/** 0091 — die Namen der Rollen, die ein Link gibt (offen, wo mein Bund sie kennt). */
function useRoleNames(ring: Ring | null, ids: readonly string[]): readonly string[] {
  const [names, setNames] = useState<readonly string[]>([]);
  const key = ids.join(',');
  useEffect(() => {
    let alive = true;
    void (async () => {
      const out: string[] = [];
      for (const id of ids) out.push((ring === null ? null : await ring.name(id)) ?? 'rola');
      if (alive) setNames(out);
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ring, key]);
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
  const state = linkState(row);
  const active = row.redeemed.filter((r) => r.active).length;
  const [asking, setAsking] = useState(false);
  const [aiming, setAiming] = useState(false);
  const roleNames = useRoleNames(ring, row.roles ?? []);

  return (
    <li className="wk-link-item">
      <div className="wk-link-head">
        <strong>{row.label ?? 'Link'}</strong>
        <span className={state === 'działa' ? 'wk-tag wk-tag-open' : 'wk-tag'}>{state}</span>
      </div>
      {roleNames.length > 0 && <p className="wk-link-roles">{roleNames.length === 1 ? 'Rola' : 'Role'}: <strong>{roleNames.join(', ')}</strong>{row.capability === 'admin' ? ' (może zapraszać innych)' : ''}</p>}
      <p className="wk-hint">
        {roleNames.length > 0 ? reachWords(row.areas) : accessWords(row.areas)}
        {' · '}{row.maxUses === 1 ? 'jednorazowy' : row.maxUses === null ? 'wielokrotny' : `do ${row.maxUses} osób`}
        {' · '}użyty {row.used}×{active > 0 ? `, ${active} z dostępem` : ''}
        {' · '}ważny do {new Date(row.expiresAt).toLocaleDateString('pl-PL')}
      </p>
      <p className="wk-hint wk-link-aim-now">
        Otwiera: {row.aim === null ? 'stronę dołączenia' : <a href={`#/${row.aim}`}>{aimWords(row.aim)}</a>}
        {state === 'działa' && onAim !== undefined && !aiming && (
          <> · <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setAiming(true)}>Zmień cel</button></>
        )}
      </p>

      {aiming && onAim !== undefined && <AimEdit row={row} busy={busy} onAim={onAim} onDone={() => setAiming(false)} />}

      {shown !== undefined && (
        shown === null
          ? <p className="wk-note">Tego linku nie da się już pokazać — utwórz nowy.</p>
          : <LinkShare url={shown} />
      )}

      <div className="wk-actions">
        {state === 'działa' && onShow !== undefined && (shown === undefined
          ? <button type="button" className="wk-link-btn" disabled={ring === null && !madeHere.has(row.invitationId)} onClick={() => void onShow()}>Pokaż link</button>
          : <button type="button" className="wk-link-btn" onClick={onHide}>Ukryj</button>)}
        {state === 'działa' && (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setAsking(true)}>Wyłącz link…</button>
        )}
        {state !== 'działa' && active > 0 && (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void onRevoke(true)}>Odbierz dostęp ({active})</button>
        )}
      </div>

      {asking && (
        <div className="wk-confirm">
          <p>Link przestanie działać — także w przeglądarkach, w których go otwarto. Co z tymi, którzy dodali go do konta{active > 0 ? ` (${active})` : ''}?</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy} onClick={() => { setAsking(false); void onRevoke(false); }}>Zostają</button>
            <button type="button" className="wk-btn wk-btn-danger" disabled={busy} onClick={() => { setAsking(false); void onRevoke(true); }}>Też tracą dostęp</button>
            <button type="button" className="wk-link-btn" onClick={() => setAsking(false)}>Anuluj</button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Das Ziel eines bestehenden Links ändern — die Vorschläge werden erst hier geladen. */
function AimEdit({ row, busy, onAim, onDone }: { row: LinkRow; busy: boolean; onAim: (aim: string | null) => Promise<void>; onDone: () => void }) {
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
      <p className="wk-hint">Link zostaje ten sam — wysłany wcześniej nadal działa i prowadzi tam, gdzie prowadził. Nowy cel mają adresy pokazane od teraz.</p>
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || 'error' in parsed}>Zapisz cel</button>
        <button type="button" className="wk-link-btn" onClick={onDone}>Anuluj</button>
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
      <h3 className="wk-h2">Linki otwarte w tej przeglądarce</h3>
      <p className="wk-hint">Działają tu bez logowania i sumują się. Na koncie działają na każdym urządzeniu i pozwalają pisać.</p>
      <ul className="wk-link-list">
        {held.map((h) => {
          const owned = h.info !== null && ring !== null && ring.has(h.info.roleId);
          return (
            <li key={h.token} className="wk-link-item">
              <div className="wk-link-head">
                <strong>{h.label ?? 'Link'}</strong>
                <span className={h.info === null ? 'wk-tag' : 'wk-tag wk-tag-open'}>{h.info === null ? 'nie działa' : owned ? 'na koncie' : 'w przeglądarce'}</span>
              </div>
              {h.info !== null && <p className="wk-hint">{describeLink(h.info)} · ważny do {new Date(h.info.expiresAt).toLocaleDateString('pl-PL')}</p>}
              <div className="wk-actions">
                {h.info !== null && <a className="wk-link-btn" href={h.aim === null ? `#/dolacz/${h.token}` : `#/${h.aim}`}>Otwórz</a>}
                {h.info !== null && !owned && <a className="wk-link-btn" href={`#/dolacz/${h.token}`}>Dodaj do konta</a>}
                <button type="button" className="wk-link-btn" onClick={() => forgetLink(h.token)}>Usuń z przeglądarki</button>
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
  const [copied, setCopied] = useState(false);

  return (
    <div className="wk-link-share">
      <input className="wk-link-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); });
        }}>{copied ? 'Skopiowano' : 'Kopiuj'}</button>
        {typeof navigator.share === 'function' && (
          <button type="button" className="wk-link-btn" onClick={() => void navigator.share({ url, title: 'Zaproszenie do recreatio.pl' }).catch(() => undefined)}>
            Udostępnij
          </button>
        )}
      </div>
      <div className="wk-link-qr"><QRCodeSVG value={url} size={168} marginSize={2} /></div>
      <p className="wk-hint">Kto ma ten link, ma dostęp. Wysyłaj go tylko tym, dla których jest.</p>
    </div>
  );
}

export default AccessLinks;
