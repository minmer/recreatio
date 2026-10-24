# Events

*Design, 2026-10-24. Not built. An event's data controller comes from [DATA-CONTROLLER.md](DATA-CONTROLLER.md).*

## 1. What is asked

An event has its own pages and internal subpages, and its own forms and sub-forms. Examples are rekolekcje, a
pilgrimage, a camp, workshops, or a year of preparation for confirmation. When an event is created, it should appear
on several websites by itself. There must be no second structure next to the ones that already exist, and the event
must fit the way pages work today.

## 2. What already exists

Almost every piece an event needs is already built, as a general piece:

| an event needs | exists as |
|---|---|
| people, leaders, keys | an area with its roles and certificates |
| participants | a form's roles (0091/0120), seats and links, a mini area per submission (0120) |
| registration, consents, payments, notes | forms and sub-forms (extensions, 0047), needs (0086), steps, rounds (0077) |
| date, place, programme | an appointment with sub-appointments (0070) and its link field (0073) |
| a conversation | the area's chat or channel (0080) |
| a public page with internal subpages | subpages; access-only pages bound to areas (0051); sealed pages (0121) |
| the same form on two pages | one module in two places (0036) |
| navigation | the page menu, either its own or taken over from another page (0056) |
| content | the event parts (0063): Tytuł, Krótkie informacje, Plan, Mapa, Koszty, Pytania, Osoby, Pliki, Galeria; also Program, Kalendarz, Formularz |
| a page about one of many | the page subject, with a list page and a detail page (0082, 0104) |
| showing on other websites | widgets: any part of a public page, for example on WordPress |
| building from a description | page JSON; since 2026-10-24 it also carries appointments and calendar entry points |
| who is responsible for the data | the area's data controller |

What is missing is small but decisive:

1. **Nothing marks these pieces as one event.** The area, its appointment and its pages do not know about each
   other. The starter "Zapisy na wydarzenie" creates them and does not record that they belong together.
2. **There is no list of events.** A site cannot show "our coming events", so every new event means editing other
   pages by hand.
3. **Facts are typed twice.** Date and place go into the calendar and again into Tytuł and Krótkie informacje, and
   then drift apart.
4. **Each new event is built by hand.** Last year's confirmation or pilgrimage has to be rebuilt piece by piece.

## 3. The idea

**An event is an area marked as an event.** The mark points to the event's main page and its main appointment, and
holds nothing else. Everything else stays where it lives now:

- people, roles, forms, sub-forms and chats stay in the area;
- date, place and programme stay in the appointment;
- title, lead and image stay on the page;
- the data controller stays in its record.

Three new pieces build on that mark:

- **Part "Wydarzenia"** lists events by a rule: "the events of these areas and everything below them". A new event
  therefore appears by itself on every site whose list covers its organiser, and through the widget on external
  websites.
- **A page about the chosen event** lets another site show an event in its own layout. It uses the event's own
  modules, so nothing is copied.
- **"Nowe wydarzenie"** creates the whole structure from a template. A template is the existing JSON formats bundled
  together, so the previous edition, a built-in kind and the owner's own AI-made JSON all work the same way.

**Not every appointment is an event.** A concert or a one-evening service stays an appointment in a public calendar,
shown by part "Kalendarz". An appointment becomes an event, with an area, when people gather around it:
registration, participants, leaders, internal pages.

## 4. An event

### 4.1 The mark

`app.area_event`: one row turns an area into an event.

| column | meaning |
|---|---|
| `area_id` (key) | the area that is the event |
| `slug_id` | its main page. Optional: an event can exist before its page does, or be shown only through other sites' detail pages |
| `item_id` | its main appointment: one span that does not repeat. Optional: a year-long preparation may have none |
| `kind` | one plaintext word for filtering: rekolekcje, pielgrzymka, wyjazd, kurs, koncert … |

The row holds no title, date or text. **Each fact has one home:**

| fact | lives in | shown by |
|---|---|---|
| title, lead, image | the main page (`slug_page`). The image is new: `slug_page.image_id`, one of the page's files | cards, the page, link previews |
| date, time, place, status ("odwołane") | the main appointment | cards, part "Wydarzenie", calendars, reminders |
| programme | the sub-appointments (0070) | parts "Program" and "Wydarzenie", calendars |
| registration | the event's forms | part "Formularz", "Zapisy otwarte" on cards |
| organiser | the area chain (the nearest public area above) | cards |
| data controller | the record of the area chain | every form of the event |
| people | roles, seats, mini areas | as today |

