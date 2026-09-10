/**
 * Der Weg hinein — Einladungen, und wer im Bereich ist.
 *
 * Vier Stellen hier sind Entscheidungen, keine Kosmetik:
 *
 *   1. **Das Geheimnis wird EINMAL gezeigt, mit dem Grund dazu.** Der Schlüssel
 *      reist im Link, nicht in der Datenbank — niemand kann ihn
 *      wiederherstellen, auch der Betreiber nicht. Ohne diesen Satz sieht die
 *      Einmaligkeit wie eine Schikane aus statt wie das, was sie ist: die
 *      Zusage, die den ganzen Aufbau trägt.
 *
 *   2. **„Auch die Vergangenheit" ist aus und steht mit seiner Folge da.**
 *      Ausgehändigte Epochenschlüssel sind ausgehändigt; das lässt sich nicht
 *      zurücknehmen, und wer es anklickt, soll das vorher gelesen haben.
 *
 *   3. **Ein schon geöffneter Link, der nie ankam, ist ein Vorfall** (10.3).
 *      Die Spalte steht deshalb sichtbar in der Liste und nicht in einer
 *      Detailansicht, die niemand aufmacht.
 *
 *   4. **„Entfernen" sagt, was es NICHT tut.** Es sperrt für die Zukunft, nicht
 *      rückwirkend. Wer glaubt, er habe jemanden aus der Vergangenheit
 *      ausgesperrt, trifft die nächste Entscheidung auf falscher Grundlage.
 */

import { useCallback, useEffect, useState } from 'react';
import { rcCopy, rcFormat, rcPlural, type RcLang } from './i18n';
import { rcCreateRole, type RcRole } from './lib/rcChat';
import {
  rcCreateInvitation, rcInviteLink, rcInviteOpened, rcInviteSpent,
  rcInvitations, rcMembers, rcPeekInvitation, rcRedeemInvitation, rcRemoveMember,
  rcRevokeInvitation,
  type RcInvitation, type RcInvitationCreated, type RcInvitationPeek, type RcMember
} from './lib/rcInvite';
import { useRcError } from './RcThreads';

// -- Personen und Einladungen im Bereich --------------------------------------

