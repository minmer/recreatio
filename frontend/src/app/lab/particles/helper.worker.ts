/**
 * PARTIKEL-LABOR — EIN HELFER: rechnet sein Stück jeder Aufgabe auf dem
 * gemeinsamen Speicher (`engine/runner.ts`). Er besitzt nichts — keine Szene,
 * keine Befehle, nur die Sichten auf die Felder des Rechners. Die Seite legt
 * ihn an und gibt ihm einen Kanal zum Arbeiter der Engine; nur in einer Seite,
 * die „cross-origin isolated“ ist (`lab.html`, ARCHITECTURE.md §8).
 *
 * Zwischen zwei Aufgaben wartet er aktiv, dann schläft er (`Atomics.wait`);
 * nach 50 ms ohne Aufgabe kehrt er kurz in seine Schleife der Nachrichten
 * zurück (neue Felder, Ende).
 */

import { Attached } from './engine/mem';
import { C_ACK, C_DONE, C_GEN, C_JOB, C_QUIT, C_VERSION, SPIN, type HelperMessage } from './engine/runner';
import { attachedViews, jobLength, runJob, type Views } from './engine/solver';

const scope = self as unknown as { close(): void; addEventListener(type: 'message', fn: (e: MessageEvent<{ port: MessagePort }>) => void): void };

let ctrl: Int32Array | null = null;
let index = 0;
let threads = 1;
let version = 0;
let V: Views | null = null;
let P: Float64Array | null = null;
let lastGen = 0;
let looping = false;

function loop(): void {
  const c = ctrl;
  if (c === null || looping) return;
  looping = true;
  for (;;) {
    let g = Atomics.load(c, C_GEN);
    let spins = 0;
    while (g === lastGen) {
      spins += 1;
      if (spins < SPIN) { g = Atomics.load(c, C_GEN); continue; }
      const r = Atomics.wait(c, C_GEN, lastGen, 50);
      g = Atomics.load(c, C_GEN);
      if (r === 'timed-out' && g === lastGen) {
        /* Luft holen: Nachrichten (neue Felder, Ende) kommen nur an, wenn der Faden nicht wartet. */
        looping = false;
        setTimeout(loop, 0);
        return;
      }
    }
    lastGen = g;
    if (Atomics.load(c, C_QUIT) === 1) { looping = false; scope.close(); return; }
    /* Neue Felder: die Nachricht mit ihnen kommt (oder ist schon da) — zurück in die Schleife der Nachrichten. */
    if (Atomics.load(c, C_VERSION) !== version) { looping = false; return; }
    if (V !== null && P !== null) {
      const job = Atomics.load(c, C_JOB);
      const n = jobLength(job, P);
      runJob(job, V, P, Math.floor((n * index) / threads), Math.floor((n * (index + 1)) / threads));
    }
    Atomics.add(c, C_DONE, 1);
    Atomics.notify(c, C_DONE);
  }
}

function receive(m: HelperMessage): void {
  switch (m.type) {
    case 'init':
      ctrl = new Int32Array(m.ctrl);
      index = m.index;
      threads = m.threads;
      lastGen = Atomics.load(ctrl, C_GEN);
      break;
    case 'attach': {
      if (ctrl === null) return;
      const a = new Attached(m.blocks);
      V = attachedViews(a);
      P = a.f64('params');
      version = m.version;
      /* Was vor dieser Fassung kam, war keine Aufgabe für sie. */
      lastGen = Atomics.load(ctrl, C_GEN);
      Atomics.store(ctrl, C_ACK + index - 1, version);
      break;
    }
    case 'quit':
      scope.close();
      return;
  }
  loop();
}

scope.addEventListener('message', (e) => {
  const port = e.data.port;
  port.onmessage = (ev: MessageEvent<HelperMessage>) => receive(ev.data);
});
