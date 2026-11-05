/**
 * 0137 — DIE FÜNF SCHRITTE EINER EINHEIT: dieselbe Ansicht beim Anlegen (die geführte Einrichtung,
 * `only` = ein Schritt) und als Ustawienia jeder Einheit. An jeder Einstellung steht, woher ihr Wert
 * kommt („odziedziczone z …", „z planu …", „ustawione tutaj"), und „Przywróć odziedziczone".
 * Grob zuerst; Feines hinter „Więcej".
 */

import { useState } from 'react';

import { PROFILE_KINDS, type ProfileKind } from '../areas/profile';
import { useT } from '../core/i18n';
import {
  ASSIGN_WORD, blueprintOf, councilOf, FIELD_KINDS, FIELD_PRESETS, findUnit, holdersOf, positionsOf, resolveSetting, RIGHTS,
  rightsLabel, SETTINGS, sourceWords, STEP_TITLES, valueOf, type Assign, type CommunityDoc, type FieldKind, type Rights, type SettingDef, type Step
} from './community';
import { addUnit, freePositionKey, saveAsBlueprint, setUnitPositions, setUnitSetting, updateUnit, upsertPosition } from './communityEdit';

type Edit = (next: CommunityDoc) => void;

function SettingRow({ doc, unitKey, def, onChange, busy }: { doc: CommunityDoc; unitKey: string; def: SettingDef; onChange: Edit; busy: boolean }) {
  const t = useT();
  const r = resolveSetting(doc, unitKey, def.path);
  const own = r.source.kind === 'own';
  const set = (v: unknown) => onChange(setUnitSetting(doc, unitKey, def.path, v));
  const id = `set-${unitKey}-${def.path}`;
  const value = r.value;
  let control;
  if (def.kind === 'choice') {
    control = (
      <div className="wk-cm-choices" role="radiogroup" aria-label={def.label}>
        {def.choices!.map((c) => (
          <label key={c.value} className={`wk-cm-choice${value === c.value ? ' is-on' : ''}`}>
            <input type="radio" name={id} checked={value === c.value} disabled={busy} onChange={() => set(c.value)} />
            <span><strong>{c.label}</strong>{c.example && <small>{t('communities.unit.fitsFor', { example: c.example })}</small>}</span>
          </label>
        ))}
      </div>
    );
  } else if (def.kind === 'bool') {
    control = <input id={id} type="checkbox" checked={value === true} disabled={busy} onChange={(e) => set(e.target.checked)} />;
  } else if (def.kind === 'day') {
    control = (
      <select id={id} value={typeof value === 'string' ? value : ''} disabled={busy} onChange={(e) => set(e.target.value === '' ? undefined : e.target.value)}>
        <option value="">—</option>
        {def.choices!.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    );
  } else {
    const type = def.kind === 'number' ? 'number' : def.kind === 'date' ? 'date' : def.kind === 'time' ? 'time' : 'text';
    control = (
      <input id={id} type={type} value={value === null || value === undefined ? '' : String(value)} disabled={busy}
        onChange={(e) => set(e.target.value === '' ? null : def.kind === 'number' ? Number(e.target.value) : e.target.value)} />
    );
  }
  return (
    <div className={`wk-cm-setting${def.kind === 'bool' ? ' is-bool' : ''}`} data-setting={def.path}>
      <label htmlFor={def.kind === 'choice' ? undefined : id} className="wk-cm-setting-label" title={def.hint}>{def.label}{def.hint ? <small> — {def.hint}</small> : null}</label>
      {control}
      <span className={`wk-cm-source is-${r.source.kind}`}>
        {sourceWords(r.source)}
        {own && def.inherit && (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => set(undefined)}>{t('communities.unit.restoreInherited')}</button>
        )}
      </span>
    </div>
  );
}

function Settings({ doc, unitKey, step, onChange, busy }: { doc: CommunityDoc; unitKey: string; step: Step; onChange: Edit; busy: boolean }) {
  const t = useT();
  const [fine, setFine] = useState(false);
  const get = (path: string) => valueOf(doc, unitKey, path);
  const shown = SETTINGS.filter((s) => s.step === step && (s.when === undefined || s.when(get)));
  const rough = shown.filter((s) => s.fine !== true);
  const more = shown.filter((s) => s.fine === true);
  return (
    <>
      {rough.map((def) => <SettingRow key={def.path} doc={doc} unitKey={unitKey} def={def} onChange={onChange} busy={busy} />)}
      {more.length > 0 && (
        <details className="wk-fold" open={fine} onToggle={(e) => setFine((e.target as HTMLDetailsElement).open)}>
          <summary>{t('communities.unit.moreSettings')}</summary>
          {more.map((def) => <SettingRow key={def.path} doc={doc} unitKey={unitKey} def={def} onChange={onChange} busy={busy} />)}
        </details>
      )}
    </>
  );
}

