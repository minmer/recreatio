using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 9.6 und 9.17 — Nachrichten schreiben, lesen, bearbeiten, ausblenden.
///
/// <b>Dual Authorship (3.3).</b> Gespeichert werden Rolle UND Konto, angezeigt
/// wird nur die Rolle. Das Konto liegt in einer EIGENEN Tabelle, die der
/// Lesepfad nicht joint — nicht aus Bequemlichkeit, sondern damit die Kennung
/// nicht versehentlich in einer Anzeige oder einem Export landet (3.4, BEFUND 07
/// aus dem ersten Bericht).
///
/// <b>Ausblenden ist zweierlei (9.17, BEFUND 28).</b>
///
/// <code>
///   durch den Urheber (1)          durch die Leitung (2)
///   ---------------------          ---------------------
///   Text weg, Urheber weg.         Text bleibt, Urheber bleibt.
///   Ein anonymer Grabstein.        Umkehrbar.
/// </code>
///
/// Beides „ausblenden" zu nennen und gleich zu behandeln waere der Fehler: wer
/// seinen eigenen Beitrag zuruecknimmt, will nicht als dessen Urheber
/// stehenbleiben; wer einen fremden ausblendet, muss die Entscheidung
/// zuruecknehmen koennen. Die Datenbank erzwingt den Unterschied — er laesst
/// sich nicht im Code vergessen.
/// </summary>
public static class RcMessages
{
    /// <summary>9.6.6 / E-270 — Die Frist laeuft ab dem letzten Absenden.</summary>
    public static readonly TimeSpan AppendWindow = TimeSpan.FromMinutes(15);

    public const int MaxBodyBytes = 64 * 1024;

    public static void MapRcMessages(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/areas/{id:guid}/messages", FeedAsync);
        app.MapPost("/rc/areas/{id:guid}/messages", PostAsync);
        app.MapPost("/rc/messages/{id:guid}/edit", EditAsync);
        app.MapPost("/rc/messages/{id:guid}/hide", HideAsync);
    }

    // -- Schreiben ------------------------------------------------------------

    public sealed record PostRequest(string AuthorRoleId, string Body, string? QuoteMessageId, bool? ChainBound);

