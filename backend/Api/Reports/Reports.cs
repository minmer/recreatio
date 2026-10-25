using System.Collections.Concurrent;
using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0130 — MELDEN, UND WAS DER BETREIBER DARAUFHIN TUT.
///
/// <para>
/// <b>Jede Meldung geht an den Betreiber</b> (die Rolle, die den Dienst führt —
/// <see cref="OperatorRoleAsync"/>). Melden kann jeder, mit oder ohne Konto — aber nur, was
/// er lesen kann: der Dienst prüft das an der Kennung.
/// </para>
///
/// <para>
/// <b>Offen ist nur, WAS gemeldet ist</b> (Art und Kennung — sonst liesse sich nichts
/// finden). Grund, Kontakt, angehängter Inhalt und das ENTSCHEIDUNGSGEHEIMNIS versiegelt der
/// Browser des Meldenden für den öffentlichen Schlüssel der Rolle des Betreibers; der Dienst
/// behält vom Geheimnis nur den Hash. Entscheiden kann so nur, wer die Meldung öffnet — der
/// Betreiber —, und nur über die gemeldete Sache. Jeder Schritt steht unterschrieben in der
/// Kette (<see cref="TakedownEntryRecord"/>). Ohne Meldung kein Sperren, kein Löschen.
/// </para>
///
/// <para>
/// <b>Über den Meldenden bleibt nichts:</b> kein Konto, keine Adresse, nur der Hash seiner
/// Quittung. Gegen Massen zählt der Dienst je Adresse im Speicher, eine Stunde lang.
/// </para>
/// </summary>
public static partial class Reports
{
    /// <summary>Wie lange der Verfasser widersprechen kann, bevor endgültig gelöscht werden darf.</summary>
    internal static readonly TimeSpan ObjectionPeriod = TimeSpan.FromDays(14);

    /// <summary>Wie lange Grund, Kontakt und Widerspruch nach der Entscheidung versiegelt aufbewahrt werden.</summary>
    internal static readonly TimeSpan KeepSealed = TimeSpan.FromDays(183);

    private const int MaxSealed = 256 * 1024;
    private const int PerHour = 10;

    public static void Map(WebApplication app)
    {
        app.MapGet("/report/operator", OperatorKeyAsync);
        app.MapGet("/report/target", TargetAsync);
        app.MapPost("/report", SubmitAsync);
        app.MapPost("/report/status", StatusAsync);

        app.MapGet("/workspace/reports", QueueAsync);
        app.MapGet("/workspace/reports/ledger", LedgerAsync);
        app.MapPost("/workspace/report/{id:guid}/decide", DecideAsync);

        app.MapGet("/workspace/takedowns", MineAsync);
        app.MapPost("/workspace/takedown/{id:guid}/objection", ObjectAsync);
    }

    /* -- Wer der Betreiber ist ------------------------------------------------------- */

