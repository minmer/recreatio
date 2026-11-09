/**
 * PLAN — ein Programm in Etappen, mit Uhrzeiten (Altbestand: `PlanPart`).
 *
 * <b>Je Grösse:</b> im Streifen klappt er auf (zu lang für eine Zeile); als
 * Block die erste Etappe ganz und die übrigen als Überschriften, die sich
 * öffnen; hoch alle Etappen offen, über die ganze Breite nebeneinander.
 */

import { useState } from 'react';

import { t, useT } from '../../core/i18n';
import { lazyPart } from './partTexts';
import { AreaRow, asOptionalText, asRecord, asText, defineEventPart, ListEditor, mapEntries, TextRow } from '../event/kit';

type Row = { time: string | null; title: string; detail: string | null };
type Group = { label: string; caption: string | null; rows: Row[] };
type PlanConfig = { groups: Group[]; note: string | null };

function Plan({ config, all }: { config: PlanConfig; all: boolean }) {
  const t = useT();
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]));
  const groups = config.groups.filter((g) => g.label !== '' || g.rows.some((r) => r.title !== ''));

  return (
    <div className="ev-plan">
      {groups.map((group, groupIndex) => {
        const shown = all || open.has(groupIndex);
        const rows = group.rows.filter((row) => row.title.length > 0);
        return (
          <section className={`ev-plan-group${shown ? '' : ' is-closed'}`} key={groupIndex}>
            <header>
              {all ? <h3>{group.label}</h3> : (
                <h3>
                  <button type="button" className="ev-plan-toggle" aria-expanded={shown}
                    onClick={() => setOpen((was) => { const next = new Set(was); if (!next.delete(groupIndex)) next.add(groupIndex); return next; })}>
                    {group.label}
                  </button>
                </h3>
              )}
              {group.caption !== null && <p>{group.caption}</p>}
              {!shown && <p className="ev-plan-count">{t('moduleData.plan.points', { count: rows.length })}</p>}
            </header>
            {shown && (
              <ol className="ev-plan-rows">
                {rows.map((row, rowIndex) => (
                  <li key={rowIndex}>
                    <span className="ev-plan-time">{row.time ?? '—'}</span>
                    <span className="ev-plan-body">
                      <strong>{row.title}</strong>
                      {row.detail !== null && <em>{row.detail}</em>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
      {config.note !== null && <p className="ev-note">{config.note}</p>}
    </div>
  );
}

/* Die Texte der Beschreibung je Sprache (`lazyPart`): `defineEventPart` liest sie beim Anlegen. */
export const planPart = lazyPart(() => defineEventPart<PlanConfig>({
  kind: 'plan',
  label: t('moduleData.plan.label'),
  use: t('moduleData.plan.use'),
  box: { colSpan: 6, rowSpan: 3 },
  strip: { title: t('moduleData.plan.label'), open: t('moduleData.plan.open') },
  fullscreen: true,

  blank: () => ({ groups: [], note: null }),
  example: () => ({
    groups: [
      { label: t('moduleData.plan.ex.friday'), caption: t('moduleData.plan.ex.route1'), rows: [{ time: '7:00', title: t('moduleData.plan.ex.mass'), detail: t('moduleData.plan.ex.church') }, { time: '8:00', title: t('moduleData.plan.ex.departure'), detail: null }] },
      { label: t('moduleData.plan.ex.saturday'), caption: t('moduleData.plan.ex.route2'), rows: [{ time: '8:30', title: t('moduleData.plan.ex.departure'), detail: null }, { time: '17:00', title: t('moduleData.plan.ex.jasnaGora'), detail: t('moduleData.plan.ex.appeal') }] }
    ],
    note: null
  }),

  /* 0064 — was jeder Schlüssel im JSON bedeutet (die Beschreibung neben dem Import). */
  keys: {
    groups: t('moduleData.plan.k.groups'),
    'groups[].label': t('moduleData.plan.k.groupLabel'),
    'groups[].caption': t('moduleData.plan.k.groupCaption'),
    'groups[].rows': t('moduleData.plan.k.rows'),
    'groups[].rows[].time': t('moduleData.plan.k.time'),
    'groups[].rows[].title': t('moduleData.plan.k.title'),
    'groups[].rows[].detail': t('moduleData.plan.k.detail'),
    note: t('moduleData.plan.k.note')
  },

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      groups: mapEntries<Group>(record.groups, (group) => ({
        /* Nichts fällt beim Lesen weg: ein Punkt ist leer, bis er getippt ist. Die Ansicht lässt die unbenannten aus. */
        label: asText(group.label).trim(),
        caption: asOptionalText(group.caption),
        rows: mapEntries<Row>(group.rows, (row) => ({ time: asOptionalText(row.time), title: asText(row.title).trim(), detail: asOptionalText(row.detail) }))
      })),
      note: asOptionalText(record.note)
    };
  },

  hasContent: (c) => c.groups.some((g) => g.rows.some((r) => r.title !== '')),

  shows: (c, size) => size.height === 'strip' ? t('moduleData.plan.showsStrip')
    : size.height === 'tall' ? t('moduleData.plan.showsTall', { count: c.groups.length })
    : t('moduleData.plan.showsBlock'),

  Body: ({ config, ctx }) => <Plan config={config} all={ctx.size.height === 'tall' || ctx.whole === true} />,

  Edit: function PlanEdit({ config, onChange }) {
    const t = useT();
    return (
    <>
      <ListEditor<Group>
        legend={t('moduleData.plan.groups')}
        items={config.groups}
        addLabel={t('moduleData.plan.addGroup')}
        blank={() => ({ label: t('moduleData.plan.dayN', { n: config.groups.length + 1 }), caption: null, rows: [] })}
        titleOf={(item, index) => item.label || t('moduleData.plan.groupN', { n: index + 1 })}
        onChange={(groups) => onChange({ ...config, groups })}
        renderItem={(group, updateGroup) => (
          <>
            <TextRow label={t('moduleData.plan.groupName')} value={group.label} onChange={(label) => updateGroup({ ...group, label })} />
            <TextRow label={t('moduleData.plan.caption')} value={group.caption ?? ''} onChange={(caption) => updateGroup({ ...group, caption: caption || null })} />
            <ListEditor<Row>
              legend={t('moduleData.plan.rows')}
              items={group.rows}
              addLabel={t('moduleData.plan.addRow')}
              blank={() => ({ time: null, title: '', detail: null })}
              titleOf={(row, index) => [row.time, row.title].filter(Boolean).join(' · ') || t('moduleData.plan.rowN', { n: index + 1 })}
              onChange={(rows) => updateGroup({ ...group, rows })}
              renderItem={(row, updateRow) => (
                <>
                  <TextRow label={t('moduleData.plan.time')} value={row.time ?? ''} placeholder="9:00" onChange={(time) => updateRow({ ...row, time: time || null })} />
                  <TextRow label={t('moduleData.plan.what')} value={row.title} onChange={(title) => updateRow({ ...row, title })} />
                  <TextRow label={t('moduleData.plan.detail')} value={row.detail ?? ''} onChange={(detail) => updateRow({ ...row, detail: detail || null })} />
                </>
              )}
            />
          </>
        )}
      />
      <AreaRow label={t('moduleData.plan.note')} rows={2} value={config.note ?? ''} onChange={(note) => onChange({ ...config, note: note || null })} />
    </>
    );
  }
}));
