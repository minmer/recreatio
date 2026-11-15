/**
 * „W DZIELE" — WO EIN EINTRAG IM WERK STEHT (2026-11-15). Eine Baza wiedzy kann das Wissen eines Werks im Skryptorium
 * sein (Personen, Orte, Begriffe, Ideen): an der Seite eines Eintrags steht dann, in welchen Werken und an welchen
 * Knoten er eingeführt, definiert, als Beispiel, gebraucht oder wieder aufgenommen wird — in Lesereihenfolge des
 * ersten Weges, jeder ein Link an seine Stelle in der Struktur.
 *
 * Gelesen werden nur Skryptoria, die dieser Leser öffnen kann: die Quellen der Baza und jedes lesbare Skryptorium,
 * dessen Projekte diese Baza als Wissen nennen. Wer ein Skryptorium nicht öffnen kann, sieht nichts davon.
 * Umgekehrt (eine Phase „gilt ab Kapitel 5") zeigt der Eintrag selbst auf Knoten: das stehen seine Felder und Verweise.
 */

import { useEffect, useState } from 'react';

import { useT } from '../core/i18n';
import { libraryKindOf, loadLibraries, openLibraries } from '../library/library';
import { MARK_ROLES } from '../library/libraryKinds';
import { storeOf, type LibraryStore } from '../library/libraryStore';
import { viewPath } from '../routes';
import { knowledgeFrom } from '../scriptorium/work/workKnowledge';
import { occurrencesOf, registerOf } from '../scriptorium/work/workMarks';
import { MARK_ORDER, pathOf, readWork, type MarkRole } from '../scriptorium/work/workModel';
import { useCtx } from './ui';

interface Place {
  readonly node: string;
  readonly number: string;
  readonly title: string;
  readonly role: MarkRole;
  readonly href: string;
}

interface WorkPlaces {
  readonly scriptorium: string;
  readonly project: string;
  readonly title: string;
  readonly href: string;
  readonly places: readonly Place[];
  /** Vorkommen in Fassungen, die nicht auf dem ersten Weg liegen. */
  readonly elsewhere: number;
}

/** Die Werke eines Skryptorium, die diese Baza nennen (oder alle, wenn die Baza aus ihm schöpft), mit den Stellen des Eintrags. */
function placesIn(store: LibraryStore, base: string, fromSource: boolean, entity: string, knowledgeLook: Parameters<typeof knowledgeFrom>[0]): WorkPlaces[] {
  const look = { all: () => store.all(), get: (id: string) => store.get(id), byKey: (key: string) => store.byKey(key) };
  const out: WorkPlaces[] = [];
  const knowledge = knowledgeFrom(knowledgeLook, [base], [entity]);
  for (const project of store.all().filter((e) => e.kind === 'project')) {
    const model = readWork(project, look);
    if (model.nodes.size === 0 || (!fromSource && !model.bases.includes(base))) continue;
    const occurrences = occurrencesOf(model, look, knowledge).filter((o) => o.entity === entity);
    if (occurrences.length === 0) continue;
    const register = registerOf(model, pathOf(model, undefined), occurrences);
    const here = (node: string) => viewPath('scriptorium', store.libraryId, project.id, 'struktura', node);
    const places = (register.byEntity.get(entity)?.occ ?? []).map((o) => {
      const placed = register.placed[o.pos];
      return { node: o.node, number: placed.number, title: placed.node.title, role: o.role, href: here(o.node) };
    });
    out.push({
      scriptorium: store.libraryId, project: project.id, title: model.project.data.title?.toString() ?? '',
      href: viewPath('scriptorium', store.libraryId, project.id, 'struktura'), places,
      elsewhere: occurrences.filter((o) => !register.posOf.has(o.node)).length
    });
  }
  return out;
}

export function WorkBox({ id }: { id: string }) {
  const t = useT();
  const { lib, me } = useCtx();
  const [works, setWorks] = useState<readonly WorkPlaces[] | null>(null);
  const revision = lib.revision;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const found: WorkPlaces[] = [];
      const fromSources = new Set(lib.sourceList().filter((s) => s.kind === 'writing').map((s) => s.store.libraryId));
      const stores: LibraryStore[] = lib.sourceList().filter((s) => s.kind === 'writing').map((s) => s.store);
      if (me !== null) {
        try {
          const rows = await openLibraries(me.ring, (await loadLibraries()).libraries);
          for (const row of rows) {
            if (libraryKindOf(row) !== 'writing' || fromSources.has(row.libraryId)) continue;
            const one = storeOf(me.ring, row);
            await one.sync().catch(() => undefined);
            if (one.loaded) stores.push(one);
          }
        } catch { /* ohne Liste: nur die Quellen */ }
      }
      for (const store of stores) {
        try { found.push(...placesIn(store, lib.libraryId, fromSources.has(store.libraryId), id, lib)); } catch { /* ein Werk, das sich nicht lesen lässt, fehlt */ }
      }
      if (alive) setWorks(found);
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lib, me, revision]);

  if (works === null || works.length === 0) return null;
  const roleLabel = (role: MarkRole) => MARK_ROLES.find((r) => r.value === role)?.label ?? role;
  return (
    <section className="cg-card" data-work-box="">
      <h3>{t('workCogita.box.title')}</h3>
      {works.map((w) => (
        <div key={`${w.scriptorium}:${w.project}`}>
          <a className="wk-link" href={w.href}><strong>{w.title || t('workCogita.box.untitled')}</strong></a>
          {MARK_ORDER.map((role) => {
            const list = w.places.filter((p) => p.role === role);
            if (list.length === 0) return null;
            return (
              <p key={role} className="cg-muted">
                {roleLabel(role)}:{' '}
                {list.map((p, i) => (
                  <span key={`${p.node}:${i}`}>{i > 0 ? ', ' : ''}<a className="wk-link" href={p.href}>{`${p.number} ${p.title}`.trim()}</a></span>
                ))}
              </p>
            );
          })}
          {w.elsewhere > 0 && <p className="cg-muted">{t('workCogita.box.elsewhere', { count: w.elsewhere })}</p>}
        </div>
      ))}
    </section>
  );
}
