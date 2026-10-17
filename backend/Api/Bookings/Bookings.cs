using System.Security.Cryptography;
using System.Text;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Etwas, das man sich fuer eine Zeit nehmen kann (0039).
///
/// <para>
/// <b>Zwei Faelle, eine Pruefung.</b> Ein Firmling nimmt sich einen Platz bei
/// einem Treffen mit dem Priester; eine Gruppe fragt nach einem Haus in Hortus
/// Dei. Beides ist: jemand nimmt sich einen Teil von etwas Begrenztem, fuer
/// eine Zeit. Was sich unterscheidet, sind Regeln am Ding (`app.resource`) —
/// wer die Zeit waehlt, was die Grenze zaehlt, Puffer, wer bestaetigt, ob der
/// Erste einladen darf. Die Frage „passt das noch" wird hier EINMAL
/// beantwortet, fuer beide.
/// </para>
///
/// <para>
/// <b>Unter einer Sperre, und das ist der Grund fuer diese Datei.</b> 0029
/// zaehlte die belegten Plaetze und schrieb die Buchung in einem zweiten
/// Schritt. Zwei Menschen im selben Augenblick lasen beide „einer frei" und
/// bekamen beide einen. Hier wird die Wurzel des Dings gesperrt, bevor gezaehlt
/// wird, und erst nach dem Schreiben freigegeben — wer danach kommt, zaehlt den
/// Vorgaenger mit.
/// </para>
///
/// <para>
/// <b>Die Wurzel und nicht das Ding</b>, weil in einem Baum auch das Haus das
/// Zimmer belegt: wer das ganze Haus nimmt, waehrend ein anderer das Zimmer
/// darin nimmt, muss mit ihm in dieselbe Schlange.
/// </para>
/// </summary>
public static partial class Bookings
{
    /// <summary>Sechs Zeichen, wie in 0029: er wird abgetippt, nicht kopiert.</summary>
    private const int CodeLength = 6;

    /* Ohne 0, O, 1, I, L — auf Papier und per SMS sind sie dasselbe Zeichen. */
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    private const int MaxName = 200;

    private static readonly string[] Kinds = ["person", "room", "house", "place", "other"];

    public static void Map(WebApplication app)
    {
        /* -- die Kanzlei ---------------------------------------------------- */
        app.MapGet("/workspace/resources", ListAsync);
        app.MapPost("/workspace/resource", CreateAsync);
        app.MapPost("/workspace/resource/{id:guid}", UpdateAsync);
        app.MapGet("/workspace/resource/{id:guid}/claims", OfficeClaimsAsync);
        app.MapPost("/workspace/claim/{id:guid}/decide", OfficeDecideAsync);

        /* 0049 — die Kanzlei am Termin: eintragen, austragen, schliessen. */
        app.MapPost("/workspace/resource/{id:guid}/add", OfficeAddAsync);
        app.MapPost("/workspace/claim/{id:guid}/remove", OfficeRemoveAsync);
        app.MapPost("/workspace/resource/{id:guid}/close", OfficeCloseAsync);

        /*
         * -- wer sich etwas nimmt -------------------------------------------
         *
         * Ohne Konto: der Platz (`seat`) ist der Ausweis. Der Dienst sieht nur
         * das Token — der Schluessel, der die Einsendung oeffnet, bleibt im
         * Browser und wird hier gar nicht gebraucht.
         */
        app.MapGet("/resource/offers", OffersAsync);
        app.MapPost("/resource/claim", ClaimAsync);
        app.MapPost("/resource/release", ReleaseAsync);
        app.MapPost("/resource/ask", AskAsync);
        app.MapPost("/resource/decide", HostDecideAsync);
        app.MapPost("/resource/unhost", UnhostAsync);

        /* 0050 — der Erste sagt, ob er Gastgeber sein will. */
        app.MapPost("/resource/host", HostConfirmAsync);

        /* 0049 — der Gastgeber schliesst seinen Termin, sobald genug darauf sitzen. */
        app.MapPost("/resource/close", HostCloseAsync);

        /* 0057 — die Reservierungen im eigenen Kalender (Bookings.Agenda.cs). */
        app.MapGet("/workspace/agenda/bookings", AgendaAsync);
    }

