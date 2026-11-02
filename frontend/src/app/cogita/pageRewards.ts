/**
 * 2026-11-02 — NAGRODY GEHÖREN ZUR SEITE: steht auf einer Seite ein Baustein „Punkty i seria" (oder „Statystyki na
 * żywo") für eine Baza, zeigt auch die Powtórka derselben Baza auf der Seite im Lauf Punkte, Serie und „+10" — nach
 * derselben Regel. Ein Baustein meldet seine Regel hier an, solange er steht; die Powtórka fragt nach.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

import type { RewardRules } from './rewards';

const placed = new Map<string, Map<symbol, RewardRules>>();
const listeners = new Set<() => void>();
let version = 0;
const changed = () => { version += 1; for (const one of listeners) one(); };

/** Diese Regel gilt auf der Seite für die Baza `libraryId`, solange der Baustein steht. */
export function usePlaceRewards(libraryId: string | null, rules: RewardRules | null): void {
  const [me] = useState(() => Symbol('rewards'));
  useEffect(() => {
    if (libraryId === null || libraryId === '' || rules === null) return undefined;
    const key = libraryId.toLowerCase();
    const map = placed.get(key) ?? new Map<symbol, RewardRules>();
    map.set(me, rules);
    placed.set(key, map);
    changed();
    return () => {
      map.delete(me);
      if (map.size === 0) placed.delete(key);
      changed();
    };
  }, [libraryId, rules, me]);
}

/** Die Regel, die ein Baustein dieser Seite für die Baza angemeldet hat — sonst `null`. */
export function usePageRewards(libraryId: string | null): RewardRules | null {
  useSyncExternalStore((on) => { listeners.add(on); return () => { listeners.delete(on); }; }, () => version, () => version);
  if (libraryId === null || libraryId === '') return null;
  const map = placed.get(libraryId.toLowerCase());
  return map === undefined ? null : map.values().next().value ?? null;
}
