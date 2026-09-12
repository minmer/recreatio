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

    public static string Normalise(string? path) =>
        (path ?? string.Empty).Trim().Trim('/').ToLowerInvariant();

    public static bool IsWellFormed(string path) =>
        path.Length is > 0 and <= MaxPathLength && Shape().IsMatch(path);

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
            var held = await ClaimedAncestorAsync(connection, ancestors, ctx.RequestAborted);
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

    private static async Task<(string Path, Guid RoleId)?> ClaimedAncestorAsync(
        SqlConnection connection, IReadOnlyList<string> ancestors, CancellationToken ct)
    {
        var names = string.Join(", ", ancestors.Select((_, i) => $"@a{i}"));

        // Der längste zuerst: die nächstliegende Heimat entscheidet, nicht die
        // oberste.
        await using var cmd = new SqlCommand(
            $"SELECT TOP 1 path, claimed_by_role_id FROM app.slug "
            + $"WHERE path IN ({names}) AND claimed_by_role_id IS NOT NULL "
            + "ORDER BY LEN(path) DESC;", connection);

        for (var i = 0; i < ancestors.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", ancestors[i]);

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
            "list" => await ListAsync(connection),
            _ => Usage()
        };
    }

    private static int Usage()
    {
        Console.Error.WriteLine("  slug add <pfad> [\"wofuer\"]   Adresse oeffnen, Code ausgeben");
        Console.Error.WriteLine("  slug list                     Adressen zeigen (ohne Codes)");
        return 1;
    }

    private static async Task<int> AddAsync(SqlConnection connection, string[] args)
    {
        if (args.Length < 3) return Usage();

        var path = Normalise(args[2]);
        var note = args.Length > 3 ? args[3] : null;

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

        // Der Klartext existiert ab hier genau einmal: in dieser Ausgabe.
        var code = Token.NewSecret();

        await using var insert = new SqlCommand("""
            INSERT INTO app.slug (id, path, claim_code_sha256, note, created_at)
            VALUES (@id, @path, @hash, @note, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", Ids.NewId());
        insert.Parameters.AddWithValue("@path", path);
        insert.Parameters.AddWithValue("@hash", Token.HashSecret(code));
        insert.Parameters.AddWithValue("@note", (object?)note ?? DBNull.Value);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync();
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            Console.Error.WriteLine($"  XX   \"{path}\" steht schon im Register.");
            return 1;
        }

        Console.WriteLine();
        Console.WriteLine($"  Adresse   recreatio.pl/{path}");
        Console.WriteLine($"  Code      {code}");
        Console.WriteLine();
        Console.WriteLine("  Der Code steht genau einmal hier - gespeichert ist nur sein SHA-256.");
        Console.WriteLine("  Wer ihn eintippt, setzt eine seiner Rollen auf diese Adresse und auf alles darunter.");
        Console.WriteLine();
        return 0;
    }

    private static async Task<int> ListAsync(SqlConnection connection)
    {
        await using var cmd = new SqlCommand(
            "SELECT path, note, claimed_at FROM app.slug ORDER BY path;", connection);

        await using var reader = await cmd.ExecuteReaderAsync();

        var rows = 0;
        while (await reader.ReadAsync())
        {
            var path = reader.GetString(0);
            var note = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);
            var state = reader.IsDBNull(2) ? "frei" : "vergeben";

            Console.WriteLine($"  {state,-9} {path,-32} {note}");
            rows++;
        }

        if (rows == 0) Console.WriteLine("  (das Register ist leer - `slug add <pfad>` oeffnet die erste Adresse)");
        return 0;
    }
}
