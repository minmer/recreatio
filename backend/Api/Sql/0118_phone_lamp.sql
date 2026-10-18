/* 0118 — LAMPY: Geräte, die das Telefon (Ausgabe „sms") per Bluetooth LE
   steuert, jedes mit seinen Sygnały (Werbepakete, Dauer, Ramki) als EINE Hülle
   unter dem Schlüssel eines Bereichs (gedacht: des eigenen, „Tylko ja").

   `app.phone_lamp` — eine Lampe je Zeile. `version` zählt jede Änderung: wer
   mit einem alten Stand speichert, wird abgewiesen. Gelöscht wird wirklich
   (kein Abgleich mit dem Telefon nötig: es liest die Liste jedes Mal neu).

   Der Dienst öffnet die Hülle nicht — Namen, Nummern und Bytes der Sygnały
   sieht er nicht.
*/
IF OBJECT_ID('app.phone_lamp', 'U') IS NULL
    CREATE TABLE app.phone_lamp
    (
        id          uniqueidentifier  NOT NULL,
        area_id     uniqueidentifier  NOT NULL,
        epoch       int               NOT NULL,
        sealed      varbinary(max)    NOT NULL,
        version     int               NOT NULL,
        created_at  datetimeoffset(7) NOT NULL,
        updated_at  datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_phone_lamp PRIMARY KEY (id),
        CONSTRAINT fk_phone_lamp_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_phone_lamp_epoch CHECK (epoch >= 1),
        CONSTRAINT ck_phone_lamp_version CHECK (version >= 1)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_phone_lamp_area')
    CREATE INDEX ix_phone_lamp_area ON app.phone_lamp (area_id, created_at);
GO
