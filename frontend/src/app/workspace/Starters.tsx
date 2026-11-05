/**
 * CO CHCESZ ZROBIĆ? (0094) — fertige Anfänge: ein paar Fragen, und alles,
 * was dazugehört, steht da und ist verbunden.
 *
 * Zapisy auf ein Ereignis brauchten bisher fünf Teile des Arbeitsplatzes:
 * einen Bereich, die Annahme, ein Formular mit Fragen, eine Seite mit dem
 * Formular, eine Rolle für die Menschen — und wer eines vergass, bekam ein
 * Formular, das nichts annahm. Hier fragt ein Fenster nach dem Namen und dem
 * Ort und legt alles an, mit den Teilen, die es ohnehin gibt
 * (`createArea`, `writeFormContent`, `createCommonRole`, `setMemberRole`,
 * `createLink`) — nichts davon ist eigens für diesen Weg gebaut.
 *
 * <code>
 *   Nowe wydarzenie        Bereich mit der Art Wydarzenie (0133) · Haupttermin
 *                          (sichtbar im nächsten jawnen Bereich darüber) · Formular
 *                          (Imię, Nazwisko, Telefon, E-mail; Fragen ebendort)
 *                          · Seite mit Wizytówka und Formular · Rola uczestników
 *   Nowa grupa             Bereich mit der Art Grupa · Rola członków · Rozmowa
 *                          · Link, der in den Bereich führt
 *   Kurs (0109)            Bereich mit der Art Kurs · Baza wiedzy · Rola uczących się
 *                          · Przyjęcia für die Antworten · Powtórka codzienna · Link zum Kurs
 *   Nowa szkoła (0134)     Bereich mit der Art Szkoła · Rola nauczycieli · Skryptorium für die
 *                          Programme · Klassen als Bereiche darin (Art Klasa, mit den Nauczyciele)
 * </code>
 *
 * 0133 — die Stücke dafür stehen in `areas/AreaKindPanel.tsx`; der Reiter der Art
 * nimmt dieselben, und dort geht es nach dem Anlegen weiter.
 */

import { useEffect, useState } from 'react';

import { LinkShare } from '../links/AccessLinks';
import { createArea, loadMembers, type AreaRow } from '../areas/area';
import {
  cardPart, createAreaRole, createCourseBase, createSignupForm, createSubpage, formPart, publishAreaFor, slugOf
} from '../areas/AreaKindPanel';
import { loadProfile, saveImportKeys, saveProfile, sealCard } from '../areas/profile';
import { savePublishedItem } from '../areas/profileItem';
import { startAreaChat } from '../chat/chat';
import { loadDesk, type PageCard } from './desk';
import { createLink } from '../links/linkAccess';
import { setMemberRole } from '../roles/memberRole';
import { Modal } from '../ui/Modal';
import { forgetKeys, keysFor } from '../core/ringOf';
import { selfOf } from '../roles/roles';
import { formPath, formsPath, viewPath } from '../routes';
import type { IconName } from '../ui/icons';
import { MenuButton } from '../ui/Menu';
import { WorkspaceError, type Who } from '../core/session';
import { areasNow, invalidate, refreshDesk } from './viewData';
import { AreaPick } from '../areas/AreaPick';
import { leadOf, mainTermOf } from '../events/mainTerm';
import { useT } from '../core/i18n';

/* Die Prüfung der Plattform (`app-platform-check`) liest es von hier. */
export { slugOf };

type Starter = 'signup' | 'group' | 'course' | 'school';

/** 0131 — was nach dem Anlegen noch zu tun ist, mit dem Weg dorthin. */
interface Note { readonly text: string; readonly href: string; readonly link: string }

/* Titel, Satz und „Powstanie…" je Anfang: `workspace.starter.<id>.title|says|makes`. */
const STARTERS: readonly Starter[] = ['signup', 'group', 'course', 'school'];

