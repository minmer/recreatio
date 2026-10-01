using Api;

/// <summary>0063 — was an einer Seite liegen darf, und wie es hinausgeht.</summary>
internal static class PageFileChecks
{
    public static void Run(Action<bool, string> check)
    {
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

        var id = Guid.Parse("01a0f4c1-bab6-7be5-bdfc-6f198a63ecea");
        var said = PageImage.Disposition("Regulamin \"2026\"; ż.pdf", id);
        check(said.StartsWith("attachment; ", StringComparison.Ordinal), "files go out as downloads");
        check(said.Contains("filename=\"Regulamin _2026__ _.pdf\"", StringComparison.Ordinal), "ascii name without quotes or semicolons");
        check(said.Contains("filename*=UTF-8''Regulamin%20%222026%22%3B%20%C5%BC.pdf", StringComparison.Ordinal), "utf-8 name escaped");
        check(PageImage.Disposition(null, id).Contains("plik-01a0f4c1bab67be5bdfc6f198a63ecea", StringComparison.Ordinal), "nameless file gets its id");
    }
}
