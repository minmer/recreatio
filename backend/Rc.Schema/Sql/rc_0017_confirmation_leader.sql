/* ===========================================================================
   rc_0017 — Der Annahmeschlüssel gehört einer ROLLE, nicht dem Bereich

   BISHER lag der private Annahmeschluessel unter dem Epochenschluessel des
   Bereichs. Damit konnte jeder, der den Bereich lesen darf, die Anmeldungen
   der Kinder oeffnen — und „den Bereich lesen duerfen" ist etwas, das man
   bekommt, um an einem Messplan zu arbeiten.

   JETZT gehoert er einer Rolle: der Person, die das Firmjahr fuehrt. Wer diese
   Rolle nicht haelt, kommt an die Anmeldungen nicht heran, auch mit dem
   Bereichsschluessel nicht.

   WEITERGEBEN geht trotzdem — ueber denselben Weg wie bei jeder anderen Rolle
   (POST /rc/roles/{id}/holders). Das ist der Unterschied zwischen „niemand
   sonst kann es" und „nur wer es bekommen hat": das Erste waere eine Sackgasse,
   sobald jemand krank wird.

   BESTEHENDE GRUPPEN behalten ihren alten Schluessel, solange leader_role_id
   leer ist. Der Dienst liest beide Wege; die Spalte sagt, welcher gilt.
   =========================================================================== */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF COL_LENGTH('dbo.rc_confirmation_group', 'leader_role_id') IS NULL
BEGIN
    ALTER TABLE dbo.rc_confirmation_group ADD
        /* Die Rolle, der der Annahmeschluessel gehoert.
           NULL heisst: alte Gruppe, Schluessel liegt noch unter der Epoche.  */
        leader_role_id uniqueidentifier NULL;
END
GO

/* Die Rolle muss es geben. Ohne diese Verknuepfung koennte leader_role_id auf
   eine geloeschte Rolle zeigen, und der Schluessel waere fort, ohne dass die
   Zeile es zugibt. */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_rc_conf_leader')
    ALTER TABLE dbo.rc_confirmation_group
        ADD CONSTRAINT fk_rc_conf_leader FOREIGN KEY (leader_role_id)
            REFERENCES dbo.rc_role (id);
GO

/* Der Weg von der Rolle zu ihren Gruppen — fuer die Frage „was fuehre ich?". */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_conf_leader')
    CREATE INDEX ix_rc_conf_leader
        ON dbo.rc_confirmation_group (leader_role_id)
        WHERE leader_role_id IS NOT NULL;
GO