### 4.2 The areas of an event

An area is a key: whoever holds the key reads everything sealed under it, and a public area publishes its key. Form
questions are sealed under an area's key as well (`slug_field.label_area_id`), so a public registration form needs a
public area anyway. That is why the **event's own area is its public face**, and the private parts are areas below it:

```
Parafia (public)                            data controller here
└── Pielgrzymka rowerowa 2027 (public)      area_event: main page + main appointment
    │   calendar: the main appointment and its programme
    │   forms: Zapisy (questions public; answers sealed for the leaders, as for every form)
    ├── Uczestnicy (private)                read by the participants' role: chat, meetings, page …/uczestnicy
    ├── Prowadzący (private)                the leaders: their page …/prowadzacy, notes, chat
    └── a mini area per submission (0120)   "uczestnik i prowadzący", "notatki prowadzących"
```

A private event, such as a group's internal camp, has the same shape with the event area private. It then appears
only on access-only pages and in the workspace. The template decides how many sub-areas an event has; a concert needs
none.

### 4.3 Pages

The pages are ordinary addresses under a page the organiser leads, for example
`parish/grzegorzki/pielgrzymka-2027`, with subpages:

| subpage | access | carries |
|---|---|---|
| (main) | public | Tytuł, Wydarzenie (date, place, registration), Plan, Mapa, Koszty, Pytania |
| `program` | public | Program, from the main appointment |
| `zapisy` | public | the registration form |
| `uczestnicy` | bound to "Uczestnicy" | the form's portal: Twoje zgłoszenie, Kroki, Zadania, Rozmowa |
| `prowadzacy` | bound to "Prowadzący" | Lista osób and Osoba (0082/0104), notes |

- **Who edits them.** The leaders' role leads the pages, not whoever leads the parish site; the nearest claimed address
  decides (`Access.OfAsync`). The event's people edit their event and nothing else.
- **Navigation.** The event pages keep the menu of the site they stand in, taken over as in 0056. An "Odnośniki" strip
  at the top of each event page links the event's subpages. Visitors stay on the parish site, and the event still has
  its own tabs. A template can give an event its own menu instead; that works today too.
- **Internal subpages.** To everyone else, internal subpages say that access is needed (403, as now).

### 4.4 Forms and sub-forms

They are created in the event area, and their answers go to the leaders, as for every form. That includes:

- the registration form;
- its needs: Zgoda rodzica, Zdrowie, Ubezpieczenie;
- its sub-forms: Wpłaty, Zakwaterowanie, Notatki;
- its roles and virtual areas;
- its portal `…/uczestnicy`, chosen in the form's settings.

The template puts them into a form folder (0096) named after the event, so "Formularze" shows them together. None of
this is new; the event only creates them.

## 5. On many websites, without copies

There are three ways, from automatic to hand-picked. None of them copies a page or a form.

### 5.1 Lists by rule (automatic)

Part **"Wydarzenia"** (`events`):

- **Sources.** One or more areas, including everything below them by default ("the events of the parish"). A new event
  under the parish appears on every list with that source, and nobody has to touch those pages. A later option can
  add the appointments of chosen calendars, so that small events without an area appear in the same list, opening
  their link.
- **Filter.** By kind; coming, past ("Archiwum") or all; how many.
- **Each size has its own view**, as every part must:

  | size | view |
  |---|---|
  | strip | the next event in one line |
  | block | the next three, as lines or cards |
  | tall | a list by month with kind chips |
  | wide/full and fullscreen | the catalogue: search, kind, place, coming/archive, sort (what the legacy `EventsCatalogue` did) |

- **Public data only.** An event is shown if its main page is public and its main appointment is visible to everyone.
  A later step could also show, to signed-in visitors on access-only pages, the private events their areas can read.
- **Other websites.** As a part of a public page, the list embeds through the existing widget
  (`#/widget/<part>/<page>`). A parish WordPress site then shows new events without being edited.

### 5.2 On request: another organisation's list

