/**
 * 2026-11-24 — DIE ANSICHTEN DER BAUSTEINE „Nauczyciel — moje klasy" und „Klasa" (`cogita.tsx`), ein eigenes Bündel.
 *
 * Die Lehrerin: dieselbe Konsole wie in Nauka → „Klasy" (`TeacherConsole.tsx`), mit ihrem Konto — die Baza so, wie die Seite
 * sie öffnet (`usePageBase`), die Wege führen in die Nauka der Baza. Eine Klasse: dieselbe Seite wie `#/workspace/klasa/…`
 * (`ClassPage.tsx`) — Beitreten, oder lernen als Konto oder mit dem eigenen Link.
 */

import { useMemo } from 'react';

import { useMe, useWho } from '../../core/me';
import { useT } from '../../core/i18n';
import { loadLibraries, openLibraries } from '../../library/library';
import { viewPath } from '../../routes';
import { Loading } from '../../ui/Loading';
import { ClassPage } from '../../cogita/classes/ClassPage';
import { consoleSlots } from '../../cogita/classes/consoleSlots';
import { TeacherConsole } from '../../cogita/classes/TeacherConsole';
import { usePageBase } from '../../cogita/pageBase';
import { CogitaContext, useAsync, type CogitaCtx } from '../../cogita/ui';
import type { PartContext } from '../part';
import type { ClassConfig, TeacherConfig } from './cogita';

export function TeacherModuleView({ config }: { config: TeacherConfig; ctx: PartContext }) {
  const t = useT();
  const who = useWho();
  const me = useMe(who);
  const { lib, ctx } = usePageBase(config.library);
  /* Der Name der Baza, wie die Nauka ihn zeigt (eine Klasse merkt ihn sich). */
  const name = useAsync(async () => {
    if (me == null || lib == null) return '';
    const rows = (await loadLibraries()).libraries.filter((r) => r.libraryId === lib.libraryId);
    return (await openLibraries(me.ring, rows))[0]?.name ?? '';
  }, [me, lib?.libraryId]);
  const teacher = useMemo<CogitaCtx | null>(() => (ctx === null || me == null || lib == null ? null : {
    ...ctx, me, who: who ?? null, name: name ?? '', href: (...tail: readonly string[]) => viewPath('learn', lib.libraryId, ...tail)
  }), [ctx, me, who, lib, name]);

  return (
    <section className="pb-teacher" data-part-teacher={config.library}>
      {config.title !== '' && <h2 className="wk-h2">{config.title}</h2>}
      {who === undefined || (who !== null && me === undefined) || (who !== null && lib === undefined) ? <Loading />
        : who === null || me === null ? <p className="wk-note" data-part-teacher-signin="">{t('moduleDataCogita.teacher.signIn')}</p>
        : lib === null || teacher === null ? <p className="wk-error">{t('moduleDataCogita.teacher.noBase')}</p>
        : <CogitaContext.Provider value={teacher}><TeacherConsole slots={consoleSlots} /></CogitaContext.Provider>}
    </section>
  );
}

export function ClassModuleView({ config }: { config: ClassConfig; ctx: PartContext }) {
  const who = useWho();
  if (who === undefined) return <Loading />;
  return (
    <section className="pb-class" data-part-class={config.area}>
      {config.title !== '' && <h2 className="wk-h2">{config.title}</h2>}
      <ClassPage trail={[config.area, config.library]} who={who} />
    </section>
  );
}
