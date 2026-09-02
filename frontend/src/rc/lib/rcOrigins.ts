/**
 * Wo die Dinge liegen — und die EINE Liste dessen, was sich ändert, wenn es
 * mehr als eine Domäne gibt.
 *
 * ---------------------------------------------------------------------------
 * DER STAND HEUTE
 *
 * <b>Alles hängt an zwei Namen:</b> `recreatio.pl` trägt die Seite,
 * `api.recreatio.pl` den Dienst. Das ist fest verdrahtet und soll es vorerst
 * sein — eine Einrichtung mit einem Haus, einer Pfarrei und einer Handvoll
 * Veranstaltungen braucht keine Domänenverwaltung, sie braucht eine Adresse,
 * die funktioniert.
 *
 * ---------------------------------------------------------------------------
 * WAS SICH ÄNDERT, WENN ES MEHRERE WERDEN
 *
 * Kommen eigene Domänen dazu — eine Pfarrei unter ihrem eigenen Namen, ein
 * Mandant mit eigener Adresse —, dann sind es genau diese Stellen. Sie tragen
 * alle dieselbe Marke, und <b>ein `grep -r DOMAENENWECHSEL` findet sie</b>:
 *
 *   1. `RC_API_ORIGIN` hier — der Dienst. Wird dann je Mandant verschieden
 *      oder relativ zum eigenen Ursprung.
 *   2. `RC_HASH_BASE` in `rcRoute.ts` — die Plattform hängt unter `#/new`.
 *      Ohne Raute wird daraus ein Pfad, und mit eigener Domäne womöglich `/`.
 *   3. `PUBLIC_BASE` in `publicRoutes.ts` — dasselbe für die öffentliche Seite.
 *   4. Die erlaubten Ursprünge im Dienst (CORS). Heute gibt es sie im neuen
 *      Teil noch gar nicht; mit mehreren Domänen werden sie zu einer Liste,
 *      die aus der Konfiguration kommt und nicht aus dem Quelltext.
 *
 * <b>Die Reihenfolge ist keine Empfehlung, sondern eine Abhängigkeit:</b> ohne
 * (4) nützt (1) nichts — der Browser blockt die Anfrage, bevor der Dienst sie
 * sieht.
 *
 * ---------------------------------------------------------------------------
 * WARUM DAS HIER STEHT UND NICHT IN EINER AUFGABENLISTE
 *
 * Eine fest verdrahtete Domäne ist keine Schuld, solange sie eine Entscheidung
 * ist. Sie wird erst zu einer, wenn sie in fünf Dateien steht und niemand mehr
 * weiss, welche davon gemeint sind. Deshalb: eine Stelle, eine Marke, und die
 * Liste dessen, was zusammengehört.
 */

/**
 * Der Dienst.
 *
 * DOMAENENWECHSEL — heute ein fester Name, später je Mandant.
 *
 * In der Entwicklung wird er NICHT benutzt: dort leitet der Entwicklungsserver
 * `/rc` an den lokalen Dienst weiter, damit Seite und Dienst auf demselben
 * Ursprung liegen und das Sitzungsplätzchen überhaupt zurückkommt
 * (`vite.config.ts`, `RcCookiePolicy`).
 */
export const RC_API_ORIGIN = 'https://api.recreatio.pl';

/**
 * Die öffentliche Seite.
 *
 * DOMAENENWECHSEL — heute ein fester Name. Gebraucht wird er dort, wo ein Link
 * aus der Plattform zurück nach draussen führt.
 */
export const RC_SITE_ORIGIN = 'https://recreatio.pl';
