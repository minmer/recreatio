/**
 * How a gallery says how big it is.
 *
 * Its own file so the rule can be exercised: Polish counts three ways, the
 * teens are the exception to the exception, and "13 zdjęcia" is the kind of
 * mistake that sits on a page for a year because it is only slightly wrong.
 */
/** "1 zdjęcie", "3 zdjęcia", "24 zdjęcia" — Polish counts three ways. */
export function photoCount(count: number): string {
  const last = count % 10;
  const teens = count % 100;

  if (count === 1) return '1 zdjęcie';
  if (last >= 2 && last <= 4 && (teens < 12 || teens > 14)) return `${count} zdjęcia`;
  return `${count} zdjęć`;
}
