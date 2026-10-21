/**
 * COGITA — EINEN EINTRAG BEARBEITEN (COGITA.md §2.2, §3): seine Arten, seine
 * Felder nach Typ — mit mehreren und unsicheren Werten, Quellen, Verweisen,
 * Dateien, Orten und Spannen —, was „poza schematem" steht, wer auf ihn zeigt,
 * seine Karten, seine Fassungen, und das Zusammenführen mit einem Doppelgänger.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { areaKeys, newestKey } from '../chat/chat';
import { answerText } from './CardFace';
import { uploadFile } from './files';
import { GeoMap } from './GeoMap';
import { entityBundle, publicEntity, publishBundle, publishMedia, unpublishBundle } from './publish';
import {
  dateText, FIELD_TYPE_LABEL, fieldsOf, labelOf, outsideOf, parseRange, rangeText, readDate, readRange, VALUE_STATE_LABEL, VALUE_STATES,
  type Entity, type FieldDef, type GeoPoint, type MediaRef, type RangeValue, type ValueState
} from './schema';
import { linkedOf } from './store';
import { creatorFor, EntityPicker, Markup, MediaView, entityName, useAsync, useBusy, useCtx } from './ui';
import { loadVersions, openVersion } from './versions';
import { askText } from '../ui/dialogs';
import { Loading } from '../ui/Loading';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isEnvelope = (raw: unknown): raw is Record<string, unknown> =>
  isObject(raw) && ('state' in raw || 'value' in raw) && !('segments' in raw) && !('file' in raw) && !('lat' in raw);

export function EntityEditor({ entityId, newKinds, onDone, onOpen }: {
  /** `null`: ein neuer Eintrag (mit `newKinds`). */
  entityId: string | null;
  newKinds?: readonly string[];
  onDone: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const { lib, writes, me } = useCtx();
  const existing = entityId === null ? undefined : lib.entity(entityId);
  const [kinds, setKinds] = useState<readonly string[]>(existing?.kinds ?? newKinds ?? ['knowledge']);
  const [data, setData] = useState<Record<string, unknown>>({ ...(existing?.data ?? {}) });
  const [dirty, setDirty] = useState(false);
  const { busy, failed, run } = useBusy();
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    if (dirty) return;
    setKinds(existing?.kinds ?? newKinds ?? ['knowledge']);
    setData({ ...(existing?.data ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, existing === undefined ? '' : JSON.stringify(existing)]);

  if (entityId !== null && existing === undefined) return <p className="wk-empty">Tego wpisu nie ma (albo został połączony z innym).</p>;

  const draft: Entity = { id: entityId ?? 'new', kinds, data };
  const look = lib.look;
  const fields = fieldsOf(draft, look);
  const outside = outsideOf(draft, look);
  const change = (key: string, value: unknown) => {
    setData((was) => {
      const next = { ...was };
      if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) delete next[key]; else next[key] = value;
      return next;
    });
    setDirty(true);
  };

  const save = () => run(async () => {
    const saved = await lib.saveEntity({ ...(entityId === null ? {} : { id: entityId }), kinds, data });
    setDirty(false);
    setSaid('Zapisano.');
    if (entityId === null) onDone(saved.id);
  });

  const entry = entityId === null ? undefined : lib.entry(entityId);
  const knowledgeLike = kinds.includes('knowledge') || kinds.includes('topic');
  const checked = isObject(entry?.data._checked) ? entry!.data._checked as Record<string, string> : {};
  const changedLinks = existing === undefined ? [] : linkedOf(existing, look).map((t) => lib.resolve(t)).filter((id): id is string => id !== undefined)
    .filter((id) => { const at = lib.entry(id)?.updatedAt; return at !== undefined && (checked[id] === undefined || checked[id] < at); });

  return (
    <div className="cg-split">
      <form className="wk-form cg" onSubmit={(e) => { e.preventDefault(); if (writes) void save(); }}>
        <div className="cg-row-between">
          <h2 className="wk-h2">{entityId === null ? 'Nowy wpis' : labelOf(draft, look)}</h2>
          <span className="cg-row">
            {entry?.publishedAs != null && <span className="cg-tag is-ok">publiczny</span>}
            {dirty && <span className="cg-tag is-warn">niezapisane</span>}
          </span>
        </div>
        <KindsRow kinds={kinds} writes={writes} onChange={(k) => { setKinds(k); setDirty(true); }} />
        {fields.map((field) => (
          <FieldEditor key={field.key} field={field} raw={data[field.key]} writes={writes} onChange={(v) => change(field.key, v)} onOpen={onOpen} />
        ))}
        {outside.length > 0 && (
          <fieldset className="cg"><legend>Poza schematem</legend>
            <p className="wk-hint">Te wartości zostały po zmianie rodzaju — pole usunięto albo zmienił się jego typ. Zostają, dopóki nie zdecydujesz.</p>
            {outside.map((o) => (
              <div key={o.key} className="cg-row">
                <code>{o.key}</code> <span className="cg-muted">{JSON.stringify(o.raw).slice(0, 120)}</span>
                <span className="cg-tag">{o.reason === 'removed' ? 'pole usunięte' : 'inny typ'}</span>
                {writes && <button type="button" className="wk-link-btn" onClick={() => change(o.key, undefined)}>usuń wartość</button>}
              </div>
            ))}
          </fieldset>
        )}
        {failed !== null && <p className="wk-error">{failed}</p>}
        {said !== null && !dirty && <p className="wk-hint">{said}</p>}
        {writes && (
          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy || !dirty}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>
            {entityId !== null && <button type="button" className="wk-link-btn" disabled={busy} onClick={async () => {
              if (!(await askText('Usunąć ten wpis? Zostanie w historii wersji.'))) return;
              void run(async () => { await lib.remove(entityId); onDone(null); });
            }}>Usuń</button>}
          </div>
        )}
      </form>
      <aside className="cg">
        {existing !== undefined && knowledgeLike && changedLinks.length > 0 && (
          <div className="cg-card">
            <strong>Zmieniło się, o czym jest ten wpis</strong>
            <span className="cg-muted">{changedLinks.map((id) => entityName(lib, id)).join(', ')}</span>
            {writes && <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(() => lib.markChecked(existing.id))}>Sprawdzone</button>}
          </div>
        )}
        {existing !== undefined && <Backlinks entity={existing} onOpen={onOpen} />}
        {existing !== undefined && <EntityCards entity={existing} />}
        {existing !== undefined && writes && <Merge entity={existing} onMerged={() => onDone(existing.id)} />}
        {existing !== undefined && writes && me !== null && <History entityId={existing.id} onRestored={() => setDirty(false)} />}
        {existing !== undefined && writes && <PublishEntity entity={existing} />}
      </aside>
    </div>
  );
}

