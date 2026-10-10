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
 *   Zapisy na wydarzenie   Bereich · Formular (Imię, Nazwisko, Telefon, E-mail)
 *                          · Seite mit dem Formular · Rola uczestników
 *   Nowa grupa             Bereich · Rola członków · Rozmowa · Link zaproszenia
 * </code>
 */

import { useEffect, useState } from 'react';

import { LinkShare } from './AccessLinks';
import { createArea, type AreaRow } from './area';
import { startAreaChat } from './chat';
import { createCommonRole } from './commonRole';
import { loadDesk, type PageCard } from './desk';
import { writeFormContent } from './formJson';
import { newId } from './ids';
import { createLink } from './linkAccess';
import { setMemberRole } from './memberRole';
import { Modal } from './Modal';
import { savePage, saveParts } from './page';
import { forgetKeys, keysFor } from './ringOf';
import { selfOf } from './roles';
import { pageSteps, viewPath } from './routes';
import { call, WorkspaceError, type Who } from './session';
import { areasNow, invalidate, refreshDesk } from './viewData';
import { AreaOptions } from './AreaOptions';

type Starter = 'signup' | 'group';

const STARTERS: readonly { id: Starter; title: string; says: string; makes: string }[] = [
  { id: 'signup', title: 'Zapisy na wydarzenie', says: 'Rekolekcje, wyjazd, warsztaty — formularz zgłoszeń na stronie.',
    makes: 'Powstanie: obszar wydarzenia, formularz (imię, nazwisko, telefon, e-mail), strona z formularzem i rola uczestników.' },
  { id: 'group', title: 'Nowa grupa', says: 'Schola, oaza, rada — miejsce, rozmowa i link dla członków.',
    makes: 'Powstanie: obszar grupy, rola członków, rozmowa grupy i link zaproszenia.' }
];

/** „Rekolekcje 2027" → „rekolekcje-2027" — so, wie eine Adresse heissen darf. */
export const slugOf = (name: string): string => name.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'wydarzenie';

