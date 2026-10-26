/**
 * LABOR 2D (v2) — ALLE KERNE des beschleunigten Wegs in einer Liste (zum
 * Übersetzen beim Start und für den Prüfstand).
 */

import { BODY_COLLECT_KERNELS } from './kbodycollect';
import { BODY_COVER_KERNELS } from './kbodycover';
import { BODY_DYN_KERNELS } from './kbodydyn';
import { BODY_MELT_KERNELS } from './kbodymelt';
import { BODY_MELT2_KERNELS } from './kbodymelt2';
import { BUBBLE_END_KERNELS } from './kbubend';
import { BUBBLE_KERNELS } from './kbubbles';
import { GAS_KERNELS } from './kgas';
import { GAS_FLOW_KERNELS } from './kgasflow';
import { HEAT_KERNELS } from './kheat';
import type { KernelDef } from './kernel';
import { LIQUID_KERNELS } from './kliquid';
import { MG_KERNELS } from './kmg';
import { MIX_KERNELS } from './kmix';
import { FLASH_KERNELS } from './kflash';
import { PHASE_KERNELS } from './kphase';
import { SALT_KERNELS } from './ksalt';
import { SOLVER_KERNELS } from './ksolver';
import { RENDER_KERNELS } from './render';

export const ALL_KERNELS: readonly KernelDef[] = [...SOLVER_KERNELS, ...MG_KERNELS, ...LIQUID_KERNELS, ...MIX_KERNELS, ...GAS_KERNELS, ...GAS_FLOW_KERNELS, ...BUBBLE_KERNELS, ...BUBBLE_END_KERNELS, ...PHASE_KERNELS, ...FLASH_KERNELS, ...SALT_KERNELS, ...HEAT_KERNELS, ...RENDER_KERNELS,
  ...BODY_COVER_KERNELS, ...BODY_COLLECT_KERNELS, ...BODY_DYN_KERNELS, ...BODY_MELT_KERNELS, ...BODY_MELT2_KERNELS];
