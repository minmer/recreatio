/**
 * COGITA — DO ZROBIENIA, gemeinsam für alle Autoren (COGITA.md §3, [C5–C7,
 * D12, K4]): offene Themen, Wissen, dessen Eintrag sich seither geändert hat,
 * Karten, die Lernende gemeldet haben, und Zahlen ohne Namen („tu wielu się
 * myli"). Dazu die parallelen Fragen: ein Muster für jeden Eintrag einer Menge,
 * je einzeln bestätigt.
 */

import { useMemo, useState } from 'react';

import { loadIntake, openIntakeKey } from '../forms/intake';
import { loadReports, type Report } from './learn';
import { fieldsOf, valuesOf } from './schema';
import { linkedOf } from './store';
import { EntityPicker, entityName, originPath, useAsync, useBusy, useCtx } from './ui';
import { blockMarkups, blockRefs, isQuestion, thesisProblem, THESIS_LIMIT } from '../library/blocks';
import { citedKeys } from '../library/libraryMarkup';
import { blocksField, entityAbout, entityBlocks } from './statements';
import { Loading } from '../ui/Loading';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function Pending({ onOpen }: { onOpen: (id: string) => void }) {
  const { lib, me, writes } = useCtx();
  const look = lib.look;

  /* 0110 — was offen ist, in DIESER Baza wiedzy; was eine Quelle offen hat, ist dort zu tun. */
  /* 2026-10-22 (Schritt 7) — Themen aus allen Quellen: als offen markierte; dazu eigene, auf die nichts zeigt. */
  const open = lib.topics().filter((t) => {
    const f = fieldsOf(t, look);
    const flag = f.find((x) => x.key === 'open');
    const answers = f.find((x) => x.key === 'answers');
    return (flag !== undefined && valuesOf(t, flag)[0]?.value === true)
      || (lib.isOwn(t.id) && (answers === undefined || valuesOf(t, answers).length === 0) && lib.taggedWith(t.id).size === 0);
  });

  const stale = lib.ofKind('topic').filter((e) => lib.isOwn(e.id)).filter((e) => {
    const entry = lib.entry(e.id);
    const checked = isObject(entry?.data._checked) ? entry!.data._checked as Record<string, string> : {};
    return linkedOf(e, look).some((token) => {
      const id = lib.resolve(token);
      const at = id === undefined ? undefined : lib.entry(id)?.updatedAt;
      return id !== undefined && at !== undefined && entry !== undefined && at > (checked[id] ?? entry.updatedAt);
    });
  });

  /*
    2026-10-22 — AUSSAGEN: eine Teza, die fehlt oder zu lang ist
    (Entscheidung 1), und Fragen, auf die noch keine Aussage zeigt
    (Entscheidung 2). 2026-10-23 — jeder Eintrag dieser Baza (und ihrer
    Quellen), dessen Rodzaj ein Feld `blocks` hat.
  */
  const statements = lib.entities().filter((e) => blocksField(e, look) !== undefined);
  const thesisTodo = statements.filter((e) => thesisProblem(entityBlocks(e, look)) !== null);
  const answered = new Set<string>();
  for (const s of statements) {
    const blocks = entityBlocks(s, look);
    const tokens = [...blockRefs(blocks).map((r) => r.ref), ...citedKeys(...blockMarkups(blocks)), ...entityAbout(s, look).map((a) => a.ref)];
    for (const token of tokens) { const id = lib.resolve(token); if (id !== undefined && id !== s.id) answered.add(id); }
  }
  const openQuestions = statements.filter((e) => isQuestion(entityBlocks(e, look)) && !answered.has(e.id));
  const pathOf = (id: string) => { const from = lib.origin(id); return from === undefined ? '#' : originPath(from, id, 'wpisy'); };

  const reports = useAsync(me === null || !writes ? null : async () => {
    const intake = await openIntakeKey(await loadIntake(lib.areaId), me.ring);
    return loadReports(lib.libraryId, intake);
  }, [me, lib.libraryId, writes]);

  const flags = (reports ?? []).filter((r): r is Report => r.kind === 'flags');
  const counts = useMemo(() => {
    const out = new Map<string, { asked: number; wrong: number }>();
    for (const r of reports ?? []) {
      if (r.kind !== 'counts' || !isObject(r.body) || !isObject(r.body.cards)) continue;
      for (const [key, v] of Object.entries(r.body.cards)) {
        if (!isObject(v)) continue;
        const had = out.get(key) ?? { asked: 0, wrong: 0 };
        out.set(key, { asked: had.asked + (typeof v.asked === 'number' ? v.asked : 0), wrong: had.wrong + (typeof v.wrong === 'number' ? v.wrong : 0) });
      }
    }
    return [...out.entries()].filter(([, v]) => v.asked >= 5 && v.wrong / v.asked >= 0.5).sort((a, b) => b[1].wrong / b[1].asked - a[1].wrong / a[1].asked).slice(0, 30);
  }, [reports]);

  return (
    <div className="cg">
      <section className="cg-card">
        <h3>Tematy do rozwinięcia ({open.length})</h3>
        {open.length === 0 ? <span className="wk-hint">Nic otwartego.</span> : <ul>{open.slice(0, 60).map((t) => <li key={t.id}><button type="button" className="cg-ref" onClick={() => onOpen(t.id)}>{lib.label(t)}</button></li>)}</ul>}
      </section>
      <section className="cg-card">
        <h3>Pytania bez odpowiedzi ({openQuestions.length})</h3>
        {openQuestions.length === 0 ? <span className="cg-muted">Na każde pytanie odpowiada jakaś wypowiedź.</span>
          : <ul>{openQuestions.slice(0, 60).map((e) => <li key={e.id}><a className="cg-ref" href={pathOf(e.id)}>{lib.label(e).slice(0, 160)}</a></li>)}</ul>}
      </section>
      <section className="cg-card">
        <h3>Wypowiedzi bez dobrej tezy ({thesisTodo.length})</h3>
        {thesisTodo.length === 0 ? <span className="cg-muted">Każda wypowiedź (treść w blokach) zaczyna się od krótkiego zdania — tezy.</span>
          : <ul>{thesisTodo.slice(0, 60).map((e) => (
            <li key={e.id}>
              <a className="cg-ref" href={pathOf(e.id)}>{lib.label(e).slice(0, 120)}</a>
              <span className="cg-muted"> — {thesisProblem(entityBlocks(e, look)) === 'missing' ? 'nie zaczyna się od zdania' : `pierwsze zdanie ma ponad ${THESIS_LIMIT} znaków`}</span>
            </li>
          ))}</ul>}
      </section>
      <section className="cg-card">
        <h3>Do sprawdzenia — wpis zmienił się od ostatniego razu ({stale.length})</h3>
        {stale.length === 0 ? <span className="wk-hint">Wszystko aktualne.</span> : <ul>{stale.slice(0, 60).map((e) => <li key={e.id}><button type="button" className="cg-ref" onClick={() => onOpen(e.id)}>{lib.label(e).slice(0, 120)}</button></li>)}</ul>}
      </section>
      {writes && (
        <section className="cg-card">
          <h3>Zgłoszenia uczących się ({flags.length})</h3>
          {reports === undefined ? <Loading lines={2} />
            : reports === null ? <span className="wk-hint">Zgłoszenia czyta ten, kto ma klucz przyjęć obszaru bazy wiedzy (Ustawienia → przyjęcia).</span>
            : flags.length === 0 ? <span className="wk-hint">Brak zgłoszeń.</span>
            : <ul>{flags.slice(-60).reverse().map((f, i) => {
                const body = isObject(f.body) ? f.body : {};
                const question = typeof body.question === 'string' ? body.question : '';
                const entity = question.split(':')[1] ?? question;
                return <li key={i}>{new Date(f.createdAt).toLocaleDateString('pl-PL')} · {lib.entity(entity) !== undefined ? <button type="button" className="cg-ref" onClick={() => onOpen(entity)}>{entityName(lib, entity)}</button> : <code>{question.slice(0, 30)}</code>} — {String(body.text ?? '')}</li>;
              })}</ul>}
          {counts.length > 0 && (
            <>
              <h4>Tu wielu się myli</h4>
              <ul>{counts.map(([key, v]) => <li key={key}><code>{key.slice(0, 50)}</code> — {Math.round((v.wrong / v.asked) * 100)}% błędów z {v.asked}</li>)}</ul>
            </>
          )}
        </section>
      )}
      {writes && <Parallel />}
    </div>
  );
}

