import { asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { AreaRow, ListEditor, TextRow } from './editorKit';

type FileEntry = { label: string; url: string; note: string | null; size: string | null };

type FilesConfig = {
  files: FileEntry[];
  note: string | null;
};

/** Documents to take away: regulamin, karta zgłoszenia, ślad GPX. */
export const filesPart = definePart<FilesConfig>({
  kind: 'files',
  label: 'Pliki',
  description: 'Lista dokumentów do pobrania.',

  defaultConfig: () => ({ files: [], note: null }),

  example: () => ({
    files: [
      { label: 'Regulamin', url: 'https://…/regulamin.pdf', note: 'Do przeczytania przed startem', size: 'PDF, 240 kB' }
    ],
    note: null
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      files: mapEntries<FileEntry>(record.files, (item) => {
        const label = asText(item.label).trim();
        const url = asText(item.url).trim();
        if (label.length === 0 || url.length === 0) return null;
        return { label, url, note: asOptionalText(item.note), size: asOptionalText(item.size) };
      }),
      note: asOptionalText(record.note)
    };
  },

  Renderer: ({ config }) => (
    <div className="e2-files">
      {config.files.length === 0 ? (
        <p className="e2-note">Nie dodano jeszcze plików.</p>
      ) : (
        <ul className="e2-file-list">
          {config.files.map((file, index) => (
            <li key={index}>
              <a href={file.url} target="_blank" rel="noreferrer noopener" download>
                <span className="e2-file-icon" aria-hidden="true">
                  ↓
                </span>
                <span className="e2-file-body">
                  <strong>{file.label}</strong>
                  {file.note ? <em>{file.note}</em> : null}
                </span>
                {file.size ? <span className="e2-file-size">{file.size}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      )}
      {config.note ? <p className="e2-note">{config.note}</p> : null}
    </div>
  ),

  Editor: ({ config, onChange }) => (
    <>
      <ListEditor<FileEntry>
        legend="Pliki"
        items={config.files}
        addLabel="Dodaj plik"
        blank={() => ({ label: '', url: '', note: null, size: null })}
        titleOf={(item, index) => item.label || `Plik ${index + 1}`}
        onChange={(files) => onChange({ ...config, files })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Nazwa" value={item.label} onChange={(label) => update({ ...item, label })} />
            <TextRow label="Adres pliku" value={item.url} onChange={(url) => update({ ...item, url })} />
            <TextRow
              label="Opis"
              value={item.note ?? ''}
              onChange={(note) => update({ ...item, note: note || null })}
            />
            <TextRow
              label="Rozmiar"
              value={item.size ?? ''}
              hint="Np. „PDF, 240 kB”."
              onChange={(size) => update({ ...item, size: size || null })}
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
