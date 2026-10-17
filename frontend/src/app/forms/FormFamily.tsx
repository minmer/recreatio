/**
 * DAS FORMULAR UND SEINE UNTERFORMULARE (0096) — oben in jedem Formular: das
 * Hauptformular und jedes Unterformular als Reiter zum Öffnen und Bearbeiten,
 * „+ Podformularz" gleich hier, die Karte der Familie, und die Gruppe.
 *
 * <code>
 *   [Zapisy do bierzmowania] [↳ 1. Zadania] [↳ 2. Zadania] [+ Podformularz]   Mapa · Grupa: Bierzmowanie 2027
 * </code>
 *
 * Vorher lagen die Unterformulare nur in den Einstellungen des Hauptformulars
 * („Rozszerzenia" → Otwórz) — in der einfachen Liste gar nicht.
 *
 * 0099 — und ein Unterformular lässt sich hier auch wieder LÖSCHEN, solange
 * niemand etwas eingetragen hat: mit Rückfrage, und steht es auf einer Seite,
 * wird es von dort mitgenommen (der Dienst prüft, ob man die Seite bearbeitet).
 */

import { useEffect, useState } from 'react';

import { FORM_MAP } from './FormList';
import { newId } from '../core/ids';
import { createModule, loadModules, removeModule, updateModule, type FormGroup, type ModuleRow } from '../modules/module';
import { REPEAT_LABEL, REPEATS, repeatOf, type Repeat } from './rounds';
import { formPath, formsPath } from '../routes';
import { WorkspaceError } from '../core/session';

