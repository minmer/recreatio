using System.Text;

namespace Kernel;

/// <summary>
/// 3.13 — Feldnamen stammen aus einer festen Aufzaehlung, nicht aus einer frei
/// uebergebenen Zeichenkette. Ein Tippfehler darf nicht zu einem stillschweigend
/// anderen Etikett fuehren: der Geheimtext liesse sich dann nicht mehr oeffnen,
/// und zwar erst Monate spaeter und ohne erkennbare Ursache.
///
/// Ein neues verschluesseltes Feld verlangt einen neuen Eintrag hier. Das ist
/// Absicht — es zwingt zu der Frage, welcher Klasse nach 12.9 das Feld angehoert.
/// </summary>
public enum Field
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
    /// <summary>
    /// Der zusammengesetzte Name — nur noch fuer Kandidaten, die jemand von
    /// innen eingetragen hat. Selbstanmeldungen fuellen
    /// <see cref="CandidateGiven"/> und <see cref="CandidateSurname"/>.
    /// </summary>
    CandidateName,

    /*
     * Vorname, Nachname und Adresse je fuer sich.
     *
     * Vorher trug ein Feld beide Namen und ein anderes Telefon UND Adresse.
     * Zwei Angaben unter einem Etikett sind EINE Angabe: die Trennung waere
     * danach Auslegungssache dessen, der sie liest, und eine Liste nach
     * Nachnamen gaebe es nicht.
     */
    CandidateGiven,
    CandidateSurname,
    CandidateAddress,
    CandidateBorn,
    CandidateContact,
    CandidateSchool,
    CandidateBaptism,
    CandidateNote,

    // Die Person
    //
    // Der Steckbrief eines Menschen. JEDES Feld ein eigenes Etikett — und das
    // ist hier nicht Formsache, sondern der ganze Zweck: Vorname, Nachname,
    // Telefon und Geburtstag sind EINZELN verschluesselt und EINZELN
    // freigebbar. Wer eine Telefonnummer bekommen soll, bekommt genau die und
    // nicht den Geburtstag dazu.
    //
    // Trugen zwei davon dasselbe Etikett, fiele genau das zusammen: der
    // Geheimtext des einen ginge am Platz des anderen auf, und eine Freigabe
    // waere nicht mehr die Freigabe EINER Angabe.
    //
    // Klasse durchgehend personal (12.9) — also protokollpflichtig. Ein
    // Geburtsdatum ist keine besondere Kategorie nach Art. 9, aber es ist auch
    // nichts, dessen Abruf spurlos bleiben darf.
    PersonGivenName,
    PersonSurname,
    PersonPhone,
    PersonBorn,

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

    /// <summary>Wer eine Messintention gegeben hat — und was (rc_0020).</summary>
    MassIntentionGiver,
    MassIntentionOffering,

    /// <summary>
    /// Wer besucht wird und wo (rc_0023).
    ///
    /// Dass jemand zu Hause besucht wird, heisst: er kommt nicht heraus. Das
    /// ist eine Auskunft ueber Gesundheit und darueber, dass unter dieser
    /// Anschrift jemand Wehrloses wohnt — beides gehoert versiegelt.
    /// </summary>
    SickPersonName,
    SickPersonAddress,
    SickPersonPhone,
    SickPersonNote,
    SickVisitNote,
    EnquiryContact,
    EnquiryGroupKind,
    EnquiryNote,

    /// <summary>Der verpackte Sitzungsschluessel einer Anfrage von aussen.</summary>
    EnquiryIntakeKey,

    /// <summary>
    /// Was eine Pfarrgruppe INTERN ueber sich aufschreibt (rc_0035).
    ///
    /// Ein eigenes Etikett und nicht etwa <see cref="AreaTitle"/>, obwohl beide
    /// am selben Bereich haengen und unter demselben Epochenschluessel liegen.
    /// Trugen sie dasselbe, liesse sich der Geheimtext der Notiz an den Platz
    /// des Bereichstitels schieben — die Huelle ginge auf, und in der Liste der
    /// Bereiche stuende ploetzlich, wer den Sakristeischluessel hat. Genau
    /// diesen Tausch schliesst 3.13 aus, und er kostet nur eine Zeile.
    /// </summary>
    ParishGroupNote
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
public readonly record struct Aad
{
    public string Module { get; }
    public string ObjectType { get; }
    public Guid ObjectId { get; }
    public Field Field { get; }
    public int Version { get; }

    private Aad(string module, string objectType, Guid objectId, Field field, int version)
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
    public static Aad Create(string module, string objectType, Guid objectId, Field field, int version)
    {
        if (string.IsNullOrWhiteSpace(module)) throw new ArgumentException("Modul fehlt.", nameof(module));
        if (string.IsNullOrWhiteSpace(objectType)) throw new ArgumentException("Objekttyp fehlt.", nameof(objectType));
        if (objectId == Guid.Empty) throw new ArgumentException("Objekt-ID fehlt.", nameof(objectId));
        if (version < 1) throw new ArgumentOutOfRangeException(nameof(version), "Version beginnt bei 1.");
        if (!Enum.IsDefined(field)) throw new ArgumentOutOfRangeException(nameof(field));

        if (module.Contains(':') || objectType.Contains(':'))
            throw new ArgumentException("Doppelpunkt ist das Trennzeichen und darf in den Teilen nicht vorkommen.");

        return new Aad(module, objectType, objectId, field, version);
    }

    /// <summary>
    /// 3.13: Die Version steigt NUR bei inhaltlicher Aenderung des Feldes. Sie
    /// ist ausdruecklich kein Formatkennzeichen — dafuer gibt es den Klartext-Kopf
    /// (Anhang C, 21.3).
    /// </summary>
    public Aad NextVersion() => new(Module, ObjectType, ObjectId, Field, Version + 1);

    public string Text => $"{Module}:{ObjectType}:{Ids.ToText(ObjectId)}:{FieldName(Field)}:{Version}";

    public byte[] ToUtf8() => Encoding.UTF8.GetBytes(Text);

    public override string ToString() => Text;

    /// <summary>Die Zeichenkette in der AAD. Aenderung hier bricht alle bestehenden Huellen.</summary>
    public static string FieldName(Field f) => f switch
    {
        Field.AccountMasterKey        => "masterkey",
        Field.DataItemKey             => "item_key",
        Field.RoleSignPrivate         => "sign_private",
        Field.RoleWrapPrivate         => "wrap_private",
        Field.RoleDisplayName         => "display_name",
        Field.InvitationRoleKey       => "invite_key",
        Field.AreaTitle               => "title",
        Field.AreaEpochKey            => "epoch_key",
        Field.MessageBody             => "body",
        Field.TopicTitle              => "title",
        Field.DecisionBody            => "body",
        Field.PollQuestion            => "question",
        Field.PollChoice              => "choice",
        Field.DraftBody               => "draft",
        Field.AttachmentFileName      => "file_name",
        Field.AttachmentContent       => "content",
        Field.ParticipantCardData     => "card_data",
        Field.ParticipantCardConsents => "card_consents",
        Field.ParticipantCardClause   => "card_clause",
        Field.EventTitle              => "event_title_sealed",
        Field.EventEpochKey           => "event_epoch_key",
        Field.EventPageTitle          => "page_title",
        Field.EventPartMenu           => "part_menu",
        Field.EventPartTitle          => "part_title",
        Field.EventPartIntro          => "part_intro",
        Field.EventPartConfig         => "part_config",
        Field.EventPartLayers         => "part_layers",
        Field.EventFieldLabel         => "field_label",
        Field.EventFieldHelp          => "field_help",
        Field.EventFieldOptions       => "field_options",
        Field.EventAnswer             => "answer",
        Field.EventIntakeKey          => "intake_key",
        Field.GraphNodeValue          => "node_value",
        Field.GraphEdgeNote           => "edge_note",
        Field.CandidateName           => "candidate_name",
        Field.CandidateGiven          => "candidate_given",
        Field.CandidateSurname        => "candidate_surname",
        Field.CandidateAddress        => "candidate_address",
        Field.CandidateBorn           => "candidate_born",
        Field.CandidateContact        => "candidate_contact",
        Field.CandidateSchool         => "candidate_school",
        Field.CandidateBaptism        => "candidate_baptism",
        Field.CandidateNote           => "candidate_note",
        Field.IntentionInternal       => "internal_text",
        Field.IntentionDonorRef       => "donor_ref",
        Field.OfferingAmount          => "amount_sealed",
        Field.OfferingDonorRef        => "offering_donor",
        Field.CalendarEventTitle      => "event_title",
        Field.CalendarEventLocation   => "event_location",
        Field.CalendarEventDescription=> "event_description",
        Field.CalendarItemNotes       => "item_notes",
        Field.ParishDonorName         => "donor_name",
        Field.ParishDonationAmount    => "amount",
        Field.ContactPhone            => "phone",

        Field.PersonGivenName         => "given_name",
        Field.PersonSurname           => "surname",
        Field.PersonPhone             => "person_phone",
        Field.PersonBorn              => "born",
        Field.EnquiryGroupName        => "enquiry_group_name",
        Field.EnquiryContactPerson    => "enquiry_contact_person",
        Field.MassIntentionGiver      => "mass_intention_giver",
        Field.MassIntentionOffering   => "mass_intention_offering",
        Field.SickPersonName          => "sick_person_name",
        Field.SickPersonAddress       => "sick_person_address",
        Field.SickPersonPhone         => "sick_person_phone",
        Field.SickPersonNote          => "sick_person_note",
        Field.SickVisitNote           => "sick_visit_note",
        Field.EnquiryContact          => "enquiry_contact",
        Field.EnquiryGroupKind        => "enquiry_group_kind",
        Field.EnquiryNote             => "enquiry_note",
        Field.EnquiryIntakeKey        => "enquiry_intake_key",
        Field.ParishGroupNote         => "parish_group_note",
        _ => throw new ArgumentOutOfRangeException(nameof(f))
    };
}
