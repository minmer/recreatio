using Api;

/// <summary>0063 — was an einer Seite liegen darf, und wie es hinausgeht.</summary>
internal static class PageFileChecks
{
    public static void Run(Action<bool, string> check)
    {
        /* 2026-10-20 — das Menü sucht von der Seite nach oben, bis zur Hauptseite: auch die Hauptseite selbst findet ihr eigenes. */
        check(Menu.Upwards("").SequenceEqual([""]), "the main page looks at itself");
        check(Menu.Upwards("parish/grzegorzki").SequenceEqual(["parish/grzegorzki", "parish", ""]), "a page looks up to the main page");

        /* 2026-10-21 — ein Logo statt des Namens: ein Bild der Seite, https oder ein eigener Pfad; sonst nichts. */
        check(Menu.ImageShape("page-image:01a15629-8c30-764d-88ad-8cfee5e4f6d9"), "menu image: a page image");
        check(Menu.ImageShape("https://recreatio.pl/logo.svg") && Menu.ImageShape("/Hortus.jpg"), "menu image: https and own paths");
        check(!Menu.ImageShape("page-image:nope") && !Menu.ImageShape("http://x.pl/a.png") && !Menu.ImageShape("//x.pl/a.png"), "menu image: no broken ids, no http, no foreign protocol-relative");
        check(!Menu.ImageShape("javascript:alert(1)") && !Menu.ImageShape("/a.png\" onerror=\"x") && !Menu.ImageShape("/a b.png"), "menu image: no scripts, quotes or spaces");
        var web = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web);
        check(!System.Text.Json.JsonSerializer.Serialize(new Menu.Clean("Start", "abs", "", []), web).Contains("image"), "menu item without an image stays as before");
        check(System.Text.Json.JsonSerializer.Serialize(new Menu.Clean("Start", "abs", "", [], "/logo.svg"), web).Contains("\"image\":\"/logo.svg\""), "menu item with an image keeps it");

        check(PageImage.Allowed("application/pdf"), "pdf allowed");
        check(PageImage.Allowed("application/gpx+xml"), "gpx allowed");
        check(!PageImage.Allowed("text/html"), "html refused");
        check(!PageImage.Allowed("image/svg+xml"), "svg refused");
        check(PageImage.MaxBytesOf("image/png") == 8 * 1024 * 1024, "images keep 8 MB");
        check(PageImage.MaxBytesOf("application/pdf") == 25 * 1024 * 1024, "documents get 25 MB");

        check(PageImage.Looks("application/pdf", "%PDF-1.7\n"u8), "pdf by its head");
        check(!PageImage.Looks("application/pdf", "<html>"u8), "html posing as pdf refused");
        check(PageImage.Looks("application/vnd.oasis.opendocument.text", new byte[] { 0x50, 0x4B, 3, 4, 20, 0 }), "odt is a zip");
        check(!PageImage.Looks("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "%PDF-"u8), "pdf posing as docx refused");
        check(PageImage.Looks("application/gpx+xml", "﻿<?xml version=\"1.0\"?>\n<gpx version=\"1.1\">"u8), "gpx with bom and declaration");
        check(PageImage.Looks("application/gpx+xml", "<gpx creator=\"x\">"u8), "bare gpx");
        check(!PageImage.Looks("application/gpx+xml", "<?xml version=\"1.0\"?><html xmlns=\"http://www.w3.org/1999/xhtml\">"u8), "xhtml posing as gpx refused");

        /* 2026-10-19 — Filme und Klänge einer Präsentation: erlaubt, 30 MB, am Kopf erkannt, im Element (kein Download). */
        check(PageImage.Allowed("video/mp4") && PageImage.Allowed("video/webm") && PageImage.Allowed("audio/mpeg"), "video and audio allowed");
        check(!PageImage.Allowed("video/quicktime"), "quicktime refused");
        check(PageImage.MaxBytesOf("video/mp4") == 30 * 1024 * 1024, "media get 30 MB");
        check(PageImage.IsMedia("audio/ogg") && !PageImage.IsMedia("application/pdf"), "media are known");
        check(PageImage.Looks("video/mp4", new byte[] { 0, 0, 0, 0x20, (byte)'f', (byte)'t', (byte)'y', (byte)'p', (byte)'i', (byte)'s', (byte)'o', (byte)'m' }), "mp4 by its ftyp box");
        check(!PageImage.Looks("video/mp4", "%PDF-1.7\n"u8), "pdf posing as mp4 refused");
        check(PageImage.Looks("video/webm", new byte[] { 0x1A, 0x45, 0xDF, 0xA3, 0x9F }), "webm by its EBML head");
        check(PageImage.Looks("audio/mpeg", "ID3\u0004\u0000"u8) && PageImage.Looks("audio/mpeg", new byte[] { 0xFF, 0xFB, 0x90 }), "mp3 with a tag or a frame");
        check(PageImage.Looks("audio/ogg", "OggS\u0000"u8) && !PageImage.Looks("audio/ogg", "<html>"u8), "ogg by its head");
        check(PageImage.Looks("audio/wav", "RIFF$\u0000\u0000\u0000WAVEfmt "u8) && !PageImage.Looks("audio/wav", "RIFF$\u0000\u0000\u0000WEBPVP8 "u8), "wav, not webp");

        var id = Guid.Parse("01a0f4c1-bab6-7be5-bdfc-6f198a63ecea");
        var said = PageImage.Disposition("Regulamin \"2026\"; ż.pdf", id);
        check(said.StartsWith("attachment; ", StringComparison.Ordinal), "files go out as downloads");
        check(said.Contains("filename=\"Regulamin _2026__ _.pdf\"", StringComparison.Ordinal), "ascii name without quotes or semicolons");
        check(said.Contains("filename*=UTF-8''Regulamin%20%222026%22%3B%20%C5%BC.pdf", StringComparison.Ordinal), "utf-8 name escaped");
        check(PageImage.Disposition(null, id).Contains("plik-01a0f4c1bab67be5bdfc6f198a63ecea", StringComparison.Ordinal), "nameless file gets its id");
    }
}
