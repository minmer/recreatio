using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// LAMPY (0118) — die Geräte, die das Telefon per Bluetooth LE steuert, jedes
/// mit seinen Sygnały als EINE Hülle unter dem Schlüssel eines Bereichs.
///
/// <para>
/// <b>Der Dienst sendet nichts und liest nichts.</b> Gesendet wird vom Telefon
/// (der Baustein <c>Lamp</c> der Ausgabe „sms"); hier liegt nur, was es senden
/// soll — damit es nach einer Neuinstallation und auf einem zweiten Telefon
/// wieder da ist. <c>version</c> verhindert, dass ein alter Stand einen neueren
/// überschreibt.
/// </para>
///
/// <para>
/// Seit 2026-10-18 stehen hier auch die <b>Timer</b> der Lampen (Uhrzeit, Tage,
/// welche Sygnały) — als Zeilen derselben Art; was eine Zeile ist, steht in der
/// Hülle (<c>kind</c>), und die öffnet nur der Browser.
/// </para>
/// </summary>
public static partial class Phone
{
    private const int MaxLampSealed = 256 * 1024;
    private const int MaxLamps = 500;

    private static void MapLamps(WebApplication app)
    {
        app.MapGet("/workspace/phone/{areaId:guid}/lamps", LampsAsync);
        app.MapPut("/workspace/phone/{areaId:guid}/lamp/{id:guid}", SaveLampAsync);
        app.MapDelete("/workspace/phone/{areaId:guid}/lamp/{id:guid}", RemoveLampAsync);
    }

    /// <summary><c>Version</c>: der Stand, auf dem geändert wurde — 0 für eine neue Lampe.</summary>
    public sealed record LampRequest(int Epoch, string? Sealed, int Version);

    /// <summary>Eine Hülle einer Lampe gelesen — oder warum nicht.</summary>
    public static bool SealedLamp(string? text, out byte[] bytes) =>
        Base64Url.TryDecode(text, out bytes) && bytes.Length is >= 48 and <= MaxLampSealed;

    private static async Task LampsAsync(HttpContext ctx, Db db, Guid areaId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Read) is null) return;

        await using var cmd = new SqlCommand("""
            SELECT id, epoch, sealed, version, updated_at
            FROM app.phone_lamp
            WHERE area_id = @area
            ORDER BY created_at;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);

        var lamps = new List<object>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                lamps.Add(new
                {
                    lampId = Ids.ToText(reader.GetGuid(0)),
                    epoch = reader.GetInt32(1),
                    @sealed = Base64Url.Encode((byte[])reader[2]),
                    version = reader.GetInt32(3),
                    updatedAt = reader.GetDateTimeOffset(4)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { lamps });
    }

    /// <summary>
    /// Eine Lampe speichern. Ist sie inzwischen woanders geändert worden, kommt
    /// 409 (<c>stale</c>) — der Browser lädt neu, statt still zu überschreiben.
    /// </summary>
    private static async Task SaveLampAsync(HttpContext ctx, Db db, Guid areaId, Guid id, LampRequest body)
    {
        if (!SealedLamp(body.Sealed, out var sealedBytes))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zapieczętowane urządzenie musi mieć najwyżej 256 KB.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var allowed = await AllowedAsync(ctx, db, connection, areaId, Capability.Write);
        if (allowed is null) return;
        if (body.Epoch < 1 || body.Epoch > allowed.Value.CurrentEpoch)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        (Guid Area, int Version)? had = null;
        await using (var read = new SqlCommand(
            "SELECT area_id, version FROM app.phone_lamp WITH (UPDLOCK, HOLDLOCK) WHERE id = @id;", connection, tx))
        {
            read.Parameters.AddWithValue("@id", id);
            await using var reader = await read.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted)) had = (reader.GetGuid(0), reader.GetInt32(1));
        }

        if (had is not null && had.Value.Area != areaId)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "To urządzenie należy do innego obszaru.");
            return;
        }
        if ((had?.Version ?? 0) != body.Version)
        {
            ctx.Response.StatusCode = StatusCodes.Status409Conflict;
            await ctx.Response.WriteAsJsonAsync(new { error = "Ktoś zmienił to urządzenie w międzyczasie — wczytaj nowszą wersję.", verdict = "stale", version = had?.Version ?? 0 });
            return;
        }
        if (had is null)
        {
            await using var count = new SqlCommand("SELECT COUNT(*) FROM app.phone_lamp WHERE area_id = @area;", connection, tx);
            count.Parameters.AddWithValue("@area", areaId);
            if ((int)(await count.ExecuteScalarAsync(ctx.RequestAborted))! >= MaxLamps)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Obszar ma już {MaxLamps} urządzeń.");
                return;
            }
        }

        var now = DateTimeOffset.UtcNow;
        await using (var save = new SqlCommand(had is null
            ? """
              INSERT INTO app.phone_lamp (id, area_id, epoch, sealed, version, created_at, updated_at)
              VALUES (@id, @area, @epoch, @sealed, 1, @now, @now);
              """
            : """
              UPDATE app.phone_lamp
                 SET epoch = @epoch, sealed = @sealed, version = version + 1, updated_at = @now
               WHERE id = @id;
              """, connection, tx))
        {
            save.Parameters.AddWithValue("@id", id);
            save.Parameters.AddWithValue("@area", areaId);
            save.Parameters.AddWithValue("@epoch", body.Epoch);
            save.Parameters.AddBlob("@sealed", sealedBytes);
            save.Parameters.AddWithValue("@now", now);
            await save.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { lampId = Ids.ToText(id), version = body.Version + 1, updatedAt = now });
    }

    private static async Task RemoveLampAsync(HttpContext ctx, Db db, Guid areaId, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Write) is null) return;

        await using var cmd = new SqlCommand("DELETE FROM app.phone_lamp WHERE id = @id AND area_id = @area;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@area", areaId);
        var changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { lampId = Ids.ToText(id), deleted = changed > 0 });
    }
}
