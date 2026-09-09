using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Recreatio.Api.Data;

namespace Recreatio.Api.Services.Events;

/// <summary>
/// Moves gallery photographs out of the database and onto the disk.
///
/// <para>
/// <b>Why this exists.</b> 105 photographs, 61 MB of JPEG and WebP, sitting in
/// <c>events.EventGalleryPhotos.Data</c> — half of a 123 MB data file that has
/// a hard 250 MB ceiling and 0.2 MB of room left inside it. When that ceiling
/// is reached it is not uploads that fail, it is every write: a confirmation
/// application, a mass intention, a login session. Meanwhile the hosting panel
/// reports <c>Pliki: 0 MB</c> — the disk beside it is empty.
/// </para>
///
/// <para>
/// <b>Why it runs on the administrator's login and not on a timer.</b> This is
/// a one-off with an end. A timer would go on asking a question forever whose
/// answer is "nothing to do", and would start moving files at three in the
/// morning with nobody watching. Tying it to a login means it runs while the
/// person who would want to know is present, and it stops for good once the
/// last photograph has moved.
/// </para>
///
/// <para>
/// <b>Why it does not run inside the login request.</b> 61 MB of reads and
/// writes on shared hosting is not a thing to make somebody wait for. The
/// request signals; this service does the work afterwards. A login that hangs
/// for a minute is a broken login, and it would be broken for the one person
/// who can fix anything.
/// </para>
///
/// <para>
/// <b>Every photograph moves on its own, and safely.</b> Write the file, flush
/// it to the device, read it back, compare the hash, and only then empty the
/// row. If anything fails, the row is untouched and the next run tries again.
/// There is no step at which the bytes exist in neither place.
/// </para>
/// </summary>
public sealed class GalleryPhotoOffload
{
    /// <summary>
    /// How many photographs one pass moves.
    ///
    /// Not all of them at once: each is held in memory while it is written, and
    /// on shared hosting the memory limit is the one that bites first. Twenty
    /// at roughly 600 KB is a bounded amount of work, and a pass that is
    /// interrupted has still moved twenty.
    /// </summary>
    private const int BatchSize = 20;

    /// <summary>
    /// A run that has to give up leaves the rest for the next login rather than
    /// hammering a disk that is refusing writes.
    /// </summary>
    private const int MaxFailuresPerRun = 5;

    private readonly IServiceScopeFactory scopeFactory;
    private readonly ILogger<GalleryPhotoOffload> logger;

    /*
     * ONE RUN AT A TIME.
     *
     * Two administrators logging in together would otherwise both start, read
     * the same rows, and write the same files. The per-row work is idempotent
     * so that would not corrupt anything — but it would double the memory and
     * the disk traffic for no gain.
     */
    private readonly SemaphoreSlim gate = new(1, 1);

    public GalleryPhotoOffload(IServiceScopeFactory scopeFactory, ILogger<GalleryPhotoOffload> logger)
    {
        this.scopeFactory = scopeFactory;
        this.logger = logger;
    }

    /// <summary>
    /// What happened. <paramref name="State"/> is the field that matters.
    ///
    /// <para>
    /// <b>Why it exists.</b> Without it this record answers "0 moved, 0
    /// failed, no error" to four completely different situations: nothing
    /// to do, switched off here, another run already going, and a run that
    /// genuinely moved nothing. The caller gets 200 OK and a page of
    /// zeroes, and has no way to tell which. That is a failure wearing the
    /// costume of a success, and it cost somebody a round-trip to ask what
    /// their own response meant.
    /// </para>
    /// </summary>
    /// <param name="State">
    /// <c>never-run</c> nothing has run in this process yet;
    /// <c>disabled</c> this installation may not move photographs
    /// (<c>Events:PhotoOffload</c> is not <c>true</c>);
    /// <c>busy</c> a run was already going, these are its figures so far;
    /// <c>ran</c> a pass actually completed - read the numbers.
    /// </param>
    /// <param name="Remaining">
    /// How many are still in the database. <c>-1</c> means NOT COUNTED,
    /// which is not the same as zero - and telling those two apart is the
    /// whole reason it is not simply 0.
    /// </param>
    public sealed record Progress(
        DateTimeOffset? StartedUtc, DateTimeOffset? FinishedUtc,
        int Moved, int Failed, int Remaining, long BytesMoved, string? LastError,
        string State);

    public const string StateNeverRun = "never-run";
    public const string StateDisabled = "disabled";
    public const string StateBusy = "busy";
    public const string StateRan = "ran";

    private volatile Progress last = new(null, null, 0, 0, -1, 0, null, StateNeverRun);

    public Progress Last => last;

    /// <summary>
    /// Start a run if one is not already going. Returns immediately.
    ///
    /// <para>
    /// Deliberately fire-and-forget: the caller is a login request that has
    /// nothing to do with the outcome. Every failure inside is logged and
    /// recorded in <see cref="Last"/>; nothing propagates back into the
    /// request, because a photograph that would not move is not a reason to
    /// refuse somebody their session.
    /// </para>
    /// </summary>
    public void RequestRun()
    {
        _ = Task.Run(async () =>
        {
            try { await RunAsync(CancellationToken.None); }
            catch (Exception exception)
            {
                logger.LogError(exception, "Gallery photo offload failed outright.");
            }
        });
    }

