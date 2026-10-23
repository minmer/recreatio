using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// PLIKI PRZEZ LINK AUS DEM POSTPROGRAMM (0125) — Thunderbird legt grosse Anhänge
/// als Pliki przez link ab (der Dodatek <c>frontend/thunderbird</c>): dieselbe Hülle,
/// derselbe Link, dieselben Grenzen des Bereichs wie aus einer SMS.
///
/// <para>
/// <b>Ein Połączenie, kein angemeldetes Konto.</b> Im Browser des Kontos entsteht es
/// (Pliki przez link → Thunderbird): der Browser würfelt den Schlüssel der Etiketten
/// und versiegelt ihn mit dem Namen unter dem Schlüssel des Bereichs; der Dienst
/// würfelt das Geheimnis, mit dem sich das Programm ausweist, gibt es EINMAL heraus
/// und behält nur seinen Hash. Beides zusammen ist der Kod połączenia, den man in
/// Thunderbird einfügt.
/// </para>
///
/// <para>
/// <b>Was es darf: Dateien hineinlegen und die eigenen zurückziehen — sonst nichts.</b>
/// Es öffnet keinen Bereichsschlüssel und liest keine Zeile. Bei jedem Aufruf gilt
/// das Recht dessen, der es verbunden hat: kann der im Bereich nicht mehr schreiben
/// (oder ist sein Konto fort), kann es das Połączenie auch nicht. Getrennt wird im
/// Browser des Kontos oder vom Programm selbst.
/// </para>
/// </summary>
public static partial class Phone
{
    /// <summary>Der versiegelte Teil eines Połączenie: der Schlüssel der Etiketten und ein Name.</summary>
    private const int MaxDeviceSealed = 2000;

    /// <summary>So viele Połączenia darf ein Bereich zugleich haben.</summary>
    private const int MaxShareDevices = 20;

