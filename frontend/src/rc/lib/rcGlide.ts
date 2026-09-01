/**
 * Die Kurve, mit der ein Übergang läuft.
 *
 * Eine Geste stösst ihn an, dann läuft er in seiner eigenen Zeit. Damit das
 * eine Bewegung bleibt und nicht zwei, muss er mit der Geschwindigkeit
 * anfangen, mit der die Hand gerade schiebt — und von selbst zur Ruhe kommen.
 *
 * Eine gewöhnliche Ein-und-Ausblendkurve kann das nicht: sie fängt immer bei
 * null an. Deshalb eine kubische Hermite-Kurve mit vorgegebener
 * Anfangssteigung und der Endsteigung null.
 *
 * Steht hier und nicht in der Startseite, weil daran eine Zusicherung hängt,
 * die man beim Lesen nicht sieht: über der Steigung 3 schwingt die Kurve über
 * das Ziel hinaus, die Seite führe also ein Stück zurück. Das ist der einzige
 * Fehler an dieser Stelle, der sich nicht als Fehler zeigt, sondern nur als
 * schlechtes Gefühl beim Scrollen — und der einzige, den eine Prüfreihe
 * zuverlässig findet.
 */

/**
 * Die grösste Anfangssteigung, bei der die Kurve noch monoton ist.
 *
 * Genau dort wird ihre Ableitung zu 3(k−1)² und berührt die Null nur am Ende.
 * Ein Wert darüber lässt die Bewegung über das Ziel hinauslaufen.
 */
export const RC_GLIDE_MAX = 3;

/**
 * Der zurückgelegte Anteil der Strecke — k von 0 bis 1, m die Anfangssteigung.
 *
 *     p(k) = m·k·(k−1)² + k²·(3−2k)
 */
export function rcGlide(k: number, m: number): number {
  return m * k * (k - 1) * (k - 1) + k * k * (3 - 2 * k);
}

/**
 * Ihre Ableitung.
 *
 * Gebraucht, wenn ein Übergang in den nächsten übergeht: dessen Anfang muss
 * die Geschwindigkeit des vorigen aufnehmen, sonst fährt jede Kette aus
 * Schritten bei jedem Schritt neu an.
 */
export function rcGlideSlope(k: number, m: number): number {
  return m * (3 * k - 1) * (k - 1) + 6 * k * (1 - k);
}

/**
 * Die Anfangssteigung aus einer Geschwindigkeit.
 *
 * Rechnet px/ms in die Einheiten der Kurve um: welchen Anteil der ganzen
 * Strecke die Hand in der ganzen Zeit des Übergangs schaffte. Zurück kommt nie
 * mehr als RC_GLIDE_MAX und nie weniger als null — eine Hand, die gegen den
 * Schritt schiebt, soll ihn nicht rückwärts anfahren lassen.
 */
export function rcGlideLead(speed: number, span: number, reach: number): number {
  if (reach === 0 || span <= 0) return 0;

  const m = (speed * span) / reach;
  return Math.min(RC_GLIDE_MAX, Math.max(0, m));
}