    public async Task<Progress> RunAsync(CancellationToken ct)
    {
        // Already running: report what that run has done so far rather than
        // queueing a second one behind it. Says so, rather than handing back
        // figures that look like the result of THIS call.
        if (!await gate.WaitAsync(0, ct)) return last with { State = StateBusy };

        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<RecreatioDbContext>();
            var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();

            /*
             * NOT HERE UNLESS THIS INSTALLATION SAYS SO.
             *
             * The check sits at the top of the run and not at the call
             * sites, because there are three of those - the login, the
             * start-up service, and the manual button - and a guard that
             * has to be repeated is a guard that will be forgotten at one
             * of them. This is the only place that empties a row, so this
             * is where the permission belongs.
             */
            if (!EventPhotoStore.OffloadEnabled(config))
            {
                logger.LogDebug(
                    "Gallery photo offload is switched off here ({Key} is not true).",
                    EventPhotoStore.OffloadKey);

                /*
                 * SAYS SO, LOUDLY.
                 *
                 * This is the single most likely reason for "I pressed it
                 * and nothing happened", because the switch is off by
                 * default and has to be set on the server on purpose. A
                 * caller who gets zeroes here must be able to read why
                 * without going to look at the source.
                 */
                return last with { State = StateDisabled, LastError = EventPhotoStore.OffloadKey + " is not true" };
            }

            var started = DateTimeOffset.UtcNow;
            int moved = 0, failed = 0;
            long bytes = 0;
            string? lastError = null;

            while (!ct.IsCancellationRequested && failed < MaxFailuresPerRun)
            {
                /*
                 * ONLY THE IDS FIRST.
                 *
                 * Selecting whole rows would pull twenty photographs into
                 * memory in one query and keep them there for the whole batch.
                 * The bytes are fetched one at a time, below, and released
                 * between photographs.
                 */
                var pending = await db.EventGalleryPhotos.AsNoTracking()
                    .Where(x => x.StoragePath == null && x.Data != null)
                    .OrderBy(x => x.CreatedUtc)
                    .Select(x => x.Id)
                    .Take(BatchSize)
                    .ToListAsync(ct);

                if (pending.Count == 0) break;

                foreach (var id in pending)
                {
                    try
                    {
                        var size = await MoveOneAsync(db, config, id, ct);
                        if (size > 0) { moved++; bytes += size; }
                    }
                    catch (Exception exception)
                    {
                        failed++;
                        lastError = exception.Message;
                        logger.LogError(exception, "Could not move gallery photo {PhotoId} to disk.", id);
                        if (failed >= MaxFailuresPerRun) break;
                    }
                }
            }

            var remaining = await db.EventGalleryPhotos.AsNoTracking()
                .CountAsync(x => x.StoragePath == null && x.Data != null, ct);

            last = new Progress(started, DateTimeOffset.UtcNow, moved, failed, remaining, bytes, lastError, StateRan);

            if (moved > 0)
            {
                logger.LogInformation(
                    "Moved {Moved} gallery photos ({Megabytes:F1} MB) to disk; {Remaining} left in the database.",
                    moved, bytes / 1048576.0, remaining);
            }

            return last;
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>
    /// One photograph. Returns the bytes moved, or 0 if there was nothing to do.
    ///
    /// <para>
    /// <b>The order here is the whole point.</b>
    /// </para>
    /// <code>
    ///   1. read the bytes from the row
    ///   2. write them to disk, flush to the device, read back, compare hash
    ///   3. only now: record the path and empty the column
    /// </code>
    /// <para>
    /// Step 3 is a single UPDATE, so the path and the emptying cannot come
    /// apart. If step 2 throws, the row still holds the photograph and the file
    /// — if any — is a harmless orphan that the next attempt overwrites. There
    /// is no ordering of these three in which the bytes exist nowhere.
    /// </para>
    /// </summary>
    private static async Task<long> MoveOneAsync(
        RecreatioDbContext db, IConfiguration config, Guid id, CancellationToken ct)
    {
        var photo = await db.EventGalleryPhotos.FirstOrDefaultAsync(x => x.Id == id, ct);

        // Gone, or moved by something else while we queued: both mean there is
        // nothing to do, and neither is an error.
        if (photo?.Data is null || photo.StoragePath is not null) return 0;

        var bytes = photo.Data;
        var relative = EventPhotoStore.RelativePathFor(photo.Id);

        var hash = await EventPhotoStore.WriteAsync(config, photo.Id, bytes, ct);

        photo.StoragePath = relative;
        photo.ContentSha256 = hash;
        photo.Data = null;

        // ByteSize was already the length; keep it honest in case an old row
        // disagreed with its own bytes.
        photo.ByteSize = bytes.Length;

        await db.SaveChangesAsync(ct);

        // Let the batch move on without holding this photograph.
        db.Entry(photo).State = EntityState.Detached;

        return bytes.Length;
    }
}

/// <summary>
/// Runs the move shortly after start-up as well.
///
/// <para>
/// The administrator's login is the trigger that was asked for, and it is the
/// right one — but it is not the only moment this should be able to happen. A
/// deployment that restarts the application while photographs are still in the
/// database would otherwise wait for somebody to sign in, and on a database
/// this close to full that wait has a cost.
/// </para>
///
/// <para>
/// The delay is there so the move does not compete with everything else a cold
/// start is doing. It runs ONCE: when there is nothing left to move the pass
/// is a single cheap count, and after it this service has no further reason to
/// wake up.
/// </para>
/// </summary>
public sealed class GalleryPhotoOffloadHostedService : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(3);

    private readonly GalleryPhotoOffload offload;
    private readonly ILogger<GalleryPhotoOffloadHostedService> logger;

    public GalleryPhotoOffloadHostedService(
        GalleryPhotoOffload offload, ILogger<GalleryPhotoOffloadHostedService> logger)
    {
        this.offload = offload;
        this.logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        try
        {
            var progress = await offload.RunAsync(stoppingToken);
            if (progress.Remaining > 0)
            {
                logger.LogWarning(
                    "{Remaining} gallery photos are still stored in the database.", progress.Remaining);
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception exception)
        {
            logger.LogError(exception, "Gallery photo offload failed on start-up.");
        }
    }
}