/* -- Arten -------------------------------------------------------------------------------- */

function KindsRow({ kinds, writes, onChange }: { kinds: readonly string[]; writes: boolean; onChange: (k: readonly string[]) => void }) {
  const { lib } = useCtx();
  const [adding, setAdding] = useState('');
  return (
    <div className="cg-row">
      <span className="cg-muted">Rodzaje:</span>
      {kinds.map((k, i) => (
        <span key={k} className="cg-tag">
          {lib.kind(k)?.name ?? k}{i === 0 ? ' (etykieta)' : ''}
          {writes && kinds.length > 1 && <button type="button" className="wk-link-btn" aria-label="Usuń rodzaj" onClick={() => onChange(kinds.filter((x) => x !== k))}>×</button>}
        </span>
      ))}
      {writes && (
        <select value={adding} onChange={(e) => { if (e.target.value !== '') onChange([...kinds, e.target.value]); setAdding(''); }} aria-label="Dodaj rodzaj">
          <option value="">+ rodzaj</option>
          {lib.kinds.filter((k) => !kinds.includes(k.id)).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      )}
    </div>
  );
}

/* -- Ein Feld -------------------------------------------------------------------------------- */

function FieldEditor({ field, raw, writes, onChange, onOpen }: { field: FieldDef; raw: unknown; writes: boolean; onChange: (v: unknown) => void; onOpen: (id: string) => void }) {
  const whole = field.type === 'list' || field.type === 'outline';
  const many = field.multi && !whole ? (Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw]) : null;
  const label = <span>{field.label}{field.private === true && <span className="cg-tag">prywatne</span>}<span className="cg-muted"> — {FIELD_TYPE_LABEL[field.type]}{field.unit ? `, ${field.unit}` : ''}</span></span>;

  if (field.type === 'outline') {
    return <div className="wk-field">{label}<span className="wk-hint">Plan projektu edytuje się w Bibliotece ({Array.isArray(raw) ? raw.length : 0} pozycji).</span></div>;
  }

  if (many !== null) {
    return (
      <fieldset className="cg">
        <legend>{label}</legend>
        {many.map((one, i) => (
          <div key={i} className="cg-row">
            <OneValue field={field} raw={one} writes={writes} onOpen={onOpen} onChange={(v) => {
              const next = [...many];
              if (v === undefined) next.splice(i, 1); else next[i] = v;
              onChange(next);
            }} />
            {writes && <button type="button" className="wk-link-btn" aria-label="Usuń wartość" onClick={() => onChange(many.filter((_, j) => j !== i))}>×</button>}
          </div>
        ))}
        {writes && <button type="button" className="wk-link-btn" onClick={() => onChange([...many, field.uncertain ? { value: '', state: 'known' } : ''])}>+ wartość</button>}
        {field.says !== undefined && <span className="wk-hint">{field.says}</span>}
      </fieldset>
    );
  }

  return (
    <div className="wk-field">
      {label}
      <OneValue field={field} raw={raw} writes={writes} onChange={onChange} onOpen={onOpen} />
      {field.says !== undefined && <span className="wk-hint">{field.says}</span>}
    </div>
  );
}

