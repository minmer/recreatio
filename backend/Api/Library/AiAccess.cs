using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DOSTĘP DLA AI (0126, 2026-10-24) — ein ausdrücklicher Link, über den ein
/// Assistent (ChatGPT, Claude …) die drei Teile EINES Bereichs liest: die
/// Bibliothek (Quellen), das Skryptorium (Texte) und die Bazy wiedzy (Cogita).
/// Nur lesen — es gibt keinen Weg, über ihn etwas zu ändern —, und nichts
/// ausser diesen Behältern: keine Rozmowy, keine Formulare, keine Kalender.
///
/// <para>
/// <b>Warum Abschriften.</b> Ein Assistent kann keine Hülle öffnen; er ruft
/// Adressen auf und liest JSON. Also baut der Browser dessen, der den Bereich
/// prowadzi (später jedes, der dort schreibt), je Behälter eine lesbare
/// Abschrift und versiegelt sie unter einem eigenen Zufallsschlüssel C. Der
/// Dienst hält C nur verpackt unter einem Schlüssel aus dem Geheimnis im Link
/// (<see cref="Crypto.InfoAiAccess"/>) — das Geheimnis selbst speichert er
/// nicht. Geöffnet wird eine Abschrift also nur, solange eine Anfrage den Link
/// trägt (<c>AiAccess.Read.cs</c>): die eine, ausdrückliche Ausnahme von
/// „der Dienst öffnet nichts". Kein Bereichsschlüssel verlässt je den Browser.
/// </para>
///
/// <para>
/// <b>Wer was darf.</b> Anlegen, verlängern, Behälter ändern, löschen: wer
/// den Bereich prowadzi. Auffrischen: wer dort schreibt (er hält C unter dem
/// Schlüssel des Bereichs). Sehen, DASS es einen Link gibt: jedes Mitglied —
/// wer liest, soll wissen, dass ein Assistent mitliest. Der Link gilt nur,
/// solange sein Urheber den Bereich prowadzi.
/// </para>
/// </summary>
public static partial class AiAccess
{
    private const int MaxPerArea = 10;
    private const int MaxParts = 20;
    private const int MaxEnvelope = 400;
    private const long MaxSnapshot = 32L * 1024 * 1024;

    /// <summary>Wie lange ein Link gilt — wählbar beim Anlegen und Verlängern.</summary>
    public static readonly int[] DayChoices = [7, 30, 90, 365];

    /// <summary>Angelegt, aber nie fertig geworden (der Browser brach ab): nach einer Stunde fort.</summary>
    private static readonly TimeSpan PendingFor = TimeSpan.FromHours(1);

    /// <summary>Abgelaufen bleibt er noch so lange stehen (verlängerbar), dann ist er fort.</summary>
    private static readonly TimeSpan KeptAfterExpiry = TimeSpan.FromDays(30);

    public static void Map(WebApplication app)
    {
        /* Im Bereich: sehen, anlegen (zwei Schritte), ändern, löschen, auffrischen. */
        app.MapGet("/workspace/area/{areaId:guid}/ai-access", ListAsync);
        app.MapPost("/workspace/area/{areaId:guid}/ai-access", CreateAsync);
        app.MapPut("/workspace/area/{areaId:guid}/ai-access/{id:guid}/key", FinishAsync);
        app.MapPost("/workspace/area/{areaId:guid}/ai-access/{id:guid}", ChangeAsync);
        app.MapDelete("/workspace/area/{areaId:guid}/ai-access/{id:guid}", DeleteAsync);
        app.MapPut("/workspace/area/{areaId:guid}/ai-access/{id:guid}/part/{libraryId:guid}", UploadAsync);

        /* Der Assistent — mit dem Link statt einer Sitzung, nur GET (AiAccess.Read.cs). */
        MapRead(app);
    }

    /// <param name="WholeArea">2026-10-24 (0128) — der Link zeigt alle Behälter des Bereichs, auch spätere.</param>
    public sealed record CreateRequest(string? Id, string[]? Libraries, int Days, bool? WholeArea = null);
    public sealed record FinishRequest(string? Token, int Epoch, string? KeySealed, string? TokenSealed, string? KeyWrapped);
    public sealed record ChangeRequest(int? Days, string[]? Libraries, bool? WholeArea = null);

    /* -- 2026-10-24 (0128): ein Link, der seinem Bereich folgt ------------------------------------------ */

