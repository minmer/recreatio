using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 3.9 Schicht 1, 2 und der Sitzungswiderruf.
///
/// P0-2 im Audit: Im Altbestand prueft die Cookie-Anmeldung nur das
/// Data-Protection-Ticket. <c>KeyRingService</c> liest Nutzer- und Sitzungs-ID
/// aus den Anspruechen und prueft die Sitzungszeile NICHT. Viele Endpunkte
/// rufen ihn unmittelbar auf. Ergebnis: Ein kopiertes Cookie ueberlebt
/// Abmeldung und Passwortwechsel — <c>/auth/me</c> weist es ab, waehrend Chat,
/// Kalender, Parish und Events es weiter akzeptieren.
///
/// <b>Hier wird an EINER Stelle geprueft, und diese Stelle liegt vor allen
/// Endpunkten.</b> Ein Modul kann sie nicht vergessen, weil es sie nicht
/// aufruft.
/// </summary>
public sealed class RcSessionMiddleware(RequestDelegate next, IConfiguration config)
{
    /// <summary>
    /// 3.9 Schicht 2 — Das Oeffnungsstueck kommt in einem EIGENEN Kopf, nicht
    /// im Cookie. Damit ist der Authentifizierungsnachweis sauber vom
    /// Entsperrmaterial getrennt; genau deren Vermischung war der Fehler, den
    /// das Audit gefunden hat.
    /// </summary>
    public const string UnlockHeader = "X-Rc-Unlock";

    public const string ClaimAccountId = "rc.sub";
    public const string ClaimSessionId = "rc.sid";

    /// <summary>
    /// Der Aktivitaetszeitstempel wird gedrosselt geschrieben. 3.9 verlangt
    /// ausdruecklich, einen Schreibzugriff bei JEDEM Lesevorgang zu vermeiden —
    /// sonst kostet jede Anzeige eine Schreiboperation.
    /// </summary>
    private static readonly TimeSpan ActivityWriteInterval = TimeSpan.FromMinutes(1);
    private static readonly ConcurrentDictionary<Guid, DateTimeOffset> LastWritten = new();

    public async Task InvokeAsync(HttpContext context)
    {
        // Nur was unter /rc laeuft. Der Altbestand bleibt unberuehrt.
        if (!context.Request.Path.StartsWithSegments("/rc"))
        {
            await next(context);
            return;
        }

        // Ausdruecklich gegen das EIGENE Verfahren, nicht gegen context.User.
        // context.User traegt das Vorgabeschema des Altbestands; wuerde es hier
        // gelten, waere eine Anmeldung dort zugleich eine hier — und 2.1 waere
        // nur noch ein Pfadpraefix.
        var result = await context.AuthenticateAsync(RcAuth.Scheme);
        var principal = result.Succeeded ? result.Principal : null;

        var accountId = principal is null ? null : ReadGuidClaim(principal, ClaimAccountId);
        var sessionId = principal is null ? null : ReadGuidClaim(principal, ClaimSessionId);

        if (accountId is null || sessionId is null)
        {
            // Nicht angemeldet ist kein Fehler — oeffentliche Pfade gibt es
            // (A04, 7.4.1). Die Berechtigungspruefung entscheidet spaeter.
            await next(context);
            return;
        }

        var state = await LoadSessionAsync(sessionId.Value);

        if (state is null || state.RevokedUtc is not null)
        {
            await SignOutAsync(context, RcErrorCodes.SessionRevoked,
                "Diese Sitzung wurde beendet. Bitte neu anmelden.");
            return;
        }

        if (state.ExpiresUtc <= DateTimeOffset.UtcNow)
        {
            await SignOutAsync(context, RcErrorCodes.SessionExpired,
                "Diese Sitzung ist abgelaufen. Bitte neu anmelden.");
            return;
        }

        context.Items[nameof(RcRequestSession)] =
            new RcRequestSession(accountId.Value, sessionId.Value, state.Username);
        await TouchAsync(sessionId.Value);
        await next(context);
    }

    /// <summary>
    /// Widerruf UND Abmeldung in einem: das Cookie wird geloescht, und was der
    /// Schluesselspeicher zu dieser Sitzung haelt, ist ohnehin ohne
    /// Oeffnungsstueck wertlos (3.9).
    /// </summary>
    private static async Task SignOutAsync(HttpContext context, string code, string message)
    {
        await context.SignOutAsync(RcAuth.Scheme);
        await RcResults.WriteErrorAsync(context, StatusCodes.Status401Unauthorized, code, message);
    }