/** Ein Wert — in seiner Hülle, wenn das Feld unsicher sein darf (Stand, Quelle, Notiz). */
function OneValue({ field, raw, writes, onChange, onOpen }: { field: FieldDef; raw: unknown; writes: boolean; onChange: (v: unknown) => void; onOpen: (id: string) => void }) {
  if (!field.uncertain) return <PlainValue field={field} value={isEnvelope(raw) ? raw.value : raw} writes={writes} onChange={onChange} onOpen={onOpen} />;
  const env = isEnvelope(raw) ? raw : raw === undefined ? {} : { value: raw };
  const state = (VALUE_STATES as readonly string[]).includes(String(env.state)) ? env.state as ValueState : 'known';
  const source = isObject(env.source) ? env.source : {};
  const set = (patch: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...env, ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === undefined || v === '') delete next[k];
    onChange(next);
  };
  const withValue = state !== 'unknown' && state !== 'na' && state !== 'pending';
  return (
    <div className="cg-card">
      <div className="cg-row">
        {withValue && <PlainValue field={field} value={env.value} writes={writes} onChange={(v) => set({ value: v })} onOpen={onOpen} />}
        <select value={state} disabled={!writes} onChange={(e) => set({ state: e.target.value })} aria-label="Pewność">
          {VALUE_STATES.map((s) => <option key={s} value={s}>{VALUE_STATE_LABEL[s]}</option>)}
        </select>
      </div>
      <SourceRow source={source} writes={writes} onChange={(s) => set({ source: s })} />
      <input value={typeof env.note === 'string' ? env.note : ''} placeholder="notatka" disabled={!writes} onChange={(e) => set({ note: e.target.value })} />
    </div>
  );
}

function SourceRow({ source, writes, onChange }: { source: Record<string, unknown>; writes: boolean; onChange: (s: Record<string, unknown> | undefined) => void }) {
  const { lib } = useCtx();
  const work = typeof source.work === 'string' ? source.work : null;
  return (
    <div className="cg-row">
      <span className="cg-muted">Źródło:</span>
      {writes ? <EntityPicker lib={lib} kinds={['work']} refs value={work} placeholder="dzieło z biblioteki (źródła tej bazy)" onPick={(id) => onChange(id === null ? undefined : { ...source, work: id })} />
        : <span>{work === null ? '—' : entityName(lib, work)}</span>}
      {work !== null && <input value={typeof source.locator === 'string' ? source.locator : ''} placeholder="s. 23, J 3,16" disabled={!writes} onChange={(e) => onChange({ ...source, locator: e.target.value || undefined })} />}
    </div>
  );
}

