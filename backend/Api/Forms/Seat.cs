using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Der individuelle Zugang — ein PLATZ in einem Bereich.
///
/// <para>
/// Drei Faelle, ein Gebilde: der Firmkandidat ohne Konto, der Teilnehmer, der
/// sich vom offenen Netz anmeldet, der Schueler in einer Klasse. Was die
/// Kanzlei einem von ihnen sagt, steht in seiner Rozmowa (0069).
/// </para>
///
/// <para>
/// <b>Jeder Platz hat seinen eigenen Schluessel</b>, und er liegt dreifach
/// verpackt: unter dem Schluessel aus dem Link, unter dem Epochenschluessel des
/// Bereichs, und — sobald jemand den Platz an sein Konto bindet — unter dem
/// oeffentlichen Schluessel seiner Rolle.
/// </para>
///
/// <para>
/// Das ist der Unterschied zu 0005, wo der Link den EPOCHENSCHLUESSEL trug:
/// damit haette jeder Schueler jeden anderen Platz geoeffnet. 0023 nennt den
/// Befund; hier steht die Folge.
/// </para>
///
/// <para>
/// <b>Der Dienst oeffnet nichts.</b> Er nimmt Huellen entgegen, gibt sie
/// heraus, und kennt vom Link nur dessen SHA-256.
/// </para>
/// </summary>
public static partial class Seat
{
    public const int MaxName = 200;

    /// <summary>Ein Platz ohne Ablaufdatum ist einer, der in fuenf Jahren noch aufgeht.</summary>
    private static readonly TimeSpan DefaultLife = TimeSpan.FromDays(365);

    public static void Map(WebApplication app)
    {
        // Die Kanzlei.
        app.MapGet("/workspace/area/{id:guid}/seats", ListAsync);
        app.MapPost("/workspace/seats/names", NamesAsync);
        app.MapPost("/workspace/seat/{id:guid}/revoke", RevokeAsync);
        app.MapPost("/workspace/seat/{id:guid}/relink", RelinkAsync);

        // Meine eigenen Plaetze — ueber das Konto, ohne Link.
        app.MapGet("/workspace/seats", MineAsync);

        /*
         * Der Link. OHNE Konto — das ist der ganze Zweck: ein Vierzehnjaehriger
         * hat keines, und ein Teilnehmer soll sich fuer eine Anmeldung keines
         * anlegen muessen.
         */
        app.MapGet("/seat/{token}", OpenAsync);
        app.MapPost("/seat/{token}/bind", BindAsync);

        /*
         * SEINE EIGENE EINSENDUNG BERICHTIGEN — ohne Konto, mit dem Link.
         *
         * Wer sich selbst angemeldet hat, hat sich vertippt oder ist umgezogen.
         * Ihn dafuer in die Kanzlei zu schicken hiesse: die Angabe gehoert dem
         * Amt. Sie gehoert ihm.
         */
        app.MapPost("/seat/{token}/submission", ReviseAsync);

        /*
         * „To mój numer“ — die Bestaetigung aus dem eigenen Portal (0031).
         * Sie steht neben dem SMS-Link und ersetzt ihn nicht: der Link zeigt
         * Erreichbarkeit, dieser Knopf zeigt, dass die Angabe noch gilt.
         */
        app.MapPost("/seat/{token}/check", SelfCheckAsync);

        /*
         * 0046 — beim ersten Oeffnen bestaetigen, die ganze Einsendung auf
         * einmal bestaetigen, und nach einer Aenderung einen neuen Link.
         */
        app.MapPost("/seat/{token}/verify", VerifyAsync);
        app.MapPost("/seat/{token}/confirm", ConfirmAsync);
        app.MapPost("/seat/{token}/rotate", RotateAsync);

        /* 0047 — einen Schritt selbst abhaken, den der Mensch selbst abhakt. */
        app.MapPost("/seat/{token}/step", OwnStepAsync);

        /* 0098 — eine Aufgabe: przyjmuję / pomijam / odmawiam, und an welchen Tagen getan. */
        app.MapPost("/seat/{token}/task", OwnTaskAsync);

        /* 0099 — zu einem Termin: będę / nie wiem / nie będę, die Funktion, und (wenn er es selbst einträgt) da gewesen. */
        app.MapPost("/seat/{token}/presence", OwnPresenceAsync);
    }

    /*
        AUSSTELLEN VON HAND — FORT.

        Ein Platz entstand auf zwei Wegen: aus einer Einsendung, und weil die
        Kanzlei einen ausstellte. Der zweite war eine Verdopplung des ersten:
        das Amt legt ohnehin ein Formular an, und wer es abschickt, bekommt
        seinen Platz — mitsamt Namen, Antworten und Link, alles an einer
        Stelle. Der Knopf daneben erzeugte einen Platz OHNE Einsendung, den
        danach niemand wiederfand ausser über eine zweite Liste.

        Was bleibt: `/workspace/area/{id}/seats` (die Kanzlei liest sie),
        `/relink` (den Link neu zeigen) und `/revoke` (ihn zurücknehmen).
        Angelegt werden Plätze nur noch dort, wo sie entstehen — beim
        Absenden eines Formulars (`Form.SubmitAsync`).
    */