    /// <summary>Gibt es die Spalte schon? (Ein Dienst vor der Migration 0128 arbeitet ohne sie, wie bisher.)</summary>
    internal static async Task<bool> HasWholeAreaAsync(SqlConnection connection, SqlTransaction? tx, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT CASE WHEN COL_LENGTH('app.ai_access', 'whole_area') IS NULL THEN 0 ELSE 1 END;", connection, tx);
        return (int)(await cmd.ExecuteScalarAsync(ct) ?? 0) == 1;
    }

    /// <summary>
    /// DIE LINKS, DIE IHREM BEREICH FOLGEN, BEKOMMEN SEINE NEUEN BEHÄLTER — als Teil ohne
    /// Abschrift (die baut der nächste Browser, der dort schreibt; bis dahin sagt der Link,
    /// dass sie noch fehlt). Aufgerufen, wenn ein Behälter angelegt wird, beim Auflisten
    /// und beim Lesen: so fehlt nichts, auch was vor dieser Regel entstand. Höchstens
    /// <see cref="MaxParts"/> Behälter je Link.
    /// </summary>
    internal static async Task FollowAreaAsync(SqlConnection connection, SqlTransaction? tx, Guid areaId, CancellationToken ct)
    {
        if (!await HasWholeAreaAsync(connection, tx, ct)) return;
        await using var cmd = new SqlCommand($"""
            INSERT INTO app.ai_access_part (access_id, library_id)
            SELECT a.id, l.id
            FROM app.ai_access a
            JOIN app.library l ON l.area_id = a.area_id AND l.kind IN (N'books', N'writing', N'knowledge')
            WHERE a.area_id = @area AND a.whole_area = 1
              AND NOT EXISTS (SELECT 1 FROM app.ai_access_part p WHERE p.access_id = a.id AND p.library_id = l.id)
              AND (SELECT COUNT(*) FROM app.ai_access_part c WHERE c.access_id = a.id) < {MaxParts};
            """, connection, tx);
        cmd.Parameters.AddWithValue("@area", areaId);
        try
        {
            await cmd.ExecuteNonQueryAsync(ct);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            /* Zwei Anfragen zugleich: die andere hat ihn schon dazugenommen. */
        }
    }

    /// <summary>Alle Behälter des Bereichs (für einen Link, der ihm folgt).</summary>
    private static async Task<List<Guid>> AreaLibrariesAsync(SqlConnection connection, SqlTransaction? tx, Guid areaId, CancellationToken ct)
    {
        var out_ = new List<Guid>();
        await using var cmd = new SqlCommand($"""
            SELECT TOP ({MaxParts}) id FROM app.library WHERE area_id = @area AND kind IN (N'books', N'writing', N'knowledge') ORDER BY created_at;
            """, connection, tx);
        cmd.Parameters.AddWithValue("@area", areaId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) out_.Add(reader.GetGuid(0));
        return out_;
    }

    /* -- Was hereinkommt ------------------------------------------------------------------------ */

    /// <summary>
    /// Das Geheimnis eines Links, wie <see cref="Token.NewSecret"/> es würfelt — base64url,
    /// 16 bis 128 Zeichen; sonst <c>null</c>.
    /// </summary>
    public static string? TokenOf(string? text)
    {
        var secret = text?.Trim();
        if (secret is null || secret.Length is < 16 or > 128) return null;
        foreach (var c in secret)
            if (!char.IsAsciiLetterOrDigit(c) && c is not '-' and not '_') return null;
        return secret;
    }

    /// <summary>Eine versiegelte Hülle für einen Schlüssel oder das Geheimnis: 48 bis 400 Bytes.</summary>
    public static bool EnvelopeOf(string? text, out byte[] bytes) =>
        Base64Url.TryDecode(text, out bytes) && bytes.Length is >= 48 and <= MaxEnvelope;

    private static readonly Regex MarkPattern = new("^[0-9A-Za-z:.+\\-]{1,120}$", RegexOptions.CultureInvariant);

    /// <summary>Der Stand eines Behälters (<see cref="MarkSql"/>), so wie der Browser ihn zurückgibt.</summary>
    public static bool IsMark(string? mark) => mark is not null && MarkPattern.IsMatch(mark);