export function FormFamily({ module, onChanged }: { module: ModuleRow; onChanged?: () => void }) {
  const [all, setAll] = useState<readonly ModuleRow[] | null>(null);
  const [groups, setGroups] = useState<readonly FormGroup[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [audience, setAudience] = useState<'person' | 'office'>('person');
  const [repeat, setRepeat] = useState<Repeat>('once');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [removing, setRemoving] = useState(false);
  useEffect(() => { setRemoving(false); }, [module.moduleId]);

  useEffect(() => {
    let alive = true;
    void loadModules().then((found) => { if (alive) { setAll(found.modules); setGroups(found.groups ?? []); } }).catch(() => undefined);
    return () => { alive = false; };
  }, [module.moduleId, module.groupId, module.name, module.audience, module.repeat, round]);

  if (all === null) return null;

  const mainId = module.extendsId ?? module.moduleId;
  const main = all.find((m) => m.moduleId === mainId) ?? (module.extendsId === null ? module : null);
  const subs = all.filter((m) => m.kind === 'form' && m.extendsId === mainId).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  const group = groups.find((g) => g.groupId === module.groupId) ?? null;

  const add = async () => {
    if (main === null || name.trim() === '') return;
    setBusy(true);
    setFailed(null);
    try {
      const moduleId = newId();
      await createModule(moduleId, 'form', name.trim(), main.areaId, main.forKind, '{}', { extendsId: main.moduleId, audience, repeat });
      setAdding(false);
      setName('');
      setRound((n) => n + 1);
      onChanged?.();
      window.location.hash = formPath(moduleId);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się założyć podformularza.');
    } finally {
      setBusy(false);
    }
  };

  /* 0099 — das offene Unterformular löschen; danach steht das Hauptformular da. */
  const remove = async () => {
    if (module.extendsId === null) return;
    setBusy(true);
    setFailed(null);
    try {
      await removeModule(module.moduleId, { fromPages: module.usedOnPages > 0 });
      setRemoving(false);
      onChanged?.();
      window.location.hash = formPath(module.extendsId);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć podformularza.');
    } finally {
      setBusy(false);
    }
  };

  /* Das offene Formular frisch aus dem Aufrufer — die Liste kann einen Augenblick älter sein. */
  const tab = (listed: ModuleRow, sub: boolean, form: ModuleRow = listed.moduleId === module.moduleId ? module : listed) => (
    <a key={form.moduleId} className={form.moduleId === module.moduleId ? 'wk-family-tab is-on' : 'wk-family-tab'}
      aria-current={form.moduleId === module.moduleId ? 'page' : undefined}
      href={formPath(form.moduleId)} data-family-tab={form.moduleId}>
      {sub && <span aria-hidden="true">↳ </span>}{form.name}
      {sub && <span className="wk-family-who"> · {form.audience === 'office' ? 'koordynator' : 'osoba'}{repeatOf(form.repeat) !== 'once' ? ` · ${REPEAT_LABEL[repeatOf(form.repeat)]}` : ''}</span>}
    </a>
  );

  return (
    <nav className="wk-family" aria-label="Formularz i podformularze" data-form-family="">
      <div className="wk-family-tabs">
        {main !== null && tab(main, false)}
        {subs.map((s) => tab(s, true))}
        {main !== null && !adding && (
          <button type="button" className="wk-family-add" data-add-sub="" onClick={() => setAdding(true)}>+ Podformularz</button>
        )}
      </div>
      <div className="wk-family-side">
        <a className="wk-link-btn" href={formsPath(FORM_MAP, mainId)} data-family-map="">Mapa</a>
        {group !== null && <span className="wk-tag">grupa: {group.name}</span>}
        {module.extendsId !== null && !removing && (
          <button type="button" className="wk-link-btn wk-danger-link" data-sub-remove="" onClick={() => setRemoving(true)}>Usuń podformularz</button>
        )}
      </div>

      {removing && module.extendsId !== null && (
        <div className="wk-note wk-delete-warn wk-family-remove" data-sub-remove-ask="">
          {module.entries > 0 ? (
            <>
              <p>
                Do „{module.name}" są już wpisy ({module.entries}) — należą do osób, więc podformularza nie da się usunąć.
                Można go zamknąć w zakładce „Ustawienia": nowych wpisów już nie będzie.
              </p>
              <div className="wk-actions">
                <button type="button" className="wk-link-btn" onClick={() => setRemoving(false)}>Rozumiem</button>
              </div>
            </>
          ) : (
            <>
              <p>
                <strong>Usunąć podformularz „{module.name}"?</strong> Znikną jego pytania, układ i logika,
                a osoby nie zobaczą już kroku „Uzupełnij". Tego nie da się cofnąć.
              </p>
              {module.pages.length > 0 && (
                <p>
                  Stoi na {module.pages.length === 1 ? 'stronie' : 'stronach'}{' '}
                  {module.pages.map((p) => (p === '' ? 'recreatio.pl' : p)).join(', ')} — {module.pages.length === 1 ? 'zostanie z niej zdjęty' : 'zostanie z nich zdjęty'}.
                </p>
              )}
              <div className="wk-actions">
                <button type="button" className="wk-btn wk-btn-danger" disabled={busy} data-sub-remove-go="" onClick={() => void remove()}>
                  {busy ? 'Usuwanie…' : 'Usuń podformularz'}
                </button>
                <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setRemoving(false)}>Anuluj</button>
              </div>
            </>
          )}
        </div>
      )}

      {adding && main !== null && (
        <form className="wk-inline wk-family-new" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <input value={name} autoFocus placeholder="np. Zadania na najbliższy czas" aria-label="Nazwa podformularza" data-sub-name=""
            disabled={busy} onChange={(e) => setName(e.target.value)} />
          <select value={audience} aria-label="Kto wypełnia" disabled={busy} onChange={(e) => setAudience(e.target.value === 'office' ? 'office' : 'person')}>
            <option value="person">wypełnia osoba (przez swój link)</option>
            <option value="office">tylko koordynator</option>
          </select>
          <select value={repeat} aria-label="Jak często" disabled={busy} onChange={(e) => setRepeat(repeatOf(e.target.value))}>
            {REPEATS.map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
          </select>
          <button type="submit" className="wk-btn wk-btn-small" disabled={busy || name.trim() === ''} data-sub-go="">{busy ? 'Zakładanie…' : 'Dodaj'}</button>
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => { setAdding(false); setName(''); }}>Anuluj</button>
          <span className="wk-hint">Podformularz dopisuje się do zgłoszeń z „{main.name}" — osoba wypełnia go przez swój link (albo tylko koordynator).</span>
        </form>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </nav>
  );
}

/**
 * NAZWA I GRUPA — für jedes Formular, auch im einfachen Weg (vorher nur in den
 * erweiterten Einstellungen). Bei einem Unterformular dazu, wer es ausfüllt —
 * solange nichts eingetragen ist.
 */
export function FormBasics({ module, busy, onAct, withName = true }: {
  module: ModuleRow;
  /** Im erweiterten Weg steht der Name schon in den Einstellungen des Moduls. */
  withName?: boolean;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void> | void;
}) {
  const [name, setName] = useState(module.name);
  const [groups, setGroups] = useState<readonly FormGroup[]>([]);
  useEffect(() => { setName(module.name); }, [module.name]);
  useEffect(() => {
    let alive = true;
    void loadModules().then((found) => { if (alive) setGroups(found.groups ?? []); }).catch(() => undefined);
    return () => { alive = false; };
  }, [module.moduleId]);

  return (
    <div className="wk-form wk-form-basics" data-form-basics="">
      {withName && <form className="wk-inline" onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() !== '' && name.trim() !== module.name) void onAct('Zmiana nazwy…', () => updateModule(module.moduleId, { name: name.trim() }, module));
      }}>
        <label className="wk-field">
          <span>Nazwa {module.extendsId === null ? 'formularza' : 'podformularza'}</span>
          <input value={name} maxLength={200} disabled={busy} data-form-name="" onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className="wk-btn wk-btn-small" disabled={busy || name.trim() === '' || name.trim() === module.name}>Zapisz nazwę</button>
      </form>}

      <label className="wk-field">
        <span>Grupa formularzy (folder — dla wypełniających nic się nie zmienia)</span>
        <select value={module.groupId ?? ''} disabled={busy} data-form-group-select=""
          onChange={(e) => void onAct(e.target.value === '' ? 'Wyjmowanie z grupy…' : 'Przenoszenie do grupy…',
            () => updateModule(module.moduleId, e.target.value === '' ? { clearGroup: true } : { groupId: e.target.value }))}>
          <option value="">bez grupy</option>
          {groups.map((g) => <option key={g.groupId} value={g.groupId}>{g.name}</option>)}
        </select>
        {groups.length === 0 && <span className="wk-hint">Grupę zakładasz na liście formularzy („+ Nowa grupa").</span>}
      </label>

      {module.extendsId !== null && (
        <label className="wk-field">
          <span>Kto wypełnia</span>
          <select value={module.audience === 'office' ? 'office' : 'person'} disabled={busy || module.entries > 0} data-form-audience=""
            onChange={(e) => void onAct('Zapisywanie…', () => updateModule(module.moduleId, { audience: e.target.value === 'office' ? 'office' : 'person' }))}>
            <option value="person">osoba — przez swój link (w swoich krokach „Uzupełnij")</option>
            <option value="office">tylko koordynator — osoba tego nie widzi</option>
          </select>
          {module.entries > 0 && <span className="wk-hint">Są już wpisy — kto wypełnia, zmienia się tylko w pustym podformularzu.</span>}
        </label>
      )}
    </div>
  );
}

export default FormFamily;
