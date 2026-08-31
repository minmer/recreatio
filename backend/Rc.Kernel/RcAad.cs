using System.Text;

namespace Rc.Kernel;

/// <summary>
/// 3.13 — Feldnamen stammen aus einer festen Aufzaehlung, nicht aus einer frei
/// uebergebenen Zeichenkette. Ein Tippfehler darf nicht zu einem stillschweigend
/// anderen Etikett fuehren: der Geheimtext liesse sich dann nicht mehr oeffnen,
/// und zwar erst Monate spaeter und ohne erkennbare Ursache.
///
/// Ein neues verschluesseltes Feld verlangt einen neuen Eintrag hier. Das ist
/// Absicht — es zwingt zu der Frage, welcher Klasse nach 12.9 das Feld angehoert.
/// </summary>
public enum RcField
{
    // kernel
    AccountMasterKey,

    /// <summary>12.3.2 — Der Schluessel eines einzelnen Datenelements.</summary>
    DataItemKey,
    RoleSignPrivate,
    RoleWrapPrivate,
    RoleDisplayName,

    /// <summary>3.12 — Der Rollenschluessel, der mit einer Einladung reist.</summary>
    InvitationRoleKey,

    // chat
    AreaTitle,
    AreaEpochKey,
    MessageBody,
    TopicTitle,
    DecisionBody,
    PollQuestion,
    PollChoice,
    DraftBody,
    AttachmentFileName,
    AttachmentContent,

    // besondere Kategorien (12.9)
    ParticipantCardData,
    ParticipantCardConsents,
    ParticipantCardClause,

    // Veranstaltungen (14.4)
    //
    // Jeder Eintrag hier zwingt zu der Frage, welcher Klasse nach 12.9 das
    // Feld angehoert. Bei Anmeldungen ist die Antwort unangenehm: der Wert
    // eines Formularfeldes kann alles sein — eine Essgewohnheit, eine
    // Unvertraeglichkeit, eine Konfession. Deshalb traegt jedes Feld seine
    // Klasse in der Zeile, und die Vorgabe ist die strengere.
    EventTitle,
    EventEpochKey,
    EventPageTitle,
    EventPartMenu,
    EventPartTitle,
    EventPartIntro,

    /// <summary>Was nur das Teil-Modul selbst versteht. Im Altbestand Klartext.</summary>
    EventPartConfig,
    EventPartLayers,

    EventFieldLabel,
    EventFieldHelp,
    EventFieldOptions,

    /// <summary>Eine eingesandte Antwort. Besondere Kategorie, bis das Gegenteil gesagt wird.</summary>
    EventAnswer,

    /// <summary>Der private Annahmeschluessel einer Veranstaltung.</summary>
    EventIntakeKey,

    // Cogita — der Wissensgraph
    //
    // Nur ZWEI Felder, obwohl der Graph beliebig viele Arten kennt. Das ist
    // Absicht: die ART eines Knotens ist Struktur und bleibt Klartext, der
    // WERT ist Inhalt und traegt immer dasselbe Etikett. Ein Feldname je
    // benutzerdefinierter Art waere eine Aufzaehlung, die der Benutzer
    // erweitert — und damit keine feste Aufzaehlung mehr.
    GraphNodeValue,
    GraphEdgeNote,

    // Firmung — der empfindlichste Teil der Plattform
    //
    // Kandidaten sind Minderjaehrige. Der Altbestand hatte EINEN
    // verschluesselten Klumpen fuer alles (PayloadEnc); damit laesst sich der
    // Klumpen eines Kindes gegen den eines anderen tauschen, ohne dass etwas
    // auffaellt. Jedes Feld traegt deshalb sein eigenes Etikett.
    CandidateName,
    CandidateBorn,
    CandidateContact,
    CandidateSchool,
    CandidateBaptism,
    CandidateNote,

