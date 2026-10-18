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

        check(Phone.OutboxSealed(Kernel.Base64Url.Encode(new byte[200]), out var queued) && queued.Length == 200, "0116: a sealed message for the phone");
        check(!Phone.OutboxSealed(Kernel.Base64Url.Encode(new byte[64 * 1024 + 1]), out _) && !Phone.OutboxSealed(null, out _), "at most 64 KB, never empty");
        check(Phone.DeviceName("  Pixel 8\n") == "Pixel 8" && Phone.DeviceName(" ") is null && Phone.DeviceName(new string('x', 120))!.Length == 80,
            "a phone's name: trimmed, without control characters, at most 80");

        check(Phone.ShareDays(null) == 30 && Phone.ShareDays(7) == 7 && Phone.ShareDays(400) == 400
            && Phone.ShareDays(0) is null && Phone.ShareDays(401) is null, "0117: a link holds 1 to 400 days, 30 without a word");
        check(Phone.ShareLabel(Kernel.Base64Url.Encode(new byte[120]), out var label) && label.Length == 120
            && !Phone.ShareLabel(Kernel.Base64Url.Encode(new byte[4001]), out _) && !Phone.ShareLabel("", out _),
            "a sealed label for the sender: 48 bytes to 4000, never empty");

        check(Phone.SealedLamp(Kernel.Base64Url.Encode(new byte[48]), out var lamp) && lamp.Length == 48
            && !Phone.SealedLamp(Kernel.Base64Url.Encode(new byte[47]), out _)
            && !Phone.SealedLamp(Kernel.Base64Url.Encode(new byte[256 * 1024 + 1]), out _)
            && !Phone.SealedLamp(null, out _) && !Phone.SealedLamp("not base64!", out _),
            "0118: a sealed lamp between 48 bytes and 256 KB, readable");
        check(Kernel.Aad.FieldName(Kernel.Field.PhoneLamp) == "phone_lamp", "0118: the lamp label is the browser's");
    }
}
