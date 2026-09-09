using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Data;

namespace Recreatio.Api.Services.Events;

/// <summary>
/// Should the gallery move start because <i>this</i> person just signed in?
///
/// <para>
/// <b>Two questions, and the cheap one first.</b> "Is anything left to move" is
/// one indexed count against a filtered index that is empty once the job is
/// done. "Is this the events administrator" is a lookup in a table with a
/// handful of rows. Asking the cheap one first means that after the move is
/// finished, every login on the platform forever pays for one count that finds
/// nothing — and nothing else.
/// </para>
///
/// <para>
/// <b>Why it lives here and not in the endpoint.</b> The login handler should
/// read as a login handler. A maintenance decision spelled out in the middle of
/// it is how the next person editing authentication ends up reasoning about
/// photographs.
/// </para>
/// </summary>
public static class GalleryOffloadTrigger
{
    /// <summary>
    /// Matches <c>EventEndpoints.EventAdminScope</c>.
    ///
    /// Repeated rather than shared because that one is private to a partial
    /// class of endpoints; making it public to reach it from here would widen
    /// something for a reason that has nothing to do with it. If the scope key
    /// ever changes, the worst case is that the move waits for a start-up
    /// instead of a login — it does not stop happening.
    /// </summary>
    private const string EventAdminScope = "events";

    public static async Task<bool> ShouldRunForAsync(
        RecreatioDbContext dbContext, Guid userId, CancellationToken ct)
    {
        /*
         * IS THERE ANYTHING LEFT AT ALL.
         *
         * `ix_EventGalleryPhotos_pending` is filtered on `StoragePath IS NULL`,
         * so once every photograph has moved this index holds nothing and the
         * count is as close to free as a query gets. That is what makes it
         * acceptable on a path every single login goes through.
         */
        var pending = await dbContext.EventGalleryPhotos.AsNoTracking()
            .AnyAsync(x => x.StoragePath == null && x.Data != null, ct);

        if (!pending) return false;

        return await dbContext.PortalAdminAssignments.AsNoTracking()
            .AnyAsync(x => x.ScopeKey == EventAdminScope && x.UserId == userId, ct);
    }
}
