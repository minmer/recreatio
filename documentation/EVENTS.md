# Events

*Design, 2026-10-24, updated 2026-10-25 after the owner's review (brief "data controller, reports and events"). Not
built. An event's data controller comes from [DATA-CONTROLLER.md](DATA-CONTROLLER.md); reporting cards and widgets
from [REPORTS.md](REPORTS.md). The owner's decisions are in §10.*

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
| participants | a form's roles (0091/0120), seats and links, a mini area per submission (0120), made by a leader's browser when it next comes by |
| registration, consents, payments, notes | forms and sub-forms (extensions, 0047), needs (in the form's settings, 0086), steps, rounds (0077) |
| date, place, programme | an appointment with sub-appointments (0070) and its link field (0073) |
| a conversation | the area's chat (0052) or channel (0080) |
| a public page with internal subpages | subpages; access-only pages bound to areas (0051); sealed pages (0121) |
| the same form on two pages | one module in two places (0036) |
| navigation | the page menu, its own or taken over from another page (0056). Menus are not inherited (0058): a page without its own menu shows none, and only someone who leads both pages can make one use the other's menu |
| content | the event parts (0063): Tytuł, Krótkie informacje, Plan, Mapa, Koszty, Pytania, Osoby, Pliki, Galeria; also Program, Kalendarz, Formularz |
| a page about one of many | the page subject, with a list page and a detail page (0082; the office's view of a person's own page came in round 0104, which has no migration) |
| showing on other websites | widgets: any part of a public page, for example on WordPress |
| building from a description | page JSON; since 2026-10-24 it also carries appointments and calendar entry points, and asks for files (`images`) |
| who is responsible for the data | the record that applies to the area ([DATA-CONTROLLER.md](DATA-CONTROLLER.md)) |

What is missing is small but decisive:

1. **Nothing marks these pieces as one event.** They are linked only through their area: the page shows the area's
   form, an appointment sits in a calendar of the area, access-only pages are bound to it. Nothing records which page
   and which appointment are the event's main ones. The starter "Zapisy na wydarzenie" creates an area (inside a chosen
   area or standalone) with its intake, a form with four questions, optionally a subpage with that form and, by
   default, a role "Uczestnicy: …" that every submitter holds. It creates no appointment. The area is not made public
   and gets no controller, so the form accepts nothing from strangers until someone makes the area public and a
   controller applies.
2. **There is no list of events.** Part "Kalendarz" shows the coming appointments of calendars chosen one by one, but a
   new event in its own area has its own calendar, so every other page has to be edited by hand to show it.
3. **Facts are typed twice.** Date and place go into the calendar and again into Tytuł and Krótkie informacje, and
   then drift apart. Since 2026-10-25 part "Program wydarzenia" shows the appointment's name, date and place live, but
   Tytuł and Krótkie informacje cannot.
4. **Each new event is assembled by hand.** Last year's pages can be exported and imported one by one as page JSON,
   with their forms, but the area, sub-areas, roles, access, appointments and links are made again.

## 3. The idea

**An event is an area marked as an event.** The mark points to the event's main page and its main appointment, and
holds nothing else. Everything else stays where it lives now:

- forms, sub-forms and chats stay in the area, which its people and roles reach through certificates;
- date, place and programme stay in the appointment;
- title and lead stay on the page, and so does the image, which is new;
- the data controller stays in its record, which the area uses by a signed attachment or inherits.

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
| `slug_id` | its main page. Optional: an event can exist before its page does, or be shown only through other sites' detail pages. Its registration form, though, takes submissions only while it stands on at least one page |
| `item_id` | its main appointment: one span that does not repeat. Optional: a year-long preparation may have none |
| `kind` | one plaintext word for filtering: rekolekcje, pielgrzymka, wyjazd, kurs, koncert … |

The row holds no title, date or text. **Each fact has one home:**

