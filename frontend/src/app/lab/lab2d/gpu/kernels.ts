/**
 * LABOR 2D (v2) — ALLE KERNE des beschleunigten Wegs in einer Liste (zum
 * Übersetzen beim Start und für den Prüfstand).
 */

import { BUBBLE_END_KERNELS } from './kbubend';
import { BUBBLE_KERNELS } from './kbubbles';
import { GAS_KERNELS } from './kgas';
import { GAS_FLOW_KERNELS } from './kgasflow';
import { HEAT_KERNELS } from './kheat';
import type { KernelDef } from './kernel';
import { LIQUID_KERNELS } from './kliquid';
import { MG_KERNELS } from './kmg';
import { PHASE_KERNELS } from './kphase';
import { SOLVER_KERNELS } from './ksolver';
import { RENDER_KERNELS } from './render';

export const ALL_KERNELS: readonly KernelDef[] = [...SOLVER_KERNELS, ...MG_KERNELS, ...LIQUID_KERNELS, ...GAS_KERNELS, ...GAS_FLOW_KERNELS, ...BUBBLE_KERNELS, ...BUBBLE_END_KERNELS, ...PHASE_KERNELS, ...HEAT_KERNELS, ...RENDER_KERNELS];
