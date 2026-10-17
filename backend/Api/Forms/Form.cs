using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Das Formular — Felder als ZEILEN, und was von aussen hereinkommt.
///
/// <para>
/// <b>Warum Felder Zeilen sind und keine Einstellung.</b> 0003 sagte es, und es
/// gilt unveraendert: „Laege die Feldliste als JSON im Baustein, haette eine
/// Antwort keinen Anker: man aenderte die Reihenfolge, und alle Antworten
/// meinten etwas anderes." Eine Antwort zeigt auf ein Feld, also muss es das
/// Feld geben.
/// </para>
///
/// <para>
/// <b>Jedes Feld nennt seinen eigenen Bereich.</b> Damit kann ein Formular
/// Fragen stellen, deren Antworten an verschiedene Stellen gehen — die
/// Anmeldung an die Pfarrei, die Gesundheitsangabe an die Leitung der Freizeit.
/// Mit einem Bereich je Baustein muesste man dafuer zwei Formulare bauen und
/// den Menschen zweimal fragen.
/// </para>
///
/// <para>
/// <b>Auch die BESCHRIFTUNG ist versiegelt</b> — und die Auswahlliste erst
/// recht: eine Liste moeglicher Antworten sagt oft mehr als die Frage. Ein
/// oeffentliches Formular ist deshalb eines, dessen Bereich seine Epoche
/// offengelegt hat; dasselbe Verfahren wie beim Kalender, und kein zweites.
/// </para>
///
/// <para>
/// <b>Der Dienst liest nichts davon.</b> Werte kommen versiegelt an, die
/// Schluessel dazu verpackt unter der oeffentlichen Haelfte des Annahmepaares
/// (<see cref="Intake"/>). Er legt sie hin.
/// </para>
/// </summary>
public static partial class Form
{
    /// <summary>
    /// Was ein Feld ueber die Person sagt, die den Bogen ausfuellt (0038).
    ///
    /// <para>
    /// Dieselben Woerter wie <c>ck_person_value_field</c>. Zwei Listen fuer
    /// dieselbe Sache sind die zuverlaessigste Art, sie auseinanderlaufen zu
    /// lassen — und hier faellt es erst auf, wenn ein Bogen sich nicht mehr
    /// ausfuellen laesst.
    /// </para>
    /// </summary>
    private static readonly string[] IdentityRoles =
    [
        "none",
        "given_name", "surname", "phone", "born", "address", "email", "nickname"
    ];

    private static readonly string[] Kinds =
        ["line", "text", "choice", "date", "number", "checkbox", "email", "phone",

         /*
          * Eine ZUSTIMMUNG mit ihrem Wortlaut (die Antwort traegt den Text, dem
          * zugestimmt wurde — RODO Art. 7 Abs. 1), und eine PESEL-Nummer (im
          * Browser auf ihre Pruefziffer geprueft). Der Dienst liest keine
          * Antwort; fuer ihn sind es zwei Woerter mehr.
          */
         "consent", "pesel"];