| fact | lives in | shown by |
|---|---|---|
| title, lead, image | the main page (`slug_page`). The image is new: `slug_page.image_id`, one of the page's files | cards, the page |
| date, time, place, status ("odwołane") | the main appointment | cards, parts "Wydarzenie" and "Program wydarzenia", calendars |
| programme | the sub-appointments (0070) | parts "Program" and "Wydarzenie", calendars |
| registration | the event's forms | part "Formularz"; "Zapisy otwarte" on cards only while a form really accepts submissions (§5.1) |
| organiser | the area chain (the nearest public area above) | cards |
| data controller | the record that applies to the event's area | every form of the event, the event header |
| people | roles, seats, mini areas | as today |

### 4.2 The areas of an event

An area is a key: whoever holds the key reads everything sealed under it, and a public area publishes its key. A form's
questions, its name and its design are sealed under the key of the form's own area (recorded per question in
`slug_field.label_area_id`), so a public registration form needs a public area anyway. That is why the **event's own
area is its public face**, and the private parts are areas below it:

```
Parafia (public)                              its controller record; the event below inherits it (no new signature)
└── Pielgrzymka rowerowa 2027 (public)        area_event: main page + main appointment
    │   calendar: the main appointment and its programme
    │   forms: Zapisy (questions public; answers for the leaders' role)
    │   ├── virtual area "Uczestnik i prowadzący"    one mini area per submission (0120)
    │   └── virtual area "Notatki prowadzących"      one mini area per submission
    ├── Uczestnicy (private)                  read by the participants' role: chat, meetings, page …/uczestnicy
    └── Prowadzący (private)                  the leaders: their page …/prowadzacy, notes, chat
```

- **Who reads the answers.** An area has one intake, created once and never replaced; its private key is sealed for
  exactly one role, and only holders of that role open the answers. Every form flow today seals it for the creating
  person's own role (only Cogita's settings offer a choice of role), and writing a question into an area without an
  intake creates one for the writer's person. The event therefore creates its area's intake for the leaders' role
  before it writes any question.
- **Private events.** A group's internal camp has the same shape with the event area private. It then appears only on
  access-only pages and in the workspace. The template decides how many sub-areas an event has; a concert needs none.

### 4.3 Pages

The pages are ordinary addresses under a page the organiser leads, for example
`parish/grzegorzki/pielgrzymka-2027`, with subpages:

| subpage | access | carries |
|---|---|---|
| (main) | public | Tytuł, Wydarzenie (date, place, registration), Plan, Mapa, Koszty, Pytania |
| `program` | public | Program, from the main appointment |
| `zapisy` | public | the registration form |
| `uczestnicy` | bound to "Uczestnicy" | the person's parts: Zgłoszenie osoby, Kroki osoby, Zadania osoby, Rozmowa grupy. As an access-only page it is the form's portal only when chosen in the form's settings |
| `prowadzacy` | bound to "Prowadzący" | Lista osób and Panel osoby (0082/0104), notes |

- **Who edits them.** The leaders' role leads the pages, not whoever leads the parish site; the nearest claimed address
  decides (`Access.OfAsync`). The event's people edit their event and nothing else.
- **Navigation** (owner decision 2). The event pages show the menu of the site they stand in, and an "Odnośniki" strip
  (part `links`, with full paths) at the top of each event page links the event's subpages. Visitors stay on the parish
  site, and the event still has its own tabs. Today the service accepts a menu pointer only from someone who leads both
  pages ("Tamtej strony nie prowadzisz."). Step E2 therefore lets a page show the menu of a page above it on its own
  path without leading it, when that page is public (bound to no areas and not sealed): showing a public menu gives no
  reach, the same reasoning that lets a leader add aliases under its own root. Menus are plaintext unless sealed, so
  the menu of an access-only page is never shown this way. A template can still give an event its own menu.
- **Internal subpages.** To everyone else, internal subpages say that access is needed (403, as now).

### 4.4 Forms and sub-forms

They are created in the event area, and their answers go to the leaders' role (§4.2). That includes:

- the registration form;
- its needs: Udział niepełnoletnich (the parents' written consent is one of its settings), Zdrowie i dieta,
  Ubezpieczenie NNW, Zasady udziału;
- its sub-forms, extensions filled by the person or by the leaders only, for example Wpłaty, Zakwaterowanie, Notatki;
- its roles and virtual areas;
- its portal `…/uczestnicy`, chosen in the form's settings.

The template puts them into a form folder (0096) named after the event, so "Formularze" shows them together. The forms
accept submissions once a data controller record applies to the event's area ([DATA-CONTROLLER.md](DATA-CONTROLLER.md));
until then the event header says what is missing. None of this is new; the event only creates it.

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
  | wide/full and fullscreen | the catalogue: search, kind, place, coming/archive, sort. The legacy `EventsCatalogue` had search, group, place, sort by date, name or group, and a "coming only" switch; the archive view is new |

- **Public data only.** An event is shown if its main page is public and its main appointment is visible to everyone.
  Private events for signed-in members are not in this round (owner decision 5).
- **"Zapisy otwarte"** only while a form really accepts submissions. The service can compute that without reading
  content: the form is not closed, its audience is public, it has a live question, every answer area has an intake, the
  key of each question's label area at its label epoch is published, a controller record applies, the form stands on a
  public page, its portal is valid, and neither the form nor its page is blocked ([REPORTS.md](REPORTS.md)).
- **Other websites.** As a part of a public page, the list embeds through the existing widget
  (`#/widget/<part>/<page>`). A parish WordPress site then shows new events without being edited. Every widget carries
  a small "Zgłoś" next to "recreatio.pl ↗" ([REPORTS.md](REPORTS.md)).

### 5.2 On request: another organisation's list

The leaders of an event can ask to appear in a list they do not lead, such as a co-organiser's site, the diocese or
the catalogue ("Pokaż też na…").

- The list's leaders see the request in the bell ("Prośby o pokazanie wydarzenia") and accept or refuse it once. The
  kind is built like `bookings` (0094). Whoever may tend the list decides (`Module.MayTendAsync`): the writers of the
  module's area, or, for a module without an area (every module made from a page part starts without one), the role
  that leads a page it stands on. The catalogue is the exception: its requests are decided by the operators
  ([REPORTS.md](REPORTS.md) §8). Telling the event's leaders the decision needs a second digest field, which no kind
  has today; waking a closed phone needs a new push kind and the count in the device digest.
- A list can take requests without asking ("przyjmuj bez pytania"); it then shows them at once, and its leaders can
  still remove one. The catalogue never does.
- The request goes to the list (the module), so a list that stands on two pages accepts only once.

**The catalogue `recreatio.pl/events` is the operator's own publication** (owner decision 1):

- organisers opt in with "Pokaż w katalogu", which is a request to the catalogue's list;
- the operator approves each event before it appears, confirming "Na karcie nie ma danych osobowych (osób na zdjęciu,
  nazwisk)";
- an approval covers what the operator saw: the listing keeps the state of the card's facts at approval (the page's
  last change and image, the appointment's fields and times, the organiser's name), and any later change hides the card
  until the operator approves it again;
- cards show only what the organiser published for the event: title, date, place, organiser and image, and no personal
  data about individuals;
- every card can be reported ([REPORTS.md](REPORTS.md));
- it does not go public before reports and takedown work (step E4 after R1).

Why: an operator that publishes users' content can be a controller of the personal data in it and cannot rely on the
hosting exemption for that (CJEU C-492/23, Russmedia, 2025). The address was registered as claimable by 0083, with its
code kept outside Git. Whether it has been claimed, by which role, and what stands under it (the code's examples name
`events/rocket2026`) only the production database shows; the operator's role must lead it. The site is hash-routed, so
the page is `recreatio.pl/#/events`; the short address needs a static page in `public/events/` that forwards to it.
Link previews would need prebuilt pages with meta tags; they are not part of this round.

### 5.3 In the host's own layout: a page about the chosen event

A site may want to keep visitors inside its own menu and look instead of sending them to the organiser's site. Persons
already work this way: a list page and a detail page linked by `?wpis=` (0082).