    // Pfarrei
    //
    // Die Intention ist der Fall, an dem sich die Feldnamen bewaehren: EINE
    // Zeile traegt einen oeffentlichen Text, einen internen und einen Hinweis
    // auf den Stifter. Trugen alle drei dasselbe Etikett, koennte wer
    // Schreibzugriff hat den Stifternamen in das interne Feld schieben —
    // lautlos und ohne Fehlermeldung. Genau dafuer gibt es 3.13.
    IntentionInternal,
    IntentionDonorRef,
    OfferingAmount,
    OfferingDonorRef,

    // Module
    CalendarEventTitle,
    CalendarEventLocation,
    CalendarEventDescription,

    /// <summary>Die Notizen eines Kalendereintrags — das WOMIT, nicht das WANN.</summary>
    CalendarItemNotes,
    ParishDonorName,
    ParishDonationAmount,
    ContactPhone,

    // Belegung — Haus, Zimmer, Pfarrsaal
    //
    // Die ZEIT einer Anfrage bleibt Klartext: sie ist der Grund, warum das
    // Modul ueberhaupt benutzbar ist (freie Zeitraeume finden, ohne alles
    // herunterzuladen). Alles, was eine GRUPPE kenntlich macht, ist es nicht.
    //
    // Je Feld ein eigenes Etikett, aus demselben Grund wie bei der Intention:
    // trugen alle dasselbe, koennte wer schreiben darf die Telefonnummer in
    // das Bemerkungsfeld schieben — lautlos und ohne Fehlermeldung.
    EnquiryGroupName,
    EnquiryContactPerson,
    EnquiryContact,
    EnquiryGroupKind,
    EnquiryNote,

    /// <summary>Der verpackte Sitzungsschluessel einer Anfrage von aussen.</summary>
    EnquiryIntakeKey
}

