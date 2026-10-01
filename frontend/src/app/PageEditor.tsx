/**
 * Eine übernommene Adresse: was darauf steht, und wer daran darf.
 *
 * <b>Zwei verschiedene Dinge auf einer Karte, und der Unterschied wird
 * gesagt.</b> Titel und Text sind ÖFFENTLICH und liegen im Klartext — sie
 * werden ohne Konto ausgeliefert. Die Zugänge daneben sind unterschriebene
 * Zertifikate: der Dienst kann sie nicht herstellen, nur prüfen.
 *
 * <b>Zwei Stufen, und sie decken einander nicht</b> (Kernel 3.5):
 * `write` darf ändern, `certify` darf weitergeben und Unterseiten öffnen. Wer
 * beides soll, bekommt beides — das ist die Stelle, an der jemand einmal
 * hinsehen muss, und deshalb steht sie hier als zwei Einträge und nicht als
 * ein Schalter.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadPage, savePage, savePageLook, saveParts, toDraft, type DraftPart } from './page';
import { MassOffice } from './MassOffice';
import { MenuEditor } from './MenuEditor';
import { PageBuilder } from './PageBuilder';
import { logicKey, PageLogicEditor } from './PageLogicEditor';
import { pagePath } from './routes';
import { SlidesEditor } from './SlidesEditor';
import { SlidesImport } from './SlidesImport';
import { NO_LOOK, readLook, writeLook, type Look } from './slides';
import { WorkspaceError, type Who } from './session';

export function PageEditor({ path, who, onOpenModule }: {
  path: string;
  who: Who;

  /** Den Baustein aufschlagen — als Unterseite DIESER Seite (`Workspace`). */
  onOpenModule: (moduleId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [lead, setLead] = useState('');
  const [parts, setParts] = useState<readonly DraftPart[]>([]);

  /* 0062 — Seite oder Slajdy, und ihr Aussehen. Gespeichert mit den Modulen. */
  const [mode, setMode] = useState<'page' | 'slides'>('page');
  const [pageLook, setPageLook] = useState<Look>(NO_LOOK);
  const [lookDirty, setLookDirty] = useState(false);

  /* Die Karte der Seite (0048) — und ob sie gerade aufgeklappt ist. */
  const [logic, setLogic] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  /* Die Anordnung geht als GANZES hinaus. Ein Knopf, der immer anklickbar ist,
     sagt nicht, ob noch etwas offen ist — deshalb merkt sich das der Editor. */
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const look = useCallback(async () => {
    setReady(false);
    setFailed(null);

    try {
      const page = await loadPage(path);
      setTitle(page.title ?? '');
      setLead(page.lead ?? '');
      setParts(page.parts.map(toDraft));
      setLogic(page.logic ?? null);
      setMode(page.mode === 'slides' ? 'slides' : 'page');
      setPageLook(readLook(page.theme));
    } catch {
      // Eine Adresse ohne Seite ist der Normalfall beim ersten Mal.
      setTitle('');
      setLead('');
      setParts([]);
      setLogic(null);
      setMode('page');
      setPageLook(NO_LOOK);
    }

    setDirty(false);
    setLookDirty(false);


    setReady(true);
  }, [path, who]);

  useEffect(() => { void look(); }, [look]);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);
    setSaved(false);

    try {
      await todo();
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  if (!ready) return <p className="wk-hint">Wczytywanie strony…</p>;


  return (
    <div className="wk-page-edit">
      <h3 className="wk-h2">recreatio.pl/{path}</h3>

      {/*
        0054 — DAS MENÜ, über allem anderen: es steht auch über der Seite, und
        es gilt für sie und alle darunter. Zugeklappt, bis man es braucht.
      */}
      <details className="wk-fold wk-menued-fold">
        <summary>Menu strony</summary>
        <MenuEditor path={path} />
      </details>

      <form
        className="wk-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy === null && title.trim() !== '') {
            void act('Zapisywanie…', () =>
              savePage(path, { title: title.trim(), lead: lead.trim() === '' ? null : lead.trim() })
            ).then(() => setSaved(true));
          }
        }}
      >
        <label className="wk-field">
          <span>Tytuł</span>
          <input value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} />
        </label>

        <label className="wk-field">
          <span>Tekst</span>
          <textarea rows={5} value={lead} onChange={(e) => { setLead(e.target.value); setSaved(false); }} />
        </label>

        <p className="wk-hint">
          Ta strona jest publiczna — tytuł i tekst idą do usługi otwartym tekstem,
          bo czyta je każdy, kto wejdzie pod ten adres.
        </p>

        {failed !== null && <p className="wk-error">{failed}</p>}
        {saved && <p className="wk-done">Zapisane.</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy !== null || title.trim() === ''}>
            {busy ?? 'Zapisz'}
          </button>

          <a className="wk-link" href={pagePath(path)}>Zobacz stronę</a>
        </div>
      </form>

      <h3 className="wk-h2">Moduły</h3>

      {/*
        0062 — WIE DIE SEITE ERSCHEINT. Als Seite: die Bausteine im Raster, wie
        bisher. Als Slajdy: jeder Baustein ein Bildschirm, mit eigenem Hintergrund
        — wie die Ereignisseiten des Altbestands.
      */}
      <div className="wk-seg" role="group" aria-label="Rodzaj strony">
        {([['page', 'Strona z modułami'], ['slides', 'Slajdy — każdy moduł osobno']] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={mode === value} disabled={busy !== null}
            className={mode === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
            onClick={() => { if (mode !== value) { setMode(value); setLookDirty(true); } }}>
            {label}
          </button>
        ))}
      </div>

      {mode === 'slides' ? (
        <SlidesEditor
          path={path}
          parts={parts}
          look={pageLook}
          title={title}
          lead={lead}
          busy={busy !== null}
          onChange={(next) => { setParts(next); setDirty(true); }}
          onLook={(next) => { setPageLook(next); setLookDirty(true); }}
          onOpenModule={(moduleId, next) => {
            setParts(next);
            void act('Zapisywanie modułów…', () => saveParts(path, next)).then(() => {
              setDirty(false);
              onOpenModule(moduleId);
            });
          }}
        />
      ) : (
      <PageBuilder
        parts={parts}
        path={path}
        busy={busy !== null}
        onChange={(next) => { setParts(next); setDirty(true); }}

        /*
          ERST SPEICHERN, DANN HINÜBER. Was der Editor gerade geändert hat,
          steht nur im Bild: dass diese Stelle DIESEN Bogen zeigt. Ohne das
          Speichern wäre der Bogen angelegt und die Seite wüsste nichts
          davon — und die einzige Spur davon wäre eine Adresse, die auf
          einen Baustein zeigt, der dort nicht steht.
        */
        onOpenModule={(moduleId, next) => {
          setParts(next);

          void act('Zapisywanie modułów…', () => saveParts(path, next)).then(() => {
            setDirty(false);
            onOpenModule(moduleId);
          });
        }}
      />
      )}

      {/* 0063 — ein Ereignis des Altbestands als JSON: jede Część wird ein Baustein, mit Slajd und Hintergrund. */}
      <SlidesImport
        parts={parts}
        look={pageLook}
        onParts={(next) => { setParts(next); setDirty(true); }}
        onLook={(next) => { setPageLook(next); setLookDirty(true); }}
      />

      <div className="wk-actions">
        <button
          type="button"
          className="wk-btn"
          disabled={busy !== null || (!dirty && !lookDirty)}
          onClick={() => void act(mode === 'slides' ? 'Zapisywanie slajdów…' : 'Zapisywanie modułów…', async () => {
            if (dirty) await saveParts(path, parts);
            if (lookDirty) await savePageLook(path, { mode, theme: writeLook(pageLook) });
          })}
        >
          {busy ?? (mode === 'slides' ? 'Zapisz slajdy' : 'Zapisz moduły')}
        </button>

        {!dirty && !lookDirty && busy === null && <span className="wk-blocker">Nic się nie zmieniło.</span>}
      </div>

      {/*
        DIE KARTE DER SEITE (0048): wann welcher Baustein zu sehen ist, und
        die Schritte, aus denen „Kroki osoby" seine Liste zeichnet. Zugeklappt
        — sie ist gross, und nicht jede Seite braucht sie.
      */}
      <h3 className="wk-h2">
        Mapa logiki strony{' '}
        <button type="button" className="wk-link-btn" aria-expanded={mapOpen} onClick={() => setMapOpen(!mapOpen)}>
          {mapOpen ? 'Zwiń' : logic === null ? 'Otwórz' : 'Otwórz (ustawiona)'}
        </button>
      </h3>

      {mapOpen && (
        dirty || lookDirty ? (
          <p className="wk-warn">Najpierw zapisz moduły — mapa łączy się z modułami, które są już na stronie.</p>
        ) : (
          <PageLogicEditor
            key={logicKey(logic, parts)}
            path={path}
            parts={parts}
            logic={logic}
            who={who}
            onSaved={setLogic}
          />
        )
      )}

      {/*
        Die Kanzlei erscheint erst, wenn die Seite einen Messplan ZEIGT.
        Der Baustein ist die Erklärung „hier gibt es Messen"; ohne ihn stünde
        auf jeder Seite ein Formular für etwas, das dort nicht vorkommt.

        Ein Henne-Ei-Fall ist das nicht: man legt den Baustein ab, speichert die
        Module, und die Kanzlei steht da — bevor die erste Messe existiert.
      */}
      {parts.some((part) => part.kind === 'masses') && <MassOffice />}

      {/*
        HIER STANDEN: die Fragen des Formulars, „Kto ma dostęp" und „Otwórz
        podstronę". Alle drei gehörten woanders hin.

        <b>Die Fragen gehören dem BAUSTEIN</b>, nicht der Seite, auf der er
        steht (0036). Sie hier zu stellen hiess: wer denselben Bogen auf eine
        zweite Seite legt, bearbeitet ihn an zwei Stellen — und sieht beide
        Male dieselben Antworten, ohne zu wissen, warum. Jetzt führt die
        Kachel zum Baustein, und dort wird gefragt.

        <b>Der Zugang zu einer ADRESSE war ein zweites Schloss neben dem
        einzigen, das schliesst.</b> Was geschützt ist, liegt unter einem
        Bereichsschlüssel; Titel, Text und Einstellungen einer Seite gehen
        offen hinaus — das steht zwei Bildschirme weiter oben. Eine Adresse
        zu verbergen schützte damit nichts und sah aus, als täte es das.

        <b>Unterseiten gehören in die Seiteneinstellungen</b>, wo der Baum
        steht. Sie hier ein zweites Mal anzubieten hiess, dasselbe an zwei
        Stellen zu pflegen.
      */}
    </div>
  );
}