    /// <summary>
    /// Die Rolle, die den Dienst führt: <c>Operator:RoleId</c> in der Konfiguration des
    /// Servers — sonst die Rolle, die die Startseite (<c>start</c>) führt.
    /// </summary>
    internal static async Task<Guid?> OperatorRoleAsync(SqlConnection connection, IConfiguration config, CancellationToken ct)
    {
        if (Guid.TryParse(config["Operator:RoleId"], out var configured)) return configured;
        await using var cmd = new SqlCommand(
            "SELECT claimed_by_role_id FROM app.slug WHERE path = N'start' AND claimed_by_role_id IS NOT NULL;", connection);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    /// <summary>Ist, wer ruft, der Betreiber? (Seine Rolle ist eine der Rollen des Kontos.)</summary>
    internal static async Task<Guid?> AsOperatorAsync(HttpContext ctx, Db db, SqlConnection connection, IConfiguration config)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return null; }
        var role = await OperatorRoleAsync(connection, config, ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (role is null || !mine.Any(r => r.Id == role.Value))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To widzi tylko operator serwisu.");
            return null;
        }
        return role;
    }

    /// <summary>Wohin eine Meldung versiegelt wird: der öffentliche Verpackungsschlüssel der Rolle des Betreibers.</summary>
    private static async Task OperatorKeyAsync(HttpContext ctx, Db db, IConfiguration config)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var role = await OperatorRoleAsync(connection, config, ctx.RequestAborted);
        if (role is null) { await Fail(ctx, StatusCodes.Status503ServiceUnavailable, "Zgłoszenia nie są jeszcze włączone."); return; }

        await using var cmd = new SqlCommand("SELECT wrap_public_key, sign_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", role.Value);
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted)) { await Fail(ctx, StatusCodes.Status503ServiceUnavailable, "Zgłoszenia nie są jeszcze włączone."); return; }

        await ctx.Response.WriteAsJsonAsync(new
        {
            roleId = Ids.ToText(role.Value),
            wrapPublicKey = Base64Url.Encode((byte[])reader[0]),
            signPublicKey = Base64Url.Encode((byte[])reader[1])
        });
    }

    /* -- Gegen Massen ---------------------------------------------------------------- */

    private static readonly ConcurrentDictionary<string, List<DateTimeOffset>> Recent = new();

    /// <summary>Höchstens <see cref="PerHour"/> je Adresse und Stunde; nach einer Stunde ist jede Spur fort.</summary>
    private static bool Allowed(HttpContext ctx, string bucket)
    {
        var now = DateTimeOffset.UtcNow;
        var key = $"{bucket}:{ctx.Connection.RemoteIpAddress}";
        foreach (var stale in Recent.Where(p => p.Value.Count == 0 || p.Value[^1] < now.AddHours(-1)).Select(p => p.Key).ToList())
            Recent.TryRemove(stale, out _);

        var times = Recent.GetOrAdd(key, _ => []);
        lock (times)
        {
            times.RemoveAll(t => t < now.AddHours(-1));
            if (times.Count >= PerHour) return false;
            times.Add(now);
            return true;
        }
    }

    /* -- Was gemeldet wird ------------------------------------------------------------ */

    /// <summary>
    /// Die Sache, die gemeldet werden soll — aus Art und Kennung, oder aus einer Adresse
    /// (eine Seite mit ihren Teilen und Dateien zur Auswahl). Nur, was wer ruft, lesen kann.
    /// </summary>
    private static async Task TargetAsync(HttpContext ctx, Db db)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var caller = await Callers.OfAsync(ctx, db, connection);

        var kind = ctx.Request.Query["kind"].ToString();
        if (Guid.TryParse(ctx.Request.Query["id"].ToString(), out var id) && Kinds.Contains(kind))
        {
            var item = await ItemAsync(connection, caller, kind, id, ctx.RequestAborted);
            if (item is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma tu czego zgłosić — albo nie masz do tego dostępu."); return; }
            await ctx.Response.WriteAsJsonAsync(new { itemKind = item.Kind, itemId = Ids.ToText(item.Id), path = item.Path, title = item.Title, parts = Array.Empty<object>() });
            return;
        }

        /* Eine Adresse: recreatio.pl/#/pfad, #/pfad, oder der Pfad selbst. */
        var raw = ctx.Request.Query["address"].ToString().Trim();
        var at = raw.IndexOf("#/", StringComparison.Ordinal);
        var path = Slug.Normalise((at >= 0 ? raw[(at + 2)..] : raw).Split('?')[0]);
        Guid? slug = null;
        await using (var cmd = new SqlCommand("""
            SELECT COALESCE(t.id, s.id) FROM app.slug s LEFT JOIN app.slug t ON s.alias_of IS NOT NULL AND t.path = s.alias_of WHERE s.path = @path;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@path", path);
            slug = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as Guid?;
        }
        var page = slug is null ? null : await ItemAsync(connection, caller, "page", slug.Value, ctx.RequestAborted);
        if (page is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma strony, którą możesz zgłosić."); return; }

        var parts = new List<object>();
        await using (var cmd = new SqlCommand("""
            SELECT p.id, COALESCE(m.kind, p.kind) FROM app.slug_part p LEFT JOIN app.module m ON m.id = p.module_id
            WHERE p.slug_id = @slug ORDER BY p.position;
            SELECT id, name, content_type FROM app.page_image WHERE slug_id = @slug ORDER BY created_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@slug", slug!.Value);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                parts.Add(new { itemKind = "part", itemId = Ids.ToText(reader.GetGuid(0)), kind = reader.GetString(1) });
            await reader.NextResultAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                parts.Add(new { itemKind = "file", itemId = Ids.ToText(reader.GetGuid(0)), kind = reader.GetString(2), name = reader.IsDBNull(1) ? null : reader.GetString(1) });
        }

        await ctx.Response.WriteAsJsonAsync(new { itemKind = "page", itemId = Ids.ToText(slug.Value), path = page.Path, title = page.Title, parts });
    }

    public sealed record SubmitRequest(
        string? Id, string? ItemKind, string? ItemId, long? ItemAt, string? Path, string? Reason,
        string? OperatorRoleId, string? Sealed, string? SealedKey, string? DecisionSha256, string? ReceiptSha256);

    /// <summary>Eine Meldung annehmen — und gleich bestätigen. Gesperrt wird dadurch nichts; das entscheidet der Betreiber.</summary>
    private static async Task SubmitAsync(HttpContext ctx, Db db, IConfiguration config, SubmitRequest body)
    {
        if (!Allowed(ctx, "report"))
        {
            await Fail(ctx, StatusCodes.Status429TooManyRequests, "Za dużo zgłoszeń z tego miejsca — spróbuj za godzinę.");
            return;
        }

        if (!Guid.TryParse(body.Id, out var id) || !Guid.TryParse(body.ItemId, out var itemId) || !Kinds.Contains(body.ItemKind ?? ""))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie wiadomo, co zgłaszasz.");
            return;
        }
        if (body.Reason is not ("data" or "illegal" or "other"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Wybierz, czego dotyczy zgłoszenie.");
            return;
        }

        byte[] sealedBlob, sealedKey, decision, receipt;
        try
        {
            sealedBlob = Base64Url.Decode(body.Sealed ?? "");
            sealedKey = Base64Url.Decode(body.SealedKey ?? "");
            decision = Base64Url.Decode(body.DecisionSha256 ?? "");
            receipt = Base64Url.Decode(body.ReceiptSha256 ?? "");
        }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zgłoszenie.");
            return;
        }
        if (sealedBlob.Length is 0 or > MaxSealed || sealedKey.Length is 0 or > 1024 || decision.Length != 32 || receipt.Length != 32)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zgłoszenie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var operatorRole = await OperatorRoleAsync(connection, config, ctx.RequestAborted);
        if (operatorRole is null || !Guid.TryParse(body.OperatorRoleId, out var sealedFor) || sealedFor != operatorRole.Value)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Zgłoszenie zaszyfrowano dla innego operatora — odśwież stronę.");
            return;
        }

        var caller = await Callers.OfAsync(ctx, db, connection);
        var item = await ItemAsync(connection, caller, body.ItemKind!, itemId, ctx.RequestAborted);
        if (item is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Zgłosić można tylko to, co widzisz.");
            return;
        }

        var controller = item.AreaId is null ? null : await Controllers.OfAreaAsync(connection, item.AreaId.Value, ctx.RequestAborted);
        var now = DateTimeOffset.UtcNow;

        await using (var cmd = new SqlCommand("""
            INSERT INTO app.report (id, item_kind, item_id, item_at, item_path, area_id, controller_id, reason, state,
                operator_role_id, sealed, sealed_key, decision_sha256, receipt_sha256, received_at)
            VALUES (@id, @kind, @item, @at, @path, @area, @controller, @reason, N'received',
                @operator, @sealed, @key, @decision, @receipt, @now);
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@kind", item.Kind);
            cmd.Parameters.AddWithValue("@item", itemId);
            cmd.Parameters.AddWithValue("@at", body.ItemAt is long at ? DateTimeOffset.FromUnixTimeSeconds(at) : DBNull.Value);
            cmd.Parameters.AddWithValue("@path", (object?)(item.Path ?? Trimmed(body.Path, 400)) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@area", item.AreaId is null ? DBNull.Value : item.AreaId.Value);
            cmd.Parameters.AddWithValue("@controller", controller is null ? DBNull.Value : controller.Id);
            cmd.Parameters.AddWithValue("@reason", body.Reason);
            cmd.Parameters.AddWithValue("@operator", operatorRole.Value);
            cmd.Parameters.AddWithValue("@sealed", sealedBlob);
            cmd.Parameters.AddWithValue("@key", sealedKey);
            cmd.Parameters.AddWithValue("@decision", decision);
            cmd.Parameters.AddWithValue("@receipt", receipt);
            cmd.Parameters.AddWithValue("@now", now);
            try { await cmd.ExecuteNonQueryAsync(ctx.RequestAborted); }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "To zgłoszenie już jest.");
                return;
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), receivedAt = now, state = "received" });
    }

    private static string? Trimmed(string? s, int max)
    {
        var t = (s ?? "").Trim();
        return t.Length == 0 ? null : t.Length > max ? t[..max] : t;
    }

    public sealed record StatusRequest(string? Receipt);

    /// <summary>Was aus einer Meldung wurde — für den, der ihre Quittung hat. Nichts über den Verfasser.</summary>
    private static async Task StatusAsync(HttpContext ctx, Db db, StatusRequest body)
    {
        if (!Allowed(ctx, "status"))
        {
            await Fail(ctx, StatusCodes.Status429TooManyRequests, "Za dużo zapytań — spróbuj za godzinę.");
            return;
        }

        byte[] receipt;
        try { receipt = Base64Url.Decode(body.Receipt ?? ""); } catch (FormatException) { receipt = []; }
        if (receipt.Length is < 16 or > 64) { await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma takiego zgłoszenia."); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand(
            "SELECT id, item_kind, state, received_at, decided_at FROM app.report WHERE receipt_sha256 = @hash;", connection);
        cmd.Parameters.AddWithValue("@hash", SHA256.HashData(receipt));
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted)) { await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma takiego zgłoszenia."); return; }

        await ctx.Response.WriteAsJsonAsync(new
        {
            id = Ids.ToText(reader.GetGuid(0)),
            itemKind = reader.GetString(1),
            state = reader.GetString(2),
            receivedAt = reader.GetDateTimeOffset(3),
            decidedAt = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4)
        });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