    public static void Map(WebApplication app)
    {
        app.MapPost("/workspace/part/{id:guid}/field", AddFieldAsync);
        app.MapGet("/workspace/part/{id:guid}/fields", FieldsAsync);
        app.MapPost("/workspace/field/{id:guid}/remove", RemoveFieldAsync);
        /* 0086 — eine vom Formular genommene Frage zurückholen. */
        app.MapPost("/workspace/field/{id:guid}/restore", RestoreFieldAsync);

        /*
         * EINE FRAGE AENDERN (0042) — ihren Text, ihre Form, und wohin ihre
         * Antworten gehen. Der Dienst legt ab, was der Browser neu versiegelt
         * und neu verpackt hat; er selbst kann beides nicht.
         */
        app.MapPost("/workspace/field/{id:guid}", UpdateFieldAsync);

        app.MapGet("/workspace/part/{id:guid}/registrations", RegistrationsAsync);

        /*
         * EINE EINSTELLUNG DES BAUSTEINS, von der Kanzleisicht aus.
         *
         * Der Rasterentwurf speichert `config` mitsamt der ganzen Seite
         * (`PUT /workspace/parts`). Das ist dort richtig — dort verschiebt man
         * Bausteine. Die Nachrichtenvorlage denkt aber niemand beim Verschieben
         * aus, sondern dann, wenn er vor den Einsendungen sitzt; sie dort zu
         * suchen hiesse, die Seite zu verlassen, um einen Satz zu tippen.
         *
         * Deshalb dieser Weg: EIN Baustein, EINZELNE Schluessel, alles andere
         * bleibt stehen.
         */
        app.MapPost("/workspace/part/{id:guid}/config", ConfigAsync);

        /*
         * DER AUFBAU UND DIE LOGIK (0043) — ein versiegeltes Dokument, das der
         * Dienst ablegt und herausgibt, ohne es zu lesen.
         */
        app.MapPost("/workspace/part/{id:guid}/design", SaveDesignAsync);
        app.MapPost("/workspace/part/{id:guid}/linkcheck", LinkCheckAsync);

        /*
         * RSA ist der Umschlag, nicht der Tresor (0037). Wer eine Einsendung
         * aufmacht, versiegelt ihre Schluessel im selben Zug symmetrisch neu —
         * und der RSA-Umschlag faellt.
         */
        app.MapPost("/workspace/part/{id:guid}/rewrap", RewrapAsync);

        /*
         * ZWEI VERSCHIEDENE DINGE, und sie duerfen nicht denselben Knopf haben.
         *
         *   hide    raeumt die LISTE auf. Die Huellen bleiben liegen.
         *   remove  loescht die HUELLEN. Danach gibt es sie nicht mehr —
         *           auch nicht fuer den Betreiber, der sie ohnehin nie lesen
         *           konnte.
         *
         * Ein einziger Knopf „usuń", der in Wahrheit versteckt, waere eine
         * Zusage, die niemand einloest: wer seine Daten zurueckzieht, meint die
         * Bytes und nicht die Anzeige.
         */
        app.MapPost("/workspace/registration/{id:guid}/hide", HideAsync);
        app.MapPost("/workspace/registration/{id:guid}/remove", RemoveAsync);

        /*
         * EINE EINSENDUNG BERICHTIGEN — von der Kanzlei aus.
         *
         * Es gibt schon `POST /seat/{token}/submission`: dort berichtigt der
         * Mensch selbst, mit seinem Link. Das ist der Normalfall und bleibt es.
         *
         * Hier steht der andere: eine Telefonnummer, die als „600700800"
         * eingetragen wurde und als „+48 600 700 800" gespeichert gehoert. Wer
         * das reihum geradezieht, ist die Kanzlei — sie hat den
         * Annahmeschluessel, und der Betroffene hat vielleicht seit Wochen
         * nicht hereingeschaut.
         */
        app.MapPost("/workspace/registration/{id:guid}/values", ReviseAsOfficeAsync);

        /*
         * EINE NUMMER BESTAETIGEN, OHNE SIE ZU KENNEN (0030).
         *
         * Der Dienst kann keine SMS mit einem Code schicken — er liest die
         * Nummer nicht. Also wuerfelt die KANZLEI ein Geheimnis, verschickt den
         * Link von Hand, und der Dienst bekommt nur den Abdruck und die Stelle:
         * welche Einsendung, welches Feld.
         *
         * Wer klickt, war unter dieser Nummer erreichbar. Mehr beweist auch
         * eine Code-SMS nicht.
         */
        app.MapPost("/workspace/registration/{id:guid}/check", ArmCheckAsync);

        /* Ohne Konto — der Link IST der Beweis. */
        app.MapPost("/verify/{token}", VerifyAsync);

        /* Ohne Konto — das ist der Zweck. */
        app.MapGet("/form/{id:guid}", PublicAsync);
        app.MapPost("/form/{id:guid}/submit", SubmitAsync);

        /* 0047 — Erweiterungen und Schritte (Form.Extension.cs). */
        MapExtension(app);

        /* 0091 — die Rolle der Menschen eines Formulars (Form.Members.cs). */
        MapMembers(app);
    }

/* -- Gemeinsames -------------------------------------------------------- */

    /// <summary>
    /// Eine Frage, wie sie in der Datenbank steht. <c>RemovedAt</c> (0086): vom
    /// Formular genommen — gefragt wird sie nicht mehr, ihre Antworten bleiben.
    /// </summary>
    internal sealed record FieldRow(
        Guid Id, Guid AreaId, string Kind, int Position, byte[] Label, byte[]? Help,
        byte[]? Options, int Epoch, bool IsRequired, bool IsHalfWidth, string IdentityRole,
        Guid? LabelAreaId = null, int? LabelEpoch = null, bool SelfEdit = true, bool LinkCheck = false,
        DateTimeOffset? RemovedAt = null, bool PersonOnly = false);

