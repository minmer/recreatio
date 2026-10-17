using Api;

/// <summary>0114 — was das Telefon annimmt: Kennungen, Kontakte, Stapel des Archivs.</summary>
internal static class PhoneChecks
{
    public static void Run(Action<bool, string> check)
    {
        check(Phone.IdOf("01a0f4c1-bab6-7be5-bdfc-6f198a63ecea", out var id) && id != Guid.Empty, "an id in its text form is read");
        check(!Phone.IdOf("01A0F4C1-BAB6-7BE5-BDFC-6F198A63ECEA", out _) && !Phone.IdOf("x", out _) && !Phone.IdOf(null, out _), "anything else is no id");

        var small = Kernel.Base64Url.Encode(new byte[48]);
        check(Phone.SealedContact(small, out var bytes) && bytes.Length == 48, "a sealed contact of 48 bytes passes");
        check(!Phone.SealedContact(Kernel.Base64Url.Encode(new byte[47]), out _), "shorter than a sealed envelope is refused");
        check(!Phone.SealedContact(Kernel.Base64Url.Encode(new byte[256 * 1024 + 1]), out _), "a contact at most 256 KB");
        check(!Phone.SealedContact("not base64!", out _), "unreadable is refused");

        check(Phone.SinceOf(null, out var all) && all is null, "no `since`: everything");
        check(Phone.SinceOf("2026-10-17T10:00:00Z", out var from) && from == DateTimeOffset.Parse("2026-10-17T09:59:58Z"), "since: two seconds earlier");
        check(!Phone.SinceOf("yesterday", out _), "an unreadable `since` is refused");

        check(Phone.BatchProblem(3, 100, 48) is null, "three messages, three prints of 16 bytes");
        check(Phone.BatchProblem(3, 100, 47) is not null, "prints must match the count");
        check(Phone.BatchProblem(0, 100, 0) is not null && Phone.BatchProblem(5001, 100, 16 * 5001) is not null, "1 to 5000 messages in a batch");
        check(Phone.BatchProblem(1, 4 * 1024 * 1024 + 1, 16) is not null && Phone.BatchProblem(1, 10, 16) is not null, "a sealed batch between 48 bytes and 4 MB");

        check(Phone.SummaryOf(null, out var none) && none is null && Phone.SummaryOf("", out _), "0115: a batch without a summary is fine");
        check(Phone.SummaryOf(Kernel.Base64Url.Encode(new byte[300]), out var summary) && summary!.Length == 300, "a sealed summary is kept");
        check(!Phone.SummaryOf(Kernel.Base64Url.Encode(new byte[8001]), out _) && !Phone.SummaryOf(Kernel.Base64Url.Encode(new byte[47]), out _)
            && !Phone.SummaryOf("not base64!", out _), "a summary between 48 bytes and 8000, readable");
    }
}
