/**
 * DAS PORTAL EINES BOGENS — die Seite, auf der jemand nach dem Absenden landet.
 *
 * <b>Es entstand bisher von selbst, und das war das Problem.</b> Wer ein
 * Formular abschickte, bekam einen Platz, und der Platz hing „eine Ebene über
 * dem Formular" — abgeleitet, nicht entschieden. Gab es die Seite darüber
 * nicht, fiel er auf die Seite mit dem Formular zurück: der Mensch öffnete
 * seinen Link und sah den Bogen, den er gerade abgeschickt hatte.
 *
 * <b>Wo der Bogen steht, sagt der Bogen</b> (`ModuleRow.pages`) — und nicht der
 * Weg, über den jemand hierhergekommen ist. Das war der Fehler davor: wer
 * denselben Baustein über die Bausteinliste aufschlug, bekam keine Auswahl,
 * keinen Knopf und die Meldung, der Bogen stehe nirgends. Er stand sehr wohl
 * irgendwo; nur diese Ansicht wusste es nicht.
 *
 * <b>Drei Wege, und alle drei kommen vor.</b> Eine vorhandene Seite benennen;
 * eine neue anlegen und selbst benennen; oder gar nichts tun und es dem Dienst
 * überlassen. Der dritte ist der, der bisher als einziger von selbst geschah —
 * jetzt steht wenigstens da, was dabei herauskommt.
 *
 * <b>Angelegt wird sie NICHT leer.</b> Ein Portal ohne den Baustein, der die
 * eigene Einsendung zeigt, ist kein Portal — es ist eine leere Seite hinter
 * einem geheimen Link.
 */

import { useCallback, useEffect, useState } from 'react';

import { openSubpage } from './access';
import { loadDesk, type PageCard } from './desk';
import { setPartConfig } from './form';
import { newId } from './ids';
import { COLUMNS, type Layout } from './layout';
import { saveParts, type DraftPart } from './page';
import { PATH_SHAPE, viewPath } from './routes';
import { WorkspaceError } from './session';

/**
 * Wie ein neues Portal vorgeschlagen wird.
 *
 * <b>Nicht `portal`.</b> Das Wort ist im Register gesperrt (`Slug.IsReserved`),
 * weil hinter ihm der Link eines Menschen beginnt — `…/portal/<token>`. Eine
 * Unterseite so zu nennen verdeckte jeden dieser Links, und zwar lautlos.
 *
 * <b>Ein Vorschlag und keine Vorschrift.</b> Wer sein Portal `candidate` nennen
 * will, nennt es so; das Feld steht offen.
 */
const STEP = 'moje';

/**
 * Welche Seiten ein Platz tragen darf — dieselbe Regel wie im Dienst
 * (`Form.MayAnchorAsync`).
 *
 * <b>Verwandt:</b> die Seite mit dem Bogen, eine darüber, eine darunter.
 *
 * <b>Oder eine andere öffentliche Seite DESSELBEN TRÄGERS</b> — das Formular
 * auf `…/confirmation/signin`, das Portal auf `…/confirmation/candidate`.
 * Vorher hing die Auswahl davon ab, ob der Bogen zufällig auch auf einer
 * höheren Seite stand: dann kamen alle Seiten darunter mit, sonst nur die
 * Kette nach oben. Dieselbe Organisation, einmal mehr und einmal weniger
 * Seiten.
 *
 * <b>Nie eine interne Seite</b> — sie gehört einem Menschen, und ein Platz dort
 * trüge JEDEN Einsendenden hinein. Ein Verweis zeigt woandershin: nur, wenn er
 * verwandt ist.
 */
const mayCarry = (formPage: string, one: PageCard, pages: readonly PageCard[]): boolean => {
  const path = one.path;
  if (one.internalForRoleId !== null) return false;
  if (path === formPage || formPage.startsWith(path + '/') || path.startsWith(formPage + '/')) return true;
  if (one.aliasOf !== null) return false;
  const owner = pages.find((page) => page.path === formPage)?.roleId;
  return owner !== undefined && owner === one.roleId;
};

