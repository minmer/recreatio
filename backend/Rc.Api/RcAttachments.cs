using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 9.10 — Anhaenge. Das einzige Stueck der Plattform, bei dem Inhalt die
/// Datenbank verlaesst.
///
/// <b>Warum ins Dateisystem und nicht in die Datenbank</b> (9.10.1). Eine
/// Datenbank mit zehntausend Bildern darin ist bei jeder Sicherung eine
/// Datenbank mit zehntausend Bildern darin: die Sicherung dauert Stunden, die
/// Wiederherstellung auch, und der Teil, auf den es ankommt — Nachrichten,
/// Rollen, Kette — ist darin nicht mehr aufzufinden. Getrennt gelagert laesst
/// sich beides mit verschiedenen Fristen und verschiedener Eile behandeln.
///
/// <b>Was auf der Platte liegt.</b> Geheimtext, sonst nichts. Kein Dateiname,
/// keine Endung, kein erkennbarer Kopf — der Pfad ist aus der Kennung gebildet
/// und sagt nichts. Wer den Ordner in die Hand bekommt, hat einen Haufen
/// gleichfoermiger Bloecke.
///
/// <b>Das Kontingent haengt am KONTO, nicht am Bereich</b> (15.12, E-294). Ein
/// Bereichskontingent liesse sich umgehen, indem man weitere Bereiche anlegt —
/// und Bereiche anlegen darf, wer einen eigenen Geltungsbereich hat, also
/// jeder.
/// </summary>
public static class RcAttachments
{
    /// <summary>E-94 — 10 MB je Datei. Steht auch in <c>ck_rc_attachment_size</c>.</summary>
    public const long MaxFileBytes = 10 * 1024 * 1024;

    public const string FileExtension = ".rcbin";

    public static void MapRcAttachments(this IEndpointRouteBuilder app)
    {
        // DisableAntiforgery schaltet den EINGEBAUTEN Formularschutz von
        // ASP.NET ab — er ist Voraussetzung dafuer, dass IFormFile in einem
        // Minimal-API-Endpunkt ueberhaupt gebunden wird.
        //
        // Der Schutz dieser Plattform bleibt davon unberuehrt: RcCsrfMiddleware
        // laeuft vor jedem Endpunkt und verlangt hier denselben Schutzwert wie
        // ueberall. Ohne diesen Satz liest die Zeile sich wie ein Loch, und
        // irgendwann macht jemand daraus eines.
        app.MapPost("/rc/messages/{id:guid}/attachments", UploadAsync)
           .DisableAntiforgery().Produces<RcAttachmentUploadedResponse>();
        app.MapGet("/rc/messages/{id:guid}/attachments", ListAsync).Produces<RcAttachmentsResponse>();
        app.MapGet("/rc/attachments/{id:guid}/content", DownloadAsync);
        app.MapPost("/rc/attachments/{id:guid}/delete", DeleteAsync).Produces<RcAttachmentDeletedResponse>();
    }

    // -- Hochladen ------------------------------------------------------------

