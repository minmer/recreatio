/**
 * PYTANIA — FAQ, zugeklappt, bis man eines öffnet (Altbestand: `FaqPart`).
 *
 * Ein Knopf und ein Feld statt `<details>`: das Feld ist eine Zeile eines
 * Rasters (0fr → 1fr) und gleitet auf, ohne dass jemand eine Höhe misst.
 *
 * <b>Je Grösse:</b> im Streifen klappt er auf; als Block und hoch alle
 * Fragen, jede für sich zu öffnen; im Vollbild alle offen.
 */

import { useId, useState } from 'react';

import { AreaRow, asRecord, asText, defineEventPart, ListEditor, mapEntries, TextRow } from '../event/kit';

type FaqItem = { question: string; answer: string };
type FaqConfig = { items: FaqItem[] };

function FaqList({ items, allOpen }: { items: FaqItem[]; allOpen: boolean }) {
  const domId = useId();
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());

  const toggle = (index: number) => setOpen((previous) => {
    const next = new Set(previous);
    if (!next.delete(index)) next.add(index);
    return next;
  });

  return (
    <div className="ev-faq">
      {items.map((item, index) => {
        const isOpen = allOpen || open.has(index);
        const panelId = `${domId}-faq-${index}`;
        return (
          <div className={`ev-faq-item${isOpen ? ' is-open' : ''}`} key={index}>
            <button type="button" className="ev-faq-question" aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(index)}>
              <span>{item.question}</span>
              <span className="ev-faq-mark" aria-hidden="true" />
            </button>
            <div className="ev-faq-panel" id={panelId} role="region">
              <div className="ev-faq-panel-inner"><p>{item.answer}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const faqPart = defineEventPart<FaqConfig>({
  kind: 'faq',
  label: 'Pytania (FAQ)',
  use: 'Pytania i odpowiedzi do rozwinięcia.',
  box: { colSpan: 6, rowSpan: 3 },
  strip: { title: 'Pytania', open: 'Pokaż pytania' },
  fullscreen: true,

  blank: () => ({ items: [] }),
  example: () => ({
    items: [
      { question: 'Co zabrać?', answer: 'Kask, dętkę zapasową, wodę i coś ciepłego na wieczór.' },
      { question: 'Czy jest transport bagażu?', answer: 'Tak — bagaż jedzie samochodem technicznym.' }
    ]
  }),

  /* 0064 — was jeder Schlüssel im JSON bedeutet (die Beschreibung neben dem Import). */
  keys: {
    items: 'Pytania i odpowiedzi — lista',
    'items[].question': 'Pytanie',
    'items[].answer': 'Odpowiedź'
  },

  parse: (raw) => ({
    /* Nichts fällt beim Lesen weg: eine eben hinzugefügte Frage ist auf beiden Seiten leer. */
    items: mapEntries<FaqItem>(asRecord(raw).items, (item) => ({ question: asText(item.question).trim(), answer: asText(item.answer).trim() }))
  }),

  hasContent: (c) => c.items.some((item) => item.question !== ''),

  shows: (c, size) => size.height === 'strip' ? 'Przycisk, który rozwija pytania.' : `Pytania do rozwinięcia (${c.items.length}).`,

  Body: ({ config, ctx }) => <FaqList items={config.items.filter((item) => item.question.length > 0)} allOpen={ctx.whole === true} />,

  Edit: ({ config, onChange }) => (
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
