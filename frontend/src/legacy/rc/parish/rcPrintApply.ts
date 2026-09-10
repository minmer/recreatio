/**
 * Zgłoszenie i zgoda rodzica — do wydruku.
 *
 * <b>Dlaczego papier.</b> Zgoda opiekuna prawnego nie powstaje przez zaznaczenie
 * haczyka przez nastolatka. Ktoś dorosły musi ją podpisać, a podpis wymaga
 * kartki. Ta kartka ma już wpisane dane kandydata — żeby nikt nie przepisywał
 * ich po raz drugi i nie pomylił się przy przepisywaniu.
 *
 * <b>Skąd dane.</b> Z przeglądarki, nie z serwera. Zgłoszenie jest zaszyfrowane
 * kluczem, który leży w linku; serwer go nie ma i wydruku by nie złożył. Dlatego
 * dokument powstaje tutaj, z tego, co portal już otworzył.
 *
 * <b>Czego nie wymyślamy.</b> Nazwa parafii, adres i osoba prowadząca pochodzą
 * z tego, co parafia sama wpisała. Czego nie wpisała, tego nie ma na wydruku:
 * zamiast tego zostaje kropkowana linia do uzupełnienia ręką. Wpisanie tam
 * czegoś „sensownego" byłoby podstawieniem cudzych danych pod cudzy podpis.
 */

import { rcDay, type RcApplyField } from './rcCandidate';
import { rcPhones } from './rcPhone';

/** Co wiadomo o parafii w chwili drukowania. Puste znaczy: nie wpisano. */
export type RcPrintParish = {
  readonly name: string;
  readonly address: string;
  readonly email: string;
  /** Kto prowadzi przygotowanie — z pola „Kto prowadzi" strony bierzmowania. */
  readonly leader: string;
};

/** Kropkowana linia do wypełnienia ręką. */
const BLANK = '.'.repeat(46);

/**
 * Znaki, które w HTML znaczą co innego niż w nazwisku.
 *
 * Nazwisko `O'Brien & Sons` ma tu wyjść nazwiskiem, a nie kawałkiem znacznika.
 * Wydruk składa się z tekstu wpisanego przez obcych ludzi — to jedyne miejsce,
 * w którym ten tekst styka się ze składnią.
 */
