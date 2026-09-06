/**
 * Formularz zapisu — pokazany, nie zbierany.
 *
 * <b>Dlaczego ta część jest inna niż reszta przeniesionych.</b> Pozostałe
 * czytają wyłącznie `configJson`; ta czyta POLA, a te leżą w osobnej tabeli
 * (`rc_event_part_field`) i przychodzą w `ctx.part.fields`. Konfiguracja nie ma
 * tu nic do rzeczy — pole dopisane w edytorze musi pojawić się na stronie bez
 * przepisywania JSON-a obok.
 *
 * <b>Zgłoszenie idzie osobną drogą</b> (`RcRegistrations`), z szyfrowaniem w
 * przeglądarce, tak jak wniosek kandydata do bierzmowania. Tutaj widać tylko, o
 * co formularz pyta — żeby dało się to przeczytać, ZANIM się cokolwiek wpisze.
 * To nie jest brak: klauzula i pytania mają być czytelne bez konta i bez klucza.
 *
 * <b>Czego brakuje wobec starego modułu.</b> Tam edytor pozwalał pole usunąć i
 * przestawić (`deleteEventField`, `reorderEventFields`); rc umie na razie tylko
 * dodać. Edytor poniżej nie udaje więcej, niż potrafi serwis.
 */

import { definePart } from './contracts';

export const formPart = definePart<Record<string, never>>({
  kind: 'form',
  label: 'Formularz zapisu',
  description: 'Pytania, na które odpowiada zapisujący się. Pola dodaje się w edytorze części.',
  defaultConfig: () => ({}),
  parse: () => ({}),

  Renderer: ({ ctx }) => {
    const fields = ctx.part.fields ?? [];
    if (fields.length === 0) return <p className="ev-note">Formularz nie ma jeszcze pól.</p>;

    return (
      <ul className="ev-form-fields">
        {fields.map((field) => (
          <li key={field.fieldId} className={field.isHalfWidth ? 'ev-form-half' : undefined}>
            <span className="ev-form-label">
              {field.label}
              {field.isRequired && <em> — wymagane</em>}
            </span>

            {(field.helpText ?? '').trim() !== '' && (
              <span className="ev-form-help">{field.helpText}</span>
            )}

            {/*
              Warianty wyboru stoją wprost. Kto się zastanawia, czy zdąży,
              chce zobaczyć terminy przed założeniem konta.
            */}
            {(field.options ?? []).length > 0 && (
              <span className="ev-form-options">{(field.options ?? []).join(' · ')}</span>
            )}
          </li>
        ))}
      </ul>
    );
  },

  Editor: () => (
    <p className="ev-note">
      Pola tego formularza dodaje się osobno — nie w tym miejscu, bo nie są
      częścią konfiguracji, tylko własnymi wierszami.
    </p>
  )
});

export default formPart;