- **The detail page.** A host page, for example `oaza/wydarzenia/szczegoly`, declares that it is **about an event**:
  page subject kind `event`, registered in `pageSubject.tsx` beside `entry` and `entity`. The event is either chosen
  from the address (`?wydarzenie=<id>`, with ◀ ▶ in the list's order) or fixed to one event.
- **Part "Wydarzenie"** (`event`) shows the chosen event live:
  - the title, lead and image of its page;
  - date and place, and the programme;
  - its open registration forms.

  Registration happens in the event's own form, the same module that stands on the event's pages (0036), loaded by
  its id as any public form is. Every submission lands in that one form, and the person's link leads to the event's
  own participants' page, which the form's settings choose as its portal.
- **The host's list** opens its cards on this page ("Szczegóły na stronie: …"); without one, on the event's own page.

On the event's own pages, the same part (with the subject fixed to the event) replaces typing date and place into
Tytuł and Krótkie informacje. Part "Program wydarzenia" already reads the appointment's name, date and place (since
2026-10-25); part "Wydarzenie" uses the same reader and adds the page's title, lead and image and the open forms, so
the two never show the same facts in two ways.

### What is deliberately not done

- **No copies of event pages per site.** Two pages for one event drift apart.
- **No mounted subtrees** (owner decision 3). Mounting would be an alias of the whole event tree under the host's
  address, with the host's menu. It would put the event under the host's own domain, but every link, portal rule,
  access check and menu would have to learn that one tree has two addresses. The detail page gives the same visible
  result with what already exists. If a site on its own domain ever needs the internal subpages too, mounting can be
  added later on top of aliases (0014) and own domains (0016); an alias today can point only to a page its own role
  leads.

## 6. Creating an event

### 6.1 "Nowe wydarzenie"

It replaces the starter "Zapisy na wydarzenie" (today Nowe → Zapisy na wydarzenie… in the header of Teraz, shown only
to accounts that lead a page) with Nowe → Wydarzenie…. One dialog asks for:

- name, date (from–to, or times), place, kind, and whether the event is public;
- the organiser: the area it goes under, from the areas the account leads;
- **the data controller:** the dialog shows which record will apply. When the chain has none, it offers saved records;
  picking one sends a signature request, or signs at once if the creator is an admin of the record's home area. The
  event can be created anyway;