The leaders of an event can ask to appear in a list they do not lead, such as a co-organiser's site, the diocese or
the catalogue ("Pokaż też na…").

- The list's leaders see the request in the bell ("Prośby o pokazanie wydarzenia") and accept or refuse it once.
- A list can take requests without asking ("przyjmuj bez pytania"); it then shows them at once, and its leaders can
  still remove one.
- The catalogue at `recreatio.pl/events` (claimed, still empty) is such a list. It takes every public event whose
  leaders tick "Pokaż w katalogu".
- The request goes to the list (the module), so a list that stands on two pages accepts only once.

### 5.3 In the host's own layout: a page about the chosen event

A site may want to keep visitors inside its own menu and look instead of sending them to the organiser's site. Persons
already work this way: a list page and a detail page linked by `?wpis=` (0082).

- **The detail page.** A host page, for example `oaza/wydarzenia/szczegoly`, declares that it is **about an event**:
  page subject kind `event`. The event is either chosen from the address (`?wydarzenie=<id>`, with ◀ ▶ in the list's
  order) or fixed to one event.
- **Part "Wydarzenie"** (`event`) shows the chosen event live:
  - the title, lead and image of its page;
  - date and place, and the programme;
  - its open registration forms.

  Registration happens in the event's own form, the same module that stands on the event's pages (0036). Every
  submission lands in that one form, and the person's link leads to the event's own participants' page.
- **The host's list** opens its cards on this page ("Szczegóły na stronie: …"); without one, on the event's own page.

On the event's own pages, the same part (with the subject fixed to the event) replaces typing date and place into
Tytuł and Krótkie informacje.

### What is deliberately not done

- **No copies of event pages per site.** Two pages for one event drift apart.
- **No mounted subtrees.** Mounting would be an alias of the whole event tree under the host's address, with the
  host's menu. It would put the event under the host's own domain, but every link, portal rule, access check and menu
  would have to learn that one tree has two addresses. The detail page gives the same visible result with what already
  exists. If a site on its own domain ever needs the internal subpages too, mounting can be added later on top of
  aliases (0014).

## 6. Creating an event

### 6.1 "Nowe wydarzenie"

It replaces the starter "Zapisy na wydarzenie" (Nowe → Wydarzenie…). One dialog asks for:

- name, date (from–to, or times), place, kind, and whether the event is public;
- the organiser: the area it goes under, from the areas the account leads. The dialog shows which data controller
  will apply, or offers the saved ones when the chain has none;
