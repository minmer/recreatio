using System.Text;
using Microsoft.Extensions.Logging;

namespace Api;

/// <summary>Small rotating file sink for server exceptions; configured by Logging:File.</summary>
[ProviderAlias("File")]
public sealed class FileLoggerProvider : ILoggerProvider
{
    private readonly object gate = new();
    private readonly string directory;
    private readonly long maxBytes;
    private readonly int retainedDays;
    private string day = "";
    private int part;
    private bool reportedFailure;

    public FileLoggerProvider(string contentRoot, IConfiguration configuration)
    {
        var configured = configuration["Directory"] ?? "logs";
        directory = Path.GetFullPath(configured, contentRoot);
        maxBytes = Math.Clamp(configuration.GetValue<long?>("MaxFileBytes") ?? 10_485_760, 1024, 104_857_600);
        retainedDays = Math.Clamp(configuration.GetValue<int?>("RetainedDays") ?? 7, 1, 365);
    }

    public ILogger CreateLogger(string categoryName) => new FileLogger(this, categoryName);
    public void Dispose() { }

    private void Write(string category, LogLevel level, EventId eventId, string message, Exception? exception)
    {
        lock (gate)
        {
            try
            {
                Directory.CreateDirectory(directory);
                var now = DateTimeOffset.UtcNow;
                var today = now.ToString("yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture);
                if (day != today)
                {
                    day = today;
                    part = 0;
                    foreach (var old in Directory.EnumerateFiles(directory, "api-*.log"))
                        if (File.GetLastWriteTimeUtc(old) < now.UtcDateTime.AddDays(-retainedDays)) File.Delete(old);
                }
                var entry = $"{now:O} [{level}] {category} ({eventId.Id}) {message}{Environment.NewLine}"
                    + (exception is null ? "" : exception + Environment.NewLine);
                var bytes = Encoding.UTF8.GetBytes(entry);
                string path;
                while (true)
                {
                    path = Path.Combine(directory, $"api-{day}-{Environment.ProcessId}-{part:D3}.log");
                    var info = new FileInfo(path);
                    if (!info.Exists || info.Length == 0 || info.Length + bytes.Length <= maxBytes) break;
                    part++;
                }
                using var stream = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.Read);
                stream.Write(bytes);
                reportedFailure = false;
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
                // Logging failures must not replace the original request error.
                if (!reportedFailure)
                {
                    Console.Error.WriteLine($"Cannot write API log files to '{directory}': {error.Message}");
                    reportedFailure = true;
                }
            }
        }
    }

    private sealed class FileLogger(FileLoggerProvider provider, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (IsEnabled(logLevel)) provider.Write(category, logLevel, eventId, formatter(state, exception), exception);
        }
    }
}