    /// <summary>
    /// Wie eine Frage hinausgeht. <c>labelAreaId</c> / <c>labelEpoch</c> sind
    /// IMMER gesetzt: der Schluessel, der die Frage oeffnet — der des
    /// Formulars (0042) oder, bei einer Frage von davor, der ihrer Antworten.
    /// Der Browser muss den Unterschied nicht kennen.
    /// </summary>
    private static object Told(FieldRow f) => new
    {
        fieldId = Ids.ToText(f.Id),
        areaId = Ids.ToText(f.AreaId),
        kind = f.Kind,
        position = f.Position,
        labelSealed = Base64Url.Encode(f.Label),
        helpSealed = f.Help is null ? null : Base64Url.Encode(f.Help),
        optionsSealed = f.Options is null ? null : Base64Url.Encode(f.Options),
        epoch = f.Epoch,
        labelAreaId = Ids.ToText(f.LabelAreaId ?? f.AreaId),
        labelEpoch = f.LabelEpoch ?? f.Epoch,
        isRequired = f.IsRequired,
        isHalfWidth = f.IsHalfWidth,
        identityRole = f.IdentityRole,
        selfEdit = f.SelfEdit,

        /* 0093 — schreibt und berichtigt nur der Mensch; die Kanzlei liest. */
        personOnly = f.PersonOnly,

        /* Beim ersten Oeffnen eines Links zu bestaetigen (0046)? */
        linkCheck = f.LinkCheck,

        /* 0086 — vom Formular genommen (nur die Kanzlei bekommt solche zu sehen). */
        removedAt = f.RemovedAt
    };

    /// <summary>
    /// Unter welchem Schluessel die Frage liegen MUSS.
    ///
    /// <para>
    /// Hat das Formular einen Bereich, dann unter seinem — sonst waere die
    /// Frage nur fuer die lesbar, die die Antworten lesen, und ein
    /// oeffentliches Formular zeigte „zapieczętowane". Ohne Bereich wie vor
    /// 0042: unter dem der Antworten (NULL).
    /// </para>
    /// </summary>
    private static (Guid? Area, int? Epoch, string? Fail) LabelPlace(
        Sheet sheet, string? labelAreaId, int? labelEpoch)
    {
        if (string.IsNullOrWhiteSpace(labelAreaId)) return (null, null, null);

        if (!Guid.TryParse(labelAreaId, out var area) || labelEpoch is null or < 1)
        {
            return (null, null, "Nieczytelny obszar albo epoka pytania.");
        }

        if (sheet.AreaId is not Guid own || own != area)
        {
            return (null, null, "Pytanie pieczętuje się kluczem obszaru formularza.");
        }

        return (area, labelEpoch, null);
    }

