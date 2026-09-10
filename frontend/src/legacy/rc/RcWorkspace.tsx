/**
 * Warsztat — to, co masz do zrobienia, a nie to, co parafia ogłasza.
 *
 * <b>Czym różni się od strony organizacji.</b> Strona parafii należy do
 * parafii: wisi dla wszystkich i mówi jednym głosem. Warsztat należy do
 * CIEBIE — pokazuje to, do czego masz klucze, i nic poza tym. Dwie osoby
 * otwierają ten sam adres i widzą co innego, i to nie jest usterka, tylko
 * cała jego treść.
 *
 * <b>Dlaczego jest za logowaniem.</b> Bez klucza nie ma tu czego pokazać —
 * nie „mało", tylko nic. Strona, która po zalogowaniu wygląda inaczej niż
 * przed, jest zrozumiała; strona, która przed zalogowaniem pokazuje sześć
 * zamkniętych kafelków, wygląda na zepsutą.
 *
 * <b>Co tu na razie jest.</b> Drzwi — i uczciwie tylko te, które prowadzą
 * gdzieś, gdzie już coś jest. Wnętrze warsztatu (moje wspólnoty, moje
 * organizacje, moje zgłoszenia) dochodzi osobno; kafelek, który obiecuje
 * listę i pokazuje pustkę, jest gorszy niż jego brak.
 */

import { rcPath } from './lib/rcRoute';

/**
 * Drzwi warsztatu.
 *
 * Pogrupowane tak, jak platforma jest zbudowana: najpierw to, co Twoje, potem
 * organizacje i ich wspólnoty, na końcu wydarzenia. Kolejność niesie
 * informację — nie jest alfabetyczna i nie jest przypadkowa.
 */
type Door = {
  readonly to: string;
  readonly title: string;
  readonly body: string;
};

const MINE: readonly Door[] = [
  {
    to: rcPath('calendar'),
    title: 'Terminarz',
    body: 'Msze, spowiedź, spotkania i wydarzenia — razem, w kolejności, w jakiej nadchodzą.'
  },
  {
    to: rcPath('account'),
    title: 'Konto',
    body: 'Twoje dane, klucze i role. Wpisane raz, używane przez każdy formularz.'
  }
];

const PLACES: readonly Door[] = [
  {
    to: rcPath('parish'),
    title: 'Parafie',
    body: 'Strony parafii, a w nich wspólnoty — schola, ministranci, oaza.'
  },
  {
    to: rcPath('event'),
    title: 'Wydarzenia',
    body: 'Pielgrzymki, rekolekcje, wyjazdy — te ogłoszone i te, które prowadzisz.'
  }
];

export function RcWorkspace({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <div className="ws">
      <header className="ws-head">
        <p className="ws-eyebrow">Warsztat</p>
        <h1 className="ws-h1">Twoje miejsce pracy</h1>
        <p className="ws-lede">
          Tu jest to, do czego masz klucze. Strony parafii i wydarzeń są dla
          wszystkich — warsztat jest Twój, i dlatego wygląda inaczej u każdego.
        </p>
      </header>

      <section className="ws-block">
        <h2 className="ws-h2">Twoje</h2>
        <Doors doors={MINE} />
      </section>

      <section className="ws-block">
        <h2 className="ws-h2">Miejsca</h2>
        <Doors doors={PLACES} />
      </section>

      {/*
        CO JESZCZE NIE STOI — powiedziane wprost.

        Warsztat dopiero powstaje. Puste miejsce, o którym nie napisano, że
        jest puste, czyta się jako brak funkcji albo jako brak uprawnień —
        a jest po prostu niezbudowane.
      */}
      <section className="ws-block">
        <h2 className="ws-h2">W budowie</h2>
        <p className="ws-note">
          Wnętrze warsztatu — Twoje wspólnoty, organizacje, którymi zarządzasz,
          i Twoje zgłoszenia — pojawi się tutaj. Na razie wchodzisz do nich
          przez stronę parafii albo przez link, który dostałeś.
        </p>
      </section>

      {onSignOut !== undefined && (
        <p className="ws-foot">
          <button type="button" className="rc-btn rc-btn-quiet" onClick={onSignOut}>
            Wyloguj
          </button>
        </p>
      )}
    </div>
  );
}

function Doors({ doors }: { doors: readonly Door[] }) {
  return (
    <ul className="ws-doors">
      {doors.map((door) => (
        <li key={door.to} className="ws-door">
          {/*
            Odnośnik, nie przycisk: środkowym klawiszem w nowej karcie, do
            zakładek, do wysłania komuś. Ta sama zasada co wszędzie w rc.
          */}
          <a className="ws-door-link" href={door.to}>
            <span className="ws-door-title">{door.title}</span>
            <span className="ws-door-body">{door.body}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default RcWorkspace;
