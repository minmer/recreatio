using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Veranstaltungen — Seiten, Teile, Felder.
///
/// <b>Eine Veranstaltung haengt an einem Bereich.</b> Sie bringt keine eigenen
/// Epochen, keine eigene Schluesselverwaltung, keine eigene Kette und keine
/// eigenen Zertifikate mit. Wer eine Veranstaltung vorbereitet, ist eine
/// Gruppe, die miteinander redet, Beschluesse fasst und Leute dazuholt — genau
/// das ist ein Bereich. Eine Veranstaltung ist ein Bereich mit Seiten daran.
///
/// <b>Oeffentlicher Inhalt wird nicht verschluesselt.</b> Der naheliegende Weg
/// waere, alles zu versiegeln und fuer oeffentliche Seiten den Schluessel
/// mitzuliefern. Das waere Theater: ein Schluessel, den jeder bekommt, ist
/// kein Schluessel. Es saehe nach Schutz aus, wo keiner ist — und das ist
/// schlimmer als sichtbar ungeschuetzt.
///
/// Ein Teil ist deshalb ENTWEDER oeffentlich ODER intern, nie beides. Die
/// Datenbank erzwingt es (<c>ck_rc_event_part_form</c>), damit es nicht von
/// der Sorgfalt dieses Codes abhaengt.
/// </summary>
public static class RcEvents
{
    public const string LifecycleDraft = "draft";
    public const string LifecyclePublished = "published";
    public const string LifecycleArchived = "archived";

    /// <summary>
    /// Die Aufzaehlung steht dreifach: hier, im CHECK der Datenbank und in der
    /// erzeugten Beschreibung. Das ist kein Versehen — die Datenbank ist die
    /// Regel, diese Liste macht sie zu einem Fehler mit brauchbarer Meldung
    /// statt zu einer Verletzung einer Bedingung.
    /// </summary>
    public static readonly string[] PartKinds =
    [
        "title", "shortinfos", "text", "plan", "map", "faq",
        "form", "costs", "contact", "gallery", "files", "people",

        /*
         * NUR HINTER EINEM BELEG SINNVOLL: diese fuenf handeln von den Daten
         * des Lesers selbst — seine Anmeldung, seine Karte, seine Haken, seine
         * Fragen — oder von der Liste, die die Verwaltung fuehrt.
         *
         * Sie standen hier NICHT, waehrend der Browser sie laengst anbot: der
         * Herausgeber zeigte sie im Menue „Teil hinzufuegen", und der Dienst
         * wies sie ab. Eine Art, die auf einer Seite existiert und auf der
         * anderen nicht, sieht wie ein Fehler des Benutzers aus.
         */
        "registration", "card", "checklist", "roster", "topics",

        // Bilder aus der Galerie, mit Aufschrift darunter.
        "meme"
    ];

    public static readonly string[] FieldKinds =
    [
        "text", "textarea", "select", "multiselect", "checkbox",
        "number", "date", "email", "phone"
    ];

    public static void MapRcEvents(this IEndpointRouteBuilder app)
    {
        /*
         * Die flache Liste ueber alle Sammlungen hinweg — was DIESES Konto an
         * Veranstaltungen sehen darf. Jede Zeile nennt ihre Sammlung mit, sonst
         * liesse sich aus ihr kein Verweis bauen: die Adresse ist zweiteilig.
         */
        app.MapGet("/rc/events", ListAsync).Produces<RcEventsResponse>();

        /*
         * Gegruendet wird die SAMMLUNG (RcEventCollections), und in ihr entsteht
         * die Veranstaltung. Einen zweiten Weg gibt es nicht: er fuehrte an der
         * Klausel vorbei, die am Veranstalter haengt.
         *
         * Ohne Konto lesbar, WENN die Veranstaltung veroeffentlicht und
         * oeffentlich ist. Das ist der ganze Zweck des Moduls: eine Seite, die
         * man verschicken kann.
         */
        app.MapGet("/rc/event-collections/{collection}/events/{slug}", ReadAsync)
            .Produces<RcEventViewResponse>();

        app.MapPost("/rc/events/{id:guid}/pages", AddPageAsync).Produces<RcEventPageCreatedResponse>();
        app.MapPost("/rc/events/{id:guid}/publish", PublishAsync).Produces<RcEventPublishedResponse>();

        app.MapPost("/rc/event-pages/{id:guid}/parts", AddPartAsync).Produces<RcEventPartCreatedResponse>();
        app.MapPost("/rc/event-parts/{id:guid}", UpdatePartAsync).Produces<RcEventPartUpdatedResponse>();
        app.MapPost("/rc/event-parts/{id:guid}/fields", AddFieldAsync).Produces<RcEventFieldCreatedResponse>();
    }

    // -- AAD ------------------------------------------------------------------
    //
    // 3.13 — Jeder Geheimtext klebt an seinem Platz. Die Kennung im Etikett ist
    // die des TEILS, nicht die der Seite: verschoebe jemand einen Teil auf eine
    // andere Seite, bliebe die Huelle gueltig — sie gehoert dem Teil.

    private static RcAad TitleAad(Guid partId) =>
        RcAad.Create("events", "part", partId, RcField.EventPartTitle, 1);

    private static RcAad IntroAad(Guid partId) =>
        RcAad.Create("events", "part", partId, RcField.EventPartIntro, 1);

    private static RcAad ConfigAad(Guid partId) =>
        RcAad.Create("events", "part", partId, RcField.EventPartConfig, 1);

