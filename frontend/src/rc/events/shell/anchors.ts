/**
 * Where a part sits, as an address.
 *
 * Kept out of the shell so a part can build a link to another part without
 * importing the shell that renders it — the shell already imports the part
 * registry, and the two importing each other is a cycle.
 *
 * The rule is exactly the shell's own, letter for letter: an anchor that changed
 * shape would break every address already shared.
 */

/** Stable in-page anchor for a part, derived from its menu label. */
export function partAnchor(menuLabel: string): string {
  return menuLabel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
