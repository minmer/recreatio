using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// EINE NORMALISIERUNG FÜR ALLE ADRESSEN (0082) — nicht nur die der Kartoteka.
///
/// <para>
/// Eine Adresse steht an vielen Stellen: in Antworten auf Formulare, im
/// Steckbrief einer Person, im Verzeichnis der Kolęda, beim Verantwortlichen
/// eines Formulars. Überall soll dieselbe Straße gleich heissen — so, wie
/// sie im gemeinsamen Verzeichnis der Teile steht (<c>app.address_part</c>).
/// Der Browser zerlegt die Zeile (<c>postal.ts</c>), hier bekommen die Teile
/// ihre eine Schreibweise, und der Browser setzt die Zeile wieder zusammen.
/// </para>
///
/// <para>
/// <b>Hierher kommen nur Teile, keine Hausnummern</b> — Straße, Ort,
/// Ortsteil, Post, Postleitzahl. Was jemand in seine Antwort schrieb, bleibt
/// versiegelt; der Dienst sieht nur, dass es eine Straße dieses Namens gibt.
/// Ins Verzeichnis EINTRAGEN darf nur, wer angemeldet ist (die Kanzlei
/// räumt auf); nachschlagen jeder — wie die Vorschläge.
/// </para>
/// </summary>
public static partial class Postal
{
    private const int MaxNormalize = 500;

    private static void MapEverywhere(WebApplication app)
    {
        app.MapPost("/addresses/normalize", NormalizeAsync);
    }

    /* ======================================================================
       DIE SCHREIBWEISE EINES NAMENS
       ====================================================================== */

    [GeneratedRegex(@"^(x{0,3})(ix|iv|v?i{0,3})$")]
    private static partial Regex Roman();

    private static readonly HashSet<string> Particles = ["i", "w", "we", "z", "ze", "nad", "pod", "przy", "na", "u", "do", "od", "po", "o"];
    private static readonly HashSet<string> LowerPrefixes = ["al.", "pl.", "os.", "bulw."];

    /// <summary>
    /// Wer alles klein oder alles groß tippt („długa", „JANA PAWŁA II"),
    /// bekommt die übliche Schreibweise: jedes Wort groß, römische Zahlen ganz
    /// groß, kleine Wörter („nad", „i") und „al.", „pl.", „os." klein. Wer
    /// gemischt schreibt, hat es so gewollt — das bleibt. Dieselbe Regel wie
    /// <c>postal.ts</c> <c>display</c> (Tabelle <c>postal-norms.json</c>).
    /// </summary>
    public static string Proper(string text)
    {
        var letters = text.Where(char.IsLetter).ToList();
        if (letters.Count == 0) return text;
        var allLower = letters.All(c => !char.IsUpper(c));
        var allUpper = letters.All(c => !char.IsLower(c));
        if (!allLower && !allUpper) return text;

        var words = text.ToLowerInvariant().Split(' ');
        for (var i = 0; i < words.Length; i++)
        {
            var word = words[i];
            if (word.Length == 0) continue;
            if (i == 0 && LowerPrefixes.Contains(word)) continue;
            if (i > 0 && Particles.Contains(word)) continue;
            words[i] = string.Join("-", word.Split('-').Select(Cap));
        }
        return string.Join(' ', words);

        static string Cap(string piece)
        {
            if (piece.Length >= 2 && Roman().IsMatch(piece)) return piece.ToUpperInvariant();
            var at = 0;
            while (at < piece.Length && !char.IsLetter(piece[at])) at++;
            return at >= piece.Length ? piece : piece[..at] + char.ToUpperInvariant(piece[at]) + piece[(at + 1)..];
        }
    }

    /* ======================================================================
       DIE TEILE IHRE EINE SCHREIBWEISE
       ====================================================================== */

    public sealed record PartsIn(string? Postcode, string? Post, string? Locality, string? District, string? Street);

    public sealed record NormalizeRequest(IReadOnlyList<PartsIn>? Addresses, bool Register = false);

