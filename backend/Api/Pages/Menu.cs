using System.Text.Json;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DAS MENÜ EINER SEITE (0054) — ein Baum aus Einträgen über der Seite.
///
/// <para>
/// <b>Jeder Eintrag hat ein Ziel, und es gibt drei Arten davon:</b>
/// </para>
///
/// <code>
///   abs   ein Pfad im Register — „parish/grzegorzki/oaza"
///   rel   ein Pfad von der Seite des Menüs aus — „oaza", „./oaza", „../"
///   url   eine Adresse draussen — „https://…", „mailto:…", „tel:…"
/// </code>
///
/// <para>
/// <b>Relativ heisst: von der Seite, die das Menü trägt</b> — nicht von der,
/// auf der man gerade steht. Andere Seiten können dasselbe Menü übernehmen
/// (`uses_slug_id`, 0056) — geerbt wird es nicht (0058); „oaza" soll auf
/// jeder Seite, die es zeigt, dasselbe bleiben.
/// </para>
///
/// <para>
/// <b>Offen gespeichert</b>, wie Titel und Bausteine der Seite: es hängt
/// öffentlich an ihr. Der Dienst prüft seine Form (Tiefe, Anzahl, Ziele) —
/// deuten tut es der Browser.
/// </para>
///
/// <para>
/// <b>Mehrere Seiten, ein Menü (0056).</b> Eine Zeile ist entweder ein Menü
/// oder ein VERWEIS auf die Seite, deren Menü hier gelten soll. Der Verweis
/// geht immer auf ein EIGENES Menü, nie auf einen zweiten Verweis: so ist das
/// Auflösen ein Schritt, und es kann keinen Kreis geben.
/// </para>
///
/// <para>
/// Relative Ziele bleiben dabei an der Seite, die das Menü TRÄGT. Nimmt die
/// Schule das Menü der Pfarrei, heisst „oaza" darin weiterhin die Oaza der
/// Pfarrei — sonst wäre es kein geteiltes Menü, sondern eine Kopie, die sich
/// bei jedem anders liest.
/// </para>
/// </summary>
public static class Menu
{
    private const int MaxItems = 60;
    private const int MaxDepth = 3;
    private const int MaxLabel = 80;
    private const int MaxTarget = 400;

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public sealed record Item(string? Label, string? Kind, string? Target, IReadOnlyList<Item>? Children);

    public sealed record Clean(string Label, string Kind, string Target, IReadOnlyList<Clean> Children);

