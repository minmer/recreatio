using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Api;

/// <summary>
/// DER KATALOG ZUR ISBN — wer ein Buch einscannt, das noch nicht in der
/// Bibliothek steht, bekommt Titel, Autoren, Übersetzer, Verlag, Jahr,
/// Seitenzahl, Höhe, Einband und Reihe vorgeschlagen.
///
/// <para>
/// <b>Nur ein Bote.</b> Die Biblioteka Narodowa (Katalog der Bibliotheken
/// im Netz, MARC), e-ISBN (die Meldungen der Verlage, ONIX) und Open Library
/// sagen dem Browser selbst nichts — die ersten beiden schicken keine
/// CORS-Kopfzeilen. Der Dienst fragt alle drei und reicht die Antworten fast
/// roh weiter; gelesen und auf die Felder eines Werks gelegt wird im Browser
/// (<c>libraryCatalog.ts</c>), wie alles in der Bibliothek.
/// </para>
///
/// <para>
/// <b>Ohne Konto.</b> Der Browser fragt ohne Sitzung (<c>credentials:
/// 'omit'</c>): welches Buch jemand einscannt, hängt hier an keinem Konto.
/// Eine Bremse je Adresse hält den Boten davon ab, für jemanden die Kataloge
/// zu fluten; was schon gefragt war, kommt eine Stunde lang aus dem Speicher.
/// </para>
/// </summary>
public static class LibraryCatalog
{
    private static readonly HttpClient Http = MakeClient();

    private const int PerMinute = 30;
    private const int MaxRecords = 8;
    private const int MaxOnix = 256 * 1024;
    private const int MaxCached = 500;
    private static readonly TimeSpan Keep = TimeSpan.FromHours(1);

    private static readonly ConcurrentDictionary<string, (DateTime Window, int Count)> Asked = new();
    private static readonly ConcurrentDictionary<string, (DateTime At, string Json)> Cache = new();

    /// <summary>MARC-Felder, die nur sagen, WO ein Exemplar steht oder wer katalogisiert hat — sie gehen nicht mit.</summary>
    private static readonly HashSet<string> Holdings = ["001", "005", "009", "035", "040", "852", "856", "920", "996"];

    public static void Map(WebApplication app)
    {
        app.MapGet("/library/catalog/{isbn}", LookupAsync);
    }

