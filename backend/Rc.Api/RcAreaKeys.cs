using System.Security.Cryptography;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 9.x — Epochen: warum Verlassen billig bleibt.
///
/// <b>Das Problem.</b> Jemand verlaesst einen Bereich. Er soll kuenftige
/// Nachrichten nicht mehr lesen koennen. Die naheliegende Antwort — alles neu
/// verschluesseln — ist bei zehntausend Nachrichten eine Stunde Rechenzeit und
/// bei jedem Austritt erneut. In einer Pfarrgemeinde treten Leute staendig aus
/// und ein.
///
/// <b>Die Antwort: ein Schnitt statt einer Neuverschluesselung.</b>
///
/// <code>
///   Epoche 1        Epoche 2                 Epoche 3
///   ┌──────────┐    ┌──────────────────┐     ┌────────────────
///   │ Nachr. 1 │    │ Nachr. 4         │     │ Nachr. 9
///   │ Nachr. 2 │    │ Nachr. 5 … 8     │     │ …
///   │ Nachr. 3 │    │                  │     │
///   └──────────┘    └──────────────────┘     └────────────────
///        ▲                  ▲                        ▲
///   Schluessel 1       Schluessel 2             Schluessel 3
///
///   Anna:  1, 2, 3   ← alles, sie war von Anfang an dabei
///   Bruno:    2, 3   ← ab seinem Beitritt
///   Clara: 1, 2      ← sie ist gegangen; Epoche 3 entstand DESHALB
/// </code>
///
/// Wer geht, behaelt genau das, was er ohnehin schon gelesen hatte — und das
/// ist keine Luecke, sondern eine Tatsache: er hat es gesehen. Ihm rueckwirkend
/// das Gedaechtnis zu nehmen ist ein Versprechen, das keine Software halten
/// kann; so zu tun als koennte sie es, waere die eigentliche Unehrlichkeit.
///
/// <b>Wo die Schluessel liegen.</b> In derselben Tabelle wie die
/// Rollenschluessel: <c>rc_role_key_grant</c> mit <c>key_kind = 'epoch'</c>,
/// <c>key_ref</c> = Bereich, <c>key_epoch</c> = Nummer. Verpackt unter dem
/// oeffentlichen Verpackungsschluessel der MITGLIEDSROLLE — der Aufnehmende
/// braucht dafuer nichts vom Aufgenommenen ausser dessen oeffentlichem
/// Schluessel (21.6).
/// </summary>
public static class RcAreaKeys
{
    /// <summary>Die Gruende aus <c>ck_rc_area_epoch_reason</c>.</summary>
    public const string ReasonInitial = "initial";
    public const string ReasonMemberLeft = "member_left";
    public const string ReasonMemberAdded = "member_added";
    public const string ReasonRotation = "rotation";

    /// <summary>
    /// Alle Epochenschluessel eines Bereichs, die dieses Konto oeffnen kann.
    ///
    /// Der Rueckgabewert ist absichtlich eine LUECKENHAFTE Abbildung: fehlt
    /// Epoche 1, ist das kein Fehler, sondern die Auskunft „vor deiner Zeit".
    /// Der Lesepfad muss damit umgehen koennen, statt die ganze Anzeige
    /// scheitern zu lassen (15.9).
    /// </summary>
    public static async Task<Dictionary<int, byte[]>> EpochKeysAsync(
        SqlConnection connection, Guid accountId, byte[] masterKey, Guid areaId, CancellationToken ct = default)
    {
        var roleKeys = await RcRoleAccess.AllRoleKeysAsync(connection, accountId, masterKey, ct);
        if (roleKeys.Count == 0) return [];

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, roleKeys.Keys.ToList(), ct);

        var names = string.Join(", ", roleKeys.Keys.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT role_id, key_epoch, sealed_blob
            FROM dbo.rc_role_key_grant
            WHERE key_kind = @kind AND key_ref = @area AND destroyed_at IS NULL
              AND role_id IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@kind", RcGrantKinds.Epoch);
        cmd.Parameters.AddWithValue("@area", areaId);
        var i = 0;
        foreach (var roleId in roleKeys.Keys) cmd.Parameters.AddWithValue($"@r{i++}", roleId);

        var rows = new List<(Guid RoleId, int Epoch, byte[] Blob)>();
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
                rows.Add((reader.GetGuid(0), reader.GetInt32(1), (byte[])reader[2]));
        }

