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
      if (question.length === 0) return null;
      return { question, answer: asText(item.answer).trim() };
    })
  }),

  Renderer: ({ config }) =>
    config.items.length === 0 ? (
      <p className="ev-note">Brak pytań w tej sekcji.</p>
    ) : (
      <div className="ev-faq">
        {config.items.map((item, index) => (
          <details key={index}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    ),

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
