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
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { useCrumbs } from '../shell/crumbTrail';
import { viewPath } from '../routes';
import { saveBlob } from '../core/platform';
import { WorkspaceError, type Who } from '../core/session';
import { ask, toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { MenuButton } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';
import {
  contactMatches, emptyContact, fromCard, fromPhoneBook, importContacts, loadContacts, PHONE_LABELS, phoneKeysOf, removeContact,
  saveContact, saveProblem, type Contact, type ContactData
} from './contactStore';
import { Phone, phoneHere, pluginSource, type PhoneStatus } from './native';
import { phoneShown } from './numbers';
import { contactsNow } from './phoneJobs';
import { openPhone, type PhoneCtx } from './phoneContext';
import { Avatar, shortWhen } from './smsShared';
import { formatVCards, parseVCards } from './vcard';
import './phone.css';

export function ContactsApp({ who, trail }: { who: Who; trail: readonly string[] }) {
  const native = phoneHere();
  const [ctx, setCtx] = useState<PhoneCtx | null>(null);
  const [contacts, setContacts] = useState<readonly Contact[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<PhoneStatus | null>(null);

  const reload = useCallback(async (opened: PhoneCtx) => {
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
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać kontaktów.');
      }
    })();
    return () => { alive = false; };
  }, [who, reload]);

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
  if (ctx === null || contacts === null) return <Loading label="Wczytywanie kontaktów…" />;

  if (step !== undefined) {
    const had = step === 'nowy' ? null : contacts.find((c) => c.id === step) ?? null;
    if (step !== 'nowy' && had === null) return <p className="wk-empty">Takiego kontaktu nie ma.</p>;
    return (
      <ContactEdit ctx={ctx} contact={had} native={native}
        onSaved={(saved) => {
          setContacts((list) => [...(list ?? []).filter((c) => c.id !== saved.id), saved]);
          toPhoneSoon(ctx);
          window.location.hash = viewPath('contacts');
        }}
        onRemoved={(id) => {
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
      toast(e instanceof WorkspaceError || e instanceof Error ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  const importPhone = () => work('Wczytywanie kontaktów z telefonu…', async () => {
    const granted = (await Phone.requestContacts()).granted;
    if (!granted) return 'Bez dostępu do kontaktów telefonu nie da się ich wczytać.';
    const { contacts: book } = await Phone.contacts();
    const result = await importContacts(ctx, book.map(fromPhoneBook), contacts, (done, total) => setBusy(`Zapisywanie kontaktów… ${done}/${total}`));
    await reload(ctx);
    toPhoneSoon(ctx);
    return `Z telefonu: nowych ${result.added}, uzupełnionych ${result.updated}, bez zmian ${result.unchanged}${result.failed > 0 ? `, nie udało się ${result.failed}` : ''}.`;
  });

  const syncPhone = () => work('Zapisywanie kontaktów w telefonie…', async () => {
    const granted = (await Phone.requestContacts()).granted;
    if (!granted) return 'Bez dostępu do kontaktów telefon nie dostanie kontaktów z recreatio.';
    const result = await contactsNow(ctx, pluginSource, true);
    refreshStatus();
    return `W telefonie: ${result.total} (nowych ${result.added}, zmienionych ${result.updated}, usuniętych ${result.removed}).`;
  });

  /*
   * PRZENIEŚ: einlesen wie oben, ins Telefon schreiben — und dann die Originale entfernen, die NUR im Gerät
   * stehen (ohne Konto). Danach gibt es jeden Menschen einmal, und beim Anruf steht der Name aus recreatio.
   * Ging beim Einlesen etwas schief, wird nichts entfernt.
   */
  const movePhone = async () => {
    const yes = await ask({
      title: 'Przenieść kontakty telefonu do recreatio?',
      body: 'Kontakty zapisane tylko w pamięci telefonu trafią do recreatio, a z pamięci telefonu zostaną usunięte. Telefon zachowa ich kopię z recreatio — przy połączeniu i w SMS nadal zobaczysz imię, a zmiany wprowadzasz tutaj. Kontakty z innych kont (DAVx5, Signal, karta SIM) zostają bez zmian.',
      confirm: 'Przenieś'
    });
    if (!yes) return;
    await work('Przenoszenie kontaktów z telefonu…', async () => {
      if (!(await Phone.requestContacts()).granted) return 'Bez dostępu do kontaktów telefonu nie da się ich przenieść.';
      const { contacts: book } = await Phone.contacts();
      const result = await importContacts(ctx, book.map(fromPhoneBook), contacts, (done, total) => setBusy(`Zapisywanie kontaktów… ${done}/${total}`));
      if (result.failed > 0) return `Nie udało się zapisać ${result.failed} kontaktów — z telefonu nic nie usunięto.`;
      const fresh = await loadContacts(ctx);
      setContacts(fresh);
      setBusy('Zapisywanie kontaktów w telefonie…');
      await contactsNow(ctx, pluginSource, true);
      const { removed } = await Phone.dropLocal({ keys: phoneKeysOf(fresh) });
      refreshStatus();
      return `Przeniesiono: nowych ${result.added}, uzupełnionych ${result.updated}; z pamięci telefonu usunięto ${removed}.`;
    });
  };

  return (
    <ContactList contacts={contacts} native={native} status={status} busy={busy}
      onImportPhone={() => void importPhone()}
      onMovePhone={() => void movePhone()}
      onSyncPhone={() => void syncPhone()}
      onImportCards={(text) => void work('Wczytywanie vCard…', async () => {
        const cards = parseVCards(text);
        if (cards.length === 0) return 'W pliku nie ma żadnego kontaktu (vCard).';
        const result = await importContacts(ctx, cards.map(fromCard), contacts, (done, total) => setBusy(`Zapisywanie kontaktów… ${done}/${total}`));
        await reload(ctx);
        toPhoneSoon(ctx);
        return `Z pliku: nowych ${result.added}, uzupełnionych ${result.updated}, bez zmian ${result.unchanged}.`;
      })}
    />
  );
}

export default ContactsApp;

/* -- Die Liste ------------------------------------------------------------------------------- */

function ContactList({ contacts, native, status, busy, onImportPhone, onMovePhone, onSyncPhone, onImportCards }: {
  contacts: readonly Contact[];
  native: boolean;
  status: PhoneStatus | null;
  busy: string | null;
  onImportPhone: () => void;
  onMovePhone: () => void;
  onSyncPhone: () => void;
  onImportCards: (text: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const file = useRef<HTMLInputElement | null>(null);
  useCrumbs([]);

  const groups = useMemo(() => [...new Set(contacts.flatMap((c) => c.groups))].sort((a, b) => a.localeCompare(b, 'pl')), [contacts]);
  const shown = contacts.filter((c) => (group === null || c.groups.includes(group)) && contactMatches(c, query));

  /* `saveBlob`: im Browser ein Download, in der App der Dokumentenwähler — ein <a download> täte dort nichts. */
  const exportCards = () => {
    void saveBlob(new Blob([formatVCards(shown)], { type: 'text/vcard' }), `kontakty-${new Date().toISOString().slice(0, 10)}.vcf`)
      .catch(() => toast('Nie udało się zapisać pliku.'));
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const one = e.target.files?.[0];
    e.target.value = '';
    if (one === undefined) return;
    void one.text().then(onImportCards);
  };

  return (
    <>
      <PageHeader title="Kontakty" meta={`${contacts.length} kontaktów`} actions={(
        <>
          <a className="wk-btn" href={viewPath('contacts', 'nowy')}><Icon name="plus" />Kontakt</a>
          <MenuButton label="Więcej: Kontakty" items={[
            native && { label: 'Wczytaj z telefonu', icon: 'download', onSelect: onImportPhone },
            native && { label: 'Przenieś z telefonu do recreatio…', icon: 'upload', onSelect: onMovePhone },
            native && { label: 'Zapisz w telefonie teraz', icon: 'phone', onSelect: onSyncPhone },
            { label: 'Wczytaj vCard (.vcf)', icon: 'upload', onSelect: () => file.current?.click() },
            { label: shown.length === contacts.length ? 'Zapisz wszystkie jako vCard' : `Zapisz widoczne (${shown.length}) jako vCard`, icon: 'download', onSelect: exportCards }
          ]} />
        </>
      )} />
      <input ref={file} type="file" accept=".vcf,text/vcard,text/x-vcard" hidden onChange={pick} />

      {busy !== null && <p className="wk-working" aria-live="polite">{busy}</p>}

      {native && status !== null && (
        <section className="ph-setup" aria-label="Kontakty w telefonie">
          <p>
            {status.contacts
              ? <>W telefonie: <strong>{status.written}</strong> kontaktów z recreatio{status.contactsSyncedAt !== null ? `, zaktualizowane ${shortWhen(status.contactsSyncedAt)}` : ''}. Przy połączeniu i w SMS telefon pokazuje ich imiona bez pytania serwera.</>
              : 'Aplikacja nie ma jeszcze dostępu do kontaktów telefonu.'}
          </p>
          <div className="wk-actions">
            {contacts.length === 0 && <button type="button" className="wk-btn" disabled={busy !== null} onClick={onImportPhone}>Wczytaj kontakty z telefonu</button>}
            <button type="button" className="wk-btn wk-btn-quiet" disabled={busy !== null} onClick={onMovePhone}>Przenieś z telefonu…</button>
            <button type="button" className="wk-btn wk-btn-quiet" disabled={busy !== null} onClick={onSyncPhone}>Aktualizuj w telefonie</button>
          </div>
        </section>
      )}

      <div className="ph-search">
        <input type="search" value={query} placeholder="Szukaj: imię, numer, grupa…" aria-label="Szukaj kontaktu" onChange={(e) => setQuery(e.target.value)} />
      </div>
      {groups.length > 0 && (
        <div className="ph-groups" role="group" aria-label="Grupy">
          <button type="button" className="ui-filter" aria-pressed={group === null} onClick={() => setGroup(null)}>Wszyscy</button>
          {groups.map((g) => (
            <button key={g} type="button" className="ui-filter" aria-pressed={group === g} onClick={() => setGroup(group === g ? null : g)}>{g}</button>
          ))}
        </div>
      )}

      {shown.length === 0
        ? <p className="wk-empty">{contacts.length === 0 ? (native ? 'Nie ma jeszcze kontaktów — wczytaj je z telefonu albo z pliku vCard.' : 'Nie ma jeszcze kontaktów — dodaj je albo wczytaj plik vCard.') : 'Nic nie pasuje.'}</p>
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
  const [draft, setDraft] = useState<ContactData>(() => {
    if (contact !== null) return contact;
    const number = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('numer');
    const fresh = emptyContact();
    return number === null ? fresh : { ...fresh, phones: [{ number, label: 'komórka' }] };
  });
  const [groupsText, setGroupsText] = useState((contact?.groups ?? []).join(', '));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  useCrumbs([{ label: contact?.name ?? 'Nowy kontakt', href: null }]);

  const set = (patch: Partial<ContactData>) => setDraft((d) => ({ ...d, ...patch }));
  const setPhone = (i: number, patch: Partial<ContactData['phones'][number]>) =>
    set({ phones: draft.phones.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setEmail = (i: number, patch: Partial<ContactData['emails'][number]>) =>
    set({ emails: draft.emails.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  const save = async () => {
    if (draft.name.trim() === '' && draft.phones.every((p) => p.number.trim() === '')) { setFailed('Podaj imię albo numer.'); return; }
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
    if (!await ask({ title: `Usunąć kontakt „${contact.name}"?`, body: native ? 'Zniknie też z kontaktów telefonu (z konta REcreatio).' : undefined, confirm: 'Usuń', danger: true })) return;
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
      <PageHeader title={contact === null ? 'Nowy kontakt' : contact.name} meta={contact === null ? undefined : `Zmieniony ${shortWhen(Date.parse(contact.updatedAt))}`} />

      {contact !== null && contact.phones.length > 0 && (
        <div className="ph-numbers" aria-label="Numery">
          {contact.phones.map((p) => (
            <div key={p.number} className="ph-number">
              <strong>{p.number}</strong>
              {p.label !== null && <span className="ph-number-label">{p.label}</span>}
              <a className="wk-btn wk-btn-quiet" href={`tel:${p.number.replace(/\s+/g, '')}`}><Icon name="phone" />Zadzwoń</a>
              <a className="wk-btn wk-btn-quiet" href={sms(p.number)}><Icon name="chat" />SMS</a>
            </div>
          ))}
        </div>
      )}

      <label className="wk-field">
        <span>Nazwa (tak widać ją przy połączeniu)</span>
        <input value={draft.name} autoComplete="off" onChange={(e) => set({ name: e.target.value })} placeholder="np. Anna Nowak" />
      </label>
      <div className="ph-pair">
        <label className="wk-field"><span>Imię</span><input value={draft.given ?? ''} onChange={(e) => set({ given: e.target.value })} /></label>
        <label className="wk-field"><span>Nazwisko</span><input value={draft.family ?? ''} onChange={(e) => set({ family: e.target.value })} /></label>
      </div>

      <fieldset className="wk-field">
        <legend>Telefony</legend>
        <div className="ph-lines">
          {draft.phones.map((p, i) => (
            <div key={i} className="ph-line">
              <input value={p.number} inputMode="tel" aria-label="Numer" placeholder="600 100 200" onChange={(e) => setPhone(i, { number: e.target.value })}
                onBlur={() => setPhone(i, { number: phoneShown(p.number) })} />
              <select value={p.label ?? ''} aria-label="Rodzaj numeru" onChange={(e) => setPhone(i, { label: e.target.value === '' ? null : e.target.value })}>
                <option value="">—</option>
                {PHONE_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                {p.label !== null && !(PHONE_LABELS as readonly string[]).includes(p.label) && <option value={p.label}>{p.label}</option>}
              </select>
              <span className="ph-line-tools">
                <button type="button" className="wk-link-btn" aria-label="Usuń numer" onClick={() => set({ phones: draft.phones.filter((_, j) => j !== i) })}>×</button>
              </span>
            </div>
          ))}
        </div>
        <button type="button" className="wk-link-btn" onClick={() => set({ phones: [...draft.phones, { number: '', label: 'komórka' }] })}>+ numer</button>
      </fieldset>

      <fieldset className="wk-field">
        <legend>E-mail</legend>
        <div className="ph-lines">
          {draft.emails.map((m, i) => (
            <div key={i} className="ph-line">
              <input value={m.address} inputMode="email" aria-label="Adres e-mail" onChange={(e) => setEmail(i, { address: e.target.value })} />
              <select value={m.label ?? ''} aria-label="Rodzaj adresu" onChange={(e) => setEmail(i, { label: e.target.value === '' ? null : e.target.value })}>
                <option value="">—</option>
                <option value="dom">dom</option>
                <option value="praca">praca</option>
              </select>
              <span className="ph-line-tools">
                <button type="button" className="wk-link-btn" aria-label="Usuń adres" onClick={() => set({ emails: draft.emails.filter((_, j) => j !== i) })}>×</button>
              </span>
            </div>
          ))}
        </div>
        <button type="button" className="wk-link-btn" onClick={() => set({ emails: [...draft.emails, { address: '', label: null }] })}>+ e-mail</button>
      </fieldset>

      <div className="ph-pair">
        <label className="wk-field"><span>Organizacja</span><input value={draft.org ?? ''} onChange={(e) => set({ org: e.target.value })} placeholder="np. Parafia Grzegórzki" /></label>
        <label className="wk-field"><span>Funkcja</span><input value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="np. kandydat, rodzic" /></label>
      </div>
      <div className="ph-pair">
        <label className="wk-field"><span>Grupy (po przecinku)</span><input value={groupsText} onChange={(e) => setGroupsText(e.target.value)} placeholder="np. Rodzina, Bierzmowanie 2026" /></label>
        <label className="wk-field"><span>Urodziny</span><input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(draft.birthday ?? '') ? draft.birthday! : ''} onChange={(e) => set({ birthday: e.target.value === '' ? null : e.target.value })} /></label>
      </div>
      <label className="wk-field">
        <span>Notatka</span>
        <textarea rows={3} value={draft.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
      </label>

      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>
        <a className="wk-btn wk-btn-quiet" href={viewPath('contacts')}>Anuluj</a>
        {contact !== null && <button type="button" className="wk-btn wk-btn-quiet wk-danger-link" disabled={busy} onClick={() => void remove()}>Usuń</button>}
      </div>
    </form>
  );
}
