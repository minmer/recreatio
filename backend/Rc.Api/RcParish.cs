using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Pfarrei — Messen, Intentionen, Gaben.
///
/// <b>Wie bei den Veranstaltungen haengt sie an einem Bereich.</b> Von dort
/// kommen Schluessel, Mitglieder, Zertifikate und Kette. Ein zweites
/// Epochenmodell gibt es nicht.
///
/// <b>Der Messplan ist oeffentlich und liegt im Klartext.</b> Er haengt am
/// Schaukasten; ihn zu verschluesseln und den Schluessel mitzuliefern waere
/// Theater.
///
/// <b>Die Intention ist der interessante Fall.</b> Bei den Veranstaltungen
/// trennt die Sichtbarkeit ganze Abschnitte — hier trennt sie FELDER derselben
/// Zeile:
///
/// <code>
///   public_text        "in einer bestimmten Absicht"    steht im Plan
///   internal_sealed    was wirklich gemeint ist          nur die Pfarrei
///   donor_ref_sealed   von wem                           nur die Pfarrei
/// </code>
///
/// Das ist kein Sonderfall, sondern der Alltag: eine Intention wird
/// oeffentlich angekuendigt, aber wofuer und von wem sie gestiftet wurde, geht
/// die Gemeinde nichts an. Der Altbestand hatte das bereits richtig
/// (<c>_reference/backend/parish/Data/ParishIntention.cs</c>); uebernommen wird
/// die Aufteilung, nicht der Code.
/// </summary>
public static class RcParish
{
    public static void MapRcParish(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/parishes", ListAsync).Produces<RcParishesResponse>();
        app.MapPost("/rc/parishes", CreateAsync).Produces<RcParishCreatedResponse>();

        // Ohne Konto lesbar: der Plan ist oeffentlich, das ist sein Zweck.
        app.MapGet("/rc/parishes/{slug}/masses", MassesAsync).Produces<RcMassesResponse>();

        app.MapPost("/rc/parishes/{id:guid}/masses", AddMassAsync).Produces<RcMassCreatedResponse>();
        app.MapPost("/rc/parishes/{id:guid}/intentions", AddIntentionAsync).Produces<RcIntentionCreatedResponse>();
        app.MapGet("/rc/parishes/{id:guid}/intentions", IntentionsAsync).Produces<RcIntentionsResponse>();
        app.MapPost("/rc/intentions/{id:guid}/offerings", AddOfferingAsync).Produces<RcOfferingCreatedResponse>();

        // Die Startseite der Pfarrei. Lesen ohne Konto — es ist die
        // oeffentliche Seite; schreiben nur, wer den Bereich verwaltet.
        app.MapGet("/rc/parishes/{id:guid}/site", SiteAsync).Produces<RcParishSiteResponse>();
        app.MapPut("/rc/parishes/{id:guid}/site", SaveSiteAsync).Produces<RcParishSiteResponse>();
    }

    // -- AAD ------------------------------------------------------------------
    //
    // 3.13 — Drei Felder derselben Zeile, drei verschiedene Etiketten. Trugen
    // sie dasselbe, koennte wer Schreibzugriff hat den Stifternamen in das
    // interne Feld schieben: lautlos, ohne Fehlermeldung, ohne Protokolleintrag.

    private static RcAad InternalAad(Guid intentionId) =>
        RcAad.Create("parish", "intention", intentionId, RcField.IntentionInternal, 1);

    private static RcAad DonorAad(Guid intentionId) =>
        RcAad.Create("parish", "intention", intentionId, RcField.IntentionDonorRef, 1);

    private static RcAad AmountAad(Guid offeringId) =>
        RcAad.Create("parish", "offering", offeringId, RcField.OfferingAmount, 1);

    private static RcAad OfferingDonorAad(Guid offeringId) =>
        RcAad.Create("parish", "offering", offeringId, RcField.OfferingDonorRef, 1);

    // -- Anlegen --------------------------------------------------------------

