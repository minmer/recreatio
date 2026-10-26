/**
 * 2026-10-26 — WAS SICH AN EINEM KNOTEN EINSTELLEN LÄSST: die Tafel neben der
 * Karte, für den gewählten Knoten. Jede Art hat ihre Felder; was nicht
 * gebraucht wird (Anfang, Ende), sagt in einem Satz, was der Knoten tut.
 */

import { EditFeasts } from './EditFeasts';
import { EditSeason } from './EditSeason';
import { EditSlots } from './EditSlots';
import { EditTest } from './EditTest';
import type { RecordList, SchemeChoice, SchemeField } from '../scheme';
import {
  NODE_INFO, type FeastsData, type FlowNode, type IfData, type MessageData, type RecordData, type SeasonData, type SetData,
  type SlotsData
} from './flowModel';
import { PLACEHOLDERS } from './FlowNodes';

/** Ein Platzhalter ans Ende des Textes. */
function Placeholders({ onPick, disabled }: { onPick: (token: string) => void; disabled: boolean }) {
  return (
    <div className="wk-flow-tokens" role="group" aria-label="Wstaw do tekstu">
      {PLACEHOLDERS.map((p) => (
        <button key={p.token} type="button" className="wk-flow-token" disabled={disabled} title={p.says} onClick={() => onPick(p.token)}>
          {p.token}
        </button>
      ))}
    </div>
  );
}

