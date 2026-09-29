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
/// auf der man gerade steht. Das Menü gilt für seine Seite und alle darunter,
/// bis eine eigenes hat; „oaza" soll unter jeder Unterseite dasselbe bleiben
/// und nicht mit jedem Schritt tiefer wandern.
/// </para>
///
/// <para>
/// <b>Offen gespeichert</b>, wie Titel und Bausteine der Seite: es hängt
/// öffentlich an ihr. Der Dienst prüft seine Form (Tiefe, Anzahl, Ziele) —
/// deuten tut es der Browser.
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

    public sealed record SaveRequest(string Path, IReadOnlyList<Item>? Items);

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
    /// Das Menü, das auf dieser Seite gilt: ihr eigenes oder das der nächsten
    /// Seite darüber, die eines hat. <c>From</c> ist der Pfad, von dem aus
    /// relative Ziele gelten.
    /// </summary>
    internal static async Task<(string From, JsonElement Items)?> ForPageAsync(
        SqlConnection connection, string path, bool includeSelf, CancellationToken ct)
    {
        var candidates = Upwards(path);
        if (!includeSelf && candidates.Count > 0) candidates.RemoveAt(0);
        if (candidates.Count == 0) return null;

        var names = string.Join(", ", candidates.Select((_, i) => $"@p{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT s.path, m.menu FROM app.slug_menu m JOIN app.slug s ON s.id = m.slug_id
            WHERE s.path IN ({names});
            """, connection);
        for (var i = 0; i < candidates.Count; i++) cmd.Parameters.AddWithValue($"@p{i}", candidates[i]);

        string? bestPath = null, bestMenu = null;
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var found = reader.GetString(0);
                if (bestPath is null || found.Length > bestPath.Length) { bestPath = found; bestMenu = reader.GetString(1); }
            }
        }

        if (bestPath is null || bestMenu is null) return null;

        using var document = JsonDocument.Parse(bestMenu);
        return (bestPath, document.RootElement.Clone());
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

        var own = await ForPageAsync(connection, wanted, includeSelf: true, ctx.RequestAborted);
        var above = await ForPageAsync(connection, wanted, includeSelf: false, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            path = wanted,
            items = own is not null && own.Value.From == wanted ? own.Value.Items : (JsonElement?)null,
            inherited = above is null ? null : new { from = above.Value.From, items = above.Value.Items }
        });
    }

    /// <summary>Das Menü einer Seite speichern — als Ganzes. Leer heisst: keines (dann gilt das von oben).</summary>
    private static async Task SaveAsync(HttpContext ctx, Db db, SaveRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var count = 0;
        var clean = Validate(body.Items, 1, ref count, out var error);
        if (clean is null) { await Fail(ctx, StatusCodes.Status400BadRequest, error); return; }

        var wanted = Slug.Normalise(body.Path);
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

        if (clean.Count == 0)
        {
            await using var drop = new SqlCommand("DELETE FROM app.slug_menu WHERE slug_id = @slug;", connection);
            drop.Parameters.AddWithValue("@slug", slugId.Value);
            await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { path = wanted, items = 0 });
            return;
        }

        var json = JsonSerializer.Serialize(clean, Web);

        await using var save = new SqlCommand("""
            UPDATE app.slug_menu SET menu = @menu, updated_at = @now WHERE slug_id = @slug;
            IF @@ROWCOUNT = 0
                INSERT INTO app.slug_menu (slug_id, menu, updated_at) VALUES (@slug, @menu, @now);
            """, connection);
        save.Parameters.AddWithValue("@slug", slugId.Value);
        save.Parameters.AddWithValue("@menu", json);
        save.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await save.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            // Zwei Fenster haben gleichzeitig gespeichert — das andere gilt; wer noch einmal speichert, gewinnt.
        }

        await ctx.Response.WriteAsJsonAsync(new { path = wanted, items = count });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
