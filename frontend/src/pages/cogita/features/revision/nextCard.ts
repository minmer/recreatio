export type NextCardSelection<T> = {
  nextIndex: number;
  nextCard: T | null;
  hasNext: boolean;
};

export function getNextCardSelection<T>(queue: T[], currentIndex: number): NextCardSelection<T> {
  const safeLength = Math.max(0, queue.length);
  const candidateIndex = currentIndex + 1;
  const hasNext = candidateIndex < safeLength;
  const nextIndex = hasNext ? candidateIndex : safeLength;
  return {
    nextIndex,
    nextCard: hasNext ? queue[candidateIndex] ?? null : null,
    hasNext
  };
}
