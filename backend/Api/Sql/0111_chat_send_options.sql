/* 0111 — WIE EINE NACHRICHT HINAUSGEHT, wie in jedem Messenger:

   1. „Wyślij, gdy będzie online" — `wait_online_from` ist der Absender (Konto
      oder Platz); die Nachricht wartet (`pending`), bis jemand ANDERES aus der
      Rozmowa in der App ist und das zeigt (Einstellung `ShareOnline`) —
      spätestens bis `scheduled_at` (ein Jahr). Wer nicht zeigt, dass er da
      ist, verrät es auch nicht über eine solche Nachricht.
   2. „Wyślij bez dźwięku" — `silent`: niemand wird geweckt (kein Push), die
      Nachricht zählt trotzdem als neu.
   3. `app.online` — wann ein Konto oder ein Platz zuletzt in der App war (der
      Browser meldet sich alle 45 s, solange die Seite zu sehen ist). Gezeigt
      wird es nur denen, die es teilen; die Zeile selbst sagt nichts über Inhalte.

   Additiv: ein älterer Dienst schreibt die Vorgaben (0 / NULL) und läuft weiter.
   Keine JSON-Funktionen der Datenbank (sie fehlen hier).
*/
IF COL_LENGTH('app.chat_message', 'wait_online_from') IS NULL
    ALTER TABLE app.chat_message ADD wait_online_from uniqueidentifier NULL;
GO
IF COL_LENGTH('app.chat_message', 'silent') IS NULL
    ALTER TABLE app.chat_message ADD silent bit NOT NULL CONSTRAINT df_message_silent DEFAULT 0;
GO
IF OBJECT_ID('app.online', 'U') IS NULL
CREATE TABLE app.online (
    principal_id uniqueidentifier NOT NULL CONSTRAINT pk_online PRIMARY KEY,
    seen_at datetimeoffset(7) NOT NULL
);
GO