/** Parallele Fragen [C5]: „Jak Dawid jest pokazany w rozdziale 16, 17, 19?" — je Eintrag eine, der Autor bestätigt. */
function Parallel() {
  const { lib } = useCtx();
  const [pattern, setPattern] = useState('Jak {e} jest pokazany w {t}?');
  const [kind, setKind] = useState(lib.kinds.find((k) => lib.ofKind(k.id).length > 0)?.id ?? 'person');
  const [about, setAbout] = useState<string | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const { busy, failed, run } = useBusy();
  const target = about === null ? undefined : lib.entity(about);
  const proposals = lib.ofKind(kind).slice(0, 40).map((e) => ({ id: e.id, text: pattern.replace('{e}', lib.label(e)).replace('{t}', target === undefined ? '…' : lib.label(target)) }));
  return (
    <section className="cg-card">
      <h3>Pytania równoległe</h3>
      <p className="wk-hint">Jeden wzór dla każdego wpisu rodzaju — zaznacz, które tematy mają powstać.</p>
      <div className="cg-row">
        <input value={pattern} onChange={(e) => setPattern(e.target.value)} aria-label="Wzór" />
        <select value={kind} onChange={(e) => setKind(e.target.value)}>{lib.kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select>
        <EntityPicker lib={lib} value={about} onPick={setAbout} placeholder="{t}: w czym (np. rozdział)" />
      </div>
      <ul className="cg-options">
        {proposals.map((p) => (
          <li key={p.id}><label className="pe-check"><input type="checkbox" checked={chosen.has(p.id)} onChange={(e) => setChosen((was) => { const n = new Set(was); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} /><span>{p.text}</span></label></li>
        ))}
      </ul>
      <button type="button" className="wk-btn" disabled={busy || chosen.size === 0} onClick={() => void run(async () => {
        for (const p of proposals.filter((x) => chosen.has(x.id))) {
          /* Ein Thema darüber nur, wenn „{t}" selbst ein Thema ist — das Feld „parent" zeigt auf Themen. */
          await lib.saveEntity({ kinds: ['topic'], data: { name: p.text, entity: p.id, open: true, ...(target?.kinds.includes('topic') === true ? { parent: target.id } : {}) } });
        }
        setChosen(new Set());
      })}>Utwórz zaznaczone tematy</button>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
