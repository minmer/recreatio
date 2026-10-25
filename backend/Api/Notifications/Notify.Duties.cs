using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0129–0131 — SPRAWY DO DECYZJI: was ein Mensch entscheiden oder wissen muss.
///
/// <list type="bullet">
///   <item>Administrator danych: Bitten an die Heimat, Angebote an den Bereich, Entscheidungen
///   über die eigenen Bitten, Bereiche, für die niemand mehr geradesteht, Datensätze ohne
///   angenommene Bedingungen oder Bestätigung;</item>
///   <item>der Betreiber: neue Meldungen und Widersprüche;</item>
///   <item>der Verfasser: was von ihm nach einer Meldung gesperrt ist;</item>
///   <item>Listen von Wydarzenia: Bitten, darin zu stehen.</item>
/// </list>
/// Alles aus dem Stand der Tabellen, wie der Rest der Glocke — nichts wird als Nachricht gespeichert.
/// </summary>
public static partial class Notify
{
    private static readonly TimeSpan DutyNotice = TimeSpan.FromDays(30);

    private static async Task<object> DutiesAsync(
        SqlConnection connection, Guid account, IReadOnlyList<Guid> mine, DateTimeOffset now, IConfiguration? config, CancellationToken ct)
    {
        var asks = new List<object>();
        var offers = new List<object>();
        var decided = new List<object>();
        var nobody = new List<object>();
        var missing = new List<object>();

        if (mine.Count > 0)
        {
            var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
            var adminAreas = $"""
                SELECT scope_id FROM app.certificate
                WHERE scope_kind = N'area' AND capability = N'admin' AND revoked_at IS NULL AND expires_at > @now
                  AND subject_role_id IN ({names})
                """;

            await using var cmd = new SqlCommand($"""
                /* Bitten an Datensätze mit Heimat in meinen Bereichen. */
                SELECT TOP 30 x.id, a.name, v.name, d.home_area_id
                FROM app.controller_attachment x
                JOIN app.data_controller d ON d.id = x.controller_id
                JOIN app.data_controller_version v ON v.controller_id = d.id AND v.version = d.current_version
                LEFT JOIN app.area a ON a.id = x.area_id
                WHERE x.state = N'asked' AND d.home_area_id IN ({adminAreas})
                ORDER BY x.asked_at;

                /* Angebote an meine Bereiche. */
                SELECT TOP 30 x.id, x.area_id, a.name, v.name
                FROM app.controller_attachment x
                JOIN app.data_controller d ON d.id = x.controller_id
                JOIN app.data_controller_version v ON v.controller_id = d.id AND v.version = d.current_version
                LEFT JOIN app.area a ON a.id = x.area_id
                WHERE x.state = N'offered' AND x.area_id IN ({adminAreas});

                /* Was aus meinen Bitten und Angeboten wurde (die letzten Wochen). */
                SELECT TOP 30 x.id, x.area_id, a.name, v.name, x.state
                FROM app.controller_attachment x
                JOIN app.data_controller d ON d.id = x.controller_id
                JOIN app.data_controller_version v ON v.controller_id = d.id AND v.version = d.current_version
                LEFT JOIN app.area a ON a.id = x.area_id
                WHERE x.decided_at > @since AND x.state IN (N'live', N'refused')
                  AND (x.asked_by_role_id IN ({names}) OR (x.asked_by_role_id IS NULL AND x.signed_by_role_id IN ({names})))
                  AND (x.decided_by_role_id IS NULL OR x.decided_by_role_id NOT IN ({names}));

                /* Bereiche, die ich führe und für die seit Kurzem niemand mehr geradesteht. */
                WITH mine_admin AS ({adminAreas}),
                chain AS (
                    SELECT m.scope_id AS start, m.scope_id AS id, 0 AS depth FROM mine_admin m
                    UNION ALL
                    SELECT c.start, a.parent_area_id, c.depth + 1 FROM chain c JOIN app.area a ON a.id = c.id
                     WHERE a.parent_area_id IS NOT NULL AND c.depth < 16
                ),
                lost AS (
                    SELECT DISTINCT c.start FROM chain c
                    JOIN app.controller_attachment x ON x.area_id = c.id AND x.state = N'ended' AND x.ended_at > @since
                         AND x.ended_reason <> N'replaced'
                    UNION
                    SELECT p.area_id FROM app.area_parent_ended p WHERE p.ended_at > @since AND p.area_id IN (SELECT scope_id FROM mine_admin)
                )
                SELECT TOP 30 l.start, a.name FROM lost l JOIN app.area a ON a.id = l.start
                WHERE NOT EXISTS (SELECT 1 FROM chain c2 JOIN app.controller_attachment y ON y.area_id = c2.id AND y.state = N'live'
                                   WHERE c2.start = l.start)
                OPTION (MAXRECURSION 20);

                /* Datensätze mit Heimat in meinen Bereichen ohne die heutigen Bedingungen, ohne Bestätigung, ohne Anschrift. */
                SELECT TOP 30 d.id, v.name, d.home_area_id,
                       CASE WHEN EXISTS (SELECT 1 FROM app.controller_terms t WHERE t.controller_id = d.id AND t.terms_version = @terms) THEN 1 ELSE 0 END,
                       CASE WHEN v.authority_confirmed_at IS NULL THEN 0 ELSE 1 END,
                       CASE WHEN v.address IS NULL OR v.email IS NULL OR v.authority IS NULL THEN 0 ELSE 1 END
                FROM app.data_controller d
                JOIN app.data_controller_version v ON v.controller_id = d.id AND v.version = d.current_version
                WHERE d.closed_at IS NULL AND d.home_area_id IN ({adminAreas})
                  AND (v.authority_confirmed_at IS NULL OR v.address IS NULL OR v.email IS NULL OR v.authority IS NULL
                       OR NOT EXISTS (SELECT 1 FROM app.controller_terms t WHERE t.controller_id = d.id AND t.terms_version = @terms));
                """, connection);
            cmd.Parameters.AddWithValue("@now", now);
            cmd.Parameters.AddWithValue("@since", now - DutyNotice);
            cmd.Parameters.AddWithValue("@terms", Controllers.TermsVersion);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                asks.Add(new { attachmentId = Ids.ToText(reader.GetGuid(0)), areaName = reader.IsDBNull(1) ? null : reader.GetString(1), controllerName = reader.GetString(2), homeAreaId = Ids.ToText(reader.GetGuid(3)) });
            await reader.NextResultAsync(ct);
            while (await reader.ReadAsync(ct))
                offers.Add(new { attachmentId = Ids.ToText(reader.GetGuid(0)), areaId = Ids.ToText(reader.GetGuid(1)), areaName = reader.IsDBNull(2) ? null : reader.GetString(2), controllerName = reader.GetString(3) });
            await reader.NextResultAsync(ct);
            while (await reader.ReadAsync(ct))
                decided.Add(new { attachmentId = Ids.ToText(reader.GetGuid(0)), areaId = Ids.ToText(reader.GetGuid(1)), areaName = reader.IsDBNull(2) ? null : reader.GetString(2), controllerName = reader.GetString(3), state = reader.GetString(4) });
            await reader.NextResultAsync(ct);
            while (await reader.ReadAsync(ct))
                nobody.Add(new { areaId = Ids.ToText(reader.GetGuid(0)), areaName = reader.GetString(1) });
            await reader.NextResultAsync(ct);
            while (await reader.ReadAsync(ct))
                missing.Add(new
                {
                    controllerId = Ids.ToText(reader.GetGuid(0)), name = reader.GetString(1), homeAreaId = Ids.ToText(reader.GetGuid(2)),
                    terms = reader.GetInt32(3) == 1, confirmed = reader.GetInt32(4) == 1, complete = reader.GetInt32(5) == 1
                });
        }

        /* Der Betreiber: was auf ihn wartet. */
        var isOperator = false;
        var reports = 0;
        if (config is not null && await Reports.OperatorRoleAsync(connection, config, ct) is { } op && mine.Contains(op))
        {
            isOperator = true;
            await using var cmd = new SqlCommand("SELECT COUNT(*) FROM app.report WHERE state IN (N'received', N'objected');", connection);
            reports = (int)(await cmd.ExecuteScalarAsync(ct))!;
        }

        var takedowns = await Reports.AuthoredAsync(connection, mine, ct);
        var listings = await AreaEvent.WaitingAsync(connection, account, isOperator, ct);

        return new
        {
            count = asks.Count + offers.Count + reports + listings.Count,
            controllers = new { asks, offers, decided, nobody, missing },
            reports = new { count = reports, isOperator },
            takedowns,
            listings
        };
    }
}