function PlainValue({ field, value, writes, onChange, onOpen }: { field: FieldDef; value: unknown; writes: boolean; onChange: (v: unknown) => void; onOpen: (id: string) => void }) {
  const { lib, me } = useCtx();
  const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  const [busy, setBusy] = useState(false);
  const [rangeDraft, setRangeDraft] = useState<string | null>(null);
  switch (field.type) {
    case 'line':
    case 'url':
      return <input type={field.type === 'url' ? 'url' : 'text'} value={text} disabled={!writes} onChange={(e) => onChange(e.target.value)} />;
    case 'text':
      return <textarea rows={3} value={text} disabled={!writes} onChange={(e) => onChange(e.target.value)} />;
    case 'markup':
      return <MarkupInput value={text} writes={writes} onChange={onChange} onOpen={onOpen} />;
    case 'number':
      return <input type="number" step="any" value={typeof value === 'number' ? value : text} disabled={!writes} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />;
    case 'date': {
      const date = readDate(text);
      return (
        <span className="cg-row">
          <input value={text} disabled={!writes} placeholder="1410, 1410-07, 1410-07-15, -1000" onChange={(e) => onChange(e.target.value)} />
          <span className="cg-muted">{text === '' ? '' : date === null ? 'nieczytelna data' : dateText(date)}</span>
        </span>
      );
    }
    case 'bool':
      return (
        <select value={value === true ? 'yes' : value === false ? 'no' : value === 'unknown' ? 'unknown' : ''} disabled={!writes}
          onChange={(e) => onChange(e.target.value === 'yes' ? true : e.target.value === 'no' ? false : e.target.value === 'unknown' ? 'unknown' : undefined)}>
          <option value="">—</option><option value="yes">tak</option><option value="no">nie</option><option value="unknown">nie wiadomo</option>
        </select>
      );
    case 'choice':
      return (
        <select value={text} disabled={!writes} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'ref': {
      const id = typeof value === 'string' && value !== '' ? value : null;
      return (
        <span className="cg-row">
          {writes ? <EntityPicker lib={lib} kinds={field.to} refs {...creatorFor(lib, field.to, writes)} value={id} onPick={(next) => onChange(next ?? undefined)} />
            : <span>{id === null ? '—' : entityName(lib, id)}</span>}
          {id !== null && lib.entity(id) !== undefined && <button type="button" className="wk-link-btn" onClick={() => onOpen(id)}>otwórz</button>}
        </span>
      );
    }
    case 'media': {
      const media = isObject(value) && typeof value.file === 'string' ? value as unknown as MediaRef : null;
      return (
        <span className="cg">
          {media !== null && <MediaView media={media} />}
          {writes && me !== null && (
            <input type="file" disabled={busy} accept={(field.media ?? []).map((m) => (m === 'document' ? '.pdf,.doc,.docx,.odt' : `${m}/*`)).join(',')} onChange={(e) => {
              const file = e.target.files?.[0];
              if (file === undefined) return;
              setBusy(true);
              void (async () => {
                try {
                  const newest = newestKey(await areaKeys(me.ring, lib.areaId, true));
                  if (newest !== null) onChange(await uploadFile(lib.libraryId, newest, file));
                } finally { setBusy(false); }
              })();
            }} />
          )}
          {busy && <span className="wk-hint">Wgrywanie i szyfrowanie…</span>}
        </span>
      );
    }
    case 'list':
      return <textarea rows={3} value={Array.isArray(value) ? value.join('\n') : text} disabled={!writes} placeholder="jedna pozycja w wierszu, w kolejności" onChange={(e) => onChange(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} />;
    case 'geo': {
      const geo = isObject(value) && typeof value.lat === 'number' && typeof value.lon === 'number' ? value as unknown as GeoPoint : null;
      return (
        <span className="cg">
          <span className="cg-row">
            <input type="number" step="any" placeholder="szerokość" value={geo?.lat ?? ''} disabled={!writes} onChange={(e) => onChange({ lat: Number(e.target.value), lon: geo?.lon ?? 0 })} />
            <input type="number" step="any" placeholder="długość" value={geo?.lon ?? ''} disabled={!writes} onChange={(e) => onChange({ lat: geo?.lat ?? 0, lon: Number(e.target.value) })} />
          </span>
          <GeoMap zoom={geo === null ? 6 : 13} center={geo ?? { lat: 51.9, lon: 19.1 }} marks={geo === null ? [] : [{ ...geo, kind: 'pin' }]} onPick={writes ? (at) => onChange({ lat: Number(at.lat.toFixed(6)), lon: Number(at.lon.toFixed(6)) }) : undefined} height="14rem" />
        </span>
      );
    }
    case 'range': {
      const of = field.rangeOf ?? 'number';
      const range = readRange(value, of);
      const shown = rangeDraft ?? (range === null ? '' : rangeText(range, of).replace(/ok\. /g, 'ok. '));
      return (
        <span className="cg-row">
          <input value={shown} disabled={!writes} placeholder="992–1000, 1002–1025" onChange={(e) => {
            setRangeDraft(e.target.value);
            const parsed: RangeValue | null = parseRange(e.target.value, of);
            if (parsed !== null || e.target.value.trim() === '') onChange(parsed ?? undefined);
          }} onBlur={() => setRangeDraft(null)} />
          {range !== null && <span className="cg-muted">{rangeText(range, of)}</span>}
        </span>
      );
    }
    default:
      return <span className="wk-hint">—</span>;
  }
}

/** Auszeichnung mit Vorschau — und ein Verweis auf einen Eintrag, aus der Suche eingefügt [C3]. */
function MarkupInput({ value, writes, onChange, onOpen }: { value: string; writes: boolean; onChange: (v: string) => void; onOpen: (id: string) => void }) {
  const { lib } = useCtx();
  const [linking, setLinking] = useState(false);
  return (
    <span className="cg">
      <textarea rows={4} value={value} disabled={!writes} onChange={(e) => onChange(e.target.value)} />
      {writes && (linking
        ? <EntityPicker lib={lib} refs value={null} placeholder="do którego wpisu?" onPick={(id) => {
            setLinking(false);
            if (id === null) return;
            const entity = lib.entity(id);
            onChange(`${value}${value.endsWith(' ') || value === '' ? '' : ' '}[[${entity === undefined ? 'wpis' : lib.label(entity)}|@${id}]]`);
          }} />
        : <button type="button" className="wk-link-btn" onClick={() => setLinking(true)}>+ odwołanie do wpisu</button>)}
      {value.trim() !== '' && <div className="cg-card"><Markup text={value} onEntity={onOpen} resolve={(t) => lib.resolve(t)} /></div>}
    </span>
  );
}

/* -- Daneben -------------------------------------------------------------------------------- */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="cg-card"><h3>{title}</h3>{children}</section>;
}

function Backlinks({ entity, onOpen }: { entity: Entity; onOpen: (id: string) => void }) {
  const { lib } = useCtx();
  const links = lib.backlinks(entity.id);
  if (links.length === 0) return null;
  const by = new Map<string, string[]>();
  for (const l of links) by.set(l.label, [...(by.get(l.label) ?? []), l.from]);
  return (
    <Section title="Odwołują się tutaj">
      {[...by.entries()].map(([label, ids]) => (
        <div key={label}>
          <span className="cg-muted">{label}:</span>{' '}
          {ids.map((id, i) => <span key={id}>{i > 0 && ', '}<button type="button" className="cg-ref" onClick={() => onOpen(id)}>{entityName(lib, id)}</button></span>)}
        </div>
      ))}
    </Section>
  );
}

function EntityCards({ entity }: { entity: Entity }) {
  const { lib } = useCtx();
  const cards = useAsync(() => lib.cardsFor(entity.id, 'preview'), [entity.id, lib.revision]);
  if (cards === undefined) return <Section title="Karty"><span className="wk-hint">Liczenie kart…</span></Section>;
  if (cards === null || cards.length === 0) return <Section title="Karty"><span className="wk-hint">Z tego wpisu nie powstaje jeszcze żadna karta — dodaj szablon dla jego rodzaju albo napisz pytanie.</span></Section>;
  return (
    <Section title={`Karty (${cards.length})`}>
      <ul className="cg-muted">
        {cards.slice(0, 12).map((c) => <li key={c.key}>{c.prompt.map((p) => p.text).join(' ') || '(obraz/dźwięk)'} → <strong>{answerText(c)}</strong></li>)}
      </ul>
    </Section>
  );
}

function Merge({ entity, onMerged }: { entity: Entity; onMerged: () => void }) {
  const { lib } = useCtx();
  const [other, setOther] = useState<string | null>(null);
  const { busy, failed, run } = useBusy();
  return (
    <Section title="Połącz z duplikatem">
      <span className="wk-hint">Wszystkie odwołania do duplikatu przejdą na ten wpis; duplikat zniknie (zostanie w historii).</span>
      <EntityPicker lib={lib} kinds={entity.kinds} value={other} onPick={setOther} placeholder="który wpis to duplikat?" />
      {other !== null && other !== entity.id && (
        <button type="button" className="wk-btn" disabled={busy} onClick={async () => {
          if (!(await askText(`Połączyć „${entityName(lib, other)}" z „${lib.label(entity)}"?`))) return;
          void run(async () => { await lib.merge(entity.id, other); setOther(null); onMerged(); });
        }}>{busy ? 'Łączenie…' : 'Połącz'}</button>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </Section>
  );
}

function History({ entityId, onRestored }: { entityId: string; onRestored: () => void }) {
  const { lib, me } = useCtx();
  const [open, setOpen] = useState(false);
  const versions = useAsync(open ? () => loadVersions(lib.libraryId, entityId).then((r) => r.versions) : null, [open, entityId, lib.revision]);
  const { busy, failed, run } = useBusy();
  const keys = useMemo(() => (me === null ? null : areaKeys(me.ring, lib.areaId)), [me, lib.areaId]);
  return (
    <Section title="Historia wersji">
      {!open ? <button type="button" className="wk-link-btn" onClick={() => setOpen(true)}>Pokaż wcześniejsze wersje</button>
        : versions === undefined ? <Loading lines={2} />
        : versions === null ? <span className="wk-hint">Historia nie jest dostępna.</span>
        : versions.length === 0 ? <span className="wk-hint">Nie ma jeszcze wcześniejszych wersji.</span>
        : (
          <ul className="cg-muted">
            {versions.map((v) => (
              <li key={v.version} className="cg-row">
                <span>v{v.version} · {new Date(v.writtenAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}{v.byMe ? ' · Ty' : ''}</span>
                <button type="button" className="wk-link-btn" disabled={busy || keys === null} onClick={() => void run(async () => {
                  const doc = await openVersion(lib.libraryId, entityId, v.version, await keys!);
                  if (doc === null) throw new Error('Tej wersji nie da się otworzyć.');
                  const entry = lib.entry(entityId);
                  await lib.store.save({ id: entityId, kind: entry?.kind ?? doc.kind, ...(entry?.key === undefined ? {} : { key: entry.key }), data: doc.data });
                  onRestored();
                })}>przywróć</button>
              </li>
            ))}
          </ul>
        )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </Section>
  );
}

function PublishEntity({ entity }: { entity: Entity }) {
  const { lib, keyIn } = useCtx();
  const entry = lib.entry(entity.id);
  const { busy, failed, run } = useBusy();
  const builtin = entry !== undefined && ['person', 'work', 'quote', 'topic', 'text', 'delivery', 'project'].includes(entry.kind);
  const publish = async () => {
    const bundle = entityBundle(lib, entity);
    await publishMedia(lib, publicEntity(lib, entity).media, keyIn);
    await publishBundle(lib, entity.id, bundle);
  };
  if (entry === undefined || builtin) return null;
  return (
    <Section title="Na stronie">
      <span className="wk-hint">Opublikowany wpis może pokazać moduł „Karta wpisu" na stronie (bez klucza, dla każdego).</span>
      {entry.publishedAs === null
        ? <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(publish)}>Opublikuj</button>
        : (
          <span className="cg-row">
            <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(publish)}>Zaktualizuj publikację</button>
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => unpublishBundle(lib, entity.id))}>Wycofaj</button>
          </span>
        )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </Section>
  );
}