function esc(raw: string): string {
  return raw
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

/** Wiersze tekstu jako akapity — zachowuje podział, którym ktoś się posłużył. */
function lines(raw: string): string {
  return raw
    .split('\n')
    .map((one) => one.trim())
    .filter((one) => one !== '')
    .map((one) => `<li>${esc(one)}</li>`)
    .join('');
}

/** Wiersz danych: etykieta i wartość, albo etykieta i miejsce na dopisanie. */
function row(label: string, value: string): string {
  const shown = value.trim() === '' ? `<span class="blank">${BLANK}</span>` : esc(value.trim());
  return `<p><strong>${esc(label)}:</strong> ${shown}</p>`;
}

/**
 * Treść oświadczenia rodzica.
 *
 * Zdania są te same co na starej stronie — zmieniło się to, że parafia,
 * jej adres i osoba prowadząca nie są już wpisane na stałe. Parafia, która
 * drukuje ten arkusz, nie oświadcza niczego o cudzej parafii.
 */
function consent(parish: RcPrintParish): readonly string[] {
  const where = [parish.name.trim(), parish.address.trim()]
    .filter((part) => part !== '')
    .join(', ');

  const led = parish.leader.trim() === ''
    ? ''
    : `, prowadzonych przez ${parish.leader.trim()}`;

  return [
    'Ja, niżej podpisany / niżej podpisana, jako rodzic / opiekun prawny kandydata '
    + 'do sakramentu bierzmowania, oświadczam, że wyrażam zgodę na udział mojego '
    + 'dziecka w spotkaniach przygotowujących do przyjęcia sakramentu bierzmowania'
    + (where === '' ? '' : ` przy ${where}`) + led + '.',

    'Oświadczam również, że przyjmuję do wiadomości zasady związane z parafialnym '
    + 'przygotowaniem do bierzmowania oraz zobowiązuję się do współpracy z osobami '
    + 'prowadzącymi przygotowanie mojego dziecka.',

    'Jednocześnie wyrażam zgodę na samodzielny powrót mojego dziecka do domu po '
    + 'zakończeniu spotkań przygotowujących do sakramentu bierzmowania i biorę za '
    + 'ten powrót pełną odpowiedzialność.'
  ];
}

/**
 * Klauzula informacyjna.
 *
 * <b>Administrator jest tą parafią</b>, a nie parafią, w której tekst powstał.
 * <b>Inspektor zostaje pusty</b>: jego adres jest inny w każdej diecezji, a
 * wpisanie krakowskiego wszystkim byłoby wskazaniem człowieka, który o niczym
 * nie wie. Organ nadzoru jest z kolei jeden dla całego kraju i stoi wprost.
 */
function rodo(parish: RcPrintParish): readonly string[] {
  const who = [parish.name.trim(), parish.address.trim()]
    .filter((part) => part !== '')
    .join(', ');

  const mail = parish.email.trim() === '' ? '' : `, e-mail: ${parish.email.trim()}`;

  return [
    'Zgodnie z art. 13 ust. 1 i 2 RODO oraz art. 8 ust. 1 Dekretu ogólnego '
    + 'Konferencji Episkopatu Polski w sprawie ochrony osób fizycznych w związku '
    + 'z przetwarzaniem danych osobowych w Kościele katolickim informujemy, że:',

    `Administratorem danych osobowych jest ${who === '' ? BLANK : who}${mail}.`,

    `Kontakt z Inspektorem Ochrony Danych jest możliwy pod adresem: ${BLANK}`,

    'Dane osobowe rodzica / opiekuna prawnego oraz dziecka są przetwarzane w celu '
    + 'organizacji i prowadzenia przygotowania do sakramentu bierzmowania, kontaktu '
    + 'w sprawach z nim związanych, prowadzenia dokumentacji parafialnej oraz '
    + 'realizacji obowiązków wynikających z przepisów prawa kościelnego i '
    + 'powszechnie obowiązującego.',

    'Odbiorcami danych mogą być wyłącznie podmioty uprawnione do ich otrzymania na '
    + 'podstawie przepisów prawa, podmioty współpracujące z administratorem na '
    + 'podstawie stosownych upoważnień oraz właściwe podmioty kościelne w zakresie '
    + 'niezbędnym do realizacji celu przetwarzania.',

    'Dane osobowe będą przechowywane przez okres niezbędny do realizacji celu, dla '
    + 'którego zostały zebrane, a następnie przez okres wynikający z przepisów '
    + 'prawa kościelnego i powszechnie obowiązującego.',

    'Przysługuje Pani / Panu prawo dostępu do danych osobowych, ich sprostowania, '
    + 'ograniczenia przetwarzania, a w przypadkach przewidzianych przepisami także '
    + 'żądania usunięcia danych.',

    'W przypadku danych osobowych związanych z działalnością kanoniczną Kościoła '
    + 'katolickiego właściwym organem nadzoru jest Kościelny Inspektor Ochrony '
    + 'Danych, Skwer kard. Stefana Wyszyńskiego 6, 01-015 Warszawa, '
    + 'e-mail: kiod@episkopat.pl. W przypadku danych związanych z pozostałą '
    + 'działalnością właściwym organem nadzorczym jest Prezes Urzędu Ochrony Danych '
    + 'Osobowych, ul. Stawki 2, 00-193 Warszawa.',

    'Dane osobowe nie będą przetwarzane w sposób zautomatyzowany, w tym również '
    + 'w formie profilowania.',

    'Podanie danych jest dobrowolne, ale niezbędne do udziału dziecka w parafialnym '
    + 'przygotowaniu do sakramentu bierzmowania.',

    'Oświadczam, że zapoznałem / zapoznałam się z treścią powyższej klauzuli '
    + 'informacyjnej.'
  ];
}

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: #f3f4f7; color: #111;
    font-family: "Segoe UI", Tahoma, sans-serif; line-height: 1.35;
  }
  .note {
    max-width: 148mm; margin: 16px auto; padding: 10px 14px;
    border: 1px solid #d6dae2; border-radius: 10px;
    background: #fff; font-size: 0.9rem;
  }
  .note p { margin: 0 0 4px; }
  .note p:last-child { margin: 0; }
  .page {
    width: 148mm; min-height: 210mm; margin: 14px auto; padding: 10mm;
    background: #fff; border: 1px solid #cfd5df; overflow: hidden;
  }
  .tag {
    margin: 0 0 8px; font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; color: #31527f;
  }
  h1 { margin: 0 0 10px; font-size: 1.08rem; line-height: 1.25; }
  .lead {
    margin-bottom: 10px; font-size: 0.78rem; text-transform: uppercase;
    letter-spacing: 0.02em; font-weight: 700;
  }
  p { margin: 0 0 7px; font-size: 0.87rem; }
  ul { margin: 0 0 10px 18px; padding: 0; font-size: 0.86rem; }
  li { margin: 0 0 4px; }
  .fine, .fine p, .fine ul { font-size: 0.8rem; }
  .blank { color: #6b7280; letter-spacing: 0.06em; }
  .sign { margin-top: 18px; }
  .sign p { margin: 0 0 14px; }
  @page { size: A5 portrait; margin: 8mm; }
  @media print {
    html, body { background: #fff; }
    .note { display: none; }
    .page {
      width: auto; min-height: 0; margin: 0; padding: 0; border: none;
      break-after: page; page-break-after: always;
    }
    .page:last-of-type { break-after: auto; page-break-after: auto; }
  }
`;

/**
 * Złożyć dokument.
 *
 * Osobna funkcja od otwierania okna, bo to ona daje się sprawdzić: okna w
 * teście nie ma, a tekstu jest tu więcej niż mechaniki.
 */
export function rcApplyPrintHtml(
  fields: Partial<Record<RcApplyField, string>>,
  parish: RcPrintParish,
  groupName: string,
  printedAt: string
): string {
  const value = (field: RcApplyField) => (fields[field] ?? '').trim();

  const phones = rcPhones(value('phone'));
  const phonesHtml = phones.length === 0
    ? `<p><strong>Telefony:</strong> <span class="blank">${BLANK}</span></p>`
    : `<p><strong>Telefony:</strong></p><ul>${phones.map((one) => `<li>${esc(one)}</li>`).join('')}</ul>`;

  const addressHtml = value('address') === ''
    ? `<p><strong>Adres zamieszkania:</strong> <span class="blank">${BLANK}</span></p>`
    : `<p><strong>Adres zamieszkania:</strong></p><ul>${lines(value('address'))}</ul>`;

  const consentHtml = consent(parish).map((one) => `<p>${esc(one)}</p>`).join('');
  const rodoHtml = rodo(parish).map((one) => `<p>${esc(one)}</p>`).join('');

  const title = [parish.name.trim(), groupName.trim()]
    .filter((part) => part !== '')
    .join(' — ');

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Zgłoszenie i zgoda rodzica</title>
<style>${STYLE}</style>
</head>
<body>
<div class="note">
  <p>Dokument do druku A5. Wygenerowano: ${esc(printedAt)}.</p>
  <p>Kropkowane miejsca uzupełnia się ręcznie — nie zostały wypełnione, bo tych
  danych nie ma w systemie.</p>
</div>

<section class="page">
  <p class="tag">Bierzmowanie</p>
  <h1>Zgłoszenie kandydata</h1>
  ${title === '' ? '' : `<p class="lead">${esc(title)}</p>`}
  ${row('Imię', value('given'))}
  ${row('Nazwisko', value('surname'))}
  ${row('Data urodzenia', rcDay(value('born')))}
  ${addressHtml}
  ${row('Szkoła i klasa', value('school'))}
  ${phonesHtml}
  <div class="sign">
    <p>Miejscowość, data: ${BLANK}</p>
    <p>Podpis kandydata: ${BLANK}</p>
  </div>
</section>

<section class="page">
  <p class="tag">Bierzmowanie</p>
  <h1>Oświadczenie rodzica / opiekuna prawnego</h1>
  <p class="lead">Oświadczenie dotyczące udziału dziecka w przygotowaniu do sakramentu bierzmowania</p>
  ${row('Kandydat', [value('given'), value('surname')].filter((p) => p !== '').join(' '))}
  ${consentHtml}
  <div class="sign">
    <p>Miejscowość, data: ${BLANK}</p>
    <p>Imię i nazwisko rodzica / opiekuna: ${BLANK}</p>
    <p>Podpis: ${BLANK}</p>
  </div>
</section>

<section class="page fine">
  <p class="tag">RODO</p>
  <h1>Klauzula informacyjna</h1>
  <p class="lead">Przetwarzanie danych osobowych</p>
  ${rodoHtml}
  <div class="sign">
    <p>Data i podpis rodzica / opiekuna: ${BLANK}</p>
  </div>
</section>

<script>window.addEventListener('load', function () { window.print(); });</script>
</body>
</html>`;
}

/**
 * Otworzyć wydruk.
 *
 * Zwraca `false`, gdy przeglądarka nie dała okna — to nie jest wyjątek, tylko
 * blokada wyskakujących okien, i strona ma o niej powiedzieć zamiast milczeć.
 */
export function rcPrintApply(
  fields: Partial<Record<RcApplyField, string>>,
  parish: RcPrintParish,
  groupName: string
): boolean {
  const html = rcApplyPrintHtml(fields, parish, groupName, new Date().toLocaleString('pl-PL'));
  const opened = window.open('about:blank', '_blank');
  if (opened === null) return false;

  opened.document.open();
  opened.document.write(html);
  opened.document.close();

  /*
   * Drukowanie wywołuje sama otwarta strona, po `load` — wywołane stąd
   * trafiałoby czasem w pusty dokument, zależnie od tego, co przeglądarka
   * zdążyła złożyć.
   */
  return true;
}
