/**
 * Jedna część wydarzenia.
 *
 * <b>Rodzajów jest dwanaście, a wyglądów mniej.</b> Stary moduł ma po
 * komponencie na każdy rodzaj — bo tam każdy naprawdę coś swojego robi: mapa
 * rysuje mapę, galeria powiększa zdjęcia, formularz zbiera zgłoszenia. Tutaj
 * stoi to, co ma treść już dziś; reszta pokazuje tytuł i wstęp, bo tyle o niej
 * wiadomo.
 *
 * <b>Część, której nie da się otworzyć, NIE ZNIKA.</b> Wewnętrzne części są
 * zapieczętowane pod kluczem epoki; czytelnik bez klucza widzi, ŻE tam coś jest.
 * Ukrycie jej byłoby okłamaniem go co do tego, ile ma przed sobą — a menu i tak
 * pokazuje numer.
 */

import type { RcPartView } from './rcEventLayers';

/** Nazwy rodzajów — dla części, które nie mają jeszcze własnego wyglądu. */
const KIND_LABEL: Record<string, string> = {
  title: 'Tytuł',
  shortinfos: 'Najważniejsze',
  text: 'Tekst',
  plan: 'Plan',
  map: 'Mapa',
  faq: 'Pytania',
  form: 'Formularz',
  costs: 'Koszty',
  contact: 'Kontakt',
  gallery: 'Galeria',
  files: 'Pliki',
  people: 'Ludzie'
};

export function RcEventPart({ part }: { part: RcPartView }) {
  const title = (part.title ?? '').trim();
  const intro = (part.intro ?? '').trim();
  const sealed = (part.unreadable ?? null) !== null;

  if (sealed) {
    return (
      <article className="ev-part ev-part-sealed">
        <h1 className="ev-title">Część wewnętrzna</h1>
        <p className="ev-muted">
          Ta część jest zapieczętowana — temu kontu brakuje do niej klucza.
          Zaloguj się kluczem tego wydarzenia, aby ją przeczytać.
        </p>
      </article>
    );
  }

  return (
    <article className={`ev-part ev-part-${part.kind}`}>
      {/*
        Tytuł części jest nagłówkiem STRONY, gdy część jest tym, co się właśnie
        czyta — a przy tej budowie zawsze jest. Stąd h1, a nie h2.
      */}
      {title !== '' && <h1 className="ev-title">{title}</h1>}

      {/* Wstęp: akapity rozdzielone pustą linią, tak jak się je pisze. */}
      {intro !== '' && (
        <div className="ev-intro">
          {intro.split('\n\n').map((block, n) => <p key={n}>{block}</p>)}
        </div>
      )}

      {part.kind === 'form' && <Fields part={part} />}

      {/*
        Część bez treści nie zostaje pustym ekranem: mówi, czym miała być.
        „Galeria" bez zdjęć to informacja — pusty ekran to usterka.
      */}
      {title === '' && intro === '' && part.kind !== 'form' && (
        <p className="ev-muted">{KIND_LABEL[part.kind] ?? part.kind} — jeszcze bez treści.</p>
      )}
    </article>
  );
}

/**
 * Pola formularza — pokazane, nie zbierane.
 *
 * <b>Zgłoszenie idzie osobną drogą</b> (`RcRegistrations`), z szyfrowaniem w
 * przeglądarce, tak jak wniosek kandydata do bierzmowania. Tutaj widać tylko, o
 * co formularz pyta — żeby dało się to przeczytać, zanim się cokolwiek wpisze.
 */
function Fields({ part }: { part: RcPartView }) {
  const fields = part.fields ?? [];
  if (fields.length === 0) return <p className="ev-muted">Formularz nie ma jeszcze pól.</p>;

  return (
    <ul className="ev-fields">
      {fields.map((field) => (
        <li key={field.fieldId} className={field.isHalfWidth ? 'ev-half' : undefined}>
          <span className="ev-label">
            {field.label}
            {field.isRequired && <em> — wymagane</em>}
          </span>

          {(field.helpText ?? '').trim() !== '' && (
            <span className="ev-help">{field.helpText}</span>
          )}

          {/*
            Warianty wyboru stoją wprost. Kto się zastanawia, czy zdąży,
            chce zobaczyć terminy przed założeniem konta.
          */}
          {(field.options ?? []).length > 0 && (
            <span className="ev-options">{(field.options ?? []).join(' · ')}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default RcEventPart;
