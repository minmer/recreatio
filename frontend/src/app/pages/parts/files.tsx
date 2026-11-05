/**
 * PLIKI — Dokumente zum Mitnehmen: das Regulamin, die Karte zum Ausdrucken,
 * der GPX-Track (Altbestand: `FilesPart`).
 *
 * Hochgeladen liegen sie an der Seite (`PageImage.cs`, 0063) und gehen als
 * Download hinaus; eine Adresse anderswo bleibt genauso gültig.
 *
 * <b>Je Grösse:</b> im Streifen die erste Datei und wie viele noch kommen;
 * als Block und hoch die ganze Liste mit Beschreibung und Grösse.
 */

import { useState } from 'react';

import { t, useT } from '../../core/i18n';
import { AreaRow, asOptionalText, asRecord, asText, defineEventPart, FileRow, ListEditor, mapEntries, TextRow } from '../event/kit';
import { imageUrl } from '../slides/slideLook';

type FileEntry = { label: string; url: string; note: string | null; size: string | null };
type FilesConfig = { files: FileEntry[]; note: string | null };

function Files({ config, strip }: { config: FilesConfig; strip: boolean }) {
  const t = useT();
  const [all, setAll] = useState(false);
  /* Ohne Adresse gibt es nichts, was man dem Leser reichen könnte. */
  const files = config.files.filter((file) => file.url.length > 0);
  const shown = strip && !all ? files.slice(0, 1) : files;

  return (
    <div className="ev-files">
      <ul className="ev-file-list">
        {shown.map((file, index) => (
          <li key={index}>
            <a href={imageUrl(file.url)} target="_blank" rel="noreferrer noopener" download>
              <span className="ev-file-icon" aria-hidden="true">↓</span>
              <span className="ev-file-body">
                <strong>{file.label || t('moduleContent.files.file')}</strong>
                {!strip && file.note !== null && <em>{file.note}</em>}
              </span>
              {file.size !== null && <span className="ev-file-size">{file.size}</span>}
            </a>
          </li>
        ))}
      </ul>
      {shown.length < files.length && (
        <button type="button" className="wk-link-btn wk-card-more" onClick={() => setAll(true)}>
          {t('moduleContent.files.more', { count: files.length - shown.length })}
        </button>
      )}
      {!strip && config.note !== null && <p className="ev-note">{config.note}</p>}
    </div>
  );
}

export const filesPart = defineEventPart<FilesConfig>({
  kind: 'files',
  label: 'moduleContent.files.label',
  use: 'moduleContent.files.use',
  box: { colSpan: 3, rowSpan: 3 },

  blank: () => ({ files: [], note: null }),
  example: () => ({
    files: [{ label: 'Regulamin', url: 'https://…/regulamin.pdf', note: 'Do przeczytania przed startem', size: 'PDF, 240 kB' }], // i18n-ignore
    note: null
  }),

  /* 0064 — was jeder Schlüssel im JSON bedeutet (die Beschreibung neben dem Import). */
  keys: {
    files: 'moduleContent.files.keyFiles',
    'files[].label': 'moduleContent.files.keyLabel',
    'files[].url': 'moduleContent.files.keyUrl',
    'files[].note': 'moduleContent.files.keyNote',
    'files[].size': 'moduleContent.files.keySize',
    note: 'moduleContent.files.keyListNote'
  },

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      /* Nichts fällt beim Lesen weg: ein Eintrag wird leer angelegt und danach gefüllt. */
      files: mapEntries<FileEntry>(record.files, (item) => ({
        label: asText(item.label).trim(),
        url: asText(item.url).trim(),
        note: asOptionalText(item.note),
        size: asOptionalText(item.size)
      })),
      note: asOptionalText(record.note)
    };
  },

  hasContent: (c) => c.files.some((file) => file.url !== ''),

  shows: (_c, size) => size.height === 'strip' ? t('moduleContent.files.showsStrip') : t('moduleContent.files.showsList'),

  Body: ({ config, ctx }) => <Files config={config} strip={ctx.size.height === 'strip'} />,

  Edit: function FilesEdit({ config, onChange, ctx, busy }) {
    const t = useT();
    return (
    <>
      <ListEditor<FileEntry>
        legend={t('moduleContent.files.legend')}
        items={config.files}
        addLabel={t('moduleContent.files.add')}
        blank={() => ({ label: '', url: '', note: null, size: null })}
        titleOf={(item, index) => item.label || t('moduleContent.files.nth', { n: index + 1 })}
        onChange={(files) => onChange({ ...config, files })}
        renderItem={(item, update) => (
          <>
            <TextRow label={t('moduleContent.files.name')} value={item.label} onChange={(label) => update({ ...item, label })} />
            {/* Hochladen füllt die Adresse und — nur wo noch leer — Name und Grösse. Was von Hand dasteht, bleibt. */}
            <FileRow value={item.url} ctx={ctx} busy={busy}
              onChange={(url) => update({ ...item, url })}
              onPicked={(url, name, size) => update({ ...item, url, label: item.label.trim() !== '' ? item.label : name.replace(/\.[a-z0-9]+$/i, ''), size: item.size ?? size })} />
            <TextRow label={t('moduleContent.files.description')} value={item.note ?? ''} onChange={(note) => update({ ...item, note: note || null })} />
            <TextRow label={t('moduleContent.files.size')} value={item.size ?? ''} hint={t('moduleContent.files.sizeHint')} onChange={(size) => update({ ...item, size: size || null })} />
          </>
        )}
      />
      <AreaRow label={t('moduleContent.files.note')} rows={2} value={config.note ?? ''} onChange={(note) => onChange({ ...config, note: note || null })} />
    </>
    );
  }
});