- where its page goes: under a page the account leads, or no page yet;
- the template: a built-in kind, an earlier event ("na wzór: Pielgrzymka 2026"), or a JSON file;
- where else it will show. Lists that take it by rule are named ("pojawi się na: parish/grzegorzki, widżet na stronie
  parafii"). Requests to other lists can be ticked, "Pokaż w katalogu" among them; for a new edition, the lists of the
  previous one are suggested.

From the template it then creates, in this order:

- the areas and the roles (the creator holds the leaders' role), the event area's intake for the leaders' role, and the
  public key of the event area when the event is public;
- the main appointment and its programme, with dates shifted to the chosen start;
- the pages with their access, menu pointer, strip and parts;
- the forms and sub-forms in their folder, their portal, and the chat;
- the mark, the controller request, and the list requests.

The done screen links the page editor, the forms and the participants' link, and says what is still missing
("Formularz zacznie przyjmować zgłoszenia, gdy ‹Parafia› podpisze."). The event header in the workspace says the same
until it is done.

### 6.2 Templates are the existing JSON formats, bundled

The format `recreatio/event` adds only the bundle itself, relative dates and `@keys`:

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
  ],
  "subForms": [{ "of": "zapisy", "name": "Wpłaty", "audience": "office" }]
}
```

- **Pages.** Each `page` is a page document as page JSON exports it: parts, menu, logic, subject, and forms with
  everything a module document carries (questions, design, needs, roles, virtual areas, folder, rounds —
  `modules/moduleImport.ts`).
- **What the bundle adds to them.** Neither page JSON nor a module document creates a sub-form ("extends" is information
  only), and a page export contains no appointments; the event format lists both itself. `@keys` resolve today only in
  parts' calendar fields (`@main` as Program's appointment) and in `page-image:@key`; the event format adds `@keys` for
  roles (a form's member roles and virtual areas take real role ids today) and a `{path}` placeholder for portals.
- **Pictures.** A template asks for the event's own photos and files the way a page document already can (since
  2026-10-24): each described in `images`, used as `page-image:@key`. The dialog shows the descriptions, the
  organiser adds the files, and they land in every place that uses them.
- **Export.** "Zapisz jako wzór" and "Kolejna edycja" export an event into this format:
  - dates become relative to its main appointment;
  - ids are dropped;
  - the event's name is replaced by `{name}`.

  Never exported: submissions, people, seats and links, messages, people's files, the data controller, signatures and
  report data. A new event takes its controller from where it is created, and the import ignores such fields in a
  hand-written file.
- **Built-in kinds** are such files in `templates/events/`, like `templates/cogita/`, not code. Nothing under
  `templates/` reaches the website today (the Cogita files are imported by hand), so the dialog bundles them in its lazy
  chunk and `app-json-check` checks them. The kinds (owner decision 4):
  - "Wydarzenie bez zapisów";
  - "Wydarzenie z zapisami";
  - "Wyjazd z noclegiem": consents, insurance, payments, participants' and leaders' pages;
  - "Przygotowanie do bierzmowania", derived from the structure built in Grzegórzki only after the owner confirms which
    parts to take, and never with people or submissions.
- **Description.** The description of the format stands next to its import and is generated from the code, as every
  JSON format must; `app-json-check` covers it. Descriptions are a tree since 2026-10-24 (`core/jsonTree.ts`): the
  event format is one node whose `inside` holds the page format (`PAGE_JSON`), so pages, modules, forms and their
  needs are described once and never copied.

## 7. Underneath

### Data

A sketch; each migration takes the next free number when its step is built.

```sql
-- step E1
CREATE TABLE app.area_event (
    area_id    uniqueidentifier NOT NULL PRIMARY KEY REFERENCES app.area (id),
    slug_id    uniqueidentifier NULL REFERENCES app.slug (id),            -- unique where not null
    item_id    uniqueidentifier NULL REFERENCES app.calendar_item (id),
    kind       nvarchar(40)   NULL,
    created_at datetimeoffset NOT NULL,
    created_by_role_id uniqueidentifier NULL
);
ALTER TABLE app.slug_page ADD image_id uniqueidentifier NULL REFERENCES app.page_image (id);