export function RcPeople({
  lang, areaId, roles, canCertify, onError, onChanged
}: {
  lang: RcLang;
  areaId: string;
  roles: readonly RcRole[];
  canCertify: boolean;
  onError: (message: string) => void;
  onChanged: () => void;
}) {
  const t = rcCopy[lang].invite;
  const describe = useRcError(lang);

  const [members, setMembers] = useState<readonly RcMember[]>([]);
  const [invitations, setInvitations] = useState<readonly RcInvitation[]>([]);
  const [fresh, setFresh] = useState<RcInvitationCreated | null>(null);

  const refresh = useCallback(async () => {
    try {
      const m = await rcMembers(areaId);
      setMembers(m.members ?? []);
      if (canCertify) setInvitations((await rcInvitations()).invitations ?? []);
    } catch (e) {
      onError(describe(e));
    }
  }, [areaId, canCertify, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  const mine = new Set(roles.map((r) => r.roleId));

  return (
    <div className="rc-panel">
      <h4 className="rc-chat-h">{t.members}</h4>

      {members.length === 0 ? (
        <p className="rc-note">{t.noMembers}</p>
      ) : (
        <ul className="rc-member-list">
          {members.map((member) => (
            <li key={member.roleId} className="rc-member">
              <span className="rc-member-id">{member.roleId.slice(0, 8)}</span>
              <span className="rc-member-cap">
                {t.capability} {t.caps[member.capability] ?? member.capability}
              </span>
              <span className="rc-member-keys">
                {rcPlural(lang, t.epochGrants, member.epochGrants)}
              </span>

              {canCertify && !mine.has(member.roleId) && (
                <button
                  type="button"
                  className="rc-msg-action"
                  title={t.removeWhy}
                  onClick={async () => {
                    try { await rcRemoveMember(areaId, member.roleId); await refresh(); onChanged(); }
                    catch (e) { onError(describe(e)); }
                  }}
                >
                  {t.remove}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Was Entfernen NICHT tut, steht dabei — nicht nur als Titel an einem
          Knopf, den niemand mit der Maus berührt. */}
      {canCertify && members.length > 0 && <p className="rc-note rc-remove-why">{t.removeWhy}</p>}

      {canCertify && (
        <>
          <h4 className="rc-chat-h">{t.invitations}</h4>

          {fresh !== null ? (
            <RcFreshLink lang={lang} created={fresh} onDone={() => { setFresh(null); void refresh(); }} />
          ) : (
            <>
              {invitations.length === 0 && <p className="rc-note">{t.noInvitations}</p>}

              <ul className="rc-invite-list">
                {invitations.map((invitation) => (
                  <RcInviteRow
                    key={invitation.invitationId}
                    lang={lang}
                    invitation={invitation}
                    onRevoke={async () => {
                      try { await rcRevokeInvitation(invitation.invitationId); await refresh(); }
                      catch (e) { onError(describe(e)); }
                    }}
                  />
                ))}
              </ul>

              <RcNewInvite
                lang={lang}
                roles={roles}
                onCreated={setFresh}
                onError={onError}
                onRolesChanged={onChanged}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function RcInviteRow({
  lang, invitation, onRevoke
}: {
  lang: RcLang;
  invitation: RcInvitation;
  onRevoke: () => Promise<void>;
}) {
  const t = rcCopy[lang].invite;
  const spent = rcInviteSpent(invitation);
  const opened = rcInviteOpened(invitation);

  return (
    <li className="rc-invite" data-spent={spent}>
      <div className="rc-invite-main">
        <span className="rc-invite-label">{invitation.label ?? invitation.invitationId.slice(0, 8)}</span>
        <span className="rc-invite-meta">
          {spent ? t.spent : rcFormat(t.expires, {
            when: new Date(invitation.expiresUtc).toLocaleDateString(lang)
          })}
          {' · '}
          {rcFormat(t.used, { n: invitation.useCount })}
          {invitation.maxUses !== null && invitation.maxUses !== undefined && ` / ${invitation.maxUses}`}
        </span>

        {/* 10.3 — Ein Link, der geöffnet wurde, bevor er ankam, ist unterwegs
            gelesen worden. Das gehört sichtbar und nicht in eine Ecke. */}
        {opened && (
          <span className="rc-invite-opened" title={t.openedWhy}>
            {rcFormat(t.opened, {
              when: new Date(invitation.firstOpenedUtc!).toLocaleString(lang)
            })}
          </span>
        )}
      </div>

      {!spent && (
        <button type="button" className="rc-btn rc-btn-quiet" onClick={() => void onRevoke()}>
          {t.revoke}
        </button>
      )}
    </li>
  );
}

/**
 * Der Link, einmal. Danach ist er weg — und das steht dabei, mit dem Grund.
 */
function RcFreshLink({
  lang, created, onDone
}: {
  lang: RcLang;
  created: RcInvitationCreated;
  onDone: () => void;
}) {
  const t = rcCopy[lang].invite;
  const [copied, setCopied] = useState(false);
  const link = rcInviteLink(created.secret);

  return (
    <div className="rc-fresh-link">
      <strong>{t.linkReady}</strong>
      <p className="rc-note">{t.linkOnce}</p>

      <code className="rc-secret">{link}</code>

      <div className="rc-fresh-actions">
        <button
          type="button"
          className="rc-btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {
              // Ohne Zwischenablage bleibt der Link lesbar da stehen — dann
              // markiert man ihn eben von Hand. Ein Fehlerhinweis wäre hier
              // Lärm über etwas, das gar nichts kaputtmacht.
            }
          }}
        >
          {copied ? t.copied : t.copy}
        </button>
        <button type="button" className="rc-btn rc-btn-quiet" onClick={onDone}>
          {t.done}
        </button>
      </div>
    </div>
  );
}

function RcNewInvite({
  lang, roles, onCreated, onError, onRolesChanged
}: {
  lang: RcLang;
  roles: readonly RcRole[];
  onCreated: (created: RcInvitationCreated) => void;
  onError: (message: string) => void;
  onRolesChanged: () => void;
}) {
  const t = rcCopy[lang].invite;
  const describe = useRcError(lang);

  // Gruppen zuerst: wer eine hat, soll nicht erst an der persönlichen Rolle
  // vorbeimüssen, um das Richtige zu tun.
  const usable = [...roles.filter((r) => r.hasKey)]
    .sort((a, b) => Number(a.kind === 'person') - Number(b.kind === 'person'));

  const [roleId, setRoleId] = useState(usable[0]?.roleId ?? '');
  const [label, setLabel] = useState('');
  const [groupName, setGroupName] = useState('');
  const [days, setDays] = useState(30);
  const [maxUses, setMaxUses] = useState<number | null>(1);
  const [forSms, setForSms] = useState(false);
  const [busy, setBusy] = useState(false);

  if (usable.length === 0) return null;

  const chosen = usable.find((r) => r.roleId === roleId);
  const personal = chosen?.kind === 'person';

  /**
   * Eine Gruppe anlegen, ohne die Seite zu verlassen.
   *
   * Ohne diesen Weg wäre die Warnung darunter nur ein Vorwurf: „tu das nicht"
   * ohne „tu stattdessen das". Wer gerade jemanden einladen will, soll nicht
   * erst woanders hingehen müssen — sonst nimmt er die persönliche Rolle, weil
   * sie eben da ist.
   */
  const makeGroup = async () => {
    if (groupName.trim().length === 0 || busy) return;
    setBusy(true);
    try {
      const made = await rcCreateRole(
        roles.find((r) => r.kind === 'person')?.roleId ?? roleId, 'group', groupName);
      setGroupName('');
      onRolesChanged();
      setRoleId(made.roleId);
    } catch (err) {
      onError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="rc-new-invite"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
          onCreated(await rcCreateInvitation(roleId, {
            label: label.trim().length > 0 ? label : undefined,
            daysValid: days,
            maxUses: maxUses ?? undefined,
            forSms
          }));
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h5 className="rc-chat-h">{t.create}</h5>

      {/* Der Wähler steht IMMER da, auch bei nur einer Rolle: wer eine
          Einladung ausstellt, verschickt einen Schlüssel, und er muss sehen,
          welchen. */}
      <label className="rc-inline-field">
        <span>{rcCopy[lang].chat.writingAs}</span>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          {usable.map((r) => (
            <option key={r.roleId} value={r.roleId}>{r.displayName ?? r.roleId.slice(0, 8)}</option>
          ))}
        </select>
      </label>

      {/* Die gefährlichste Verwechslung der ganzen Plattform: eine Einladung
          teilt eine ROLLE, nicht einen Bereich. Wer seine persönliche Rolle
          verschickt, verschickt sein halbes Konto — und nichts schlägt fehl. */}
      {personal && (
        <div className="rc-personal-warning">
          <p>{t.personalWarning}</p>

          <div className="rc-make-group">
            <input
              type="text"
              value={groupName}
              placeholder={t.groupName}
              disabled={busy}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <button
              type="button"
              className="rc-btn"
              disabled={busy || groupName.trim().length === 0}
              onClick={() => void makeGroup()}
            >
              {t.newGroup}
            </button>
          </div>
        </div>
      )}

      <label className="rc-field">
        <span>{t.label}</span>
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} disabled={busy} />
      </label>
      <p className="rc-note rc-hint">{t.labelHint}</p>

      <div className="rc-poll-opts">
        <label className="rc-inline-field">
          <span>{t.daysValid}</span>
          <input
            type="number"
            min={forSms ? 7 : 1}
            max={365}
            value={days}
            disabled={busy}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </label>

        <label className="rc-inline-field">
          <span>{t.maxUses}</span>
          <input
            type="number"
            min={1}
            max={999}
            value={maxUses ?? ''}
            placeholder={t.unlimited}
            disabled={busy}
            onChange={(e) => setMaxUses(e.target.value === '' ? null : Number(e.target.value))}
          />
        </label>
      </div>

      <label className="rc-check">
        <input
          type="checkbox"
          checked={forSms}
          disabled={busy}
          onChange={(e) => {
            setForSms(e.target.checked);
            // 10.4 — Der SMS-Weg verlangt mindestens sieben Tage. Den Wert hier
            // gleich hochzuziehen ist ehrlicher, als ihn stehen zu lassen und
            // den Dienst später ablehnen zu lassen.
            if (e.target.checked && days < 7) setDays(7);
          }}
        />
        <span>{t.forSms}</span>
      </label>
      {forSms && <p className="rc-note rc-hint">{t.forSmsWhy}</p>}

      <button type="submit" className="rc-btn" disabled={busy}>
        {busy ? t.issuing : t.issue}
      </button>
    </form>
  );
}

// -- Jemand kommt über einen Link ---------------------------------------------

/**
 * Was jemand sieht, der einen Einladungslink öffnet.
 *
 * Erst ansehen, dann entscheiden: der Dienst sagt ohne Konto, wohinein der Link
 * führt. Erst danach — und nur mit angemeldetem, entsperrtem Konto — wird
 * eingelöst. „Einlösen" ist damit eine Entscheidung und kein Sprung ins Dunkle.
 */
export function RcInviteBanner({
  lang, secret, canRedeem, onDone
}: {
  lang: RcLang;
  secret: string;
  /**
   * Angemeldet UND entsperrt. Beides muss stimmen und ist deshalb EIN Wert:
   * zwei Merker, die immer gleich gesetzt werden, laufen irgendwann
   * auseinander, und dann steht der Knopf da, obwohl er nicht kann.
   */
  canRedeem: boolean;
  onDone: () => void;
}) {
  const t = rcCopy[lang].invite;
  const describe = useRcError(lang);

  const [peek, setPeek] = useState<RcInvitationPeek | null>(null);
  const [state, setState] = useState<'looking' | 'ready' | 'invalid' | 'done' | 'already'>('looking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const view = await rcPeekInvitation(secret);
        if (!cancelled) { setPeek(view); setState('ready'); }
      } catch {
        // Ein ungültiger Link ist kein Systemfehler, sondern der häufigste
        // Fall überhaupt: abgelaufen, verbraucht, falsch abgeschrieben.
        if (!cancelled) setState('invalid');
      }
    })();
    return () => { cancelled = true; };
  }, [secret]);

  if (state === 'looking') return null;

  return (
    <div className="rc-invite-banner" data-state={state}>
      {state === 'invalid' && <strong>{t.invalid}</strong>}

      {state === 'done' && <strong>{t.accepted}</strong>}
      {state === 'already' && <strong>{t.alreadyIn}</strong>}

      {state === 'ready' && peek !== null && (
        <>
          <strong>{t.youWereInvited}</strong>
          <p>{rcFormat(t.leadsTo, { label: peek.label ?? peek.purpose })}</p>

          {/* Der Link ist kein Anmeldeweg (3.12). Wer noch kein Konto hat,
              legt eines an — ganz normal — und verbindet ihn danach. */}
          {!canRedeem ? (
            <p className="rc-note">{t.needAccount}</p>
          ) : (
            <button
              type="button"
              className="rc-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await rcRedeemInvitation(secret);
                  setState(result.alreadyRedeemed ? 'already' : 'done');
                  onDone();
                } catch (e) {
                  setError(describe(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? t.accepting : t.accept}
            </button>
          )}
        </>
      )}

      {error !== null && <p className="rc-auth-error">{error}</p>}

      <button type="button" className="rc-msg-action rc-banner-close" onClick={onDone}>
        {t.dismiss}
      </button>
    </div>
  );
}

/*
 * `rcAddMember` wird hier ABSICHTLICH nicht angeboten.
 *
 * Es verlangt die Rollenkennung des Neuen, und die kann die Oberfläche gar
 * nicht kennen: es gibt kein Verzeichnis der Rollen (3.4), und das ist keine
 * Lücke, sondern der Punkt. Wer jemanden hineinbitten will, stellt eine
 * Einladung aus — dann bringt der Eingeladene seine Rolle selbst mit. Ein
 * Eingabefeld für eine fremde Rollenkennung wäre eine Aufforderung, sich diese
 * Kennungen irgendwo anders zu besorgen, und genau das soll es nicht geben.
 */
