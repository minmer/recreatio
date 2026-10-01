/**
 * LINKI DOSTĘPU (0065) — anlegen, wieder zeigen, zurückziehen.
 *
 * <b>Ein Link, mehrere Bereiche.</b> Wer ihn einlöst, steht danach in jedem
 * der gewählten Bereiche mit derselben Stufe — als Mensch mit eigenem Konto,
 * nicht als Platz. Deshalb die Frage „einmalig?": ein Link für EINE Person
 * hört nach dem Einlösen auf zu gelten; einer für eine Gruppe (die Rada, die
 * Schola) bleibt, bis er abläuft oder zurückgezogen wird.
 *
 * <b>Zurückziehen hat zwei Stärken.</b> Nur den Link (wer drin ist, bleibt),
 * oder den Link UND alle, die über ihn hereinkamen. Das zweite nimmt ihnen
 * den Schlüssel für Neues; was sie schon gelesen haben, haben sie.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import {
  createLink, linkState, linkUrlOf, loadLinks, revokeLink, LEVEL_WORD, LINK_LEVELS,
  type LinkLevel, type LinkRow
} from './linkAccess';
import type { AreaRow } from './area';
import type { Ring, SealedRole } from './keys';
import { WorkspaceError } from './session';
import { Segment } from './Areas';

/**
 * Was in diesem Tab eben angelegt wurde — sofort wieder zu zeigen, auch bevor der
 * Schlüsselbund die neue Linkrolle kennt (er wird nach dem Anlegen neu gebaut).
 */
const madeHere = new Map<string, string>();

const EXPIRY = [
  { days: 1, label: 'dzień' },
  { days: 7, label: 'tydzień' },
  { days: 30, label: 'miesiąc' },
  { days: 90, label: '3 miesiące' },
  { days: 365, label: 'rok' }
];

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
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać linków.');
    }
  }, []);

  useEffect(() => { void look(); }, [look]);

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
        ring={ring}
        self={self}
        areas={areas}
        focusAreaId={focusAreaId}
        busy={busy}
        onCreate={(what) => onAct('Tworzenie linku…', async () => {
          if (ring === null || self === null) throw new WorkspaceError('Najpierw podaj hasło.');
          const out = await createLink(ring, self, what);
          setMade({ url: out.url, label: what.label.trim() || 'Link' });
          madeHere.set(out.invitationId, out.url);
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
                onShow={async () => setShown({ id: row.invitationId, url: madeHere.get(row.invitationId) ?? (ring === null ? null : await linkUrlOf(ring, row)) })}
                onHide={() => setShown(null)}
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
    </div>
  );
}

function NewLink({ ring, self, areas, focusAreaId, busy, onCreate }: {
  ring: Ring | null;
  self: SealedRole | null;
  areas: readonly AreaRow[];
  focusAreaId?: string;
  busy: boolean;
  onCreate: (what: { label: string; areaIds: string[]; capability: LinkLevel; once: boolean; expiresDays: number }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [level, setLevel] = useState<LinkLevel>('read');
  const [once, setOnce] = useState(true);
  const [days, setDays] = useState(30);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(focusAreaId === undefined ? [] : [focusAreaId]));

  /* Nur Bereiche, in die ich hineinlassen darf — und nie der eigene, private. */
  const possible = areas.filter((a) => a.mayCertify && a.personal !== true);

  const blocker =
    ring === null ? 'Najpierw podaj hasło.'
    : self === null ? 'Konto nie prowadzi jeszcze żadnej osoby.'
    : picked.size === 0 ? 'Wybierz co najmniej jeden obszar.'
    : label.trim() === '' ? 'Nazwij link — np. „Rada parafialna" albo imię osoby.'
    : null;

  if (!open) {
    return (
      <button type="button" className="wk-tree-add" disabled={busy || possible.length === 0} onClick={() => setOpen(true)}>
        <span aria-hidden="true">+</span> Nowy link dostępu
      </button>
    );
  }

  return (
    <form className="wk-form wk-add-role" onSubmit={(e) => {
      e.preventDefault();
      if (blocker !== null) return;
      void onCreate({ label, areaIds: [...picked], capability: level, once, expiresDays: days }).then(() => {
        setOpen(false);
        setLabel('');
      });
    }}>
      <h3 className="wk-h2">Nowy link dostępu</h3>

      <label className="wk-field">
        <span>Dla kogo / po co</span>
        <input value={label} placeholder="np. Rada parafialna" autoComplete="off" onChange={(e) => setLabel(e.target.value)} />
        <span className="wk-hint">Nazwę widzi ten, kto otworzy link — zanim dołączy.</span>
      </label>

      <fieldset className="wk-field wk-link-areas">
        <legend>Obszary</legend>
        {possible.map((a) => (
          <label key={a.areaId} className="wk-check">
            <input type="checkbox" checked={picked.has(a.areaId)} onChange={(e) => setPicked((was) => {
              const next = new Set(was);
              if (e.target.checked) next.add(a.areaId); else next.delete(a.areaId);
              return next;
            })} />
            <span>{a.name}</span>
          </label>
        ))}
      </fieldset>

      <div className="wk-field">
        <span>Co może</span>
        <Segment now={level} busy={busy} onPick={setLevel}
          options={LINK_LEVELS.map((l) => ({ value: l.value, label: l.label }))} />
        <span className="wk-hint">{LINK_LEVELS.find((l) => l.value === level)?.says}.</span>
      </div>

      <label className="wk-check">
        <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} />
        <span>Jednorazowy — po dołączeniu jednej osoby link przestaje działać</span>
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

function LinkItem({ row, ring, busy, shown, onShow, onHide, onRevoke }: {
  row: LinkRow;
  ring: Ring | null;
  busy: boolean;
  /** `undefined`: zu; `null`: lässt sich nicht mehr zeigen; sonst die Adresse. */
  shown?: string | null;
  onShow?: () => Promise<void>;
  onHide?: () => void;
  onRevoke: (dropMembers: boolean) => Promise<void>;
}) {
  const state = linkState(row);
  const active = row.redeemed.filter((r) => r.active).length;
  const [asking, setAsking] = useState(false);

  return (
    <li className="wk-link-item">
      <div className="wk-link-head">
        <strong>{row.label ?? 'Link'}</strong>
        <span className="wk-tag">{LEVEL_WORD[row.capability ?? 'read'] ?? row.capability}</span>
        <span className={state === 'działa' ? 'wk-tag wk-tag-open' : 'wk-tag'}>{state}</span>
      </div>
      <p className="wk-hint">
        {row.areas.map((a) => a.name).join(' · ') || 'bez obszarów'}
        {' · '}{row.maxUses === 1 ? 'jednorazowy' : row.maxUses === null ? 'wielokrotny' : `do ${row.maxUses} osób`}
        {' · '}użyty {row.used}×{active > 0 ? `, ${active} z dostępem` : ''}
        {' · '}ważny do {new Date(row.expiresAt).toLocaleDateString('pl-PL')}
      </p>

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
          <p>Link przestanie działać. Co z tymi, którzy już przez niego dołączyli{active > 0 ? ` (${active})` : ''}?</p>
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
      <p className="wk-hint">Kto ma ten link, może dołączyć. Wysyłaj go tylko tym, dla których jest.</p>
    </div>
  );
}

export default AccessLinks;
