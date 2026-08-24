using System.Collections.Concurrent;

namespace Rc.Api;

/// <summary>
/// Zwei verschiedene Schutzbeduerfnisse, die gern verwechselt werden.
///
/// <b>1. Der Speicherriegel.</b> Ein Argon2id-Lauf belegt 64 MiB. Bei zwanzig
/// gleichzeitigen Anmeldeversuchen sind das 1,3 GiB — der Dienst faellt um,
/// ohne dass ein einziges Passwort erraten wurde. Der Schutz vor Raten ist hier
/// zugleich ein Hebel zum Umwerfen. Deshalb laufen nie mehr als
/// <see cref="MaxConcurrent"/> Laeufe gleichzeitig; alles weitere wartet.
///
/// <b>2. Die Ratensperre.</b> Sie zaehlt Fehlversuche je Benutzername UND je
/// Absender. Nur je Name waere zu wenig: ein Angreifer probiert dann ein
/// Passwort gegen tausend Namen. Nur je Absender waere ebenfalls zu wenig: ein
/// Botnetz hat tausend Absender.
///
/// Im Speicher, nicht in der Datenbank: 11.11 setzt genau einen
/// Anwendungsprozess je Instanz voraus. Wird das aufgegeben, muss diese Klasse
/// mitwandern — deshalb steht es hier und nicht nur in Kapitel 16.
/// </summary>
public sealed class RcLoginGuard(int maxConcurrent = 4, int maxFailures = 10, TimeSpan? window = null)
{
    public int MaxConcurrent { get; } = maxConcurrent;

    private readonly SemaphoreSlim _gate = new(maxConcurrent, maxConcurrent);
    private readonly TimeSpan _window = window ?? TimeSpan.FromMinutes(15);
    private readonly ConcurrentDictionary<string, Attempts> _failures = new(StringComparer.OrdinalIgnoreCase);

    private sealed record Attempts(int Count, DateTimeOffset FirstUtc, DateTimeOffset LastUtc);

    /// <summary>
    /// Wartet, bis ein Platz frei ist, statt abzuweisen. Eine Anmeldung, die
    /// zwei Sekunden braucht, ist unangenehm; eine, die mit 503 antwortet, weil
    /// gerade jemand anders sich anmeldet, ist kaputt.
    /// </summary>
    public async Task<IDisposable> EnterAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        return new Release(_gate);
    }

    public bool IsBlocked(string key, DateTimeOffset now)
    {
        if (!_failures.TryGetValue(key, out var a)) return false;
        if (now - a.FirstUtc > _window)
        {
            _failures.TryRemove(key, out _);
            return false;
        }
        return a.Count >= maxFailures;
    }

    public bool IsBlocked(string username, string? remoteAddress, DateTimeOffset now) =>
        IsBlocked($"u:{username}", now)
        || (remoteAddress is not null && IsBlocked($"a:{remoteAddress}", now));

    public void RecordFailure(string username, string? remoteAddress, DateTimeOffset now)
    {
        Bump($"u:{username}", now);
        if (remoteAddress is not null) Bump($"a:{remoteAddress}", now);
    }

    /// <summary>
    /// Nach einer gelungenen Anmeldung faellt nur der Zaehler des Namens. Der
    /// des Absenders bleibt stehen: sonst waescht ein Angreifer, der EIN gutes
    /// Konto besitzt, mit jeder eigenen Anmeldung seine Fehlversuche gegen alle
    /// anderen weg.
    /// </summary>
    public void RecordSuccess(string username) => _failures.TryRemove($"u:{username}", out _);

    private void Bump(string key, DateTimeOffset now) =>
        _failures.AddOrUpdate(key,
            _ => new Attempts(1, now, now),
            (_, a) => now - a.FirstUtc > _window
                ? new Attempts(1, now, now)
                : a with { Count = a.Count + 1, LastUtc = now });

    /// <summary>Damit die Tabelle nicht auf Dauer waechst.</summary>
    public int EvictExpired(DateTimeOffset now)
    {
        var stale = _failures.Where(kv => now - kv.Value.FirstUtc > _window).Select(kv => kv.Key).ToList();
        foreach (var key in stale) _failures.TryRemove(key, out _);
        return stale.Count;
    }

    private sealed class Release(SemaphoreSlim gate) : IDisposable
    {
        private int _done;
        public void Dispose()
        {
            if (Interlocked.Exchange(ref _done, 1) == 0) gate.Release();
        }
    }
}