    /* ======================================================================
       DAS DING
       ====================================================================== */

    internal sealed record ResourceRow(
        Guid Id, Guid AreaId, Guid? ParentId, Guid? CalendarId, string Name, string Kind,
        string Mode, bool ByNight, int CheckInMin, int CheckOutMin, int Capacity,
        int BufferBefore, int BufferAfter, string Approval, int InviteHours, int LeadDays,

        /* Wie viele Termine EINER halten darf — 0: keine Grenze (0045). */
        int PerPerson,

        /*
         * Ab wie vielen Menschen ein Termin nach dem Fenster des Gastgebers
         * NICHT an alle zurueckfaellt — und ab wann der Gastgeber ihn selbst
         * schliessen darf (0049).
         */
        int MinPersons = 2,

        /*
         * 0058 — WER RESERVIEREN DARF: Mitglieder und Plätze dieses Bereichs
         * und der Bereiche darunter. NULL: jeder, der den Termin findet (wie
         * bisher). Die Kandidaten beim Priester sind der Fall „Bereich
         * Kandydaci" — nicht mehr der einzige.
         */
        Guid? ReserveAreaId = null,

        /* 0058 — sind die Termine des Kalenders von selbst Angebote? Ein Termin kann es für sich anders sagen. */
        bool BookableDefault = true);

    private const string ResourceColumns = """
        id, area_id, parent_id, calendar_id, name, kind, mode, by_night, check_in_min,
        check_out_min, capacity, buffer_before, buffer_after, approval, invite_hours, lead_days,
        per_person, min_persons, reserve_area_id, bookable_default
        """;

    private static ResourceRow ReadResource(SqlDataReader r) => new(
        r.GetGuid(0), r.GetGuid(1),
        r.IsDBNull(2) ? null : r.GetGuid(2),
        r.IsDBNull(3) ? null : r.GetGuid(3),
        r.GetString(4), r.GetString(5), r.GetString(6), r.GetBoolean(7),
        r.GetInt32(8), r.GetInt32(9), r.GetInt32(10), r.GetInt32(11), r.GetInt32(12),
        r.GetString(13), r.GetInt32(14), r.GetInt32(15), r.GetInt32(16), r.GetInt32(17),
        r.IsDBNull(18) ? null : r.GetGuid(18), r.GetBoolean(19));

    private static async Task<ResourceRow?> ResourceAsync(
        SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            $"SELECT {ResourceColumns} FROM app.resource WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadResource(reader) : null;
    }

    /// <summary>
    /// Der Baum um ein Ding — seine Vorfahren und seine Nachkommen.
    ///
    /// <para>
    /// <b>Aus EINER Abfrage.</b> Die Dinge eines Bereichs sind wenige (ein Ort,
    /// ein paar Haeuser, ihre Zimmer); sie alle zu holen und den Baum hier zu
    /// bauen ist billiger als eine rekursive Abfrage und liest sich besser.
    /// </para>
    /// </summary>
    private static async Task<(Guid Root, HashSet<Guid> Above, HashSet<Guid> Below)> TreeAsync(
        SqlConnection connection, SqlTransaction? tx, ResourceRow resource, CancellationToken ct)
    {
        var parent = new Dictionary<Guid, Guid?>();

        await using (var cmd = new SqlCommand(
            "SELECT id, parent_id FROM app.resource WHERE area_id = @a;", connection, tx))
        {
            cmd.Parameters.AddWithValue("@a", resource.AreaId);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                parent[reader.GetGuid(0)] = reader.IsDBNull(1) ? null : reader.GetGuid(1);
        }

        var above = new HashSet<Guid>();
        var root = resource.Id;

        /* Hinauf — und nicht endlos, falls die Datenbank je einen Kreis haette. */
        for (var at = resource.ParentId; at is not null && above.Add(at.Value); )
        {
            root = at.Value;
            at = parent.TryGetValue(at.Value, out var up) ? up : null;
        }

        var below = new HashSet<Guid>();
        var queue = new Queue<Guid>([resource.Id]);

        while (queue.Count > 0)
        {
            var here = queue.Dequeue();
            foreach (var (child, up) in parent)
                if (up == here && below.Add(child)) queue.Enqueue(child);
        }

        return (root, above, below);
    }

