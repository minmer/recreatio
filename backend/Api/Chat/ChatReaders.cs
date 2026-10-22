using Kernel;

namespace Api;

/// <summary>
/// 0102 — WER FÜR EINEN MENSCHEN AUS EINEM FORMULAR LIEST.
///
/// <para>
/// <b>Über seinen Link oder in der App.</b> Er liest als sein Platz (der Link)
/// — oder mit seinem Konto: dem, das die Person hält, als die er eingesandt
/// hat (<c>registration.role_id</c>), oder eine Rolle, an die er den Platz
/// gebunden hat (<c>access_holder</c>). Gelesen ist, was EINER von ihnen
/// gelesen hat (<c>chat_presence</c> je Platz oder Konto, <c>chat_read</c> je
/// Konto). Seine eigenen Nachrichten — über den Platz oder als eine dieser
/// Personen — sind nie ungelesen.
/// </para>
///
/// <para>
/// Gebraucht vom Schritt „Przeczytaj wiadomości" (je Einsendung) und von der
/// Liste der Rozmowy eines Platzes (das Ungelesene, das der Link zeigt) — damit
/// beide dasselbe sagen.
/// </para>
/// </summary>
internal static class ChatReaders
{
    /// <summary>
    /// SQL: aus der Tabellenvariable <c>@keys (k, seat, role)</c> die Leser
    /// <c>@who (k, principal)</c> — der Platz und die Konten — und
    /// <c>@own (k, role)</c> — die Personen, deren Nachrichten seine eigenen sind.
    /// </summary>
    public static readonly string Fill = $"""
        DECLARE @own TABLE (k uniqueidentifier NOT NULL, role uniqueidentifier NOT NULL);
        DECLARE @who TABLE (k uniqueidentifier NOT NULL, principal uniqueidentifier NOT NULL);

        INSERT INTO @own (k, role)
        SELECT k, role FROM @keys WHERE role IS NOT NULL
        UNION
        SELECT g.k, h.role_id FROM @keys g JOIN app.access_holder h ON h.access_id = g.seat
         WHERE h.until IS NULL OR h.until > SYSDATETIMEOFFSET()
        UNION
        SELECT g.k, r.role_id FROM @keys g JOIN app.registration r ON r.access_id = g.seat
         WHERE r.role_id IS NOT NULL AND r.withdrawn_at IS NULL;

        /* Die Konten darüber: wer die Person hält (über `holds`, wie `Workspace.RolesOfAsync` hinab). */
        WITH up (k, id, depth) AS (
            SELECT k, role, 0 FROM @own
            UNION ALL
            SELECT u.k, e.from_role_id, u.depth + 1
            FROM up u
            JOIN app.role_edge e ON e.to_role_id = u.id AND {RoleEdges.Live("e")} AND e.edge_kind = N'holds'
            WHERE u.depth < {RoleGraph.MaxDepth}
        )
        INSERT INTO @who (k, principal)
        SELECT DISTINCT u.k, a.id FROM up u JOIN app.account a ON a.person_role_id = u.id
        OPTION (MAXRECURSION {RoleGraph.MaxDepth + 1});

        INSERT INTO @who (k, principal) SELECT k, seat FROM @keys WHERE seat IS NOT NULL;
        """;

    /// <summary>SQL: bis wann einer der Leser von <paramref name="k"/> die Rozmowa <paramref name="chat"/> gelesen hat (NULL: keiner).</summary>
    public static string ReadPoint(string k, string chat) => $"""
        (SELECT MAX(t.at) FROM (
            SELECT p.read_at AS at FROM app.chat_presence p JOIN @who w ON w.principal = p.principal_id
             WHERE w.k = {k} AND p.chat_id = {chat}
            UNION ALL
            SELECT r.read_at FROM app.chat_read r JOIN @who w ON w.principal = r.account_id
             WHERE w.k = {k} AND r.chat_id = {chat}) t)
        """;

    /// <summary>
    /// SQL: die Nachricht <c>m</c> ist ungelesen für <paramref name="k"/> —
    /// gesendet, nicht gelöscht, nicht seine eigene, und nach <paramref name="readAt"/>.
    /// </summary>
    public static string Unread(string k, string seat, string readAt) => $"""
        (m.schedule_state = N'sent' AND m.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 WHERE m.author_access_id = {seat}
                                    OR EXISTS (SELECT 1 FROM @own o WHERE o.k = {k} AND (o.role = m.author_person_id OR o.role = m.author_role_id)))
         AND m.created_at > COALESCE({readAt}, '0001-01-01'))
        """;
}
