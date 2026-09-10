/**
 * „Twoje zgłoszenie" — własna aplikacja widziana ze strony parafii.
 *
 * <b>Po co, skoro jest lista przy koncie.</b> Bo szuka się jej tutaj. Kto raz
 * zgłosił się w tej parafii, wraca na tę samą stronę — po termin, po godzinę
 * spotkania, po wydruk zgody. Odsyłanie go do przeglądu konta znaczyłoby: wiem,
 * gdzie to jest, ale ci nie powiem.
 *
 * <b>Dlaczego to zastępuje formularz.</b> Pusty formularz obok istniejącego
 * zgłoszenia to zaproszenie do zgłoszenia się drugi raz — a drugie zgłoszenie
 * tej samej osoby parafia musi potem rozpoznać i usunąć ręcznie.
 *
 * <b>Własne klasy, nie te z warsztatu.</b> Ta strona ma swój arkusz
 * (`parishSite.css`). Komponent z klasami `rc-*` wyglądałby tu jak tekst bez
 * oprawy — dokładnie tak, jak wyglądała szuflada logowania, zanim dostała swoje
 * barwy.
 */

import { useEffect, useState } from 'react';

import { rcDay, rcMyCandidates, type RcMyCandidate } from './rcCandidate';
import { rcPhones } from './rcPhone';
import { rcPrintApply, type RcPrintParish } from './rcPrintApply';

const STATUS: Record<string, string> = {
  enrolled: 'przyjęty',
  withdrawn: 'wycofany',
  confirmed: 'bierzmowany'
};

/**
 * Co wiadomo o własnym zgłoszeniu w tej parafii.
 *
 * <b>`others` to nie ozdoba.</b> Konto może prowadzić kilka osób — dwoje
 * rodzeństwa w tym samym roczniku to zwykła sytuacja. Pokazać jedno zgłoszenie
 * i przemilczeć drugie znaczyłoby: to, czego nie widzisz, nie istnieje. Tu
 * widać, że istnieje, i jednym ruchem można się przełączyć.
 */
export type RcMineHere =
  | { readonly state: 'none'; readonly others: number }
  | { readonly state: 'locked' }
  | { readonly state: 'found'; readonly candidate: RcMyCandidate; readonly others: number };

/**
 * Poszukać własnego zgłoszenia w TEJ parafii.
 *
 * Trzy odpowiedzi, nie dwie. „Nie mam" i „nie mogę sprawdzić" to nie to samo:
 * przy pierwszym trzeba pokazać formularz, przy drugim byłoby to namawianie do
 * powtórnego zgłoszenia.
 */
export function useMineHere(
  slug: string, signedIn: boolean, personRoleId: string | null
): RcMineHere {
  const [found, setFound] = useState<RcMineHere>({ state: 'none', others: 0 });

  useEffect(() => {
    if (!signedIn) { setFound({ state: 'none', others: 0 }); return; }

    let alive = true;
    void (async () => {
      try {
        const list = await rcMyCandidates();
        const here = (list.candidates ?? []).filter((one) => one.parishSlug === slug);
        if (!alive) return;

        /*
         * Zgłoszenie WYBRANEJ osoby, nie pierwsze z brzegu.
         *
         * Wcześniej brane było pierwsze pasujące. Przy dwojgu dzieci w tej
         * samej parafii znaczyło to: jedno widać zawsze, drugiego nigdy — i
         * nic tego nie zdradzało, bo dane pierwszego otwierały się poprawnie.
         */
        const mine = personRoleId === null
          ? here[0]
          : here.find((one) => one.personRoleId === personRoleId);

        setFound(mine === undefined
          ? { state: 'none', others: here.length }
          : { state: 'found', candidate: mine, others: here.length - 1 });
      } catch {
        // Klucze zamknięte albo brak odpowiedzi — nie wiemy, więc tego nie
        // udajemy.
        if (alive) setFound({ state: 'locked' });
      }
    })();
    return () => { alive = false; };
  }, [slug, signedIn, personRoleId]);

  return found;
}

export function RcMyApplication({
  candidate, parish
}: {
  candidate: RcMyCandidate;
  parish: RcPrintParish;
}) {
  const [error, setError] = useState<string | null>(null);

  const sealed = candidate.unreadable !== null && candidate.unreadable !== undefined;

  if (sealed) {
    return (
      <article className="ps-card ps-card-note">
        <h2>Twoje zgłoszenie</h2>
        <p>
          Zgłoszenie istnieje, ale nie da się go tutaj otworzyć — temu kontu
          brakuje do niego klucza. Otwórz link, który dostałeś po wysłaniu.
        </p>
      </article>
    );
  }

  const name = [candidate.given, candidate.surname]
    .filter((part) => (part ?? '') !== '')
    .join(' ');

  const phones = rcPhones(candidate.contact ?? '');

  const fields = {
    given: candidate.given ?? '',
    surname: candidate.surname ?? '',
    born: candidate.born ?? '',
    phone: candidate.contact ?? '',
    address: candidate.address ?? '',
    school: candidate.school ?? ''
  };

  return (
    <article className="ps-card ap">
      <h2>Twoje zgłoszenie</h2>
      <p className="ps-muted">{candidate.groupName}</p>

      <ul className="ps-rows">
        {name !== '' && <li><span>Kandydat</span><em>{name}</em></li>}
        <li>
          <span>Zgłoszenie</span>
          <em>{STATUS[candidate.status ?? ''] ?? candidate.status}</em>
        </li>
        <li>
          <span>Zgoda rodzica</span>
          <em>{candidate.paperReceived === true ? 'dostarczona' : 'czekamy na papier'}</em>
        </li>
        {(candidate.born ?? '') !== '' && (
          <li><span>Data urodzenia</span><em>{rcDay(candidate.born ?? '')}</em></li>
        )}
        {phones.map((one, index) => (
          <li key={one}><span>{index === 0 ? 'Telefon' : ''}</span><em>{one}</em></li>
        ))}
        {(candidate.address ?? '') !== '' && (
          <li><span>Adres</span><em className="ca-lines">{candidate.address}</em></li>
        )}
        {(candidate.school ?? '') !== '' && (
          <li><span>Szkoła</span><em>{candidate.school}</em></li>
        )}
      </ul>

      {/* Zgoda rodzica i tak musi trafić na papier — więc wydruk stoi tu, a nie
          tylko tam, gdzie się zgłaszało. */}
      <button
        type="button"
        className="ps-edit"
        onClick={() => {
          const ok = rcPrintApply(fields, parish, candidate.groupName ?? '');
          setError(ok ? null : 'Przeglądarka zablokowała nowe okno. Zezwól na nie i spróbuj jeszcze raz.');
        }}
      >
        Drukuj zgłoszenie i zgodę rodzica
      </button>

      {error !== null && <p className="ap-error">{error}</p>}
    </article>
  );
}

export default RcMyApplication;