    /* ======================================================================
       WER ES HAELT
       ====================================================================== */

    private sealed record ClaimRow(
        Guid Id, Guid ResourceId, DateTimeOffset StartsAt, DateTimeOffset EndsAt,
        Guid? ItemId, DateTimeOffset? OccurrenceAt, Guid? AccessId, Guid? RoleId, Guid GroupId,
        string Status, string? Awaits, byte[]? InviteSha256, DateTimeOffset? InviteUntil,
        byte[]? InviteSealed,

        /* Wann der Erste ja gesagt hat — NULL: er entscheidet noch (0050). */
        DateTimeOffset? HostConfirmedAt = null,
        DateTimeOffset? CreatedAt = null,

        /*
         * 0097 — WER ES HÄLT, NIE OFFEN: für die Kanzlei (unter dem
         * Bereichsschlüssel ODER für die Annahme verpackt), für den Gastgeber
         * (seine Bitte, ECIES), und dessen P-256-Paar.
         */
        byte[]? HolderSealed = null, int? HolderEpoch = null, byte[]? HolderWrapped = null,
        byte[]? AskSealed = null, byte[]? HostPublic = null, byte[]? HostPrivate = null)
    {
        /// <summary>
        /// Haelt DIESER ihn — ein Platz oder eine Rolle (0045)? Die Kennungen
        /// kommen aus verschiedenen Tabellen und koennen sich nicht gleichen.
        /// </summary>
        public bool HeldBy(Guid me) => AccessId == me || RoleId == me;
    }

    private const string ClaimColumns = """
        id, resource_id, starts_at, ends_at, item_id, occurrence_at, access_id, role_id,
        group_id, status, awaits, invite_sha256, invite_until, invite_sealed,
        host_confirmed_at, created_at,
        holder_name_sealed, holder_name_epoch, holder_name_wrapped, ask_name_sealed, host_wrap_public, host_wrap_private_sealed
        """;

    private static ClaimRow ReadClaim(SqlDataReader r) => new(
        r.GetGuid(0), r.GetGuid(1), r.GetDateTimeOffset(2), r.GetDateTimeOffset(3),
        r.IsDBNull(4) ? null : r.GetGuid(4),
        r.IsDBNull(5) ? null : r.GetDateTimeOffset(5),
        r.IsDBNull(6) ? null : r.GetGuid(6),
        r.IsDBNull(7) ? null : r.GetGuid(7),
        r.GetGuid(8), r.GetString(9),
        r.IsDBNull(10) ? null : r.GetString(10),
        r.IsDBNull(11) ? null : (byte[])r[11],
        r.IsDBNull(12) ? null : r.GetDateTimeOffset(12),
        r.IsDBNull(13) ? null : (byte[])r[13],
        r.IsDBNull(14) ? null : r.GetDateTimeOffset(14),
        r.IsDBNull(15) ? null : r.GetDateTimeOffset(15),
        r.IsDBNull(16) ? null : (byte[])r[16],
        r.IsDBNull(17) ? null : r.GetInt32(17),
        r.IsDBNull(18) ? null : (byte[])r[18],
        r.IsDBNull(19) ? null : (byte[])r[19],
        r.IsDBNull(20) ? null : (byte[])r[20],
        r.IsDBNull(21) ? null : (byte[])r[21]);