    private static RcAad LayersAad(Guid partId) =>
        RcAad.Create("events", "part", partId, RcField.EventPartLayers, 1);

    /// <summary>Der private Annahmeschluessel, versiegelt unter dem Epochenschluessel.</summary>
    internal static RcAad IntakeAad(Guid eventId) =>
        RcAad.Create("events", "event", eventId, RcField.EventIntakeKey, 1);

    /*
      HIER STAND DAS GRUENDEN.

      Es ist nach RcEventCollections gezogen, samt dem alten POST /rc/events.
      Der Grund ist nicht Ordnung, sondern eine Ebene, die gefehlt hat: eine
      Veranstaltung entsteht nicht mehr fuer sich, sondern IN einer Sammlung,
      und die Sammlung traegt die Adresse, den Veranstalter und die Klausel.

      POST /rc/events haengte eine Veranstaltung an einen BESTEHENDEN Bereich
      und fragte dabei nach keinem Verantwortlichen. Es kann nicht bleiben:
      rc_event.collection_id ist seit rc_0027 Pflicht, und eine Veranstaltung
      ohne Sammlung haette keine Adresse, unter der man sie findet.
    */

    /// <summary>
    /// Aus einem Titel eine Adresse machen. Kleinbuchstaben, Ziffern, Striche.
    ///
    /// Bewusst OHNE Umlautersetzung nach Sprache: „Grüße" wird zu „gru-e",
    /// nicht zu „gruesse". Eine Adresse, die je nach Sprache anders ausfaellt,
    /// ist keine Adresse — sie soll stabil sein, nicht schoen.
    /// </summary>
    public static string Slugify(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";

        var sb = new StringBuilder(raw.Length);
        var lastDash = true;

        foreach (var c in raw.Trim().ToLowerInvariant())
        {
            if (c is >= 'a' and <= 'z' || c is >= '0' and <= '9')
            {
                sb.Append(c);
                lastDash = false;
            }
            else if (!lastDash)
            {
                sb.Append('-');
                lastDash = true;
            }
        }

        return sb.ToString().Trim('-');
    }

    // -- Seiten und Teile -----------------------------------------------------

    /// <summary>
    /// <paramref name="Kind"/> ist ABSICHT, keine Ableitung.
    ///
    /// Ob eine Seite oeffentlich oder intern ist, liesse sich auch daran
    /// ablesen, ob alle ihre Teile versiegelt sind — als ANZEIGE stimmt das,
    /// als Absicht nicht: eine noch leere interne Seite haette dann als
    /// oeffentlich gegolten, und die erste Zuteilung waere ins Leere
    /// gegangen, ohne dass jemand sieht warum.
    ///
    /// Ohne Angabe entsteht eine oeffentliche: das ist der haeufige Fall.
    /// </summary>
    public sealed record AddPageRequest(
        string Slug, string Title, int? SortOrder, string? Kind, string? MenuLabel);

    private static async Task AddPageAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, AddPageRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfEventAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var slug = Slugify(body.Slug);
        var title = body.Title?.Trim() ?? "";
        if (slug.Length == 0 || title.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Adresse oder Titel fehlen.");
            return;
        }

