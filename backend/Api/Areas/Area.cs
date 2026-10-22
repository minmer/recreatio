using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Bereiche — die Schlüssel, und sonst nichts.
///
/// <para>
/// <b>Drei Ordnungen, die einander nicht besitzen.</b> Der Bereich ist ein
/// benannter SCHLÜSSEL mit seinen Epochen. Die Rolle HÄLT Schlüssel, ist aber
/// keiner. Die Seite (<see cref="Slug"/>) hat ihre eigene Hierarchie und weiss
/// von beidem nichts. Sie treffen sich in Zertifikaten und Zuteilungen — nicht
/// in Fremdschlüsselspalten.
/// </para>
///
/// <para>
/// <b>Der Dienst sieht keinen Schlüssel.</b> Der Epochenschlüssel entsteht im
/// Browser, wird dort für den öffentlichen Verpackungsschlüssel jeder
/// Mitgliedsrolle verpackt und kommt als undurchsichtiger Block hier an. Der
/// Altbestand öffnete dafür den Hauptschlüssel im Auftrag; dieser Dienst kann
/// das nicht, und das ist der Gewinn.
/// </para>
///
/// <para>
/// <b>DARF und KANN sind zwei Dinge</b> (0001): ein Zertifikat ohne Schlüssel
/// darf lesen und kann es nicht; ein Schlüssel ohne Zertifikat kann und darf
/// nicht. Deshalb verlangt das Weitergeben ein Zertifikat und nicht den blossen
/// Besitz des Schlüssels — sonst wäre Besitz die Berechtigung, und die Trennung
/// wäre aufgegeben.
/// </para>
/// </summary>
public static partial class Area
{
    public const int MaxName = 200;

    /// <summary>Ein Schlüssel ist 32 Byte. Alles andere ist keiner.</summary>
    public const int KeySize = 32;

    /// <summary>
    /// 2026-10-22 — wie lange ein Zertifikat höchstens gilt: zwei Jahre (und ein
    /// Tag Spiel für Uhren). Nach einem Jahr erneuert es der Browser eines
    /// Aufnehmenden (<see cref="RenewBefore"/>, Area.Renew.cs).
    /// </summary>
    internal static readonly TimeSpan MaxLife = TimeSpan.FromDays(365 * 2 + 1);
    internal static readonly TimeSpan ClockSlack = TimeSpan.FromHours(1);

    public static void Map(WebApplication app)
    {
        app.MapPost("/workspace/area", CreateAsync);
        app.MapGet("/workspace/areas", ListAsync);
        app.MapGet("/workspace/area/{id:guid}/members", MembersAsync);

        /*
         * MEINE eigenen Huellen. Ohne sie kann ein Browser nach einem Neuladen
         * seinen eigenen Epochenschluessel nicht wiederfinden — und damit weder
         * offenlegen noch ein neues Feld versiegeln. Der Schluessel laege dann
         * allein im Speicher des Tabs, in dem der Bereich entstanden ist.
         */
        app.MapGet("/workspace/area/{id:guid}/keys", MyKeysAsync);
        app.MapPost("/workspace/area/{id:guid}/grant", GrantAsync);
        app.MapGet("/workspace/area/{id:guid}/renewals", RenewalsAsync);
        app.MapPost("/workspace/area/{id:guid}/renew", RenewAsync);

        /*
         * Die Gestalt eines Bereichs (0035): wie weit er nach aussen offen
         * steht, und was jemand sieht, der ueber ein Formular hereinkommt.
         */
        app.MapPost("/workspace/area/{id:guid}/public", SetPublicAsync);
        app.MapPost("/workspace/area/{id:guid}/seat-level", SetSeatLevelAsync);
        app.MapPost("/workspace/area/{id:guid}/drop", DropAsync);

        /* 0081 — umbenennen: wer den Bereich führt. */
        app.MapPost("/workspace/area/{id:guid}/name", RenameAsync);

        /*
         * ÖFFENTLICH, und das ist der ganze Punkt. Wer einen veröffentlichten
         * Epochenschlüssel holt, braucht kein Konto — sonst wäre „öffentlich"
         * bloss ein anderes Wort für „angemeldet".
         */
        app.MapGet("/area/{id:guid}/key", PublicKeyAsync);
    }

