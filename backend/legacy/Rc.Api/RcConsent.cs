using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 12.10 — Einwilligungstexte.
///
/// <b>Was hier NICHT steht: wer eingewilligt hat.</b> Das ist eine
/// personenbezogene Angabe und liegt verschluesselt als Datenelement
/// (<see cref="RcDataItems"/>, Feld <c>ParticipantCardConsents</c>). Hier
/// stehen nur die TEXTE — sie sind oeffentlich, sie muessen es sein, und sie
/// sind fuer alle dieselben.
///
/// <b>Drei Eigenschaften, und jede hat einen Grund:</b>
///
///   <b>Je Sprache ein eigener Text.</b> Nicht eine Uebersetzung des einen
///   richtigen — eine Einwilligung gilt in der Sprache, in der sie gelesen
///   wurde, und wer sie auf Polnisch gegeben hat, hat dem polnischen Wortlaut
///   zugestimmt und keinem anderen.
///
///   <b>Versioniert, und alte Fassungen bleiben.</b> Wer 2024 zugestimmt hat,
///   hat der Fassung von 2024 zugestimmt. Sie zu ueberschreiben hiesse, ihm
///   nachtraeglich etwas anderes in den Mund zu legen.
///
///   <b>Mit Hash ueber die kanonische Form.</b> Damit laesst sich zeigen, dass
///   der Text von damals genau dieser war. Ohne ihn waere die Fassungsnummer
///   eine Behauptung des Betreibers.
/// </summary>
public static class RcConsent
{
    public static void MapRcConsent(this IEndpointRouteBuilder app)
    {
        // Ohne Konto lesbar — ein Einwilligungstext, den man erst nach der
        // Anmeldung lesen kann, kommt zu spaet.
        app.MapGet("/rc/consent/{key}", CurrentAsync).Produces<RcConsent.ConsentView>();
        app.MapGet("/rc/consent/{key}/versions", VersionsAsync).Produces<RcConsentVersionsResponse>();
        app.MapPost("/rc/consent", PublishAsync).Produces<RcConsentPublishedResponse>();
    }

    // -- Veroeffentlichen -----------------------------------------------------

    public sealed record PublishRequest(string ConsentKey, string Language, string Body, string TenantRoleId);

    /// <summary>
    /// Eine neue Fassung veroeffentlichen. Die Nummer vergibt der Dienst — wer
    /// sie selbst waehlen darf, waehlt irgendwann versehentlich eine
    /// bestehende, und dann steht unter derselben Nummer zweierlei.
    ///
    /// Verlangt <c>admin</c> in der Traegerschaft. Ein Einwilligungstext ist
    /// keine Nachricht: er bindet alle, die ihm zustimmen.
    /// </summary>
    private static async Task PublishAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, PublishRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var key = Slug(body.ConsentKey);
        var language = Slug(body.Language)?.ToLowerInvariant();
        var text = body.Body?.Trim() ?? "";

