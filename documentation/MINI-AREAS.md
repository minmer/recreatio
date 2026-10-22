# Forms: roles and virtual areas

*Design, 2026-10-21, agreed with the user in two rounds. Step 1 built (§6), not deployed; migration 0120 not applied on
production.*

## 1. Why

A form today is a container. Beside its questions it carries sub-forms, steps that someone ticks, tasks with their
own plan and days, invitations to calendar meetings with answers, duties and an attendance list, a booking step, a
"read the messages" step, a one-to-one chat per person, page modules that exist only for people with a link, and a
separate office view of each person.

Most of this already exists in the platform in a general form, and the form keeps a second copy of it:

| general | the form's copy |
|---|---|
| `app.task` + `app.task_done` | `form_step` kind `task` + `task_answer`, `task_day` |
| `app.calendar_presence` (who is there, with which duty) | `task_presence` + `task_duty` |
| chat kind `area` | chat kind `seat` + `chat_seat_key` |
| calendar, task and chat page modules | `seat-tasks`, `seat-steps`, `seat-chat`, `seat-ask`, `seat-submission` |
| endpoints for a caller (account or link, `Caller`) | `/seat/{token}/step`, `/task`, `/presence`, `/chats` |

Two versions of one thing drift apart, and every new feature has to be built twice.

## 2. The structure

A form declares, besides its questions:

1. **Roles.** Every submission holds the role or roles the form names. A role gives access to areas outside the
   submission — the group, the parish. (0091 had one, `module.member_role_id`; now several.)
2. **Virtual areas.** A virtual area describes one area that every submission gets of its own — its **mini area** —
   and decides how other people deal with that part of the submission's data:
   - **the submitter**, directly by link or account: not at all, reads, or writes;
   - **roles**: every holder of a connected role reaches that mini area of every submission — reads, writes or leads.

   A form can have several virtual areas: what the submitter shares with the leaders, what only the leaders keep
   about each person, what is shared with another role.

Together this is the form's small role graph:

```
              holds                      access
 submission ────────► role ─────────────────────────► area outside (group, parish)
     │
     │ directly: none / reads / writes
     ▼
 virtual area ◄──────────────── role: that mini area of every submission
     │                                (reads / writes / leads)
     └── one mini area per submission
```

**Data is connected to a virtual area** — answers to questions, sub-forms, the conversation, appointments and tasks —
and lives in the submission's mini area of it. What is set up in the virtual area itself is the rule for every mini
area: a task there is a task in each mini area, done in each.

## 3. Example

Form "Zapisy do bierzmowania":

- role **Kandydaci 2026** — reads the group's area "Bierzmowanie" (meetings, channel);
- virtual area **Kandydat i prowadzący** — the submitter writes, role "Prowadzący" leads: the answers, the sub-form
  "Cele", the conversation, tasks and answers to meetings;
- virtual area **Notatki prowadzących** — the submitter: none, "Prowadzący" leads: notes, "Rozmowa odbyta", the
  leaders' talk about this person;
- virtual area **Wizytówka** — the submitter writes, role "Kandydaci 2026" reads: every candidate sees the others'
  cards.

## 4. Today → after

| today | after |
|---|---|
| `module.member_role_id` (0091) | the form's roles, several |
| `area.seat_level` (what a link person sees of the form's area) | the form's roles; the submitter's access per virtual area |
| answers sealed for the intake and for the seat | answers in the mini area of a virtual area with the submitter and the leaders |
| per-question area of the answer (`slug_field.area_id`) | a question connected to a virtual area |
| office sub-form | a sub-form connected to a virtual area without the submitter |
| seat chat (kind `seat`), "Napisz do nas" | the conversation in a mini area |
| steps, form tasks, invitations, booking and chat steps | tasks and meeting answers set up in a virtual area, done per mini area |
| seat modules on the person page, the office view (0104) | the general modules showing one submission's mini areas |

## 5. Underneath

- **A virtual area** is a row in `app.area` (parent: the form's area) plus `app.virtual_area` (the form, the
  submitter's access, the order). Its certificates name the connected roles. Its own key seals what is set up in it.
- **A mini area** is a row in `app.area` (parent: its virtual area) plus `app.area_instance` (virtual area,
  registration). It is an ordinary area with **certificates of its own**, written by the browser of a leader whose
  role holds `admin` or `certify` on the virtual area — exactly the virtual area's certificates, one per role and
  level. Because of that, everything that works on areas (chats, calendars, tasks, the bell, push) works in a mini
  area without knowing about virtual areas, and 0035 stays true for every area ("a prerequisite, not inheritance").
- **Its key** is made by the same browser and wrapped for the public key of every role of the rule (`app.key_grant`)
  and, when the person takes part, sealed under the seat key (`app.access_grant`, 0024). RSA encryption only, no key
  generation per person.
- **Applying the rule** (`forms/virtualAreas.ts`, `applyVirtualArea`): the plan (`GET /workspace/virtual/{id}/plan`)
  lists submissions without a mini area and mini areas behind the rule (a certificate, a key, the seat's key);
  `POST …/instances` creates, `POST …/mirror` tops up. It runs without a click: when the form's settings or office
  open, and when the bell's digest names the virtual area (`virtual.waiting`). A role dropped from the virtual area
  is revoked in every mini area by the service (`Area.DropAsync`); "nie widzi" removes the seats' keys.
- **The person's side** uses the seat machinery that exists: holding the mini area's key makes the seat one of the
  area's people (`Audience.PeopleOf`, `MayMeetAsync`). The conversation of a mini area the person takes part in is
  a one-to-one chat (kind `seat`) at the mini area — titles, unread counts and key hand-over work as before; with
  "czyta" the person reads but cannot post. A leaders-only mini area has an ordinary area chat about the person.
- Mini areas are not listed among areas, and their plaintext `area.name` is the virtual area's name, never a
  person's (0097).

## 6. Plan

Each step works on its own and is deployed (API together with the frontend) before the next.

1. **Roles and virtual areas exist** — *built*. Migration 0120 (`module_role`, `virtual_area`, `area_instance`);
   the form's settings: several roles ("Role uczestników") and "Obszary osób" (rules: name, what the person does,
   roles with levels); mini areas made and topped up by leaders' browsers; the person panel ("Obszary osoby") with
   the conversation; module JSON (`memberRoles`, `virtualAreas`); the digest. Still open: appointments and tasks
   from the person panel, the form map's small graph.
2. **The submitter's side** — *conversation built* (the seat reads and, with "pisze", writes in the one-to-one chat
   of its mini area, shown by the existing chat strip). Still open: the person page's calendar and tasks of the mini
   area.
3. **Data into virtual areas.** Questions and sub-forms connected to a virtual area store their answers in the mini
   area; office sub-forms move.
4. **For each person.** Tasks and meetings set up in a virtual area, done per mini area; the form's steps, tasks and
   invitations move; `form_step`, `step_mark`, `task_answer`, `task_day`, `task_presence`, `task_duty` go.
5. **Removal.** Chat kind `seat`, the seat modules, the office view, `/seat/{token}/step|task|presence`.

## 7. Known limits

- Old one-to-one chats cannot be moved: each message version is signed over its sealed text
  (`MessageVersionRecord.BodyHash`), so re-sealing breaks the signatures. They stay readable as history.
- The service never re-seals: anything sealed under an old key moves in a browser that holds it.