export function Starters({ who }: { who: Who }) {
  const [open, setOpen] = useState<Starter | null>(null);
  return (
    <>
      <ul className="wk-starters">
        {STARTERS.map((one) => (
          <li key={one.id}>
            <button type="button" className="wk-starter" data-starter={one.id} onClick={() => setOpen(one.id)}>
              <strong>{one.title}</strong>
              <span>{one.says}</span>
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <StarterDialog who={who} starter={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function StarterDialog({ who, starter, onClose }: { who: Who; starter: Starter; onClose: () => void }) {
  const def = STARTERS.find((one) => one.id === starter)!;
  const [name, setName] = useState('');
  const [parent, setParent] = useState('');
  const [under, setUnder] = useState('');
  const [withRole, setWithRole] = useState(true);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [pages, setPages] = useState<readonly PageCard[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<{ open: string; label: string; link?: string } | null>(null);

  useEffect(() => {
    void areasNow().then(setAreas).catch(() => undefined);
    void loadDesk().then((desk) => {
      const mine = desk.pages.filter((p) => p.aliasOf === null && p.path !== '');
      setPages(mine);
      if (mine.length > 0) setUnder(mine[0].path);
    }).catch(() => setPages([]));
  }, []);

  const run = async () => {
    if (name.trim() === '') { setFailed('Podaj nazwę.'); return; }
    setFailed(null);
    try {
      setBusy('Otwieranie kluczy…');
      const { ring, graph } = await keysFor(who);
      const person = selfOf(graph);
      if (ring === null || person === null) throw new WorkspaceError('Najpierw podaj hasło — klucze nie są otwarte w tej karcie.');

      setBusy('Tworzenie obszaru…');
      const area = await createArea(ring, person, name.trim(), parent === '' ? undefined : parent);

      if (starter === 'group') {
        const role = await createCommonRole(ring, person, { name: `Członkowie: ${name.trim()}`, areas: [{ areaId: area.areaId, capability: 'write' }] }, setBusy);
        setBusy('Zakładanie rozmowy grupy…');
        await startAreaChat(area.areaId, person.id).catch(() => null);
        setBusy('Tworzenie linku zaproszenia…');
        const link = await createLink(role.ring, person, { label: name.trim(), roles: [{ roleId: role.roleId, lead: false }], once: false, expiresDays: 90, aim: null });
        invalidate();
        refreshDesk();
        setDone({ open: viewPath('areas', area.areaId), label: 'Otwórz grupę', link: link.url });
        return;
      }

      /* Zapisy: das Formular im Bereich des Ereignisses, seine Fragen, die Seite, die Rolle. */
      setBusy('Tworzenie formularza…');
      const formId = newId();
      await call('/workspace/module', { method: 'POST', body: JSON.stringify({ moduleId: formId, kind: 'form', name: name.trim(), areaId: area.areaId, forKind: 'person' }) });
      await writeFormContent(who, { moduleId: formId, areaId: area.areaId }, {
        questions: [
          { id: 'q1', kind: 'line', label: 'Imię', required: true, halfWidth: true, identity: 'given_name' },
          { id: 'q2', kind: 'line', label: 'Nazwisko', required: true, halfWidth: true, identity: 'surname' },
          { id: 'q3', kind: 'phone', label: 'Telefon', required: true, halfWidth: true, identity: 'phone' },
          { id: 'q4', kind: 'email', label: 'E-mail', required: false, halfWidth: true, identity: 'email' }
        ]
      }, { replace: false, answersTo: area.areaId, onStage: setBusy });

      let page: string | null = null;
      if (under !== '') {
        setBusy('Tworzenie strony…');
        page = `${under}/${slugOf(name)}`;
        await call('/workspace/subpage', { method: 'POST', body: JSON.stringify({ path: page, roleId: person.id }) });
        await savePage(page, { title: name.trim(), lead: null });
        const frame = (colSpan: number) => ({ position: { row: 1, col: 1 }, size: { colSpan, rowSpan: 5 } });
        await saveParts(page, [{ id: newId(), moduleId: formId, kind: 'form', layout: { desktop: frame(6), tablet: frame(4), mobile: frame(2) }, config: {} }]);
      }

      if (withRole) {
        const role = await createCommonRole(ring, person, { name: `Uczestnicy: ${name.trim()}`, areas: [{ areaId: area.areaId, capability: 'read' }] }, setBusy);
        setBusy('Łączenie formularza z rolą uczestników…');
        await setMemberRole(formId, role.roleId);
      }

      forgetKeys();
      invalidate();
      refreshDesk();
      setDone({ open: page === null ? viewPath('modules', 'form', formId) : viewPath('pages', ...pageSteps(page)), label: page === null ? 'Otwórz formularz' : 'Otwórz stronę w edytorze', link: page === null ? undefined : `${window.location.origin}${window.location.pathname}#/${page}` });
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się — część mogła już powstać; sprawdź w Obszarach.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title={def.title} onClose={onClose}>
      {done !== null ? (
        <div className="wk-starter-done">
          <p className="wk-done" role="status">Gotowe.</p>
          {done.link !== undefined && <LinkShare url={done.link} />}
          <div className="wk-actions">
            <a className="wk-btn" href={done.open} onClick={onClose}>{done.label}</a>
            <button type="button" className="wk-link-btn" onClick={onClose}>Zamknij</button>
          </div>
        </div>
      ) : (
        <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void run(); }}>
          <p className="wk-hint">{def.makes}</p>
          <label className="wk-field">
            <span>{starter === 'group' ? 'Nazwa grupy' : 'Nazwa wydarzenia'}</span>
            <input value={name} autoComplete="off" data-starter-name="" placeholder={starter === 'group' ? 'np. Schola' : 'np. Rekolekcje 2027'} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="wk-field">
            <span>Wewnątrz obszaru (opcjonalnie)</span>
            <select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">— samodzielny —</option>
              <AreaOptions areas={areas} only={areas.filter((a) => a.myLevel === 'admin' && a.personal !== true)} />
            </select>
          </label>
          {starter === 'signup' && (
            <>
              <label className="wk-field">
                <span>Strona z formularzem — pod adresem</span>
                <select value={under} onChange={(e) => setUnder(e.target.value)}>
                  <option value="">— bez strony (dodasz formularz później) —</option>
                  {(pages ?? []).map((p) => <option key={p.path} value={p.path}>recreatio.pl/{p.path}/{slugOf(name || 'wydarzenie')}</option>)}
                </select>
              </label>
              <label className="wk-check">
                <input type="checkbox" checked={withRole} onChange={(e) => setWithRole(e.target.checked)} />
                <span>Rola uczestników — każdy, kto się zapisze, widzi strony, kalendarz i rozmowy wydarzenia</span>
              </label>
            </>
          )}
          {failed !== null && <p className="wk-error">{failed}</p>}
          {busy !== null && <p className="wk-working" role="status">{busy}</p>}
          <div className="wk-actions">
            {/* Erst, wenn die Seiten da sind — sonst entstünde die Zapisy ohne Seite, nur weil jemand schnell war. */}
            <button type="submit" className="wk-btn" disabled={busy !== null || (starter === 'signup' && pages === null)} data-starter-go="">Utwórz</button>
            <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={onClose}>Anuluj</button>
          </div>
          <p className="wk-hint">Tworzenie kluczy trwa chwilę — nie zamykaj karty.</p>
        </form>
      )}
    </Modal>
  );
}

export default Starters;