    /// <summary>
    /// <b>Die Person, nicht der Bereich.</b>
    ///
    /// Vorher stand hier eine Bereichskennung, und der Browser legte den
    /// Bereich vorher selbst an — zwei Anfragen, zwischen denen es kein Zurueck
    /// gibt. Scheiterte die zweite, blieb ein Bereich stehen, der zu nichts
    /// gehoerte. Nach vier Anlaeufen standen vier gleichnamige herum.
    /// </summary>
    public sealed record CreateParishRequest(string PersonRoleId, string Slug, string Name, string? Location);

    /// <summary>
    /// Eine Pfarrei anlegen — mit allem, was dazugehoert, in EINER Transaktion.
    ///
    /// Es entstehen drei Dinge, und keines davon ergibt allein einen Sinn:
    ///
    /// <code>
    ///   Bereich   traegt Schluessel, Epochen und Kette der Pfarrei
    ///   Pfarrei   die Zeile selbst, mit Adresse und Namen
    ///   Amt       die Rolle, die sie verwaltet — uebergebbar, ohne dass
    ///             jemand sein Konto weitergeben muss
    /// </code>
    ///
    /// <b>Warum das nicht der Browser macht.</b> Er hat es getan, in drei
    /// Aufrufen, und zwischen zwei Anfragen gibt es kein Zurueck: brach der
    /// zweite ab, blieb der erste stehen. Sichtbar wurde das als eine Liste
    /// gleichnamiger Bereiche, die zu nichts gehoerten. Hier scheitert
    /// entweder alles oder nichts.
    /// </summary>
    private static async Task CreateAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, CreateParishRequest body)
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

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var tenantId = await RcAreas.TenantOfRoleAsync(connection, personRoleId, ctx.RequestAborted);
        if (tenantId == Guid.Empty)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Tenant, tenantId,
            RcCapability.Certify, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        // Die Adresse wird vorher entschieden, nicht hier erfunden. Die
        // Begruendung steht in RcParishSlugs; das Formular kennt dieselbe
        // Liste, aber ein Formular ist keine Schranke.
        //
        // ERST NACH der Berechtigungspruefung, und das ist kein Zufall: die
        // Antwort nennt die vorgesehenen Namen. Wer hier gar nichts anlegen
        // darf, soll sie nicht erfahren.
        if (!RcParishSlugs.IsAllowed(slug))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.ParishSlugNotAllowed,
                "Dieser Name ist fuer eine Pfarrei nicht vorgesehen.",
                new Dictionary<string, string>
                {
                    ["slug"] = slug,
                    ["allowed"] = RcParishSlugs.AllowedList()
                });
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var personKey = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, held.MasterKey, personRoleId, ctx.RequestAborted);

        if (personKey is null) { await RcAreas.NotForYou(ctx); return; }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [personRoleId], ctx.RequestAborted);
        if (!identities.TryGetValue(personRoleId, out var person))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var parishId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        try
        {
            /*
             * DAS AMT — die Stelle, nicht der Mensch darauf.
             *
             * Ohne es haengt die Pfarrei allein an der Person, die sie angelegt
             * hat: uebergeben liesse sie sich nur, indem man das Konto
             * weitergibt, also gar nicht.
             *
             * Es entsteht VOR dem Bereich, damit es beim Schnitt der ersten
             * Epoche schon dasteht und den Bereichsschluessel mitbekommt.
             */
            var officeId = await RcRoles.InsertHeldRoleAsync(connection, tx, personRoleId, personKey,
                person, tenantId, RcRoleKinds.Office, name, ctx.RequestAborted);

            var areaId = await RcAreas.InsertAreaAsync(connection, tx, personRoleId, personKey, person,
                tenantId, name, false, ctx.RequestAborted, officeId);

            await using (var insert = new SqlCommand("""
                INSERT INTO dbo.rc_parish (id, area_id, tenant_id, slug, name, location, created_at)
                VALUES (@id, @area, @tenant, @slug, @name, @location, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", parishId);
                insert.Parameters.AddWithValue("@area", areaId);
                insert.Parameters.AddWithValue("@tenant", tenantId);
                insert.Parameters.AddWithValue("@slug", slug);
                insert.Parameters.AddWithValue("@name", name);
                insert.Parameters.Add("@location", System.Data.SqlDbType.NVarChar, 200).Value =
                    (object?)Trim(body.Location, 200) ?? DBNull.Value;
                insert.Parameters.AddWithValue("@now", now);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Diese Adresse ist vergeben.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new RcParishCreatedResponse(
            RcId.ToText(parishId), slug, name), StatusCodes.Status201Created);
    }

    // -- Messen ---------------------------------------------------------------

    public sealed record AddMassRequest(DateTimeOffset StartsUtc, string Church, string? Title,
        string? Note, bool? IsCollective, int? DurationMinutes, string? Kind);

    private static async Task AddMassAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, AddMassRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfParishAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var church = body.Church?.Trim() ?? "";
        if (church.Length is 0 or > 128)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Kirche fehlt oder ist zu lang.");
            return;
        }

        var massId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_mass
                (id, parish_id, starts_at, church, title, note, is_collective,
                 duration_min, kind, created_at, updated_at)
            VALUES (@id, @parish, @starts, @church, @title, @note, @coll,
                    @duration, @kind, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", massId);
        insert.Parameters.AddWithValue("@parish", id);
        insert.Parameters.AddWithValue("@starts", body.StartsUtc);
        insert.Parameters.AddWithValue("@church", church);
        insert.Parameters.Add("@title", System.Data.SqlDbType.NVarChar, 256).Value =
            (object?)Trim(body.Title, 256) ?? DBNull.Value;
        insert.Parameters.Add("@note", System.Data.SqlDbType.NVarChar, 512).Value =
            (object?)Trim(body.Note, 512) ?? DBNull.Value;
        insert.Parameters.AddWithValue("@coll", body.IsCollective ?? false);
        insert.Parameters.Add("@duration", System.Data.SqlDbType.Int).Value =
            (object?)body.DurationMinutes ?? DBNull.Value;
        insert.Parameters.Add("@kind", System.Data.SqlDbType.NVarChar, 80).Value =
            (object?)Trim(body.Kind, 80) ?? DBNull.Value;
        insert.Parameters.AddWithValue("@now", now);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcMassCreatedResponse(
            RcId.ToText(massId), body.StartsUtc, church), StatusCodes.Status201Created);
    }

    public sealed record MassView(string MassId, DateTimeOffset StartsUtc, string Church,
        string? Title, string? Note, bool IsCollective, int? DurationMinutes, string? Kind,
        IReadOnlyList<string> Intentions);

    /// <summary>
    /// Der Plan, wie er am Schaukasten haengt — ohne Konto abrufbar.
    ///
    /// Zu jeder Messe stehen die OEFFENTLICHEN Texte der Intentionen. Was
    /// intern dazu vermerkt ist und von wem sie gestiftet wurde, steht hier
    /// nicht: dafuer gibt es einen anderen Weg, der einen Schluessel verlangt.
    /// </summary>
    private static async Task MassesAsync(
        HttpContext ctx, RcDb db, string slug, DateTimeOffset? from, DateTimeOffset? to)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var parishId = await ParishBySlugAsync(connection, slug, ctx.RequestAborted);
        if (parishId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var start = from ?? DateTimeOffset.UtcNow.AddDays(-1);
        var end = to ?? start.AddDays(30);

        await using var cmd = new SqlCommand("""
            SELECT m.id, m.starts_at, m.church, m.title, m.note, m.is_collective,
                   m.duration_min, m.kind
            FROM dbo.rc_mass m
            WHERE m.parish_id = @parish AND m.starts_at >= @from AND m.starts_at < @to
            ORDER BY m.starts_at;
            """, connection);

        cmd.Parameters.AddWithValue("@parish", parishId);
        cmd.Parameters.AddWithValue("@from", start);
        cmd.Parameters.AddWithValue("@to", end);

        var rows = new List<(Guid Id, DateTimeOffset At, string Church, string? Title,
            string? Note, bool Coll, int? Duration, string? Kind)>();

        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
                rows.Add((reader.GetGuid(0), reader.GetDateTimeOffset(1), reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3),
                    reader.IsDBNull(4) ? null : reader.GetString(4),
                    reader.GetBoolean(5),
                    reader.IsDBNull(6) ? null : reader.GetInt32(6),
                    reader.IsDBNull(7) ? null : reader.GetString(7)));
        }

        var texts = await PublicIntentionsAsync(connection, parishId, ctx.RequestAborted);

        var views = rows.Select(r => new MassView(
            RcId.ToText(r.Id), r.At, r.Church, r.Title, r.Note, r.Coll, r.Duration, r.Kind,
            texts.TryGetValue(r.Id, out var list) ? list : [])).ToList();

        await RcResults.WriteJsonAsync(ctx, new RcMassesResponse(RcId.ToText(parishId), views));
    }

    // -- Intentionen ----------------------------------------------------------

    public sealed record AddIntentionRequest(string PublicText, string? InternalText,
        string? DonorRef, string? MassId);

    /// <summary>
    /// Eine Intention entsteht mit ihrem oeffentlichen Text — und, wenn es sie
    /// gibt, mit dem, was nur die Pfarrei angeht.
    ///
    /// Der oeffentliche Text ist PFLICHT. Eine Intention ohne ihn stuende
    /// nirgends im Plan, und dann waere sie keine Intention, sondern eine
    /// Notiz.
    /// </summary>
    private static async Task AddIntentionAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, AddIntentionRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfParishAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var publicText = body.PublicText?.Trim() ?? "";
        if (publicText.Length is 0 or > 512)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der oeffentliche Text fehlt oder ist zu lang.");
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
            areaId, ctx.RequestAborted);

        if (keys.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.CryptoMissingEpoch, "Du hast keinen Schluessel fuer diesen Bereich.");
            return;
        }

        var epoch = keys.Keys.Max();
        var key = keys[epoch];

        var intentionId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_intention
                (id, parish_id, mass_id, epoch, public_text, internal_sealed, donor_ref_sealed,
                 created_at, updated_at)
            VALUES (@id, @parish, @mass, @epoch, @public, @internal, @donor, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", intentionId);
        insert.Parameters.AddWithValue("@parish", id);
        insert.Parameters.Add("@mass", System.Data.SqlDbType.UniqueIdentifier).Value =
            Guid.TryParse(body.MassId, out var massId) ? massId : DBNull.Value;
        insert.Parameters.AddWithValue("@epoch", epoch);
        insert.Parameters.AddWithValue("@public", publicText);
        insert.Parameters.Add("@internal", System.Data.SqlDbType.VarBinary).Value =
            (object?)SealOrNull(key, InternalAad(intentionId), Trim(body.InternalText, 2000)) ?? DBNull.Value;
        insert.Parameters.Add("@donor", System.Data.SqlDbType.VarBinary).Value =
            (object?)SealOrNull(key, DonorAad(intentionId), Trim(body.DonorRef, 200)) ?? DBNull.Value;
        insert.Parameters.AddWithValue("@now", now);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcIntentionCreatedResponse(
            RcId.ToText(intentionId), publicText), StatusCodes.Status201Created);
    }

    public sealed record IntentionView(string IntentionId, string? MassId, string PublicText,
        string? InternalText, string? DonorRef, string Status, string? Unreadable);

    /// <summary>
    /// Die Intentionen MIT dem, was intern dazu steht. Verlangt einen
    /// Schluessel; ohne ihn gibt es den Plan (oeffentlich) und sonst nichts.
    ///
    /// 15.9 — Was der Leser nicht oeffnen kann, faellt NICHT aus der Liste. Es
    /// steht da, mit einem Grund. Der oeffentliche Text bleibt in jedem Fall
    /// sichtbar: er ist ohnehin oeffentlich, und ihn zu verbergen, weil der
    /// interne fehlt, waere eine Luecke ohne Gewinn.
    /// </summary>
    private static async Task IntentionsAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfParishAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
            areaId, ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT id, mass_id, epoch, public_text, internal_sealed, donor_ref_sealed, status
            FROM dbo.rc_intention WHERE parish_id = @parish ORDER BY created_at DESC;
            """, connection);
        cmd.Parameters.AddWithValue("@parish", id);

        var views = new List<IntentionView>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var intentionId = reader.GetGuid(0);
                var epoch = reader.GetInt32(2);
                var internalSealed = reader.IsDBNull(4) ? null : (byte[])reader[4];
                var donorSealed = reader.IsDBNull(5) ? null : (byte[])reader[5];

                string? unreadable = null;
                string? internalText = null, donorRef = null;

                if (!keys.TryGetValue(epoch, out var key))
                {
                    // Nur, wenn es ueberhaupt etwas Verschlossenes gibt. Eine
                    // Intention ganz ohne internen Teil ist nicht unlesbar —
                    // sie hat schlicht nichts, was verborgen waere.
                    if (internalSealed is not null || donorSealed is not null)
                        unreadable = RcErrorCodes.CryptoMissingEpoch;
                }
                else
                {
                    internalText = OpenOrNull(key, InternalAad(intentionId), internalSealed, ref unreadable);
                    donorRef = OpenOrNull(key, DonorAad(intentionId), donorSealed, ref unreadable);
                }

                views.Add(new IntentionView(
                    RcId.ToText(intentionId),
                    reader.IsDBNull(1) ? null : RcId.ToText(reader.GetGuid(1)),
                    reader.GetString(3), internalText, donorRef, reader.GetString(6), unreadable));
            }
        }

        await RcResults.WriteJsonAsync(ctx, new RcIntentionsResponse(views));
    }

    // -- Gaben ----------------------------------------------------------------

    public sealed record AddOfferingRequest(string Amount, string? Currency,
        string? DonorRef, DateOnly? ReceivedOn);

    /// <summary>
    /// Eine Gabe. Der Betrag liegt IMMER versiegelt — 12.9, und ohne Schalter.
    ///
    /// Er reist als Zeichenkette und nicht als Zahl. Das ist Absicht: ein
    /// Geldbetrag als Gleitkommazahl ist ein Rundungsfehler, der auf eine
    /// Gelegenheit wartet. Wer damit rechnen will, holt die Zeilen und rechnet
    /// mit dem Schluessel in der Hand.
    ///
    /// Der Preis steht im Schema: eine Summe ueber alle Gaben laesst sich nicht
    /// in SQL bilden. Er ist bekannt und wird bezahlt.
    /// </summary>
    private static async Task AddOfferingAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, AddOfferingRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid parishId = Guid.Empty, areaId = Guid.Empty;
        await using (var head = new SqlCommand("""
            SELECT p.id, p.area_id FROM dbo.rc_intention i
            JOIN dbo.rc_parish p ON p.id = i.parish_id
            WHERE i.id = @id;
            """, connection))
        {
            head.Parameters.AddWithValue("@id", id);
            await using var reader = await head.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await RcAreas.NotForYou(ctx); return; }
            parishId = reader.GetGuid(0);
            areaId = reader.GetGuid(1);
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var amount = body.Amount?.Trim() ?? "";
        if (amount.Length is 0 or > 40)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Betrag fehlt oder ist zu lang.");
            return;
        }

        var currency = (body.Currency?.Trim() ?? "PLN").ToUpperInvariant();
        if (currency.Length != 3 || !currency.All(char.IsAsciiLetterUpper))
        {
            // Ein Tippfehler in einer Waehrung bedeutet, dass zwei Betraege
            // spaeter nicht mehr vergleichbar sind. Er faellt hier auf.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Eine Waehrung hat drei Buchstaben.");
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
            areaId, ctx.RequestAborted);

        if (keys.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.CryptoMissingEpoch, "Du hast keinen Schluessel fuer diesen Bereich.");
            return;
        }

        var epoch = keys.Keys.Max();
        var key = keys[epoch];
        var offeringId = RcId.NewId();

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_offering
                (id, parish_id, intention_id, epoch, amount_sealed, currency,
                 donor_ref_sealed, received_on, created_at)
            VALUES (@id, @parish, @intention, @epoch, @amount, @ccy, @donor, @on, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", offeringId);
        insert.Parameters.AddWithValue("@parish", parishId);
        insert.Parameters.AddWithValue("@intention", id);
        insert.Parameters.AddWithValue("@epoch", epoch);
        insert.Parameters.AddWithValue("@amount",
            RcCrypto.Seal(key, AmountAad(offeringId), Encoding.UTF8.GetBytes(amount)));
        insert.Parameters.AddWithValue("@ccy", currency);
        insert.Parameters.Add("@donor", System.Data.SqlDbType.VarBinary).Value =
            (object?)SealOrNull(key, OfferingDonorAad(offeringId), Trim(body.DonorRef, 200)) ?? DBNull.Value;
        insert.Parameters.AddWithValue("@on",
            (body.ReceivedOn ?? DateOnly.FromDateTime(DateTime.UtcNow)).ToDateTime(TimeOnly.MinValue));
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcOfferingCreatedResponse(
            RcId.ToText(offeringId), currency), StatusCodes.Status201Created);
    }

    // -- Uebersicht -----------------------------------------------------------

    public sealed record ParishSummary(string ParishId, string AreaId, string Slug,
        string Name, string? Location, int Masses);

    private static async Task ListAsync(HttpContext ctx, RcDb db, RcPermissions permissions)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT p.id, p.area_id, p.slug, p.name, p.location,
                   (SELECT COUNT(*) FROM dbo.rc_mass m WHERE m.parish_id = p.id)
            FROM dbo.rc_parish p ORDER BY p.name;
            """, connection);

        var all = new List<ParishSummary>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
                all.Add(new ParishSummary(
                    RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)),
                    reader.GetString(2), reader.GetString(3),
                    reader.IsDBNull(4) ? null : reader.GetString(4), reader.GetInt32(5)));
        }

        // 3.4 — Gefiltert wird je Zeile ueber den Kernel und nicht in der
        // Abfrage: eine zweite Auswertungslogik weicht irgendwann ab.
        var visible = new List<ParishSummary>();
        foreach (var parish in all)
        {
            var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
                Guid.Parse(parish.AreaId), RcCapability.Read, ctx.RequestAborted);
            if (may.Allowed) visible.Add(parish);
        }

        await RcResults.WriteJsonAsync(ctx, new RcParishesResponse(visible));
    }

    // -- Kleinkram ------------------------------------------------------------

    private static async Task<Dictionary<Guid, List<string>>> PublicIntentionsAsync(
        SqlConnection connection, Guid parishId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT mass_id, public_text FROM dbo.rc_intention
            WHERE parish_id = @parish AND mass_id IS NOT NULL AND status = 'active'
            ORDER BY created_at;
            """, connection);
        cmd.Parameters.AddWithValue("@parish", parishId);

        var byMass = new Dictionary<Guid, List<string>>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var massId = reader.GetGuid(0);
            if (!byMass.TryGetValue(massId, out var list))
                byMass[massId] = list = [];
            list.Add(reader.GetString(1));
        }
        return byMass;
    }

    private static async Task<Guid> AreaOfParishAsync(SqlConnection connection, Guid parishId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT area_id FROM dbo.rc_parish WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", parishId);
        return await cmd.ExecuteScalarAsync(ct) is Guid g ? g : Guid.Empty;
    }

    private static async Task<Guid> ParishBySlugAsync(SqlConnection connection, string slug, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT id FROM dbo.rc_parish WHERE slug = @slug;", connection);
        cmd.Parameters.AddWithValue("@slug", slug);
        return await cmd.ExecuteScalarAsync(ct) is Guid g ? g : Guid.Empty;
    }

    private static async Task<Guid> TenantOfAreaAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT tenant_id FROM dbo.rc_area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", areaId);
        return await cmd.ExecuteScalarAsync(ct) is Guid g ? g : Guid.Empty;
    }

    private static string? Trim(string? value, int max)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        return trimmed.Length > max ? trimmed[..max] : trimmed;
    }

    private static byte[]? SealOrNull(byte[] key, RcAad aad, string? value) =>
        value is null ? null : RcCrypto.Seal(key, aad, Encoding.UTF8.GetBytes(value));

    private static string? OpenOrNull(byte[] key, RcAad aad, byte[]? blob, ref string? reason)
    {
        if (blob is null) return null;
        try { return Encoding.UTF8.GetString(RcCrypto.Open(key, aad, blob)); }
        catch (RcDecryptException e) { reason ??= e.Code; return null; }
    }
    // -- Die Startseite -------------------------------------------------------

    /// <summary>Was die Vorgabe zeigt, solange niemand gewaehlt hat.</summary>
    private const string DefaultTheme = "classic";
    private const string DefaultModules = """["masses","announcements","intentions","contact"]""";

    public sealed record SaveSiteRequest(string? Theme, string? Modules);

    /// <summary>
    /// Ohne Konto lesbar, wie der Messplan. Gibt es noch keine Zeile, kommt die
    /// Vorgabe zurueck — mit <c>Configured = false</c>, damit der zweite Schritt
    /// des Anlegens weiss, dass er noch aussteht.
    /// </summary>
    private static async Task SiteAsync(HttpContext ctx, RcDb db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand(
            "SELECT theme, modules FROM dbo.rc_parish_site WHERE parish_id = @parish;", connection);
        cmd.Parameters.AddWithValue("@parish", id);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);

        if (await reader.ReadAsync(ctx.RequestAborted))
        {
            await RcResults.WriteJsonAsync(ctx, new RcParishSiteResponse(
                RcId.ToText(id), reader.GetString(0), reader.GetString(1), true));
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcParishSiteResponse(
            RcId.ToText(id), DefaultTheme, DefaultModules, false));
    }

    /// <summary>
    /// Speichern. Eine Zeile je Pfarrei, also einfuegen ODER ersetzen.
    ///
    /// Geprueft wird, dass <c>Modules</c> ueberhaupt JSON ist — die Datenbank
    /// tut es auch (ck_rc_parish_site_modules_json), aber ein sauberer Fehler
    /// ist besser als eine Bedingungsverletzung, die als 500 herauskommt.
    /// </summary>
    private static async Task SaveSiteAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, SaveSiteRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var areaId = await AreaOfParishAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Admin, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var theme = Trim(body.Theme, 40) ?? DefaultTheme;
        var modules = body.Modules ?? DefaultModules;

        if (!LooksLikeJsonArray(modules))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Bausteine sind keine JSON-Liste.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE dbo.rc_parish_site
               SET theme = @theme, modules = @modules, updated_at = @now
             WHERE parish_id = @parish;

            IF @@ROWCOUNT = 0
                INSERT INTO dbo.rc_parish_site (parish_id, theme, modules, updated_at)
                VALUES (@parish, @theme, @modules, @now);
            """, connection);

        cmd.Parameters.AddWithValue("@parish", id);
        cmd.Parameters.AddWithValue("@theme", theme);
        cmd.Parameters.AddWithValue("@modules", modules);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcParishSiteResponse(
            RcId.ToText(id), theme, modules, true));
    }

    /// <summary>
    /// Faengt den haeufigsten Fehler ab: irgendein Text statt einer Liste.
    ///
    /// <b>Das ist die schaerfste Pruefung, die es hier gibt</b> — die Datenbank
    /// prueft DASSELBE und nicht mehr. ISJSON stand einmal in der Bedingung und
    /// steht dort nicht mehr: die Funktion gibt es erst ab Kompatibilitaetsgrad
    /// 130, und die Datenbank laeuft darunter.
    ///
    /// Wer also darauf baut, dass hinter dieser Stelle garantiert gueltiges
    /// JSON liegt, baut auf nichts. Es liegt gueltiges JSON dort, weil der
    /// Dienst den Wert selbst zusammensetzt — nicht, weil jemand ihn geprueft
    /// haette.
    /// </summary>
    private static bool LooksLikeJsonArray(string text)
    {
        var trimmed = text.AsSpan().Trim();
        return trimmed.Length >= 2 && trimmed[0] == '[' && trimmed[^1] == ']';
    }


}