    /// <summary>Ein Teil im Verzeichnis — gleiche Norm, gleicher Elternteil.</summary>
    private static async Task<(Guid Id, string Name)?> FindPartAsync(
        SqlConnection connection, SqlTransaction? tx, string kind, string norm, Guid? parent, CancellationToken ct)
    {
        await using var find = new SqlCommand(
            "SELECT TOP 1 id, name FROM app.address_part WHERE kind = @kind AND norm = @norm AND ((@parent IS NULL AND parent_id IS NULL) OR parent_id = @parent);",
            connection, tx);
        find.Parameters.AddWithValue("@kind", kind);
        find.Parameters.AddWithValue("@norm", norm);
        find.Parameters.Add("@parent", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)parent ?? DBNull.Value;
        await using var reader = await find.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? (reader.GetGuid(0), reader.GetString(1)) : null;
    }

    /// <summary>
    /// DIE TEILE IN IHRER EINEN SCHREIBWEISE — wie im Verzeichnis, sonst
    /// <see cref="Display"/>. Mit <c>register</c> (nur angemeldet) kommt,
    /// was fehlt, ins Verzeichnis — dann schreibt es die nächste Adresse so.
    /// </summary>
    private static async Task NormalizeAsync(HttpContext ctx, Db db, NormalizeRequest body)
    {
        var list = body.Addresses ?? [];
        if (list.Count > MaxNormalize)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Najwyżej {MaxNormalize} adresów naraz.");
            return;
        }

        var register = body.Register && await Auth.WhoAsync(ctx, db) is not null;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var tx = register ? (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted) : null;

        /*
         * IN EINER ANFRAGE EINE SCHREIBWEISE: was das Verzeichnis (noch) nicht
         * kennt, schreibt die erste Adresse der Anfrage vor — sonst hiesse
         * dieselbe Straße in einem Durchgang zweimal anders.
         */
        var seen = new Dictionary<string, (Guid? Id, string Name)>();

        async Task<(Guid? Id, string Name)> One(string kind, string? text, Guid? parent, string parentNorm = "")
        {
            var norm = Norm(kind, text);
            if (norm.Length == 0) return (null, kind == "postcode" ? "" : Display(kind, text));
            if (kind is not ("street" or "district")) { parent = null; parentNorm = ""; }

            var key = $"{kind}|{norm}|{parent?.ToString() ?? parentNorm}";
            if (seen.TryGetValue(key, out var had)) return had;

            (Guid? Id, string Name) got;
            var found = await FindPartAsync(connection, tx, kind, norm, parent, ctx.RequestAborted);
            if (found is not null) got = (found.Value.Id, found.Value.Name);
            else if (tx is not null && (kind is not ("street" or "district") || parent is not null))
                got = (await EnsurePartAsync(connection, tx, kind, text, parent, ctx.RequestAborted), Display(kind, text));
            else got = (null, Display(kind, text));

            seen[key] = got;
            return got;
        }

        var out_ = new List<object>(list.Count);
        foreach (var a in list)
        {
            var postcode = await One("postcode", a.Postcode, null);
            var post = await One("post", a.Post, null);
            var locality = await One("locality", a.Locality, null);

            /* Straße und Ortsteil gehören zu einem Ort — ohne Ort zu dem der Post (wie `Complete`). */
            var place = string.IsNullOrWhiteSpace(a.Locality) ? a.Post : a.Locality;
            var parent = locality.Id ?? (string.IsNullOrWhiteSpace(a.Locality) ? (await One("locality", a.Post, null)).Id : null);
            var district = await One("district", a.District, parent, Norm("locality", place));
            var street = await One("street", a.Street, parent, Norm("locality", place));

            out_.Add(new
            {
                postcode = postcode.Name,
                post = post.Name,
                locality = locality.Name,
                district = district.Name,
                street = street.Name
            });
        }

        if (tx is not null) await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { addresses = out_, registered = register });
    }
}
