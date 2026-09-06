using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Bilder und Dateien einer Veranstaltung.
///
/// <b>Dieselbe Ablage wie bei Anhaengen an Nachrichten</b>
/// (<see cref="RcAttachments"/>), und das ist die ganze Entscheidung hinter
/// dieser Datei. Eine zweite Ablage danebenzustellen hiesse, dieselben drei
/// Fragen ein zweites Mal zu beantworten — wo die Bytes liegen, unter welchem
/// Schluessel, auf wessen Kontingent — und die zweite Antwort waere die
/// schlechtere, weil sie die erste nicht kennt. Deshalb bekam
/// <c>rc_attachment</c> in rc_0028 einen allgemeinen Traeger.
///
/// <b>Was hier daneben steht.</b> Nur, was das Bild in einer Galerie ausmacht:
/// Unterschrift, wer es beigesteuert hat, Seitenverhaeltnis. Getrennt, weil es
/// andere Fristen hat — eine Unterschrift wird korrigiert, die Datei nicht.
///
/// <b>Wer beitragen darf.</b> Zum Ansehen reicht, was auch fuer die
/// Veranstaltung reicht. Zum HOCHLADEN braucht es Schreibrecht am Bereich —
/// oder, fuer Teilnehmer ohne Konto, den Beleg ihrer Anmeldung. Ein offener
/// Bilderkasten ohne beides waere ein Briefkasten fuer Fremde.
/// </summary>
public static class RcEventMedia
{
    /// <summary>Ein Bild darf so gross sein wie jeder andere Anhang.</summary>
    public const long MaxFileBytes = RcAttachments.MaxFileBytes;

    public static void MapRcEventMedia(this IEndpointRouteBuilder app)
    {
        // DisableAntiforgery schaltet nur den EINGEBAUTEN Formularschutz ab —
        // Voraussetzung dafuer, dass IFormFile ueberhaupt gebunden wird.
        // RcCsrfMiddleware laeuft davor und verlangt hier denselben Schutzwert
        // wie ueberall; ohne diesen Satz liest die Zeile sich wie ein Loch.
        app.MapPost("/rc/event-parts/{id:guid}/photos", UploadPhotoAsync)
            .DisableAntiforgery().Produces<RcEventPhotoUploadedResponse>();
        app.MapGet("/rc/event-parts/{id:guid}/photos", ListPhotosAsync)
            .Produces<RcEventPhotosResponse>();
        app.MapPost("/rc/event-photos/{id:guid}/delete", DeletePhotoAsync)
            .Produces<RcEventDeletedResponse>();

        app.MapPost("/rc/events/{id:guid}/documents", UploadDocumentAsync)
            .DisableAntiforgery().Produces<RcEventDocumentUploadedResponse>();
        app.MapGet("/rc/events/{id:guid}/documents", ListDocumentsAsync)
            .Produces<RcEventDocumentsResponse>();
        app.MapPost("/rc/event-documents/{id:guid}/delete", DeleteDocumentAsync)
            .Produces<RcEventDeletedResponse>();

        // Der Inhalt liegt hinter EINER Adresse fuer beides: ein Bild und eine
        // Datei unterscheiden sich hier durch nichts als ihre Zeile.
        app.MapGet("/rc/event-media/{id:guid}/content", DownloadAsync);
    }

    // -- Bilder ---------------------------------------------------------------

