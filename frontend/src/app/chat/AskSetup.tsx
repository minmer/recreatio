/**
 * 0081 — „NAPISZ DO NAS" EINRICHTEN: wer antwortet (Rollen) und wer schreiben
 * darf (die Menschen bestimmter Formulare).
 *
 * <b>Die Rollen bekommen einen eigenen Bereich</b> — wie eine Gruppe in den
 * Rozmowy: Zugang zur Rozmowa IST Zugang zum Bereich (0052). Der Baustein
 * trägt ihn als seinen Bereich (`module.area_id`); sein Name ist, was die
 * Person mit dem Link liest („Napisz do: …"). Wer ihn anlegt, legt ihn als
 * eine der gewählten eigenen Rollen an — sonst als seine Person, und ist dann
 * selbst dabei.
 *
 * <b>Die Formulare</b> hängen am Baustein wie an jedem Ding mit Odbiorcy
 * (`AudienceForms`, Art `module`, Zugang `one`).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createArea, dropFromArea, joinArea, loadAreas, loadMembers, renameArea, type AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { inheritController, publicAreaController, controllerChanged, type ControllerInfo } from '../areas/controllers';
import { setParent } from '../communities/communityStore';
import { loadPage } from '../pages/page';
import { askParents, suggestedAskParent } from './askParent';
import { loadAudienceForms, type AudienceForm } from '../areas/audience';
import { AudienceForms } from '../areas/AudienceForms';
import { areaKeys, loadAreaNames, loadChats, openNames, setMemberName, type ChatRow, type Invitee } from './chat';
import { useMe, useWho } from '../core/me';
import { loadModules, updateModule, type ModuleRow } from '../modules/module';
import type { EditorProps } from '../pages/part';
import { InviteePicker, KIND, nameOf, useKnown, useKnownInAreas } from '../roles/RolePicker';
import { WorkspaceError } from '../core/session';
import { askText } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import { useT } from '../core/i18n';

interface Answerer {
  readonly roleId: string;
  readonly kind: string;
  readonly name: string;
  readonly leads: boolean;
  readonly mine: boolean;
}

const LEADS = ['admin', 'certify'];

export function AskSetup({ raw, onSet, ctx, busy }: EditorProps) {
  const t = useT();
  const who = useWho();
  const me = useMe(who);
  const youMark = ` (${t('chat.askSetup.youMark')})`;
  const plainName = (n: string) => (n.endsWith(youMark) ? n.slice(0, -youMark.length) : n);
  const moduleId = ctx.moduleId ?? null;

  const [row, setRow] = useState<ModuleRow | null | undefined>(undefined);
  const [answerers, setAnswerers] = useState<readonly Answerer[]>([]);
  const [forms, setForms] = useState<readonly AudienceForm[]>([]);
  const [chats, setChats] = useState<readonly ChatRow[]>([]);
  const [adding, setAdding] = useState<readonly Invitee[]>([]);
  const [shownAs, setShownAs] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [parentId, setParentId] = useState('');
  const [controller, setController] = useState<ControllerInfo | null>(null);
  const [parentController, setParentController] = useState<ControllerInfo | null | undefined>(undefined);
  const [parentFailed, setParentFailed] = useState(false);

  const areaId = row?.areaId ?? null;

  const look = useCallback(async () => {
    if (moduleId === null || me == null) return;
    const [modules, areaList] = await Promise.all([loadModules(), loadAreas()]);
    const found = modules.modules.find((m) => m.moduleId === moduleId) ?? null;
    setAreas(areaList.areas);
    const replyArea = areaList.areas.find((a) => a.areaId === found?.areaId);
    const paths = found?.pages.length ? found.pages : ctx.path === null ? [] : [ctx.path];
    const pages = await Promise.all(paths.map((path) => loadPage(path).catch(() => null)));
    setParentId(replyArea?.parentAreaId ?? suggestedAskParent(askParents(areaList.areas, found?.areaId ?? null), pages.map((p) => p?.responsible?.areaId)));
    setController(found?.areaId == null ? null : (await publicAreaController(found.areaId)).controller);
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
  }, [moduleId, me, ctx.path]);

  useEffect(() => {
    let alive = true;
    setParentController(undefined);
    setParentFailed(false);
    if (parentId === '') { setParentController(null); return; }
    void publicAreaController(parentId).then(
      (out) => { if (alive) setParentController(out.controller); },
      () => { if (alive) { setParentController(null); setParentFailed(true); } });
    return () => { alive = false; };
  }, [parentId]);

  useEffect(() => { void look().catch(() => setRow(null)); }, [look]);
  useEffect(() => { void loadChats().then((found) => setChats(found.chats)).catch(() => undefined); }, []);

  /* Wen ich anbieten kann: zuerst meine eigenen Rollen, dann die aus meinen Bereichen und Rozmowy. */
  const fromChats = useKnown(me ?? null, chats);
  const fromAreas = useKnownInAreas(me ?? null);
  const known = useMemo<readonly Invitee[]>(() => {
    if (me == null) return [];
    const out = new Map<string, Invitee>();
    for (const r of me.roles) out.set(r.id, { roleId: r.id, kind: r.kind as Invitee['kind'], wrapPublicKey: r.wrapPublicKey, name: `${me.names.get(r.id) ?? KIND[r.kind] ?? t('chat.askSetup.role')}${youMark}` });
    for (const one of [...fromAreas, ...fromChats]) if (!out.has(one.roleId)) out.set(one.roleId, one);
    return [...out.values()].filter((one) => !answerers.some((a) => a.roleId === one.roleId));
  }, [me, fromAreas, fromChats, answerers, youMark, t]);

  const run = async (what: string, todo: () => Promise<void>) => {
    setWorking(what);
    setFailed(null);
    try { await todo(); await look(); } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('common.failed'));
    } finally { setWorking(null); }
  };

  /* Wer hineinlässt: eine meiner Rollen, die den Bereich führt. */
  const issuer = answerers.find((a) => a.mine && a.leads)?.roleId ?? null;
  const writer = answerers.find((a) => a.mine)?.roleId ?? null;

  const join = async (target: string, by: string, list: readonly Invitee[]) => {
    if (me == null) return;
    for (const one of list) {
      await joinArea(me.ring, target, { id: one.roleId, kind: one.kind, wrapPublicKey: one.wrapPublicKey }, by, 'write');
      const plain = plainName(one.name).trim();
      if (plain !== '') await setMemberName(target, await areaKeys(me.ring, target, true), one.roleId, plain, by).catch(() => undefined);
    }
  };

  /* Zum ersten Mal: den Bereich anlegen — als eine der gewählten eigenen Rollen, sonst als meine Person. */
  const create = () => void run(t('common.saving'), async () => {
    if (me == null || moduleId === null) return;
    if (adding.length === 0) throw new WorkspaceError(t('chat.askSetup.pickAnswerers'));
    const called = (shownAs.trim() || adding.map((a) => plainName(a.name)).join(', ')).slice(0, 200);
    const own = adding.find((a) => me.ring.maySign(a.roleId));
    const creator = me.roles.find((r) => r.id === own?.roleId) ?? me.person;
    const made = await createArea(me.ring, creator, called, parentId || undefined);
    await updateModule(moduleId, { areaId: made.areaId });
    const myName = me.names.get(creator.id);
    if (myName !== undefined) await setMemberName(made.areaId, new Map([[made.epoch, made.key]]), creator.id, myName, creator.id).catch(() => undefined);
    await join(made.areaId, creator.id, adding.filter((a) => a.roleId !== creator.id));
    setAdding([]);
  });

  if (moduleId === null) {
    return <p className="wk-hint">{t('chat.askSetup.saveFirst')}</p>;
  }
  if (who === null) return <p className="wk-hint">{t('chat.askSetup.signIn')}</p>;
  if (me === null) return <p className="wk-hint">{t('chat.askSetup.unlock')}</p>;
  if (row === undefined || me === undefined) return <Loading label={t('common.loading')} />;
  if (row === null) return <p className="wk-hint">{t('chat.askSetup.saveFirst')}</p>;

  const blocked = busy || working !== null;
  const ownArea = areas.find((a) => a.areaId === areaId);
  const parents = askParents(areas, areaId);
  const inherits = controller !== null && controller.fromAreaId !== areaId;
  const parentChanged = parentId !== (ownArea?.parentAreaId ?? '');
  const saveParent = () => void run(t('common.saving'), async () => {
    if (areaId === null || parentId === '') return;
    if (parentChanged) await setParent(areaId, parentId);
    if (controller?.fromAreaId === areaId) await inheritController(areaId);
    controllerChanged(areaId);
  });

  return (
    <section className="wk-ask-setup">
      <label className="wk-field">
        <span>{t('chat.askSetup.heading')}</span>
        <input value={raw.title ?? ''} placeholder={t('chat.askSetup.headingHint')} disabled={blocked} onChange={(e) => onSet({ title: e.target.value })} />
      </label>

      <h4 className="pb-h">{t('chat.askSetup.responsibility')}</h4>
      <p className="wk-hint">{t('chat.askSetup.parentHint')}</p>
      <AreaPick areas={areas} only={parents} value={parentId} onChange={setParentId}
        extras={areaId === null || ownArea?.parentAreaId == null ? [{ value: '', label: t('chat.askSetup.standalone') }] : []}
        label={t('chat.askSetup.parent')} disabled={blocked || (areaId !== null && ownArea?.myLevel !== 'admin')} />
      {parentId !== '' && parentController === undefined ? <Loading lines={1} />
        : parentFailed ? <p className="wk-error">{t('areas.ctl.loadFailed')}</p>
        : parentController === null ? <p className="wk-hint">{t('chat.askSetup.privateWithoutController')}</p>
        : parentController !== undefined && <p className="wk-note">{t('chat.askSetup.parentController', { name: parentController.name })}</p>}
      {areaId !== null && ownArea?.myLevel === 'admin' && (parentChanged || !inherits) && <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={blocked || parentId === '' || parentController === undefined || parentFailed} onClick={saveParent}>{t('chat.askSetup.useParent')}</button>
      </div>}
      {areaId !== null && inherits && !parentChanged && <p className="wk-hint">{t('chat.askSetup.inherits', { name: controller.name })}</p>}

      <h4 className="pb-h">{t('chat.askSetup.answerers')}</h4>
      {areaId === null ? (
        <>
          <p className="wk-hint">
            {t('chat.askSetup.answerersHint')}
          </p>
          <InviteePicker known={known} chosen={adding} single={false} busy={blocked} onChange={setAdding} />
          <label className="wk-field">
            <span>{t('chat.askSetup.shownAs')}</span>
            <input value={shownAs} maxLength={200} disabled={blocked}
              placeholder={adding.map((a) => plainName(a.name)).join(', ') || t('chat.askSetup.shownAsHint')}
              onChange={(e) => setShownAs(e.target.value)} />
          </label>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={blocked || adding.length === 0} onClick={create}>{t('chat.askSetup.saveAnswerers')}</button>
          </div>
        </>
      ) : (
        <>
          <ul className="wk-list">
            {answerers.map((a) => (
              <li key={a.roleId} className="wk-row">
                <span>
                  <strong>{a.name}</strong>
                  <span className="wk-row-side"> · {KIND[a.kind] ?? a.kind}{a.leads ? ` · ${t('chat.askSetup.leads')}` : ''}{a.mine ? ` · ${t('chat.askSetup.isYou')}` : ''}</span>
                </span>
                {issuer !== null && !a.leads && (
                  <button type="button" className="wk-link-btn wk-danger" disabled={blocked}
                    onClick={async () => {
                      if (!(await askText(t('chat.askSetup.removeAsk', { name: a.name })))) return;
                      void run(t('chat.askSetup.removing'), async () => { await dropFromArea(areaId, a.roleId); });
                    }}>
                    {t('common.remove')}
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
                    onClick={() => void run(t('chat.askSetup.adding'), async () => { await join(areaId, issuer, adding); setAdding([]); })}>
                    {t('chat.askSetup.addAnswerers')}
                  </button>
                </div>
              )}
              <form className="wk-inline-form" onSubmit={(e) => {
                e.preventDefault();
                void run(t('common.saving'), async () => { await renameArea(areaId, shownAs.trim()); });
              }}>
                <label className="wk-field">
                  <span>{t('chat.askSetup.shownAs')}</span>
                  <input value={shownAs} maxLength={200} disabled={blocked} onChange={(e) => setShownAs(e.target.value)} />
                </label>
                {shownAs.trim() !== '' && shownAs.trim() !== (row.areaName ?? '') && (
                  <div className="wk-actions"><button type="submit" className="wk-btn wk-btn-quiet" disabled={blocked}>{t('common.change')}</button></div>
                )}
              </form>
            </>
          )}
        </>
      )}

      {areaId === null
        ? <p className="wk-hint">{t('chat.askSetup.formsLater')}</p>
        : <AudienceForms kind="module" subjectId={moduleId} mode="one" forms={forms} byRoleId={writer} what={t('chat.askSetup.thisModule')} onChanged={() => void look()} />}

      {forms.length === 0 && areaId !== null && <p className="wk-blocker">{t('chat.askSetup.needForm')}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {working !== null && <p className="wk-hint" role="status">{working}</p>}
    </section>
  );
}
