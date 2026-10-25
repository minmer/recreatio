using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>0130 — was der Betreiber mit einer Meldung tut, und was der Verfasser davon erfährt.</summary>
public static partial class Reports
{
    /* -- Die Liste des Betreibers ----------------------------------------------------- */

    private static async Task QueueAsync(HttpContext ctx, Db db, IConfiguration config)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AsOperatorAsync(ctx, db, connection, config) is null) return;

        var list = new List<object>();
        await using (var cmd = new SqlCommand("""
            SELECT TOP 300 r.id, r.item_kind, r.item_id, r.item_at, r.item_path, r.area_id, a.name, r.controller_id, v.name,
                   r.reason, r.state, r.received_at, r.decided_at, r.sealed, r.sealed_key, r.objection, r.objection_key, r.objected_at,
                   t.state, t.since
            FROM app.report r
            LEFT JOIN app.area a ON a.id = r.area_id
            LEFT JOIN app.data_controller d ON d.id = r.controller_id
            LEFT JOIN app.data_controller_version v ON v.controller_id = d.id AND v.version = d.current_version
            LEFT JOIN app.takedown t ON t.item_kind = r.item_kind AND t.item_id = r.item_id
                 AND ((t.item_at IS NULL AND r.item_at IS NULL) OR t.item_at = r.item_at)
            ORDER BY CASE WHEN r.state IN (N'received', N'objected') THEN 0 WHEN r.state = N'blocked' THEN 1 ELSE 2 END, r.received_at DESC;
            """, connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                string? B64(int i) => reader.IsDBNull(i) ? null : Base64Url.Encode((byte[])reader[i]);
                var since = reader.IsDBNull(19) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(19);
                list.Add(new
                {
                    id = Ids.ToText(reader.GetGuid(0)),
                    itemKind = reader.GetString(1),
                    itemId = Ids.ToText(reader.GetGuid(2)),
                    itemAt = reader.IsDBNull(3) ? (long?)null : reader.GetDateTimeOffset(3).ToUnixTimeSeconds(),
                    path = reader.IsDBNull(4) ? null : reader.GetString(4),
                    areaId = reader.IsDBNull(5) ? null : Ids.ToText(reader.GetGuid(5)),
                    areaName = reader.IsDBNull(6) ? null : reader.GetString(6),
                    controllerId = reader.IsDBNull(7) ? null : Ids.ToText(reader.GetGuid(7)),
                    controllerName = reader.IsDBNull(8) ? null : reader.GetString(8),
                    reason = reader.GetString(9),
                    state = reader.GetString(10),
                    receivedAt = reader.GetDateTimeOffset(11),
                    decidedAt = reader.IsDBNull(12) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(12),
                    @sealed = B64(13), sealedKey = B64(14),
                    objection = B64(15), objectionKey = B64(16),
                    objectedAt = reader.IsDBNull(17) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(17),
                    takedown = reader.IsDBNull(18) ? null : reader.GetString(18),
                    blockedSince = since,
                    /* Endgültig löschen: nach der Frist für einen Widerspruch — oder wenn widersprochen wurde, nach dessen Lektüre. */
                    deleteFrom = since?.Add(ObjectionPeriod)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { reports = list, head = await HeadAsync(connection, null, ctx.RequestAborted) });
    }

    private static async Task<object> HeadAsync(SqlConnection connection, SqlTransaction? tx, CancellationToken ct)
    {
        var (sequence, hash) = await HeadValuesAsync(connection, tx, ct, lockIt: false);
        return new { sequence, hash = Crypto.ToHex(hash) };
    }

    private static async Task<(long Sequence, byte[] Hash)> HeadValuesAsync(SqlConnection connection, SqlTransaction? tx, CancellationToken ct, bool lockIt)
    {
        await using var cmd = new SqlCommand(
            $"SELECT TOP 1 sequence, entry_hash FROM app.takedown_ledger {(lockIt ? "WITH (UPDLOCK, HOLDLOCK)" : "")} ORDER BY sequence DESC;",
            connection, tx);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? (reader.GetInt64(0), (byte[])reader[1]) : (0L, TakedownEntryRecord.Genesis);
    }

    /// <summary>Die Kette — wer will, prüft jede Unterschrift und jedes Glied nach.</summary>
    private static async Task LedgerAsync(HttpContext ctx, Db db, IConfiguration config)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AsOperatorAsync(ctx, db, connection, config) is null) return;

        var entries = new List<object>();
        await using (var cmd = new SqlCommand("""
            SELECT TOP 200 sequence, entry_id, previous_hash, entry_hash, report_id, item_kind, item_id, item_at, action,
                   signer_role_id, signed_at, signature, recorded_at
            FROM app.takedown_ledger ORDER BY sequence DESC;
            """, connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                entries.Add(new
                {
                    sequence = reader.GetInt64(0),
                    entryId = Ids.ToText(reader.GetGuid(1)),
                    previousHash = Crypto.ToHex((byte[])reader[2]),
                    entryHash = Crypto.ToHex((byte[])reader[3]),
                    reportId = Ids.ToText(reader.GetGuid(4)),
                    itemKind = reader.GetString(5),
                    itemId = Ids.ToText(reader.GetGuid(6)),
                    itemAt = reader.IsDBNull(7) ? (long?)null : reader.GetDateTimeOffset(7).ToUnixTimeSeconds(),
                    action = reader.GetString(8),
                    signerRoleId = Ids.ToText(reader.GetGuid(9)),
                    signedAt = reader.GetDateTimeOffset(10).ToUnixTimeSeconds(),
                    signature = Base64Url.Encode((byte[])reader[11]),
                    recordedAt = reader.GetDateTimeOffset(12)
                });
            }
        }
        await ctx.Response.WriteAsJsonAsync(new { entries, head = await HeadAsync(connection, null, ctx.RequestAborted) });
    }

    /* -- Entscheiden ---------------------------------------------------------------- */

    public sealed record LedgerStep(string? EntryId, long Sequence, string? PreviousHash, long SignedAt, string? Signature);

    public sealed record DecideRequest(string? Action, string? Secret, string? ReasonCode, LedgerStep? Entry);

    private sealed record Case(Guid Id, string Kind, Guid Item, DateTimeOffset? At, string State, byte[] Decision);

    /// <summary>
    /// Sperren, wiederherstellen, endgültig löschen oder ablehnen — nur mit dem
    /// Entscheidungsgeheimnis dieser Meldung und mit einem unterschriebenen Glied der Kette.
    /// </summary>
    private static async Task DecideAsync(HttpContext ctx, Db db, IConfiguration config, Guid id, DecideRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var operatorRole = await AsOperatorAsync(ctx, db, connection, config);
        if (operatorRole is null) return;

        var action = body.Action;
        if (action is not ("block" or "restore" or "delete" or "reject"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieznana decyzja.");
            return;
        }
        var reason = body.ReasonCode ?? "other";
        if (reason is not ("personal-data" or "illegal" or "rights" or "other"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieznany powód.");
            return;
        }

        byte[] secret, signature, previous;
        try
        {
            secret = Base64Url.Decode(body.Secret ?? "");
            signature = Base64Url.Decode(body.Entry?.Signature ?? "");
            previous = Crypto.FromHex(body.Entry?.PreviousHash ?? "");
        }
        catch (Exception e) when (e is FormatException or ArgumentException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna decyzja.");
            return;
        }
        if (body.Entry is null || !Guid.TryParse(body.Entry.EntryId, out var entryId) || signature.Length is 0 or > 1024 || previous.Length != 32)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brakuje podpisanego wpisu do łańcucha.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var signedAt = DateTimeOffset.FromUnixTimeSeconds(body.Entry.SignedAt);
        if ((signedAt - now).Duration() > Area.ClockSlack)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Czas podpisu się nie zgadza — sprawdź zegar urządzenia.");
            return;
        }

        var files = new List<string>();
        string state;

        /* Wem die Glocke sagt, warum (vor der Transaktion: das Nachsehen öffnet eigene Abfragen). */
        Guid? author = null;
        if (action == "block")
        {
            string? kind = null;
            var item = Guid.Empty;
            await using (var pre = new SqlCommand("SELECT item_kind, item_id FROM app.report WHERE id = @id;", connection))
            {
                pre.Parameters.AddWithValue("@id", id);
                await using var reader = await pre.ExecuteReaderAsync(ctx.RequestAborted);
                if (await reader.ReadAsync(ctx.RequestAborted)) { kind = reader.GetString(0); item = reader.GetGuid(1); }
            }
            if (kind is not null) author = (await ItemAsync(connection, null, kind, item, ctx.RequestAborted, trusted: true))?.AuthorRoleId;
        }

        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted))
        {
            Case? found = null;
            await using (var cmd = new SqlCommand(
                "SELECT id, item_kind, item_id, item_at, state, decision_sha256 FROM app.report WITH (UPDLOCK) WHERE id = @id;", connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", id);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                if (await reader.ReadAsync(ctx.RequestAborted))
                    found = new Case(reader.GetGuid(0), reader.GetString(1), reader.GetGuid(2),
                        reader.IsDBNull(3) ? null : reader.GetDateTimeOffset(3), reader.GetString(4), (byte[])reader[5]);
            }
            if (found is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma takiego zgłoszenia."); return; }

            /* DAS GEHEIMNIS DER MELDUNG: es steht nur in der versiegelten Meldung, und öffnen kann sie nur der Betreiber. */
            if (!CryptographicOperations.FixedTimeEquals(SHA256.HashData(secret), found.Decision))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Ta decyzja nie pasuje do zgłoszenia.");
                return;
            }

            /* Der Stand der Sperre der Sache. */
            string? blockedState = null;
            DateTimeOffset? since = null;
            await using (var cmd = new SqlCommand("""
                SELECT state, since FROM app.takedown
                WHERE item_kind = @kind AND item_id = @item AND ((item_at IS NULL AND @at IS NULL) OR item_at = @at);
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@kind", found.Kind);
                cmd.Parameters.AddWithValue("@item", found.Item);
                cmd.Parameters.AddWithValue("@at", found.At is null ? DBNull.Value : found.At.Value);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                if (await reader.ReadAsync(ctx.RequestAborted)) { blockedState = reader.GetString(0); since = reader.GetDateTimeOffset(1); }
            }

            string? refuse = action switch
            {
                "block" when found.State is not ("received" or "restored") => "To zgłoszenie jest już rozpatrzone.",
                "restore" when found.State is not ("blocked" or "objected") => "Przywrócić można tylko to, co jest zablokowane.",
                "delete" when found.State is not ("blocked" or "objected") => "Usunąć na zawsze można dopiero to, co jest zablokowane.",
                "delete" when found.State == "blocked" && since is not null && now < since.Value + ObjectionPeriod
                    => $"Autor może się odwołać do {(since.Value + ObjectionPeriod).ToLocalTime():dd.MM.yyyy} — dopiero wtedy można usunąć na zawsze.",
                "reject" when found.State != "received" => "Odrzucić można tylko nowe zgłoszenie.",
                _ => null
            };
            if (refuse is not null) { await Fail(ctx, StatusCodes.Status409Conflict, refuse); return; }

            /* DIE KETTE: dieses Glied muss das nächste sein, am Hash des letzten hängen und vom Betreiber unterschrieben sein. */
            var (sequence, head) = await HeadValuesAsync(connection, tx, ctx.RequestAborted, lockIt: true);
            if (body.Entry.Sequence != sequence + 1 || !CryptographicOperations.FixedTimeEquals(previous, head))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Łańcuch się przesunął — odśwież i podpisz jeszcze raz.");
                return;
            }

            var step = new TakedownEntryRecord
            {
                Sequence = body.Entry.Sequence, PreviousHash = previous, EntryId = entryId, ReportId = found.Id,
                ItemKind = found.Kind, ItemId = found.Item, ItemAt = found.At, Action = action,
                SignerRoleId = operatorRole.Value, SignedUtc = signedAt
            };

            byte[]? spki;
            await using (var cmd = new SqlCommand("SELECT sign_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", operatorRole.Value);
                spki = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as byte[];
            }
            var valid = false;
            if (spki is not null)
            {
                try
                {
                    using var rsa = RSA.Create();
                    rsa.ImportSubjectPublicKeyInfo(spki, out _);
                    valid = step.Verify(rsa, signature);
                }
                catch (CryptographicException) { valid = false; }
            }
            if (!valid) { await Fail(ctx, StatusCodes.Status403Forbidden, "Podpis wpisu do łańcucha się nie zgadza."); return; }

            await using (var cmd = new SqlCommand("""
                INSERT INTO app.takedown_ledger (sequence, entry_id, previous_hash, entry_hash, report_id, item_kind, item_id, item_at,
                    action, signer_role_id, signed_at, signature, recorded_at)
                VALUES (@seq, @entry, @prev, @hash, @report, @kind, @item, @at, @action, @signer, @signedAt, @sig, @now);
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@seq", step.Sequence);
                cmd.Parameters.AddWithValue("@entry", entryId);
                cmd.Parameters.AddWithValue("@prev", previous);
                cmd.Parameters.AddWithValue("@hash", step.EntryHash());
                cmd.Parameters.AddWithValue("@report", found.Id);
                cmd.Parameters.AddWithValue("@kind", found.Kind);
                cmd.Parameters.AddWithValue("@item", found.Item);
                cmd.Parameters.AddWithValue("@at", found.At is null ? DBNull.Value : found.At.Value);
                cmd.Parameters.AddWithValue("@action", action);
                cmd.Parameters.AddWithValue("@signer", operatorRole.Value);
                cmd.Parameters.AddWithValue("@signedAt", signedAt);
                cmd.Parameters.AddWithValue("@sig", signature);
                cmd.Parameters.AddWithValue("@now", now);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            /* Und erst jetzt, in derselben Transaktion, die Wirkung. */
            var sameItem = "item_kind = @kind AND item_id = @item AND ((item_at IS NULL AND @at IS NULL) OR item_at = @at)";
            async Task Run(string sql, Guid? author = null)
            {
                await using var cmd = new SqlCommand(sql, connection, tx);
                cmd.Parameters.AddWithValue("@kind", found.Kind);
                cmd.Parameters.AddWithValue("@item", found.Item);
                cmd.Parameters.AddWithValue("@at", found.At is null ? DBNull.Value : found.At.Value);
                cmd.Parameters.AddWithValue("@report", found.Id);
                cmd.Parameters.AddWithValue("@reason", reason);
                cmd.Parameters.AddWithValue("@author", author is null ? DBNull.Value : author.Value);
                cmd.Parameters.AddWithValue("@now", now);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            switch (action)
            {
                case "block":
                {
                    if (blockedState is null)
                        await Run("""
                            INSERT INTO app.takedown (id, item_kind, item_id, item_at, state, report_id, reason_code, author_role_id, since)
                            VALUES (NEWID(), @kind, @item, @at, N'blocked', @report, @reason, @author, @now);
                            """, author);
                    await Run("UPDATE app.report SET state = N'blocked', decided_at = @now WHERE id = @report;");
                    await TouchAsync(connection, tx, found.Kind, found.Item, now, ctx.RequestAborted);
                    state = "blocked";
                    break;
                }
                case "restore":
                    await Run($"DELETE FROM app.takedown WHERE {sameItem};");
                    await Run($"UPDATE app.report SET state = N'restored', decided_at = @now WHERE {sameItem} AND state IN (N'blocked', N'objected');");
                    await TouchAsync(connection, tx, found.Kind, found.Item, now, ctx.RequestAborted);
                    state = "restored";
                    break;
                case "delete":
                    files = await DeleteForGoodAsync(connection, tx, config, found.Kind, found.Item, now, ctx.RequestAborted);
                    await Run($"UPDATE app.takedown SET state = N'deleted' WHERE {sameItem};");
                    await Run($"UPDATE app.report SET state = N'deleted', decided_at = @now WHERE {sameItem} AND state IN (N'blocked', N'objected');");
                    state = "deleted";
                    break;
                default:
                    await Run("UPDATE app.report SET state = N'rejected', decided_at = @now WHERE id = @report;");
                    state = "rejected";
                    break;
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }

        foreach (var file in files)
        {
            try { File.Delete(file); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }

        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), state, head = await HeadAsync(connection, null, ctx.RequestAborted) });
    }

    /* -- Was der Verfasser erfährt ---------------------------------------------------- */

    /// <summary>Was von dem, was meine Rollen geschrieben haben, nach einer Meldung gesperrt ist — und warum.</summary>
    private static async Task MineAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        await ctx.Response.WriteAsJsonAsync(new { takedowns = await AuthoredAsync(connection, mine, ctx.RequestAborted) });
    }

    internal static async Task<List<object>> AuthoredAsync(SqlConnection connection, IReadOnlyList<Guid> mine, CancellationToken ct)
    {
        var list = new List<object>();
        if (mine.Count == 0) return list;
        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT t.id, t.item_kind, t.item_id, t.state, t.reason_code, t.since, r.item_path, r.objected_at, r.id
            FROM app.takedown t JOIN app.report r ON r.id = t.report_id
            WHERE t.author_role_id IN ({names})
            ORDER BY t.since DESC;
            """, connection);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var since = reader.GetDateTimeOffset(5);
            list.Add(new
            {
                id = Ids.ToText(reader.GetGuid(0)),
                itemKind = reader.GetString(1),
                itemId = Ids.ToText(reader.GetGuid(2)),
                state = reader.GetString(3),
                reason = reader.GetString(4),
                since,
                path = reader.IsDBNull(6) ? null : reader.GetString(6),
                objectedAt = reader.IsDBNull(7) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(7),
                objectUntil = since + ObjectionPeriod,
                reportId = Ids.ToText(reader.GetGuid(8))
            });
        }
        return list;
    }

    public sealed record ObjectionRequest(string? Sealed, string? SealedKey);

    /// <summary>Der Verfasser widerspricht — versiegelt für den Betreiber, wie die Meldung.</summary>
    private static async Task ObjectAsync(HttpContext ctx, Db db, Guid id, ObjectionRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        byte[] sealedBlob, sealedKey;
        try { sealedBlob = Base64Url.Decode(body.Sealed ?? ""); sealedKey = Base64Url.Decode(body.SealedKey ?? ""); }
        catch (FormatException) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne odwołanie."); return; }
        if (sealedBlob.Length is 0 or > MaxSealed || sealedKey.Length is 0 or > 1024)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne odwołanie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToHashSet();

        Guid? author = null, report = null;
        string? state = null;
        await using (var cmd = new SqlCommand("SELECT author_role_id, report_id, state FROM app.takedown WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                author = reader.IsDBNull(0) ? null : reader.GetGuid(0);
                report = reader.GetGuid(1);
                state = reader.GetString(2);
            }
        }
        if (report is null || author is null || !mine.Contains(author.Value))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma takiej blokady.");
            return;
        }
        if (state != "blocked") { await Fail(ctx, StatusCodes.Status409Conflict, "Ta treść jest już usunięta."); return; }

        await using (var cmd = new SqlCommand("""
            UPDATE app.report SET objection = @sealed, objection_key = @key, objected_at = @now, state = N'objected'
            WHERE id = @report AND state IN (N'blocked', N'objected');
            """, connection))
        {
            cmd.Parameters.AddWithValue("@sealed", sealedBlob);
            cmd.Parameters.AddWithValue("@key", sealedKey);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@report", report.Value);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), objected = true });
    }

    /* -- Aufbewahrung --------------------------------------------------------------- */

    /// <summary>
    /// Ein halbes Jahr nach der Entscheidung gehen Grund, Kontakt und Widerspruch (versiegelt);
    /// was gemeldet und entschieden wurde, bleibt — und die Kette sowieso.
    /// </summary>
    internal static async Task SweepAsync(SqlConnection connection, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            UPDATE app.report SET sealed = NULL, sealed_key = NULL, objection = NULL, objection_key = NULL
            WHERE decided_at IS NOT NULL AND decided_at < @before AND (sealed IS NOT NULL OR objection IS NOT NULL)
              AND state IN (N'deleted', N'restored', N'rejected');
            """, connection);
        cmd.Parameters.AddWithValue("@before", DateTimeOffset.UtcNow - KeepSealed);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}

/// <summary>Einmal am Tag: was nach seiner Frist nicht mehr aufbewahrt wird.</summary>
internal sealed class ReportSweep(Db db, ILogger<ReportSweep> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var connection = await db.OpenAsync(stoppingToken);
                await Reports.SweepAsync(connection, stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogWarning(e, "Report sweep failed.");
            }
            try { await Task.Delay(TimeSpan.FromHours(24), stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }
}