/* -- Krok 2: jednostki pod nią, grono ------------------------------------------------------------ */

function Structure({ doc, unitKey, onChange, busy, onOpen }: { doc: CommunityDoc; unitKey: string; onChange: Edit; busy: boolean; onOpen?: (key: string) => void }) {
  const t = useT();
  const here = findUnit(doc, unitKey)!.unit;
  const [name, setName] = useState('');
  const [plan, setPlan] = useState(here.units?.find((u) => u.from !== undefined)?.from ?? '');
  const [count, setCount] = useState(1);
  const council = councilOf(doc, here);
  const ps = positionsOf(doc, here);
  const below = [...new Map((here.units ?? []).flatMap((c) => positionsOf(doc, c)).map((p) => [p.key, p])).values()];
  const add = () => {
    let next = doc;
    const n = Math.max(1, Math.min(50, count));
    for (let i = 1; i <= n; i += 1) {
      const label = n === 1 ? name.trim() : `${name.trim()} ${i}`;
      next = addUnit(next, unitKey, { name: label, ...(plan === '' ? {} : { from: plan }) });
    }
    onChange(next);
    setName('');
  };
  const setCouncil = (c: typeof council | null) => onChange(updateUnit(doc, unitKey, (u) => {
    const { council: _c, ...rest } = u;
    return c === null ? rest : { ...rest, council: c };
  }));
  return (
    <>
      <Settings doc={doc} unitKey={unitKey} step={2} onChange={onChange} busy={busy} />
      <h4 className="wk-h3">{t('communities.unit.unitsUnder', { name: here.name })}</h4>
      {(here.units ?? []).length === 0 ? <p className="wk-note">{t('communities.unit.noChildren')}</p> : (
        <ul className="wk-cm-children">
          {(here.units ?? []).map((c) => (
            <li key={c.key} className={c.remove ? 'is-removed' : undefined}>
              {onOpen ? <button type="button" className="wk-link-btn" onClick={() => onOpen(c.key)}>{c.name}</button> : c.name}
              {c.from && <span className="wk-tag">{t('communities.unit.planTag', { name: doc.blueprints.find((b) => b.key === c.from)?.name ?? c.from })}</span>}
              {c.remove && <span className="wk-tag">{t('communities.unit.dissolved')}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="wk-cm-inline">
        <label className="wk-field"><span>{t('communities.unit.newUnitName')}</span><input value={name} disabled={busy} placeholder={t('communities.unit.newUnitPlaceholder')} onChange={(e) => setName(e.target.value)} /></label>
        <label className="wk-field"><span>{t('communities.unit.fromBlueprint')}</span>
          <select value={plan} disabled={busy} onChange={(e) => setPlan(e.target.value)}>
            <option value="">{t('communities.unit.noBlueprint')}</option>
            {doc.blueprints.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}
          </select>
        </label>
        <label className="wk-field wk-cm-narrow"><span>{t('communities.unit.howMany')}</span><input type="number" min={1} max={50} value={count} disabled={busy} onChange={(e) => setCount(Number(e.target.value) || 1)} /></label>
        <button type="button" className="wk-btn wk-btn-line" disabled={busy || name.trim() === ''} onClick={add} data-cm-add-unit="">{t('common.add')}</button>
      </div>
      {valueOf(doc, unitKey, 'structure.council') === true && (
        <div className="wk-cm-box">
          <h4 className="wk-h3">{t('communities.unit.council')}</h4>
          {council === undefined ? (
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy}
              onClick={() => setCouncil({ key: `grono-${unitKey}`.slice(0, 40), name: t('communities.unit.councilName', { name: here.name }), own: ps.filter((p) => p.rights === 'lead' || p.rights === 'accompany').map((p) => p.key), below: below.filter((p) => p.rights === 'lead').map((p) => p.key) })}>
              {t('communities.unit.createCouncil')}
            </button>
          ) : (
            <>
              <label className="wk-field"><span>{t('common.name')}</span><input value={council.name} disabled={busy} onChange={(e) => setCouncil({ ...council, name: e.target.value })} /></label>
              <span className="wk-cm-setting-label">{t('communities.unit.fromThisUnit')}</span>
              <div className="wk-cm-checks">
                {ps.map((p) => (
                  <label key={p.key}><input type="checkbox" checked={council.own.includes(p.key)} disabled={busy}
                    onChange={(e) => setCouncil({ ...council, own: e.target.checked ? [...council.own, p.key] : council.own.filter((k) => k !== p.key) })} /> {p.name}</label>
                ))}
              </div>
              <span className="wk-cm-setting-label">{t('communities.unit.fromEachBelow')}</span>
              <div className="wk-cm-checks">
                {below.map((p) => (
                  <label key={p.key}><input type="checkbox" checked={council.below.includes(p.key)} disabled={busy}
                    onChange={(e) => setCouncil({ ...council, below: e.target.checked ? [...council.below, p.key] : council.below.filter((k) => k !== p.key) })} /> {p.name}</label>
                ))}
              </div>
              <p className="wk-note">{t('communities.unit.councilNote')}</p>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* -- Krok 3: pozycje ----------------------------------------------------------------------------- */

function Positions({ doc, unitKey, onChange, busy }: { doc: CommunityDoc; unitKey: string; onChange: Edit; busy: boolean }) {
  const t = useT();
  const here = findUnit(doc, unitKey)!.unit;
  const plan = blueprintOf(doc, here);
  const fromPlan = new Set(plan?.positions ?? []);
  const active = new Set(positionsOf(doc, here).map((p) => p.key));
  const [name, setName] = useState('');
  const [rights, setRights] = useState<Rights>('member');
  const [pair, setPair] = useState(false);
  const toggle = (key: string, on: boolean) => onChange(setUnitPositions(doc, unitKey, on ? [...active, key] : [...active].filter((k) => k !== key)));
  const add = () => {
    const key = freePositionKey(doc, name);
    const next = upsertPosition(doc, { key, name: name.trim(), rights, ...(pair ? { pair: true } : {}) });
    onChange(setUnitPositions(next, unitKey, [...active, key]));
    setName(''); setPair(false);
  };
  return (
    <>
      <p className="wk-note">{t('communities.unit.positionsNote', { rights: RIGHTS.map((r) => `${r.label} — ${r.says}`).join('; ') })}</p>
      <ul className="wk-cm-positions">
        {doc.positions.map((p) => (
          <li key={p.key} data-position={p.key}>
            <label>
              <input type="checkbox" checked={active.has(p.key)} disabled={busy || fromPlan.has(p.key)} onChange={(e) => toggle(p.key, e.target.checked)} />
              <strong>{p.name}</strong> <span className="wk-tag">{rightsLabel(p.rights)}</span>{p.pair && <span className="wk-tag">{t('communities.unit.pairTag')}</span>}
              {fromPlan.has(p.key) && <span className="wk-cm-source is-blueprint">{t('communities.source.blueprint', { name: plan!.name })}</span>}
            </label>
            {active.has(p.key) && <span className="wk-cm-meta">{t('communities.unit.holders', { names: holdersOf(doc, unitKey, p.key).map((h) => h.name).join(', ') || t('communities.unit.nobody') })}</span>}
            <details className="wk-fold">
              <summary>{t('common.more')}</summary>
              <div className="wk-cm-inline">
                <label className="wk-field"><span>{t('common.name')}</span><input value={p.name} disabled={busy} onChange={(e) => onChange(upsertPosition(doc, { ...p, name: e.target.value }))} /></label>
                <label className="wk-field"><span>{t('communities.unit.rights')}</span>
                  <select value={p.rights} disabled={busy} onChange={(e) => onChange(upsertPosition(doc, { ...p, rights: e.target.value as Rights }))}>
                    {RIGHTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </label>
                <label className="wk-field"><span>{t('communities.unit.assign')}</span>
                  <select value={p.assign ?? ''} disabled={busy} onChange={(e) => { const { assign: _a, ...rest } = p; onChange(upsertPosition(doc, e.target.value === '' ? rest : { ...rest, assign: e.target.value as Assign })); }}>
                    <option value="">—</option>
                    {Object.entries(ASSIGN_WORD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="wk-field"><span>{t('communities.unit.term')}</span><input value={p.term ?? ''} disabled={busy} placeholder={t('communities.unit.termPlaceholder')} onChange={(e) => onChange(upsertPosition(doc, { ...p, term: e.target.value }))} /></label>
                <label className="wk-field wk-cm-narrow"><span>{t('communities.unit.need')}</span><input type="number" min={0} value={p.need ?? ''} disabled={busy}
                  onChange={(e) => { const { need: _n, ...rest } = p; const n = Number(e.target.value); onChange(upsertPosition(doc, n > 0 ? { ...rest, need: n } : rest)); }} /></label>
                <label className="wk-check"><input type="checkbox" checked={p.pair === true} disabled={busy} onChange={(e) => onChange(upsertPosition(doc, { ...p, pair: e.target.checked }))} /> {t('communities.unit.heldByPair')}</label>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <div className="wk-cm-inline">
        <label className="wk-field"><span>{t('communities.unit.newPosition')}</span><input value={name} disabled={busy} placeholder={t('communities.unit.newPositionPlaceholder')} onChange={(e) => setName(e.target.value)} /></label>
        <label className="wk-field"><span>{t('communities.unit.rights')}</span>
          <select value={rights} disabled={busy} onChange={(e) => setRights(e.target.value as Rights)}>
            {RIGHTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label className="wk-check"><input type="checkbox" checked={pair} disabled={busy} onChange={(e) => setPair(e.target.checked)} /> {t('communities.unit.pairTag')}</label>
        <button type="button" className="wk-btn wk-btn-line" disabled={busy || name.trim() === ''} onClick={add} data-cm-add-position="">{t('communities.unit.addPosition')}</button>
      </div>
    </>
  );
}

/* -- Krok 4: pola osób ---------------------------------------------------------------------------- */

function Fields({ doc, onChange, busy }: { doc: CommunityDoc; onChange: Edit; busy: boolean }) {
  const t = useT();
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<FieldKind>('line');
  const [options, setOptions] = useState('');
  const [secret, setSecret] = useState(false);
  const has = new Set(doc.fields.map((f) => f.key));
  return (
    <div className="wk-cm-box">
      <h4 className="wk-h3">{t('communities.unit.personData')}</h4>
      <div className="wk-cm-chips">
        {FIELD_PRESETS.filter((f) => !has.has(f.key)).map((f) => (
          <button key={f.key} type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} onClick={() => onChange({ ...doc, fields: [...doc.fields, { ...f }] })}>+ {f.label}</button>
        ))}
      </div>
      {doc.fields.length > 0 && (
        <ul className="wk-cm-children">
          {doc.fields.map((f) => (
            <li key={f.key}>
              {f.label} <span className="wk-tag">{f.kind}</span>
              <label className="wk-check"><input type="checkbox" checked={f.leadersOnly === true} disabled={busy}
                onChange={(e) => onChange({ ...doc, fields: doc.fields.map((x) => (x.key === f.key ? { ...x, leadersOnly: e.target.checked } : x)) })} /> {t('communities.unit.leadersOnly')}</label>
              <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onChange({ ...doc, fields: doc.fields.filter((x) => x.key !== f.key) })}>{t('common.remove')}</button>
            </li>
          ))}
        </ul>
      )}
      <details className="wk-fold">
        <summary>{t('communities.unit.ownField')}</summary>
        <div className="wk-cm-inline">
          <label className="wk-field"><span>{t('communities.unit.fieldLabel')}</span><input value={label} disabled={busy} onChange={(e) => setLabel(e.target.value)} /></label>
          <label className="wk-field"><span>{t('communities.unit.fieldKind')}</span><select value={kind} disabled={busy} onChange={(e) => setKind(e.target.value as FieldKind)}>{FIELD_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
          {kind === 'choice' && <label className="wk-field"><span>{t('communities.unit.fieldOptions')}</span><input value={options} disabled={busy} onChange={(e) => setOptions(e.target.value)} /></label>}
          <label className="wk-check"><input type="checkbox" checked={secret} disabled={busy} onChange={(e) => setSecret(e.target.checked)} /> {t('communities.unit.leadersOnly')}</label>
          <button type="button" className="wk-btn wk-btn-line" disabled={busy || label.trim() === ''} onClick={() => {
            const base = freePositionKey({ ...doc, positions: doc.fields.map((f) => ({ key: f.key, name: f.label, rights: 'member' as const })) }, label);
            onChange({ ...doc, fields: [...doc.fields, { key: base, label: label.trim(), kind, ...(kind === 'choice' ? { options: options.split(',').map((o) => o.trim()).filter((o) => o !== '') } : {}), ...(secret ? { leadersOnly: true } : {}) }] });
            setLabel(''); setOptions(''); setSecret(false);
          }}>{t('communities.unit.addField')}</button>
        </div>
      </details>
    </div>
  );
}

/* -- Das Ganze ------------------------------------------------------------------------------------- */

export function UnitSettings({ doc, unitKey, onChange, busy = false, only, onOpen, areaHref }: {
  doc: CommunityDoc;
  unitKey: string;
  onChange: Edit;
  busy?: boolean;
  /** Nur dieser Schritt (die geführte Einrichtung). */
  only?: Step;
  /** Eine Einheit darunter öffnen. */
  onOpen?: (key: string) => void;
  /** Der Bereich dieser Einheit in „Obszary" (wenn es ihn schon gibt). */
  areaHref?: string | null;
}) {
  const t = useT();
  const flat = findUnit(doc, unitKey);
  const [bpName, setBpName] = useState('');
  if (flat === undefined) return <p className="wk-note">{t('communities.unit.notInCommunity')}</p>;
  const u = flat.unit;
  const steps: readonly Step[] = only === undefined ? [1, 2, 3, 4, 5] : [only];
  const body = (step: Step) => {
    if (step === 2) return <Structure doc={doc} unitKey={unitKey} onChange={onChange} busy={busy} onOpen={onOpen} />;
    if (step === 3) return <Positions doc={doc} unitKey={unitKey} onChange={onChange} busy={busy} />;
    if (step === 4) return <><Settings doc={doc} unitKey={unitKey} step={4} onChange={onChange} busy={busy} /><Fields doc={doc} onChange={onChange} busy={busy} /></>;
    return <Settings doc={doc} unitKey={unitKey} step={step} onChange={onChange} busy={busy} />;
  };
  return (
    <div className="wk-cm-unit" data-unit-settings={unitKey}>
      {only === undefined && (
        <div className="wk-cm-inline">
          <label className="wk-field"><span>{t('communities.unit.unitName')}</span><input value={u.name} disabled={busy} onChange={(e) => onChange(updateUnit(doc, unitKey, (x) => ({ ...x, name: e.target.value })))} /></label>
          <label className="wk-field"><span>{t('communities.unit.areaKind')}</span>
            <select value={u.kind ?? ''} disabled={busy} onChange={(e) => onChange(updateUnit(doc, unitKey, (x) => { const { kind: _k, ...rest } = x; return e.target.value === '' ? rest : { ...rest, kind: e.target.value as ProfileKind }; }))}>
              <option value="">{blueprintOf(doc, u)?.kind ? t('communities.unit.kindFromPlan', { kind: blueprintOf(doc, u)!.kind! }) : t('communities.unit.kindGroup')}</option>
              {PROFILE_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
            </select>
          </label>
          {flat.parent !== null && (
            <label className="wk-field"><span>{t('communities.unit.blueprint')}</span>
              <select value={u.from ?? ''} disabled={busy} onChange={(e) => onChange(updateUnit(doc, unitKey, (x) => { const { from: _f, ...rest } = x; return e.target.value === '' ? rest : { ...rest, from: e.target.value }; }))}>
                <option value="">{t('communities.unit.noBlueprint')}</option>
                {doc.blueprints.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}
              </select>
            </label>
          )}
          {areaHref && <a className="wk-link" href={areaHref}>{t('communities.unit.thisArea')}</a>}
        </div>
      )}
      {steps.map((step) => (
        only === undefined ? (
          <details key={step} className="wk-cm-step" open={step === 1} data-step={step}>
            <summary><span className="wk-cm-step-no">{step}</span> {STEP_TITLES[step]}</summary>
            {body(step)}
          </details>
        ) : <div key={step} className="wk-cm-step is-open" data-step={step}>{body(step)}</div>
      ))}
      {only === undefined && (
        <div className="wk-cm-inline wk-cm-blueprint">
          <label className="wk-field"><span>{t('communities.unit.saveAsBlueprint')}</span><input value={bpName} disabled={busy} placeholder={t('communities.unit.blueprintPlaceholder')} onChange={(e) => setBpName(e.target.value)} /></label>
          <button type="button" className="wk-btn wk-btn-line" disabled={busy || bpName.trim() === ''} onClick={() => { onChange(saveAsBlueprint(doc, unitKey, bpName.trim())); setBpName(''); }}>{t('communities.unit.saveBlueprint')}</button>
        </div>
      )}
    </div>
  );
}
