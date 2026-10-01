/**
 * OSOBY — wer wofür steht: Karten mit Funktion, Foto und Kontakt (Altbestand:
 * `PeoplePart`).
 *
 * <b>Je Grösse:</b> im Streifen nur die Gesichter mit Namen in einer Reihe;
 * schmal eine Liste; breit ein Raster von Karten.
 */

import { AreaRow, asOptionalText, asRecord, asText, defineEventPart, ImageRow, ListEditor, mapEntries, TextRow } from '../event/kit';
import { imageUrl } from '../slides';

type Person = { name: string; role: string | null; detail: string | null; photoUrl: string | null; contact: string | null; contactHref: string | null };
type PeopleConfig = { people: Person[]; note: string | null };

const initials = (name: string): string =>
  name.split(/\s+/).filter((word) => word.length > 0).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');

/** Aus „+48 600 …" ein tel:, aus „a@b.pl" ein mailto: — wenn niemand einen Link angegeben hat. */
function hrefOf(person: Person): string | null {
  if (person.contactHref !== null) return person.contactHref;
  const said = person.contact ?? '';
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(said)) return `mailto:${said}`;
  if (/^\+?[\d\s()-]{7,}$/.test(said)) return `tel:${said.replace(/[^\d+]/g, '')}`;
  return null;
}

export const peoplePart = defineEventPart<PeopleConfig>({
  kind: 'people',
  label: 'Osoby',
  use: 'Karty osób z funkcją, zdjęciem i kontaktem.',
  box: { colSpan: 6, rowSpan: 3 },

  blank: () => ({ people: [], note: null }),
  example: () => ({
    people: [{ name: 'Jan Kowalski', role: 'Odpowiedzialny za trasę', detail: 'Prowadzi grupę i pilnuje tempa.', photoUrl: null, contact: '+48 000 000 000', contactHref: null }],
    note: null
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      /* Nichts fällt beim Lesen weg: eine Person wird ohne Namen angelegt und gleich danach benannt. */
      people: mapEntries<Person>(record.people, (item) => ({
        name: asText(item.name).trim(),
        role: asOptionalText(item.role),
        detail: asOptionalText(item.detail),
        photoUrl: asOptionalText(item.photoUrl),
        contact: asOptionalText(item.contact),
        contactHref: asOptionalText(item.contactHref)
      })),
      note: asOptionalText(record.note)
    };
  },

  hasContent: (c) => c.people.some((p) => p.name !== ''),

  shows: (_c, size) => size.height === 'strip' ? 'Zdjęcia z imionami w jednym rzędzie.'
    : size.width === 'narrow' ? 'Lista osób z funkcją i kontaktem.'
    : 'Karty osób: zdjęcie, funkcja, opis, kontakt.',

  Body: ({ config, ctx }) => {
    /* Eine Karte ohne Namen stellt niemanden vor. */
    const people = config.people.filter((person) => person.name.length > 0);
    const strip = ctx.size.height === 'strip';
    return (
      <div className={`ev-people${strip ? ' is-strip' : ''}${ctx.size.width === 'narrow' ? ' is-narrow' : ''}`}>
        <div className="ev-people-grid">
          {people.map((person, index) => {
            const href = hrefOf(person);
            return (
              <article key={index}>
                <div className="ev-person-avatar" aria-hidden="true">
                  {person.photoUrl !== null ? <img src={imageUrl(person.photoUrl)} alt="" loading="lazy" /> : <span>{initials(person.name)}</span>}
                </div>
                <div className="ev-person-body">
                  {!strip && person.role !== null && <p className="ev-person-role">{person.role}</p>}
                  <h3>{person.name}</h3>
                  {!strip && person.detail !== null && <p>{person.detail}</p>}
                  {!strip && person.contact !== null && (
                    <p className="ev-person-contact">{href !== null ? <a href={href}>{person.contact}</a> : person.contact}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {!strip && config.note !== null && <p className="ev-note">{config.note}</p>}
      </div>
    );
  },

  Edit: ({ config, onChange, ctx, busy }) => (
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
            <TextRow label="Funkcja" value={item.role ?? ''} hint="Np. „Odpowiedzialny za trasę”." onChange={(role) => update({ ...item, role: role || null })} />
            <TextRow label="Opis" value={item.detail ?? ''} onChange={(detail) => update({ ...item, detail: detail || null })} />
            <ImageRow label="Zdjęcie" value={item.photoUrl ?? ''} ctx={ctx} busy={busy} hint="Zostaw puste, żeby pokazać inicjały."
              onChange={(photoUrl) => update({ ...item, photoUrl: photoUrl || null })} />
            <TextRow label="Kontakt" value={item.contact ?? ''} hint="Telefon albo e-mail — link powstanie sam." onChange={(contact) => update({ ...item, contact: contact || null })} />
            <TextRow label="Odnośnik kontaktu" value={item.contactHref ?? ''} hint="Tylko jeśli ma prowadzić gdzie indziej, np. https://…" onChange={(contactHref) => update({ ...item, contactHref: contactHref || null })} />
          </>
        )}
      />
      <AreaRow label="Uwaga" rows={2} value={config.note ?? ''} onChange={(note) => onChange({ ...config, note: note || null })} />
    </>
  )
});
