import type { EventPartKind } from '../../../lib/api';
import type { PartModule } from './contracts';
import { contactPart } from './ContactPart';
import { costsPart } from './CostsPart';
import { faqPart } from './FaqPart';
import { filesPart } from './FilesPart';
import { formPart } from './FormPart';
import { galleryPart } from './GalleryPart';
import { mapPart } from './MapPart';
import { participantCardPart } from './ParticipantCardPart';
import { peoplePart } from './PeoplePart';
import { planPart } from './PlanPart';
import { registrationPart } from './RegistrationPart';
import { shortInfosPart } from './ShortInfosPart';
import { textPart } from './TextPart';
import { titlePart } from './TitlePart';

/**
 * Every part an event can be built from. Order is the order they appear in the
 * builder's "add a part" list, roughly the order you would use them.
 *
 * Adding a part means writing one file and adding it here — the shell, the
 * editor and the API need no changes.
 */
export const PART_MODULES: PartModule[] = [
  titlePart,
  shortInfosPart,
  textPart,
  planPart,
  mapPart,
  formPart,
  costsPart,
  faqPart,
  peoplePart,
  filesPart,
  galleryPart,
  contactPart,
  // Only useful behind an individual link: these act on the reader's own data.
  registrationPart,
  participantCardPart
];

const BY_KIND = new Map<EventPartKind, PartModule>(PART_MODULES.map((module) => [module.kind, module]));

export function getPartModule(kind: EventPartKind): PartModule | null {
  return BY_KIND.get(kind) ?? null;
}

export function partLabel(kind: EventPartKind): string {
  return BY_KIND.get(kind)?.label ?? kind;
}
