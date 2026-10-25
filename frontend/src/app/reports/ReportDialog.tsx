/**
 * 0130 — ZGŁOŚ an Ort und Stelle, mit dem, was der Meldende gerade sieht (eine
 * Nachricht in einer Rozmowa): der Betreiber hat zu ihr keinen Schlüssel, er bekommt
 * nur, was der Meldende mitschickt.
 */

import { Modal } from '../ui/Modal';
import { ReportForm, type ReportWhat } from './ReportForm';

export function ReportDialog({ what, onClose }: { what: ReportWhat; onClose: () => void }) {
  return (
    <Modal title="Zgłoś treść" onClose={onClose}>
      <ReportForm what={what} onDone={onClose} />
    </Modal>
  );
}

export default ReportDialog;