    /* -- Die Kanzleisicht --------------------------------------------------- */

    /// <summary>
    /// Die Plaetze eines Bereichs.
    ///
    /// <para>
    /// Mit beiden Huellen: die Kanzlei braucht <c>seat_key_for_area</c>, um den
    /// Platzschluessel zu oeffnen, und den Epochenschluessel fuer die interne
    /// Notiz. Beides geht versiegelt hinaus — geoeffnet wird im Browser.
    /// </para>
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        /*
         * BEIDE Wege der Kanzlei stehen hier (0027), und genau EINER ist je
         * Zeile gefuellt:
         *
         *   seat_key_for_area     das Amt hat den Platz ausgestellt
         *   seat_key_for_intake   jemand hat sich selbst angemeldet
         *
         * `origin` sagt welcher, damit die Oberflaeche nicht aus „welche Spalte
         * ist leer" darauf schliessen muss.
         */
        await using var cmd = new SqlCommand("""
            SELECT a.id, a.seat_key_for_area, a.epoch,
                   a.status, a.view_count, a.created_at, a.expires_at, a.revoked_at,
                   (SELECT COUNT(*) FROM app.access_holder h
                     WHERE h.access_id = a.id AND h.until IS NULL) AS holders,
                   a.seat_key_for_intake, a.origin,

                   /*
                    * Wohin der Platz gehoert — damit ein neu ausgestellter Link
                    * sich liest wie die Adresse, unter der der Mensch ihn
                    * erwartet, und nicht als loses `#/seat/…`.
                    */
                   (SELECT TOP 1 s.path FROM app.access_slug g
                     JOIN app.slug s ON s.id = g.slug_id
                    WHERE g.access_id = a.id ORDER BY LEN(s.path)) AS under_path,
                   a.link_sealed, a.verify_fields, a.verified_at,
                   CAST(CASE WHEN a.verify_hash IS NULL THEN 0 ELSE 1 END AS bit) AS asks,
                   a.verify_failures,
                   a.name_sealed, a.name_epoch, a.own_name_sealed
            FROM app.access a
            WHERE a.area_id = @area
            ORDER BY a.created_at DESC;
            """, connection);

        cmd.Parameters.AddWithValue("@area", id);

        var seats = new List<object>();

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            seats.Add(new
            {
                seatId = Ids.ToText(reader.GetGuid(0)),

                /* 0097 — der Name, versiegelt unter dem Schlüssel dieses Bereichs. */
                nameSealed = Names.B64(reader, 17),
                nameEpoch = Names.Int(reader, 18),

                /* In einem jawny Bereich gibt es keine Kopie unter seinem Schlüssel: dann die eigene, an die die Kanzlei über den Platzschlüssel kommt. */
                ownNameSealed = Names.B64(reader, 19),
                seatKeyForArea = reader.IsDBNull(1) ? null : Base64Url.Encode((byte[])reader[1]),
                seatKeyForIntake = reader.IsDBNull(9) ? null : Base64Url.Encode((byte[])reader[9]),
                origin = reader.GetString(10),
                under = reader.IsDBNull(11) ? null : reader.GetString(11),
                epoch = reader.GetInt32(2),
                status = reader.GetString(3),
                viewCount = reader.GetInt32(4),
                createdAt = reader.GetDateTimeOffset(5),
                expiresAt = reader.IsDBNull(6) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(6),
                revokedAt = reader.IsDBNull(7) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(7),
                holders = reader.GetInt32(8),

                /* 0046 — der Link, versiegelt unter dem Platzschluessel, und ob er beim ersten Oeffnen fragt. */
                linkSealed = reader.IsDBNull(12) ? null : Base64Url.Encode((byte[])reader[12]),
                verifyFields = reader.IsDBNull(13) ? null : reader.GetString(13),
                verifiedAt = reader.IsDBNull(14) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(14),
                asks = reader.GetBoolean(15),

                /* Zu viele falsche Antworten: der Link ist zu, nur ein neuer hilft. */
                locked = reader.GetInt32(16) >= MaxVerifyFailures
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), seats });
    }

/* -- Gemeinsames -------------------------------------------------------- */

    internal static async Task<Guid?> AreaOfAsync(SqlConnection connection, Guid seatId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT area_id FROM app.access WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", seatId);

        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }

    private static bool Blob(string? text, out byte[] bytes)
    {
        bytes = [];
        if (string.IsNullOrWhiteSpace(text)) return false;

        try { bytes = Base64Url.Decode(text); return true; }
        catch (FormatException) { return false; }
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
