/**
 * OSOBY — wer wofür steht: Karten mit Funktion, Foto und Kontakt (Altbestand:
 * `PeoplePart`).
 *
 * <b>Je Grösse:</b> im Streifen nur die Gesichter mit Namen in einer Reihe;
 * schmal eine Liste; breit ein Raster von Karten.
 */

import { t, useT } from '../../core/i18n';
import { lazyPart } from './partTexts';
import { AreaRow, asOptionalText, asRecord, asText, defineEventPart, ImageRow, ListEditor, mapEntries, TextRow } from '../event/kit';
import { imageUrl } from '../slides/slideLook';
import { FadeImg } from '../../ui/fadeImage';

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

/* Die Texte der Beschreibung je Sprache (`lazyPart`): `defineEventPart` liest sie beim Anlegen. */
export const peoplePart = lazyPart(() => defineEventPart<PeopleConfig>({
  kind: 'people',
  label: t('moduleData.people.label'),
  use: t('moduleData.people.use'),
  box: { colSpan: 6, rowSpan: 3 },

  blank: () => ({ people: [], note: null }),
  example: () => ({
    people: [{ name: t('moduleData.people.ex.name'), role: t('moduleData.people.ex.role'), detail: t('moduleData.people.ex.detail'), photoUrl: null, contact: '+48 000 000 000', contactHref: null }],
    note: null
  }),

  /* 0064 — was jeder Schlüssel im JSON bedeutet (die Beschreibung neben dem Import). */
  keys: {
    people: t('moduleData.people.k.people'),
    'people[].name': t('moduleData.people.k.name'),
    'people[].role': t('moduleData.people.k.role'),
    'people[].detail': t('moduleData.people.k.detail'),
    'people[].photoUrl': t('moduleData.people.k.photo'),
    'people[].contact': t('moduleData.people.k.contact'),
    'people[].contactHref': t('moduleData.people.k.contactHref'),
    note: t('moduleData.people.k.note')
  },

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

  shows: (_c, size) => size.height === 'strip' ? t('moduleData.people.showsStrip')
    : size.width === 'narrow' ? t('moduleData.people.showsNarrow')
    : t('moduleData.people.showsBlock'),

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
                  {person.photoUrl !== null ? <FadeImg src={imageUrl(person.photoUrl)} alt="" loading="lazy" /> : <span>{initials(person.name)}</span>}
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

  Edit: function PeopleEdit({ config, onChange, ctx, busy }) {
    const t = useT();
    return (
    <>
      <ListEditor<Person>
        legend={t('moduleData.people.label')}
        items={config.people}
        addLabel={t('moduleData.people.add')}
        blank={() => ({ name: '', role: null, detail: null, photoUrl: null, contact: null, contactHref: null })}
        titleOf={(item, index) => item.name || t('moduleData.people.personN', { n: index + 1 })}
        onChange={(people) => onChange({ ...config, people })}
        renderItem={(item, update) => (
          <>
            <TextRow label={t('moduleData.people.name')} value={item.name} onChange={(name) => update({ ...item, name })} />
            <TextRow label={t('moduleData.people.role')} value={item.role ?? ''} hint={t('moduleData.people.roleHint')} onChange={(role) => update({ ...item, role: role || null })} />
            <TextRow label={t('common.description')} value={item.detail ?? ''} onChange={(detail) => update({ ...item, detail: detail || null })} />
            <ImageRow label={t('moduleData.people.photo')} value={item.photoUrl ?? ''} ctx={ctx} busy={busy} hint={t('moduleData.people.photoHint')}
              onChange={(photoUrl) => update({ ...item, photoUrl: photoUrl || null })} />
            <TextRow label={t('moduleData.people.contact')} value={item.contact ?? ''} hint={t('moduleData.people.contactHint')} onChange={(contact) => update({ ...item, contact: contact || null })} />
            <TextRow label={t('moduleData.people.contactHref')} value={item.contactHref ?? ''} hint={t('moduleData.people.contactHrefHint')} onChange={(contactHref) => update({ ...item, contactHref: contactHref || null })} />
          </>
        )}
      />
      <AreaRow label={t('moduleData.plan.note')} rows={2} value={config.note ?? ''} onChange={(note) => onChange({ ...config, note: note || null })} />
    </>
    );
  }
}));
