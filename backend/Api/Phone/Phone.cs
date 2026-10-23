using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DAS TELEFON (0114) — Kontakte und das Archiv der SMS, für die eigene
/// Ausgabe der App (der Build „sms", nur für ein Telefon gedacht), lesbar aber
/// auch im Browser.
///
/// <para>
/// <b>Der Dienst liest nichts davon.</b> Ein Kontakt ist EINE Hülle unter dem
/// Schlüssel eines Bereichs (gedacht: des eigenen), ein Stapel archivierter
/// Nachrichten ebenso, ein Bild aus einer MMS eine versiegelte Datei. Gesucht,
/// zugeordnet und angezeigt wird auf dem Telefon und im Browser.
/// </para>
///
/// <para>
/// <b>Kontakte gleichen ab</b> wie die Bibliothek: <c>updated_at</c> sagt, was
/// sich seit dem letzten Mal geändert hat (auch Grabsteine), <c>version</c>
/// verhindert, dass ein alter Stand einen neueren überschreibt. Das Telefon
/// legt sie in sein eigenes Adressbuch — so steht bei einem Anruf der Name da,
/// ohne dass jemand fragt.
/// </para>
/// </summary>
public static partial class Phone
{
    private const int MaxContactSealed = 256 * 1024;
    private const int MaxContacts = 20_000;
    private const int MaxContactBatch = 500;

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/phone/{areaId:guid}/contacts", ContactsAsync);
        app.MapPost("/workspace/phone/{areaId:guid}/contacts", SaveContactsAsync);
        app.MapPut("/workspace/phone/{areaId:guid}/contact/{id:guid}", SaveContactAsync);
        app.MapDelete("/workspace/phone/{areaId:guid}/contact/{id:guid}", RemoveContactAsync);

