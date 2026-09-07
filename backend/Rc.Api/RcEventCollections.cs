using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Die Sammlung ueber den Veranstaltungen — der Veranstaltungsteil eines
/// Veranstalters.
///
/// <b>Warum es sie gibt.</b> Vorher war die Veranstaltung das oberste Ding,
/// und eine Zeile trug alles: Adresse, Bereich, Amt, Annahmeschluessel und die
/// Klausel nach RODO. Wer „recreatio" gruendete, bekam damit eine
/// Veranstaltung namens „recreatio" — nicht die Seite des Hauses, unter der
/// viele liegen. Das Amt sollte aber „den ganzen Veranstaltungsteil"
/// verwalten, und nach dem Verantwortlichen fuer die Daten wird EINMAL gefragt,
/// nicht bei jedem Fest neu.
///
/// <b>Was die Sammlung traegt und was nicht.</b>
///
/// <code>
///   rc_event_collection   Adresse, Veranstalter, Klausel, Amt, eigener Bereich
///        |
///        +-- rc_event      EIGENER Bereich, EIGENE Schluessel, EIGENES Amt
/// </code>
///
/// Jede Veranstaltung behaelt ihren eigenen Bereich, weil sonst, wer beim
/// Pfarrfest die Anmeldungen fuehrt, auch die der Pilgerfahrt oeffnete. Das Amt
/// der Sammlung HAELT die Aemter der einzelnen Veranstaltungen: wer die
/// Sammlung verwaltet, kommt ueberall hin; wer nur ein Fest bekommt, bleibt
/// dort. Es ist dieselbe Grenze, aus der eine Veranstaltung schon bisher nicht
/// im Bereich der Pfarrei liegt — eine Ebene tiefer gezogen.
///
/// <b>Die Adresse.</b> <c>/event/recreatio/kal26</c>. Die Sammlung nennt sich
/// global eindeutig, die Veranstaltung nur innerhalb ihrer Sammlung — sonst
/// verbrauchte die erste Pfarrei mit einem „festyn-2026" den Namen fuer alle.
/// </summary>
public static class RcEventCollections
{
    public static void MapRcEventCollections(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/event-collections", ListAsync).Produces<RcEventCollectionsResponse>();

        /*
         * Gruenden — Bereich, Amt, Schluessel und Eintrag in EINER Transaktion.
         * Das ist der einzige Weg, auf dem eine Sammlung entsteht: sie ohne
         * Verantwortlichen anzulegen hiesse, spaeter Anmeldungen unter einer
         * unvollstaendigen Klausel entgegenzunehmen.
         */
        app.MapPost("/rc/event-collections", FoundAsync)
            .Produces<RcEventCollectionFoundedResponse>();

        // Ohne Konto lesbar, wenn veroeffentlicht — der Katalog ist die Seite,
        // die man verschickt.
        app.MapGet("/rc/event-collections/{slug}", ReadAsync)
            .Produces<RcEventCollectionViewResponse>();

        app.MapPost("/rc/event-collections/{id:guid}/events", AddEventAsync)
            .Produces<RcEventFoundedResponse>();

        app.MapPost("/rc/event-collections/{id:guid}/publish", PublishAsync)
            .Produces<RcEventCollectionPublishedResponse>();
    }

    private const string LifecyclePublished = "published";
    private const string LifecycleArchived = "archived";

    // -- Gruenden -------------------------------------------------------------

    public sealed record FoundCollectionRequest(
        string? FounderRoleId, string? OrganizerRoleId,
        string? Slug, string? Title,
        string? OrganizerName, string? OrganizerAddress, string? OrganizerEmail);