    private static HttpClient MakeClient()
    {
        var client = new HttpClient(new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(10),
            AutomaticDecompression = DecompressionMethods.All
        })
        {
            Timeout = TimeSpan.FromSeconds(12)
        };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("recreatio.pl/1.0 (+https://recreatio.pl)");
        return client;
    }

    /* -- ISBN ---------------------------------------------------------------------------- */

    /// <summary>
    /// Die ISBN als 13 Ziffern — aus „978-83-63110-45-1", „83-7006-123-X" oder
    /// dem Strichcode. <c>null</c>, wenn die Prüfziffer nicht stimmt: ein
    /// verlesener Code soll nicht ein fremdes Buch finden.
    /// </summary>
    public static string? Isbn13(string? text)
    {
        var raw = new string((text ?? "").Where(c => char.IsDigit(c) || c is 'x' or 'X').ToArray()).ToUpperInvariant();
        if (raw.Length == 10)
        {
            var sum = 0;
            for (var i = 0; i < 10; i++)
            {
                var c = raw[i];
                if (c == 'X' && i != 9) return null;
                sum += (c == 'X' ? 10 : c - '0') * (10 - i);
            }
            if (sum % 11 != 0) return null;
            var body = "978" + raw[..9];
            return body + Check13(body);
        }
        if (raw.Length != 13 || raw.Contains('X') || !(raw.StartsWith("978") || raw.StartsWith("979"))) return null;
        return Check13(raw[..12]) == raw[12] ? raw : null;
    }

    private static char Check13(string twelve)
    {
        var sum = 0;
        for (var i = 0; i < 12; i++) sum += (twelve[i] - '0') * (i % 2 == 0 ? 1 : 3);
        return (char)('0' + (10 - sum % 10) % 10);
    }

    /// <summary>Die alte, zehnstellige Form — ältere Datensätze kennen nur sie.</summary>
    public static string? Isbn10(string isbn13)
    {
        if (!isbn13.StartsWith("978")) return null;
        var body = isbn13[3..12];
        var sum = 0;
        for (var i = 0; i < 9; i++) sum += (body[i] - '0') * (10 - i);
        var check = (11 - sum % 11) % 11;
        return body + (check == 10 ? "X" : check.ToString());
    }

    /* -- Fragen --------------------------------------------------------------------------- */

    private static async Task LookupAsync(HttpContext ctx, string isbn)
    {
        var code = Isbn13(isbn);
        if (code is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest poprawny numer ISBN (nie zgadza się cyfra kontrolna).");
            return;
        }

        var now = DateTime.UtcNow;
        if (Cache.TryGetValue(code, out var cached) && now - cached.At < Keep)
        {
            await Send(ctx, cached.Json);
            return;
        }

        var who = ctx.Connection.RemoteIpAddress?.ToString() ?? "?";
        var count = Asked.AddOrUpdate(who, (now, 1), (_, was) => now - was.Window > TimeSpan.FromMinutes(1) ? (now, 1) : (was.Window, was.Count + 1));
        if (count.Count > PerMinute)
        {
            await Fail(ctx, StatusCodes.Status429TooManyRequests, "Za dużo zapytań do katalogów naraz — spróbuj za minutę.");
            return;
        }
        if (Asked.Count > 10_000) foreach (var old in Asked.Where(p => now - p.Value.Window > TimeSpan.FromMinutes(2)).ToList()) Asked.TryRemove(old.Key, out _);

        var ct = ctx.RequestAborted;
        var bn = AskBnAsync(code, ct);
        var onix = AskEisbnAsync(code, ct);
        var open = AskOpenLibraryAsync(code, ct);
        await Task.WhenAll(bn, onix, open);

        var sources = new JsonArray();
        var reached = 0;
        if (bn.Result.Reached) reached++;
        if (onix.Result.Reached) reached++;
        if (open.Result.Reached) reached++;
        if (bn.Result.Value is JsonArray records && records.Count > 0) sources.Add(new JsonObject { ["source"] = "bn", ["records"] = records });
        if (onix.Result.Value is JsonValue xml) sources.Add(new JsonObject { ["source"] = "e-isbn", ["onix"] = xml });
        if (open.Result.Value is JsonObject book) sources.Add(new JsonObject { ["source"] = "openlibrary", ["book"] = book });

        if (reached == 0)
        {
            await Fail(ctx, StatusCodes.Status502BadGateway, "Katalogi nie odpowiadają — spróbuj później albo uzupełnij dane ręcznie.");
            return;
        }

        var json = new JsonObject { ["isbn"] = code, ["sources"] = sources }.ToJsonString();
        if (Cache.Count >= MaxCached) foreach (var old in Cache.OrderBy(p => p.Value.At).Take(MaxCached / 4).ToList()) Cache.TryRemove(old.Key, out _);
        Cache[code] = (now, json);
        await Send(ctx, json);
    }

    private readonly record struct Answer(bool Reached, JsonNode? Value);

    /// <summary>Biblioteka Narodowa, Katalog Biblioteki Narodowej i bibliotek w sieci: MARC 21 als JSON.</summary>
    private static async Task<Answer> AskBnAsync(string code, CancellationToken ct)
    {
        var tries = new List<string> { code };
        if (Isbn10(code) is { } ten) tries.Add(ten);
        var reached = false;
        foreach (var one in tries)
        {
            try
            {
                using var response = await Http.GetAsync($"https://data.bn.org.pl/api/networks/bibs.json?isbnIssn={one}&limit={MaxRecords}", ct);
                if (!response.IsSuccessStatusCode) continue;
                reached = true;
                var root = JsonNode.Parse(await response.Content.ReadAsStringAsync(ct));
                if (root?["bibs"] is not JsonArray bibs || bibs.Count == 0) continue;
                var records = new JsonArray();
                foreach (var bib in bibs.Take(MaxRecords))
                {
                    if (bib?["marc"]?["fields"] is not JsonArray fields || bib["deleted"]?.GetValue<bool>() == true) continue;
                    var kept = new JsonArray();
                    foreach (var field in fields)
                    {
                        if (field is not JsonObject entry || entry.Count != 1) continue;
                        var tag = entry.First().Key;
                        if (Holdings.Contains(tag)) continue;
                        kept.Add(field.DeepClone());
                    }
                    records.Add(new JsonObject { ["id"] = bib["id"]?.DeepClone(), ["fields"] = kept });
                }
                if (records.Count > 0) return new Answer(true, records);
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException or InvalidOperationException)
            {
            }
        }
        return new Answer(reached, null);
    }

    /// <summary>e-ISBN: was die Verlage selbst gemeldet haben — auch Bücher, die noch kein Katalog beschrieben hat.</summary>
    private static async Task<Answer> AskEisbnAsync(string code, CancellationToken ct)
    {
        try
        {
            using var response = await Http.GetAsync($"https://e-isbn.pl/IsbnWeb/api.xml?isbn={code}", ct);
            if (!response.IsSuccessStatusCode) return new Answer(false, null);
            var xml = await response.Content.ReadAsStringAsync(ct);
            return new Answer(true, xml.Contains("<Product") && xml.Length <= MaxOnix ? JsonValue.Create(xml) : null);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            return new Answer(false, null);
        }
    }

    /// <summary>Open Library — für Bücher aus dem Ausland.</summary>
    private static async Task<Answer> AskOpenLibraryAsync(string code, CancellationToken ct)
    {
        try
        {
            using var response = await Http.GetAsync($"https://openlibrary.org/api/books?bibkeys=ISBN:{code}&format=json&jscmd=data", ct);
            if (!response.IsSuccessStatusCode) return new Answer(false, null);
            var root = JsonNode.Parse(await response.Content.ReadAsStringAsync(ct)) as JsonObject;
            return new Answer(true, root?[$"ISBN:{code}"] is JsonObject book ? book.DeepClone() : null);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException)
        {
            return new Answer(false, null);
        }
    }

    private static Task Send(HttpContext ctx, string json)
    {
        ctx.Response.ContentType = "application/json; charset=utf-8";
        ctx.Response.Headers.CacheControl = "public, max-age=3600";
        return ctx.Response.WriteAsync(json);
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
