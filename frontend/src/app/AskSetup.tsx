/**
 * 0081 — „NAPISZ DO NAS" EINRICHTEN: wer antwortet (Rollen) und wer schreiben
 * darf (die Menschen bestimmter Formulare).
 *
 * <b>Die Rollen bekommen einen eigenen Bereich</b> — wie eine Gruppe in den
 * Rozmowy: Zugang zur Rozmowa IST Zugang zum Bereich (0052). Der Baustein
 * trägt ihn als seinen Bereich (\`module.area_id\`); sein Name ist, was die
 * Person mit dem Link liest („Napisz do: …"). Wer ihn anlegt, legt ihn als
 * eine der gewählten eigenen Rollen an — sonst als seine Person, und ist dann
 * selbst dabei.
 *
 * <b>Die Formulare</b> hängen am Baustein wie an jedem Ding mit Odbiorcy
 * (\`AudienceForms\`, Art \`module\`, Zugang \`one\`).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createArea, dropFromArea, joinArea, loadMembers, renameArea } from './area';
import { loadAudienceForms, type AudienceForm } from './audience';
import { AudienceForms } from './AudienceForms';
import { areaKeys, loadAreaNames, loadChats, openNames, setMemberName, type ChatRow, type Invitee } from './chat';
import { useMe, useWho } from './me';
import { loadModules, updateModule, type ModuleRow } from './module';
import type { EditorProps } from './part';
import { InviteePicker, KIND, nameOf, useKnown, useKnownInAreas } from './RolePicker';
import { WorkspaceError } from './session';

interface Answerer {
  readonly roleId: string;
  readonly kind: string;
  readonly name: string;
  readonly leads: boolean;
  readonly mine: boolean;
}

const LEADS = ['admin', 'certify'];

export function AskSetup({ raw, onSet, ctx, busy }: EditorProps) {
  const who = useWho();
  const me = useMe(who);
  const moduleId = ctx.moduleId ?? null;

  const [row, setRow] = useState<ModuleRow | null | undefined>(undefined);
  const [answerers, setAnswerers] = useState<readonly Answerer[]>([]);
  const [forms, setForms] = useState<readonly AudienceForm[]>([]);
  const [chats, setChats] = useState<readonly ChatRow[]>([]);
  const [adding, setAdding] = useState<readonly Invitee[]>([]);
  const [shownAs, setShownAs] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const areaId = row?.areaId ?? null;

  const look = useCallback(async () => {
    if (moduleId === null || me == null) return;
    const found = (await loadModules()).modules.find((m) => m.moduleId === moduleId) ?? null;
    setRow(found);
    setShownAs(found?.areaName ?? '');
    if (found?.areaId == null) { setAnswerers([]); setForms([]); return; }

    const [{ members }, { names: sealed }, { forms: attached }] = await Promise.all([
      loadMembers(found.areaId), loadAreaNames(found.areaId), loadAudienceForms('module', moduleId)
    ]);
    let names = new Map<string, string>();
    try { names = await openNames(await areaKeys(me.ring, found.areaId, true), found.areaId, sealed); } catch { /* ohne Namen */ }
    setAnswerers(members.filter((m) => m.kind !== 'account').map((m) => ({
      roleId: m.roleId, kind: m.kind, name: nameOf(m.roleId, m.kind, names, me.names),
      leads: m.capabilities.some((c) => LEADS.includes(c)), mine: me.ring.has(m.roleId)
    })));
    setForms(attached);
  }, [moduleId, me]);

  useEffect(() => { void look().catch(() => setRow(null)); }, [look]);
  useEffect(() => { void loadChats().then((found) => setChats(found.chats)).catch(() => undefined); }, []);

  /* Wen ich anbieten kann: zuerst meine eigenen Rollen, dann die aus meinen Bereichen und Rozmowy. */
  const fromChats = useKnown(me ?? null, chats);
  const fromAreas = useKnownInAreas(me ?? null);
  const known = useMemo<readonly Invitee[]>(() => {
    if (me == null) return [];
    const out = new Map<string, Invitee>();
    for (const r of me.roles) out.set(r.id, { roleId: r.id, kind: r.kind as Invitee['kind'], wrapPublicKey: r.wrapPublicKey, name: `${me.names.get(r.id) ?? KIND[r.kind] ?? 'rola'} (Ty)` });
    for (const one of [...fromAreas, ...fromChats]) if (!out.has(one.roleId)) out.set(one.roleId, one);
    return [...out.values()].filter((one) => !answerers.some((a) => a.roleId === one.roleId));
  }, [me, fromAreas, fromChats, answerers]);

  const run = async (what: string, todo: () => Promise<void>) => {
    setWorking(what);
    setFailed(null);
    try { await todo(); await look(); } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally { setWorking(null); }
  };

  /* Wer hineinlässt: eine meiner Rollen, die den Bereich führt. */
  const issuer = answerers.find((a) => a.mine && a.leads)?.roleId ?? null;
  const writer = answerers.find((a) => a.mine)?.roleId ?? null;

  const join = async (target: string, by: string, list: readonly Invitee[]) => {
    if (me == null) return;
    for (const one of list) {
      await joinArea(me.ring, target, { id: one.roleId, kind: one.kind, wrapPublicKey: one.wrapPublicKey }, by, 'write');
      const plain = one.name.replace(/ \(Ty\)$/, '').trim();
      if (plain !== '') await setMemberName(target, await areaKeys(me.ring, target, true), one.roleId, plain, by).catch(() => undefined);
    }
  };

  /* Zum ersten Mal: den Bereich anlegen — als eine der gewählten eigenen Rollen, sonst als meine Person. */
  const create = () => void run('Zapisywanie…', async () => {
    if (me == null || moduleId === null) return;
    if (adding.length === 0) throw new WorkspaceError('Wybierz, kto odpowiada.');
    const called = (shownAs.trim() || adding.map((a) => a.name.replace(/ \(Ty\)$/, '')).join(', ')).slice(0, 200);
    const own = adding.find((a) => me.ring.maySign(a.roleId));
    const creator = me.roles.find((r) => r.id === own?.roleId) ?? me.person;
    const made = await createArea(me.ring, creator, called);
    await updateModule(moduleId, { areaId: made.areaId });
    const myName = me.names.get(creator.id);
    if (myName !== undefined) await setMemberName(made.areaId, new Map([[made.epoch, made.key]]), creator.id, myName, creator.id).catch(() => undefined);
    await join(made.areaId, creator.id, adding.filter((a) => a.roleId !== creator.id));
    setAdding([]);
  });

  if (moduleId === null) {
    return <p className="wk-hint">Zapisz stronę — potem wybierzesz, kto odpowiada i z których formularzy można pisać.</p>;
  }
  if (who === null) return <p className="wk-hint">Zaloguj się, żeby wybrać, kto odpowiada.</p>;
  if (me === null) return <p className="wk-hint">Odblokuj klucze (hasło), żeby wybrać, kto odpowiada.</p>;
  if (row === undefined || me === undefined) return <p className="wk-hint">Wczytywanie…</p>;
  if (row === null) return <p className="wk-hint">Zapisz stronę — potem wybierzesz, kto odpowiada i z których formularzy można pisać.</p>;

  const blocked = busy || working !== null;

  return (
    <section className="wk-ask-setup">
      <label className="wk-field">
        <span>Nagłówek</span>
        <input value={raw.title ?? ''} placeholder="np. Napisz do księdza" disabled={blocked} onChange={(e) => onSet({ title: e.target.value })} />
      </label>

      <h4 className="pb-h">Kto odpowiada</h4>
      {areaId === null ? (
        <>
          <p className="wk-hint">
            Wybierz osoby albo role (np. swoją rolę „Ksiądz"). Tylko one zobaczą rozmowy z tego modułu.
            Jeśli nie wybierzesz żadnej swojej roli, będziesz wśród nich także Ty.
          </p>
          <InviteePicker known={known} chosen={adding} single={false} busy={blocked} onChange={setAdding} />
          <label className="wk-field">
            <span>Jak ich zobaczy osoba z linkiem</span>
            <input value={shownAs} maxLength={200} disabled={blocked}
              placeholder={adding.map((a) => a.name.replace(/ \(Ty\)$/, '')).join(', ') || 'np. Ksiądz Jan'}
              onChange={(e) => setShownAs(e.target.value)} />
          </label>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={blocked || adding.length === 0} onClick={create}>Zapisz, kto odpowiada</button>
          </div>
        </>
      ) : (
        <>
          <ul className="wk-list">
            {answerers.map((a) => (
              <li key={a.roleId} className="wk-row">
                <span>
                  <strong>{a.name}</strong>
                  <span className="wk-row-side"> · {KIND[a.kind] ?? a.kind}{a.leads ? ' · prowadzi listę' : ''}{a.mine ? ' · to Ty' : ''}</span>
                </span>
                {issuer !== null && !a.leads && (
                  <button type="button" className="wk-link-btn wk-danger" disabled={blocked}
                    onClick={() => {
                      if (!window.confirm(`Usunąć „${a.name}" z odpowiadających? Rozmów, które już czytał(a), to nie zabiera.`)) return;
                      void run('Usuwanie…', async () => { await dropFromArea(areaId, a.roleId); });
                    }}>
                    Usuń
                  </button>
                )}
              </li>
            ))}
          </ul>
          {issuer !== null && (
            <>
              <InviteePicker known={known} chosen={adding} single={false} busy={blocked} onChange={setAdding} />
              {adding.length > 0 && (
                <div className="wk-actions">
                  <button type="button" className="wk-btn wk-btn-quiet" disabled={blocked}
                    onClick={() => void run('Dodawanie…', async () => { await join(areaId, issuer, adding); setAdding([]); })}>
                    Dodaj do odpowiadających
                  </button>
                </div>
              )}
              <form className="wk-inline-form" onSubmit={(e) => {
                e.preventDefault();
                void run('Zapisywanie…', async () => { await renameArea(areaId, shownAs.trim()); });
              }}>
                <label className="wk-field">
                  <span>Jak ich zobaczy osoba z linkiem</span>
                  <input value={shownAs} maxLength={200} disabled={blocked} onChange={(e) => setShownAs(e.target.value)} />
                </label>
                {shownAs.trim() !== '' && shownAs.trim() !== (row.areaName ?? '') && (
                  <div className="wk-actions"><button type="submit" className="wk-btn wk-btn-quiet" disabled={blocked}>Zmień</button></div>
                )}
              </form>
            </>
          )}
        </>
      )}

      {areaId === null
        ? <p className="wk-hint">Z których formularzy można pisać — wybierzesz, gdy zapiszesz, kto odpowiada.</p>
        : <AudienceForms kind="module" subjectId={moduleId} mode="one" forms={forms} byRoleId={writer} what="ten moduł" onChanged={() => void look()} />}

      {forms.length === 0 && areaId !== null && <p className="wk-blocker">Dołącz co najmniej jeden formularz — inaczej nikt nie może tu napisać.</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {working !== null && <p className="wk-hint" role="status">{working}</p>}
    </section>
  );
}