    private static async Task UploadAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        IConfiguration config, Guid id, IFormFile file)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (file.Length is <= 0 or > MaxFileBytes)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status413PayloadTooLarge,
                RcErrorCodes.StorageFileTooLarge,
                $"Eine Datei darf hoechstens {MaxFileBytes / 1024 / 1024} MB gross sein.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await RcEngagement.AreaOfMessageAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId, RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        // 15.12 — Das Kontingent VOR dem Verschluesseln pruefen. Andersherum
        // haette man zehn Megabyte gerechnet, um sie dann wegzuwerfen.
        var (used, quota) = await QuotaAsync(connection, session.AccountId, ctx.RequestAborted);
        if (used + file.Length > quota)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.StorageQuotaExceeded,
                $"Dein Speicher ist voll: {used / 1024 / 1024} von {quota / 1024 / 1024} MB belegt.");
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var epoch = await EpochOfMessageAsync(connection, id, ctx.RequestAborted);
        var epochKey = await RcAreaKeys.EpochKeyAsync(
            connection, session.AccountId, held.MasterKey, areaId, epoch, ctx.RequestAborted);

        if (epochKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingKey, "Fuer diese Epoche fehlt dir der Schluessel.");
            return;
        }

        var attachmentId = RcId.NewId();

        // Bei 10 MB Obergrenze ist das Puffern vertretbar und der Code dafuer
        // ein Zehntel so gross wie eine gestueckelte Stromverschluesselung.
        // Wird die Grenze je angehoben, ist DAS hier die Stelle, die zuerst
        // weh tut — deshalb steht es hier und nicht in einer Randnotiz.
        byte[] plain;
        await using (var stream = file.OpenReadStream())
        await using (var buffer = new MemoryStream())
        {
            await stream.CopyToAsync(buffer, ctx.RequestAborted);
            plain = buffer.ToArray();
        }

        byte[] sealedContent;
        try
        {
            sealedContent = RcCrypto.Seal(epochKey, ContentAad(attachmentId), plain);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plain);
        }

        var fileName = SafeName(file.FileName);
        var sealedName = RcCrypto.Seal(epochKey, NameAad(attachmentId), Encoding.UTF8.GetBytes(fileName));

        // Der Pfad kommt aus der Kennung, NIE aus dem Dateinamen. Ein
        // Dateiname vom Klienten in einem Pfad ist der klassische Weg aus dem
        // Ordner heraus.
        var relativePath = RelativePath(attachmentId);
        var root = StoreRoot(config);
        var fullPath = Path.Combine(root, relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        await File.WriteAllBytesAsync(fullPath, sealedContent, ctx.RequestAborted);

        try
        {
            await using var cmd = new SqlCommand("""
                INSERT INTO dbo.rc_attachment
                    (id, message_id, owner_account_id, size_bytes, content_sealed_path,
                     content_sha256, file_name_sealed, created_at)
                VALUES
                    (@id, @message, @owner, @size, @path, @hash, @name, @now);
                """, connection);

            cmd.Parameters.AddWithValue("@id", attachmentId);
            cmd.Parameters.AddWithValue("@message", id);
            cmd.Parameters.AddWithValue("@owner", session.AccountId);
            cmd.Parameters.AddWithValue("@size", file.Length);
            cmd.Parameters.AddWithValue("@path", relativePath);

            // Hash ueber den GEHEIMTEXT. Damit laesst sich pruefen, dass die
            // Datei auf der Platte unversehrt ist, ohne sie zu oeffnen — der
            // Betreiber kann seine Sicherung kontrollieren, ohne mitzulesen.
            cmd.Parameters.AddWithValue("@hash", SHA256.HashData(sealedContent));
            cmd.Parameters.AddWithValue("@name", sealedName);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch
        {
            // Die Zeile fehlt, also darf die Datei nicht bleiben: sonst
            // waechst der Ordner um Bloecke, die niemand mehr zuordnen kann.
            TryDelete(fullPath);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new RcAttachmentUploadedResponse(
            RcId.ToText(attachmentId), fileName, file.Length, used + file.Length, quota),
            StatusCodes.Status201Created);
    }

    // -- Anzeigen und Holen ---------------------------------------------------

    public sealed record AttachmentView(string AttachmentId, string? FileName, long SizeBytes, DateTimeOffset CreatedAt);

    private static async Task ListAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await RcEngagement.AreaOfMessageAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId, RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey, areaId, ctx.RequestAborted);

        await using var cmd = new SqlCommand(
            "SELECT id, file_name_sealed, size_bytes, created_at FROM dbo.rc_attachment " +
            "WHERE message_id = @message ORDER BY seq;", connection);
        cmd.Parameters.AddWithValue("@message", id);

        var views = new List<AttachmentView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            var attachmentId = reader.GetGuid(0);
            views.Add(new AttachmentView(
                RcId.ToText(attachmentId),
                RcAreaKeys.TryOpenText(keys, NameAad(attachmentId), (byte[])reader[1]),
                reader.GetInt64(2), reader.GetDateTimeOffset(3)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcAttachmentsResponse(views));
    }

    private static async Task DownloadAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        IConfiguration config, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var row = await LoadAsync(connection, id, ctx.RequestAborted);
        if (row is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, row.AreaId, RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey, row.AreaId, ctx.RequestAborted);

        var fullPath = Path.Combine(StoreRoot(config), row.RelativePath);
        if (!File.Exists(fullPath))
        {
            // Zeile ohne Datei. Das ist ein Betriebsfehler und kein
            // Nutzerfehler — er gehoert benannt und nicht als „nicht gefunden"
            // getarnt, sonst sucht ihn nie jemand.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status500InternalServerError,
                "storage.file_missing", "Diese Datei liegt nicht mehr im Speicher.");
            return;
        }

        var sealedContent = await File.ReadAllBytesAsync(fullPath, ctx.RequestAborted);

        if (!SHA256.HashData(sealedContent).SequenceEqual(row.ContentHash))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status500InternalServerError,
                "storage.file_corrupt", "Diese Datei ist beschaedigt.");
            return;
        }

        byte[] plain;
        try
        {
            plain = OpenWithAnyEpoch(keys, ContentAad(id), sealedContent)
                ?? throw new RcDecryptException(RcDecryptError.MissingEpoch, "Kein passender Epochenschluessel.");
        }
        catch (RcDecryptException e)
        {
            await RcResults.WriteDecryptErrorAsync(ctx, e);
            return;
        }

        var fileName = RcAreaKeys.TryOpenText(keys, NameAad(id), row.SealedName) ?? "anhang";

        // Immer als Anhang, nie zur Anzeige im Browser, und immer als
        // octet-stream: eine hochgeladene Datei ist nichts, dem man beim
        // Darstellen trauen sollte.
        ctx.Response.ContentType = "application/octet-stream";
        ctx.Response.Headers.ContentDisposition =
            $"attachment; filename*=UTF-8''{Uri.EscapeDataString(fileName)}";
        ctx.Response.ContentLength = plain.Length;

        await ctx.Response.Body.WriteAsync(plain, ctx.RequestAborted);
        CryptographicOperations.ZeroMemory(plain);
    }

    // -- Loeschen -------------------------------------------------------------

    /// <summary>
    /// Loeschen heisst hier wirklich loeschen: Zeile weg, Datei weg. Das ist der
    /// Unterschied zu 12.3.2 Weg (b), wo die Schluesselvernichtung genuegt —
    /// bei einer Datei im Dateisystem gibt es keinen Grund, den Block liegen zu
    /// lassen, und ein liegengebliebener Block zaehlt weiter gegen das
    /// Kontingent seines Eigentuemers.
    /// </summary>
    private static async Task DeleteAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, IConfiguration config, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var row = await LoadAsync(connection, id, ctx.RequestAborted);
        if (row is null) { await RcAreas.NotForYou(ctx); return; }

        // Der Eigentuemer darf immer; sonst braucht es admin im Bereich.
        if (row.OwnerAccountId != session.AccountId)
        {
            var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, row.AreaId, RcCapability.Admin, ctx.RequestAborted);
            if (!may.Allowed)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                    RcErrorCodes.PermissionDenied, "Diese Datei darfst du nicht loeschen.");
                return;
            }
        }

        await using (var cmd = new SqlCommand("DELETE FROM dbo.rc_attachment WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        // Erst die Zeile, dann die Datei. Andersherum bliebe bei einem Absturz
        // dazwischen eine Zeile ohne Datei — und die sieht aus wie ein
        // Datenverlust, waehrend eine Datei ohne Zeile nur Platz kostet.
        TryDelete(Path.Combine(StoreRoot(config), row.RelativePath));

        await RcResults.WriteJsonAsync(ctx, new RcAttachmentDeletedResponse(RcId.ToText(id), true));
    }

    // -- Datenzugriff ---------------------------------------------------------

    private sealed record AttachmentRow(
        Guid Id, Guid AreaId, Guid OwnerAccountId, string RelativePath, byte[] ContentHash, byte[] SealedName);

    private static async Task<AttachmentRow?> LoadAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT a.id, m.area_id, a.owner_account_id, a.content_sealed_path, a.content_sha256, a.file_name_sealed
            FROM dbo.rc_attachment a
            JOIN dbo.rc_message m ON m.id = a.message_id
            WHERE a.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new AttachmentRow(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2),
            reader.GetString(3), (byte[])reader[4], (byte[])reader[5]);
    }

    private static async Task<(long Used, long Quota)> QuotaAsync(
        SqlConnection connection, Guid accountId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT ISNULL((SELECT SUM(size_bytes) FROM dbo.rc_attachment WHERE owner_account_id = @id), 0),
                   (SELECT storage_quota_bytes FROM dbo.rc_account WHERE id = @id);
            """, connection);
        cmd.Parameters.AddWithValue("@id", accountId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? (reader.GetInt64(0), reader.GetInt64(1)) : (0, 0);
    }

    private static async Task<int> EpochOfMessageAsync(SqlConnection connection, Guid messageId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT epoch FROM dbo.rc_message WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", messageId);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct) ?? 0, System.Globalization.CultureInfo.InvariantCulture);
    }

    // -- Kleinkram ------------------------------------------------------------

    private static string StoreRoot(IConfiguration config) =>
        config["Rc:FileStorePath"] ?? throw new InvalidOperationException("Rc:FileStorePath fehlt.");

    /// <summary>
    /// Zwei Ebenen aus der Kennung. Zehntausend Dateien in einem Ordner sind
    /// auf manchen Dateisystemen langsam und in jedem Werkzeug unbrauchbar.
    /// </summary>
    private static string RelativePath(Guid attachmentId)
    {
        var text = RcId.ToText(attachmentId).Replace("-", "");
        return Path.Combine(text[..2], text[2..4], text + FileExtension);
    }

    /// <summary>
    /// Der Dateiname wird NUR fuer die Anzeige aufbewahrt — im Pfad kommt er
    /// nicht vor. Trotzdem wird er beschnitten: er landet spaeter in einem
    /// Kopf und im Dateidialog des Empfaengers.
    /// </summary>
    private static string SafeName(string? name)
    {
        var trimmed = Path.GetFileName(name?.Trim() ?? "");
        if (string.IsNullOrEmpty(trimmed)) return "anhang";

        var cleaned = new string(trimmed.Where(c => !char.IsControl(c)).ToArray());
        return cleaned.Length > 200 ? cleaned[..200] : cleaned;
    }

    private static byte[]? OpenWithAnyEpoch(IReadOnlyDictionary<int, byte[]> keys, RcAad aad, byte[] blob)
    {
        foreach (var key in keys.OrderBy(k => k.Key).Select(k => k.Value))
        {
            try { return RcCrypto.Open(key, aad, blob); }
            catch (RcDecryptException) { /* naechste Epoche */ }
        }
        return null;
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch (IOException) { /* Der Block bleibt liegen. Kein Grund, den Aufruf scheitern zu lassen. */ }
        catch (UnauthorizedAccessException) { }
    }

    private static RcAad ContentAad(Guid attachmentId) =>
        RcAad.Create("chat", "attachment", attachmentId, RcField.AttachmentContent, 1);

    private static RcAad NameAad(Guid attachmentId) =>
        RcAad.Create("chat", "attachment", attachmentId, RcField.AttachmentFileName, 1);
}
