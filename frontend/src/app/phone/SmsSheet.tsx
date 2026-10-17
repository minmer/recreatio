/**
 * „NAPISZ SMS" AUS EINER ANSICHT (Ausgabe „sms") — wo sonst `sms:` das Fenster
 * einer anderen App öffnete (Formularze → Osoby → „Wyślij SMS"): ein Blatt über
 * der Seite, das gleich sendet. Die Seite darunter bleibt, wie sie war — wer
 * zehn Menschen nacheinander schreibt, verliert seinen Platz nicht.
 *
 * Eine eigene Wurzel (`createRoot`): aufgerufen wird es aus einem Klick, nicht
 * aus einer Zeichnung, und es gehört zu keiner Ansicht.
 */

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { viewPath } from '../routes';
import { toast } from '../ui/dialogs';
import { Modal } from '../ui/Modal';
import { Composer } from './Composer';
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
  useEffect(() => {
    let alive = true;
    void Phone.status().then((s) => { if (alive) setStatus(s); }).catch(() => undefined);
    void Phone.lookup({ numbers: [to] }).then((r) => { if (alive) setName(r.names[to] ?? null); }).catch(() => undefined);
    return () => { alive = false; };
  }, [to]);

  const off = status !== null && !status.defaultSms;
  return (
    <Modal title={name === null ? `SMS do ${phoneShown(to)}` : `SMS do: ${name} (${phoneShown(to)})`} onClose={() => onDone(false)}>
      {off && (
        <p className="ph-setup">
          Ta aplikacja nie jest jeszcze aplikacją SMS telefonu — ustaw ją w <a href={viewPath('sms')} onClick={() => onDone(false)}>SMS</a>.
        </p>
      )}
      <div className="ph-sheet">
        <Composer to={[to]} sims={status?.sims ?? []} defaultSub={status?.defaultSubId ?? null} media={false}
          disabled={off} initial={text}
          onSent={() => { toast(`Wysłano SMS do: ${name ?? phoneShown(to)}.`); onDone(true); }} />
      </div>
    </Modal>
  );
}
