using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0120 — DIE VIRTUELLEN BEREICHE EINES FORMULARS — und die Kleinbereiche darin.
///
/// <para>
/// <b>Was eine Einsendung hält, und was sie hat.</b> Die Rollen des Formulars
/// (<c>module_role</c>, Form.Members.cs) geben jedem Einsender Zugang nach
/// AUSSEN — zur Gruppe, zur Pfarrei. Ein virtueller Bereich beschreibt dagegen
/// einen Bereich, den JEDE Einsendung für sich bekommt (ihren Kleinbereich),
/// und wer ihn erreicht: der Einsender selbst (<c>submitter_level</c>) und die
/// Rollen, die am virtuellen Bereich ein Zertifikat halten — jede davon diesen
/// Kleinbereich JEDER Einsendung. Ein Formular kann mehrere haben: was der
/// Einsender mit den Leitern teilt, was nur die Leiter über jeden führen.
/// </para>
///
/// <para>
/// <b>Die Regel steht am virtuellen Bereich; angewandt wird sie im Browser.</b>
/// Ein Kleinbereich ist ein gewöhnlicher Bereich mit eigenem Schlüssel und
/// eigenen Zertifikaten. Damit gilt für ihn alles, was für Bereiche gilt —
/// Rozmowa, Kalender, Aufgaben, Glocke —, ohne dass eine dieser Stellen von
/// virtuellen Bereichen wissen muss. Die Zertifikate unterschreibt der Browser
/// eines Leiters, dessen Rolle am virtuellen Bereich <c>admin</c> oder
/// <c>certify</c> hält, und zwar GENAU nach den Zertifikaten des virtuellen
/// Bereichs; den Schlüssel verpackt er für dieselben Rollen und — wenn der
/// Einsender ihn erreicht — unter dessen Platzschlüssel. Kommt am virtuellen
/// Bereich eine Rolle dazu, trägt ein Leiter-Browser sie in jedem Kleinbereich
/// nach (<c>mirror</c>); geht eine, nimmt der Dienst sie überall selbst
/// zurück (<c>Area.DropAsync</c>).
/// </para>
///
/// <code>
///   GET  /workspace/part/{id}/virtual            die virtuellen Bereiche des Formulars
///   POST /workspace/part/{id}/virtual            einen Bereich unter dem des Formulars zum virtuellen machen
///   POST /workspace/virtual/{id}                 was der Einsender darf, die Reihenfolge
///   POST /workspace/virtual/{id}/release         wieder ein gewöhnlicher Bereich (nur ohne Kleinbereiche)
///   GET  /workspace/virtual/{id}/plan            was ein Leiter-Browser braucht: fehlende und unvollständige Kleinbereiche
///   POST /workspace/virtual/{id}/instances       Kleinbereiche anlegen
///   POST /workspace/virtual/{id}/mirror          Kleinbereichen nachtragen, was ihr virtueller Bereich sagt
///   GET  /workspace/registration/{id}/areas      die Kleinbereiche einer Einsendung
/// </code>
/// </summary>
public static partial class Form
{
    private const int MaxInstancesAtOnce = 100;
    private const int MaxMirrorAtOnce = 1000;
    private const int MaxRolesPerInstance = 32;
    private const int MaxPlanRows = 500;

    /// <summary>Was der Einsender in seinem Kleinbereich darf.</summary>
    public static readonly string[] SubmitterLevels = ["none", "read", "write"];

    private const string NotReady = "Obszary wirtualne będą dostępne po migracji 0120.";

    private static void MapVirtual(WebApplication app)
    {
        app.MapGet("/workspace/part/{id:guid}/virtual", VirtualListAsync);
        app.MapPost("/workspace/part/{id:guid}/virtual", VirtualAddAsync);
        app.MapPost("/workspace/virtual/{id:guid}", VirtualChangeAsync);
        app.MapPost("/workspace/virtual/{id:guid}/release", VirtualReleaseAsync);
        app.MapGet("/workspace/virtual/{id:guid}/plan", VirtualPlanAsync);
        app.MapPost("/workspace/virtual/{id:guid}/instances", InstancesAsync);
        app.MapPost("/workspace/virtual/{id:guid}/mirror", MirrorAsync);
        app.MapGet("/workspace/registration/{id:guid}/areas", RegistrationAreasAsync);
    }

    public sealed record VirtualAddRequest(string? AreaId, string? SubmitterLevel);

    public sealed record VirtualChangeRequest(string? SubmitterLevel, int? Position);

    /// <summary>Ein Zertifikat für einen Kleinbereich, wie der Browser es unterschrieben hat — mit seinem Subjekt.</summary>
    public sealed record InstanceProof(
        string? SubjectRoleId, string? Id, string? Capability, long IssuedAt, long ExpiresAt, string? Signature);

    /// <summary>Der Epochenschlüssel des Kleinbereichs, verpackt für den öffentlichen Schlüssel einer Rolle.</summary>
    public sealed record InstanceGrant(string? RoleId, string? WrappedKey);

    public sealed record InstanceItem(
        string? RegistrationId, string? AreaId, List<InstanceGrant>? Grants, List<InstanceProof>? Certificates,
        string? SeatKeySealed);

    public sealed record InstancesRequest(string? IssuerRoleId, List<InstanceItem>? Items);

    /// <summary>Nachtragen: für eine Rolle ein Zertifikat, eine Schlüsselhülle oder beides — oder die Hülle für den Platz.</summary>
    public sealed record MirrorItem(
        string? AreaId, string? RoleId, string? WrappedKey, InstanceProof? Certificate, string? SeatKeySealed);

    public sealed record MirrorRequest(string? IssuerRoleId, List<MirrorItem>? Items);

    /// <summary>Ein virtueller Bereich, wie er in der Datenbank steht.</summary>
    private sealed record VirtualRow(
        Guid AreaId, Guid ModuleId, string Name, string SubmitterLevel, int Position, int CurrentEpoch);

    /* -- Gemeinsames -------------------------------------------------------- */