    /// <summary>
    /// Entweder <c>Items</c> (ein eigenes Menü) oder <c>Uses</c> (der Pfad der
    /// Seite, deren Menü hier gelten soll). Beides leer: die Seite hat keines
    /// mehr (0058: und dann auch keine Leiste — geerbt wird nicht).
    /// </summary>
    public sealed record SaveRequest(string Path, IReadOnlyList<Item>? Items, string? Uses);

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/menu", ReadAsync);
        app.MapPost("/workspace/menu", SaveAsync);
    }

    /// <summary>Die Form prüfen und glätten — oder sagen, was nicht stimmt.</summary>
    internal static List<Clean>? Validate(IReadOnlyList<Item>? items, int depth, ref int count, out string error)
    {
        error = string.Empty;
        var out_ = new List<Clean>();
        if (items is null) return out_;

        if (depth > MaxDepth) { error = $"Menu ma najwyżej {MaxDepth} poziomy."; return null; }

        foreach (var one in items)
        {
            if (++count > MaxItems) { error = $"Menu ma najwyżej {MaxItems} pozycji."; return null; }

            var label = (one.Label ?? string.Empty).Trim();
            if (label.Length is 0 or > MaxLabel) { error = "Każda pozycja potrzebuje nazwy (do 80 znaków)."; return null; }

            var kind = (one.Kind ?? "rel").Trim().ToLowerInvariant();
            var target = (one.Target ?? string.Empty).Trim();
            if (target.Length > MaxTarget) { error = $"„{label}”: cel jest za długi."; return null; }

            switch (kind)
            {
                case "abs":
                    target = target.Trim('/').ToLowerInvariant();
                    if (target != string.Empty && !Slug.IsWellFormed(target))
                    {
                        error = $"„{label}”: to nie jest adres strony (np. parish/grzegorzki).";
                        return null;
                    }
                    break;

                case "rel":
                    target = target.ToLowerInvariant();
                    if (!RelativeShape(target))
                    {
                        error = $"„{label}”: ścieżka względna to np. oaza, ./oaza albo ../kontakt.";
                        return null;
                    }
                    break;

                case "url":
                    if (!(target.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
                          || target.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                          || target.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
                          || target.StartsWith("tel:", StringComparison.OrdinalIgnoreCase))
                        || target.Any(char.IsWhiteSpace))
                    {
                        error = $"„{label}”: adres zewnętrzny zaczyna się od https://, mailto: albo tel:.";
                        return null;
                    }
                    break;

                case "none":
                    /* Nur ein Dach für Untereinträge — ohne eigenes Ziel. */
                    target = string.Empty;
                    break;

                default:
                    error = $"„{label}”: nieznany rodzaj celu.";
                    return null;
            }

            var children = Validate(one.Children, depth + 1, ref count, out error);
            if (children is null) return null;

            if (kind == "none" && children.Count == 0)
            {
                error = $"„{label}”: pozycja bez celu musi mieć podpozycje.";
                return null;
            }

            out_.Add(new Clean(label, kind, target, children));
        }

        return out_;
    }

    /// <summary>„oaza", „./oaza", „../", „../kontakt/mapa" — Schritte aus Wörtern, Punkt und zwei Punkten.</summary>
    private static bool RelativeShape(string target)
    {
        if (target == string.Empty) return false;
        if (target.StartsWith('/')) return false;

        foreach (var step in target.TrimEnd('/').Split('/'))
        {
            if (step is "." or "..") continue;
            if (!Slug.IsWellFormed(step) || step.Contains('/')) return false;
        }

        return true;
    }

    private static async Task<Guid?> SlugIdAsync(SqlConnection connection, string path, CancellationToken ct)
    {
        await using var find = new SqlCommand("SELECT id FROM app.slug WHERE path = @path;", connection);
        find.Parameters.AddWithValue("@path", path);
        return await find.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    /// <summary>Die Pfade von hier nach oben — „a/b/c", „a/b", „a".</summary>
    private static List<string> Upwards(string path)
    {
        var steps = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return Enumerable.Range(0, steps.Length).Select(n => string.Join('/', steps.Take(steps.Length - n))).ToList();
    }

    /// <summary>
    /// Das EIGENE Menü einer Seite — nie ein Verweis. Ein Verweis zeigt immer
    /// hierauf, und damit endet das Auflösen nach einem Schritt.
    /// </summary>
    private static async Task<(string From, JsonElement Items)?> OwnAsync(
        SqlConnection connection, Guid slugId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT s.path, m.menu FROM app.slug_menu m JOIN app.slug s ON s.id = m.slug_id
            WHERE m.slug_id = @id AND m.menu IS NOT NULL;
            """, connection);
        cmd.Parameters.AddWithValue("@id", slugId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        using var document = JsonDocument.Parse(reader.GetString(1));
        return (reader.GetString(0), document.RootElement.Clone());
    }

    /// <summary>
    /// Das Menü, das diese Seite sich von einer anderen HOLT — mit dem Pfad
    /// der Quelle, auch wenn dort inzwischen keines mehr steht.
    /// </summary>
    /// <remarks>
    /// Der Pfad steht auch dann da, wenn <c>Items</c> fehlt: „hier gilt das
    /// Menü von X, und X hat keines mehr" ist die Auskunft, die der Editor
    /// braucht. Ohne sie sähe die Seite aus, als hätte sie nie eines gehabt.
    /// </remarks>
    private static async Task<(string From, JsonElement? Items)?> UsesAsync(
        SqlConnection connection, Guid slugId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT s.id, s.path FROM app.slug_menu m JOIN app.slug s ON s.id = m.uses_slug_id
            WHERE m.slug_id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", slugId);

        Guid source;
        string path;
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            if (!await reader.ReadAsync(ct)) return null;
            source = reader.GetGuid(0);
            path = reader.GetString(1);
        }

        return (path, (await OwnAsync(connection, source, ct))?.Items);
    }

    /// <summary>
    /// Das Menü einer Seite. <c>From</c> ist der Pfad, von dem aus relative
    /// Ziele gelten — bei einem Verweis der Pfad der Seite, VON DER das Menü
    /// stammt, nicht der eigene.
    ///
    /// <para>
    /// <b>Nur die Seite selbst</b> (<paramref name="includeSelf"/>): ihr
    /// eigenes Menü oder das, das sie sich ausdrücklich geholt hat. Eine
    /// Unterseite erbt nichts mehr von selbst (0058) — wer dort dasselbe Menü
    /// will, wählt es im Editor; sonst stand auf jeder Unterseite plötzlich
    /// eine Leiste, die dort niemand hingestellt hatte.
    /// </para>
    ///
    /// <para>
    /// Ohne die Seite selbst: die nächste Seite DARÜBER mit einem Menü — nur
    /// noch als Vorschlag für den Editor („weź menu strony wyżej").
    /// </para>
    /// </summary>
    internal static async Task<(string From, JsonElement Items)?> ForPageAsync(
        SqlConnection connection, string path, bool includeSelf, CancellationToken ct)
    {
        var candidates = Upwards(path);
        if (includeSelf) candidates = candidates.Take(1).ToList();
        else if (candidates.Count > 0) candidates.RemoveAt(0);
        if (candidates.Count == 0) return null;

        var names = string.Join(", ", candidates.Select((_, i) => $"@p{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT s.path, m.menu, m.uses_slug_id FROM app.slug_menu m JOIN app.slug s ON s.id = m.slug_id
            WHERE s.path IN ({names});
            """, connection);
        for (var i = 0; i < candidates.Count; i++) cmd.Parameters.AddWithValue($"@p{i}", candidates[i]);

        string? bestPath = null, bestMenu = null;
        Guid? bestUses = null;
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var found = reader.GetString(0);
                if (bestPath is not null && found.Length <= bestPath.Length) continue;

                bestPath = found;
                bestMenu = reader.IsDBNull(1) ? null : reader.GetString(1);
                bestUses = reader.IsDBNull(2) ? null : reader.GetGuid(2);
            }
        }

        if (bestPath is null) return null;

        /*
            Ein Verweis, dessen Ziel sein eigenes Menü inzwischen abgelegt hat,
            zeigt NICHTS — und fällt nicht auf das von weiter oben zurück. Das
            Menü einer Seite ist eine Ansage; stillschweigend ein anderes
            hinzustellen hiesse, die Ansage zu überhören.
        */
        if (bestMenu is null)
        {
            return bestUses is null ? null : await OwnAsync(connection, bestUses.Value, ct);
        }

        using var document = JsonDocument.Parse(bestMenu);
        return (bestPath, document.RootElement.Clone());
    }

    /// <summary>
    /// Die Seiten mit einem EIGENEN Menü, die dieses Konto führt — die Liste,
    /// aus der im Editor eines ausgewählt wird.
    /// </summary>
    /// <remarks>
    /// Nur eigene: ein Menü von einer fremden Seite zu nehmen hiesse, die
    /// eigene Seite an etwas zu hängen, das jemand anders jederzeit ändert.
    /// Was einem gehört, steht meist schon in den eigenen Rollen; nur was
    /// darüber hinausgeht, wird einzeln gefragt (Zertifikat).
    /// </remarks>
    private static async Task<List<(string Path, int Count)>> UsableAsync(
        SqlConnection connection, Guid accountId, string except, CancellationToken ct)
    {
        var found = new List<(string Path, Guid? Owner, int Count)>();

        await using (var cmd = new SqlCommand("""
            SELECT TOP (200) s.path, s.claimed_by_role_id, m.menu
            FROM app.slug_menu m JOIN app.slug s ON s.id = m.slug_id
            WHERE m.menu IS NOT NULL
            ORDER BY s.path;
            """, connection))
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var path = reader.GetString(0);
                if (path == except) continue;

                var count = 0;
                try
                {
                    using var document = JsonDocument.Parse(reader.GetString(2));
                    count = document.RootElement.GetArrayLength();
                }
                catch (JsonException)
                {
                    // Unlesbar gespeichert — dann steht eben keine Zahl daneben.
                }

                found.Add((path, reader.IsDBNull(1) ? null : reader.GetGuid(1), count));
            }
        }

        var mine = (await Workspace.RolesOfAsync(connection, accountId, ct)).Select(r => r.Id).ToHashSet();
        var usable = new List<(string Path, int Count)>();

        foreach (var one in found)
        {
            /* Die eigene Rolle führt sie — das ist der Normalfall und kostet keine Frage. */
            if (one.Owner is not null && mine.Contains(one.Owner.Value))
            {
                usable.Add((one.Path, one.Count));
                continue;
            }

            var grip = await Access.OfAsync(connection, accountId, one.Path, ct);
            if (grip.MayWrite) usable.Add((one.Path, one.Count));
        }

        return usable;
    }

    /// <summary>Für den Editor: das eigene Menü der Seite, und was sie sonst von oben erbt.</summary>
    private static async Task ReadAsync(HttpContext ctx, Db db, string? path)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wanted = Slug.Normalise(path);
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var grip = await Access.OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);
        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzisz.");
            return;
        }

        var above = await ForPageAsync(connection, wanted, includeSelf: false, ctx.RequestAborted);

        /*
            Drei verschiedene Dinge, und der Editor muss sie auseinanderhalten:
            das EIGENE Menü dieser Seite, das Menü, das sie sich von einer
            anderen HOLT, und das, was ohne beides von oben gälte.
        */
        var slugId = await SlugIdAsync(connection, wanted, ctx.RequestAborted);
        var own = slugId is null ? null : await OwnAsync(connection, slugId.Value, ctx.RequestAborted);
        var uses = slugId is null ? null : await UsesAsync(connection, slugId.Value, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            path = wanted,
            items = own?.Items,
            uses = uses is null ? null : new { from = uses.Value.From, items = uses.Value.Items },
            inherited = above is null ? null : new { from = above.Value.From, items = above.Value.Items },
            usable = (await UsableAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted))
                .Select(one => new { path = one.Path, items = one.Count })
        });
    }

    /// <summary>Das Menü einer Seite speichern — als Ganzes. Leer heisst: keines (dann hat die Seite keine Leiste).</summary>
    private static async Task SaveAsync(HttpContext ctx, Db db, SaveRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var count = 0;
        var clean = Validate(body.Items, 1, ref count, out var error);
        if (clean is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error); return; }

        var borrowed = (body.Uses ?? string.Empty).Trim();
        var wanted = Slug.Normalise(body.Path);

        if (borrowed != string.Empty && clean.Count > 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Albo własne menu, albo menu innej strony — nie oba naraz.");
            return;
        }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var grip = await Access.OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);
        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzisz.");
            return;
        }

        var slugId = await SlugIdAsync(connection, wanted, ctx.RequestAborted);
        if (slugId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
            return;
        }

        if (clean.Count == 0 && borrowed == string.Empty)
        {
            await using var drop = new SqlCommand("DELETE FROM app.slug_menu WHERE slug_id = @slug;", connection);
            drop.Parameters.AddWithValue("@slug", slugId.Value);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { path = wanted, items = 0 });
            return;
        }

        Guid? uses = null;

        if (borrowed != string.Empty)
        {
            var source = Slug.Normalise(borrowed);

            if (source == wanted)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Strona nie może wziąć menu sama od siebie.");
                return;
            }

            var sourceId = await SlugIdAsync(connection, source, ctx.RequestAborted);
            if (sourceId is null)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tej strony nie ma w rejestrze.");
                return;
            }

            /*
                Nur von einer Seite, die man selbst führt: sonst hinge die
                eigene Seite an einem Menü, das jemand anders jederzeit
                umbaut, ohne davon zu wissen.
            */
            var there = await Access.OfAsync(connection, who.Value.AccountId, source, ctx.RequestAborted);
            if (!there.MayWrite)
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Tamtej strony nie prowadzisz.");
                return;
            }

            /* Nur auf ein EIGENES Menü — ein Verweis auf einen Verweis wäre eine Kette. */
            if (await OwnAsync(connection, sourceId.Value, ctx.RequestAborted) is null)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Tamta strona nie ma własnego menu — nie ma czego stąd pokazać.");
                return;
            }

            uses = sourceId.Value;
        }

        var json = uses is null ? JsonSerializer.Serialize(clean, Web) : null;

        await using var save = new SqlCommand("""
            UPDATE app.slug_menu SET menu = @menu, uses_slug_id = @uses, updated_at = @now WHERE slug_id = @slug;
            IF @@ROWCOUNT = 0
                INSERT INTO app.slug_menu (slug_id, menu, uses_slug_id, updated_at)
                VALUES (@slug, @menu, @uses, @now);
            """, connection);
        save.Parameters.AddWithValue("@slug", slugId.Value);
        save.Parameters.AddWithValue("@menu", (object?)json ?? DBNull.Value);
        save.Parameters.AddWithValue("@uses", (object?)uses ?? DBNull.Value);
        save.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await save.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            // Zwei Fenster haben gleichzeitig gespeichert — das andere gilt; wer noch einmal speichert, gewinnt.
        }

        await ctx.Response.WriteAsJsonAsync(new { path = wanted, items = count, uses = borrowed });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
