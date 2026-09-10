import { selectNextCardIndex } from './runCore';

export function selectNextCardIndexByMode(payload: {
  mode: string;
  currentIndex: number;
  cardKeys: string[];
  askedCardKeys?: string[] | null;
  knownessByCardKey?: Record<string, number> | null;
}): number | null {
  return selectNextCardIndex(payload);
}