/**
 * Was auf einem frischen Portal steht.
 *
 * <b>Über die ganze Breite und untereinander.</b> Ein Portal liest man von oben
 * nach unten; nebeneinander zu stellen ist eine Entscheidung, die der treffen
 * soll, der die Seite danach baut.
 */
const SEED: readonly { kind: string; rowSpan: number; config: Record<string, string> }[] = [
  {
    /* DER GRUND, warum es das Portal gibt. */
    kind: 'seat-submission',
    rowSpan: 3,
    config: { title: 'Twoje zgłoszenie' }
  },
  {
    /* Und der Rückweg: was die Kanzlei diesem einen Menschen schreibt. */
    kind: 'seat-note',
    rowSpan: 2,
    config: { title: 'Od kancelarii' }
  }
];

/** Dieselbe Anordnung in jeder Grösse — volle Breite, der Reihe nach. */
function fullWidth(row: number, rowSpan: number): Layout {
  const out: Layout = {};

  for (const [breakpoint, columns] of Object.entries(COLUMNS)) {
    out[breakpoint as keyof Layout] = {
      position: { row, col: 1 },
      size: { colSpan: columns, rowSpan }
    };
  }

  return out;
}

export function Portal({ moduleId, standsOn, portalUnder, ownerRoleId, onSet }: {
  moduleId: string;

  /**
   * Die Seiten, auf denen dieser Bogen steht.
   *
   * <b>Leer heisst: nirgends</b> — und das ist kein Grund, alles zu sperren.
   * Wer ein Portal VORBEREITET, bevor er den Bogen auslegt, tut etwas
   * Vernünftiges; die Regel des Dienstes greift erst, wenn jemand absendet.
   * Also wird dann alles angeboten und dazugesagt, was noch fehlt.
   */
  standsOn: readonly string[];

  /** Worauf der Bogen heute zeigt. Leer heisst: der Dienst leitet es ab. */
  portalUnder: string;

  /** Wer eine neue Unterseite führen soll. */
  ownerRoleId: string | null;

  /** Nach dem Setzen — damit die Einstellung im Bild nachzieht. */
  onSet: (portalUnder: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [pages, setPages] = useState<readonly PageCard[]>([]);
  const [wanted, setWanted] = useState('');

  const look = useCallback(async () => {
    try { setPages((await loadDesk()).pages); } catch { setPages([]); }
  }, []);

  useEffect(() => { void look(); }, [look]);

  const has = portalUnder !== '';
  const nowhere = standsOn.length === 0;

  /* Ein Vorschlag für den neuen Pfad — sobald bekannt ist, wo der Bogen steht. */
  useEffect(() => {
    if (wanted === '' && standsOn[0] !== undefined) setWanted(`${standsOn[0]}/${STEP}`);
  }, [standsOn, wanted]);

  /*
   * WAS ZUR AUSWAHL STEHT.
   *
   * Steht der Bogen irgendwo, gilt die Regel des Dienstes — gegen JEDE seiner
   * Seiten, denn er darf auf mehreren stehen und eine davon genügt. Steht er
   * nirgends, gibt es nichts zu prüfen: dann alles, was mir gehört.
   */
  const choices = nowhere
    ? pages.filter((one) => one.internalForRoleId === null)
    : pages.filter((one) => standsOn.some((page) => mayCarry(page, one, pages)));

  /* Was eingestellt ist, aber (nicht mehr) passt — der Bogen ist umgezogen. */
  const astray = has && !nowhere && pages.length > 0 && !choices.some((one) => one.path === portalUnder);

  /*
   * WELCHE SEITE DER LINK WIRKLICH ÖFFNET.
   *
   * Ohne Einstellung leitet der Dienst sie ab: eine Ebene höher, und wenn es
   * die nicht gibt, die Seite mit dem Bogen (`Form.Above`). Eine Regel, auf die
   * niemand von selbst kommt — also steht hier nicht „o poziom wyżej", sondern
   * die Adresse, die dabei herauskommt.
   *
   * <b>Dieselbe Ableitung ein zweites Mal, und das ist der Preis.</b> Sie steht
   * im Dienst, weil sie dort gilt; hier steht sie, damit man sie VORHER sieht.
   * Laufen sie auseinander, zeigt diese Zeile das Falsche — deshalb steht der
   * Name der Gegenstelle im Kommentar.
   */
  const derived = (() => {
    const first = standsOn[0];
    if (first === undefined) return null;

    const cut = first.lastIndexOf('/');
    if (cut < 0) return first;

    const above = first.slice(0, cut);
    return pages.some((one) => one.path === above) ? above : first;
  })();

  const opens = has ? portalUnder : derived;

  const said = (e: unknown, what: string) =>
    setFailed(e instanceof WorkspaceError ? e.message : what);

  /** Auf eine Seite zeigen, die es schon gibt. */
  const point = async (where: string) => {
    setBusy(true);
    setFailed(null);

    try {
      await setPartConfig(moduleId, { portalUnder: where });
      onSet(where);
    } catch (e) {
      said(e, 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  /** Eine neue anlegen — unter dem Namen, der im Feld steht. */
  const make = async () => {
    const where = wanted.trim().replace(/^\/+|\/+$/g, '');
    if (where === '' || ownerRoleId === null) return;

    setBusy(true);
    setFailed(null);

    try {
      /*
       * DREI SCHRITTE, UND DIE REIHENFOLGE IST EINE ENTSCHEIDUNG.
       *
       * Erst die Seite — ohne sie zeigte die Einstellung auf nichts. Dann die
       * Bausteine, damit niemand eine leere Seite vorfindet. Zuletzt die
       * Einstellung: ab da landen die Plätze dort, und ab da soll auch etwas
       * da sein.
       */
      /*
       * WEM DIE NEUE SEITE GEHÖRT: dem Träger der Seite darüber, wenn ich ihn
       * halte — so wie jede andere Seite in diesem Baum. Sonst mir. Gehörte
       * sie immer mir, wäre ein Portal NEBEN dem Formular (`…/candidate`
       * neben `…/signin`) eine fremde Seite und dürfte keines sein.
       */
      const parent = where.split('/').slice(0, -1).join('/');
      const owner = pages.find((one) => one.path === parent && one.aliasOf === null)?.roleId ?? ownerRoleId;

      await openSubpage(where, owner, 'Portal');

      const parts: DraftPart[] = SEED.map((one, at) => ({
        id: newId(),
        moduleId: null,
        kind: one.kind,
        layout: fullWidth(at === 0 ? 1 : 1 + SEED[0].rowSpan, one.rowSpan),
        /* Das Portal entsteht AUS diesem Formular — also zeigt es dessen Antworten, alle. */
        config: one.kind === 'seat-submission' ? { ...one.config, form: moduleId, show: '*' } : one.config
      }));

      await saveParts(where, parts);
      await setPartConfig(moduleId, { portalUnder: where });

      onSet(where);
      window.location.hash = viewPath('pages', ...where.split('/'));
    } catch (e) {
      said(e, 'Nie udało się założyć portalu.');
    } finally {
      setBusy(false);
    }
  };

  const path = wanted.trim().replace(/^\/+|\/+$/g, '');
  const taken = pages.some((one) => one.path === path);

  const blocker =
    path === '' ? 'Wpisz adres strony.'
    : !PATH_SHAPE.test(path) ? 'Adres: małe litery, cyfry i myślniki; części oddziel ukośnikiem.'
    : taken ? 'Taka strona już jest — wybierz ją wyżej.'
    : ownerRoleId === null ? 'Nie znaleziono Twojej roli.'
    : null;

  return (
    <section className="wk-form">
      <h3 className="wk-h2">Po wysłaniu</h3>

      {/*
        WO DER BOGEN STEHT. Es entscheidet, welche Seite sein Portal tragen
        darf — und es ist das Erste, was fehlt, wenn nichts anzubieten ist.
      */}
      {nowhere ? (
        <p className="wk-hint">
          Ten formularz nie stoi jeszcze na żadnej stronie. Portal możesz
          przygotować już teraz — pamiętaj tylko, że po postawieniu formularza
          portal musi być tą samą stroną, stroną nad nią lub pod nią albo inną
          publiczną stroną tego samego właściciela.
        </p>
      ) : (
        <p className="wk-hint">
          Formularz stoi na: {standsOn.map((one) => <code key={one}>recreatio.pl/{one}</code>)
            .reduce<React.ReactNode[]>((all, one, at) => at === 0 ? [one] : [...all, ', ', one], [])}.
          {' '}Portalem może być każda publiczna strona tego samego właściciela.
        </p>
      )}

      {opens !== null && (
        <p className="wk-warn">
          Link otwiera <code>recreatio.pl/{opens}</code>
          {!has && ' — tak wychodzi z ustawień, nikt tego nie wybrał.'}
        </p>
      )}

      {/*
        WAS DER LINK TUT — er öffnet DIESE Seite selbst, mit dem Schlüssel des
        Menschen daran (`?miejsce=…`), keine Unterseite mit einem Portal.
      */}
      <p className="wk-hint">
        Osoba dostaje link do tej strony z własnym kluczem. Bloki „Zgłoszenie osoby" i
        „Wiadomość dla osoby" na tej stronie pokażą jej dane; jeśli ich tam nie ma, jej
        zgłoszenie pojawi się pod treścią strony. Klucz zostaje w jej przeglądarce i działa
        też na innych stronach tej organizacji.
      </p>

      {astray && (
        <p className="wk-blocker">
          Ta strona nie pasuje już do stron, na których stoi formularz — wybierz inną,
          inaczej zgłoszenie się nie powiedzie.
        </p>
      )}

      {has && (
        <div className="wk-actions">
          <a className="wk-btn" href={viewPath('pages', ...portalUnder.split('/'))}>
            Otwórz tę stronę
          </a>
        </div>
      )}

      <Choose
        now={portalUnder}
        choices={choices}
        busy={busy}
        onPick={(where) => void point(where)}
      />

      {/*
        EINE NEUE, unter einem Namen, den man selbst wählt. Vorher stand hier
        ein fester Vorschlag und kein Feld — wer sein Portal anders nennen
        wollte, konnte es nicht.
      */}
      <details className="wk-fold" open={!has && choices.length === 0}>
        <summary>Albo załóż nową stronę</summary>

        <label className="wk-field">
          <span>Adres</span>
          <input
            value={wanted}
            placeholder="np. parish/grzegorzki/confirmation/candidate"
            disabled={busy}
            onChange={(e) => setWanted(e.target.value)}
          />
        </label>

        <p className="wk-hint">
          Powstanie ze zgłoszeniem tej osoby, które <strong>może poprawić</strong>,
          i miejscem na wiadomość od kancelarii.
        </p>

        {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

        <div className="wk-actions">
          <button
            type="button"
            className="wk-btn"
            disabled={busy || blocker !== null}
            onClick={() => void make()}
          >
            {busy ? 'Zakładanie…' : 'Załóż i otwórz'}
          </button>
        </div>
      </details>

      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/**
 * Eine Seite, die es schon gibt.
 *
 * <b>Sie steht NEBEN dem Anlegen und nicht statt seiner.</b> Die Übersicht
 * darüber ist manchmal genau die richtige Seite — und manchmal soll das Portal
 * seine eigene sein.
 */
function Choose({ now, choices, busy, onPick }: {
  now: string;
  choices: readonly PageCard[];
  busy: boolean;
  onPick: (path: string) => void;
}) {
  if (choices.length === 0) return null;

  return (
    <label className="wk-field">
      <span>Strona po wysłaniu</span>
      <select
        value={now}
        disabled={busy}
        onChange={(e) => { if (e.target.value !== '') onPick(e.target.value); }}
      >
        <option value="">— niech usługa wybierze —</option>
        {/* Was eingestellt ist, steht da — auch wenn es nicht mehr passt. */}
        {now !== '' && !choices.some((one) => one.path === now) && (
          <option value={now} disabled>recreatio.pl/{now} (nie pasuje)</option>
        )}
        {choices.map((one) => (
          <option key={one.path} value={one.path}>recreatio.pl/{one.path}</option>
        ))}
      </select>
    </label>
  );
}

export default Portal;