    private static Guid? ReadGuidClaim(ClaimsPrincipal user, string type) =>
        Guid.TryParse(user.FindFirst(type)?.Value, out var value) ? value : null;

    private async Task<SessionState?> LoadSessionAsync(Guid sessionId)
    {
        var cs = RcDb.TryRead(config);
        if (cs is null) return null;

        await using var c = new SqlConnection(cs);
        await c.OpenAsync();
        await using var cmd = new SqlCommand(
            "SELECT s.account_id, s.expires_at, s.revoked_at, a.username " +
            "FROM dbo.rc_session s JOIN dbo.rc_account a ON a.id = s.account_id " +
            "WHERE s.id = @id;", c);
        cmd.Parameters.AddWithValue("@id", sessionId);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return null;

        return new SessionState(
            reader.GetGuid(0),
            reader.GetDateTimeOffset(1),
            reader.IsDBNull(2) ? null : reader.GetDateTimeOffset(2),
            reader.GetString(3));
    }

    private async Task TouchAsync(Guid sessionId)
    {
        var now = DateTimeOffset.UtcNow;
        if (LastWritten.TryGetValue(sessionId, out var last) && now - last < ActivityWriteInterval) return;
        LastWritten[sessionId] = now;

        var cs = RcDb.TryRead(config);
        if (cs is null) return;

        await using var c = new SqlConnection(cs);
        await c.OpenAsync();
        await using var cmd = new SqlCommand(
            "UPDATE dbo.rc_session SET last_activity_at = @now WHERE id = @id AND revoked_at IS NULL;", c);
        cmd.Parameters.AddWithValue("@now", now);
        cmd.Parameters.AddWithValue("@id", sessionId);
        await cmd.ExecuteNonQueryAsync();
    }

    private sealed record SessionState(
        Guid AccountId, DateTimeOffset ExpiresUtc, DateTimeOffset? RevokedUtc, string Username);
}

/// <summary>Was eine Anfrage ueber ihre Sitzung weiss. Mehr braucht kein Modul.</summary>
/// <remarks>
/// <c>Username</c> ist der ANMELDENAME, nicht der Anzeigename. Der Anzeigename
/// liegt versiegelt an der persoenlichen Rolle und ist ohne Schluesselbund nicht
/// lesbar (9.13.2) — bei verschlossenem Bund ist dies das Einzige, was die
/// Oberflaeche ueberhaupt sagen kann, wer hier angemeldet ist.
/// </remarks>
public sealed record RcRequestSession(Guid AccountId, Guid SessionId, string Username);

public static class RcSessionExtensions
{
    public static IApplicationBuilder UseRcSession(this IApplicationBuilder app) =>
        app.UseMiddleware<RcSessionMiddleware>();

    public static RcRequestSession? RcSession(this HttpContext context) =>
        context.Items.TryGetValue(nameof(RcRequestSession), out var value)
            ? value as RcRequestSession
            : null;

    /// <summary>
    /// Liegt ueberhaupt ein Oeffnungsstueck bei?
    ///
    /// <see cref="RcUnlockPiece"/> WIRFT, wenn keines mitkam — richtig so fuer
    /// jeden Endpunkt, der ohne Schluessel nichts tun kann. Es gibt aber einen,
    /// der beides bedienen muss: die Anmeldung zu einer Veranstaltung geht mit
    /// Konto UND ohne. Dort saehe ein Aufruf mit anschliessendem Null-Test wie
    /// eine Pruefung aus und waere in Wahrheit der Fehlerfall selbst.
    /// </summary>
    public static bool RcHasUnlockPiece(this HttpContext context) =>
        !string.IsNullOrEmpty(context.Request.Headers[RcSessionMiddleware.UnlockHeader].ToString());

    /// <summary>
    /// 3.9 Schicht 2 — Das Oeffnungsstueck aus dem eigenen Kopf. Es wird
    /// NIRGENDS protokolliert: Kapitel 16 verlangt eine Sperrliste der
    /// Protokollierung fuer Koepfe mit Schluesselmaterial.
    /// </summary>
    public static byte[] RcUnlockPiece(this HttpContext context)
    {
        var raw = context.Request.Headers[RcSessionMiddleware.UnlockHeader].ToString();
        if (string.IsNullOrEmpty(raw))
            throw new RcUnlockRequiredException("Kein Oeffnungsstueck mitgeschickt.");

        if (!RcBase64Url.TryDecode(raw, out var piece))
            throw new RcUnlockRequiredException("Oeffnungsstueck unlesbar.");

        return piece;
    }
}
