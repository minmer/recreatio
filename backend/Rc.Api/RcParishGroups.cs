using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Gruppen einer Pfarrei — Ministranten, Schola, Oase, Caritas.
///
/// <b>Eine Gruppe ist ein Bereich mit einer Vordertuer.</b> Chat, Themen,
/// Termine, Aufgaben, Mitglieder und Schluessel sind schon da und schon
/// bereichsweise; dieses Modul erfindet nichts davon neu. Es legt einen
/// eigenen Bereich an, schreibt daneben auf, wozu er da ist, und macht den
/// Weg hinein begehbar.
///
/// <code>
///   rc_parish_group
///     ├── area_id        → Chat (rc_message), Themen (rc_topic), Mitglieder
///     ├── calendar_id    → Termine UND Aufgaben (rc_calendar_item)
///     └── member_role_id → der Beitrittslink (rc_invitation)
/// </code>
///
/// <b>Was hier NICHT steht, ist die Haelfte des Entwurfs.</b> Es gibt kein
/// eigenes Nachrichtenformat, keine Gruppenaufgabentabelle und keinen
/// Gruppenbeitritt. Wer im Gruppenchat schreibt, schreibt in
/// <c>POST /rc/areas/{area}/messages</c>; wer beitritt, loest eine ganz
/// gewoehnliche Einladung ein. Jede dieser Abkuerzungen waere ein zweiter
/// Lesepfad fuer dieselben Daten, und der zweite ist immer der, den beim
/// naechsten Sicherheitsbefund niemand mitprueft.
///
/// <b>Zwei Sichtbarkeiten, nebeneinander und beschriftet.</b> Der Aushang
/// (Name, Anriss, Treffzeit) ist Klartext, weil er ohne Konto ausgeliefert
/// wird — er ist fuer jemanden gedacht, der noch nicht dazugehoert. Die
/// interne Notiz liegt unter dem Epochenschluessel des Bereichs. Dieselbe
/// Grenze wie bei der Messintention, und im Formular stehen beide Felder
/// nebeneinander mit der Auskunft, wer das jeweils sieht.
/// </summary>
public static class RcParishGroups
{
    /// <summary>
    /// Adressen, die im Gruppenteil schon etwas bedeuten.
    ///
    /// <c>#/new/parish/x/community/new</c> ist der Knopf „neue Gruppe". Hiesse
    /// eine Gruppe so, waere sie unerreichbar — und niemand wuesste warum.
    /// Dieselbe Vorsichtsmassnahme wie bei den Veranstaltungen.
    /// </summary>
    private static readonly string[] ReservedSlugs = ["new", "edit"];

    public static void MapRcParishGroups(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/parishes/{id:guid}/groups", ListAsync).Produces<RcParishGroupsResponse>();
        app.MapPost("/rc/parishes/{id:guid}/groups", CreateAsync).Produces<RcParishGroupCreatedResponse>();

        app.MapGet("/rc/groups/{id:guid}", OneAsync).Produces<RcParishGroupResponse>();
        app.MapPost("/rc/groups/{id:guid}", SaveAsync).Produces<RcParishGroupSavedResponse>();

        // Der Aushang. Ohne Konto — das ist sein ganzer Zweck.
        app.MapGet("/rc/public/parishes/{slug}/groups", PublicAsync)
           .Produces<RcPublicParishGroupsResponse>();
    }

    // -- AAD ------------------------------------------------------------------

    /// <summary>
    /// 3.13 — die interne Notiz klebt an IHRER Gruppe.
    ///
    /// Ohne die Gruppenkennung in der Huelle liesse sich die Notiz einer
    /// Gruppe an den Platz einer anderen schieben, solange beide im selben
    /// Bereich liegen. Sie liegen es nie — jede Gruppe hat ihren —, aber das
    /// ist eine Eigenschaft der heutigen Ablage und keine Zusicherung.
    /// </summary>
    private static RcAad NoteAad(Guid groupId) =>
        RcAad.Create("parish", "group", groupId, RcField.ParishGroupNote, 1);