    /// <summary>
    /// ZAEHLT GEGEN DIE GRENZE?
    ///
    /// <para>
    /// Was steht, zaehlt. Was auf die KANZLEI wartet, zaehlt auch — sonst zeigte
    /// der Kalender frei, was schon erfragt ist. Was auf den GASTGEBER wartet,
    /// zaehlt nicht: eine Bitte um Mitnahme soll nicht den Platz blockieren,
    /// den der Gastgeber vielleicht jemand anderem geben will. Sie wird beim
    /// Ja noch einmal gegen die Grenze geprueft.
    /// </para>
    /// </summary>
    private static bool Counts(ClaimRow c) =>
        c.Status == "confirmed" || (c.Status == "pending" && c.Awaits == "office");

    private static bool Live(ClaimRow c) => c.Status is "confirmed" or "pending";

    /// <summary>
    /// Wie lange der Erste Zeit hat, sich zu entscheiden, ob er Gastgeber sein
    /// will (0050). Solange haelt er die freien Plaetze wie ein Gastgeber;
    /// antwortet er nicht, gehoeren sie danach allen.
    /// </summary>
    private const int HostDecisionMinutes = 15;

    /// <summary>
    /// IST ER GASTGEBER? Wer ja gesagt hat — oder wer noch innerhalb seiner 15
    /// Minuten ueberlegt. Wer sie verstreichen liess, ist es nicht: dann gibt es
    /// keinen Gastgeber, und was frei ist, ist frei.
    /// </summary>
    private static bool Hosts(ClaimRow c, DateTimeOffset now) =>
        c.Status == "confirmed" && c.InviteSha256 is not null
        && (SaidYes(c) || (c.InviteUntil is not null && c.InviteUntil > now));

    /// <summary>Er hat den Termin als Erster, und die Frage „Gastgeber oder nicht" ist noch offen.</summary>
    private static bool HostUndecided(ClaimRow c, DateTimeOffset now) =>
        c.InviteSha256 is not null && !SaidYes(c)
        && c.InviteUntil is not null && c.InviteUntil > now;

    /// <summary>HAT ER JA GESAGT? Mit Zeitpunkt (0050; die Gastgeber von davor trägt 0112 nach).</summary>
    private static bool SaidYes(ClaimRow c) => c.HostConfirmedAt is not null;

    /// <summary>Haelt gerade jemand die freien Plaetze — mit seinem Fenster oder seiner Bedenkzeit?</summary>
    private static bool HostWindowOpen(IEnumerable<ClaimRow> claims, DateTimeOffset now) =>
        claims.Any(c => Hosts(c, now) && c.InviteUntil is not null && c.InviteUntil > now);

/* ======================================================================
       KLEINKRAM
       ====================================================================== */

    /// <summary>
    /// WER NIMMT — ein Platz (sein Token genuegt) oder eine eigene Person
    /// (dann mit Anmeldung, und sie muss dem Konto gehoeren; das Konto selbst
    /// nimmt nichts, 0040). <c>null</c>: niemand, der hier etwas nehmen darf.
    /// </summary>
    private static async Task<(Guid Id, bool IsRole)?> HolderAsync(
        HttpContext ctx, Db db, SqlConnection connection, string? seat, string? roleId, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(seat))
        {
            var found = await SeatOfAsync(connection, seat, ct);
            return found is null ? null : (found.Value, false);
        }

        if (!Guid.TryParse(roleId, out var role)) return null;

        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) return null;

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ct);
        if (!mine.Any(r => r.Id == role) || Workspace.IsAccount(mine, role)) return null;

        return (role, true);
    }

    private static async Task<Guid?> SeatOfAsync(
        SqlConnection connection, string? token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;

        await using var cmd = new SqlCommand("""
            SELECT id FROM app.access
            WHERE token_sha256 = @token AND revoked_at IS NULL AND status = N'active'
              AND (expires_at IS NULL OR expires_at > @now)
              AND (verify_hash IS NULL OR verified_at IS NOT NULL);
            """, connection);

        cmd.Parameters.AddWithValue("@token", SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim())));
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    private static string NewCode()
    {
        var chars = new char[CodeLength];
        for (var i = 0; i < CodeLength; i++)
            chars[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        return new string(chars);
    }

    internal static byte[] HashCode(string code) =>
        SHA256.HashData(Encoding.UTF8.GetBytes(code.Trim().ToUpperInvariant()));

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
