/**
 * EIN BAUTEIL, DAS ERST KOMMT, WENN ES GEZEIGT WIRD (2026-10-17).
 *
 * Die Bausteine einer Seite (`parts/`) holten ihre Ansichten statisch: eine
 * Rozmowa, ein Kalender, eine Karte, ein Formular — jede öffentliche Seite lud
 * sie alle, auch wenn sie nur einen Text zeigte. Mit `later` steht an ihrer
 * Stelle ein Bauteil, das die Datei erst lädt, wenn es gezeichnet wird; bis
 * dahin der Platzhalter (`Loading`).
 *
 * <code>
 *   const PageChatCard = later(() => import('../PageChatView').then((m) => m.PageChatCard));
 * </code>
 */

import { createElement, lazy, Suspense, type ComponentType, type ReactNode } from 'react';

import { Loading } from './Loading';

export function later<P extends object>(
  load: () => Promise<ComponentType<P>>,
  fallback: ReactNode = createElement(Loading, { lines: 2 })
): ComponentType<P> {
  const Lazy = lazy(async () => ({ default: await load() }));
  function Later(props: P) {
    return createElement(Suspense, { fallback }, createElement(Lazy as unknown as ComponentType<P>, props));
  }
  return Later;
}

export default later;