/// <summary>
/// 3.13 — Jeder Geheimtext klebt an seinem Platz.
///
/// <code>&lt;modul&gt;:&lt;objekttyp&gt;:&lt;objekt-id&gt;:&lt;feldname&gt;:&lt;version&gt;</code>
///
/// Der Feldname ist der Teil, der im Altsystem fehlte: dort trugen alle Felder
/// desselben Datensatzes dasselbe Etikett, und wer Schreibzugriff hatte, konnte
/// den verschluesselten Betrag in das Spenderfeld schieben — lautlos, ohne
/// Fehlermeldung und ohne Protokolleintrag.
/// </summary>
public readonly record struct RcAad
{
    public string Module { get; }
    public string ObjectType { get; }
    public Guid ObjectId { get; }
    public RcField Field { get; }
    public int Version { get; }

    private RcAad(string module, string objectType, Guid objectId, RcField field, int version)
    {
        Module = module;
        ObjectType = objectType;
        ObjectId = objectId;
        Field = field;
        Version = version;
    }

    /// <summary>
    /// Alle fuenf Werte sind Pflicht. Es gibt bewusst KEINE Ueberladung ohne
    /// Feldnamen — genau eine solche bequeme Hilfsfunktion hat den Zustand
    /// erzeugt, den 3.13 abstellt.
    /// </summary>
    public static RcAad Create(string module, string objectType, Guid objectId, RcField field, int version)
    {
        if (string.IsNullOrWhiteSpace(module)) throw new ArgumentException("Modul fehlt.", nameof(module));
        if (string.IsNullOrWhiteSpace(objectType)) throw new ArgumentException("Objekttyp fehlt.", nameof(objectType));
        if (objectId == Guid.Empty) throw new ArgumentException("Objekt-ID fehlt.", nameof(objectId));
        if (version < 1) throw new ArgumentOutOfRangeException(nameof(version), "Version beginnt bei 1.");
        if (!Enum.IsDefined(field)) throw new ArgumentOutOfRangeException(nameof(field));

        if (module.Contains(':') || objectType.Contains(':'))
            throw new ArgumentException("Doppelpunkt ist das Trennzeichen und darf in den Teilen nicht vorkommen.");

        return new RcAad(module, objectType, objectId, field, version);
    }

    /// <summary>
    /// 3.13: Die Version steigt NUR bei inhaltlicher Aenderung des Feldes. Sie
    /// ist ausdruecklich kein Formatkennzeichen — dafuer gibt es den Klartext-Kopf
    /// (Anhang C, 21.3).
    /// </summary>
    public RcAad NextVersion() => new(Module, ObjectType, ObjectId, Field, Version + 1);

    public string Text => $"{Module}:{ObjectType}:{RcId.ToText(ObjectId)}:{FieldName(Field)}:{Version}";

    public byte[] ToUtf8() => Encoding.UTF8.GetBytes(Text);

    public override string ToString() => Text;

    /// <summary>Die Zeichenkette in der AAD. Aenderung hier bricht alle bestehenden Huellen.</summary>
    public static string FieldName(RcField f) => f switch
    {
        RcField.AccountMasterKey        => "masterkey",
        RcField.DataItemKey             => "item_key",
        RcField.RoleSignPrivate         => "sign_private",
        RcField.RoleWrapPrivate         => "wrap_private",
        RcField.RoleDisplayName         => "display_name",
        RcField.InvitationRoleKey       => "invite_key",
        RcField.AreaTitle               => "title",
        RcField.AreaEpochKey            => "epoch_key",
        RcField.MessageBody             => "body",
        RcField.TopicTitle              => "title",
        RcField.DecisionBody            => "body",
        RcField.PollQuestion            => "question",
        RcField.PollChoice              => "choice",
        RcField.DraftBody               => "draft",
        RcField.AttachmentFileName      => "file_name",
        RcField.AttachmentContent       => "content",
        RcField.ParticipantCardData     => "card_data",
        RcField.ParticipantCardConsents => "card_consents",
        RcField.ParticipantCardClause   => "card_clause",
        RcField.EventTitle              => "event_title_sealed",
        RcField.EventEpochKey           => "event_epoch_key",
        RcField.EventPageTitle          => "page_title",
        RcField.EventPartMenu           => "part_menu",
        RcField.EventPartTitle          => "part_title",
        RcField.EventPartIntro          => "part_intro",
        RcField.EventPartConfig         => "part_config",
        RcField.EventPartLayers         => "part_layers",
        RcField.EventFieldLabel         => "field_label",
        RcField.EventFieldHelp          => "field_help",
        RcField.EventFieldOptions       => "field_options",
        RcField.EventAnswer             => "answer",
        RcField.EventIntakeKey          => "intake_key",
        RcField.GraphNodeValue          => "node_value",
        RcField.GraphEdgeNote           => "edge_note",
        RcField.CandidateName           => "candidate_name",
        RcField.CandidateBorn           => "candidate_born",
        RcField.CandidateContact        => "candidate_contact",
        RcField.CandidateSchool         => "candidate_school",
        RcField.CandidateBaptism        => "candidate_baptism",
        RcField.CandidateNote           => "candidate_note",
        RcField.IntentionInternal       => "internal_text",
        RcField.IntentionDonorRef       => "donor_ref",
        RcField.OfferingAmount          => "amount_sealed",
        RcField.OfferingDonorRef        => "offering_donor",
        RcField.CalendarEventTitle      => "event_title",
        RcField.CalendarEventLocation   => "event_location",
        RcField.CalendarEventDescription=> "event_description",
        RcField.CalendarItemNotes       => "item_notes",
        RcField.ParishDonorName         => "donor_name",
        RcField.ParishDonationAmount    => "amount",
        RcField.ContactPhone            => "phone",
        RcField.EnquiryGroupName        => "enquiry_group_name",
        RcField.EnquiryContactPerson    => "enquiry_contact_person",
        RcField.EnquiryContact          => "enquiry_contact",
        RcField.EnquiryGroupKind        => "enquiry_group_kind",
        RcField.EnquiryNote             => "enquiry_note",
        RcField.EnquiryIntakeKey        => "enquiry_intake_key",
        _ => throw new ArgumentOutOfRangeException(nameof(f))
    };
}