    private static async Task<VirtualRow?> VirtualOfAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT v.area_id, v.module_id, a.name, v.submitter_level, v.position, a.current_epoch
            FROM app.virtual_area v JOIN app.area a ON a.id = v.area_id
            WHERE v.area_id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", areaId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new VirtualRow(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
            reader.GetInt32(4), reader.GetInt32(5));
    }

    /// <summary>Die Regel: welche Rolle am virtuellen Bereich welche Stufe hält — lebende Zertifikate lebender Rollen.</summary>
    private static async Task<List<(Guid Role, Capability Capability)>> VirtualRulesAsync(
        SqlConnection connection, Guid areaId, DateTimeOffset now, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT DISTINCT c.subject_role_id, c.capability
            FROM app.certificate c JOIN app.role r ON r.id = c.subject_role_id AND r.revoked_at IS NULL
            WHERE c.scope_kind = N'area' AND c.scope_id = @area AND c.revoked_at IS NULL AND c.expires_at > @now;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@now", now);

        var rules = new List<(Guid, Capability)>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            if (Capabilities.TryParse(reader.GetString(1), out var capability)) rules.Add((reader.GetGuid(0), capability));
        }
        return rules;
    }

    /// <summary>Meine stärkste Stufe an einem Bereich (ohne <c>certify</c>), und ob ich hineinlassen darf.</summary>
    private static async Task<(string? Level, bool MayCertify)> LevelOnAsync(
        SqlConnection connection, IReadOnlyList<Guid> mine, Guid areaId, DateTimeOffset now, CancellationToken ct)
    {
        if (mine.Count == 0) return (null, false);

        var names = string.Join(", ", mine.Select((_, i) => $"@m{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT c.capability FROM app.certificate c
            WHERE c.scope_kind = N'area' AND c.scope_id = @area AND c.revoked_at IS NULL AND c.expires_at > @now
              AND c.subject_role_id IN ({names});
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@now", now);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@m{i}", mine[i]);

        var held = new List<Capability>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            if (Capabilities.TryParse(reader.GetString(0), out var capability)) held.Add(capability);
        }

        string? level = held.Contains(Capability.Admin) ? "admin"
            : held.Contains(Capability.Write) ? "write"
            : held.Contains(Capability.Read) ? "read"
            : null;
        return (level, Capabilities.CoversAny(held, Capability.Certify));
    }

    /// <summary>Darf die Rolle nach der Regel des virtuellen Bereichs Zertifikate für seine Kleinbereiche ausstellen?</summary>
    private static async Task<bool> IssuesForAsync(SqlConnection connection, Guid issuer, Guid virtualAreaId, DateTimeOffset now, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT COUNT(*) FROM app.certificate
            WHERE scope_kind = N'area' AND scope_id = @area AND subject_role_id = @role
              AND capability IN (N'admin', N'certify') AND revoked_at IS NULL AND expires_at > @now;
            """, connection);
        cmd.Parameters.AddWithValue("@area", virtualAreaId);
        cmd.Parameters.AddWithValue("@role", issuer);
        cmd.Parameters.AddWithValue("@now", now);
        return (int)(await cmd.ExecuteScalarAsync(ct))! > 0;
    }

    /// <summary>
    /// Ein Zertifikat für einen Kleinbereich prüfen: lesbar, im Zeitfenster,
    /// nach der Regel (genau dieses Subjekt mit genau dieser Stufe hält am
    /// virtuellen Bereich ein Zertifikat) und vom Aussteller unterschrieben.
    /// </summary>
    public static (CertificateRecord? Record, byte[]? Signature, string? Error) CheckInstanceProof(
        InstanceProof? proof, Guid instanceId, Guid issuer, byte[] issuerSpki,
        IReadOnlyCollection<(Guid Role, Capability Capability)> rules, DateTimeOffset now)
    {
        if (proof is null
            || !Guid.TryParse(proof.SubjectRoleId, out var subject)
            || !Guid.TryParse(proof.Id, out var certificateId)
            || !Capabilities.TryParse(proof.Capability, out var capability)
            || !Base64Url.TryDecode(proof.Signature, out var signature) || signature.Length == 0)
        {
            return (null, null, "Nieczytelne zaświadczenie.");
        }

        if (!rules.Contains((subject, capability)))
        {
            return (null, null, "Zaświadczenie nie zgadza się z regułą obszaru wirtualnego.");
        }

        var issuedAt = DateTimeOffset.FromUnixTimeSeconds(proof.IssuedAt);
        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(proof.ExpiresAt);
        if (issuedAt > now + Area.ClockSlack || issuedAt < now - Area.ClockSlack
            || expiresAt <= issuedAt || expiresAt > now + Area.MaxLife)
        {
            return (null, null, "Data albo ważność zaświadczenia się nie zgadza.");
        }

        var record = new CertificateRecord
        {
            Id = certificateId,
            SubjectRoleId = subject,
            ScopeKind = ScopeKind.Area,
            ScopeId = instanceId,
            Capability = capability,
            IssuedByRoleId = issuer,
            IssuedUtc = issuedAt,
            ExpiresUtc = expiresAt
        };

        return Area.Verify(record, issuerSpki, signature)
            ? (record, signature, null)
            : (null, null, "Podpis zaświadczenia się nie zgadza.");
    }

    /// <summary>Eine RSA-Hülle eines Epochenschlüssels (20 Byte Kopf + 512): grob plausibel, nicht leer.</summary>
    private static bool WrappedShape(byte[] blob) => blob.Length is >= 100 and <= 2048;

    /// <summary>Eine AES-Hülle unter dem Platzschlüssel (wie <c>access_grant</c> sie trägt).</summary>
    private static bool SealedShape(byte[] blob) => blob.Length is >= 40 and <= 512;

    /// <summary>Die Einsendung, an der Kleinbereiche hängen: eine erste (keine Ergänzung), nicht zurückgezogen.</summary>
    private static async Task<(Guid Module, Guid? Seat)?> MainRegistrationAsync(
        SqlConnection connection, Guid registrationId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT g.part_id, g.access_id FROM app.registration g
            WHERE g.id = @id AND g.base_id IS NULL AND g.withdrawn_at IS NULL;
            """, connection);
        cmd.Parameters.AddWithValue("@id", registrationId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return (reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetGuid(1));
    }

    /* -- Die Liste ------------------------------------------------------------- */

    private static async Task VirtualListAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma."); return; }
        if (!await MayOfficeAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        var moduleId = Ids.ToText(sheet.ModuleId);
        var formAreaId = sheet.AreaId is Guid area ? Ids.ToText(area) : null;

        /* Ohne die Migration gibt es keine — das ist eine Auskunft, kein Fehler. */
        if (!await Schema.VirtualAreasAsync(connection, ctx.RequestAborted))
        {
            await ctx.Response.WriteAsJsonAsync(new
            {
                moduleId, formAreaId, ready = false, registrations = 0, virtualAreas = Array.Empty<object>()
            });
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();

        int registrations;
        await using (var count = new SqlCommand("""
            SELECT COUNT(*) FROM app.registration
            WHERE part_id = @module AND base_id IS NULL AND withdrawn_at IS NULL AND is_hidden = 0;
            """, connection))
        {
            count.Parameters.AddWithValue("@module", sheet.ModuleId);
            registrations = (int)(await count.ExecuteScalarAsync(ctx.RequestAborted))!;
        }

        var rows = new List<(Guid Area, string Name, string Level, int Position, int Epoch, int Instances, int Missing, int Behind)>();
        await using (var cmd = new SqlCommand("""
            SELECT v.area_id, a.name, v.submitter_level, v.position, a.current_epoch,
                   (SELECT COUNT(*) FROM app.area_instance ai WHERE ai.virtual_area_id = v.area_id) AS instances,
                   (SELECT COUNT(*) FROM app.registration g
                     WHERE g.part_id = v.module_id AND g.base_id IS NULL AND g.withdrawn_at IS NULL AND g.is_hidden = 0
                       AND NOT EXISTS (SELECT 1 FROM app.area_instance ai
                                        WHERE ai.virtual_area_id = v.area_id AND ai.registration_id = g.id)) AS missing,
                   (SELECT COUNT(DISTINCT ai.area_id) FROM app.area_instance ai
                      JOIN app.certificate vc ON vc.scope_kind = N'area' AND vc.scope_id = ai.virtual_area_id
                                             AND vc.revoked_at IS NULL AND vc.expires_at > @now
                     WHERE ai.virtual_area_id = v.area_id
                       AND NOT EXISTS (SELECT 1 FROM app.certificate ic
                                        WHERE ic.scope_kind = N'area' AND ic.scope_id = ai.area_id
                                          AND ic.subject_role_id = vc.subject_role_id AND ic.capability = vc.capability
                                          AND ic.revoked_at IS NULL AND ic.expires_at > @now)) AS behind
            FROM app.virtual_area v JOIN app.area a ON a.id = v.area_id
            WHERE v.module_id = @module
            ORDER BY v.position, v.created_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@module", sheet.ModuleId);
            cmd.Parameters.AddWithValue("@now", now);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetInt32(3),
                    reader.GetInt32(4), reader.GetInt32(5), reader.GetInt32(6), reader.GetInt32(7)));
            }
        }

        var virtualAreas = new List<object>();
        foreach (var row in rows)
        {
            var (level, mayCertify) = await LevelOnAsync(connection, mine, row.Area, now, ctx.RequestAborted);
            virtualAreas.Add(new
            {
                areaId = Ids.ToText(row.Area),
                name = row.Name,
                submitterLevel = row.Level,
                position = row.Position,
                currentEpoch = row.Epoch,

                /* Wie viele Einsendungen ihren Kleinbereich schon haben, wie vielen er fehlt, wie viele hinter der Regel zurück sind. */
                instances = row.Instances,
                missing = row.Missing,
                behind = row.Behind,

                myLevel = level,
                mayCertify
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { moduleId, formAreaId, ready = true, registrations, virtualAreas });
    }

    /* -- Anlegen, ändern, lösen ------------------------------------------------- */

    /// <summary>
    /// Einen Bereich zum virtuellen Bereich des Formulars machen. Angelegt hat
    /// ihn der Browser schon (<c>POST /workspace/area</c>, mit dem Bereich des
    /// Formulars als Vater) — hier bekommt er seine Bedeutung. Nur für ein
    /// Hauptformular: eine Ergänzung schreibt in die Kleinbereiche ihres
    /// Formulars.
    /// </summary>
    private static async Task VirtualAddAsync(HttpContext ctx, Db db, Guid id, VirtualAddRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.AreaId, out var areaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung obszaru.");
            return;
        }

        var level = body.SubmitterLevel ?? "write";
        if (!SubmitterLevels.Contains(level))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Osoba: none, read albo write.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma."); return; }
        if (!await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        if (!await Schema.VirtualAreasAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, NotReady);
            return;
        }

        if (sheet.AreaId is not Guid formArea)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Formularz bez obszaru nie ma obszarów wirtualnych.");
            return;
        }

        await using (var kind = new SqlCommand("SELECT kind, extends_id FROM app.module WHERE id = @id;", connection))
        {
            kind.Parameters.AddWithValue("@id", sheet.ModuleId);
            await using var reader = await kind.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted) || reader.GetString(0) != "form")
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Obszary wirtualne ma tylko formularz.");
                return;
            }
            if (!reader.IsDBNull(1))
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Podformularz nie ma własnych obszarów wirtualnych — zapisuje w obszarach swojego formularza.");
                return;
            }
        }

        await using (var shape = new SqlCommand("""
            SELECT a.parent_area_id, a.personal_role_id,
                   (SELECT COUNT(*) FROM app.virtual_area v WHERE v.area_id = a.id)
                 + (SELECT COUNT(*) FROM app.area_instance ai WHERE ai.area_id = a.id)
            FROM app.area a WHERE a.id = @id;
            """, connection))
        {
            shape.Parameters.AddWithValue("@id", areaId);
            await using var reader = await shape.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
                return;
            }
            if (reader.IsDBNull(0) || reader.GetGuid(0) != formArea)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Obszar wirtualny leży bezpośrednio w obszarze formularza.");
                return;
            }
            if (!reader.IsDBNull(1))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, Area.PersonalStaysPersonal);
                return;
            }
            if (reader.GetInt32(2) > 0)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Ten obszar już należy do formularza.");
                return;
            }
        }

        var now = DateTimeOffset.UtcNow;
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();

        /* Wer ihn führt — die eigene Rolle mit `admin`; sonst darf hier niemand eine Regel aufstellen. */
        Guid? leader = null;
        if (mine.Count > 0)
        {
            var names = string.Join(", ", mine.Select((_, i) => $"@m{i}"));
            await using var find = new SqlCommand($"""
                SELECT TOP 1 c.subject_role_id FROM app.certificate c
                WHERE c.scope_kind = N'area' AND c.scope_id = @area AND c.capability = N'admin'
                  AND c.revoked_at IS NULL AND c.expires_at > @now AND c.subject_role_id IN ({names});
                """, connection);
            find.Parameters.AddWithValue("@area", areaId);
            find.Parameters.AddWithValue("@now", now);
            for (var i = 0; i < mine.Count; i++) find.Parameters.AddWithValue($"@m{i}", mine[i]);
            leader = await find.ExecuteScalarAsync(ctx.RequestAborted) as Guid?;
        }

        if (leader is null)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Obszarem wirtualnym może zostać obszar, który prowadzisz.");
            return;
        }

        int position;
        await using (var next = new SqlCommand(
            "SELECT ISNULL(MAX(position), -1) + 1 FROM app.virtual_area WHERE module_id = @module;", connection))
        {
            next.Parameters.AddWithValue("@module", sheet.ModuleId);
            position = (int)(await next.ExecuteScalarAsync(ctx.RequestAborted))!;
        }

        try
        {
            await using var insert = new SqlCommand("""
                INSERT INTO app.virtual_area (area_id, module_id, submitter_level, position, created_by_role_id, created_at)
                VALUES (@area, @module, @level, @position, @by, @now);
                """, connection);
            insert.Parameters.AddWithValue("@area", areaId);
            insert.Parameters.AddWithValue("@module", sheet.ModuleId);
            insert.Parameters.AddWithValue("@level", level);
            insert.Parameters.AddWithValue("@position", position);
            insert.Parameters.AddWithValue("@by", leader.Value);
            insert.Parameters.AddWithValue("@now", now);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten obszar już należy do formularza.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(areaId),
            moduleId = Ids.ToText(sheet.ModuleId),
            submitterLevel = level,
            position
        });
    }

    /// <summary>
    /// Was der Einsender in seinem Kleinbereich darf, und an welcher Stelle der
    /// virtuelle Bereich steht. Auf <c>none</c> gehen die Hüllen unter den
    /// Platzschlüsseln — was ein Browser schon geöffnet hat, bleibt geöffnet.
    /// </summary>
    private static async Task VirtualChangeAsync(HttpContext ctx, Db db, Guid id, VirtualChangeRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (body.SubmitterLevel is not null && !SubmitterLevels.Contains(body.SubmitterLevel))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Osoba: none, read albo write.");
            return;
        }

        if (body.Position is < 0 or > 1000)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kolejność.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Schema.VirtualAreasAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, NotReady);
            return;
        }

        var row = await VirtualOfAsync(connection, id, ctx.RequestAborted);
        if (row is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru wirtualnego nie ma."); return; }

        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Regułę zmienia ten, kto prowadzi obszar wirtualny.");
            return;
        }

        var level = body.SubmitterLevel ?? row.SubmitterLevel;
        var position = body.Position ?? row.Position;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await using (var cmd = new SqlCommand(
                "UPDATE app.virtual_area SET submitter_level = @level, position = @position WHERE area_id = @id;", connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@level", level);
                cmd.Parameters.AddWithValue("@position", position);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            if (level == "none" && row.SubmitterLevel != "none")
            {
                await using var drop = new SqlCommand("""
                    DELETE FROM app.access_grant
                    WHERE area_id IN (SELECT ai.area_id FROM app.area_instance ai WHERE ai.virtual_area_id = @id);
                    """, connection, tx);
                drop.Parameters.AddWithValue("@id", id);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), submitterLevel = level, position });
    }

    /// <summary>
    /// Kein virtueller Bereich mehr — der Bereich bleibt als gewöhnlicher stehen.
    /// Nur solange es keine Kleinbereiche gibt: die gehören den Menschen, die
    /// eingesandt haben, und verschwinden nicht mit einer Einstellung.
    /// </summary>
    private static async Task VirtualReleaseAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Schema.VirtualAreasAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, NotReady);
            return;
        }

        var row = await VirtualOfAsync(connection, id, ctx.RequestAborted);
        if (row is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru wirtualnego nie ma."); return; }

        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Admin, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Regułę zmienia ten, kto prowadzi obszar wirtualny.");
            return;
        }

        await using var cmd = new SqlCommand("""
            DELETE FROM app.virtual_area
            WHERE area_id = @id AND NOT EXISTS (SELECT 1 FROM app.area_instance ai WHERE ai.virtual_area_id = @id);
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ten obszar wirtualny ma już obszary osób — one należą do tych, którzy się zgłosili.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), released = true });
    }

    /* -- Der Plan für den Browser eines Leiters -------------------------------------------- */

    /// <summary>
    /// Was ein Leiter-Browser braucht, um die Regel anzuwenden: die Rollen der
    /// Regel mit ihren öffentlichen Schlüsseln; welche meiner Rollen ausstellen
    /// darf; die Einsendungen ohne Kleinbereich (mit dem, was er braucht, um den
    /// Platzschlüssel zu öffnen); und die Kleinbereiche, denen etwas fehlt — ein
    /// Zertifikat, eine Schlüsselhülle, die Hülle für den Platz.
    /// </summary>
    private static async Task VirtualPlanAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Schema.VirtualAreasAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, NotReady);
            return;
        }

        var row = await VirtualOfAsync(connection, id, ctx.RequestAborted);
        if (row is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru wirtualnego nie ma."); return; }

        var sheet = await SheetAsync(connection, row.ModuleId, ctx.RequestAborted);
        if (sheet is null || !await MayOfficeAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        var names = mine.Count == 0 ? "NULL" : string.Join(", ", mine.Select((_, i) => $"@m{i}"));
        void Mine(SqlCommand cmd) { for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@m{i}", mine[i]); }

        /* Die Regel, je Rolle mit allen ihren Stufen und ihrem öffentlichen Schlüssel. */
        var members = new Dictionary<Guid, (string Kind, byte[] Wrap, List<string> Caps)>();
        var order = new List<Guid>();
        await using (var cmd = new SqlCommand("""
            SELECT r.id, r.kind, r.wrap_public_key, c.capability
            FROM app.certificate c JOIN app.role r ON r.id = c.subject_role_id AND r.revoked_at IS NULL
            WHERE c.scope_kind = N'area' AND c.scope_id = @area AND c.revoked_at IS NULL AND c.expires_at > @now;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            cmd.Parameters.AddWithValue("@now", now);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var role = reader.GetGuid(0);
                if (!members.TryGetValue(role, out var entry))
                {
                    entry = (reader.GetString(1), (byte[])reader[2], []);
                    members[role] = entry;
                    order.Add(role);
                }
                var capability = reader.GetString(3);
                if (!entry.Caps.Contains(capability)) entry.Caps.Add(capability);
            }
        }

        /* Wer von mir ausstellen darf. */
        var issuers = new List<string>();
        foreach (var role in mine.Where(members.ContainsKey))
        {
            if (members[role].Caps.Contains("admin") || members[role].Caps.Contains("certify")) issuers.Add(Ids.ToText(role));
        }

        /* Einsendungen ohne Kleinbereich — mit dem Platz, wenn ich ihn öffnen kann. */
        var missing = new List<object>();
        await using (var cmd = new SqlCommand($"""
            SELECT TOP {MaxPlanRows} g.id, s.id, s.area_id, s.epoch, s.origin, s.seat_key_for_intake, s.seat_key_for_area,
                   CASE WHEN s.id IS NOT NULL AND {OpensSeat(names)} THEN 1 ELSE 0 END
            FROM app.registration g
            LEFT JOIN app.access s ON s.id = g.access_id AND s.revoked_at IS NULL
            WHERE g.part_id = @module AND g.base_id IS NULL AND g.withdrawn_at IS NULL AND g.is_hidden = 0
              AND NOT EXISTS (SELECT 1 FROM app.area_instance ai WHERE ai.virtual_area_id = @area AND ai.registration_id = g.id)
            ORDER BY g.submitted_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@module", row.ModuleId);
            cmd.Parameters.AddWithValue("@area", id);
            cmd.Parameters.AddWithValue("@now", now);
            Mine(cmd);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                missing.Add(new
                {
                    registrationId = Ids.ToText(reader.GetGuid(0)),
                    seat = reader.IsDBNull(1) ? null : SeatEnvelope(reader, 1, reader.GetInt32(7) == 1)
                });
            }
        }

        /* Kleinbereiche hinter der Regel: fehlende Zertifikate und Schlüsselhüllen, die fehlende Hülle für den Platz. */
        var behind = new Dictionary<Guid, (Guid Registration, int Epoch, List<object> Lacks, List<string> Keyless, object? Seat)>();
        var behindOrder = new List<Guid>();
        void Note(Guid area, Guid registration, int epoch)
        {
            if (behind.ContainsKey(area)) return;
            behind[area] = (registration, epoch, [], [], null);
            behindOrder.Add(area);
        }

        await using (var cmd = new SqlCommand($"""
            SELECT TOP {MaxPlanRows * 4} ai.area_id, ai.registration_id, a.current_epoch, vc.subject_role_id, vc.capability
            FROM app.area_instance ai
            JOIN app.area a ON a.id = ai.area_id
            JOIN app.certificate vc ON vc.scope_kind = N'area' AND vc.scope_id = ai.virtual_area_id
                                   AND vc.revoked_at IS NULL AND vc.expires_at > @now
            JOIN app.role r ON r.id = vc.subject_role_id AND r.revoked_at IS NULL
            WHERE ai.virtual_area_id = @area
              AND NOT EXISTS (SELECT 1 FROM app.certificate ic
                               WHERE ic.scope_kind = N'area' AND ic.scope_id = ai.area_id
                                 AND ic.subject_role_id = vc.subject_role_id AND ic.capability = vc.capability
                                 AND ic.revoked_at IS NULL AND ic.expires_at > @now)
            ORDER BY ai.created_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            cmd.Parameters.AddWithValue("@now", now);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var area = reader.GetGuid(0);
                Note(area, reader.GetGuid(1), reader.GetInt32(2));
                behind[area].Lacks.Add(new { roleId = Ids.ToText(reader.GetGuid(3)), capability = reader.GetString(4) });
            }
        }

        await using (var cmd = new SqlCommand($"""
            SELECT TOP {MaxPlanRows * 4} ai.area_id, ai.registration_id, a.current_epoch, vr.subject_role_id
            FROM app.area_instance ai
            JOIN app.area a ON a.id = ai.area_id
            JOIN (SELECT DISTINCT c.subject_role_id FROM app.certificate c
                   JOIN app.role r ON r.id = c.subject_role_id AND r.revoked_at IS NULL
                  WHERE c.scope_kind = N'area' AND c.scope_id = @area AND c.revoked_at IS NULL AND c.expires_at > @now
                    AND c.capability IN (N'read', N'write', N'admin')) vr ON 1 = 1
            WHERE ai.virtual_area_id = @area
              AND NOT EXISTS (SELECT 1 FROM app.key_grant kg
                               WHERE kg.key_kind = N'epoch' AND kg.key_ref = ai.area_id AND kg.key_epoch = a.current_epoch
                                 AND kg.role_id = vr.subject_role_id AND kg.destroyed_at IS NULL)
            ORDER BY ai.created_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            cmd.Parameters.AddWithValue("@now", now);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var area = reader.GetGuid(0);
                Note(area, reader.GetGuid(1), reader.GetInt32(2));
                behind[area].Keyless.Add(Ids.ToText(reader.GetGuid(3)));
            }
        }

        if (row.SubmitterLevel != "none")
        {
            await using var cmd = new SqlCommand($"""
                SELECT TOP {MaxPlanRows} ai.area_id, ai.registration_id, a.current_epoch,
                       s.id, s.area_id, s.epoch, s.origin, s.seat_key_for_intake, s.seat_key_for_area,
                       CASE WHEN {OpensSeat(names)} THEN 1 ELSE 0 END
                FROM app.area_instance ai
                JOIN app.area a ON a.id = ai.area_id
                JOIN app.registration g ON g.id = ai.registration_id
                JOIN app.access s ON s.id = g.access_id AND s.revoked_at IS NULL
                WHERE ai.virtual_area_id = @area
                  AND NOT EXISTS (SELECT 1 FROM app.access_grant ag WHERE ag.access_id = s.id AND ag.area_id = ai.area_id)
                ORDER BY ai.created_at;
                """, connection);
            cmd.Parameters.AddWithValue("@area", id);
            cmd.Parameters.AddWithValue("@now", now);
            Mine(cmd);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var area = reader.GetGuid(0);
                Note(area, reader.GetGuid(1), reader.GetInt32(2));
                var entry = behind[area];
                behind[area] = entry with { Seat = SeatEnvelope(reader, 3, reader.GetInt32(9) == 1) };
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(row.AreaId),
            name = row.Name,
            moduleId = Ids.ToText(row.ModuleId),
            submitterLevel = row.SubmitterLevel,
            members = order.Select(role => new
            {
                roleId = Ids.ToText(role),
                kind = members[role].Kind,
                wrapPublicKey = Base64Url.Encode(members[role].Wrap),
                capabilities = members[role].Caps
            }),
            issuers,
            missing,
            behind = behindOrder.Select(area => new
            {
                areaId = Ids.ToText(area),
                registrationId = Ids.ToText(behind[area].Registration),
                epoch = behind[area].Epoch,
                lacks = behind[area].Lacks,
                keyless = behind[area].Keyless,
                seat = behind[area].Seat
            })
        });
    }

    /// <summary>Ein Platz, wie der Browser ihn braucht, um seinen Schlüssel zu öffnen (wie <c>MembersAsync</c> ihn schickt).</summary>
    private static object SeatEnvelope(SqlDataReader reader, int at, bool opens) => new
    {
        seatId = Ids.ToText(reader.GetGuid(at)),
        areaId = Ids.ToText(reader.GetGuid(at + 1)),
        epoch = reader.GetInt32(at + 2),
        origin = reader.GetString(at + 3),
        seatKeyForIntake = opens && !reader.IsDBNull(at + 4) ? Base64Url.Encode((byte[])reader[at + 4]) : null,
        seatKeyForArea = opens && !reader.IsDBNull(at + 5) ? Base64Url.Encode((byte[])reader[at + 5]) : null,
        opens
    };

    /* -- Kleinbereiche anlegen ------------------------------------------------------------ */

    /// <summary>
    /// Kleinbereiche anlegen — je Einsendung einen, mit Schlüssel und
    /// Zertifikaten aus dem Browser eines Leiters. Geprüft wird, was der Dienst
    /// prüfen kann: die Einsendung gehört zum Formular, jedes Zertifikat folgt
    /// der Regel und trägt die Unterschrift des Ausstellers, Hüllen gehen nur an
    /// Rollen mit Zertifikat und an den eigenen Platz der Einsendung. Was in den
    /// Hüllen liegt, sieht er nicht.
    /// </summary>
    private static async Task InstancesAsync(HttpContext ctx, Db db, Guid id, InstancesRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var items = body.Items ?? [];
        if (items.Count is 0 or > MaxInstancesAtOnce)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Od jednego do {MaxInstancesAtOnce} obszarów naraz.");
            return;
        }

        if (!Guid.TryParse(body.IssuerRoleId, out var issuer))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rola wystawiającego.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var context = await IssuerContextAsync(ctx, connection, who.Value.AccountId, id, issuer);
        if (context is null) return;
        var (row, issuerSpki, rules, now) = context.Value;

        var results = new List<object>();
        var created = 0;

        foreach (var item in items)
        {
            if (!Guid.TryParse(item.RegistrationId, out var registrationId) || !Guid.TryParse(item.AreaId, out var areaId)
                || areaId == Guid.Empty)
            {
                results.Add(new { registrationId = item.RegistrationId, status = "unreadable" });
                continue;
            }

            var registration = await MainRegistrationAsync(connection, registrationId, ctx.RequestAborted);
            if (registration is null || registration.Value.Module != row.ModuleId)
            {
                results.Add(new { registrationId = item.RegistrationId, status = "foreign" });
                continue;
            }

            /* Die Zertifikate: nach der Regel, unterschrieben vom Aussteller. */
            var proofs = item.Certificates ?? [];
            if (proofs.Count is 0 or > MaxRolesPerInstance)
            {
                results.Add(new { registrationId = item.RegistrationId, status = "certificates" });
                continue;
            }

            var certificates = new List<(CertificateRecord Record, byte[] Signature)>();
            string? problem = null;
            foreach (var proof in proofs)
            {
                var (record, signature, error) = CheckInstanceProof(proof, areaId, issuer, issuerSpki, rules, now);
                if (record is null) { problem = error; break; }
                if (certificates.Any(c => c.Record.SubjectRoleId == record.SubjectRoleId && c.Record.Capability == record.Capability)) continue;
                certificates.Add((record, signature!));
            }

            if (problem is not null)
            {
                results.Add(new { registrationId = item.RegistrationId, status = "certificate", error = problem });
                continue;
            }

            /* Die Hüllen: nur für Rollen, die hier ein Zertifikat bekommen. */
            var subjects = certificates.Select(c => c.Record.SubjectRoleId).ToHashSet();
            var grants = new List<(Guid Role, byte[] Blob)>();
            foreach (var grant in item.Grants ?? [])
            {
                if (!Guid.TryParse(grant.RoleId, out var role) || !subjects.Contains(role)
                    || !Base64Url.TryDecode(grant.WrappedKey, out var blob) || !WrappedShape(blob))
                {
                    problem = "Nieczytelna albo cudza koperta klucza.";
                    break;
                }
                if (grants.Any(g => g.Role == role)) continue;
                grants.Add((role, blob));
            }

            if (problem is not null || grants.Count > MaxRolesPerInstance)
            {
                results.Add(new { registrationId = item.RegistrationId, status = "grant", error = problem });
                continue;
            }

            /* Die Hülle für den Platz: nur, wenn der Einsender seinen Kleinbereich erreicht. */
            byte[]? forSeat = null;
            if (item.SeatKeySealed is not null)
            {
                if (row.SubmitterLevel == "none" || registration.Value.Seat is null
                    || !Base64Url.TryDecode(item.SeatKeySealed, out var sealedBlob) || !SealedShape(sealedBlob))
                {
                    results.Add(new { registrationId = item.RegistrationId, status = "seat" });
                    continue;
                }
                forSeat = sealedBlob;
            }

            await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
            try
            {
                await using (var cmd = new SqlCommand("""
                    INSERT INTO app.area (id, name, current_epoch, created_at, parent_area_id)
                    VALUES (@id, @name, 1, @now, @parent);

                    INSERT INTO app.area_epoch (area_id, epoch, reason, cut_by_role_id, created_at)
                    VALUES (@id, 1, N'initial', @by, @now);

                    INSERT INTO app.area_instance (area_id, virtual_area_id, registration_id, created_by_role_id, created_at)
                    VALUES (@id, @parent, @registration, @by, @now);
                    """, connection, tx))
                {
                    cmd.Parameters.AddWithValue("@id", areaId);
                    cmd.Parameters.AddWithValue("@name", row.Name);
                    cmd.Parameters.AddWithValue("@now", now);
                    cmd.Parameters.AddWithValue("@parent", row.AreaId);
                    cmd.Parameters.AddWithValue("@by", issuer);
                    cmd.Parameters.AddWithValue("@registration", registrationId);
                    await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                foreach (var (role, blob) in grants)
                {
                    await Area.GrantKeyAsync(connection, tx, role, areaId, 1, blob, issuer, now, ctx.RequestAborted);
                }

                foreach (var (record, signature) in certificates)
                {
                    await Area.InsertCertificateAsync(connection, tx, record, signature, ctx.RequestAborted);
                }

                if (forSeat is not null)
                {
                    await using var seat = new SqlCommand("""
                        INSERT INTO app.access_grant (access_id, area_id, epoch, sealed_blob, created_at)
                        VALUES (@seat, @area, 1, @blob, @now);
                        """, connection, tx);
                    seat.Parameters.AddWithValue("@seat", registration.Value.Seat!.Value);
                    seat.Parameters.AddWithValue("@area", areaId);
                    seat.Parameters.AddBlob("@blob", forSeat);
                    seat.Parameters.AddWithValue("@now", now);
                    await seat.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                await tx.CommitAsync(ctx.RequestAborted);
                created++;
                results.Add(new { registrationId = Ids.ToText(registrationId), areaId = Ids.ToText(areaId), status = "created" });
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                await tx.RollbackAsync(ctx.RequestAborted);

                /* Zwei Browser zugleich, oder die Kennung gab es schon: der erste gilt. */
                results.Add(new { registrationId = Ids.ToText(registrationId), status = "exists" });
            }
            catch
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                throw;
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { virtualAreaId = Ids.ToText(id), created, items = results });
    }

    /// <summary>
    /// Was Anlegen und Nachtragen gemeinsam prüfen: die Migration, der virtuelle
    /// Bereich, das Formular, der Aussteller (eine meiner Rollen mit
    /// <c>admin</c>/<c>certify</c> am virtuellen Bereich und mit Schlüssel zum
    /// Unterschreiben). Schreibt bei <c>null</c> die Antwort selbst.
    /// </summary>
    private static async Task<(VirtualRow Row, byte[] IssuerSpki, List<(Guid Role, Capability Capability)> Rules, DateTimeOffset Now)?>
        IssuerContextAsync(HttpContext ctx, SqlConnection connection, Guid accountId, Guid id, Guid issuer)
    {
        if (!await Schema.VirtualAreasAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, NotReady);
            return null;
        }

        var row = await VirtualOfAsync(connection, id, ctx.RequestAborted);
        if (row is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru wirtualnego nie ma.");
            return null;
        }

        var sheet = await SheetAsync(connection, row.ModuleId, ctx.RequestAborted);
        if (sheet is null || !await MayOfficeAsync(connection, accountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return null;
        }

        var mine = await Workspace.RolesOfAsync(connection, accountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == issuer))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W imieniu tej roli nic nie wystawisz.");
            return null;
        }

        var now = DateTimeOffset.UtcNow;
        if (!await IssuesForAsync(connection, issuer, id, now, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Obszary osób zakłada ten, kto prowadzi obszar wirtualny.");
            return null;
        }

        var spki = await Area.PublicSignKeyAsync(connection, issuer, ctx.RequestAborted);
        if (spki is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej roli nie ma.");
            return null;
        }

        return (row, spki, await VirtualRulesAsync(connection, id, now, ctx.RequestAborted), now);
    }

    /* -- Nachtragen ----------------------------------------------------------------------- */

    /// <summary>
    /// Kleinbereichen nachtragen, was ihr virtueller Bereich inzwischen sagt: das
    /// Zertifikat einer Rolle, die dazugekommen ist, ihre Schlüsselhülle, die
    /// Hülle für den Platz, wenn der Einsender jetzt dazugehört. Was schon da ist,
    /// bleibt; doppelt wird nichts.
    /// </summary>
    private static async Task MirrorAsync(HttpContext ctx, Db db, Guid id, MirrorRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var items = body.Items ?? [];
        if (items.Count is 0 or > MaxMirrorAtOnce)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Od jednego do {MaxMirrorAtOnce} wpisów naraz.");
            return;
        }

        if (!Guid.TryParse(body.IssuerRoleId, out var issuer))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rola wystawiającego.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var context = await IssuerContextAsync(ctx, connection, who.Value.AccountId, id, issuer);
        if (context is null) return;
        var (row, issuerSpki, rules, now) = context.Value;
        var subjects = rules.Select(r => r.Role).ToHashSet();

        /* Die Kleinbereiche dieses virtuellen Bereichs: Epoche und Platz. */
        var instances = new Dictionary<Guid, (int Epoch, Guid? Seat)>();
        await using (var cmd = new SqlCommand("""
            SELECT ai.area_id, a.current_epoch, s.id
            FROM app.area_instance ai
            JOIN app.area a ON a.id = ai.area_id
            JOIN app.registration g ON g.id = ai.registration_id
            LEFT JOIN app.access s ON s.id = g.access_id AND s.revoked_at IS NULL
            WHERE ai.virtual_area_id = @area;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                instances[reader.GetGuid(0)] = (reader.GetInt32(1), reader.IsDBNull(2) ? null : reader.GetGuid(2));
            }
        }

        int certificatesAdded = 0, keysAdded = 0, seatsAdded = 0, refused = 0;

        foreach (var item in items)
        {
            if (!Guid.TryParse(item.AreaId, out var areaId) || !instances.TryGetValue(areaId, out var instance))
            {
                refused++;
                continue;
            }

            /* Die Hülle für den Platz. */
            if (item.SeatKeySealed is not null)
            {
                if (row.SubmitterLevel == "none" || instance.Seat is null
                    || !Base64Url.TryDecode(item.SeatKeySealed, out var sealedBlob) || !SealedShape(sealedBlob))
                {
                    refused++;
                    continue;
                }

                await using var seat = new SqlCommand("""
                    INSERT INTO app.access_grant (access_id, area_id, epoch, sealed_blob, created_at)
                    SELECT @seat, @area, @epoch, @blob, @now
                    WHERE NOT EXISTS (SELECT 1 FROM app.access_grant WHERE access_id = @seat AND area_id = @area);
                    """, connection);
                seat.Parameters.AddWithValue("@seat", instance.Seat.Value);
                seat.Parameters.AddWithValue("@area", areaId);
                seat.Parameters.AddWithValue("@epoch", instance.Epoch);
                seat.Parameters.AddBlob("@blob", sealedBlob);
                seat.Parameters.AddWithValue("@now", now);
                seatsAdded += await seat.ExecuteNonQueryAsync(ctx.RequestAborted);
                continue;
            }

            if (!Guid.TryParse(item.RoleId, out var role) || !subjects.Contains(role))
            {
                refused++;
                continue;
            }

            if (item.Certificate is not null)
            {
                if (item.Certificate.SubjectRoleId is null || !Guid.TryParse(item.Certificate.SubjectRoleId, out var subject) || subject != role)
                {
                    refused++;
                    continue;
                }

                var (record, signature, _) = CheckInstanceProof(item.Certificate, areaId, issuer, issuerSpki, rules, now);
                if (record is null)
                {
                    refused++;
                    continue;
                }

                await using var there = new SqlCommand("""
                    SELECT COUNT(*) FROM app.certificate
                    WHERE scope_kind = N'area' AND scope_id = @area AND subject_role_id = @role AND capability = @capability
                      AND revoked_at IS NULL AND expires_at > @now;
                    """, connection);
                there.Parameters.AddWithValue("@area", areaId);
                there.Parameters.AddWithValue("@role", role);
                there.Parameters.AddWithValue("@capability", Capabilities.ToText(record.Capability));
                there.Parameters.AddWithValue("@now", now);
                if ((int)(await there.ExecuteScalarAsync(ctx.RequestAborted))! == 0)
                {
                    await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
                    await Area.InsertCertificateAsync(connection, tx, record, signature!, ctx.RequestAborted);
                    await tx.CommitAsync(ctx.RequestAborted);
                    certificatesAdded++;
                }
            }

            if (item.WrappedKey is not null)
            {
                if (!Base64Url.TryDecode(item.WrappedKey, out var blob) || !WrappedShape(blob))
                {
                    refused++;
                    continue;
                }

                await using var there = new SqlCommand("""
                    SELECT COUNT(*) FROM app.key_grant
                    WHERE key_kind = N'epoch' AND key_ref = @area AND key_epoch = @epoch AND role_id = @role AND destroyed_at IS NULL;
                    """, connection);
                there.Parameters.AddWithValue("@area", areaId);
                there.Parameters.AddWithValue("@epoch", instance.Epoch);
                there.Parameters.AddWithValue("@role", role);
                if ((int)(await there.ExecuteScalarAsync(ctx.RequestAborted))! == 0)
                {
                    await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
                    try
                    {
                        await Area.GrantKeyAsync(connection, tx, role, areaId, instance.Epoch, blob, issuer, now, ctx.RequestAborted);
                        await tx.CommitAsync(ctx.RequestAborted);
                        keysAdded++;
                    }
                    catch (SqlException e) when (e.Number is 2601 or 2627)
                    {
                        await tx.RollbackAsync(ctx.RequestAborted);
                    }
                }
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            virtualAreaId = Ids.ToText(id),
            certificates = certificatesAdded,
            keys = keysAdded,
            seats = seatsAdded,
            refused
        });
    }

    /* -- Die Kleinbereiche einer Einsendung --------------------------------------------------- */

    /// <summary>
    /// Für die Kanzlei: die virtuellen Bereiche des Formulars, und für jeden der
    /// Kleinbereich dieser Einsendung (oder <c>null</c>: noch keiner) mit meiner
    /// Stufe darin. Eine Ergänzung zeigt die ihrer ersten Einsendung.
    /// </summary>
    private static async Task RegistrationAreasAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid registrationId = id, moduleId;
        Guid? seatId;
        await using (var find = new SqlCommand("""
            SELECT COALESCE(b.id, g.id), COALESCE(b.part_id, g.part_id), CASE WHEN b.id IS NULL THEN g.access_id ELSE b.access_id END
            FROM app.registration g LEFT JOIN app.registration b ON b.id = g.base_id
            WHERE g.id = @id;
            """, connection))
        {
            find.Parameters.AddWithValue("@id", id);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zgłoszenia nie ma.");
                return;
            }
            registrationId = reader.GetGuid(0);
            moduleId = reader.GetGuid(1);
            seatId = reader.IsDBNull(2) ? null : reader.GetGuid(2);
        }

        var sheet = await SheetAsync(connection, moduleId, ctx.RequestAborted);
        if (sheet is null || !await MayOfficeAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        if (!await Schema.VirtualAreasAsync(connection, ctx.RequestAborted))
        {
            await ctx.Response.WriteAsJsonAsync(new
            {
                registrationId = Ids.ToText(registrationId), moduleId = Ids.ToText(moduleId), ready = false,
                seatId = seatId is Guid none ? Ids.ToText(none) : null, areas = Array.Empty<object>()
            });
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();

        var rows = new List<(Guid Virtual, string Name, string Level, int Position, Guid? Area, int? Epoch)>();
        await using (var cmd = new SqlCommand("""
            SELECT v.area_id, a.name, v.submitter_level, v.position, ai.area_id, ia.current_epoch
            FROM app.virtual_area v
            JOIN app.area a ON a.id = v.area_id
            LEFT JOIN app.area_instance ai ON ai.virtual_area_id = v.area_id AND ai.registration_id = @registration
            LEFT JOIN app.area ia ON ia.id = ai.area_id
            WHERE v.module_id = @module
            ORDER BY v.position, v.created_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@registration", registrationId);
            cmd.Parameters.AddWithValue("@module", moduleId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetInt32(3),
                    reader.IsDBNull(4) ? null : reader.GetGuid(4), reader.IsDBNull(5) ? null : reader.GetInt32(5)));
            }
        }

        var areas = new List<object>();
        foreach (var row in rows)
        {
            var (level, _) = row.Area is Guid area ? await LevelOnAsync(connection, mine, area, now, ctx.RequestAborted) : (null, false);
            areas.Add(new
            {
                virtualAreaId = Ids.ToText(row.Virtual),
                name = row.Name,
                submitterLevel = row.Level,
                position = row.Position,
                areaId = row.Area is Guid a ? Ids.ToText(a) : null,
                epoch = row.Epoch,
                myLevel = level
            });
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            registrationId = Ids.ToText(registrationId), moduleId = Ids.ToText(moduleId), ready = true,

            /* Der Platz der Person — die Rozmowa in einem Kleinbereich, den sie erreicht, ist eine mit ihr allein (kind seat). */
            seatId = seatId is Guid seat ? Ids.ToText(seat) : null,
            areas
        });
    }
}
