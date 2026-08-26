import { useId, useState } from 'react';
import { asRecord, asText, definePart, mapEntries } from './contracts';
import { AreaRow, ListEditor, TextRow } from './editorKit';

type FaqItem = { question: string; answer: string };

type FaqConfig = { items: FaqItem[] };

/** Questions people actually ask, collapsed until opened. */
export const faqPart = definePart<FaqConfig>({
  kind: 'faq',
  label: 'FAQ',
  description: 'Pytania i odpowiedzi do rozwinięcia.',

  defaultConfig: () => ({ items: [{ question: 'Pierwsze pytanie?', answer: 'Odpowiedź.' }] }),

  parse: (raw) => ({
    items: mapEntries<FaqItem>(asRecord(raw).items, (item) => {
      const question = asText(item.question).trim();
      const answer = asText(item.answer).trim();
      // A question just added is empty on both sides; dropping it here made the
      // "add" button do nothing at all, since the config is re-parsed between
      // the click and the next render. The reader is protected below instead.
      if (question.length === 0 && answer.length === 0) return null;
      return { question, answer };
    })
  }),

  // A question still being written has nothing to ask the reader.
  Renderer: ({ config }) => <FaqList items={config.items.filter((item) => item.question.length > 0)} />,

  Editor: ({ config, onChange }) => (
    <ListEditor<FaqItem>
      legend="Pytania"
      items={config.items}
      addLabel="Dodaj pytanie"
      blank={() => ({ question: '', answer: '' })}
      titleOf={(item, index) => item.question || `Pytanie ${index + 1}`}
      onChange={(items) => onChange({ items })}
      renderItem={(item, update) => (
        <>
          <TextRow label="Pytanie" value={item.question} onChange={(question) => update({ ...item, question })} />
          <AreaRow label="Odpowiedź" rows={3} value={item.answer} onChange={(answer) => update({ ...item, answer })} />
        </>
      )}
    />
  )
});

/**
 * A button and a panel rather than <details>, because <details> cannot be
 * animated: the browser hides its children outright when closed, so there is no
 * height to transition from. The panel is a grid row instead — 0fr to 1fr —
 * which eases between "nothing" and "however tall the answer happens to be"
 * without anyone having to measure it.
 */
function FaqList({ items }: { items: FaqItem[] }) {
  const domId = useId();
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());

  if (items.length === 0) {
    return <p className="ev-note">Brak pytań w tej sekcji.</p>;
  }

  const toggle = (index: number) =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  return (
    <div className="ev-faq">
      {items.map((item, index) => {
        const isOpen = open.has(index);
        const panelId = `${domId}-faq-${index}`;

        return (
          <div className={`ev-faq-item ${isOpen ? 'is-open' : ''}`} key={index}>
            <button
              type="button"
              className="ev-faq-question"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(index)}
            >
              <span>{item.question}</span>
              <span className="ev-faq-mark" aria-hidden="true" />
            </button>

            <div className="ev-faq-panel" id={panelId} role="region">
              <div className="ev-faq-panel-inner">
                <p>{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