        var pageId = RcId.NewId();
        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_event_page
                (id, event_id, sort_order, slug, title, kind, menu_label, created_at)
            VALUES (@id, @event, @sort,
                    @slug, @title, @kind, @menu, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", pageId);
        insert.Parameters.AddWithValue("@event", id);
        insert.Parameters.AddWithValue("@sort", body.SortOrder ?? await NextPageOrderAsync(connection, id, ctx.RequestAborted));
        insert.Parameters.AddWithValue("@slug", slug);
        insert.Parameters.AddWithValue("@title", title);

        // Ohne Angabe entsteht eine oeffentliche Seite: das ist der haeufige
        // Fall, und eine versehentlich interne faende niemand wieder.
        var kind = (body.Kind ?? string.Empty).Trim();
        insert.Parameters.AddWithValue("@kind", kind == "internal" ? "internal" : "public");

        var menu = (body.MenuLabel ?? string.Empty).Trim();
        insert.Parameters.Add("@menu", System.Data.SqlDbType.NVarChar, 60).Value =
            menu.Length == 0 ? DBNull.Value : (menu.Length > 60 ? menu[..60] : menu);

        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Diese Seitenadresse gibt es in dieser Veranstaltung schon.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventPageCreatedResponse(
            RcId.ToText(pageId), slug, title), StatusCodes.Status201Created);
    }

    public sealed record AddPartRequest(string Kind, bool? IsPublic, string? MenuLabel,
        string? Title, string? Intro, string? ConfigJson, int? SortOrder);

    private static async Task AddPartAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, AddPartRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var kind = body.Kind?.Trim().ToLowerInvariant() ?? "";
        if (!PartKinds.Contains(kind))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Art von Teil gibt es nicht.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var (eventId, areaId) = await EventOfPageAsync(connection, id, ctx.RequestAborted);
        if (eventId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var partId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;
        var isPublic = body.IsPublic ?? true;
        var sort = body.SortOrder ?? await NextPartOrderAsync(connection, id, ctx.RequestAborted);

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_event_part
                (id, page_id, sort_order, kind, is_public, epoch, menu_label,
                 title, intro, config_json,
                 title_sealed, intro_sealed, config_sealed,
                 created_at, updated_at)
            VALUES (@id, @page, @sort, @kind, @public, @epoch, @menu,
                    @title, @intro, @config,
                    @titleS, @introS, @configS,
                    @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", partId);
        insert.Parameters.AddWithValue("@page", id);
        insert.Parameters.AddWithValue("@sort", sort);
        insert.Parameters.AddWithValue("@kind", kind);
        insert.Parameters.AddWithValue("@public", isPublic);
        insert.Parameters.Add("@menu", System.Data.SqlDbType.NVarChar, 60).Value = (object?)Trim(body.MenuLabel, 60) ?? DBNull.Value;
        insert.Parameters.AddWithValue("@now", now);

        if (isPublic)
        {
            insert.Parameters.Add("@epoch", System.Data.SqlDbType.Int).Value = DBNull.Value;
            insert.Parameters.Add("@title", System.Data.SqlDbType.NVarChar, 200).Value = (object?)Trim(body.Title, 200) ?? DBNull.Value;
            insert.Parameters.Add("@intro", System.Data.SqlDbType.NVarChar, 600).Value = (object?)Trim(body.Intro, 600) ?? DBNull.Value;
            insert.Parameters.Add("@config", System.Data.SqlDbType.NVarChar, -1).Value = (object?)body.ConfigJson ?? DBNull.Value;

            Null(insert, System.Data.SqlDbType.VarBinary, "@titleS", "@introS", "@configS");
        }
        else
        {
            // Intern: unter dem AKTUELLEN Epochenschluessel des Bereichs. Wer
            // spaeter dazukommt, sieht diesen Teil nicht — genau wie bei einer
            // Nachricht, und aus demselben Grund.
            using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
            var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey, areaId, ctx.RequestAborted);

            if (keys.Count == 0)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                    RcErrorCodes.CryptoMissingEpoch, "Du hast keinen Schluessel fuer diesen Bereich.");
                return;
            }

            var epoch = keys.Keys.Max();
            var key = keys[epoch];

            insert.Parameters.AddWithValue("@epoch", epoch);
            Null(insert, System.Data.SqlDbType.NVarChar, "@title", "@intro", "@config");

            insert.Parameters.Add("@titleS", System.Data.SqlDbType.VarBinary).Value =
                (object?)SealOrNull(key, TitleAad(partId), Trim(body.Title, 200)) ?? DBNull.Value;
            insert.Parameters.Add("@introS", System.Data.SqlDbType.VarBinary).Value =
                (object?)SealOrNull(key, IntroAad(partId), Trim(body.Intro, 600)) ?? DBNull.Value;
            insert.Parameters.Add("@configS", System.Data.SqlDbType.VarBinary).Value =
                (object?)SealOrNull(key, ConfigAad(partId), body.ConfigJson) ?? DBNull.Value;
        }

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcEventPartCreatedResponse(
            RcId.ToText(partId), kind, isPublic, sort), StatusCodes.Status201Created);
    }

    public sealed record UpdatePartRequest(string? MenuLabel, string? Title, string? Intro,
        string? ConfigJson, bool? IsVisible);

    /// <summary>
    /// Ein Teil wird bearbeitet — im Unterschied zu einer Nachricht, die eine
    /// neue Fassung bekommt. Der Unterschied ist gewollt: eine Seite ist ein
    /// Arbeitsstueck, kein Wortbeitrag. Ihre Geschichte steht in der Kette des
    /// Bereichs, nicht in einer Fassungsliste je Absatz.
    /// </summary>
    private static async Task UpdatePartAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, UpdatePartRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var part = await LoadPartAsync(connection, id, ctx.RequestAborted);
        if (part is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, part.AreaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var update = new SqlCommand("""
            UPDATE dbo.rc_event_part
               SET menu_label   = @menu,
                   title        = @title,   intro        = @intro,   config_json   = @config,
                   title_sealed = @titleS,  intro_sealed = @introS,  config_sealed = @configS,
                   is_visible   = @visible,
                   updated_at   = @now
             WHERE id = @id;
            """, connection);

        update.Parameters.AddWithValue("@id", id);
        update.Parameters.Add("@menu", System.Data.SqlDbType.NVarChar, 60).Value = (object?)Trim(body.MenuLabel, 60) ?? DBNull.Value;
        update.Parameters.AddWithValue("@visible", body.IsVisible ?? part.IsVisible);
        update.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        if (part.IsPublic)
        {
            update.Parameters.Add("@title", System.Data.SqlDbType.NVarChar, 200).Value = (object?)Trim(body.Title, 200) ?? DBNull.Value;
            update.Parameters.Add("@intro", System.Data.SqlDbType.NVarChar, 600).Value = (object?)Trim(body.Intro, 600) ?? DBNull.Value;
            update.Parameters.Add("@config", System.Data.SqlDbType.NVarChar, -1).Value = (object?)body.ConfigJson ?? DBNull.Value;
            Null(update, System.Data.SqlDbType.VarBinary, "@titleS", "@introS", "@configS");
        }
        else
        {
            using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

            // Unter DERSELBEN Epoche wie beim Anlegen, nicht unter der neuesten.
            // Sonst waere ein bearbeiteter Teil ploetzlich fuer weniger Leute
            // lesbar als vorher — eine Aenderung am Text duerfte nicht die
            // Sichtbarkeit verschieben.
            var key = await RcAreaKeys.EpochKeyAsync(connection, session.AccountId, held.MasterKey,
                part.AreaId, part.Epoch!.Value, ctx.RequestAborted);

            if (key is null)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                    RcErrorCodes.CryptoMissingEpoch, "Du hast keinen Schluessel fuer diesen Teil.");
                return;
            }

            Null(update, System.Data.SqlDbType.NVarChar, "@title", "@intro", "@config");
            update.Parameters.Add("@titleS", System.Data.SqlDbType.VarBinary).Value =
                (object?)SealOrNull(key, TitleAad(id), Trim(body.Title, 200)) ?? DBNull.Value;
            update.Parameters.Add("@introS", System.Data.SqlDbType.VarBinary).Value =
                (object?)SealOrNull(key, IntroAad(id), Trim(body.Intro, 600)) ?? DBNull.Value;
            update.Parameters.Add("@configS", System.Data.SqlDbType.VarBinary).Value =
                (object?)SealOrNull(key, ConfigAad(id), body.ConfigJson) ?? DBNull.Value;
        }

        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcEventPartUpdatedResponse(RcId.ToText(id), true));
    }

    public sealed record AddFieldRequest(string Kind, string Label, string? HelpText,
        string[]? Options, bool? IsRequired, bool? IsHalfWidth, string? IdentityRole, string? DataClass);

    private static async Task AddFieldAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, AddFieldRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var kind = body.Kind?.Trim().ToLowerInvariant() ?? "";
        if (!FieldKinds.Contains(kind))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Art von Feld gibt es nicht.");
            return;
        }

        var label = body.Label?.Trim() ?? "";
        if (label.Length is 0 or > 300)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Beschriftung fehlt oder ist zu lang.");
            return;
        }

        // Eine Auswahl ohne Auswahlmoeglichkeiten waere ein Feld, das niemand
        // ausfuellen kann. Die Datenbank faengt es ab; hier wird eine Meldung
        // daraus, die den Grund nennt.
        var needsOptions = kind is "select" or "multiselect";
        var options = body.Options?.Where(o => !string.IsNullOrWhiteSpace(o)).ToArray() ?? [];
        if (needsOptions && options.Length == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Eine Auswahl braucht Auswahlmoeglichkeiten.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var part = await LoadPartAsync(connection, id, ctx.RequestAborted);
        if (part is null) { await RcAreas.NotForYou(ctx); return; }

        if (part.Kind != "form")
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Felder gehoeren an einen Formularteil.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, part.AreaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        // 12.9 — Die Vorgabe ist die STRENGERE. Bei einer Anmeldung ist
        // Ernaehrung, Unvertraeglichkeit oder Konfession der Normalfall; wer
        // weniger will, sagt es ausdruecklich und trifft damit eine
        // Entscheidung, statt in sie hineinzurutschen.
        var dataClass = body.DataClass?.Trim().ToLowerInvariant() ?? "special";
        if (dataClass is not ("normal" or "sensitive" or "special" or "secret"))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Datenklasse gibt es nicht.");
            return;
        }

        var identity = body.IdentityRole?.Trim().ToLowerInvariant() ?? "none";
        if (identity is not ("none" or "name" or "contact"))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Rolle im Formular gibt es nicht.");
            return;
        }

        var fieldId = RcId.NewId();
        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_event_field
                (id, part_id, sort_order, kind, label, help_text, options_json,
                 is_required, is_half_width, identity_role, data_class)
            VALUES (@id, @part, @sort, @kind, @label, @help, @options,
                    @required, @half, @identity, @class);
            """, connection);

        insert.Parameters.AddWithValue("@id", fieldId);
        insert.Parameters.AddWithValue("@part", id);
        insert.Parameters.AddWithValue("@sort", await NextFieldOrderAsync(connection, id, ctx.RequestAborted));
        insert.Parameters.AddWithValue("@kind", kind);
        insert.Parameters.AddWithValue("@label", label);
        insert.Parameters.AddWithValue("@help", (object?)Trim(body.HelpText, 400) ?? DBNull.Value);
        insert.Parameters.AddWithValue("@options",
            needsOptions ? JsonSerializer.Serialize(options) : (object)DBNull.Value);
        insert.Parameters.AddWithValue("@required", body.IsRequired ?? false);
        insert.Parameters.AddWithValue("@half", body.IsHalfWidth ?? false);
        insert.Parameters.AddWithValue("@identity", identity);
        insert.Parameters.AddWithValue("@class", dataClass);

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcEventFieldCreatedResponse(
            RcId.ToText(fieldId), kind, label, dataClass), StatusCodes.Status201Created);
    }

    // -- Veroeffentlichen -----------------------------------------------------

    public sealed record PublishRequest(bool? Archive);

    /// <summary>
    /// Ein Entwurf ist NICHT oeffentlich, auch wenn <c>is_public</c> steht.
    /// Sonst waere jede halbfertige Seite im Netz, sobald sie angelegt ist —
    /// und man muesste daran denken, sie zu verstecken, statt daran, sie
    /// freizugeben.
    /// </summary>
    private static async Task PublishAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, PublishRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfEventAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Admin, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var target = body.Archive == true ? LifecycleArchived : LifecyclePublished;

        await using var update = new SqlCommand(
            "UPDATE dbo.rc_event SET lifecycle = @life WHERE id = @id;", connection);
        update.Parameters.AddWithValue("@life", target);
        update.Parameters.AddWithValue("@id", id);
        await update.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcEventPublishedResponse(RcId.ToText(id), target));
    }

    // -- Lesen ----------------------------------------------------------------

    /// <summary>
    /// <c>CollectionSlug</c> steht mit dabei, weil die Adresse zweiteilig ist:
    /// <c>/event/recreatio/kal26</c>. Ohne ihn traegt eine Zeile dieser Liste
    /// nicht genug, um einen Verweis auf sich selbst zu bauen — und das faellt
    /// erst auf, wenn jemand darauf klickt.
    /// </summary>
    public sealed record EventSummary(string EventId, string AreaId, string CollectionSlug,
        string Slug, string Title,
        string Lifecycle, bool IsPublic, DateTimeOffset? StartsUtc, DateTimeOffset? EndsUtc, int Pages);

    private static async Task ListAsync(HttpContext ctx, RcDb db, RcPermissions permissions)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT e.id, e.area_id, c.slug, e.slug, e.title, e.lifecycle, e.is_public,
                   e.starts_at, e.ends_at,
                   (SELECT COUNT(*) FROM dbo.rc_event_page p WHERE p.event_id = e.id)
            FROM dbo.rc_event e
            JOIN dbo.rc_event_collection c ON c.id = e.collection_id
            ORDER BY e.created_at DESC;
            """, connection);

        var views = new List<EventSummary>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                views.Add(new EventSummary(
                    RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)),
                    reader.GetString(2), reader.GetString(3), reader.GetString(4),
                    reader.GetString(5), reader.GetBoolean(6),
                    reader.IsDBNull(7) ? null : reader.GetDateTimeOffset(7),
                    reader.IsDBNull(8) ? null : reader.GetDateTimeOffset(8),
                    reader.GetInt32(9)));
            }
        }

        // 3.4 — Gefiltert wird NACH dem Lesen und je Zeile ueber den Kernel.
        // Eine Abfrage, die die Berechtigung selbst nachbaut, ist eine zweite
        // Auswertungslogik — und die weicht irgendwann ab.
        var visible = new List<EventSummary>();
        foreach (var view in views)
        {
            var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
                Guid.Parse(view.AreaId), RcCapability.Read, ctx.RequestAborted);
            if (may.Allowed) visible.Add(view);
        }

        await RcResults.WriteJsonAsync(ctx, new RcEventsResponse(visible));
    }

    public sealed record PartView(string PartId, string Kind, bool IsPublic, int SortOrder,
        string? MenuLabel, string? Title, string? Intro, string? ConfigJson,
        bool IsVisible, string? Unreadable, IReadOnlyList<FieldView> Fields);

    public sealed record FieldView(string FieldId, string Kind, string Label, string? HelpText,
        IReadOnlyList<string> Options, bool IsRequired, bool IsHalfWidth,
        string IdentityRole, string DataClass);

    /// <summary>
    /// <c>Kind</c> — „public" oder „internal" — ist ABSICHT, keine Ableitung
    /// aus den Teilen. Eine noch leere interne Seite waere sonst als oeffentlich
    /// durchgegangen, und die erste Zuteilung eines persoenlichen Zugangs waere
    /// ins Leere gelaufen, ohne dass jemand sieht warum.
    /// </summary>
    public sealed record PageView(string PageId, string Slug, string Title, int SortOrder,
        bool IsVisible, string Kind, string? MenuLabel, string? Description,
        IReadOnlyList<PartView> Parts);

    /// <summary>
    /// Die Veranstaltung, wie ein Leser sie sieht.
    ///
    /// OHNE Konto: nur wenn veroeffentlicht und oeffentlich, und dann nur die
    /// oeffentlichen Teile. MIT Konto und Schluessel: dazu die internen, soweit
    /// die Epochen reichen.
    ///
    /// 15.9 — Ein interner Teil, den der Leser nicht oeffnen kann, faellt NICHT
    /// aus der Liste. Er steht da, mit einem Grund. Ein Loch waere schlimmer:
    /// der Leser haette keinen Anhaltspunkt, dass zwischen zwei Abschnitten
    /// etwas fehlt.
    /// </summary>
    private static async Task ReadAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        string collection, string slug)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * BEIDE TEILE DER ADRESSE ZAEHLEN.
         *
         * Der Name der Veranstaltung ist nur innerhalb ihrer Sammlung eindeutig;
         * ihn allein zu suchen traefe irgendein "festyn-2026" — womoeglich das
         * einer fremden Pfarrei. Der Verbund ist hier also keine Bequemlichkeit,
         * sondern die Bedingung dafuer, dass die Antwort die gemeinte Zeile ist.
         */
        await using var head = new SqlCommand("""
            SELECT e.id, e.area_id, e.slug, e.title, e.lifecycle, e.is_public,
                   e.starts_at, e.ends_at, e.intake_public_key,
                   e.subtitle, e.summary, e.category, e.audience, e.places_json,
                   e.thumbnail_url, e.date_label, e.theme_json
            FROM dbo.rc_event e
            JOIN dbo.rc_event_collection c ON c.id = e.collection_id
            WHERE c.slug = @collection AND e.slug = @slug;
            """, connection);
        head.Parameters.AddWithValue("@collection", collection);
        head.Parameters.AddWithValue("@slug", slug);

        Guid eventId = Guid.Empty, areaId = Guid.Empty;
        string title = "", lifecycle = "";
        bool isPublic = false;
        DateTimeOffset? starts = null, ends = null;
        byte[]? intakePublicKey = null;
        string? subtitle = null, summary = null, category = null, audience = null;
        string? placesJson = null, thumbnailUrl = null, dateLabel = null, themeJson = null;

        await using (var reader = await head.ExecuteReaderAsync(ctx.RequestAborted))
        {
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await RcAreas.NotForYou(ctx); return; }
            eventId = reader.GetGuid(0);
            areaId = reader.GetGuid(1);
            title = reader.GetString(3);
            lifecycle = reader.GetString(4);
            isPublic = reader.GetBoolean(5);
            starts = reader.IsDBNull(6) ? null : reader.GetDateTimeOffset(6);
            ends = reader.IsDBNull(7) ? null : reader.GetDateTimeOffset(7);
            intakePublicKey = reader.IsDBNull(8) ? null : (byte[])reader[8];

            subtitle = reader.IsDBNull(9) ? null : reader.GetString(9);
            summary = reader.IsDBNull(10) ? null : reader.GetString(10);
            category = reader.IsDBNull(11) ? null : reader.GetString(11);
            audience = reader.IsDBNull(12) ? null : reader.GetString(12);
            placesJson = reader.IsDBNull(13) ? null : reader.GetString(13);
            thumbnailUrl = reader.IsDBNull(14) ? null : reader.GetString(14);
            dateLabel = reader.IsDBNull(15) ? null : reader.GetString(15);
            themeJson = reader.IsDBNull(16) ? null : reader.GetString(16);
        }

        var session = ctx.RcSession();
        var mayRead = session is not null
            && (await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
                    RcCapability.Read, ctx.RequestAborted)).Allowed;

        // Ein Entwurf ist fuer Fremde nicht da — und zwar so, als gaebe es ihn
        // nicht. "Noch nicht veroeffentlicht" waere ein Verzeichnis dessen, was
        // gerade vorbereitet wird.
        var publicly = lifecycle == LifecyclePublished && isPublic;
        if (!publicly && !mayRead) { await RcAreas.NotForYou(ctx); return; }

        Dictionary<int, byte[]> keys = [];
        if (mayRead && session is not null)
        {
            using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
            keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey, areaId, ctx.RequestAborted);
        }

        var pages = await ReadPagesAsync(connection, eventId, mayRead, keys, ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcEventViewResponse(
            RcId.ToText(eventId), RcId.ToText(areaId), collection, slug, title, lifecycle, isPublic,
            starts, ends, mayRead, pages,
            // Der oeffentliche Annahmeschluessel reist mit dem Formular. Er ist
            // oeffentlich — genau dafuer ist er da.
            intakePublicKey is null ? null : RcBase64Url.Encode(intakePublicKey),
            subtitle, summary, category, audience, placesJson, thumbnailUrl,
            dateLabel, themeJson));
    }

    /// <summary>
    /// Die Veranstaltung, wie ein Leser MIT PERSOENLICHEM LINK sie sieht.
    ///
    /// <b>Zwei Unterschiede zum Mitglied, und beide sind Absicht.</b>
    ///
    /// Der Schluesselbund traegt GENAU EINE Epoche — die, unter der der
    /// Zugang ausgestellt wurde. Schneidet der Bereich spaeter eine neue,
    /// oeffnet dieser Link weiterhin, was zu seiner Zeit gehoerte, und nichts
    /// von dem, was danach kam.
    ///
    /// Und die Auswahl der Seiten ist eine LISTE, keine Berechtigung: die
    /// oeffentliche Seite plus die zugeteilten. Was nicht zugeteilt ist,
    /// steht nicht in der Antwort — nicht „gesperrt", sondern gar nicht.
    /// Gefiltert wird hier und nicht im Browser: was nicht mitgeschickt
    /// wird, kann auch nicht durchsickern.
    /// </summary>
    internal static async Task<RcEventViewResponse?> ReadForAccessAsync(
        SqlConnection connection, Guid eventId, IReadOnlyList<Guid> grantedPages,
        int epoch, byte[] epochKey, CancellationToken ct)
    {
        Guid areaId;
        string slug, title, lifecycle, collectionSlug;
        bool isPublic;
        DateTimeOffset? starts, ends;
        byte[]? intakePublicKey;
        string? subtitle, themeJson;

        await using (var head = new SqlCommand("""
            SELECT e.id, e.area_id, e.slug, e.title, e.lifecycle, e.is_public,
                   e.starts_at, e.ends_at, e.intake_public_key, c.slug,
                   e.subtitle, e.theme_json
            FROM dbo.rc_event e
            JOIN dbo.rc_event_collection c ON c.id = e.collection_id
            WHERE e.id = @id;
            """, connection))
        {
            head.Parameters.AddWithValue("@id", eventId);
            await using var reader = await head.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;

            areaId = reader.GetGuid(1);
            slug = reader.GetString(2);
            title = reader.GetString(3);
            lifecycle = reader.GetString(4);
            isPublic = reader.GetBoolean(5);
            starts = reader.IsDBNull(6) ? null : reader.GetDateTimeOffset(6);
            ends = reader.IsDBNull(7) ? null : reader.GetDateTimeOffset(7);
            intakePublicKey = reader.IsDBNull(8) ? null : (byte[])reader[8];
            collectionSlug = reader.GetString(9);
            subtitle = reader.IsDBNull(10) ? null : reader.GetString(10);
            themeJson = reader.IsDBNull(11) ? null : reader.GetString(11);
        }

        var keys = new Dictionary<int, byte[]> { [epoch] = epochKey };
        var pages = await ReadPagesAsync(connection, eventId, true, keys, ct);

        /*
         * Die oeffentliche Seite kommt IMMER mit. Sonst haette der
         * Empfaenger keinen Weg zu dem, was alle sehen, ausser einer zweiten
         * Adresse, die ihm niemand geschickt hat.
         */
        var open = new HashSet<string>(grantedPages.Select(RcId.ToText));

        var kinds = new Dictionary<string, string>();
        await using (var cmd = new SqlCommand(
            "SELECT id, ISNULL(kind, N'public') FROM dbo.rc_event_page WHERE event_id = @id;",
            connection))
        {
            cmd.Parameters.AddWithValue("@id", eventId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                kinds[RcId.ToText(reader.GetGuid(0))] = reader.GetString(1);
        }

        var allowed = pages
            .Where(page => kinds.GetValueOrDefault(page.PageId, "public") == "public"
                        || open.Contains(page.PageId))
            .ToList();

        return new RcEventViewResponse(
            RcId.ToText(eventId), RcId.ToText(areaId), collectionSlug, slug, title,
            lifecycle, isPublic, starts, ends, true, allowed,
            intakePublicKey is null ? null : RcBase64Url.Encode(intakePublicKey),
            subtitle, null, null, null, null, null, null, themeJson);
    }

    private static async Task<List<PageView>> ReadPagesAsync(
        SqlConnection connection, Guid eventId, bool mayRead,
        IReadOnlyDictionary<int, byte[]> keys, CancellationToken ct)
    {
        var pages = new List<(Guid Id, string Slug, string Title, int Sort, bool Visible,
            string Kind, string? Menu, string? Description)>();

        await using (var cmd = new SqlCommand("""
            SELECT id, slug, title, sort_order, is_visible,
                   ISNULL(kind, N'public'), menu_label, description
            FROM dbo.rc_event_page WHERE event_id = @event ORDER BY sort_order, seq;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@event", eventId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                pages.Add((reader.GetGuid(0), reader.GetString(1), reader.GetString(2),
                    reader.GetInt32(3), reader.GetBoolean(4), reader.GetString(5),
                    reader.IsDBNull(6) ? null : reader.GetString(6),
                    reader.IsDBNull(7) ? null : reader.GetString(7)));
        }

        var result = new List<PageView>();
        foreach (var page in pages)
        {
            if (!page.Visible && !mayRead) continue;
            result.Add(new PageView(RcId.ToText(page.Id), page.Slug, page.Title, page.Sort,
                page.Visible, page.Kind, page.Menu, page.Description,
                await ReadPartsAsync(connection, page.Id, mayRead, keys, ct)));
        }
        return result;
    }

    private static async Task<List<PartView>> ReadPartsAsync(
        SqlConnection connection, Guid pageId, bool mayRead,
        IReadOnlyDictionary<int, byte[]> keys, CancellationToken ct)
    {
        var rows = new List<(Guid Id, string Kind, bool Public, int Sort, int? Epoch,
            string? Menu, string? Title, string? Intro, string? Config,
            byte[]? TitleS, byte[]? IntroS, byte[]? ConfigS, bool Visible)>();

        await using (var cmd = new SqlCommand("""
            SELECT id, kind, is_public, sort_order, epoch, menu_label,
                   title, intro, config_json, title_sealed, intro_sealed, config_sealed, is_visible
            FROM dbo.rc_event_part WHERE page_id = @page ORDER BY sort_order, seq;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@page", pageId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                rows.Add((reader.GetGuid(0), reader.GetString(1), reader.GetBoolean(2),
                    reader.GetInt32(3), reader.IsDBNull(4) ? null : reader.GetInt32(4),
                    reader.IsDBNull(5) ? null : reader.GetString(5),
                    reader.IsDBNull(6) ? null : reader.GetString(6),
                    reader.IsDBNull(7) ? null : reader.GetString(7),
                    reader.IsDBNull(8) ? null : reader.GetString(8),
                    reader.IsDBNull(9) ? null : (byte[])reader[9],
                    reader.IsDBNull(10) ? null : (byte[])reader[10],
                    reader.IsDBNull(11) ? null : (byte[])reader[11],
                    reader.GetBoolean(12)));
        }

        var result = new List<PartView>();
        foreach (var row in rows)
        {
            // Ein interner Teil geht einen Fremden gar nichts an — er faellt
            // fuer ihn aus der Liste. Der Vermerk "unlesbar" gilt fuer
            // MITGLIEDER, denen nur die Epoche fehlt: die sollen sehen, dass
            // etwas da ist. Einem Aussenstehenden zu zeigen, wie viele interne
            // Abschnitte es gibt, waere eine Auskunft ueber die Vorbereitung.
            if (!row.Public && !mayRead) continue;
            if (!row.Visible && !mayRead) continue;

            string? unreadable = null;
            string? partTitle = row.Title, partIntro = row.Intro, partConfig = row.Config;

            if (!row.Public)
            {
                if (row.Epoch is null || !keys.TryGetValue(row.Epoch.Value, out var key))
                {
                    unreadable = RcErrorCodes.CryptoMissingEpoch;
                    partTitle = partIntro = partConfig = null;
                }
                else
                {
                    partTitle = OpenOrNull(key, TitleAad(row.Id), row.TitleS, ref unreadable);
                    partIntro = OpenOrNull(key, IntroAad(row.Id), row.IntroS, ref unreadable);
                    partConfig = OpenOrNull(key, ConfigAad(row.Id), row.ConfigS, ref unreadable);
                }
            }

            result.Add(new PartView(
                RcId.ToText(row.Id), row.Kind, row.Public, row.Sort, row.Menu,
                partTitle, partIntro, partConfig, row.Visible, unreadable,
                row.Kind == "form" ? await ReadFieldsAsync(connection, row.Id, ct) : []));
        }
        return result;
    }

    private static async Task<List<FieldView>> ReadFieldsAsync(SqlConnection connection, Guid partId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT id, kind, label, help_text, options_json, is_required, is_half_width,
                   identity_role, data_class
            FROM dbo.rc_event_field WHERE part_id = @part ORDER BY sort_order, seq;
            """, connection);
        cmd.Parameters.AddWithValue("@part", partId);

        var fields = new List<FieldView>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            string[] options = [];
            if (!reader.IsDBNull(4))
            {
                // Ein kaputtes Auswahlfeld darf nicht die ganze Seite mitnehmen.
                // Der Altbestand hatte dieselbe Haltung, und sie war richtig:
                // Konfiguration wird bearbeitet und ist an jedem Punkt halb
                // fertig (siehe _reference/.../contracts.ts, "Tolerant readers").
                try { options = JsonSerializer.Deserialize<string[]>(reader.GetString(4)) ?? []; }
                catch (JsonException) { options = []; }
            }

            fields.Add(new FieldView(
                RcId.ToText(reader.GetGuid(0)), reader.GetString(1), reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3), options,
                reader.GetBoolean(5), reader.GetBoolean(6), reader.GetString(7), reader.GetString(8)));
        }
        return fields;
    }

    // -- Kleinkram ------------------------------------------------------------

    private sealed record PartRow(Guid Id, Guid AreaId, string Kind, bool IsPublic, int? Epoch, bool IsVisible);

    private static async Task<PartRow?> LoadPartAsync(SqlConnection connection, Guid partId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT p.id, e.area_id, p.kind, p.is_public, p.epoch, p.is_visible
            FROM dbo.rc_event_part p
            JOIN dbo.rc_event_page g ON g.id = p.page_id
            JOIN dbo.rc_event e      ON e.id = g.event_id
            WHERE p.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", partId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new PartRow(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
            reader.GetBoolean(3), reader.IsDBNull(4) ? null : reader.GetInt32(4), reader.GetBoolean(5));
    }

    private static async Task<Guid> AreaOfEventAsync(SqlConnection connection, Guid eventId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT area_id FROM dbo.rc_event WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", eventId);
        return await cmd.ExecuteScalarAsync(ct) is Guid g ? g : Guid.Empty;
    }

    private static async Task<Guid> TenantOfAreaAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT tenant_id FROM dbo.rc_area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", areaId);
        return await cmd.ExecuteScalarAsync(ct) is Guid g ? g : Guid.Empty;
    }

    private static async Task<(Guid EventId, Guid AreaId)> EventOfPageAsync(
        SqlConnection connection, Guid pageId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT e.id, e.area_id FROM dbo.rc_event_page p
            JOIN dbo.rc_event e ON e.id = p.event_id WHERE p.id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", pageId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct)
            ? (reader.GetGuid(0), reader.GetGuid(1))
            : (Guid.Empty, Guid.Empty);
    }

    private static async Task<int> NextPageOrderAsync(SqlConnection c, Guid eventId, CancellationToken ct) =>
        await NextOrderAsync(c, "SELECT ISNULL(MAX(sort_order), -1) + 1 FROM dbo.rc_event_page WHERE event_id = @id;", eventId, ct);

    private static async Task<int> NextPartOrderAsync(SqlConnection c, Guid pageId, CancellationToken ct) =>
        await NextOrderAsync(c, "SELECT ISNULL(MAX(sort_order), -1) + 1 FROM dbo.rc_event_part WHERE page_id = @id;", pageId, ct);

    private static async Task<int> NextFieldOrderAsync(SqlConnection c, Guid partId, CancellationToken ct) =>
        await NextOrderAsync(c, "SELECT ISNULL(MAX(sort_order), -1) + 1 FROM dbo.rc_event_field WHERE part_id = @id;", partId, ct);

    private static async Task<int> NextOrderAsync(SqlConnection c, string sql, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(sql, c);
        cmd.Parameters.AddWithValue("@id", id);
        return await cmd.ExecuteScalarAsync(ct) is int n ? n : 0;
    }

    private static string? Trim(string? value, int max)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        return trimmed.Length > max ? trimmed[..max] : trimmed;
    }

    private static byte[]? SealOrNull(byte[] key, RcAad aad, string? value) =>
        value is null ? null : RcCrypto.Seal(key, aad, Encoding.UTF8.GetBytes(value));

    /// <summary>
    /// Oeffnen und dabei den ERSTEN Grund festhalten, falls es schiefgeht.
    ///
    /// Der erste, nicht der letzte: wenn Titel und Nutzlast beide nicht
    /// aufgehen, ist der Grund derselbe, und der spaetere ueberschriebe nur die
    /// Stelle, an der es zuerst klemmte.
    /// </summary>
    private static string? OpenOrNull(byte[] key, RcAad aad, byte[]? blob, ref string? reason)
    {
        if (blob is null) return null;
        try { return Encoding.UTF8.GetString(RcCrypto.Open(key, aad, blob)); }
        catch (RcDecryptException e) { reason ??= e.Code; return null; }
    }

    /// <summary>
    /// Leere Werte MIT Typ eintragen.
    ///
    /// <c>AddWithValue(name, DBNull.Value)</c> leitet den Typ aus dem Wert ab
    /// und kommt bei DBNull auf nvarchar. Gegen eine varbinary-Spalte bricht
    /// das mit einer Meldung ueber eine unerlaubte Umwandlung ab — und zwar
    /// erst beim Ausfuehren, nicht beim Uebersetzen. Genau dieser Fehler ist
    /// hier schon einmal an einer anderen Tabelle passiert; deshalb nimmt der
    /// Helfer den Typ jetzt entgegen, statt ihn raten zu lassen.
    /// </summary>
    private static void Null(SqlCommand cmd, System.Data.SqlDbType type, params string[] names)
    {
        foreach (var name in names) cmd.Parameters.Add(name, type).Value = DBNull.Value;
    }
}
