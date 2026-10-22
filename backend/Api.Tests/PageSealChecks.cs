using Api;

/// <summary>0121 — versiegelte Seiten: die Form einer Hülle und die Hüllen des Seitenschlüssels.</summary>
internal static class PageSealChecks
{
    public static void Run(Action<bool, string> check)
    {
        /* Eine Hülle: rcs1.<Fassung>.<base64url>, mindestens Kopf, Nonce, Etikett und ein Byte (66 Zeichen). */
        var body = new string('A', 66);
        check(Page.IsEnvelope($"rcs1.1.{body}"), "seal: the shortest envelope (an empty piece) is one");
        check(Page.IsEnvelope($"rcs1.123456.{body}-_x"), "seal: a long version and base64url letters");
        check(!Page.IsEnvelope($"rcs1.1.{body[..65]}"), "seal: shorter than header, nonce and tag is not");
        check(!Page.IsEnvelope($"rcs1.x.{body}") && !Page.IsEnvelope($"rcs1..{body}") && !Page.IsEnvelope($"rcs1.1234567.{body}"), "seal: the version is 1–6 digits");
        check(!Page.IsEnvelope($"rcs1.1.{body}=") && !Page.IsEnvelope($"rcs1.1.{body} "), "seal: no padding, no spaces");
        check(!Page.IsEnvelope("{\"title\":\"x\"}") && !Page.IsEnvelope(null) && !Page.IsEnvelope(""), "seal: JSON and nothing are not envelopes");

        /* Versiegelt ist länger: auch ungepackt (drei Byte je Zeichen, base64) passt der Titel in seine Spalte. */
        check(Page.SealedLimit(Page.MaxTitle) <= 2000, "seal: a sealed title fits nvarchar(2000)");

        /* Die Hüllen des Seitenschlüssels: gelesen, geprüft, gleich zurückgeschrieben. */
        var area = Guid.Parse("01a15623-0000-7000-8000-00000000aaaa");
        var role = Guid.Parse("01a15623-0000-7000-8000-00000000cccc");
        var key = new string('k', 60);
        var json = $"{{\"v\":3,\"w\":[{{\"a\":\"{area}\",\"e\":7,\"k\":\"{key}\"}},{{\"r\":\"{role}\",\"k\":\"{key}\"}}]}}";
        var seal = Page.ReadSeal(json);
        check(seal is not null && seal.Version == 3 && seal.Wraps.Count == 2, "seal: header read");
        check(seal!.Wraps[0].Area == area && seal.Wraps[0].Epoch == 7 && seal.Wraps[1].Role == role, "seal: an area wrap with its epoch, a role wrap");
        check(Page.ReadSeal(Page.WriteSeal(seal)) is { Version: 3 } again && again.Wraps.SequenceEqual(seal.Wraps), "seal: written as read");

        check(Page.ReadSeal("{\"v\":0,\"w\":[]}") is null, "seal: version 0 refused");
        check(Page.ReadSeal($"{{\"v\":1,\"w\":[]}}") is null, "seal: without any wrap nobody could open it — refused");
        check(Page.ReadSeal($"{{\"v\":1,\"w\":[{{\"a\":\"{area}\",\"k\":\"{key}\"}}]}}") is null, "seal: an area wrap needs its epoch");
        check(Page.ReadSeal($"{{\"v\":1,\"w\":[{{\"a\":\"{area}\",\"e\":1,\"k\":\"short\"}}]}}") is null, "seal: a wrap too short to be one refused");
        check(Page.ReadSeal($"{{\"v\":1,\"w\":[{{\"a\":\"{area}\",\"e\":1,\"k\":\"{key}+/=\"}}]}}") is null, "seal: a wrap must be base64url");
        check(Page.ReadSeal($"{{\"v\":1,\"w\":[{{\"x\":\"{area}\",\"k\":\"{key}\"}}]}}") is null, "seal: a wrap for neither an area nor a role refused");
        check(Page.ReadSeal("not json") is null && Page.ReadSeal(null) is null, "seal: nothing readable, nothing sealed");
    }
}
