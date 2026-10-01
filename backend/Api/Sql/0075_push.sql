/*
    PUSH (0075) — das Telefon sofort wecken, statt alle 15 Minuten zu fragen.

    Bisher fragte die App bei geschlossenem Bildschirm höchstens alle 15
    Minuten nach Neuem (0067) — für eine Nachricht viel zu spät. Jetzt
    schickt der Dienst bei einer neuen Nachricht, Anmeldung oder einem
    eingelösten Link ein Wecksignal über Firebase Cloud Messaging an die
    Geräte, die es betrifft. Das Signal trägt NICHTS als „sieh nach"; das
    Telefon holt dann selbst die Zahlen (/notify/digest) und meldet sich.

    push_token  die Kennung des Geräts bei FCM (sie muss im Klartext liegen,
                sonst lässt sich nichts schicken; sie öffnet nichts)
    push_at     wann zuletzt geweckt wurde
    push_error  warum das letzte Wecken nicht ging (für die Einstellungen)
*/

IF COL_LENGTH('app.notify_device', 'push_token') IS NULL
    ALTER TABLE app.notify_device ADD push_token nvarchar(512) NULL;
GO

IF COL_LENGTH('app.notify_device', 'push_at') IS NULL
    ALTER TABLE app.notify_device ADD push_at datetimeoffset(7) NULL;
GO

IF COL_LENGTH('app.notify_device', 'push_error') IS NULL
    ALTER TABLE app.notify_device ADD push_error nvarchar(200) NULL;
GO
