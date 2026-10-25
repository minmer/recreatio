# Events

*Built 2026-10-25 (migration 0131). The event's data controller comes from [DATA-CONTROLLER.md](DATA-CONTROLLER.md);
cards can be reported like everything else ([REPORTS.md](REPORTS.md)).*

## What an event is

An event is an **area with a mark** (`area_event`): its main page, its main appointment (one, not repeating, in a
calendar of the area), a kind word ("rekolekcje") and an image chosen from the page's files (`slug_page.image_id`).
Nothing else is stored: title and lead are the page's, date, place and programme the appointment's, people, forms and
chats the area's, the controller the area's chain. Sub-pages and sub-forms are ordinary pages and forms of the area.

Set it in the area settings → "Wydarzenie", or create one in one go with the starter **"Nowe wydarzenie"** (area,
leaders' role, page, form, main appointment, mark).

## Where it shows

A **card** goes out only for a public, unsealed, unblocked main page. The date is on it only if the appointment is
visible to everyone and not blocked; title and place are sealed and opened in the browser with published keys.
"Zapisy otwarte" is computed: a form of the area that is open, public, has questions, sits on a public page, is not
blocked, in a public area with a controller.

- Page part **"Wydarzenia"** (`events`): the events of chosen areas (and their sub-areas), by kind and time, plus the
  events that asked to be listed there and were accepted.
- Page part **"Wydarzenie"** (`event`): one event — the configured one, or `?wydarzenie=<area id>` on the page.
- **Asking to be listed** ("Pokaż też na…", `event_listing`): whoever keeps the list decides; if I keep it, it is shown
  at once.
- **The catalogue** is the list on the page `events`: there only the operator decides, ticking that the card carries no
  personal data. The approval holds for exactly that state of the card (`approved_print`); any change hides the card
  until it is approved again.

Decisions on listings are in **Sprawy**; the bell names them.

## Endpoints

`GET|POST /workspace/area/{id}/event` · `GET /workspace/event/{id}/listings` · `POST /workspace/event/{id}/listing` ·
`POST /workspace/listing/{areaId}/{moduleId}` · public: `GET /events?areas=&deep=&kind=&when=&limit=&module=`,
`GET /event/{id}`. Code: `backend/Api/Events/AreaEvent.cs`, `frontend/src/app/events/`, `pages/parts/events.tsx`.
