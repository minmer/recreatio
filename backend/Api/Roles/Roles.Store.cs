using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Gemeinsames der Rollen: Befugnis, Graph, Zuteilungen, Unterschriften prüfen, Zeilen schreiben.</summary>
public static partial class Roles
{
    /* -- Gemeinsames -------------------------------------------------------- */

    /// <summary>Erreicht dieser Mensch die Rolle? Sonst gibt es sie für ihn nicht.</summary>
    private static async Task<bool> MayTouchAsync(HttpContext ctx, Db db, SqlConnection connection, Guid roleId)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return false; }

        var person = await PersonRoleAsync(connection, null, who.Value.AccountId, ctx.RequestAborted);
        if (person is null)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Nie masz jeszcze roli osobistej.");
            return false;
        }

        var (_, edges) = await GraphAsync(connection, null, ctx.RequestAborted);
        var reachable = RoleGraph.Reachable(person.Value, Held(edges));

        if (!reachable.Contains(roleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ta rola nie jest Twoja.");
            return false;
        }

        /*
         * 0065 — DIE ROLLE EINES LINKS führt auch, wer ihn eingelöst hat (sonst
         * gälten ihre Zertifikate für ihn nicht). Umbenennen, umtypen oder
         * zurücknehmen darf sie trotzdem nur, wer den Link angelegt hat — sonst
         * nähme der Erste, der ihn einlöst, allen anderen den Zugang.
         */
        await using (var link = new SqlCommand(
            "SELECT TOP 1 created_by_role_id FROM app.invitation WHERE role_id = @id AND purpose = N'area-link';", connection))
        {
            link.Parameters.AddWithValue("@id", roleId);
            if (await link.ExecuteScalarAsync(ctx.RequestAborted) is Guid creator && !reachable.Contains(creator))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Tą rolą zarządza ten, kto utworzył link.");
                return false;
            }
        }

        return true;
    }

    private static async Task<Guid?> PersonRoleAsync(
        SqlConnection connection, SqlTransaction? tx, Guid accountId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT person_role_id FROM app.account WHERE id = @id;", connection, tx);
        cmd.Parameters.AddWithValue("@id", accountId);

        return await cmd.ExecuteScalarAsync(ct) is Guid role ? role : null;
    }

    private static async Task<(List<RoleRow> Roles, List<EdgeRow> Edges)> GraphAsync(
        SqlConnection connection, SqlTransaction? tx, CancellationToken ct)
    {
        var roles = new List<RoleRow>();
        var edges = new List<EdgeRow>();

        await using (var cmd = new SqlCommand("""
            SELECT id, kind, display_name_sealed, wrap_public_key, sign_public_key,
                   key_layout,
                   wrap_private_sealed, sign_private_sealed, created_at
            FROM app.role WHERE revoked_at IS NULL;
            """, connection, tx))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                roles.Add(new RoleRow(
                    reader.GetGuid(0), reader.GetString(1),
                    reader.IsDBNull(2) ? null : (byte[])reader[2],
                    (byte[])reader[3], (byte[])reader[4],
                    reader.IsDBNull(6) ? null : (byte[])reader[6],
                    reader.IsDBNull(7) ? null : (byte[])reader[7],
                    reader.GetDateTimeOffset(8),
                    reader.GetByte(5)));
            }
        }

        await using (var cmd = new SqlCommand("""
            SELECT id, from_role_id, to_role_id, signer_role_id, edge_kind, created_at, expires_at
            FROM app.role_edge WHERE revoked_at IS NULL;
            """, connection, tx))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                edges.Add(new EdgeRow(
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetGuid(3),
                    reader.GetString(4), reader.GetDateTimeOffset(5),
                    reader.IsDBNull(6) ? null : reader.GetDateTimeOffset(6)));
            }
        }

        return (roles, edges);
    }

    private static async Task<List<(Guid Holder, Guid Granted, byte[] Blob, string Kind)>> GrantsAsync(
        SqlConnection connection, List<Guid> holders, CancellationToken ct)
    {
        var grants = new List<(Guid, Guid, byte[], string)>();
        if (holders.Count == 0) return grants;

        var names = string.Join(", ", holders.Select((_, i) => $"@h{i}"));
        await using var cmd = new SqlCommand(
            $"SELECT role_id, key_ref, sealed_blob, key_kind FROM app.key_grant "
            + $"WHERE key_kind IN (N'role', N'role_sign') AND destroyed_at IS NULL "
            + $"AND role_id IN ({names});", connection);

        for (var i = 0; i < holders.Count; i++) cmd.Parameters.AddWithValue($"@h{i}", holders[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            grants.Add((reader.GetGuid(0), reader.GetGuid(1), (byte[])reader[2], reader.GetString(3)));
        }

        return grants;
    }

    /// <summary>
    /// Die Unterschrift gegen den öffentlichen Schlüssel des Unterzeichners.
    ///
    /// <para>
    /// Der Kernel baut dieselbe kanonische Form, die der Browser unterschrieben
    /// hat. Weicht ein Feld ab — auch nur die Reihenfolge —, passt die
    /// Unterschrift nicht, und das ist die Absicht: sie hängt am ganzen Inhalt,
    /// nicht an einem Teil davon.
    /// </para>
    /// </summary>
    private static bool VerifyEdge(
        byte[] signerSpki, Guid edgeId, Guid from, Guid to, Guid signer,
        DateTimeOffset createdAt, byte[] signature, string edgeKind)
    {
        var record = new RoleEdgeRecord
        {
            Id = edgeId,
            FromRoleId = from,
            ToRoleId = to,
            EdgeKind = edgeKind,
            SignerRoleId = signer,
            CreatedUtc = createdAt
        };

        try
        {
            using var rsa = RSA.Create();
            rsa.ImportSubjectPublicKeyInfo(signerSpki, out _);
            return record.Verify(rsa, signature);
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    private static bool IsFresh(DateTimeOffset at)
    {
        var now = DateTimeOffset.UtcNow;
        return at <= now + ClockSlack && at >= now - ClockSlack;
    }

    private static async Task InsertRoleAsync(
        SqlConnection connection, SqlTransaction tx, Guid roleId, string kind,
        CreateRequest body, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO app.role
                (id, kind, display_name_sealed, wrap_public_key, sign_public_key,
                 wrap_private_sealed, sign_private_sealed, created_at, key_layout)
            VALUES (@id, @kind, @name, @wrapPub, @signPub, @wrapPriv, @signPriv, @now, @layout);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", roleId);
        cmd.Parameters.AddWithValue("@kind", kind);
        cmd.Parameters.AddBlob("@name",
            body.DisplayNameSealed is null ? null : Base64Url.Decode(body.DisplayNameSealed));
        cmd.Parameters.AddWithValue("@wrapPub", Base64Url.Decode(body.WrapPublicKey));
        cmd.Parameters.AddWithValue("@signPub", Base64Url.Decode(body.SignPublicKey));
        cmd.Parameters.AddWithValue("@wrapPriv", Base64Url.Decode(body.WrapPrivateSealed));
        cmd.Parameters.AddWithValue("@signPriv", Base64Url.Decode(body.SignPrivateSealed));
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@layout", body.SignGrantSealedBlob is null ? (byte)0 : (byte)1);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task InsertEdgeAsync(
        SqlConnection connection, SqlTransaction tx, Guid edgeId, Guid from, Guid to, Guid signer,
        DateTimeOffset createdAt, byte[] signature, string edgeKind, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO app.role_edge
                (id, from_role_id, to_role_id, signer_role_id, signature, edge_kind, created_at)
            VALUES (@id, @from, @to, @signer, @sig, @kind, @created);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", edgeId);
        cmd.Parameters.AddWithValue("@from", from);
        cmd.Parameters.AddWithValue("@to", to);
        cmd.Parameters.AddWithValue("@signer", signer);
        cmd.Parameters.AddWithValue("@sig", signature);
        cmd.Parameters.AddWithValue("@kind", edgeKind);

        // Derselbe Zeitpunkt, der unterschrieben wurde — auf die Sekunde. Sonst
        // liesse sich die Kante später nicht mehr nachprüfen.
        cmd.Parameters.AddWithValue("@created", createdAt);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Die Zuteilung des ROLLENSCHLUESSELS an einen Halter.
    ///
    /// <para>
    /// <b>Eine je Paarung, nicht eine je Kante</b> (0032). Der Schluessel ist
    /// ein Ding: wer ihn schon hat, bekommt ihn durch eine zweite Kante nicht
    /// noch einmal. Wird jemand von <c>read</c> auf <c>write</c> gehoben, ohne
    /// die alte Kante zu loesen, stuenden sonst zwei gleiche Zuteilungen da —
    /// und <c>ux_key_grant_one</c> lehnt die zweite ab, was als 500 herauskaeme.
    /// </para>
    ///
    /// <para>
    /// <b>Die bestehende wird NICHT ueberschrieben.</b> Sie ist unter dem
    /// oeffentlichen Schluessel desselben Halters verpackt und oeffnet
    /// dasselbe; sie zu ersetzen aenderte nichts ausser dem Zeitstempel. Was
    /// zaehlt, ist, dass am Ende genau eine dasteht.
    /// </para>
    /// </summary>
    private static async Task InsertGrantAsync(
        SqlConnection connection, SqlTransaction tx, Guid holderId, Guid grantedId,
        byte[] sealedBlob, Guid grantedBy, CancellationToken ct, string keyKind = "role")
    {
        await using var cmd = new SqlCommand("""
            IF NOT EXISTS (
                SELECT 1 FROM app.key_grant
                 WHERE role_id = @role AND key_kind = @kind AND key_ref = @ref
                   AND key_epoch IS NULL AND destroyed_at IS NULL)
            BEGIN
                INSERT INTO app.key_grant
                    (id, role_id, key_kind, key_ref, sealed_blob, granted_by_role_id, created_at)
                VALUES (@id, @role, @kind, @ref, @blob, @by, @now);
            END
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", Ids.NewId());
        cmd.Parameters.AddWithValue("@role", holderId);
        cmd.Parameters.AddWithValue("@kind", keyKind);
        cmd.Parameters.AddWithValue("@ref", grantedId);
        cmd.Parameters.AddWithValue("@blob", sealedBlob);
        cmd.Parameters.AddWithValue("@by", grantedBy);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Base64URL-Felder einlesen, die nicht fehlen dürfen. Ein unlesbares Feld
    /// bekommt seinen Namen genannt — „ungültig" allein liesse raten, welches
    /// von sechs gemeint ist.
    /// </summary>
    private static bool TryBlobs(
        HttpContext ctx, out Task fail, params (string? Value, string Name)[] fields)
    {
        foreach (var (value, name) in fields)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                fail = Fail(ctx, StatusCodes.Status400BadRequest, $"Brakuje pola „{name}”.");
                return false;
            }

            try { Base64Url.Decode(value); }
            catch (FormatException)
            {
                fail = Fail(ctx, StatusCodes.Status400BadRequest, $"Nieczytelne pole „{name}”.");
                return false;
            }
        }

        fail = Task.CompletedTask;
        return true;
    }
}