    // -- Anlegen --------------------------------------------------------------

    public sealed record CreateRequest(
        string PersonRoleId, string Slug, string Name,
        string? Summary, string? Meets, bool? IsPublic, string? Note);

    /// <summary>
    /// Eine Gruppe entsteht in EINER Transaktion, mit allem, was sie braucht.
    ///
    /// <b>Warum nicht in vier Aufrufen.</b> Der Browser koennte es: Rolle
    /// anlegen, Bereich anlegen, Kalender anlegen, Gruppe eintragen. Scheitert
    /// der dritte, steht ein Bereich mit einer Mitgliedsrolle herum, der zu
    /// nichts gehoert — und beim naechsten Versuch der naechste. Genau das ist
    /// bei der Pfarrei passiert, bevor <see cref="RcAreas.InsertAreaAsync"/>
    /// herausgeloest wurde; zwischen zwei Anfragen gibt es kein Zurueck.
    ///
    /// <b>Die Reihenfolge ist nicht beliebig.</b> Die Mitgliedsrolle entsteht
    /// VOR dem Bereich, damit sie beim Schnitt der ersten Epoche schon dasteht
    /// und den Schluessel mitbekommt. Wuerde sie danach aufgenommen, muesste
    /// sofort eine zweite Epoche geschnitten werden — zwei Schluessel fuer
    /// einen Bereich, der eine Sekunde alt ist.
    /// </summary>
    private static async Task CreateAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, CreateRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.PersonRoleId, out var personRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Das ist keine Rollenkennung.");
            return;
        }

        var slug = RcEvents.Slugify(body.Slug);
        var name = body.Name?.Trim() ?? "";

        if (slug.Length is 0 or > 80 || name.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Adresse oder Name fehlen.");
            return;
        }

        if (ReservedSlugs.Contains(slug))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                $"„{slug}“ bedeutet in der Adresse eine Handlung, keinen Namen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var parish = await ParishAsync(connection, id, ctx.RequestAborted);
        if (parish is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.ParishNotFound, "Diese Pfarrei gibt es nicht.");
            return;
        }

        // Verwalten der PFARREI ist die Bedingung — eine Gruppe gehoert zu ihr,
        // und wer sie gruenden darf, entscheidet die Pfarrei und nicht der
        // Gruendende. Der eigene Bereich der Gruppe existiert noch nicht.
        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, parish.AreaId,
            RcCapability.Admin, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var personKey = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, held.MasterKey, personRoleId, ctx.RequestAborted);
        if (personKey is null) { await RcAreas.NotForYou(ctx); return; }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(
            connection, [personRoleId], ctx.RequestAborted);
        if (!identities.TryGetValue(personRoleId, out var person))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var groupId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        try
        {
            /*
             * DIE MITGLIEDSROLLE — die Zugehoerigkeit, nicht der Mensch.
             *
             * Sie bedeutet „gehoert zu dieser Gruppe". Der Beitrittslink
             * versiegelt IHREN Schluessel; wer ihn einloest, haengt sie an
             * seine persoenliche Rolle und kommt darueber an die
             * Bereichsschluessel.
             *
             * `kind = group` steht schon in RcRoleKinds und meint genau das.
             */
            var (memberRoleId, memberKey) = await RcRoles.InsertHeldRoleAsync(
                connection, tx, personRoleId, personKey, person, parish.TenantId,
                RcRoleKinds.Group, name, ctx.RequestAborted);

            // Unter dem Mitgliedsschluessel wird hier nichts versiegelt — also
            // weg damit, statt ihn bis zum Ende der Anfrage liegen zu lassen.
            CryptographicOperations.ZeroMemory(memberKey);

            var (areaId, epochKey) = await RcAreas.InsertAreaAsync(
                connection, tx, personRoleId, personKey, person, parish.TenantId, name,
                false, ctx.RequestAborted, alsoWrite: memberRoleId);

            try
            {
                var calendarId = RcId.NewId();
                await using (var calendar = new SqlCommand("""
                    INSERT INTO dbo.rc_calendar (id, area_id, tenant_id, title, time_zone, created_at)
                    VALUES (@id, @area, @tenant, @title, @tz, @now);
                    """, connection, tx))
                {
                    calendar.Parameters.AddWithValue("@id", calendarId);
                    calendar.Parameters.AddWithValue("@area", areaId);
                    calendar.Parameters.AddWithValue("@tenant", parish.TenantId);
                    calendar.Parameters.AddWithValue("@title", name);

                    // Dieselbe Vorgabe wie bei jedem anderen Kalender. Eine
                    // Gruppe, die woanders lebt, aendert sie danach.
                    calendar.Parameters.AddWithValue("@tz", "Europe/Warsaw");
                    calendar.Parameters.AddWithValue("@now", now);
                    await calendar.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                /*
                 * Die interne Notiz liegt unter dem Schluessel der gerade
                 * geschnittenen Epoche. Ihn hinterher zu holen ginge nicht:
                 * RcAreaKeys kennt diese Transaktion nicht, und ausserhalb
                 * gibt es den Bereich noch nicht.
                 */
                var note = Trim(body.Note, 20_000);
                var noteSealed = note is null
                    ? null
                    : RcCrypto.Seal(epochKey, NoteAad(groupId), Encoding.UTF8.GetBytes(note));

                /*
                 * WELCHE EPOCHE DAS IST, WIRD GEFRAGT UND NICHT GERATEN.
                 *
                 * Hier stand eine 1. Sie stimmt auch — CutEpochAsync rechnet
                 * `MAX(epoch)+1`, und ein frischer Bereich hat keine. Aber sie
                 * stimmt aus einem Grund, der ANDERSWO steht: aendert sich das
                 * Anlegen eines Bereichs je, laege die Notiz unter Epoche 2 und
                 * waere als Epoche 1 verbucht. Sie ginge nie wieder auf, und im
                 * Formular saehe das aus wie „keine Notiz" — also wie ein Feld,
                 * auf das man schreiben darf.
                 *
                 * Eine Abfrage ist billiger als dieser Fehler.
                 */
                int noteEpoch = 0;
                if (noteSealed is not null)
                {
                    await using var current = new SqlCommand(
                        "SELECT current_epoch FROM dbo.rc_area WHERE id = @area;", connection, tx);
                    current.Parameters.AddWithValue("@area", areaId);
                    noteEpoch = Convert.ToInt32(
                        await current.ExecuteScalarAsync(ctx.RequestAborted),
                        System.Globalization.CultureInfo.InvariantCulture);
                }

                await using (var insert = new SqlCommand("""
                    INSERT INTO dbo.rc_parish_group
                        (id, parish_id, tenant_id, area_id, member_role_id, calendar_id,
                         slug, name, summary, meets, is_public,
                         note_sealed, note_epoch, lifecycle, created_at)
                    VALUES (@id, @parish, @tenant, @area, @member, @calendar,
                            @slug, @name, @summary, @meets, @public,
                            @note, @noteEpoch, N'active', @now);
                    """, connection, tx))
                {
                    insert.Parameters.AddWithValue("@id", groupId);
                    insert.Parameters.AddWithValue("@parish", parish.ParishId);
                    insert.Parameters.AddWithValue("@tenant", parish.TenantId);
                    insert.Parameters.AddWithValue("@area", areaId);
                    insert.Parameters.AddWithValue("@member", memberRoleId);
                    insert.Parameters.AddWithValue("@calendar", calendarId);
                    insert.Parameters.AddWithValue("@slug", slug);
                    insert.Parameters.AddWithValue("@name", name);
                    insert.Parameters.Add("@summary", System.Data.SqlDbType.NVarChar, 400).Value =
                        (object?)Trim(body.Summary, 400) ?? DBNull.Value;
                    insert.Parameters.Add("@meets", System.Data.SqlDbType.NVarChar, 200).Value =
                        (object?)Trim(body.Meets, 200) ?? DBNull.Value;
                    insert.Parameters.AddWithValue("@public", body.IsPublic ?? true);
                    insert.Parameters.Add("@note", System.Data.SqlDbType.VarBinary).Value =
                        (object?)noteSealed ?? DBNull.Value;

                    // Ohne Notiz bleibt auch die Epoche leer — die Tabelle
                    // laesst nichts anderes zu (ck_rc_parish_group_note).
                    insert.Parameters.Add("@noteEpoch", System.Data.SqlDbType.Int).Value =
                        noteSealed is null ? DBNull.Value : noteEpoch;
                    insert.Parameters.AddWithValue("@now", now);
                    await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
                }
            }
            finally
            {
                // Der Schluessel gehoert ab InsertAreaAsync uns — samt der
                // Pflicht, ihn wegzuraeumen, auch wenn dazwischen etwas bricht.
                CryptographicOperations.ZeroMemory(epochKey);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.IdDuplicate, "Diese Adresse ist in dieser Pfarrei vergeben.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new RcParishGroupCreatedResponse(
            RcId.ToText(groupId), slug, name), StatusCodes.Status201Created);
    }

    // -- Auflisten ------------------------------------------------------------

    private static async Task ListAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var rows = await RowsAsync(connection, "g.parish_id = @key", id, ctx.RequestAborted);

        /*
         * DIE ROLLENSCHLUESSEL EINMAL, NICHT JE GRUPPE.
         *
         * „Gehoere ich dazu" heisst: kann ich die Mitgliedsrolle oeffnen. Der
         * Rollengraph wird dafuer EINMAL abgelaufen; je Gruppe zu fragen
         * hiesse bei zwoelf Gruppen zwoelf Laeufe durch denselben Graphen.
         */
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var roleKeys = await RcRoleAccess.AllRoleKeysAsync(
            connection, session.AccountId, held.MasterKey, ctx.RequestAborted);

        var groups = new List<RcParishGroupView>();
        foreach (var row in rows)
        {
            var mayAdmin = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
                row.AreaId, RcCapability.Admin, ctx.RequestAborted);

            var mayRead = mayAdmin.Allowed || roleKeys.ContainsKey(row.MemberRoleId);

            /*
             * WER WEDER MITGLIED IST NOCH VERWALTET, SIEHT NUR DEN AUSHANG.
             *
             * Eine nicht oeffentliche Gruppe steht fuer ihn gar nicht in der
             * Liste. Das ist kein Geheimnis um ihrer selbst willen: „es gibt
             * hier eine Gruppe fuer Suchtkranke" ist bereits die Auskunft, die
             * niemanden ausserhalb angeht.
             */
            if (!mayRead && !row.IsPublic) continue;

            groups.Add(new RcParishGroupView(
                RcId.ToText(row.GroupId), row.Slug, row.Name,
                row.Summary, row.Meets, row.IsPublic, row.Lifecycle,
                RcId.ToText(row.AreaId), RcId.ToText(row.CalendarId), RcId.ToText(row.MemberRoleId),
                row.Members, roleKeys.ContainsKey(row.MemberRoleId), mayAdmin.Allowed));
        }

        await RcResults.WriteJsonAsync(ctx, new RcParishGroupsResponse(RcId.ToText(id), groups));
    }

    // -- Eine einzelne --------------------------------------------------------

    private static async Task OneAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var rows = await RowsAsync(connection, "g.id = @key", id, ctx.RequestAborted);
        if (rows.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.NotFoundOrNoAccess, "Diese Gruppe gibt es nicht.");
            return;
        }

        var row = rows[0];

        var mayAdmin = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
            row.AreaId, RcCapability.Admin, ctx.RequestAborted);

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var roleKeys = await RcRoleAccess.AllRoleKeysAsync(
            connection, session.AccountId, held.MasterKey, ctx.RequestAborted);

        var mine = roleKeys.ContainsKey(row.MemberRoleId);

        if (!mine && !mayAdmin.Allowed && !row.IsPublic)
        {
            // Dieselbe Antwort wie „gibt es nicht". Ein eigener Code hier
            // waere die Auskunft, dass es sie gibt.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.NotFoundOrNoAccess, "Diese Gruppe gibt es nicht.");
            return;
        }

        string? note = null;
        string? unreadable = null;

        if (row.NoteSealed is not null && row.NoteEpoch is not null)
        {
            var keys = await RcAreaKeys.EpochKeysAsync(
                connection, session.AccountId, held.MasterKey, row.AreaId, ctx.RequestAborted);

            if (!keys.TryGetValue(row.NoteEpoch.Value, out var key))
            {
                unreadable = RcErrorCodes.CryptoMissingEpoch;
            }
            else
            {
                try
                {
                    note = Encoding.UTF8.GetString(
                        RcCrypto.Open(key, NoteAad(row.GroupId), row.NoteSealed));
                }
                catch (RcDecryptException)
                {
                    unreadable = RcErrorCodes.CryptoAadMismatch;
                }
            }
        }

        await RcResults.WriteJsonAsync(ctx, new RcParishGroupResponse(
            RcId.ToText(row.GroupId), RcId.ToText(row.ParishId), row.ParishSlug, row.Slug, row.Name,
            row.Summary, row.Meets, row.IsPublic, row.Lifecycle,
            RcId.ToText(row.AreaId), RcId.ToText(row.CalendarId), RcId.ToText(row.MemberRoleId),
            row.Members, mine, mayAdmin.Allowed, note, unreadable));
    }

    // -- Aendern --------------------------------------------------------------

    public sealed record SaveRequest(
        string? Name, string? Summary, string? Meets, bool? IsPublic,
        string? Note, bool? ClearNote, string? Lifecycle);

    /// <summary>
    /// Was sich aendern laesst — und was nicht.
    ///
    /// <b>Die Adresse bleibt.</b> Sie steht in Links, die weitergegeben wurden,
    /// und in Lesezeichen. Eine Gruppe umzubenennen ist alltaeglich; ihre
    /// Adresse zu wechseln hiesse, jeden dieser Links stillschweigend ins
    /// Leere laufen zu lassen. Wer wirklich eine andere Adresse braucht, legt
    /// eine Gruppe an und archiviert die alte — dann ist der Bruch sichtbar.
    ///
    /// <b>Ein weggelassenes Feld bleibt, wie es ist.</b> <c>null</c> heisst
    /// „nicht angefasst" und nicht „leeren"; Leeren ist eine eigene Ansage
    /// (<see cref="SaveRequest.ClearNote"/>). Sonst loeschte ein Formular, das
    /// nur den Namen schickt, die interne Notiz mit.
    /// </summary>
    private static async Task SaveAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, SaveRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var rows = await RowsAsync(connection, "g.id = @key", id, ctx.RequestAborted);
        if (rows.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.NotFoundOrNoAccess, "Diese Gruppe gibt es nicht.");
            return;
        }

        var row = rows[0];

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
            row.AreaId, RcCapability.Admin, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var name = body.Name is null ? row.Name : body.Name.Trim();
        if (name.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Name fehlt oder ist zu lang.");
            return;
        }

        var lifecycle = body.Lifecycle?.Trim().ToLowerInvariant();
        if (lifecycle is not null && lifecycle is not ("active" or "archived"))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diesen Zustand gibt es nicht.");
            return;
        }

        byte[]? noteSealed = row.NoteSealed;
        int? noteEpoch = row.NoteEpoch;

        if (body.ClearNote == true)
        {
            noteSealed = null;
            noteEpoch = null;
        }
        else if (Trim(body.Note, 20_000) is string text)
        {
            /*
             * NEU VERSIEGELT WIRD UNTER DER LAUFENDEN EPOCHE, nicht unter der
             * alten. Wer inzwischen ausgetreten ist, soll die neue Fassung
             * nicht lesen — das ist der Sinn des Schnitts. Die alte Fassung
             * hat er ohnehin gesehen; sie ihm rueckwirkend zu nehmen ist ein
             * Versprechen, das keine Software halten kann.
             */
            using var held = await masterKeys.OpenAsync(
                connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

            var keys = await RcAreaKeys.EpochKeysAsync(
                connection, session.AccountId, held.MasterKey, row.AreaId, ctx.RequestAborted);

            if (keys.Count == 0)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                    RcErrorCodes.CryptoMissingKey,
                    "Fuer diesen Bereich hast du keinen Schluessel — die Notiz bliebe unlesbar.");
                return;
            }

            noteEpoch = keys.Keys.Max();
            noteSealed = RcCrypto.Seal(keys[noteEpoch.Value], NoteAad(row.GroupId),
                Encoding.UTF8.GetBytes(text));
        }

        await using var update = new SqlCommand("""
            UPDATE dbo.rc_parish_group
               SET name = @name,
                   summary = @summary,
                   meets = @meets,
                   is_public = @public,
                   note_sealed = @note,
                   note_epoch = @noteEpoch,
                   lifecycle = @lifecycle
             WHERE id = @id;
            """, connection);

        update.Parameters.AddWithValue("@id", row.GroupId);
        update.Parameters.AddWithValue("@name", name);
        update.Parameters.Add("@summary", System.Data.SqlDbType.NVarChar, 400).Value =
            (object?)(body.Summary is null ? row.Summary : Trim(body.Summary, 400)) ?? DBNull.Value;
        update.Parameters.Add("@meets", System.Data.SqlDbType.NVarChar, 200).Value =
            (object?)(body.Meets is null ? row.Meets : Trim(body.Meets, 200)) ?? DBNull.Value;
        update.Parameters.AddWithValue("@public", body.IsPublic ?? row.IsPublic);
        update.Parameters.Add("@note", System.Data.SqlDbType.VarBinary).Value =
            (object?)noteSealed ?? DBNull.Value;
        update.Parameters.Add("@noteEpoch", System.Data.SqlDbType.Int).Value =
            (object?)noteEpoch ?? DBNull.Value;
        update.Parameters.AddWithValue("@lifecycle", lifecycle ?? row.Lifecycle);

        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcParishGroupSavedResponse(
            RcId.ToText(row.GroupId), row.Slug, name));
    }

    // -- Der Aushang ----------------------------------------------------------

    /// <summary>
    /// Was ohne Konto sichtbar ist.
    ///
    /// Nur <c>is_public</c> und nur <c>active</c>: eine archivierte Gruppe im
    /// Schaukasten schickt Leute zu Treffen, die es nicht mehr gibt.
    /// </summary>
    private static async Task PublicAsync(HttpContext ctx, RcDb db, string slug)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT g.slug, g.name, g.summary, g.meets
            FROM dbo.rc_parish_group g
            JOIN dbo.rc_parish p ON p.id = g.parish_id
            WHERE p.slug = @slug AND g.is_public = 1 AND g.lifecycle = N'active'
            ORDER BY g.name;
            """, connection);
        cmd.Parameters.AddWithValue("@slug", slug);

        var groups = new List<RcPublicParishGroupView>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
                groups.Add(new RcPublicParishGroupView(
                    reader.GetString(0), reader.GetString(1),
                    reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcPublicParishGroupsResponse(slug, groups));
    }

    // -- Lesen aus der Tabelle ------------------------------------------------

    private sealed record Row(
        Guid GroupId, Guid ParishId, string ParishSlug, Guid TenantId,
        Guid AreaId, Guid MemberRoleId, Guid CalendarId,
        string Slug, string Name, string? Summary, string? Meets, bool IsPublic,
        byte[]? NoteSealed, int? NoteEpoch, string Lifecycle, int Members);

    /// <summary>
    /// Eine Gruppe oder alle einer Pfarrei — dieselben Spalten, dieselbe Zeile.
    ///
    /// <b>Warum EINE Abfrage mit eingesetzter Bedingung</b> und nicht zwei
    /// nebeneinander: zwei Abfragen ueber dieselbe Tabelle laufen auseinander,
    /// sobald eine Spalte dazukommt, und dann zeigt die Liste etwas anderes als
    /// die Einzelansicht. Die Bedingung ist ein fester Text aus diesem Modul,
    /// kein Wert von aussen — der steht als <c>@key</c> gebunden daneben.
    /// </summary>
    private static async Task<List<Row>> RowsAsync(
        SqlConnection connection, string where, Guid key, CancellationToken ct)
    {
        await using var cmd = new SqlCommand($"""
            SELECT g.id, g.parish_id, p.slug, g.tenant_id,
                   g.area_id, g.member_role_id, g.calendar_id,
                   g.slug, g.name, g.summary, g.meets, g.is_public,
                   g.note_sealed, g.note_epoch, g.lifecycle,

                   /*
                       Wie viele ROLLEN dazugehoeren — dieselbe Zaehlung wie in
                       RcAreaKeys.MembersAsync, samt DISTINCT und Ablauf.

                       Ohne DISTINCT waere die Zahl falsch und sehr
                       ueberzeugend: der Gruender traegt zwei Zertifikate
                       (admin und certify), stuende also als zwei Mitglieder
                       da. Eine frisch angelegte Gruppe meldete „2 czlonkow",
                       bevor jemand beigetreten ist.
                   */
                   (SELECT COUNT(DISTINCT c.subject_role_id)
                      FROM dbo.rc_certificate c
                      JOIN dbo.rc_role r ON r.id = c.subject_role_id AND r.revoked_at IS NULL
                     WHERE c.scope_kind = 'area' AND c.scope_id = g.area_id
                       AND c.revoked_at IS NULL AND c.expires_at > @now)
            FROM dbo.rc_parish_group g
            JOIN dbo.rc_parish p ON p.id = g.parish_id
            WHERE {where}
            ORDER BY g.name;
            """, connection);

        cmd.Parameters.AddWithValue("@key", key);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        var rows = new List<Row>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            rows.Add(new Row(
                reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetGuid(3),
                reader.GetGuid(4), reader.GetGuid(5), reader.GetGuid(6),
                reader.GetString(7), reader.GetString(8),
                reader.IsDBNull(9) ? null : reader.GetString(9),
                reader.IsDBNull(10) ? null : reader.GetString(10),
                reader.GetBoolean(11),
                reader.IsDBNull(12) ? null : (byte[])reader[12],
                reader.IsDBNull(13) ? null : reader.GetInt32(13),
                reader.GetString(14),
                reader.GetInt32(15)));
        }

        return rows;
    }

    private sealed record ParishRow(Guid ParishId, Guid AreaId, Guid TenantId, string Slug);

    private static async Task<ParishRow?> ParishAsync(
        SqlConnection connection, Guid parishId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, area_id, tenant_id, slug FROM dbo.rc_parish WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", parishId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new ParishRow(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetString(3));
    }

    /// <summary>Leer ist dasselbe wie nicht gesetzt — sonst stuende ein Leerzeichen im Aushang.</summary>
    private static string? Trim(string? value, int max)
    {
        var text = value?.Trim() ?? "";
        return text.Length == 0 ? null : text.Length > max ? text[..max] : text;
    }
}