    /* -- Gemeinsames -------------------------------------------------------- */

    /// <summary>
    /// Darf diese Person hier, was sie vorhat?
    ///
    /// <para>
    /// Gefragt wird über ALLE erreichbaren Rollen — Erreichbarkeit im
    /// Rollengraphen IST der Weg zum Schlüssel (Kernel: RoleKeys), und eine
    /// zweite Auffassung davon liefe irgendwann anders.
    /// </para>
    /// </summary>
    /*
     * `internal`, nicht `private`: der Kalender fragt dieselbe Frage, und zwar
     * an vier Stellen. Eine zweite Fassung davon waere eine zweite Meinung
     * darueber, wer wo darf — und die eine davon liefe irgendwann anders.
     */
    internal static async Task<bool> MayAsync(
        SqlConnection connection, Guid accountId, Guid areaId, Capability needed, CancellationToken ct) =>
        await MayAsync(connection, await Workspace.RolesOfAsync(connection, accountId, ct), areaId, needed, ct);

    /// <summary>Dasselbe für einen Rufer — ein Konto oder die Links eines Browsers (<see cref="Caller"/>).</summary>
    internal static Task<bool> MayAsync(
        SqlConnection connection, Caller caller, Guid areaId, Capability needed, CancellationToken ct) =>
        MayAsync(connection, caller.Roles, areaId, needed, ct);

    private static async Task<bool> MayAsync(
        SqlConnection connection, List<Workspace.RoleRow> mine, Guid areaId, Capability needed, CancellationToken ct)
    {
        if (mine.Count == 0) return false;

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT capability FROM app.certificate
            WHERE scope_kind = N'area' AND scope_id = @area
              AND revoked_at IS NULL AND expires_at > @now
              AND subject_role_id IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i].Id);

        var held = new List<Capability>();

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            if (Capabilities.TryParse(reader.GetString(0), out var capability)) held.Add(capability);
        }

        return Capabilities.CoversAny(held, needed);
    }

    internal static async Task<byte[]?> PublicSignKeyAsync(
        SqlConnection connection, Guid roleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT sign_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection);

        cmd.Parameters.AddWithValue("@id", roleId);
        return await cmd.ExecuteScalarAsync(ct) as byte[];
    }

    internal static async Task GrantKeyAsync(
        SqlConnection connection, SqlTransaction tx, Guid roleId, Guid areaId, int epoch,
        byte[] wrapped, Guid byRoleId, DateTimeOffset now, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO app.key_grant
                (id, role_id, key_kind, key_ref, key_epoch, sealed_blob, granted_by_role_id, created_at)
            VALUES (@id, @role, N'epoch', @area, @epoch, @blob, @by, @now);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", Ids.NewId());
        cmd.Parameters.AddWithValue("@role", roleId);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@epoch", epoch);
        cmd.Parameters.AddWithValue("@blob", wrapped);
        cmd.Parameters.AddWithValue("@by", byRoleId);
        cmd.Parameters.AddWithValue("@now", now);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    internal static async Task InsertCertificateAsync(
        SqlConnection connection, SqlTransaction tx, CertificateRecord record, byte[] signature,
        CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO app.certificate
                (id, subject_role_id, scope_kind, scope_id, capability, issued_by_role_id,
                 signature, issued_at, expires_at)
            VALUES (@id, @subject, N'area', @scope, @cap, @by, @sig, @issued, @expires);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", record.Id);
        cmd.Parameters.AddWithValue("@subject", record.SubjectRoleId);
        cmd.Parameters.AddWithValue("@scope", record.ScopeId);
        cmd.Parameters.AddWithValue("@cap", Capabilities.ToText(record.Capability));
        cmd.Parameters.AddWithValue("@by", record.IssuedByRoleId);
        cmd.Parameters.AddWithValue("@sig", signature);
        cmd.Parameters.AddWithValue("@issued", record.IssuedUtc);
        cmd.Parameters.AddWithValue("@expires", record.ExpiresUtc);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    internal static bool Verify(CertificateRecord record, byte[] issuerSpki, byte[] signature)
    {
        try
        {
            using var rsa = RSA.Create();
            rsa.ImportSubjectPublicKeyInfo(issuerSpki, out _);
            return record.Verify(rsa, signature);
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
