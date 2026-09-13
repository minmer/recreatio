/*
    Ein Code gehört einer WURZEL — nie einer Unteradresse.

    `parish` wird mit einem Code übernommen. Was darunter liegt, ist von da an
    Sache dessen, der `parish` führt: er öffnet dort lokale Routen (ohne Code,
    `claim_code_sha256 IS NULL`, siehe Access.OpenAsync und 0012).

    <b>Warum das eine Regel ist und nicht eine Gewohnheit.</b> Gäbe es beide
    Wege, entstünde zweimal dieselbe Adresse: der Führende von `parish` öffnet
    sich `parish/grzegorzki`, und daneben liegt ein `parish/grzegorzki`, das
    jemand mit einem Code übernommen hat. Zwei Verantwortliche für eine
    Adresszeile — und welche Seite erscheint, entschiede die Reihenfolge der
    Zeilen. Das ist kein Streitfall, den man später klärt; es ist einer, den
    man nicht entstehen lässt.

    <b>Wer eine Unteradresse weitergeben will</b>, stellt ein Zertifikat aus
    (app.certificate). Das ist der Weg dafür, und er nimmt niemandem etwas:
    der Führende bleibt der Führende, und zurückgenommen ist es sofort.

    Die leere Wurzel (`N''` — recreatio.pl selbst) hat keinen Schrägstrich und
    ist von der Regel deshalb nicht berührt.

    `WITH CHECK`: die vorhandenen Zeilen werden mitgeprüft. Läge schon eine
    Unteradresse mit Code im Register, müsste man sie ansehen und nicht
    stillschweigend weiterführen.
*/

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'ck_slug_root_code')
BEGIN
    ALTER TABLE app.slug WITH CHECK
        ADD CONSTRAINT ck_slug_root_code
        CHECK (claim_code_sha256 IS NULL OR CHARINDEX(N'/', path) = 0);
END
GO
