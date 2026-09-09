using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;

namespace Recreatio.Api.Services.Events;

/// <summary>
/// Where a gallery photograph's bytes live once they are no longer in the row.
///
/// <para>
/// <b>The rule about relative paths, and why it is the same one rc uses.</b> A
/// setting like <c>..\data\event-photos</c> is not, by itself, a location: it
/// depends on what the operating system currently considers the working
/// directory. Under IIS that is not reliably the application folder.
/// </para>
///
/// <para>
/// The unpleasant part is not failure but success in the wrong place:
/// <c>CreateDirectory</c> happily makes the folder somewhere else, writing
/// works, everything looks green — and months later somebody looks for a
/// hundred photographs and finds an empty directory where they should be.
/// Resolution is therefore against <see cref="AppContext.BaseDirectory"/>, the
/// folder the application actually sits in. This mirrors
/// <c>RcFileStore</c> deliberately: two rules for one question is how the two
/// stores end up on different disks.
/// </para>
///
/// <para>
/// <b>These bytes are not sealed.</b> A gallery photograph is served to anyone
/// who can open the slide, so encrypting it at rest would protect nothing that
/// the request does not immediately hand out again. That makes the folder
/// choice load-bearing: it must be outside what the web server serves
/// directly, or the addresses become guessable and the slide's permission
/// check is decoration. <c>..\data\…</c> — beside the published folder, not
/// inside it — is exactly that.
/// </para>
/// </summary>
public static class EventPhotoStore
{
    public const string ConfigKey = "Events:PhotoStorePath";

    /// <summary>
    /// Whether this installation is allowed to MOVE photographs out of the
    /// database. Off unless explicitly switched on.
    /// </summary>
    public const string OffloadKey = "Events:PhotoOffload";

