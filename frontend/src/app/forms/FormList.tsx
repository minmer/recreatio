/**
 * DIE FORMULARE, GEORDNET (0096) — die einfache Liste in „Moduły": jede
 * Gruppe (ein Ordner) mit ihren Formularen in ihrer Folge, darunter die ohne
 * Gruppe; Unterformulare eingerückt unter ihrem Hauptformular, jedes zum
 * Öffnen und Bearbeiten.
 *
 * <code>
 *   [Mapa formularzy] [+ Nowa grupa] [+ Nowy formularz]
 *   ▸ Bierzmowanie 2027                       Zmień nazwę · Usuń grupę
 *       Zapisy do bierzmowania     84 zgłoszeń      Grupa [▾]  ↑ ↓
 *         ↳ 1. Zadania …           wypełnia osoba   Grupa [▾]
 *   ▸ Bez grupy
 * </code>
 */

import { useState } from 'react';

import { areaPath, type AreaRow } from '../areas/area';
import { AreaOptions } from '../areas/AreaOptions';
import { plural } from '../core/plural';
import { formSections, moveInGroup, type FormItem } from './formGroups';
import { newId } from '../core/ids';
import { createFormGroup, removeFormGroup, updateFormGroup, updateModule, type FormGroup, type ModuleRow } from '../modules/module';
import { formNewsPath, formPath, formsPath } from '../routes';
import { askText } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { MenuButton } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';

export const FORM_MAP = 'mapa-formularzy';

