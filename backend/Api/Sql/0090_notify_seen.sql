/*
    PRZEJRZANE — JE KONTO, NICHT JE GERÄT (0090).

    Bisher stand „seit wann ist etwas neu" im Browser (localStorage). Wer
    „Oznacz jako przejrzane" drückte, tat das nur für DIESEN Browser: auf dem
    Telefon, im zweiten Browser, nach dem Leeren des Speichers waren dieselben
    Zgłoszenia wieder neu — tagelang, bis das Fenster von drei Tagen sie
    vergass. Für das Konto war die Nachricht längst angekommen.

    Jetzt hält der Dienst die Marke, je Konto:

      kind 'all'    alles bis hier ist gesehen (die Glocke: „Oznacz wszystko")
      kind 'form'   die Zgłoszenia EINES Formulars bis hier (subject_id = Baustein);
                    gesetzt, sobald die Kanzlei die Liste öffnet
      kind 'links'  wer über Links hereinkam, bis hier (die Liste der Links geöffnet)

    Neu ist, was nach der jüngsten zutreffenden Marke kam — auf jedem Gerät
    dasselbe, und es bleibt neu, bis es jemand mit diesem Konto gesehen hat
    (höchstens 60 Tage zurück). Ein Konto ohne Marke bekommt beim ersten
    Nachsehen eine von vor drei Tagen: so viel war vorher sichtbar.
*/

IF OBJECT_ID('app.notify_seen') IS NULL
    CREATE TABLE app.notify_seen
    (
        account_id  uniqueidentifier  NOT NULL,
        kind        nvarchar(8)       NOT NULL,
        subject_id  uniqueidentifier  NOT NULL,
        seen_at     datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_notify_seen PRIMARY KEY (account_id, kind, subject_id),
        CONSTRAINT fk_notify_seen_account FOREIGN KEY (account_id) REFERENCES app.account (id),
        CONSTRAINT ck_notify_seen_kind CHECK (kind IN (N'all', N'form', N'links'))
    );
GO
