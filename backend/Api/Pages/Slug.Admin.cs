using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Am Server: Adressen anlegen, öffnen und neu verschlüsseln (Befehle von `dotnet run -- slug`).</summary>
public static partial class Slug
{
    /* -- Am Server: Adressen öffnen ----------------------------------------
     *
     * Von Hand und nicht aus der Oberfläche: ein Eintrag IST die Erlaubnis,
     * eine Adresse zu übernehmen. Wer sie vergibt, sitzt am Server.
     */

    public static async Task<int> AdminAsync(string connectionString, string[] args)
    {
        var verb = args.Length > 1 ? args[1].ToLowerInvariant() : "list";

        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        return verb switch
        {
            "add" => await AddAsync(connection, args),
            "recode" => await RecodeAsync(connection, args),
            "host" => await HostAsync(connection, args),
            "list" => await ListAsync(connection),
            _ => Usage()
        };
    }

    private static int Usage()
    {
        Console.Error.WriteLine("  slug add <pfad> [\"wofuer\"] [--alias-of <ziel>]");
        Console.Error.WriteLine("                                Adresse oeffnen, Code ausgeben");
        Console.Error.WriteLine("                                <pfad> \"/\" ist die Wurzel (recreatio.pl)");
        Console.Error.WriteLine("  slug recode <pfad>            Neuen Code fuer eine noch freie Adresse");
        Console.Error.WriteLine("                                Der alte Code gilt danach nicht mehr");
        Console.Error.WriteLine("  slug host <pfad> <name|->     Eigene Domain an eine Adresse haengen");
        Console.Error.WriteLine("                                z.B. slug host cogita cogita.pl");
        Console.Error.WriteLine("  slug list                     Adressen zeigen (ohne Codes)");
        return 1;
    }

    /// <summary>
    /// Ein Hostname und sonst nichts: klein, mit Punkt, ohne Schema, ohne Pfad,
    /// ohne Doppelpunkt.
    ///
    /// <para>
    /// Dieselbe Form wie <c>ck_slug_host</c> — was hier hineinkommt, wird
    /// später mit dem verglichen, was der Browser als seinen Ort nennt. Eine
    /// Schreibweise mehr, und der Vergleich geht still daneben.
    /// </para>
    /// </summary>
    public static bool IsHostName(string host) =>
        host.Length is > 3 and <= 200
        && host == host.ToLowerInvariant()
        && host.Contains('.')
        && !host.StartsWith('.') && !host.EndsWith('.')
        && !host.Contains("..")
        && host.All(c => c is (>= 'a' and <= 'z') or (>= '0' and <= '9') or '.' or '-');

    /// <summary>
    /// Einen eigenen Namen an eine Adresse hängen — oder ihn abnehmen.
    ///
    /// <code>
    ///   slug host cogita cogita.pl
    ///   slug host cogita -
    /// </code>
    ///
    /// <para>
    /// <b>Das ist Betrieb, nicht Inhalt.</b> Wer einen Namen setzt, muss ohnehin
    /// das DNS umlegen und die Seite unter diesem Namen ausliefern. Die Adresse
    /// selbst bleibt, was sie war: mit Code übernommen und von einer Rolle
    /// geführt — der Name gibt niemandem ein Recht, er zeigt einen zweiten Weg.
    /// </para>
    /// </summary>
    private static async Task<int> HostAsync(SqlConnection connection, string[] args)
    {
        if (args.Length < 4) return Usage();

        var path = Normalise(args[2]);
        var host = args[3].Trim().ToLowerInvariant();
        var clear = host == "-";

        if (!IsWellFormed(path))
        {
            Console.Error.WriteLine($"  XX   \"{Show(path)}\" ist keine Adresse.");
            return 1;
        }

        if (!clear && !IsHostName(host))
        {
            Console.Error.WriteLine($"  XX   \"{host}\" ist kein Name: klein, mit Punkt, ohne http und ohne Pfad.");
            return 1;
        }

        await using var cmd = new SqlCommand(
            "UPDATE app.slug SET host = @host WHERE path = @path;", connection);

        cmd.Parameters.AddWithValue("@host", clear ? DBNull.Value : host);
        cmd.Parameters.AddWithValue("@path", path);

        try
        {
            if (await cmd.ExecuteNonQueryAsync() == 0)
            {
                Console.Error.WriteLine($"  XX   \"{Show(path)}\" steht nicht im Register.");
                return 1;
            }
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            // Ein Name gehört genau einer Adresse — sonst entschiede die
            // Reihenfolge der Zeilen, welche Seite er zeigt.
            Console.Error.WriteLine($"  XX   \"{host}\" zeigt schon auf eine andere Adresse.");
            return 1;
        }

        Console.WriteLine(clear
            ? $"  Der Name ist von recreatio.pl/{Show(path)} abgenommen."
            : $"  {host} zeigt jetzt auf recreatio.pl/{Show(path)}.");

        if (!clear)
        {
            Console.WriteLine();
            Console.WriteLine("  Es fehlt noch, was nicht in der Datenbank steht:");
            Console.WriteLine("    - DNS von " + host + " auf den Ort der Seite,");
            Console.WriteLine("    - dieselbe Oberflaeche unter diesem Namen ausliefern,");
            Console.WriteLine("    - " + host + " in Api:Origins aufnehmen (CORS).");
        }

        Console.WriteLine();
        return 0;
    }

