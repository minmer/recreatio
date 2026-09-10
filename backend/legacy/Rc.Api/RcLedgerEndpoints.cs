using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 7.4 — Was von einer Kette nach aussen geht.
///
/// <b>Der Kopf ist oeffentlich, der Inhalt nicht.</b> Ein Kettenkopf besteht
/// aus einer Nummer und einem Hash. Er verraet, dass eine Kette so weit
/// gewachsen ist, und sonst nichts — keinen Text, keinen Namen, kein Thema.
///
/// Genau deshalb MUSS er oeffentlich abrufbar sein: die Kette beweist von sich
/// aus nur Reihenfolge und Urheberschaft, nicht den Zeitpunkt (7.1, E-265). Der
/// Zeitstempel ist eine Behauptung des Betreibers. Erst wenn Unabhaengige den
/// Kopf mitschreiben, entsteht daraus eine Aussage ueber die Zeit: <i>wer den
/// Kopf am Dienstag notiert hat, kann bezeugen, dass alles davor schon da
/// war.</i>
///
/// Ein Kopfabruf, der ein Konto verlangt, taugt dafuer nicht — ein Zeuge, den
/// der Betreiber erst zulassen muss, ist kein Zeuge.
/// </summary>
public static class RcLedgerEndpoints
{
    public static void MapRcLedger(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/ledgers/{id:guid}/head", HeadAsync).Produces<RcLedgerHeadResponse>();
        app.MapGet("/rc/ledgers/{id:guid}/verify", VerifyAsync).Produces<RcLedgerEndpoints.VerifyResponse>();
        app.MapGet("/rc/ledgers/{id:guid}/entries", EntriesAsync).Produces<RcLedgerEntriesResponse>();
    }

    /// <summary>
    /// Ohne Konto erreichbar. Wer die Kettenkennung kennt, darf ihren Kopf
    /// sehen — und die Kennung erfaehrt nur, wem der Bereich ohnehin offensteht
    /// oder wem sie jemand gegeben hat, um Zeuge zu sein.
    /// </summary>
    private static async Task HeadAsync(HttpContext ctx, RcDb db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var (sequence, hash) = await RcLedger.HeadAsync(connection, id, ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcLedgerHeadResponse(
            RcId.ToText(id), sequence, RcCrypto.ToHex(hash),

            // Ohne diesen Satz wird der Kopf frueher oder spaeter als
            // Zeitnachweis gelesen, der er nicht ist.
            "Die Kette beweist Reihenfolge und Urheberschaft. Den Zeitpunkt "
            + "beweist erst ein unabhaengig mitgeschriebener Kopf."));
    }

    public sealed record VerifyResponse(
        string LedgerId, long Entries, bool Intact, long? FirstBrokenSequence, string? Reason,
        long HeadSequence, string HeadHash);

    /// <summary>
    /// Die Kette Glied fuer Glied nachrechnen, mit allen Unterschriften.
    ///
    /// Verlangt <c>read</c> im Bereich — nicht weil das Ergebnis geheim waere,
    /// sondern weil die Pruefung teuer ist: RSA-PSS je Eintrag. Ein offener
    /// Endpunkt, der beliebig viel Rechenzeit verbraucht, ist eine Einladung.
    /// </summary>
    private static async Task VerifyAsync(HttpContext ctx, RcDb db, RcPermissions permissions, RcLedger ledger, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!await MayReadAsync(db, permissions, session, id, ctx.RequestAborted))
        {
            await RcAreas.NotForYou(ctx);
            return;
        }

        var report = await ledger.VerifyAsync(id, ctx.RequestAborted);
        await RcResults.WriteJsonAsync(ctx, new VerifyResponse(
            report.LedgerId, report.Entries, report.Intact, report.FirstBrokenSequence,
            report.Reason, report.HeadSequence, report.HeadHash),
            report.Intact ? StatusCodes.Status200OK : StatusCodes.Status409Conflict);
    }

    public sealed record EntryView(
        long Sequence, string EntryId, string PreviousHash, string EntryHash,
        string ModuleId, string SignerKeyFingerprint, string AccountCommitment,
        DateTimeOffset ServerTimestamp, string PayloadCanonical);

    /// <summary>
    /// 24.3 — Ausgeliefert werden die GESPEICHERTEN kanonischen Bytes, nicht ein
    /// zweites Mal serialisiertes JSON. Ein Pruefer soll genau die Bytes
    /// bekommen, ueber die unterschrieben wurde; alles andere waere eine
    /// Nachbildung, die im Zweifel abweicht.
    ///
    /// Was hier NICHT steht: die Account-ID. Sie kommt als gesaltete
    /// Verpflichtung (3.4) — stuende sie selbst hier, liefe sie ueber den Export
    /// aus und die Trennung von Konto und Rolle waere aufgehoben.
    /// </summary>
    private static async Task EntriesAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, long? from, int? limit)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!await MayReadAsync(db, permissions, session, id, ctx.RequestAborted))
        {
            await RcAreas.NotForYou(ctx);
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            SELECT TOP (@limit) sequence_no, id, previous_hash, entry_hash, module_id,
                   signer_key_fp, account_commitment, server_timestamp, payload_canonical
            FROM dbo.rc_ledger_entry
            WHERE ledger_id = @ledger AND sequence_no >= @from
            ORDER BY sequence_no;
            """, connection);

        cmd.Parameters.AddWithValue("@ledger", id);
        cmd.Parameters.AddWithValue("@from", from ?? 1);
        cmd.Parameters.AddWithValue("@limit", Math.Clamp(limit ?? 100, 1, 500));

        var entries = new List<EntryView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            entries.Add(new EntryView(
                reader.GetInt64(0), RcId.ToText(reader.GetGuid(1)),
                RcCrypto.ToHex((byte[])reader[2]), RcCrypto.ToHex((byte[])reader[3]),
                reader.GetString(4), RcCrypto.ToHex((byte[])reader[5]),
                RcCrypto.ToHex((byte[])reader[6]), reader.GetDateTimeOffset(7),
                System.Text.Encoding.UTF8.GetString((byte[])reader[8])));
        }

        await RcResults.WriteJsonAsync(ctx, new RcLedgerEntriesResponse(entries));
    }

    /// <summary>
    /// Eine Kette gehoert zu einem Bereich. Wer den Bereich lesen darf, darf
    /// seine Kette pruefen — und wer ihn nicht kennt, bekommt dieselbe Antwort
    /// wie fuer einen Bereich, den es nicht gibt.
    /// </summary>
    private static async Task<bool> MayReadAsync(
        RcDb db, RcPermissions permissions, RcRequestSession session, Guid ledgerId, CancellationToken ct)
    {
        await using var connection = await db.OpenAsync(ct);
        await using var cmd = new SqlCommand("SELECT id FROM dbo.rc_area WHERE ledger_id = @ledger;", connection);
        cmd.Parameters.AddWithValue("@ledger", ledgerId);

        if (await cmd.ExecuteScalarAsync(ct) is not Guid areaId) return false;
        return (await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId, RcCapability.Read, ct)).Allowed;
    }
}
