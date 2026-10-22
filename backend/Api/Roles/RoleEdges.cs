namespace Api;

/// <summary>
/// 2026-10-22 — WANN EINE KANTE GILT: solange sie nicht zurückgenommen ist UND
/// nicht abgelaufen. <c>role_edge.expires_at</c> gibt es seit 0008; bis heute
/// prüfte nur der Browser es (<c>chatAuthor.ts</c>), der Dienst nicht. Jede
/// Abfrage, die über Kanten Reichweite gibt, nimmt die Bedingung von hier — so
/// gilt dieselbe Regel überall.
/// </summary>
internal static class RoleEdges
{
    /// <summary>SQL: die Kante mit dem Alias <paramref name="e"/> lebt.</summary>
    internal static string Live(string e) =>
        $"{e}.revoked_at IS NULL AND ({e}.expires_at IS NULL OR {e}.expires_at > SYSDATETIMEOFFSET())";
}
