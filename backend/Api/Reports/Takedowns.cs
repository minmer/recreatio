using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0130 — WAS GESPERRT IST. Die Stellen, die ausliefern, fragen hier — eine gesperrte Sache
/// geht an niemanden hinaus, auch nicht an den, der sie geschrieben hat. Gesperrt wird nur
/// auf eine Meldung hin, durch den Betreiber (<see cref="Reports"/>).
/// </summary>
internal static class Takedowns
{
    internal const string Placeholder = "Treść zablokowana po zgłoszeniu.";

    /// <summary>Die gesperrten oder gelöschten unter diesen Kennungen einer Art (ganze Sachen, ohne Zeitpunkt).</summary>
    internal static async Task<HashSet<Guid>> BlockedAsync(
        SqlConnection connection, string kind, IReadOnlyCollection<Guid> ids, CancellationToken ct, SqlTransaction? tx = null)
    {
        var found = new HashSet<Guid>();
        if (ids.Count == 0) return found;

        foreach (var chunk in ids.Distinct().Chunk(500))
        {
            var names = string.Join(", ", chunk.Select((_, i) => $"@i{i}"));
            await using var cmd = new SqlCommand(
                $"SELECT item_id FROM app.takedown WHERE item_kind = @kind AND item_at IS NULL AND item_id IN ({names});", connection, tx);
            cmd.Parameters.AddWithValue("@kind", kind);
            for (var i = 0; i < chunk.Length; i++) cmd.Parameters.AddWithValue($"@i{i}", chunk[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) found.Add(reader.GetGuid(0));
        }
        return found;
    }

    internal static async Task<bool> IsBlockedAsync(SqlConnection connection, string kind, Guid id, CancellationToken ct, SqlTransaction? tx = null) =>
        (await BlockedAsync(connection, kind, [id], ct, tx)).Count > 0;

    /// <summary>SQL: gibt es eine Sperre auf <paramref name="column"/> in dieser Art? (für Abfragen, die selbst filtern)</summary>
    internal static string Exists(string kind, string column) =>
        $"EXISTS (SELECT 1 FROM app.takedown tdn WHERE tdn.item_kind = N'{kind}' AND tdn.item_at IS NULL AND tdn.item_id = {column})";

    internal static Task BlockedResponse(HttpContext ctx)
    {
        /* 451: Unavailable For Legal Reasons — die Sache gibt es, sie geht nach einer Meldung nicht hinaus. */
        ctx.Response.StatusCode = StatusCodes.Status451UnavailableForLegalReasons;
        ctx.Response.Headers.CacheControl = "no-store";
        return ctx.Response.WriteAsJsonAsync(new { error = Placeholder, verdict = "blocked" });
    }
}
