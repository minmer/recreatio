/**
 * PARTIKEL-LABOR — die Stufen eines Teilschritts, in dieser Reihenfolge (je
 * eine Zeit im Entwickler-HUD). Eigene Datei: die Oberfläche braucht die
 * Namen, ohne die Engine mitzuladen.
 */

export const STAGES = ['forces', 'grid', 'constraints', 'velocity', 'heat', 'phaseChange', 'chemistry', 'boundary', 'diagnostics'] as const;
export type StageName = (typeof STAGES)[number];
