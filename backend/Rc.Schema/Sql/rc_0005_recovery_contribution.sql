SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ===========================================================================
   rc_0005_recovery_contribution — die Beitraege der Buergen

   BEFUND 45. Der Schwellwert aus 8.2 verlangt, dass MEHRERE MENSCHEN
   zusammenkommen. Die erste Umsetzung verlangte statt dessen, dass EINE
   Anfrage alle noetigen Anteile oeffnen kann — und weil ein Anteil nur mit dem
   Schluessel seines Buergen aufgeht, haette das eine Person verlangt, die
   mehrere persoenliche Rollen haelt. Die gibt es nicht. Die Wiederherstellung
   waere also nie vollziehbar gewesen.

   Dieselbe Ueberlegung wie bei der Einladung loest es: jeder Buerge oeffnet
   SEINEN Anteil mit SEINEM Schluessel und verpackt ihn neu unter dem
   oeffentlichen Verpackungsschluessel des Antragstellers. Die Beitraege
   sammeln sich hier, bis der Schwellwert erreicht ist.

   Was dabei NICHT entsteht: ein Ort, an dem Klartext liegt. Ein Beitrag ist
   ein Anteil, verpackt fuer genau einen Empfaenger — der Betreiber sieht
   Huellen, die er nicht oeffnen kann, und ein einzelner Beitrag verraet
   ohnehin nichts (8.2).
   =========================================================================== */

IF OBJECT_ID('dbo.rc_recovery_contribution', 'U') IS NULL
CREATE TABLE dbo.rc_recovery_contribution (
    seq               bigint IDENTITY(1,1) NOT NULL,
    id                uniqueidentifier     NOT NULL,
    request_id        uniqueidentifier     NOT NULL,
    guarantor_role_id uniqueidentifier     NOT NULL,

    /* Der Anteil, neu verpackt unter wrap_public_key des Antragstellers.
       AlgId 0x02, AAD kernel:recovery_contribution:<id>:masterkey:1.          */
    share_resealed    varbinary(1024)      NOT NULL,
    contributed_at    datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_recovery_contribution PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_recovery_contribution_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_recovery_contribution_request
        FOREIGN KEY (request_id) REFERENCES dbo.rc_recovery_request (id),
    CONSTRAINT fk_rc_recovery_contribution_role
        FOREIGN KEY (guarantor_role_id) REFERENCES dbo.rc_role (id),

    /* Ein Buerge zaehlt einmal. Ohne das koennte einer allein den Schwellwert
       erreichen, indem er denselben Anteil mehrfach einreicht — und die ganze
       Teilung waere eine Kopie mit Zwischenschritt.                           */
    CONSTRAINT uq_rc_recovery_contribution_once UNIQUE (request_id, guarantor_role_id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_recovery_contribution_request')
    CREATE INDEX ix_rc_recovery_contribution_request
        ON dbo.rc_recovery_contribution (request_id);
GO

/* Beitraege sind Tatsachen, keine Zustaende: wer beigetragen hat, hat
   beigetragen. Nachtraeglich zu streichen, wer dabei war, waere die bequemste
   Art, eine Wiederherstellung anders aussehen zu lassen, als sie war (7.6).   */
IF OBJECT_ID('dbo.tr_rc_recovery_contribution_append_only', 'TR') IS NULL
EXEC('
CREATE TRIGGER dbo.tr_rc_recovery_contribution_append_only
ON dbo.rc_recovery_contribution
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    RAISERROR (''rc_recovery_contribution ist append-only (7.6).'', 16, 1);
    ROLLBACK TRANSACTION;
END');
GO
