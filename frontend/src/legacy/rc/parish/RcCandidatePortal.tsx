/**
 * Portal kandydata — to, co otwiera link.
 *
 * <b>Klucz jest w adresie, za kratką.</b> Nigdy nie trafia na serwer: to samo
 * miejsce, co przy linku zaproszeniowym (3.12). Serwer wydaje szyfrogram, a
 * dopiero ta strona go otwiera.
 *
 * <b>Cena jest wprost.</b> Kto ma link, ma dane — to nie jest legitymacja,
 * tylko klucz. Strona mówi to na wierzchu, a nie drobnym drukiem na dole.
 *
 * <b>Po podłączeniu konta link można wyłączyć.</b> Wcześniej nie: bez konta i
 * bez linku nikt już nie dociera do zgłoszenia — także sam kandydat. Pilnuje
 * tego również baza, nie tylko ta strona.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  rcBindCandidate, rcCandidatePortal, rcDay, rcOpenCandidate, rcRevokeCandidate,
  RC_APPLY_FIELDS, type RcApplyField, type RcCandidatePortal as Portal
} from './rcCandidate';
import { rcFromBase64Url } from '../lib/rcBase64';
import { RcRequestError } from '../lib/rcApi';
import { rcPath } from '../lib/rcRoute';
import { RcPersonPicker, usePersons, useActivePerson } from '../RcPersonPicker';
import { rcMe } from '../lib/rcAuth';
import { rcPublicParish } from './rcPublicParish';
import { rcReadSite } from './rcSite';
import { rcPrintApply, type RcPrintParish } from './rcPrintApply';

const LABELS: Record<RcApplyField, string> = {
  given: 'Imię',
  surname: 'Nazwisko',
  born: 'Data urodzenia',
  phone: 'Telefony',
  address: 'Adres',
  school: 'Szkoła i klasa'
};

const STATUS: Record<string, string> = {
  enrolled: 'przyjęty',
  withdrawn: 'wycofany',
  confirmed: 'bierzmowany'
};

export function RcCandidatePortalPage({
  secret, keyText, signedIn, onSignIn
}: {
  secret: string;
  /** Klucz sesji z adresu. Bez niego widać stan, ale nie dane. */
  keyText: string | null;
  signedIn: boolean;
  onSignIn: () => void;
}) {
  const [portal, setPortal] = useState<Portal | null>(null);
  const [fields, setFields] = useState<Partial<Record<RcApplyField, string>>>({});
  const [gone, setGone] = useState(false);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * ZU WEM diese Anmeldung gehoeren soll.
   *
   * Ein Elternteil mit zwei Kindern oeffnet zwei solcher Links. Ohne Wahl
   * landeten beide bei derselben Person — und weil die Angaben trotzdem
   * aufgingen, faende es niemand heraus.
   */
  const [accountId, setAccountId] = useState('');

  useEffect(() => {
    if (!signedIn) { setAccountId(''); return; }
    let alive = true;
    void (async () => {
      try {
        const who = await rcMe();
        if (alive) setAccountId(who.accountId ?? '');
      } catch { if (alive) setAccountId(''); }
    })();
    return () => { alive = false; };
  }, [signedIn]);

  const persons = usePersons(signedIn);
  const activePerson = useActivePerson(accountId, persons);

  /*
   * WEN DER AUSDRUCK NENNT.
   *
   * Die Einwilligung der Eltern nennt eine Pfarrei beim Namen und mit ihrer
   * Anschrift — die stehen nicht in der Anmeldung, sondern in dem, was die
   * Pfarrei auf ihrer Seite eingetragen hat. Bleibt es leer, druckt das Blatt
   * eine Linie zum Ausfuellen; erfunden wird nichts.
   */
  const [parish, setParish] = useState<RcPrintParish | null>(null);

  const load = useCallback(async () => {
    try {
      const found = await rcCandidatePortal(secret);
      setPortal(found);

      if (keyText !== null) {
        try {
          setFields(await rcOpenCandidate(found, rcFromBase64Url(keyText)));
        } catch {
          // Klucz z adresu nie pasuje — dane zostają zamknięte, stan widać.
          setFields({});
        }
      }
    } catch (e) {
      if (e instanceof RcRequestError && e.code === 'portal.revoked') setGone(true);
      else setMissing(true);
    }
  }, [secret, keyText]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const slug = portal?.parishSlug;
    if (slug === undefined || slug === null || slug === '') return;

    let alive = true;
    void (async () => {
      try {
        const found = await rcPublicParish(slug);
        const site = rcReadSite(found.modules);
        if (!alive) return;
        setParish({
          name: found.name,
          address: site.content['contact.address'] ?? '',
          email: site.content['contact.email'] ?? '',
          leader: site.content['sacrament.confirmation.who'] ?? ''
        });
      } catch {
        // Ohne die Angaben der Pfarrei bleibt der Ausdruck moeglich — mit
        // Linien statt Namen. Das ist besser als kein Blatt.
        if (alive) setParish(null);
      }
    })();
    return () => { alive = false; };
  }, [portal?.parishSlug]);

  const act = async (what: 'bind' | 'revoke') => {
    setBusy(true);
    setError(null);
    try {
      if (what === 'bind') {
        /*
          Verbinden geht nur MIT dem Schlüssel aus der Adresse. Ohne ihn wäre
          es eine Zeile, die ein Konto nennt, das nichts aufmachen kann — und
          der Knopf daneben schaltete danach den letzten Weg ab.
        */
        if (keyText === null) {
          setError('Ten adres nie zawiera klucza. Otwórz pełny link, który dostałeś po wysłaniu.');
          return;
        }
        await rcBindCandidate(secret, rcFromBase64Url(keyText), activePerson);
      }
      else await rcRevokeCandidate(secret);
      await load();
    } catch (e) {
      setError(e instanceof RcRequestError && e.code === 'permission.denied'
        ? 'To zgłoszenie należy już do innego konta.'
        : 'Nie udało się. Spróbuj jeszcze raz.');
    } finally { setBusy(false); }
  };

  if (gone) {
    return (
      <Shell>
        <h1 className="ps-title">Ten link został wyłączony</h1>
        <article className="ps-card">
          <p>
            Zgłoszenie istnieje dalej — dostęp przez ten link został zamknięty
            przez właściciela konta, z którym je połączono.
          </p>
        </article>
      </Shell>
    );
  }

  if (missing) {
    return (
      <Shell>
        <h1 className="ps-title">Nie znaleziono zgłoszenia</h1>
        <article className="ps-card">
          <p>Ten link nie prowadzi do żadnego zgłoszenia. Sprawdź, czy skopiowałeś go w całości.</p>
        </article>
      </Shell>
    );
  }

  if (portal === null) {
    return <Shell><p className="ps-muted">Wczytywanie…</p></Shell>;
  }

  const known = RC_APPLY_FIELDS.filter((f) => (fields[f] ?? '') !== '');

  return (
    <Shell>
      <h1 className="ps-title">Twoje zgłoszenie</h1>
      <p className="ps-muted">{portal.groupName}</p>

      <div className="ps-stack">
        <article className="ps-card">
          <h2>Stan</h2>
          <ul className="ps-rows">
            <li><span>Zgłoszenie</span><em>{STATUS[portal.status] ?? portal.status}</em></li>
            <li>
              <span>Zgoda rodzica</span>
              <em>{portal.paperReceived ? 'dostarczona' : 'czekamy na papier'}</em>
            </li>
            <li><span>Konto</span><em>{portal.bound ? 'połączone' : 'niepołączone'}</em></li>
          </ul>
        </article>

        {/* Dane — otwarte kluczem z adresu, nie przez serwer. */}
        {keyText === null ? (
          <article className="ps-card ps-card-note">
            <h2>Twoje dane</h2>
            <p>
              W tym adresie nie ma klucza, więc danych nie da się odczytać.
              Użyj pełnego linku, który dostałeś po wysłaniu zgłoszenia.
            </p>
          </article>
        ) : known.length === 0 ? (
          <article className="ps-card ps-card-note">
            <h2>Twoje dane</h2>
            <p>Nie udało się ich otworzyć tym kluczem.</p>
          </article>
        ) : (
          <article className="ps-card">
            <h2>Twoje dane</h2>
            <ul className="ps-rows">
              {known.map((f) => (
                <li key={f}>
                  <span>{LABELS[f]}</span>
                  {/*
                    Telefony i adres mają po kilka wierszy — tak zostały wpisane
                    i tak się je czyta. Data wygląda jak na formularzu, a nie
                    jak w bazie.
                  */}
                  <em className="ca-lines">{f === 'born' ? rcDay(fields[f] ?? '') : fields[f]}</em>
                </li>
              ))}
            </ul>
            <p className="ps-muted">Widzi je również osoba prowadząca przygotowanie.</p>

            {/*
              Wydruk składa się TUTAJ, z odszyfrowanych danych. Serwer ich nie
              ma, więc nie mógłby go złożyć — a zgoda rodzica i tak musi trafić
              na papier, bo haczyk zaznaczony przez nastolatka nie jest zgodą
              opiekuna.
            */}
            <button
              type="button"
              className="ps-edit"
              onClick={() => {
                const ok = rcPrintApply(
                  fields,
                  parish ?? { name: portal.groupName ?? '', address: '', email: '', leader: '' },
                  portal.groupName ?? ''
                );
                setError(ok ? null : 'Przeglądarka zablokowała nowe okno. Zezwól na nie i spróbuj jeszcze raz.');
              }}
            >
              Drukuj zgłoszenie i zgodę rodzica
            </button>

            <p className="ps-muted">
              Trzy strony A5: zgłoszenie, oświadczenie rodzica do podpisu
              i klauzula informacyjna. Podpisaną zgodę trzeba oddać w parafii.
            </p>
          </article>
        )}

        {/* Konto: podłączyć, a potem móc wyłączyć link. */}
        <article className="ps-card ps-card-note">
          <h2>{portal.bound ? 'Konto połączone' : 'Zachowaj dostęp'}</h2>

          {!portal.bound && (
            <>
              <p>
                <strong>Zapisz ten link</strong> albo połącz zgłoszenie z kontem.
                Bez jednego i drugiego nie ma drogi powrotnej — nikt, także
                parafia, nie odtworzy tego linku.
              </p>
              {signedIn && persons.length > 1 && (
                <>
                  <p>
                    To zgłoszenie zostanie przypisane do wybranej osoby. Sprawdź,
                    czy to ta właściwa — później zmienia się to tylko przez parafię.
                  </p>
                  <RcPersonPicker
                    accountId={accountId}
                    persons={persons}
                    active={activePerson}
                    className="ps-person-pick"
                  />
                </>
              )}

              {signedIn ? (
                <button type="button" className="ps-signin" disabled={busy} onClick={() => void act('bind')}>
                  {busy ? 'Łączenie…' : 'Połącz z moim kontem'}
                </button>
              ) : (
                <button type="button" className="ps-signin" onClick={onSignIn}>
                  Zaloguj się, aby połączyć
                </button>
              )}
            </>
          )}

          {portal.bound && (
            <>
              <p>
                Zgłoszenie znajdziesz przez swoje konto. Link nadal działa —
                możesz go wyłączyć, jeśli poszedł SMS-em i nie chcesz, żeby
                został w historii wiadomości.
              </p>
              {signedIn ? (
                <button type="button" className="ps-edit" disabled={busy} onClick={() => void act('revoke')}>
                  {busy ? 'Wyłączanie…' : 'Wyłącz ten link'}
                </button>
              ) : (
                <button type="button" className="ps-signin" onClick={onSignIn}>
                  Zaloguj się, aby zarządzać
                </button>
              )}
            </>
          )}

          {error !== null && <p className="ap-error">{error}</p>}
        </article>
      </div>
    </Shell>
  );
}

/** Ta sama oprawa co strona parafii — portal do niej należy. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ps">
      <header className="ps-head">
        <span className="ps-brand">
          <span className="ps-mark" aria-hidden="true">✝</span>
          <span className="ps-name">Portal kandydata</span>
        </span>
      </header>
      <main className="ps-main">{children}</main>
      <footer className="ps-foot">
        <a href={rcPath('parish')}>Parafie</a>
        <a href="https://recreatio.pl">recreatio.pl</a>
      </footer>
    </div>
  );
}

export default RcCandidatePortalPage;
