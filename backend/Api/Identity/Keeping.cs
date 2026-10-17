using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Den PasswordKey aufbewahren — als Huelle, die dieser Dienst nicht oeffnet.
///
/// <para>
/// <b>Was hier liegt, ist fuer den Betreiber Rauschen.</b> Der Browser
/// versiegelt den PasswordKey unter einem Zufallsschluessel, den er selbst
/// behaelt (<c>localStorage</c>, je Geraet einer); hierher kommt nur das
/// Ergebnis. Es gibt in diesem Dienst keine Stelle, die <c>sealed_blob</c>
/// oeffnet — und das ist der ganze Unterschied zum Altbestand, der den
/// PasswordKey offen entgegennahm und serverseitig entschluesselte.
/// </para>
///
/// <code>
///   Datenbank allein   Huellen ohne Oeffner        nichts
///   Geraet allein      Oeffner ohne Huelle*        nichts
///   beides zusammen    alles
///
///   * die Huelle gibt es nur gegen eine gueltige Sitzung
/// </code>
///
/// <para>
/// <b>Umschalten auf <c>tab</c> loescht mit.</b> Eine „sichere" Einstellung,
/// die die Huellen liegen liesse, waere eine Beschriftung und keine Massnahme.
/// Deshalb geschieht beides in EINER Transaktion.
/// </para>
/// </summary>
public static class Keeping
{
    /// <summary>Der Schluessel ueberlebt (Vorgabe) oder lebt nur im Tab.</summary>
    public const string Kept = "kept";
    public const string TabOnly = "tab";

    /// <summary>
    /// Ein versiegelter 32-Byte-Schluessel sind rund achtzig Byte. Der Deckel
    /// steht hier mit einer Meldung, damit aus dieser Spalte kein Ablagefach
    /// wird — die Datenbank sagt sonst nur „constraint".
    /// </summary>
    private const int MaxSealed = 512;

    public static void Map(WebApplication app)
    {
        app.MapPost("/workspace/key", KeepAsync);
        app.MapGet("/workspace/key", FetchAsync);
        app.MapDelete("/workspace/key", ForgetAsync);
        app.MapPost("/workspace/key/mode", ModeAsync);
        app.MapGet("/workspace/key/devices", DevicesAsync);
    }

    public sealed record KeepRequest(string DeviceId, string Sealed);
    public sealed record ModeRequest(string Mode);

    /* -- Ablegen ------------------------------------------------------------ */

    /// <summary>
    /// Die Huelle dieses Geraets ablegen — oder die vorhandene ersetzen.
    ///
    /// <para>
    /// Ersetzen und nicht haeufen: ein Geraet hat genau einen Oeffner. Eine
    /// zweite Huelle daneben waere eine, die niemand mehr aufbekommt.
    /// </para>
    /// </summary>
    private static async Task KeepAsync(HttpContext ctx, Db db, KeepRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.DeviceId, out var deviceId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung urządzenia.");
            return;
        }

        byte[] sealed_;
        try { sealed_ = Base64Url.Decode(body.Sealed ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna zapieczętowana treść.");
            return;
        }

        if (sealed_.Length is < 20 or > MaxSealed)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie wygląda na zapieczętowany klucz.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * NUR wenn das Konto es auch will. Ohne diese Frage liesse sich die
         * strenge Einstellung mit einem einzigen Aufruf umgehen — und zwar
         * still, denn die Oberflaeche sagte weiterhin „tylko w tej karcie".
         */
        if (await ModeOfAsync(connection, who.Value.AccountId, ctx.RequestAborted) != Kept)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "To konto trzyma klucz tylko w karcie. Najpierw zmień ustawienie.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.account_key
               SET sealed_blob = @blob, created_at = @now, last_used_at = NULL
             WHERE account_id = @account AND device_id = @device;

            IF @@ROWCOUNT = 0
                INSERT INTO app.account_key (account_id, device_id, sealed_blob, created_at)
                VALUES (@account, @device, @blob, @now);
            """, connection);

        cmd.Parameters.AddWithValue("@account", who.Value.AccountId);
        cmd.Parameters.AddWithValue("@device", deviceId);
        cmd.Parameters.AddWithValue("@blob", sealed_);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { deviceId = Ids.ToText(deviceId), kept = true });
    }

    /* -- Holen -------------------------------------------------------------- */

    /// <summary>
    /// Die Huelle dieses Geraets zurueckgeben.
    ///
    /// <para>
    /// Sie geht nur gegen eine gueltige Sitzung hinaus. Das ist die zweite
    /// Haelfte der Rechnung: der Oeffner allein — etwa von einer gestohlenen
    /// Platte — nuetzt nichts, solange niemand angemeldet ist.
    /// </para>
    /// </summary>
    private static async Task FetchAsync(HttpContext ctx, Db db, string? device)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(device, out var deviceId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung urządzenia.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            UPDATE app.account_key SET last_used_at = @now
            OUTPUT inserted.sealed_blob
            WHERE account_id = @account AND device_id = @device;
            """, connection);

