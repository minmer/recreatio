/**
 * 0082 — PORZĄDEK W CAŁEJ BAZIE: dieselbe eine Form für jede Adresse (und
 * jede Telefonnummer), nicht nur in der Kartoteka.
 *
 * <b>Was durchgesehen wird</b> — alles, was dieser Browser öffnen kann:
 * <ul>
 *   <li>die Antworten aller Formulare (Fragen „Adres" und „Telefon"),
 *       `answerTidy.ts`, wie in der Kanzlei eines Formulars;</li>
 *   <li>die Adresse des Verantwortlichen (Administrator danych) an Formularen
 *       und an Bereichen — Klartext, sie steht unter jedem Formular.</li>
 * </ul>
 * Die Kartoteka selbst ist schon normalisiert (0071); Steckbriefe und neue
 * Antworten bekommen die Form beim Eintippen (`PostalInput`).
 *
 * <b>Erst sehen, dann ändern</b>: eine Liste zum Abhaken; was der Zerleger
 * nicht sicher wusste, ist nicht angehakt.
 */

import { useState } from 'react';

import { crookedOf, seatKeyFinder, straighten, type Crooked } from './answerTidy';
import { loadAreas } from './area';
import { readForm, type ReadForm } from './formRead';
import { loadPublicIntake, setController } from './intake';
import type { Ring } from './keys';
import { loadModules, updateModule } from './module';
import { normalizeAddressLines } from './postal';
import { WorkspaceError } from './session';
import { TidyList, toggled, type TidyItem } from './TidyList';

interface FormFound {
  readonly formId: string;
  readonly name: string;
  readonly read: ReadForm;
  readonly crooked: readonly Crooked[];
}

interface ControllerFound {
  readonly key: string;
  readonly where: string;
  readonly apply: (address: string) => Promise<unknown>;
  readonly before: string;
  readonly after: string;
  readonly doubt: boolean;
}

const answerKey = (formId: string, c: Crooked) => `${formId}|${c.registrationId}|${c.fieldId}`;