        var keys = new Dictionary<int, byte[]>();
        foreach (var (roleId, epoch, blob) in rows)
        {
            if (keys.ContainsKey(epoch)) continue;
            if (!identities.TryGetValue(roleId, out var identity)) continue;
            if (!roleKeys.TryGetValue(roleId, out var roleKey)) continue;

            try
            {
                using var wrapKey = RcRoleKeys.OpenWrapKey(identity, roleKey);
                keys[epoch] = RcCrypto.UnwrapKey(wrapKey, EpochAad(areaId, epoch), blob);
            }
            catch (RcDecryptException)
            {
                // Eine Zuteilung, die sich nicht oeffnen laesst, ist ein Befund —
                // aber kein Grund, die restlichen Epochen mit zu verlieren.
            }
        }
        return keys;
    }

    /// <summary>
    /// Etwas oeffnen, ohne zu wissen, unter welcher Epoche es liegt.
    ///
    /// Titel von Bereichen und Themen tragen keine Epochennummer: sie entstehen
    /// einmal und aendern sich nicht, wenn geschnitten wird. Statt eine Spalte
    /// dafuer zu fuehren — die dann irgendwann nicht mehr stimmt — werden die
    /// vorhandenen Schluessel der Reihe nach probiert.
    ///
    /// Wer eine Epoche nicht hat, liest den Titel nicht. Das ist richtig so und
    /// keine Luecke: es entspricht genau dem, was er auch von den Nachrichten
    /// darunter nicht liest.
    /// </summary>
    public static string? TryOpenText(IReadOnlyDictionary<int, byte[]> keys, RcAad aad, byte[] blob)
    {
        foreach (var key in keys.OrderBy(k => k.Key).Select(k => k.Value))
        {
            try { return System.Text.Encoding.UTF8.GetString(RcCrypto.Open(key, aad, blob)); }
            catch (RcDecryptException) { /* naechste Epoche */ }
        }
        return null;
    }

    /// <summary>Genau eine Epoche, meist die laufende — zum Schreiben.</summary>
    public static async Task<byte[]?> EpochKeyAsync(
        SqlConnection connection, Guid accountId, byte[] masterKey, Guid areaId, int epoch,
        CancellationToken ct = default)
    {
        var keys = await EpochKeysAsync(connection, accountId, masterKey, areaId, ct);
        return keys.TryGetValue(epoch, out var key) ? key : null;
    }

    /// <summary>
    /// Einen neuen Epochenschluessel erzeugen, die Epoche eintragen und sie
    /// allen genannten Rollen zuteilen.
    ///
    /// <paramref name="members"/> ist die Liste NACH der Aenderung. Wer geht,
    /// steht nicht mehr darin — und bekommt deshalb keine Zuteilung. Das ist
    /// der ganze Mechanismus; es gibt keinen zweiten Schritt, der ihn aussperrt.
    /// </summary>
    public static async Task<int> CutEpochAsync(
        SqlConnection connection, SqlTransaction tx, Guid areaId, string reason,
        IReadOnlyDictionary<Guid, byte[]> members, Guid grantedByRoleId, byte[]? epochKey = null,
        CancellationToken ct = default)
    {
        int epoch;
        await using (var next = new SqlCommand(
            "SELECT ISNULL(MAX(epoch), 0) + 1 FROM dbo.rc_area_epoch WHERE area_id = @area;", connection, tx))
        {
            next.Parameters.AddWithValue("@area", areaId);
            epoch = Convert.ToInt32(await next.ExecuteScalarAsync(ct), System.Globalization.CultureInfo.InvariantCulture);
        }

        await using (var insert = new SqlCommand(
            "INSERT INTO dbo.rc_area_epoch (area_id, epoch, created_at, reason) VALUES (@area, @epoch, @now, @reason);",
            connection, tx))
        {
            insert.Parameters.AddWithValue("@area", areaId);
            insert.Parameters.AddWithValue("@epoch", epoch);
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            insert.Parameters.AddWithValue("@reason", reason);
            await insert.ExecuteNonQueryAsync(ct);
        }

        // Der Aufrufer darf den Schluessel mitbringen. Das Anlegen eines
        // Bereichs braucht ihn naemlich SCHON VORHER: der Titel liegt darunter.
        // Ohne diesen Weg haette der Bereich einen Titel, den niemand oeffnet —
        // versiegelt unter einem Schluessel, den es nur waehrend eines
        // Methodenaufrufs gab.
        var ownsKey = epochKey is null;
        epochKey ??= RcCrypto.NewSymmetricKey();
        try
        {
            foreach (var (roleId, wrapPublicKey) in members)
                await GrantAsync(connection, tx, roleId, areaId, epoch, epochKey, wrapPublicKey, grantedByRoleId, ct);
        }
        finally
        {
            if (ownsKey) CryptographicOperations.ZeroMemory(epochKey);
        }

        await using var bump = new SqlCommand(
            "UPDATE dbo.rc_area SET current_epoch = @epoch WHERE id = @area;", connection, tx);
        bump.Parameters.AddWithValue("@epoch", epoch);
        bump.Parameters.AddWithValue("@area", areaId);
        await bump.ExecuteNonQueryAsync(ct);

        return epoch;
    }

    /// <summary>Einen bestehenden Epochenschluessel an eine weitere Rolle geben.</summary>
    public static async Task GrantAsync(
        SqlConnection connection, SqlTransaction? tx, Guid roleId, Guid areaId, int epoch,
        byte[] epochKey, byte[] wrapPublicKey, Guid grantedByRoleId, CancellationToken ct = default)
    {
        using var rsa = RSA.Create();
        rsa.ImportSubjectPublicKeyInfo(wrapPublicKey, out _);
        var sealedBlob = RcCrypto.WrapKey(rsa, EpochAad(areaId, epoch), epochKey);

        await using var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_role_key_grant
                (id, role_id, key_kind, key_ref, key_epoch, sealed_blob, granted_by_role_id, granted_at)
            VALUES
                (@id, @role, @kind, @area, @epoch, @blob, @by, @now);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", RcId.NewId());
        cmd.Parameters.AddWithValue("@role", roleId);
        cmd.Parameters.AddWithValue("@kind", RcGrantKinds.Epoch);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@epoch", epoch);
        cmd.Parameters.AddWithValue("@blob", sealedBlob);
        cmd.Parameters.AddWithValue("@by", grantedByRoleId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// 12.3.2 Weg (b) — Loeschung durch Schluesselvernichtung. Es MUSS
    /// protokolliert werden, WELCHER Schluessel WANN vernichtet wurde; sonst ist
    /// der Vollzug nicht nachweisbar, und „geloescht" bleibt eine Behauptung.
    /// </summary>
    public static async Task DestroyGrantsAsync(
        SqlConnection connection, SqlTransaction tx, Guid roleId, Guid areaId, string reason,
        CancellationToken ct = default)
    {
        await using var cmd = new SqlCommand("""
            UPDATE dbo.rc_role_key_grant
            SET destroyed_at = @now, destroyed_reason = @reason
            WHERE role_id = @role AND key_kind = @kind AND key_ref = @area AND destroyed_at IS NULL;
            """, connection, tx);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@reason", reason);
        cmd.Parameters.AddWithValue("@role", roleId);
        cmd.Parameters.AddWithValue("@kind", RcGrantKinds.Epoch);
        cmd.Parameters.AddWithValue("@area", areaId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Die Mitglieder eines Bereichs mit ihren oeffentlichen
    /// Verpackungsschluesseln. Mitgliedschaft IST ein Zertifikat auf den Bereich
    /// (3.5) — es gibt keine zweite Liste, die damit auseinanderlaufen koennte.
    /// </summary>
    public static async Task<Dictionary<Guid, byte[]>> MembersAsync(
        SqlConnection connection, SqlTransaction? tx, Guid areaId, CancellationToken ct = default)
    {
        await using var cmd = new SqlCommand("""
            SELECT DISTINCT r.id, r.wrap_public_key
            FROM dbo.rc_certificate c
            JOIN dbo.rc_role r ON r.id = c.subject_role_id AND r.revoked_at IS NULL
            WHERE c.scope_kind = 'area' AND c.scope_id = @area
              AND c.revoked_at IS NULL AND c.expires_at > @now;
            """, connection, tx);

        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        var members = new Dictionary<Guid, byte[]>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) members[reader.GetGuid(0)] = (byte[])reader[1];
        return members;
    }

    /// <summary>
    /// Die AAD eines Epochenschluessels nennt Bereich UND Epoche. Ohne die
    /// Epoche liesse sich eine Huelle von einer Epoche auf eine andere
    /// umhaengen — und der Schnitt, der jemanden aussperrt, waere wirkungslos.
    /// </summary>
    private static RcAad EpochAad(Guid areaId, int epoch) =>
        RcAad.Create("chat", "area_epoch", areaId, RcField.AreaEpochKey, epoch);
}
