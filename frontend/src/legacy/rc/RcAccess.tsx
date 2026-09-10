/**
 * Der Zugang — ein Bauteil für alle Stellen, an denen man hinein- oder
 * hinauskommt.
 *
 * <b>Warum das eines sein muss.</b> Es gab zwei: in der Kopfleiste der
 * Werkstatt ein Zweig, der bei Angemeldeten den Namen und den Weg hinaus
 * zeigte, auf der Pfarrseite ein einzelner Knopf „Zaloguj się". Der zweite
 * verschwand nach dem Anmelden einfach — wer dort arbeitete, kam nicht mehr
 * heraus und sah auch nicht, als wer er angemeldet war.
 *
 * Zwei Stellen, die dasselbe tun sollen, tun mit der Zeit Verschiedenes. Die
 * eine bekommt eine Verbesserung, die andere nicht, und niemand merkt es, weil
 * beide für sich richtig aussehen.
 *
 * <b>Das Aussehen bleibt Sache der Umgebung.</b> Die Pfarrseite hat ihre
 * eigenen Farben — sie gehört der Pfarrei, nicht der Plattform. Deshalb trägt
 * dieses Bauteil nur seine eigenen Marken, und die beiden Orte richten sie
 * jeweils zu.
 */

import { RcSignIn } from './RcSignIn';
import { rcCopy, type RcLang } from './i18n';
import type { RcEntry } from './lib/rcBoot';
import type { RcMe } from './lib/rcAuth';

export function RcAccess({
  lang, entry, onEntry, onReady, onSignIn
}: {
  lang: RcLang;
  entry: RcEntry<RcMe>;
  onEntry: (entry: RcEntry<RcMe>) => void;
  onReady?: (ready: boolean) => void;
  /** Die Schublade öffnen. Sie liegt beim Aufrufer — jede Seite hat ihre eigene. */
  onSignIn: () => void;
}) {
  const t = rcCopy[lang];

  /*
   * ANGEMELDET: der ganze Zustand — wer, ob die Schlüssel da sind, der Weg
   * hinaus. Nur einen Knopf zu zeigen hiesse, dass man nach dem Anmelden
   * nicht mehr sieht, als wer man da ist.
   */
  if (entry.kind === 'signed-in') {
    return (
      <div className="rc-access">
        <RcSignIn lang={lang} entry={entry} onEntry={onEntry} onReady={onReady} />
      </div>
    );
  }

  /*
   * SOLANGE DIE ANTWORT NOCH AUSSTEHT, steht nichts da.
   *
   * Ein „Anmelden" für den Bruchteil einer Sekunde, das dann zum eigenen Namen
   * wird, sieht aus wie ein Fehler — und wer schnell klickt, bekommt eine
   * Schublade, die er nicht wollte.
   */
  if (entry.kind === 'checking') return <div className="rc-access" />;

  return (
    <div className="rc-access">
      <button type="button" className="rc-access-in" onClick={onSignIn}>
        {t.auth.signIn}
      </button>
    </div>
  );
}

export default RcAccess;
