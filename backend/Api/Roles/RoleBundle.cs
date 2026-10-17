using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DER WEG VON EINER ROLLE ZU IHREN BEREICHEN — als Hüllen, für wen kein Konto
/// hat (0091).
///
/// <para>
/// Ein Konto läuft diesen Weg mit dem ganzen Rollengraphen (<c>Ring.walk</c>).
/// Ein Link mit Zugang und ein Platz haben keinen Graphen, aber einen
/// Ausgangsschlüssel: der Link den seiner Linkrolle (aus seinem Geheimnis),
/// der Platz den der Rolle seines Formulars (unter dem Platzschlüssel). Von
/// dort braucht der Browser genau das hier:
/// </para>
///
/// <code>
///   roles        jede erreichte Rolle mit ihrem versiegelten privaten Verpackungsschlüssel
///   roleGrants   wer welche Rolle hält — der Rollenschlüssel, für den Halter verpackt
///   epochGrants  die Epochen der Bereiche, für die erreichten Rollen verpackt
///   areas        Name und Kalender der Bereiche (der Name liegt ohnehin offen)
/// </code>
///
/// <para>
/// <b>Der Dienst öffnet nichts davon.</b> Es sind dieselben Hüllen, die ein
/// Halter der Rolle bekäme; aufmachen kann sie nur, wer den Ausgangsschlüssel
/// hat. Herausgegeben wird nur, was von den Ausgangsrollen aus erreichbar ist
/// — wer dorthin fragen darf, entscheidet der Aufrufer.
/// </para>
/// </summary>
internal static class RoleBundle
{
    internal static async Task<object> BuildAsync(SqlConnection connection, IReadOnlyCollection<Guid> start, CancellationToken ct)
    {
        var reach = await Workspace.ClosureAsync(connection, start, ct);
        if (reach.Count == 0) return new { roles = Array.Empty<object>(), roleGrants = Array.Empty<object>(), epochGrants = Array.Empty<object>(), areas = Array.Empty<object>() };

        var ids = reach.Select(r => r.Id).ToList();
        var names = string.Join(", ", ids.Select((_, i) => $"@r{i}"));
        void Bind(SqlCommand cmd) { for (var i = 0; i < ids.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", ids[i]); }

        /* Was jede Rolle selbst darf (ihre Zertifikate) — daran wählt der Browser, als wer er schreibt. */
        var rights = new Dictionary<Guid, List<object>>();
        await using (var cmd = new SqlCommand($"""
            SELECT subject_role_id, scope_id, capability FROM app.certificate
            WHERE scope_kind = N'area' AND revoked_at IS NULL AND expires_at > @now
              AND capability IN (N'read', N'write', N'admin') AND subject_role_id IN ({names});
            """, connection))
        {
            Bind(cmd);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var role = reader.GetGuid(0);
                if (!rights.TryGetValue(role, out var list)) rights[role] = list = [];
                list.Add(new { areaId = Ids.ToText(reader.GetGuid(1)), capability = reader.GetString(2) });
            }
        }

        var roles = new List<object>();
        await using (var cmd = new SqlCommand($"SELECT id, kind, wrap_private_sealed FROM app.role WHERE id IN ({names});", connection))
        {
            Bind(cmd);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var id = reader.GetGuid(0);
                roles.Add(new
                {
                    roleId = Ids.ToText(id),
                    kind = reader.GetString(1),
                    wrapPrivateSealed = reader.IsDBNull(2) ? null : Base64Url.Encode((byte[])reader[2]),
                    rights = rights.TryGetValue(id, out var list) ? list : []
                });
            }
        }

        /* Nur `role` (Lesen) — den Signierschlüssel braucht hier niemand: ohne Konto unterschreibt keiner. */
        var roleGrants = new List<object>();
        await using (var cmd = new SqlCommand($"""
            SELECT g.role_id, g.key_ref, g.sealed_blob FROM app.key_grant g
            JOIN app.role_edge e ON e.from_role_id = g.role_id AND e.to_role_id = g.key_ref
                                AND e.revoked_at IS NULL AND e.edge_kind = N'holds'
            WHERE g.key_kind = N'role' AND g.destroyed_at IS NULL AND g.key_epoch IS NULL
              AND g.role_id IN ({names}) AND g.key_ref IN ({names});
            """, connection))
        {
            Bind(cmd);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                roleGrants.Add(new
                {
                    holderRoleId = Ids.ToText(reader.GetGuid(0)),
                    roleId = Ids.ToText(reader.GetGuid(1)),
                    sealedBlob = Base64Url.Encode((byte[])reader[2])
                });
            }
        }

        var epochGrants = new List<object>();
        var areaIds = new HashSet<Guid>();
        await using (var cmd = new SqlCommand($"""
            SELECT role_id, key_ref, key_epoch, sealed_blob FROM app.key_grant
            WHERE key_kind = N'epoch' AND destroyed_at IS NULL AND key_epoch IS NOT NULL AND role_id IN ({names})
            ORDER BY key_ref, key_epoch;
            """, connection))
        {
            Bind(cmd);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                areaIds.Add(reader.GetGuid(1));
                epochGrants.Add(new
                {
                    roleId = Ids.ToText(reader.GetGuid(0)),
                    areaId = Ids.ToText(reader.GetGuid(1)),
                    epoch = reader.GetInt32(2),
                    sealedBlob = Base64Url.Encode((byte[])reader[3])
                });
            }
        }

        return new { roles, roleGrants, epochGrants, areas = await AreasAsync(connection, areaIds, ct) };
    }

    /// <summary>Name und Kalender je Bereich — ohne die Kennung wüsste, wer kein Konto hat, nicht, WAS er öffnen kann.</summary>
    internal static async Task<List<object>> AreasAsync(SqlConnection connection, IReadOnlyCollection<Guid> areaIds, CancellationToken ct)
    {
        var out_ = new List<object>();
        if (areaIds.Count == 0) return out_;

        var list = areaIds.ToList();
        var names = string.Join(", ", list.Select((_, i) => $"@a{i}"));
        var areaName = new Dictionary<Guid, string>();
        var calendars = new Dictionary<Guid, List<object>>();

        await using (var cmd = new SqlCommand($"SELECT id, name FROM app.area WHERE id IN ({names});", connection))
        {
            for (var i = 0; i < list.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", list[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) areaName[reader.GetGuid(0)] = reader.GetString(1);
        }

        await using (var cmd = new SqlCommand($"SELECT area_id, id, title, time_zone FROM app.calendar WHERE area_id IN ({names});", connection))
        {
            for (var i = 0; i < list.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", list[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var area = reader.GetGuid(0);
                if (!calendars.TryGetValue(area, out var found)) calendars[area] = found = [];
                found.Add(new { calendarId = Ids.ToText(reader.GetGuid(1)), title = reader.GetString(2), timeZone = reader.GetString(3) });
            }
        }

        foreach (var (id, name) in areaName.OrderBy(a => a.Value))
        {
            out_.Add(new { areaId = Ids.ToText(id), name, calendars = calendars.TryGetValue(id, out var found) ? found : [] });
        }
        return out_;
    }
}