    private static async Task<int> AddAsync(SqlConnection connection, string[] args)
    {
        if (args.Length < 3) return Usage();

        var path = Normalise(args[2]);
        var rest = args.Skip(3).ToArray();

        // Der erste freie Wert ist die Notiz; alles mit -- davor ist ein Schalter.
        var note = rest.Length > 0 && !rest[0].StartsWith("--", StringComparison.Ordinal) ? rest[0] : null;

        string? aliasOf = null;
        for (var i = 0; i < rest.Length - 1; i++)
        {
            if (rest[i] == "--alias-of") aliasOf = Normalise(rest[i + 1]);
        }

        if (!IsWellFormed(path))
        {
            Console.Error.WriteLine(
                $"  XX   \"{path}\" ist keine Adresse: kleine Buchstaben, Ziffern, Bindestriche, Teile mit /.");
            return 1;
        }

        if (IsReserved(path))
        {
            Console.Error.WriteLine("  XX   Diese Adresse gehoert der Plattform selbst (workspace, seat, verify, dolacz, widget, portal).");
            return 1;
        }

        /*
         * EIN CODE GEHÖRT EINER WURZEL. Was unter einer übernommenen Adresse
         * liegt, öffnet der, der sie führt — dort heisst es lokale Route und
         * braucht kein Geheimnis (Access.OpenAsync).
         *
         * Gäbe es beide Wege, entstünde zweimal dieselbe Adresse: einmal von
         * oben geöffnet, einmal mit Code übernommen. Welche Seite erschiene,
         * entschiede die Reihenfolge der Zeilen. Dieselbe Regel steht als
         * ck_slug_root_code in der Datenbank (0017).
         */
        if (path.Contains('/'))
        {
            Console.Error.WriteLine(
                $"  XX   \"{path}\" ist eine Unteradresse - Codes gibt es nur fuer Wurzeln.");
            Console.Error.WriteLine(
                "       Was unter einer Adresse liegt, oeffnet ihr Fuehrender selbst, im Arbeitsplatz.");
            return 1;
        }

        if (aliasOf is not null)
        {
            if (!IsWellFormed(aliasOf) || aliasOf == path)
            {
                Console.Error.WriteLine("  XX   Das Ziel des Alias ist keine andere Adresse.");
                return 1;
            }

            /*
             * Das Ziel muss es geben UND selbst keiner sein. Eine Kette liesse
             * sich im Kreis legen, und wer sie aufruft, liefe ihn mit.
             */
            await using var target = new SqlCommand(
                "SELECT alias_of FROM app.slug WHERE path = @p;", connection);
            target.Parameters.AddWithValue("@p", aliasOf);

            var found = await target.ExecuteScalarAsync();

            if (found is null)
            {
                Console.Error.WriteLine($"  XX   \"{Show(aliasOf)}\" steht nicht im Register.");
                return 1;
            }

            if (found is not DBNull)
            {
                Console.Error.WriteLine($"  XX   \"{Show(aliasOf)}\" ist selbst ein Alias. Ketten gibt es nicht.");
                return 1;
            }
        }

        // Der Klartext existiert ab hier genau einmal: in dieser Ausgabe.
        var code = Token.NewSecret();

        await using var insert = new SqlCommand("""
            INSERT INTO app.slug (id, path, claim_code_sha256, note, alias_of, created_at)
            VALUES (@id, @path, @hash, @note, @alias, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", Ids.NewId());
        insert.Parameters.AddWithValue("@path", path);
        insert.Parameters.AddWithValue("@hash", Token.HashSecret(code));
        insert.Parameters.AddWithValue("@note", (object?)note ?? DBNull.Value);
        insert.Parameters.AddWithValue("@alias", (object?)aliasOf ?? DBNull.Value);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync();
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            Console.Error.WriteLine($"  XX   \"{Show(path)}\" steht schon im Register.");
            return 1;
        }

        Console.WriteLine();
        Console.WriteLine($"  Adresse   recreatio.pl/{path}");

        if (aliasOf is not null)
        {
            Console.WriteLine($"  Alias auf recreatio.pl/{aliasOf}  (eigener Inhalt liegt dort)");
        }

        Console.WriteLine($"  Code      {code}");
        Console.WriteLine();
        Console.WriteLine("  Der Code steht genau einmal hier - gespeichert ist nur sein SHA-256.");
        Console.WriteLine("  Wer ihn eintippt, setzt eine seiner Rollen auf diese Adresse und auf alles darunter.");
        Console.WriteLine();
        return 0;
    }

    /// <summary>
    /// Ein neuer Code für eine Adresse, die noch frei ist.
    ///
    /// <para>
    /// <b>Ein Code kann verlorengehen.</b> Er steht genau einmal in einer
    /// Ausgabe, und wer sie nicht aufbewahrt hat, hat ihn nicht mehr. Die
    /// Adresse ist deshalb nicht verloren: an die Stelle des alten Hashes tritt
    /// ein neuer, und der alte Code ist von da an nichts mehr wert.
    /// </para>
    ///
    /// <para>
    /// <b>Nur, was niemand führt.</b> Eine übernommene Adresse hat ihren Code
    /// verbraucht — übernommen wird ja nur, was frei ist. Ein Befehl, der auch
    /// dort noch einen Code ausgäbe, wäre ein Weg, eine fremde Adresse
    /// zurückzuholen. Die Bedingung steht deshalb im <c>WHERE</c> und nicht in
    /// einer Prüfung davor, die man beim nächsten Umbau vergessen kann.
    /// </para>
    /// </summary>
    private static async Task<int> RecodeAsync(SqlConnection connection, string[] args)
    {
        if (args.Length < 3) return Usage();

        var path = Normalise(args[2]);

        if (!IsWellFormed(path))
        {
            Console.Error.WriteLine($"  XX   \"{Show(path)}\" ist keine Adresse.");
            return 1;
        }

        // Der Klartext existiert ab hier genau einmal: in dieser Ausgabe.
        var code = Token.NewSecret();

        await using var cmd = new SqlCommand("""
            UPDATE app.slug
            SET claim_code_sha256 = @hash
            OUTPUT inserted.alias_of
            WHERE path = @path AND claimed_by_role_id IS NULL;
            """, connection);

        cmd.Parameters.AddWithValue("@hash", Token.HashSecret(code));
        cmd.Parameters.AddWithValue("@path", path);

        /*
         * Keine Zeile heisst zweierlei: den Pfad gibt es nicht, oder er ist
         * vergeben. Draussen wären das zwei Antworten und damit ein Verzeichnis
         * (siehe ClaimAsync) — hier am Server dürfen sie zusammenfallen, denn
         * wer hier sitzt, sieht mit `slug list` ohnehin, welcher Fall es war.
         */
        var alias = await cmd.ExecuteScalarAsync();

        if (alias is null)
        {
            Console.Error.WriteLine(
                $"  XX   \"{Show(path)}\" steht nicht im Register oder ist schon vergeben.");
            return 1;
        }

        Console.WriteLine();
        Console.WriteLine($"  Adresse   recreatio.pl/{path}");

        if (alias is not DBNull)
        {
            Console.WriteLine($"  Alias auf recreatio.pl/{(string)alias}  (eigener Inhalt liegt dort)");
        }

        Console.WriteLine($"  Code      {code}");
        Console.WriteLine();
        Console.WriteLine("  Neu ausgegeben - der alte Code gilt ab sofort nicht mehr.");
        Console.WriteLine("  Der Code steht genau einmal hier - gespeichert ist nur sein SHA-256.");
        Console.WriteLine();
        return 0;
    }

    /// <summary>Die Wurzel hat keinen Namen — für die Ausgabe bekommt sie „/".</summary>
    private static string Show(string path) => path == Home ? "/" : path;

    private static async Task<int> ListAsync(SqlConnection connection)
    {
        await using var cmd = new SqlCommand(
            "SELECT path, note, claimed_at, alias_of, host FROM app.slug ORDER BY path;", connection);

        await using var reader = await cmd.ExecuteReaderAsync();

        var rows = 0;
        while (await reader.ReadAsync())
        {
            var path = Show(reader.GetString(0));
            var note = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);
            var state = reader.IsDBNull(2) ? "frei" : "vergeben";
            var alias = reader.IsDBNull(3) ? string.Empty : $"-> {Show(reader.GetString(3))}  ";
            var host = reader.IsDBNull(4) ? string.Empty : $"[{reader.GetString(4)}]  ";

            Console.WriteLine($"  {state,-9} {path,-32} {alias}{host}{note}");
            rows++;
        }

        if (rows == 0) Console.WriteLine("  (das Register ist leer - `slug add <pfad>` oeffnet die erste Adresse)");
        return 0;
    }
}
