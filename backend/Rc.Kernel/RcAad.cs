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

    // Module
    CalendarEventTitle,
    CalendarEventLocation,
    CalendarEventDescription,
    ParishDonorName,
    ParishDonationAmount,
    ContactPhone
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
        RcField.CalendarEventTitle      => "event_title",
        RcField.CalendarEventLocation   => "event_location",
        RcField.CalendarEventDescription=> "event_description",
        RcField.ParishDonorName         => "donor_name",
        RcField.ParishDonationAmount    => "amount",
        RcField.ContactPhone            => "phone",
        _ => throw new ArgumentOutOfRangeException(nameof(f))
    };
}
