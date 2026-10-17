using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Eine Adresse übernehmen — ihre Form, reservierte Wörter, die nächste übernommene darüber.</summary>
public static partial class Slug
{
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

    /// <summary>
    /// Adressen, die niemand führt.
    ///
    /// <para>
    /// <c>workspace</c> ist der Arbeitsplatz selbst. <c>portal</c> ist der
    /// Platzzugang: <c>lo13/portal/&lt;token&gt;/&lt;key&gt;</c> ist die Adresse
    /// EINES SCHÜLERS und keine Unterseite. Liesse man sie übernehmen,
    /// verdeckte eine Seite namens „portal" jeden dieser Links — und zwar
    /// lautlos, denn beide sähen gleich aus.
    /// </para>
    ///
    /// <para>
    /// <b>Die Teile der Oberfläche</b> (`ROUTES` in `frontend/src/app/routes.ts`):
    /// seit es dort keine Liste der Seiten mehr gibt (2026-10-16), ist jedes
    /// Wort, das kein Teil ist, eine Seite. Eine Wurzel namens „seat" oder
    /// „widget" wäre also nie zu sehen — sie verdeckte nichts, sie würde
    /// verdeckt. Beide Listen müssen gleich bleiben.
    /// </para>
    /// </summary>
    public static bool IsReserved(string path)
    {
        var root = path.Split('/')[0];
        return Parts.Contains(root)
            || path == "portal"
            || path.EndsWith("/portal", StringComparison.Ordinal)
            || path.Contains("/portal/", StringComparison.Ordinal);
    }

    /// <summary>Die Teile der Oberfläche — dieselben Wörter wie `ROUTES` im Browser.</summary>
    private static readonly HashSet<string> Parts = new(StringComparer.Ordinal) { "workspace", "seat", "verify", "dolacz", "widget", "plik" };

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
            await Fail(ctx, StatusCodes.Status400BadRequest, "Ten adres należy do samej platformy (warsztat, linki, widżety).");
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

        // Dem Konto wird nichts gegeben (0040) — nur Personen und Rollen darunter.
        if (Workspace.IsAccount(mine, roleId))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, Workspace.AccountTakesNothing);
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

                /*
                 * KEIN CODE IST EIN GÜLTIGER ZUSTAND, seit 0012: eine lokale
                 * Route und ein Alias entstehen VON OBEN und tragen deshalb
                 * NULL. Hier stand ein blanker Cast, und der warf auf so einer
                 * Zeile InvalidCastException — aus der wurde eine 500.
                 *
                 * Das war nicht bloss ein Absturz, sondern ein Leck: diese
                 * Stelle antwortet auf „gibt es nicht" und „Code stimmt nicht"
                 * absichtlich dasselbe, damit sich das Register nicht nach
                 * freien Adressen abfragen lässt. Eine 500 unterscheidet sich
                 * von beidem — der Absturz selbst verriet, dass die Zeile da ist.
                 *
                 * Mit NULL läuft es in die Prüfung unten und wird zu genau der
                 * einen, nichtssagenden Antwort.
                 */
                codeHash = reader.IsDBNull(1) ? null : (byte[])reader[1];
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
         * LIEGT DARÜBER SCHON EINE ÜBERNOMMENE ADRESSE, ist hier nichts mehr zu
         * übernehmen — auch nicht für den, der sie führt. Was unter einer Wurzel
         * liegt, ist ihre lokale Route: der Führende öffnet sie im Arbeitsplatz,
         * ohne Code, und gibt sie mit einem Zertifikat weiter.
         *
         * Vorher wurde hier nur eine FREMDE Adresse darüber abgewehrt. Damit
         * konnte der Führende von `parish` neben seiner lokalen Route ein
         * zweites, mit Code übernommenes `parish/grzegorzki` stellen — zwei
         * Verantwortliche für eine Adresszeile, und welche Seite erscheint,
         * entschiede die Reihenfolge der Zeilen.
         */
        var ancestors = Ancestors(path);
        if (ancestors.Count > 0)
        {
            var held = await LongestClaimedAsync(connection, ancestors, ctx.RequestAborted);
            if (held is not null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, mine.Any(r => r.Id == held.Value.RoleId)
                    ? $"Adres „{Show(held.Value.Path)}” już prowadzisz — trasy pod nim otwierasz w warsztacie, bez kodu."
                    : $"Adres nadrzędny „{Show(held.Value.Path)}” należy do kogoś innego.");
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
}