    /// <summary>Die Behälter einer Anfrage: Kennungen, jede einmal, 1 bis 20.</summary>
    public static List<Guid>? LibrariesOf(string[]? ids)
    {
        if (ids is null || ids.Length is 0 or > MaxParts) return null;
        var out_ = new List<Guid>();
        foreach (var one in ids)
        {
            if (!Guid.TryParse(one, out var id) || id == Guid.Empty) return null;
            if (!out_.Contains(id)) out_.Add(id);
        }
        return out_;
    }

    /* -- Schlüssel und Etiketten (dieselben wie im Browser, aiAccess/aiAccess.ts) ------------- */

    /// <summary>C unter dem Schlüssel aus dem Link.</summary>
    public static Aad WrapAad(Guid accessId) => Aad.Create("ai", "access", accessId, Field.AiAccessWrap, 1);

    /// <summary>Eine Abschrift eines Behälters unter C.</summary>
    public static Aad SnapshotAad(Guid libraryId) => Aad.Create("ai", "snapshot", libraryId, Field.AiSnapshot, 1);

    /// <summary>Der Schlüssel aus dem Link: HKDF über die UTF-8-Bytes des Geheimnisses, gebunden an den Zugang.</summary>
    public static byte[] LinkKey(string token, Guid accessId) =>
        Crypto.Derive(Encoding.UTF8.GetBytes(token), Crypto.InfoAiAccess(accessId), Crypto.KeySize);

    /// <summary>
    /// DER STAND EINES BEHÄLTERS, wie ihn der Dienst ohne Schlüssel sieht: wie
    /// viele Einträge, welche in welcher Fassung (eine Prüfsumme über Kennung
    /// und <c>version</c>), wann zuletzt einer geändert wurde, wann der
    /// Behälter selbst (sein Name). Weicht er von dem ab, aus dem die
    /// Abschrift gebaut wurde, ist sie alt.
    /// </summary>
    private const string MarkSql = """
        CONCAT(
          (SELECT COUNT_BIG(*) FROM app.library_entry e WHERE e.library_id = l.id AND e.deleted_at IS NULL), '.',
          (SELECT ISNULL(CHECKSUM_AGG(CHECKSUM(e.id, e.version)), 0) FROM app.library_entry e WHERE e.library_id = l.id AND e.deleted_at IS NULL), '.',
          (SELECT ISNULL(CONVERT(varchar(40), MAX(e.updated_at), 127), '-') FROM app.library_entry e WHERE e.library_id = l.id), '.',
          CONVERT(varchar(40), l.updated_at, 127))
        """;

    /* -- Wer hier was darf -------------------------------------------------------------------- */

    private readonly record struct Allowed(Guid AccountId, int CurrentEpoch, bool Writes, bool Leads);

