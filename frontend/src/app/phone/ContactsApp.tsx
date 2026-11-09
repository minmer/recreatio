/**
 * KONTAKTE (2026-10-17) — das eigene Adressbuch in recreatio, versiegelt im
 * eigenen Bereich. Bearbeitet wird hier; das Telefon (Ausgabe „sms") bekommt
 * eine Abschrift in sein Adressbuch (Konto „REcreatio"), damit bei einem Anruf
 * und unter jeder SMS der Name steht — ohne dass jemand nachfragen muss.
 *
 * <code>
 *   #/workspace/contacts            die Liste, Suche, Gruppen
 *   #/workspace/contacts/nowy       ein neuer Kontakt (?numer=… vorbelegt)
 *   #/workspace/contacts/<kennung>  ein Kontakt
 * </code>
 *
 * Einlesen: aus dem Telefon (alle Kontakte, ein zweites Mal ergänzt es nur)
 * und aus einer vCard (Google, ein anderes Telefon); hinaus als vCard.
 * 2026-10-29 — und als JSON wie jeder Teil der App (`contactsJson.ts`): mit Vorschau, für Hand und Assistent.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { useCrumbs } from '../shell/crumbTrail';
import { viewPath } from '../routes';
import { rich, useT } from '../core/i18n';
import { saveBlob } from '../core/platform';
import { WorkspaceError, type Who } from '../core/session';
import { ask, toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { JsonPanel } from '../ui/JsonPanel';
import { MenuButton } from '../ui/Menu';
import { Modal } from '../ui/Modal';
import { PageHeader } from '../ui/PageHeader';
import {
  contactMatches, emptyContact, fromCard, fromPhoneBook, importContacts, loadContacts, PHONE_LABELS, phoneKeysOf, phoneLabelText, removeContact,
  saveContact, saveContactsMany, saveProblem, type Contact, type ContactData
} from './contactStore';
import { CONTACTS_JSON, exportContactsJson, planContactsJson } from './contactsJson';
import { Phone, phoneHere, pluginSource, type PhoneStatus } from './native';
import { phoneShown } from './numbers';
import { findLine, forgetContacts, lineKeyOf, lineText, useLineRules, usePhoneLines } from './lines';
import { contactsNow } from './phoneJobs';
import { openPhone, type PhoneCtx } from './phoneContext';
import { Avatar, shortWhen } from './smsShared';
import { formatVCards, parseVCards } from './vcard';
import './phone.css';

export function ContactsApp({ who, trail }: { who: Who; trail: readonly string[] }) {
  const t = useT();
  const native = phoneHere();
  const [ctx, setCtx] = useState<PhoneCtx | null>(null);
  const [contacts, setContacts] = useState<readonly Contact[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [json, setJson] = useState(false);

  const reload = useCallback(async (opened: PhoneCtx) => {
    forgetContacts();
    setContacts(await loadContacts(opened));
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const opened = await openPhone(who);
        if (!alive) return;
        setCtx(opened);
        await reload(opened);
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : t('phoneContacts.app.loadFailed'));
      }
    })();
    return () => { alive = false; };
  }, [who, reload, t]);

  const refreshStatus = useCallback(() => {
    if (native) void Phone.status().then(setStatus).catch(() => undefined);
  }, [native]);
  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  /* Nach jeder Änderung: das Telefon gleich auffrischen (in der App selbst, sonst im Hintergrund). */
  const toPhoneSoon = useCallback((opened: PhoneCtx) => {
    if (!native) return;
    void contactsNow(opened, pluginSource, true).then(refreshStatus).catch(() => undefined);
  }, [native, refreshStatus]);

  const step = trail[0];
  if (failed !== null) return <p className="wk-error">{failed}</p>;
  if (ctx === null || contacts === null) return <Loading label={t('phoneContacts.app.loading')} />;

  if (step !== undefined) {
    const had = step === 'nowy' ? null : contacts.find((c) => c.id === step) ?? null;
    if (step !== 'nowy' && had === null) return <p className="wk-empty">{t('phoneContacts.app.noSuch')}</p>;
    return (
      <ContactEdit ctx={ctx} contact={had} native={native}
        onSaved={(saved) => {
          forgetContacts();
          setContacts((list) => [...(list ?? []).filter((c) => c.id !== saved.id), saved]);
          toPhoneSoon(ctx);
          window.location.hash = viewPath('contacts');
        }}
        onRemoved={(id) => {
          forgetContacts();
          setContacts((list) => (list ?? []).filter((c) => c.id !== id));
          toPhoneSoon(ctx);
          window.location.hash = viewPath('contacts');
        }} />
    );
  }

  const work = async (what: string, todo: () => Promise<string | null>) => {
    setBusy(what);
    try {
      const said = await todo();
      if (said !== null) toast(said);
    } catch (e) {
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(null);
    }
  };

  const savingN = (done: number, total: number) => setBusy(t('phoneContacts.app.savingN', { done, total }));

  const importPhone = () => work(t('phoneContacts.app.importingPhone'), async () => {
    const granted = (await Phone.requestContacts()).granted;
    if (!granted) return t('phoneContacts.app.noAccessImport');
    const { contacts: book } = await Phone.contacts();
    const result = await importContacts(ctx, book.map(fromPhoneBook), contacts, savingN);
    await reload(ctx);
    toPhoneSoon(ctx);
    return result.failed > 0
      ? t('phoneContacts.app.fromPhoneFailed', { added: result.added, updated: result.updated, unchanged: result.unchanged, failed: result.failed })
      : t('phoneContacts.app.fromPhone', { added: result.added, updated: result.updated, unchanged: result.unchanged });
  });

  const syncPhone = () => work(t('phoneContacts.app.savingPhone'), async () => {
    const granted = (await Phone.requestContacts()).granted;
    if (!granted) return t('phoneContacts.app.noAccessSync');
    const result = await contactsNow(ctx, pluginSource, true);
    refreshStatus();
    return t('phoneContacts.app.inPhone', { total: result.total, added: result.added, updated: result.updated, removed: result.removed });
  });

  /*
   * PRZENIEŚ: einlesen wie oben, ins Telefon schreiben — und dann die Originale entfernen, die NUR im Gerät
   * stehen (ohne Konto). Danach gibt es jeden Menschen einmal, und beim Anruf steht der Name aus recreatio.
   * Ging beim Einlesen etwas schief, wird nichts entfernt.
   */
  const movePhone = async () => {
    const yes = await ask({
      title: t('phoneContacts.app.moveAsk'),
      body: t('phoneContacts.app.moveBody'),
      confirm: t('phoneContacts.app.move')
    });
    if (!yes) return;
    await work(t('phoneContacts.app.moving'), async () => {
      if (!(await Phone.requestContacts()).granted) return t('phoneContacts.app.noAccessMove');
      const { contacts: book } = await Phone.contacts();
      const result = await importContacts(ctx, book.map(fromPhoneBook), contacts, savingN);
      if (result.failed > 0) return t('phoneContacts.app.moveFailed', { failed: result.failed });
      const fresh = await loadContacts(ctx);
      setContacts(fresh);
      setBusy(t('phoneContacts.app.savingPhone'));
      await contactsNow(ctx, pluginSource, true);
      const { removed } = await Phone.dropLocal({ keys: phoneKeysOf(fresh) });
      refreshStatus();
      return t('phoneContacts.app.moved', { added: result.added, updated: result.updated, removed });
    });
  };

  return (
    <>
    <ContactList contacts={contacts} native={native} status={status} busy={busy}
      onJson={() => setJson(true)}
      onImportPhone={() => void importPhone()}
      onMovePhone={() => void movePhone()}
      onSyncPhone={() => void syncPhone()}
      onImportCards={(text) => void work(t('phoneContacts.app.loadingVcard'), async () => {
        const cards = parseVCards(text);
        if (cards.length === 0) return t('phoneContacts.app.noCards');
        const result = await importContacts(ctx, cards.map(fromCard), contacts, savingN);
        await reload(ctx);
        toPhoneSoon(ctx);
        return t('phoneContacts.app.fromFile', { added: result.added, updated: result.updated, unchanged: result.unchanged });
      })}
    />
    {json && (
      <Modal title={t('phoneContacts.app.jsonTitle')} wide onClose={() => setJson(false)}>
        <JsonPanel
          summary={t('phoneContacts.json.short')}
          lead={<>{t('phoneContacts.app.jsonLead')}</>}
          fileName={t('phoneContacts.app.jsonFile', { date: new Date().toISOString().slice(0, 10) })}
          exportDoc={() => exportContactsJson(contacts)}
          format={CONTACTS_JSON}
          open
          preview={(doc) => {
            const plan = planContactsJson(doc, contacts);
            return 'error' in plan ? plan : { lines: plan.lines, warnings: plan.warnings };
          }}
          importLabel={t('phoneContacts.app.jsonImport')}
          onImport={async (doc, stage) => {
            const plan = planContactsJson(doc, contacts);
            if ('error' in plan) throw new WorkspaceError(plan.error);
            stage(t('phoneContacts.app.saving'));
            const { failed } = await saveContactsMany(ctx, plan.work, (done) => stage(t('phoneContacts.app.savingN', { done, total: plan.work.length })));
            await reload(ctx);
            toPhoneSoon(ctx);
            return { lines: plan.lines, warnings: failed > 0 ? [...plan.warnings, t('phoneContacts.app.saveFailedN', { failed })] : plan.warnings };
          }}
        />
      </Modal>
    )}
    </>
  );
}