export function FormList({ modules, groups, areas, fresh, busy, onAct }: {
  modules: readonly ModuleRow[];
  groups: readonly FormGroup[];
  areas: readonly AreaRow[];
  /** Neue Einsendungen je Formular (aus der Glocke). */
  fresh: ReadonlyMap<string, number>;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [naming, setNaming] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [making, setMaking] = useState(false);
  const [newName, setNewName] = useState('');
  const sections = formSections(modules, groups);
  const hasGroups = groups.length > 0;

  /*
   * 0097 — EINE GRUPPE GEHÖRT EINEM BEREICH: unter seinem Schlüssel liegt ihr
   * Name. Zur Wahl stehen die, in denen ich schreibe; vorgeschlagen der, in dem
   * die meisten Formulare stehen.
   */
  const writable = areas.filter((a) => a.myLevel === 'write' || a.myLevel === 'admin');
  const usual = (() => {
    const count = new Map<string, number>();
    for (const m of modules) if (m.kind === 'form' && m.areaId !== null && writable.some((a) => a.areaId === m.areaId)) count.set(m.areaId, (count.get(m.areaId) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? writable[0]?.areaId ?? '';
  })();
  const [newArea, setNewArea] = useState('');
  const groupArea = newArea !== '' ? newArea : usual;

  const moveTo = (form: ModuleRow, value: string) => void onAct(
    value === '' ? 'Wyjmowanie z grupy…' : 'Przenoszenie do grupy…',
    () => updateModule(form.moduleId, value === '' ? { clearGroup: true } : { groupId: value }, form)
  );

  const row = (form: ModuleRow, sub: boolean, order: readonly string[] | null, group: FormGroup | null) => {
    const n = fresh.get(form.moduleId) ?? 0;
    const at = order === null ? -1 : order.indexOf(form.moduleId);
    return (
      <div className={sub ? 'wk-form-row is-sub' : 'wk-form-row'} data-form-row={form.moduleId}>
        {/* 0103 — mit Neuem gleich auf seine Liste. */}
        <a className="wk-tree-row" href={n > 0 ? formNewsPath(form.moduleId) : formPath(form.moduleId)}>
          <span className="wk-tree-name">{sub && <span aria-hidden="true">↳ </span>}{form.name}</span>
          <span className="wk-tags">
            {form.extendsId !== null && <span className="wk-tag">{form.audience === 'office' ? 'tylko koordynator' : 'wypełnia osoba'}</span>}
            {form.extendsId === null && form.areaId !== null && <span className="wk-tag">{areaPath(areas, form.areaId).short || form.areaName}</span>}
            {form.closed && <span className="wk-tag">zamknięty</span>}
            {n > 0 && <span className="wk-tag wk-tag-new">nowe: {n}</span>}
          </span>
          <span className="wk-tree-mine">
            {form.entries} {form.extendsId === null ? plural(form.entries, 'zgłoszenie', 'zgłoszenia', 'zgłoszeń') : plural(form.entries, 'wpis', 'wpisy', 'wpisów')}
          </span>
        </a>
        {/* 2026-10-17 — Grupa und Reihenfolge in EINEM Menü: vorher an jeder Zeile ein Auswahlfeld und zwei Pfeile. */}
        <MenuButton label={`Więcej: ${form.name}`} disabled={busy} items={[
          order !== null && group !== null && group.manages && at > 0 && {
            label: 'Przesuń wyżej', icon: 'up',
            onSelect: () => void onAct('Porządkowanie…', () => updateFormGroup(group.groupId, { order: moveInGroup(order, form.moduleId, -1) }))
          },
          order !== null && group !== null && group.manages && at >= 0 && at < order.length - 1 && {
            label: 'Przesuń niżej', icon: 'down',
            onSelect: () => void onAct('Porządkowanie…', () => updateFormGroup(group.groupId, { order: moveInGroup(order, form.moduleId, 1) }))
          },
          ...(hasGroups || form.groupId != null ? [
            ...groups.map((g) => ({ label: `Do grupy: ${g.name}`, icon: 'layers' as const, checked: form.groupId === g.groupId, onSelect: () => { if (form.groupId !== g.groupId) moveTo(form, g.groupId); } })),
            form.groupId != null && { label: 'Wyjmij z grupy', icon: 'x' as const, onSelect: () => moveTo(form, '') }
          ] : [])
        ]} />
      </div>
    );
  };

  const items = (list: readonly FormItem<ModuleRow>[], group: FormGroup | null) => {
    const order = group === null ? null : list.map((i) => i.form.moduleId);
    return (
      <ul className="wk-form-list">
        {list.map((item) => (
          <li key={item.form.moduleId}>
            {row(item.form, item.form.extendsId !== null, order, group)}
            {item.subs.length > 0 && (
              <ul className="wk-form-subs">
                {item.subs.map((sub) => <li key={sub.moduleId}>{row(sub, true, null, null)}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="wk-form-groups" data-form-groups="">
      <PageHeader
        title="Formularze"
        actions={(
          <>
            <a className="wk-btn" href={formPath('new')}><Icon name="plus" />Nowy formularz</a>
            {!making && <button type="button" className="wk-btn wk-btn-line" data-new-group="" onClick={() => setMaking(true)}><Icon name="plus" />Nowa grupa</button>}
            <a className="wk-btn wk-btn-quiet" href={formsPath(FORM_MAP)} data-form-map-link=""><Icon name="branch" />Mapa</a>
          </>
        )}
      />

      {making && (
        <form className="wk-inline wk-new-group" onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim() === '' || groupArea === '') return;
          void onAct('Zakładanie grupy…', () => createFormGroup(newId(), newName.trim(), groupArea)).then(() => { setMaking(false); setNewName(''); });
        }}>
          <input value={newName} autoFocus placeholder="np. Bierzmowanie 2027" aria-label="Nazwa grupy" data-new-group-name="" onChange={(e) => setNewName(e.target.value)} />
          <select aria-label="Obszar grupy" value={groupArea} disabled={busy} data-new-group-area="" onChange={(e) => setNewArea(e.target.value)}>
            <AreaOptions areas={areas} only={writable} />
          </select>
          <button type="submit" className="wk-btn wk-btn-small" disabled={busy || newName.trim() === '' || groupArea === ''}>Utwórz grupę</button>
          <button type="button" className="wk-link-btn" onClick={() => { setMaking(false); setNewName(''); }}>Anuluj</button>
          <span className="wk-hint">Grupa to folder — dla wypełniających nic się nie zmienia.</span>
        </form>
      )}

      {sections.map((section) => {
        const group = section.group;
        const key = group?.groupId ?? 'none';
        if (group === null && section.items.length === 0) return null;
        return (
          <section key={key} className={group === null ? 'wk-fgroup is-loose' : 'wk-fgroup'} data-fgroup={key}>
            {(group !== null || hasGroups) && (
              <header className="wk-fgroup-head">
                {group !== null && naming === group.groupId ? (
                  <form className="wk-inline" onSubmit={(e) => {
                    e.preventDefault();
                    if (name.trim() === '') return;
                    void onAct('Zmiana nazwy grupy…', () => updateFormGroup(group.groupId, { name: name.trim() }, group.areaId)).then(() => setNaming(null));
                  }}>
                    <input value={name} autoFocus aria-label="Nazwa grupy" onChange={(e) => setName(e.target.value)} />
                    <button type="submit" className="wk-btn wk-btn-small" disabled={busy || name.trim() === ''}>Zapisz</button>
                    <button type="button" className="wk-link-btn" onClick={() => setNaming(null)}>Anuluj</button>
                  </form>
                ) : (
                  <h2 className="wk-fgroup-name">{group === null ? 'Bez grupy' : group.name}</h2>
                )}
                {group !== null && naming !== group.groupId && group.manages && (
                  <MenuButton label={`Grupa: ${group.name}`} disabled={busy} items={[
                    { label: 'Zmień nazwę', icon: 'edit', onSelect: () => { setNaming(group.groupId); setName(group.name); } },
                    {
                      label: 'Usuń grupę', icon: 'trash', danger: true,
                      onSelect: () => void (async () => {
                        if (!(await askText(`Usunąć grupę „${group.name}"? Formularze zostają — tylko bez grupy.`))) return;
                        void onAct('Usuwanie grupy…', () => removeFormGroup(group.groupId));
                      })()
                    }
                  ]} />
                )}
              </header>
            )}
            {section.items.length === 0
              ? <p className="wk-empty">Pusta grupa — przenieś tu formularz z jego menu „⋯".</p>
              : items(section.items, group)}
          </section>
        );
      })}

      {modules.every((m) => m.kind !== 'form') && (
        <p className="wk-empty">Nie masz jeszcze formularza. Najprościej: na stronie warsztatu „Co chcesz zrobić?" → „Zapisy na wydarzenie".</p>
      )}
    </div>
  );
}

export default FormList;
