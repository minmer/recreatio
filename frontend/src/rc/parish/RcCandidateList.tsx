/**
 * Lista kandydatów — dla prowadzącego przygotowanie.
 *
 * <b>Widzi ją tylko ten, kto trzyma rolę urzędu.</b> Nie każdy, kto ma dostęp
 * do parafii: klucz przyjmowania należy do roli, nie do obszaru. Kto jej nie
 * trzyma, zobaczy kandydatów jako nieczytelnych — i zobaczy, że są. Dziura w
 * liście nie jest informacją, a liczby przestałyby się zgadzać.
 *
 * <b>Linki do SMS-ów są tu, ale nie na wierzchu.</b> Link to nie legitymacja,
 * tylko klucz: kto go ma, ma dane. Rozwija się go dla jednego kandydata, kiedy
 * jest potrzebny, zamiast wyświetlać wszystkie naraz na ekranie, który ktoś
 * może mieć za plecami.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  rcCandidateLinks, rcCandidatesOf, rcSetProgress,
  type RcAdminCandidate
} from './rcConfirmationAdmin';
import { rcPortalLinkFromSecret } from './rcCandidate';
import { RcRequestError } from '../lib/rcApi';

const STATUS: Record<string, string> = {
  enrolled: 'przyjęty',
  withdrawn: 'wycofany',
  confirmed: 'bierzmowany'
};

export function RcCandidateList({ groupId }: { groupId: string }) {
  const [list, setList] = useState<readonly RcAdminCandidate[]>([]);
  const [links, setLinks] = useState<Record<string, { secret: string | null; revoked: boolean }>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      /*
       * Beides zusammen: die Liste kommt auch ohne die Amtsrolle (dann
       * unlesbar), die Links nur mit ihr. Zwei Anfragen nacheinander liessen
       * die Seite einen Augenblick lang halb aussehen.
       */
      const [candidates, secrets] = await Promise.all([
        rcCandidatesOf(groupId),
        rcCandidateLinks(groupId)
      ]);

      setList(candidates.candidates ?? []);
      setLinks(Object.fromEntries(
        (secrets.links ?? []).map((l) => [
          l.candidateId ?? '',
          { secret: l.secret ?? null, revoked: l.revoked === true }
        ])
      ));
      setLoaded(true);
    } catch (e) {
      setError(e instanceof RcRequestError ? 'Nie udało się wczytać listy.' : 'Nie udało się wczytać listy.');
      setLoaded(true);
    }
  }, [groupId]);

  useEffect(() => { void load(); }, [load]);

  const mark = async (id: string, what: { paperReceived?: boolean; quizPassed?: boolean }) => {
    setBusy(id);
    setError(null);
    try { await rcSetProgress(id, what); await load(); }
    catch { setError('Nie udało się zapisać.'); }
    finally { setBusy(null); }
  };

  if (!loaded) return <p className="pb-hint">Wczytywanie…</p>;

  if (list.length === 0) {
    return (
      <div className="pb-content">
        <p className="pb-empty">
          Nie ma jeszcze zgłoszeń. Pojawią się tutaj, gdy ktoś wypełni formularz.
        </p>
      </div>
    );
  }

  const waiting = list.filter((c) => c.paperReceived !== true && c.status === 'enrolled').length;

  return (
    <div className="pb-content ca">
      <p className="pb-hint">
        {list.length} {list.length === 1 ? 'zgłoszenie' : 'zgłoszeń'}
        {waiting > 0 && <> · <strong>{waiting}</strong> czeka na zgodę rodzica</>}
      </p>

      {error !== null && <p className="ap-error">{error}</p>}

      <ul className="ca-list">
        {list.map((c) => {
          const id = c.candidateId ?? '';
          const link = links[id];
          const sealed = c.unreadable !== null && c.unreadable !== undefined;

          return (
            <li className="ca-row" key={id} data-sealed={sealed}>
              <div className="ca-head">
                {/* Ein Kandidat, den man nicht lesen kann, faellt NICHT aus der
                    Liste: dass jemand da ist, gehoert zur Auskunft. */}
                <span className="ca-name">
                  {sealed ? <em>zapieczętowane — brak klucza</em> : (c.name ?? '—')}
                </span>
                <span className="ca-status">{STATUS[c.status ?? ''] ?? c.status}</span>
              </div>

              {!sealed && (
                <ul className="ps-rows ca-fields">
                  {c.born !== null && c.born !== undefined && c.born !== '' && (
                    <li><span>Urodzony</span><em>{c.born}</em></li>
                  )}
                  {c.contact !== null && c.contact !== undefined && c.contact !== '' && (
                    <li><span>Kontakt</span><em>{c.contact}</em></li>
                  )}
                  {c.school !== null && c.school !== undefined && c.school !== '' && (
                    <li><span>Szkoła</span><em>{c.school}</em></li>
                  )}
                </ul>
              )}

              <div className="ca-marks">
                <label>
                  <input
                    type="checkbox"
                    checked={c.paperReceived === true}
                    disabled={busy === id}
                    onChange={(e) => void mark(id, { paperReceived: e.target.checked })}
                  />
                  <span>Zgoda rodzica na papierze</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={c.quizPassed === true}
                    disabled={busy === id}
                    onChange={(e) => void mark(id, { quizPassed: e.target.checked })}
                  />
                  <span>Zaliczone</span>
                </label>
              </div>

              {/*
                DER LINK IST EIN SCHLUESSEL.

                Deshalb steht er nicht offen in der Liste, sondern wird fuer
                EINEN Kandidaten aufgeklappt, wenn man ihn braucht. Ein Bildschirm
                mit dreissig Portallinks ist dreissig Datensaetze weit offen.
              */}
              {link !== undefined && (
                <div className="ca-link">
                  {link.revoked ? (
                    <span className="ps-muted">Link wyłączony przez właściciela konta.</span>
                  ) : link.secret === null ? (
                    <span className="ps-muted">Linku nie udało się odtworzyć.</span>
                  ) : open === id ? (
                    <LinkRow
                      secret={link.secret}
                      copied={copied === id}
                      onCopy={(text) => {
                        void navigator.clipboard?.writeText(text)
                          .then(() => setCopied(id))
                          .catch(() => setCopied(null));
                      }}
                      onHide={() => { setOpen(null); setCopied(null); }}
                    />
                  ) : (
                    <button type="button" className="rc-link-btn" onClick={() => setOpen(id)}>
                      Pokaż link do wysłania
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Der Link samt fertigem SMS-Text.
 *
 * Der Text steht daneben, weil das die eigentliche Handlung ist: niemand will
 * den Link, sondern eine Nachricht, die man abschicken kann. Ihn allein zu
 * zeigen hiesse, jedem dasselbe Formulieren zu ueberlassen.
 */
function LinkRow({
  secret, copied, onCopy, onHide
}: {
  secret: string;
  copied: boolean;
  onCopy: (text: string) => void;
  onHide: () => void;
}) {
  const link = `${window.location.origin}/${rcPortalLinkFromSecret(secret)}`;
  const sms = `Twoje zgłoszenie do bierzmowania: ${link} — zachowaj ten link, to jedyna droga do twoich danych.`;

  return (
    <div className="ca-link-open">
      <p className="ap-warn">
        Ten link otwiera dane kandydata. Wyślij go tylko jemu.
      </p>

      <div className="ap-link">
        <input type="text" value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={() => onCopy(link)}>{copied ? 'Skopiowano' : 'Kopiuj'}</button>
      </div>

      <div className="ca-sms">
        <button type="button" className="rc-link-btn" onClick={() => onCopy(sms)}>
          Kopiuj gotowy SMS
        </button>
        <button type="button" className="rc-link-btn" onClick={onHide}>Ukryj</button>
      </div>
    </div>
  );
}

export default RcCandidateList;
