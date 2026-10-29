/**
 * „NAPISZ SMS" AUS EINER ANSICHT (Ausgabe „sms") — wo sonst `sms:` das Fenster
 * einer anderen App öffnete (Formularze → Osoby → „Wyślij SMS"): ein Blatt über
 * der Seite, das gleich sendet. Die Seite darunter bleibt, wie sie war — wer
 * zehn Menschen nacheinander schreibt, verliert seinen Platz nicht.
 *
 * Eine eigene Wurzel (`createRoot`): aufgerufen wird es aus einem Klick, nicht
 * aus einer Zeichnung, und es gehört zu keiner Ansicht.
 */

import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { Icon } from '../chat/ChatKit';
import { whoIsThere } from '../core/session';
import { viewPath } from '../routes';
import { toast } from '../ui/dialogs';
import { Modal } from '../ui/Modal';
import { Composer } from './Composer';
import { nameIndex, type Contact } from './contactStore';
import { chooseLine, contactsOf, lastSubOf, lineText, useLineRules, usePhoneLines, whyIcon, whyText } from './lines';
import { Phone, type PhoneStatus } from './native';
import { phoneShown } from './numbers';
import './phone.css';

/** Zeigt das Blatt; `true`, wenn gesendet wurde. */
export function showSmsSheet(to: string, text: string): Promise<boolean> {
  const node = document.createElement('div');
  document.body.appendChild(node);
  const root = createRoot(node);
  return new Promise((resolve) => {
    const done = (sent: boolean) => {
      root.unmount();
      node.remove();
      resolve(sent);
    };
    root.render(<SmsSheet to={to} text={text} onDone={done} />);
  });
}

function SmsSheet({ to, text, onDone }: { to: string; text: string; onDone: (sent: boolean) => void }) {
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [name, setName] = useState<string | null>(null);
  const lines = usePhoneLines();
  const { groupRules, threadRules } = useLineRules();
  const [contacts, setContacts] = useState<ReadonlyMap<string, Contact>>(new Map());
  const [lastSub, setLastSub] = useState<number | null>(null);
  /** Eine andere Karte — nur für diese Nachricht. */
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    void Phone.status().then((s) => { if (alive) setStatus(s); }).catch(() => undefined);
    void Phone.lookup({ numbers: [to] }).then((r) => { if (alive) setName(r.names[to] ?? null); }).catch(() => undefined);
    return () => { alive = false; };
  }, [to]);

  /* Mit zwei Karten dieselbe Folge wie im Gespräch: gewählt, die Gruppe, wo zuletzt etwas kam, die des Telefons. */
  const twoLines = lines.length > 1;
  useEffect(() => {
    if (!twoLines) return undefined;
    let alive = true;
    void whoIsThere().then((who) => (who === null ? [] : contactsOf(who)))
      .then((list) => { if (alive) setContacts(nameIndex(list)); })
      .catch(() => undefined);
    void lastSubOf(to).then((s) => { if (alive) setLastSub(s); }).catch(() => undefined);
    return () => { alive = false; };
  }, [to, twoLines]);
  const choice = useMemo(() => chooseLine({ peers: [to], lines, contacts, groupRules, threadRules, lastSub, defaultSub: status?.defaultSubId ?? null }),
    [to, lines, contacts, groupRules, threadRules, lastSub, status]);
  const sub = picked ?? choice.line?.subId ?? status?.defaultSubId ?? null;

  const off = status !== null && !status.defaultSms;
  return (
    <Modal title={name === null ? `SMS do ${phoneShown(to)}` : `SMS do: ${name} (${phoneShown(to)})`} onClose={() => onDone(false)}>
      {off && (
        <p className="ph-setup">
          Ta aplikacja nie jest jeszcze aplikacją SMS telefonu — ustaw ją w <a href={viewPath('sms')} onClick={() => onDone(false)}>SMS</a>.
        </p>
      )}
      {twoLines && (
        <label className="wk-field">
          <span className="ph-why" data-why={picked === null ? choice.why : 'thread'}>
            <Icon name={picked === null ? whyIcon(choice.why) : 'pin'} />Z numeru{picked === null ? ` — ${whyText(choice)}` : ' — tylko ta wiadomość'}
          </span>
          <select value={sub === null ? '' : String(sub)} onChange={(e) => setPicked(Number(e.target.value))}>
            {lines.map((l) => <option key={l.subId} value={l.subId}>{lineText(l)}</option>)}
          </select>
        </label>
      )}
      <div className="ph-sheet">
        <Composer to={[to]} sims={status?.sims ?? []} sub={sub} media={false}
          disabled={off} initial={text}
          onSent={() => { toast(`Wysłano SMS do: ${name ?? phoneShown(to)}.`); onDone(true); }} />
      </div>
    </Modal>
  );
}
