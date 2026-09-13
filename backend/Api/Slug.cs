using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Das Adressregister — wer <c>recreatio.pl/&lt;pfad&gt;</c> führt.
///
/// <para>
/// <b>Übernehmen, nicht anlegen.</b> Der Eintrag steht vorher da (<c>slug
/// add</c> am Server), mit einem Code. Wer den Code hat, setzt EINE seiner
/// Rollen auf die Adresse — und damit auf alles darunter.
/// </para>
///
/// <para>
/// <b>Eine Antwort für zwei Fälle.</b> „Diesen Pfad gibt es nicht" und „der
/// Code stimmt nicht" sind von aussen nicht zu unterscheiden. Zwei Antworten
/// wären ein Verzeichnis: man tippt Wörter durch und liest ab, welche Adressen
/// zu haben sind, bevor sie jemand hat.
/// </para>
/// </summary>
public static partial class Slug
{
    /// <summary>Passt in <c>app.slug.path</c> und in eine Adresszeile.</summary>
    public const int MaxPathLength = 200;

    public static void Map(WebApplication app)
    {
        app.MapPost("/workspace/slug/claim", ClaimAsync);
    }

    public sealed record ClaimRequest(string Path, string Code, string RoleId);

    /// <summary>
    /// Kleinbuchstaben, Ziffern, Bindestriche; Teile durch <c>/</c>. Kein
    /// führender, doppelter oder abschliessender Schrägstrich — dieselbe Regel
    /// wie <c>ck_slug_path</c>, damit der Dienst ablehnt, was die Datenbank
    /// ohnehin ablehnen würde, und zwar mit einem Satz statt einer Fehlernummer.
    /// </summary>
    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*)*$")]
    private static partial Regex Shape();

    /// <summary>
    /// Die Wurzel: <c>recreatio.pl</c> selbst, im Register die leere
    /// Zeichenkette.
    ///
    /// <para>
    /// Sie ist der einzige Pfad ohne Wort. `Normalise` macht aus „/" von selbst
    /// sie — deshalb schreibt man am Server schlicht <c>slug add /</c>.
    /// </para>
    /// </summary>
    public const string Home = "";

    public static string Normalise(string? path) =>
        (path ?? string.Empty).Trim().Trim('/').ToLowerInvariant();

    public static bool IsWellFormed(string path) =>
        path == Home || (path.Length <= MaxPathLength && Shape().IsMatch(path));

    /// <summary>Der Arbeitsplatz selbst. Er ist keine Adresse, die jemand führt.</summary>
    public static bool IsReserved(string path) =>
        path == "workspace" || path.StartsWith("workspace/", StringComparison.Ordinal);

    /// <summary>Die Vorfahren von <c>a/b/c</c>: <c>a</c> und <c>a/b</c>.</summary>
    public static IReadOnlyList<string> Ancestors(string path)
    {
        var parts = path.Split('/');
        var ancestors = new List<string>(Math.Max(0, parts.Length - 1));

        for (var i = 1; i < parts.Length; i++) ancestors.Add(string.Join('/', parts[..i]));
        return ancestors;
    }

    private static async Task ClaimAsync(HttpContext ctx, Db db, ClaimRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var path = Normalise(body.Path);

        if (!IsWellFormed(path))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Adres: małe litery, cyfry i myślniki; części oddziel ukośnikiem.");
            return;
        }

        if (IsReserved(path))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Adres „workspace” należy do samego warsztatu.");
            return;
        }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rola.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        // Die Rolle muss DIESEM Konto gehören. Ohne diese Zeile setzte man eine
        // fremde Rolle auf eine Adresse und gäbe sie damit weg.
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == roleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
            return;
        }

        Guid slugId = Guid.Empty;
        byte[]? codeHash = null;
        Guid? claimedBy = null;

        await using (var find = new SqlCommand(
            "SELECT id, claim_code_sha256, claimed_by_role_id FROM app.slug WHERE path = @p;", connection))
        {
            find.Parameters.AddWithValue("@p", path);

            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                slugId = reader.GetGuid(0);
                codeHash = (byte[])reader[1];
                claimedBy = reader.IsDBNull(2) ? null : reader.GetGuid(2);
            }
        }

        /*
         * Gerechnet wird immer, auch für einen Pfad, den es nicht gibt: sonst
         * verriete die Antwortzeit, was die Antwort verschweigt.
         */
        var presented = Token.HashSecret(body.Code ?? string.Empty);
        var known = codeHash ?? new byte[presented.Length];

        if (!CryptographicOperations.FixedTimeEquals(known, presented) || codeHash is null)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tego adresu nie ma do wzięcia albo kod się nie zgadza.");
            return;
        }

        if (claimedBy is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten adres jest już zajęty.");
            return;
        }

        /*
         * Wer `schola` führt, führt `schola/proby`. Eine Unteradresse an eine
         * fremde Rolle zu geben hiesse, in ein fremdes Haus eine Tür zu setzen.
         */
        var ancestors = Ancestors(path);
        if (ancestors.Count > 0)
        {
            var held = await LongestClaimedAsync(connection, ancestors, ctx.RequestAborted);
            if (held is not null && !mine.Any(r => r.Id == held.Value.RoleId))
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    $"Adres nadrzędny „{held.Value.Path}” należy do kogoś innego.");
                return;
            }
        }

        var now = DateTimeOffset.UtcNow;

        await using var claim = new SqlCommand("""
            UPDATE app.slug
            SET claimed_by_role_id = @role, claimed_by_account_id = @account, claimed_at = @now
            WHERE id = @id AND claimed_by_role_id IS NULL;
            """, connection);

        claim.Parameters.AddWithValue("@role", roleId);
        claim.Parameters.AddWithValue("@account", who.Value.AccountId);
        claim.Parameters.AddWithValue("@now", now);
        claim.Parameters.AddWithValue("@id", slugId);

        // Zwei, die im selben Augenblick denselben Code eintippen: der zweite
        // trifft auf 0 Zeilen. Ohne die Bedingung im WHERE überschriebe er den
        // ersten.
        if (await claim.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten adres jest już zajęty.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            path,
            roleId = Ids.ToText(roleId),
            claimedAt = now
        });
    }

    /// <summary>
    /// Von den genannten Adressen die LÄNGSTE, die jemand führt — mit ihrer
    /// Rolle.
    ///
    /// <para>
    /// Die eine Stelle, an der „wer ist hier verantwortlich" beantwortet wird.
    /// Beim Übernehmen bekommt sie die Vorfahren zu sehen (der Pfad selbst ist
    /// dort ja noch frei), beim Schreiben einer Seite den Pfad UND seine
    /// Vorfahren. Zwei Fassungen dieser Frage wären zwei Rechteprüfungen, und
    /// eine davon liefe irgendwann anders.
    /// </para>
    /// </summary>
    public static async Task<(string Path, Guid RoleId)?> LongestClaimedAsync(
        SqlConnection connection, IReadOnlyList<string> paths, CancellationToken ct)
    {
        if (paths.Count == 0) return null;

        var names = string.Join(", ", paths.Select((_, i) => $"@a{i}"));

        // Der längste zuerst: die nächstliegende Heimat entscheidet, nicht die
        // oberste.
        await using var cmd = new SqlCommand(
            $"SELECT TOP 1 path, claimed_by_role_id FROM app.slug "
            + $"WHERE path IN ({names}) AND claimed_by_role_id IS NOT NULL "
            + "ORDER BY LEN(path) DESC;", connection);

        for (var i = 0; i < paths.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", paths[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return (reader.GetString(0), reader.GetGuid(1));
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }

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
            Console.Error.WriteLine("  XX   \"workspace\" gehoert dem Arbeitsplatz selbst.");
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