    /// <summary>
    /// May the one-off move run here?
    ///
    /// <para>
    /// <b>Off by default, and this is the important part.</b> The move writes
    /// files to the local disk and then empties the database rows. Point a
    /// development machine at the production database — which is exactly how
    /// one debugs a live problem — sign in as the events administrator, and 61
    /// MB of other people's photographs move onto a laptop and vanish from the
    /// server. Every row would say "on disk", and the disk in question would be
    /// one nobody can reach.
    /// </para>
    ///
    /// <para>
    /// There is no clever way to tell the two situations apart from inside the
    /// process: the connection string is the same, the path is the same, the
    /// administrator is the same person. So it is a decision, made once, where
    /// the application is actually deployed — and the price is that somebody
    /// must set it there on purpose. That is the correct price for an operation
    /// with no undo.
    /// </para>
    ///
    /// <para>
    /// SERVING from disk is not gated: a photograph that has already moved must
    /// be readable everywhere, including locally.
    /// </para>
    /// </summary>
    public static bool OffloadEnabled(IConfiguration config) =>
        string.Equals(config[OffloadKey], "true", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// The default sits beside the published application, like rc's store.
    /// Having one at all matters: without it a missing setting would mean the
    /// move silently does nothing, on a database that is 0.2 MB from full.
    /// </summary>
    public const string DefaultPath = @"..\data\event-photos";

    /// <summary>The root folder, always absolute.</summary>
    public static string Root(IConfiguration config)
    {
        var configured = config[ConfigKey];
        var path = string.IsNullOrWhiteSpace(configured) ? DefaultPath : configured;

        // Resolves "..\" too, turning a setting that depends on the run
        // environment into one that does not.
        return Path.GetFullPath(path, AppContext.BaseDirectory);
    }

    /// <summary>
    /// The path of one photograph, relative to the root.
    ///
    /// <para>
    /// <b>Relative, because absolute would be written into 105 rows.</b> Moving
    /// to another host would then mean rewriting 105 rows, and the first one
    /// missed is a photograph that no longer loads.
    /// </para>
    ///
    /// <para>
    /// <b>Two hex characters of the id as a folder.</b> 256 buckets, so no
    /// directory grows past a few hundred entries. A flat folder with ten
    /// thousand files is not broken, but every listing, backup and file
    /// manager on it becomes slow, and by then splitting it means rewriting
    /// every path again.
    /// </para>
    ///
    /// <para>
    /// The extension is <c>.bin</c> and not <c>.jpg</c> on purpose: the content
    /// type belongs to the row, which is the one place that decides what gets
    /// sent. A folder full of files that a web server might recognise is a
    /// folder somebody eventually points a web server at.
    /// </para>
    /// </summary>
    public static string RelativePathFor(Guid photoId)
    {
        var name = photoId.ToString("N");
        return Path.Combine(name[..2], name + ".bin");
    }

    public static string FullPath(IConfiguration config, string relativePath) =>
        Path.Combine(Root(config), relativePath);

    /// <summary>
    /// Write the bytes, then prove they are there.
    ///
    /// <para>
    /// <b>The order is the whole safety of the move.</b> Written to a temporary
    /// name first, flushed to the disk, read back, hashed, and only then moved
    /// into place. A half-written file that happens to have the right length
    /// would otherwise pass a size check — and the caller would go on to clear
    /// the row.
    /// </para>
    ///
    /// <para>
    /// Returns the SHA-256 of what is now on disk. The caller stores it and
    /// only then clears the column; if anything here throws, nothing was
    /// cleared and the photograph is untouched.
    /// </para>
    /// </summary>
    public static async Task<byte[]> WriteAsync(
        IConfiguration config, Guid photoId, byte[] bytes, CancellationToken ct)
    {
        var relative = RelativePathFor(photoId);
        var full = Path.Combine(Root(config), relative);

        Directory.CreateDirectory(Path.GetDirectoryName(full)!);

        // A temporary name beside the target, not in the system temp folder:
        // File.Move is only atomic within one volume, and the temp folder is
        // very often on another one.
        var scratch = full + ".part";

        await using (var stream = new FileStream(
            scratch, FileMode.Create, FileAccess.Write, FileShare.None, 64 * 1024, useAsync: true))
        {
            await stream.WriteAsync(bytes, ct);

            // Not merely flushed to the operating system: flushed to the
            // device. Without `true` the bytes can still be in a cache that a
            // power cut discards — after the row has already been cleared.
            await stream.FlushAsync(ct);
            stream.Flush(flushToDisk: true);
        }

        var written = await VerifyAsync(scratch, bytes, ct);

        File.Move(scratch, full, overwrite: true);
        return written;
    }

    /// <summary>
    /// Read it back and compare — the step that makes clearing the row safe.
    /// </summary>
    private static async Task<byte[]> VerifyAsync(string path, byte[] expected, CancellationToken ct)
    {
        await using var stream = new FileStream(
            path, FileMode.Open, FileAccess.Read, FileShare.None, 64 * 1024, useAsync: true);

        if (stream.Length != expected.Length)
        {
            throw new IOException(
                $"Nach dem Schreiben stehen {stream.Length} Bytes auf der Platte, erwartet waren {expected.Length}.");
        }

        var onDisk = await SHA256.HashDataAsync(stream, ct);
        var wanted = SHA256.HashData(expected);

        if (!CryptographicOperations.FixedTimeEquals(onDisk, wanted))
        {
            throw new IOException("Die geschriebene Datei stimmt nicht mit dem ueberein, was geschrieben werden sollte.");
        }

        return onDisk;
    }

    /// <summary>
    /// Can we actually write there?
    ///
    /// <para>
    /// <b>Asked before the move, not discovered during it.</b> The failure this
    /// catches is the quiet one: a path that resolves somewhere the application
    /// pool may not write. The move itself is safe either way — it never clears
    /// a row whose file did not land — but without this the administrator finds
    /// out by seeing a counter that refuses to go down, with no clue why.
    /// </para>
    ///
    /// <para>
    /// It writes a real file and removes it again. Checking for the directory
    /// alone would pass on a folder that exists and is read-only, which is
    /// exactly the case worth catching.
    /// </para>
    /// </summary>
    public static (bool Writable, string Root, string? Problem) Probe(IConfiguration config)
    {
        string root;
        try { root = Root(config); }
        catch (Exception exception) { return (false, "", exception.Message); }

        try
        {
            Directory.CreateDirectory(root);

            var probe = Path.Combine(root, ".probe-" + Guid.NewGuid().ToString("N") + ".tmp");
            File.WriteAllBytes(probe, [0x72, 0x63]);
            File.Delete(probe);

            return (true, root, null);
        }
        catch (Exception exception)
        {
            return (false, root, exception.Message);
        }
    }

    /// <summary>
    /// Open a stored photograph for sending.
    ///
    /// <c>null</c> when the file is not there. Deliberately not an exception:
    /// the caller can still fall back to the row, and during the move there is
    /// a legitimate window in which some photographs are in one place and some
    /// in the other.
    /// </summary>
    public static Stream? OpenRead(IConfiguration config, string relativePath)
    {
        var full = Path.Combine(Root(config), relativePath);
        if (!File.Exists(full)) return null;

        return new FileStream(
            full, FileMode.Open, FileAccess.Read, FileShare.Read, 64 * 1024, useAsync: true);
    }

    /// <summary>
    /// Remove a stored photograph.
    ///
    /// <para>
    /// Never throws. A file that cannot be deleted is wasted disk space; a
    /// deletion that throws would leave the row behind as well, and then the
    /// photograph is still in the gallery after somebody removed it. Of the two
    /// failures only one is visible to the person who pressed the button, and
    /// it is the wrong one.
    /// </para>
    /// </summary>
    public static void TryDelete(IConfiguration config, string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return;

        try
        {
            var full = Path.Combine(Root(config), relativePath);
            if (File.Exists(full)) File.Delete(full);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
}