    private static async Task<Allowed?> AllowedAsync(HttpContext ctx, Db db, SqlConnection connection, Guid areaId, Capability needed)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return null; }

        int? epoch = null;
        await using (var cmd = new SqlCommand("SELECT current_epoch FROM app.area WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", areaId);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is int found) epoch = found;
        }

        var account = who.Value.AccountId;
        if (epoch is null || !await Area.MayAsync(connection, account, areaId, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma takiego obszaru.");
            return null;
        }

        var writes = await Area.MayAsync(connection, account, areaId, Capability.Write, ctx.RequestAborted);
        var leads = writes && await Area.MayAsync(connection, account, areaId, Capability.Admin, ctx.RequestAborted);
        if (needed == Capability.Write && !writes)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W tym obszarze możesz tylko czytać.");
            return null;
        }
        if (needed == Capability.Admin && !leads)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Dostęp dla AI zakłada i zmienia tylko ten, kto prowadzi obszar.");
            return null;
        }
        return new Allowed(account, epoch.Value, writes, leads);
    }

    /// <summary>Was nie fertig wurde und was lange abgelaufen ist — fort, bevor gezählt oder gezeigt wird.</summary>
    private static async Task TidyAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            DELETE FROM app.ai_access
             WHERE area_id = @area
               AND ((key_wrapped IS NULL AND created_at < @pending) OR expires_at < @gone);
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@pending", DateTimeOffset.UtcNow - PendingFor);
        cmd.Parameters.AddWithValue("@gone", DateTimeOffset.UtcNow - KeptAfterExpiry);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Gehören alle diese Behälter dem Bereich? (Jede Art ist einer der drei Teile.)</summary>
    private static async Task<bool> OwnLibrariesAsync(SqlConnection connection, SqlTransaction? tx, Guid areaId, List<Guid> ids, CancellationToken ct)
    {
        var names = string.Join(", ", ids.Select((_, i) => $"@l{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT COUNT(*) FROM app.library WHERE area_id = @area AND kind IN (N'books', N'writing', N'knowledge') AND id IN ({names});
            """, connection, tx);
        cmd.Parameters.AddWithValue("@area", areaId);
        for (var i = 0; i < ids.Count; i++) cmd.Parameters.AddWithValue($"@l{i}", ids[i]);
        return (int)(await cmd.ExecuteScalarAsync(ct))! == ids.Count;
    }

    /* -- Sehen ---------------------------------------------------------------------------------- */

    /// <summary>
    /// Die Links eines Bereichs — für jedes Mitglied (es soll wissen, dass ein
    /// Assistent mitliest). Den Schlüssel der Abschriften bekommt nur, wer
    /// schreibt (zum Auffrischen); das versiegelte Geheimnis nur, wer prowadzi.
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db, Guid areaId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var allowed = await AllowedAsync(ctx, db, connection, areaId, Capability.Read);
        if (allowed is null) return;
        await TidyAsync(connection, areaId, ctx.RequestAborted);
        /* 2026-10-24 (0128) — was inzwischen in den Bereich kam, gehört zu den Links, die ihm folgen. */
        await FollowAreaAsync(connection, null, areaId, ctx.RequestAborted);
        var hasWhole = await HasWholeAreaAsync(connection, null, ctx.RequestAborted);

        var rows = new List<(Guid Id, Guid Creator, int? Epoch, byte[]? KeySealed, byte[]? TokenSealed, bool Ready, DateTimeOffset Created, DateTimeOffset Expires, DateTimeOffset? Used, int Uses, bool Whole)>();
        await using (var cmd = new SqlCommand($"""
            SELECT id, account_id, epoch, key_sealed, token_sealed, CAST(CASE WHEN key_wrapped IS NULL THEN 0 ELSE 1 END AS bit),
                   created_at, expires_at, last_used_at, uses, {(hasWhole ? "whole_area" : "CAST(0 AS bit)")}
            FROM app.ai_access WHERE area_id = @area ORDER BY created_at DESC, id;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", areaId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((reader.GetGuid(0), reader.GetGuid(1), reader.IsDBNull(2) ? null : reader.GetInt32(2),
                    reader.IsDBNull(3) ? null : (byte[])reader[3], reader.IsDBNull(4) ? null : (byte[])reader[4], reader.GetBoolean(5),
                    reader.GetDateTimeOffset(6), reader.GetDateTimeOffset(7), reader.IsDBNull(8) ? null : reader.GetDateTimeOffset(8), reader.GetInt32(9), reader.GetBoolean(10)));
            }
        }

        var parts = new List<(Guid Access, Guid Library, string Kind, string? Made, DateTimeOffset? MadeAt, int? Entries, long? Bytes, string Mark)>();
        if (rows.Count > 0)
        {
            await using var cmd = new SqlCommand($"""
                SELECT p.access_id, p.library_id, l.kind, p.mark, p.made_at, p.entries, DATALENGTH(p.snapshot), {MarkSql}
                FROM app.ai_access_part p
                JOIN app.ai_access a ON a.id = p.access_id
                JOIN app.library l ON l.id = p.library_id
                WHERE a.area_id = @area
                ORDER BY CASE l.kind WHEN N'books' THEN 0 WHEN N'writing' THEN 1 ELSE 2 END, l.created_at;
                """, connection);
            cmd.Parameters.AddWithValue("@area", areaId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                parts.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.IsDBNull(3) ? null : reader.GetString(3),
                    reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4), reader.IsDBNull(5) ? null : reader.GetInt32(5),
                    reader.IsDBNull(6) ? null : Convert.ToInt64(reader.GetValue(6)), reader.GetString(7)));
            }
        }

        /* Gilt der Link noch? Nur, solange sein Urheber den Bereich prowadzi. */
        var leading = new Dictionary<Guid, bool>();
        foreach (var creator in rows.Select(r => r.Creator).Distinct())
            leading[creator] = await Area.MayAsync(connection, creator, areaId, Capability.Admin, ctx.RequestAborted);

        var now = DateTimeOffset.UtcNow;
        ctx.Response.Headers.CacheControl = "no-store";
        await ctx.Response.WriteAsJsonAsync(new
        {
            accesses = rows.Select(r => new
            {
                id = Ids.ToText(r.Id),
                createdAt = r.Created,
                expiresAt = r.Expires,
                lastUsedAt = r.Used,
                uses = r.Uses,
                ready = r.Ready,
                expired = r.Expires <= now,
                mine = r.Creator == allowed.Value.AccountId,
                creatorLeads = leading[r.Creator],
                works = r.Ready && r.Expires > now && leading[r.Creator],
                wholeArea = r.Whole,
                epoch = r.Epoch,
                keySealed = allowed.Value.Writes && r.KeySealed is not null ? Base64Url.Encode(r.KeySealed) : null,
                tokenSealed = allowed.Value.Leads && r.TokenSealed is not null ? Base64Url.Encode(r.TokenSealed) : null,
                parts = parts.Where(p => p.Access == r.Id).Select(p => new
                {
                    libraryId = Ids.ToText(p.Library),
                    kind = p.Kind,
                    mark = p.Mark,
                    madeFrom = p.Made,
                    madeAt = p.MadeAt,
                    entries = p.Entries,
                    bytes = p.Bytes,
                    fresh = p.Made is not null && p.Made == p.Mark
                })
            }),
            writes = allowed.Value.Writes,
            leads = allowed.Value.Leads,
            limit = MaxPerArea,
            days = DayChoices
        });
    }

    /* -- Anlegen: zwei Schritte ----------------------------------------------------------------- */

    /// <summary>
    /// ERSTER SCHRITT — Kennung und Behälter vom Browser, das Geheimnis vom
    /// Dienst (<see cref="Token.NewSecret"/>): es geht nur hier hinaus, als
    /// Antwort; gespeichert wird sein Hash. Bis zum zweiten Schritt gilt der
    /// Link nicht (es gibt noch nichts, was er öffnen könnte).
    /// </summary>
    private static async Task CreateAsync(HttpContext ctx, Db db, Guid areaId, CreateRequest body)
    {
        if (!Guid.TryParse(body.Id, out var id) || id == Guid.Empty)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung dostępu.");
            return;
        }
        var whole = body.WholeArea == true;
        var libraries = LibrariesOf(body.Libraries);
        if (libraries is null && !whole)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Wybierz od 1 do {MaxParts} zbiorów tego obszaru.");
            return;
        }
        if (!DayChoices.Contains(body.Days))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Link może działać 7, 30, 90 albo 365 dni.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var allowed = await AllowedAsync(ctx, db, connection, areaId, Capability.Admin);
        if (allowed is null) return;
        await TidyAsync(connection, areaId, ctx.RequestAborted);

        var secret = Token.NewSecret();
        var now = DateTimeOffset.UtcNow;
        var expires = now.AddDays(body.Days);
        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted))
        {
            /* 2026-10-24 (0128) — ein Link für den ganzen Bereich: seine Behälter jetzt, und später die neuen. */
            var follows = whole && await HasWholeAreaAsync(connection, tx, ctx.RequestAborted);
            if (whole) libraries = await AreaLibrariesAsync(connection, tx, areaId, ctx.RequestAborted);
            if (libraries is null || libraries.Count == 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Ten obszar nie ma jeszcze biblioteki, skryptorium ani bazy wiedzy.");
                return;
            }
            if (!await OwnLibrariesAsync(connection, tx, areaId, libraries, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Można wybrać tylko bibliotekę, skryptorium i bazy wiedzy tego obszaru.");
                return;
            }

            await using (var check = new SqlCommand("""
                SELECT COUNT(*) FROM app.ai_access WITH (UPDLOCK, HOLDLOCK) WHERE area_id = @area AND expires_at > @now;
                SELECT COUNT(*) FROM app.ai_access WHERE id = @id;
                """, connection, tx))
            {
                check.Parameters.AddWithValue("@area", areaId);
                check.Parameters.AddWithValue("@now", now);
                check.Parameters.AddWithValue("@id", id);
                await using var reader = await check.ExecuteReaderAsync(ctx.RequestAborted);
                var held = await reader.ReadAsync(ctx.RequestAborted) ? reader.GetInt32(0) : 0;
                await reader.NextResultAsync(ctx.RequestAborted);
                var taken = await reader.ReadAsync(ctx.RequestAborted) && reader.GetInt32(0) > 0;
                await reader.CloseAsync();
                if (taken)
                {
                    await Fail(ctx, StatusCodes.Status409Conflict, "Taki dostęp już istnieje.");
                    return;
                }
                if (held >= MaxPerArea)
                {
                    await Fail(ctx, StatusCodes.Status409Conflict, $"Ten obszar ma już {MaxPerArea} linków dla AI — najpierw usuń któryś.");
                    return;
                }
            }

            await using (var insert = new SqlCommand(follows ? """
                INSERT INTO app.ai_access (id, area_id, account_id, token_sha256, created_at, expires_at, whole_area)
                VALUES (@id, @area, @account, @hash, @now, @expires, 1);
                """ : """
                INSERT INTO app.ai_access (id, area_id, account_id, token_sha256, created_at, expires_at)
                VALUES (@id, @area, @account, @hash, @now, @expires);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", id);
                insert.Parameters.AddWithValue("@area", areaId);
                insert.Parameters.AddWithValue("@account", allowed.Value.AccountId);
                insert.Parameters.Add("@hash", SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.AddWithValue("@expires", expires);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
            await AddPartsAsync(connection, tx, id, libraries, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }

        ctx.Response.Headers.CacheControl = "no-store";
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), token = secret, createdAt = now, expiresAt = expires });
    }

    private static async Task AddPartsAsync(SqlConnection connection, SqlTransaction tx, Guid accessId, IEnumerable<Guid> libraries, CancellationToken ct)
    {
        foreach (var library in libraries)
        {
            await using var part = new SqlCommand("""
                IF NOT EXISTS (SELECT 1 FROM app.ai_access_part WHERE access_id = @access AND library_id = @library)
                    INSERT INTO app.ai_access_part (access_id, library_id) VALUES (@access, @library);
                """, connection, tx);
            part.Parameters.AddWithValue("@access", accessId);
            part.Parameters.AddWithValue("@library", library);
            await part.ExecuteNonQueryAsync(ct);
        }
    }

    /// <summary>
    /// ZWEITER SCHRITT — der Browser bringt C dreifach: unter dem Schlüssel des
    /// Bereichs, verpackt unter dem Schlüssel aus dem Link, und dazu das
    /// Geheimnis unter dem Schlüssel des Bereichs. Der Dienst prüft das
    /// Geheimnis gegen den Hash und öffnet die Verpackung EINMAL zur Probe —
    /// geht sie nicht auf, würde der Link nie antworten. Behalten wird davon
    /// nur die Kennung von C (21.5), gegen die jede Abschrift geprüft wird.
    /// </summary>
    private static async Task FinishAsync(HttpContext ctx, Db db, Guid areaId, Guid id, FinishRequest body)
    {
        var token = TokenOf(body.Token);
        if (token is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny link.");
            return;
        }
        if (!EnvelopeOf(body.KeySealed, out var keySealed) || !EnvelopeOf(body.TokenSealed, out var tokenSealed) || !EnvelopeOf(body.KeyWrapped, out var keyWrapped))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brak zapieczętowanego klucza dostępu.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var allowed = await AllowedAsync(ctx, db, connection, areaId, Capability.Admin);
        if (allowed is null) return;
        if (body.Epoch < 1 || body.Epoch > allowed.Value.CurrentEpoch)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
            return;
        }

        byte[]? hash = null;
        var ready = false;
        var created = DateTimeOffset.MinValue;
        await using (var cmd = new SqlCommand("""
            SELECT token_sha256, CAST(CASE WHEN key_wrapped IS NULL THEN 0 ELSE 1 END AS bit), created_at
            FROM app.ai_access WHERE id = @id AND area_id = @area;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@area", areaId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                hash = (byte[])reader[0];
                ready = reader.GetBoolean(1);
                created = reader.GetDateTimeOffset(2);
            }
        }

        if (hash is null || !CryptographicOperations.FixedTimeEquals(hash, Token.HashSecret(token)))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma takiego dostępu.");
            return;
        }
        if (ready)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten dostęp jest już gotowy.");
            return;
        }
        if (created < DateTimeOffset.UtcNow - PendingFor)
        {
            await Fail(ctx, StatusCodes.Status410Gone, "Za późno — utwórz link jeszcze raz.");
            return;
        }

        /* Zur Probe öffnen; behalten wird nur die Kennung des Schlüssels. */
        byte[] keyId;
        var linkKey = LinkKey(token, id);
        byte[]? key = null;
        try
        {
            key = Crypto.Open(linkKey, WrapAad(id), keyWrapped);
            if (key.Length != Crypto.KeySize) throw new DecryptException(DecryptError.Malformed, "Kein Schlüssel.");
            keyId = Crypto.KeyId(key);
        }
        catch (DecryptException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Klucz nie pasuje do linku — utwórz link jeszcze raz.");
            return;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(linkKey);
            if (key is not null) CryptographicOperations.ZeroMemory(key);
        }

        /* Die beiden Hüllen unter dem Bereichsschlüssel öffnet der Dienst nicht — er prüft nur, dass es Hüllen sind. */
        if (!IsSealed(keySealed) || !IsSealed(tokenSealed))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brak zapieczętowanego klucza dostępu.");
            return;
        }

        await using (var update = new SqlCommand("""
            UPDATE app.ai_access
               SET epoch = @epoch, key_sealed = @keySealed, token_sealed = @tokenSealed, key_wrapped = @keyWrapped, key_id = @keyId
             WHERE id = @id AND area_id = @area AND key_wrapped IS NULL;
            """, connection))
        {
            update.Parameters.AddWithValue("@id", id);
            update.Parameters.AddWithValue("@area", areaId);
            update.Parameters.AddWithValue("@epoch", body.Epoch);
            update.Parameters.Add("@keySealed", SqlDbType.VarBinary, MaxEnvelope).Value = keySealed;
            update.Parameters.Add("@tokenSealed", SqlDbType.VarBinary, MaxEnvelope).Value = tokenSealed;
            update.Parameters.Add("@keyWrapped", SqlDbType.VarBinary, MaxEnvelope).Value = keyWrapped;
            update.Parameters.Add("@keyId", SqlDbType.VarBinary, 16).Value = keyId;
            if (await update.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Ten dostęp jest już gotowy.");
                return;
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), ready = true });
    }

    /// <summary>Eine symmetrische Hülle (21.3) — Kopf, Nonce, Tag; geöffnet wird sie hier nicht.</summary>
    public static bool IsSealed(byte[] blob)
    {
        try
        {
            return Crypto.ReadHeader(blob).Alg == Alg.AesGcm256 && blob.Length >= Crypto.HeaderSize + Crypto.NonceSize + Crypto.TagSize;
        }
        catch (DecryptException)
        {
            return false;
        }
    }

    /* -- Ändern und löschen --------------------------------------------------------------------- */

    /// <summary>Verlängern (ab heute) und die Behälter ändern — neue stehen leer da, bis der Browser sie abschreibt.</summary>
    private static async Task ChangeAsync(HttpContext ctx, Db db, Guid areaId, Guid id, ChangeRequest body)
    {
        if (body.Days is int days && !DayChoices.Contains(days))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Link może działać 7, 30, 90 albo 365 dni.");
            return;
        }
        List<Guid>? libraries = null;
        if (body.Libraries is not null && (libraries = LibrariesOf(body.Libraries)) is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Wybierz od 1 do {MaxParts} zbiorów tego obszaru.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Admin) is null) return;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        await using (var exists = new SqlCommand("SELECT COUNT(*) FROM app.ai_access WITH (UPDLOCK) WHERE id = @id AND area_id = @area;", connection, tx))
        {
            exists.Parameters.AddWithValue("@id", id);
            exists.Parameters.AddWithValue("@area", areaId);
            if ((int)(await exists.ExecuteScalarAsync(ctx.RequestAborted))! == 0)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma takiego dostępu.");
                return;
            }
        }

        var expires = (DateTimeOffset?)null;
        if (body.Days is int add)
        {
            expires = DateTimeOffset.UtcNow.AddDays(add);
            await using var extend = new SqlCommand("UPDATE app.ai_access SET expires_at = @expires WHERE id = @id;", connection, tx);
            extend.Parameters.AddWithValue("@id", id);
            extend.Parameters.AddWithValue("@expires", expires.Value);
            await extend.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        /* 2026-10-24 (0128) — dem Bereich folgen (dann entscheidet er, nicht die Auswahl) oder nicht mehr. */
        if (body.WholeArea is bool follow && await HasWholeAreaAsync(connection, tx, ctx.RequestAborted))
        {
            await using var flag = new SqlCommand("UPDATE app.ai_access SET whole_area = @whole WHERE id = @id;", connection, tx);
            flag.Parameters.AddWithValue("@id", id);
            flag.Parameters.AddWithValue("@whole", follow);
            await flag.ExecuteNonQueryAsync(ctx.RequestAborted);
            if (follow) libraries = null;
        }

        if (libraries is not null)
        {
            if (!await OwnLibrariesAsync(connection, tx, areaId, libraries, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Można wybrać tylko bibliotekę, skryptorium i bazy wiedzy tego obszaru.");
                return;
            }
            var keep = string.Join(", ", libraries.Select((_, i) => $"@l{i}"));
            await using (var drop = new SqlCommand($"DELETE FROM app.ai_access_part WHERE access_id = @id AND library_id NOT IN ({keep});", connection, tx))
            {
                drop.Parameters.AddWithValue("@id", id);
                for (var i = 0; i < libraries.Count; i++) drop.Parameters.AddWithValue($"@l{i}", libraries[i]);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
            await AddPartsAsync(connection, tx, id, libraries, ctx.RequestAborted);
        }
        await tx.CommitAsync(ctx.RequestAborted);
        if (body.WholeArea == true) await FollowAreaAsync(connection, null, areaId, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), expiresAt = expires });
    }

    /// <summary>Löschen: der Link antwortet ab sofort nicht mehr, die Abschriften sind fort.</summary>
    private static async Task DeleteAsync(HttpContext ctx, Db db, Guid areaId, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Admin) is null) return;

        await using var cmd = new SqlCommand("DELETE FROM app.ai_access WHERE id = @id AND area_id = @area;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@area", areaId);
        var deleted = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        if (deleted == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma takiego dostępu.");
            return;
        }
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(id), deleted = true });
    }

    /* -- Auffrischen ----------------------------------------------------------------------------- */

    /// <summary>
    /// EINE ABSCHRIFT HINAUFLADEN — wer im Bereich schreibt. Der Körper ist die
    /// Hülle selbst (gzip-JSON unter C); <c>mark</c> der Stand, aus dem sie
    /// gebaut wurde, <c>entries</c> wie viele Einträge sie trägt. Sie muss
    /// unter genau dem Schlüssel dieses Zugangs liegen (Kennung im Kopf).
    /// </summary>
    private static async Task UploadAsync(HttpContext ctx, Db db, Guid areaId, Guid id, Guid libraryId, string? mark, int? entries)
    {
        var limit = ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
        if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = MaxSnapshot;

        if (ctx.Request.ContentType != "application/octet-stream" || ctx.Request.ContentLength is not long size
            || size < Crypto.HeaderSize + Crypto.NonceSize + Crypto.TagSize || size > MaxSnapshot)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Odpis może mieć najwyżej 32 MB.");
            return;
        }
        if (!IsMark(mark) || entries is not int count || count < 0 || count > 1_000_000)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brak stanu zbioru.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Write) is null) return;

        byte[]? keyId = null;
        var expires = DateTimeOffset.MinValue;
        await using (var cmd = new SqlCommand("""
            SELECT a.key_id, a.expires_at FROM app.ai_access a
            JOIN app.ai_access_part p ON p.access_id = a.id AND p.library_id = @library
            WHERE a.id = @id AND a.area_id = @area AND a.key_wrapped IS NOT NULL;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@area", areaId);
            cmd.Parameters.AddWithValue("@library", libraryId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                keyId = (byte[])reader[0];
                expires = reader.GetDateTimeOffset(1);
            }
        }
        if (keyId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Ten dostęp nie obejmuje tego zbioru.");
            return;
        }
        if (expires <= DateTimeOffset.UtcNow)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten link wygasł — najpierw go przedłuż.");
            return;
        }

        var blob = new byte[size];
        await ctx.Request.Body.ReadExactlyAsync(blob, ctx.RequestAborted);
        if (!IsSealed(blob) || !Crypto.ReadHeader(blob).KeyId.AsSpan().SequenceEqual(keyId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Odpis nie jest zapieczętowany kluczem tego dostępu.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        await using (var update = new SqlCommand("""
            UPDATE app.ai_access_part SET snapshot = @snapshot, mark = @mark, entries = @entries, made_at = @now
             WHERE access_id = @id AND library_id = @library;
            """, connection))
        {
            update.Parameters.AddWithValue("@id", id);
            update.Parameters.AddWithValue("@library", libraryId);
            update.Parameters.AddBlob("@snapshot", blob);
            update.Parameters.Add("@mark", SqlDbType.VarChar, 120).Value = mark!;
            update.Parameters.AddWithValue("@entries", count);
            update.Parameters.AddWithValue("@now", now);
            await update.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { libraryId = Ids.ToText(libraryId), madeAt = now, bytes = size });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
