using System.Security.Cryptography;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 21.6 — Der Weg vom Wurzelschluessel zu einem Rollenschluessel.
///
/// <b>Das ist nicht dieselbe Frage wie „darf ich".</b> <see cref="RcPermissions"/>
/// beantwortet, was jemand tun darf; diese Klasse beantwortet, was jemand
/// aufbekommt. Die beiden laufen absichtlich getrennt und muessen
/// uebereinstimmen — tun sie es nicht, ist das ein Befund und keine
/// Unbequemlichkeit:
///
///   • Berechtigt, aber ohne Schluessel: die Anzeige verspricht etwas, das
///     nicht einzuloesen ist.
///   • Schluessel, aber unberechtigt: die Berechtigungspruefung ist Zierrat,
///     denn wer den Schluessel hat, braucht sie nicht.
///
/// <b>Der Lauf.</b>
/// <code>
///   MasterKey ─derive→ persoenliche Rolle ─wrap_private→ Zuteilung → Rolle R
///                                                             │
///                                                    ─wrap_private→ Zuteilung → Rolle S
/// </code>
///
/// Nur die persoenliche Rolle wird ABGELEITET, und nur sie darf es: ein
/// abgeleiteter Schluessel gehoert genau einem Konto. Alles weitere ist
/// gewrappt (21.6), denn eine Rolle kann mehrere Halter haben.
///
/// Jede Stufe kostet eine RSA-Entschluesselung. Der Lauf hoert deshalb auf,
/// sobald das Gesuchte gefunden ist, und was er findet, gilt nur fuer diese
/// eine Anfrage. Ein Zwischenspeicher ueber Anfragen hinweg waere ein zweiter
/// Ort, an dem Schluesselmaterial liegt — und der erste ist schon einer zu viel
/// (3.9).
/// </summary>
public sealed class RcRoleAccess(RcDb db)
{
    public const int MaxDepth = RcRoleGraph.MaxDepth;

    /// <summary>
    /// Der Schluessel EINER Rolle, oder <c>null</c>, wenn dieses Konto keinen
    /// Weg dorthin hat.
    ///
    /// <c>null</c> heisst nicht „gibt es nicht", sondern „nicht fuer dich" —
    /// und der Aufrufer darf den Unterschied nicht nach aussen tragen.
    /// </summary>
    public async Task<byte[]?> RoleKeyAsync(
        Guid accountId, byte[] masterKey, Guid targetRoleId, CancellationToken ct = default)
    {
        await using var connection = await db.OpenAsync(ct);
        return await RoleKeyAsync(connection, accountId, masterKey, targetRoleId, ct);
    }

    public static async Task<byte[]?> RoleKeyAsync(
        SqlConnection connection, Guid accountId, byte[] masterKey, Guid targetRoleId, CancellationToken ct = default)
    {
        var found = new Dictionary<Guid, byte[]>();
        await WalkAsync(connection, accountId, masterKey, found, targetRoleId, ct);
        return found.TryGetValue(targetRoleId, out var key) ? key : null;
    }

    /// <summary>
    /// Alle erreichbaren Rollenschluessel. Fuer Anzeigen, die mehrere Rollen auf
    /// einmal brauchen — etwa „unter welchem Namen schreibe ich wo".
    /// </summary>
    public static async Task<Dictionary<Guid, byte[]>> AllRoleKeysAsync(
        SqlConnection connection, Guid accountId, byte[] masterKey, CancellationToken ct = default)
    {
        var found = new Dictionary<Guid, byte[]>();
        await WalkAsync(connection, accountId, masterKey, found, null, ct);
        return found;
    }