    /// <summary>
    /// Die Zeilen, wie sie in der Datenbank stehen.
    ///
    /// <para>
    /// <b>NIE HINAUSSCHREIBEN — immer durch <see cref="Told"/>.</b> Diese
    /// Aufstellung traegt `Id` und `Label` als `byte[]`; der Browser sucht
    /// `fieldId` und `labelSealed` in Base64Url. Direkt serialisiert kommt
    /// eine zweite Gestalt derselben Sache heraus, und niemand merkt es: es
    /// wirft nicht, es fehlt nur — und `undefined` reicht sich still weiter,
    /// bis eine Beschriftung nie aufgeht und keine Antwort ihre Frage findet.
    /// Genau das ist einmal passiert, und zwar nur auf dem Weg der Kanzlei.
    /// </para>
    /// </summary>
    /// <param name="withRemoved">
    /// 0086 — auch die vom Formular genommenen Fragen: für die Kanzlei (ihre
    /// Antworten bleiben lesbar) und für die Frage, wer was darf. Das Formular
    /// selbst und das Absenden kennen sie nicht mehr.
    /// </param>
    private static async Task<List<FieldRow>> ReadFieldsAsync(
        SqlConnection connection, Guid partId, CancellationToken ct, bool withRemoved = false)
    {
        var fields = new List<FieldRow>();

        await using var cmd = new SqlCommand($"""
            SELECT id, area_id, kind, position, label_sealed, help_sealed, options_sealed,
                   epoch, is_required, is_half_width, identity_role, label_area_id, label_epoch,
                   self_edit, link_check, removed_at, person_only
            FROM app.slug_field
            WHERE part_id = @part{(withRemoved ? "" : " AND removed_at IS NULL")}
            ORDER BY position;
            """, connection);

        cmd.Parameters.AddWithValue("@part", partId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            fields.Add(new FieldRow(
                reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetInt32(3),
                (byte[])reader[4],
                reader.IsDBNull(5) ? null : (byte[])reader[5],
                reader.IsDBNull(6) ? null : (byte[])reader[6],
                reader.GetInt32(7), reader.GetBoolean(8), reader.GetBoolean(9), reader.GetString(10),
                reader.IsDBNull(11) ? null : reader.GetGuid(11),
                reader.IsDBNull(12) ? null : reader.GetInt32(12),
                reader.GetBoolean(13),
                reader.GetBoolean(14),
                reader.IsDBNull(15) ? null : reader.GetDateTimeOffset(15),
                reader.GetBoolean(16)));
        }

        return fields;
    }

/// <summary>Das Formular als Ganzes: wovon es handelt, ob es offen ist, wer fuer die Daten steht.</summary>
    private sealed record Whole(
        string ForKind, bool Closed, (string Name, string? Address, string? Email)? Controller,

        /// <summary>Wie das Formular heisst — die Ueberschrift auf der Seite (fuer den Ausdruck). Sonst sein Name, den der Browser oeffnet (0097).</summary>
        string? Title = null,

        /// <summary>Was nach dem Absenden dasteht, und ob ein Ausdruck unterschrieben werden muss (siehe <see cref="AfterOf"/>).</summary>
        After? After = null,

        /// <summary>0097 — sein Name: versiegelt unter dem Schluessel seines Bereichs.</summary>
        Guid? AreaId = null, byte[]? NameSealed = null, int? NameEpoch = null);

    /// <summary>
    /// <para>
    /// <b>NACH DEM ABSENDEN</b> — aus den Einstellungen des Bausteins: eine eigene
    /// Ueberschrift (<c>sentTitle</c>, sonst „Zgłoszenie przyjęte."), ein eigener
    /// Text darunter (<c>sentText</c>), und ob das Ausgefuellte auf Papier
    /// unterschrieben werden muss (<c>paper</c>: <c>always</c>, oder die Kennung
    /// einer Frage — dann, wenn sie angekreuzt ist; <c>paperSigner</c>: wer
    /// unterschreibt).
    /// </para>
    /// <para>
    /// Hinaus geht NUR das, nicht die ganze Tafel: dort stehen auch die
    /// Vorlagen der Nachrichten, und die gehoeren der Kanzlei.
    /// </para>
    /// </summary>
    /// <param name="At">
    /// 0086 — was an die Adresse der Seite gehängt wird (`portalAt`): `?s=3`
    /// (ein Slajd), `?part=<kennung>` (ein Baustein), `#zapisy` (ein Slajd nach
    /// seinem Namen) — der Link des Menschen öffnet die Seite genau dort.
    /// </param>
    private sealed record After(string? Title, string? Text, string? Paper, string? Signer, string? At = null);

    /// <summary>Was der Platz eines Menschen in der Adresse traegt (`seatKeep.ts`) — der Zusatz darf es nicht nachmachen.</summary>
    private const string SeatParam = "miejsce";

    private const int MaxPortalAt = 300;

    /// <summary>
    /// 0086 — DER ZUSATZ ZUR ADRESSE, geprueft: beginnt mit `?` oder `#`,
    /// keine Leerzeichen, keine Zeichen, die aus einem Link etwas anderes
    /// machen, nicht der Platz selbst. <c>null</c> heisst: so nicht.
    /// </summary>
    public static string? PortalAt(string? text)
    {
        var at = (text ?? string.Empty).Trim();
        if (at.Length == 0 || at.Length > MaxPortalAt) return null;
        if (at[0] != '?' && at[0] != '#') return null;
        if (at.Any(c => char.IsWhiteSpace(c) || char.IsControl(c) || c is '<' or '>' or '"' or '\'' or '`' or '\\')) return null;

        var hash = at.IndexOf('#');
        var query = hash < 0 ? at : at[..hash];
        if (query.TrimStart('?').Split('&').Any(p => p.Equals(SeatParam, StringComparison.OrdinalIgnoreCase)
                || p.StartsWith(SeatParam + "=", StringComparison.OrdinalIgnoreCase))) return null;

        /* Ein zweites `#` haette keinen Sinn — der Anker ist der Rest. */
        if (hash >= 0 && at.IndexOf('#', hash + 1) >= 0) return null;

        return at == "?" || at == "#" ? null : at;
    }