    private static async Task PostAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, RcLedger ledger,
        Guid id, PostRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.AuthorRoleId, out var authorRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        var text = body.Body ?? "";
        if (text.Trim().Length == 0 || Encoding.UTF8.GetByteCount(text) > MaxBodyBytes)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Dieser Beitrag ist leer oder zu lang.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        // Unter welchem Namen geschrieben wird, bestimmt der Schreibende — aber
        // nur unter einem, den er erreicht UND der hier schreiben darf.
        var authorKey = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, held.MasterKey, authorRoleId, ctx.RequestAborted);

        if (authorKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Unter diesem Namen kannst du nicht schreiben.");
            return;
        }

        var epoch = await CurrentEpochAsync(connection, id, ctx.RequestAborted);
        var epochKey = await RcAreaKeys.EpochKeyAsync(
            connection, session.AccountId, held.MasterKey, id, epoch, ctx.RequestAborted);

        if (epochKey is null)
        {
            // Berechtigt, aber ohne Schluessel. Das ist ein Befund und keine
            // Unbequemlichkeit — die Zuteilung fehlt, obwohl das Zertifikat da
            // ist, und die beiden sollen NIE auseinanderlaufen.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingKey,
                "Fuer die laufende Epoche dieses Bereichs fehlt dir der Schluessel.");
            return;
        }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [authorRoleId], ctx.RequestAborted);
        if (!identities.TryGetValue(authorRoleId, out var author))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var messageId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;
        var sealedBody = RcCrypto.Seal(epochKey, BodyAad(messageId, 1), Encoding.UTF8.GetBytes(text));

        // 9.6.7 — Das Zitat haelt den Hash der zitierten Fassung fest und wandert
        // NICHT mit, wenn das Original spaeter bearbeitet wird.
        Guid? quoteId = null;
        byte[]? quoteHash = null;
        if (Guid.TryParse(body.QuoteMessageId, out var parsedQuote))
        {
            quoteHash = await QuotedBodyHashAsync(connection, parsedQuote, id, ctx.RequestAborted);
            if (quoteHash is not null) quoteId = parsedQuote;
        }

        using var authorSign = RcRoleKeys.OpenSignKey(author, authorKey);
        var version = new RcMessageVersionRecord
        {
            Id = RcId.NewId(),
            MessageId = messageId,
            Version = 1,
            AuthorRoleId = authorRoleId,
            BodyHash = RcMessageVersionRecord.QuoteHash(sealedBody),
            CreatedUtc = now
        };

        // 7.8 / E-263 — Kettenpflicht wird JE BEITRAG entschieden, nicht je
        // Bereich. Fehlt die Angabe, entsteht kein Eintrag: sichere
        // Voreinstellung, und kein Sicherheitsverlust, denn der Beitrag ist
        // trotzdem verschluesselt, zugeordnet und versioniert.
        //
        // Alles in die Kette zu schreiben waere teuer und stumpf — eine Kette,
        // in der jedes „bis gleich" steht, beweist am Ende nichts, weil niemand
        // sie mehr liest.
        var chainBound = body.ChainBound == true;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            chainBound ? System.Data.IsolationLevel.Serializable : System.Data.IsolationLevel.ReadCommitted,
            ctx.RequestAborted);
        try
        {
            Guid? ledgerEntryId = null;
            if (chainBound)
            {
                var area = await LedgerOfAreaAsync(connection, tx, id, ctx.RequestAborted);
                var entry = await ledger.AppendAsync(connection, tx, area.LedgerId,
                    RcJson.O(
                        ("bodyHash", RcJson.Hex(RcMessageVersionRecord.QuoteHash(sealedBody))),
                        ("epoch", RcJson.I(epoch)),
                        ("kind", RcJson.S("message.posted")),
                        ("messageId", RcJson.G(messageId))),
                    messageId, area.TenantId, "chat",
                    author, authorSign, session.AccountId, RcId.NewId(), ctx.RequestAborted);

                ledgerEntryId = entry.EntryId;
            }

            await using (var insert = new SqlCommand("""
                INSERT INTO dbo.rc_message
                    (id, area_id, epoch, author_role_id, body_sealed, version, posted_at,
                     append_window_until, quote_message_id, quote_body_hash, ledger_entry_id)
                VALUES
                    (@id, @area, @epoch, @author, @body, 1, @now, @window, @quoteId, @quoteHash, @ledgerEntry);
                """, connection, tx))
            {
                insert.Parameters.Add("@ledgerEntry", System.Data.SqlDbType.UniqueIdentifier).Value =
                    (object?)ledgerEntryId ?? DBNull.Value;
                insert.Parameters.AddWithValue("@id", messageId);
                insert.Parameters.AddWithValue("@area", id);
                insert.Parameters.AddWithValue("@epoch", epoch);
                insert.Parameters.AddWithValue("@author", authorRoleId);
                insert.Parameters.AddWithValue("@body", sealedBody);
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.AddWithValue("@window", now + AppendWindow);

                // AddWithValue leitet den Typ aus dem WERT ab — bei DBNull wird
                // daraus nvarchar, und SQL Server weigert sich, das nach
                // varbinary zu wandeln. Bei nullbaren Spalten muss der Typ
                // deshalb ausdruecklich dastehen.
                insert.Parameters.Add("@quoteId", System.Data.SqlDbType.UniqueIdentifier).Value =
                    (object?)quoteId ?? DBNull.Value;
                insert.Parameters.Add("@quoteHash", System.Data.SqlDbType.VarBinary, 32).Value =
                    (object?)quoteHash ?? DBNull.Value;
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            // 3.3 / 3.4 — Das Konto in einer eigenen Tabelle, die der Lesepfad
            // nicht anfasst.
            await using (var attribution = new SqlCommand(
                "INSERT INTO dbo.rc_message_attribution (message_id, account_id, created_at) VALUES (@m, @a, @now);",
                connection, tx))
            {
                attribution.Parameters.AddWithValue("@m", messageId);
                attribution.Parameters.AddWithValue("@a", session.AccountId);
                attribution.Parameters.AddWithValue("@now", now);
                await attribution.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await InsertVersionAsync(connection, tx, version, sealedBody, version.Sign(authorSign), ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new
        {
            messageId = RcId.ToText(messageId),
            epoch,
            version = 1,
            postedUtc = now,
            appendWindowUntil = now + AppendWindow,
            chainBound
        }, StatusCodes.Status201Created);
    }

    // -- Lesen ----------------------------------------------------------------

    public sealed record MessageView(
        string MessageId, int Epoch, string? AuthorRoleId, string? Body, int Version,
        DateTimeOffset PostedUtc, DateTimeOffset? EditedUtc, string? HiddenKind,
        string? QuoteMessageId, string? Unreadable);

    /// <summary>
    /// 15.9 — Was der Leser nicht oeffnen kann, faellt NICHT aus der Liste. Es
    /// steht da, mit einem Grund.
    ///
    /// Eine Nachricht stillschweigend wegzulassen waere schlimmer als sie
    /// unlesbar zu zeigen: der Leser haette keinen Anhaltspunkt, dass zwischen
    /// zwei Beitraegen etwas fehlt, und wuerde das Gespraech falsch verstehen.
    /// „Aus der Zeit vor deinem Beitritt" ist eine Auskunft; ein Loch ist keine.
    /// </summary>
    private static async Task FeedAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, int? limit)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey, id, ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT TOP (@limit) id, epoch, author_role_id, body_sealed, version, posted_at, edited_at,
                   hidden_kind, quote_message_id
            FROM dbo.rc_message
            WHERE area_id = @area
            ORDER BY seq DESC;
            """, connection);

        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@limit", Math.Clamp(limit ?? 50, 1, 200));

        var views = new List<MessageView>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var messageId = reader.GetGuid(0);
                var epoch = reader.GetInt32(1);
                var authorRoleId = reader.IsDBNull(2) ? (Guid?)null : reader.GetGuid(2);
                var sealedBody = reader.IsDBNull(3) ? null : (byte[])reader[3];
                var version = reader.GetInt32(4);
                var hiddenKind = reader.IsDBNull(7) ? (byte?)null : reader.GetByte(7);
                var quote = reader.IsDBNull(8) ? (Guid?)null : reader.GetGuid(8);

                string? text = null;
                string? unreadable = null;

                if (sealedBody is null)
                {
                    // 9.17 — Ausblenden durch den Urheber. Ein anonymer Grabstein
                    // ist kein Fehler und bekommt deshalb keinen Fehlergrund.
                }
                else if (!keys.TryGetValue(epoch, out var key))
                {
                    unreadable = RcErrorCodes.CryptoMissingEpoch;
                }
                else
                {
                    try { text = Encoding.UTF8.GetString(RcCrypto.Open(key, BodyAad(messageId, version), sealedBody)); }
                    catch (RcDecryptException e) { unreadable = e.Code; }
                }

                views.Add(new MessageView(
                    RcId.ToText(messageId), epoch,
                    authorRoleId is null ? null : RcId.ToText(authorRoleId.Value),
                    text, version,
                    reader.GetDateTimeOffset(5),
                    reader.IsDBNull(6) ? null : reader.GetDateTimeOffset(6),
                    hiddenKind switch { 1 => "author", 2 => "moderation", _ => null },
                    quote is null ? null : RcId.ToText(quote.Value),
                    unreadable));
            }
        }

        views.Reverse();
        await RcResults.WriteJsonAsync(ctx, new
        {
            messages = views,
            readableEpochs = keys.Keys.OrderBy(k => k).ToList()
        });
    }

    // -- Bearbeiten -----------------------------------------------------------

    public sealed record EditRequest(string Body);

    /// <summary>
    /// Bearbeiten heisst: eine neue Fassung anlegen, nicht die alte
    /// ueberschreiben. <c>rc_message_version</c> behaelt jede, mit eigener
    /// Unterschrift.
    ///
    /// Nur der Urheber, und nur innerhalb der Frist (9.6.6). Die Frist laeuft ab
    /// dem letzten Absenden, nicht ab Beginn des Schreibens — sonst waere sie
    /// bei einem langen Beitrag schon abgelaufen, bevor er fertig war.
    /// </summary>
    private static async Task EditAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, EditRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var text = body.Body ?? "";
        if (text.Trim().Length == 0 || Encoding.UTF8.GetByteCount(text) > MaxBodyBytes)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Dieser Beitrag ist leer oder zu lang.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var message = await LoadAsync(connection, id, ctx.RequestAborted);
        if (message is null || message.AuthorRoleId is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.PermissionDenied, "Diesen Beitrag gibt es nicht.");
            return;
        }

        var may = await permissions.CheckAsync(
            session.AccountId, RcScopeKind.Area, message.AreaId, RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        if (message.AppendWindowUntil is null || message.AppendWindowUntil < DateTimeOffset.UtcNow)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Die Frist zum Bearbeiten ist abgelaufen.");
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        // Nur der Urheber. Geprueft wird ueber den SCHLUESSEL der Urheberrolle,
        // nicht ueber eine Kennung im Antragskoerper: wer die Rolle nicht
        // aufbekommt, ist nicht ihr Halter, was immer er behauptet.
        var authorKey = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, held.MasterKey, message.AuthorRoleId.Value, ctx.RequestAborted);

        if (authorKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Nur der Urheber kann seinen Beitrag bearbeiten.");
            return;
        }

        var epochKey = await RcAreaKeys.EpochKeyAsync(
            connection, session.AccountId, held.MasterKey, message.AreaId, message.Epoch, ctx.RequestAborted);

        if (epochKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingEpoch, "Fuer diese Epoche fehlt dir der Schluessel.");
            return;
        }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [message.AuthorRoleId.Value], ctx.RequestAborted);
        if (!identities.TryGetValue(message.AuthorRoleId.Value, out var author))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var newVersion = message.Version + 1;
        var now = DateTimeOffset.UtcNow;

        // Die AAD nennt die Fassungsnummer. Ohne sie liesse sich eine alte
        // Fassung an die Stelle einer neuen schieben — und die
        // Versionsgeschichte waere umschreibbar.
        var sealedBody = RcCrypto.Seal(epochKey, BodyAad(id, newVersion), Encoding.UTF8.GetBytes(text));

        using var authorSign = RcRoleKeys.OpenSignKey(author, authorKey);
        var record = new RcMessageVersionRecord
        {
            Id = RcId.NewId(),
            MessageId = id,
            Version = newVersion,
            AuthorRoleId = message.AuthorRoleId.Value,
            BodyHash = RcMessageVersionRecord.QuoteHash(sealedBody),
            CreatedUtc = now
        };

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.ReadCommitted, ctx.RequestAborted);
        try
        {
            await using (var update = new SqlCommand("""
                UPDATE dbo.rc_message
                SET body_sealed = @body, version = @version, edited_at = @now, append_window_until = @window
                WHERE id = @id AND version = @previous AND hidden_at IS NULL;
                """, connection, tx))
            {
                update.Parameters.AddWithValue("@body", sealedBody);
                update.Parameters.AddWithValue("@version", newVersion);
                update.Parameters.AddWithValue("@now", now);

                // E-270 — jede Anfuegung verlaengert die Frist.
                update.Parameters.AddWithValue("@window", now + AppendWindow);
                update.Parameters.AddWithValue("@id", id);
                update.Parameters.AddWithValue("@previous", message.Version);

                if (await update.ExecuteNonQueryAsync(ctx.RequestAborted) != 1)
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                        RcErrorCodes.ChainSequenceConflict, "Dieser Beitrag wurde inzwischen geaendert.");
                    return;
                }
            }

            await InsertVersionAsync(connection, tx, record, sealedBody, record.Sign(authorSign), ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new { messageId = RcId.ToText(id), version = newVersion, editedUtc = now });
    }

    // -- Ausblenden -----------------------------------------------------------

    public sealed record HideRequest(bool? ByAuthor);

    private static async Task HideAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, HideRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var message = await LoadAsync(connection, id, ctx.RequestAborted);
        if (message is null || message.AuthorRoleId is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.PermissionDenied, "Diesen Beitrag gibt es nicht.");
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var isAuthor = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, held.MasterKey, message.AuthorRoleId.Value, ctx.RequestAborted) is not null;

        var byAuthor = body.ByAuthor ?? isAuthor;

        if (byAuthor && !isAuthor)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "So zuruecknehmen kann nur der Urheber.");
            return;
        }

        Guid hidingRoleId;
        if (byAuthor)
        {
            hidingRoleId = message.AuthorRoleId.Value;
        }
        else
        {
            var may = await permissions.CheckAsync(
                session.AccountId, RcScopeKind.Area, message.AreaId, RcCapability.Admin, ctx.RequestAborted);

            if (!may.Allowed)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                    RcErrorCodes.PermissionDenied, "Hier darfst du nichts ausblenden.");
                return;
            }
            hidingRoleId = may.Via!.Value;
        }

        // 9.17 / BEFUND 28 — die beiden Faelle sind wirklich verschieden, und
        // die Datenbank besteht darauf. Ein Verstoss hier wird nicht
        // stillschweigend geschrieben, sondern abgewiesen.
        var sql = byAuthor
            ? """
              UPDATE dbo.rc_message
              SET hidden_at = @now, hidden_kind = 1, hidden_by_role_id = @by,
                  author_role_id = NULL, body_sealed = NULL
              WHERE id = @id AND hidden_at IS NULL;
              """
            : """
              UPDATE dbo.rc_message
              SET hidden_at = @now, hidden_kind = 2, hidden_by_role_id = @by
              WHERE id = @id AND hidden_at IS NULL;
              """;

        await using var cmd = new SqlCommand(sql, connection);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@by", hidingRoleId);
        cmd.Parameters.AddWithValue("@id", id);

        var rows = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await RcResults.WriteJsonAsync(ctx, new
        {
            messageId = RcId.ToText(id),
            hidden = rows == 1,
            kind = byAuthor ? "author" : "moderation",
            reversible = !byAuthor
        });
    }

    // -- Datenzugriff ---------------------------------------------------------

    private sealed record MessageRow(
        Guid Id, Guid AreaId, int Epoch, Guid? AuthorRoleId, int Version, DateTimeOffset? AppendWindowUntil);

    private static async Task<MessageRow?> LoadAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, area_id, epoch, author_role_id, version, append_window_until " +
            "FROM dbo.rc_message WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new MessageRow(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetInt32(2),
            reader.IsDBNull(3) ? null : reader.GetGuid(3),
            reader.GetInt32(4),
            reader.IsDBNull(5) ? null : reader.GetDateTimeOffset(5));
    }

    private static async Task<byte[]?> QuotedBodyHashAsync(
        SqlConnection connection, Guid quotedId, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT body_sealed FROM dbo.rc_message WHERE id = @id AND area_id = @area AND body_sealed IS NOT NULL;",
            connection);
        cmd.Parameters.AddWithValue("@id", quotedId);
        cmd.Parameters.AddWithValue("@area", areaId);

        return await cmd.ExecuteScalarAsync(ct) is byte[] sealedBody
            ? RcMessageVersionRecord.QuoteHash(sealedBody)
            : null;
    }

    private static async Task InsertVersionAsync(
        SqlConnection connection, SqlTransaction tx, RcMessageVersionRecord record,
        byte[] sealedBody, byte[] signature, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_message_version (id, message_id, version, body_sealed, created_at, signature)
            VALUES (@id, @message, @version, @body, @now, @sig);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", record.Id);
        cmd.Parameters.AddWithValue("@message", record.MessageId);
        cmd.Parameters.AddWithValue("@version", record.Version);
        cmd.Parameters.AddWithValue("@body", sealedBody);
        cmd.Parameters.AddWithValue("@now", record.CreatedUtc);
        cmd.Parameters.AddWithValue("@sig", signature);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task<(Guid LedgerId, Guid TenantId)> LedgerOfAreaAsync(
        SqlConnection connection, SqlTransaction tx, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT ledger_id, tenant_id FROM dbo.rc_area WHERE id = @id;", connection, tx);
        cmd.Parameters.AddWithValue("@id", areaId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? (reader.GetGuid(0), reader.GetGuid(1)) : (Guid.Empty, Guid.Empty);
    }

    private static async Task<int> CurrentEpochAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT current_epoch FROM dbo.rc_area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", areaId);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct) ?? 0, System.Globalization.CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Die AAD nennt die FASSUNG. Ohne sie liesse sich eine alte Fassung an die
    /// Stelle einer neuen schieben, und die Versionsgeschichte waere
    /// umschreibbar (3.13).
    /// </summary>
    private static RcAad BodyAad(Guid messageId, int version) =>
        RcAad.Create("chat", "message", messageId, RcField.MessageBody, version);
}