export function TidyEverything({ ring }: { ring: Ring }) {
  const [forms, setForms] = useState<readonly FormFound[] | null>(null);
  const [controllers, setControllers] = useState<readonly ControllerFound[]>([]);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [working, setWorking] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const scan = async () => {
    setWorking('Przeglądanie…');
    setFailed(null);
    setSaid(null);
    try {
      const { modules } = await loadModules();
      const found: FormFound[] = [];
      let unreadable = 0;
      for (const m of modules.filter((one) => one.kind === 'form')) {
        setWorking(`Przeglądanie: ${m.name}…`);
        try {
          const read = await readForm(m.moduleId, ring);
          const crooked = await crookedOf(read);
          if (crooked.length > 0) found.push({ formId: m.moduleId, name: m.name, read, crooked });
        } catch {
          unreadable += 1;
        }
      }

      /* Der Verantwortliche — an Formularen und an Bereichen, im Klartext. */
      const raw: { key: string; where: string; before: string; apply: (address: string) => Promise<unknown> }[] = [];
      for (const m of modules) {
        const c = m.controller;
        if (c === null || c.address === null || c.address.trim() === '') continue;
        raw.push({
          key: `module|${m.moduleId}`, where: `Administrator danych: ${m.name}`, before: c.address,
          apply: (address) => updateModule(m.moduleId, { controller: { name: c.name, address, email: c.email ?? undefined } })
        });
      }
      for (const a of (await loadAreas()).areas.filter((one) => one.myLevel === 'admin' || one.myLevel === 'write')) {
        const c = await loadPublicIntake(a.areaId).then((r) => r.controller).catch(() => null);
        if (c === null || c.address === null || c.address === undefined || c.address.trim() === '') continue;
        raw.push({
          key: `area|${a.areaId}`, where: `Administrator danych: ${a.name}`, before: c.address,
          apply: (address) => setController(a.areaId, { name: c.name, address, email: c.email ?? undefined })
        });
      }
      const tidied = await normalizeAddressLines(raw.map((r) => r.before));
      const ctrl = raw.map((r, i) => ({ ...r, after: tidied[i].tidy, doubt: tidied[i].doubt })).filter((r) => r.after !== r.before);

      setForms(found);
      setControllers(ctrl);
      setSkipped(new Set([
        ...found.flatMap((f) => f.crooked.filter((c) => c.doubt).map((c) => answerKey(f.formId, c))),
        ...ctrl.filter((c) => c.doubt).map((c) => c.key)
      ]));
      if (unreadable > 0) setSaid(`${unreadable} ${unreadable === 1 ? 'formularza' : 'formularzy'} nie da się otworzyć tym kluczem — zostają, jak są.`);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się przejrzeć bazy.');
    } finally {
      setWorking(null);
    }
  };

  const apply = async () => {
    if (forms === null) return;
    setWorking('Porządkowanie…');
    setFailed(null);
    try {
      /*
       * Noch einmal gerechnet, diesmal MIT Eintrag ins gemeinsame Verzeichnis —
       * dann schreibt jede nächste Adresse diese Teile genauso. Übernommen
       * wird, was angehakt war.
       */
      const seats = seatKeyFinder(ring);
      let values = 0;
      for (const f of forms) {
        const keys = new Set(f.crooked.filter((c) => !skipped.has(answerKey(f.formId, c))).map((c) => answerKey(f.formId, c)));
        if (keys.size === 0) continue;
        setWorking(`Porządkowanie: ${f.name}…`);
        const chosen = (await crookedOf(f.read, true)).filter((c) => keys.has(answerKey(f.formId, c)));
        values += (await straighten(ring, { registrations: f.read.registrations, areaOf: f.read.areaOf }, chosen, seats)).values;
      }
      const picked = controllers.filter((one) => !skipped.has(one.key));
      const final = await normalizeAddressLines(picked.map((c) => c.before), true);
      let ctrl = 0;
      for (const [i, c] of picked.entries()) {
        await c.apply(final[i].tidy);
        ctrl += 1;
      }
      setForms(null);
      setControllers([]);
      setSaid(`Uporządkowano ${values} ${values === 1 ? 'odpowiedź' : 'odpowiedzi'} w formularzach`
        + (ctrl > 0 ? ` i ${ctrl} ${ctrl === 1 ? 'adres administratora danych' : 'adresy administratorów danych'}` : '') + '.');
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się uporządkować wszystkiego — część mogła zostać zapisana; przejrzyj jeszcze raz.');
    } finally {
      setWorking(null);
    }
  };

  const items: TidyItem[] = [
    ...(forms ?? []).flatMap((f) => f.crooked.map((c) => ({
      key: answerKey(f.formId, c), where: `${f.name} · ${c.kind === 'phone' ? 'telefon' : 'adres'}`, before: c.value, after: c.tidy, doubt: c.doubt
    }))),
    ...controllers.map((c) => ({ key: c.key, where: c.where, before: c.before, after: c.after, doubt: c.doubt }))
  ];
  const chosen = items.filter((one) => !skipped.has(one.key)).length;

  return (
    <section className="wk-form wk-tidy-all">
      <h2 className="wk-h2">Porządek w całej bazie</h2>
      <p className="wk-hint">
        Każdy adres w bazie zapisuje się tak samo jak w kartotece — w odpowiedziach na formularze, w danych osób
        i u administratora danych; numery telefonu jako +48 600 700 800. Nowe wpisy dostają tę postać same, przy
        wpisywaniu. Tu uporządkujesz to, co zapisano wcześniej — wszędzie, gdzie masz klucz.
      </p>
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={working !== null} onClick={() => void scan()}>
          {forms === null ? 'Przejrzyj bazę' : 'Przejrzyj jeszcze raz'}
        </button>
      </div>
      {forms !== null && items.length === 0 && <p className="wk-empty">Wszystko jest już zapisane w jednej postaci.</p>}
      {items.length > 0 && (
        <>
          <TidyList items={items} skipped={skipped} busy={working !== null} onToggle={(key) => setSkipped((was) => toggled(was, key))} />
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={working !== null || chosen === 0} onClick={() => void apply()}>
              Zapisz zaznaczone ({chosen})
            </button>
          </div>
        </>
      )}
      {working !== null && <p className="wk-hint" role="status">{working}</p>}
      {said !== null && <p className="wk-done">{said}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
