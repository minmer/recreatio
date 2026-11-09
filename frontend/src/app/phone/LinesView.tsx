/**
 * NUMERY I GRUPY (2026-10-19) — die eigenen Nummern dieses Telefons (zwei Karten: eine
 * für alle, eine für eine Gruppe) und die Gruppen der Kontakte, denen ein eigener Numer
 * gehört: wer in so einer Gruppe ist, bekommt SMS immer von dieser Nummer — aus dem
 * Gespräch, aus „Nowa wiadomość" und als Antwort aus der Meldung (`lines.ts`).
 *
 * <code>
 *   #/workspace/sms/numery
 * </code>
 *
 * Eine Gruppe ist, was in Kontakty bei „Grupy" steht; hier entsteht eine neue (Name,
 * Nummer, wer dazugehört) oder bekommt eine bestehende ihre Nummer und ihre Leute.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useT } from '../core/i18n';
import { useCrumbs } from '../shell/crumbTrail';
import { WorkspaceError, type Who } from '../core/session';
import { toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { Modal } from '../ui/Modal';
import { PageHeader } from '../ui/PageHeader';
import { contactMatches, saveContact, type Contact } from './contactStore';
import { contactsOf, findLine, forgetContacts, lineKeyOf, lineText, useLineRules, usePhoneLines } from './lines';
import { Phone, type Line, type PhoneStatus } from './native';
import { phoneShown } from './numbers';
import { openPhone } from './phoneContext';
import './phone.css';

/**
 * DIE EIGENEN NUMMERN — das Archiv vermerkt bei jeder Nachricht, von welcher sie ging, eine
 * Antwort aus dem Browser sendet nur ein Telefon mit dieser Nummer, und eine Gruppe nennt
 * ihre Nummer. Nennt eine Karte ihre Nummer nicht, trägt man sie hier ein (nur auf diesem Telefon).
 */
