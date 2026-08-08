import { asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { AreaRow, ListEditor, TextRow } from './editorKit';

type Channel = { label: string; value: string; href: string | null };

type ContactConfig = {
  organizer: string | null;
  channels: Channel[];
  note: string | null;
};

/** Who is running this and how to reach them. */
export const contactPart = definePart<ContactConfig>({
  kind: 'contact',
  label: 'Kontakt',
  description: 'Organizator i kanały kontaktu.',

  defaultConfig: () => ({
    organizer: 'reCreatio',
    channels: [{ label: 'E-mail', value: 'kontakt@recreatio.pl', href: 'mailto:kontakt@recreatio.pl' }],
    note: null
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      organizer: asOptionalText(record.organizer),
      channels: mapEntries<Channel>(record.channels, (item) => {
        const label = asText(item.label).trim();
        const value = asText(item.value).trim();
        if (label.length === 0 || value.length === 0) return null;
        return { label, value, href: asOptionalText(item.href) };
      }),
      note: asOptionalText(record.note)
    };
  },

  Renderer: ({ config }) => (
    <div className="e2-contact">
      {config.organizer ? <p className="e2-contact-organizer">{config.organizer}</p> : null}
      {config.channels.length > 0 ? (
        <div className="e2-card-grid">
          {config.channels.map((channel, index) => (
            <article key={index}>
              <h3>{channel.label}</h3>
              <p>{channel.href ? <a href={channel.href}>{channel.value}</a> : channel.value}</p>
            </article>
          ))}
        </div>
      ) : null}
      {config.note ? <p className="e2-note">{config.note}</p> : null}
    </div>
  ),

  Editor: ({ config, onChange }) => (
    <>
      <AreaRow
        label="Organizator"
        rows={2}
        value={config.organizer ?? ''}
        onChange={(organizer) => onChange({ ...config, organizer: organizer || null })}
      />
      <ListEditor<Channel>
        legend="Kanały kontaktu"
        items={config.channels}
        addLabel="Dodaj kanał"
        blank={() => ({ label: 'E-mail', value: '', href: null })}
        titleOf={(item) => item.label || 'Kanał'}
        onChange={(channels) => onChange({ ...config, channels })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Etykieta" value={item.label} onChange={(label) => update({ ...item, label })} />
            <TextRow label="Wartość" value={item.value} onChange={(value) => update({ ...item, value })} />
            <TextRow
              label="Odnośnik"
              value={item.href ?? ''}
              hint="Np. mailto:… albo tel:… — zostaw puste, jeśli to nie link."
              onChange={(href) => update({ ...item, href: href || null })}
            />
          </>
        )}
      />
      <AreaRow
        label="Uwaga"
        rows={2}
        value={config.note ?? ''}
        onChange={(note) => onChange({ ...config, note: note || null })}
      />
    </>
  )
});