        MapSms(app);
        MapFiles(app);
        MapOutbox(app);
        MapShares(app);
        MapShareDevices(app);
        MapLamps(app);
    }

    /* -- Wer hier darf ------------------------------------------------------------------------ */

    /// <summary>
    /// Das Konto, wenn es in diesem Bereich darf, was es will — mit der jüngsten
    /// Epoche des Bereichs. Sonst steht die Antwort schon da (401, 404, 403).
    /// </summary>
    private static async Task<(Guid AccountId, int CurrentEpoch)?> AllowedAsync(
        HttpContext ctx, Db db, SqlConnection connection, Guid areaId, Capability needed)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return null; }

        int? epoch = null;
        await using (var cmd = new SqlCommand("SELECT current_epoch FROM app.area WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", areaId);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is int found) epoch = found;
        }

        if (epoch is null || !await Area.MayAsync(connection, who.Value.AccountId, areaId, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma takiego obszaru.");
            return null;
        }

        if (needed != Capability.Read && !await Area.MayAsync(connection, who.Value.AccountId, areaId, needed, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W tym obszarze możesz tylko czytać.");
            return null;
        }

        return (who.Value.AccountId, epoch.Value);
    }

    /* -- Kontakte ------------------------------------------------------------------------------ */

    /// <summary><c>Version</c>: der Stand, auf dem geändert wurde — 0 für einen neuen Kontakt.</summary>
    public sealed record ContactRequest(string? ContactId, int Epoch, string? Sealed, int Version);

    public sealed record ContactsRequest(IReadOnlyList<ContactRequest>? Contacts);

    /// <summary>Eine Kennung aus dem Text (23.4: klein, mit Bindestrichen) — oder nicht.</summary>
    public static bool IdOf(string? text, out Guid id)
    {
        id = Guid.Empty;
        if (text is null) return false;
        try { id = Ids.Parse(text); return true; } catch (FormatException) { return false; }
    }

    /// <summary>Eine Hülle eines Kontakts gelesen — oder warum nicht.</summary>
    public static bool SealedContact(string? text, out byte[] bytes) =>
        Base64Url.TryDecode(text, out bytes) && bytes.Length is >= 48 and <= MaxContactSealed;

    /// <summary>`since` gelesen — zwei Sekunden früher, damit Gleichzeitiges nicht durchfällt; leer: alles.</summary>
    public static bool SinceOf(string? since, out DateTimeOffset? from)
    {
        from = null;
        if (string.IsNullOrWhiteSpace(since)) return true;
        if (!DateTimeOffset.TryParse(since, out var parsed)) return false;
        from = parsed.AddSeconds(-2);
        return true;
    }

    /// <summary>
    /// ABGLEICH: alle Kontakte (ohne <c>since</c>) oder was sich seitdem geändert
    /// hat — dann mit Grabsteinen. <c>now</c> wird VOR dem Lesen genommen.
    /// </summary>
    private static async Task ContactsAsync(HttpContext ctx, Db db, Guid areaId, string? since)
    {
        if (!SinceOf(since, out var from)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan."); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Read) is null) return;

        var now = DateTimeOffset.UtcNow;
        await using var cmd = new SqlCommand($"""
            SELECT id, epoch, sealed, version, updated_at, deleted_at
            FROM app.phone_contact
            WHERE area_id = @area AND {(from is null ? "deleted_at IS NULL" : "updated_at >= @since")}
            ORDER BY updated_at;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        if (from is not null) cmd.Parameters.AddWithValue("@since", from.Value);

        var contacts = new List<object>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                contacts.Add(new
                {
                    contactId = Ids.ToText(reader.GetGuid(0)),
                    epoch = reader.GetInt32(1),
                    @sealed = reader.IsDBNull(2) ? null : Base64Url.Encode((byte[])reader[2]),
                    version = reader.GetInt32(3),
                    updatedAt = reader.GetDateTimeOffset(4),
                    deletedAt = reader.IsDBNull(5) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(5)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { now, contacts });
    }

    /// <summary>Wie ein Speichern ausging — für einen und für viele dieselbe Rechnung.</summary>
    private enum Saved { Done, Stale, Foreign, Full }

    private static async Task<(Saved Outcome, int Version, DateTimeOffset At)> StoreContactAsync(
        SqlConnection connection, SqlTransaction tx, Guid areaId, Guid id, int epoch, byte[] sealedBytes, int version, CancellationToken ct)
    {
        (Guid Area, int Version)? had = null;
        await using (var read = new SqlCommand(
            "SELECT area_id, version FROM app.phone_contact WITH (UPDLOCK, HOLDLOCK) WHERE id = @id;", connection, tx))
        {
            read.Parameters.AddWithValue("@id", id);
            await using var reader = await read.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct)) had = (reader.GetGuid(0), reader.GetInt32(1));
        }

        if (had is not null && had.Value.Area != areaId) return (Saved.Foreign, 0, default);
        if ((had?.Version ?? 0) != version) return (Saved.Stale, had?.Version ?? 0, default);

        if (had is null)
        {
            await using var count = new SqlCommand("SELECT COUNT(*) FROM app.phone_contact WHERE area_id = @area;", connection, tx);
            count.Parameters.AddWithValue("@area", areaId);
            if ((int)(await count.ExecuteScalarAsync(ct))! >= MaxContacts) return (Saved.Full, 0, default);
        }

        var now = DateTimeOffset.UtcNow;
        await using (var save = new SqlCommand(had is null
            ? """
              INSERT INTO app.phone_contact (id, area_id, epoch, sealed, version, created_at, updated_at)
              VALUES (@id, @area, @epoch, @sealed, 1, @now, @now);
              """
            : """
              UPDATE app.phone_contact
                 SET epoch = @epoch, sealed = @sealed, version = version + 1, updated_at = @now, deleted_at = NULL
               WHERE id = @id;
              """, connection, tx))
        {
            save.Parameters.AddWithValue("@id", id);
            save.Parameters.AddWithValue("@area", areaId);
            save.Parameters.AddWithValue("@epoch", epoch);
            save.Parameters.AddBlob("@sealed", sealedBytes);
            save.Parameters.AddWithValue("@now", now);
            await save.ExecuteNonQueryAsync(ct);
        }

        return (Saved.Done, version + 1, now);
    }

    /// <summary>
    /// Einen Kontakt speichern. Ist er inzwischen woanders geändert worden, kommt
    /// 409 mit dem Stand, der jetzt gilt — der Browser holt ihn, statt still zu
    /// überschreiben.
    /// </summary>
    private static async Task SaveContactAsync(HttpContext ctx, Db db, Guid areaId, Guid id, ContactRequest body)
    {
        if (!SealedContact(body.Sealed, out var sealedBytes))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zapieczętowany kontakt musi mieć najwyżej 256 KB.");
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
        var (outcome, version, at) = await StoreContactAsync(connection, tx, areaId, id, body.Epoch, sealedBytes, body.Version, ctx.RequestAborted);
        switch (outcome)
        {
            case Saved.Foreign:
                await Fail(ctx, StatusCodes.Status409Conflict, "Ten kontakt należy do innego obszaru.");
                return;
            case Saved.Full:
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Obszar ma już {MaxContacts} kontaktów.");
                return;
            case Saved.Stale:
                ctx.Response.StatusCode = StatusCodes.Status409Conflict;
                await ctx.Response.WriteAsJsonAsync(new { error = "Ktoś zmienił ten kontakt w międzyczasie — wczytaj nowszą wersję.", verdict = "stale", version });
                return;
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { contactId = Ids.ToText(id), version, updatedAt = at });
    }

    /// <summary>
    /// VIELE AUF EINMAL — das Einlesen aus dem Telefon oder einer vCard. Jeder
    /// Kontakt für sich: einer mit altem Stand hält die anderen nicht auf, er
    /// steht in der Antwort mit dem Grund.
    /// </summary>
    private static async Task SaveContactsAsync(HttpContext ctx, Db db, Guid areaId, ContactsRequest body)
    {
        var list = body.Contacts ?? [];
        if (list.Count is < 1 or > MaxContactBatch)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Od 1 do {MaxContactBatch} kontaktów naraz.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var allowed = await AllowedAsync(ctx, db, connection, areaId, Capability.Write);
        if (allowed is null) return;

        var results = new List<object>();
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        foreach (var one in list)
        {
            if (!IdOf(one.ContactId, out var id))
            {
                results.Add(new { contactId = one.ContactId, error = "Nieczytelny identyfikator." });
                continue;
            }
            if (!SealedContact(one.Sealed, out var sealedBytes) || one.Epoch < 1 || one.Epoch > allowed.Value.CurrentEpoch)
            {
                results.Add(new { contactId = Ids.ToText(id), error = "Nieczytelny kontakt." });
                continue;
            }

            var (outcome, version, at) = await StoreContactAsync(connection, tx, areaId, id, one.Epoch, sealedBytes, one.Version, ctx.RequestAborted);
            results.Add(outcome switch
            {
                Saved.Done => new { contactId = Ids.ToText(id), version, updatedAt = (DateTimeOffset?)at, error = (string?)null },
                Saved.Stale => new { contactId = Ids.ToText(id), version, updatedAt = (DateTimeOffset?)null, error = (string?)"stale" },
                Saved.Full => new { contactId = Ids.ToText(id), version = 0, updatedAt = (DateTimeOffset?)null, error = (string?)$"Obszar ma już {MaxContacts} kontaktów." },
                _ => new { contactId = Ids.ToText(id), version = 0, updatedAt = (DateTimeOffset?)null, error = (string?)"Ten kontakt należy do innego obszaru." }
            });
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { results });
    }

    /// <summary>Löschen: der Kontakt wird zum Grabstein — damit das Telefon ihn beim Abgleich auch löscht.</summary>
    private static async Task RemoveContactAsync(HttpContext ctx, Db db, Guid areaId, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Write) is null) return;

        await using var cmd = new SqlCommand("""
            UPDATE app.phone_contact
               SET sealed = NULL, deleted_at = SYSDATETIMEOFFSET(), updated_at = SYSDATETIMEOFFSET(), version = version + 1
             WHERE id = @id AND area_id = @area AND deleted_at IS NULL;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@area", areaId);
        var changed = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { contactId = Ids.ToText(id), deleted = changed > 0 });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
