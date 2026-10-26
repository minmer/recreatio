# Areas with a kind: events, groups, parishes, courses, schools and classes

*Built 2026-10-25 (0131) and 2026-10-26 (0133, 0134 — schools and classes) from the owner's choices. The data
controller of every piece is the area's own chain ([DATA-CONTROLLER.md](DATA-CONTROLLER.md)); cards can be reported
like everything else ([REPORTS.md](REPORTS.md)).*

## The idea

An area stays an area — keys, people, chats, forms, calendars. Giving it a **kind** (`area_profile`: event, group,
organisation, course) adds a profile and the tools that kind needs; what changes is mainly how the area is presented
and what the area view offers to add.

| Profile field | Meaning |
| --- | --- |
| card | Title and description, sealed in the browser under the key of the area it is **published in** (`card_area_id`). A public area: everyone opens it with the published key; otherwise only who reads that area. |
| image, category | A file of one of the area's pages; a word for filters ("rekolekcje"). |
| main page, after page | The page of the area; a page prepared for the time after the event — hidden (`verdict: later`) until the end, then shown and linked from cards. |
| main appointment | One non-repeating appointment in a calendar of the area; its end is the end of the event. |
| publish area | Where new public pieces go by default. |
| archive | `auto`: one hour after the end the sweep closes the area's forms and remembers which; "Przywróć" reopens exactly those and switches to `manual`. |

## Publishing per item

Data stays in the area; each public piece can be published in another area — **only by someone who leads both**
(admin on both; the service checks it):