export default ContactsApp;

/* -- Die Liste ------------------------------------------------------------------------------- */

function ContactList({ contacts, native, status, busy, onJson, onImportPhone, onMovePhone, onSyncPhone, onImportCards }: {
  contacts: readonly Contact[];
  native: boolean;
  status: PhoneStatus | null;
  busy: string | null;
  onJson: () => void;
  onImportPhone: () => void;
  onMovePhone: () => void;
  onSyncPhone: () => void;
  onImportCards: (text: string) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const file = useRef<HTMLInputElement | null>(null);
  /* 2026-10-19 — eine Gruppe kann ihre eigene Nummer für SMS haben (zwei Karten im Telefon). */
  const lines = usePhoneLines();
  const { groupRules, setGroupRule } = useLineRules();
  useCrumbs([]);

  const groups = useMemo(() => [...new Set(contacts.flatMap((c) => c.groups))].sort((a, b) => a.localeCompare(b, t.locale)), [contacts, t]);
  const shown = contacts.filter((c) => (group === null || c.groups.includes(group)) && contactMatches(c, query));

  /* `saveBlob`: im Browser ein Download, in der App der Dokumentenwähler — ein <a download> täte dort nichts. */
  const exportCards = () => {
    void saveBlob(new Blob([formatVCards(shown)], { type: 'text/vcard' }), t('phoneContacts.app.vcfFile', { date: new Date().toISOString().slice(0, 10) }))
      .catch(() => toast(t('phoneContacts.app.fileFailed')));
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const one = e.target.files?.[0];
    e.target.value = '';
    if (one === undefined) return;
    void one.text().then(onImportCards);
  };

  return (
    <>
      <PageHeader title={t('phoneContacts.json.short')} meta={t('phoneContacts.app.count', { count: contacts.length })} actions={(
        <>
          <a className="wk-btn" href={viewPath('contacts', 'nowy')}><Icon name="plus" />{t('phoneContacts.app.contact')}</a>
          <MenuButton label={t('phoneContacts.app.more')} items={[
            native && { label: t('phoneContacts.app.menuImportPhone'), icon: 'download', onSelect: onImportPhone },
            native && { label: t('phoneContacts.app.menuMove'), icon: 'upload', onSelect: onMovePhone },
            native && { label: t('phoneContacts.app.menuSync'), icon: 'phone', onSelect: onSyncPhone },
            { label: t('phoneContacts.app.menuVcard'), icon: 'upload', onSelect: () => file.current?.click() },
            { label: shown.length === contacts.length ? t('phoneContacts.app.saveAllVcard') : t('phoneContacts.app.saveShownVcard', { count: shown.length }), icon: 'download', onSelect: exportCards },
            { label: t('phoneContacts.app.menuJson'), icon: 'braces', onSelect: onJson }
          ]} />
        </>
      )} />
      <input ref={file} type="file" accept=".vcf,text/vcard,text/x-vcard" hidden onChange={pick} />

      {busy !== null && <p className="wk-working" aria-live="polite">{busy}</p>}

      {native && status !== null && (
        <section className="ph-setup" aria-label={t('phoneContacts.app.inPhoneTitle')}>
          <p>
            {status.contacts
              ? rich(status.contactsSyncedAt !== null
                ? t('phoneContacts.app.inPhoneSynced', { count: status.written, when: shortWhen(status.contactsSyncedAt) })
                : t('phoneContacts.app.inPhoneNow', { count: status.written }), { b: (s) => <strong>{s}</strong> })
              : t('phoneContacts.app.noAccess')}
          </p>
          <div className="wk-actions">
            {contacts.length === 0 && <button type="button" className="wk-btn" disabled={busy !== null} onClick={onImportPhone}>{t('phoneContacts.app.importPhoneBtn')}</button>}
            <button type="button" className="wk-btn wk-btn-quiet" disabled={busy !== null} onClick={onMovePhone}>{t('phoneContacts.app.moveBtn')}</button>
            <button type="button" className="wk-btn wk-btn-quiet" disabled={busy !== null} onClick={onSyncPhone}>{t('phoneContacts.app.syncBtn')}</button>
          </div>
        </section>
      )}

      <div className="ph-search">
        <input type="search" value={query} placeholder={t('phoneContacts.app.searchPh')} aria-label={t('phoneContacts.app.search')} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {groups.length > 0 && (
        <div className="ph-groups" role="group" aria-label={t('phoneContacts.app.groups')}>
          <button type="button" className="ui-filter" aria-pressed={group === null} onClick={() => setGroup(null)}>{t('phoneContacts.app.everyone')}</button>
          {groups.map((g) => (
            <button key={g} type="button" className="ui-filter" aria-pressed={group === g} onClick={() => setGroup(group === g ? null : g)}>{g}</button>
          ))}
        </div>
      )}
      {group !== null && native && lines.length > 1 && (
        <label className="wk-field ph-group-line">
          <span>{t('phoneContacts.app.groupLine', { group })}</span>
          <select value={findLine(lines, groupRules[group]) === null ? '' : groupRules[group]} onChange={(e) => setGroupRule(group, e.target.value === '' ? null : e.target.value)}>
            <option value="">{t('phoneLines.defaultNumber')}</option>
            {lines.map((l) => <option key={l.subId} value={lineKeyOf(l)}>{lineText(l)}</option>)}
          </select>
        </label>
      )}

      {shown.length === 0
        ? <p className="wk-empty">{contacts.length === 0 ? (native ? t('phoneContacts.app.emptyNative') : t('phoneContacts.app.empty')) : t('phoneContacts.app.noMatch')}</p>
        : (
          <ul className="ph-list">
            {shown.map((c) => (
              <li key={c.id}>
                <a className="ph-row" href={viewPath('contacts', c.id)}>
                  <Avatar name={c.name} seed={c.id} />
                  <span className="ph-row-text">
                    <span className="ph-row-name">{c.name}</span>
                    <span className="ph-row-snippet">{[c.phones[0]?.number, c.org, ...c.groups].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="ph-row-end"><Icon name="next" /></span>
                </a>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}

/* -- Ein Kontakt --------------------------------------------------------------------------- */

function ContactEdit({ ctx, contact, native, onSaved, onRemoved }: {
  ctx: PhoneCtx;
  contact: Contact | null;
  native: boolean;
  onSaved: (c: Contact) => void;
  onRemoved: (id: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<ContactData>(() => {
    if (contact !== null) return contact;
    const number = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('numer');
    const fresh = emptyContact();
    return number === null ? fresh : { ...fresh, phones: [{ number, label: PHONE_LABELS[0] }] };
  });
  const [groupsText, setGroupsText] = useState((contact?.groups ?? []).join(', '));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  useCrumbs([{ label: contact?.name ?? t('phoneContacts.edit.new'), href: null }]);

  const set = (patch: Partial<ContactData>) => setDraft((d) => ({ ...d, ...patch }));
  const setPhone = (i: number, patch: Partial<ContactData['phones'][number]>) =>
    set({ phones: draft.phones.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setEmail = (i: number, patch: Partial<ContactData['emails'][number]>) =>
    set({ emails: draft.emails.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  const save = async () => {
    if (draft.name.trim() === '' && draft.phones.every((p) => p.number.trim() === '')) { setFailed(t('phoneContacts.edit.needName')); return; }
    setBusy(true);
    setFailed(null);
    try {
      const groups = groupsText.split(',').map((g) => g.trim()).filter(Boolean);
      onSaved(await saveContact(ctx, contact?.id ?? null, { ...draft, groups }, contact?.version ?? 0));
    } catch (e) {
      setFailed(saveProblem(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (contact === null) return;
    if (!await ask({ title: t('phoneContacts.edit.removeAsk', { name: contact.name }), body: native ? t('phoneContacts.edit.removeBody') : undefined, confirm: t('common.delete'), danger: true })) return;
    setBusy(true);
    try {
      await removeContact(ctx, contact.id);
      onRemoved(contact.id);
    } catch (e) {
      setFailed(saveProblem(e));
      setBusy(false);
    }
  };

  const sms = (number: string) => native ? `${viewPath('sms', 'nowa')}?do=${encodeURIComponent(number)}` : `sms:${number.replace(/\s+/g, '')}`;

  return (
    <form className="ph-contact-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <PageHeader title={contact === null ? t('phoneContacts.edit.new') : contact.name} meta={contact === null ? undefined : t('phoneContacts.edit.changed', { when: shortWhen(Date.parse(contact.updatedAt)) })} />

      {contact !== null && contact.phones.length > 0 && (
        <div className="ph-numbers" aria-label={t('phoneContacts.edit.numbers')}>
          {contact.phones.map((p) => (
            <div key={p.number} className="ph-number">
              <strong>{p.number}</strong>
              {p.label !== null && <span className="ph-number-label">{phoneLabelText(p.label)}</span>}
              <a className="wk-btn wk-btn-quiet" href={`tel:${p.number.replace(/\s+/g, '')}`}><Icon name="phone" />{t('phoneContacts.edit.call')}</a>
              <a className="wk-btn wk-btn-quiet" href={sms(p.number)}><Icon name="chat" />{t('phoneSms.compose.sms')}</a>
            </div>
          ))}
        </div>
      )}

      <label className="wk-field">
        <span>{t('phoneContacts.edit.name')}</span>
        <input value={draft.name} autoComplete="off" onChange={(e) => set({ name: e.target.value })} placeholder={t('phoneContacts.edit.namePh')} />
      </label>
      <div className="ph-pair">
        <label className="wk-field"><span>{t('phoneContacts.edit.given')}</span><input value={draft.given ?? ''} onChange={(e) => set({ given: e.target.value })} /></label>
        <label className="wk-field"><span>{t('phoneContacts.edit.family')}</span><input value={draft.family ?? ''} onChange={(e) => set({ family: e.target.value })} /></label>
      </div>

      <fieldset className="wk-field">
        <legend>{t('phoneContacts.edit.phones')}</legend>
        <div className="ph-lines">
          {draft.phones.map((p, i) => (
            <div key={i} className="ph-line">
              <input value={p.number} inputMode="tel" aria-label={t('phoneContacts.edit.number')} placeholder="600 100 200" onChange={(e) => setPhone(i, { number: e.target.value })}
                onBlur={() => setPhone(i, { number: phoneShown(p.number) })} />
              <select value={p.label ?? ''} aria-label={t('phoneContacts.edit.numberKind')} onChange={(e) => setPhone(i, { label: e.target.value === '' ? null : e.target.value })}>
                <option value="">—</option>
                {PHONE_LABELS.map((l) => <option key={l} value={l}>{phoneLabelText(l)}</option>)}
                {p.label !== null && !(PHONE_LABELS as readonly string[]).includes(p.label) && <option value={p.label}>{p.label}</option>}
              </select>
              <span className="ph-line-tools">
                <button type="button" className="wk-link-btn" aria-label={t('phoneContacts.edit.removeNumber')} onClick={() => set({ phones: draft.phones.filter((_, j) => j !== i) })}>×</button>
              </span>
            </div>
          ))}
        </div>
        <button type="button" className="wk-link-btn" onClick={() => set({ phones: [...draft.phones, { number: '', label: PHONE_LABELS[0] }] })}>{t('phoneContacts.edit.addNumber')}</button>
      </fieldset>

      <fieldset className="wk-field">
        <legend>{t('phoneContacts.edit.email')}</legend>
        <div className="ph-lines">
          {draft.emails.map((m, i) => (
            <div key={i} className="ph-line">
              <input value={m.address} inputMode="email" aria-label={t('phoneContacts.edit.emailAddress')} onChange={(e) => setEmail(i, { address: e.target.value })} />
              <select value={m.label ?? ''} aria-label={t('phoneContacts.edit.emailKind')} onChange={(e) => setEmail(i, { label: e.target.value === '' ? null : e.target.value })}>
                <option value="">—</option>
                <option value={PHONE_LABELS[1]}>{phoneLabelText(PHONE_LABELS[1])}</option>
                <option value={PHONE_LABELS[2]}>{phoneLabelText(PHONE_LABELS[2])}</option>
              </select>
              <span className="ph-line-tools">
                <button type="button" className="wk-link-btn" aria-label={t('phoneContacts.edit.removeEmail')} onClick={() => set({ emails: draft.emails.filter((_, j) => j !== i) })}>×</button>
              </span>
            </div>
          ))}
        </div>
        <button type="button" className="wk-link-btn" onClick={() => set({ emails: [...draft.emails, { address: '', label: null }] })}>{t('phoneContacts.edit.addEmail')}</button>
      </fieldset>

      <div className="ph-pair">
        <label className="wk-field"><span>{t('phoneContacts.edit.org')}</span><input value={draft.org ?? ''} onChange={(e) => set({ org: e.target.value })} placeholder={t('phoneContacts.edit.orgPh')} /></label>
        <label className="wk-field"><span>{t('phoneContacts.edit.title')}</span><input value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder={t('phoneContacts.edit.titlePh')} /></label>
      </div>
      <div className="ph-pair">
        <label className="wk-field"><span>{t('phoneContacts.edit.groups')}</span><input value={groupsText} onChange={(e) => setGroupsText(e.target.value)} placeholder={t('phoneContacts.edit.groupsPh')} /></label>
        <label className="wk-field"><span>{t('phoneContacts.edit.birthday')}</span><input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(draft.birthday ?? '') ? draft.birthday! : ''} onChange={(e) => set({ birthday: e.target.value === '' ? null : e.target.value })} /></label>
      </div>
      <label className="wk-field">
        <span>{t('phoneContacts.edit.note')}</span>
        <textarea rows={3} value={draft.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
      </label>

      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
        <a className="wk-btn wk-btn-quiet" href={viewPath('contacts')}>{t('common.cancel')}</a>
        {contact !== null && <button type="button" className="wk-btn wk-btn-quiet wk-danger-link" disabled={busy} onClick={() => void remove()}>{t('common.delete')}</button>}
      </div>
    </form>
  );
}
