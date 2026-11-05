/**
 * 2026-10-18 — DIE FIZYKA 2D IN WORTEN: das Polecenie dla AI neben dem
 * Editor (die KI schreibt im eigenen Chat eine Szene, die man hier einfügt).
 * Eigene Datei: die langen Sätze lädt nur, wer baut. Die Texte stehen in
 * labPhysics.json (`labPhysics.ai.*`).
 */

import { t } from '../../core/i18n';
import { LIQUIDS } from '../fluid';
import { MATERIALS } from './physBody';
import { PHYS_PRESETS } from './physPresets';
import { GRAPH_OF, PALETTE, TOOLS, VECTOR_KINDS, WORLD_CONTROLS } from './physScene';

const quoted = (list: readonly string[]): string => list.map((x) => `"${x}"`).join(', ');

export function physDescription(): string {
  return t('labPhysics.ai.format', {
    materials: Object.values(MATERIALS).map((m) => `${m.key} (${m.name}, ${m.density} kg/m³)`).join(', '),
    liquids: Object.values(LIQUIDS).map((l) => `${l.key} (${l.name}, ${l.density})`).join(', '),
    vectors: quoted(VECTOR_KINDS),
    graph: quoted(GRAPH_OF),
    palette: quoted(PALETTE),
    tools: quoted(TOOLS),
    controls: quoted(WORLD_CONTROLS)
  });
}

export function physPrompt(): string {
  const example = PHYS_PRESETS.find((p) => p.key === 'plywanie') ?? PHYS_PRESETS[0];
  return [
    t('labPhysics.ai.prompt'),
    '',
    physDescription(),
    '',
    t('labPhysics.ai.example'),
    JSON.stringify(example.scene, null, 2)
  ].join('\n');
}
