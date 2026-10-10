using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// LINKS MIT ZUGANG (0065) — ein Link, der einem Konto Zugang zu einem oder
/// mehreren Bereichen gibt: lesen, schreiben oder verwalten.
///
/// <para>
/// <b>Der Link ist eine ROLLE.</b> Wer ihn anlegt, legt im Browser eine
/// Rolle an („Link: Rada parafialna"), gibt ihr die Zugänge zu den Bereichen
/// (Zertifikate und Schlüssel, wie jeder anderen Rolle) und versiegelt ihre
/// beiden Schlüssel unter einem Schlüssel, der aus dem Geheimnis im Link
/// abgeleitet ist. Wer den Link einlöst, hängt seine Person an diese Rolle —
/// mit einer Kante, die ER unterschreibt, und einer Zuteilung, die SEIN
/// Browser verpackt. Der Dienst sieht weder das Geheimnis noch einen Schlüssel.
/// </para>
///
/// <code>
///   T          32 Zufallsbytes, nur im Link (#/dolacz/T)
///   proof      HKDF(T, "recreatio:v1:invite:proof") — geht beim Einlösen hinaus
///   lookup     SHA-256(proof) — darunter liegt der Link (token_sha256)
///   sealKey    HKDF(T, "recreatio:v1:invite:seal") — versiegelt die Rollenschlüssel; bleibt im Browser
/// </code>
///
/// <para>
/// <b>Einmal oder öfter.</b> <c>max_uses</c> 1 heisst: nach dem Einlösen ist
/// der Link verbraucht. Zurückziehen geht jederzeit — wahlweise auch so, dass
/// alle, die über ihn hereinkamen, den Zugang wieder verlieren.
/// </para>
/// </summary>
public static partial class Roles
{
    private const int MaxInviteUses = 1_000_000;

    private static void MapInvites(WebApplication app)
    {
        app.MapPost("/workspace/invites", CreateInviteAsync);
        app.MapGet("/workspace/invites", ListInvitesAsync);
        app.MapPost("/workspace/invite/{id:guid}/revoke", RevokeInviteAsync);
        app.MapPost("/workspace/invite/redeem", RedeemInviteAsync);

        app.MapPost("/workspace/invite/{id:guid}/aim", AimInviteAsync);

        /* Ohne Konto: wer den Link öffnet, soll sehen, wozu er einlädt, bevor er sich anmeldet. */
        app.MapGet("/invite/{lookup}", ShowInviteAsync);

        /* 0073 — ohne Konto: die Schlüssel der Links, die dieser Browser hält (HeldLinks). */
        app.MapPost("/links/keys", HeldKeysAsync);
    }

    public sealed record InviteRequest(
        string? InvitationId, string? RoleId, string? TokenSha256, string? SealedRoleKey,
        string? Label, int? MaxUses, int? ExpiresDays, string? Capability,

        /* 0072 — das Geheimnis, versiegelt unter dem Schlüssel der Linkrolle: zum Wiederzeigen. */
        string? TokenSealed = null,

        /* 0073 — wo der Link aufgeht (der Weg hinter `#/`). */
        string? Aim = null);

    public sealed record AimRequest(string? Aim);

    public sealed record HeldRequest(string[]? Proofs);

    public sealed record RedeemRequest(
        string? Proof, string? HolderRoleId, EdgeProof? Edge, string? GrantSealedBlob, string? SignGrantSealedBlob);

    public sealed record RevokeInviteRequest(bool DropMembers);

    /// <summary>Was an einem Antrag auf einen Link nicht stimmt — oder <c>null</c>.</summary>
    public static string? CheckInvite(InviteRequest body)
    {
        if (!Guid.TryParse(body.InvitationId, out _) || !Guid.TryParse(body.RoleId, out _)) return "Nieczytelna kennung.";
        if (!Base64Url.TryDecode(body.TokenSha256, out var token) || token.Length != 32) return "Odcisk linku musi mieć 32 bajty.";
        if (!Base64Url.TryDecode(body.SealedRoleKey, out var sealedKey) || sealedKey.Length is < 48 or > 8192) return "Zapieczętowane klucze linku są nieczytelne.";
        if ((body.Label?.Length ?? 0) > 200) return "Opis linku: najwyżej 200 znaków.";
        if (body.MaxUses is < 1) return "Link musi dać się użyć co najmniej raz.";
        if (body.ExpiresDays is < 1 or > 3650) return "Ważność: od jednego dnia do dziesięciu lat.";
        if (body.Capability is not ("read" or "write" or "admin")) return "Dostęp: odczyt, zapis albo zarządzanie.";
        if (body.TokenSealed is not null && (!Base64Url.TryDecode(body.TokenSealed, out var tokenSealed) || tokenSealed.Length is < 32 or > 512))
            return "Zapieczętowany link jest nieczytelny.";
        return HeldLinks.NormaliseAim(body.Aim).Error;
    }

