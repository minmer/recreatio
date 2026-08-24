SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ===========================================================================
   rc_0004_datakinds — 'role_key' als eigene Art der Schluesselzuteilung

   BEFUND 43. Beim Bau der Rollenschicht wurde 'data_key' fuer etwas benutzt,
   wofuer es nicht gedacht war: fuer die Zuteilung des Schluessels einer ROLLE
   an ihren Halter. Beim Bau von Kapitel 12 stellte sich heraus, dass
   'data_key' der Schluessel eines DATENELEMENTS ist (rc_data_item) — und dass
   die Loeschung durch Schluesselvernichtung (12.3.2 Weg b) genau diese
   Zuteilungen vernichtet.

   Beides in einer Art zu fuehren waere nicht bloss unsauber, sondern
   gefaehrlich: eine Loeschung, die "alle data_key-Zuteilungen dieser Rolle"
   vernichtet, haette die Rolle selbst mit ausgesperrt. Der Unterschied
   zwischen 'was diese Rolle IST' und 'was diese Rolle WEISS' muss in der
   Spalte stehen, nicht im Kopf dessen, der die Abfrage schreibt.

   Die Aufzaehlung wird deshalb um 'role_key' erweitert und die bestehenden
   Zeilen werden umgesetzt.
   =========================================================================== */

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_role_key_grant_kind')
    ALTER TABLE dbo.rc_role_key_grant DROP CONSTRAINT ck_rc_role_key_grant_kind;
GO

/* Bestehende Rollenzuteilungen erkennt man daran, dass key_ref auf eine Rolle
   zeigt. Datenelemente gab es zu diesem Zeitpunkt noch keine — die Abfrage ist
   trotzdem so geschrieben, dass sie auch dann noch stimmt, wenn dieses Skript
   spaeter einmal auf einem gewachsenen Bestand laeuft.                        */
UPDATE g
SET key_kind = N'role_key'
FROM dbo.rc_role_key_grant g
WHERE g.key_kind = N'data_key'
  AND EXISTS (SELECT 1 FROM dbo.rc_role r WHERE r.id = g.key_ref);
GO

ALTER TABLE dbo.rc_role_key_grant ADD CONSTRAINT ck_rc_role_key_grant_kind
    CHECK (key_kind IN (N'epoch', N'shared_view', N'data_key', N'role_key', N'recovery'));
GO