    /// <summary>
    /// Eine Sammlung gruenden.
    ///
    /// <b>Warum nicht der Browser.</b> Er hat es bei den Pfarreien in drei
    /// Aufrufen getan, und zwischen zwei Anfragen gibt es kein Zurueck: brach
    /// die zweite ab, blieb die erste stehen. Sichtbar wurde das als Liste
    /// gleichnamiger Bereiche, die zu nichts gehoerten.
    /// </summary>
    private static async Task FoundAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        FoundCollectionRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.FounderRoleId, out var founderRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Das ist keine Rollenkennung.");
            return;
        }

        var slug = RcEvents.Slugify(body.Slug);
        var title = body.Title?.Trim() ?? "";

        if (slug.Length is 0 or > 80 || title.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Adresse oder Titel fehlen.");
            return;
        }

        /*
         * DIE KLAUSEL BRAUCHT EINEN NAMEN UND EINE ANSCHRIFT.
         *
         * Unter dieser Sammlung wird spaeter jede Veranstaltung Anmeldungen
         * entgegennehmen. Ein Formular, das personenbezogene Daten aufnimmt,
         * muss sagen, WER sie verarbeitet und unter welcher Anschrift — sonst
         * ist die Klausel unvollstaendig und die darunter erteilte Zustimmung
         * auch.
         *
         * Hier gefragt und nicht bei jeder Veranstaltung: der Verantwortliche
         * ist der Veranstalter, nicht das einzelne Fest.
         */
        var organizerName = (body.OrganizerName ?? string.Empty).Trim();
        var organizerAddress = (body.OrganizerAddress ?? string.Empty).Trim();

        if (organizerName.Length is 0 or > 200 || organizerAddress.Length is 0 or > 400)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                "Ohne Veranstalter und Anschrift laesst sich keine Anmeldung entgegennehmen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var tenantId = await RcAreas.TenantOfRoleAsync(connection, founderRoleId, ctx.RequestAborted);
        if (tenantId == Guid.Empty)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Tenant, tenantId,
            RcCapability.Certify, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        if (await SlugTakenAsync(connection, null, slug, ctx.RequestAborted))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Diese Adresse ist schon vergeben.");
            return;
        }

        using var held = await masterKeys.OpenAsync(
            connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var founderKey = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, held.MasterKey, founderRoleId, ctx.RequestAborted);

        if (founderKey is null) { await RcAreas.NotForYou(ctx); return; }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(
            connection, [founderRoleId], ctx.RequestAborted);

        if (!identities.TryGetValue(founderRoleId, out var founder))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        // Ohne genannte Veranstalterrolle gilt die gruendende. Der haeufige
        // Fall: jemand richtet seinen Veranstaltungsteil fuer sich selbst ein.
        var organizerRoleId = Guid.TryParse(body.OrganizerRoleId, out var named)
            ? named : founderRoleId;

        var collectionId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        try
        {
            /*
             * DAS AMT ZUERST — vor dem Bereich, damit es beim Schnitt der ersten
             * Epoche schon dasteht und deren Schluessel mitbekommt. Danach
             * angelegt, muesste er ihm nachtraeglich zugeteilt werden.
             */
            var (officeId, officeKey) = await RcRoles.InsertHeldRoleAsync(
                connection, tx, founderRoleId, founderKey, founder, tenantId,
                RcRoleKinds.Office, title, ctx.RequestAborted);

            // Unter dem Amtsschluessel wird hier nichts versiegelt — also weg
            // damit, statt ihn bis zum Ende der Anfrage liegen zu lassen.
            System.Security.Cryptography.CryptographicOperations.ZeroMemory(officeKey);

            var (areaId, epochKey) = await RcAreas.InsertAreaAsync(
                connection, tx, founderRoleId, founderKey, founder, tenantId, title,
                false, ctx.RequestAborted, officeId);

            // Der Bereich der Sammlung traegt (noch) nichts Versiegeltes: die
            // Annahmeschluessel entstehen je Veranstaltung.
            System.Security.Cryptography.CryptographicOperations.ZeroMemory(epochKey);

            await using (var insert = new SqlCommand("""
                INSERT INTO dbo.rc_event_collection
                    (id, tenant_id, area_id, office_role_id, slug, title,
                     organizer_role_id, organizer_name, organizer_address, organizer_email,
                     lifecycle, created_at)
                VALUES (@id, @tenant, @area, @office, @slug, @title,
                        @organizer, @orgName, @orgAddress, @orgEmail,
                        N'draft', @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", collectionId);
                insert.Parameters.AddWithValue("@tenant", tenantId);
                insert.Parameters.AddWithValue("@area", areaId);
                insert.Parameters.AddWithValue("@office", officeId);
                insert.Parameters.AddWithValue("@slug", slug);
                insert.Parameters.AddWithValue("@title", title);
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.AddWithValue("@organizer", organizerRoleId);
                insert.Parameters.AddWithValue("@orgName", organizerName);
                insert.Parameters.AddWithValue("@orgAddress", organizerAddress);

                var email = (body.OrganizerEmail ?? string.Empty).Trim();
                insert.Parameters.Add("@orgEmail", System.Data.SqlDbType.NVarChar, 200).Value =
                    email.Length == 0 ? DBNull.Value : email;

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);

            await RcResults.WriteJsonAsync(ctx, new RcEventCollectionFoundedResponse(
                RcId.ToText(collectionId), RcId.ToText(areaId), RcId.ToText(officeId), slug),
                StatusCodes.Status201Created);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }

    // -- Eine Veranstaltung hineinstellen --------------------------------------

    public sealed record AddEventRequest(
        string? Slug, string? Title, DateTimeOffset? StartsUtc, DateTimeOffset? EndsUtc);

    /// <summary>
    /// Eine Veranstaltung in eine Sammlung stellen.
    ///
    /// <b>Der Schluessel des Amtes IST die Berechtigung.</b> Wer das Amt der
    /// Sammlung nicht aufschliessen kann, kann auch das Amt der neuen
    /// Veranstaltung nicht darunter verschliessen — die Pruefung faellt also
    /// mit der Sache zusammen, statt daneben zu stehen und irgendwann von ihr
    /// abzuweichen.
    ///
    /// <b>Nach dem Verantwortlichen wird nicht noch einmal gefragt.</b> Er
    /// steht an der Sammlung; die Klausel unter dem Formular liest ihn von
    /// dort.
    /// </summary>
    private static async Task AddEventAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, Guid id, AddEventRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var slug = RcEvents.Slugify(body.Slug);
        var title = body.Title?.Trim() ?? "";

        if (slug.Length is 0 or > 80 || title.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Adresse oder Titel fehlen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid tenantId, officeRoleId;
        await using (var head = new SqlCommand("""
            SELECT tenant_id, office_role_id FROM dbo.rc_event_collection WHERE id = @id;
            """, connection))
        {
            head.Parameters.AddWithValue("@id", id);
            await using var reader = await head.ExecuteReaderAsync(ctx.RequestAborted);

            if (!await reader.ReadAsync(ctx.RequestAborted)) { await RcAreas.NotForYou(ctx); return; }

            tenantId = reader.GetGuid(0);

            /*
             * Eine Sammlung ohne Amt kann keine Veranstaltung aufnehmen: es
             * gaebe keinen Schluessel, unter dem das Amt der neuen entstuende.
             * So sehen die beim Umzug nachgetragenen Sammlungen aus (rc_0027);
             * sie sind lesbar, aber nicht fortzufuehren.
             */
            if (reader.IsDBNull(1))
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                    RcErrorCodes.PermissionDenied,
                    "Diese Sammlung hat kein Amt — sie laesst sich nicht fortfuehren.");
                return;
            }

            officeRoleId = reader.GetGuid(1);
        }

        if (await SlugTakenAsync(connection, id, slug, ctx.RequestAborted))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Diese Adresse ist in dieser Sammlung schon vergeben.");
            return;
        }

        using var held = await masterKeys.OpenAsync(
            connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var officeKey = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, held.MasterKey, officeRoleId, ctx.RequestAborted);

        if (officeKey is null) { await RcAreas.NotForYou(ctx); return; }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(
            connection, [officeRoleId], ctx.RequestAborted);

        if (!identities.TryGetValue(officeRoleId, out var office))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var eventId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        try
        {
            // Das Amt der Veranstaltung haengt am Amt der Sammlung — daher
            // kommt sein Schluessel, und daher kommt die Reichweite: wer die
            // Sammlung verwaltet, verwaltet auch das Fest.
            var (eventOfficeId, eventOfficeKey) = await RcRoles.InsertHeldRoleAsync(
                connection, tx, officeRoleId, officeKey, office, tenantId,
                RcRoleKinds.Office, title, ctx.RequestAborted);

            var (areaId, epochKey) = await RcAreas.InsertAreaAsync(
                connection, tx, officeRoleId, officeKey, office, tenantId, title,
                false, ctx.RequestAborted, eventOfficeId);

            // Unter dem Epochenschluessel wird hier nichts mehr versiegelt.
            System.Security.Cryptography.CryptographicOperations.ZeroMemory(epochKey);

            /*
             * DER ANNAHMESCHLUESSEL GEHOERT DEM AMT, NICHT DEM BEREICH.
             *
             * Ein Anmeldeformular arbeitet mit einem Paar: den OEFFENTLICHEN
             * Teil bekommt jeder, der sich anmeldet — damit verschliesst er
             * seine Antworten. Der PRIVATE Teil oeffnet sie wieder und gehoert
             * dem, der die Veranstaltung fuehrt.
             *
             * Laege er unter dem Epochenschluessel des Bereichs, koennte jeder
             * Helfer, den man zum Vorbereiten hinzubittet, saemtliche
             * Anmeldungen lesen — Namen, Ernaehrung, Unvertraeglichkeiten.
             * Niemand muesste ihm etwas geben; es folgte aus der
             * Mitgliedschaft. Genau so war es hier, bis rc_0031.
             *
             * `intake_epoch = 0` sagt: dieser Schluessel haengt an keiner
             * Epoche. Ein Epochenschnitt macht ihn nicht unbrauchbar, und
             * niemand muss raten, unter welcher er lag. Dieselbe Verabredung
             * wie im Firmmodul, wo sie von Anfang an richtig war.
             *
             * Der Annahmeschluessel entsteht MIT der Veranstaltung, nicht beim
             * ersten Formular — sonst haette man ein Formular, das noch nichts
             * annehmen kann.
             */
            const int intakeEpoch = 0;
            byte[] intakePublic, intakeSealed;

            using (var intake = System.Security.Cryptography.RSA.Create(4096))
            {
                intakePublic = intake.ExportSubjectPublicKeyInfo();
                intakeSealed = RcCrypto.Seal(
                    eventOfficeKey, RcEvents.IntakeAad(eventId), intake.ExportPkcs8PrivateKey());
            }

            System.Security.Cryptography.CryptographicOperations.ZeroMemory(eventOfficeKey);

            await using (var insert = new SqlCommand("""
                INSERT INTO dbo.rc_event
                    (id, collection_id, area_id, tenant_id, office_role_id,
                     slug, title, lifecycle, is_public,
                     starts_at, ends_at, created_at,
                     intake_public_key, intake_private_sealed, intake_epoch)
                VALUES (@id, @collection, @area, @tenant, @office,
                        @slug, @title, N'draft', 0,
                        @starts, @ends, @now,
                        @intakePub, @intakeSealed, @intakeEpoch);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", eventId);
                insert.Parameters.AddWithValue("@collection", id);
                insert.Parameters.AddWithValue("@area", areaId);
                insert.Parameters.AddWithValue("@tenant", tenantId);
                insert.Parameters.AddWithValue("@office", eventOfficeId);
                insert.Parameters.AddWithValue("@slug", slug);
                insert.Parameters.AddWithValue("@title", title);
                insert.Parameters.Add("@starts", System.Data.SqlDbType.DateTimeOffset).Value =
                    (object?)body.StartsUtc ?? DBNull.Value;
                insert.Parameters.Add("@ends", System.Data.SqlDbType.DateTimeOffset).Value =
                    (object?)body.EndsUtc ?? DBNull.Value;
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.AddWithValue("@intakePub", intakePublic);
                insert.Parameters.AddWithValue("@intakeSealed", intakeSealed);
                insert.Parameters.AddWithValue("@intakeEpoch", intakeEpoch);

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);

            await RcResults.WriteJsonAsync(ctx, new RcEventFoundedResponse(
                RcId.ToText(eventId), RcId.ToText(areaId), RcId.ToText(eventOfficeId), slug),
                StatusCodes.Status201Created);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }

    // -- Lesen ----------------------------------------------------------------

    public sealed record CollectionSummary(
        string CollectionId, string AreaId, string Slug, string Title, string Lifecycle,
        string? OrganizerName, int Events);

    public sealed record CollectionEvent(
        string EventId, string AreaId, string Slug, string Title, string Lifecycle, bool IsPublic,
        DateTimeOffset? StartsUtc, DateTimeOffset? EndsUtc, int Pages);

    private static async Task ListAsync(HttpContext ctx, RcDb db, RcPermissions permissions)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT c.id, c.area_id, c.slug, c.title, c.lifecycle, c.organizer_name,
                   (SELECT COUNT(*) FROM dbo.rc_event e WHERE e.collection_id = c.id)
            FROM dbo.rc_event_collection c
            ORDER BY c.created_at DESC;
            """, connection);

        var all = new List<CollectionSummary>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                all.Add(new CollectionSummary(
                    RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)),
                    reader.GetString(2), reader.GetString(3), reader.GetString(4),
                    reader.IsDBNull(5) ? null : reader.GetString(5),
                    reader.GetInt32(6)));
            }
        }

        // 3.4 — Gefiltert wird NACH dem Lesen und je Zeile ueber den Kernel.
        // Eine Abfrage, die die Berechtigung selbst nachbaut, ist eine zweite
        // Auswertungslogik — und die weicht irgendwann ab.
        var visible = new List<CollectionSummary>();
        foreach (var view in all)
        {
            var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
                Guid.Parse(view.AreaId), RcCapability.Read, ctx.RequestAborted);
            if (may.Allowed) visible.Add(view);
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventCollectionsResponse(visible));
    }

    /// <summary>
    /// Der Katalog: die Sammlung und was in ihr liegt.
    ///
    /// <b>Ein Entwurf ist fuer Fremde nicht da</b> — und zwar so, als gaebe es
    /// ihn nicht. „Noch nicht veroeffentlicht" waere ein Verzeichnis dessen,
    /// was gerade vorbereitet wird.
    /// </summary>
    private static async Task ReadAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, string slug)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid collectionId, areaId;
        string title, lifecycle;
        string? organizerName, organizerAddress, organizerEmail;

        await using (var head = new SqlCommand("""
            SELECT id, area_id, title, lifecycle,
                   organizer_name, organizer_address, organizer_email
            FROM dbo.rc_event_collection WHERE slug = @slug;
            """, connection))
        {
            head.Parameters.AddWithValue("@slug", slug);
            await using var reader = await head.ExecuteReaderAsync(ctx.RequestAborted);

            if (!await reader.ReadAsync(ctx.RequestAborted)) { await RcAreas.NotForYou(ctx); return; }

            collectionId = reader.GetGuid(0);
            areaId = reader.GetGuid(1);
            title = reader.GetString(2);
            lifecycle = reader.GetString(3);
            organizerName = reader.IsDBNull(4) ? null : reader.GetString(4);
            organizerAddress = reader.IsDBNull(5) ? null : reader.GetString(5);
            organizerEmail = reader.IsDBNull(6) ? null : reader.GetString(6);
        }

        var session = ctx.RcSession();
        var mayRead = session is not null
            && (await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
                    RcCapability.Read, ctx.RequestAborted)).Allowed;

        if (lifecycle != LifecyclePublished && !mayRead) { await RcAreas.NotForYou(ctx); return; }

        /*
         * WELCHE VERANSTALTUNGEN IM KATALOG STEHEN.
         *
         * Fuer Fremde nur die veroeffentlichten und oeffentlichen — dieselbe
         * Schranke, die `RcEvents.ReadAsync` an der einzelnen Veranstaltung
         * zieht. Stuende hier mehr, waere der Katalog das Verzeichnis der
         * Entwuerfe, das die Veranstaltung selbst gerade verweigert.
         */
        var events = new List<CollectionEvent>();
        await using (var cmd = new SqlCommand("""
            SELECT e.id, e.area_id, e.slug, e.title, e.lifecycle, e.is_public,
                   e.starts_at, e.ends_at,
                   (SELECT COUNT(*) FROM dbo.rc_event_page p WHERE p.event_id = e.id)
            FROM dbo.rc_event e
            WHERE e.collection_id = @collection
              AND (@mayRead = 1 OR (e.lifecycle = N'published' AND e.is_public = 1))
            ORDER BY
                CASE WHEN e.starts_at IS NULL THEN 1 ELSE 0 END,
                e.starts_at DESC, e.created_at DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@collection", collectionId);
            cmd.Parameters.AddWithValue("@mayRead", mayRead ? 1 : 0);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                events.Add(new CollectionEvent(
                    RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)),
                    reader.GetString(2), reader.GetString(3), reader.GetString(4),
                    reader.GetBoolean(5),
                    reader.IsDBNull(6) ? null : reader.GetDateTimeOffset(6),
                    reader.IsDBNull(7) ? null : reader.GetDateTimeOffset(7),
                    reader.GetInt32(8)));
            }
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventCollectionViewResponse(
            RcId.ToText(collectionId), RcId.ToText(areaId), slug, title, lifecycle,
            organizerName, organizerAddress, organizerEmail, mayRead, events));
    }

    // -- Veroeffentlichen ------------------------------------------------------

    public sealed record PublishCollectionRequest(bool? Archive);

    private static async Task PublishAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, PublishCollectionRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid areaId;
        await using (var head = new SqlCommand(
            "SELECT area_id FROM dbo.rc_event_collection WHERE id = @id;", connection))
        {
            head.Parameters.AddWithValue("@id", id);
            if (await head.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await RcAreas.NotForYou(ctx);
                return;
            }
            areaId = found;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var lifecycle = body.Archive == true ? LifecycleArchived : LifecyclePublished;

        await using (var update = new SqlCommand(
            "UPDATE dbo.rc_event_collection SET lifecycle = @lifecycle WHERE id = @id;", connection))
        {
            update.Parameters.AddWithValue("@lifecycle", lifecycle);
            update.Parameters.AddWithValue("@id", id);
            await update.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await RcResults.WriteJsonAsync(ctx,
            new RcEventCollectionPublishedResponse(RcId.ToText(id), lifecycle));
    }

    // -- Gemeinsames -----------------------------------------------------------

    /// <summary>
    /// Ist die Adresse vergeben?
    ///
    /// <c>collection</c> <c>null</c> fragt nach einer Sammlung — deren Adresse
    /// steht allein im Link und ist darum global eindeutig. Mit Sammlung fragt
    /// es nach einer Veranstaltung DARIN: dort reicht Eindeutigkeit innerhalb
    /// der Sammlung, sonst verbrauchte die erste Pfarrei mit einem
    /// „festyn-2026" den Namen fuer alle.
    /// </summary>
    private static async Task<bool> SlugTakenAsync(
        SqlConnection connection, Guid? collection, string slug, CancellationToken ct)
    {
        await using var cmd = collection is null
            ? new SqlCommand(
                "SELECT TOP 1 1 FROM dbo.rc_event_collection WHERE slug = @slug;", connection)
            : new SqlCommand(
                "SELECT TOP 1 1 FROM dbo.rc_event WHERE collection_id = @collection AND slug = @slug;",
                connection);

        cmd.Parameters.AddWithValue("@slug", slug);
        if (collection is not null) cmd.Parameters.AddWithValue("@collection", collection.Value);

        return await cmd.ExecuteScalarAsync(ct) is not null;
    }

}
