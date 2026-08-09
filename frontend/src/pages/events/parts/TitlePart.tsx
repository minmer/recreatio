import { asOptionalText, asRecord, asStringList, asText, definePart, mapEntries } from './contracts';
import { AreaRow, LinesRow, ListEditor, SelectRow, TextRow } from './editorKit';

type Action = { label: string; href: string; variant: 'cta' | 'ghost' };

type TitleConfig = {
  badge: string | null;
  headline: string;
  lede: string | null;
  paragraphs: string[];
  actions: Action[];
  footnote: string | null;
};

/** The opening slide: what this event is, in one screen. */
export const titlePart = definePart<TitleConfig>({
  kind: 'title',
  label: 'Tytuł',
  description: 'Nagłówek wydarzenia z hasłem, opisem i przyciskami.',

  defaultConfig: () => ({
    badge: 'Termin i miejsce',
    headline: 'Tytuł wydarzenia',
    lede: 'Jedno zdanie, które mówi, o co chodzi.',
    paragraphs: ['Krótki opis wydarzenia.'],
    actions: [{ label: 'Zapisz się', href: '#zapisy', variant: 'cta' }],
    footnote: null
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      badge: asOptionalText(record.badge),
      headline: asText(record.headline, 'Wydarzenie'),
      lede: asOptionalText(record.lede),
      paragraphs: asStringList(record.paragraphs),
      actions: mapEntries<Action>(record.actions, (item) => {
        const label = asText(item.label).trim();
        const href = asText(item.href).trim();
        if (label.length === 0 || href.length === 0) return null;
        return { label, href, variant: asText(item.variant) === 'ghost' ? 'ghost' : 'cta' };
      }),
      footnote: asOptionalText(record.footnote)
    };
  },

  Renderer: ({ config }) => (
    <section className="e2-title">
      {config.badge ? <p className="e2-badge">{config.badge}</p> : null}
      <h1>
        {config.headline}
        {config.lede ? <span>{config.lede}</span> : null}
      </h1>
      {config.paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      {config.actions.length > 0 ? (
        <div className="e2-actions">
          {config.actions.map((action, index) => (
            <a key={index} className={action.variant === 'ghost' ? 'e2-ghost' : 'e2-cta'} href={action.href}>
              {action.label}
            </a>
          ))}
        </div>
      ) : null}
      {config.footnote ? <small>{config.footnote}</small> : null}
    </section>
  ),

  Editor: ({ config, onChange }) => (
    <>
      <TextRow label="Plakietka" value={config.badge ?? ''} onChange={(badge) => onChange({ ...config, badge: badge || null })} />
      <TextRow label="Nagłówek" value={config.headline} onChange={(headline) => onChange({ ...config, headline })} />
      <TextRow label="Podtytuł" value={config.lede ?? ''} onChange={(lede) => onChange({ ...config, lede: lede || null })} />
      <LinesRow
        label="Akapity"
        values={config.paragraphs}
        rows={5}
        hint="Jeden akapit na linię."
        onChange={(paragraphs) => onChange({ ...config, paragraphs })}
      />
      <ListEditor<Action>
        legend="Przyciski"
        items={config.actions}
        addLabel="Dodaj przycisk"
        blank={() => ({ label: 'Przycisk', href: '#', variant: 'cta' })}
        titleOf={(item) => item.label || 'Przycisk'}
        onChange={(actions) => onChange({ ...config, actions })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Napis" value={item.label} onChange={(label) => update({ ...item, label })} />
            <TextRow
              label="Adres"
              value={item.href}
              hint="Np. #zapisy albo pełny adres."
              onChange={(href) => update({ ...item, href })}
            />
            <SelectRow<Action['variant']>
              label="Styl"
              value={item.variant}
              options={[
                { value: 'cta', label: 'Wyróżniony' },
                { value: 'ghost', label: 'Zwykły' }
              ]}
              onChange={(variant) => update({ ...item, variant })}
            />
          </>
        )}
      />
      <AreaRow
        label="Dopisek"
        rows={2}
        value={config.footnote ?? ''}
        onChange={(footnote) => onChange({ ...config, footnote: footnote || null })}
      />
    </>
  )
});