        if (key is null || language is null || language.Length is < 2 or > 8 || text.Length is 0 or > 100_000)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Schluessel, Sprache oder Text fehlt.");
            return;
        }

        if (!Guid.TryParse(body.TenantRoleId, out var tenantRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid tenantId;
        await using (var cmd = new SqlCommand(
            "SELECT tenant_id FROM dbo.rc_role WHERE id = @id AND revoked_at IS NULL;", connection))
        {
            cmd.Parameters.AddWithValue("@id", tenantRoleId);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                    RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
                return;
            }
            tenantId = found;
        }

        var may = await permissions.CheckAsync(
            session.AccountId, RcScopeKind.Tenant, tenantId, RcCapability.Admin, ctx.RequestAborted);

        if (!may.Allowed)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Hier darfst du keine Einwilligungstexte veroeffentlichen.");
            return;
        }

        int version;
        await using (var next = new SqlCommand(
            "SELECT ISNULL(MAX(version), 0) + 1 FROM dbo.rc_consent_text " +
            "WHERE consent_key = @key AND language = @language;", connection))
        {
            next.Parameters.AddWithValue("@key", key);
            next.Parameters.AddWithValue("@language", language);
            version = Convert.ToInt32(await next.ExecuteScalarAsync(ctx.RequestAborted),
                System.Globalization.CultureInfo.InvariantCulture);
        }

        var hash = BodyHash(key, language, version, text);

        try
        {
            await using var insert = new SqlCommand("""
                INSERT INTO dbo.rc_consent_text (id, consent_key, language, version, body, body_hash, published_at)
                VALUES (@id, @key, @language, @version, @body, @hash, @now);
                """, connection);

            insert.Parameters.AddWithValue("@id", RcId.NewId());
            insert.Parameters.AddWithValue("@key", key);
            insert.Parameters.AddWithValue("@language", language);
            insert.Parameters.AddWithValue("@version", version);
            insert.Parameters.AddWithValue("@body", text);
            insert.Parameters.AddWithValue("@hash", hash);
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            // Zwei gleichzeitige Veroeffentlichungen derselben Sprache. Kein
            // Schaden — die Bedingung hat getan, wofuer sie da ist.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.ChainSequenceConflict, "Es wurde gerade gleichzeitig veroeffentlicht.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcConsentPublishedResponse(
            key, language, version, RcCrypto.ToHex(hash)), StatusCodes.Status201Created);
    }

    // -- Lesen ----------------------------------------------------------------

    public sealed record ConsentView(
        string ConsentKey, string Language, int Version, string Body, string BodyHash, DateTimeOffset PublishedAt);

    /// <summary>
    /// Die aktuelle Fassung in der gewuenschten Sprache.
    ///
    /// <b>Ohne Rueckfall auf eine andere Sprache.</b> Gibt es den Text auf
    /// Polnisch nicht, kommt keiner — und nicht der englische. Wer einen Text
    /// unterschreibt, den er nicht lesen kann, willigt in nichts ein, und die
    /// Anwendung soll nicht so tun, als waere es doch geschehen.
    /// </summary>
    private static async Task CurrentAsync(HttpContext ctx, RcDb db, string key, string? language)
    {
        var consentKey = Slug(key);
        var lang = Slug(language)?.ToLowerInvariant() ?? "pl";

        if (consentKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Kein Schluessel angegeben.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            SELECT TOP 1 consent_key, language, version, body, body_hash, published_at
            FROM dbo.rc_consent_text
            WHERE consent_key = @key AND language = @language
            ORDER BY version DESC;
            """, connection);

        cmd.Parameters.AddWithValue("@key", consentKey);
        cmd.Parameters.AddWithValue("@language", lang);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.PermissionDenied,
                $"Fuer '{consentKey}' gibt es keinen Text in dieser Sprache.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new ConsentView(
            reader.GetString(0), reader.GetString(1), reader.GetInt32(2), reader.GetString(3),
            RcCrypto.ToHex((byte[])reader[4]), reader.GetDateTimeOffset(5)));
    }

    /// <summary>
    /// Alle Fassungen, ohne Text — fuer den Nachweis, WAS wann galt. Der Hash
    /// genuegt dafuer; wer den Wortlaut braucht, holt die einzelne Fassung.
    /// </summary>
    private static async Task VersionsAsync(HttpContext ctx, RcDb db, string key)
    {
        var consentKey = Slug(key);
        if (consentKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Kein Schluessel angegeben.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            SELECT language, version, body_hash, published_at
            FROM dbo.rc_consent_text WHERE consent_key = @key
            ORDER BY language, version;
            """, connection);
        cmd.Parameters.AddWithValue("@key", consentKey);

        var versions = new List<RcConsentVersion>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            versions.Add(new RcConsentVersion(
                reader.GetString(0), reader.GetInt32(1),
                RcCrypto.ToHex((byte[])reader[2]), reader.GetDateTimeOffset(3)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcConsentVersionsResponse(consentKey, versions));
    }

    // -- Gemeinsames ----------------------------------------------------------

    /// <summary>
    /// Der Hash geht ueber die KANONISCHE Form (Anhang D), nicht ueber den
    /// blossen Text. Damit ist er unabhaengig davon, wie ein Klient das JSON
    /// gerade schreibt — und Schluessel, Sprache und Fassung gehen mit ein:
    /// derselbe Wortlaut unter einer anderen Fassungsnummer ist eine andere
    /// Zusage.
    /// </summary>
    public static byte[] BodyHash(string key, string language, int version, string body) =>
        SHA256.HashData(RcCanonical.SerializeToUtf8(RcJson.O(
            ("body", RcJson.S(body)),
            ("consentKey", RcJson.S(key)),
            ("language", RcJson.S(language)),
            ("version", RcJson.I(version)))));

    private static string? Slug(string? text)
    {
        var trimmed = text?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;

        var cleaned = new string(trimmed.Where(c => char.IsLetterOrDigit(c) || c is '_' or '-' or '.').ToArray());
        return cleaned.Length == 0 ? null : cleaned.Length > 64 ? cleaned[..64] : cleaned;
    }
}