    /// <summary>
    /// Der Lauf selbst. <paramref name="target"/> <c>null</c> heisst: alles
    /// einsammeln statt beim ersten Treffer aufzuhoeren.
    /// </summary>
    private static async Task WalkAsync(
        SqlConnection connection, Guid accountId, byte[] masterKey,
        Dictionary<Guid, byte[]> found, Guid? target, CancellationToken ct)
    {
        // Stufe 0: die persoenlichen Rollen. Sie haengen ueber
        // rc_role_edge.from_account_id am Graphen, und NUR fuer sie ist der
        // Schluessel ableitbar.
        var frontier = new List<Guid>();
        await using (var cmd = new SqlCommand("""
            SELECT e.to_role_id
            FROM dbo.rc_role_edge e
            JOIN dbo.rc_role r ON r.id = e.to_role_id AND r.revoked_at IS NULL
            WHERE e.from_account_id = @account
              AND e.revoked_at IS NULL
              AND (e.expires_at IS NULL OR e.expires_at > @now)
              AND r.kind = @person;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@account", accountId);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@person", RcRoleKinds.Person);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var roleId = reader.GetGuid(0);
                found[roleId] = RcRoleKeys.PersonalRoleKey(masterKey, roleId);
                frontier.Add(roleId);
            }
        }

        if (target is not null && found.ContainsKey(target.Value)) return;

        // Stufe 1..n: den Zuteilungen folgen.
        for (var depth = 0; depth < MaxDepth && frontier.Count > 0; depth++)
        {
            var grants = await LoadGrantsAsync(connection, frontier, ct);
            if (grants.Count == 0) return;

            var identities = await LoadIdentitiesAsync(connection, frontier, ct);
            var next = new List<Guid>();

            foreach (var grant in grants)
            {
                if (found.ContainsKey(grant.GrantedRoleId)) continue;
                if (!identities.TryGetValue(grant.HolderRoleId, out var holder)) continue;
                if (!found.TryGetValue(grant.HolderRoleId, out var holderKey)) continue;

                try
                {
                    using var wrapKey = RcRoleKeys.OpenWrapKey(holder, holderKey);
                    found[grant.GrantedRoleId] =
                        RcRoleKeys.OpenGrant(wrapKey, grant.GrantedRoleId, grant.SealedBlob);
                    next.Add(grant.GrantedRoleId);
                }
                catch (RcDecryptException)
                {
                    // Eine Zuteilung, die sich nicht oeffnen laesst, ist ein
                    // Befund — aber kein Grund, den ganzen Lauf abzubrechen und
                    // damit auch die Rollen zu verlieren, die in Ordnung sind.
                    // Sie bleibt schlicht unerreichbar.
                }

                if (target is not null && found.ContainsKey(target.Value)) return;
            }

            frontier = next;
        }
    }

    private sealed record GrantRow(Guid HolderRoleId, Guid GrantedRoleId, byte[] SealedBlob);

    private static async Task<List<GrantRow>> LoadGrantsAsync(
        SqlConnection connection, IReadOnlyList<Guid> holders, CancellationToken ct)
    {
        var names = string.Join(", ", holders.Select((_, i) => $"@h{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT role_id, key_ref, sealed_blob
            FROM dbo.rc_role_key_grant
            WHERE key_kind = @kind
              AND destroyed_at IS NULL
              AND role_id IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@kind", RcGrantKinds.RoleKey);
        for (var i = 0; i < holders.Count; i++) cmd.Parameters.AddWithValue($"@h{i}", holders[i]);

        var rows = new List<GrantRow>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            rows.Add(new GrantRow(reader.GetGuid(0), reader.GetGuid(1), (byte[])reader[2]));
        }
        return rows;
    }

    public static async Task<Dictionary<Guid, RcRoleIdentity>> LoadIdentitiesAsync(
        SqlConnection connection, IReadOnlyList<Guid> roleIds, CancellationToken ct)
    {
        if (roleIds.Count == 0) return [];

        var names = string.Join(", ", roleIds.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT id, sign_public_key, wrap_public_key, sign_private_sealed, wrap_private_sealed,
                   key_fingerprint, key_version
            FROM dbo.rc_role
            WHERE revoked_at IS NULL AND id IN ({names});
            """, connection);

        for (var i = 0; i < roleIds.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roleIds[i]);

        var map = new Dictionary<Guid, RcRoleIdentity>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            map[reader.GetGuid(0)] = new RcRoleIdentity
            {
                RoleId = reader.GetGuid(0),
                SignPublicKey = (byte[])reader[1],
                WrapPublicKey = (byte[])reader[2],
                SignPrivateSealed = (byte[])reader[3],
                WrapPrivateSealed = (byte[])reader[4],
                Fingerprint = (byte[])reader[5],
                KeyVersion = reader.GetInt32(6)
            };
        }
        return map;
    }

    /// <summary>
    /// Der Signierschluessel einer erreichbaren Rolle. Er liegt nur waehrend
    /// dieser Anfrage offen; der Aufrufer MUSS ihn entsorgen.
    /// </summary>
    public static async Task<RSA?> OpenSignKeyAsync(
        SqlConnection connection, Guid accountId, byte[] masterKey, Guid roleId, CancellationToken ct = default)
    {
        var roleKey = await RoleKeyAsync(connection, accountId, masterKey, roleId, ct);
        if (roleKey is null) return null;

        var identities = await LoadIdentitiesAsync(connection, [roleId], ct);
        return identities.TryGetValue(roleId, out var identity)
            ? RcRoleKeys.OpenSignKey(identity, roleKey)
            : null;
    }
}

/// <summary>
/// 3.1 — Diese Zeichenketten stehen in <c>rc_role.kind</c>. Der Kernel
/// interpretiert sie NICHT; er kennt genau eine Ausnahme, und die steht hier:
/// <see cref="Person"/> markiert die Wurzel des Schluesselwegs. Ohne diese eine
/// Unterscheidung gaebe es keinen Anfang, von dem aus abgeleitet wird.
/// </summary>
public static class RcRoleKinds
{
    public const string Person = "person";
    public const string Group = "group";
    public const string Office = "office";
}

/// <summary>Die Werte aus <c>ck_rc_role_key_grant_kind</c>.</summary>
/// <summary>
/// Die Werte aus <c>ck_rc_role_key_grant_kind</c>.
///
/// <b>BEFUND 43.</b> <see cref="RoleKey"/> kam mit <c>rc_0004</c> hinzu. Zuvor
/// stand hier <see cref="DataKey"/> fuer beides — fuer den Schluessel einer
/// ROLLE und fuer den eines DATENELEMENTS. Das war nicht bloss unsauber:
/// die Loeschung durch Schluesselvernichtung (12.3.2 Weg b) vernichtet alle
/// <c>data_key</c>-Zuteilungen eines Elements. Haetten Rollen dieselbe Art
/// getragen, haette eine Loeschung die Rolle selbst mit ausgesperrt.
///
/// Der Unterschied zwischen <i>was diese Rolle IST</i> und <i>was diese Rolle
/// WEISS</i> gehoert in die Spalte, nicht in den Kopf dessen, der die Abfrage
/// schreibt.
/// </summary>
public static class RcGrantKinds
{
    public const string Epoch = "epoch";
    public const string SharedView = "shared_view";

    /// <summary>Der Schluessel eines DATENELEMENTS (rc_data_item).</summary>
    public const string DataKey = "data_key";

    /// <summary>Der Schluessel einer ROLLE, zugeteilt an ihren Halter (21.6).</summary>
    public const string RoleKey = "role_key";

    public const string Recovery = "recovery";
}