        cmd.Parameters.AddWithValue("@account", who.Value.AccountId);
        cmd.Parameters.AddWithValue("@device", deviceId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not byte[] blob)
        {
            // „Gibt es nicht" und „gehoert dir nicht" bekommen dieselbe Antwort.
            await Fail(ctx, StatusCodes.Status404NotFound, "Dla tego urządzenia nic tu nie leży.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            deviceId = Ids.ToText(deviceId),

            // `@sealed`, damit hinaus dasselbe Wort geht, das hereinkommt
            // (`KeepRequest.Sealed`). Ein `sealed_` waere ein Name, den es nur
            // gibt, weil C# das Schluesselwort sonst nicht durchlaesst.
            @sealed = Base64Url.Encode(blob)
        });
    }

    /* -- Vergessen ---------------------------------------------------------- */

    /// <summary>
    /// Die Huellen wegwerfen — dieses eine Geraet, oder alle.
    ///
    /// <para>
    /// Ohne <c>device</c> alle: das ist „auf allen Geraeten abmelden", und es
    /// muss ohne die Geraete gehen, die man gerade nicht in der Hand hat.
    /// </para>
    /// </summary>
    private static async Task ForgetAsync(HttpContext ctx, Db db, string? device)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        Guid? only = null;

        if (!string.IsNullOrWhiteSpace(device))
        {
            if (!Guid.TryParse(device, out var one))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung urządzenia.");
                return;
            }
            only = one;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var dropped = await DropAsync(connection, null, who.Value.AccountId, only, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { forgotten = dropped });
    }

    /* -- Umschalten --------------------------------------------------------- */

    /// <summary>
    /// Die Betriebsart setzen.
    ///
    /// <para>
    /// <b>Auf <c>tab</c> umzuschalten wirft die Huellen weg</b> — in derselben
    /// Transaktion. Eine Einstellung, die „nur in der Karte" sagt und die
    /// Huellen liegen liesse, waere eine Beschriftung und keine Massnahme; und
    /// der Mensch, der sie umlegt, tut es gerade deshalb.
    /// </para>
    /// </summary>
    private static async Task ModeAsync(HttpContext ctx, Db db, ModeRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var mode = (body.Mode ?? string.Empty).Trim().ToLowerInvariant();

        if (mode is not (Kept or TabOnly))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Tryb: kept albo tab.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var cmd = new SqlCommand(
                "UPDATE app.account SET key_keeping = @mode WHERE id = @id;", connection, tx))
            {
                cmd.Parameters.AddWithValue("@mode", mode);
                cmd.Parameters.AddWithValue("@id", who.Value.AccountId);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            var dropped = mode == TabOnly
                ? await DropAsync(connection, tx, who.Value.AccountId, null, ctx.RequestAborted)
                : 0;

            await tx.CommitAsync(ctx.RequestAborted);
            await ctx.Response.WriteAsJsonAsync(new { keyKeeping = mode, forgotten = dropped });
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }

    /* -- Was liegt herum ---------------------------------------------------- */

    /// <summary>
    /// Welche Geraete eine Huelle halten — ohne die Huellen selbst.
    ///
    /// <para>
    /// Damit ein Mensch sieht, was mitlesen koennte. Ein Geraet, das seit einem
    /// Jahr nicht gefragt hat, ist meist eines, das er nicht mehr besitzt.
    /// </para>
    /// </summary>
    private static async Task DevicesAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * ZUERST die Betriebsart, DANN der Leser.
         *
         * Umgekehrt lief ein zweiter Befehl ueber dieselbe Verbindung, waehrend
         * der Leser noch offen war — das weist SQL Server ohne MARS ab, und der
         * ganze Aufruf endete als 500. Sichtbar wurde es als „das Geraet steht
         * nicht in der Liste": ein Fehler sieht von aussen aus wie eine leere
         * Liste.
         */
        var mode = await ModeOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT device_id, created_at, last_used_at
            FROM app.account_key
            WHERE account_id = @account
            ORDER BY ISNULL(last_used_at, created_at) DESC;
            """, connection);

        cmd.Parameters.AddWithValue("@account", who.Value.AccountId);

        var devices = new List<object>();

        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                devices.Add(new
                {
                    deviceId = Ids.ToText(reader.GetGuid(0)),
                    createdAt = reader.GetDateTimeOffset(1),
                    lastUsedAt = reader.IsDBNull(2) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(2)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { keyKeeping = mode, devices });
    }

    /* -- Gemeinsames -------------------------------------------------------- */

    /// <summary>Die Betriebsart eines Kontos — <c>kept</c>, wenn nichts dasteht.</summary>
    internal static async Task<string> ModeOfAsync(
        SqlConnection connection, Guid accountId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT key_keeping FROM app.account WHERE id = @id;", connection);

        cmd.Parameters.AddWithValue("@id", accountId);
        return await cmd.ExecuteScalarAsync(ct) as string ?? Kept;
    }

    private static async Task<int> DropAsync(
        SqlConnection connection, SqlTransaction? tx, Guid accountId, Guid? device, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "DELETE FROM app.account_key WHERE account_id = @account"
            + (device is null ? ";" : " AND device_id = @device;"), connection, tx);

        cmd.Parameters.AddWithValue("@account", accountId);
        if (device is not null) cmd.Parameters.AddWithValue("@device", device.Value);

        return await cmd.ExecuteNonQueryAsync(ct);
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
