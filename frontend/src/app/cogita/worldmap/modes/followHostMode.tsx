/**
 * MODUS „ICH FÜHRE DIE KLASSE" (Tryb prowadzony, die Lehrerin — `follow/followHost.ts`): läuft für diese Baza eine Folge-Stunde,
 * meldet die Karte ihren Stand (Kamera nach jeder Änderung, das Gewählte, der Modus, der Ausschnitt — hinaus nur, was sich änderte),
 * eine gespielte Erzählung ihre Schritte (`lessonLink`), und oben steht die Leiste „Na żywo". Ins Menü trägt er „Prowadź klasę na
 * żywo" ein (die Klassen, die ich leite); eine laufende Folge-Stunde nimmt er beim Öffnen wieder auf.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type { Me } from '../../../core/me';
import { myClasses } from '../../classes/classes';
import { FollowBar } from '../../follow/FollowBar';
import { reportMap, reportMapShown, reportStep, resumeFollow, startFollow, stopFollow, useFollowLive } from '../../follow/followHost';
import type { SharedCam } from '../../follow/followModel';
import type { LessonLink } from '../../lesson/lessonStep';
import type { CogitaLibrary } from '../../store';
import type { MapMode } from '../mapMode';

/** Der Spieler der Lehrerin meldet jeden Schritt an die Klasse (die Antwort nimmt er von ihr selbst). */
const FOLLOW_LINK: LessonLink = { onStep: reportStep, decide: null };

export interface FollowHost {
  readonly mode: MapMode;
  readonly leading: boolean;
  /** Über einer laufenden Erzählung (auch dort: wie viele geantwortet haben, „Pokaż wyniki"). */
  readonly runBar: ReactNode;
  /** Für `FlowPlayer`: die Schritte gehen an die Klasse. */
  readonly lessonLink: LessonLink | null;
  /** Zurück auf der Karte (nach einer Erzählung): die Klasse sieht wieder die Karte. */
  readonly backOnMap: () => void;
}

export function useFollowHostMode(input: {
  readonly lib: CogitaLibrary;
  readonly me: Me | null;
  readonly following: boolean;
  readonly viewKey: string;
  /** Der Stand, der hinausgeht (immer der jetzige). */
  readonly state: { readonly chosen: { readonly kind: string; readonly id: string } | null; readonly mode: string; readonly slice: readonly string[] };
  /** Solange ein anderer Modus die Karte hat (die Wahl einer Klasse), keine Leiste über ihr. */
  readonly quiet: boolean;
}): FollowHost {
  const { lib, me, following, viewKey } = input;
  const { live } = useFollowLive();
  /* 2026-11-25 — nur mit einer Person, die führt: eine Karte ohne (Schüler über den eigenen Link, das Verzeichnis im Przegląd) führt nie. */
  const leading = me !== null && !following && live !== null && live.libraryId.toLowerCase() === lib.libraryId.toLowerCase();
  /* Die Klassen, die ich leite (für „Prowadź klasę na żywo"); eine laufende Folge-Stunde wieder aufnehmen. */
  const [classes, setClasses] = useState<readonly { readonly areaId: string; readonly name: string }[]>([]);
  useEffect(() => {
    if (me === null || following) { setClasses([]); return undefined; }
    let alive = true;
    void myClasses(true, lib.libraryId).then((list) => {
      if (!alive) return;
      setClasses(list.map((c) => ({ areaId: c.areaId, name: c.name })));
      if (list.length > 0) void resumeFollow(me, lib.libraryId).catch(() => undefined);
    }, () => undefined);
    return () => { alive = false; };
  }, [me, following, lib.libraryId]);
  const cam = useRef<SharedCam | null>(null);
  const now = useRef(input.state);
  now.current = input.state;
  const report = useCallback(() => {
    const st = now.current;
    reportMap({ view: viewKey, cam: cam.current, chosen: st.chosen === null ? null : { kind: st.chosen.kind, id: st.chosen.id }, mode: st.mode, slice: [...st.slice], at: Date.now() });
  }, [viewKey]);
  const onCamera = useCallback((c: SharedCam) => { cam.current = c; report(); }, [report]);
  useEffect(() => { if (leading) report(); }, [leading, input.state.chosen?.kind, input.state.chosen?.id, input.state.mode, input.state.slice.join('|'), report]); // eslint-disable-line react-hooks/exhaustive-deps
  const live2 = { on: leading, onStop: () => { void stopFollow(); }, classes: classes.map((c) => ({ key: c.areaId, label: c.name, onPick: () => { if (me !== null) void startFollow(lib, me, c).catch(() => undefined); } })) };
  const followBar = (): ReactNode => <FollowBar me={me} onMap />;
  const mode: MapMode = {
    id: 'followHost',
    active: true,
    menu: { live: live2 },
    ...(leading ? {
      banner: input.quiet ? null : followBar(),
      camera: { onCamera },
      suppress: { tour: true, invite: true },
      hostData: { 'data-world-leading': '1' }
    } : {})
  };
  return {
    mode,
    leading,
    runBar: leading ? followBar() : null,
    lessonLink: leading ? FOLLOW_LINK : null,
    backOnMap: () => { if (leading) reportMapShown(); }
  };
}