-- step E4
CREATE TABLE app.event_listing (
    area_id   uniqueidentifier NOT NULL REFERENCES app.area_event (area_id),
    module_id uniqueidentifier NOT NULL REFERENCES app.module (id),     -- the list
    state     nvarchar(8) NOT NULL,                                     -- asked | shown | refused
    asked_by_role_id   uniqueidentifier NOT NULL, asked_at   datetimeoffset NOT NULL,
    decided_by_role_id uniqueidentifier NULL,     decided_at datetimeoffset NULL,
    PRIMARY KEY (area_id, module_id)
);
```

- **Pointers go one way.** Like `module`, the mark points at an area, a page and an appointment, and none of them
  points back: it adds no column to `area`, `slug` or `calendar_item`. The orders mostly meet in third things
  (certificates, key grants, `slug_area`), though a page already names its leading role in `slug.claimed_by_role_id`.
- **Deleting.** The code's foreign keys do not cascade (only 0126 does), and deletes clear pointers by hand. Pages
  cannot be deleted (a move keeps the id), so `slug_id` never dangles. Deleting a page file or an appointment is a hard
  delete, and account deletion also deletes the appointments of dying areas; those places clear `slug_page.image_id`
  and `area_event.item_id`. A list's module is deleted by `DELETE /workspace/module/{id}`, by account deletion, and
  silently as an orphan without an area when it leaves its last page (where a blocking key would fail the whole page
  save); `event_listing` rows are deleted in all three. The deletes for good of [REPORTS.md](REPORTS.md) (a page's
  content, a file, an appointment, a part) are further such places and clear the same pointers.
- **Deleting an event area.** An event area is deleted only the way every area is: today, only by account deletion,
  which then also deletes its mark and its requests. That ends its attachments and closes the record homed in it
  ([DATA-CONTROLLER.md](DATA-CONTROLLER.md) §11). There is no "Usuń wydarzenie" (§10).

### Service

| call | who |
|---|---|
| `POST /workspace/area/{id}/event` `{ slug, itemId, kind }` or `{ off: true }` | admin of the area, who leads the page. The appointment must be in a calendar of the area and must not repeat |
| `GET /events?areas=…&deep=1&module=…&from=…&to=…&kind=…` | anyone. Public events only, each with: its page; sealed title and place, with their area and epoch, opened with published keys as in public calendars; start, end and status; organiser; whether registration is open (§5.1); how it got into the list (rule or request). For the catalogue, only approved events, with the card fields of §5.2 |
| `GET /event/{areaId}` | anyone. One event, as above, plus its programme and its open public forms (for part "Wydarzenie") |
| `POST /workspace/event/{areaId}/listing` `{ moduleId }` and `POST /workspace/listing/{area}/{module}` `{ accept }` | the event's admin asks; whoever tends the list decides; for the catalogue, an operator ([REPORTS.md](REPORTS.md) §8) |

The service reads part configs only for forms (portal, the texts after sending, the needs that lock questions) and no
other part's config. The list therefore passes its sources in the query; only requests are looked up by the module's id.

### Browser

- **Code.** A domain folder `events/` holds:
  - the client (`areaEvent.ts`);
  - the two parts (`parts/events.tsx`, `parts/event.tsx`);
  - the subject kind (`eventSubject.tsx`, registered in `pageSubject.tsx`);
  - the dialog, and template import and export (`eventJson.ts`).
- **Workspace.** The event is shown where its area is:
  - Obszary marks events with their date;
  - the area overview gets an event header: page, date, the lists it stands in, what is still missing (a controller
    record, a public area), "Zapisz jako wzór", "Kolejna edycja", "Pokaż też na…";
  - a new workspace part "Wydarzenia" lists coming events the account leads or takes part in (added in code to
    `PART_DEFS` and the fixed layouts, since views are no longer built by users).
- **Bell.** A new alert kind for listing requests (§5.2).
- **JSON.** Page JSON gains `image`; parts `events` and `event` give examples; the event format has its description.
  `app-json-check` checks all of it.
- **Naming.** In the code, "event" already means three things: calendar entries (`EventDialog`, `saveEvent`,
  `.wk-ev-…`), the legacy event-page parts (0063: `pages/event/`, `styles/event-*.css` with `.wk-evp` and `.ev-…`,
  `app-event-check`) and Cogita session events. The new code says `areaEvent` and `eventList` and uses a CSS prefix of
  its own that starts with neither `.wk-ev` nor `.ev-` (proposed: `.wk-ae-`). The part kinds `events` and `event` are
  free.

## 8. Today → after

| today | after |
|---|---|
| "Zapisy na wydarzenie" makes an area, a form, optionally a page and a role, with no date, in an area that is not public and may have no controller; only the form links them | "Nowe wydarzenie" makes the whole event from a template: date, programme, subpages, sub-forms, the leaders' intake, a public area, the controller request, and the mark that ties them together |
| a standalone event's form silently refuses submissions | the dialog and the event header say which controller applies and what is missing |
| date and place typed into Tytuł / Krótkie informacje and again into the calendar | only in the appointment; pages show them through part "Wydarzenie" |
| a new event is added to other pages by hand | lists by rule show it at once; other organisations accept a request once; WordPress through the widget |
| another site can link to the event, show its calendar, embed a public part through the widget, or place its form (the editor's list of modules offers only those of areas the editor holds a certificate on), but cannot show the event as one whole | it can also show it in its own layout, on a page about the chosen event |
| next year, everything is rebuilt by hand | "Kolejna edycja" |
| the legacy catalogue (`/events` in the old service) is gone | `recreatio.pl/events`, the operator's own publication: approved cards without personal data, each one reportable |

## 9. Plan

Each step works on its own and is deployed before the next: the owner applies the migration, then the API is deployed,
then the website, then the Android app. Reports come before the events (owner decision 8).

| step | what | migration |
|---|---|---|
| A1 | data controller records, signed attachments, history ([DATA-CONTROLLER.md](DATA-CONTROLLER.md)) | next free |
| A2 | the clause everywhere, "nobody responsible" | — |
| R1 | reports and takedown ([REPORTS.md](REPORTS.md)) | next free |
| E1 | the mark, the page image, `GET /events`, part "Wydarzenia" (sizes, the widget with its report link), marking an area as an event in its settings | next free |
| E2 | "Nowe wydarzenie" with the built-in structure (controller, the leaders' intake, public area, menu pointer and strip), replacing "Zapisy na wydarzenie" | — |
| E3 | page subject `event`, part "Wydarzenie", lists that open the host's detail page | — |
| E4 | requests to other lists, the bell, the catalogue with the operator's approval; only after R1 | next free |
| E5 | templates: `recreatio/event`, "Zapisz jako wzór", "Kolejna edycja", built-in files | — |
| A3 | dropping `app.area_controller` | next free |

With E1 alone, existing setups can already be marked as events, once their area has a main page and a non-repeating
main appointment; the confirmation in Grzegórzki is checked on the live data first. A list shows them once their main
page and appointment are public.

## 10. Decisions

The open questions of 2026-10-24 are settled by the owner's decisions in the brief of 2026-10-25. Each is a default the
owner confirms before the step that depends on it:

- **Decision 1, catalogue:** the operator approves each event before it appears (§5.2). Step E4.
- **Decision 2, event pages:** the site's menu plus a strip of links to the event's subpages (§4.3). Step E2, with the
  menu rule of §4.3.
- **Decision 3, co-organisers' own domains:** the page about the chosen event is enough; no mounting (§5.3). Step E3.
- **Decision 4, first templates:** the four built-in kinds; "Przygotowanie do bierzmowania" only after the owner
  confirms which parts of the Grzegórzki structure to take, never with people or submissions (§6.2). Step E5.
- **Decision 5, private events in lists** for signed-in members: not in this round.
- **Decision 8, order:** reports and takedown before the events (§9).

Decisions 6 and 7 concern the data controller ([DATA-CONTROLLER.md](DATA-CONTROLLER.md) §15).

Still open, for the owner:

- **Deleting an event.** No endpoint deletes an area today, and a form with submissions cannot be deleted. Should events
  get a delete, and what happens to their submissions and people, or is "Zakończ" (unlisted, kept as history) enough?
- **Who reads the answers.** The intake is sealed once and for good: the whole leaders' role (proposed), or a narrower
  coordinators' role for health and minors' data?
- **The address `events`.** Who holds it today, and what stands under it?

## 11. Alternatives considered

- **An event as its own subsystem** (the legacy `rc_event` with its own registration, card, roster and catalogue).
  This is exactly the double structure to avoid: everything it had exists today as forms, seats, steps, chats and
  parts.
- **An event as an appointment only.** An appointment has no keys, forms or chat of its own; it can only carry the
  people who must be there, bookable seats with a capacity, and a note of the chat it came from. That is enough for a
  concert, which stays a plain appointment in a public calendar.
- **An event as a page only.** A page has no members of its own, and its only key, a sealed page's page key (0121), is
  wrapped under the keys of its bound areas and of its leading role; access and forms need an area anyway.
- **One template page that renders every event.** Changing the template would rewrite last year's pages, and an
  event's own content (plan, FAQ, gallery) would have nowhere to live. The page about the chosen event is generic only
  for what the event itself already holds.
- **Listing by calendar** (putting the appointment into the site's calendar). An appointment belongs to one calendar,
  so a co-organiser could show either all events of the other calendar or none.

## 12. Not in this round

- **Joint controllers** for co-organised events (art. 26 RODO): an area pointing to more than one record
  ([DATA-CONTROLLER.md](DATA-CONTROLLER.md) §15).
- **Private events in lists** for signed-in members.
- **Mounting** an event's subtree under another domain.
