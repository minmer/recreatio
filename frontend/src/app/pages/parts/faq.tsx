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

import { t, useT } from '../../core/i18n';
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
  label: 'moduleContent.faq.label',
  use: 'moduleContent.faq.use',
  box: { colSpan: 6, rowSpan: 3 },
  strip: { title: 'moduleContent.faq.stripTitle', open: 'moduleContent.faq.stripOpen' },
  fullscreen: true,

  blank: () => ({ items: [] }),
  example: () => ({
    items: [
      { question: 'Co zabrać?', answer: 'Kask, dętkę zapasową, wodę i coś ciepłego na wieczór.' }, // i18n-ignore
      { question: 'Czy jest transport bagażu?', answer: 'Tak — bagaż jedzie samochodem technicznym.' } // i18n-ignore
    ]
  }),

  /* 0064 — was jeder Schlüssel im JSON bedeutet (die Beschreibung neben dem Import). */
  keys: {
    items: 'moduleContent.faq.keyItems',
    'items[].question': 'moduleContent.faq.question',
    'items[].answer': 'moduleContent.faq.answer'
  },

  parse: (raw) => ({
    /* Nichts fällt beim Lesen weg: eine eben hinzugefügte Frage ist auf beiden Seiten leer. */
    items: mapEntries<FaqItem>(asRecord(raw).items, (item) => ({ question: asText(item.question).trim(), answer: asText(item.answer).trim() }))
  }),

  hasContent: (c) => c.items.some((item) => item.question !== ''),

  shows: (c, size) => size.height === 'strip' ? t('moduleContent.faq.showsStrip') : t('moduleContent.faq.showsList', { count: c.items.length }),

  Body: ({ config, ctx }) => <FaqList items={config.items.filter((item) => item.question.length > 0)} allOpen={ctx.whole === true} />,

  Edit: function FaqEdit({ config, onChange }) {
    const t = useT();
    return (
    <ListEditor<FaqItem>
      legend={t('moduleContent.faq.legend')}
      items={config.items}
      addLabel={t('moduleContent.faq.add')}
      blank={() => ({ question: '', answer: '' })}
      titleOf={(item, index) => item.question || t('moduleContent.faq.nth', { n: index + 1 })}
      onChange={(items) => onChange({ items })}
      renderItem={(item, update) => (
        <>
          <TextRow label={t('moduleContent.faq.question')} value={item.question} onChange={(question) => update({ ...item, question })} />
          <AreaRow label={t('moduleContent.faq.answer')} rows={3} value={item.answer} onChange={(answer) => update({ ...item, answer })} />
        </>
      )}
    />
    );
  }
});
