import { asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { AreaRow, ListEditor, TextRow } from './editorKit';

type Person = {
  name: string;
  role: string | null;
  detail: string | null;
  photoUrl: string | null;
  contact: string | null;
  contactHref: string | null;
};

type PeopleConfig = {
  people: Person[];
  note: string | null;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

/** Who is responsible for what — the roster behind an event. */
export const peoplePart = definePart<PeopleConfig>({
  kind: 'people',
  label: 'Osoby',
  description: 'Karty osób z funkcją, zdjęciem i kontaktem.',

  defaultConfig: () => ({ people: [], note: null }),

  example: () => ({
    people: [
      {
        name: 'Jan Kowalski',
        role: 'Odpowiedzialny za trasę',
        detail: 'Prowadzi grupę i pilnuje tempa.',
        photoUrl: null,
        contact: '+48 000 000 000',
        contactHref: 'tel:+48000000000'
      }
    ],
    note: null
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      people: mapEntries<Person>(record.people, (item) => {
        const name = asText(item.name).trim();
        if (name.length === 0) return null;
        return {
          name,
          role: asOptionalText(item.role),
          detail: asOptionalText(item.detail),
          photoUrl: asOptionalText(item.photoUrl),
          contact: asOptionalText(item.contact),
          contactHref: asOptionalText(item.contactHref)
        };
      }),
      note: asOptionalText(record.note)
    };
  },

  Renderer: ({ config }) => (
    <div className="ev-people">
      {config.people.length === 0 ? (
        <p className="ev-note">Nie dodano jeszcze żadnych osób.</p>
      ) : (
        <div className="ev-people-grid">
          {config.people.map((person, index) => (
            <article key={index}>
              <div className="ev-person-avatar" aria-hidden="true">
                {person.photoUrl ? <img src={person.photoUrl} alt="" loading="lazy" /> : <span>{initials(person.name)}</span>}
              </div>
              <div className="ev-person-body">
                {person.role ? <p className="ev-person-role">{person.role}</p> : null}
                <h3>{person.name}</h3>
                {person.detail ? <p>{person.detail}</p> : null}
                {person.contact ? (
                  <p className="ev-person-contact">
                    {person.contactHref ? <a href={person.contactHref}>{person.contact}</a> : person.contact}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
      {config.note ? <p className="ev-note">{config.note}</p> : null}
    </div>
  ),

  Editor: ({ config, onChange }) => (
    <>
      <ListEditor<Person>
        legend="Osoby"
        items={config.people}
        addLabel="Dodaj osobę"
        blank={() => ({ name: '', role: null, detail: null, photoUrl: null, contact: null, contactHref: null })}
        titleOf={(item, index) => item.name || `Osoba ${index + 1}`}
        onChange={(people) => onChange({ ...config, people })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Imię i nazwisko" value={item.name} onChange={(name) => update({ ...item, name })} />
            <TextRow
              label="Funkcja"
              value={item.role ?? ''}
              hint="Np. „Odpowiedzialny za trasę”."
              onChange={(role) => update({ ...item, role: role || null })}
            />
            <TextRow
              label="Opis"
              value={item.detail ?? ''}
              onChange={(detail) => update({ ...item, detail: detail || null })}
            />
            <TextRow
              label="Zdjęcie"
              value={item.photoUrl ?? ''}
              hint="Zostaw puste, żeby pokazać inicjały."
              onChange={(photoUrl) => update({ ...item, photoUrl: photoUrl || null })}
            />
            <TextRow
              label="Kontakt"
              value={item.contact ?? ''}
              onChange={(contact) => update({ ...item, contact: contact || null })}
            />
            <TextRow
              label="Odnośnik kontaktu"
              value={item.contactHref ?? ''}
              hint="Np. mailto:… albo tel:…"
              onChange={(contactHref) => update({ ...item, contactHref: contactHref || null })}
            />
          </>
        )}
      />
      <AreaRow
        label="Uwaga"
        rows={2}
        value={config.note ?? ''}
        onChange={(note) => onChange({ ...config, note: note || null })}
      />
    </>
  )
});