export function OwnLines() {
  const t = useT();
  const [lines, setLines] = useState<readonly Line[] | null>(null);
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({});
  const load = useCallback(() => {
    void Phone.lines().then((r) => setLines(r.lines)).catch(() => setLines([]));
    void Phone.status().then(setStatus).catch(() => undefined);
  }, []);
  useEffect(() => { load(); }, [load]);
  if (lines === null || lines.length === 0) return null;

  const save = async (line: Line) => {
    const value = (typed[line.subId] ?? line.number ?? '').trim();
    try {
      await Phone.setLine({ subId: line.subId, number: value === '' ? null : value });
      toast(value === '' ? t('phoneLines.own.removed') : t('phoneLines.own.saved'));
      load();
    } catch {
      toast(t('phoneLines.own.saveFailed'));
    }
  };

  return (
    <fieldset className="ph-own-lines">
      <legend>{t('phoneLines.own.title')}</legend>
      <p>{t('phoneLines.own.note')}</p>
      <ul>
        {lines.map((l) => (
          <li key={l.subId}>
            <span>{l.name}{status?.defaultSubId === l.subId && lines.length > 1 ? ` ${t('phoneLines.own.default')}` : ''}</span>
            {l.known ? <strong>{phoneShown(l.number)}</strong> : (
              <span className="ph-own-line">
                <input type="tel" value={typed[l.subId] ?? l.number ?? ''} placeholder={t('phoneLines.own.numberPh')} aria-label={t('phoneLines.own.numberOf', { name: l.name })}
                  onChange={(e) => setTyped({ ...typed, [l.subId]: e.target.value })} />
                <button type="button" className="wk-btn wk-btn-quiet" onClick={() => void save(l)}>{t('common.save')}</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

export function LinesView({ who }: { who: Who }) {
  const t = useT();
  const lines = usePhoneLines();
  const { groupRules, setGroupRule } = useLineRules();
  const [contacts, setContacts] = useState<readonly Contact[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  useCrumbs([{ label: t('phoneLines.title'), href: null }]);

  const reload = useCallback(() => {
    forgetContacts();
    void contactsOf(who).then((list) => { setContacts(list); setFailed(null); })
      .catch((e: unknown) => setFailed(e instanceof WorkspaceError ? e.message : t('phoneLines.loadFailed')));
  }, [who, t]);
  useEffect(() => { reload(); }, [reload]);

  /* Alle Gruppen: aus den Kontakten und aus den Regeln (eine Regel ohne Leute bleibt sichtbar). */
  const groups = useMemo(() => {
    const count = new Map<string, number>();
    for (const c of contacts ?? []) for (const g of c.groups) count.set(g, (count.get(g) ?? 0) + 1);
    for (const g of Object.keys(groupRules)) if (!count.has(g)) count.set(g, 0);
    return [...count.entries()].sort((a, b) => a[0].localeCompare(b[0], t.locale));
  }, [contacts, groupRules, t]);

  return (
    <>
      <PageHeader title={t('phoneLines.title')} />
      <OwnLines />

      <section className="ph-line-groups" aria-label={t('phoneLines.groups.title')}>
        <h2 className="ph-section-title">{t('phoneLines.groups.title')}</h2>
        <p className="ph-section-note">
          {t('phoneLines.groups.note')}
        </p>
        {lines.length < 2 && <p className="wk-empty">{t('phoneLines.groups.oneSim')}</p>}
        {failed !== null && <p className="wk-error">{failed}</p>}
        {contacts === null && failed === null && <Loading label={t('phoneLines.loading')} lines={2} />}
        {contacts !== null && groups.length === 0 && <p className="wk-empty">{t('phoneLines.groups.empty')}</p>}
        {contacts !== null && groups.length > 0 && (
          <ul className="ph-group-rows">
            {groups.map(([g, n]) => {
              const rule = findLine(lines, groupRules[g]);
              return (
                <li key={g} className="ph-group-row">
                  <span className="ph-group-name"><strong>{g}</strong><small>{t('phoneLines.persons', { count: n })}</small></span>
                  {lines.length > 1 && (
                    <select aria-label={t('phoneLines.groups.numberFor', { group: g })} value={rule === null ? '' : lineKeyOf(rule)}
                      onChange={(e) => setGroupRule(g, e.target.value === '' ? null : e.target.value)}>
                      <option value="">{t('phoneLines.defaultNumber')}</option>
                      {lines.map((l) => <option key={l.subId} value={lineKeyOf(l)}>{lineText(l)}</option>)}
                    </select>
                  )}
                  <button type="button" className="wk-link-btn" onClick={() => setEditing(g)}><Icon name="users" />{t('phoneLines.groups.people')}</button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={contacts === null} onClick={() => setEditing('')}><Icon name="plus" />{t('phoneLines.groups.new')}</button>
        </div>
      </section>

      {editing !== null && contacts !== null && (
        <GroupEditor who={who} name={editing} contacts={contacts} lines={lines} rule={editing === '' ? null : groupRules[editing] ?? null}
          onClose={() => setEditing(null)}
          onSaved={(name, key) => { setGroupRule(name, key, editing === '' ? undefined : editing); setEditing(null); reload(); }} />
      )}
    </>
  );
}

/**
 * EINE GRUPPE: Name (bei einer neuen), Nummer, wer dazugehört. Gespeichert wird bei jedem
 * Kontakt, der dazukommt oder geht — die Gruppe steht im Kontakt (versiegelt), die Nummer
 * in der Regel am Konto.
 */
function GroupEditor({ who, name, contacts, lines, rule, onClose, onSaved }: {
  who: Who;
  name: string;
  contacts: readonly Contact[];
  lines: readonly Line[];
  rule: string | null;
  onClose: () => void;
  onSaved: (name: string, key: string | null) => void;
}) {
  const t = useT();
  const fresh = name === '';
  const [title, setTitle] = useState(name);
  const [key, setKey] = useState<string>(rule ?? (fresh && lines.length > 1 ? lineKeyOf(lines[lines.length - 1]) : ''));
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<ReadonlySet<string>>(() => new Set(contacts.filter((c) => c.groups.includes(name)).map((c) => c.id)));
  const [busy, setBusy] = useState<string | null>(null);
  const shown = contacts.filter((c) => contactMatches(c, query)).slice(0, 300);

  const toggle = (id: string) => setMembers((had) => {
    const next = new Set(had);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const save = async () => {
    const group = title.trim();
    if (group === '') { toast(t('phoneLines.edit.nameIt')); return; }
    if (group.includes(',')) { toast(t('phoneLines.edit.noComma')); return; }
    const changes = contacts.filter((c) => members.has(c.id) !== c.groups.includes(group) || (!fresh && group !== name && c.groups.includes(name)));
    setBusy(t('common.saving'));
    try {
      const ctx = await openPhone(who);
      let done = 0;
      for (const c of changes) {
        const without = c.groups.filter((g) => g !== group && (fresh || g !== name));
        const groups = members.has(c.id) ? [...without, group] : without;
        await saveContact(ctx, c.id, { ...c, groups }, c.version);
        done += 1;
        setBusy(t('phoneLines.edit.savingN', { done, total: changes.length }));
      }
      onSaved(group, key === '' ? null : key);
      toast(key === ''
        ? t('phoneLines.edit.saved', { group, persons: t('phoneLines.persons', { count: members.size }) })
        : t('phoneLines.edit.savedNumber', { group, persons: t('phoneLines.persons', { count: members.size }), number: lineText(findLine(lines, key) ?? lines[0]) }));
    } catch (e) {
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : t('phoneLines.edit.saveFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title={fresh ? t('phoneLines.groups.new') : t('phoneLines.edit.title', { group: name })} onClose={onClose} wide>
      <div className="ph-group-edit">
        <label className="wk-field">
          <span>{t('phoneLines.edit.name')}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('phoneLines.edit.namePh')} autoFocus={fresh} />
        </label>
        {lines.length > 1 && (
          <label className="wk-field">
            <span>{t('phoneLines.edit.sendFrom')}</span>
            <select value={key} onChange={(e) => setKey(e.target.value)}>
              <option value="">{t('phoneLines.defaultNumber')}</option>
              {lines.map((l) => <option key={l.subId} value={lineKeyOf(l)}>{lineText(l)}</option>)}
            </select>
          </label>
        )}
        <label className="wk-field">
          <span>{t('phoneLines.edit.people', { count: members.size })}</span>
          <input type="search" value={query} placeholder={t('phoneLines.edit.searchPh')} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <ul className="ph-choose-list" aria-label={t('phoneLines.edit.contacts')}>
          {shown.map((c) => (
            <li key={c.id}>
              <label className="wk-check">
                <input type="checkbox" checked={members.has(c.id)} onChange={() => toggle(c.id)} />
                <span className="ph-choose-text">
                  <span className="ph-row-name">{c.name}</span>
                  <small>{[c.phones[0]?.number, ...c.groups].filter(Boolean).join(' · ')}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {busy !== null && <p className="ch-compose-line" aria-live="polite">{busy}</p>}
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy !== null} onClick={() => void save()}>{t('phoneLines.edit.save')}</button>
          <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </Modal>
  );
}