    private static After? AfterOf(string? config)
    {
        if (string.IsNullOrWhiteSpace(config)) return null;

        Dictionary<string, string>? read;
        try { read = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(config); }
        catch (System.Text.Json.JsonException) { return null; }
        if (read is null) return null;

        string? Get(string key) => read.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v.Trim() : null;

        var after = new After(Get("sentTitle"), Get("sentText"), Get("paper"), Get("paperSigner"), PortalAt(Get("portalAt")));
        return after is { Title: null, Text: null, Paper: null, Signer: null, At: null } ? null : after;
    }

    private static string? TitleOf(string? config)
    {
        if (string.IsNullOrWhiteSpace(config)) return null;
        try
        {
            var read = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(config);
            return read is not null && read.TryGetValue("title", out var t) && !string.IsNullOrWhiteSpace(t) ? t.Trim() : null;
        }
        catch (System.Text.Json.JsonException) { return null; }
    }

    /// <summary>
    /// <b>Die Klausel des Formulars</b> (0042) steht an EINER Stelle: der
    /// Administrator danych beim Obszar des Formulars, und ein Obszar ohne
    /// eigenen erbt den des naechsten darueber (<c>parent_area_id</c>: die Gruppe
    /// den der Pfarrei). Hat die ganze Kette keinen, sammelt das Formular nicht.
    /// </summary>
    private static async Task<Whole?> WholeAsync(SqlConnection connection, Guid moduleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            WITH chain AS (
                SELECT a.id, a.parent_area_id, 0 AS depth
                  FROM app.area a
                  JOIN app.module mm ON mm.area_id = a.id
                 WHERE mm.id = @id
                UNION ALL
                SELECT p.id, p.parent_area_id, c.depth + 1
                  FROM app.area p
                  JOIN chain c ON p.id = c.parent_area_id
                 WHERE c.depth < 16
            )
            SELECT m.for_kind, m.closed_at,
                   m.config, m.area_id, m.name_sealed, m.name_epoch,
                   h.name, h.address, h.email
            FROM app.module m
            OUTER APPLY (
                SELECT TOP 1 ac.name, ac.address, ac.email
                  FROM chain ch
                  JOIN app.area_controller ac ON ac.area_id = ch.id
                 ORDER BY ch.depth
            ) h
            WHERE m.id = @id;
            """, connection);

        cmd.Parameters.AddWithValue("@id", moduleId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        string? Text(int i) => reader.IsDBNull(i) ? null : reader.GetString(i);

        (string, string?, string?)? controller = Text(6) is string name ? (name, Text(7), Text(8)) : null;

        var config = Text(2);
        return new Whole(reader.GetString(0), !reader.IsDBNull(1), controller,
            Title: TitleOf(config), After: AfterOf(config),
            AreaId: reader.IsDBNull(3) ? null : reader.GetGuid(3),
            NameSealed: reader.IsDBNull(4) ? null : (byte[])reader[4],
            NameEpoch: reader.IsDBNull(5) ? null : reader.GetInt32(5));
    }

/// <summary>Die zu bestaetigenden Fragen als Text — oder <c>null</c>, wenn keine.</summary>
    internal static string? VerifyFieldsText(IReadOnlyList<string>? ids)
    {
        var parsed = (ids ?? []).Select(one => Guid.TryParse(one, out var g) ? g : (Guid?)null)
            .Where(g => g is not null).Select(g => Ids.ToText(g!.Value)).Distinct().Take(10).ToList();
        return parsed.Count == 0 ? null : string.Join(",", parsed);
    }

    private static byte[]? Optional(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        try { return Base64Url.Decode(text); }
        catch (FormatException) { return null; }
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