- where its page goes: under a page the account leads, or no page yet;
- the template: a built-in kind, an earlier event ("na wzór: Pielgrzymka 2026"), or a JSON file;
- where else it will show. Lists that take it by rule are named ("pojawi się na: parish/grzegorzki, widżet na stronie
  parafii"). Requests to other lists can be ticked; for a new edition, the lists of the previous one are suggested.

From the template it then creates:

- the areas, the intake, and the roles (the creator holds the leaders' role);
- the main appointment and its programme, with dates shifted to the chosen start;
- the pages with their access, menu and parts;
- the forms and sub-forms in their folder, and the chat;
- the mark, and the requests.

The done screen links the page editor, the forms and the participants' link.

### 6.2 Templates are the existing JSON formats, bundled

The format `recreatio/event` adds only the bundle itself and relative dates:

```json
{
  "format": "recreatio/event", "version": 1,
  "kind": "pielgrzymka", "public": true,
  "areas":  [{ "key": "uczestnicy", "name": "Uczestnicy" }, { "key": "prowadzacy", "name": "Prowadzący" }],
  "roles":  [{ "key": "uczestnicy", "name": "Uczestnicy: {name}", "areas": { "@uczestnicy": "read" } },
             { "key": "prowadzacy", "name": "Prowadzący: {name}", "creator": true,
               "areas": { "@event": "admin", "@prowadzacy": "admin", "@uczestnicy": "write" } }],
  "appointments": [{ "key": "main", "title": "{name}", "start": "+0d 08:00", "end": "+1d 18:00",
                     "points": [{ "title": "Wyjazd spod kościoła", "start": "+0d 08:00", "end": "+0d 08:30" }] }],
  "pages": [
    { "path": "",           "ledBy": "@prowadzacy", "page": { "format": "recreatio/page", "…": "…" } },
    { "path": "uczestnicy", "access": ["@uczestnicy"], "page": { "…": "…" } }
  ]
}
```

- **Pages.** Each `page` is a page document exactly as page JSON exports it: parts, menu, logic, subject, and forms
  with everything a module document carries (questions, design, needs, roles, virtual areas, folder, rounds —
  `modules/moduleImport.ts`). `@keys` resolve the way the appointment import already resolves them: `@main` in
  Program, `@uczestnicy` as a form's role, `{path}` in a form's portal.
- **Pictures.** A template asks for the event's own photos and files the way a page document already can (since
  2026-10-24): each described in `images`, used as `page-image:@key`. The dialog shows the descriptions, the
  organiser adds the files, and they land in every place that uses them.
- **Export.** "Zapisz jako wzór" and "Kolejna edycja" export an event into this format:
  - dates become relative to its main appointment;
  - ids are dropped;
  - the event's name is replaced by `{name}`.

  Never exported: submissions, people, seats and links, messages, people's files.
- **Built-in kinds** are such files in `templates/events/`, like `templates/cogita/`, not code:
  - "Wydarzenie bez zapisów";
  - "Wydarzenie z zapisami";
  - "Wyjazd z noclegiem": consents, insurance, payments, participants' and leaders' pages;
  - "Przygotowanie do bierzmowania", taken from the structure built in Grzegórzki.
- **Description.** The description of the format stands next to its import and is generated from the code, as every
  JSON format must; `app-json-check` covers it. Descriptions are a tree since 2026-10-24 (`core/jsonTree.ts`): the
  event format is one node whose `inside` holds the page format (`PAGE_JSON`), so pages, modules, forms and their
  needs are described once and never copied.

## 7. Underneath

### Data

```sql
-- 0130
CREATE TABLE app.area_event (
    area_id    uniqueidentifier NOT NULL PRIMARY KEY REFERENCES app.area (id),
    slug_id    uniqueidentifier NULL REFERENCES app.slug (id),            -- unique where not null
    item_id    uniqueidentifier NULL REFERENCES app.calendar_item (id),
    kind       nvarchar(40)   NULL,
    created_at datetimeoffset NOT NULL,
    created_by_role_id uniqueidentifier NULL
);
ALTER TABLE app.slug_page ADD image_id uniqueidentifier NULL REFERENCES app.page_image (id);

-- 0131 (step E4)
CREATE TABLE app.event_listing (
    area_id   uniqueidentifier NOT NULL REFERENCES app.area_event (area_id) ON DELETE CASCADE,
    module_id uniqueidentifier NOT NULL REFERENCES app.module (id) ON DELETE CASCADE,   -- the list
    state     nvarchar(8) NOT NULL,                                  -- asked | shown | refused
    asked_by_role_id   uniqueidentifier NOT NULL, asked_at   datetimeoffset NOT NULL,
    decided_by_role_id uniqueidentifier NULL,     decided_at datetimeoffset NULL,
    PRIMARY KEY (area_id, module_id)
);
```

- **Pointers go one way.** Like `module`, the mark points at an area, a page and an appointment, and none of them
  points back. The three orders (areas, roles, pages) meet in a fourth thing, not in each other's columns.
- **Deleting.** Deleting a page, a page image or an appointment clears its pointer. Deleting the area deletes the mark
  and its requests.

### Service

| call | who |
|---|---|
| `POST /workspace/area/{id}/event` `{ slug, itemId, kind }` or `{ off: true }` | admin of the area, who leads the page. The appointment must be in a calendar of the area and must not repeat |
| `GET /events?areas=…&deep=1&module=…&from=…&to=…&kind=…` | anyone. Public events only, each with: its page; sealed title and place, with their area and epoch, opened with published keys as in public calendars; start, end and status; organiser; whether registration is open; how it got into the list (rule or request) |
| `GET /event/{areaId}` | anyone. One event, as above, plus its programme and its open public forms (for part "Wydarzenie") |
| `POST /workspace/event/{areaId}/listing` `{ moduleId }` and `POST /workspace/listing/{area}/{module}` `{ accept }` | the event's admin asks; whoever tends the list decides |

The service still does not read part configs. The list passes its sources in the query; only requests are looked up
by the module's id.

### Browser

- **Code.** A domain folder `events/` holds:
  - the client (`areaEvent.ts`);
  - the two parts (`parts/events.tsx`, `parts/event.tsx`);
  - the subject kind (`eventSubject.tsx`, registered in `pageSubject.tsx`);
  - the dialog, and template import and export (`eventJson.ts`).
- **Workspace.** The event is shown where its area is:
  - Obszary marks events with their date;
  - the area overview gets an event header: page, date, the lists it stands in, "Zapisz jako wzór", "Kolejna
    edycja", "Pokaż też na…";
  - a new workspace part "Wydarzenia" lists coming events the account leads or takes part in.
- **Bell.** A new alert kind `listings` (requests waiting for a decision), with a digest field carrying the area.
- **JSON.** Page JSON gains `image`; parts `events` and `event` give examples; the event format has its description.
  `app-json-check` checks all of it.
- **Naming.** In the code, "event" already means calendar entries (`EventDialog`, `.wk-ev`). The new code says
  `areaEvent` and `eventList` and uses its own CSS prefix.

## 8. Today → after

| today | after |
|---|---|
| "Zapisy na wydarzenie" makes an area, a form, one page and a role, with no date, and does not record that they belong together | "Nowe wydarzenie" makes the whole event from a template: date, programme, subpages, sub-forms, data controller check, and the mark that ties them together |
| date and place typed into Tytuł / Krótkie informacje and again into the calendar | only in the appointment; pages show them through part "Wydarzenie" |
| a new event is added to other pages by hand | lists by rule show it at once; other organisations accept a request once; WordPress through the widget |
| another site can show the event only as a link | it can also show it in its own layout, on a page about the chosen event |
| next year, everything is rebuilt by hand | "Kolejna edycja" |
| the legacy catalogue (`/events` in the old service) is gone | `recreatio.pl/events` with a "Wydarzenia" list at catalogue size |

## 9. Plan

Each step works on its own and is deployed (the API first, then the website) before the next one. The owner applies
the migrations.

| step | what | migration |
|---|---|---|
| A1 | data controller records, picking, the clause with IOD and authority ([DATA-CONTROLLER.md](DATA-CONTROLLER.md)) | 0129 |
| E1 | the mark, the page image, `GET /events`, part "Wydarzenia" (sizes, widget), marking an area as an event in its settings | 0130 |
| E2 | "Nowe wydarzenie" with the built-in structure, replacing "Zapisy na wydarzenie" | — |
| E3 | page subject `event`, part "Wydarzenie", lists that open the host's detail page | — |
| E4 | requests to other lists, the bell, the catalogue | 0131 |
| E5 | templates: `recreatio/event`, "Zapisz jako wzór", "Kolejna edycja", built-in files | — |

With E1 alone, existing setups (such as the confirmation in Grzegórzki) can already be marked as events. A list shows
them once their main page and appointment are public.

## 10. Decisions for the owner

1. **The catalogue at `recreatio.pl/events`:** does it take every public event that ticks "Pokaż w katalogu"
   automatically, or does someone approve each one?
2. **Navigation on event pages:** keep the site's menu plus an event strip (proposed), or give each event its own
   menu?
3. **Other domains:** is the page about the chosen event enough for co-organisers' sites, or must the whole event,
   internal subpages included, live under their domain (mounting, §5)?
4. **First templates:** which kinds? Should "Przygotowanie do bierzmowania" be taken from the live Grzegórzki
   structure?
5. **Private events in lists** for signed-in members (a later step): are they needed?

## 11. Alternatives considered

- **An event as its own subsystem** (the legacy `rc_event` with its own registration, card, roster and catalogue).
  This is exactly the double structure to avoid: everything it had exists today as forms, seats, steps, chats and
  parts.
- **An event as an appointment only.** An appointment has no people, keys, forms or chat. That is enough for a
  concert, which stays a plain appointment in a public calendar.
- **An event as a page only.** A page has no keys and no people; access and forms need an area anyway.
- **One template page that renders every event.** Changing the template would rewrite last year's pages, and an
  event's own content (plan, FAQ, gallery) would have nowhere to live. The page about the chosen event is generic only
  for what the event itself already holds.
- **Listing by calendar** (putting the appointment into the site's calendar). An appointment belongs to one calendar,
  so a co-organiser could show either all events of the other calendar or none.
