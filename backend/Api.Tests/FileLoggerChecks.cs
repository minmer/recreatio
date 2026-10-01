using Api;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

internal static class FileLoggerChecks
{
    public static void Run(Action<bool, string> check)
    {
        var root = Path.Combine(Path.GetTempPath(), "recreatio-log-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Directory"] = "logs", ["MaxFileBytes"] = "1024", ["RetainedDays"] = "7"
            }).Build();
            Directory.CreateDirectory(Path.Combine(root, "logs"));
            var expired = Path.Combine(root, "logs", "api-expired.log");
            File.WriteAllText(expired, "old"); File.SetLastWriteTimeUtc(expired, DateTime.UtcNow.AddDays(-10));
            var unrelated = Path.Combine(root, "logs", "operator-notes.txt"); File.WriteAllText(unrelated, "keep");
            using var provider = new FileLoggerProvider(root, config);
            var logger = provider.CreateLogger("Api.ApiErrorMiddleware");
            logger.LogError(new InvalidOperationException("missing test table"), "Request failed. TraceId: {TraceId}", "trace-test-123");
            var log = File.ReadAllText(Directory.GetFiles(Path.Combine(root, "logs"), "api-*.log").Single());
            check(log.Contains("trace-test-123") && log.Contains("missing test table") && log.Contains("InvalidOperationException"),
                "file logger writes trace ID and exception details");
            check(!File.Exists(expired) && File.Exists(unrelated), "retention removes expired API logs only");
            logger.LogError("{Large}", new string('x', 900));
            check(Directory.GetFiles(Path.Combine(root, "logs"), "api-*.log").Length >= 2, "file logger rotates at configured size");
            Parallel.For(0, 10, i => logger.LogWarning("Concurrent record {Index}", i));
            var all = string.Join("\n", Directory.GetFiles(Path.Combine(root, "logs"), "api-*.log").Select(File.ReadAllText));
            check(Enumerable.Range(0, 10).All(i => all.Contains($"Concurrent record {i}")), "concurrent log entries are preserved");
        }
        finally { Directory.Delete(root, true); }
    }
}