    private static void MapShareDevices(WebApplication app)
    {
        /* Im Browser des Kontos: verbinden, sehen, trennen. */
        app.MapPost("/workspace/phone/{areaId:guid}/share-devices", AddShareDeviceAsync);
        app.MapGet("/workspace/phone/{areaId:guid}/share-devices", ShareDevicesAsync);
        app.MapDelete("/workspace/phone/{areaId:guid}/share-device/{id:guid}", DropShareDeviceAsync);

        /* Das Programm selbst — mit seinem Geheimnis statt einer Sitzung. */
        app.MapGet("/share-device", DeviceInfoAsync);
        app.MapDelete("/share-device", DeviceLeaveAsync);
        app.MapPut("/share-device/share/{id:guid}", DeviceShareAsync)
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(MaxShareSealed));
        app.MapDelete("/share-device/share/{id:guid}", DeviceUnshareAsync);
    }

    public sealed record ShareDeviceRequest(string? Id, int Epoch, string? Sealed);

    /// <summary>Der versiegelte Teil eines Połączenie (Schlüssel der Etiketten, Name): 48 Bytes bis 2000.</summary>
    public static bool DeviceSealed(string? text, out byte[] bytes) =>
        Base64Url.TryDecode(text, out bytes) && bytes.Length is >= 48 and <= MaxDeviceSealed;

    /// <summary>
    /// Das Geheimnis aus <c>Authorization: Bearer …</c> — base64url, 16 bis 128 Zeichen;
    /// sonst <c>null</c>. Es ist das, was <see cref="Token.NewSecret"/> würfelte.
    /// </summary>
    public static string? DeviceSecret(string? header)
    {
        const string bearer = "Bearer ";
        if (header is null || !header.StartsWith(bearer, StringComparison.OrdinalIgnoreCase)) return null;
        var secret = header[bearer.Length..].Trim();
        if (secret.Length is < 16 or > 128) return null;
        foreach (var c in secret)
            if (!char.IsAsciiLetterOrDigit(c) && c is not '-' and not '_') return null;
        return secret;
    }

    /* -- Im Browser des Kontos --------------------------------------------------------------- */

    /// <summary>
    /// EIN POŁĄCZENIE ANLEGEN — Kennung und versiegelter Teil kommen vom Browser (die
    /// AAD nennt die Kennung), das Geheimnis würfelt der Dienst und gibt es nur hier heraus.
    /// </summary>
    private static async Task AddShareDeviceAsync(HttpContext ctx, Db db, Guid areaId, ShareDeviceRequest body)
    {
        if (!IdOf(body.Id, out var id))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung połączenia.");
            return;
        }
        if (!DeviceSealed(body.Sealed, out var sealedBytes))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brak zapieczętowanego klucza połączenia.");
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

        var secret = Token.NewSecret();
        var now = DateTimeOffset.UtcNow;
        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted))
        {
            await using (var check = new SqlCommand("""
                SELECT COUNT(*) FROM app.phone_share_device WITH (UPDLOCK, HOLDLOCK)
                 WHERE area_id = @area AND revoked_at IS NULL;
                SELECT COUNT(*) FROM app.phone_share_device WHERE id = @id;
                """, connection, tx))
            {
                check.Parameters.AddWithValue("@area", areaId);
                check.Parameters.AddWithValue("@id", id);
                await using var reader = await check.ExecuteReaderAsync(ctx.RequestAborted);
                var held = await reader.ReadAsync(ctx.RequestAborted) ? reader.GetInt32(0) : 0;
                await reader.NextResultAsync(ctx.RequestAborted);
                var taken = await reader.ReadAsync(ctx.RequestAborted) && reader.GetInt32(0) > 0;
                await reader.CloseAsync();
                if (taken)
                {
                    await Fail(ctx, StatusCodes.Status409Conflict, "Takie połączenie już istnieje.");
                    return;
                }
                if (held >= MaxShareDevices)
                {
                    await Fail(ctx, StatusCodes.Status409Conflict, $"Połączonych programów jest już {MaxShareDevices} — najpierw odłącz któryś.");
                    return;
                }
            }

            await using (var insert = new SqlCommand("""
                INSERT INTO app.phone_share_device (id, area_id, account_id, token_sha256, epoch, sealed, created_at)
                VALUES (@id, @area, @account, @hash, @epoch, @sealed, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", id);
                insert.Parameters.AddWithValue("@area", areaId);
                insert.Parameters.AddWithValue("@account", allowed.Value.AccountId);
                insert.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
                insert.Parameters.AddWithValue("@epoch", body.Epoch);
                insert.Parameters.Add("@sealed", System.Data.SqlDbType.VarBinary, MaxDeviceSealed).Value = sealedBytes;
                insert.Parameters.AddWithValue("@now", now);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
            await tx.CommitAsync(ctx.RequestAborted);
        }

        ctx.Response.Headers.CacheControl = "no-store";
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), token = secret, createdAt = now });
    }

    /// <summary>Die Połączenia eines Bereichs, die gelten — neueste zuerst, mit dem, was sie gerade teilen.</summary>
    private static async Task ShareDevicesAsync(HttpContext ctx, Db db, Guid areaId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Read) is null) return;

        await using var cmd = new SqlCommand("""
            SELECT d.id, d.epoch, d.sealed, d.created_at, d.last_used_at,
                   (SELECT COUNT(*) FROM app.phone_share s
                     WHERE s.device_id = d.id AND s.deleted_at IS NULL AND s.expires_at > SYSDATETIMEOFFSET()),
                   (SELECT COALESCE(SUM(s.byte_length), 0) FROM app.phone_share s
                     WHERE s.device_id = d.id AND s.deleted_at IS NULL AND s.expires_at > SYSDATETIMEOFFSET())
            FROM app.phone_share_device d
            WHERE d.area_id = @area AND d.revoked_at IS NULL
            ORDER BY d.created_at DESC, d.id;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);

        var devices = new List<object>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                devices.Add(new
                {
                    id = Ids.ToText(reader.GetGuid(0)),
                    epoch = reader.GetInt32(1),
                    @sealed = Base64Url.Encode((byte[])reader[2]),
                    createdAt = reader.GetDateTimeOffset(3),
                    lastUsedAt = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4),
                    shares = reader.GetInt32(5),
                    bytes = reader.GetInt64(6)
                });
            }
        }
        await ctx.Response.WriteAsJsonAsync(new { devices });
    }

    /// <summary>Trennen: das Programm weist sich ab sofort nicht mehr aus. Seine Links gelten bis zu ihrem Ablauf.</summary>
    private static async Task DropShareDeviceAsync(HttpContext ctx, Db db, Guid areaId, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Write) is null) return;

        await using var cmd = new SqlCommand("""
            UPDATE app.phone_share_device SET revoked_at = SYSDATETIMEOFFSET()
             WHERE id = @id AND area_id = @area AND revoked_at IS NULL;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@area", areaId);
        var changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), revoked = changed > 0 });
    }

    /* -- Das Programm ------------------------------------------------------------------------ */

    private readonly record struct ShareDeviceRow(Guid Id, Guid Area, Guid Account, int Epoch);

    /// <summary>
    /// Wer sich mit seinem Geheimnis ausweist — und ob der, der es verbunden hat, im
    /// Bereich noch schreibt. Sonst steht die Antwort schon da (401, 403).
    /// </summary>
    private static async Task<ShareDeviceRow?> DeviceOfAsync(HttpContext ctx, SqlConnection connection)
    {
        ctx.Response.Headers.CacheControl = "no-store";
        var secret = DeviceSecret(ctx.Request.Headers.Authorization.ToString());
        if (secret is null)
        {
            await Fail(ctx, StatusCodes.Status401Unauthorized, "Brak kodu połączenia z recreatio.pl.");
            return null;
        }

        ShareDeviceRow? row = null;
        await using (var cmd = new SqlCommand("""
            SELECT d.id, d.area_id, d.account_id, d.epoch
            FROM app.phone_share_device d
            JOIN app.account a ON a.id = d.account_id
            WHERE d.token_sha256 = @hash AND d.revoked_at IS NULL AND a.disabled_at IS NULL;
            """, connection))
        {
            cmd.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
                row = new ShareDeviceRow(reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetInt32(3));
        }

        if (row is null)
        {
            await Fail(ctx, StatusCodes.Status401Unauthorized,
                "To połączenie zostało odłączone albo kod jest nieprawidłowy — połącz program ponownie (recreatio.pl → Pliki przez link).");
            return null;
        }
        if (!await Area.MayAsync(connection, row.Value.Account, row.Value.Area, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Konto, które połączyło ten program, nie może już dodawać plików w tym obszarze.");
            return null;
        }
        return row;
    }

    /// <summary>Was das Programm wissen muss: ob es noch verbunden ist, und wie viel Platz bleibt.</summary>
    private static async Task DeviceInfoAsync(HttpContext ctx, Db db)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await DeviceOfAsync(ctx, connection) is not { } device) return;

        await using var cmd = new SqlCommand("""
            SELECT COALESCE(SUM(byte_length), 0) FROM app.phone_share
             WHERE area_id = @area AND deleted_at IS NULL AND expires_at > SYSDATETIMEOFFSET();
            SELECT COALESCE(SUM(byte_length), 0) FROM app.phone_share
             WHERE area_id = @area AND created_at > DATEADD(day, -1, SYSDATETIMEOFFSET());
            """, connection);
        cmd.Parameters.AddWithValue("@area", device.Area);
        long held = 0, today = 0;
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            if (await reader.ReadAsync(ctx.RequestAborted)) held = reader.GetInt64(0);
            await reader.NextResultAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted)) today = reader.GetInt64(0);
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            id = Ids.ToText(device.Id),
            maxFile = MaxShareFile,
            held,
            maxHeld = MaxSharesHeld,
            today,
            maxToday = MaxSharesPerDay,
            maxDays = MaxShareDays
        });
    }

    /// <summary>Das Programm trennt sich selbst (in Thunderbird „Odłącz", oder das Konto dort wurde entfernt).</summary>
    private static async Task DeviceLeaveAsync(HttpContext ctx, Db db)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var secret = DeviceSecret(ctx.Request.Headers.Authorization.ToString());
        if (secret is null)
        {
            await Fail(ctx, StatusCodes.Status401Unauthorized, "Brak kodu połączenia z recreatio.pl.");
            return;
        }

        /* Auch ohne Schreibrecht: sich selbst trennen darf jedes Połączenie. */
        await using var cmd = new SqlCommand("""
            UPDATE app.phone_share_device SET revoked_at = SYSDATETIMEOFFSET()
             WHERE token_sha256 = @hash AND revoked_at IS NULL;
            """, connection);
        cmd.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
        var changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { revoked = changed > 0 });
    }

    /// <summary>
    /// EINEN LINK ANLEGEN, aus dem Programm — wie aus dem Browser, nur dass Bereich und
    /// Epoche am Połączenie hängen: das Etikett liegt unter seinem Schlüssel, und der
    /// liegt unter dieser Epoche.
    /// </summary>
    private static async Task DeviceShareAsync(HttpContext ctx, Db db, IConfiguration config, Guid id, int? days)
    {
        if (await ShareRequestAsync(ctx, days) is not { } request) return;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await DeviceOfAsync(ctx, connection) is not { } device) return;

        await using (var used = new SqlCommand(
            "UPDATE app.phone_share_device SET last_used_at = SYSDATETIMEOFFSET() WHERE id = @id;", connection))
        {
            used.Parameters.AddWithValue("@id", device.Id);
            await used.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await StoreShareAsync(ctx, config, connection, device.Area, device.Epoch, device.Id, id, request);
    }

    /// <summary>Einen eigenen Link zurückziehen (der Anhang wurde aus der Nachricht genommen) — fremde nie.</summary>
    private static async Task DeviceUnshareAsync(HttpContext ctx, Db db, IConfiguration config, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await DeviceOfAsync(ctx, connection) is not { } device) return;

        int changed;
        await using (var cmd = new SqlCommand("""
            UPDATE app.phone_share SET deleted_at = SYSDATETIMEOFFSET()
             WHERE id = @id AND area_id = @area AND device_id = @device AND deleted_at IS NULL;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@area", device.Area);
            cmd.Parameters.AddWithValue("@device", device.Id);
            changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        /* Die Datei nur, wenn es wirklich der eigene war: dieselbe Kennung im Bereich gehört sonst jemand anderem. */
        if (changed > 0) DropShareFile(config, device.Area, id);
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), deleted = changed > 0 });
    }
}
