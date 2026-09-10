import { asOptionalText, asRecord, asStringList, definePart } from './contracts';
import { AreaRow, LinesRow } from './editorKit';

type TextConfig = {
  paragraphs: string[];
  bullets: string[];
  note: string | null;
};

/** Plain prose with an optional bullet list and one highlighted line. */
export const textPart = definePart<TextConfig>({
  kind: 'text',
  label: 'Treść',
  description: 'Akapity, lista punktów i wyróżniona uwaga.',

  defaultConfig: () => ({ paragraphs: ['Treść sekcji.'], bullets: [], note: null }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      paragraphs: asStringList(record.paragraphs),
      bullets: asStringList(record.bullets),
      note: asOptionalText(record.note)
    };
  },

  Renderer: ({ config }) => (
    <div className="ev-prose">
      {config.paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      {config.bullets.length > 0 ? (
        <ul>
          {config.bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      {config.note ? <p className="ev-callout">{config.note}</p> : null}
    </div>
  ),

  Editor: ({ config, onChange }) => (
    <>
      <LinesRow
        label="Akapity"
        rows={6}
        hint="Jeden akapit na linię."
        values={config.paragraphs}
        onChange={(paragraphs) => onChange({ ...config, paragraphs })}
      />
      <LinesRow
        label="Punkty"
        rows={5}
        values={config.bullets}
        onChange={(bullets) => onChange({ ...config, bullets })}
      />
      <AreaRow
        label="Wyróżniona uwaga"
        rows={2}
        value={config.note ?? ''}
        onChange={(note) => onChange({ ...config, note: note || null })}
      />
    </>
  )
});
