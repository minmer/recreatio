/**
 * Karta „Bierzmowanie" w edytorze strony parafii.
 *
 * <b>Wer die Anmeldungen liest, wird HIER bestätigt.</b> Der Annahmeschlüssel
 * gehört einer Rolle und nicht dem Bereich: wer den Messplan pflegt, bekommt
 * damit keinen Zugang zu den Akten der Kinder. Beim Einrichten übernimmt sie
 * der, der einrichtet — weitergeben geht danach wie bei jeder anderen Rolle.
 *
 * <b>Das Speichern verlangt eine Bestätigung.</b> Nicht als Höflichkeitsfrage:
 * mit dem Öffnen der Anmeldungen beginnen fremde Kinder, ihre Daten
 * herzuschicken. Wer das einschaltet, soll in demselben Augenblick lesen, wer
 * sie danach sehen kann.
 */

import { useCallback, useEffect, useState } from 'react';

import { rcConfirmationSetUp, rcOpenApplications, rcReadConfirmation } from './rcConfirmationAdmin';
import { rcRoles } from '../lib/rcChat';
import { RcRequestError } from '../lib/rcApi';
import { RC_HASH_BASE } from '../lib/rcRoute';
import { RcCandidateList } from './RcCandidateList';

type SetUp = {
  groupId: string | null;
  name: string | null;
  leaderRoleId: string | null;
  open: boolean;
};

