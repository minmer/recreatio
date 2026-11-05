/* i18n-ignore-file */
/**
 * 0133 — DIE BEISPIELE eines Wydarzenie und einer Grupa (aus `areaJsonText.ts`): Daten, wie eine
 * Besitzerin sie schreibt — sie lassen sich ohne ein Wort importieren (`scripts/app-duty-check.mjs`).
 * Inhalt gehört seinem Autor; die App übersetzt ihn nicht.
 */

import { DEFAULT_ENTRY } from '../calendar/appointmentsJson';
import { NEED_PREFIX } from '../pages/pageImageNeeds';
import { AREA_FORMAT } from './areaJson';

/* -- Beispiele ------------------------------------------------------------------------- */

const SIGNUP = [
  { id: 'imie', kind: 'line', label: 'Imię', required: true, halfWidth: true, identity: 'given_name' },
  { id: 'nazwisko', kind: 'line', label: 'Nazwisko', required: true, halfWidth: true, identity: 'surname' },
  { id: 'telefon', kind: 'phone', label: 'Telefon', required: true, halfWidth: true, identity: 'phone' },
  { id: 'email', kind: 'email', label: 'E-mail', required: false, halfWidth: true, identity: 'email' }
];

/** Ein Wydarzenie: Rekolekcje mit Zapisy, Programm, Seite danach mit Materialien nur für Teilnehmer. */
export function areaExample(): Record<string, unknown> {
  return {
    format: AREA_FORMAT,
    version: 1,
    kind: 'event',
    name: 'Rekolekcje adwentowe 2026',
    category: 'rekolekcje',
    address: 'parafia/rekolekcje-2026',
    publish: 'auto',
    archive: 'auto',
    card: { title: 'Rekolekcje adwentowe 2026', lead: 'Trzy wieczory ze słowem, ciszą i wspólnotą — 4–6 grudnia w kościele parafialnym.', image: `${NEED_PREFIX}plakat` },
    roles: [
      { key: 'organizatorzy', name: 'Organizatorzy', level: 'admin' },
      { key: 'pomocnicy', name: 'Pomocnicy', level: 'write', link: { days: 30 } },
      { key: 'uczestnicy', name: 'Uczestnicy', level: 'read' }
    ],
    appointments: [{
      key: 'main', main: true, title: 'Rekolekcje adwentowe 2026', start: '2026-12-04T18:00', end: '2026-12-06T21:00', location: 'Kościół parafialny',
      points: [
        { key: 'dzien1', title: 'Dzień 1 — Słowo', start: '2026-12-04T18:00', end: '2026-12-04T21:00' },
        { title: 'Dzień 2 — Cisza', start: '2026-12-05T18:00', end: '2026-12-05T21:00' },
        { title: 'Dzień 3 — Wspólnota', start: '2026-12-06T18:00', end: '2026-12-06T21:00' }
      ]
    }],
    pages: [
      {
        key: 'main', path: '', main: true, access: 'public',
        page: {
          title: 'Rekolekcje adwentowe 2026',
          lead: 'Trzy wieczory ze słowem, ciszą i wspólnotą.',
          images: [{ key: 'plakat', label: 'Plakat rekolekcji', description: 'Plakat albo zdjęcie kościoła wieczorem; poziomo — na kartę i na górę strony' }],
          modules: [
            { id: 'wizytowka', kind: 'event', config: { title: '', area: '@area' } },
            { id: 'zdjecie', kind: 'image', config: { url: `${NEED_PREFIX}plakat`, alt: 'Kościół parafialny wieczorem', fit: 'cover' } },
            { id: 'program', kind: 'program', config: { title: 'Program', calendar: '', item: '@main', hide: '' } },
            { id: 'zapisy', kind: 'form', name: 'Zapisy na rekolekcje', questions: SIGNUP, memberRoles: ['@uczestnicy'] },
            { id: 'napisz', kind: 'seat-ask', config: { title: 'Napisz do organizatorów' }, answer: ['@role:organizatorzy'], forms: ['@form:main/zapisy'] }
          ]
        }
      },
      {
        key: 'po', path: 'po', after: true,
        page: {
          title: 'Po rekolekcjach',
          lead: 'Dziękujemy, że byliście.',
          modules: [
            { id: 'podziekowanie', kind: 'text', config: { title: 'Dziękujemy', body: 'Nagrania konferencji i zdjęcia są niżej — tylko dla uczestników.' } },
            { id: 'materialy', kind: 'files', members: true, config: { files: [{ label: 'Konferencje (nagrania)', url: 'https://…/konferencje.zip', note: null, size: null }], note: null } }
          ]
        }
      }
    ],
    subforms: [{
      key: 'zgody', of: '@form:main/zapisy', name: 'Zgoda na zdjęcia', audience: 'person',
      questions: [{ id: 'zgoda', kind: 'choice', label: 'Czy zgadzasz się na zdjęcia z rekolekcji na stronie parafii?', options: ['Tak', 'Nie'], required: true }]
    }],
    chats: [{ kind: 'area', forms: ['@form:main/zapisy'] }, 'channel']
  };
}

/** Eine Grupa: Schola mit wöchentlicher Probe, einer Seite nur für Mitglieder und einem Link für sie. */
export function groupExample(): Record<string, unknown> {
  return {
    format: AREA_FORMAT,
    version: 1,
    kind: 'group',
    name: 'Schola parafialna',
    address: 'parafia/schola',
    publish: 'area',
    card: { title: 'Schola parafialna', lead: 'Śpiewamy na mszy niedzielnej o 11:00. Próby w czwartki o 19:00.' },
    roles: [{ key: 'czlonkowie', name: 'Członkowie scholi', level: 'write', link: { days: 60 } }],
    appointments: [{ key: 'proba', title: 'Próba scholi', start: '2026-11-05T19:00', end: '20:30', repeat: 'weekly', weekdays: ['cz'], location: 'Salka przy zakrystii' }],
    pages: [{
      key: 'main', path: '', main: true, access: 'members',
      page: {
        title: 'Schola — dla członków',
        modules: [
          { id: 'kalendarz', kind: 'calendar', config: { title: 'Próby i występy', calendars: `@${DEFAULT_ENTRY}` } },
          { id: 'nuty', kind: 'files', config: { files: [{ label: 'Śpiewnik na Adwent', url: 'https://…/spiewnik.pdf', note: null, size: 'PDF' }], note: null } }
        ]
      }
    }],
    chats: ['area']
  };
}