function SetEditor({ data, onChange, fields, disabled }: {
  data: SetData; onChange: (data: SetData) => void; fields: readonly SchemeField[]; disabled: boolean;
}) {
  const known = fields.some((f) => f.key === data.key);
  return (
    <div className="wk-flow-stack">
      <label className="wk-field">
        <span>Co ustawić</span>
        <select value={data.target} disabled={disabled}
          onChange={(e) => {
            const target = e.target.value as SetData['target'];
            onChange({ ...data, target, key: target === 'title' ? undefined : target === 'field' ? fields[0]?.key ?? '' : 'colour' });
          }}>
          <option value="title">tytuł mszy</option>
          <option value="field">pole schematu</option>
          <option value="var">zmienną (np. colour)</option>
        </select>
      </label>

      {data.target === 'field' && (
        fields.length > 0 ? (
          <label className="wk-field">
            <span>Pole</span>
            <select value={data.key ?? ''} disabled={disabled} onChange={(e) => onChange({ ...data, key: e.target.value })}>
              {!known && <option value={data.key ?? ''}>{data.key ? `${data.key} (nie ma w schemacie)` : '— wybierz pole —'}</option>}
              {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </label>
        ) : (
          <label className="wk-field">
            <span>Klucz pola schematu</span>
            <input value={data.key ?? ''} disabled={disabled} className="wk-flow-key" placeholder="np. kolor"
              onChange={(e) => onChange({ ...data, key: e.target.value.trim() })} />
          </label>
        )
      )}

      {data.target === 'var' && (
        <label className="wk-field">
          <span>Nazwa zmiennej</span>
          <input value={data.key ?? ''} disabled={disabled} className="wk-flow-key" placeholder="np. colour"
            onChange={(e) => onChange({ ...data, key: e.target.value.trim() })} />
        </label>
      )}

      <label className="wk-field">
        <span>Wartość</span>
        <input value={data.value} disabled={disabled} placeholder="np. {celebration}" onChange={(e) => onChange({ ...data, value: e.target.value })} />
      </label>
      <Placeholders disabled={disabled} onPick={(token) => onChange({ ...data, value: `${data.value}${token}` })} />
      {data.target === 'var' && data.key === 'colour' && (
        <p className="wk-flow-note">Zmienna „colour” to kolor mszy: wpisuje się go potem do pola (np. „Ustaw pole Kolor = {'{colour}'}”).</p>
      )}
    </div>
  );
}

function RecordEditor({ data, onChange, lists, disabled }: {
  data: RecordData; onChange: (data: RecordData) => void; lists: readonly RecordList[]; disabled: boolean;
}) {
  const list = lists.find((l) => l.key === data.list);
  return (
    <div className="wk-flow-stack">
      {lists.length > 0 ? (
        <label className="wk-field">
          <span>Lista</span>
          <select value={data.list} disabled={disabled} onChange={(e) => onChange({ ...data, list: e.target.value, mode: undefined })}>
            {list === undefined && <option value={data.list}>{data.list ? `${data.list} (nie ma w schemacie)` : '— wybierz listę —'}</option>}
            {lists.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </label>
      ) : (
        <label className="wk-field">
          <span>Klucz listy</span>
          <input value={data.list} disabled={disabled} className="wk-flow-key" placeholder="intencje" onChange={(e) => onChange({ ...data, list: e.target.value.trim() })} />
        </label>
      )}

      {(list?.modes ?? []).length > 0 && (
        <label className="wk-field">
          <span>Rodzaj</span>
          <select value={data.mode ?? ''} disabled={disabled} onChange={(e) => onChange({ ...data, mode: e.target.value === '' ? undefined : e.target.value })}>
            <option value="">— bez rodzaju —</option>
            {(list?.modes ?? []).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
      )}

      <label className="wk-field">
        <span>{list?.textLabel ?? 'Tekst wpisu'}</span>
        <input value={data.text} disabled={disabled} placeholder="np. Za parafian" onChange={(e) => onChange({ ...data, text: e.target.value })} />
      </label>
      <Placeholders disabled={disabled} onPick={(token) => onChange({ ...data, text: `${data.text}${token}` })} />
      <p className="wk-flow-note">Wpis powstaje razem z mszą i jest oznaczony „z reguły” — kancelaria może go zmienić albo usunąć.</p>
    </div>
  );
}

export function FlowPanel({ node, kind, onData, onRemove, fields = [], lists = [], modes, slotKeys = [], readOnly = false }: {
  node: FlowNode;
  kind: 'plan' | 'rule';
  onData: (data: Record<string, unknown>) => void;
  onRemove: () => void;
  fields?: readonly SchemeField[];
  lists?: readonly RecordList[];
  modes?: readonly SchemeChoice[];
  slotKeys?: readonly { readonly key: string; readonly label: string }[];
  readOnly?: boolean;
}) {
  const info = NODE_INFO[node.type];
  const d = node.data;
  /* Die Daten eines Knotens sind ein offenes Objekt — hier zurück in ihre Gestalt. */
  const as = <T,>() => d as unknown as T;
  const put = (data: object) => onData(data as Record<string, unknown>);

  return (
    <div className="wk-flow-panel-in">
      <div className="wk-flow-panel-head">
        <h3 className="wk-flow-title">{info.label}</h3>
        {!readOnly && <button type="button" className="wk-link-btn wk-danger" onClick={onRemove}>Usuń węzeł</button>}
      </div>
      <p className="wk-flow-note">{info.says}</p>

      {node.type === 'season' && <EditSeason data={as<SeasonData>()} disabled={readOnly} onChange={put} />}
      {node.type === 'feasts' && <EditFeasts data={as<FeastsData>()} disabled={readOnly} onChange={put} />}
      {node.type === 'if' && (
        <EditTest test={as<IfData>().test} kind={kind} disabled={readOnly} modes={modes} fields={fields} slotKeys={slotKeys}
          onChange={(test) => put({ ...d, test })} />
      )}
      {node.type === 'set' && <SetEditor data={as<SetData>()} fields={fields} disabled={readOnly} onChange={put} />}
      {node.type === 'slots' && <EditSlots data={as<SlotsData>()} disabled={readOnly} onChange={put} />}
      {node.type === 'record' && <RecordEditor data={as<RecordData>()} lists={lists} disabled={readOnly} onChange={put} />}
      {(node.type === 'allow' || node.type === 'wait' || node.type === 'refuse') && (
        <label className="wk-field">
          <span>{node.type === 'refuse' ? 'Komunikat dla dodającego' : 'Komunikat (nieobowiązkowo)'}</span>
          <input value={as<MessageData>().message ?? ''} disabled={readOnly}
            placeholder={node.type === 'refuse' ? 'np. Ta msza ma już intencję.' : node.type === 'wait' ? 'np. Kancelaria potwierdzi wpis.' : 'np. Dziękujemy — intencja przyjęta.'}
            onChange={(e) => put({ ...d, message: e.target.value })} />
        </label>
      )}
    </div>
  );
}

export default FlowPanel;