    /// <summary>Die Rollen, die dieses Konto FÜHRT — nur über sie lässt sich ein Link anlegen oder zurückziehen.</summary>
    private static async Task<HashSet<Guid>> LedAsync(SqlConnection connection, Guid accountId, CancellationToken ct)
    {
        var person = await PersonRoleAsync(connection, null, accountId, ct);
        if (person is null) return [];
        var (_, edges) = await GraphAsync(connection, null, ct);
        return RoleGraph.Reachable(person.Value, Held(edges));
    }

    private static async Task CreateInviteAsync(HttpContext ctx, Db db, InviteRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wrong = CheckInvite(body);
        if (wrong is not null) { await Fail(ctx, StatusCodes.Status400BadRequest, wrong); return; }

        var id = Guid.Parse(body.InvitationId!);
        var roleId = Guid.Parse(body.RoleId!);

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var led = await LedAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!led.Contains(roleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Link może dawać tylko rolę, którą prowadzisz.");
            return;
        }

        /* Wer ihn anlegt — die Person, die die Linkrolle hält (die erste, die sie erreicht). */
        var person = await PersonRoleAsync(connection, null, who.Value.AccountId, ctx.RequestAborted);
        var (_, edges) = await GraphAsync(connection, null, ctx.RequestAborted);
        var creator = edges.Where(e => e.To == roleId && e.Kind == HoldsEdge && led.Contains(e.From)).Select(e => e.From).FirstOrDefault();
        if (creator == Guid.Empty) creator = person!.Value;

        await using var insert = new SqlCommand("""
            INSERT INTO app.invitation
                (id, role_id, token_sha256, sealed_role_key, label, max_uses, used_count,
                 created_by_role_id, created_at, expires_at, edge_kind, capability, purpose, token_sealed, aim)
            VALUES (@id, @role, @token, @sealed, @label, @max, 0, @by, @now, @expires, N'holds', @cap, N'area-link', @tokenSealed, @aim);
            """, connection);
        insert.Parameters.Add("@aim", System.Data.SqlDbType.NVarChar, HeldLinks.MaxAim).Value =
            (object?)HeldLinks.NormaliseAim(body.Aim).Aim ?? DBNull.Value;
        var now = DateTimeOffset.UtcNow;
        insert.Parameters.AddWithValue("@id", id);
        insert.Parameters.AddWithValue("@role", roleId);
        insert.Parameters.AddWithValue("@token", Base64Url.Decode(body.TokenSha256!));
        insert.Parameters.AddWithValue("@sealed", Base64Url.Decode(body.SealedRoleKey!));
        insert.Parameters.AddWithValue("@label", string.IsNullOrWhiteSpace(body.Label) ? DBNull.Value : body.Label.Trim());
        insert.Parameters.AddWithValue("@max", Math.Min(body.MaxUses ?? MaxInviteUses, MaxInviteUses));
        insert.Parameters.AddWithValue("@by", creator);
        insert.Parameters.AddWithValue("@now", now);
        insert.Parameters.AddWithValue("@expires", now.AddDays(body.ExpiresDays ?? 30));
        insert.Parameters.AddWithValue("@cap", body.Capability!);
        insert.Parameters.Add("@tokenSealed", System.Data.SqlDbType.VarBinary, 512).Value =
            body.TokenSealed is null ? DBNull.Value : Base64Url.Decode(body.TokenSealed);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten link już jest.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { invitationId = Ids.ToText(id) });
    }

    /// <summary>
    /// Die Bereiche, zu denen eine Rolle Zugang hat — mit Namen (sie liegen im
    /// Klartext). 0091: auch über die Rollen, die sie hält — ein Link, der
    /// „Rada parafialna" gibt, gibt deren Bereiche.
    /// </summary>
    internal static async Task<List<object>> AreasOfRoleAsync(SqlConnection connection, Guid roleId, CancellationToken ct)
    {
        var reach = (await Workspace.ClosureAsync(connection, [roleId], ct)).Select(r => r.Id).ToList();
        if (reach.Count == 0) return [];
        var names = string.Join(", ", reach.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT a.id, a.name, c.capability
            FROM app.certificate c JOIN app.area a ON a.id = c.scope_id
            WHERE c.scope_kind = N'area' AND c.subject_role_id IN ({names}) AND c.revoked_at IS NULL AND c.expires_at > @now
            ORDER BY a.name;
            """, connection);
        for (var i = 0; i < reach.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", reach[i]);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        var areas = new Dictionary<Guid, (string Name, string Capability)>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var id = reader.GetGuid(0);
            var capability = reader.GetString(2);
            /* Je Bereich die stärkste Stufe — eine Zuteilung je Epoche bringt dasselbe Zertifikat mehrfach. */
            if (!areas.TryGetValue(id, out var had) || Rank(capability) > Rank(had.Capability)) areas[id] = (reader.GetString(1), capability);
        }
        return areas.Select(a => (object)new { areaId = Ids.ToText(a.Key), name = a.Value.Name, capability = a.Value.Capability }).ToList();

        static int Rank(string c) => c switch { "admin" => 3, "write" => 2, "read" => 1, _ => 0 };
    }

    /// <summary>0091 — die Rollen, die eine (Link-)Rolle unmittelbar hält: das, was der Link gibt.</summary>
    internal static async Task<List<string>> HeldRoleIdsAsync(SqlConnection connection, Guid roleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT e.to_role_id FROM app.role_edge e JOIN app.role r ON r.id = e.to_role_id AND r.revoked_at IS NULL
            WHERE e.from_role_id = @role AND e.revoked_at IS NULL AND e.edge_kind = N'holds'
            ORDER BY e.created_at;
            """, connection);
        cmd.Parameters.AddWithValue("@role", roleId);
        var held = new List<string>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) held.Add(Ids.ToText(reader.GetGuid(0)));
        return held;
    }

    private static async Task ListInvitesAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var led = (await LedAsync(connection, who.Value.AccountId, ctx.RequestAborted)).ToList();
        var rows = new List<(Guid Id, Guid Role, string? Label, int Max, int Used, DateTimeOffset Created, DateTimeOffset Expires, DateTimeOffset? Revoked, string? Capability, byte[]? TokenSealed, string? Aim)>();

        if (led.Count > 0)
        {
            var names = string.Join(", ", led.Select((_, i) => $"@r{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT id, role_id, label, max_uses, used_count, created_at, expires_at, revoked_at, capability, token_sealed, aim
                FROM app.invitation
                WHERE purpose = N'area-link' AND created_by_role_id IN ({names})
                ORDER BY created_at DESC;
                """, connection);
            for (var i = 0; i < led.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", led[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((reader.GetGuid(0), reader.GetGuid(1), reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.GetInt32(3), reader.GetInt32(4), reader.GetDateTimeOffset(5), reader.GetDateTimeOffset(6),
                    reader.IsDBNull(7) ? null : reader.GetDateTimeOffset(7), reader.IsDBNull(8) ? null : reader.GetString(8),
                    reader.IsDBNull(9) ? null : (byte[])reader[9], reader.IsDBNull(10) ? null : reader.GetString(10)));
            }
        }

        var invites = new List<object>();
        foreach (var row in rows)
        {
            var redeemed = new List<object>();
            await using (var cmd = new SqlCommand("""
                SELECT r.role_id, r.redeemed_at,
                       CASE WHEN EXISTS (SELECT 1 FROM app.role_edge e WHERE e.from_role_id = r.role_id AND e.to_role_id = @role
                                          AND e.revoked_at IS NULL) THEN 1 ELSE 0 END
                FROM app.invitation_redemption r WHERE r.invitation_id = @id ORDER BY r.redeemed_at;
                """, connection))
            {
                cmd.Parameters.AddWithValue("@id", row.Id);
                cmd.Parameters.AddWithValue("@role", row.Role);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted))
                {
                    redeemed.Add(new { roleId = Ids.ToText(reader.GetGuid(0)), at = reader.GetDateTimeOffset(1), active = reader.GetInt32(2) == 1 });
                }
            }

            invites.Add(new
            {
                invitationId = Ids.ToText(row.Id),
                roleId = Ids.ToText(row.Role),
                label = row.Label,
                capability = row.Capability,
                maxUses = row.Max >= MaxInviteUses ? (int?)null : row.Max,
                used = row.Used,
                createdAt = row.Created,
                expiresAt = row.Expires,
                revokedAt = row.Revoked,
                tokenSealed = row.TokenSealed is null ? null : Base64Url.Encode(row.TokenSealed),
                aim = row.Aim,
                areas = await AreasOfRoleAsync(connection, row.Role, ctx.RequestAborted),

                /* 0091 — die Rollen, die der Link gibt (ihre Namen öffnet der Browser). Leer: ein Link der alten Art, direkt zu Bereichen. */
                roles = await HeldRoleIdsAsync(connection, row.Role, ctx.RequestAborted),
                redeemed
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { invites });
    }

    private static string? InviteState(int max, int used, DateTimeOffset expires, DateTimeOffset? revoked, DateTimeOffset now) =>
        revoked is not null ? "revoked" : expires <= now ? "expired" : used >= max ? "used" : null;

    /// <summary>Was ein Link gibt — ohne Konto lesbar. Die versiegelten Schlüssel nützen nur dem, der den Link hat.</summary>
    private static async Task ShowInviteAsync(HttpContext ctx, Db db, string lookup)
    {
        if (!Base64Url.TryDecode(lookup, out var hash) || hash.Length != 32)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego linku nie ma.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            SELECT i.id, i.role_id, i.sealed_role_key, i.label, i.max_uses, i.used_count, i.expires_at,
                   CASE WHEN r.revoked_at IS NOT NULL THEN COALESCE(i.revoked_at, r.revoked_at) ELSE i.revoked_at END,
                   i.capability, i.edge_kind, i.aim
            FROM app.invitation i JOIN app.role r ON r.id = i.role_id
            WHERE i.token_sha256 = @token AND i.purpose = N'area-link';
            """, connection);
        cmd.Parameters.AddWithValue("@token", hash);

        (Guid Id, Guid Role, byte[] Sealed, string? Label, int Max, int Used, DateTimeOffset Expires, DateTimeOffset? Revoked, string? Capability, string? EdgeKind, string? Aim)? row = null;
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                row = (reader.GetGuid(0), reader.GetGuid(1), (byte[])reader[2], reader.IsDBNull(3) ? null : reader.GetString(3),
                    reader.GetInt32(4), reader.GetInt32(5), reader.GetDateTimeOffset(6),
                    reader.IsDBNull(7) ? null : reader.GetDateTimeOffset(7), reader.IsDBNull(8) ? null : reader.GetString(8),
                    reader.IsDBNull(9) ? null : reader.GetString(9), reader.IsDBNull(10) ? null : reader.GetString(10));
            }
        }

        if (row is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego linku nie ma."); return; }

        var r = row.Value;
        await ctx.Response.WriteAsJsonAsync(new
        {
            invitationId = Ids.ToText(r.Id),
            roleId = Ids.ToText(r.Role),
            label = r.Label,
            capability = r.Capability,
            edgeKind = r.EdgeKind ?? HoldsEdge,
            state = InviteState(r.Max, r.Used, r.Expires, r.Revoked, DateTimeOffset.UtcNow),
            once = r.Max == 1,
            expiresAt = r.Expires,
            sealedRoleKey = Base64Url.Encode(r.Sealed),
            aim = r.Aim,
            areas = await AreasOfRoleAsync(connection, r.Role, ctx.RequestAborted),
            roles = await HeldRoleIdsAsync(connection, r.Role, ctx.RequestAborted)
        });
    }

    /// <summary>Wohin ein Link führt — ändern darf es, wer ihn angelegt hat. Der Link selbst bleibt gültig; nur neu verschickte Adressen tragen das neue Ziel.</summary>
    private static async Task AimInviteAsync(HttpContext ctx, Db db, Guid id, AimRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var (aim, error) = HeldLinks.NormaliseAim(body.Aim);
        if (error is not null) { await Fail(ctx, StatusCodes.Status400BadRequest, error); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var led = await LedAsync(connection, who.Value.AccountId, ctx.RequestAborted);

        Guid by = Guid.Empty;
        await using (var cmd = new SqlCommand("SELECT created_by_role_id FROM app.invitation WHERE id = @id AND purpose = N'area-link';", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is Guid found) by = found;
        }
        if (by == Guid.Empty || !led.Contains(by)) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego linku nie ma."); return; }

        await using (var cmd = new SqlCommand("UPDATE app.invitation SET aim = @aim WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.Add("@aim", System.Data.SqlDbType.NVarChar, HeldLinks.MaxAim).Value = (object?)aim ?? DBNull.Value;
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        await ctx.Response.WriteAsJsonAsync(new { invitationId = Ids.ToText(id), aim });
    }

    /// <summary>
    /// DIE SCHLÜSSEL DER LINKS IN DIESEM BROWSER (0073) — ohne Konto. Für jeden
    /// Beweis, dessen Link gilt: die versiegelten Rollenschlüssel (aufzumachen
    /// nur mit T), der versiegelte private Verpackungsschlüssel der Linkrolle
    /// und ihre Zuteilungen der Bereichsepochen. Daraus baut der Browser die
    /// Schlüssel, mit denen er Kalender und Seiten dieser Bereiche öffnet.
    /// </summary>
    private static async Task HeldKeysAsync(HttpContext ctx, Db db, HeldRequest body)
    {
        var proofs = (body.Proofs ?? [])
            .Select(p => Base64Url.TryDecode(p, out var bytes) && bytes.Length == 32 ? bytes : null)
            .Where(p => p is not null).Select(p => p!).Take(HeldLinks.Max).ToList();

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var held = await HeldLinks.ValidAsync(connection, proofs, ctx.RequestAborted);
        var links = new List<object>();

        foreach (var link in held)
        {
            string? label = null, capability = null, aim = null;
            byte[]? sealedKey = null, wrapPrivate = null;
            DateTimeOffset expires = default;
            await using (var cmd = new SqlCommand("""
                SELECT i.label, i.capability, i.aim, i.sealed_role_key, i.expires_at, r.wrap_private_sealed
                FROM app.invitation i JOIN app.role r ON r.id = i.role_id WHERE i.id = @id;
                """, connection))
            {
                cmd.Parameters.AddWithValue("@id", link.InvitationId);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                if (!await reader.ReadAsync(ctx.RequestAborted)) continue;
                label = reader.IsDBNull(0) ? null : reader.GetString(0);
                capability = reader.IsDBNull(1) ? null : reader.GetString(1);
                aim = reader.IsDBNull(2) ? null : reader.GetString(2);
                sealedKey = (byte[])reader[3];
                expires = reader.GetDateTimeOffset(4);
                wrapPrivate = reader.IsDBNull(5) ? null : (byte[])reader[5];
            }

            var grants = new List<object>();
            await using (var cmd = new SqlCommand("""
                SELECT key_ref, key_epoch, sealed_blob FROM app.key_grant
                WHERE key_kind = N'epoch' AND destroyed_at IS NULL AND key_epoch IS NOT NULL AND role_id = @role
                ORDER BY key_ref, key_epoch;
                """, connection))
            {
                cmd.Parameters.AddWithValue("@role", link.RoleId);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted))
                {
                    grants.Add(new { areaId = Ids.ToText(reader.GetGuid(0)), epoch = reader.GetInt32(1), sealedBlob = Base64Url.Encode((byte[])reader[2]) });
                }
            }

            links.Add(new
            {
                lookup = Base64Url.Encode(link.Lookup),
                invitationId = Ids.ToText(link.InvitationId),
                roleId = Ids.ToText(link.RoleId),
                label,
                capability,
                aim,
                expiresAt = expires,
                sealedRoleKey = Base64Url.Encode(sealedKey!),
                wrapPrivateSealed = wrapPrivate is null ? null : Base64Url.Encode(wrapPrivate),
                areas = await AreasOfRoleAsync(connection, link.RoleId, ctx.RequestAborted),
                grants,

                /*
                 * 0091 — DER WEG ZU DEN ROLLEN, DIE DER LINK GIBT: ihre Hüllen, wer sie
                 * hält, ihre Epochen. Aufzumachen mit dem Schlüssel der Linkrolle,
                 * also nur mit T.
                 */
                bundle = await RoleBundle.BuildAsync(connection, [link.RoleId], ctx.RequestAborted)
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { links });
    }

    /// <summary>
    /// DEN LINK EINLÖSEN: die eigene Person an die Linkrolle hängen.
    ///
    /// <para>
    /// Der Beweis (<c>proof</c>) zeigt, dass der Browser das Geheimnis kennt —
    /// ohne es preiszugeben. Kante und Zuteilungen kommen fertig aus dem
    /// Browser; hier wird geprüft, dass die Kante von der Person unterschrieben
    /// ist, dass kein Kreis entsteht, und dass der Link noch gilt — alles in
    /// EINER Transaktion, damit ein einmaliger Link nicht zweimal aufgeht.
    /// </para>
    /// </summary>
    private static async Task RedeemInviteAsync(HttpContext ctx, Db db, Push push, RedeemRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Base64Url.TryDecode(body.Proof, out var proof) || proof.Length != 32
            || !Guid.TryParse(body.HolderRoleId, out var holderId) || body.Edge is null || !Guid.TryParse(body.Edge.Id, out var edgeId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny link albo podpis.");
            return;
        }

        if (!TryBlobs(ctx, out var fail, (body.GrantSealedBlob, "grantSealedBlob"), (body.Edge.Signature, "signature")))
        {
            await fail;
            return;
        }

        var createdAt = DateTimeOffset.FromUnixTimeSeconds(body.Edge.CreatedAt);
        if (!IsFresh(createdAt)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Data podpisu nie zgadza się z zegarem."); return; }

        var lookup = SHA256.HashData(proof);

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var person = await PersonRoleAsync(connection, null, who.Value.AccountId, ctx.RequestAborted);
        if (person is null) { await Fail(ctx, StatusCodes.Status403Forbidden, "Nie masz jeszcze roli osobistej."); return; }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ctx.RequestAborted);

        (Guid Id, Guid Role, int Max, int Used, DateTimeOffset Expires, DateTimeOffset? Revoked, string EdgeKind, string Capability)? invite = null;
        await using (var cmd = new SqlCommand("""
            SELECT id, role_id, max_uses, used_count, expires_at, revoked_at, COALESCE(edge_kind, N'holds'), COALESCE(capability, N'read')
            FROM app.invitation WITH (UPDLOCK, HOLDLOCK) WHERE token_sha256 = @token AND purpose = N'area-link';
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@token", lookup);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted))
            {
                invite = (reader.GetGuid(0), reader.GetGuid(1), reader.GetInt32(2), reader.GetInt32(3), reader.GetDateTimeOffset(4),
                    reader.IsDBNull(5) ? null : reader.GetDateTimeOffset(5), reader.GetString(6), reader.GetString(7));
            }
        }

        if (invite is null) { await tx.RollbackAsync(ctx.RequestAborted); await Fail(ctx, StatusCodes.Status404NotFound, "Takiego linku nie ma."); return; }
        var inv = invite.Value;
        var state = InviteState(inv.Max, inv.Used, inv.Expires, inv.Revoked, DateTimeOffset.UtcNow);
        if (state is not null)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status410Gone, state switch
            {
                "revoked" => "Ten link został wycofany.",
                "expired" => "Ten link wygasł.",
                _ => "Ten link został już wykorzystany."
            });
            return;
        }

        var (roles, edges) = await GraphAsync(connection, tx, ctx.RequestAborted);

        /* Die Linkrolle selbst zurückgenommen (im Rollengraphen) — dann gilt auch der Link nicht mehr. */
        if (!roles.Any(r => r.Id == inv.Role))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status410Gone, "Ten link został wycofany.");
            return;
        }

        var links = Held(edges);
        var reachable = RoleGraph.Reachable(person.Value, links);
        var holder = roles.FirstOrDefault(r => r.Id == holderId);

        if (holder is null || !reachable.Contains(holderId) || holderId == person.Value || holder.Kind != "person")
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status403Forbidden, "Link przyjmuje Twoja osoba — nie konto ani cudza rola.");
            return;
        }

        if (reachable.Contains(inv.Role))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten dostęp już masz.");
            return;
        }

        if (RoleGraph.WouldCreateCycle(holderId, inv.Role, links)
            || !VerifyEdge(holder.SignPublic, edgeId, holderId, inv.Role, holderId, createdAt, Base64Url.Decode(body.Edge.Signature), inv.EdgeKind))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis dołączenia się nie zgadza.");
            return;
        }

        await InsertEdgeAsync(connection, tx, edgeId, holderId, inv.Role, holderId, createdAt,
            Base64Url.Decode(body.Edge.Signature), inv.EdgeKind, ctx.RequestAborted);
        await InsertGrantAsync(connection, tx, holderId, inv.Role, Base64Url.Decode(body.GrantSealedBlob!), holderId, ctx.RequestAborted);
        /*
         * DEN SIGNIERSCHLÜSSEL NUR BEI „ZARZĄDZANIE": wer verwalten soll, muss im
         * Namen der Linkrolle Zertifikate ausstellen. Wer liest oder schreibt,
         * braucht ihn nicht — und ohne ihn kann er die Rolle nicht weitergeben.
         */
        if (!string.IsNullOrWhiteSpace(body.SignGrantSealedBlob) && inv.EdgeKind == HoldsEdge && inv.Capability == "admin"
            && Base64Url.TryDecode(body.SignGrantSealedBlob, out var signGrant))
        {
            await InsertGrantAsync(connection, tx, holderId, inv.Role, signGrant, holderId, ctx.RequestAborted, "role_sign");
        }

        await using (var used = new SqlCommand("""
            INSERT INTO app.invitation_redemption (invitation_id, role_id, redeemed_at) VALUES (@id, @holder, @now);
            UPDATE app.invitation SET used_count = used_count + 1 WHERE id = @id;
            """, connection, tx))
        {
            used.Parameters.AddWithValue("@id", inv.Id);
            used.Parameters.AddWithValue("@holder", holderId);
            used.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await used.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await tx.CommitAsync(ctx.RequestAborted);
        push.Link(inv.Id, who.Value.AccountId);
        await ctx.Response.WriteAsJsonAsync(new { roleId = Ids.ToText(inv.Role), areas = await AreasOfRoleAsync(connection, inv.Role, ctx.RequestAborted) });
    }

    /// <summary>
    /// Einen Link zurückziehen. <c>dropMembers</c>: auch wer über ihn
    /// hereinkam, verliert den Zugang — die Kanten zur Linkrolle fallen, mit
    /// ihren Zuteilungen. (Was schon gelesen wurde, ist gelesen; Neues sieht er
    /// nach dem Wechsel der Epoche nicht mehr.)
    /// </summary>
    private static async Task RevokeInviteAsync(HttpContext ctx, Db db, Guid id, RevokeInviteRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var led = await LedAsync(connection, who.Value.AccountId, ctx.RequestAborted);

        Guid? role = null;
        Guid by = Guid.Empty;
        await using (var cmd = new SqlCommand("SELECT role_id, created_by_role_id FROM app.invitation WHERE id = @id AND purpose = N'area-link';", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted)) { role = reader.GetGuid(0); by = reader.GetGuid(1); }
        }

        /* Zurückziehen darf, wer ihn angelegt hat — nicht, wer über ihn hereinkam (der führt die Linkrolle auch). */
        if (role is null || !led.Contains(by))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego linku nie ma.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        var now = DateTimeOffset.UtcNow;
        await using (var cmd = new SqlCommand("UPDATE app.invitation SET revoked_at = COALESCE(revoked_at, @now) WHERE id = @id;", connection, tx))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@now", now);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        var dropped = 0;
        if (body.DropMembers)
        {
            await using var drop = new SqlCommand("""
                UPDATE app.role_edge SET revoked_at = @now
                 WHERE to_role_id = @role AND revoked_at IS NULL
                   AND from_role_id IN (SELECT role_id FROM app.invitation_redemption WHERE invitation_id = @id);
                UPDATE app.key_grant SET destroyed_at = @now
                 WHERE key_ref = @role AND key_kind IN (N'role', N'role_sign') AND destroyed_at IS NULL
                   AND role_id IN (SELECT role_id FROM app.invitation_redemption WHERE invitation_id = @id);
                """, connection, tx);
            drop.Parameters.AddWithValue("@id", id);
            drop.Parameters.AddWithValue("@role", role.Value);
            drop.Parameters.AddWithValue("@now", now);
            dropped = await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { invitationId = Ids.ToText(id), revoked = true, dropped = dropped > 0 });
    }
}
