/**
 * LABOR 2D (v2) — die Stufen eines Schritts, in dieser Reihenfolge (Prompt v2,
 * „The step loop“; je eine Zeit im Entwickler-HUD). Eigene Datei: die
 * Oberfläche braucht die Namen, ohne die Engine mitzuladen.
 */

export const STAGES = ['inputs', 'liquid', 'gas', 'bubbles', 'interface', 'heat', 'chemistry', 'diagnostics', 'bodies'] as const;
export type StageName = (typeof STAGES)[number];
export const STAGE_COUNT = STAGES.length;