export function Starters({ who }: { who: Who }) {
  const [open, setOpen] = useState<Starter | null>(null);
  const t = useT();
  return (
    <>
      <ul className="wk-starters">
        {STARTERS.map((one) => (
          <li key={one}>
            <button type="button" className="wk-starter" data-starter={one} onClick={() => setOpen(one)}>
              <strong>{t(`workspace.starter.${one}.title`)}</strong>
              <span>{t(`workspace.starter.${one}.says`)}</span>
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <StarterDialog who={who} starter={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function StarterDialog({ who, starter, onClose }: { who: Who; starter: Starter; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [parent, setParent] = useState('');
  const [under, setUnder] = useState('');
  const [withRole, setWithRole] = useState(true);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [pages, setPages] = useState<readonly PageCard[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<{ open: string; label: string; link?: string; notes?: readonly Note[] } | null>(null);
  /* 0131 — der Haupttermin und die Art des Wydarzenie. */
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [place, setPlace] = useState('');
  const [kind, setKind] = useState('');
  /* 0134 — die Klassen einer neuen Szkoła („1a, 1b, 2a"). */
  const [classNames, setClassNames] = useState('');

  useEffect(() => {
    void areasNow().then(setAreas).catch(() => undefined);
    void loadDesk().then((desk) => {
      const mine = desk.pages.filter((p) => p.aliasOf === null && p.path !== '');
      setPages(mine);
      if (mine.length > 0) setUnder(mine[0].path);
    }).catch(() => setPages([]));
  }, []);

  const run = async () => {
    if (name.trim() === '') { setFailed(t('workspace.starter.giveName')); return; }
    setFailed(null);
    try {
      setBusy(t('workspace.starter.openingKeys'));
      const { ring, graph } = await keysFor(who);
      const person = selfOf(graph);
      if (ring === null || person === null) throw new WorkspaceError(t('workspace.starter.needPassword'));

      setBusy(t('workspace.starter.creatingArea'));
      const area = await createArea(ring, person, name.trim(), parent === '' ? undefined : parent);

      const notes: Note[] = [];
      const settings = viewPath('areas', area.areaId, 'ustawienia');
      const kindTab = viewPath('areas', area.areaId, 'profil');
      /* 0133 — ging das Profil nicht, steht der Bereich trotzdem; die Art setzt man dann in den Ustawienia. */
      const kindLost = (): void => { notes.push({ text: t('workspace.starter.kindLost'), href: settings, link: t('workspace.starter.kindLostLink') }); };

      if (starter === 'course') {
        /*
         * 0109 — der Kurs: die Baza wiedzy im Bereich, die Antworten in DENSELBEN
         * Bereich (Przyjęcia: nur das Amt öffnet sie), eine Powtórka aus allen
         * Karten, und ein Link, der die Rolle gibt und in den Kurs führt.
         */
        await saveProfile(area.areaId, { kind: 'course' }).catch(kindLost);
        const libraryId = await createCourseBase(ring, person, area.areaId, name.trim(), setBusy);
        const role = await createAreaRole(ring, person, { areaId: area.areaId, name: t('workspace.starter.roleLearners', { name: name.trim() }), capability: 'read', onStage: setBusy });
        setBusy(t('workspace.starter.linkLearners'));
        const link = await createLink(role.ring, person, {
          label: name.trim(), roles: [{ roleId: role.roleId, lead: false }], once: false, expiresDays: 365,
          aim: `workspace/learn/${libraryId}`
        });
        forgetKeys();
        invalidate();
        refreshDesk();
        setDone({ open: viewPath('knowledge', libraryId, 'wpisy'), label: t('workspace.starter.addFirstEntries'), link: link.url, notes });
        return;
      }

      if (starter === 'school') {
        /*
         * 0134 — die Szkoła: das Profil, die Rolle Nauczyciele (unter ihrem Schlüssel „teachers", wie
         * im Reiter), das Skryptorium für die Programme, dann die Klassen mit den Nauczyciele darin.
         */
        await saveProfile(area.areaId, { kind: 'school' }).catch(kindLost);
        const role = await createAreaRole(ring, person, { areaId: area.areaId, name: t('workspace.starter.roleTeachers', { name: name.trim() }), capability: 'write', onStage: setBusy });
        await saveImportKeys(area.areaId, [{ kind: 'role', key: 'teachers', refId: role.roleId, refText: t('workspace.starter.teachers') }]).catch(() => undefined);
        const teacher = (await loadMembers(area.areaId).catch(() => ({ members: [] }))).members.find((m) => m.roleId === role.roleId) ?? null;
        setBusy(t('workspace.starter.scriptorium'));
        const [{ ensureScriptorium, parseClassNames }, { addClassesTo }] = await Promise.all([import('../areas/school'), import('../areas/SchoolTools')]);
        await ensureScriptorium(role.ring, area.areaId, name.trim()).catch((e: unknown) => {
          notes.push({ text: t('workspace.starter.scriptoriumFailed', { why: e instanceof WorkspaceError ? e.message : t('workspace.starter.error') }), href: kindTab, link: t('workspace.starter.scriptoriumLink') });
        });
        const wanted = parseClassNames(classNames);
        if (wanted.length > 0) {
          const made = await addClassesTo(role.ring, person, area.areaId, wanted,
            teacher === null ? null : { roleId: role.roleId, wrapPublicKey: teacher.wrapPublicKey, name: t('workspace.starter.roleTeachers', { name: name.trim() }) }, setBusy);
          if (made.note !== null) notes.push({ text: made.note, href: kindTab, link: t('workspace.starter.schoolTab') });
        }
        const now = await loadProfile(area.areaId).catch(() => null);
        if (now !== null && now.controller === null) {
          notes.push({ text: t('workspace.starter.schoolNoController'), href: settings, link: t('workspace.starter.schoolNoControllerLink') });
        }
        forgetKeys();
        invalidate();
        refreshDesk();
        setDone({ open: kindTab, label: t('workspace.starter.openSchool'), notes });
        return;
      }

      if (starter === 'group') {
        await saveProfile(area.areaId, { kind: 'group' }).catch(kindLost);
        const role = await createAreaRole(ring, person, { areaId: area.areaId, name: t('workspace.starter.roleMembers', { name: name.trim() }), capability: 'write', onStage: setBusy });
        setBusy(t('workspace.starter.groupChat'));
        /* 0129 — eine Rozmowa des Bereichs braucht einen Administrator danych; ohne ihn sagt es der Abschluss. */
        const chatMade = await startAreaChat(area.areaId, person.id).then(() => true, () => false);
        if (!chatMade) notes.push({ text: t('workspace.starter.groupChatFailed'), href: settings, link: t('workspace.starter.pickControllerLink') });
        setBusy(t('workspace.starter.linkMembers'));
        /* 0133 — der Link führt in die eigene Ansicht der Grupa. */
        const link = await createLink(role.ring, person, {
          label: name.trim(), roles: [{ roleId: role.roleId, lead: false }], once: false, expiresDays: 90,
          aim: `workspace/areas/${area.areaId}`
        });
        forgetKeys();
        invalidate();
        refreshDesk();
        setDone({ open: kindTab, label: t('workspace.starter.openGroup'), link: link.url, notes });
        return;
      }

      /*
       * 0133 — der Bereich IST das Wydarzenie: das Profil gleich zu Beginn (hängt
       * ein späterer Schritt, steht es trotzdem), veröffentlicht im nächsten jawnen
       * Bereich darüber, den ich führe — sonst in ihm selbst.
       */
      const publishTo = publishAreaFor(areas, parent === '' ? null : parent, area.areaId);
      setBusy(t('workspace.starter.event'));
      await saveProfile(area.areaId, { kind: 'event', ...(publishTo !== area.areaId ? { publishAreaId: publishTo } : {}) }).catch(kindLost);
      const first = await loadProfile(area.areaId).catch(() => null);

      /* Der Haupttermin im Kalender des Bereichs (der Kalender entsteht dabei), zu sehen dort, wo veröffentlicht wird. */
      const term = mainTermOf({ date, time, endDate, endTime });
      let itemId: string | null = null;
      if (term !== null) {
        setBusy(t('workspace.starter.mainTerm'));
        itemId = await savePublishedItem(ring, {
          areaId: area.areaId, visibilityAreaId: publishTo, ownerRoleId: person.id,
          item: { title: name.trim(), location: place.trim(), ...term }
        });
      }

      /* Zapisy: das Formular im Bereich, seine Fragen dort, wo veröffentlicht wird. */
      const form = await createSignupForm(who, ring, { areaId: area.areaId, name: name.trim(), publishTo, onStage: setBusy });
      if (form.note !== null) notes.push({ text: form.note, href: formPath(form.formId), link: t('workspace.starter.openForm') });

      let page: string | null = null;
      if (under !== '') {
        setBusy(t('workspace.starter.creatingPage'));
        page = `${under}/${slugOf(name)}`;
        /* Oben die Wizytówka, darunter das Formular; für die Seite steht der Administrator danych des Bereichs (wenn er einen hat). */
        const made = await createSubpage({
          path: page, roleId: person.id, areaId: first?.controller != null ? area.areaId : null,
          title: name.trim(), lead: leadOf(term, place), parts: [cardPart(area.areaId), formPart(form.formId)]
        });
        if (made.note !== null) notes.push({ text: made.note, href: kindTab, link: t('workspace.starter.eventTab') });
      }

      if (withRole) {
        const role = await createAreaRole(ring, person, { areaId: area.areaId, name: t('workspace.starter.roleParticipants', { name: name.trim() }), capability: 'read', onStage: setBusy });
        setBusy(t('workspace.starter.linkingRole'));
        await setMemberRole(form.formId, role.roleId);
      }

      /* Die Wizytówka — unter dem Schlüssel des Bereichs, in dem sie zu sehen ist —, dazu Seite, Termin, Kategorie. */
      setBusy(t('workspace.starter.card'));
      try {
        const card = await sealCard(ring, area.areaId, publishTo, { title: name.trim(), lead: leadOf(term, place) ?? '' });
        await saveProfile(area.areaId, {
          card,
          ...(page === null ? {} : { path: page }),
          ...(itemId === null ? {} : { itemId }),
          ...(kind.trim() === '' ? {} : { category: kind.trim() })
        });
        const now = await loadProfile(area.areaId);
        if (now.controller === null) {
          notes.push({ text: t('workspace.starter.formNoController'), href: settings, link: t('workspace.starter.pickControllerLink') });
        }
        if (!now.publishPublic || page === null) {
          notes.push({ text: t('workspace.starter.notListed'), href: kindTab, link: t('workspace.starter.eventTab') });
        }
      } catch (e) {
        notes.push({ text: t('workspace.starter.cardFailed', { why: e instanceof WorkspaceError ? e.message : t('workspace.starter.error') }), href: kindTab, link: t('workspace.starter.cardFailedLink') });
      }
      if (term === null) notes.push({ text: t('workspace.starter.noDate'), href: kindTab, link: t('workspace.starter.eventTab') });

      forgetKeys();
      invalidate();
      refreshDesk();
      setDone({ open: kindTab, label: t('workspace.starter.openEvent'), link: page === null ? undefined : `${window.location.origin}${window.location.pathname}#/${page}`, notes });
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('workspace.starter.failed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title={t(`workspace.starter.${starter}.title`)} onClose={onClose}>
      {done !== null ? (
        <div className="wk-starter-done">
          <p className="wk-done" role="status">{t('workspace.starter.done')}</p>
          {done.link !== undefined && <LinkShare url={done.link} />}
          {(done.notes ?? []).map((one) => (
            <p key={one.text} className="wk-note" data-starter-note="">
              {one.text} <a className="wk-link" href={one.href} onClick={onClose}>{one.link}</a>
            </p>
          ))}
          <div className="wk-actions">
            <a className="wk-btn" href={done.open} onClick={onClose}>{done.label}</a>
            <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.close')}</button>
          </div>
        </div>
      ) : (
        <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void run(); }}>
          <p className="wk-hint">{t(`workspace.starter.${starter}.makes`)}</p>
          <label className="wk-field">
            <span>{t(`workspace.starter.${starter}.nameLabel`)}</span>
            <input value={name} autoComplete="off" data-starter-name="" placeholder={t(`workspace.starter.${starter}.namePlaceholder`)} onChange={(e) => setName(e.target.value)} />
          </label>
          {starter === 'school' && (
            <label className="wk-field">
              <span>{t('workspace.starter.classes')}</span>
              <input value={classNames} autoComplete="off" maxLength={600} data-starter-classes="" placeholder={t('workspace.starter.classesPlaceholder')} onChange={(e) => setClassNames(e.target.value)} />
            </label>
          )}
          <label className="wk-field">
            <span>{t('workspace.starter.insideOptional')}</span>
            <AreaPick
              label={t('workspace.starter.inside')} value={parent} onChange={setParent}
              areas={areas} only={areas.filter((a) => a.myLevel === 'admin' && a.personal !== true)}
              extras={[{ value: '', label: t('workspace.starter.standalone') }]}
            />
          </label>
          {starter === 'signup' && (
            <>
              <label className="wk-field">
                <span>{t('workspace.starter.pageUnder')}</span>
                <select value={under} onChange={(e) => setUnder(e.target.value)}>
                  <option value="">{t('workspace.starter.noPage')}</option>
                  {(pages ?? []).map((p) => <option key={p.path} value={p.path}>{`recreatio.pl/${p.path}/${slugOf(name || t('workspace.starter.slugFallback'))}`}</option>)}
                </select>
              </label>
              <div className="wk-starter-when">
                <label className="wk-field">
                  <span>{t('workspace.starter.start')}</span>
                  <input type="date" value={date} data-starter-date="" onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="wk-field">
                  <span>{t('workspace.starter.time')}</span>
                  <input type="time" value={time} data-starter-time="" onChange={(e) => setTime(e.target.value)} />
                </label>
                <label className="wk-field">
                  <span>{t('workspace.starter.end')}</span>
                  <input type="date" value={endDate} min={date === '' ? undefined : date} onChange={(e) => setEndDate(e.target.value)} />
                </label>
                <label className="wk-field">
                  <span>{t('workspace.starter.endTime')}</span>
                  <input type="time" value={endTime} disabled={time === ''} onChange={(e) => setEndTime(e.target.value)} />
                </label>
              </div>
              <label className="wk-field">
                <span>{t('workspace.starter.place')}</span>
                <input value={place} autoComplete="off" placeholder={t('workspace.starter.placePlaceholder')} onChange={(e) => setPlace(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>{t('workspace.starter.kind')}</span>
                <input value={kind} autoComplete="off" maxLength={40} placeholder={t('workspace.starter.kindPlaceholder')} onChange={(e) => setKind(e.target.value)} />
              </label>
              <label className="wk-check">
                <input type="checkbox" checked={withRole} onChange={(e) => setWithRole(e.target.checked)} />
                <span>{t('workspace.starter.withRole')}</span>
              </label>
            </>
          )}
          {failed !== null && <p className="wk-error">{failed}</p>}
          {busy !== null && <p className="wk-working" role="status">{busy}</p>}
          <div className="wk-actions">
            {/* Erst, wenn die Seiten da sind — sonst entstünde die Zapisy ohne Seite, nur weil jemand schnell war. */}
            <button type="submit" className="wk-btn" disabled={busy !== null || (starter === 'signup' && pages === null)} data-starter-go="">{t('workspace.starter.create')}</button>
            <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={onClose}>{t('common.cancel')}</button>
          </div>
          <p className="wk-hint">{t('workspace.starter.keysTakeTime')}</p>
        </form>
      )}
    </Modal>
  );
}

/* -- 2026-10-16: „Nowe" im Kopf von Teraz ------------------------------------------------ */

const STARTER_ICON: Record<Starter, IconName> = { signup: 'form', group: 'users', course: 'cap', school: 'book' };

/**
 * DIE ANFÄNGE ALS MENÜ — im Kopf von „Teraz", wo man etwas anlegt. Als Kacheln
 * standen sie mitten auf der Startseite, jeden Tag, auch wenn man nichts anlegte.
 */
export function NewMenu({ who }: { who: Who }) {
  const [open, setOpen] = useState<Starter | null>(null);
  const t = useT();
  return (
    <>
      <MenuButton
        label={t('workspace.starter.create')}
        icon="plus"
        text={t('workspace.starter.newMenu')}
        className="wk-btn"
        items={[
          ...STARTERS.map((one) => ({ label: t('workspace.starter.menuItem', { title: t(`workspace.starter.${one}.title`) }), icon: STARTER_ICON[one], onSelect: () => setOpen(one) })),
          { label: t('workspace.starter.emptyForm'), icon: 'file' as IconName, onSelect: () => { window.location.hash = formsPath('new').slice(1); } },
          { label: t('workspace.starter.newArea'), icon: 'layers' as IconName, onSelect: () => { window.location.hash = viewPath('areas', 'new').slice(1); } }
        ]}
      />
      {open !== null && <StarterDialog who={who} starter={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export default Starters;