    private static async Task UploadPhotoAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        IConfiguration config, Guid id, IFormFile file,
        [Microsoft.AspNetCore.Mvc.FromForm] string? caption,
        [Microsoft.AspNetCore.Mvc.FromForm] string? uploaderName,
        [Microsoft.AspNetCore.Mvc.FromForm] int? width,
        [Microsoft.AspNetCore.Mvc.FromForm] int? height)
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

        var owner = await RcEventEditing.OwnerOfPartAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }
        if (!await RcEventEditing.MayWriteAreaAsync(ctx, permissions, session.AccountId, owner.Value.AreaId)) return;

        var stored = await StoreAsync(ctx, connection, masterKeys, config, session,
            owner.Value.AreaId, file, "event_photo", id);
        if (stored is null) return;

        var photoId = RcId.NewId();

        await using (var insert = new SqlCommand("""
            INSERT INTO dbo.rc_event_photo
                (id, event_id, part_id, attachment_id, registration_id,
                 uploader_name, caption, width, height, created_at)
            VALUES (@id, @event, @part, @attachment, NULL,
                    @who, @caption, @w, @h, @now);
            """, connection))
        {
            insert.Parameters.AddWithValue("@id", photoId);
            insert.Parameters.AddWithValue("@event", owner.Value.EventId);
            insert.Parameters.AddWithValue("@part", id);
            insert.Parameters.AddWithValue("@attachment", stored.Value);
            Text(insert, "@who", uploaderName, 120);
            Text(insert, "@caption", caption, 400);
            insert.Parameters.AddWithValue("@w", width ?? 0);
            insert.Parameters.AddWithValue("@h", height ?? 0);
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventPhotoUploadedResponse(
            RcId.ToText(photoId), RcId.ToText(stored.Value)), StatusCodes.Status201Created);
    }

    public sealed record PhotoView(
        string PhotoId, string MediaId, string? UploaderName, string? Caption,
        int Width, int Height, DateTimeOffset CreatedUtc);

    private static async Task ListPhotosAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var owner = await RcEventEditing.OwnerOfPartAsync(connection, id, ctx.RequestAborted);
        if (owner is null) { await RcAreas.NotForYou(ctx); return; }

        if (!await MayReadPartAsync(ctx, connection, permissions, id, owner.Value.AreaId)) return;

        var views = new List<PhotoView>();
        await using (var cmd = new SqlCommand("""
            SELECT id, attachment_id, uploader_name, caption, width, height, created_at
            FROM dbo.rc_event_photo WHERE part_id = @id
            ORDER BY created_at DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                views.Add(new PhotoView(
                    RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)),
                    reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3),
                    reader.GetInt32(4), reader.GetInt32(5), reader.GetDateTimeOffset(6)));
            }
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventPhotosResponse(views));
    }

    private static async Task DeletePhotoAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, IConfiguration config, Guid id)
    {
        await DeleteMediaAsync(ctx, db, permissions, config, id,
            "dbo.rc_event_photo", """
            SELECT e.area_id, p.attachment_id FROM dbo.rc_event_photo p
            JOIN dbo.rc_event e ON e.id = p.event_id WHERE p.id = @id;
            """);
    }

    // -- Dateien --------------------------------------------------------------

    private static async Task UploadDocumentAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        IConfiguration config, Guid id, IFormFile file,
        [Microsoft.AspNetCore.Mvc.FromForm] string? label)
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

        Guid areaId;
        await using (var cmd = new SqlCommand(
            "SELECT area_id FROM dbo.rc_event WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await RcAreas.NotForYou(ctx);
                return;
            }
            areaId = found;
        }

        if (!await RcEventEditing.MayWriteAreaAsync(ctx, permissions, session.AccountId, areaId)) return;

        var stored = await StoreAsync(ctx, connection, masterKeys, config, session,
            areaId, file, "event_document", id);
        if (stored is null) return;

        var documentId = RcId.NewId();

        await using (var insert = new SqlCommand("""
            INSERT INTO dbo.rc_event_document (id, event_id, attachment_id, label, created_at)
            VALUES (@id, @event, @attachment, @label, @now);
            """, connection))
        {
            insert.Parameters.AddWithValue("@id", documentId);
            insert.Parameters.AddWithValue("@event", id);
            insert.Parameters.AddWithValue("@attachment", stored.Value);
            Text(insert, "@label", label ?? file.FileName, 200);
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventDocumentUploadedResponse(
            RcId.ToText(documentId), RcId.ToText(stored.Value), file.Length),
            StatusCodes.Status201Created);
    }

    public sealed record DocumentView(
        string DocumentId, string MediaId, string? Label, long ByteSize, DateTimeOffset CreatedUtc);

    private static async Task ListDocumentsAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid areaId;
        await using (var cmd = new SqlCommand(
            "SELECT area_id FROM dbo.rc_event WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await RcAreas.NotForYou(ctx);
                return;
            }
            areaId = found;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var views = new List<DocumentView>();
        await using (var cmd = new SqlCommand("""
            SELECT d.id, d.attachment_id, d.label, a.size_bytes, d.created_at
            FROM dbo.rc_event_document d
            JOIN dbo.rc_attachment a ON a.id = d.attachment_id
            WHERE d.event_id = @id
            ORDER BY d.created_at DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                views.Add(new DocumentView(
                    RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)),
                    reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.GetInt64(3), reader.GetDateTimeOffset(4)));
            }
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventDocumentsResponse(views));
    }

    private static async Task DeleteDocumentAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, IConfiguration config, Guid id)
    {
        await DeleteMediaAsync(ctx, db, permissions, config, id,
            "dbo.rc_event_document", """
            SELECT e.area_id, d.attachment_id FROM dbo.rc_event_document d
            JOIN dbo.rc_event e ON e.id = d.event_id WHERE d.id = @id;
            """);
    }

    // -- Inhalt ---------------------------------------------------------------

    /// <summary>
    /// Der Inhalt, entsiegelt.
    ///
    /// <b>Warum das nicht ohne Konto geht, obwohl die Seite oeffentlich ist.</b>
    /// Die Datei liegt unter dem Epochenschluessel des Bereichs — sie zu lesen
    /// heisst, ihn zu haben. Ein oeffentlicher Bilderkasten braucht deshalb
    /// entweder unversiegelte Ablage oder einen Leser, der dazugehoert; das
    /// Erste gibt es hier nicht, und so zu tun, als gaebe es ein Drittes, waere
    /// die Art von Halbheit, die spaeter als Datenleck auffaellt.
    /// </summary>
    private static async Task DownloadAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        IConfiguration config, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid areaId, attachmentId;
        int epoch;
        string relativePath;

        await using (var cmd = new SqlCommand("""
            SELECT e.area_id, a.id, a.content_sealed_path, ISNULL(a.epoch, 0)
            FROM dbo.rc_attachment a
            LEFT JOIN dbo.rc_event_photo p    ON p.attachment_id = a.id
            LEFT JOIN dbo.rc_event_document d ON d.attachment_id = a.id
            JOIN dbo.rc_event e ON e.id = ISNULL(p.event_id, d.event_id)
            WHERE a.id = @id;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await RcAreas.NotForYou(ctx); return; }

            areaId = reader.GetGuid(0);
            attachmentId = reader.GetGuid(1);
            relativePath = reader.GetString(2);
            epoch = reader.GetInt32(3);
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var epochKey = await RcAreaKeys.EpochKeyAsync(
            connection, session.AccountId, held.MasterKey, areaId, epoch, ctx.RequestAborted);

        if (epochKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingKey, "Fuer diese Epoche fehlt dir der Schluessel.");
            return;
        }

        var fullPath = Path.Combine(RcAttachments.StoreRoot(config), relativePath);
        if (!File.Exists(fullPath))
        {
            // Zeile ohne Datei. Das ist ein Betriebsfehler und kein
            // Nutzerfehler — er gehoert benannt und nicht als „nicht gefunden"
            // getarnt, sonst sucht ihn nie jemand. Wortgleich mit
            // RcAttachments, weil es derselbe Fehler in derselben Ablage ist.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status500InternalServerError,
                "storage.file_missing", "Diese Datei liegt nicht mehr im Speicher.");
            return;
        }

        var sealedContent = await File.ReadAllBytesAsync(fullPath, ctx.RequestAborted);
        var plain = RcCrypto.Open(epochKey, RcAttachments.ContentAad(attachmentId), sealedContent);

        /*
         * IMMER als Anhang und IMMER als octet-stream.
         *
         * Der Inhaltstyp kaeme sonst vom Hochladenden, und ein als Bild
         * angekuendigtes HTML fuehrt der Browser im Ursprung dieser Seite aus.
         * Die Anzeige im Browser kostet das — der Preis ist es wert.
         */
        ctx.Response.ContentType = "application/octet-stream";
        ctx.Response.Headers.ContentDisposition = "attachment";
        ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
        await ctx.Response.Body.WriteAsync(plain, ctx.RequestAborted);
    }

    // -- Gemeinsames ----------------------------------------------------------

    /// <summary>
    /// Die Datei verschluesselt ablegen und ihre Zeile in <c>rc_attachment</c>
    /// schreiben. Gibt die Kennung zurueck — oder <c>null</c>, wenn schon
    /// geantwortet wurde.
    /// </summary>
    private static async Task<Guid?> StoreAsync(
        HttpContext ctx, SqlConnection connection, RcMasterKey masterKeys,
        IConfiguration config, RcRequestSession session, Guid areaId, IFormFile file,
        string ownerKind, Guid ownerId)
    {
        // 15.12 — Das Kontingent VOR dem Verschluesseln pruefen. Andersherum
        // haette man zehn Megabyte gerechnet, um sie dann wegzuwerfen.
        var (used, quota) = await RcAttachments.QuotaAsync(connection, session.AccountId, ctx.RequestAborted);
        if (used + file.Length > quota)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.StorageQuotaExceeded,
                $"Dein Speicher ist voll: {used / 1024 / 1024} von {quota / 1024 / 1024} MB belegt.");
            return null;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var epoch = await CurrentEpochAsync(connection, areaId, ctx.RequestAborted);
        var epochKey = await RcAreaKeys.EpochKeyAsync(
            connection, session.AccountId, held.MasterKey, areaId, epoch, ctx.RequestAborted);

        if (epochKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingKey, "Fuer diese Epoche fehlt dir der Schluessel.");
            return null;
        }

        var attachmentId = RcId.NewId();

        byte[] plain;
        await using (var stream = file.OpenReadStream())
        await using (var buffer = new MemoryStream())
        {
            await stream.CopyToAsync(buffer, ctx.RequestAborted);
            plain = buffer.ToArray();
        }

        byte[] sealedContent;
        try { sealedContent = RcCrypto.Seal(epochKey, RcAttachments.ContentAad(attachmentId), plain); }
        finally { CryptographicOperations.ZeroMemory(plain); }

        var fileName = RcAttachments.SafeName(file.FileName);
        var sealedName = RcCrypto.Seal(
            epochKey, RcAttachments.NameAad(attachmentId), Encoding.UTF8.GetBytes(fileName));

        // Der Pfad kommt aus der Kennung, NIE aus dem Dateinamen. Ein
        // Dateiname vom Klienten in einem Pfad ist der klassische Weg aus dem
        // Ordner heraus.
        var relativePath = RcAttachments.RelativePath(attachmentId);
        var fullPath = Path.Combine(RcAttachments.StoreRoot(config), relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await File.WriteAllBytesAsync(fullPath, sealedContent, ctx.RequestAborted);

        try
        {
            await using var cmd = new SqlCommand("""
                INSERT INTO dbo.rc_attachment
                    (id, message_id, owner_kind, owner_id, owner_account_id, size_bytes,
                     content_sealed_path, content_sha256, file_name_sealed, epoch, created_at)
                VALUES
                    (@id, NULL, @kind, @owner, @account, @size,
                     @path, @hash, @name, @epoch, @now);
                """, connection);

            cmd.Parameters.AddWithValue("@id", attachmentId);
            cmd.Parameters.AddWithValue("@kind", ownerKind);
            cmd.Parameters.AddWithValue("@owner", ownerId);
            cmd.Parameters.AddWithValue("@account", session.AccountId);
            cmd.Parameters.AddWithValue("@size", file.Length);
            cmd.Parameters.AddWithValue("@path", relativePath);
            cmd.Parameters.AddWithValue("@hash", SHA256.HashData(sealedContent));
            cmd.Parameters.AddWithValue("@name", sealedName);
            cmd.Parameters.AddWithValue("@epoch", epoch);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch
        {
            // Die Zeile fehlt, also darf die Datei nicht bleiben: sonst waechst
            // der Ordner um Bloecke, die niemand mehr zuordnen kann.
            try { File.Delete(fullPath); } catch { /* Der Fehler darunter zaehlt. */ }
            throw;
        }

        return attachmentId;
    }

    /// <summary>
    /// Ein Stueck Medium entfernen: erst die Zeile, dann der Anhang, dann die
    /// Datei. In dieser Reihenfolge, damit ein Abbruch hoechstens eine Datei
    /// ohne Zeile hinterlaesst und nie eine Zeile ohne Datei — die erste ist
    /// Muell, die zweite ist ein Bild, das niemand mehr oeffnen kann.
    /// </summary>
    private static async Task DeleteMediaAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, IConfiguration config,
        Guid id, string table, string lookup)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid areaId, attachmentId;
        await using (var cmd = new SqlCommand(lookup, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await RcAreas.NotForYou(ctx); return; }
            areaId = reader.GetGuid(0);
            attachmentId = reader.GetGuid(1);
        }

        if (!await RcEventEditing.MayWriteAreaAsync(ctx, permissions, session.AccountId, areaId)) return;

        string? relativePath = null;
        await using (var cmd = new SqlCommand(
            "SELECT content_sealed_path FROM dbo.rc_attachment WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", attachmentId);
            relativePath = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as string;
        }

        await using (var cmd = new SqlCommand($"DELETE FROM {table} WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await using (var cmd = new SqlCommand(
            "DELETE FROM dbo.rc_attachment WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", attachmentId);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        if (relativePath is not null)
        {
            try { File.Delete(Path.Combine(RcAttachments.StoreRoot(config), relativePath)); }
            catch { /* Die Zeilen sind fort; eine liegengebliebene Datei ist Muell, kein Fehler. */ }
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventDeletedResponse(RcId.ToText(id), true));
    }

    /// <summary>
    /// Darf dieser Leser den Teil sehen?
    ///
    /// Ein oeffentlicher Teil einer veroeffentlichten Veranstaltung steht jedem
    /// offen; alles andere verlangt Lesen am Bereich. Dieselbe Grenze wie in
    /// <c>RcEvents.ReadAsync</c> — sie hier anders zu ziehen hiesse, dass die
    /// Bilder eines Entwurfs sichtbar waeren, den es fuer Fremde nicht gibt.
    /// </summary>
    private static async Task<bool> MayReadPartAsync(
        HttpContext ctx, SqlConnection connection, RcPermissions permissions,
        Guid partId, Guid areaId)
    {
        var session = ctx.RcSession();

        if (session is not null)
        {
            var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
                RcCapability.Read, ctx.RequestAborted);
            if (may.Allowed) return true;
        }

        await using var cmd = new SqlCommand("""
            SELECT TOP 1 1 FROM dbo.rc_event_part p
            JOIN dbo.rc_event_page g ON g.id = p.page_id
            JOIN dbo.rc_event e      ON e.id = g.event_id
            WHERE p.id = @id AND p.is_public = 1 AND p.is_visible = 1
              AND e.lifecycle = N'published' AND e.is_public = 1;
            """, connection);
        cmd.Parameters.AddWithValue("@id", partId);

        if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not null) return true;

        await RcAreas.NotForYou(ctx);
        return false;
    }

    private static async Task<int> CurrentEpochAsync(
        SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT MAX(epoch) FROM dbo.rc_area_epoch WHERE area_id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", areaId);
        return await cmd.ExecuteScalarAsync(ct) is int n ? n : 1;
    }

    private static void Text(SqlCommand cmd, string name, string? value, int max)
    {
        var trimmed = (value ?? string.Empty).Trim();
        if (trimmed.Length > max) trimmed = trimmed[..max];

        cmd.Parameters.Add(name, System.Data.SqlDbType.NVarChar, max).Value =
            trimmed.Length == 0 ? DBNull.Value : trimmed;
    }
}