- the card (sealed under the target's key);
- the main appointment and its programme (`calendar_item.visibility_area_id`; fields sealed under the target's key,
  the item lives in the area's calendar);
- a form's questions and layout (`module.label_area_id`; `POST /workspace/form/{id}/questions-area` re-seals all of
  them at once). Answers still go to the form's area and its intake; the clause names the area's controller.

So a private group (its own keys, its chats and answers private) can publish its event card, date and registration
questions through a public area such as "Wydarzenia" above it.

## Only for the area's people

A page module can be limited to the people of an area (`slug_part.audience_area_id`): the service sends it only to a
viewer with their own seat link from a form of that area, an access link in this browser that reads it, or an account
that reads it. Page editors always get it (marked). Used for the after-event page: photos or materials only for the
participants.

## Lists and the catalogue

Page part **"Wydarzenia"** (`events`, with `type`: events, groups, organisations, courses) lists profiles of chosen
areas (and below) plus profiles that asked to be listed and were accepted (`event_listing`). Part **"Wizytówka"**
(`event`) shows one profile card (configured, or `?wydarzenie=<area id>`). The catalogue is the list on the page
`events`: requests there are accepted only by the operator, ticking that the card carries no personal data; the approval
holds for that exact card (`approved_print`, now including the sealed card and the after page). The areas the operator
ticks in the catalogue's own list show directly, like on any list — that choice is the approval.

A card is listed only with a public, unsealed, unblocked main page; the date only if the appointment is publicly
visible; "Zapisy otwarte" when a form of the area really accepts (open, public audience, questions in a public area, on
a public page, a controller exists).

## The kind tab

Ustawienia → "Rodzaj obszaru" (plain area, event, group, parish/organisation, course). With a kind the area gets a
first tab named after it: the card as visitors see it, "Do zrobienia" (a checklist with one-click fixes), the card
editor (title, description, category, image from the page files, where it is shown), "Publikuj w", the tools of the
kind, other lists, and the JSON import/export (admins only).

| Kind | Tools |
| --- | --- |
| event | main page (new sub-page with the card on top, or an existing page), sub-pages, registration form + sub-forms (questions moved to the publishing area), main appointment + programme, "Napisz do nas" (an answerers area inside the area, organisers in it, the form attached), channel, participants' chat, roles Organizatorzy / Pomocnicy / Uczestnicy with links (the form gives Uczestnicy), after page with a members-only module, end now / restore |
| group | chat, channel, Członkowie / Prowadzący, members' link opening `workspace/areas/<id>` |
| organisation | data controller, main page, one-click lists "Wydarzenia" and "Grupy" |
| course | knowledge base with daily revision, learners' role and link |

The main appointment is made there or **picked** ("Wybierz istniejący"): single (no repeat), not a programme point,
editable by me, from a month back to a year ahead. The area's own calendar comes first; one from another calendar
("Także z innych kalendarzy") is moved into the area's calendar after a question — who sees it, its link and its
points stay (the service accepts only an appointment of the area's calendar as the main one).

A published appointment stays in the area's own calendar: every edit names its calendar (without it the service would
move the item into the calendar of the area that shows it). The tab remembers its roles under import keys
(`organisers`, `participants`, `helpers`, `members`, `leaders`, `learners`), so the export and the JSON import call
them the same.

## School and classes (0134)

A **school** (kind `school`) holds its **classes** as sub-areas (kind `class`). A program is written once for all
classes that follow it; each class realizes it in its own way, with its own notes.

| Piece | Where it lives |
| --- | --- |
| program | a project of the school's Scriptorium (`projectType: program`); its outline = headings and lessons; `classes` = the classes that follow it |
| lesson | a text of that Scriptorium: title, plan (points with stable ids), body, materials |
| realization | a delivery of the lesson text with `classArea`, `state` (`planned`, `done`, `partial`, `skipped`), `date`, note (`summary`), `homework`, and per plan point what was covered — the Scriptorium's delivery form shows "Lekcja w klasie" |
| timetable | weekly appointments in the class's own calendar, remembered under import keys `lekcja-<n>` |
| students | the class form `uczniowie` with the office extensions `obecnosc` (daily attendance sheet) and `uwagi` (notes per student) |
| chats, roles | as for a group: channel, class chat, Uczniowie / Rodzice with links; Nauczyciele (`teachers`) at the school, joined to every new class as admin |

All of it is sealed under the school's key (teachers read it) or the class's key (its people read it); the service needs
no new table — 0134 only adds the two kinds and `GET /workspace/area/{id}/children` (sub-areas with their kind).

**School tab:** classes (add "4a, 4b" in one go, mark existing sub-areas), teachers, the Scriptorium (made on demand),
programs (classes ticked, lessons pasted one per line, `# Dział` or `Dział:` as headings) and the matrix "Realizacja w
klasach": lessons × classes, ✓ / ◐ with the date, · planned, ✕ to repeat, plus lessons held outside the program.
The starter "Nowa szkoła" makes school, teachers, Scriptorium and classes at once.

**Class tab:** the programs it follows with its progress; the weekly timetable; the **journal** (Dziennik) lesson by
lesson — topic, state, note, homework, "Szczegóły" (the full delivery form with the plan), "Wyślij klasie" (to the class
channel); "Rozłóż program na kolejne lekcje" puts the lessons not yet held or planned (a skipped one comes again) on the
next free lessons; "+ Lekcja dodatkowa" for one outside the program; the student list with attendance and notes.
The logic is `areas/school.ts` (tested in `scripts/app-duty-check.mjs`), the tabs `SchoolTools.tsx`, `SchoolMatrix.tsx`,
`ClassTools.tsx`, `ClassJournal.tsx`.

## One document for the whole area ("recreatio/area")

Before the import only the area and the address of its main page exist (an empty page is filled). The import sits on
the kind tab; an area without a kind reaches it from Ustawienia → "Import z JSON".

```
{ "format": "recreatio/area", "version": 1, "kind": "event|group|organisation|course", "name", "category",
  "address": "parafia/rekolekcje-2026", "publish": "auto|area|<area id>", "archive": "auto|manual",
  "card": { "title", "lead", "image": "page-image:@key|page-image:<id>", "publish" },
  "roles": [{ "key", "name", "level": "read|write|admin", "link": true | { "days", "once", "lead", "label" } }],
  "appointments": [{ "key", "main", "publish", …appointment keys of a page document…, "points": […] }],
  "pages": [{ "key", "path": ""|"sub"|"/abs", "main", "after", "access": "public|members", "page": { recreatio/page } }],
  "subforms": [{ "key", "of": "@form:main/zapisy", "name", "audience": "person|office", "repeat", "publish", "questions", … }],
  "chats": ["area", "channel", { "kind": "area", "forms": ["@form:main/zapisy"] }],
  "listings": ["parafia/wydarzenia", "events"] }
```

Page modules may add `id` (required for forms), `members` (only the area's people), `publish` (forms) and, on
"Napisz do nas", `answer` (roles) and `forms`. References are whole values: `@area`, `@form:page/id`, `@page:key`,
`@role:key`, `@<appointment key>`, `@kalendarz`. `module` and `answersTo` are never imported (answers always go to
this area).

Check → plan (lines, warnings, files asked for) → step by step: profile, roles and links, appointments, forms
(questions placed first), pages, sub-forms, chats, card and profile, listings. Everything made is remembered at once
under its key (`app.area_import_key`), so a second or interrupted import changes the same things — questions too,
under `page/module#question` (the service gives a question its id only when it is made). Without a key the import
takes what the tab already made: the role with that name ("Uczestnicy" also matches "Uczestnicy: …"), the profile's
main appointment with its points in order, and a question of the same kind and wording. Links are shown once after the
import; only the invitation id is stored.

The export writes the same document and registers keys for pieces that had none. "Skopiuj prompt dla AI" copies the
task, the format (without the long rare modules such as animation, labs, presentation, unless the template uses them;
"Pełny opis" adds all) and, as the template, the export of this area or of another area the person leads. There are no
built-in templates: the AI gets the previous event's export.

## Endpoints

`GET|POST /workspace/area/{id}/profile` · `POST /workspace/area/{id}/archive` ·
`GET|POST /workspace/area/{id}/import-keys` · `POST /workspace/form/{id}/questions-area` · listings as before ·
public: `GET /area/{id}/profile`, `GET /events?areas=&deep=&type=&kind=&when=&limit=&module=`, `GET /event/{id}`.
The 0131 calls (`/workspace/area/{id}/event`) still work and read/write the event profile.
Code: `backend/Api/Areas/Profiles.cs`, `Events/AreaEvent.cs`, `Forms/Form.QuestionsArea.cs`, `Pages/Page.Audience.cs`;
`frontend/src/app/areas/profile.ts`, `profileItem.ts`, `AreaKindPanel.tsx`, `areaJson.ts` (reading and planning,
tested in `scripts/app-duty-check.mjs`), `areaImport.ts`, `areaExport.ts`, `areaJsonText.ts`, `AreaJsonPanel.tsx`,
`pages/pageImportRun.ts` (the page import both editors use).