export function RcConfirmationTab({ parishId, slug }: { parishId: string; slug: string }) {
  const [setUp, setSetUp] = useState<SetUp | null>(null);
  const [personRoleId, setPersonRoleId] = useState<string | null>(null);
  const [roleNames, setRoleNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Die Bestätigung vor dem Öffnen. Ohne sie geht der Schalter nicht um. */
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    try {
      const [found, roles] = await Promise.all([rcReadConfirmation(parishId), rcRoles()]);

      setSetUp({
        groupId: found.groupId ?? null,
        name: found.name ?? null,
        leaderRoleId: found.leaderRoleId ?? null,
        open: found.open === true
      });

      const list = roles.roles ?? [];
      setPersonRoleId(list.find((r) => r.kind === 'person')?.roleId ?? null);
      setRoleNames(Object.fromEntries(
        list.map((r) => [r.roleId ?? '', r.displayName ?? '—'])
      ));
    } catch (e) {
      setError(e instanceof RcRequestError ? 'Nie udało się wczytać.' : 'Nie udało się wczytać.');
    }
  }, [parishId]);

  useEffect(() => { void load(); }, [load]);

  if (setUp === null) return <p className="pb-hint">Wczytywanie…</p>;

  const run = async (what: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await what(); await load(); }
    catch (e) {
      setError(e instanceof RcRequestError
        ? 'Nie udało się. Sprawdź, czy masz uprawnienia i odblokowane klucze.'
        : 'Nie udało się.');
    }
    finally { setBusy(false); setConfirming(false); }
  };

  /* -- Noch gar nichts eingerichtet ---------------------------------------- */

  if (setUp.groupId === null) {
    return (
      <div className="pb-content">
        <section className="pb-fieldset">
          <h4 className="pb-h">Bierzmowanie</h4>
          <p className="pb-hint">
            Przygotowanie do bierzmowania ma <strong>własny obszar</strong> —
            oddzielny od reszty parafii. Kto pracuje przy planie mszy, nie
            dostaje przez to dostępu do akt kandydatów.
          </p>
          <p className="pb-hint">
            Przy zakładaniu opiekę nad nim przejmujesz ty. Później możesz ją
            przekazać albo dodać kolejne osoby.
          </p>

          <button
            type="button"
            className="ps-signin"
            disabled={busy || personRoleId === null}
            onClick={() => void run(() => rcConfirmationSetUp(parishId, personRoleId!))}
          >
            {busy ? 'Zakładanie…' : 'Załóż rocznik firmowy'}
          </button>

          {personRoleId === null && (
            <p className="ap-error">Brak roli osobistej — odblokuj klucze i spróbuj ponownie.</p>
          )}
          {error !== null && <p className="ap-error">{error}</p>}
        </section>
      </div>
    );
  }

  /* -- Eingerichtet -------------------------------------------------------- */

  const leader = setUp.leaderRoleId === null ? null : (roleNames[setUp.leaderRoleId] ?? setUp.leaderRoleId);
  const formLink = `${RC_HASH_BASE}/parish/${slug}/sacrament-confirmation`;

  return (
    <div className="pb-content">
      <section className="pb-fieldset">
        <h4 className="pb-h">{setUp.name}</h4>

        <ul className="ps-rows">
          <li>
            <span>Zgłoszenia</span>
            <em>{setUp.open ? 'przyjmowane' : 'zamknięte'}</em>
          </li>
          <li>
            <span>Odpowiedzialny</span>
            <em>{leader ?? 'nie ustalono'}</em>
          </li>
        </ul>

        {/*
          Wer die Anmeldungen lesen kann, steht hier im Klartext — und daneben,
          wie man jemanden dazunimmt. Eine Rolle, die man nicht weitergeben
          kann, ist eine Sackgasse an dem Tag, an dem jemand krank wird.
        */}
        <p className="pb-hint">
          Zgłoszenia odczytuje ten, kto trzyma tę rolę — nie każdy, kto ma
          dostęp do parafii. Rolę można przekazać albo dodać do niej kolejne
          osoby w części <strong>Twoje konto</strong>.
        </p>
      </section>

      <section className="pb-fieldset">
        <h4 className="pb-h">Formularz zgłoszeniowy</h4>

        {!setUp.open && !confirming && (
          <>
            <p className="pb-hint">
              Po włączeniu na stronie bierzmowania pojawi się formularz.
              Kandydaci będą przysyłać dane zaszyfrowane — serwer ich nie widzi.
            </p>
            <button type="button" className="ps-signin" disabled={busy} onClick={() => setConfirming(true)}>
              Włącz przyjmowanie zgłoszeń
            </button>
          </>
        )}

        {/*
          DIE BESTÄTIGUNG.

          Sie ist keine Höflichkeitsfrage. Mit dem Einschalten fangen fremde
          Kinder an, ihre Daten herzuschicken — wer das tut, soll im selben
          Augenblick lesen, wer sie danach sehen kann und was auf Papier
          trotzdem nötig bleibt.
        */}
        {!setUp.open && confirming && (
          <div className="ap-confirm">
            <p><strong>Potwierdź, zanim włączysz.</strong></p>
            <ul>
              <li>Zgłoszenia odczytuje: <strong>{leader ?? 'nie ustalono'}</strong></li>
              <li>Dane kandydatów są szyfrowane w przeglądarce — serwer ich nie widzi</li>
              <li>Zgodę rodzica trzeba nadal zebrać <strong>na papierze</strong></li>
              <li>Każdy kandydat dostaje link do swojego portalu; parafia może go odtworzyć i wysłać SMS-em</li>
            </ul>

            <div className="pb-handles">
              <button
                type="button"
                className="ps-signin"
                disabled={busy}
                onClick={() => void run(() => rcOpenApplications(setUp.groupId!, true, personRoleId))}
              >
                {busy ? 'Włączanie…' : 'Rozumiem, włącz'}
              </button>
              <button type="button" className="ps-edit" disabled={busy} onClick={() => setConfirming(false)}>
                Anuluj
              </button>
            </div>
          </div>
        )}

        {setUp.open && (
          <>
            <p className="pb-hint">
              Formularz jest widoczny pod adresem <code>{formLink}</code>
            </p>
            <button
              type="button"
              className="ps-edit"
              disabled={busy}
              onClick={() => void run(() => rcOpenApplications(setUp.groupId!, false, personRoleId))}
            >
              {busy ? 'Zamykanie…' : 'Zamknij przyjmowanie zgłoszeń'}
            </button>
          </>
        )}

        {error !== null && <p className="ap-error">{error}</p>}
      </section>

      {/*
        DIE LISTE STEHT UNTER DEN EINSTELLUNGEN.

        Erst wer liest und ob das Formular offen ist, dann wer sich gemeldet
        hat. Andersherum sähe man dreissig Namen und müsste scrollen, um zu
        erfahren, wer sie sehen darf.
      */}
      <section className="pb-fieldset">
        <h4 className="pb-h">Zgłoszeni kandydaci</h4>
        <RcCandidateList groupId={setUp.groupId} />
      </section>
    </div>
  );
}

export default RcConfirmationTab;
